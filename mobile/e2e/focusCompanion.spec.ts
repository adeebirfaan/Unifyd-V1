import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const MINUTE = 60_000;
const CORS = { 'Access-Control-Allow-Origin': '*' };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const id = (n: number) => `00000000-0000-4000-9800-${String(n).padStart(12, '0')}`;
const visible = (page: Page, testID: string) => page.getByTestId(testID).filter({ visible: true });

type Row = Record<string, unknown> & { id: string; user_id: string; reflection?: string | null };
type FakeDb = { online: boolean; rows: Row[]; patches: Record<string, unknown>[] };

/** Fictional tasks and subjects and a fake `focus_sessions` table that also accepts the one-time reflection update. */
async function mock(page: Page, options: { tasks?: Record<string, unknown>[]; state?: (now: number) => unknown; online?: boolean } = {}) {
  const { client, userId } = await testClient();
  await client.auth.signOut();
  const db: FakeDb = { online: options.online ?? true, rows: [], patches: [] };
  await page.route('**/rest/v1/tasks?*', (route) => route.request().method() === 'GET' ? json(route, options.tasks ?? []) : route.fallback());
  await page.route('**/rest/v1/student_semester_courses*', (route) => json(route, [
    { id: id(100), user_id: userId, academic_session: '2026/2027', semester: 1, catalog_course_id: null, course_code: 'BCS3153', course_name: 'Software Evolution', credit_hours: 3, is_custom: true, created_at: '2026-10-01T00:00:00Z' },
  ]));
  await page.route('**/rest/v1/timetable_entries*', (route) => json(route, []));
  await page.route('**/rest/v1/focus_sessions*', (route) => {
    const request = route.request();
    if (!db.online) return route.abort('internetdisconnected');
    const url = new URL(request.url());
    const param = (name: string) => url.searchParams.get(name)?.replace(/^(eq|is)\./, '');
    if (request.method() === 'POST') {
      const row = request.postDataJSON() as Row;
      if (db.rows.some((item) => item.id === row.id)) return json(route, { code: '23505', message: 'duplicate key' }, 409);
      db.rows.push({ ...row, reflection: null });
      return route.fulfill({ status: 201, headers: CORS, body: '' });
    }
    if (request.method() === 'PATCH') {
      // The table's rule: only the owner's completed round, and only while it has no reflection.
      const body = request.postDataJSON() as Record<string, unknown>;
      db.patches.push({ id: param('id'), ...body });
      const row = db.rows.find((item) => item.id === param('id') && item.user_id === param('user_id') && item.reflection === null && item.status === 'completed');
      if (row) row.reflection = body.reflection as string;
      return json(route, row ? [{ id: row.id }] : []);
    }
    const wanted = param('id');
    return json(route, db.rows.filter((item) => item.user_id === param('user_id') && (!wanted || item.id === wanted)));
  });
  const state = options.state ? JSON.stringify(options.state(Date.now())) : '';
  await page.addInitScript(({ userId, state }) => {
    localStorage.setItem(`unifyd:semester-choice:${userId}`, JSON.stringify({ academicSession: '2026/2027', semester: 1 }));
    if (sessionStorage.getItem('companion-e2e-seeded')) return;
    sessionStorage.setItem('companion-e2e-seeded', '1');
    for (const key of ['focus-blocks', 'focus-reflections', 'focus-poof-hidden', 'focus-goal']) localStorage.removeItem(`unifyd:${key}:${userId}`);
    if (state) localStorage.setItem(`unifyd:focus-session:${userId}`, state); else localStorage.removeItem(`unifyd:focus-session:${userId}`);
  }, { userId, state });
  return { userId, db };
}

async function openFocus(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await visible(page, 'planner-quick-focus').click();
  await expect(visible(page, 'focus-dial')).toBeVisible();
}

const message = (page: Page) => visible(page, 'focus-poof-message');
const primary = (page: Page) => visible(page, 'focus-primary');
const local = (page: Page, key: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), key);

function seed(fields: Record<string, unknown>) {
  return {
    version: 1, status: 'idle', phase: 'focus', phaseMs: 25 * MINUTE, bankedMs: 0, runStartedAt: null, blockId: null, blockStartedAt: null, completedRounds: 0,
    settings: { preset: 'classic', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 },
    link: { courseId: null, subjectLabel: null, taskId: null, taskTitle: null }, notice: null, ...fields,
  };
}

