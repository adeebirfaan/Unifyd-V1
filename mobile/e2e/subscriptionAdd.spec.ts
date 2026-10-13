import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;

type Row = Record<string, unknown>;
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

/**
 * Subscriptions live in memory. `insert` decides each POST's fate, so tests can hold a save open (to see the
 * loading state) or fail it. Every POST is recorded.
 */
async function mockSubscriptions(page: Page, insert: (attempt: number) => Promise<number> = async () => 201) {
  const store: Row[] = [];
  const posts: Row[] = [];
  await page.route('**/rest/v1/subscriptions*', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') return json(route, 200, store);
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Row;
      posts.push(body);
      const status = await insert(posts.length);
      if (status >= 400) return json(route, status, { message: 'boom' });
      store.push({ ...body, id: `00000000-0000-4000-9000-${String(store.length + 1).padStart(12, '0')}` });
      return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    }
    return route.fulfill({ status: 405, body: '' });
  });
  return { store, posts };
}

async function openAdd(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByTestId('quick-subscriptions').filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Add your first subscription' }).click();
  await expect(page.getByRole('heading', { name: 'Add subscription' })).toBeVisible();
}

/** Drags the slider's thumb sideways by `fraction` of the track (1 = the far end). */
async function swipe(page: Page, fraction: number) {
  const track = (await page.getByTestId('subscription-swipe').boundingBox())!;
  const thumb = (await page.getByTestId('subscription-swipe-thumb').boundingBox())!;
  const x = thumb.x + thumb.width / 2;
  const y = thumb.y + thumb.height / 2;
  const travel = track.width - thumb.width - 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + travel * fraction, y + 2, { steps: 12 });
  await page.mouse.up();
}

const thumbX = async (thumb: Locator) => (await thumb.boundingBox())!.x;

test('name suggestions filter, fill only the name, follow edits, and work from the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockSubscriptions(page);
  await openAdd(page);
  const name = page.getByRole('textbox', { name: 'Subscription name' });
  const list = page.getByTestId('subscription-suggestions');
  const preview = page.getByTestId('subscription-name-preview');

  // A blank name shows the neutral placeholder; focusing opens a compact list of names only.
  await expect(preview.getByTestId('subscription-icon-placeholder')).toHaveCount(1);
  await name.focus();
  await expect(list).toContainText('Names only. Add your own amount and dates.');
  await expect(list.getByRole('button')).toHaveCount(6);

  await name.fill('SPO');
  await expect(list.getByRole('button')).toHaveCount(1);
  await list.getByRole('button', { name: 'Use Spotify' }).click();
  await expect(name).toHaveValue('Spotify');
  await expect(list).toHaveCount(0);
  await expect(preview.getByTestId('subscription-mark-spotify')).toHaveCount(1);
  // Nothing but the name is filled in.
  await expect(page.getByRole('textbox', { name: 'Amount per billing' })).toHaveValue('');
  await expect(page.getByRole('button', { name: /^Category \(optional\): No category/ })).toBeVisible();

  // Typing reopens the list with the chosen name marked; editing it into another name resets the icon.
  await name.press('End');
  await name.press('Backspace');
  await expect(name).toHaveValue('Spotif');
  await expect(preview.getByTestId('subscription-icon-initial')).toContainText('S');
  await name.press('y');
  await expect(list.getByRole('button', { name: 'Spotify, Selected' })).toBeVisible();

  // Any custom name is fine: no suggestions, and a neutral initial tile.
  await name.fill('Gym club');
  await expect(list).toHaveCount(0);
  await expect(preview.getByTestId('subscription-icon-initial')).toContainText('G');

  // Keyboard: Arrow Down moves into the list, Enter chooses, Escape closes.
  await name.fill('net');
  await name.press('ArrowDown');
  await expect(list.getByRole('button', { name: 'Use Netflix' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(name).toHaveValue('Netflix');
  await expect(list).toHaveCount(0);
  await expect(preview.getByTestId('subscription-mark-netflix')).toHaveCount(1);
  await name.fill('dis');
  await expect(list).toBeVisible();
  await name.press('Escape');
  await expect(list).toHaveCount(0);
});

test('swipe: a partial drag springs back without saving, an invalid form never opens the overlay, and a full swipe saves once', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const { store, posts } = await mockSubscriptions(page, async () => { await held; return 201; });
  await openAdd(page);
  const thumb = page.getByTestId('subscription-swipe-thumb');
  const start = await thumbX(thumb);

  // Halfway is not enough: the thumb returns and nothing is sent.
  await swipe(page, 0.5);
  await expect.poll(() => thumbX(thumb)).toBeLessThan(start + 2);
  expect(posts).toEqual([]);

  // A complete swipe on an empty form shows the errors and springs back; no overlay appears.
  await swipe(page, 1.1);
  await expect(page.getByText('Enter a subscription name.')).toBeVisible();
  await expect(page.getByText('Enter the amount.')).toBeVisible();
  await expect(page.getByTestId('subscription-saved-overlay')).toHaveCount(0);
  await expect.poll(() => thumbX(thumb)).toBeLessThan(start + 2);
  expect(posts).toEqual([]);

  await page.getByRole('textbox', { name: 'Subscription name' }).fill('YouTube Premium');
  await page.getByRole('textbox', { name: 'Amount per billing' }).fill('17.90');
  await page.getByRole('radio', { name: 'Yearly' }).click();
  await expect(page.getByRole('radio', { name: 'Yearly' })).toBeChecked();
  await swipe(page, 1.1);

  // While the save is pending: blue overlay with a spinner, and no checkmark.
  await expect(page.getByTestId('subscription-overlay-saving')).toContainText('Saving subscription…');
  await expect(page.getByTestId('subscription-overlay-success')).toHaveCount(0);
  release();
  const success = page.getByTestId('subscription-overlay-success');
  await expect(success).toContainText('Subscription added');
  await expect(success).toContainText('YouTube Premium');
  await expect(success).toContainText('RM 17.90');
  await expect(success).toContainText('Yearly');
  await expect(success).not.toContainText('-RM');
  await expect(success.getByTestId('subscription-mark-youtube')).toHaveCount(1);
  // The date defaults to today, so "3 days before" has already passed: a short pill (full sentence for screen readers), not retryable.
  await expect(page.getByTestId('subscription-overlay-reminder')).toContainText('Reminder time has passed');
  await expect(page.getByTestId('subscription-overlay-reminder')).toHaveAttribute('aria-label', 'The reminder time has already passed, so no notification was scheduled.');
  await expect(page.getByRole('button', { name: 'Try the reminder again' })).toHaveCount(0);

  // It stays until the student continues.
  await page.waitForTimeout(1500);
  await expect(success).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ name: 'YouTube Premium', amount: 17.9, billing_frequency: 'yearly', reminder_days_before: 3, notifications_enabled: true, is_active: true, category: null, notes: null });
  await page.getByTestId('subscription-saved-overlay').click({ position: { x: 20, y: 120 } });
  await expect(page.getByText('Subscription saved.')).toBeVisible();
  await expect(page.getByTestId('subscriptions-summary')).toContainText('1 active subscription');
  expect(store).toHaveLength(1);
});

