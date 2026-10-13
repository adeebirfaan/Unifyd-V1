import type { ExpenseCategory } from '@/lib/expenseForm';

export const BILLING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];
// The database allows 0–30 days; the form offers these planning choices.
export const REMINDER_DAY_CHOICES = [0, 1, 3, 7] as const;
// Local reminders fire at 09:00 on the reminder day, not at midnight.
export const SUBSCRIPTION_REMINDER_HOUR = 9;
export const UPCOMING_WINDOW_DAYS = 30;

export const SUBSCRIPTION_COLUMNS = 'id,name,amount,category,billing_frequency,next_billing_date,reminder_days_before,notifications_enabled,is_active,notes';

export type SubscriptionRecord = {
  id: string;
  name: string;
  amount: number | string;
  category: ExpenseCategory | null;
  billing_frequency: BillingFrequency;
  next_billing_date: string;
  reminder_days_before: number;
  notifications_enabled: boolean;
  is_active: boolean;
  notes: string | null;
};

export type SubscriptionInput = Omit<SubscriptionRecord, 'id' | 'amount'> & { amount: number };
export type RenewalStatus = 'overdue' | 'today' | 'soon' | 'later';

export function isBillingFrequency(value: unknown): value is BillingFrequency {
  return typeof value === 'string' && (BILLING_FREQUENCIES as readonly string[]).includes(value);
}

export function isReminderDays(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 30;
}

// Date-only maths runs on UTC calendar days so device time zones and DST never shift a date.
function toUtc(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? date : null;
}

