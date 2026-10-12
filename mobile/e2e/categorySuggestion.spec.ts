import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

/** Stubs the suggestion endpoint; every request body and auth header is recorded. */
async function mockSuggestion(page: Page, reply: (title: string) => Record<string, unknown>) {
  const calls: { body: unknown; bearer: boolean }[] = [];
  await page.route('**/api/ml/expense-category-suggestion', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = request.postDataJSON() as { title: string };
    calls.push({ body, bearer: request.headers().authorization?.startsWith('Bearer ') === true });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(reply(body.title)) });
  });
  return calls;
}

/** Records expense writes; nothing reaches the real table from these tests. */
async function blockExpenseWrites(page: Page) {
  const writes: string[] = [];
  await page.route('**/rest/v1/expenses*', (route) => {
    if (route.request().method() === 'GET') return route.continue();
    writes.push(route.request().method());
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'blocked in test' }) });
  });
  return writes;
}

async function openAddExpense(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('button', { name: 'Add expense' }).filter({ visible: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
}

const suggested = { available: true, category: 'food', confidence: 0.82, trainingExpenseCount: 24 };

test('a confident suggestion is optional: "Use" fills the category without saving', async ({ page }) => {
  const calls = await mockSuggestion(page, () => suggested);
  const writes = await blockExpenseWrites(page);
  await openAddExpense(page);

  // Short titles never ask; typing is debounced into one request with only the title.
  await page.getByRole('textbox', { name: 'Title' }).pressSequentially('KF');
  await page.waitForTimeout(900);
  expect(calls).toHaveLength(0);
  await page.getByRole('textbox', { name: 'Title' }).pressSequentially('C Gambang', { delay: 40 });
  const card = page.getByTestId('category-suggestion');
  await expect(card).toContainText('Suggested category');
  await expect(card).toContainText('Food · 82% confidence');
  await expect(card).toContainText('Based on similar expenses you saved before.');
  expect(calls).toEqual([{ body: { title: 'KFC Gambang' }, bearer: true }]);
  // The category stays empty until the student acts.
  await expect(page.getByRole('button', { name: 'Category: Select a category' })).toBeVisible();

  await card.getByRole('button', { name: 'Use Food' }).click();
  await expect(page.getByRole('button', { name: 'Category: Food' })).toBeVisible();
  await expect(page.getByTestId('category-suggestion')).toHaveCount(0);
  // The student can still change it.
  await page.getByRole('button', { name: 'Category: Food' }).click();
  await page.getByRole('radio', { name: 'Personal' }).click();
  await expect(page.getByRole('button', { name: 'Category: Personal' })).toBeVisible();
  expect(writes, 'using a suggestion never saves').toEqual([]);
});

test('"Choose myself" dismisses the suggestion and manual choice works as before', async ({ page }) => {
  await mockSuggestion(page, () => suggested);
  const writes = await blockExpenseWrites(page);
  await openAddExpense(page);
  await page.getByRole('textbox', { name: 'Title' }).fill('Grab Food');
  await page.getByTestId('category-suggestion').getByRole('button', { name: 'Choose myself' }).click();
  await expect(page.getByTestId('category-suggestion')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Title' }).fill('Grab Food nasi');
  await page.waitForTimeout(900);
  await expect(page.getByTestId('category-suggestion'), 'stays dismissed for this form').toHaveCount(0);
  await page.getByRole('button', { name: /^Category:/ }).click();
  await page.getByRole('radio', { name: 'Transport' }).click();
  await expect(page.getByRole('button', { name: 'Category: Transport' })).toBeVisible();
  expect(writes).toEqual([]);
});

test('not enough data shows a helpful note, and low confidence shows nothing', async ({ page }) => {
  await mockSuggestion(page, (title) => title.startsWith('New')
    ? { available: false, reason: 'not_enough_data', trainingExpenseCount: 4 }
    : { available: false, reason: 'low_confidence', trainingExpenseCount: 30 });
  await openAddExpense(page);
  await page.getByRole('textbox', { name: 'Title' }).fill('New thing');
  await expect(page.getByTestId('category-suggestion-notEnoughData')).toContainText('Add more categorised expenses and I can start suggesting categories.');
  await page.getByRole('textbox', { name: 'Title' }).fill('Mystery shop');
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('category-suggestion')).toHaveCount(0);
  await expect(page.getByTestId('category-suggestion-notEnoughData')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Category: Select a category' })).toBeVisible();
});

test('OCR review can show a suggestion from the draft title only, and saving stays explicit', async ({ page }) => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
  const calls = await mockSuggestion(page, () => ({ available: true, category: 'academic_materials', confidence: 0.9, trainingExpenseCount: 40 }));
  const writes = await blockExpenseWrites(page);
  await page.route('**/api/ocr/receipt', (route) => route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: cors })
    : route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({
      merchantName: 'Kedai Buku UMPSA', purchaseDate: '2026-10-08', totalAmount: 12.5,
      rawText: 'Kedai Buku UMPSA\nNOTA PRIVATE LINE\nTOTAL RM 12.50', warnings: [],
    }) }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('button', { name: 'Scan receipt' }).click();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo' }).click();
  await (await fileChooser).setFiles({ name: 'receipt.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l4cAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Extract details' }).click();
  await expect(page.getByText('Review expense')).toBeVisible();

  const card = page.getByTestId('category-suggestion');
  await expect(card).toContainText('Academic Materials · 90% confidence');
  // Only the draft title is sent, never the raw OCR text.
  expect(calls.map((call) => call.body)).toEqual([{ title: 'Kedai Buku UMPSA' }]);
  expect(JSON.stringify(calls)).not.toContain('PRIVATE');
  // OCR still starts with an empty category; nothing is saved until the student saves.
  await expect(page.getByRole('button', { name: 'Category: Select a category' })).toBeVisible();
  await card.getByRole('button', { name: 'Use Academic Materials' }).click();
  await expect(page.getByRole('button', { name: 'Category: Academic Materials' })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Save receipt expense' }).click();
  await expect.poll(() => writes).toEqual(['POST']);
});
