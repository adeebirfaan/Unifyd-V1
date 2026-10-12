import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const zone = 'Asia/Kuala_Lumpur';
const HOUR = 3_600_000;

const localDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const today = localDate(new Date());
// Monday of the current week in Kuala Lumpur, matching the Wallet's weekly budget period.
const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
const monday = localDate(new Date(Date.parse(`${today}T12:00:00Z`) - weekday * 24 * HOUR));

// Fixture rows for Poof's read-only queries, keyed by table and the exact columns Poof selects.
const fixtures: Record<string, Record<string, unknown[]>> = {
  budgets: { 'amount,period_type,period_start': [{ amount: '500.00', period_type: 'weekly', period_start: monday }] },
  expenses: { 'amount,category,expense_date': [
    { amount: '120.00', category: 'food', expense_date: today },
    { amount: '30.00', category: 'transport', expense_date: today },
  ] },
  tasks: { 'title,subject,deadline,priority,status': [
    { title: 'E2E overdue essay', subject: 'BHE1013', deadline: at(-3), priority: 'medium', status: 'pending' },
    { title: 'E2E Lab report', subject: 'BCS2233', deadline: at(30), priority: 'high', status: 'ongoing' },
  ] },
  mood_entries: { 'mood_level,stress_level,recorded_at': [{ mood_level: 4, stress_level: 2, recorded_at: at(-2) }] },
};

async function mockPoofData(page: Page) {
  for (const [table, selections] of Object.entries(fixtures)) {
    await page.route(`**/rest/v1/${table}?*`, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const rows = selections[new URL(route.request().url()).searchParams.get('select') ?? ''];
      if (!rows) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
  }
}

async function signIn(page: Page) {
  await page.route('**/api/insights/generate', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('YOUR OVERVIEW')).toBeVisible();
}

const sheet = (page: Page) => page.getByTestId('poof-assistant');

test('Poof greets, summarises real data, answers with AI or rules, and links into the app', async ({ page }) => {
  await mockPoofData(page);
  const chatRequests: { auth: string | undefined; body: { message: string; facts: unknown; language: string } }[] = [];
  let aiMode: 'ai' | 'down' = 'ai';
  await page.route('**/api/poof/chat', async (route) => {
    chatRequests.push({ auth: route.request().headers().authorization, body: route.request().postDataJSON() });
    if (aiMode === 'down') return route.abort();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      source: 'ai', reply: 'You have 1 overdue task. Clearing it first will take the pressure off.', actions: ['openPlanner'], scope: 'in',
    }) });
  });
  await signIn(page);

  await page.getByRole('button', { name: 'Chat with Poof' }).click();
  const poof = sheet(page);
  await expect(poof).toBeVisible();
  await expect(poof.getByText('Hey, I’m Poof!', { exact: false })).toBeVisible();

  // The summary uses the student's own figures and offers matching actions.
  const summary = poof.getByTestId('poof-summary');
  await expect(summary).toContainText('You’ve spent RM 120.00 on food this week, which is 24% of your weekly budget.');
  await expect(summary).toContainText('You have 1 overdue task.');
  await expect(summary).toContainText('You have 1 task due in the next 3 days.');
  await expect(summary).toContainText('You haven’t added your semester subjects yet.');

  // An AI answer: only aggregates are sent, never task titles; verified details come from the device.
  await poof.getByRole('button', { name: 'Do I have any overdue tasks?' }).click();
  await expect(poof.getByText('You have 1 overdue task. Clearing it first will take the pressure off.')).toBeVisible();
  await expect(poof.getByText('AI answer based on your data').last()).toBeVisible();
  await expect(poof.getByTestId('poof-message-poof').last()).toContainText('E2E overdue essay');
  expect(chatRequests).toHaveLength(1);
  expect(chatRequests[0].auth).toMatch(/^Bearer .+/);
  expect(chatRequests[0].body.message).toBe('Do I have any overdue tasks?');
  expect(JSON.stringify(chatRequests[0].body.facts)).not.toContain('E2E');

  // When the AI service is unreachable, Poof answers from the same data with its rules.
  aiMode = 'down';
  await poof.getByTestId('poof-input').fill('Where did I spend the most this month?');
  await poof.getByRole('button', { name: 'Send message' }).click();
  await expect(poof.getByText('This month your biggest spend is food at RM 120.00, 80% of the RM 150.00 you’ve spent.')).toBeVisible();
  await expect(poof.getByText('Quick answer from your data').last()).toBeVisible();

  // Crisis language is answered on the device with support contacts and never sent to the AI.
  const before = chatRequests.length;
  await poof.getByTestId('poof-input').fill('I want to end my life');
  await poof.getByTestId('poof-input').press('Enter');
  await expect(poof.getByTestId('poof-crisis')).toContainText('Befrienders KL (24 hours): 03-7627 2929');
  expect(chatRequests).toHaveLength(before);

  // An action closes Poof and opens the matching screen; nothing is changed.
  await poof.getByTestId('poof-message-poof').nth(1).getByRole('button', { name: 'Open Planner' }).click();
  await expect(page).toHaveURL(/\/planner/);
  await expect(sheet(page)).toHaveCount(0);
});

test('Poof shows a retryable error when data cannot load, and closes cleanly', async ({ page }) => {
  let failing = true;
  await page.route('**/rest/v1/tasks?*', async (route) => {
    if (failing && route.request().url().includes('select=title%2Csubject%2Cdeadline%2Cpriority%2Cstatus')) return route.abort();
    return route.continue();
  });
  await signIn(page);
  await page.getByRole('button', { name: 'Chat with Poof' }).click();
  const poof = sheet(page);
  await expect(poof.getByText('I couldn’t load your data just now.', { exact: false })).toBeVisible();
  // Questions wait for data rather than guessing.
  await expect(poof.getByTestId('poof-input')).toHaveAttribute('placeholder', 'Poof can answer once your data has loaded.');
  failing = false;
  await poof.getByRole('button', { name: 'Try again' }).click();
  await expect(poof.getByTestId('poof-input')).toHaveAttribute('placeholder', 'Ask Poof about your data…');
  await page.getByTestId('poof-close').click();
  await expect(sheet(page)).toHaveCount(0);

  // Reopening keeps this session's conversation, and the introduction is not repeated.
  await page.getByRole('button', { name: 'Chat with Poof' }).click();
  await expect(sheet(page).getByText('Hey, I’m Poof!', { exact: false })).toBeVisible();
  await expect(sheet(page).getByText('Hi again!', { exact: false })).toHaveCount(0);
});
