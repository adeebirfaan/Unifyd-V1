import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const id = (n: number) => `00000000-0000-4000-9500-${String(n).padStart(12, '0')}`;
const at = (offset: number) => new Date(Date.now() + offset).toISOString();

/** Minutes left in today's Kuala Lumpur day (the app's local day in these tests). */
function minutesLeftToday() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return 24 * 60 - (value('hour') * 60 + value('minute'));
}
/** ISO weekday (Monday = 1) of tomorrow in Kuala Lumpur. */
function tomorrowWeekday() {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short' }).format(new Date(Date.now() + 24 * HOUR));
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
}

type Task = { title: string; priority: 'low' | 'medium' | 'high'; deadline: string; status?: 'pending' | 'ongoing' | 'completed'; subject?: string };
type Data = { tasks?: Task[]; choice?: boolean; courses?: { code: string | null; name: string; credits: number | null }[]; classes?: boolean };

/** Planner reads are mocked from one fictional data set, so nothing touches or depends on real rows. */
async function mockStudies(page: Page, data: Data) {
  const { client, userId } = await testClient();
  await client.auth.signOut();
  const rows = (data.tasks ?? []).map((task, index) => ({
    id: id(index + 1), user_id: userId, title: task.title, subject: task.subject ?? 'BCS3153 — Software Evolution', description: null, deadline: task.deadline,
    priority: task.priority, status: task.status ?? 'pending', completed_at: task.status === 'completed' ? at(-HOUR) : null,
    created_at: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(), reminder_offset_minutes: null,
  }));
  await page.route('**/rest/v1/tasks?*', (route) => route.request().method() === 'GET' ? json(route, rows) : route.fallback());
  await page.route('**/rest/v1/student_semester_courses*', (route) => json(route, (data.courses ?? []).map((course, index) => ({
    id: id(100 + index), user_id: userId, academic_session: '2026/2027', semester: 1, catalog_course_id: null, course_code: course.code, course_name: course.name,
    credit_hours: course.credits, is_custom: true, created_at: '2026-10-01T00:00:00Z',
  }))));
  await page.route('**/rest/v1/timetable_entries*', (route) => json(route, data.classes ? [{
    id: id(200), academic_session: '2026/2027', semester: 1, student_semester_course_id: null, course_code: 'BCS3153', course_name: 'SOFTWARE EVOLUTION & MAINTENANCE',
    day_of_week: tomorrowWeekday(), start_time: '08:00:00', end_time: '09:50:00', location: 'BZ-01-112', section_label: null, entry_source: 'manual',
  }] : []));
  // The semester last chosen in My semester lives in AsyncStorage (localStorage on the web).
  await page.addInitScript(({ key, value }) => { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); },
    { key: `unifyd:semester-choice:${userId}`, value: data.choice ? JSON.stringify({ academicSession: '2026/2027', semester: 1 }) : '' });
  return rows;
}

async function openStudies(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await expect(visible(page, 'planner-quick-actions')).toBeVisible();
}

const visible = (page: Page, testID: string) => page.getByTestId(testID).filter({ visible: true });
const dot = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^Studies card \\d+ of \\d+: ${name}$`) }).filter({ visible: true });
const frontCard = (page: Page, name: string) => expect(dot(page, name)).toHaveAttribute('aria-selected', 'true');

const left = minutesLeftToday();
const sample: Task[] = [
  { title: 'Low tomorrow', priority: 'low', deadline: at(26 * HOUR) },
  { title: 'Done essay', priority: 'high', deadline: at(-3 * HOUR), status: 'completed' },
  { title: 'High in 5 days', priority: 'high', deadline: at(5 * 24 * HOUR) },
  { title: 'Overdue recent', priority: 'high', deadline: at(-HOUR) },
  { title: 'Medium in 2 days', priority: 'medium', deadline: at(2 * 24 * HOUR) },
  { title: 'Due later today', priority: 'low', deadline: at(Math.max(1, Math.floor(left / 2)) * MINUTE), status: 'ongoing' },
  { title: 'High in 3 days', priority: 'high', deadline: at(3 * 24 * HOUR) },
  { title: 'Overdue oldest', priority: 'low', deadline: at(-48 * HOUR) },
];

test('the long rows are replaced by four icon shortcuts that open the existing screens', async ({ page }) => {
  await mockStudies(page, { tasks: sample, choice: true, courses: [{ code: 'BCS3153', name: 'Software Evolution', credits: 3 }], classes: true });
  await openStudies(page);
  await expect(page.getByText('Keep assignments and deadlines in view.')).toHaveCount(0);
  const quick = visible(page, 'planner-quick-actions');
  await expect(quick.getByRole('button')).toHaveCount(4);
  for (const [name, url] of [['Add task', /\/add-task/], ['My semester', /\/my-semester/], ['My timetable', /\/timetable/], ['Reminders', /\/reminders/]] as const) {
    await quick.getByRole('button', { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await page.goBack();
    await expect(visible(page, 'planner-quick-actions')).toBeVisible();
  }
  // Every shortcut keeps a 44 pt target.
  for (const key of ['add', 'semester', 'timetable', 'reminders']) expect((await visible(page, `planner-quick-${key}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('priority tasks follow the rules, show at most five incomplete tasks, and View all lists every task', async ({ page }) => {
  test.skip(left < 3, 'too close to midnight for a due-today task');
  await mockStudies(page, { tasks: sample });
  await openStudies(page);
  const list = visible(page, 'priority-tasks');
  const titles = list.getByRole('button', { name: /^Open task / });
  await expect(titles).toHaveCount(5);
  const names = await titles.evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('aria-label') ?? '').replace(/^Open task (.*?)\. .*$/, '$1')));
  expect(names).toEqual(['Overdue oldest', 'Overdue recent', 'Due later today', 'High in 3 days', 'High in 5 days']);
  await expect(list).not.toContainText('Done essay');
  // Statuses are written out, never colour alone; every row shows its priority.
  await expect(list.getByText('Overdue', { exact: true })).toHaveCount(2);
  await expect(list.getByText('Due today', { exact: true })).toHaveCount(1);
  await expect(list.getByText('High', { exact: true })).toHaveCount(3);

  await expect(visible(page, 'view-all-tasks')).toHaveText(/View all \(8\)/);
  await visible(page, 'view-all-tasks').click();
  const sheet = page.getByTestId('all-tasks-sheet');
  await expect(sheet.getByRole('heading', { name: 'All tasks' })).toBeVisible();
  await expect(sheet).toContainText('8 tasks');
  await expect(sheet.getByText('To do (7)')).toBeVisible();
  await expect(sheet.getByText('Completed (1)')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Open task / })).toHaveCount(8);
  await expect(sheet.getByRole('button', { name: 'Reopen task Done essay' })).toBeVisible();
  await sheet.getByTestId('all-tasks-close').click();
  await expect(page.getByTestId('all-tasks-sheet')).toHaveCount(0);
});

