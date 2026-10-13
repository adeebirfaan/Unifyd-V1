import type { TaskPriority, TaskRecord } from '@/lib/tasks';

/**
 * Pure rules for the Studies (Planner) main page: the Priority tasks order, the Academic focus counts, and the
 * "starts in" time for today's next class. Everything comes from saved task and timetable fields and the device's
 * local time; nothing is predicted or invented.
 */

export const PRIORITY_PREVIEW_LIMIT = 5;

export type PriorityGroup = 'overdue' | 'today' | 'high' | 'medium' | 'low' | 'undated';
const GROUP_RANK: Record<PriorityGroup, number> = { overdue: 0, today: 1, high: 2, medium: 3, low: 4, undated: 5 };
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** The deadline in milliseconds, or null when it is missing or unreadable (shown as "No due date"). */
export function deadlineTime(task: Pick<TaskRecord, 'deadline'>): number | null {
  if (!task.deadline) return null;
  const time = Date.parse(task.deadline);
  return Number.isNaN(time) ? null : time;
}

const sameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isOpen = (task: Pick<TaskRecord, 'status'>) => task.status !== 'completed';

/** Where an incomplete task falls in Priority tasks. Overdue and due-today come before the priority levels. */
export function priorityGroup(task: Pick<TaskRecord, 'deadline' | 'priority'>, now: Date): PriorityGroup {
  const time = deadlineTime(task);
  if (time === null) return 'undated';
  if (time < now.getTime()) return 'overdue';
  if (sameLocalDay(new Date(time), now)) return 'today';
  return task.priority;
}

/** The urgency shown on a row: only overdue or due later today, never for completed tasks. */
export function taskUrgency(task: Pick<TaskRecord, 'deadline' | 'priority' | 'status'>, now: Date): 'overdue' | 'today' | null {
  if (!isOpen(task)) return null;
  const group = priorityGroup(task, now);
  return group === 'overdue' || group === 'today' ? group : null;
}

/**
 * Incomplete tasks in the order to handle them:
 * 1. overdue, 2. due later today, 3–5. High, Medium, then Low by nearest deadline, 6. no readable deadline.
 * Within a group: nearest deadline, then higher priority, then the earlier created task, then the ID.
 * Completed tasks are never included.
 */
export function priorityTasks<T extends TaskRecord>(tasks: readonly T[], now: Date): T[] {
  return tasks.filter(isOpen).map((task) => ({ task, group: GROUP_RANK[priorityGroup(task, now)], time: deadlineTime(task) }))
    .sort((a, b) => a.group - b.group
      || (a.time ?? 0) - (b.time ?? 0)
      || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority]
      || (Date.parse(a.task.created_at) || 0) - (Date.parse(b.task.created_at) || 0)
      || a.task.id.localeCompare(b.task.id))
    .map(({ task }) => task);
}

/** Completed tasks for the full list, most recently completed first (the Planner's existing completed order). */
export function completedTasks<T extends TaskRecord>(tasks: readonly T[]): T[] {
  const doneAt = (task: TaskRecord) => Date.parse(task.completed_at ?? task.created_at) || 0;
  return tasks.filter((task) => !isOpen(task)).sort((a, b) => doneAt(b) - doneAt(a) || a.id.localeCompare(b.id));
}

export type AcademicFocus = { overdue: number; dueToday: number; upcoming: number; completed: number; total: number };

/** Counts for the Academic focus card. Upcoming = incomplete and due after today; undated tasks count only in total. */
export function academicFocus(tasks: readonly TaskRecord[], now: Date): AcademicFocus {
  const focus: AcademicFocus = { overdue: 0, dueToday: 0, upcoming: 0, completed: 0, total: tasks.length };
  for (const task of tasks) {
    if (!isOpen(task)) { focus.completed += 1; continue; }
    const group = priorityGroup(task, now);
    if (group === 'overdue') focus.overdue += 1;
    else if (group === 'today') focus.dueToday += 1;
    else if (group !== 'undated') focus.upcoming += 1;
  }
  return focus;
}

/** Whole minutes until a class that starts later today, or null for any other day. */
export function minutesUntilClass(startMinutes: number, daysAhead: number, now: Date): number | null {
  if (daysAhead !== 0) return null;
  const left = startMinutes - (now.getHours() * 60 + now.getMinutes());
  return left > 0 ? left : null;
}
