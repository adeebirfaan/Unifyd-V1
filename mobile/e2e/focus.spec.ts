import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const MINUTE = 60_000;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const id = (n: number) => `00000000-0000-4000-9600-${String(n).padStart(12, '0')}`;
const visible = (page: Page, testID: string) => page.getByTestId(testID).filter({ visible: true });

type FocusRow = Record<string, unknown> & { id: string };
/** A fake `focus_sessions` table: `online` false drops requests like a lost connection; rows are what was saved. */
type FakeDb = { online: boolean; rows: FocusRow[]; posts: number };

/**
 * Fictional subjects and open tasks, and a fake `focus_sessions` table, so nothing here touches real rows.
 * `outbox` seeds kept rounds waiting on the device (per student ID) before the app starts.
 */
async function mockLinks(page: Page, initialState?: (now: number) => unknown, options: { db?: Partial<FakeDb>; outbox?: (userId: string) => Record<string, unknown[]> } = {}) {
  const { client, userId } = await testClient();
  await client.auth.signOut();
  const tasks = [
    { id: id(1), title: 'Revise chapter 4', subject: 'BCS3153 — Software Evolution', deadline: new Date(Date.now() + 2 * 86_400_000).toISOString(), status: 'pending' },
    { id: id(2), title: 'Database quiz prep', subject: 'BCS2243 — Database Systems', deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(), status: 'ongoing' },
  ];
  const writes: string[] = [];
  await page.route('**/rest/v1/tasks?*', (route) => {
    if (route.request().method() !== 'GET') { writes.push(route.request().method()); return route.fallback(); }
    return json(route, tasks);
  });
  await page.route('**/rest/v1/student_semester_courses*', (route) => json(route, [
    { id: id(100), user_id: userId, academic_session: '2026/2027', semester: 1, catalog_course_id: null, course_code: 'BCS3153', course_name: 'Software Evolution', credit_hours: 3, is_custom: true, created_at: '2026-10-01T00:00:00Z' },
    { id: id(101), user_id: userId, academic_session: '2026/2027', semester: 1, catalog_course_id: null, course_code: 'BCS2243', course_name: 'Database Systems', credit_hours: 3, is_custom: true, created_at: '2026-10-01T00:00:00Z' },
  ]));
  await page.route('**/rest/v1/timetable_entries*', (route) => json(route, []));
  const db: FakeDb = { online: true, rows: [], posts: 0, ...options.db };
  await page.route('**/rest/v1/focus_sessions*', (route) => {
    const request = route.request();
    if (!db.online) return route.abort('internetdisconnected');
    if (request.method() === 'POST') {
      db.posts++;
      const row = request.postDataJSON() as FocusRow;
      if (db.rows.some((item) => item.id === row.id)) return json(route, { code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
      db.rows.push(row);
      return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    }
    // The duplicate check: the caller's own row with this ID, if any.
    const url = new URL(request.url());
    const wanted = url.searchParams.get('id')?.replace(/^eq\./, '');
    const owner = url.searchParams.get('user_id')?.replace(/^eq\./, '');
    return json(route, db.rows.filter((item) => item.id === wanted && item.user_id === owner).map((item) => ({ id: item.id })));
  });
  const state = initialState ? JSON.stringify(initialState(Date.now())) : '';
  const outbox = options.outbox ? options.outbox(userId) : {};
  await page.addInitScript(({ userId, state, outbox }) => {
    localStorage.setItem(`unifyd:semester-choice:${userId}`, JSON.stringify({ academicSession: '2026/2027', semester: 1 }));
    // Only on the first load, so a reload inside a test keeps what the app saved.
    if (!sessionStorage.getItem('focus-e2e-seeded')) {
      sessionStorage.setItem('focus-e2e-seeded', '1');
      localStorage.removeItem(`unifyd:focus-blocks:${userId}`);
      for (const [owner, items] of Object.entries(outbox)) localStorage.setItem(`unifyd:focus-blocks:${owner}`, JSON.stringify(items));
      if (state) localStorage.setItem(`unifyd:focus-session:${userId}`, state); else localStorage.removeItem(`unifyd:focus-session:${userId}`);
    }
  }, { userId, state, outbox });
  return { userId, writes, db };
}

async function openFocus(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await visible(page, 'planner-quick-focus').click();
  await expect(page).toHaveURL(/\/focus/);
  await expect(visible(page, 'focus-dial')).toBeVisible();
}

const time = (page: Page) => visible(page, 'focus-time');
const primary = (page: Page) => visible(page, 'focus-primary');
const blocks = (page: Page, userId: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), `unifyd:focus-blocks:${userId}`);
const stored = (page: Page, userId: string) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), `unifyd:focus-session:${userId}`);

