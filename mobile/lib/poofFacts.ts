import type { ExpenseCategory } from '@/lib/expenseForm';
import type { TaskPriority } from '@/lib/tasks';

// Poof's insight layer: one typed snapshot of the signed-in student's Wallet,
// Budget, Planner, Academic, and Mind records. Pure functions only, so the rules
// can be unit-tested in Node. Every figure Poof shows, or sends to the AI, is
// calculated here; the AI never computes or alters numbers.

export const POOF_CATEGORIES: readonly ExpenseCategory[] = ['food', 'transport', 'academic_materials', 'personal', 'other'];
export const DUE_SOON_HOURS = 72;
export const DUE_THIS_WEEK_DAYS = 7;
export const RECENTLY_COMPLETED_DAYS = 7;
export const WELLNESS_WINDOW_DAYS = 7;
export const MOOD_LOOKBACK_DAYS = 30;
export const LOW_MOOD_MAX_LEVEL = 2;
export const LOW_MOOD_MIN_DAYS = 3;
export const HIGH_STRESS_AVERAGE = 4;
const LIST_LIMIT = 5;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type PoofExpenseRow = { amount: number | string; category: string; expense_date: string };
export type PoofBudgetRow = { amount: number | string; period_type: string; period_start: string };
export type PoofTaskRow = { title: string; subject: string; deadline: string; priority: string; status: string };
export type PoofMoodRow = { mood_level: number; stress_level: number; recorded_at: string };
export type PoofClassRow = { course_code: string | null; course_name: string; day_of_week: number; start_time: string; end_time: string; location: string | null };
export type PoofProfileRow = { full_name: string | null; faculty: string | null; programme: string | null; study_year: number | null } | null;
/** Semester subjects and classes come from the student's saved semester choice; `null` means none is chosen yet. */
export type PoofSemesterRows = { subjects: number; classes: PoofClassRow[] } | null;

export type PoofRows = {
  profile: PoofProfileRow;
  expenses: PoofExpenseRow[];
  budgets: PoofBudgetRow[];
  tasks: PoofTaskRow[];
  completedRecently: number;
  moods: PoofMoodRow[];
  semester: PoofSemesterRows;
};

export type CategoryTotal = { category: ExpenseCategory; cents: number; percent: number };
export type SpendingPeriod = {
  start: string;
  end: string;
  daysLeft: number;
  expenseCount: number;
  spentCents: number;
  budgetCents: number | null;
  remainingCents: number | null;
  percentUsed: number | null;
  categories: CategoryTotal[];
};
export type TaskBrief = { title: string; subject: string; deadline: string; priority: TaskPriority };
export type ClassBrief = { code: string | null; name: string; start: string; end: string; location: string | null; daysAhead: number };
export type ProfileGap = 'name' | 'faculty' | 'studyYear';

export type PoofFacts = {
  generatedAt: string;
  profile: { complete: boolean; missing: ProfileGap[] };
  finance: { week: SpendingPeriod; month: SpendingPeriod };
  planner: {
    active: number;
    overdue: number;
    dueToday: number;
    dueSoon: number;
    dueThisWeek: number;
    highPriorityOpen: number;
    completedRecently: number;
    overdueTasks: TaskBrief[];
    upcomingTasks: TaskBrief[];
    next: TaskBrief | null;
  };
  academic: { semesterSet: boolean; subjects: number; weeklyClasses: number; classesLeftToday: ClassBrief[]; nextClass: ClassBrief | null };
  wellness: {
    windowDays: number;
    checkIns: number;
    averageMood: number | null;
    averageStress: number | null;
    repeatedLowMood: boolean;
    highStress: boolean;
    daysSinceLastCheckIn: number | null;
  };
};

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const isoWeekday = (date: Date) => ((date.getDay() + 6) % 7) + 1;
const toCents = (amount: number | string) => Math.round(Number(amount) * 100);

function toMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Monday-to-Sunday week and calendar month in device-local dates, matching Wallet budgets. */
export function poofPeriods(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const weekday = isoWeekday(now);
  const monthLast = new Date(y, m + 1, 0).getDate();
  return {
    today: isoDate(now),
    week: { start: isoDate(new Date(y, m, d - weekday + 1)), end: isoDate(new Date(y, m, d - weekday + 7)), daysLeft: 8 - weekday },
    month: { start: isoDate(new Date(y, m, 1)), end: isoDate(new Date(y, m, monthLast)), daysLeft: monthLast - d + 1 },
    moodSince: new Date(y, m, d + 1 - MOOD_LOOKBACK_DAYS),
    recentlyCompletedSince: new Date(now.getTime() - RECENTLY_COMPLETED_DAYS * DAY_MS),
  };
}

