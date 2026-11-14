import { expect, test } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;

// Wellbeing Phase 1 (SRS-FR-1101, 1107, 1108): Get help is one tap from Mind, its links open
// the dialler or browser, and nothing about it is sent to the server or AI.
test('Get help opens from Mind with counsellor booking and support lines', async ({ page }) => {
  await page.addInitScript(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = ((url?: string | URL) => { opened.push(String(url)); return null; }) as typeof window.open;
  });
  const sideTraffic: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/') || url.includes('/rest/v1/wellbeing')) sideTraffic.push(url);
  });

  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Mind' }).click();
  await expect(page.getByText('How are you feeling?')).toBeVisible();

  const entry = page.getByTestId('mind-get-help');
  await expect(entry).toContainText('Get help');
  await entry.click();

  await expect(page.getByRole('heading', { name: 'Get help', exact: true })).toBeVisible();
  await expect(page.getByText('Talking to someone can help.')).toBeVisible();
  await expect(page.getByTestId('help-counsellor')).toContainText('UMPSA counsellor');
  await expect(page.getByTestId('help-counsellor')).toContainText('MyGading Pelajar › Student Life › e-Sejahtera › Booking Appointment');
  await expect(page.getByTestId('help-centre')).toContainText('Pusat Sejahtera: 09-431 6999');
  await expect(page.getByText('Open Mon–Fri, 8 am–5 pm.')).toBeVisible();
  await expect(page.getByTestId('help-line-0376272929')).toContainText('Befrienders KL');
  await expect(page.getByTestId('help-line-15555')).toContainText('Talian HEAL');
  await expect(page.getByTestId('help-line-999')).toContainText('999');
  await expect(page.getByText('Unifyd is not an emergency service.')).toBeVisible();
  // Calm wording: no clinical labels on this screen.
  const text = (await page.getByTestId('help-counsellor').locator('..').innerText()).toLowerCase();
  for (const word of ['depression', 'severe', 'symptom', 'disorder', 'score']) expect(text).not.toContain(word);

  await page.getByTestId('help-book').click();
  await page.getByTestId('help-counsellors').click();
  // react-native-web sends tel: links through window.location, which the test browser ignores,
  // so phone rows are checked by their call labels; the numbers come from constants/supportLines.ts.
  await expect(page.getByRole('link', { name: 'Call Pusat Sejahtera: 09-431 6999' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call Befrienders KL (24 hours): 03-7627 2929' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call Talian HEAL mental health line: 15555' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call Emergency services: 999' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([
    'https://gading.ump.edu.my/ump/r/student/sppa-portal/login-page',
    'https://sites.google.com/umpsa.edu.my/pusatsejahteraumpsa/about-us/counsellor-by-faculty',
  ]);

  await page.getByRole('button', { name: 'Go back' }).last().click();
  await expect(page.getByTestId('mind-get-help')).toBeVisible();
  expect(sideTraffic).toEqual([]);
});

async function signInToMind(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Mind' }).click();
  await expect(page.getByText('How are you feeling?')).toBeVisible();
}

// Wellbeing Phase 2 (SRS-FR-1102): one minute of 4 s in / 6 s out, stop any time, nothing sent.
test('Breathing break guides, stops, and finishes after one minute', async ({ page }) => {
  const sideTraffic: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/api/')) sideTraffic.push(request.url()); });
  await signInToMind(page);

  const entry = page.getByTestId('mind-breathing');
  await expect(entry).toContainText('Breathe');
  await entry.click();
  await expect(page.getByRole('heading', { name: 'Breathing break' })).toBeVisible();
  await expect(page.getByText('One minute. Stop any time.')).toBeVisible();
  await expect(page.getByText('A short pause, not a treatment.')).toBeVisible();

  // Real time: starts breathing in, turns to breathing out after 4 s, and Stop returns to Start.
  await page.getByTestId('breathing-start').click();
  await expect(page.getByTestId('breathing-phase')).toHaveText('Breathe in');
  await expect(page.getByTestId('breathing-phase')).toHaveText('Breathe out', { timeout: 6000 });
  await page.getByTestId('breathing-stop').click();
  await expect(page.getByTestId('breathing-start')).toHaveText('Start');

  // Fake clock for the full minute.
  await page.clock.install();
  await page.getByTestId('breathing-start').click();
  await expect(page.getByTestId('breathing-phase')).toHaveText('Breathe in');
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('breathing-phase')).toHaveText('Done');
  await expect(page.getByText('Take your time.')).toBeVisible();
  await expect(page.getByTestId('breathing-start')).toHaveText('Again');
  expect(sideTraffic).toEqual([]);
});

