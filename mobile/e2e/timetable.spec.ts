import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { testClient } from './test-client';

const email = process.env.E2E_TEST_EMAIL!;
const password = process.env.E2E_TEST_PASSWORD!;
const session = '2026/2027';
const subject = { id: '00000000-0000-4000-8000-0000000000a1', academic_session: session, semester: 1, catalog_course_id: null, course_code: 'BCS3453', course_name: 'INTEGRATED APPLICATION DEVELOPMENT FRAMEWORK', credit_hours: null, is_custom: true, created_at: '2026-10-01T00:00:00Z' };

type Row = Record<string, unknown>;
const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const eqFilters = (url: string) => [...new URL(url).searchParams].filter(([, value]) => value.startsWith('eq.')).map(([key, value]) => [key, value.slice(3)] as const);
const matches = (row: Row, filters: readonly (readonly [string, string])[]) => filters.every(([key, value]) => String(row[key]) === value);

/**
 * Supabase reads for the catalogue and My Semester are mocked, and timetable rows
 * live in memory, so these tests never depend on (or write) live timetable data.
 */
async function mockData(page: Page, userId: string) {
  const store: Row[] = [];
  const writes: { method: string; body: unknown }[] = [];
  await page.route('**/rest/v1/catalog_courses*', (route) => json(route, 200, [{ academic_session: session }]));
  await page.route('**/rest/v1/student_semester_courses*', (route) => json(route, 200, [{ ...subject, user_id: userId }]));
  await page.route('**/rest/v1/timetable_entries*', async (route) => {
    const request = route.request();
    const filters = eqFilters(request.url());
    const single = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    const respond = (rows: Row[]) => single ? (rows[0] ? json(route, 200, rows[0]) : json(route, 406, { code: 'PGRST116' })) : json(route, 200, rows);
    if (request.method() === 'GET') return respond(store.filter((row) => matches(row, filters)));
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Row | Row[];
      writes.push({ method: 'POST', body });
      for (const row of Array.isArray(body) ? body : [body]) store.push({ ...row, id: `00000000-0000-4000-9000-${String(store.length + 1).padStart(12, '0')}`, start_time: `${String(row.start_time)}:00`, end_time: `${String(row.end_time)}:00` });
      return route.fulfill({ status: 201, body: '' });
    }
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Row;
      writes.push({ method: 'PATCH', body });
      const rows = store.filter((row) => matches(row, filters));
      for (const row of rows) Object.assign(row, body, { start_time: `${String(body.start_time)}:00`, end_time: `${String(body.end_time)}:00` });
      return respond(rows.map((row) => ({ id: row.id })));
    }
    if (request.method() === 'DELETE') {
      writes.push({ method: 'DELETE', body: null });
      const rows = store.filter((row) => matches(row, filters));
      for (const row of rows) store.splice(store.indexOf(row), 1);
      return respond(rows.map((row) => ({ id: row.id })));
    }
    return route.fulfill({ status: 405, body: '' });
  });
  return { store, writes };
}

async function mockImport(page: Page, reply: (route: Route) => Promise<void>) {
  const posts: { bearer: boolean; fileField: boolean }[] = [];
  await page.route('**/api/timetable/import', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
    posts.push({ bearer: request.headers().authorization?.startsWith('Bearer ') === true, fileField: request.postDataBuffer()?.toString('latin1').includes('name="file"') ?? false });
    return reply(route);
  });
  return posts;
}

async function openTimetable(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('tab', { name: 'Planner' }).click();
  await page.getByRole('button', { name: 'My timetable' }).click();
  await expect(page.getByText(/not official UMPSA registration/)).toBeVisible();
  await expect(page.getByRole('button', { name: `Academic session: ${session}` })).toBeVisible();
}

async function chooseFile(page: Page, source: 'Choose from Photos' | 'Choose from Files', name: string, mimeType: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: source }).click();
  await (await chooser).setFiles({ name, mimeType, buffer: Buffer.from(mimeType === 'application/pdf' ? '%PDF-1.7\n%%EOF' : 'timetable') });
  await expect(page.getByText(`Selected: ${name}`)).toBeVisible();
}

async function userId() {
  const { client, userId: id } = await testClient();
  await client.auth.signOut();
  return id;
}

