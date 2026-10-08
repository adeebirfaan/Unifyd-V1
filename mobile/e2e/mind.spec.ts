import { expect, test } from '@playwright/test';
import type { Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const prefix = `E2E Mind ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
const createdIds = new Set<string>();

async function cleanup() {
  const { client, userId } = await testClient();
  try {
    const { data: noted, error } = await client.from('mood_entries')
      .select('id,note').eq('user_id', userId).like('note', `${prefix}%`);
    if (error) throw new Error('Could not find Mind test rows for cleanup.');
    for (const row of noted ?? []) if (row.note?.startsWith(prefix)) createdIds.add(row.id);
    for (const id of createdIds) {
      const removed = await client.from('mood_entries').delete().eq('id', id).eq('user_id', userId);
      if (removed.error) throw new Error('Could not clean up a Mind test row.');
    }
    if (createdIds.size) {
      const remaining = await client.from('mood_entries').select('id').eq('user_id', userId).in('id', [...createdIds]);
      if (remaining.error || (remaining.data?.length ?? 0) !== 0) throw new Error('Mind test cleanup left rows behind.');
    }
  } finally { await client.auth.signOut(); }
}

test('private mood check-ins validate, save, order, and delete safely', async ({ page }) => {
  page.on('response', async (response) => {
    if (!response.url().includes('/rest/v1/mood_entries') || response.request().method() !== 'POST' || !response.ok()) return;
    const payload = await response.json().catch(() => null);
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (typeof row?.id === 'string') createdIds.add(row.id);
  });
  let deleteRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/mood_entries') && request.method() === 'DELETE') deleteRequests++;
  });

  try {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('tab', { name: 'Mind' })).toBeVisible();
    await page.getByRole('tab', { name: 'Mind' }).click();
    await expect(page.getByText('How are you feeling?')).toBeVisible();

    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByText('Choose a mood level.')).toBeVisible();
    await expect(page.getByText('Choose a stress level.')).toBeVisible();
    await page.getByRole('radio', { name: 'Mood: Good' }).click();
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByText('Choose a stress level.')).toBeVisible();
    await page.getByRole('radio', { name: 'Stress: Moderate' }).click();
    await page.getByRole('textbox', { name: 'Private note (optional)' }).fill(`  ${prefix} first  `);

    const failSave = async (route: Route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      else await route.continue();
    };
    await page.route('**/rest/v1/mood_entries*', failSave);
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByText('We could not save your check-in. Please try again.')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Mood: Good' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('textbox', { name: 'Private note (optional)' })).toHaveValue(`  ${prefix} first  `);
    await page.unroute('**/rest/v1/mood_entries*', failSave);

    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect(page.getByText('Check-in saved.')).toBeVisible();
    await expect(page.getByText(`${prefix} first`)).toBeVisible();
    await expect.poll(() => createdIds.size).toBe(1);
    const firstId = [...createdIds][0];
    const { client, userId } = await testClient();
    try {
      const first = await client.from('mood_entries').select('user_id,mood_level,stress_level,note')
        .eq('id', firstId).eq('user_id', userId).single();
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ user_id: userId, mood_level: 4, stress_level: 3, note: `${prefix} first` });
    } finally { await client.auth.signOut(); }

    await page.getByRole('radio', { name: 'Mood: Very good' }).click();
    await page.getByRole('radio', { name: 'Stress: Low' }).click();
    await page.getByRole('button', { name: 'Save check-in' }).click();
    await expect.poll(() => createdIds.size).toBe(2);
    const secondId = [...createdIds][1];
    const secondRow = page.locator(`[data-testid="mind-entry-${secondId}"]`);
    await expect(secondRow).toBeVisible();
    await expect(page.locator('[data-testid^="mind-entry-"]').first()).toHaveAttribute('data-testid', `mind-entry-${secondId}`);
    await expect(secondRow.getByText('Mood: Very good')).toBeVisible();
    const secondClient = await testClient();
    try {
      const second = await secondClient.client.from('mood_entries').select('mood_level,stress_level,note')
        .eq('id', secondId).eq('user_id', secondClient.userId).single();
      expect(second.error).toBeNull();
      expect(second.data).toMatchObject({ mood_level: 5, stress_level: 2, note: null });
    } finally { await secondClient.client.auth.signOut(); }

    await secondRow.getByRole('button', { name: 'Delete check-in' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(deleteRequests).toBe(0);
    await expect(secondRow).toBeVisible();

    const failDelete = async (route: Route) => {
      if (route.request().method() === 'DELETE') await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      else await route.continue();
    };
    await page.route('**/rest/v1/mood_entries*', failDelete);
    await secondRow.getByRole('button', { name: 'Delete check-in' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('We could not delete this check-in. Please try again.')).toBeVisible();
    await expect(secondRow).toBeVisible();
    await page.unroute('**/rest/v1/mood_entries*', failDelete);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(secondRow).toHaveCount(0);
    await expect(page.getByText('Check-in deleted.')).toBeVisible();
  } finally { await cleanup(); }
});

test('recent trends show only dated owned check-ins and keep notes out of summaries', async ({ page }) => {
  const account = await testClient();
  const userId = account.userId;
  await account.client.auth.signOut();
  const stamps = await page.evaluate(() => {
    const today = new Date();
    const at = (daysAgo: number, minute: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, 0, minute).toISOString();
    return { currentOlder: at(0, 5), currentLatest: at(0, 10), currentPast: at(2, 5), priorOne: at(8, 5), priorTwo: at(9, 5), thirtyPriorOne: at(35, 5), thirtyPriorTwo: at(36, 5) };
  });
  const privateNote = `${prefix} private trend note`;
  const rows = [
    { id: '00000000-0000-4000-8000-000000000101', mood_level: 4, stress_level: 3, recorded_at: stamps.currentOlder, note: null },
    { id: '00000000-0000-4000-8000-000000000102', mood_level: 2, stress_level: 5, recorded_at: stamps.currentLatest, note: privateNote },
    { id: '00000000-0000-4000-8000-000000000103', mood_level: 5, stress_level: 1, recorded_at: stamps.currentPast, note: null },
    { id: '00000000-0000-4000-8000-000000000104', mood_level: 2, stress_level: 4, recorded_at: stamps.priorOne, note: null },
    { id: '00000000-0000-4000-8000-000000000105', mood_level: 3, stress_level: 3, recorded_at: stamps.priorTwo, note: null },
    { id: '00000000-0000-4000-8000-000000000106', mood_level: 1, stress_level: 4, recorded_at: stamps.thirtyPriorOne, note: null },
    { id: '00000000-0000-4000-8000-000000000107', mood_level: 2, stress_level: 4, recorded_at: stamps.thirtyPriorTwo, note: null },
  ];
  let stage: 'empty' | 'single' | 'populated' = 'empty';
  const trendQueries: URL[] = [];
  await page.route('**/rest/v1/mood_entries*', async (route) => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    const url = new URL(route.request().url());
    const select = url.searchParams.get('select');
    const trendQuery = select === 'mood_level,stress_level,recorded_at';
    if (trendQuery) trendQueries.push(url);
    const available = stage === 'empty' ? [] : stage === 'single' ? [rows[1]] : rows;
    const dateFilters = url.searchParams.getAll('recorded_at');
    const lower = dateFilters.find((value) => value.startsWith('gte.'))?.slice(4);
    const upper = dateFilters.find((value) => value.startsWith('lt.'))?.slice(3);
    const response = trendQuery
      ? available.filter((row) => (!lower || row.recorded_at >= lower) && (!upper || row.recorded_at < upper))
        .map(({ mood_level, stress_level, recorded_at }) => ({ mood_level, stress_level, recorded_at }))
      : available.slice().sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 10);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(response) });
  });

  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Mind' }).click();
  const trendCard = page.getByTestId('mind-trend-card');
  const ideas = page.getByTestId('mind-for-you-card');
  await expect(trendCard.getByText('No check-ins in this period yet. Save a private check-in to see your daily averages.')).toBeVisible();
  await expect(trendCard.getByText('Compared with the previous period')).toHaveCount(0);
  await expect(ideas.getByText('A few general ideas to consider:')).toBeVisible();

  stage = 'single';
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('tab', { name: 'Mind' }).click();
  await expect(trendCard.getByText('1 check-in in this period')).toBeVisible();
  await expect(trendCard.getByText('2.0')).toBeVisible();
  await expect(trendCard.getByText('Compared with the previous period')).toHaveCount(0);

  stage = 'populated';
  await page.getByRole('tab', { name: 'Wallet' }).click();
  await page.getByRole('tab', { name: 'Mind' }).click();
  await expect(trendCard.getByText('3 check-ins in this period')).toBeVisible();
  await expect(trendCard.getByText('3.7')).toBeVisible();
  await expect(trendCard.getByText('3.0')).toBeVisible();
  await expect(trendCard.getByText('Your average mood was higher than in the previous period.')).toBeVisible();
  await expect(trendCard.getByText('Your average stress was lower than in the previous period.')).toBeVisible();
  await expect(trendCard.getByTestId('mind-trend-day-6')).toHaveAttribute('aria-label', /average mood 3\.0 out of 5; average stress 4\.0 out of 5/);
  await expect(trendCard.getByTestId('mind-trend-day-5')).toHaveAttribute('aria-label', /no check-ins/);
  await expect(ideas.getByText('Take a short break from your screen.')).toBeVisible();
  await expect(ideas.getByText('Consider talking with someone you trust.')).toBeVisible();
  await expect(trendCard.getByText(privateNote)).toHaveCount(0);
  await expect(ideas.getByText(privateNote)).toHaveCount(0);
  await expect(page.getByText(privateNote)).toBeVisible();

  await trendCard.getByRole('button', { name: 'Last 30 days' }).click();
  await expect(trendCard.getByText('5 check-ins in this period')).toBeVisible();
  expect(trendQueries.length).toBeGreaterThan(0);
  for (const url of trendQueries) {
    expect(url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    expect(url.searchParams.get('select')).not.toContain('note');
    expect(url.searchParams.getAll('recorded_at')).toEqual(expect.arrayContaining([expect.stringMatching(/^gte\./), expect.stringMatching(/^lt\./)]));
  }
});