test('Academic focus leads the Studies deck on the brand gradient; cards change in one stable place, above the shortcuts', async ({ page }) => {
  test.skip(left < 3, 'too close to midnight for a due-today task');
  await mockStudies(page, { tasks: sample, choice: true, classes: true, courses: [{ code: 'BCS3153', name: 'Software Evolution', credits: 3 }, { code: null, name: 'Malay for Communication', credits: null }] });
  await openStudies(page);
  const card = (key: string) => visible(page, `studies-deck-card-${key}`);
  const below = async () => (await visible(page, 'planner-quick-actions').boundingBox())!;

  // Order: header, deck, dots, shortcuts, then Priority tasks.
  const deckBox = (await visible(page, 'studies-deck').boundingBox())!;
  const dotBox = (await dot(page, 'Academic focus').boundingBox())!;
  const quickBox = await below();
  const priorityBox = (await page.getByRole('heading', { name: 'Priority tasks' }).boundingBox())!;
  expect(dotBox.y).toBeGreaterThan(deckBox.y + deckBox.height - 1);
  expect(quickBox.y).toBeGreaterThan(dotBox.y + dotBox.height - 1);
  expect(priorityBox.y).toBeGreaterThan(quickBox.y + quickBox.height - 1);

  // Card 1 (default): Academic focus from the real tasks, on the gradient, with the guide.
  await frontCard(page, 'Academic focus');
  const focus = visible(page, 'studies-focus');
  await expect(focus.getByTestId('studies-focus-overdue')).toHaveAttribute('aria-label', 'Overdue: 2');
  await expect(focus.getByTestId('studies-focus-today')).toHaveAttribute('aria-label', 'Due today: 1');
  await expect(focus.getByTestId('studies-focus-upcoming')).toHaveAttribute('aria-label', 'Upcoming: 4');
  await expect(focus.getByTestId('studies-progress')).toHaveText('1 of 8 tasks completed');
  expect(await card('tasks').evaluate((node) => [...node.querySelectorAll('div')].some((el) => getComputedStyle(el).backgroundImage.includes('linear-gradient')))).toBe(true);
  await expect(card('tasks').getByTestId('studies-deck-hint')).toContainText('Swipe or tap the cards behind for Today and Semester');
  // The guide sits below the progress, inside the card.
  const hintBox = (await card('tasks').getByTestId('studies-deck-hint').boundingBox())!;
  const progressBox = (await focus.getByTestId('studies-progress').boundingBox())!;
  expect(hintBox.y).toBeGreaterThan(progressBox.y + progressBox.height);
  await expect(page.getByTestId('studies-deck-hint')).toHaveCount(1);
  await page.waitForTimeout(700); // let the deck finish sizing to its tallest card
  const first = (await card('tasks').boundingBox())!;
  const layout = await below();

  // A tap on the peeking edge brings Today forward in exactly the same place; nothing below moves.
  await page.mouse.click(first.x + first.width / 2, first.y - 9);
  await frontCard(page, 'Today');
  await page.waitForTimeout(700);
  await expect(visible(page, 'planner-next-class')).toContainText('BCS3153 · SOFTWARE EVOLUTION & MAINTENANCE');
  await expect(visible(page, 'planner-next-class')).toContainText('Tomorrow, 08:00–09:50');
  await expect(visible(page, 'planner-next-class')).toContainText('BZ-01-112');
  await expect(visible(page, 'planner-next-class')).not.toContainText('Starts in');
  await expect(card('today').getByTestId('studies-deck-hint')).toHaveCount(0);
  const same = (box: { x: number; y: number; width: number; height: number }) => { for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[key] - first[key])).toBeLessThan(1); };
  same((await card('today').boundingBox())!);
  expect(await below()).toEqual(layout);

  // A swipe brings Semester forward: subject count, session, and honest credits.
  const deck = visible(page, 'studies-deck');
  const box = (await deck.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(box.width, 0);
  await page.waitForTimeout(700);
  await frontCard(page, 'Semester');
  const semester = visible(page, 'studies-semester');
  await expect(semester).toContainText('2 subjects');
  await expect(semester).toContainText('2026/2027 · Semester 1');
  await expect(semester.getByTestId('studies-credits')).toHaveText('Credits not verified');
  await expect(card('semester').getByTestId('studies-deck-hint')).toHaveCount(0);
  same((await card('semester').boundingBox())!);
  expect(await below()).toEqual(layout);
  await expect(page.getByText('Back to overview', { exact: true })).toHaveCount(0);
  await semester.getByRole('button', { name: 'View subjects' }).click();
  await expect(page).toHaveURL(/\/my-semester/);
  await page.goBack();

  // The dots stay the keyboard and screen-reader way to change cards.
  await dot(page, 'Academic focus').click();
  await frontCard(page, 'Academic focus');
  await expect(page.getByRole('button', { name: /^Studies card \d of 3:/ }).filter({ visible: true })).toHaveCount(3);
});

