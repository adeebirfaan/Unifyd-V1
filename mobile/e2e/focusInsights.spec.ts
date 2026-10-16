import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const CORS = { 'Access-Control-Allow-Origin': '*' };
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
const visible = (page: Page, testID: string) => page.getByTestId(testID).filter({ visible: true });
// "Now" in these tests: Thursday 15 Oct 2026, 21:00 in Kuala Lumpur (the app's local time here).
const NOW = new Date('2026-10-15T21:00:00+08:00');
const kl = (day: number, time: string) => `2026-10-${String(day).padStart(2, '0')}T${time}:00+08:00`;
let seq = 0;

type Row = { id: string; subject_label: string | null; task_title: string | null; focus_seconds: number; planned_focus_seconds: number; status: string; started_at: string; ended_at: string };
function row(fields: Partial<Row> & { ended_at: string }): Row {
  const id = `00000000-0000-4000-9700-${String(++seq).padStart(12, '0')}`;
  return { id, subject_label: null, task_title: null, focus_seconds: 1500, planned_focus_seconds: 1500, status: 'completed', started_at: fields.ended_at, ...fields };
}

/** A fake `focus_sessions` table (newest first, paged by offset/limit) and, optionally, rounds waiting on the device. */
async function mockInsights(page: Page, rows: Row[], options: { readFails?: boolean; device?: (userId: string) => unknown[]; goal?: unknown } = {}) {
  const { client, userId } = await testClient();
  await client.auth.signOut();
  const sorted = [...rows].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const posts: unknown[] = [];
  await page.route('**/rest/v1/focus_sessions*', (route) => {
    const request = route.request();
    // Saving is "offline" here, so device rounds stay on the device for the whole test.
    if (request.method() === 'POST') { posts.push(request.postDataJSON()); return route.abort('internetdisconnected'); }
    if (options.readFails) return route.abort('internetdisconnected');
    const url = new URL(request.url());
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? 1000);
    return json(route, sorted.slice(offset, offset + limit));
  });
  await page.route('**/rest/v1/tasks?*', (route) => route.request().method() === 'GET' ? json(route, []) : route.fallback());
  await page.route('**/rest/v1/student_semester_courses*', (route) => json(route, []));
  await page.route('**/rest/v1/timetable_entries*', (route) => json(route, []));
  await page.addInitScript(({ userId, device, goal }) => {
    if (sessionStorage.getItem('insights-e2e-seeded')) return;
    sessionStorage.setItem('insights-e2e-seeded', '1');
    localStorage.removeItem(`unifyd:focus-session:${userId}`);
    localStorage.setItem(`unifyd:focus-blocks:${userId}`, JSON.stringify(device));
    if (goal) localStorage.setItem(`unifyd:focus-goal:${userId}`, JSON.stringify(goal)); else localStorage.removeItem(`unifyd:focus-goal:${userId}`);
  }, { userId, device: options.device ? options.device(userId) : [], goal: options.goal ?? null });
  await page.clock.setFixedTime(NOW);
  return { userId, posts };
}

async function openInsights(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await visible(page, 'planner-quick-focus').click();
  await visible(page, 'focus-insights-link').click();
  await expect(page).toHaveURL(/\/focus-insights/);
  await expect(visible(page, 'focus-today')).toBeVisible();
}

const label = (page: Page, testID: string) => visible(page, testID).getAttribute('aria-label');