test('Poof follows the timer: greets when ready, stays still while focusing and paused, celebrates, then floats on the break', async ({ page }) => {
  const { db } = await mock(page);
  await openFocus(page);
  await expect(message(page)).toHaveText('New here? A 15-minute Quick study round is an easy way to start.');
  await expect(visible(page, 'focus-poof-mascot')).toHaveAttribute('data-phase', 'idle');
  await page.clock.install();

  await primary(page).click();
  await expect(message(page)).toHaveText('Nice and steady. I’ll stay quiet while you focus.');
  await expect(visible(page, 'focus-poof-still')).toBeVisible();
  await expect(visible(page, 'focus-poof-mascot')).toHaveCount(0);
  await page.clock.fastForward(5 * MINUTE);
  // The timer is unaffected by Poof.
  await expect(visible(page, 'focus-time')).toHaveText('20:00');
  await primary(page).click();
  await expect(message(page)).toHaveText('Take a breath. Resume whenever you’re ready.');
  await expect(visible(page, 'focus-poof-still')).toBeVisible();
  await primary(page).click();
  await page.clock.fastForward(20 * MINUTE + 1_000);

  await expect(visible(page, 'focus-phase')).toHaveText('Short break');
  await expect(message(page)).toHaveText('Nice work! Rest your eyes for a bit.');
  await expect(visible(page, 'focus-poof-mascot')).toHaveAttribute('data-reactions', '1');
  await expect(visible(page, 'focus-reflection')).toContainText('How was your study session?');
  await visible(page, 'focus-reflection-skip').click();
  await expect(visible(page, 'focus-reflection')).toHaveCount(0);
  await expect(visible(page, 'focus-time')).toHaveText(/^4:5\d$/);

  // After the break: ready for round 2, with a suggestion from real data (a semester subject not studied this week).
  await expect.poll(() => db.rows.length).toBe(1);
  await page.clock.fastForward(5 * MINUTE);
  await expect(visible(page, 'focus-phase')).toHaveText('Ready');
  await expect(message(page)).toHaveText('BCS3153 — Software Evolution hasn’t had focus time this week. It could be a good one to pick next.');
  expect(db.patches).toEqual([]);
});

test('the fourth completed round gives an encouraging long-break message', async ({ page }) => {
  await mock(page, { state: (now) => seed({ status: 'running', runStartedAt: now - 24 * MINUTE, blockId: id(900), blockStartedAt: now - 24 * MINUTE, completedRounds: 3 }) });
  await openFocus(page);
  await page.clock.install();
  await page.clock.fastForward(MINUTE + 1_000);
  await expect(visible(page, 'focus-phase')).toHaveText('Long break');
  await expect(message(page)).toHaveText('Four rounds done. Enjoy a longer rest.');
  await expect(visible(page, 'focus-poof-mascot')).toHaveAttribute('data-reactions', '1');
});

test('a reflection is optional, saved once with its round, and kept on the device while offline', async ({ page }) => {
  const { userId, db } = await mock(page, { online: false });
  await openFocus(page);
  await page.clock.install();
  await visible(page, 'focus-preset-quick').click();
  await primary(page).click();
  await page.clock.fastForward(15 * MINUTE + 1_000);
  await visible(page, 'focus-reflect-tired').click();
  await expect(visible(page, 'focus-reflection')).toContainText('Thanks. Saved privately with this round.');
  await expect(visible(page, 'focus-reflect-great')).toHaveCount(0);
  const waiting = await local(page, `unifyd:focus-blocks:${userId}`);
  expect(waiting).toHaveLength(1);
  expect(await local(page, `unifyd:focus-reflections:${userId}`)).toEqual([{ id: waiting[0].id, reflection: 'tired' }]);

  // Back online: the round is saved first, then its reflection, once.
  db.online = true;
  await page.goBack();
  await visible(page, 'planner-quick-focus').click();
  await expect.poll(() => db.rows[0]?.reflection).toBe('tired');
  await expect.poll(() => local(page, `unifyd:focus-reflections:${userId}`)).toEqual([]);
  expect(db.rows).toHaveLength(1);
  expect(db.patches).toEqual([{ id: waiting[0].id, reflection: 'tired' }]);
});

test('a task due tomorrow becomes Poof’s ready suggestion, and its action links the task', async ({ page }) => {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
  await mock(page, { tasks: [{ id: id(1), title: 'Revise chapter 4', subject: 'BCS3153 — Software Evolution', deadline: tomorrow.toISOString(), status: 'pending' }] });
  await openFocus(page);
  await expect(message(page)).toHaveText('“Revise chapter 4” is due tomorrow. A 25-minute focus round could help you make a start.');
  await visible(page, 'focus-poof-action').click();
  await expect(visible(page, 'focus-task')).toContainText('Revise chapter 4');
  await expect(visible(page, 'focus-subject')).toContainText('BCS3153 — Software Evolution');
});

test('Poof can be hidden and stays hidden after a restart; Reduce Motion keeps Poof still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { userId } = await mock(page);
  await openFocus(page);
  await expect(visible(page, 'focus-poof-mascot')).toHaveAttribute('data-phase', 'static');
  await visible(page, 'focus-poof-hide').click();
  await expect(visible(page, 'focus-poof')).toHaveCount(0);
  await expect(visible(page, 'focus-poof-show')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), `unifyd:focus-poof-hidden:${userId}`)).toBe('1');
  await page.reload();
  await expect(visible(page, 'focus-dial')).toBeVisible();
  await expect(visible(page, 'focus-poof-show')).toBeVisible();
  await visible(page, 'focus-poof-show').click();
  await expect(visible(page, 'focus-poof')).toBeVisible();
});