test('no tasks, no timetable, and no semester stay calm and usable', async ({ page }) => {
  await mockStudies(page, {});
  await openStudies(page);
  await expect(visible(page, 'priority-empty')).toContainText('Your planner is ready.');
  await expect(visible(page, 'view-all-tasks')).toHaveCount(0);
  await expect(visible(page, 'studies-focus')).toContainText('No tasks yet.');
  await dot(page, 'Semester').click();
  await expect(visible(page, 'studies-semester')).toContainText('No subjects selected yet');
  await visible(page, 'studies-semester').getByRole('button', { name: 'Choose subjects' }).click();
  await expect(page).toHaveURL(/\/my-semester/);
  await page.goBack();
  await dot(page, 'Today').click();
  await expect(visible(page, 'planner-next-class')).toContainText('No upcoming classes in your timetable');
  await visible(page, 'planner-next-class').getByRole('button', { name: 'View timetable' }).click();
  await expect(page).toHaveURL(/\/timetable/);
  await page.goBack();
  await visible(page, 'priority-empty').getByRole('button', { name: 'Add a task' }).click();
  await expect(page).toHaveURL(/\/add-task/);
});

test('only completed tasks: all caught up, and View all still lists them', async ({ page }) => {
  await mockStudies(page, { tasks: [{ title: 'Done one', priority: 'medium', deadline: at(-HOUR), status: 'completed' }] });
  await openStudies(page);
  await expect(visible(page, 'priority-empty')).toContainText('You’re all caught up');
  await expect(visible(page, 'priority-tasks')).toHaveCount(0);
  await expect(visible(page, 'view-all-tasks')).toHaveText(/View all \(1\)/);
  await visible(page, 'view-all-tasks').click();
  await expect(page.getByTestId('all-tasks-sheet').getByText('Completed (1)')).toBeVisible();
});

test('Light mode, a 320 px phone, and Reduce Motion keep the page readable and in bounds', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/"theme_preference":"[a-z]+"/g, '"theme_preference":"light"') });
  });
  await mockStudies(page, { tasks: sample, choice: true, classes: true, courses: [{ code: 'BCS3153', name: 'Software Evolution', credits: 3 }] });
  await openStudies(page);
  // No horizontal overflow, and all four shortcut labels fit inside the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const key of ['add', 'semester', 'timetable', 'reminders']) {
    const box = (await visible(page, `planner-quick-${key}`).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  // Secondary cards stay dark in Light mode; under Reduce Motion a dot switches cards at once.
  await dot(page, 'Today').click();
  await frontCard(page, 'Today');
  const surface = await visible(page, 'studies-deck-card-today').evaluate((node) => [...node.querySelectorAll('div')].map((el) => getComputedStyle(el).backgroundColor).find((colour) => colour !== 'rgba(0, 0, 0, 0)'));
  expect(surface).toBe('rgb(23, 23, 28)');
  await dot(page, 'Semester').click();
  await frontCard(page, 'Semester');
  await expect(visible(page, 'studies-semester')).toContainText('1 subject');
});
