import { supabase } from '@/lib/supabase';
import type { SemesterChoice } from '@/lib/semesterCourses';
import { sortEntries } from '@/lib/timetable';
import type { TimetableEntry } from '@/lib/timetable';

const PAGE_SIZE = 500;
export const TIMETABLE_COLUMNS = 'id,academic_session,semester,student_semester_course_id,course_code,course_name,day_of_week,start_time,end_time,location,section_label,entry_source';

/** The signed-in student's saved classes for one session and semester, in day and time order. */
export async function loadTimetableEntries(userId: string, choice: SemesterChoice): Promise<TimetableEntry[]> {
  const entries: TimetableEntry[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('timetable_entries').select(TIMETABLE_COLUMNS)
      .eq('user_id', userId).eq('academic_session', choice.academicSession).eq('semester', choice.semester)
      .order('day_of_week').order('start_time').order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    entries.push(...(data ?? []) as TimetableEntry[]);
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return sortEntries(entries);
}
