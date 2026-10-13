import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const COLUMNS = 'id,name,amount,category,billing_frequency,next_billing_date,reminder_days_before,notifications_enabled,is_active,notes';

type Row = Record<string, unknown>;
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const eqFilters = (url: string) => [...new URL(url).searchParams].filter(([, value]) => value.startsWith('eq.')).map(([key, value]) => [key, value.slice(3)] as const);
const matches = (row: Row, filters: readonly (readonly [string, string])[]) => filters.every(([key, value]) => String(row[key]) === value);

/**
 * The subscriptions migration is awaiting owner review, so rows live in memory here.
 * Every write is recorded so tests can check exactly what the app sends.
 */
async function mockSubscriptions(page: Page, seed: Row[] = []) {
  const store: Row[] = seed.map((row) => ({ ...row }));
  const writes: { method: string; body: unknown }[] = [];
  const selects: string[] = [];
  await page.route('**/rest/v1/subscriptions*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const filters = eqFilters(request.url());
    const single = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    const respond = (rows: Row[]) => single ? (rows[0] ? json(route, 200, rows[0]) : json(route, 406, { code: 'PGRST116' })) : json(route, 200, rows);
    if (request.method() === 'GET') {
      selects.push(url.searchParams.get('select') ?? '');
      return respond(store.filter((row) => matches(row, filters)));
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Row;
      writes.push({ method: 'POST', body });
      store.push({ ...body, id: `00000000-0000-4000-9000-${String(store.length + 1).padStart(12, '0')}` });
      return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Row;
      writes.push({ method: 'PATCH', body });
      const rows = store.filter((row) => matches(row, filters));
      for (const row of rows) Object.assign(row, body);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    if (request.method() === 'DELETE') {
      writes.push({ method: 'DELETE', body: Object.fromEntries(filters) });
      const rows = store.filter((row) => matches(row, filters));
      for (const row of rows) store.splice(store.indexOf(row), 1);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    return route.fulfill({ status: 405, body: '' });
  });
  return { store, writes, selects };
}

async function userId() {
  const { client, userId: id } = await testClient();
  await client.auth.signOut();
  return id;
}

async function openSubscriptions(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByTestId('quick-subscriptions').filter({ visible: true }).click();
  await expect(page.getByText('YOUR FINANCES')).toBeVisible();
  await expect(page.getByText('Track recurring plans and renewal dates.')).toBeVisible();
}

const date = (iso: string) => new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

test.beforeEach(async ({ page }) => {
  // Monday 12 October 2026, 08:00 in Kuala Lumpur.
  await page.clock.setFixedTime(new Date('2026-10-12T08:00:00+08:00'));
  // A frozen clock also freezes animations (they read the same clock), so amounts are shown in their
  // final state at once, as with the device's Reduce Motion setting.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('an empty list leads to adding a first subscription, with validation and no expense created', async ({ page }) => {
  const owner = await userId();
  const { store, writes, selects } = await mockSubscriptions(page);
  const expenseWrites: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/rest/v1/expenses') && request.method() !== 'GET') expenseWrites.push(request.method()); });
  await openSubscriptions(page);

  await expect(page.getByTestId('subscriptions-empty')).toContainText('No subscriptions yet.');
  await page.getByRole('button', { name: 'Add your first subscription' }).click();

  // The Add screen saves by swipe or by its tap-to-save button; both validate first.
  const tapSave = page.getByRole('button', { name: 'Or tap to save subscription' });
  await tapSave.click();
  await expect(page.getByText('Enter a subscription name.')).toBeVisible();
  await expect(page.getByText('Enter the amount.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Subscription name' }).fill('  Spotify  ');
  await page.getByRole('textbox', { name: 'Amount per billing' }).fill('15.905');
  await tapSave.click();
  await expect(page.getByText('Enter an amount above RM 0.00 with up to 2 decimal places.')).toBeVisible();
  expect(writes).toEqual([]);

  await page.getByRole('textbox', { name: 'Amount per billing' }).fill('15.90');
  await expect(page.getByRole('radio', { name: 'Monthly' })).toBeChecked();
  await page.getByRole('button', { name: /^Category \(optional\):/ }).click();
  await page.getByRole('radio', { name: 'Personal' }).click();
  await page.getByRole('button', { name: /^Next billing date:/ }).click();
  await page.getByRole('button', { name: 'Sunday, 18 October 2026' }).click();
  await expect(page.getByRole('button', { name: 'Reminder timing: 3 days before' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Reminder notification' })).toBeChecked();
  await tapSave.click();

  await expect(page.getByTestId('subscription-overlay-success')).toContainText('Subscription added');
  await page.getByRole('button', { name: 'Tap anywhere to continue' }).click();
  // The result is a brief toast over the page. Web cannot deliver local reminders, which the toast says briefly
  // (the full sentence is its accessible label); the in-app list still shows the renewal.
  const toast = page.getByTestId('subscriptions-toast');
  await expect(toast).toContainText('Subscription saved.');
  await expect(toast).toContainText('Reminders work in the mobile app');
  await expect(toast).toHaveAttribute('aria-label', /Reminder notifications work in the mobile app, not on the web/);
  expect(writes).toEqual([{ method: 'POST', body: {
    user_id: owner, name: 'Spotify', amount: 15.9, category: 'personal', billing_frequency: 'monthly', next_billing_date: '2026-10-18',
    reminder_days_before: 3, notifications_enabled: true, is_active: true, notes: null,
  } }]);
  expect(store).toHaveLength(1);
  // Wallet's finance summary reads only the dates it needs; the screens use the full column list.
  expect(selects.filter((select) => select !== COLUMNS && select !== 'id,name,next_billing_date,is_active')).toEqual([]);
  await expect(page.getByTestId('subscriptions-summary')).toContainText('RM 15.90');
  await expect(page.getByTestId('subscriptions-summary')).toContainText('1 active subscription');
  await expect(page.getByTestId('subscriptions-attention')).toContainText('Spotify');
  await expect(page.getByTestId('subscriptions-attention')).toContainText('In 6 days');
  expect(expenseWrites, 'adding a subscription never creates an expense').toEqual([]);

  // The toast leaves by itself (4 s with a reminder line) and never comes back on a later visit.
  await expect(toast).toHaveCount(0, { timeout: 6000 });
  await page.getByTestId('subscriptions-attention').getByRole('button').first().click();
  await page.getByTestId('subscription-details').getByRole('button', { name: 'Edit Spotify' }).click();
  await expect(page.getByRole('textbox', { name: 'Subscription name' })).toHaveValue('Spotify');
  await page.getByRole('button', { name: 'Go back' }).filter({ visible: true }).click();
  await expect(page.getByTestId('subscriptions-summary')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('subscriptions-toast')).toHaveCount(0);
});

test('renewal needs confirmation and moves only the date; pause, resume, and delete update the list', async ({ page }) => {
  const owner = await userId();
  const spotify = { id: '00000000-0000-4000-9000-000000000101', user_id: owner, name: 'Spotify', amount: 15.9, category: null, billing_frequency: 'monthly', next_billing_date: '2026-10-10', reminder_days_before: 3, notifications_enabled: true, is_active: true, notes: 'Family plan' };
  const google = { id: '00000000-0000-4000-9000-000000000102', user_id: owner, name: 'Google One', amount: 107.88, category: null, billing_frequency: 'yearly', next_billing_date: '2026-10-25', reminder_days_before: 7, notifications_enabled: false, is_active: false, notes: null };
  const { store, writes } = await mockSubscriptions(page, [spotify, google]);
  await openSubscriptions(page);

  // A passed date stays as saved until the student confirms the renewal. Notes are never shown in the list.
  const spotifyRow = page.getByTestId(`subscription-row-${spotify.id}`);
  await expect(spotifyRow).toContainText('Overdue');
  await expect(spotifyRow).not.toContainText('Family plan');
  await expect(page.getByTestId('subscriptions-summary')).toContainText('RM 15.90');
  const sheet = page.getByTestId('subscription-details');

  // Actions live in the details sheet; renewing still asks first.
  await spotifyRow.click();
  await expect(sheet).toContainText('Spotify');
  await expect(sheet.getByTestId('subscription-details-status')).toContainText('Overdue');
  await sheet.getByRole('button', { name: 'Mark Spotify as renewed' }).click();
  const dialog = sheet.getByTestId('subscription-renew-dialog');
  await expect(dialog).toContainText(`moves from ${date('2026-10-10')} to ${date('2026-11-10')}`);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(writes).toEqual([]);

  await sheet.getByRole('button', { name: 'Mark Spotify as renewed' }).click();
  await sheet.getByTestId('subscription-renew-dialog').getByRole('button', { name: 'Mark as renewed' }).click();
  await expect(page.getByText(`Renewal recorded. Next billing date: ${date('2026-11-10')}.`)).toBeVisible();
  expect(writes).toEqual([{ method: 'PATCH', body: { next_billing_date: '2026-11-10' } }]);
  expect(store.find((row) => row.id === spotify.id)).toMatchObject({ amount: 15.9, reminder_days_before: 3, notifications_enabled: true });
  await expect(sheet.getByTestId('subscription-details-status')).toContainText('On schedule');
  await sheet.getByRole('button', { name: 'Close subscription details' }).first().click();
  await expect(sheet).toHaveCount(0);
  await expect(spotifyRow).not.toContainText('Overdue');

  // Paused plans sit in their own collapsed section. Resuming adds the honest yearly average (RM 107.88 ÷ 12 = RM 8.99).
  await expect(page.getByTestId(`subscription-row-${google.id}`)).toHaveCount(0);
  await page.getByTestId('subscriptions-paused-toggle').click();
  await page.getByTestId(`subscription-row-${google.id}`).click();
  await sheet.getByRole('button', { name: 'Resume Google One' }).click();
  await expect(page.getByText('Subscription resumed.')).toBeVisible();
  await expect(page.getByTestId('subscriptions-summary')).toContainText('RM 24.89');
  await sheet.getByRole('button', { name: 'Close subscription details' }).first().click();
  await spotifyRow.click();
  await sheet.getByRole('button', { name: 'Pause Spotify' }).click();
  await expect(page.getByText(/Subscription paused/)).toBeVisible();
  await expect(page.getByTestId('subscriptions-summary')).toContainText('RM 8.99');
  expect(writes.slice(1)).toEqual([{ method: 'PATCH', body: { is_active: true } }, { method: 'PATCH', body: { is_active: false } }]);

  // Edit still opens the existing edit route, whose delete keeps its confirmation.
  await sheet.getByRole('button', { name: 'Edit Spotify' }).click();
  await expect(page.getByRole('textbox', { name: 'Subscription name' })).toHaveValue('Spotify');
  await page.getByRole('button', { name: 'Delete subscription' }).click();
  const deleteDialog = page.getByTestId('subscription-delete-dialog').filter({ visible: true });
  await expect(deleteDialog).toContainText('Spotify and its reminder will be removed.');
  await deleteDialog.getByRole('button', { name: 'Delete subscription' }).click();
  await expect(page.getByText('Subscription deleted.')).toBeVisible();
  expect(store.map((row) => row.id)).toEqual([google.id]);
  await expect(page.getByTestId(`subscription-row-${spotify.id}`)).toHaveCount(0);
});

test('compact layout: no formula, attention rows in priority order, exactly five active rows with no View all, brand fallbacks, and delete from the sheet', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 640 });
  const owner = await userId();
  const base = { user_id: owner, category: null, billing_frequency: 'monthly', reminder_days_before: 3, notifications_enabled: true, notes: null };
  const row = (n: number, name: string, next: string, extra: Record<string, unknown> = {}) => ({ ...base, id: `00000000-0000-4000-9000-0000000003${String(n).padStart(2, '0')}`, name, amount: 10 + n, next_billing_date: next, is_active: true, ...extra });
  const rows = [
    row(1, 'Spotify', '2026-10-14'),
    row(2, 'YouTube Premium', '2026-10-12'),
    row(3, 'Gym membership with a very long name that must truncate safely', '2026-10-09'),
    row(4, 'Netflix', '2026-10-16'),
    row(5, 'Notion', '2026-11-30'),
    row(6, 'Old plan', '2026-10-01', { is_active: false }),
  ];
  const { store, writes } = await mockSubscriptions(page, rows);
  await openSubscriptions(page);
  await expect(page.getByText('Track recurring plans and renewal dates.')).toBeVisible();
  await expect(page.getByText(/divided by 3|52 weeks/)).toHaveCount(0);
  await expect(page.getByTestId('subscriptions-summary')).toContainText('Monthly equivalent');
  await expect(page.getByTestId('subscriptions-summary')).toContainText('5 active subscriptions');

  // Attention: overdue, then today, then the soonest, up to five rows; the later plan (30 Nov) is left out.
  const attention = page.getByTestId('subscriptions-attention').getByRole('button');
  await expect(attention).toHaveCount(4);
  await expect(attention.nth(3)).toContainText('Netflix');
  await expect(page.getByTestId('view-all-attention')).toHaveCount(0);
  await expect(attention.nth(0)).toContainText('Overdue');
  await expect(attention.nth(1)).toContainText('YouTube Premium');
  await expect(attention.nth(1)).toContainText('Renews today');
  await expect(attention.nth(2)).toContainText('Spotify');
  await expect(attention.nth(2)).toContainText('In 2 days');
  // Active list: compact rows (one each), with the paused plan kept out.
  const activeList = page.getByTestId('subscriptions-active');
  await expect(activeList.getByRole('button')).toHaveCount(5);
  await expect(page.getByTestId('view-all-active')).toHaveCount(0);
  await expect(activeList).not.toContainText('Old plan');
  await expect(page.getByTestId('subscriptions-paused-toggle')).toHaveText(/Paused \(1\)/);
  // Icons: local Simple Icons marks for YouTube and Spotify, and a neutral initial.
  await expect(activeList.getByTestId(`subscription-row-${rows[1].id}`).getByTestId('subscription-mark-youtube')).toHaveCount(1);
  await expect(activeList.getByTestId(`subscription-row-${rows[0].id}`).getByTestId('subscription-mark-spotify')).toHaveCount(1);
  await expect(activeList.getByTestId(`subscription-row-${rows[4].id}`).getByTestId('subscription-mark-notion')).toHaveCount(1);
  await expect(activeList.getByTestId(`subscription-row-${rows[2].id}`).getByTestId('subscription-icon-initial')).toContainText('G');
  // Long names never push the amount off a 320 px screen.
  const longRow = (await activeList.getByTestId(`subscription-row-${rows[2].id}`).boundingBox())!;
  expect(longRow.x + longRow.width).toBeLessThanOrEqual(320);
  await expect(activeList.getByTestId(`subscription-row-${rows[2].id}`)).toContainText('RM 13.00');

  // Reduce Motion: the sheet appears in place. Delete asks first, then removes only that plan.
  await activeList.getByTestId(`subscription-row-${rows[4].id}`).click();
  const sheet = page.getByTestId('subscription-details');
  await expect(sheet).toBeVisible();
  const y = (await sheet.boundingBox())!.y;
  await page.waitForTimeout(400);
  expect((await sheet.boundingBox())!.y).toBe(y);
  await expect(sheet).toContainText('3 days before');
  await sheet.getByRole('button', { name: 'Delete subscription' }).click();
  await expect(sheet.getByTestId('subscription-delete-dialog')).toContainText('Notion and its reminder will be removed.');
  expect(writes).toEqual([]);
  await sheet.getByTestId('subscription-delete-dialog').getByRole('button', { name: 'Delete subscription' }).click();
  await expect(page.getByText('Subscription deleted.')).toBeVisible();
  await expect(sheet).toHaveCount(0);
  expect(store.map((entry) => entry.id)).not.toContain(rows[4].id);
  expect(writes.map((write) => write.method)).toEqual(['DELETE']);
});

test('overview sections show at most five rows grouped by renewal date, and View all opens every plan', async ({ page }) => {
  const owner = await userId();
  const base = { user_id: owner, category: null, billing_frequency: 'monthly', reminder_days_before: 3, notifications_enabled: true, notes: null, is_active: true };
  const row = (n: number, name: string, next: string, amount = 10) => ({ ...base, id: `00000000-0000-4000-9000-0000000004${String(n).padStart(2, '0')}`, name, amount, next_billing_date: next });
  const rows = [
    row(1, 'Zoom', '2027-01-02'), row(2, 'Spotify', '2026-10-12'), row(3, 'Canva', '2026-10-12'), row(4, 'Notion', '2026-10-13'),
    row(5, 'Gym club', '2026-10-09'), row(6, 'Netflix', '2026-10-14'), row(7, 'Disney+', '2026-10-15'), row(8, 'iCloud+', '2026-12-31', 4.5),
  ];
  const { writes } = await mockSubscriptions(page, rows);
  await openSubscriptions(page);
  // Totals use every plan, not the preview.
  await expect(page.getByTestId('subscriptions-summary')).toContainText('8 active subscriptions');

  // Needs attention: 6 plans, 5 shown in urgency (and so date) order, grouped by date with relative labels.
  const attention = page.getByTestId('subscriptions-attention');
  await expect(attention.getByRole('button')).toHaveCount(5);
  await expect(page.getByTestId('view-all-attention')).toHaveText(/View all \(6\)/);
  await expect(attention.getByRole('heading')).toHaveText([date('2026-10-09'), 'Today', 'Tomorrow', date('2026-10-14')]);
  // Same date: name order, so Canva comes before Spotify.
  await expect(attention.getByRole('button').nth(0)).toContainText('Overdue');
  await expect(attention.getByRole('button').nth(1)).toContainText('Canva');
  await expect(attention.getByRole('button').nth(2)).toContainText('Spotify');

  // Active: by next billing date; 5 of 8 shown, with no day totals.
  const active = page.getByTestId('subscriptions-active');
  await expect(active.getByRole('button')).toHaveCount(5);
  await expect(page.getByTestId('view-all-active')).toHaveText(/View all \(8\)/);
  await expect(active).not.toContainText('Zoom');
  await expect(active.getByRole('heading').first()).toHaveText(date('2026-10-09'));

  // One accent for every identity icon (mark and initial alike); status colours are untouched.
  const cyan = 'rgb(52, 193, 252)';
  const fill = await active.getByTestId('subscription-mark-spotify').locator('path').first().evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toBe(cyan);
  const initial = await active.getByTestId('subscription-icon-initial').first().evaluate((el) => getComputedStyle(el.querySelector('div') ?? el).color);
  expect(initial).toBe(cyan);
  const overdue = await active.getByText('Overdue').first().evaluate((el) => getComputedStyle(el).color);
  expect(overdue).toBe('rgb(239, 68, 68)');

  // View all: every active plan, grouped by date across the year boundary.
  await page.getByTestId('view-all-active').click();
  const sheet = page.getByTestId('all-subscriptions-sheet');
  await expect(sheet).toContainText('All active subscriptions');
  await expect(sheet.getByTestId('all-subscriptions-count')).toHaveText('8 subscriptions');
  await expect(sheet.getByRole('button', { name: /next billing/ })).toHaveCount(8);
  await expect(sheet.getByTestId('subscription-day-2026-12-31')).toHaveText(date('2026-12-31'));
  await expect(sheet.getByTestId('subscription-day-2027-01-02')).toHaveText(date('2027-01-02'));
  await sheet.getByTestId('all-subscriptions-close').click();
  await expect(sheet).toHaveCount(0);

  // Opening a plan from the sheet keeps detail navigation; pausing it updates the overview and the sheet.
  await page.getByTestId('view-all-active').click();
  await sheet.getByTestId(`subscription-sheet-row-${rows[0].id}`).click();
  const details = page.getByTestId('subscription-details');
  await expect(details).toContainText('Zoom');
  await details.getByRole('button', { name: 'Pause Zoom' }).click();
  await expect(page.getByTestId('subscriptions-toast')).toContainText(/Subscription paused/);
  await details.getByRole('button', { name: 'Close subscription details' }).first().click();
  await expect(page.getByTestId('subscriptions-summary')).toContainText('7 active subscriptions');
  await expect(page.getByTestId('view-all-active')).toHaveText(/View all \(7\)/);
  await page.getByTestId('view-all-active').click();
  await expect(sheet.getByTestId('all-subscriptions-count')).toHaveText('7 subscriptions');
  await expect(sheet).not.toContainText('Zoom');
  await sheet.getByTestId('all-subscriptions-close').click();
  expect(writes).toEqual([{ method: 'PATCH', body: { is_active: false } }]);

  // The attention sheet holds all six.
  await page.getByTestId('view-all-attention').click();
  await expect(sheet).toContainText('All subscriptions needing attention');
  await expect(sheet.getByTestId('all-subscriptions-count')).toHaveText('6 subscriptions');
  await expect(sheet.getByRole('button', { name: /next billing/ })).toHaveCount(6);
});

test('one subscription shows one dated row and no View all', async ({ page }) => {
  const owner = await userId();
  await mockSubscriptions(page, [{ id: '00000000-0000-4000-9000-000000000501', user_id: owner, name: 'Notion', amount: 20, category: null, billing_frequency: 'yearly', next_billing_date: '2026-11-30', reminder_days_before: 3, notifications_enabled: true, notes: null, is_active: true }]);
  await openSubscriptions(page);
  await expect(page.getByTestId('subscriptions-attention')).toHaveCount(0);
  await expect(page.getByTestId('subscriptions-active').getByRole('button')).toHaveCount(1);
  await expect(page.getByTestId('subscriptions-active').getByRole('heading')).toHaveText(date('2026-11-30'));
  await expect(page.getByTestId('view-all-active')).toHaveCount(0);
});

test('Wallet shows upcoming renewals separately from spending totals', async ({ page }) => {
  const owner = await userId();
  const base = { user_id: owner, amount: 10, category: null, billing_frequency: 'monthly', reminder_days_before: 3, notifications_enabled: true, notes: null };
  await mockSubscriptions(page, [
    { ...base, id: '00000000-0000-4000-9000-000000000201', name: 'Spotify', next_billing_date: '2026-10-18', is_active: true },
    { ...base, id: '00000000-0000-4000-9000-000000000202', name: 'Overdue', next_billing_date: '2026-10-11', is_active: true },
    { ...base, id: '00000000-0000-4000-9000-000000000203', name: 'Later', next_billing_date: '2026-10-20', is_active: true },
    { ...base, id: '00000000-0000-4000-9000-000000000204', name: 'Paused', next_billing_date: '2026-10-13', is_active: false },
  ]);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await expect(page.getByTestId('attention-renewals-text').filter({ visible: true })).toHaveText('2 renewals in the next 7 days');
  await expect(page.getByTestId('finance-attention').filter({ visible: true })).toContainText('Not included in your spending totals.');
});

test('a load failure shows a retry state', async ({ page }) => {
  let fail = true;
  await page.route('**/rest/v1/subscriptions*', (route) => fail ? json(route, 500, { message: 'boom' }) : json(route, 200, []));
  await openSubscriptions(page);
  await expect(page.getByText('We could not load your subscriptions. Please try again.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).last().click();
  await expect(page.getByTestId('subscriptions-empty')).toBeVisible();
});