test('figures use recorded focus time only, by the local day each round ended, with device rounds counted once', async ({ page }) => {
  const synced = [
    row({ subject_label: 'BCS3153 — Software Evolution', task_title: 'Revise chapter 4', started_at: kl(15, '09:00'), ended_at: kl(15, '09:40') }), // 25 min of focus, 15 min paused
    row({ subject_label: 'BCS3153 — Software Evolution', status: 'partial', focus_seconds: 600, planned_focus_seconds: 3000, started_at: kl(15, '13:00'), ended_at: kl(15, '13:10') }),
    row({ subject_label: 'Deleted subject', started_at: kl(13, '23:40'), ended_at: kl(14, '00:05') }), // crosses midnight: counts on Wednesday
    row({ subject_label: null, focus_seconds: 3000, planned_focus_seconds: 3000, started_at: kl(12, '08:00'), ended_at: kl(12, '08:50') }),
    row({ subject_label: 'Last week', started_at: kl(11, '20:00'), ended_at: kl(11, '20:25') }),
  ];
  const { userId, posts } = await mockInsights(page, synced, { device: () => [
    // The same round as a synced row (it was saved, but the device has not heard back yet): counted once.
    { id: synced[1].id, status: 'partial', preset: 'deep', plannedFocusSeconds: 3000, focusSeconds: 600, roundNumber: 1, startedAt: synced[1].started_at, endedAt: synced[1].ended_at, courseId: null, subjectLabel: 'BCS3153 — Software Evolution', taskId: null, taskTitle: null },
    // A round only on the device.
    { id: '00000000-0000-4000-9700-000000000999', status: 'completed', preset: 'quick', plannedFocusSeconds: 900, focusSeconds: 900, roundNumber: 1, startedAt: kl(15, '20:00'), endedAt: kl(15, '20:15'), courseId: null, subjectLabel: null, taskId: null, taskTitle: null },
  ] });
  await openInsights(page);

  expect(await label(page, 'focus-today')).toBe('Today, 50 min');
  expect(await label(page, 'focus-this-week')).toBe('This week, 2 h 5 min'); // 50 + 25 + 50
  expect(await label(page, 'focus-rounds')).toBe('Rounds this week, 5, 4 completed · 1 partial');
  await expect(visible(page, 'focus-insights-device')).toContainText('Includes 1 round saved on this device that hasn’t synced yet.');

  // Monday–Sunday bars by the local day each round ended.
  expect(await label(page, 'focus-day-2026-10-12')).toBe('Monday: 50 min');
  expect(await label(page, 'focus-day-2026-10-13')).toBe('Tuesday: 0 min');
  expect(await label(page, 'focus-day-2026-10-14')).toBe('Wednesday: 25 min');
  expect(await label(page, 'focus-day-2026-10-15')).toBe('Thursday: 50 min');
  expect(await label(page, 'focus-day-2026-10-18')).toBe('Sunday: 0 min');
  await expect(visible(page, 'focus-week')).toContainText('2 h 5 min');

  // Subjects over the last 30 days, by saved label (a deleted subject keeps its name), adding up to 100%.
  const subjects = await visible(page, 'focus-subjects').getByTestId('focus-subject-row').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(subjects).toEqual(['General study: 1 h 5 min, 43%', 'BCS3153 — Software Evolution: 35 min, 23%', 'Deleted subject: 25 min, 17%', 'Last week: 25 min, 17%']);

  // History: newest first, device round marked, completed/partial in words, task shown.
  const history = await visible(page, 'focus-history').getByTestId('focus-history-row').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(history).toHaveLength(6);
  expect(history[0]).toMatch(/^General study, Thu, 15 Oct.*8:15.*, 15 min, Completed, On this device$/);
  expect(history[1]).toMatch(/^BCS3153 — Software Evolution, Thu, 15 Oct.*, 10 min, Partial$/);
  expect(history[2]).toMatch(/^BCS3153 — Software Evolution, Revise chapter 4, Thu, 15 Oct.*, 25 min, Completed$/);
  expect(history[3]).toMatch(/^Deleted subject, Wed, 14 Oct/);
  expect(posts.length).toBeGreaterThan(0); // it tried to sync the waiting round; it stays on the device while offline
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').length, `unifyd:focus-blocks:${userId}`)).toBe(2);
});

test('no rounds yet: calm zero figures, no percentages, and empty chart and history messages', async ({ page }) => {
  await mockInsights(page, []);
  await openInsights(page);
  expect(await label(page, 'focus-today')).toBe('Today, 0 min');
  expect(await label(page, 'focus-rounds')).toBe('Rounds this week, 0, 0 completed · 0 partial');
  await expect(visible(page, 'focus-week')).toContainText('No focus time this week yet.');
  await expect(visible(page, 'focus-subjects')).toContainText('No focus time in the last 30 days.');
  await expect(visible(page, 'focus-subjects').getByTestId('focus-subject-row')).toHaveCount(0);
  await expect(visible(page, 'focus-history-empty')).toContainText('No focus rounds yet.');
  await expect(visible(page, 'focus-insights-device')).toHaveCount(0);
});