test('Breathing break keeps the circle still under Reduce Motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInToMind(page);
  await page.getByTestId('mind-breathing').click();
  await page.getByTestId('breathing-start').click();
  await expect(page.getByTestId('breathing-phase')).toHaveText('Breathe in');
  const circle = page.getByTestId('breathing-circle');
  const first = await circle.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(1500);
  expect(await circle.evaluate((element) => getComputedStyle(element).transform)).toBe(first);
  await page.getByTestId('breathing-stop').click();
});

// Wellbeing Phase 3 (SRS-FR-1103): after a save, an optional card offers breathing and two tips.
// The insert is mocked so no real check-in rows are written.
test('After a check-in, a dismissible card offers breathing and two tips', async ({ page }) => {
  await page.route('**/rest/v1/mood_entries*', async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: '00000000-0000-4000-8000-00000000e2e3' }) });
    else await route.continue();
  });
  await signInToMind(page);
  await expect(page.getByTestId('mind-after-checkin')).toHaveCount(0);

  // Low mood, high stress: breathing plus a trusted person and rest.
  await page.getByRole('radio', { name: 'Mood: Low', exact: true }).click();
  await page.getByRole('radio', { name: 'Stress: High', exact: true }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByText('Check-in saved.')).toBeVisible();
  const card = page.getByTestId('mind-after-checkin');
  await expect(card).toContainText('Take a breath?');
  await expect(card).toContainText('Talk to someone you trust.');
  await expect(card).toContainText('Make time to rest and sleep.');
  await card.getByTestId('mind-after-dismiss').click();
  await expect(card).toHaveCount(0);

  // A calm check-in: everyday tips, no breathing invitation.
  await page.getByRole('radio', { name: 'Mood: Very good', exact: true }).click();
  await page.getByRole('radio', { name: 'Stress: Very low', exact: true }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(card).toContainText('Drink water and eat a proper meal.');
  await expect(card.getByTestId('mind-after-breathe')).toHaveCount(0);

  // Start opens the breathing break and the card goes away.
  await page.getByRole('radio', { name: 'Mood: Neutral', exact: true }).click();
  await page.getByRole('radio', { name: 'Stress: Moderate', exact: true }).click();
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await card.getByTestId('mind-after-breathe').click();
  await expect(page.getByRole('heading', { name: 'Breathing break' })).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).last().click();
  await expect(page.getByTestId('mind-after-checkin')).toHaveCount(0);
});

// Wellbeing Phase 4 (SRS-FR-1104): a Home invite at most once per local day, only with no check-in today.
test('Home invites a daily check-in once per day and never after a check-in', async ({ page }) => {
  let checkedInToday = false;
  await page.route('**/rest/v1/mood_entries*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.searchParams.get('select') === 'id') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(checkedInToday ? [{ id: '00000000-0000-4000-8000-00000000e2e4' }] : []) });
    } else await route.continue();
  });
  const clearInvite = () => page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('unifyd:checkin-invite:')) localStorage.removeItem(key); });
  const invite = page.getByTestId('home-checkin-invite');

  await page.goto('/');
  await clearInvite();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(invite).toContainText('How are you today?');
  const stored = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('unifyd:checkin-invite:'))?.[1]);
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  expect(stored).toBe(today);

  // Not now hides it, and it does not come back today: not on returning to Home, not after a reload.
  await page.getByTestId('home-checkin-invite-dismiss').click();
  await expect(invite).toHaveCount(0);
  await page.getByRole('tab', { name: 'Mind' }).click();
  await page.getByRole('tab', { name: 'Home' }).click();
  await expect(page.getByText('YOUR SPACE')).toBeVisible();
  await page.reload();
  await expect(page.getByText('YOUR SPACE')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(invite).toHaveCount(0);

  // A new day's invite: Check in opens Mind.
  await clearInvite();
  await page.reload();
  await page.getByTestId('home-checkin-invite-open').click();
  await expect(page.getByText('How are you feeling?')).toBeVisible();

  // With a check-in today there is no invite, even when none was shown yet.
  checkedInToday = true;
  await clearInvite();
  await page.goto('/');
  await expect(page.getByText('YOUR SPACE')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(invite).toHaveCount(0);
});

