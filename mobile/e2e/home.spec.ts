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

test('dashboard shows verified facts, a labelled AI summary, and opens each module', async ({ page }) => {
  await mockDashboardData(page, fixtures);
  const insightRequests: { auth: string | undefined; body: unknown }[] = [];
  await page.route('**/api/insights/generate', async (route) => {
    insightRequests.push({ auth: route.request().headers().authorization, body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ facts: {}, summary: aiSummary, source: 'ai', fallbackReason: null }) });
  });
  await signIn(page);

  // Hero: budget status, nearest deadline, and this week's mood.
  await expect(page.getByText('RM 150.00', { exact: true })).toBeVisible();
  await expect(page.getByText('RM 350.00 left of RM 500.00')).toBeVisible();
  await expect(page.getByText('E2E Lab report')).toBeVisible();
  await expect(page.getByText('1.7 / 5').first()).toBeVisible();

  const money = page.getByRole('button', { name: 'Open Wallet' });
  await expect(money).toContainText('Expenses this month2');
  await expect(money).toContainText('Budget used30%');
  await expect(money).toContainText('Food 80% · Transport 20%');
  const studies = page.getByRole('button', { name: 'Open Planner' });
  await expect(studies).toContainText('Pending2');
  await expect(studies).toContainText('Ongoing1');
  await expect(studies).toContainText('Overdue1');
  await expect(studies).toContainText('Due in 7 days1');
  await expect(studies).toContainText('Completed in 7 days1');
  const wellbeing = page.getByRole('button', { name: 'Open Mind' });
  await expect(wellbeing).toContainText('Check-ins (7 days)3');
  await expect(wellbeing).toContainText('Average stress4.0 / 5');
  await expect(wellbeing).toContainText('You noted a low mood on several days this week.');
  await expect(wellbeing).toContainText('not medical or professional advice');

  await expect(page.getByText('AI summary', { exact: true })).toBeVisible();
  await expect(page.getByText(aiSummary.finance)).toBeVisible();
  await expect(page.getByText(aiSummary.academic)).toBeVisible();
  await expect(page.getByText(aiSummary.wellness)).toBeVisible();
  await expect(page.getByText('Written by AI from your recorded numbers.', { exact: false })).toBeVisible();
  expect(insightRequests).toHaveLength(1);
  expect(insightRequests[0].auth).toMatch(/^Bearer .+/);
  expect(insightRequests[0].body).toEqual({ language: 'en', timeZone: zone });

  await money.click();
  await expect(page).toHaveURL(/\/wallet/);
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Open Planner' }).click();
  await expect(page).toHaveURL(/\/planner/);
  await page.getByRole('tab', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Open Mind' }).click();
  await expect(page).toHaveURL(/\/mind/);
  // Returning within five minutes reloads facts but does not request another summary.
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByText(aiSummary.finance)).toBeVisible();
  expect(insightRequests).toHaveLength(1);
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
  await expect(page.getByText('RM 0.00', { exact: true })).toBeVisible();
  await expect(page.getByText('No monthly budget set')).toBeVisible();
  await expect(page.getByText('No upcoming deadlines')).toBeVisible();
  await expect(page.getByText('No check-ins yet')).toBeVisible();
  await expect(page.getByText('No expenses recorded this month yet.')).toBeVisible();
  await expect(page.getByText('No active tasks right now.')).toBeVisible();
  await expect(page.getByText('No check-ins in the last 7 days.')).toBeVisible();
  await expect(page.getByText(/low mood/)).toHaveCount(0);

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
  await expect(page.getByRole('button', { name: 'Open Wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Mind' })).toBeVisible();
  await expect(page.getByText('We could not load your overview.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Spent this month', { exact: true })).toBeVisible();
});