test('when synced history cannot load, rounds on this device still show, with a retry', async ({ page }) => {
  await mockInsights(page, [], { readFails: true, device: () => [
    { id: '00000000-0000-4000-9700-000000000998', status: 'partial', preset: 'classic', plannedFocusSeconds: 1500, focusSeconds: 720, roundNumber: 1, startedAt: kl(15, '18:00'), endedAt: kl(15, '18:20'), courseId: null, subjectLabel: 'BCS2243 — Database Systems', taskId: null, taskTitle: 'Quiz prep' },
  ] });
  await openInsights(page);
  await expect(visible(page, 'focus-insights-error')).toContainText('Showing rounds on this device only.');
  await expect(visible(page, 'focus-insights-error').getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(await label(page, 'focus-today')).toBe('Today, 12 min');
  const history = await visible(page, 'focus-history').getByTestId('focus-history-row').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
  expect(history).toEqual([expect.stringMatching(/^BCS2243 — Database Systems, Quiz prep, .*, 12 min, Partial, On this device$/)]);
});

test('history loads 20 rounds at a time, newest first, without repeats', async ({ page }) => {
  const rows = Array.from({ length: 25 }, (_, index) => row({ subject_label: `Subject ${index + 1}`, ended_at: new Date(NOW.getTime() - (index + 1) * 3_600_000).toISOString() }));
  await mockInsights(page, rows);
  await openInsights(page);
  const items = visible(page, 'focus-history').getByTestId('focus-history-row');
  await expect(items).toHaveCount(20);
  await expect(items.first()).toHaveAttribute('aria-label', /^Subject 1,/);
  await visible(page, 'focus-history-more').click();
  await expect(items).toHaveCount(25);
  await expect(items.last()).toHaveAttribute('aria-label', /^Subject 25,/);
  await expect(visible(page, 'focus-history-more')).toHaveCount(0);
});

test('an optional daily or weekly goal shows calm progress and is remembered on this device', async ({ page }) => {
  await mockInsights(page, [row({ ended_at: kl(15, '10:00') }), row({ ended_at: kl(13, '10:00'), focus_seconds: 3000, planned_focus_seconds: 3000 })]);
  await openInsights(page);
  await expect(visible(page, 'focus-goal')).toContainText('No goal set. A goal is optional.');
  await visible(page, 'focus-goal-edit').click();
  await visible(page, 'focus-goal-day').click();
  await expect(visible(page, 'focus-goal-value')).toHaveText('1 h 0 min');
  await visible(page, 'focus-goal-less').click();
  await expect(visible(page, 'focus-goal-value')).toHaveText('45 min');
  await expect(visible(page, 'focus-goal-progress')).toHaveAttribute('aria-label', '25 min of 45 min today');
  await visible(page, 'focus-goal-week').click();
  await expect(visible(page, 'focus-goal-progress')).toHaveAttribute('aria-label', '1 h 15 min of 5 h 0 min this week');
  for (let index = 0; index < 8; index++) await visible(page, 'focus-goal-less').click();
  await expect(visible(page, 'focus-goal-value')).toHaveText('1 h 0 min');
  await expect(visible(page, 'focus-goal-less')).toBeDisabled();
  await expect(visible(page, 'focus-goal-progress')).toHaveAttribute('aria-label', '1 h 15 min of 1 h 0 min this week. Goal reached. Nice work.');
  await visible(page, 'focus-goal-done').click();
  await expect(visible(page, 'focus-goal-editor')).toHaveCount(0);
  // Remembered after a restart; "Off" removes it.
  await page.reload();
  await expect(visible(page, 'focus-goal-progress')).toHaveAttribute('aria-label', /this week. Goal reached/);
  await visible(page, 'focus-goal-edit').click();
  await visible(page, 'focus-goal-off').click();
  await expect(visible(page, 'focus-goal')).toContainText('No goal set.');
});

test('Poof’s suggestions on Focus insights use recorded facts only, and are left out when there is nothing to say', async ({ page }) => {
  await mockInsights(page, [row({ ended_at: kl(15, '10:00') }), row({ ended_at: kl(15, '12:00'), status: 'partial', focus_seconds: 1500, planned_focus_seconds: 3000 })], { goal: { period: 'day', minutes: 90 } });
  await openInsights(page);
  // 50 min of a 90 min daily goal: 40 min left (shown from half-way only).
  await expect(visible(page, 'focus-suggestions').getByTestId('focus-suggestion')).toContainText(['40 min more to reach today’s goal.']);
});