/** A stored timer state in the app's format (see lib/focusTimer.ts). */
function seed(fields: Record<string, unknown>) {
  return {
    version: 1, status: 'idle', phase: 'focus', phaseMs: 25 * MINUTE, bankedMs: 0, runStartedAt: null, blockId: null, blockStartedAt: null, completedRounds: 0,
    settings: { preset: 'classic', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 },
    link: { courseId: null, subjectLabel: null, taskId: null, taskTitle: null }, notice: null, ...fields,
  };
}

test('a round runs from timestamps: pause time is not counted, the break starts itself, and the next round waits for Start', async ({ page }) => {
  const { userId, writes, db } = await mockLinks(page);
  await openFocus(page);
  await expect(visible(page, 'focus-phase')).toHaveText('Ready');
  await expect(time(page)).toHaveText('25:00');
  await expect(visible(page, 'focus-subject')).toContainText('General study');
  await expect(visible(page, 'focus-next-break')).toContainText('5 min short break');
  await page.clock.install();

  await primary(page).click();
  await expect(visible(page, 'focus-phase')).toHaveText('Focus');
  await expect(primary(page)).toHaveAccessibleName('Pause');
  await expect(visible(page, 'focus-locked-note')).toBeVisible();
  await expect(visible(page, 'focus-preset-deep')).toBeDisabled();
  await page.clock.fastForward(5 * MINUTE);
  await expect(time(page)).toHaveText('20:00');

  await primary(page).click();
  await expect(visible(page, 'focus-phase')).toHaveText('Paused');
  await page.clock.fastForward(30 * MINUTE);
  await expect(time(page)).toHaveText('20:00');
  await primary(page).click();
  await expect(primary(page)).toHaveAccessibleName('Pause');
  await page.clock.fastForward(19 * MINUTE + 59_000);
  await expect(time(page)).toHaveText('0:01');

  await page.clock.fastForward(2_000);
  await expect(visible(page, 'focus-phase')).toHaveText('Short break');
  await expect(visible(page, 'focus-notice')).toContainText('Round complete. Enjoy your break.');
  await expect(visible(page, 'focus-completed')).toContainText('1');
  // The kept round is saved to the account once, then leaves the device outbox.
  await expect.poll(() => db.rows.length).toBe(1);
  expect(db.rows[0]).toMatchObject({ user_id: userId, status: 'completed', focus_seconds: 1500, planned_focus_seconds: 1500, round_number: 1, preset: 'classic',
    subject_label: null, semester_course_id: null, task_id: null, task_title: null });
  await expect.poll(() => blocks(page, userId)).toEqual([]);
  await expect(visible(page, 'focus-sync')).toContainText('Your focus rounds are synced to your account.');

  await page.clock.fastForward(5 * MINUTE + 1_000);
  await expect(visible(page, 'focus-phase')).toHaveText('Ready');
  await expect(visible(page, 'focus-notice')).toContainText('Break’s over.');
  await expect(primary(page)).toHaveAccessibleName('Start round 2');
  await expect(time(page)).toHaveText('25:00');
  // The time does not move until the student starts the next round.
  await page.clock.fastForward(10 * MINUTE);
  await expect(time(page)).toHaveText('25:00');
  expect(db.rows).toHaveLength(1);
  expect(db.posts).toBe(1);
  // Tasks are never written by the timer.
  expect(writes).toEqual([]);
});

