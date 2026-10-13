import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;

type Row = Record<string, unknown>;
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const eqFilters = (url: string) => [...new URL(url).searchParams].filter(([, value]) => value.startsWith('eq.')).map(([key, value]) => [key, value.slice(3)] as const);
const matches = (row: Row, filters: readonly (readonly [string, string])[]) => filters.every(([key, value]) => String(row[key]) === value);

/**
 * Budgets live in memory, with the real table's one-per-user-period-start rule. `insert` decides each POST's
 * fate (hold it open, or fail it). Every write is recorded.
 */
async function mockBudgets(page: Page, seed: Row[] = [], insert: (attempt: number) => Promise<number> = async () => 201) {
  const store: Row[] = seed.map((row) => ({ ...row }));
  const writes: { method: string; body: Row }[] = [];
  let posts = 0;
  await page.route('**/rest/v1/budgets*', async (route) => {
    const request = route.request();
    const filters = eqFilters(request.url());
    const single = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    const respond = (rows: Row[]) => single ? (rows[0] ? json(route, 200, rows[0]) : json(route, 406, { code: 'PGRST116' })) : json(route, 200, rows);
    if (request.method() === 'GET') return respond(store.filter((row) => matches(row, filters)));
    const body = request.postDataJSON() as Row;
    writes.push({ method: request.method(), body });
    if (request.method() === 'POST') {
      const status = await insert(++posts);
      if (status >= 400) return json(route, status, { message: 'boom' });
      if (store.some((row) => row.user_id === body.user_id && row.period_type === body.period_type && row.period_start === body.period_start)) return json(route, 409, { code: '23505' });
      const row = { ...body, id: `00000000-0000-4000-9000-${String(store.length + 1).padStart(12, '0')}` };
      store.push(row);
      return respond([{ id: row.id }]);
    }
    if (request.method() === 'PATCH') {
      const rows = store.filter((row) => matches(row, filters));
      for (const row of rows) Object.assign(row, body);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    return route.fulfill({ status: 405, body: '' });
  });
  return { store, writes };
}

async function userId() {
  const { client, userId: id } = await testClient();
  await client.auth.signOut();
  return id;
}

async function openBudget(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByTestId('quick-budget').filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/set-budget/);
}

async function swipe(page: Page, fraction: number) {
  const track = (await page.getByTestId('budget-swipe').boundingBox())!;
  const thumb = (await page.getByTestId('budget-swipe-thumb').boundingBox())!;
  const x = thumb.x + thumb.width / 2;
  const y = thumb.y + thumb.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (track.width - thumb.width - 10) * fraction, y + 2, { steps: 12 });
  await page.mouse.up();
}
const thumbX = async (thumb: Locator) => (await thumb.boundingBox())!.x;