test('a partial import is valid: confirmed classes save while wrong and incomplete candidates are left out', async ({ page }) => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
  // Wednesday 7 October 2026, 08:00 in Kuala Lumpur.
  await page.clock.setFixedTime(new Date('2026-10-07T08:00:00+08:00'));
  const { store, writes } = await mockData(page, await userId());
  // Shaped like a real UMPSA grid: five possible classes, of which three are accurate,
  // one is a misread legend line, and one lacks a day and end time.
  const posts = await mockImport(page, (route) => json(route, 200, {
    candidates: [
      { id: 'c1', courseCode: 'BCS3453', courseName: 'INTEGRATED APPLICATION DEVELOPMENT FRAMEWORK', dayOfWeek: 2, startTime: '08:00', endTime: '09:50', location: 'BZ-01-100', sectionLabel: '01B', confidence: 'medium' },
      { id: 'c2', courseCode: 'BCS3153', courseName: 'SOFTWARE EVOLUTION & MAINTENANCE', dayOfWeek: 4, startTime: '08:00', endTime: '09:50', location: 'BZ-01-112', sectionLabel: '01', confidence: 'medium' },
      { id: 'c3', courseCode: 'BCN3243', courseName: 'CLOUD COMPUTING TECHNOLOGY', dayOfWeek: 2, startTime: '14:00', endTime: '15:50', location: 'BZ-02-096', sectionLabel: '01', confidence: 'medium' },
      { id: 'c4', courseCode: null, courseName: 'L = Lecture T = Tutorial', dayOfWeek: 1, startTime: '07:00', endTime: '07:50', location: null, sectionLabel: null, confidence: 'low' },
      { id: 'c5', courseCode: 'BCC3024', courseName: 'UNDERGRADUATE PROJECT II', dayOfWeek: null, startTime: '15:00', endTime: null, location: 'BZ-01-085', sectionLabel: '01', confidence: 'low' },
    ],
    warnings: ['REVIEW_REQUIRED', 'INCOMPLETE_DETAILS'], pagesProcessed: 1, totalPages: 1,
  }));

  await openTimetable(page);
  await expect(page.getByTestId('timetable-empty')).toContainText('No classes saved yet. That is fine');
  await expect(page.getByTestId('next-class')).toContainText('No upcoming classes in your timetable');
  await page.getByRole('button', { name: 'Import timetable' }).click();
  await expect(page.getByText(/not stored by Unifyd/)).toBeVisible();
  await chooseFile(page, 'Choose from Photos', 'timetable.png', 'image/png');
  await page.getByRole('button', { name: 'Read timetable' }).click();

  await expect(page.getByText('Check and add your classes')).toBeVisible();
  expect(posts).toEqual([{ bearer: true, fileField: true }]);
  await expect(page.getByText(/Your other classes can still be saved/)).toBeVisible();
  await expect(page.getByTestId('review-class')).toHaveCount(5);
  expect(writes, 'nothing is saved before review').toEqual([]);

  // Complete candidates start ticked; the incomplete one cannot be ticked and does not block saving.
  const include = (number: number) => page.getByRole('checkbox', { name: `Add class ${number} to my timetable` });
  await expect(include(1)).toBeChecked();
  await expect(include(5)).not.toBeChecked();
  await expect(include(5)).toBeDisabled();
  await expect(page.getByTestId('review-class').nth(4)).toContainText('Incomplete. It will not be saved unless you complete it.');
  await expect(page.getByRole('button', { name: 'Add 4 classes to my timetable' })).toBeEnabled();

  // A candidate can be left out by unticking, then included again.
  await include(2).click();
  await expect(page.getByTestId('review-class').nth(1)).toContainText('Left out. It will not be saved.');
  await expect(page.getByRole('button', { name: 'Add 3 classes to my timetable' })).toBeVisible();
  await include(2).click();

  // The misread legend line is removed.
  await page.getByRole('button', { name: 'Remove class 4' }).click();
  await expect(page.getByTestId('review-class')).toHaveCount(4);
  await expect(page.getByText('1 not included (incomplete or left out). You can add classes later.')).toBeVisible();

  // Classes are one-line summaries; details open on request.
  await expect(page.getByTestId('review-class').first()).toContainText('BCS3453 · INTEGRATED APPLICATION DEVELOPMENT FRAMEWORK');
  await expect(page.getByTestId('review-class').first()).toContainText('Tue 08:00–09:50 · BZ-01-100 · Section 01B');
  await expect(page.getByRole('textbox', { name: 'Class name' })).toHaveCount(1); // only the incomplete class starts open
  await page.getByRole('button', { name: 'Edit class 1' }).first().click();

  // An exact course-code match is only suggested; the student links it explicitly.
  await expect(page.getByText(/Same course code as BCS3453/)).toBeVisible();
  await page.getByRole('button', { name: 'Link subject' }).click();
  await expect(page.getByRole('button', { name: /Linked subject \(optional\): BCS3453/ })).toBeVisible();

  // Clashes between kept classes are warnings only.
  const third = page.getByTestId('review-class').nth(2);
  await page.getByRole('button', { name: 'Edit class 3' }).first().click();
  await third.getByRole('textbox', { name: 'Start time' }).fill('09:00');
  await expect(page.getByText('Some classes overlap. You can still save them.')).toBeVisible();
  await expect(third.getByText(/Overlaps with BCS3453/)).toBeVisible();
  await third.getByRole('textbox', { name: 'Start time' }).fill('14:00');
  await expect(page.getByText('Some classes overlap. You can still save them.')).toHaveCount(0);

  await page.getByRole('button', { name: 'Add 3 classes to my timetable' }).click();
  await expect(page.getByText('Timetable saved: 3 classes.')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]!.body).toEqual([
    expect.objectContaining({ academic_session: session, semester: 1, student_semester_course_id: subject.id, course_code: 'BCS3453', course_name: 'INTEGRATED APPLICATION DEVELOPMENT FRAMEWORK', day_of_week: 2, start_time: '08:00', end_time: '09:50', location: 'BZ-01-100', section_label: '01B', entry_source: 'timetable_import' }),
    expect.objectContaining({ student_semester_course_id: null, course_code: 'BCS3153', day_of_week: 4, start_time: '08:00', end_time: '09:50', entry_source: 'timetable_import' }),
    expect.objectContaining({ student_semester_course_id: null, course_code: 'BCN3243', day_of_week: 2, start_time: '14:00', end_time: '15:50', entry_source: 'timetable_import' }),
  ]);
  expect(store).toHaveLength(3);

  // A partial week is shown cleanly: empty days are marked, never reported as missing.
  await expect(page.getByTestId('timetable-clashes')).toHaveCount(0);
  await expect(page.getByTestId('next-class')).toContainText('SOFTWARE EVOLUTION & MAINTENANCE');
  await expect(page.getByTestId('next-class')).toContainText('Tomorrow, 08:00–09:50');
  await expect(page.getByTestId('week-grid')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tuesday, 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monday, 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit INTEGRATED APPLICATION DEVELOPMENT FRAMEWORK, Tuesday 08:00–09:50' })).toContainText('BZ-01-100');
  // Covered hours have no + button; free hours do.
  await expect(page.getByRole('button', { name: 'Add a class on Tuesday at 09:00' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a class on Monday at 09:00' })).toBeVisible();

  // The Planner shows the same next class from the saved timetable.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('planner-next-class')).toContainText('Tomorrow, 08:00–09:50');
});

test('a review with only incomplete candidates saves nothing and can be left without saving', async ({ page }) => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
  const { writes } = await mockData(page, await userId());
  await mockImport(page, (route) => json(route, 200, {
    candidates: [{ id: 'c1', courseCode: 'BCC3024', courseName: null, dayOfWeek: 5, startTime: '15:00', endTime: null, location: null, sectionLabel: null, confidence: 'low' }],
    warnings: ['REVIEW_REQUIRED', 'INCOMPLETE_DETAILS'], pagesProcessed: 1, totalPages: 1,
  }));
  await openTimetable(page);
  await page.getByRole('button', { name: 'Import timetable' }).click();
  await chooseFile(page, 'Choose from Files', 'timetable.jpg', 'image/jpeg');
  await page.getByRole('button', { name: 'Read timetable' }).click();
  await expect(page.getByText(/No complete class is ticked yet/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add 0 classes to my timetable' })).toBeDisabled();

  // Completing the candidate makes it saveable, but the student may still leave without saving.
  const card = page.getByTestId('review-class');
  await card.getByRole('textbox', { name: 'Class name' }).fill('UNDERGRADUATE PROJECT II');
  await card.getByRole('textbox', { name: 'End time' }).fill('16:50');
  await expect(page.getByRole('button', { name: 'Add 1 class to my timetable' })).toBeEnabled();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByTestId('timetable-empty')).toBeVisible();
  expect(writes).toEqual([]);
});

test('classes can be added, edited, and deleted by hand; touching times do not clash', async ({ page }) => {
  // Wednesday 7 October 2026, 18:00: the next class is on a later day.
  await page.clock.setFixedTime(new Date('2026-10-07T18:00:00+08:00'));
  const { store, writes } = await mockData(page, await userId());
  await openTimetable(page);

  // A + cell opens the form with its day and hour filled in; cancelling creates nothing.
  await page.getByRole('button', { name: 'Add a class on Wednesday at 13:00' }).click();
  await expect(page.getByRole('button', { name: 'Day: Wednesday' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Start time' })).toHaveValue('13:00');
  await expect(page.getByRole('textbox', { name: 'End time' })).toHaveValue('13:50');
  await page.getByRole('textbox', { name: 'Class name' }).fill('Not saved');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('timetable-empty')).toBeVisible();
  expect(writes).toEqual([]);

  for (const [name, start, end] of [['Algorithms lecture', '9:00', '10:00'], ['Algorithms lab', '10.00', '11:00']] as const) {
    await page.getByRole('button', { name: 'Add class' }).click();
    await expect(page.getByText('Saving to 2026/2027, Semester 1.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Class name' }).fill(name);
    await page.getByRole('button', { name: 'Day: Choose a day' }).click();
    await page.getByRole('radio', { name: 'Thursday' }).click();
    await page.getByRole('textbox', { name: 'Start time' }).fill(start);
    await page.getByRole('textbox', { name: 'End time' }).fill(end);
    await expect(page.getByText(/Overlaps with/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Save class' }).click();
    await expect(page.getByText('Class saved.')).toBeVisible();
  }
  expect(writes.map((write) => write.body)).toEqual([
    expect.objectContaining({ course_name: 'Algorithms lecture', day_of_week: 4, start_time: '09:00', end_time: '10:00', entry_source: 'manual', course_code: null }),
    expect.objectContaining({ course_name: 'Algorithms lab', day_of_week: 4, start_time: '10:00', end_time: '11:00', entry_source: 'manual' }),
  ]);
  await expect(page.getByTestId('timetable-clashes')).toHaveCount(0);
  await expect(page.getByTestId('next-class')).toContainText('Tomorrow, 09:00–10:00');

  // Editing validates times and never changes ownership or the entry source.
  await page.getByRole('button', { name: 'Edit Algorithms lab, Thursday 10:00–11:00' }).click();
  await expect(page.getByText('Edit class')).toBeVisible();
  await page.getByRole('textbox', { name: 'End time' }).fill('09:30');
  await page.getByRole('button', { name: 'Save class' }).click();
  await expect(page.getByText('The end time must be after the start time.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Start time' }).fill('09:30');
  await page.getByRole('textbox', { name: 'End time' }).fill('11:00');
  await expect(page.getByText('Overlaps with Algorithms lecture on this day. You can still save it.')).toBeVisible();
  await page.getByRole('button', { name: 'Save class' }).click();
  await expect(page.getByText('Class updated.')).toBeVisible();
  const patch = writes.find((write) => write.method === 'PATCH')!.body as Row;
  expect(patch).not.toHaveProperty('user_id');
  expect(patch).not.toHaveProperty('entry_source');
  await expect(page.getByTestId('timetable-clashes')).toContainText('Algorithms lecture and Algorithms lab overlap on Thursday.');

  await page.getByRole('button', { name: 'Edit Algorithms lab, Thursday 09:30–11:00' }).click();
  await page.getByRole('button', { name: 'Delete class' }).click();
  await expect(page.getByText('Delete this class?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete class' }).last().click();
  await expect(page.getByText('Class deleted.')).toBeVisible();
  expect(store.map((row) => row.course_name)).toEqual(['Algorithms lecture']);
  await expect(page.getByTestId('timetable-clashes')).toHaveCount(0);
});

test('unreadable and protected files show safe messages; with no saved classes the next class note stays neutral', async ({ page }) => {
  test.skip(!process.env.EXPO_PUBLIC_OCR_API_URL, 'The OCR API URL is not configured for Expo Web.');
  const { writes } = await mockData(page, await userId());
  const replies = [
    { status: 422, body: { error: { code: 'PDF_PROTECTED', message: 'The PDF is protected.' } } },
    { status: 422, body: { error: { code: 'INVALID_DOCUMENT', message: 'Unreadable.' } } },
    { status: 502, body: { error: { code: 'OCR_UNAVAILABLE', message: 'Unavailable.' } } },
  ];
  await mockImport(page, (route) => { const reply = replies.shift()!; return json(route, reply.status, reply.body); });
  await openTimetable(page);
  await expect(page.getByTestId('next-class')).toContainText('No upcoming classes in your timetable');
  await page.getByRole('button', { name: 'Import timetable' }).click();
  await chooseFile(page, 'Choose from Files', 'locked.pdf', 'application/pdf');
  await page.getByRole('button', { name: 'Read timetable' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'This PDF is password-protected.' })).toBeVisible();
  await page.getByRole('button', { name: 'Read timetable' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'We could not read this file.' })).toBeVisible();
  await page.getByRole('button', { name: 'Read timetable' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Timetable reading is unavailable right now.' })).toBeVisible();
  expect(writes).toEqual([]);

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'My timetable' })).toBeVisible();
  await expect(page.getByTestId('planner-next-class')).toContainText('No upcoming classes in your timetable');
});
