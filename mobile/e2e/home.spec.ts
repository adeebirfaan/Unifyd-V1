import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const zone = 'Asia/Kuala_Lumpur';
const HOUR = 3_600_000;

const localDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const today = localDate(new Date());

// Fixture rows for the signed-in student's dashboard queries; dates are relative to the test run.
const fixtures: Record<string, unknown[]> = {
  budgets: [{ amount: '500.00' }],
  expenses: [
    { amount: '120.00', category: 'food', expense_date: today },
    { amount: '30.00', category: 'transport', expense_date: today },
  ],
  tasks: [
    { title: 'E2E overdue essay', subject: 'X', deadline: at(-1), status: 'pending', completed_at: null },
    { title: 'E2E Lab report', subject: 'BCS2233', deadline: at(48), status: 'ongoing', completed_at: null },
    { title: 'E2E far project', subject: 'X', deadline: at(240), status: 'pending', completed_at: null },
    { title: 'E2E finished quiz', subject: 'X', deadline: at(-30), status: 'completed', completed_at: at(-24) },
  ],
  mood_entries: [
    { mood_level: 2, stress_level: 4, recorded_at: at(-1) },
    { mood_level: 1, stress_level: 5, recorded_at: at(-48) },
    { mood_level: 2, stress_level: 3, recorded_at: at(-96) },
  ],
};

async function mockDashboardData(page: Page, data: Record<string, unknown[]>) {
  for (const table of Object.keys(data)) {
    await page.route(`**/rest/v1/${table}?*`, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const url = new URL(route.request().url());
      // Only the Home dashboard selections are replaced; other screens' queries pass through.
      const homeSelect = { budgets: 'amount', expenses: 'amount,category,expense_date', tasks: 'title,subject,deadline,status,completed_at', mood_entries: 'mood_level,stress_level,recorded_at' }[table];
      if (url.searchParams.get('select') !== homeSelect) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data[table]) });
    });
  }
}

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('YOUR OVERVIEW')).toBeVisible();
}

const aiSummary = {
  finance: 'You have spent RM 150.00 of your RM 500.00 budget this month.',
  academic: 'You have 1 overdue task and 1 due in the next 7 days.',
  wellness: 'You checked in 3 times this week.',
};

const front = (page: Page, key: string) => page.getByTestId(`deck-card-${key}`);
const showCard = (page: Page, name: string) => page.getByRole('button', { name: `Show ${name} card` }).click();

test('dashboard deck shows verified facts, a labelled AI summary, and opens each module', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  const insightRequests: { auth: string | undefined; body: unknown }[] = [];
  await page.route('**/api/insights/generate', async (route) => {
    insightRequests.push({ auth: route.request().headers().authorization, body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ facts: {}, summary: aiSummary, source: 'ai', fallbackReason: null }) });
  });
  await signIn(page);

  // Overview (front): budget status, nearest deadline, this week's mood, and summary chips.
  const overview = front(page, 'overview');
  for (const text of ['RM 150.00', 'RM 350.00 left of RM 500.00', 'E2E Lab report', '1.7 / 5', '1Due in 7 days', '1Overdue', '3Check-ins (7 days)']) {
    await expect(overview).toContainText(text);
  }
  // Cards behind the front one are not exposed as controls.
  await expect(page.getByRole('button', { name: 'Open Wallet' })).toHaveCount(0);

  await showCard(page, 'Money');
  const money = front(page, 'money');
  for (const text of ['RM 150.00', '2 expenses', '30% of budget', 'Top spending', 'Food80%', 'Transport20%']) await expect(money).toContainText(text);
  await showCard(page, 'Studies');
  const studies = front(page, 'studies');
  for (const text of ['2Pending', '1Ongoing', '1Overdue', '1Due in 7 days', 'Completed in 7 days1', 'E2E Lab report', 'BCS2233']) await expect(studies).toContainText(text);
  await showCard(page, 'Wellbeing');
  const wellbeing = front(page, 'wellbeing');
  for (const text of ['3Check-ins (7 days)', '4.0 / 5Average stress', 'You noted a low mood on several days this week.', 'not medical or professional advice']) {
    await expect(wellbeing).toContainText(text);
  }

  await expect(page.getByText('AI summary', { exact: true })).toBeVisible();
  await expect(page.getByText(aiSummary.finance)).toBeVisible();
  await expect(page.getByText(aiSummary.academic)).toBeVisible();
  await expect(page.getByText(aiSummary.wellness)).toBeVisible();
  await expect(page.getByText('Written by AI from your recorded numbers.', { exact: false })).toBeVisible();
  expect(insightRequests).toHaveLength(1);
  expect(insightRequests[0].auth).toMatch(/^Bearer .+/);
  expect(insightRequests[0].body).toEqual({ language: 'en', timeZone: zone });

  await page.getByRole('button', { name: 'Open Mind' }).click();
  await expect(page).toHaveURL(/\/mind/);
  await page.getByRole('tab', { name: 'Home' }).click();
  await showCard(page, 'Money');
  await page.getByRole('button', { name: 'Open Wallet' }).click();
  await expect(page).toHaveURL(/\/wallet/);
  await page.getByRole('tab', { name: 'Home' }).click();
  await showCard(page, 'Studies');
  await page.getByRole('button', { name: 'Open Planner' }).click();
  await expect(page).toHaveURL(/\/planner/);
  // Returning within five minutes reloads facts but does not request another summary.
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByText(aiSummary.finance)).toBeVisible();
  expect(insightRequests).toHaveLength(1);
});