test.beforeEach(async ({ page }) => {
  // Monday 12 October 2026, 08:00 in Kuala Lumpur: the week is 12–18 Oct and the month 1–31 Oct.
  await page.clock.setFixedTime(new Date('2026-10-12T08:00:00+08:00'));
  // A frozen clock also freezes animations, so the shared slider and overlay run in their Reduce Motion form.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a new budget: no description, live period preview, validation, partial swipe, and one save after a confirmed insert', async ({ page }) => {
  const owner = await userId();
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const { store, writes } = await mockBudgets(page, [], async () => { await held; return 201; });
  await openBudget(page);

  await expect(page.getByRole('heading', { name: 'Set budget' })).toBeVisible();
  await expect(page.getByText('Choose a weekly or monthly amount for the current period.')).toHaveCount(0);
  const range = page.getByTestId('budget-current-period');
  await expect(page.getByRole('radio', { name: 'Monthly' })).toBeChecked();
  await expect(range).toContainText('1 Oct 2026 – 31 Oct 2026');
  await page.getByRole('radio', { name: 'Weekly' }).click();
  await expect(page.getByRole('radio', { name: 'Weekly' })).toBeChecked();
  await expect(range).toContainText('12 Oct 2026 – 18 Oct 2026');
  await page.getByRole('radio', { name: 'Monthly' }).click();
  await expect(range).toContainText('1 Oct 2026 – 31 Oct 2026');
  await expect(page.getByTestId('budget-updating')).toHaveCount(0);

  // A partial swipe returns and saves nothing; a full swipe on an empty amount shows the error and focuses the field.
  const thumb = page.getByTestId('budget-swipe-thumb');
  const start = await thumbX(thumb);
  await swipe(page, 0.5);
  await expect.poll(() => thumbX(thumb)).toBeLessThan(start + 2);
  await swipe(page, 1.1);
  const amount = page.getByRole('textbox', { name: 'Budget amount (RM)' });
  await expect(page.getByText('Enter a budget amount.')).toBeVisible();
  await expect(amount).toBeFocused();
  await expect(page.getByTestId('budget-saved-overlay')).toHaveCount(0);
  await amount.fill('12.345');
  await page.getByRole('button', { name: 'Or tap to save budget' }).click();
  await expect(page.getByText('Enter an amount above RM0 with up to two decimal places.')).toBeVisible();
  expect(writes).toEqual([]);

  // While the insert is pending: loading only. Success appears once it is confirmed, exactly one insert.
  await amount.fill('500');
  await swipe(page, 1.1);
  await expect(page.getByTestId('budget-overlay-saving')).toContainText('Saving budget…');
  await expect(page.getByTestId('budget-overlay-success')).toHaveCount(0);
  release();
  const success = page.getByTestId('budget-overlay-success');
  await expect(success).toContainText('Budget saved');
  await expect(success).toContainText('RM 500.00');
  await expect(success).toContainText('Monthly budget');
  await expect(success).toContainText('1 Oct 2026 – 31 Oct 2026');
  expect(writes).toEqual([{ method: 'POST', body: { user_id: owner, amount: 500, period_type: 'monthly', period_start: '2026-10-01' } }]);

  // Continue returns to Wallet, which shows the saved budget and the shared success toast (the same component and
  // timing as "Subscription saved."): announced, over the page, gone after 2.5 s, and not shown again.
  await page.getByRole('button', { name: 'Tap anywhere to continue' }).click();
  await expect(page).toHaveURL(/\/wallet/);
  const toast = page.getByTestId('wallet-toast');
  await expect(toast).toContainText('Budget saved.');
  await expect(toast).toHaveAttribute('aria-label', 'Budget saved.');
  await expect(page.getByTestId('budget-amount').filter({ visible: true })).toHaveText('RM 500.00');
  await expect(toast).toHaveCount(0, { timeout: 4000 });
  await expect(page).not.toHaveURL(/budgetSaved/);
  await page.getByRole('tab', { name: 'Planner' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('wallet-toast')).toHaveCount(0);
  expect(store).toHaveLength(1);
});

test('an existing budget is shown as an update and is changed in place, never duplicated', async ({ page }) => {
  const owner = await userId();
  const existing = { id: '00000000-0000-4000-9000-000000000701', user_id: owner, amount: 500, period_type: 'monthly', period_start: '2026-10-01' };
  const { store, writes } = await mockBudgets(page, [existing]);
  await openBudget(page);
  await expect(page.getByRole('heading', { name: 'Manage budget' })).toBeVisible();
  const amount = page.getByRole('textbox', { name: 'Budget amount (RM)' });
  await expect(amount).toHaveValue('500.00');
  await expect(page.getByTestId('budget-updating')).toHaveText(/Updating this period’s budget, currently RM 500\.00\./);
  await amount.fill('650');
  await swipe(page, 1.1);
  await expect(page.getByTestId('budget-overlay-success')).toContainText('Budget updated');
  await expect(page.getByTestId('budget-overlay-success')).toContainText('RM 650.00');
  expect(writes).toEqual([{ method: 'PATCH', body: { amount: 650 } }]);
  expect(store).toEqual([{ ...existing, amount: 650 }]);
});

test('a failed save keeps the amount, resets the slider, and a retry saves once', async ({ page }) => {
  await userId();
  const { store, writes } = await mockBudgets(page, [], async (attempt) => attempt === 1 ? 500 : 201);
  await openBudget(page);
  const amount = page.getByRole('textbox', { name: 'Budget amount (RM)' });
  await amount.fill('300');
  const thumb = page.getByTestId('budget-swipe-thumb');
  const start = await thumbX(thumb);
  await swipe(page, 1.1);
  await expect(page.getByTestId('budget-save-error')).toHaveText('We could not save your budget. Please try again.');
  await expect(page.getByTestId('budget-saved-overlay')).toHaveCount(0);
  await expect(page.getByTestId('wallet-toast'), 'no success feedback after a failed save').toHaveCount(0);
  await expect(amount).toHaveValue('300');
  await expect.poll(() => thumbX(thumb)).toBeLessThan(start + 2);
  await swipe(page, 1.1);
  await expect(page.getByTestId('budget-overlay-success')).toContainText('Budget saved');
  expect(writes.map((write) => write.method)).toEqual(['POST', 'POST']);
  expect(store).toHaveLength(1);
});

test('the keyboard-reachable tap-to-save works on a 320 px phone in Light mode', async ({ page }) => {
  await userId();
  await page.setViewportSize({ width: 320, height: 640 });
  // Light mode from the profile response only; the real profile is untouched.
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/"theme_preference":"[a-z]+"/g, '"theme_preference":"light"') });
  });
  const { writes } = await mockBudgets(page);
  await openBudget(page);
  await page.getByRole('radio', { name: 'Weekly' }).click();
  await page.getByRole('textbox', { name: 'Budget amount (RM)' }).fill('75');
  await expect(page.getByTestId('budget-swipe')).toHaveAttribute('aria-hidden', 'true');
  const tapSave = page.getByRole('button', { name: 'Or tap to save budget' });
  const box = (await tapSave.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await tapSave.focus();
  await page.keyboard.press('Enter');
  const success = page.getByTestId('budget-overlay-success');
  await expect(success).toContainText('Weekly budget');
  await expect(success).toContainText('12 Oct 2026 – 18 Oct 2026');
  expect(writes).toEqual([expect.objectContaining({ method: 'POST', body: expect.objectContaining({ amount: 75, period_type: 'weekly', period_start: '2026-10-12' }) })]);
});
