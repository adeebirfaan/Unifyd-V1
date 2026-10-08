// Deterministic dashboard facts. Every number shown to Groq is calculated here
// from the signed-in student's own rows; the AI never computes or alters facts.

export const DEFAULT_TIME_ZONE = 'Asia/Kuala_Lumpur';
export const EXPENSE_CATEGORIES = ['food', 'transport', 'academic_materials', 'personal', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Wellbeing windows and the repeated low-mood rule (SRS-FR-608). The mobile app
// uses the same values in mobile/lib/dashboardFacts.ts; change both together.
export const WELLNESS_WINDOW_DAYS = 7;
export const LOW_MOOD_MAX_LEVEL = 2;
export const LOW_MOOD_MIN_DAYS = 3;
export const DUE_SOON_DAYS = 7;
export const RECENTLY_COMPLETED_DAYS = 7;

export type ExpenseRow = { amount: number | string; category: string; expense_date: string };
export type TaskRow = { title: string; subject: string; deadline: string; status: string; completed_at: string | null };
export type MoodRow = { mood_level: number; stress_level: number; recorded_at: string };
export type Direction = 'higher' | 'lower' | 'similar';

export type InsightFacts = {
  finance: {
    monthStart: string;
    monthEnd: string;
    expenseCount: number;
    spentCents: number;
    budgetCents: number | null;
    remainingCents: number | null;
    percentUsed: number | null;
    topCategories: { category: ExpenseCategory; percent: number }[];
  };
  academic: {
    pending: number;
    ongoing: number;
    overdue: number;
    dueSoon: number;
    completedRecently: number;
    nextDeadline: { title: string; subject: string; deadline: string } | null;
  };
  wellness: {
    windowDays: number;
    checkIns: number;
    averageMood: number | null;
    averageStress: number | null;
    moodVsPrevious: Direction | null;
    stressVsPrevious: Direction | null;
    repeatedLowMood: boolean;
  };
};

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** The student's local calendar date (YYYY-MM-DD) for an instant. */
export function localDate(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

/** The UTC instant at which a local calendar date begins in the given zone. */
export function startOfLocalDay(isoDate: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const wallClock = Date.UTC(year!, month! - 1, day!);
  let instant = wallClock;
  // Two passes settle the zone offset, including days that start after a DST change.
  for (let pass = 0; pass < 2; pass++) {
    const p = zonedParts(new Date(instant), timeZone);
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
    instant = wallClock - offset;
  }
  return new Date(instant);
}

export function currentMonth(now: Date, timeZone: string) {
  const today = localDate(now, timeZone);
  const [year, month] = today.split('-').map(Number);
  const start = `${today.slice(0, 7)}-01`;
  const end = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
  return { today, start, end };
}

/** Local-day windows used to load and summarise mood check-ins. */
export function wellnessWindow(now: Date, timeZone: string) {
  const today = localDate(now, timeZone);
  return {
    previousStart: startOfLocalDay(addDays(today, 1 - WELLNESS_WINDOW_DAYS * 2), timeZone),
    currentStart: startOfLocalDay(addDays(today, 1 - WELLNESS_WINDOW_DAYS), timeZone),
    endExclusive: startOfLocalDay(addDays(today, 1), timeZone),
  };
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
function direction(current: number, previous: number): Direction {
  const difference = current - previous;
  return difference >= 0.25 ? 'higher' : difference <= -0.25 ? 'lower' : 'similar';
}

export function buildInsightFacts(input: {
  expenses: ExpenseRow[];
  monthlyBudget: number | string | null;
  tasks: TaskRow[];
  moods: MoodRow[];
  now: Date;
  timeZone: string;
}): InsightFacts {
  const { now, timeZone } = input;
  const month = currentMonth(now, timeZone);

  const categoryCents = new Map<ExpenseCategory, number>();
  let expenseCount = 0;
  for (const expense of input.expenses) {
    if (expense.expense_date < month.start || expense.expense_date > month.end) continue;
    if (!(EXPENSE_CATEGORIES as readonly string[]).includes(expense.category)) continue;
    const category = expense.category as ExpenseCategory;
    categoryCents.set(category, (categoryCents.get(category) ?? 0) + Math.round(Number(expense.amount) * 100));
    expenseCount++;
  }
  const spentCents = [...categoryCents.values()].reduce((sum, cents) => sum + cents, 0);
  const budgetCents = input.monthlyBudget === null ? null : Math.round(Number(input.monthlyBudget) * 100);
  const topCategories = [...categoryCents.entries()]
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([category, cents]) => ({ category, percent: round1(cents / spentCents * 100) }));

  const nowMs = now.getTime();
  const active = input.tasks.filter((task) => task.status === 'pending' || task.status === 'ongoing');
  const upcoming = active.filter((task) => Date.parse(task.deadline) >= nowMs)
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  const next = upcoming[0];

  const window = wellnessWindow(now, timeZone);
  const current: MoodRow[] = [];
  const previous: MoodRow[] = [];
  const lowDays = new Set<string>();
  for (const mood of input.moods) {
    const at = new Date(mood.recorded_at);
    if (Number.isNaN(at.getTime()) || at < window.previousStart || at >= window.endExclusive) continue;
    if (at < window.currentStart) { previous.push(mood); continue; }
    current.push(mood);
    if (mood.mood_level <= LOW_MOOD_MAX_LEVEL) lowDays.add(localDate(at, timeZone));
  }
  const mood = average(current.map((row) => row.mood_level));
  const stress = average(current.map((row) => row.stress_level));
  const previousMood = average(previous.map((row) => row.mood_level));
  const previousStress = average(previous.map((row) => row.stress_level));
  const comparable = current.length >= 2 && previous.length >= 2;

  return {
    finance: {
      monthStart: month.start,
      monthEnd: month.end,
      expenseCount,
      spentCents,
      budgetCents,
      remainingCents: budgetCents === null ? null : budgetCents - spentCents,
      percentUsed: budgetCents ? round1(spentCents / budgetCents * 100) : null,
      topCategories,
    },
    academic: {
      pending: active.filter((task) => task.status === 'pending').length,
      ongoing: active.filter((task) => task.status === 'ongoing').length,
      overdue: active.filter((task) => Date.parse(task.deadline) < nowMs).length,
      dueSoon: upcoming.filter((task) => Date.parse(task.deadline) <= nowMs + DUE_SOON_DAYS * 86_400_000).length,
      completedRecently: input.tasks.filter((task) => task.status === 'completed' && task.completed_at
        && Date.parse(task.completed_at) >= nowMs - RECENTLY_COMPLETED_DAYS * 86_400_000).length,
      nextDeadline: next ? { title: next.title, subject: next.subject, deadline: next.deadline } : null,
    },
    wellness: {
      windowDays: WELLNESS_WINDOW_DAYS,
      checkIns: current.length,
      averageMood: mood === null ? null : round1(mood),
      averageStress: stress === null ? null : round1(stress),
      moodVsPrevious: comparable && mood !== null && previousMood !== null ? direction(mood, previousMood) : null,
      stressVsPrevious: comparable && stress !== null && previousStress !== null ? direction(stress, previousStress) : null,
      repeatedLowMood: lowDays.size >= LOW_MOOD_MIN_DAYS,
    },
  };
}
