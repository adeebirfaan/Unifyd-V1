import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const SELECTS = {
  history: 'id,title,amount,category,expense_date,notes,created_at',
  period: 'id,amount,category',
  budget: 'id,amount,period_type,period_start',
  subscriptions: 'id,name,next_billing_date,is_active',
  split: 'id,split_bill_participants(share_amount,is_self,is_settled)',
};
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const iso = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

type Data = {
  expenses?: { amount: number; category: string; title?: string; daysAgo?: number }[];
  budget?: number | null;
  renewals?: { name: string; days: number }[];
  owed?: number;
  failPeriod?: boolean;
};

/** Every Wallet read is mocked from one fictional data set, so totals are known and nothing touches real rows. */
async function mockWallet(page: Page, data: Data) {
  const expenses = (data.expenses ?? []).map((expense, index) => ({
    id: `00000000-0000-4000-9400-${String(index + 1).padStart(12, '0')}`, title: expense.title ?? `Mock ${index + 1}`, amount: expense.amount,
    category: expense.category, expense_date: iso(-(expense.daysAgo ?? 0)), notes: null, created_at: new Date(Date.now() - index * 1000).toISOString(),
  }));
  await page.route('**/rest/v1/expenses?*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const select = new URL(route.request().url()).searchParams.get('select');
    if (select === SELECTS.period) return data.failPeriod ? json(route, { message: 'down' }, 500) : json(route, expenses.map(({ id, amount, category }) => ({ id, amount, category })));
    if (select === SELECTS.history) return json(route, expenses);
    return json(route, []);
  });
  await page.route('**/rest/v1/budgets?*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const single = (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
    const row = data.budget ? { id: '00000000-0000-4000-9400-0000000000b1', amount: data.budget, period_type: 'monthly', period_start: iso(0).slice(0, 8) + '01' } : null;
    if (single) return row ? json(route, row) : json(route, { code: 'PGRST116' }, 406);
    return json(route, row ? [row] : []);
  });
  await page.route('**/rest/v1/subscriptions?*', (route) => json(route, (data.renewals ?? []).map((renewal, index) => ({ id: `s${index}`, name: renewal.name, next_billing_date: iso(renewal.days), is_active: true }))));
  // Complete rows, as the database returns them, so the split-bill screens can open from these tests too.
  await page.route('**/rest/v1/split_bills?*', (route) => json(route, data.owed ? [{ id: '00000000-0000-4000-9400-0000000000c1', title: 'Mock dinner', total_amount: 10 + data.owed, bill_date: iso(0), category: null, notes: null,
    split_bill_participants: [
      { id: '00000000-0000-4000-9400-0000000000d1', participant_name: 'You', share_amount: 10, is_self: true, is_settled: true, settled_at: new Date().toISOString() },
      { id: '00000000-0000-4000-9400-0000000000d2', participant_name: 'Amir', share_amount: data.owed, is_self: false, is_settled: false, settled_at: null },
    ] }] : []));
}