// Wellbeing Phase 5 (SRS-FR-1105, 1108): five plain feelings, one result line, no score, nothing saved or sent.
test('How have you been: calm and help outcomes, with nothing saved or sent', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/') || (url.includes('/rest/v1/') && request.method() !== 'GET')) writes.push(`${request.method()} ${url}`);
  });
  await signInToMind(page);
  await page.getByTestId('mind-reflect').click();
  await expect(page.getByRole('heading', { name: 'How have you been?' })).toBeVisible();
  await expect(page.getByText('Your answers are not saved.')).toBeVisible();
  await page.getByTestId('reflect-start').click();

  const feelings = ['Hard to relax', 'Feeling low', 'Worried or panicky', 'No energy or interest', 'Hard to sleep'];
  const question = page.getByTestId('reflect-question');
  await expect(question).toContainText('1 of 5');
  await expect(question).toContainText(feelings[0]);
  await page.getByTestId('reflect-answer-sometimes').click();
  // Back keeps the earlier answer selected.
  await expect(question).toContainText('2 of 5');
  await page.getByTestId('reflect-back').click();
  await expect(question).toContainText(feelings[0]);
  await expect(page.getByTestId('reflect-answer-sometimes')).toHaveAttribute('aria-checked', 'true');
  for (let i = 0; i < 5; i++) {
    await expect(question).toContainText(feelings[i]);
    await page.getByTestId(i % 2 ? 'reflect-answer-notReally' : 'reflect-answer-sometimes').click();
  }
  await expect(page.getByTestId('reflect-result-line')).toHaveText('Everyone feels this sometimes.');
  await expect(page.getByTestId('reflect-get-help')).toBeVisible();
  const resultText = (await page.getByTestId('reflect-result').innerText()).toLowerCase();
  for (const word of ['score', 'severe', 'mild', 'depression', 'anxiety', 'symptom', '/']) expect(resultText).not.toContain(word);
  await page.getByTestId('reflect-done').click();
  await expect(page.getByTestId('mind-reflect')).toBeVisible();

  // Any Often: the counsellor-or-doctor line, and Get help opens the help screen.
  await page.getByTestId('mind-reflect').click();
  await page.getByTestId('reflect-start').click();
  for (let i = 0; i < 5; i++) await page.getByTestId(i === 3 ? 'reflect-answer-often' : 'reflect-answer-notReally').click();
  await expect(page.getByTestId('reflect-result-line')).toHaveText('This has been often. Talking to a counsellor or doctor can help.');
  await page.getByTestId('reflect-get-help').click();
  await expect(page.getByRole('heading', { name: 'Get help', exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

// Wellbeing Phase 5 (SRS-FR-1106): Home invites the reflection when the low-mood rule is met; Not now lasts the day.
test('Home invites the reflection on repeated low mood, ahead of the daily check-in', async ({ page }) => {
  const at = (daysAgo: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(10, 0, 0, 0); return d.toISOString(); };
  await page.route('**/rest/v1/mood_entries*', async (route) => {
    const select = new URL(route.request().url()).searchParams.get('select');
    if (select === 'id') await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    else if (select === 'mood_level,stress_level,recorded_at') await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([0, 1, 2].map((days) => ({ mood_level: 1, stress_level: 3, recorded_at: at(days) }))) });
    else await route.continue();
  });
  const clearKeys = () => page.evaluate(() => { for (const key of Object.keys(localStorage)) if (/^unifyd:(reflection|checkin)-invite:/.test(key)) localStorage.removeItem(key); });
  const reflect = page.getByTestId('home-reflect-invite');

  await page.goto('/');
  await clearKeys();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(reflect).toContainText('How have you been?');
  await expect(page.getByTestId('home-checkin-invite')).toHaveCount(0);

  // Not now: the reflection invite leaves for today (the daily check-in invite may then show) and stays away after a reload.
  await page.getByTestId('home-reflect-invite-dismiss').click();
  await expect(reflect).toHaveCount(0);
  await expect(page.getByTestId('home-checkin-invite')).toBeVisible();
  await page.reload();
  await expect(page.getByText('YOUR SPACE')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(reflect).toHaveCount(0);

  // Another day: Start opens the reflection.
  await clearKeys();
  await page.reload();
  await page.getByTestId('home-reflect-invite-open').click();
  await expect(page.getByText('Your answers are not saved.')).toBeVisible();
  await clearKeys();
});
