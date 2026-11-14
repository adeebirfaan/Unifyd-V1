import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

// The receipt scan flow (Start → Reading → Review). The OCR endpoint is always mocked: Google Vision is never called,
// and no expense is written (saves are blocked or mocked).
const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l4cAAAAASUVORK5CYII=', 'base64');
const RESULT = {
  merchantName: 'Kedai Buku UMPSA', purchaseDate: '2026-10-08', totalAmount: 12.5,
  rawText: 'KEDAI BUKU UMPSA\nNOTA PRIVATE LINE\nTOTAL RM 12.50', warnings: [] as string[],
};

type OcrReply = (route: Route) => Promise<void> | void;
async function mockOcr(page: Page, reply: OcrReply) {
  const posts: number[] = [];
  await page.route('**/api/ocr/receipt', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    posts.push(Date.now());
    await reply(route);
  });
  return posts;
}
const ok = (body: Record<string, unknown>) => (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });

async function openScan(page: Page) {
  // Nothing in this spec may write an expense.
  await page.route('**/rest/v1/expenses*', (route) => route.request().method() === 'GET' ? route.continue()
    : route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'blocked in test' }) }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('button', { name: 'Scan receipt' }).click();
  await expect(page.getByTestId('scan-start')).toBeVisible();
}

async function choosePhoto(page: Page, name = 'receipt.png', buffer = PNG, mimeType = 'image/png') {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo or screenshot' }).click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}

test.beforeEach(() => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
});

test('Start shows only the essentials, Reading lasts at least 1.2 s, and Review is compact with a fixed Save', async ({ page }) => {
  await mockOcr(page, ok(RESULT));
  await openScan(page);
  const start = page.getByTestId('scan-start');
  await expect(start.getByRole('button', { name: 'Scan with camera' })).toBeVisible();
  await expect(start.getByRole('button', { name: 'Choose photo or screenshot' })).toBeVisible();
  await expect(start.getByRole('button', { name: 'Add expense manually' })).toBeVisible();
  await expect(page.getByTestId('scan-privacy')).toHaveText('Read by Google Cloud Vision. Photo not kept.');
  await expect(page.getByText('Extract details')).toHaveCount(0);

  // Record, inside the page, when Reading appears and when Review replaces it.
  await page.evaluate(() => {
    const marks: Record<string, number> = {};
    (window as unknown as { scanMarks: Record<string, number> }).scanMarks = marks;
    new MutationObserver(() => {
      for (const id of ['scan-reading', 'scan-review']) if (!marks[id] && document.querySelector(`[data-testid="${id}"]`)) marks[id] = performance.now();
    }).observe(document.body, { childList: true, subtree: true });
  });
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review')).toBeVisible();
  const marks = await page.evaluate(() => (window as unknown as { scanMarks: Record<string, number> }).scanMarks);
  expect(marks['scan-review']! - marks['scan-reading']!).toBeGreaterThanOrEqual(1150);

  const review = page.getByTestId('scan-review');
  await expect(review.getByText('Review receipt')).toBeVisible();
  await expect(page.getByTestId('scan-photo-row')).toContainText('Tap to view');
  await expect(review.getByText('Details', { exact: true })).toBeVisible();
  // No items from the server: the Items card is not shown at all.
  await expect(page.getByTestId('scan-items')).toHaveCount(0);
  // The raw text stays off the page.
  await expect(page.getByText('NOTA PRIVATE LINE')).toHaveCount(0);
  // The Save button sits outside the scroll area, in the viewport.
  const footer = page.getByTestId('scan-save-footer');
  await expect(footer.getByRole('button', { name: 'Save expense' })).toBeInViewport();

  await page.getByTestId('scan-photo-row').click();
  await expect(page.getByTestId('scan-photo-viewer')).toBeVisible();
  await page.getByTestId('scan-photo-close').click();
  await expect(page.getByTestId('scan-photo-viewer')).toHaveCount(0);
});