test('a failed save closes the overlay, keeps every value, resets the slider, and retrying saves exactly one row', async ({ page }) => {
  const { store, posts } = await mockSubscriptions(page, async (attempt) => attempt === 1 ? 500 : 201);
  await openAdd(page);
  const thumb = page.getByTestId('subscription-swipe-thumb');
  const start = await thumbX(thumb);
  await page.getByRole('textbox', { name: 'Subscription name' }).fill('Canva');
  await page.getByRole('textbox', { name: 'Amount per billing' }).fill('9.50');
  await page.getByRole('textbox', { name: 'Notes (optional)' }).fill('Student plan');
  await swipe(page, 1.1);

  await expect(page.getByTestId('subscription-save-error')).toHaveText('We could not save this subscription. Please try again.');
  await expect(page.getByTestId('subscription-saved-overlay')).toHaveCount(0);
  await expect.poll(() => thumbX(thumb)).toBeLessThan(start + 2);
  await expect(page.getByRole('textbox', { name: 'Subscription name' })).toHaveValue('Canva');
  await expect(page.getByRole('textbox', { name: 'Amount per billing' })).toHaveValue('9.50');
  await expect(page.getByRole('textbox', { name: 'Notes (optional)' })).toHaveValue('Student plan');

  await swipe(page, 1.1);
  await expect(page.getByTestId('subscription-overlay-success')).toContainText('Canva');
  expect(posts).toHaveLength(2);
  expect(store).toHaveLength(1);
});

test('Reduce Motion: the accessible tap-to-save works from the keyboard and shows success at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 640 });
  const { posts } = await mockSubscriptions(page);
  await openAdd(page);
  await page.getByRole('textbox', { name: 'Subscription name' }).fill('Notion');
  await page.getByRole('textbox', { name: 'Amount per billing' }).fill('20');
  // The slider is hidden from assistive technology; the labelled button is the accessible way to save.
  await expect(page.getByTestId('subscription-swipe')).toHaveAttribute('aria-hidden', 'true');
  const tapSave = page.getByRole('button', { name: 'Or tap to save subscription' });
  const box = (await tapSave.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await tapSave.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('subscription-overlay-success')).toContainText('Subscription added');
  await expect(page.getByTestId('subscription-overlay-success')).toContainText('RM 20.00');
  const continueButton = page.getByRole('button', { name: 'Tap anywhere to continue' });
  await continueButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Subscription saved.')).toBeVisible();
  expect(posts).toHaveLength(1);
});