async function openWallet(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await expect(visible(page, 'budget-summary')).toBeVisible();
}
const visible = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
// The Finance deck: dots are named "Finance card N of M: <name>"; the front card's dot is selected.
const deckDots = (page: Page) => page.getByRole('button', { name: /^Finance card \d+ of \d+:/ }).filter({ visible: true });
const frontCard = (page: Page, name: string) => expect(page.getByRole('button', { name: new RegExp(`^Finance card \\d+ of \\d+: ${name}$`) }).filter({ visible: true })).toHaveAttribute('aria-selected', 'true');
const showDeckCard = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^Finance card \\d+ of \\d+: ${name}$`) }).filter({ visible: true }).click();
const top = async (page: Page, id: string) => (await visible(page, id).first().boundingBox())!.y;

const sample: Data = {
  budget: 500,
  expenses: [{ amount: 30, category: 'food', title: 'KFC Gambang' }, { amount: 20, category: 'transport', title: 'Grab to campus' }, { amount: 9, category: 'other' }, { amount: 30, category: 'personal' }],
  renewals: [{ name: 'Spotify', days: 2 }],
  owed: 40,
};

test('sections appear in priority order with real figures, and recent expenses start on the first screen', async ({ page }) => {
  await mockWallet(page, sample);
  await openWallet(page);
  // Overview: available is the largest value; budget, spent, % used, and daily average support it.
  await expect(visible(page, 'budget-remaining')).toContainText('Available this month');
  await expect(visible(page, 'budget-remaining')).toContainText('RM 411.00');
  await expect(visible(page, 'budget-amount')).toHaveText('RM 500.00');
  await expect(visible(page, 'budget-spent')).toHaveText('RM 89.00');
  await expect(visible(page, 'budget-used')).toHaveText('17.8%');
  await expect(visible(page, 'budget-daily-average')).toBeVisible();
  await expect(visible(page, 'budget-status')).toHaveCount(0);

  // Breakdown: the top three real categories, with the fourth summarised, never invented.
  await expect(visible(page, 'breakdown-spent')).toHaveText('RM 89.00');
  await expect(visible(page, 'budget-category-food')).toContainText('RM 30.00');
  await expect(visible(page, 'budget-category-personal')).toContainText('RM 30.00');
  await expect(visible(page, 'budget-category-transport')).toContainText('RM 20.00');
  await expect(visible(page, 'budget-category-other')).toHaveCount(0);
  await expect(visible(page, 'breakdown-more')).toHaveText('+1 more category · RM 9.00');
  // The donut's text summary is announced once its card is in front.
  await showDeckCard(page, 'Spending by category');
  await expect(page.getByRole('img', { name: /This month by category: RM 89\.00 spent\. Food RM 30\.00/ })).toBeVisible();

  // Attention: a renewal and money owed, both real and tracked separately from spending.
  await expect(visible(page, 'attention-renewals-text')).toHaveText('1 renewal in the next 7 days');
  await expect(visible(page, 'attention-owed-text')).toHaveText('You are owed RM 40.00');
  await expect(visible(page, 'finance-attention')).toContainText('Not included in your spending totals.');

  // Order: the deck (overview, by category, needs attention) → quick actions → recent expenses.
  await expect(deckDots(page)).toHaveCount(3);
  await expect(deckDots(page).nth(0)).toHaveAccessibleName('Finance card 1 of 3: Overview');
  await expect(deckDots(page).nth(1)).toHaveAccessibleName('Finance card 2 of 3: Spending by category');
  await expect(deckDots(page).nth(2)).toHaveAccessibleName('Finance card 3 of 3: Needs attention');
  const order = [await top(page, 'finance-deck'), await top(page, 'finance-quick-actions')];
  const recent = (await page.getByText('Recent expenses', { exact: true }).filter({ visible: true }).boundingBox())!.y;
  expect([...order, recent]).toEqual([...order, recent].sort((a, b) => a - b));
  // Recent expenses starts within the first screen of a 390 × 844 phone, above the tab bar.
  const tabBar = (await page.getByRole('tab', { name: 'Wallet' }).boundingBox())!;
  expect(recent).toBeLessThan(tabBar.y);
  await expect(visible(page, 'wallet-total')).toHaveAttribute('aria-label', 'All-time spent, RM 89.00');
  await expect(page.getByRole('button', { name: /Open details for KFC Gambang/ })).toBeAttached();
  // Four expenses: all are shown, and there is no "View all".
  await expect(page.getByRole('button', { name: /^Open details for / }).filter({ visible: true })).toHaveCount(4);
  await expect(visible(page, 'view-all-expenses')).toHaveCount(0);
});

test('quick actions open Add expense, Scan receipt, Budget, Split bills, and Subscriptions', async ({ page }) => {
  await mockWallet(page, sample);
  await openWallet(page);
  const actions = visible(page, 'finance-quick-actions');
  const go = async (name: string, url: RegExp) => {
    await actions.getByRole('button', { name, exact: true }).click({ timeout: 10_000 });
    await expect(page, `${name} opens its screen`).toHaveURL(url, { timeout: 10_000 });
    await page.getByRole('button', { name: 'Go back' }).filter({ visible: true }).first().click({ timeout: 10_000 });
    await expect(visible(page, 'budget-summary'), `back to Wallet from ${name}`).toBeVisible({ timeout: 10_000 });
  };
  await go('Add expense', /\/add-expense/);
  await go('Scan receipt', /\/scan-receipt/);
  await go('Manage budget', /\/set-budget/);
  await go('Split bills', /\/split-bills/);
  await go('Subscriptions', /\/subscriptions/);
  for (const tile of ['quick-add', 'quick-scan', 'quick-budget', 'quick-split', 'quick-subscriptions']) {
    const box = (await visible(page, tile).boundingBox())!;
    expect(box.height, `${tile} touch target`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${tile} touch target`).toBeGreaterThanOrEqual(44);
  }
  // Subscriptions is a standard tile, first on the second row: the same column and size as Add expense, no pill or chevron.
  const add = (await visible(page, 'quick-add').boundingBox())!;
  const split = (await visible(page, 'quick-split').boundingBox())!;
  const subscriptions = (await visible(page, 'quick-subscriptions').boundingBox())!;
  expect(Math.abs(subscriptions.x - add.x)).toBeLessThan(1);
  expect(Math.abs(subscriptions.width - split.width)).toBeLessThan(1);
  expect(subscriptions.y).toBeGreaterThan(add.y + add.height);
  await expect(visible(page, 'quick-subscriptions')).toHaveAttribute('aria-label', 'Subscriptions');
  await expect(actions.getByRole('button')).toHaveCount(5);
});

