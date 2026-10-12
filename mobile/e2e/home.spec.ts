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

const front = (page: Page, key: string) => page.getByTestId(`deck-card-${key}`);
const showCard = (page: Page, name: string) => page.getByRole('button', { name: `Show ${name} card` }).click();

test('dashboard deck shows verified facts and opens each module, with no AI summary card on Home', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  // Poof's chat now explains the student's data, so Home no longer requests or shows a separate AI summary.
  const insightRequests: string[] = [];
  await page.route('**/api/insights/generate', async (route) => { insightRequests.push(route.request().url()); await route.abort(); });
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

  await expect(page.getByText('AI summary', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh summary' })).toHaveCount(0);

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
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(front(page, 'overview')).toContainText('RM 150.00');
  expect(insightRequests).toHaveLength(0);
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

test('empty data shows explicit empty states, never invented figures', async ({ page }) => {
  await mockDashboardData(page, { ...fixtures, mood_entries: [], tasks: [], expenses: [], budgets: [] });
  await page.route('**/api/insights/generate', (route) => route.abort());
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

// Records every animation phase the Poof chat launcher reports, from the first render onward.
async function recordPoofPhases(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __poofPhases: string[] }).__poofPhases = seen;
    new MutationObserver(() => {
      const phase = document.querySelector('[data-testid="poof-launcher"]')?.getAttribute('data-phase');
      if (phase && seen[seen.length - 1] !== phase) seen.push(phase);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
  });
  return () => page.evaluate(() => (window as unknown as { __poofPhases: string[] }).__poofPhases);
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('Home shows one Poof: the chat launcher in a speech bubble, clear of the cards, centre button, and tab bar', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  await page.route('**/api/insights/generate', (route) => route.abort());
  await signIn(page);

  // The upper decorative mascot is gone; the launcher is the only Poof.
  await expect(page.getByTestId('poof-mascot')).toHaveCount(0);
  const launcher = page.getByTestId('poof-launcher');
  await expect(launcher).toHaveCount(1);
  await expect(launcher).toHaveAttribute('aria-label', 'Chat with Poof');
  await expect(launcher).toHaveAttribute('data-backdrop', 'bubble');
  // Measure once the welcome pop-in has finished.
  await expect(launcher).toHaveAttribute('data-phase', 'idle', { timeout: 5000 });

  // A round chat bubble with a tail (one outlined shape), larger than the old 56 pt button.
  const bubble = launcher.locator('> div').first();
  const bubbleBox = (await bubble.boundingBox())!;
  expect(Math.abs(bubbleBox.width - bubbleBox.height)).toBeLessThan(6);
  expect(bubbleBox.width).toBeGreaterThan(56);
  expect(bubbleBox.height).toBeGreaterThan(56);
  const shape = bubble.getByTestId('poof-bubble-shape');
  await expect(shape).toHaveCount(1);
  expect(await shape.locator('path').getAttribute('d')).toMatch(/A 31 31/);
  expect(await launcher.locator('img').count()).toBe(1);

  // No gap where the upper Poof was: the greeting follows the eyebrow directly.
  const eyebrow = (await page.getByText('YOUR SPACE').boundingBox())!;
  const greeting = (await page.getByText(/^Good (morning|afternoon|evening),/).boundingBox())!;
  expect(greeting.y - (eyebrow.y + eyebrow.height)).toBeLessThan(16);

  // The launcher does not cover the deck, its dots, the centre button, the tab bar, or the avatar.
  const launcherBox = (await launcher.boundingBox())!;
  const others = [
    await page.getByTestId('card-deck').boundingBox(),
    await page.getByRole('button', { name: 'Show Overview card' }).boundingBox(),
    await page.getByTestId('quick-fab').boundingBox(),
    await page.getByRole('button', { name: 'Open profile' }).boundingBox(),
    ...await Promise.all((await page.getByRole('tab').all()).map((tab) => tab.boundingBox())),
  ];
  for (const other of others) expect(overlaps(launcherBox, other!)).toBe(false);
  const tabTop = Math.min(...(await Promise.all((await page.getByRole('tab').all()).map(async (tab) => (await tab.boundingBox())!.y))));
  expect(launcherBox.y + launcherBox.height).toBeLessThan(tabTop);
});

test('the Poof launcher welcomes once per session, idles without moving the layout, and opens one chat per tap', async ({ page }) => {
  await page.route('**/api/insights/generate', (route) => route.abort());
  const phases = await recordPoofPhases(page);
  await signIn(page);
  const launcher = page.getByTestId('poof-launcher');

  // Welcome plays first, then Poof settles into the idle loop.
  await expect(launcher).toHaveAttribute('data-phase', 'idle', { timeout: 5000 });
  expect(await phases()).toEqual(['pending', 'welcome', 'idle']);

  // The idle float moves the bubble without moving anything around it.
  const bubble = launcher.locator('> div').first();
  const deck = page.getByTestId('card-deck');
  const before = { deck: await deck.boundingBox(), launcher: await launcher.boundingBox(), transform: await bubble.evaluate((el) => getComputedStyle(el).transform) };
  await page.waitForTimeout(900);
  expect(await bubble.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before.transform);
  expect(await deck.boundingBox()).toEqual(before.deck);
  expect(await launcher.boundingBox()).toEqual(before.launcher);

  // A tap hops once and opens the chat straight away; a quick second tap neither stacks the hop nor opens a second chat.
  await launcher.click();
  await launcher.click({ force: true }).catch(() => undefined);
  await expect(page.getByTestId('poof-assistant')).toHaveCount(1);
  await expect(launcher).toHaveAttribute('data-reactions', '1');
  await page.waitForTimeout(600);
  await expect(page.getByTestId('poof-assistant')).toHaveCount(1);
  await page.getByTestId('poof-close').click();
  await expect(page.getByTestId('poof-assistant')).toHaveCount(0);
  await expect(launcher).toHaveAttribute('data-phase', 'idle', { timeout: 3000 });

  // Coming back to Home in the same session goes straight to idle, without another welcome.
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(launcher).toHaveAttribute('data-phase', 'idle');
  expect((await phases()).filter((phase) => phase === 'welcome')).toHaveLength(1);

  // The keyboard can open the chat too.
  await launcher.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('poof-assistant')).toBeVisible();
});

test('with reduced motion the Poof launcher stays still and opens the chat immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/insights/generate', (route) => route.abort());
  const phases = await recordPoofPhases(page);
  await signIn(page);
  const launcher = page.getByTestId('poof-launcher');
  await expect(launcher).toHaveAttribute('data-phase', 'static');
  const bubble = launcher.locator('> div').first();
  const first = await bubble.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(1200);
  expect(await bubble.evaluate((el) => getComputedStyle(el).transform)).toBe(first);
  await launcher.click();
  await expect(page.getByTestId('poof-assistant')).toBeVisible({ timeout: 2000 });
  await expect(launcher).toHaveAttribute('data-reactions', '0');
  expect(await phases()).not.toContain('welcome');
});

