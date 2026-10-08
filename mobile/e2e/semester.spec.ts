import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const prefix = `E2E Semester ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
const session = '2026/2027';

// Catalogue reads are intercepted so the tests do not depend on the reviewed seed being applied.
const catalog = [
  { id: '00000000-0000-4000-8000-000000000001', academic_session: session, semester: 1, faculty_code: 'FK', campus: 'PEKAN', course_code: 'BCS2233', course_name: 'SOFTWARE REQUIREMENT WORKSHOP', credit_hours: null, is_active: true },
  { id: '00000000-0000-4000-8000-000000000002', academic_session: session, semester: 1, faculty_code: 'FK', campus: 'PEKAN', course_code: 'BCN2113', course_name: 'COMPUTER NETWORKS', credit_hours: null, is_active: true },
  { id: '00000000-0000-4000-8000-000000000003', academic_session: session, semester: 2, faculty_code: 'FK', campus: null, course_code: 'BCC4012', course_name: 'INDUSTRIAL TRAINING', credit_hours: null, is_active: true },
];

type Row = Record<string, unknown>;

function eqFilters(url: string) {
  const filters: [string, string][] = [];
  for (const [key, value] of new URL(url).searchParams) if (value.startsWith('eq.')) filters.push([key, value.slice(3)]);
  return filters;
}

function matches(row: Row, filters: [string, string][]) {
  return filters.every(([key, value]) => String(row[key]) === value);
}

async function mockCatalog(page: Page) {
  await page.route('**/rest/v1/catalog_courses*', async (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405, body: '' });
    const rows = catalog.filter((row) => matches(row, eqFilters(route.request().url())));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
}

async function signInToMySemester(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Planner' })).toBeVisible();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await page.getByRole('button', { name: 'My semester' }).click();
  await expect(page.getByText('YOUR ACADEMICS')).toBeVisible();
  // The Planner link underneath the stack also reads "My semester"; the title is the last match.
  await expect(page.getByText('My semester', { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/not official UMPSA registration/)).toBeVisible();
  await expect(page.getByRole('button', { name: `Academic session: ${session}` })).toBeVisible();
}

async function cleanup() {
  const { client, userId } = await testClient();
  try {
    for (const [table, column] of [['student_semester_courses', 'course_name'], ['tasks', 'title']] as const) {
      const { data, error } = await client.from(table).select(`id,${column}`).eq('user_id', userId).like(column, `${prefix}%`);
      if (error) throw new Error(`Could not list ${table} test rows for cleanup.`);
      for (const row of (data ?? []) as unknown as Row[]) {
        if (!String(row[column]).startsWith(prefix)) continue;
        const removed = await client.from(table).delete().eq('id', String(row.id)).eq('user_id', userId);
        if (removed.error) throw new Error(`Could not clean up a ${table} test row.`);
      }
      const remaining = await client.from(table).select('id').eq('user_id', userId).like(column, `${prefix}%`);
      if (remaining.error || (remaining.data?.length ?? 0) !== 0) throw new Error(`${table} test cleanup left rows behind.`);
    }
  } finally { await client.auth.signOut(); }
}

test('catalogue subjects search, save a non-custom snapshot, and block duplicates', async ({ page }) => {
  const { client, userId } = await testClient();
  await client.auth.signOut();
  await mockCatalog(page);

  // Student selections are held in memory for this test because mocked catalogue IDs cannot satisfy the live foreign key.
  const store: Row[] = [];
  const inserts: Row[] = [];
  await page.route('**/rest/v1/student_semester_courses*', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const rows = store.filter((row) => matches(row, eqFilters(request.url())));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Row | Row[];
      for (const row of Array.isArray(body) ? body : [body]) {
        inserts.push(row);
        store.push({ ...row, id: `00000000-0000-4000-9000-00000000000${store.length + 1}`, created_at: new Date().toISOString() });
      }
      return route.fulfill({ status: 201, body: '' });
    }
    return route.fulfill({ status: 405, body: '' });
  });

  await signInToMySemester(page);
  await expect(page.getByText('No subjects selected for this semester yet.')).toBeVisible();

  await page.getByRole('button', { name: 'Add subject' }).click();
  await expect(page.getByText('Choose a catalogue subject')).toBeVisible();
  const software = page.getByRole('button', { name: 'Choose BCS2233 SOFTWARE REQUIREMENT WORKSHOP' });
  const networks = page.getByRole('button', { name: 'Choose BCN2113 COMPUTER NETWORKS' });
  await expect(software).toBeVisible();
  await expect(networks).toBeVisible();
  // Semester 2 offerings are filtered out of Semester 1.
  await expect(page.getByRole('button', { name: /BCC4012/ })).toHaveCount(0);
  await expect(software).toContainText('Campus: PEKAN');
  await expect(software).toContainText('Credits not verified');

  const search = page.getByRole('textbox', { name: 'Search code or course name' });
  await search.fill('bcs2233');
  await expect(software).toBeVisible();
  await expect(networks).toHaveCount(0);
  await search.fill('networks');
  await expect(networks).toBeVisible();
  await expect(software).toHaveCount(0);
  await search.fill('no such course');
  await expect(page.getByText('No courses match your search.')).toBeVisible();
  await search.fill('');

  await software.click();
  await expect(page.getByText('Subject added.')).toBeVisible();
  expect(inserts).toEqual([{
    user_id: userId, academic_session: session, semester: 1,
    catalog_course_id: catalog[0].id, course_code: 'BCS2233', course_name: 'SOFTWARE REQUIREMENT WORKSHOP',
    credit_hours: null, is_custom: false,
  }]);
  await expect(page.getByRole('button', { name: 'Edit SOFTWARE REQUIREMENT WORKSHOP' })).toBeVisible();
  await expect(page.getByText('0 verified credit hours known')).toBeVisible();
  await expect(page.getByText('1 selected subject(s) have no verified credit value yet.')).toBeVisible();

  // A subject already in the visible list is refused before any request.
  await page.getByRole('button', { name: 'Add subject' }).click();
  await expect(software).toContainText('That catalogue subject is already in this semester.');
  await software.click();
  await expect(page.getByRole('alert').filter({ hasText: 'That catalogue subject is already in this semester.' })).toBeVisible();
  expect(inserts).toHaveLength(1);

  // A selection saved elsewhere since the list loaded is caught by the owned database check.
  store.push({ id: '00000000-0000-4000-9000-000000000099', user_id: userId, academic_session: session, semester: 1, catalog_course_id: catalog[1].id, course_code: 'BCN2113', course_name: 'COMPUTER NETWORKS', credit_hours: null, is_custom: false, created_at: new Date().toISOString() });
  await networks.click();
  await expect(page.getByRole('alert').filter({ hasText: 'That catalogue subject is already in this semester.' })).toBeVisible();
  expect(inserts).toHaveLength(1);
});

test('custom subjects, credits, edits, deletes, and task subject shortcuts use owned rows', async ({ page }) => {
  await mockCatalog(page);
  const mutations: { method: string; url: string }[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/student_semester_courses') && ['PATCH', 'DELETE'].includes(request.method())) mutations.push({ method: request.method(), url: request.url() });
  });

  const { client, userId } = await testClient();
  try {
    const existing = await client.from('student_semester_courses').select('credit_hours').eq('user_id', userId).eq('academic_session', session).eq('semester', 2);
    if (existing.error) throw new Error('Could not read the existing Semester 2 selections.');
    const baseKnown = (existing.data ?? []).reduce((sum, row) => sum + (row.credit_hours ?? 0), 0);
    const baseUnknown = (existing.data ?? []).filter((row) => row.credit_hours === null).length;

    await signInToMySemester(page);
    await page.getByRole('button', { name: 'Semester: Semester 1' }).click();
    await page.getByRole('radio', { name: 'Semester 2' }).click();
    await expect(page.getByRole('button', { name: 'Semester: Semester 2' })).toBeVisible();

    const addCustom = async (name: string, code: string, credits: string) => {
      await page.getByRole('button', { name: 'Add custom subject' }).click();
      await page.getByRole('textbox', { name: 'Subject name' }).fill(name);
      await page.getByRole('textbox', { name: 'Course code (optional)' }).fill(code);
      await page.getByRole('textbox', { name: 'Credit hours (optional)' }).fill(credits);
      await page.getByRole('button', { name: 'Save subject' }).click();
      await expect(page.getByText('Subject added.')).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    };

    // Required name and positive whole-number credits are validated locally.
    await page.getByRole('button', { name: 'Add custom subject' }).click();
    await page.getByRole('button', { name: 'Save subject' }).click();
    await expect(page.getByText('Enter a subject name.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Subject name' }).fill(`${prefix} Alpha`);
    await page.getByRole('textbox', { name: 'Credit hours (optional)' }).fill('0');
    await page.getByRole('button', { name: 'Save subject' }).click();
    await expect(page.getByText('Enter a positive whole number of credit hours, or leave it blank.')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await addCustom(`${prefix} Alpha`, '  E2E101  ', '16');
    const alpha = await client.from('student_semester_courses').select('user_id,academic_session,semester,catalog_course_id,course_code,course_name,credit_hours,is_custom')
      .eq('user_id', userId).eq('course_name', `${prefix} Alpha`).single();
    expect(alpha.error).toBeNull();
    expect(alpha.data).toEqual({ user_id: userId, academic_session: session, semester: 2, catalog_course_id: null, course_code: 'E2E101', course_name: `${prefix} Alpha`, credit_hours: 16, is_custom: true });

    // Known credits are summed; the >19 notice is shown without blocking further saves.
    await addCustom(`${prefix} Beta`, '', '4');
    await expect(page.getByText(`${baseKnown + 20} verified credit hours known`)).toBeVisible();
    await expect(page.getByText(/Known credits exceed 19/)).toBeVisible();
    await addCustom(`${prefix} Gamma`, '', '');
    await expect(page.getByText(`${baseKnown + 20} verified credit hours known`)).toBeVisible();
    await expect(page.getByText(`${baseUnknown + 1} selected subject(s) have no verified credit value yet.`)).toBeVisible();
    const gamma = await client.from('student_semester_courses').select('course_code,credit_hours').eq('user_id', userId).eq('course_name', `${prefix} Gamma`).single();
    expect(gamma.data).toEqual({ course_code: null, credit_hours: null });

    // Editing changes only the owned row's editable fields.
    await page.getByRole('button', { name: `Edit ${prefix} Alpha` }).click();
    await expect(page.getByRole('textbox', { name: 'Course code (optional)' })).toHaveValue('E2E101');
    await page.getByRole('textbox', { name: 'Subject name' }).fill(`${prefix} Alpha edited`);
    await page.getByRole('textbox', { name: 'Credit hours (optional)' }).fill('3');
    await page.getByRole('button', { name: 'Save subject' }).click();
    await expect(page.getByText('Subject updated.')).toBeVisible();
    await expect(page.getByText(`${baseKnown + 7} verified credit hours known`)).toBeVisible();
    if (baseKnown + 7 <= 19) await expect(page.getByText(/Known credits exceed 19/)).toHaveCount(0);
    const edited = await client.from('student_semester_courses').select('course_code,course_name,credit_hours,is_custom,user_id')
      .eq('user_id', userId).eq('course_name', `${prefix} Alpha edited`).single();
    expect(edited.data).toEqual({ course_code: 'E2E101', course_name: `${prefix} Alpha edited`, credit_hours: 3, is_custom: true, user_id: userId });

    // The task form offers the selected semester subjects and keeps the field editable.
    const shortcut = `E2E101 — ${prefix} Alpha edited`;
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByText('My semester subjects')).toBeVisible();
    await expect(page.getByRole('button', { name: `Use ${prefix} Beta as the task subject` })).toBeVisible();
    await page.getByRole('textbox', { name: 'Title' }).fill(`${prefix} snapshot task`);
    await page.getByRole('button', { name: `Use ${shortcut} as the task subject` }).click();
    await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue(shortcut);
    await page.getByRole('button', { name: 'Save task' }).click();
    await expect(page.getByText(`${prefix} snapshot task`)).toBeVisible();

    await page.getByRole('button', { name: 'Add task' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(`${prefix} manual task`);
    await page.getByRole('button', { name: `Use ${prefix} Beta as the task subject` }).click();
    await page.getByRole('textbox', { name: 'Subject' }).fill(`${prefix} typed subject`);
    await page.getByRole('button', { name: 'Save task' }).click();
    await expect(page.getByText(`${prefix} manual task`)).toBeVisible();

    const tasks = await client.from('tasks').select('title,subject').eq('user_id', userId).like('title', `${prefix}%`).order('title');
    expect(tasks.data).toEqual([
      { title: `${prefix} manual task`, subject: `${prefix} typed subject` },
      { title: `${prefix} snapshot task`, subject: shortcut },
    ]);

    // Deleting a semester subject leaves existing task subjects untouched.
    await page.getByRole('button', { name: 'My semester' }).click();
    await page.getByRole('button', { name: `Delete subject ${prefix} Alpha edited` }).click();
    await expect(page.getByText('Delete this subject?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(`${prefix} Alpha edited`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Delete subject ${prefix} Alpha edited` }).click();
    await page.getByRole('button', { name: 'Delete subject', exact: true }).click();
    await expect(page.getByText('Subject deleted.')).toBeVisible();
    await expect(page.getByText(`${prefix} Alpha edited`, { exact: true })).toHaveCount(0);

    const gone = await client.from('student_semester_courses').select('id').eq('user_id', userId).like('course_name', `${prefix} Alpha%`);
    expect(gone.data).toEqual([]);
    const kept = await client.from('tasks').select('subject').eq('user_id', userId).eq('title', `${prefix} snapshot task`).single();
    expect(kept.data).toEqual({ subject: shortcut });

    expect(mutations.map((m) => m.method)).toEqual(['PATCH', 'DELETE']);
    for (const mutation of mutations) {
      const params = new URL(mutation.url).searchParams;
      expect(params.get('user_id')).toBe(`eq.${userId}`);
      expect(params.get('id')).toMatch(/^eq\./);
    }
  } finally {
    await client.auth.signOut();
    await cleanup();
  }
});
