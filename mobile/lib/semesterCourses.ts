import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type Semester = 1 | 2;
export type SemesterChoice = { academicSession: string; semester: Semester };
export type CatalogCourse = {
  id: string;
  academic_session: string;
  semester: Semester;
  faculty_code: string;
  campus: string | null;
  course_code: string;
  course_name: string;
  credit_hours: number | null;
};
export type StudentSemesterCourse = {
  id: string;
  user_id: string;
  academic_session: string;
  semester: Semester;
  catalog_course_id: string | null;
  course_code: string | null;
  course_name: string;
  credit_hours: number | null;
  is_custom: boolean;
  created_at: string;
};

const PAGE_SIZE = 500;
const storageKey = (userId: string) => `unifyd:semester-choice:${userId}`;

export function isAcademicSession(value: string): boolean {
  const match = /^(\d{4})\/(\d{4})$/.exec(value.trim());
  return !!match && Number(match[2]) === Number(match[1]) + 1;
}

export async function readSemesterChoice(userId: string): Promise<SemesterChoice | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || !value) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.academicSession !== 'string' || !isAcademicSession(record.academicSession) || (record.semester !== 1 && record.semester !== 2)) return null;
    return { academicSession: record.academicSession, semester: record.semester };
  } catch { return null; }
}

export async function writeSemesterChoice(userId: string, choice: SemesterChoice): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(choice));
}

export async function loadCatalogSessions(): Promise<string[]> {
  const sessions = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('catalog_courses').select('academic_session')
      .eq('is_active', true).eq('faculty_code', 'FK').order('academic_session', { ascending: false }).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) sessions.add(row.academic_session);
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return [...sessions].sort((a, b) => b.localeCompare(a));
}

export async function loadCatalogCourses(choice: SemesterChoice): Promise<CatalogCourse[]> {
  const courses: CatalogCourse[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('catalog_courses')
      .select('id,academic_session,semester,faculty_code,campus,course_code,course_name,credit_hours')
      .eq('is_active', true).eq('faculty_code', 'FK').eq('academic_session', choice.academicSession).eq('semester', choice.semester)
      .order('course_code').order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    courses.push(...(data ?? []) as CatalogCourse[]);
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return courses;
}

export async function loadStudentCourses(userId: string, choice: SemesterChoice): Promise<StudentSemesterCourse[]> {
  const courses: StudentSemesterCourse[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('student_semester_courses')
      .select('id,user_id,academic_session,semester,catalog_course_id,course_code,course_name,credit_hours,is_custom,created_at')
      .eq('user_id', userId).eq('academic_session', choice.academicSession).eq('semester', choice.semester)
      .order('created_at', { ascending: true }).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    courses.push(...(data ?? []) as StudentSemesterCourse[]);
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return courses;
}

export function parseCreditHours(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[1-9]\d*$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed <= 32767 ? parsed : undefined;
}

export function creditSummary(courses: Pick<StudentSemesterCourse, 'credit_hours'>[]) {
  return {
    knownTotal: courses.reduce((sum, course) => sum + (course.credit_hours ?? 0), 0),
    unknownCount: courses.filter((course) => course.credit_hours === null).length,
  };
}

export function taskSubject(course: Pick<StudentSemesterCourse, 'course_code' | 'course_name'>): string {
  return course.course_code ? `${course.course_code} — ${course.course_name}` : course.course_name;
}