test('no budget and no expenses show compact empty states, and the attention card is left out', async ({ page }) => {
  await mockWallet(page, {});
  await openWallet(page);
  await expect(visible(page, 'budget-summary')).toContainText('Spent this month');
  await expect(visible(page, 'budget-spent')).toHaveText('RM 0.00');
  await expect(visible(page, 'budget-summary')).toContainText('No budget set for this period.');
  await expect(visible(page, 'budget-daily-average'), 'no misleading daily average').toHaveCount(0);
  await expect(visible(page, 'quick-budget')).toHaveAttribute('aria-label', 'Set budget');
  await expect(visible(page, 'spending-breakdown')).toContainText('No expenses this month yet.');
  // No attention items: only two cards, so two dots.
  await expect(deckDots(page)).toHaveCount(2);
  await showDeckCard(page, 'Spending by category');
  await visible(page, 'spending-breakdown').getByRole('button', { name: 'Add an expense' }).click();
  await expect(page).toHaveURL(/\/add-expense/);
  await page.getByRole('button', { name: 'Go back' }).filter({ visible: true }).first().click();
  await expect(visible(page, 'finance-attention')).toHaveCount(0);
  await expect(page.getByText('Your wallet is ready.').filter({ visible: true })).toBeVisible();
  await expect(visible(page, 'view-all-expenses')).toHaveCount(0);
  // Back on Wallet the deck keeps its place; the overview's dot brings it forward (no separate back control).
  await expect(deckDots(page)).toHaveCount(2);
  await frontCard(page, 'Spending by category');
  await showDeckCard(page, 'Overview');
  await frontCard(page, 'Overview');
  // With no attention card, the guide names only the card that is there.
  await expect(visible(page, 'finance-deck-hint')).toContainText('Swipe or tap the card behind for spending by category');
  await visible(page, 'budget-summary').getByRole('button', { name: 'Set a budget' }).click();
  await expect(page).toHaveURL(/\/set-budget/);
});

test('near and over budget are written out, with the over state first in attention', async ({ page }) => {
  await mockWallet(page, { budget: 100, expenses: [{ amount: 85, category: 'food' }] });
  await openWallet(page);
  await expect(visible(page, 'budget-status')).toContainText('Close to your budget');
  await expect(visible(page, 'attention-nearBudget-text')).toHaveText('You have used 85% of this month’s budget.');

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await mockWallet(page, { budget: 75, expenses: [{ amount: 80, category: 'food' }], owed: 12 });
  await page.reload();
  await expect(visible(page, 'budget-overspent')).toContainText('Over budget');
  await expect(visible(page, 'budget-overspent')).toContainText('RM 5.00');
  await expect(visible(page, 'budget-used')).toHaveText('106.7%');
  await showDeckCard(page, 'Needs attention');
  const items = visible(page, 'finance-attention').getByRole('button');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toHaveAccessibleName('You are RM 5.00 over this month’s budget.');
  // An item on the attention card still opens its destination.
  await items.first().click();
  await expect(page).toHaveURL(/\/set-budget/);
});