test('the deck moves by swipe, peeking cards, dots, and the overview button', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  await page.route('**/api/insights/generate', (route) => route.abort());
  await signIn(page);
  const deck = page.getByTestId('card-deck');
  const selected = (name: string) => expect(page.getByRole('button', { name: `Show ${name} card` })).toHaveAttribute('aria-selected', 'true');
  // On the web the deck is a horizontal snap scroller; a horizontal wheel/trackpad scroll is the swipe.
  const swipe = async (pages: number) => {
    const box = (await deck.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(pages * box.width, 0);
    await page.waitForTimeout(700);
  };

  await selected('Overview');
  await swipe(-1); // nothing before the first card
  await selected('Overview');
  await swipe(1);
  await selected('Money');
  // Only the front card's controls are exposed.
  await expect(page.getByRole('button', { name: 'Open Wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Planner' })).toHaveCount(0);
  await swipe(1);
  await selected('Studies');
  await swipe(-1);
  await selected('Money');

  await page.getByRole('button', { name: 'Back to overview' }).click();
  await selected('Overview');

  // Tapping the edge of the card peeking behind brings it forward.
  const box = (await page.getByTestId('deck-card-overview').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y - 9);
  await selected('Money');

  await showCard(page, 'Wellbeing');
  await selected('Wellbeing');
  await swipe(1); // nothing after the last card
  await selected('Wellbeing');
  await expect(page.getByRole('button', { name: 'Back to overview' })).toHaveCount(1);
});

