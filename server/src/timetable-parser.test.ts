import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeTime, parseTimetable } from './timetable-parser.js';
import type { OcrWord } from './timetable-parser.js';

const page = (text: string, words: OcrWord[] = []) => ({ text, words });
const strip = (candidates: ReturnType<typeof parseTimetable>['candidates']) => candidates.map(({ id: _id, ...rest }) => rest);

test('clock times are read as 24-hour values without guessing', () => {
  assert.equal(normalizeTime('8', '00'), '08:00');
  assert.equal(normalizeTime('2', '30', 'PM'), '14:30');
  assert.equal(normalizeTime('12', '00', 'AM'), '00:00');
  assert.equal(normalizeTime('24', '00'), null);
  assert.equal(normalizeTime('10', '75'), null);
  assert.equal(normalizeTime('13', '00', 'PM'), null);
});

test('UMPSA section/day/time rows merge back-to-back slots and skip prerequisite codes', () => {
  const text = [
    'Course Code : BCI1023',
    'Course Name : PROGRAMMING TECHNIQUES',
    'Pre-Requisite : BCI1143,',
    '01 WED 14:00-14:50 BZ-03-083 L 30',
    '15:00-15:50 BZ-03-083 L 30',
    '01A MON 10:00-10:50 BZ-03-083 B 30',
    '11:00-11:50 BZ-03-083 B 30',
  ].join('\n');
  const { candidates, warnings } = parseTimetable([page(text)]);
  assert.deepEqual(strip(candidates), [
    { courseCode: 'BCI1023', courseName: 'PROGRAMMING TECHNIQUES', dayOfWeek: 3, startTime: '14:00', endTime: '15:50', location: 'BZ-03-083', sectionLabel: '01', confidence: 'high' },
    { courseCode: 'BCI1023', courseName: 'PROGRAMMING TECHNIQUES', dayOfWeek: 1, startTime: '10:00', endTime: '11:50', location: 'BZ-03-083', sectionLabel: '01A', confidence: 'high' },
  ]);
  assert.deepEqual(warnings, ['REVIEW_REQUIRED']);
});

test('one-line entries read code, title, day, 12-hour times, and room', () => {
  const { candidates } = parseTimetable([page('BCS2233 SOFTWARE REQUIREMENT WORKSHOP  Monday 10:00 AM - 12:00 PM  BZ-01-120\nUHL2312 Technical English Selasa 2:00-4:00 PM')]);
  assert.deepEqual(strip(candidates), [
    { courseCode: 'BCS2233', courseName: 'SOFTWARE REQUIREMENT WORKSHOP', dayOfWeek: 1, startTime: '10:00', endTime: '12:00', location: 'BZ-01-120', sectionLabel: null, confidence: 'high' },
    { courseCode: 'UHL2312', courseName: 'Technical English', dayOfWeek: 2, startTime: '14:00', endTime: '16:00', location: null, sectionLabel: null, confidence: 'high' },
  ]);
});

test('missing details stay empty and are flagged, never invented', () => {
  const { candidates, warnings } = parseTimetable([page('BCN2113 COMPUTER NETWORKS 08:00-10:00')]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.dayOfWeek, null);
  assert.equal(candidates[0]!.location, null);
  assert.equal(candidates[0]!.confidence, 'low');
  assert.ok(warnings.includes('INCOMPLETE_DETAILS'));

  // Codes and days without any time produce no class at all.
  const none = parseTimetable([page('BCS2233 SOFTWARE REQUIREMENT WORKSHOP\nMONDAY\nBZ-01-120')]);
  assert.deepEqual(none.candidates, []);
  assert.deepEqual(none.warnings, ['REVIEW_REQUIRED', 'NO_CLASSES_FOUND']);
  // An end time earlier than the start time is not a class time.
  assert.deepEqual(parseTimetable([page('BCS2233 MON 11:00-09:00')]).candidates, []);
});

