// Deterministic timetable parsing. Google Vision only supplies text and word
// positions; every value below must be read from that text. Nothing is guessed:
// missing details stay null for the student to complete during review.

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number; block: number };
export type OcrPage = { text: string; words: OcrWord[] };

export type TimetableCandidate = {
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

const DAY_WORDS: Record<string, number> = {
  MON: 1, MONDAY: 1, ISNIN: 1,
  TUE: 2, TUES: 2, TUESDAY: 2, SELASA: 2,
  WED: 3, WEDNESDAY: 3, RABU: 3,
  THU: 4, THUR: 4, THURS: 4, THURSDAY: 4, KHAMIS: 4,
  FRI: 5, FRIDAY: 5, JUMAAT: 5,
  SAT: 6, SATURDAY: 6, SABTU: 6,
  SUN: 7, SUNDAY: 7, AHAD: 7,
};
const DAY_PATTERN = new RegExp(`\\b(${Object.keys(DAY_WORDS).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i');
const TIME = String.raw`(\d{1,2})[:.](\d{2})\s*(AM|PM|A\.M\.|P\.M\.)?`;
const RANGE_PATTERN = new RegExp(`${TIME}\\s*(?:-|–|—|to|hingga|until)\\s*${TIME}`, 'gi');
const SINGLE_TIME_PATTERN = new RegExp(`^${TIME}$`, 'i');
const CODE_PATTERN = /\b([A-Z]{2,4})\s?(\d{4})\b/;
// Room codes such as BZ-01-120, W-DK-05, Z01-0003, or FKASA11A; never a course code.
const LOCATION_PATTERN = /\b(?:[A-Z][A-Z0-9]{0,5}(?:-[A-Z0-9]{1,6}){1,3}|[A-Z]{4,6}\d{1,3}[A-Z]?)\b/;
const SECTION_AT_START = /^\s*(\d{1,2}[A-Z]{0,2})\s+(?=[A-Z]{3})/;
const SECTION_LABELLED = /\b(?:SEC(?:TION)?|SEKSYEN|KUMPULAN|GROUP)\s*[:.]?\s*([0-9]{1,2}[A-Z]{0,2})\b/i;
// Lines that mention codes which are not the class itself (for example prerequisites).
const IGNORED_CODE_LINE = /PRE-?REQ|PRASYARAT|EXAM|PEPERIKSAAN/i;
// A course title given with an explicit label, e.g. "Course Name : Programming Techniques".
const LABELLED_NAME = /\b(?:COURSE|SUBJECT)\s*(?:NAME|TITLE)\s*:\s*(.+)$|\bNAMA\s*(?:KURSUS|SUBJEK)\s*:\s*(.+)$/i;

const pad = (value: number) => String(value).padStart(2, '0');

/** Reads one written time as 24-hour HH:MM, or null when it is not a valid clock time. */
export function normalizeTime(hours: string, minutes: string, meridiem?: string): string | null {
  let h = Number(hours);
  const m = Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || m > 59) return null;
  const marker = meridiem?.replace(/\./g, '').toUpperCase();
  if (marker) {
    if (h < 1 || h > 12) return null;
    if (marker === 'PM' && h !== 12) h += 12;
    if (marker === 'AM' && h === 12) h = 0;
  }
  return h > 23 ? null : `${pad(h)}:${pad(m)}`;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

function timeRanges(line: string): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  for (const match of line.matchAll(RANGE_PATTERN)) {
    // A meridiem written only after the end time applies to both ("10:00-11:30 AM").
    const start = normalizeTime(match[1]!, match[2]!, match[3] ?? match[6]);
    const end = normalizeTime(match[4]!, match[5]!, match[6]);
    if (start && end && minutesOf(end) > minutesOf(start)) ranges.push({ start, end });
  }
  return ranges;
}

const dayOf = (text: string): number | null => {
  const match = DAY_PATTERN.exec(text);
  return match ? DAY_WORDS[match[1]!.toUpperCase()] ?? null : null;
};
const codeOf = (text: string): string | null => {
  const match = CODE_PATTERN.exec(text.toUpperCase());
  return match ? `${match[1]}${match[2]}` : null;
};
const locationOf = (text: string): string | null => {
  const upper = text.toUpperCase().replace(RANGE_PATTERN, ' ');
  const match = LOCATION_PATTERN.exec(upper);
  return match && !CODE_PATTERN.test(match[0]) ? match[0] : null;
};
const sectionOf = (text: string): string | null =>
  (SECTION_LABELLED.exec(text) ?? SECTION_AT_START.exec(text.toUpperCase()))?.[1]?.toUpperCase() ?? null;

/** The course title printed after a course code on the same line, if any. */
function nameAfterCode(line: string, code: string): string | null {
  const upper = line.toUpperCase();
  const at = upper.search(new RegExp(`${code.slice(0, -4)}\\s?${code.slice(-4)}`));
  if (at < 0) return null;
  let rest = line.slice(at).replace(CODE_PATTERN, '').replace(/^[\s:–—-]+/, '');
  const stop = rest.search(new RegExp(`${DAY_PATTERN.source}|\\d{1,2}[:.]\\d{2}|\\(`, 'i'));
  if (stop >= 0) rest = rest.slice(0, stop);
  const name = rest.replace(/\s+/g, ' ').trim().replace(/[,;:]+$/, '');
  return /[A-Za-z]{3,}/.test(name) && name.length >= 3 ? name : null;
}

function confidenceOf(candidate: Omit<TimetableCandidate, 'id' | 'confidence'>, layoutDerived: boolean): TimetableCandidate['confidence'] {
  if (!candidate.dayOfWeek || !candidate.startTime || !candidate.endTime) return 'low';
  if (!candidate.courseCode && !candidate.courseName) return 'low';
  return layoutDerived || !candidate.courseCode ? 'medium' : 'high';
}

type Draft = Omit<TimetableCandidate, 'id' | 'confidence'> & { layoutDerived: boolean };

/** List layouts: each time range on a line becomes a class for the latest course code and day. */
function parseLines(text: string): Draft[] {
  const drafts: Draft[] = [];
  let code: string | null = null;
  let name: string | null = null;
  let day: number | null = null;
  let section: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const lineCode = IGNORED_CODE_LINE.test(line) ? null : codeOf(line);
    const labelledName = LABELLED_NAME.exec(line);
    if (lineCode) {
      code = lineCode;
      name = nameAfterCode(line, lineCode);
      day = null;
      section = null;
    } else if (code && labelledName) {
      // Keep only the title, not any table columns printed after a wide gap.
      name = (labelledName[1] ?? labelledName[2])!.trim().replace(/\s{2,}.*$/, '') || name;
    } else if (!name && code && /^[A-Z][A-Z &,/()-]{6,}$/.test(line.trim()) && !DAY_PATTERN.test(line) && !LOCATION_PATTERN.test(line.toUpperCase())) {
      // A course title printed on its own line directly after the code.
      name = line.trim();
    }
    const lineDay = dayOf(line);
    const lineSection = sectionOf(line);
    if (lineDay) day = lineDay;
    // A row that starts a new day or section sets it; a bare continuation row keeps the previous one.
    if (lineDay || lineSection) section = lineSection;
    for (const range of timeRanges(line)) {
      drafts.push({
        courseCode: code, courseName: name, dayOfWeek: lineDay ?? day, startTime: range.start, endTime: range.end,
        location: locationOf(line), sectionLabel: section, layoutDerived: false,
      });
    }
  }
  return drafts;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const centerX = (box: Box) => (box.x0 + box.x1) / 2;
const centerY = (box: Box) => (box.y0 + box.y1) / 2;
const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
const boxOf = (boxes: Box[]): Box => ({ x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) });
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

// Vision splits "07:00-07:50" or "BZ-01-100" into pieces such as "07" ":" "00-07"; these
// characters join their neighbours without a space, while ordinary words keep one.
const JOINS_TIGHT = /^[:\-/()]/;
function joinTokens(tokens: string[]): string {
  return tokens.reduce((text, token) => (!text ? token : JOINS_TIGHT.test(token) || /[:\-/(]$/.test(text) ? text + token : `${text} ${token}`), '');
}

/** Words grouped into visual text lines (same height, close together), left to right. */
function textLines(words: OcrWord[], height: number): (Box & { text: string; words: OcrWord[] })[] {
  const lines: OcrWord[][] = [];
  for (const word of [...words].sort((a, b) => a.x0 - b.x0)) {
    const line = lines.find((candidate) => {
      const last = candidate[candidate.length - 1]!;
      return Math.abs(centerY(last) - centerY(word)) < height * 0.6 && word.x0 - last.x1 < height * 2;
    });
    if (line) line.push(word); else lines.push([word]);
  }
  return lines.map((line) => ({ ...boxOf(line), text: joinTokens(line.map((word) => word.text)), words: line }))
    .sort((a, b) => centerY(a) - centerY(b) || a.x0 - b.x0);
}

/** Time labels on the page, such as "08:00-08:50", "08:00 - 08:50", or a start time alone. */
function timeSlots(lines: (Box & { text: string })[]): (Box & { start: string; end: string | null })[] {
  const slots: (Box & { start: string; end: string | null })[] = [];
  for (const line of lines) {
    const range = timeRanges(line.text)[0];
    if (range) { slots.push({ ...line, start: range.start, end: range.end }); continue; }
    const single = SINGLE_TIME_PATTERN.exec(line.text.trim());
    const time = single && normalizeTime(single[1]!, single[2]!, single[3]);
    if (time) slots.push({ ...line, start: time, end: null });
  }
  return slots;
}

// UMPSA's grid cell format: CODE(COURSE NAME)/SECTION/(TYPE)/ROOM, e.g. BCS3153(SOFTWARE EVOLUTION & MAINTENANCE)/01A/(B)/BZ-04-068.
const UMPSA_CELL = /^([A-Z]{2,4}\d{4})\(([^)]+)\)\/([0-9]{1,2}[A-Z]{0,2})\/\(([A-Z])\)\/([A-Z0-9-]+)$/;

/** One timetable cell's text: lines in reading order, hyphenated room codes rejoined. */
function cellText(words: OcrWord[], height: number): string {
  const lines = textLines(words, height).map((line) => line.text);
  return joinTokens(lines).replace(/\s*([()/])\s*/g, '$1').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
}

function readCell(text: string): Omit<Draft, 'dayOfWeek' | 'startTime' | 'endTime' | 'layoutDerived'> & { structured: boolean } | null {
  const upper = text.toUpperCase();
  const umpsa = UMPSA_CELL.exec(upper.replace(/\s+(?=[(/)])|(?<=[(/)])\s+/g, ''));
  if (umpsa) {
    // The name keeps its own spacing from the original text.
    const name = /\(([^)]+)\)/.exec(text)?.[1]?.trim() ?? umpsa[2]!;
    return { courseCode: umpsa[1]!, courseName: name, sectionLabel: umpsa[3]!, location: umpsa[5]!, structured: true };
  }
  const code = codeOf(text);
  if (!code || IGNORED_CODE_LINE.test(text)) return null;
  const bracketed = new RegExp(`${code.slice(0, -4)}\\s?${code.slice(-4)}\\s*\\(([^)]{3,})\\)`, 'i').exec(text)?.[1]?.trim();
  return { courseCode: code, courseName: bracketed ?? nameAfterCode(text, code), location: locationOf(text), sectionLabel: sectionOf(text), structured: false };
}

/**
 * Grid layouts: day labels along one edge and time slots along the other. Words are
 * placed in the nearest day column (or row), stacked into cells by the gaps between
 * them, and each cell takes the time slots whose labels it spans. Vision's own text
 * blocks are not used because they often mix neighbouring cells.
 */
function parseGrid(page: OcrPage): Draft[] {
  if (!page.words.length) return [];
  const height = median(page.words.map((word) => word.y1 - word.y0)) || 1;
  const lines = textLines(page.words, height);
  const dayLabels = page.words
    .filter((word) => /^[A-Za-z]+$/.test(word.text) && DAY_WORDS[word.text.toUpperCase()] !== undefined)
    .map((word) => ({ ...word, day: DAY_WORDS[word.text.toUpperCase()]! }));
  const uniqueDays = new Set(dayLabels.map((label) => label.day));
  const slots = timeSlots(lines);
  if (uniqueDays.size < 3 || slots.length < 2) return [];

  const daysInRows = spread(dayLabels.map(centerY)) > spread(dayLabels.map(centerX));
  const dayAxis = (box: Box) => (daysInRows ? centerY(box) : centerX(box));
  const timeStart = (box: Box) => (daysInRows ? box.x0 : box.y0);
  const timeEnd = (box: Box) => (daysInRows ? box.x1 : box.y1);
  const timeCenter = (box: Box) => (daysInRows ? centerX(box) : centerY(box));

  const ordered = [...slots].sort((a, b) => timeCenter(a) - timeCenter(b));
  const slotEnd = (index: number) => {
    const slot = ordered[index]!;
    const next = ordered[index + 1];
    // A header showing only a start time ends where the next header starts; the last one stays open.
    return slot.end ?? (next && minutesOf(next.start) > minutesOf(slot.start) ? next.start : null);
  };
  const dayPitch = uniqueDays.size > 1 ? spread(dayLabels.map(dayAxis)) / (uniqueDays.size - 1) : Infinity;

  // Words that are labels themselves are not cell content.
  const labelWords = new Set<OcrWord>([...dayLabels.map((label) => page.words.find((word) => word.x0 === label.x0 && word.y0 === label.y0 && word.text === label.text)!),
    ...lines.filter((line) => slots.some((slot) => slot.x0 === line.x0 && slot.y0 === line.y0)).flatMap((line) => line.words)]);
  // Each word goes to the nearest day column (cell text stays inside its column), and
  // lines are then built within one column only, so neighbouring cells never join.
  const columnWords = new Map<number, OcrWord[]>();
  for (const word of page.words) {
    if (labelWords.has(word)) continue;
    const nearest = dayLabels.reduce<{ day: number; distance: number } | null>((best, label) => {
      const distance = Math.abs(dayAxis(label) - dayAxis(word));
      return !best || distance < best.distance ? { day: label.day, distance } : best;
    }, null);
    if (nearest && nearest.distance <= dayPitch * 0.6) columnWords.set(nearest.day, [...(columnWords.get(nearest.day) ?? []), word]);
  }
  const columns = new Map([...columnWords].map(([day, words]) => [day, textLines(words, height)] as const));

  const drafts: Draft[] = [];
  for (const [day, dayLines] of columns) {
    // Stack lines along the time axis. A gap wider than most of a text line, or a line
    // that starts with a new course code, begins a new cell.
    const cells: typeof dayLines[] = [];
    let reach = -Infinity;
    for (const line of [...dayLines].sort((a, b) => timeStart(a) - timeStart(b))) {
      const current = cells[cells.length - 1];
      const startsClass = /^[A-Z]{2,4}\s?\d{4}\b/.test(line.text.toUpperCase());
      const hasClass = current?.some((existing) => codeOf(existing.text));
      if (current && timeStart(line) - reach <= height * 0.8 && !(startsClass && hasClass)) current.push(line);
      else { cells.push([line]); reach = -Infinity; }
      reach = Math.max(reach, timeEnd(line));
    }
    for (const cell of cells) {
      const read = readCell(cellText(cell.flatMap((line) => line.words), height));
      if (!read) continue;
      const box = boxOf(cell);
      const tolerance = height * 0.5;
      // The cell covers every slot whose label lies within it; otherwise the nearest slot.
      let covered = ordered.map((slot, index) => ({ slot, index })).filter(({ slot }) => timeCenter(slot) >= timeStart(box) - tolerance && timeCenter(slot) <= timeEnd(box) + tolerance);
      if (!covered.length) {
        const nearest = ordered.reduce((best, slot, index) => (Math.abs(timeCenter(slot) - timeCenter(box)) < Math.abs(timeCenter(ordered[best]!) - timeCenter(box)) ? index : best), 0);
        covered = [{ slot: ordered[nearest]!, index: nearest }];
      }
      const start = covered[0]!.slot.start;
      const end = slotEnd(covered[covered.length - 1]!.index);
      const { structured, ...values } = read;
      drafts.push({ ...values, dayOfWeek: day, startTime: start, endTime: end && minutesOf(end) > minutesOf(start) ? end : null, layoutDerived: !structured });
    }
  }
  // Back-to-back slots of the same class become one entry.
  return mergeAdjacent(drafts.sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) || minutesOf(a.startTime ?? '00:00') - minutesOf(b.startTime ?? '00:00')));
}

/** Joins back-to-back hourly slots of the same class (gap of at most 10 minutes). */
function mergeAdjacent(drafts: Draft[]): Draft[] {
  const merged: Draft[] = [];
  for (const draft of drafts) {
    const previous = merged[merged.length - 1];
    if (previous && previous.courseCode === draft.courseCode && previous.dayOfWeek === draft.dayOfWeek
      && previous.sectionLabel === draft.sectionLabel && (previous.location === draft.location || !draft.location)
      && previous.endTime && draft.startTime && previous.startTime
      && minutesOf(draft.startTime) >= minutesOf(previous.endTime) && minutesOf(draft.startTime) - minutesOf(previous.endTime) <= 10) {
      previous.endTime = draft.endTime;
      continue;
    }
    merged.push({ ...draft });
  }
  return merged;
}

export function parseTimetable(pages: OcrPage[]): { candidates: TimetableCandidate[]; warnings: string[] } {
  const drafts: Draft[] = [];
  for (const page of pages) {
    const grid = parseGrid(page);
    drafts.push(...(grid.length ? grid : mergeAdjacent(parseLines(page.text))));
  }
  // The same class read twice (for example on two pages) is listed once.
  const seen = new Set<string>();
  const candidates: TimetableCandidate[] = [];
  for (const draft of drafts) {
    const key = [draft.courseCode, draft.dayOfWeek, draft.startTime, draft.endTime, draft.sectionLabel].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const { layoutDerived, ...values } = draft;
    candidates.push({ id: `c${candidates.length + 1}`, ...values, confidence: confidenceOf(values, layoutDerived) });
  }
  const warnings = ['REVIEW_REQUIRED'];
  if (!candidates.length) warnings.push('NO_CLASSES_FOUND');
  if (candidates.some((candidate) => candidate.confidence === 'low')) warnings.push('INCOMPLETE_DETAILS');
  return { candidates, warnings };
}
