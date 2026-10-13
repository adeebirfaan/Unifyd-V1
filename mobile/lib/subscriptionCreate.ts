import type { SubscriptionReminderIssue } from '@/lib/subscriptionReminders';
import type { SubscriptionInput } from '@/lib/subscriptions';

export type CreateResult = { saved: false } | { saved: true; reminderIssue: SubscriptionReminderIssue };

/**
 * Saves a new subscription, then sets up its reminder. The two steps are separate on purpose: once the row is
 * saved the result is always `saved`, even when the reminder step fails or throws, so the student is never
 * asked to save again (which would create a second subscription). A failed reminder is retried on its own
 * with `retryReminder`, which never inserts anything.
 */
export async function createSubscription(
  input: SubscriptionInput,
  insert: (input: SubscriptionInput) => Promise<boolean>,
  refreshReminder: (input: SubscriptionInput) => Promise<SubscriptionReminderIssue>,
): Promise<CreateResult> {
  let saved = false;
  try { saved = await insert(input); } catch { saved = false; }
  if (!saved) return { saved: false };
  return { saved: true, reminderIssue: await retryReminder(input, refreshReminder) };
}

export async function retryReminder(input: SubscriptionInput, refreshReminder: (input: SubscriptionInput) => Promise<SubscriptionReminderIssue>): Promise<SubscriptionReminderIssue> {
  try { return await refreshReminder(input); } catch { return 'error'; }
}

/** Only a scheduling error or missing permission can be fixed by trying again; web and past times cannot. */
export function canRetryReminder(issue: SubscriptionReminderIssue): boolean {
  return issue === 'error' || issue === 'permissionDenied';
}