test('presets and custom durations set the timer within limits', async ({ page }) => {
  await mockLinks(page);
  await openFocus(page);
  for (const [preset, clock, rest] of [['deep', '50:00', '10 min short break'], ['quick', '15:00', '3 min short break'], ['classic', '25:00', '5 min short break']] as const) {
    await visible(page, `focus-preset-${preset}`).click();
    await expect(visible(page, `focus-preset-${preset}`)).toHaveAttribute('aria-checked', 'true');
    await expect(time(page)).toHaveText(clock);
    await expect(visible(page, 'focus-next-break')).toContainText(rest);
  }
  await visible(page, 'focus-preset-custom').click();
  await expect(visible(page, 'focus-custom')).toBeVisible();
  await visible(page, 'focus-focusMinutes-more').click();
  await expect(visible(page, 'focus-focusMinutes-value')).toHaveText('30 min');
  await expect(time(page)).toHaveText('30:00');
  for (let index = 0; index < 4; index++) await visible(page, 'focus-shortBreakMinutes-less').click();
  await expect(visible(page, 'focus-shortBreakMinutes-value')).toHaveText('1 min');
  await expect(visible(page, 'focus-shortBreakMinutes-less')).toBeDisabled();
  await expect(visible(page, 'focus-next-break')).toContainText('1 min short break');
  await visible(page, 'focus-longBreakMinutes-more').click();
  await expect(visible(page, 'focus-longBreakMinutes-value')).toHaveText('20 min');
  // The custom times are what the next round uses, and they survive leaving the screen.
  await page.goBack();
  await visible(page, 'planner-quick-focus').click();
  await expect(time(page)).toHaveText('30:00');
  await expect(visible(page, 'focus-preset-custom')).toHaveAttribute('aria-checked', 'true');
});

test('ending early keeps a partial round after confirmation; reset discards only the current round', async ({ page }) => {
  const { userId, db } = await mockLinks(page);
  await openFocus(page);
  await page.clock.install();
  await primary(page).click();
  await page.clock.fastForward(3 * MINUTE + 20_000);
  await visible(page, 'focus-end').click();
  const dialog = visible(page, 'focus-confirm');
  await expect(dialog).toContainText('3 min of focus will be kept as a partial round.');
  await dialog.getByRole('button', { name: 'Keep going' }).click();
  await expect(primary(page)).toHaveAccessibleName('Pause');
  await visible(page, 'focus-end').click();
  await visible(page, 'focus-confirm').getByRole('button', { name: 'End session' }).click();
  await expect(visible(page, 'focus-notice')).toContainText('Session ended. Your focus time was kept.');
  await expect(visible(page, 'focus-phase')).toHaveText('Ready');
  await expect.poll(() => db.rows.length).toBe(1);
  expect(db.rows[0]).toMatchObject({ status: 'partial', focus_seconds: 200, planned_focus_seconds: 1500 });
  await expect.poll(() => blocks(page, userId)).toEqual([]);

  await primary(page).click();
  await page.clock.fastForward(4 * MINUTE);
  await visible(page, 'focus-reset').click();
  await expect(visible(page, 'focus-confirm')).toContainText('Rounds you’ve completed stay kept.');
  await visible(page, 'focus-confirm').getByRole('button', { name: 'Discard round' }).click();
  await expect(visible(page, 'focus-notice')).toContainText('That round wasn’t kept.');
  await expect(time(page)).toHaveText('25:00');
  expect(db.rows).toHaveLength(1);

  // Under a minute: ending says nothing will be kept, and nothing is.
  await primary(page).click();
  await page.clock.fastForward(40_000);
  await visible(page, 'focus-end').click();
  await expect(visible(page, 'focus-confirm')).toContainText('less than a minute of focus');
  await visible(page, 'focus-confirm').getByRole('button', { name: 'End session' }).click();
  await expect(visible(page, 'focus-notice')).toContainText('That round wasn’t kept.');
  expect(db.rows).toHaveLength(1);
  expect(await blocks(page, userId)).toEqual([]);
});