test('the detected text opens only in a bottom sheet', async ({ page }) => {
  await mockOcr(page, ok(RESULT));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review')).toBeVisible();
  await expect(page.getByText('NOTA PRIVATE LINE')).toHaveCount(0);
  await page.getByRole('button', { name: 'View detected text' }).click();
  const sheet = page.getByTestId('scan-text-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Detected text', { exact: true })).toBeVisible();
  await expect(sheet.getByText('The text Google Cloud Vision read from your photo, to help you check the details.')).toBeVisible();
  await expect(page.getByTestId('scan-text-body')).toHaveText(RESULT.rawText);
  await page.getByTestId('scan-text-close').click();
  await expect(sheet).toHaveCount(0);
});

test('uncertain fields are marked from the server warnings, and a mark clears once the field is edited', async ({ page }) => {
  await mockOcr(page, ok({ ...RESULT, purchaseDate: null, warnings: ['Merchant name needs review.', 'Purchase date needs review.'] }));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review')).toBeVisible();
  await expect(page.getByTestId('scan-flag-merchant')).toContainText('Check');
  await expect(page.getByTestId('scan-flag-date')).toContainText('Check');
  await expect(page.getByTestId('scan-flag-total')).toHaveCount(0);
  // Screen readers hear the same mark, and an empty flagged date asks to be filled in.
  const merchant = page.getByRole('textbox', { name: 'Merchant, needs review' });
  await expect(merchant).toHaveValue('Kedai Buku UMPSA');
  await expect(page.getByRole('button', { name: 'Date: Not found, needs review' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Total' })).toHaveValue('12.50');
  await merchant.fill('Kedai Buku UMPSA Pekan');
  await expect(page.getByTestId('scan-flag-merchant')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Merchant' })).toHaveValue('Kedai Buku UMPSA Pekan');
  await expect(page.getByTestId('scan-flag-date')).toBeVisible();
});

test('a hard-to-read photo offers Retake until a field is edited; one uncertain field does not', async ({ page }) => {
  let reply: Record<string, unknown> = { ...RESULT, purchaseDate: null, totalAmount: null, warnings: ['Purchase date needs review.', 'Total amount needs review.'] };
  const posts = await mockOcr(page, (route) => ok(reply)(route));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review-notice')).toContainText('Parts of this photo were hard to read. It may be blurry, dark, or sideways.');
  // Retake returns to Start without a discard question (nothing was edited), ready for a new photo.
  await page.getByRole('button', { name: 'Retake photo' }).click();
  await expect(page.getByTestId('scan-start')).toBeVisible();
  await expect(page.getByText('Discard this scan?')).toHaveCount(0);
  reply = { ...RESULT, warnings: ['Purchase date needs review.'] };
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review')).toBeVisible();
  expect(posts).toHaveLength(2);
  await expect(page.getByTestId('scan-flag-date')).toBeVisible();
  await expect(page.getByTestId('scan-review-notice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retake photo' })).toHaveCount(0);
});

test('the Retake hint disappears once the student starts fixing the fields', async ({ page }) => {
  await mockOcr(page, ok({ ...RESULT, warnings: ['Merchant name needs review.', 'Total amount needs review.'] }));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByRole('button', { name: 'Retake photo' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Total, needs review' }).fill('13.50');
  await expect(page.getByRole('button', { name: 'Retake photo' })).toHaveCount(0);
  await expect(page.getByTestId('scan-review-notice')).toHaveCount(0);
  await expect(page.getByTestId('scan-flag-merchant')).toBeVisible();
});

test('no readable text shows one notice and every field asks to be filled in', async ({ page }) => {
  await mockOcr(page, ok({ merchantName: null, purchaseDate: null, totalAmount: null, rawText: '',
    warnings: ['No readable text was detected.', 'Merchant name needs review.', 'Purchase date needs review.', 'Total amount needs review.'] }));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review-notice')).toContainText('We couldn’t read any text. Enter the details yourself.');
  await expect(page.getByTestId('scan-flag-merchant')).toBeVisible();
  await expect(page.getByTestId('scan-flag-date')).toBeVisible();
  await expect(page.getByTestId('scan-flag-total')).toBeVisible();
  await page.getByRole('button', { name: 'View detected text' }).click();
  await expect(page.getByTestId('scan-text-body')).toHaveText('No text was detected.');
});

test('after 20 s Reading offers Retry and Enter manually; Cancel returns to Start', async ({ page }) => {
  const held: Route[] = [];
  const posts = await mockOcr(page, (route) => { held.push(route); });
  await openScan(page);
  await page.clock.install();
  await choosePhoto(page);
  await expect(page.getByTestId('scan-status')).toHaveText('Reading your receipt…');
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByTestId('scan-slow')).toHaveCount(0);
  await page.clock.fastForward(20500);
  const slow = page.getByTestId('scan-slow');
  await expect(slow).toContainText('This is taking longer than usual.');
  await expect(page.getByTestId('scan-ring')).toBeVisible();

  // Retry sends the same prepared photo again and restarts the 20 s wait.
  await page.getByTestId('scan-slow-retry').click();
  await expect.poll(() => posts.length).toBe(2);
  await expect(slow).toHaveCount(0);
  await page.getByTestId('scan-cancel').click();
  await expect(page.getByTestId('scan-start')).toBeVisible();
  await expect(page.getByTestId('scan-error')).toHaveCount(0);

  await choosePhoto(page);
  await expect.poll(() => posts.length).toBe(3);
  await page.clock.fastForward(20500);
  await page.getByTestId('scan-slow-manual').click();
  await expect(page).toHaveURL(/\/add-expense/);
  await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
});

test('upload and reading failures explain what happened and offer Try again and manual entry', async ({ page }) => {
  let mode: 'offline' | 'server' | 'ok' = 'offline';
  await mockOcr(page, (route) => mode === 'offline' ? route.abort('internetdisconnected')
    : mode === 'server' ? route.fulfill({ status: 502, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: { code: 'OCR_UNAVAILABLE' } }) })
      : ok(RESULT)(route));
  await openScan(page);
  await choosePhoto(page);
  const error = page.getByTestId('scan-error');
  await expect(error).toContainText('We couldn’t upload the photo. Check your connection and try again.');
  await expect(page.getByRole('button', { name: 'Add expense manually' })).toBeVisible();

  mode = 'server';
  await page.getByTestId('scan-error-retry').click();
  await expect(error).toContainText('We could not read the receipt right now. Please retry or add it manually.');

  mode = 'ok';
  await page.getByTestId('scan-error-retry').click();
  await expect(page.getByTestId('scan-review')).toBeVisible();
});

test('an unsupported photo stays on Start with its message and no upload', async ({ page }) => {
  const posts = await mockOcr(page, ok(RESULT));
  await openScan(page);
  await choosePhoto(page, 'notes.HEIC', Buffer.from('not an image'), 'image/heic');
  await expect(page.getByTestId('scan-error')).toContainText('We could not prepare that photo for scanning. Please try another photo.');
  await expect(page.getByTestId('scan-error-retry')).toHaveCount(0);
  expect(posts).toHaveLength(0);
});

test('items from the server start collapsed, show discounts as minus lines, and hide when there are none', async ({ page }) => {
  // The exact shape the receipt endpoint returns (server/src/receipt-items.ts).
  const items = [
    { name: 'Sample Crisps Original 160g', quantity: 1, unitPrice: 4.5, amount: 4.5 }, { name: 'Sample Biscuit Cup', quantity: 1, unitPrice: null, amount: 3.2 },
    { name: 'Sample Chocolate 50g', quantity: 1, unitPrice: null, amount: 5.9 }, { name: 'Sample Wafer Stick', quantity: 1, unitPrice: null, amount: 2.4 },
    { name: 'Sample Candy 15g', quantity: 5, unitPrice: 1.8, amount: 9 }, { name: 'Bundle price promo', quantity: 1, unitPrice: null, amount: -4 },
    { name: 'Sample Mineral Water', quantity: 1, unitPrice: null, amount: 6.1 },
  ];
  await mockOcr(page, ok({ ...RESULT, totalAmount: 27.1, items }));
  await openScan(page);
  await choosePhoto(page);
  const card = page.getByTestId('scan-items');
  await expect(card).toContainText('Items (7)');
  await expect(card.getByTestId('scan-item-row')).toHaveCount(4);
  await card.getByTestId('scan-items-toggle').click();
  await expect(card.getByTestId('scan-item-row')).toHaveCount(7);
  await expect(card.getByRole('button', { name: 'Discount Bundle price promo, minus RM 4.00. Edit discount' })).toContainText('−RM 4.00');
  const candy = card.getByRole('button', { name: /^Sample Candy 15g, quantity 5, RM 9.00/ });
  await expect(candy).toContainText('5 × RM 1.80');
  await expect(page.getByTestId('scan-items-incomplete')).toHaveCount(0);
  // 4.50 + 3.20 + 5.90 + 2.40 + 9.00 − 4.00 + 6.10 = 27.10, matching the total.
  await expect(page.getByTestId('scan-items-mismatch')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Total' }).fill('30.00');
  await expect(page.getByTestId('scan-items-mismatch')).toContainText('Items add up to RM 27.10, but the total is RM 30.00.');
  await card.getByRole('button', { name: /^Sample Wafer Stick/ }).click();
  await page.getByTestId('scan-item-remove').click();
  await expect(card).toContainText('Items (6)');
  await expect(card).toContainText('Only the expense is saved.');

  // Editing a line: a new quantity and price replace the row, and the printed unit price no longer applies.
  await candy.click();
  const sheet = page.getByTestId('scan-item-sheet');
  await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Sample Candy 15g');
  await expect(sheet.getByRole('textbox', { name: 'Price for this line' })).toHaveValue('9.00');
  await sheet.getByRole('textbox', { name: 'Quantity' }).fill('4');
  await sheet.getByRole('textbox', { name: 'Price for this line' }).fill('8.50');
  await sheet.getByRole('button', { name: 'Done' }).click();
  const edited = card.getByRole('button', { name: /^Sample Candy 15g, quantity 4, RM 8.50/ });
  await expect(edited).toContainText('× 4');
  await expect(edited).not.toContainText('RM 1.80');
  // Adding a line and a discount.
  await card.getByTestId('scan-item-add').click();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Plastic bag');
  await sheet.getByRole('textbox', { name: 'Price for this line' }).fill('0.20');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await card.getByTestId('scan-discount-add').click();
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Member discount');
  await sheet.getByRole('textbox', { name: 'Discount amount' }).fill('1.00');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(card).toContainText('Items (8)');
  await expect(card.getByRole('button', { name: 'Discount Member discount, minus RM 1.00. Edit discount' })).toBeVisible();
});

test('the server\'s "Items may be incomplete." warning shows on the Items card only', async ({ page }) => {
  await mockOcr(page, ok({ ...RESULT, totalAmount: 20, warnings: ['Items may be incomplete.'],
    items: [{ name: 'Nasi Lemak', quantity: 2, unitPrice: 6.5, amount: 13 }, { name: 'Teh Tarik', quantity: 1, unitPrice: null, amount: 2.5 }] }));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-items-incomplete')).toContainText('Some items may be missing or misread. Check them against your receipt.');
  await expect(page.getByTestId('scan-review-notice')).toHaveCount(0);
  await expect(page.getByTestId('scan-flag-total')).toHaveCount(0);
  await expect(page.getByTestId('scan-items')).toContainText('2 × RM 6.50');
});

test('Back from Review asks before discarding the scan', async ({ page }) => {
  await mockOcr(page, ok(RESULT));
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-review')).toBeVisible();
  await page.getByTestId('scan-review-back').click();
  const dialog = page.getByTestId('scan-discard');
  await expect(dialog).toContainText('Discard this scan?');
  await dialog.getByRole('button', { name: 'Keep reviewing' }).click();
  await expect(page.getByTestId('scan-review')).toBeVisible();
  await page.getByTestId('scan-review-back').click();
  await page.getByTestId('scan-discard').getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByTestId('scan-start')).toBeVisible();
});

test('Reduce Motion draws the ring still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockOcr(page, () => undefined);
  await openScan(page);
  await choosePhoto(page);
  await expect(page.getByTestId('scan-ring')).toHaveAttribute('data-motion', 'static');
  await page.getByTestId('scan-cancel').click();
  await expect(page.getByTestId('scan-start')).toBeVisible();
});
