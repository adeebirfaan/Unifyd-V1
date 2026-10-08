import type { ExpenseCategory } from '@/lib/expenseForm';

// Home dashboard facts, calculated on the device from the student's own rows so
// the panels work even when the insights server is unreachable. The rules match
// server/src/insight-facts.ts (SRS-FR-608 low-mood rule included); change both together.
export const WELLNESS_WINDOW_DAYS = 7;
export const LOW_MOOD_MAX_LEVEL = 2;
export const LOW_MOOD_MIN_DAYS = 3;
export const DUE_SOON_DAYS = 7;
export const RECENTLY_COMPLETED_DAYS = 7;

const CATEGORIES: readonly ExpenseCategory[] = ['food', 'transport', 'academic_materials', 'personal', 'other'];
const DAY_MS = 86_400_000;

export type Direction = 'higher' | 'lower' | 'similar';
export type DashboardExpense = { amount: number | string; category: string; expense_date: string };
export type DashboardTask = { title: string; subject: string; deadline: string; status: string; completed_at: string | null };
export type DashboardMood = { mood_level: number; stress_level: number; recorded_at: string };

export type DashboardFacts = {
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

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
function direction(current: number, previous: number): Direction {
  const difference = current - previous;
  return difference >= 0.25 ? 'higher' : difference <= -0.25 ? 'lower' : 'similar';
}

export function dashboardMonth(now = new Date()) {
  return {
    start: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function dashboardWellnessWindow(now = new Date()) {
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return {
    previousStart: day(1 - WELLNESS_WINDOW_DAYS * 2),
    currentStart: day(1 - WELLNESS_WINDOW_DAYS),
    endExclusive: day(1),
  };
}

export function buildDashboardFacts(input: {
  expenses: DashboardExpense[];
  monthlyBudget: number | string | null;
  tasks: DashboardTask[];
  moods: DashboardMood[];
  now?: Date;
}): DashboardFacts {
  const now = input.now ?? new Date();
  const month = dashboardMonth(now);

  const categoryCents = new Map<ExpenseCategory, number>();
  let expenseCount = 0;
  for (const expense of input.expenses) {
    if (expense.expense_date < month.start || expense.expense_date > month.end) continue;
    const category = CATEGORIES.find((value) => value === expense.category);
    if (!category) continue;
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

  const window = dashboardWellnessWindow(now);
  const current: DashboardMood[] = [];
  const previous: DashboardMood[] = [];
  const lowDays = new Set<string>();
  for (const mood of input.moods) {
    const at = new Date(mood.recorded_at);
    if (Number.isNaN(at.getTime()) || at < window.previousStart || at >= window.endExclusive) continue;
    if (at < window.currentStart) { previous.push(mood); continue; }
    current.push(mood);
    if (mood.mood_level <= LOW_MOOD_MAX_LEVEL) lowDays.add(isoDate(at));
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
      dueSoon: upcoming.filter((task) => Date.parse(task.deadline) <= nowMs + DUE_SOON_DAYS * DAY_MS).length,
      completedRecently: input.tasks.filter((task) => task.status === 'completed' && task.completed_at
        && Date.parse(task.completed_at) >= nowMs - RECENTLY_COMPLETED_DAYS * DAY_MS).length,
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