test('a running round survives an app restart and keeps counting from its start time', async ({ page }) => {
  const { userId } = await mockLinks(page, (now) => seed({ status: 'running', runStartedAt: now - 10 * MINUTE, blockId: '7f1f6a3e-2f4b-4c3d-9a1b-1234567890ab', blockStartedAt: now - 10 * MINUTE }));
  await openFocus(page);
  await expect(visible(page, 'focus-phase')).toHaveText('Focus');
  await expect(time(page)).toHaveText(/^1[45]:\d\d$/);
  await expect(primary(page)).toHaveAccessibleName('Pause');
  await primary(page).click();
  const pausedText = await time(page).textContent();
  // A reload is a restart: the paused round comes back exactly, with no time added while closed.
  await page.reload();
  await expect(page).toHaveURL(/\/focus/);
  await expect(visible(page, 'focus-dial')).toBeVisible();
  await expect(time(page)).toHaveText(pausedText!);
  await expect(visible(page, 'focus-phase')).toHaveText('Paused');
  expect(await stored(page, userId)).toMatchObject({ status: 'paused', blockId: '7f1f6a3e-2f4b-4c3d-9a1b-1234567890ab' });
});

test('a round that ended while the app was closed is kept once, and its break has already run', async ({ page }) => {
  const { db } = await mockLinks(page, (now) => seed({ status: 'running', runStartedAt: now - 40 * MINUTE, blockId: '7f1f6a3e-2f4b-4c3d-9a1b-000000000001', blockStartedAt: now - 40 * MINUTE, completedRounds: 3 }));
  await openFocus(page);
  // Round 4 finished 15 minutes ago, so its 15-minute long break has just ended: ready for round 5.
  await expect(visible(page, 'focus-phase')).toHaveText('Ready');
  await expect(primary(page)).toHaveAccessibleName('Start round 5');
  await expect(visible(page, 'focus-completed')).toContainText('4');
  await expect(visible(page, 'focus-next-break')).toContainText('5 min short break');
  await expect.poll(() => db.rows.length).toBe(1);
  expect(db.rows[0]).toMatchObject({ id: '7f1f6a3e-2f4b-4c3d-9a1b-000000000001', status: 'completed', round_number: 4, focus_seconds: 1500 });
});

test('subject and task are optional links to the student’s own semester subjects and open tasks', async ({ page }) => {
  await mockLinks(page);
  await openFocus(page);
  await visible(page, 'focus-subject').click();
  const subjects = visible(page, 'focus-subject-sheet');
  await expect(subjects.getByRole('radio')).toHaveCount(3);
  await expect(subjects.getByRole('radio', { name: 'General study' })).toHaveAttribute('aria-checked', 'true');
  await subjects.getByRole('radio', { name: 'BCS3153 — Software Evolution' }).click();
  await expect(visible(page, 'focus-subject')).toContainText('BCS3153 — Software Evolution');

  await visible(page, 'focus-task').click();
  const taskSheet = visible(page, 'focus-task-sheet');
  await expect(taskSheet.getByRole('radio')).toHaveCount(2);
  await expect(taskSheet.getByRole('radio', { name: /Database quiz prep/ })).toHaveCount(0);
  await taskSheet.getByTestId('focus-task-scope').click();
  await expect(taskSheet.getByRole('radio')).toHaveCount(3);
  await taskSheet.getByRole('radio', { name: /Database quiz prep/ }).click();
  // Choosing a task links its own subject.
  await expect(visible(page, 'focus-task')).toContainText('Database quiz prep');
  await expect(visible(page, 'focus-subject')).toContainText('BCS2243 — Database Systems');

  // Linked choices lock while the round runs, and General study is one tap away between rounds.
  await primary(page).click();
  await expect(visible(page, 'focus-subject')).toBeDisabled();
  await visible(page, 'focus-reset').click();
  await visible(page, 'focus-confirm').getByRole('button', { name: 'Discard round' }).click();
  await visible(page, 'focus-subject').click();
  await visible(page, 'focus-subject-sheet').getByRole('radio', { name: 'General study' }).click();
  await expect(visible(page, 'focus-subject')).toContainText('General study');
  await expect(visible(page, 'focus-task')).toContainText('No task');
});

