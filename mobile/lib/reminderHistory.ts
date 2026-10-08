import type { ReminderOffset } from '@/lib/reminderMath';

// Reminder history (SRS-FR-507) is derived from saved tasks, using the same rule
// as the device scheduler in taskReminders.ts: one reminder at deadline minus the
// chosen offset, only while the task is active. Actual delivery or dismissal on
// the device is not recorded, so this lists scheduled times only.
export const PAST_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export type ReminderHistoryTask = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  status: string;
  completed_at: string | null;
  reminder_offset_minutes: number | null;
};

export type ReminderItem = {
  taskId: string;
  title: string;
  subject: string;
  deadline: string;
  fireAt: string;
  offset: Exclude<ReminderOffset, null>;
};

const OFFSETS = [0, 60, 1440] as const;

export function buildReminderHistory(tasks: ReminderHistoryTask[], now = Date.now()) {
  const upcoming: ReminderItem[] = [];
  const past: ReminderItem[] = [];
  for (const task of tasks) {
    const offset = OFFSETS.find((value) => value === task.reminder_offset_minutes);
    const deadlineMs = Date.parse(task.deadline);
    if (offset === undefined || !Number.isFinite(deadlineMs)) continue;
    const fireMs = deadlineMs - offset * 60_000;
    const item: ReminderItem = { taskId: task.id, title: task.title, subject: task.subject, deadline: task.deadline, fireAt: new Date(fireMs).toISOString(), offset };
    const active = task.status === 'pending' || task.status === 'ongoing';
    if (fireMs > now) {
      if (active) upcoming.push(item);
      continue;
    }
    if (fireMs < now - PAST_WINDOW_DAYS * DAY_MS) continue;
    // Completing a task cancels its reminder, so one completed before its time never fired.
    const completedMs = task.completed_at ? Date.parse(task.completed_at) : NaN;
    if (!active && !(Number.isFinite(completedMs) && completedMs >= fireMs)) continue;
    past.push(item);
  }
  upcoming.sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.taskId.localeCompare(b.taskId));
  past.sort((a, b) => b.fireAt.localeCompare(a.fireAt) || a.taskId.localeCompare(b.taskId));
  return { upcoming, past };
}
