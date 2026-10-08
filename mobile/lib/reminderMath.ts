export type ReminderOffset = 0 | 60 | 1440 | null;

export function reminderLabelKey(offset: ReminderOffset) {
  switch (offset) {
    case 0: return 'task.reminderAtDeadline' as const;
    case 60: return 'task.reminderHour' as const;
    case 1440: return 'task.reminderDay' as const;
    default: return 'task.reminderNone' as const;
  }
}

export function isReminderOffset(value: unknown): value is ReminderOffset {
  return value === null || value === 0 || value === 60 || value === 1440;
}

export function reminderFireTime(deadline: string, offset: ReminderOffset, now = Date.now()): Date | null {
  if (offset === null) return null;
  const deadlineMs = Date.parse(deadline);
  if (!Number.isFinite(deadlineMs)) return null;
  const fireMs = deadlineMs - offset * 60_000;
  return fireMs > now ? new Date(fireMs) : null;
}