/** A kept round already waiting in the outbox, in the app's format (see FocusBlock in lib/focusTimer.ts). */
function waiting(n: number, fields: Record<string, unknown> = {}) {
  const ended = Date.now() - n * 60 * MINUTE;
  return {
    id: `7f1f6a3e-2f4b-4c3d-9a1b-00000000010${n}`, status: 'partial', preset: 'deep', plannedFocusSeconds: 3000, focusSeconds: 600 * n, roundNumber: 1,
    startedAt: new Date(ended - 600 * n * 1000).toISOString(), endedAt: new Date(ended).toISOString(),
    courseId: null, subjectLabel: 'BCS3153 — Software Evolution', taskId: null, taskTitle: null, ...fields,
  };
}

test('offline: a kept round waits on the device, says so, survives sign-out, and syncs once the connection is back', async ({ page }) => {
  const { userId, db } = await mockLinks(page, undefined, { db: { online: false } });
  await openFocus(page);
  await page.clock.install();
  await visible(page, 'focus-preset-quick').click();
  await primary(page).click();
  await page.clock.fastForward(15 * MINUTE + 1_000);
  await expect(visible(page, 'focus-phase')).toHaveText('Short break');
  await expect(visible(page, 'focus-sync')).toContainText('1 round is saved on this device and will sync when you’re online.');
  expect(await blocks(page, userId)).toMatchObject([{ status: 'completed', focusSeconds: 900, plannedFocusSeconds: 900 }]);
  expect(db.rows).toHaveLength(0);

  // Signing out keeps the round on the device for this student.
  await page.goBack();
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Open profile' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(await blocks(page, userId)).toHaveLength(1);

  // Back online and signed in again: it is sent once, and the timer is untouched.
  db.online = true;
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect.poll(() => db.rows.length).toBe(1);
  expect(db.rows[0]).toMatchObject({ user_id: userId, status: 'completed', focus_seconds: 900, preset: 'quick' });
  await expect.poll(() => blocks(page, userId)).toEqual([]);
  await page.getByRole('tab', { name: 'Planner' }).click();
  await visible(page, 'planner-quick-focus').click();
  await expect(visible(page, 'focus-sync')).toContainText('Your focus rounds are synced to your account.');
  await expect(visible(page, 'focus-completed')).toContainText('1');
  expect(db.posts).toBe(1);
});

test('rounds left from an earlier session sync after sign-in; another account’s rounds stay on the device and are never sent', async ({ page }) => {
  const other = '00000000-0000-4000-8000-00000000beef';
  const { userId, db } = await mockLinks(page, undefined, { outbox: (userId) => ({ [userId]: [waiting(1), waiting(2)], [other]: [waiting(3)] }) });
  await openFocus(page);
  await expect.poll(() => db.rows.length).toBe(2);
  expect(db.rows.map((row) => [row.user_id, row.focus_seconds, row.status, row.subject_label])).toEqual([
    [userId, 600, 'partial', 'BCS3153 — Software Evolution'], [userId, 1200, 'partial', 'BCS3153 — Software Evolution'],
  ]);
  await expect.poll(() => blocks(page, userId)).toEqual([]);
  expect(await blocks(page, other)).toMatchObject([{ id: waiting(3).id }]);
});

test('a retry after a lost confirmation never duplicates; an ID owned by someone else is saved under a new ID', async ({ page }) => {
  const other = '00000000-0000-4000-8000-00000000beef';
  const { userId, db } = await mockLinks(page, undefined, { outbox: (userId) => ({ [userId]: [waiting(1), waiting(2)] }) });
  // Round 1 reached the database earlier but the app never heard back; round 2's ID is (very unusually) taken.
  db.rows.push({ id: waiting(1).id, user_id: userId }, { id: waiting(2).id, user_id: other });
  await openFocus(page);
  await expect.poll(() => db.rows.length).toBe(3);
  await expect.poll(() => blocks(page, userId)).toEqual([]);
  expect(db.rows.filter((row) => row.id === waiting(1).id)).toHaveLength(1);
  const moved = db.rows[2];
  expect(moved.id).not.toBe(waiting(2).id);
  expect(moved).toMatchObject({ user_id: userId, focus_seconds: 1200 });
  expect(db.rows.find((row) => row.id === waiting(2).id)).toEqual({ id: waiting(2).id, user_id: other });
});
