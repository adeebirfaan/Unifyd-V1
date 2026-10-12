import assert from 'node:assert/strict';
import test from 'node:test';

import { draftFromCandidate, draftsToSave, draftToRow, emptyDraft, findClashes, nextClass, suggestSubject, toMinutes, validateDraft } from '../lib/timetable.ts';

const slot = (key, day, start, end) => ({ key, label: key, day, start, end });
const entry = (id, day, start, end, code = id) => ({
  id, academic_session: '2026/2027', semester: 1, student_semester_course_id: null, course_code: code, course_name: `Course ${id}`,
  day_of_week: day, start_time: `${start}:00`, end_time: `${end}:00`, location: null, section_label: null, entry_source: 'manual',
});

test('overlapping classes on the same day clash; touching times and other days do not', () => {
  assert.deepEqual(findClashes([slot('A', 1, '09:00', '11:00'), slot('B', 1, '10:00', '12:00')]).map(([a, b]) => [a.key, b.key]), [['A', 'B']]);
  assert.deepEqual(findClashes([slot('A', 1, '09:00', '10:00'), slot('B', 1, '10:00', '11:00')]), []);
  assert.deepEqual(findClashes([slot('A', 1, '09:00', '11:00'), slot('B', 2, '10:00', '12:00')]), []);
  assert.deepEqual(findClashes([slot('A', 1, '09:00', '12:00'), slot('B', 1, '10:00', '11:00')]).length, 1, 'contained class');
  assert.deepEqual(findClashes([slot('A', null, '09:00', '11:00'), slot('B', 1, '10:00', null)]), [], 'incomplete drafts are skipped');
});

test('next class uses local time and only saved entries, wrapping to next week', () => {
  const wednesday10am = new Date(2026, 9, 7, 10, 0); // 7 Oct 2026 is a Wednesday
  const entries = [entry('MON', 1, '08:00', '10:00'), entry('WEDEARLY', 3, '08:00', '09:00'), entry('WEDLATE', 3, '14:00', '16:00'), entry('FRI', 5, '09:00', '10:00')];
  assert.deepEqual(nextClass(entries, wednesday10am), { entry: entries[2], daysAhead: 0 });
  const wednesdayEvening = new Date(2026, 9, 7, 18, 0);
  assert.equal(nextClass(entries, wednesdayEvening).entry.id, 'FRI');
  assert.equal(nextClass(entries, wednesdayEvening).daysAhead, 2);
  // A class starting exactly now is not "next"; the same class next week is.
  const onlyNow = [entry('NOW', 3, '10:00', '11:00')];
  assert.deepEqual(nextClass(onlyNow, wednesday10am), { entry: onlyNow[0], daysAhead: 7 });
  assert.equal(nextClass([], wednesday10am), null);
});

test('incomplete imported classes need correction before saving', () => {
  const draft = draftFromCandidate({ id: 'c1', courseCode: 'BCN2113', courseName: null, dayOfWeek: null, startTime: '08:00', endTime: null, location: null, sectionLabel: null, confidence: 'low' }, []);
  assert.deepEqual(validateDraft(draft), ['courseName', 'day', 'end']);
  assert.deepEqual(validateDraft({ ...emptyDraft('x'), courseName: 'Lab', day: 2, start: '11:00', end: '10:00' }), ['order']);
  assert.deepEqual(validateDraft({ ...emptyDraft('x'), courseName: 'Lab', day: 2, start: '10:00', end: '11:00' }), []);
  assert.equal(toMinutes('25:00'), null);
  assert.equal(toMinutes('8.30'), 510);
  assert.deepEqual(validateDraft({ ...emptyDraft('x'), courseName: 'Lab', day: 2, start: '9:00', end: 'later' }), ['end']);
});

test('My Semester subjects are suggested only on an exact code match and never linked automatically', () => {
  const subjects = [{ id: 's1', course_code: 'BCS2233', course_name: 'Software Requirement Workshop' }, { id: 's2', course_code: null, course_name: 'Custom' }];
  assert.equal(suggestSubject('bcs 2233', subjects)?.id, 's1');
  assert.equal(suggestSubject('BCS223', subjects), null);
  assert.equal(suggestSubject(null, subjects), null);
  const draft = draftFromCandidate({ id: 'c2', courseCode: 'BCS2233', courseName: 'SRW', dayOfWeek: 1, startTime: '10:00', endTime: '12:00', location: 'BZ-01-120', sectionLabel: '01', confidence: 'high' }, subjects);
  assert.equal(draft.suggestedSubjectId, 's1');
  assert.equal(draft.subjectId, null);
  assert.equal(draft.source, 'timetable_import');
});

test('saved rows contain trimmed snapshots, nulls for blanks, and the draft source', () => {
  const row = draftToRow({ ...emptyDraft('k'), courseCode: ' bcs 2233 ', courseName: '  Workshop ', day: 1, start: '9.00', end: '12:00', location: '  ', section: ' 01 ' }, 'user-1', ' 2026/2027 ', 2);
  assert.deepEqual(row, {
    user_id: 'user-1', academic_session: '2026/2027', semester: 2, student_semester_course_id: null, course_code: 'BCS2233', course_name: 'Workshop',
    day_of_week: 1, start_time: '09:00', end_time: '12:00', location: null, section_label: '01', entry_source: 'manual',
  });
});

test('a partial import is valid: incomplete or left-out classes never block saving the confirmed ones', () => {
  const complete = (key, day) => ({ ...emptyDraft(key, 'timetable_import'), courseName: `Class ${key}`, day, start: '08:00', end: '09:50' });
  // OCR found five possible classes: three accurate, one wrong (removed), one incomplete (left unsaved).
  const drafts = [complete('a', 2), complete('b', 4), complete('c', 5), { ...emptyDraft('d', 'timetable_import'), courseName: 'BCN3243', start: '16:00' }];
  assert.deepEqual(draftsToSave(drafts, new Set()).map((draft) => draft.key), ['a', 'b', 'c']);
  // The student can also leave out a complete class.
  assert.deepEqual(draftsToSave(drafts, new Set(['b'])).map((draft) => draft.key), ['a', 'c']);
  // Saving nothing, or a single class, is allowed; no day needs a class.
  assert.deepEqual(draftsToSave([], new Set()), []);
  assert.deepEqual(draftsToSave([complete('only', 1)], new Set()).length, 1);
  assert.equal(nextClass([]), null);
});