test('facts stay visible when the AI service fails, and the summary can be retried', async ({ page }) => {
  await mockDashboardData(page, { ...fixtures, mood_entries: [], tasks: [], expenses: [], budgets: [] });
  let mode: 'down' | 'fallback' | 'ai' = 'down';
  await page.route('**/api/insights/generate', async (route) => {
    if (mode === 'down') return route.abort();
    const body = mode === 'fallback'
      ? { facts: {}, summary: null, source: 'fallback', fallbackReason: 'invalid_response' }
      : { facts: {}, summary: aiSummary, source: 'ai', fallbackReason: null };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await signIn(page);

  // Empty data shows explicit empty states, never invented figures.
  const overview = front(page, 'overview');
  for (const text of ['RM 0.00', 'No monthly budget set', 'No upcoming deadlines', 'No check-ins yet']) await expect(overview).toContainText(text);
  await showCard(page, 'Money');
  await expect(front(page, 'money')).toContainText('No expenses recorded this month yet.');
  await showCard(page, 'Studies');
  await expect(front(page, 'studies')).toContainText('No active tasks right now.');
  await expect(front(page, 'studies')).toContainText('No upcoming deadlines');
  await showCard(page, 'Wellbeing');
  await expect(front(page, 'wellbeing')).toContainText('No check-ins in the last 7 days.');
  await expect(front(page, 'wellbeing')).not.toContainText('low mood');

  const fallback = page.getByText('An AI summary isn’t available right now. Your figures above are up to date.');
  await expect(fallback).toBeVisible();
  mode = 'fallback';
  await page.getByRole('button', { name: 'Refresh summary' }).click();
  await expect(fallback).toBeVisible();
  mode = 'ai';
  await page.getByRole('button', { name: 'Refresh summary' }).click();
  await expect(page.getByText(aiSummary.finance)).toBeVisible();
  await expect(fallback).toHaveCount(0);
});

test('dashboard loads the signed-in student’s real records without errors', async ({ page }) => {
  // Real Supabase data; only the optional AI request is stubbed so no server is needed.
  await page.route('**/api/insights/generate', (route) => route.abort());
  await signIn(page);
  await expect(front(page, 'overview')).toContainText('Spent this month');
  for (const name of ['Overview', 'Money', 'Studies', 'Wellbeing']) await expect(page.getByRole('button', { name: `Show ${name} card` })).toBeVisible();
  await expect(page.getByText('We could not load your overview.', { exact: false })).toHaveCount(0);
});

test('the greeting follows the local time of day', async ({ page }) => {
  await page.route('**/api/insights/generate', (route) => route.abort());
  const today = localDate(new Date());
  await page.clock.setFixedTime(new Date(`${today}T08:00:00+08:00`));
  await signIn(page);
  await expect(page.getByText(/^Good morning,\s/)).toBeVisible();
  await page.clock.setFixedTime(new Date(`${today}T15:00:00+08:00`));
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByText(/^Good afternoon,\s/)).toBeVisible();
  await page.clock.setFixedTime(new Date(`${today}T21:00:00+08:00`));
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByText(/^Good evening,\s/)).toBeVisible();
});

