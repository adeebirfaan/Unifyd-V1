import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const supabaseHost = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!).host;

type ProfileFields = { avatar_id: string; programme: string | null };

async function setProfile(fields: Partial<ProfileFields>) {
  const { client, userId } = await testClient();
  try {
    const { data, error } = await client.from('profiles').update(fields).eq('id', userId).select('avatar_id').single();
    if (error || !data) throw new Error('Could not prepare the test profile.');
  } finally { await client.auth.signOut(); }
}

async function readProfile(): Promise<ProfileFields> {
  const { client, userId } = await testClient();
  try {
    const { data } = await client.from('profiles').select('avatar_id,programme').eq('id', userId).single();
    return data as ProfileFields;
  } finally { await client.auth.signOut(); }
}

const storedAvatar = async () => (await readProfile()).avatar_id;

const unifydServerHost = process.env.EXPO_PUBLIC_OCR_API_URL ? new URL(process.env.EXPO_PUBLIC_OCR_API_URL).host : null;

/**
 * Avatars must never touch the network: every image comes from the local bundle
 * (the Expo dev server here), nothing goes to an avatar service, and any other
 * request is only to Supabase or the project's own Unifyd server.
 */
function watchNetwork(page: Page) {
  const problems: string[] = [];
  page.on('request', (request: Request) => {
    const url = new URL(request.url());
    if (['data:', 'blob:'].includes(url.protocol)) return;
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (request.resourceType() === 'image' && !local) problems.push(`remote image ${url.host}`);
    if (/dicebear|avatar|gravatar|ui-avatars|robohash/i.test(url.host)) problems.push(`avatar service ${url.host}`);
    if (!local && url.host !== supabaseHost && url.host !== unifydServerHost) problems.push(`unexpected ${request.resourceType()} ${url.host}`);
  });
  return problems;
}

const avatarImage = (page: Page, name: string) => page.getByRole('img', { name: `${name} avatar` }).locator('visible=true').first();

test('curated local avatars: legacy fallback, choose and save an ID, shown on Home and Profile, failed save keeps the old one', async ({ page }) => {
  const original = await readProfile();
  const outside = watchNetwork(page);
  const patches: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/profiles') && request.method() === 'PATCH') patches.push(request.postDataJSON());
  });

  try {
    // A legacy generated-avatar value falls back to the default curated avatar. A listed programme
    // lets the existing Edit Profile validation pass for the Computing test account.
    await setProfile({ avatar_id: 'avatar-07', programme: 'Bachelor of Computer Science (Software Engineering) with Honours' });
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('YOUR OVERVIEW')).toBeVisible();
    await expect(avatarImage(page, 'Turban girl')).toBeVisible();

    await page.getByRole('button', { name: 'Open profile' }).click();
    await expect(avatarImage(page, 'Turban girl')).toBeVisible();
    await page.getByRole('button', { name: 'Edit profile' }).click();

    // All 12 local avatars render in the chooser, and the default is preselected without an error.
    const picker = page.getByTestId('avatar-picker');
    await expect(picker.getByRole('radio')).toHaveCount(12);
    for (const name of ['Turban girl', 'Afro guy', 'Gorpcore guy', 'Music girl', 'Cap guy', 'Everyday guy', 'Genius guy', 'Cool guy', 'Floral girl', 'Hijab girl', 'IT girl', 'Curly guy']) {
      await expect(picker.getByRole('radio', { name: `Select ${name} avatar` })).toBeVisible();
    }
    await expect(picker.getByRole('radio', { name: 'Select Turban girl avatar' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => picker.locator('img').evaluateAll((images) => images.filter((img) => (img as HTMLImageElement).naturalWidth > 0).length)).toBe(12);

    // Choosing and saving stores only the stable ID.
    await picker.getByRole('radio', { name: 'Select Music girl avatar' }).click();
    await expect(picker.getByRole('radio', { name: 'Select Music girl avatar' })).toHaveAttribute('aria-checked', 'true');
    await expect(picker.getByRole('radio', { name: 'Select Turban girl avatar' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();
    expect((patches.at(-1) as { avatar_id?: unknown }).avatar_id).toBe('music_girl');
    expect(await storedAvatar()).toBe('music_girl');

    // Profile and Home show the same avatar without restarting.
    await expect(avatarImage(page, 'Music girl')).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(avatarImage(page, 'Music girl')).toBeVisible();

    // A failed save keeps the previous avatar everywhere.
    await page.getByRole('button', { name: 'Open profile' }).click();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await page.getByTestId('avatar-picker').getByRole('radio', { name: 'Select Hijab girl avatar' }).click();
    await page.route('**/rest/v1/profiles*', (route) => route.request().method() === 'PATCH'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
      : route.continue());
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('We could not save your profile. Please try again.')).toBeVisible();
    await page.unroute('**/rest/v1/profiles*');
    expect(await storedAvatar()).toBe('music_girl');
    await page.getByRole('button', { name: 'Back to profile' }).click();
    await expect(avatarImage(page, 'Music girl')).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(avatarImage(page, 'Music girl')).toBeVisible();

    // No avatar image or avatar service request left the device.
    expect(outside).toEqual([]);
  } finally {
    await setProfile(original);
  }
});