test('a period load failure offers a retry instead of figures', async ({ page }) => {
  await mockWallet(page, { ...sample, failPeriod: true });
  await openWallet(page);
  await expect(visible(page, 'budget-summary')).toContainText('We could not load this period’s budget and spending.');
  await expect(visible(page, 'spending-breakdown')).toHaveCount(0);
  await expect(visible(page, 'budget-summary').getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('reduced motion draws the final chart at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockWallet(page, sample);
  await openWallet(page);
  await expect(visible(page, 'spending-breakdown')).toBeVisible();
  await page.waitForTimeout(250);
  // Four category arcs plus the track, fully drawn: their dash lengths add up to the whole ring (minus hairline gaps).
  const drawn = await visible(page, 'spending-breakdown').evaluate((card) => {
    const circles = [...card.querySelectorAll('circle')].slice(1);
    const r = Number(circles[0]?.getAttribute('r'));
    const total = circles.reduce((sum, circle) => sum + Number((circle.getAttribute('stroke-dasharray') ?? '0').split(/[ ,]+/)[0]), 0);
    return { count: circles.length, fraction: total / (2 * Math.PI * r) };
  });
  expect(drawn.count).toBe(4);
  expect(drawn.fraction).toBeGreaterThan(0.95);
});

test('Light mode keeps cards dark and readable, and a 320 px phone shows everything above the tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockWallet(page, sample);
  await openWallet(page);
  const bottomOfContent = await page.evaluate(() => {
    const amounts = [...document.querySelectorAll('[data-testid^="quick-"]')].filter((el) => (el as HTMLElement).offsetParent !== null);
    return Math.max(...amounts.map((el) => el.getBoundingClientRect().right));
  });
  expect(bottomOfContent, 'quick actions fit the width').toBeLessThanOrEqual(320);
  // Even at 320 px, "Subscriptions" stays one unbroken line: its tile is no taller than Scan receipt's.
  const tileHeight = async (id: string) => (await visible(page, id).boundingBox())!.height;
  expect(await tileHeight('quick-subscriptions')).toBeLessThanOrEqual(await tileHeight('quick-scan') + 0.5);
  // Scroll to the end: the last row must clear the tab bar.
  const lastRow = page.getByRole('button', { name: /^Open details for Mock 4/ }).filter({ visible: true });
  await lastRow.scrollIntoViewIfNeeded();
  const rowBox = (await lastRow.boundingBox())!;
  const tabBar = (await page.getByRole('tab', { name: 'Wallet' }).boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(tabBar.y);

  try {
    await page.getByRole('tab', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open profile' }).click();
    await page.getByRole('button', { name: 'Profile settings' }).click();
    await page.getByRole('button', { name: /^Appearance:/ }).click();
    await page.getByRole('radio', { name: /Light/ }).click();
    await expect(page.getByRole('button', { name: 'Appearance: Light' })).toBeVisible();
    await page.goBack();
    await page.goBack();
    await page.getByRole('tab', { name: 'Wallet' }).click();
    await expect(visible(page, 'spending-breakdown')).toBeVisible();
    const colours = await page.evaluate(() => {
      const bg = (el: Element | null) => { let node = el; while (node && getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)') node = node.parentElement; return node ? getComputedStyle(node).backgroundColor : ''; };
      const card = [...document.querySelectorAll('[data-testid="spending-breakdown"]')].find((el) => (el as HTMLElement).offsetParent !== null)!;
      const heroAncestor = (() => { let node: Element | null = [...document.querySelectorAll('[data-testid="budget-summary"]')].find((el) => (el as HTMLElement).offsetParent !== null)!; while (node && !getComputedStyle(node).backgroundImage.includes('gradient')) node = node.parentElement; return node; })();
      const amount = [...document.querySelectorAll('[data-testid="budget-summary"] [data-testid="budget-amount"]')].find((el) => (el as HTMLElement).offsetParent !== null)!;
      const title = [...document.querySelectorAll('div')].find((el) => el.textContent === 'Wallet' && (el as HTMLElement).offsetParent !== null && el.children.length === 0)!;
      return { card: bg(card), page: bg(title), title: getComputedStyle(title).color,
        hero: heroAncestor ? getComputedStyle(heroAncestor).backgroundImage : '', heroText: getComputedStyle(amount).color };
    });
    expect(colours.page).toBe('rgb(247, 248, 250)');
    expect(colours.card).toBe('rgb(23, 23, 28)');
    // The overview card reuses the Home overview gradient (#007AFB → #34C1FC) with white figures.
    expect(colours.hero).toContain('rgb(0, 122, 251)');
    expect(colours.hero).toContain('rgb(52, 193, 252)');
    expect(colours.heroText).toBe('rgb(255, 255, 255)');
    expect(colours.title).toBe('rgb(23, 23, 28)');
  } finally {
    await page.getByRole('tab', { name: 'Home' }).click();
    await page.getByRole('button', { name: 'Open profile' }).click();
    await page.getByRole('button', { name: 'Profile settings' }).click();
    await page.getByRole('button', { name: /^Appearance:/ }).click();
    await page.getByRole('radio', { name: /Dark/ }).click();
    await expect(page.getByRole('button', { name: 'Appearance: Dark' })).toBeVisible();
  }
});

const many: Data = { budget: 500, expenses: Array.from({ length: 8 }, (_, index) => ({ amount: 10 + index, category: index % 2 ? 'transport' : 'food', title: `Recent ${index + 1}` })) };
const scroller = (page: Page) => page.evaluate(() => {
  const anchor = [...document.querySelectorAll('[data-testid="budget-summary"]')].find((el) => (el as HTMLElement).offsetParent !== null);
  let node = anchor?.parentElement ?? null;
  while (node && !(node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY))) node = node.parentElement;
  return node ? node.scrollTop : -1;
});

test('more than five expenses: the home shows five and "View all (8)" opens the full history in a sheet', async ({ page }) => {
  await mockWallet(page, many);
  await openWallet(page);
  const rows = page.getByRole('button', { name: /^Open details for Recent / }).filter({ visible: true });
  await expect(rows).toHaveCount(5);
  // Newest first, exactly as the existing history orders them.
  await expect(rows.first()).toHaveAccessibleName(/^Open details for Recent 1\./);
  await expect(rows.last()).toHaveAccessibleName(/^Open details for Recent 5\./);
  await expect(visible(page, 'wallet-total')).toHaveAttribute('aria-label', 'All-time spent, RM 108.00');
  const viewAll = visible(page, 'view-all-expenses');
  await expect(viewAll).toHaveText(/View all \(8\)/);
  await expect(viewAll).toHaveAccessibleName('View all 8 expenses');

  // Remember where the student was, then open the sheet: same URL, full list, close control.
  await viewAll.scrollIntoViewIfNeeded();
  const before = await scroller(page);
  const url = page.url();
  await viewAll.click();
  const sheet = page.getByTestId('all-expenses-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('All expenses');
  await expect(sheet).toContainText('8 expenses recorded');
  await expect(sheet.getByRole('button', { name: /^Open details for Recent / })).toHaveCount(8);
  expect(page.url()).toBe(url);
  await expect(sheet.getByRole('button', { name: 'Close expense history' })).toBeVisible();

  // Closing returns to the same Finance position.
  await sheet.getByRole('button', { name: 'Close expense history' }).click();
  await expect(sheet).toHaveCount(0);
  expect(await scroller(page)).toBe(before);
  await expect(viewAll).toBeVisible();

  // A row in the sheet opens its detail exactly like a preview row, and the sheet closes.
  await viewAll.click();
  await page.getByTestId('all-expenses-sheet').getByRole('button', { name: /^Open details for Recent 8\./ }).click();
  await expect(page).toHaveURL(/\/expense-detail/);
  await expect(page.getByTestId('all-expenses-sheet')).toHaveCount(0);
});

test('the history sheet opens in place under Reduce Motion and clears the bottom on a 320 px phone', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 640 });
  await mockWallet(page, many);
  await openWallet(page);
  await page.waitForTimeout(300);
  await visible(page, 'view-all-expenses').click();
  const sheet = page.getByTestId('all-expenses-sheet');
  await expect(sheet).toBeVisible();
  const first = (await sheet.boundingBox())!.y;
  await page.waitForTimeout(500);
  expect((await sheet.boundingBox())!.y, 'no sliding movement').toBe(first);
  // The last row can be scrolled fully into view above the bottom edge; nothing in the app covers the sheet.
  const last = sheet.getByRole('button', { name: /^Open details for Recent 8\./ });
  await last.scrollIntoViewIfNeeded();
  const box = (await last.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  const closeBox = (await sheet.getByRole('button', { name: 'Close expense history' }).boundingBox())!;
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('the history sheet follows a downward touch drag: a short drag settles back, a long drag closes it', async ({ browser }) => {
  // Real touch input (as on a phone), sent through the DevTools protocol, rather than a mouse.
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Kuala_Lumpur' });
  const page = await context.newPage();
  try {
    await mockWallet(page, many);
    await openWallet(page);
    const cdp = await context.newCDPSession(page);
    const viewAll = visible(page, 'view-all-expenses');
    const sheet = page.getByTestId('all-expenses-sheet');
    const touchDrag = async (from: { x: number; y: number }, distance: number, release = true) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
      for (let step = 1; step <= 12; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + (distance * step) / 12 }] });
        await page.waitForTimeout(20);
      }
      if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const centre = async (locator: ReturnType<Page['getByTestId']>) => { const box = (await locator.boundingBox())!; return { x: box.x + box.width / 3, y: box.y + Math.min(20, box.height / 2) }; };

    await viewAll.tap();
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(600);
    const restY = (await sheet.boundingBox())!.y;

    // While dragging, the sheet moves with the finger; a slow, short drag settles back.
    await touchDrag(await centre(page.getByTestId('all-expenses-drag')), 60, false);
    expect((await sheet.boundingBox())!.y, 'follows the finger').toBeGreaterThan(restY + 40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.y), { message: 'settles back', timeout: 5000 }).toBe(Math.round(restY));

    // A long drag on the handle area closes it.
    await touchDrag(await centre(page.getByTestId('all-expenses-drag')), 240);
    await expect(sheet, 'long handle drag closes').toHaveCount(0, { timeout: 5000 });

    // Reopening after a drag-close shows the sheet fully up again, not just the dimmed backdrop.
    await viewAll.tap();
    await expect(sheet).toBeVisible();
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.y), { message: 'reopens fully up', timeout: 3000 }).toBe(Math.round(restY));

    // Dragging down on the list while it is at the top also closes it, without opening the row.
    await touchDrag(await centre(sheet.getByRole('button', { name: /^Open details for Recent 1\./ })), 240);
    await expect(sheet, 'list drag at top closes').toHaveCount(0, { timeout: 5000 });
    await expect(page).not.toHaveURL(/\/expense-detail/);

    // The close button still works, again after a drag-close.
    await viewAll.tap();
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.y), { message: 'reopens fully up after a list drag', timeout: 3000 }).toBe(Math.round(restY));
    await page.getByTestId('all-expenses-close').tap();
    await expect(sheet).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('recent expenses are grouped by day with day totals, in the preview and in the full-history sheet', async ({ page }) => {
  // Three today, two yesterday, two three days ago; newest first, as the history query returns them.
  const days = [0, 0, 0, 1, 1, 3, 3];
  await mockWallet(page, { budget: 500, expenses: days.map((daysAgo, index) => ({ amount: 10 + index, category: 'food', title: `Day ${index + 1}`, daysAgo })) });
  await openWallet(page);
  const today = iso(0); const yesterday = iso(-1); const older = iso(-3);
  const headers = page.locator('[data-testid^="expense-day-"]:not([data-testid^="expense-day-total-"])').filter({ visible: true });

  // Preview: five rows in total, with a header only for the two days they cover.
  await expect(page.getByRole('button', { name: /^Open details for Day / }).filter({ visible: true })).toHaveCount(5);
  await expect(headers).toHaveCount(2);
  await expect(visible(page, `expense-day-${today}`)).toContainText('Today');
  await expect(visible(page, `expense-day-total-${today}`)).toHaveText('RM 33.00');
  await expect(visible(page, `expense-day-${yesterday}`)).toContainText('Yesterday');
  await expect(visible(page, `expense-day-total-${yesterday}`)).toHaveText('RM 27.00');
  await expect(visible(page, `expense-day-${older}`)).toHaveCount(0);
  const longDate = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${today}T00:00:00Z`));
  await expect(visible(page, `expense-day-${today}`)).toHaveAttribute('aria-label', `Expenses for ${longDate}, total RM 33.00`);
  // Headers sit above their own rows, newest day first.
  const todayY = (await visible(page, `expense-day-${today}`).boundingBox())!.y;
  const yesterdayY = (await visible(page, `expense-day-${yesterday}`).boundingBox())!.y;
  const day4Y = (await page.getByRole('button', { name: /^Open details for Day 4\./ }).filter({ visible: true }).boundingBox())!.y;
  expect(todayY).toBeLessThan(yesterdayY);
  expect(yesterdayY).toBeLessThan(day4Y);
  await expect(visible(page, 'view-all-expenses')).toHaveText(/View all \(7\)/);

  // Sheet: every day, each once, with its own total.
  await visible(page, 'view-all-expenses').click();
  const sheet = page.getByTestId('all-expenses-sheet');
  await expect(sheet.getByRole('button', { name: /^Open details for Day / })).toHaveCount(7);
  for (const [date, total] of [[today, 'RM 33.00'], [yesterday, 'RM 27.00'], [older, 'RM 31.00']] as const) {
    await expect(sheet.getByTestId(`expense-day-${date}`)).toHaveCount(1);
    await expect(sheet.getByTestId(`expense-day-total-${date}`)).toHaveText(total);
  }
  const formatted = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${older}T00:00:00Z`));
  await expect(sheet.getByTestId(`expense-day-${older}`)).toContainText(formatted);
  // Rows keep their behaviour.
  await sheet.getByRole('button', { name: /^Open details for Day 7\./ }).click();
  await expect(page).toHaveURL(/\/expense-detail/);
});

