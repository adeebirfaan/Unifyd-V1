// Personal weekly timetable rules (Module 7, Phase 3). Pure functions only, so the
// clash, next-class, validation, and matching rules can be unit-tested in Node.

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const; // 1 = Monday ... 7 = Sunday
export type EntrySource = 'manual' | 'timetable_import';

export type TimetableEntry = {
  id: string;
  academic_session: string;
  semester: 1 | 2;
  student_semester_course_id: string | null;
  course_code: string | null;
  course_name: string;
  day_of_week: number;
  start_time: string; // 'HH:MM' or 'HH:MM:SS' from Postgres
  end_time: string;
  location: string | null;
  section_label: string | null;
  entry_source: EntrySource;
};

export type SemesterSubject = { id: string; course_code: string | null; course_name: string };

/** An editable class before it is saved (manual form or an import review card). */
export type ClassDraft = {
  key: string;
  subjectId: string | null;
  suggestedSubjectId: string | null;
  courseCode: string;
  courseName: string;
  day: number | null;
  start: string | null; // 'HH:MM'
  end: string | null;
  location: string;
  section: string;
  source: EntrySource;
  confidence: 'high' | 'medium' | 'low' | null;
};

export type ImportCandidate = {
  id: string;
  courseCode: string | null;
  courseName: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  sectionLabel: string | null;
  confidence: 'high' | 'medium' | 'low';
};

/** Minutes since midnight for 'H:MM', 'HH:MM', 'HH.MM', or Postgres 'HH:MM:SS'; null when invalid. */
export function toMinutes(time: string | null | undefined): number | null {
  const match = /^(\d{1,2})[:.](\d{2})(?::\d{2})?$/.exec((time ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export const shortTime = (time: string) => time.slice(0, 5);

/** The canonical 'HH:MM' form of a valid time, or null. */
export function canonicalTime(time: string | null | undefined): string | null {
  const minutes = toMinutes(time);
  return minutes === null ? null : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export const normalizeCode = (code: string | null | undefined) => (code ?? '').replace(/\s+/g, '').toUpperCase();

/** A My Semester subject is suggested only when its course code matches exactly (ignoring case and spaces). */
export function suggestSubject(code: string | null, subjects: readonly SemesterSubject[]): SemesterSubject | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return subjects.find((subject) => normalizeCode(subject.course_code) === normalized) ?? null;
}

export function draftFromCandidate(candidate: ImportCandidate, subjects: readonly SemesterSubject[]): ClassDraft {
  return {
    key: `import-${candidate.id}`,
    // A match is only suggested; the student must choose to link it.
    subjectId: null,
    suggestedSubjectId: suggestSubject(candidate.courseCode, subjects)?.id ?? null,
    courseCode: candidate.courseCode ?? '',
    courseName: candidate.courseName ?? '',
    day: candidate.dayOfWeek && candidate.dayOfWeek >= 1 && candidate.dayOfWeek <= 7 ? candidate.dayOfWeek : null,
    start: canonicalTime(candidate.startTime),
    end: canonicalTime(candidate.endTime),
    location: candidate.location ?? '',
    section: candidate.sectionLabel ?? '',
    source: 'timetable_import',
    confidence: candidate.confidence,
  };
}

export function emptyDraft(key: string, source: EntrySource = 'manual'): ClassDraft {
  return { key, subjectId: null, suggestedSubjectId: null, courseCode: '', courseName: '', day: null, start: null, end: null, location: '', section: '', source, confidence: null };
}

export function draftFromEntry(entry: TimetableEntry): ClassDraft {
  return {
    key: entry.id, subjectId: entry.student_semester_course_id, suggestedSubjectId: null,
    courseCode: entry.course_code ?? '', courseName: entry.course_name, day: entry.day_of_week,
    start: shortTime(entry.start_time), end: shortTime(entry.end_time),
    location: entry.location ?? '', section: entry.section_label ?? '', source: entry.entry_source, confidence: null,
  };
}

export type DraftError = 'courseName' | 'day' | 'start' | 'end' | 'order';

export function validateDraft(draft: ClassDraft): DraftError[] {
  const errors: DraftError[] = [];
  if (!draft.courseName.trim()) errors.push('courseName');
  if (!draft.day) errors.push('day');
  const start = toMinutes(draft.start);
  const end = toMinutes(draft.end);
  if (start === null) errors.push('start');
  if (end === null) errors.push('end');
  if (start !== null && end !== null && end <= start) errors.push('order');
  return errors;
}

export const isComplete = (draft: ClassDraft) => validateDraft(draft).length === 0;

/**
 * The import-review drafts to save: only complete ones the student has not left out.
 * An incomplete or left-out draft never blocks saving the others; a partial timetable is valid.
 */
export function draftsToSave(drafts: readonly ClassDraft[], leftOut: ReadonlySet<string>): ClassDraft[] {
  return drafts.filter((draft) => !leftOut.has(draft.key) && isComplete(draft));
}

/** The row to insert: trimmed snapshot values, blanks stored as null. Ownership comes from the session. */
export function draftToRow(draft: ClassDraft, userId: string, academicSession: string, semester: 1 | 2) {
  const optional = (value: string) => value.trim() || null;
  return {
    user_id: userId, academic_session: academicSession.trim(), semester,
    student_semester_course_id: draft.subjectId,
    course_code: optional(normalizeCode(draft.courseCode)), course_name: draft.courseName.trim(),
    day_of_week: draft.day!, start_time: canonicalTime(draft.start)!, end_time: canonicalTime(draft.end)!,
    location: optional(draft.location), section_label: optional(draft.section),
    entry_source: draft.source,
  };
}

export type ClashSlot = { key: string; label: string; day: number | null; start: string | null; end: string | null };

/**
 * Two classes clash when they are on the same day and their times overlap.
 * Touching times (09:00–10:00 and 10:00–11:00) do not clash. Incomplete
 * entries are skipped. This only reports clashes; nothing is changed.
 */
export function findClashes(slots: readonly ClashSlot[]): [ClashSlot, ClashSlot][] {
  const clashes: [ClashSlot, ClashSlot][] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      const [aStart, aEnd, bStart, bEnd] = [toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end)];
      if (!a.day || a.day !== b.day || aStart === null || aEnd === null || bStart === null || bEnd === null) continue;
      if (aStart < bEnd && bStart < aEnd) clashes.push([a, b]);
    }
  }
  return clashes;
}

