import type { FocusSessionRow } from '@/lib/focusSyncCore';
import type { FocusBlock } from '@/lib/focusTimer';

/**
 * Unifyd Focus insights (pure; times are the device's local time).
 * - Only recorded focus time counts: `focus_seconds`, which already excludes breaks and pauses. Partial rounds count
 *   with their own recorded time. Planned time is never counted.
 * - **Day rule:** a round counts on the local calendar day it ended. The table stores one total per round, not its
 *   active intervals, so a round that crosses midnight is not split (splitting would invent precision).
 * - Synced rows and rounds still waiting on the device are merged by round ID, so nothing is counted twice.
 * - Subjects are grouped by the saved label, so a deleted subject keeps its name; no label is General study.
 */
export type FocusRecord = {
  id: string; subjectLabel: string | null; taskTitle: string | null; focusSeconds: number; plannedSeconds: number;
  status: 'completed' | 'partial'; startedAt: string; endedAt: string; source: 'synced' | 'device';
};
export type FocusRow = Pick<FocusSessionRow, 'id' | 'subject_label' | 'task_title' | 'focus_seconds' | 'planned_focus_seconds' | 'status' | 'started_at' | 'ended_at'>;
export type FocusGoal = { period: 'day' | 'week'; minutes: number };

export const GOAL_LIMITS = { day: { min: 15, max: 480, step: 15, initial: 60 }, week: { min: 60, max: 3000, step: 30, initial: 300 } } as const;
const DAY = 86_400_000;

export function recordFromRow(row: FocusRow): FocusRecord {
  return {
    id: row.id, subjectLabel: row.subject_label, taskTitle: row.task_title, focusSeconds: row.focus_seconds, plannedSeconds: row.planned_focus_seconds,
    status: row.status, startedAt: row.started_at, endedAt: row.ended_at, source: 'synced',
  };
}

/** A round still in the device outbox, shown the way it will be saved (same caps as the sync). */
export function recordFromBlock(block: FocusBlock): FocusRecord {
  const planned = Math.round(block.plannedFocusSeconds);
  const focus = Math.max(0, Math.min(planned, Math.floor(block.focusSeconds)));
  const label = (value: string | null | undefined) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return {
    id: block.id, subjectLabel: label(block.subjectLabel), taskTitle: label(block.taskTitle), focusSeconds: focus, plannedSeconds: planned,
    status: focus >= planned ? 'completed' : 'partial', startedAt: block.startedAt, endedAt: block.endedAt, source: 'device',
  };
}

/** Synced rows win over the same round still listed on the device; newest first by end time. */
export function mergeFocusRecords(synced: readonly FocusRecord[], device: readonly FocusRecord[]): FocusRecord[] {
  const byId = new Map<string, FocusRecord>();
  for (const record of device) byId.set(record.id, record);
  for (const record of synced) byId.set(record.id, record);
  return [...byId.values()].filter((record) => Number.isFinite(Date.parse(record.endedAt)))
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.id.localeCompare(b.id));
}

/** Local calendar day as YYYY-MM-DD. */
export function localDayKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local midnight that starts the Monday–Sunday week containing `now`. */
export function weekStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
}

/** The earliest round start worth fetching for the summary: the start of this week or 30 days back, minus a day for long rounds. */
export function insightsFetchSince(now: Date): Date {
  const thirty = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const earliest = Math.min(weekStart(now).getTime(), thirty.getTime());
  return new Date(earliest - DAY);
}

export type WeekDay = { key: string; date: Date; seconds: number; isToday: boolean; isFuture: boolean };
export type SubjectShare = { label: string | null; seconds: number; percent: number };
export type FocusSummary = {
  todaySeconds: number; weekSeconds: number; weekCompleted: number; weekPartial: number; week: WeekDay[];
  subjects: SubjectShare[]; subjectSeconds: number; deviceCount: number;
};

/** Whole percentages that add up to exactly 100 (largest remainder), so the list never shows 99% or 101%. */
export function wholePercents(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((value) => (value / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, rest: value - floors[index] })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) { if (left <= 0) break; floors[index]++; left--; }
  return floors;
}

/**
 * Today, this week (Monday–Sunday), rounds this week, the seven days for the chart, and subject shares over the
 * last 30 days (by local day of the end time).
 */
export function summarizeFocus(records: readonly FocusRecord[], now: Date): FocusSummary {
  const today = localDayKey(now);
  const start = weekStart(now);
  const week: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = localDayKey(date);
    return { key, date, seconds: 0, isToday: key === today, isFuture: key > today };
  });
  const weekIndex = new Map(week.map((day, index) => [day.key, index]));
  const thirtyKey = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const subjects = new Map<string, { label: string | null; seconds: number }>();
  let todaySeconds = 0; let weekCompleted = 0; let weekPartial = 0; let subjectSeconds = 0; let deviceCount = 0;
  for (const record of records) {
    const key = localDayKey(record.endedAt);
    const seconds = Math.max(0, record.focusSeconds);
    if (record.source === 'device') deviceCount++;
    if (key === today) todaySeconds += seconds;
    const index = weekIndex.get(key);
    if (index !== undefined) {
      week[index].seconds += seconds;
      if (record.status === 'completed') weekCompleted++; else weekPartial++;
    }
    if (key >= thirtyKey && key <= today) {
      const group = record.subjectLabel ?? '';
      const entry = subjects.get(group) ?? { label: record.subjectLabel, seconds: 0 };
      entry.seconds += seconds;
      subjects.set(group, entry);
      subjectSeconds += seconds;
    }
  }
  const ordered = [...subjects.values()].filter((item) => item.seconds > 0)
    // Most time first; on a tie, named subjects before General study, then by name.
    .sort((a, b) => b.seconds - a.seconds || Number(a.label === null) - Number(b.label === null) || (a.label ?? '').localeCompare(b.label ?? ''));
  const percents = wholePercents(ordered.map((item) => item.seconds));
  return {
    todaySeconds, weekSeconds: week.reduce((sum, day) => sum + day.seconds, 0), weekCompleted, weekPartial, week,
    subjects: ordered.map((item, index) => ({ ...item, percent: percents[index] })), subjectSeconds, deviceCount,
  };
}