test('the Finance deck changes cards in one stable place, with a guide and no back-to-overview step', async ({ page }) => {
  await mockWallet(page, sample);
  await openWallet(page);
  const deck = page.getByTestId('finance-deck').filter({ visible: true });
  const swipe = async (pages: number) => {
    const box = (await deck.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(pages * box.width, 0);
    await page.waitForTimeout(700);
  };
  const card = (key: string) => page.getByTestId(`finance-deck-card-${key}`).filter({ visible: true });
  const actions = async () => (await visible(page, 'finance-quick-actions').boundingBox())!;

  // The guide sits inside the overview card, below its figures, and names the real cards behind.
  await frontCard(page, 'Overview');
  const hint = visible(page, 'finance-deck-hint');
  await expect(hint).toContainText('Swipe or tap the cards behind for spending by category and items that need attention');
  const overviewBox = (await card('overview').boundingBox())!;
  const hintBox = (await hint.boundingBox())!;
  const figuresBox = (await visible(page, 'budget-daily-average').boundingBox())!;
  expect(hintBox.y).toBeGreaterThanOrEqual(figuresBox.y + figuresBox.height);
  expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(overviewBox.y + overviewBox.height);
  const layoutBefore = await actions();

  await swipe(-1); // nothing before the first card
  await frontCard(page, 'Overview');
  await swipe(1);
  await frontCard(page, 'Spending by category');
  // Only the front card's controls are exposed: the overview's figures are hidden from assistive tech now.
  await expect(page.getByRole('button', { name: /^Open details for KFC Gambang/ })).toBeAttached();
  // The selected card takes the overview's exact place and size; nothing below the deck moves.
  const same = (box: { x: number; y: number; width: number; height: number }) => {
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[key] - overviewBox[key])).toBeLessThan(1);
  };
  same((await card('categories').boundingBox())!);
  expect(await actions()).toEqual(layoutBefore);
  await expect(page.getByText('Back to overview', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('finance-deck-back')).toHaveCount(0);
  await swipe(1);
  await frontCard(page, 'Needs attention');
  same((await card('attention').boundingBox())!);
  await swipe(1); // nothing after the last card
  await frontCard(page, 'Needs attention');
  expect(await actions()).toEqual(layoutBefore);
  // Swiping back returns to the overview directly.
  await swipe(-2);
  await frontCard(page, 'Overview');

  // Tapping the peeking edge of the card behind brings it forward (screen readers use the named dots instead).
  await page.mouse.click(overviewBox.x + overviewBox.width / 2, overviewBox.y - 9);
  await frontCard(page, 'Spending by category');
  await showDeckCard(page, 'Overview');
  await frontCard(page, 'Overview');

  // Internal controls still act, not the deck: the overview's figures stay, and quick actions are untouched.
  await expect(visible(page, 'finance-quick-actions').getByRole('button', { name: 'Add expense', exact: true })).toBeVisible();
});

test('a single available card is shown plainly, with no deck dots, guide, or back control', async ({ page }) => {
  // While the period cannot load, only the overview card (with its retry) exists.
  await mockWallet(page, { ...sample, failPeriod: true });
  await openWallet(page);
  await expect(page.getByTestId('finance-deck-single').filter({ visible: true })).toBeVisible();
  await expect(deckDots(page)).toHaveCount(0);
  await expect(page.getByTestId('finance-deck-hint')).toHaveCount(0);
  await expect(page.getByText('Back to overview', { exact: true })).toHaveCount(0);
});
