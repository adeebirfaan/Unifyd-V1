import { Platform } from 'react-native';

import { translate } from '@/constants/i18n';
import type { LanguagePreference } from '@/constants/i18n';
import { colors } from '@/constants/theme';
import { formatExpenseDate, formatRinggit } from '@/lib/expenseHistory';
import { planSubscriptionReminders, reconcileReminders, subscriptionReminderFireTime } from '@/lib/subscriptions';
import type { SubscriptionRecord } from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import type { ReminderSyncResult } from '@/lib/taskReminders';

type ReminderSubscription = Pick<SubscriptionRecord, 'id' | 'name' | 'amount' | 'next_billing_date' | 'reminder_days_before' | 'is_active' | 'notifications_enabled'>;
// Notes are deliberately never loaded or placed in a notification.
type ReminderData = { unifydKind: 'subscription'; userId: string; subscriptionId: string; signature: string };
const CHANNEL_ID = 'unifyd-subscription-reminders';
const PAGE_SIZE = 500;
let syncQueue: Promise<unknown> = Promise.resolve();

function queue<T>(work: () => Promise<T>): Promise<T> {
  const result = syncQueue.then(work, work);
  syncQueue = result.catch(() => undefined);
  return result;
}

async function nativeNotifications() {
  if (Platform.OS === 'web') return null;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  return Notifications;
}

// Every subscription is loaded so the pure plan decides which ones get a reminder.
async function loadSubscriptions(userId: string): Promise<ReminderSubscription[]> {
  const rows: ReminderSubscription[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('subscriptions')
      .select('id,name,amount,next_billing_date,reminder_days_before,is_active,notifications_enabled')
      .eq('user_id', userId)
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as ReminderSubscription[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function isSubscriptionData(value: unknown): value is ReminderData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.unifydKind === 'subscription' && typeof data.userId === 'string' && typeof data.subscriptionId === 'string';
}

function content(subscription: ReminderSubscription, language: LanguagePreference) {
  const values = { name: subscription.name, amount: formatRinggit(Number(subscription.amount)), date: formatExpenseDate(subscription.next_billing_date, language) };
  return {
    title: translate(language, 'subscription.notificationTitle'),
    body: translate(language, subscription.reminder_days_before === 0 ? 'subscription.notificationToday' : 'subscription.notificationBody', values),
  };
}

/** Reconciles scheduled local reminders with the student's active, reminder-enabled subscriptions. */
export async function syncSubscriptionReminders(userId: string, language: LanguagePreference, requestPermission = false): Promise<ReminderSyncResult> {
  return queue(async () => {
    try {
      const Notifications = await nativeNotifications();
      if (!Notifications) return 'unsupported';
      const subscriptions = await loadSubscriptions(userId);
      const byId = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
      const wanted = new Map<string, { subscription: ReminderSubscription; fire: Date; signature: string; text: { title: string; body: string } }>();
      for (const item of planSubscriptionReminders(userId, subscriptions)) {
        const subscription = byId.get(item.subscriptionId)!;
        const text = content(subscription, language);
        wanted.set(item.identifier, { subscription, fire: item.fire, text, signature: `${item.fire.toISOString()}|${text.title}|${text.body}` });
      }
      const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).flatMap((item) => isSubscriptionData(item.content.data)
        ? [{ identifier: item.identifier, userId: item.content.data.userId, signature: String(item.content.data.signature) }] : []);
      const { cancel, schedule } = reconcileReminders(userId, scheduled, new Map([...wanted].map(([identifier, entry]) => [identifier, entry.signature])));
      for (const identifier of cancel) await Notifications.cancelScheduledNotificationAsync(identifier);
      if (!schedule.length) return 'ok';
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: translate(language, 'subscription.channelName'),
          description: translate(language, 'subscription.channelDescription'),
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: colors.brandBlue,
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return 'permissionDenied';
      for (const identifier of schedule) {
        const { subscription, fire, text, signature } = wanted.get(identifier)!;
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            ...text,
            ...(Platform.OS === 'android' ? { color: colors.brandBlue } : {}),
            data: { unifydKind: 'subscription', userId, subscriptionId: subscription.id, signature },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
        });
      }
      return 'ok';
    } catch { return 'error'; }
  });
}

export async function clearSubscriptionReminders(): Promise<void> {
  await queue(async () => {
    try {
      const Notifications = await nativeNotifications();
      if (!Notifications) return;
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const item of scheduled) {
        if (isSubscriptionData(item.content.data)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    } catch { /* A failed cleanup is retried on next launch or sign-in. */ }
  });
}

export async function observeSubscriptionReminderTaps(userId: string, openSubscriptions: () => void): Promise<() => void> {
  const Notifications = await nativeNotifications();
  if (!Notifications) return () => undefined;
  function handle(response: { notification: { request: { content: { data?: unknown } } } }) {
    const data = response.notification.request.content.data;
    if (isSubscriptionData(data) && data.userId === userId) { openSubscriptions(); return true; }
    return false;
  }
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  const initial = Notifications.getLastNotificationResponse();
  if (initial && handle(initial)) Notifications.clearLastNotificationResponse();
  return () => listener.remove();
}

export type SubscriptionReminderIssue = '' | 'past' | 'permissionDenied' | 'unsupported' | 'error';
type ReminderSettings = { is_active: boolean; notifications_enabled: boolean; next_billing_date: string; reminder_days_before: number };

/**
 * Re-syncs after a create, edit, pause/resume, renewal, or delete. Permission is requested only when this
 * subscription wants a reminder; turning reminders off or pausing just cancels it. Returns a notice to show.
 */
export async function refreshSubscriptionReminder(userId: string, language: LanguagePreference, settings: ReminderSettings | null): Promise<SubscriptionReminderIssue> {
  const wantsReminder = !!settings && settings.is_active && settings.notifications_enabled;
  const result = await syncSubscriptionReminders(userId, language, wantsReminder);
  // Cancellation failures are retried by the next app-start or foreground sync.
  if (!wantsReminder) return '';
  if (!subscriptionReminderFireTime(settings.next_billing_date, settings.reminder_days_before)) return 'past';
  return result === 'ok' ? '' : result;
}