/** Hours and whole minutes of recorded focus (seconds are rounded down, so time is never overstated). */
export function focusDuration(seconds: number): { hours: number; minutes: number } {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

export function normalizeGoal(value: unknown): FocusGoal | null {
  if (!value || typeof value !== 'object') return null;
  const goal = value as Record<string, unknown>;
  if (goal.period !== 'day' && goal.period !== 'week') return null;
  const limits = GOAL_LIMITS[goal.period];
  if (typeof goal.minutes !== 'number' || !Number.isFinite(goal.minutes)) return null;
  const stepped = Math.round(goal.minutes / limits.step) * limits.step;
  return { period: goal.period, minutes: Math.min(limits.max, Math.max(limits.min, stepped)) };
}

/** Progress towards the goal, capped at 100% for the bar; the minutes stay as recorded. */
export function goalProgress(goal: FocusGoal, summary: Pick<FocusSummary, 'todaySeconds' | 'weekSeconds'>): { doneMinutes: number; goalMinutes: number; ratio: number; reached: boolean } {
  const doneMinutes = Math.floor((goal.period === 'day' ? summary.todaySeconds : summary.weekSeconds) / 60);
  return { doneMinutes, goalMinutes: goal.minutes, ratio: Math.min(1, doneMinutes / goal.minutes), reached: doneMinutes >= goal.minutes };
}

/**
 * Poof's study suggestions (Phase 5): deterministic rules over the student's own data, computed on the device.
 * Nothing is sent to an AI service, nothing is predicted, and every number comes from recorded rounds or saved tasks.
 * Rules that need focus history are skipped when it could not be loaded (`records` null), so nothing is guessed.
 * There is no inactivity or streak wording; overdue tasks are left to Planner rather than repeated here.
 */
export type SuggestionTask = { id: string; title: string; subject: string; deadline: string; status: string };
export type FocusSuggestion =
  | { kind: 'dueSoon'; taskId: string; title: string; subject: string; when: 'today' | 'tomorrow' }
  | { kind: 'goalReached'; period: FocusGoal['period'] }
  | { kind: 'goalNear'; period: FocusGoal['period']; leftSeconds: number }
  | { kind: 'todayMilestone'; seconds: number }
  | { kind: 'subjectGap'; subject: string }
  | { kind: 'starter' };

const MILESTONE_SECONDS = 3600;

export function focusSuggestions(input: {
  now: Date; records: readonly FocusRecord[] | null; tasks: readonly SuggestionTask[] | null; subjects: readonly string[] | null; goal: FocusGoal | null; limit: number;
}): FocusSuggestion[] {
  const { now, records, tasks, subjects, goal, limit } = input;
  const out: FocusSuggestion[] = [];
  const today = localDayKey(now);
  const tomorrow = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  // 1. The nearest task due later today or tomorrow (never an overdue one).
  const due = (tasks ?? [])
    .filter((task) => task.status !== 'completed' && Number.isFinite(Date.parse(task.deadline)) && Date.parse(task.deadline) > now.getTime())
    .map((task) => ({ task, day: localDayKey(task.deadline) }))
    .filter(({ day }) => day === today || day === tomorrow)
    .sort((a, b) => Date.parse(a.task.deadline) - Date.parse(b.task.deadline) || a.task.id.localeCompare(b.task.id))[0];
  if (due) out.push({ kind: 'dueSoon', taskId: due.task.id, title: due.task.title, subject: due.task.subject, when: due.day === today ? 'today' : 'tomorrow' });

  if (records) {
    const summary = summarizeFocus(records, now);
    // 2. Goal progress, only once at least half is done (no nagging at zero).
    if (goal) {
      const progress = goalProgress(goal, summary);
      if (progress.reached) out.push({ kind: 'goalReached', period: goal.period });
      else if (progress.ratio >= 0.5) out.push({ kind: 'goalNear', period: goal.period, leftSeconds: (progress.goalMinutes - progress.doneMinutes) * 60 });
    }
    // 3. A recorded milestone today (an hour or more).
    if (summary.todaySeconds >= MILESTONE_SECONDS) out.push({ kind: 'todayMilestone', seconds: summary.todaySeconds });
    // 4. A semester subject with no focus time this week, only once the student has studied something this week.
    if (summary.weekSeconds > 0 && subjects?.length) {
      const weekKeys = new Set(summary.week.map((day) => day.key));
      const studied = new Set(records.filter((record) => weekKeys.has(localDayKey(record.endedAt)) && record.focusSeconds > 0).map((record) => record.subjectLabel));
      const gap = subjects.find((subject) => !studied.has(subject));
      if (gap) out.push({ kind: 'subjectGap', subject: gap });
    }
    // 5. A gentle way in when there are no rounds yet and nothing more specific to say.
    if (records.length === 0 && out.length === 0) out.push({ kind: 'starter' });
  }
  return out.slice(0, Math.max(0, limit));
}