function fromUtc(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addDaysISO(iso: string, days: number): string | null {
  const date = toUtc(iso);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

function addMonthsISO(iso: string, months: number): string | null {
  const date = toUtc(iso);
  if (!date) return null;
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  // Clamp to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb).
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return fromUtc(target);
}

/** One billing cycle after `iso`. Used only after the student confirms "Mark as renewed". */
export function advanceBillingDate(iso: string, frequency: BillingFrequency): string | null {
  switch (frequency) {
    case 'weekly': return addDaysISO(iso, 7);
    case 'monthly': return addMonthsISO(iso, 1);
    case 'quarterly': return addMonthsISO(iso, 3);
    case 'yearly': return addMonthsISO(iso, 12);
  }
}

export function daysUntil(iso: string, todayISO: string): number | null {
  const target = toUtc(iso);
  const today = toUtc(todayISO);
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function renewalStatus(nextBillingDate: string, reminderDays: number, todayISO: string): RenewalStatus {
  const days = daysUntil(nextBillingDate, todayISO);
  if (days === null) return 'later';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= Math.max(reminderDays, 7) ? 'soon' : 'later';
}

/** Local reminder instant: 09:00 on (next billing date − reminder days). Null if it has already passed. */
export function subscriptionReminderFireTime(nextBillingDate: string, reminderDays: number, now = Date.now()): Date | null {
  if (!isReminderDays(reminderDays)) return null;
  const reminderDay = addDaysISO(nextBillingDate, -reminderDays);
  if (!reminderDay) return null;
  const [year, month, day] = reminderDay.split('-').map(Number);
  const fire = new Date(year, month - 1, day, SUBSCRIPTION_REMINDER_HOUR, 0, 0, 0);
  return fire.getTime() > now ? fire : null;
}

export function amountCents(amount: number | string): number | null {
  const cents = Math.round(Number(amount) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/**
 * Average monthly cost of active subscriptions, in integer cents.
 * Monthly is exact; quarterly ÷ 3 and yearly ÷ 12 are averages; weekly uses 52 weeks ÷ 12 months.
 * Returns null when there is nothing active or any amount is unreadable, so no partial total is shown.
 */
export function monthlyEquivalentCents(subscriptions: readonly Pick<SubscriptionRecord, 'amount' | 'billing_frequency' | 'is_active'>[]): number | null {
  const active = subscriptions.filter((subscription) => subscription.is_active);
  if (!active.length) return null;
  let total = 0;
  for (const subscription of active) {
    const cents = amountCents(subscription.amount);
    if (cents === null || !isBillingFrequency(subscription.billing_frequency)) return null;
    total += subscription.billing_frequency === 'weekly' ? (cents * 52) / 12
      : subscription.billing_frequency === 'quarterly' ? cents / 3
        : subscription.billing_frequency === 'yearly' ? cents / 12 : cents;
  }
  return Math.round(total);
}

export function upcomingRenewals<T extends Pick<SubscriptionRecord, 'name' | 'next_billing_date' | 'is_active'>>(subscriptions: readonly T[], todayISO: string, windowDays = UPCOMING_WINDOW_DAYS): T[] {
  return subscriptions
    .filter((subscription) => {
      const days = daysUntil(subscription.next_billing_date, todayISO);
      return subscription.is_active && days !== null && days <= windowDays;
    })
    .sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date) || a.name.localeCompare(b.name));
}

type Named = Pick<SubscriptionRecord, 'name'> & { id?: string };
/** Deterministic tie-breaker for plans sharing a date: name, then id. */
function byNameThenId(a: Named, b: Named): number {
  return a.name.localeCompare(b.name) || (a.id ?? '').localeCompare(b.id ?? '');
}

/** Active subscriptions by nearest billing date (so overdue come first), then paused ones by name. */
export function sortSubscriptions<T extends Pick<SubscriptionRecord, 'name' | 'next_billing_date' | 'is_active'> & { id?: string }>(subscriptions: readonly T[]): T[] {
  return [...subscriptions].sort((a, b) => Number(b.is_active) - Number(a.is_active)
    || (a.is_active ? a.next_billing_date.localeCompare(b.next_billing_date) : 0)
    || byNameThenId(a, b));
}

/** Rows each overview section shows before "View all (N)". The full list is always kept for the sheet and totals. */
export const SUBSCRIPTION_PREVIEW_LIMIT = 5;
export type SubscriptionDateGroup<T> = { date: string; subscriptions: T[] };
export type RenewalDay = 'today' | 'tomorrow' | 'yesterday' | null;

/**
 * Groups already-sorted subscriptions by `next_billing_date` (a date-only string, so no time zone can move a
 * plan to another day). Groups keep the order of their first row and rows keep their order, so the caller's
 * sort (by date, or by urgency, which is also date order) decides everything. No empty group is ever made.
 * Apply any preview limit before grouping.
 */
export function groupSubscriptionsByDate<T extends Pick<SubscriptionRecord, 'next_billing_date'>>(subscriptions: readonly T[]): SubscriptionDateGroup<T>[] {
  const groups = new Map<string, SubscriptionDateGroup<T>>();
  for (const subscription of subscriptions) {
    const group = groups.get(subscription.next_billing_date) ?? { date: subscription.next_billing_date, subscriptions: [] };
    group.subscriptions.push(subscription);
    groups.set(subscription.next_billing_date, group);
  }
  return [...groups.values()];
}

/** "today", "tomorrow", or "yesterday" relative to the local date, otherwise null (show the full date). */
export function renewalDay(iso: string, todayISO: string): RenewalDay {
  const days = daysUntil(iso, todayISO);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : null;
}

export type ReminderPlanItem = { identifier: string; subscriptionId: string; fire: Date };

export function subscriptionReminderId(userId: string, subscriptionId: string) {
  return `unifyd-subscription-${userId}-${subscriptionId}`;
}

/** The one reminder each active, reminder-enabled subscription should have now. Paused, disabled, deleted, or past ones get none. */
export function planSubscriptionReminders(userId: string, subscriptions: readonly Pick<SubscriptionRecord, 'id' | 'is_active' | 'notifications_enabled' | 'next_billing_date' | 'reminder_days_before'>[], now = Date.now()): ReminderPlanItem[] {
  const plan: ReminderPlanItem[] = [];
  for (const subscription of subscriptions) {
    if (!subscription.is_active || !subscription.notifications_enabled) continue;
    const fire = subscriptionReminderFireTime(subscription.next_billing_date, subscription.reminder_days_before, now);
    if (fire) plan.push({ identifier: subscriptionReminderId(userId, subscription.id), subscriptionId: subscription.id, fire });
  }
  return plan;
}

/**
 * Compares scheduled reminders with the wanted ones (identifier → signature). Anything for another user,
 * no longer wanted, or with a changed time or text is cancelled; wanted ones not left in place are scheduled.
 */
export function reconcileReminders(userId: string, scheduled: readonly { identifier: string; userId: string; signature: string }[], wanted: ReadonlyMap<string, string>): { cancel: string[]; schedule: string[] } {
  const cancel: string[] = [];
  const kept = new Set<string>();
  for (const item of scheduled) {
    if (item.userId === userId && wanted.get(item.identifier) === item.signature && !kept.has(item.identifier)) kept.add(item.identifier);
    else cancel.push(item.identifier);
  }
  return { cancel, schedule: [...wanted.keys()].filter((identifier) => !kept.has(identifier)) };
}

const STATUS_PRIORITY: Record<RenewalStatus, number> = { overdue: 0, today: 1, soon: 2, later: 3 };

/**
 * Active subscriptions that need attention (overdue, renewing today, or within the reminder window used by
 * `renewalStatus`), highest priority first: overdue, then today, then soon; earlier dates first within each.
 * Every matching plan is returned (the overview previews the first five); an empty result means the section is left out.
 * Because overdue dates come before today and today before later dates, this order is also date order.
 */
export function attentionSubscriptions<T extends Pick<SubscriptionRecord, 'name' | 'next_billing_date' | 'reminder_days_before' | 'is_active'> & { id?: string }>(subscriptions: readonly T[], todayISO: string, limit = Infinity): { subscription: T; status: Exclude<RenewalStatus, 'later'> }[] {
  return subscriptions
    .filter((subscription) => subscription.is_active)
    .map((subscription) => ({ subscription, status: renewalStatus(subscription.next_billing_date, subscription.reminder_days_before, todayISO) }))
    .filter((entry): entry is { subscription: T; status: Exclude<RenewalStatus, 'later'> } => entry.status !== 'later')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
      || a.subscription.next_billing_date.localeCompare(b.subscription.next_billing_date)
      || byNameThenId(a.subscription, b.subscription))
    .slice(0, limit);
}