function spending(expenses: readonly PoofExpenseRow[], budgets: readonly PoofBudgetRow[], type: 'weekly' | 'monthly', period: { start: string; end: string; daysLeft: number }): SpendingPeriod {
  const totals = new Map<ExpenseCategory, number>();
  let expenseCount = 0;
  for (const expense of expenses) {
    if (expense.expense_date < period.start || expense.expense_date > period.end) continue;
    const category = POOF_CATEGORIES.find((value) => value === expense.category);
    if (!category) continue;
    totals.set(category, (totals.get(category) ?? 0) + toCents(expense.amount));
    expenseCount++;
  }
  const spentCents = [...totals.values()].reduce((sum, cents) => sum + cents, 0);
  const budget = budgets.find((row) => row.period_type === type && row.period_start === period.start);
  const budgetCents = budget ? toCents(budget.amount) : null;
  return {
    ...period,
    expenseCount,
    spentCents,
    budgetCents,
    remainingCents: budgetCents === null ? null : budgetCents - spentCents,
    percentUsed: budgetCents ? round1(spentCents / budgetCents * 100) : null,
    categories: [...totals.entries()]
      .filter(([, cents]) => cents > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([category, cents]) => ({ category, cents, percent: round1(cents / spentCents * 100) })),
  };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const priorityOf = (value: string): TaskPriority => value === 'high' || value === 'low' ? value : 'medium';
const brief = (task: PoofTaskRow): TaskBrief => ({ title: task.title, subject: task.subject, deadline: task.deadline, priority: priorityOf(task.priority) });

function classBrief(row: PoofClassRow, daysAhead: number): ClassBrief {
  return { code: row.course_code, name: row.course_name, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5), location: row.location, daysAhead };
}

export function buildPoofFacts(rows: PoofRows, now = new Date()): PoofFacts {
  const periods = poofPeriods(now);
  const nowMs = now.getTime();

  // Planner: overdue first, then upcoming by deadline and priority.
  const active = rows.tasks.filter((task) => task.status === 'pending' || task.status === 'ongoing')
    .filter((task) => !Number.isNaN(Date.parse(task.deadline)));
  const byUrgency = (a: PoofTaskRow, b: PoofTaskRow) => Date.parse(a.deadline) - Date.parse(b.deadline)
    || PRIORITY_RANK[priorityOf(a.priority)] - PRIORITY_RANK[priorityOf(b.priority)];
  const overdue = active.filter((task) => Date.parse(task.deadline) < nowMs).sort(byUrgency);
  const upcoming = active.filter((task) => Date.parse(task.deadline) >= nowMs).sort(byUrgency);
  const thisWeek = upcoming.filter((task) => Date.parse(task.deadline) <= nowMs + DUE_THIS_WEEK_DAYS * DAY_MS);

  // Classes: remaining today, and the next one to start.
  const today = isoWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const classes = (rows.semester?.classes ?? []).filter((row) => row.day_of_week >= 1 && row.day_of_week <= 7 && toMinutes(row.start_time) !== null);
  const scheduled = classes.map((row) => {
    const start = toMinutes(row.start_time)!;
    let daysAhead = (row.day_of_week - today + 7) % 7;
    if (daysAhead === 0 && start <= nowMinutes) daysAhead = 7;
    return { row, start, daysAhead };
  }).sort((a, b) => a.daysAhead - b.daysAhead || a.start - b.start);
  const next = scheduled[0];

  // Wellbeing: the last seven local days, plus how long since the latest check-in.
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 - WELLNESS_WINDOW_DAYS);
  const current: PoofMoodRow[] = [];
  const lowDays = new Set<string>();
  let latest: number | null = null;
  for (const mood of rows.moods) {
    const at = new Date(mood.recorded_at);
    if (Number.isNaN(at.getTime()) || at.getTime() > nowMs) continue;
    latest = latest === null ? at.getTime() : Math.max(latest, at.getTime());
    if (at < windowStart) continue;
    current.push(mood);
    if (mood.mood_level <= LOW_MOOD_MAX_LEVEL) lowDays.add(isoDate(at));
  }
  const mood = average(current.map((row) => row.mood_level));
  const stress = average(current.map((row) => row.stress_level));
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysSince = latest === null ? null : Math.max(0, Math.ceil((startOfToday - latest) / DAY_MS));

  const missing: ProfileGap[] = [];
  if (!rows.profile?.full_name?.trim()) missing.push('name');
  if (!rows.profile?.faculty?.trim() && !rows.profile?.programme?.trim()) missing.push('faculty');
  if (!rows.profile?.study_year) missing.push('studyYear');

  return {
    generatedAt: now.toISOString(),
    profile: { complete: missing.length === 0, missing },
    finance: {
      week: spending(rows.expenses, rows.budgets, 'weekly', periods.week),
      month: spending(rows.expenses, rows.budgets, 'monthly', periods.month),
    },
    planner: {
      active: active.length,
      overdue: overdue.length,
      dueToday: upcoming.filter((task) => isoDate(new Date(task.deadline)) === periods.today).length,
      dueSoon: upcoming.filter((task) => Date.parse(task.deadline) <= nowMs + DUE_SOON_HOURS * HOUR_MS).length,
      dueThisWeek: thisWeek.length,
      highPriorityOpen: active.filter((task) => priorityOf(task.priority) === 'high').length,
      completedRecently: rows.completedRecently,
      overdueTasks: overdue.slice(0, LIST_LIMIT).map(brief),
      upcomingTasks: thisWeek.slice(0, LIST_LIMIT).map(brief),
      next: upcoming[0] ? brief(upcoming[0]) : null,
    },
    academic: {
      semesterSet: rows.semester !== null,
      subjects: rows.semester?.subjects ?? 0,
      weeklyClasses: classes.length,
      classesLeftToday: scheduled.filter((item) => item.daysAhead === 0).map((item) => classBrief(item.row, 0)),
      nextClass: next ? classBrief(next.row, next.daysAhead) : null,
    },
    wellness: {
      windowDays: WELLNESS_WINDOW_DAYS,
      checkIns: current.length,
      averageMood: mood === null ? null : round1(mood),
      averageStress: stress === null ? null : round1(stress),
      repeatedLowMood: lowDays.size >= LOW_MOOD_MIN_DAYS,
      highStress: stress !== null && stress >= HIGH_STRESS_AVERAGE,
      daysSinceLastCheckIn: daysSince,
    },
  };
}

