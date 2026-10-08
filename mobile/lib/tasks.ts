export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'ongoing' | 'completed';

export type TaskRecord = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  reminder_offset_minutes?: 0 | 60 | 1440 | null;
};

export const priorities: TaskPriority[] = ['low', 'medium', 'high'];
export const statuses: TaskStatus[] = ['pending', 'ongoing', 'completed'];

export function sortTasks(tasks: TaskRecord[]): TaskRecord[] {
  const rank: Record<TaskStatus, number> = { pending: 0, ongoing: 1, completed: 2 };
  return [...tasks].sort((a, b) => {
    const group = rank[a.status] - rank[b.status];
    if (group) return group;
    const difference = a.status === 'completed'
      ? Date.parse(b.completed_at ?? b.created_at) - Date.parse(a.completed_at ?? a.created_at)
      : Date.parse(a.deadline) - Date.parse(b.deadline);
    return difference || a.id.localeCompare(b.id);
  });
}

export function isOverdue(task: TaskRecord, now = Date.now()): boolean {
  return task.status !== 'completed' && Date.parse(task.deadline) < now;
}

export function formatTaskDeadline(value: string, language: 'en' | 'ms'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

export function localDeadlineParts(value: string): { date: string; hour: string; minute: string } {
  const parsed = new Date(value);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const pad = (number: number) => String(number).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hour: pad(date.getHours()),
    minute: pad(date.getMinutes()),
  };
}

export function deadlineIso(date: string, hour: string, minute: string): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts || !/^\d{2}$/.test(hour) || !/^\d{2}$/.test(minute)) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const h = Number(hour);
  const m = Number(minute);
  if (h > 23 || m > 59) return null;
  const local = new Date(year, month - 1, day, h, m);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day || local.getHours() !== h || local.getMinutes() !== m) return null;
  return local.toISOString();
}