test('grid layouts use day rows and time columns from word positions', () => {
  const word = (text: string, x0: number, y0: number, x1: number, y1: number, block: number): OcrWord => ({ text, x0, y0, x1, y1, block });
  const words: OcrWord[] = [
    ...['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day, index) => word(day, 10, 100 + index * 100, 50, 115 + index * 100, 100 + index)),
    ...['08:00', '09:00', '10:00', '11:00'].map((time, index) => word(time, 100 + index * 100, 40, 140 + index * 100, 55, 200 + index)),
    // Tuesday class block spanning the 08:00 and 09:00 columns.
    word('BCS2233', 110, 195, 190, 207, 7), word('BZ-01-120', 120, 210, 235, 222, 7),
    // Thursday class block in the 11:00 (last) column: its end is not printed.
    word('UHL2312', 405, 395, 470, 407, 8),
  ];
  const { candidates } = parseTimetable([page(words.map((w) => w.text).join('\n'), words)]);
  assert.deepEqual(strip(candidates), [
    { courseCode: 'BCS2233', courseName: null, dayOfWeek: 2, startTime: '08:00', endTime: '10:00', location: 'BZ-01-120', sectionLabel: null, confidence: 'medium' },
    { courseCode: 'UHL2312', courseName: null, dayOfWeek: 4, startTime: '11:00', endTime: null, location: null, sectionLabel: null, confidence: 'low' },
  ]);
});

test('a UMPSA grid split into pieces by OCR becomes whole classes with names, sections, and rooms', () => {
  // Shaped like Vision's output for the UMPSA "Slot/Day" grid: times arrive as "08" ":" "00-08" ":" "50",
  // cells wrap over several lines, rooms break at hyphens, and block numbers mix neighbouring cells.
  const words: OcrWord[] = [];
  const add = (text: string, x0: number, y0: number, block = 0) => words.push({ text, x0, y0, x1: x0 + text.length * 5, y1: y0 + 10, block });
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((day, index) => add(day, 160 + index * 140, 15));
  const rowTop: Record<string, number> = { '07': 40, '08': 62, '09': 146, '10': 231, '11': 316, '12': 401 };
  for (const [hour, y] of Object.entries(rowTop)) {
    add(hour, 19, y); add(':', 32, y); add(`00-${hour}`, 36, y); add(':', 64, y); add('50', 69, y);
  }
  const cell = (x: number, top: number, lines: string[][]) => lines.forEach((line, row) => {
    let left = x;
    for (const token of line) { add(token, left, top + row * 15, 99); left += token.length * 5 + 2; }
  });
  // Tuesday 08:00 and 09:00 hold the same lab section: one class from 08:00 to 09:50.
  for (const top of [62, 146]) cell(240, top, [['BCS3453', '(', 'INTEGRATED'], ['APPLICATION'], ['DEVELOPMENT'], ['FRAMEWORK', ')', '/', '01B', '/', '(', 'B', ')', '/', 'BZ-'], ['01-100']]);
  // Friday 10:00 and 11:00: a lecture whose room is split as "BZ - 01-" then "085".
  for (const top of [231, 316]) cell(670, top, [['BCC3024', '('], ['UNDERGRADUATE'], ['PROJECT', 'II', ')', '/', '01', '/', '(', 'L', ')', '/'], ['BZ', '-', '01-'], ['085']]);
  const { candidates, warnings } = parseTimetable([page('', words)]);
  assert.deepEqual(strip(candidates), [
    { courseCode: 'BCS3453', courseName: 'INTEGRATED APPLICATION DEVELOPMENT FRAMEWORK', dayOfWeek: 2, startTime: '08:00', endTime: '09:50', location: 'BZ-01-100', sectionLabel: '01B', confidence: 'high' },
    { courseCode: 'BCC3024', courseName: 'UNDERGRADUATE PROJECT II', dayOfWeek: 5, startTime: '10:00', endTime: '11:50', location: 'BZ-01-085', sectionLabel: '01', confidence: 'high' },
  ]);
  assert.deepEqual(warnings, ['REVIEW_REQUIRED']);
});

test('the same class read on two pages is listed once with temporary IDs', () => {
  const text = 'BCS2233 MON 10:00-12:00 BZ-01-120';
  const { candidates } = parseTimetable([page(text), page(text)]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.id, 'c1');
});
