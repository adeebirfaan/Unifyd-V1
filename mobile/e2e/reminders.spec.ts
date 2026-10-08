import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const prefix = `E2E Reminders ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
const HOUR = 3_600_000;
const SELECT = 'id,title,subject,deadline,status,completed_at,reminder_offset_minutes';
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

async function openReminders(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await page.getByRole('button', { name: 'Reminders' }).click();
  await expect(page.getByText('Reminder times worked out from your tasks.', { exact: false })).toBeVisible();
}

test('reminder history lists upcoming and recent reminders and opens their tasks', async ({ page }) => {
  const id = (n: number) => `00000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`;
  const rows = [
    { id: id(1), title: 'Lab report', subject: 'BCS2233', deadline: at(30), status: 'pending', completed_at: null, reminder_offset_minutes: 1440 }, // in 6 h
    { id: id(2), title: 'Quiz prep', subject: 'BCN2113', deadline: at(3), status: 'ongoing', completed_at: null, reminder_offset_minutes: 60 },   // in 2 h
    { id: id(3), title: 'Essay draft', subject: 'UHL2312', deadline: at(-1), status: 'pending', completed_at: null, reminder_offset_minutes: 0 },  // 1 h ago
    { id: id(4), title: 'Finished early', subject: 'X', deadline: at(-5), status: 'completed', completed_at: at(-30), reminder_offset_minutes: 60 }, // cancelled
    { id: id(5), title: 'Old reminder', subject: 'X', deadline: at(-24 * 40), status: 'pending', completed_at: null, reminder_offset_minutes: 0 },   // > 30 days
  ];
  const queries: URL[] = [];
  await page.route('**/rest/v1/tasks?*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.searchParams.get('select') !== SELECT) return route.continue();
    queries.push(url);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await openReminders(page);

  const upcoming = page.getByTestId('reminders-upcoming');
  const past = page.getByTestId('reminders-past');
  const upcomingItems = upcoming.getByRole('button');
  await expect(upcomingItems).toHaveCount(2);
  await expect(upcomingItems.nth(0)).toContainText('Quiz prep');
  await expect(upcomingItems.nth(0)).toContainText('1 hour before');
  await expect(upcomingItems.nth(1)).toContainText('Lab report');
  await expect(upcomingItems.nth(1)).toContainText('1 day before');
  await expect(past.getByRole('button')).toHaveCount(1);
  await expect(past.getByRole('button')).toContainText('Essay draft');
  await expect(past.getByRole('button')).toContainText('At deadline');
  await expect(page.getByText('Finished early')).toHaveCount(0);
  await expect(page.getByText('Old reminder')).toHaveCount(0);

  const { userId } = await (async () => { const c = await testClient(); await c.client.auth.signOut(); return c; })();
  expect(queries.length).toBeGreaterThan(0);
  for (const url of queries) {
    expect(url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    expect(url.searchParams.get('reminder_offset_minutes')).toBe('not.is.null');
  }

  await upcomingItems.nth(0).click();
  await expect(page).toHaveURL(new RegExp(`task-detail\\?id=${id(2)}`));
});

test('empty sections explain themselves, and a real task reminder appears', async ({ page }) => {
  // First an empty history (intercepted), then the student's real data.
  let empty = true;
  await page.route('**/rest/v1/tasks?*', async (route) => {
    const url = new URL(route.request().url());
    if (!empty || route.request().method() !== 'GET' || url.searchParams.get('select') !== SELECT) return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await openReminders(page);
  await expect(page.getByText('No upcoming reminders. Choose a reminder when you add or edit a task.')).toBeVisible();
  await expect(page.getByText('No reminder times in the last 30 days.')).toBeVisible();

  const { client, userId } = await testClient();
  try {
    const created = await client.from('tasks').insert({
      user_id: userId, title: `${prefix} live`, subject: 'BCS2233', deadline: at(72), reminder_offset_minutes: 1440,
    }).select('id').single();
    expect(created.error).toBeNull();
    empty = false;
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.getByRole('button', { name: 'Reminders' }).click();
    const item = page.getByTestId('reminders-upcoming').getByRole('button', { name: new RegExp(`Open task ${prefix} live`) });
    await expect(item).toBeVisible();
    await expect(item).toContainText('1 day before');
    await item.click();
    await expect(page).toHaveURL(new RegExp(`task-detail\\?id=${created.data!.id}`));
    await expect(page.getByText(`${prefix} live`).last()).toBeVisible();
  } finally {
    const removed = await client.from('tasks').delete().eq('user_id', userId).like('title', `${prefix}%`).select('id');
    expect(removed.error).toBeNull();
    await client.auth.signOut();
  }
});
