import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { testClient } from './test-client';

/**
 * Live checks against the applied `20261016_001_focus_sessions` migration, using only the configured test account.
 * Every task, subject, and focus row created here is removed at the end. There is no second test account, so
 * "another student's" task and subject are represented by IDs the test account does not own.
 */
const tag = `E2E Focus ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
const OTHER_USER = '00000000-0000-4000-8000-00000000dead';
const HOUR = 3_600_000;

function round(userId: string, fields: Record<string, unknown> = {}) {
  const ended = Date.now() - HOUR;
  return {
    id: crypto.randomUUID(), user_id: userId, semester_course_id: null, subject_label: null, task_id: null, task_title: null, preset: 'classic',
    planned_focus_seconds: 1500, focus_seconds: 1500, round_number: 1, started_at: new Date(ended - 1800_000).toISOString(), ended_at: new Date(ended).toISOString(),
    status: 'completed', ...fields,
  };
}

test('focus_sessions: owner insert/read/delete only, own links only, and every check holds', async () => {
  const { client, userId } = await testClient();
  const ids: string[] = [];
  let taskId = '';
  let courseId = '';
  try {
    const task = await client.from('tasks').insert({ user_id: userId, title: `${tag} task`, subject: `${tag} subject`, deadline: new Date(Date.now() + 86_400_000).toISOString() }).select('id').single();
    expect(task.error).toBeNull();
    taskId = task.data!.id;
    const course = await client.from('student_semester_courses').insert({ user_id: userId, academic_session: '2026/2027', semester: 1, course_name: `${tag} subject`, is_custom: true }).select('id').single();
    expect(course.error).toBeNull();
    courseId = course.data!.id;

    // A linked completed round and a General study partial round save and read back unchanged.
    const linked = round(userId, { semester_course_id: courseId, subject_label: `${tag} subject`, task_id: taskId, task_title: `${tag} task` });
    const partial = round(userId, { status: 'partial', focus_seconds: 600, preset: 'deep', planned_focus_seconds: 3000 });
    for (const row of [linked, partial]) {
      expect((await client.from('focus_sessions').insert(row)).error, row.status).toBeNull();
      ids.push(row.id);
    }
    const read = await client.from('focus_sessions').select('id,user_id,task_id,semester_course_id,focus_seconds,status,created_at').in('id', ids).order('focus_seconds');
    expect(read.data).toHaveLength(2);
    expect(read.data![1]).toMatchObject({ id: linked.id, user_id: userId, task_id: taskId, semester_course_id: courseId, focus_seconds: 1500, status: 'completed' });

    // The same ID twice is refused (the app then checks it owns that row).
    expect((await client.from('focus_sessions').insert(linked)).error?.code).toBe('23505');
    // Another user's ID, a task or subject the student does not own, and editing are refused.
    expect((await client.from('focus_sessions').insert(round(OTHER_USER))).error).not.toBeNull();
    expect((await client.from('focus_sessions').insert(round(userId, { task_id: crypto.randomUUID(), task_title: 'Not mine' }))).error).not.toBeNull();
    expect((await client.from('focus_sessions').insert(round(userId, { semester_course_id: crypto.randomUUID(), subject_label: 'Not mine' }))).error).not.toBeNull();
    expect((await client.from('focus_sessions').update({ focus_seconds: 1 }).eq('id', partial.id)).error).not.toBeNull();
    expect((await client.from('focus_sessions').insert({ ...round(userId), created_at: '2020-01-01T00:00:00Z' })).error).not.toBeNull();

    // Table checks: time limits, real focus only, status rules, and readable copies with links.
    const start = Date.now() - 2 * HOUR;
    for (const bad of [
      { planned_focus_seconds: 60, focus_seconds: 60 }, { planned_focus_seconds: 9000, focus_seconds: 9000 },
      { focus_seconds: 1600 }, { focus_seconds: 1400 }, { status: 'partial', focus_seconds: 30 }, { status: 'partial', focus_seconds: 1500 },
      { started_at: new Date(start).toISOString(), ended_at: new Date(start + 600_000).toISOString() },
      { started_at: new Date(start).toISOString(), ended_at: new Date(start - 1000).toISOString() },
      { preset: 'pomodoro' }, { status: 'abandoned' }, { round_number: 0 }, { subject_label: '   ' },
      { task_id: taskId, task_title: null }, { semester_course_id: courseId, subject_label: null }, { task_title: 'x'.repeat(501) },
    ]) {
      expect((await client.from('focus_sessions').insert(round(userId, bad))).error, JSON.stringify(bad)).not.toBeNull();
    }

    // Deleting the task and the subject keeps the round with its readable copies.
    expect((await client.from('tasks').delete().eq('id', taskId).eq('user_id', userId).select('id')).data).toHaveLength(1);
    expect((await client.from('student_semester_courses').delete().eq('id', courseId).eq('user_id', userId).select('id')).data).toHaveLength(1);
    taskId = ''; courseId = '';
    const kept = await client.from('focus_sessions').select('task_id,task_title,semester_course_id,subject_label,focus_seconds').eq('id', linked.id).single();
    expect(kept.data).toEqual({ task_id: null, task_title: `${tag} task`, semester_course_id: null, subject_label: `${tag} subject`, focus_seconds: 1500 });

    // A signed-out client sees and writes nothing.
    const anon = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await anon.from('focus_sessions').select('id').in('id', ids)).data ?? []).toHaveLength(0);
    expect((await anon.from('focus_sessions').insert(round(userId))).error).not.toBeNull();

    // The owner can delete their own rows.
    expect((await client.from('focus_sessions').delete().eq('id', partial.id).eq('user_id', userId).select('id')).data).toHaveLength(1);
  } finally {
    if (ids.length) await client.from('focus_sessions').delete().in('id', ids).eq('user_id', userId);
    if (taskId) await client.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
    if (courseId) await client.from('student_semester_courses').delete().eq('id', courseId).eq('user_id', userId);
    await client.auth.signOut();
  }
});

test('a round finished in the app is saved to the account once and leaves the device outbox', async ({ page }) => {
  const { client, userId } = await testClient();
  const started = new Date().toISOString();
  await page.addInitScript((userId) => {
    if (sessionStorage.getItem('focus-live-seeded')) return;
    sessionStorage.setItem('focus-live-seeded', '1');
    localStorage.removeItem(`unifyd:focus-session:${userId}`);
    localStorage.removeItem(`unifyd:focus-blocks:${userId}`);
    localStorage.removeItem(`unifyd:focus-reflections:${userId}`);
  }, userId);
  try {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.E2E_TEST_EMAIL!);
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('tab', { name: 'Planner' }).click();
    await page.getByTestId('planner-quick-focus').filter({ visible: true }).click();
    await page.clock.install();
    await page.getByTestId('focus-preset-quick').filter({ visible: true }).click();
    await page.getByTestId('focus-primary').filter({ visible: true }).click();
    await page.clock.fastForward(15 * 60_000 + 1_000);
    await expect(page.getByTestId('focus-phase').filter({ visible: true })).toHaveText('Short break');
    await expect(page.getByTestId('focus-sync').filter({ visible: true })).toContainText('Your focus rounds are synced to your account.');
    const saved = await client.from('focus_sessions').select('id,user_id,status,focus_seconds,planned_focus_seconds,preset').eq('user_id', userId).gte('created_at', started);
    expect(saved.data).toHaveLength(1);
    expect(saved.data![0]).toMatchObject({ user_id: userId, status: 'completed', focus_seconds: 900, planned_focus_seconds: 900, preset: 'quick' });
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), `unifyd:focus-blocks:${userId}`)).toEqual([]);
    // The optional reflection is saved on that same row, once.
    await page.getByTestId('focus-reflect-great').filter({ visible: true }).click();
    await expect.poll(async () => (await client.from('focus_sessions').select('id,reflection').eq('user_id', userId).gte('created_at', started)).data).toEqual([{ id: saved.data![0].id, reflection: 'great' }]);
    await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), `unifyd:focus-reflections:${userId}`)).toEqual([]);
    // Focus insights reads the saved row back from the database (nothing is waiting on the device).
    await page.getByTestId('focus-insights-link').filter({ visible: true }).click();
    await expect(page.getByTestId('focus-today').filter({ visible: true })).toHaveAttribute('aria-label', /^Today, (15 min|\d+ h \d+ min|\d+ min)$/);
    await expect(page.getByTestId('focus-history-row').filter({ visible: true }).first()).toHaveAttribute('aria-label', /^General study, .*, 15 min, Completed$/);
    await expect(page.getByTestId('focus-insights-device')).toHaveCount(0);
  } finally {
    await client.from('focus_sessions').delete().eq('user_id', userId).gte('created_at', started);
    await client.auth.signOut();
  }
});

test('reflections (migration 20261016_002): set once, only on the student’s own completed round, and nothing else can change', async () => {
  const { client, userId } = await testClient();
  const completed = round(userId);
  const partial = round(userId, { status: 'partial', focus_seconds: 600 });
  const spare = round(userId);
  const ids = [completed.id, partial.id, spare.id];
  try {
    for (const row of [completed, partial, spare]) expect((await client.from('focus_sessions').insert(row)).error).toBeNull();
    // The live table has exactly the 15 expected columns, with reflection empty on a new round.
    const all = await client.from('focus_sessions').select('*').eq('id', completed.id).single();
    expect(Object.keys(all.data!).sort()).toEqual(['created_at', 'ended_at', 'focus_seconds', 'id', 'planned_focus_seconds', 'preset', 'reflection', 'round_number',
      'semester_course_id', 'started_at', 'status', 'subject_label', 'task_id', 'task_title', 'user_id']);
    expect(all.data!.reflection).toBeNull();
    const set = await client.from('focus_sessions').update({ reflection: 'great' }).eq('id', completed.id).eq('user_id', userId).is('reflection', null).select('id');
    expect(set.error).toBeNull();
    expect(set.data).toHaveLength(1);
    // A second answer changes nothing, with or without the "still empty" filter.
    expect((await client.from('focus_sessions').update({ reflection: 'tired' }).eq('id', completed.id).is('reflection', null).select('id')).data).toHaveLength(0);
    expect((await client.from('focus_sessions').update({ reflection: 'tired' }).eq('id', completed.id).select('id')).data ?? []).toHaveLength(0);
    expect((await client.from('focus_sessions').select('reflection').eq('id', completed.id).single()).data).toEqual({ reflection: 'great' });
    // Partial rounds take no reflection; values outside the four words, clearing, and every other column are refused.
    expect((await client.from('focus_sessions').update({ reflection: 'okay' }).eq('id', partial.id).select('id')).data ?? []).toHaveLength(0);
    expect((await client.from('focus_sessions').update({ reflection: 'amazing' }).eq('id', spare.id).select('id')).error).not.toBeNull();
    expect((await client.from('focus_sessions').update({ reflection: null }).eq('id', spare.id).select('id')).error).not.toBeNull();
    expect((await client.from('focus_sessions').update({ focus_seconds: 1 }).eq('id', spare.id)).error).not.toBeNull();
    expect((await client.from('focus_sessions').update({ reflection: 'okay', status: 'partial' }).eq('id', spare.id)).error).not.toBeNull();
    // Inserting a reflection directly is not allowed (it is only ever added after the round is saved).
    expect((await client.from('focus_sessions').insert({ ...round(userId), reflection: 'great' })).error).not.toBeNull();
    // A signed-out client cannot add one.
    const anon = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await anon.from('focus_sessions').update({ reflection: 'okay' }).eq('id', spare.id).select('id')).data ?? []).toHaveLength(0);
    expect((await client.from('focus_sessions').select('reflection').eq('id', spare.id).single()).data).toEqual({ reflection: null });
  } finally {
    await client.from('focus_sessions').delete().in('id', ids).eq('user_id', userId);
    await client.auth.signOut();
  }
});
