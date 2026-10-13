export const REMINDER_OPTIONS = [
  { id: '1_day', label: '1 day before' },
  { id: '3_days', label: '3 days before' },
  { id: '1_week', label: '1 week before' },
] as const;

export type ReminderTiming = (typeof REMINDER_OPTIONS)[number]['id'];
export const DEFAULT_REMINDER_TIMING: ReminderTiming = '1_day';