const ringgit = (cents: number) => (cents / 100).toFixed(2);

function periodPayload(period: SpendingPeriod) {
  return {
    spent: ringgit(period.spentCents),
    expenseCount: period.expenseCount,
    budget: period.budgetCents === null ? null : ringgit(period.budgetCents),
    remaining: period.remainingCents !== null && period.remainingCents >= 0 ? ringgit(period.remainingCents) : null,
    overBudgetBy: period.remainingCents !== null && period.remainingCents < 0 ? ringgit(-period.remainingCents) : null,
    percentOfBudgetUsed: period.percentUsed,
    daysLeftIncludingToday: period.daysLeft,
    categories: period.categories.map(({ category, cents, percent }) => ({ category, spent: ringgit(cents), percentOfSpending: percent })),
  };
}

/**
 * The only data sent to the AI service: aggregate numbers and fixed labels. Task
 * titles, subjects, class names, notes, names, and dates never leave the device
 * this way. The server validates this exact shape (server/src/poof-chat.ts).
 */
export function poofAiPayload(facts: PoofFacts) {
  const { planner, academic, wellness } = facts;
  return {
    currency: 'RM' as const,
    profileComplete: facts.profile.complete,
    finance: { thisWeek: periodPayload(facts.finance.week), thisMonth: periodPayload(facts.finance.month) },
    planner: {
      activeTasks: planner.active,
      overdueTasks: planner.overdue,
      dueToday: planner.dueToday,
      dueInNext3Days: planner.dueSoon,
      dueInNext7Days: planner.dueThisWeek,
      highPriorityOpen: planner.highPriorityOpen,
      completedInLast7Days: planner.completedRecently,
    },
    academic: {
      semesterSetUp: academic.semesterSet,
      subjects: academic.subjects,
      weeklyClasses: academic.weeklyClasses,
      classesLeftToday: academic.classesLeftToday.length,
      nextClassInDays: academic.nextClass?.daysAhead ?? null,
    },
    wellbeing: {
      scale: '1 (very low) to 5 (very high), self-reported' as const,
      checkInsLast7Days: wellness.checkIns,
      averageMood: wellness.averageMood,
      averageStress: wellness.averageStress,
      repeatedLowMoodDays: wellness.repeatedLowMood,
      daysSinceLastCheckIn: wellness.daysSinceLastCheckIn,
    },
  };
}
export type PoofAiPayload = ReturnType<typeof poofAiPayload>;
