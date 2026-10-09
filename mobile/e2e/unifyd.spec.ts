import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const runPrefix = `E2E Wallet ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;

function visibleTestId(page: Page, id: string) {
  return page.locator(`[data-testid="${id}"]`).filter({ visible: true });
}

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
}

async function restorePreferences() {
  const { client, userId } = await testClient();
  const { data, error } = await client.from('profiles')
    .update({ theme_preference: 'dark', language_preference: 'en' })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (error || !data) throw new Error('Could not restore Dark and English test preferences.');
  await client.auth.signOut();
}

async function cleanupExpenses() {
  const { client, userId } = await testClient();
  const { data, error } = await client.from('expenses')
    .select('id,title')
    .eq('user_id', userId)
    .like('title', `${runPrefix}%`);
  if (error) throw new Error('Could not list E2E expenses for cleanup.');
  for (const row of data ?? []) {
    if (!row.title.startsWith(runPrefix)) continue;
    const deleted = await client.from('expenses').delete()
      .eq('id', row.id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();
    if (deleted.error || !deleted.data) throw new Error('Could not delete an E2E expense during cleanup.');
  }
  const remaining = await client.from('expenses').select('id')
    .eq('user_id', userId)
    .like('title', `${runPrefix}%`);
  if (remaining.error || (remaining.data?.length ?? 0) > 0) throw new Error('E2E expense cleanup left test rows behind.');
  await client.auth.signOut();
}

async function spentTotal(page: Page): Promise<number> {
  const label = page.getByText('ALL-TIME SPENT', { exact: true }).filter({ visible: true });
  if (!await label.isVisible()) return 0;
  const total = await label.locator('..').getByText(/^RM /).textContent();
  return Number(total?.replace(/[^\d.]/g, '') ?? 0);
}

async function expectSpent(page: Page, amount: number) {
  await expect.poll(() => spentTotal(page)).toBeCloseTo(amount, 2);
}

test('receipt selection sends a bearer-authenticated image and shows an unsaved OCR draft', async ({ page }) => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
  let postedImage = false;
  const savedExpense: { value: Record<string, unknown> | null } = { value: null };
  let allowSave = false;
  await page.route('**/rest/v1/expenses*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (!allowSave) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'permission denied' }) });
      return;
    }
    savedExpense.value = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000001' }) });
  });
  await page.route('**/api/ocr/receipt', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      } });
      return;
    }
    postedImage = request.method() === 'POST'
      && request.headers().authorization?.startsWith('Bearer ') === true
      && (request.postDataBuffer()?.toString('latin1').includes('name="image"') ?? false);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({
      merchantName: 'Kedai Buku UMPSA', purchaseDate: '2026-10-08', totalAmount: 12.5,
      rawText: 'Kedai Buku UMPSA\nTOTAL RM 12.50', warnings: [],
    }) });
  });
  await signIn(page);
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('button', { name: 'Scan receipt' }).click();
  await expect(page.getByText('Preview only. No expense or receipt image has been saved.')).toHaveCount(0);
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo' }).click();
  await (await fileChooser).setFiles({
    name: 'synthetic-receipt.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l4cAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Extract details' }).click();
  await expect(page.getByText('Extracted draft')).toBeVisible();
  await expect(page.getByText('Kedai Buku UMPSA', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 12.50', { exact: true })).toBeVisible();
  await expect(page.getByText('Preview only. No expense or receipt image has been saved.')).toBeVisible();
  expect(postedImage).toBe(true);
  await expect(page.getByText('Review expense')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Kedai Buku UMPSA');
  await expect(page.getByRole('textbox', { name: 'Amount (RM)' })).toHaveValue('12.5');
  await page.getByRole('button', { name: 'Save receipt expense' }).click();
  await expect(page.getByText('Choose a category.')).toBeVisible();
  expect(savedExpense.value).toBeNull();
  await page.getByRole('textbox', { name: 'Title' }).fill('  Books from OCR  ');
  await page.getByRole('textbox', { name: 'Amount (RM)' }).fill('13.25');
  await page.getByRole('button', { name: /^Category:/ }).click();
  await page.getByRole('radio', { name: 'Academic Materials' }).click();
  await page.getByRole('textbox', { name: 'Notes (optional)' }).fill('  Checked receipt  ');
  await page.getByRole('button', { name: 'Save receipt expense' }).click();
  await expect(page.getByText('We could not save this receipt expense. Your changes are still here. Please try again.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('  Books from OCR  ');
  await expect(page.getByRole('textbox', { name: 'Amount (RM)' })).toHaveValue('13.25');
  expect(savedExpense.value).toBeNull();
  allowSave = true;
  await page.getByRole('button', { name: 'Save receipt expense' }).click();
  await expect(page.getByText('Expense saved.').filter({ visible: true })).toBeVisible();
  expect(savedExpense.value).toMatchObject({
    title: 'Books from OCR', amount: 13.25, category: 'academic_materials',
    expense_date: '2026-10-08', notes: 'Checked receipt', entry_source: 'ocr',
  });
  expect(typeof savedExpense.value?.user_id).toBe('string');
  expect(savedExpense.value).not.toHaveProperty('rawText');
  expect(savedExpense.value).not.toHaveProperty('image');
});

test('OCR review requires missing fields before an expense can be saved', async ({ page }) => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
  await page.route('**/api/ocr/receipt', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      } });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({
      merchantName: null, purchaseDate: null, totalAmount: null,
      rawText: 'Unclear receipt', warnings: ['Merchant name needs review.', 'Purchase date needs review.', 'Total amount needs review.'],
    }) });
  });
  await signIn(page);
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('button', { name: 'Scan receipt' }).click();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo' }).click();
  await (await fileChooser).setFiles({
    name: 'unclear-receipt.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l4cAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('button', { name: 'Extract details' }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Amount (RM)' })).toHaveValue('');
  await page.getByRole('button', { name: 'Save receipt expense' }).click();
  await expect(page.getByText('Enter an expense title.')).toBeVisible();
  await expect(page.getByText('Enter an amount.')).toBeVisible();
  await expect(page.getByText('Choose a category.')).toBeVisible();
  await expect(page.getByText('Choose an expense date.')).toBeVisible();
});

async function periodSpent(page: Page): Promise<number> {
  const text = await visibleTestId(page, 'budget-spent').filter({ visible: true }).textContent();
  return Number(text?.replace(/[^\d.]/g, '') ?? 0);
}

async function expectPeriodSpent(page: Page, amount: number) {
  await expect.poll(() => periodSpent(page)).toBeCloseTo(amount, 2);
}

async function addExpense(page: Page, title: string, amount: string, category: 'Food' | 'Transport' | 'Personal') {
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: 'Amount (RM)' }).fill(amount);
  await page.getByRole('button', { name: /^Category:/ }).click();
  await page.getByRole('radio', { name: category }).click();
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect(page.getByText(title, { exact: true }).filter({ visible: true })).toBeVisible();
}

async function openExpense(page: Page, title: string) {
  await page.getByRole('button', { name: `Open details for ${title}` }).click();
  await expect(page.getByText(title, { exact: true }).filter({ visible: true })).toBeVisible();
}

async function confirmDelete(page: Page) {
  await page.getByRole('button', { name: 'Delete expense' }).click();
  await expect(page.getByText('Delete this expense?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete expense' }).last().click();
  await expect(page.getByText('Expense deleted.').filter({ visible: true })).toBeVisible();
}

test('authentication validation, sign in, sign out, and sign in again', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your password.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Open profile' }).click();
  await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await signIn(page);
});

test('profile controls, settings preferences, and legal pages', async ({ page }) => {
  await signIn(page);
  try {
    await page.getByRole('button', { name: 'Open profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('textbox', { name: 'Full name' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Faculty or centre:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Study year:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Default reminder:/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Select Turban woman avatar' })).toBeVisible();
    await page.getByRole('button', { name: /^Faculty or centre:/ }).click();
    await page.getByRole('radio', { name: 'Faculty of Computing' }).click();
    await expect(page.getByRole('button', { name: /^Programme:/ })).toBeVisible();
    await page.getByRole('button', { name: 'Back to profile' }).click();

    await page.getByRole('button', { name: 'Profile settings' }).click();
    const appearance = page.getByRole('button', { name: /^Appearance:/ });
    await expect(page.getByRole('radio', { name: /System/ })).toHaveCount(0);
    await appearance.click();
    await expect(page.getByRole('radio', { name: /System/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Light/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Dark/ })).toBeVisible();
    await appearance.click();
    await expect(page.getByRole('radio', { name: /System/ })).toHaveCount(0);
    await appearance.click();
    await page.getByRole('radio', { name: /Light/ }).click();
    await expect(page.getByRole('button', { name: 'Appearance: Light' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /System/ })).toHaveCount(0);
    const pageColor = await page.getByText('Settings', { exact: true }).evaluate((element) => {
      let node: Element | null = element;
      while (node && getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)') node = node.parentElement;
      return node ? getComputedStyle(node).backgroundColor : '';
    });
    const cardColor = await page.getByText('Appearance', { exact: true }).evaluate((element) => {
      let node: Element | null = element;
      while (node && getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)') node = node.parentElement;
      return node ? getComputedStyle(node).backgroundColor : '';
    });
    expect(pageColor).toBe('rgb(247, 248, 250)');
    expect(cardColor).toBe('rgb(23, 23, 28)');
    await page.getByRole('button', { name: 'Appearance: Light' }).click();
    await page.getByRole('radio', { name: /Dark/ }).click();
    await expect(page.getByRole('button', { name: 'Appearance: Dark' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /System/ })).toHaveCount(0);
    const darkColor = await page.getByText('Settings', { exact: true }).evaluate((element) => {
      let node: Element | null = element;
      while (node && getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)') node = node.parentElement;
      return node ? getComputedStyle(node).backgroundColor : '';
    });
    expect(darkColor).toBe('rgb(11, 11, 15)');

    const language = page.getByRole('button', { name: /^Language:/ });
    await expect(page.getByRole('radio', { name: 'Bahasa Melayu' })).toHaveCount(0);
    await language.click();
    await expect(page.getByRole('radio', { name: 'English' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Bahasa Melayu' })).toBeVisible();
    await language.click();
    await expect(page.getByRole('radio', { name: 'Bahasa Melayu' })).toHaveCount(0);
    await language.click();
    await page.getByRole('radio', { name: 'Bahasa Melayu' }).click();
    await expect(page.getByText('Tetapan', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bahasa: Bahasa Melayu' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Bahasa: Bahasa Melayu' }).click();
    await page.getByRole('radio', { name: 'English' }).click();
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Privacy Policy' }).click();
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByText('Last updated: October 2026')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Purpose' })).toBeVisible();
    const privacyEnd = page.getByRole('heading', { name: 'Prototype limitation' });
    await privacyEnd.scrollIntoViewIfNeeded();
    await expect(privacyEnd).toBeInViewport();
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.getByRole('button', { name: 'Terms of Use' }).click();
    await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Responsible use' })).toBeVisible();
    const termsEnd = page.getByRole('heading', { name: 'Contact and academic project' });
    await termsEnd.scrollIntoViewIfNeeded();
    await expect(termsEnd).toBeInViewport();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
  } finally {
    await restorePreferences();
  }
});

test('manual expense validation and complete CRUD without touching other rows', async ({ page }) => {
  const food = `${runPrefix} Food`;
  const foodUpdated = `${runPrefix} Food updated`;
  const transport = `${runPrefix} Transport`;
  try {
    await signIn(page);
    await page.getByRole('tab', { name: 'Wallet' }).click();
    await expect(page.getByText('YOUR WALLET', { exact: true })).toBeVisible();
    const baseline = await spentTotal(page);
    const periodBaseline = await periodSpent(page);

    await page.getByRole('button', { name: 'Add expense' }).click();
    const title = page.getByRole('textbox', { name: 'Title' });
    const amount = page.getByRole('textbox', { name: 'Amount (RM)' });
    await amount.fill('12.50');
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByText('Enter an expense title.')).toBeVisible();
    await title.fill(food);
    await amount.fill('0');
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByText('Enter an amount above RM0 with up to two decimal places.')).toBeVisible();
    await amount.fill('-1');
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByText('Enter an amount above RM0 with up to two decimal places.')).toBeVisible();
    await amount.fill('abc');
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByText('Enter an amount above RM0 with up to two decimal places.')).toBeVisible();
    await amount.fill('12.50');
    await page.getByRole('button', { name: /^Category:/ }).click();
    await page.getByRole('radio', { name: 'Food' }).click();
    await page.getByRole('textbox', { name: 'Notes (optional)' }).fill('Automated test');
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByText('Expense saved.')).toBeVisible();
    await expect(page.getByText(food, { exact: true }).filter({ visible: true })).toBeVisible();
    await expectSpent(page, baseline + 12.5);
    await expectPeriodSpent(page, periodBaseline + 12.5);

    await page.getByRole('button', { name: 'Add expense' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(transport);
    await page.getByRole('textbox', { name: 'Amount (RM)' }).fill('5.00');
    await page.getByRole('button', { name: /^Category:/ }).click();
    await page.getByRole('radio', { name: 'Transport' }).click();
    await page.getByRole('button', { name: 'Save expense' }).click();
    await expect(page.getByText(food, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(transport, { exact: true }).filter({ visible: true })).toBeVisible();
    await expectSpent(page, baseline + 17.5);
    await expectPeriodSpent(page, periodBaseline + 17.5);

    await openExpense(page, food);
    await expect(page.getByText('Food', { exact: true }).filter({ visible: true }).last()).toBeVisible();
    await expect(page.getByText('RM 12.50', { exact: true }).filter({ visible: true }).last()).toBeVisible();
    await expect(page.getByText('Automated test').filter({ visible: true }).last()).toBeVisible();
    const today = await page.evaluate(() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    });
    const dateLabel = new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${today}T00:00:00Z`));
    await expect(page.getByText(dateLabel, { exact: true }).filter({ visible: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Edit expense' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(foodUpdated);
    await page.getByRole('textbox', { name: 'Amount (RM)' }).fill('15.00');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Expense updated.')).toBeVisible();
    await expect(page.getByText(foodUpdated, { exact: true }).filter({ visible: true })).toBeVisible();
    await expectSpent(page, baseline + 20);
    await expectPeriodSpent(page, periodBaseline + 20);

    await openExpense(page, transport);
    await page.getByRole('button', { name: 'Delete expense' }).click();
    await expect(page.getByText('Delete this expense?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(transport, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByText(transport, { exact: true }).filter({ visible: true })).toBeVisible();
    await openExpense(page, transport);
    await confirmDelete(page);
    await expect(page.getByText(transport, { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expectSpent(page, baseline + 15);
    await expectPeriodSpent(page, periodBaseline + 15);

    await openExpense(page, foodUpdated);
    await confirmDelete(page);
    await expect(page.getByText(foodUpdated, { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expectSpent(page, baseline);
    await expectPeriodSpent(page, periodBaseline);
  } finally {
    await cleanupExpenses();
  }
});

test('current monthly and weekly budgets use only their period expenses', async ({ page }) => {
  await signIn(page);
  await page.getByRole('tab', { name: 'Wallet' }).click();
  const dates = await page.evaluate(() => {
    const today = new Date();
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7), 12);
    return {
      today: iso(today),
      monthStart: iso(new Date(today.getFullYear(), today.getMonth(), 1, 12)),
      monthEnd: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0, 12)),
      weekStart: iso(monday),
      weekEnd: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 12)),
      previousMonthEnd: iso(new Date(today.getFullYear(), today.getMonth(), 0, 12)),
    };
  });
  const { client, userId } = await testClient();
  type SavedBudget = { id: string; amount: number | string } | null;
  const original: Record<'monthly' | 'weekly', SavedBudget> = { monthly: null, weekly: null };
  const starts = { monthly: dates.monthStart, weekly: dates.weekStart };
  let budgetsCaptured = false;
  try {
    for (const type of ['monthly', 'weekly'] as const) {
      const result = await client.from('budgets').select('id,amount')
        .eq('user_id', userId).eq('period_type', type).eq('period_start', starts[type]).maybeSingle();
      if (result.error) throw new Error('Could not capture the original current budget.');
      original[type] = result.data;
    }
    budgetsCaptured = true;
    const currentMonth = await client.from('expenses').select('amount').eq('user_id', userId).gte('expense_date', dates.monthStart).lte('expense_date', dates.monthEnd);
    const currentWeek = await client.from('expenses').select('amount').eq('user_id', userId).gte('expense_date', dates.weekStart).lte('expense_date', dates.weekEnd);
    if (currentMonth.error || currentWeek.error) throw new Error('Could not inspect existing period expenses.');
    test.skip(Boolean(currentMonth.data?.length || currentWeek.data?.length), 'Exact RM50 scenario needs a clean current-period test account.');

    await expect(page.getByText('No budget set for this period.')).toBeVisible();
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 0.00');
    const olderTitle = `${runPrefix} Older`;
    const older = await client.from('expenses').insert({ user_id: userId, title: olderTitle, amount: 7, category: 'personal', expense_date: dates.previousMonthEnd, notes: null });
    if (older.error) throw new Error('Could not create the older E2E expense.');
    await page.reload();
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 0.00');
    await expect(page.getByText('No expenses in this period yet. Older expenses are not included.')).toBeVisible();
    await expect(visibleTestId(page, 'budget-category-personal')).toHaveCount(0);

    await page.getByRole('button', { name: 'Set budget' }).click();
    await expect(page.getByRole('button', { name: 'Budget period: Monthly' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Budget amount (RM)' }).fill('500.00');
    await page.getByRole('button', { name: 'Save budget' }).click();
    await expect(visibleTestId(page, 'budget-amount')).toHaveText('RM 500.00');
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 0.00');
    await expect(visibleTestId(page, 'budget-remaining')).toContainText('RM 500.00');
    await expect(page.getByText('Your full budget is available. Add an expense to start tracking spending.')).toBeVisible();
    await page.getByRole('button', { name: 'Manage budget' }).click();
    await expect(page.getByRole('textbox', { name: 'Budget amount (RM)' })).toHaveValue('500.00');
    await page.getByRole('button', { name: 'Go back' }).click();

    await addExpense(page, `${runPrefix} Budget Food`, '30.00', 'Food');
    await addExpense(page, `${runPrefix} Budget Transport`, '20.00', 'Transport');
    await expect(visibleTestId(page, 'budget-amount')).toHaveText('RM 500.00');
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 50.00');
    await expect(visibleTestId(page, 'budget-remaining')).toContainText('RM 450.00');
    await expect(visibleTestId(page, 'budget-used')).toHaveText('10%');
    await expect(visibleTestId(page, 'budget-category-food')).toContainText('RM 30.00');
    await expect(visibleTestId(page, 'budget-category-food')).toContainText('60%');
    await expect(visibleTestId(page, 'budget-category-transport')).toContainText('RM 20.00');
    await expect(visibleTestId(page, 'budget-category-transport')).toContainText('40%');
    const dayNumber = (iso: string) => {
      const [year, month, day] = iso.split('-').map(Number);
      return Date.UTC(year, month - 1, day) / 86_400_000;
    };
    const ringgit = (value: number) => `RM ${new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
    await expect(visibleTestId(page, 'budget-daily-average')).toHaveText(ringgit(50 / (dayNumber(dates.today) - dayNumber(dates.monthStart) + 1)));

    if (dates.monthStart < dates.weekStart) {
      const outsideWeek = await client.from('expenses').insert({ user_id: userId, title: `${runPrefix} Earlier this month`, amount: 9, category: 'other', expense_date: dates.monthStart, notes: null });
      if (outsideWeek.error) throw new Error('Could not create the outside-week E2E expense.');
      await page.reload();
      await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 59.00');
      await expect(visibleTestId(page, 'budget-category-other')).toContainText('RM 9.00');
    }

    await page.getByRole('button', { name: 'Weekly', exact: true }).click();
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 50.00');
    await expect(page.getByText('No budget set for this period.')).toBeVisible();
    await expect(visibleTestId(page, 'budget-category-other')).toHaveCount(0);
    await expect(visibleTestId(page, 'budget-category-personal')).toHaveCount(0);
    await expect(visibleTestId(page, 'budget-daily-average')).toHaveText(ringgit(50 / (dayNumber(dates.today) - dayNumber(dates.weekStart) + 1)));
    await page.getByRole('button', { name: 'Set budget' }).click();
    await expect(page.getByRole('button', { name: 'Budget period: Weekly' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Budget amount (RM)' }).fill('75.00');
    await page.getByRole('button', { name: 'Save budget' }).click();
    await expect(visibleTestId(page, 'budget-amount')).toHaveText('RM 75.00');
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 50.00');
    await expect(visibleTestId(page, 'budget-remaining')).toContainText('RM 25.00');
    await addExpense(page, `${runPrefix} Budget Personal`, '30.00', 'Personal');
    await expect(visibleTestId(page, 'budget-spent')).toHaveText('RM 80.00');
    await expect(visibleTestId(page, 'budget-overspent')).toContainText('Over budget');
    await expect(visibleTestId(page, 'budget-overspent')).toContainText('RM 5.00');
    await expect(visibleTestId(page, 'budget-overspent')).toHaveCSS('background-color', 'rgb(180, 35, 24)');
    await expect(visibleTestId(page, 'budget-summary').getByText('Remaining', { exact: true })).toHaveCount(0);
    await expect(visibleTestId(page, 'budget-used')).toHaveText('106.7%');

    await page.getByRole('button', { name: 'Monthly', exact: true }).click();
    await expect(visibleTestId(page, 'budget-amount')).toHaveText('RM 500.00');
    await expect(visibleTestId(page, 'budget-spent')).toHaveText(dates.monthStart < dates.weekStart ? 'RM 89.00' : 'RM 80.00');
    await expect(visibleTestId(page, 'budget-category-personal')).toContainText('RM 30.00');
  } finally {
    try {
      await cleanupExpenses();
    } finally {
      try {
        for (const type of budgetsCaptured ? ['monthly', 'weekly'] as const : []) {
          const current = await client.from('budgets').select('id,amount')
            .eq('user_id', userId).eq('period_type', type).eq('period_start', starts[type]).maybeSingle();
          if (current.error) throw new Error('Could not read a budget during E2E restoration.');
          const previous = original[type];
          if (previous) {
            if (!current.data || current.data.id !== previous.id) throw new Error('The original E2E budget record changed unexpectedly.');
            if (Number(current.data.amount) !== Number(previous.amount)) {
              const restored = await client.from('budgets').update({ amount: Number(previous.amount) })
                .eq('id', previous.id).eq('user_id', userId).select('id').maybeSingle();
              if (restored.error || !restored.data) throw new Error('Could not restore an original E2E budget amount.');
            }
          } else if (current.data) {
            const deleted = await client.from('budgets').delete().eq('id', current.data.id).eq('user_id', userId).select('id').maybeSingle();
            if (deleted.error || !deleted.data) throw new Error('Could not remove a new E2E budget.');
          }
        }
      } finally {
        await client.auth.signOut();
      }
    }
  }
});