test('the centre button opens quick actions, and the avatar opens Profile', async ({ page }) => {
  await page.route('**/api/insights/generate', (route) => route.abort());
  await signIn(page);

  // Profile is no longer a tab; the bar keeps two tabs either side of the centre action.
  await expect(page.getByRole('tab', { name: 'Profile' })).toHaveCount(0);
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();

  const sheet = page.getByTestId('quick-actions-sheet');
  const open = page.getByRole('button', { name: 'Open quick actions' });
  await open.click();
  await expect(page.getByTestId('quick-fab')).toHaveAttribute('aria-label', 'Close quick actions');
  for (const name of ['Add expense', 'Scan receipt', 'Add task', 'Log mood']) await expect(sheet.getByRole('button', { name })).toBeVisible();

  // The × closes it again.
  // The × is the raised centre button itself.
  await page.getByTestId('quick-fab').click();
  await expect(open).toBeVisible();

  const go = async (action: string, url: RegExp) => {
    await page.getByRole('tab', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open quick actions' }).click();
    await sheet.getByRole('button', { name: action }).click();
    await expect(page).toHaveURL(url);
  };
  await go('Add expense', /\/add-expense/);
  await page.getByRole('button', { name: 'Go back' }).first().click();
  await go('Add task', /\/add-task/);
  await page.getByRole('button', { name: 'Go back' }).first().click();
  await go('Scan receipt', /\/scan-receipt/);
  await page.getByRole('button', { name: 'Go back' }).first().click();
  await go('Log mood', /\/mind/);
  await expect(page.getByText('How are you feeling?')).toBeVisible();

  // Switching tabs while the sheet is open closes it.
  await page.getByRole('button', { name: 'Open quick actions' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await expect(page.getByRole('button', { name: 'Open quick actions' })).toBeVisible();

  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Open profile' }).click();
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page.getByText('YOUR OVERVIEW')).toBeVisible();
});

test('students can choose up to four quick-action shortcuts, saved for next time', async ({ page }) => {
  await page.route('**/api/insights/generate', (route) => route.abort());
  await signIn(page);
  const sheet = page.getByTestId('quick-actions-sheet');
  const openSheet = () => page.getByRole('button', { name: 'Open quick actions' }).click();

  await openSheet();
  await sheet.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(sheet.getByText('Choose your shortcuts')).toBeVisible();
  await expect(sheet.getByText('4 of 4 selected')).toBeVisible();
  await expect(sheet.getByRole('checkbox')).toHaveCount(7);

  // A fifth shortcut is refused with an explanation.
  const reminders = sheet.getByRole('checkbox', { name: 'Reminders' });
  await reminders.click();
  await expect(sheet.getByText('You can choose up to 4. Remove one to add another.')).toBeVisible();
  await expect(reminders).toHaveAttribute('aria-checked', 'false');

  // Swap Scan receipt for Reminders.
  await sheet.getByRole('checkbox', { name: 'Scan receipt' }).click();
  await expect(sheet.getByText('3 of 4 selected')).toBeVisible();
  await reminders.click();
  await expect(reminders).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Done' }).click();
  for (const name of ['Add expense', 'Add task', 'Reminders', 'Log mood']) await expect(sheet.getByRole('button', { name })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Scan receipt' })).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Reminders' }).click();
  await expect(page).toHaveURL(/\/reminders/);

  // The choice survives reopening the app.
  await page.goto('/');
  await expect(page.getByText('YOUR OVERVIEW')).toBeVisible();
  await openSheet();
  await expect(sheet.getByRole('button', { name: 'Reminders' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Scan receipt' })).toHaveCount(0);

  // At least one shortcut stays selected, and Reset restores the defaults.
  await sheet.getByRole('button', { name: 'Edit', exact: true }).click();
  for (const name of ['Add expense', 'Add task', 'Reminders']) await sheet.getByRole('checkbox', { name }).click();
  await expect(sheet.getByText('1 of 4 selected')).toBeVisible();
  await sheet.getByRole('checkbox', { name: 'Log mood' }).click();
  await expect(sheet.getByText('Keep at least one shortcut.')).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: 'Log mood' })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Reset to default' }).click();
  await expect(sheet.getByText('4 of 4 selected')).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();
  for (const name of ['Add expense', 'Scan receipt', 'Add task', 'Log mood']) await expect(sheet.getByRole('button', { name })).toBeVisible();
});

test('module card colours can be changed and are remembered; Overview keeps its gradient', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  await page.route('**/api/insights/generate', (route) => route.abort());
  await signIn(page);
  const surface = (key: string) => front(page, key).getByTestId('card-surface');
  const background = (key: string) => surface(key).evaluate((el) => getComputedStyle(el).backgroundColor);

  // The Overview card has no colour option.
  await expect(page.getByRole('button', { name: /card colour$/ })).toHaveCount(0);

  await showCard(page, 'Money');
  expect(await background('money')).toBe('rgb(15, 38, 32)'); // Emerald default
  await page.getByRole('button', { name: 'Change Money card colour' }).click();
  const picker = page.getByTestId('shade-picker');
  await expect(picker.getByText('Money card colour')).toBeVisible();
  await expect(picker.getByRole('radio')).toHaveCount(6);
  await expect(picker.getByRole('radio', { name: 'Emerald' })).toHaveAttribute('aria-checked', 'true');
  await picker.getByRole('radio', { name: 'Ocean' }).click();
  await expect(picker.getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'true');
  await picker.getByRole('button', { name: 'Done' }).click();
  await expect(picker).toHaveCount(0);
  await expect.poll(() => background('money')).toBe('rgb(13, 34, 48)'); // Ocean
  // Other cards keep their own colours.
  expect(await background('studies')).toBe('rgb(20, 27, 45)'); // Midnight default

  // The choice is remembered when the app is opened again.
  await page.goto('/');
  await expect(page.getByText('YOUR OVERVIEW')).toBeVisible();
  await expect.poll(() => background('money')).toBe('rgb(13, 34, 48)');
});