test('Home spent amounts roll into place, and the Money card waits until it is in front', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  await signIn(page);
  // Overview is in front, so it rolls at once and settles into plain text with the final value.
  const overview = page.getByTestId('overview-spent');
  await expect(overview).toHaveAttribute('aria-label', 'Spent this month, RM 150.00');
  await expect(overview.getByTestId('overview-spent-roll')).toHaveCount(0);
  await expect(overview).toContainText('RM 150.00');

  // The Money card waits behind the deck instead of rolling unseen.
  const money = page.getByTestId('money-spent');
  await expect(money).toHaveAttribute('aria-label', 'Spent this month, RM 150.00');
  await page.waitForTimeout(1200);
  expect(await money.getByTestId('money-spent-roll').count(), 'still waiting behind the front card').toBeGreaterThan(0);
  await showCard(page, 'Money');
  await expect(money.getByTestId('money-spent-roll')).toHaveCount(0);
  await expect(front(page, 'money')).toContainText('RM 150.00');

  // Coming back to the Overview card from another card rolls its amount again from RM 0.00.
  await showCard(page, 'Wellbeing');
  await page.getByRole('button', { name: 'Back to overview' }).click();
  await expect.poll(() => overview.getByTestId('overview-spent-roll').count(), { timeout: 2000, intervals: [20] }).toBeGreaterThan(0);
  await expect(overview.getByTestId('overview-spent-roll')).toHaveCount(0);
  await expect(overview).toContainText('RM 150.00');

  // Returning to Home from another tab, with Overview still in front and the same total, does not replay.
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByTestId('overview-spent')).toHaveAttribute('aria-label', 'Spent this month, RM 150.00');
  await expect(page.getByTestId('overview-spent').getByTestId('overview-spent-roll')).toHaveCount(0);
});
