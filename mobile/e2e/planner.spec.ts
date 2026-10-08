import { expect, test } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const prefix = `E2E Planner ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;

async function cleanup() {
  const { client, userId } = await testClient();
  try {
    const { data, error } = await client.from('tasks').select('id,title').eq('user_id', userId).like('title', `${prefix}%`);
    if (error) throw new Error('Could not list Planner test tasks for cleanup.');
    for (const row of data ?? []) {
      if (!row.title.startsWith(prefix)) continue;
      const deleted = await client.from('tasks').delete().eq('id', row.id).eq('user_id', userId).select('id').maybeSingle();
      if (deleted.error || !deleted.data) throw new Error('Could not clean up Planner test task.');
    }
  } finally { await client.auth.signOut(); }
}

test('student can create, edit, complete, reopen, and delete an owned task', async ({ page }) => {
  try {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('tab', { name: 'Planner' })).toBeVisible();
    await page.getByRole('tab', { name: 'Planner' }).click();
    await expect(page.getByText('Academic tasks')).toBeVisible();
    await page.getByRole('button', { name: 'Add task' }).click();
    await page.getByRole('button', { name: 'Save task' }).click();
    await expect(page.getByText('Enter a task title.')).toBeVisible();
    await expect(page.getByText('Enter a subject.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Title' }).fill(`${prefix} original`);
    await page.getByRole('textbox', { name: 'Subject' }).fill('E2E subject');
    await page.getByRole('textbox', { name: 'Description (optional)' }).fill('E2E description');
    await page.getByRole('button', { name: 'Save task' }).click();
    await expect(page.getByText(`${prefix} original`)).toBeVisible();
    await page.getByRole('button', { name: `Open task ${prefix} original` }).click();
    await expect(page.getByText('E2E description')).toBeVisible();
    await page.getByRole('button', { name: 'Edit task' }).click();
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(`${prefix} original`);
    await page.getByRole('textbox', { name: 'Title' }).fill(`${prefix} edited`);
    await page.getByRole('textbox', { name: 'Subject' }).fill('Updated E2E subject');
    await page.getByRole('button', { name: 'Priority: Medium' }).click();
    await page.getByRole('radio', { name: 'High' }).click();
    await page.getByRole('button', { name: 'Status: Pending' }).click();
    await page.getByRole('radio', { name: 'Ongoing' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`${prefix} edited`)).toBeVisible();
    await page.getByRole('button', { name: `Complete task ${prefix} edited` }).click();
    await expect(page.getByRole('button', { name: `Reopen task ${prefix} edited` })).toBeVisible();
    await page.getByRole('button', { name: `Reopen task ${prefix} edited` }).click();
    await expect(page.getByRole('button', { name: `Complete task ${prefix} edited` })).toBeVisible();
    await page.getByRole('button', { name: `Open task ${prefix} edited` }).click();
    await page.getByRole('button', { name: 'Delete task' }).click();
    await expect(page.getByText(`Delete “${prefix} edited”? This cannot be undone.`)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    // The Planner row stays mounted beneath the detail screen; the detail title is the last exact match.
    await expect(page.getByText(`${prefix} edited`, { exact: true }).last()).toBeVisible();
    await expect(page.getByText(`Delete “${prefix} edited”? This cannot be undone.`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Delete task' }).click();
    await page.getByRole('button', { name: 'Delete task' }).last().click();
    // An earlier Planner instance can stay hidden in the web stack; only visible rows matter.
    await expect(page.getByText(`${prefix} edited`).locator('visible=true')).toHaveCount(0);
  } finally { await cleanup(); }
});
