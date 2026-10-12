import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const PERIOD_SELECT = 'id,amount,category';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

/**
 * The Wallet overview's primary amount is the one rolling figure. With no budget it is "Spent this month",
 * so this period's expenses are mocked (and the budget is absent) to make the value known.
 */
async function mockPeriod(page: Page, amounts: { current: number[] }) {
  await page.route('**/rest/v1/expenses?*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (new URL(route.request().url()).searchParams.get('select') !== PERIOD_SELECT) return json(route, []);
    return json(route, amounts.current.map((amount, index) => ({ id: `00000000-0000-4000-9300-${String(index + 1).padStart(12, '0')}`, amount, category: 'food' })));
  });
  await page.route('**/rest/v1/budgets?*', (route) => (route.request().headers().accept ?? '').includes('vnd.pgrst.object')
    ? json(route, { code: 'PGRST116' }, 406) : json(route, []));
}

async function openWallet(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
}

const amount = (page: Page) => page.getByTestId('budget-spent').filter({ visible: true });

/** Samples, every frame for `ms`, the first rolling column's offset and boxes inside the overview card. */
function sample(page: Page, ms: number) {
  return page.evaluate((duration) => new Promise<{ t: number; y: number | null; card: string; label: string }[]>((resolve) => {
    const rows: { t: number; y: number | null; card: string; label: string }[] = [];
    const start = performance.now();
    // Sizes and positions relative to the card: nothing inside the card may move or resize while the digits roll.
    const rect = (el: Element | null | undefined) => el?.getBoundingClientRect();
    const frame = () => {
      const value = [...document.querySelectorAll('[data-testid="budget-spent"]')].find((el) => (el as HTMLElement).offsetParent !== null);
      const column = value?.querySelector('[data-testid="budget-spent-roll"] > div') as HTMLElement | null | undefined;
      const transform = column ? getComputedStyle(column).transform : 'none';
      const y = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : column ? 0 : null;
      const card = rect(value?.closest('[data-testid="budget-summary"]'));
      const label = rect(value?.previousElementSibling);
      const own = rect(value);
      rows.push({ t: performance.now() - start, y,
        card: card && own ? `${card.width}x${card.height}; amount ${own.x - card.x},${own.y - card.y} ${own.width}x${own.height}` : '',
        label: card && label ? `${label.x - card.x},${label.y - card.y} ${label.width}x${label.height}` : '' });
      if (performance.now() - start < duration) requestAnimationFrame(frame); else resolve(rows);
    };
    requestAnimationFrame(frame);
  }), ms);
}

test('only the primary amount rolls, within about a second, while the card and label stay still', async ({ page }) => {
  const amounts = { current: [1000.25, 234.25] };
  await mockPeriod(page, amounts);
  await openWallet(page);
  await expect(amount(page)).toHaveAttribute('aria-label', 'Spent this month, RM 1,234.50');
  const rows = await sample(page, 1300);

  const moving = rows.filter((row) => row.y !== null && Math.abs(row.y) > 0.5);
  expect(moving.length, 'the digits visibly roll').toBeGreaterThan(5);
  expect(new Set(moving.map((row) => Math.round(row.y!))).size, 'smooth, many intermediate positions').toBeGreaterThan(5);
  expect(moving.at(-1)!.t, 'settles within the 700–1000 ms window').toBeLessThan(1100);
  expect(rows.at(-1)!.y, 'settles into plain text: no rolling column remains').toBeNull();
  await expect(amount(page)).toHaveText(/^RM\s?1,234\.50$/);
  expect(new Set(rows.map((row) => row.card)).size, 'the card never moves or resizes').toBe(1);
  expect(new Set(rows.map((row) => row.label)).size, 'the label never moves').toBe(1);

  // Returning with the same total does not replay the roll.
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await expect(amount(page)).toHaveAttribute('aria-label', 'Spent this month, RM 1,234.50');
  await expect(amount(page).getByTestId('budget-spent-roll')).toHaveCount(0);

  // A lower total rolls from the previous value, keeping two decimals and separators.
  amounts.current = [5.5];
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await expect(amount(page)).toHaveAttribute('aria-label', 'Spent this month, RM 5.50');
  const after = await sample(page, 1300);
  expect(after.some((row) => row.y !== null && Math.abs(row.y) > 0.5), 'the decrease rolls').toBe(true);
  expect(after.at(-1)!.y).toBeNull();
  await expect(amount(page)).toHaveText(/^RM\s?5\.50$/);
});

test('large amounts fit a 320 px phone without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await mockPeriod(page, { current: [1234567.89] });
  await openWallet(page);
  await expect(amount(page)).toHaveAttribute('aria-label', 'Spent this month, RM 1,234,567.89');
  await sample(page, 1200);
  await expect(amount(page)).toHaveText(/^RM\s?1,234,567\.89$/);
  const glyphs = await amount(page).getByTestId('budget-spent-glyphs').boundingBox();
  const card = await page.getByTestId('budget-summary').filter({ visible: true }).boundingBox();
  expect(glyphs!.x + glyphs!.width).toBeLessThanOrEqual(card!.x + card!.width - 16);
});

test('reduced motion shows the final amount at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockPeriod(page, { current: [125.5] });
  await openWallet(page);
  await expect(amount(page)).toHaveAttribute('aria-label', 'Spent this month, RM 125.50');
  const rows = await sample(page, 400);
  // Allow the few frames before the device setting is read; after that nothing moves.
  expect(rows.filter((row) => row.t > 150 && row.y !== null && Math.abs(row.y) > 0.5)).toEqual([]);
});