export const entrySlot = (entry: TimetableEntry): ClashSlot => ({
  key: entry.id, label: entry.course_code ?? entry.course_name, day: entry.day_of_week, start: entry.start_time, end: entry.end_time,
});

/** Monday = 1 ... Sunday = 7 for a device-local date. */
export const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1;

/**
 * The next class to start after `now`, using only saved entries and the device's
 * local time. `daysAhead` is 0 for today, 1 for tomorrow, up to 7 (same weekday next week).
 */
export function nextClass(entries: readonly TimetableEntry[], now = new Date()): { entry: TimetableEntry; daysAhead: number } | null {
  const today = isoWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best: { entry: TimetableEntry; daysAhead: number; start: number } | null = null;
  for (const entry of entries) {
    const start = toMinutes(entry.start_time);
    if (start === null || entry.day_of_week < 1 || entry.day_of_week > 7) continue;
    let daysAhead = (entry.day_of_week - today + 7) % 7;
    if (daysAhead === 0 && start <= nowMinutes) daysAhead = 7;
    if (!best || daysAhead < best.daysAhead || (daysAhead === best.daysAhead && start < best.start)) best = { entry, daysAhead, start };
  }
  return best && { entry: best.entry, daysAhead: best.daysAhead };
}

export function sortEntries(entries: readonly TimetableEntry[]): TimetableEntry[] {
  return [...entries].sort((a, b) => a.day_of_week - b.day_of_week || (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0) || a.id.localeCompare(b.id));
}
