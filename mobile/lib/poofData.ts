import type { Profile } from '@/providers/AuthProvider';
import { buildPoofFacts, poofPeriods } from '@/lib/poofFacts';
import type { PoofBudgetRow, PoofClassRow, PoofExpenseRow, PoofFacts, PoofMoodRow, PoofSemesterRows, PoofTaskRow } from '@/lib/poofFacts';
import { readSemesterChoice } from '@/lib/semesterCourses';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 500;

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;

async function readAll<T>(page: Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

async function loadSemester(userId: string): Promise<PoofSemesterRows> {
  const choice = await readSemesterChoice(userId);
  if (!choice) return null;
  const [subjects, classes] = await Promise.all([
    supabase.from('student_semester_courses').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('academic_session', choice.academicSession).eq('semester', choice.semester),
    readAll<PoofClassRow>((from, to) => supabase.from('timetable_entries').select('course_code,course_name,day_of_week,start_time,end_time,location')
      .eq('user_id', userId).eq('academic_session', choice.academicSession).eq('semester', choice.semester).order('id').range(from, to)),
  ]);
  if (subjects.error) throw subjects.error;
  return { subjects: subjects.count ?? 0, classes };
}

/**
 * Reads only the signed-in student's own rows for Poof. Every query filters by
 * their user ID and Supabase Row Level Security remains the boundary. Read-only:
 * Poof never inserts, updates, or deletes anything.
 */
export async function loadPoofFacts(userId: string, profile: Profile | null, now = new Date()): Promise<PoofFacts> {
  const periods = poofPeriods(now);
  const from = periods.week.start < periods.month.start ? periods.week.start : periods.month.start;
  const to = periods.week.end > periods.month.end ? periods.week.end : periods.month.end;
  const [budgets, expenses, tasks, completed, moods, semester] = await Promise.all([
    supabase.from('budgets').select('amount,period_type,period_start').eq('user_id', userId).in('period_start', [periods.week.start, periods.month.start]),
    readAll<PoofExpenseRow>((start, end) => supabase.from('expenses').select('amount,category,expense_date')
      .eq('user_id', userId).gte('expense_date', from).lte('expense_date', to).order('id').range(start, end)),
    readAll<PoofTaskRow>((start, end) => supabase.from('tasks').select('title,subject,deadline,priority,status')
      .eq('user_id', userId).neq('status', 'completed').order('id').range(start, end)),
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'completed').gte('completed_at', periods.recentlyCompletedSince.toISOString()),
    readAll<PoofMoodRow>((start, end) => supabase.from('mood_entries').select('mood_level,stress_level,recorded_at')
      .eq('user_id', userId).gte('recorded_at', periods.moodSince.toISOString()).order('id').range(start, end)),
    loadSemester(userId),
  ]);
  if (budgets.error) throw budgets.error;
  if (completed.error) throw completed.error;
  return buildPoofFacts({
    profile,
    budgets: (budgets.data ?? []) as PoofBudgetRow[],
    expenses,
    tasks,
    completedRecently: completed.count ?? 0,
    moods,
    semester,
  }, now);
}
