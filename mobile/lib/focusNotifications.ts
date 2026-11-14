import { Platform } from 'react-native';

import { translate } from '@/constants/i18n';
import type { LanguagePreference } from '@/constants/i18n';
import { colors } from '@/constants/theme';
import { focusAlerts } from '@/lib/focusTimer';
import type { FocusState } from '@/lib/focusTimer';
import { loadFocusState } from '@/lib/focusStorage';

/**
 * Local alerts for Unifyd Focus: one when a focus block ends and one when the break after it ends, scheduled from
 * the timer's own end times, so they arrive while the phone is locked or the app is closed. The timer never
 * depends on them: a denied permission or the web just means no alert. Alert text never names a subject or task.
 */
export type FocusAlertResult = 'ok' | 'permissionDenied' | 'unsupported' | 'error';
type FocusAlertData = { unifydKind: 'focus'; userId: string; kind: 'focusDone' | 'breakDone' };
const CHANNEL_ID = 'unifyd-focus';
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

function isFocusData(value: unknown): value is FocusAlertData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.unifydKind === 'focus' && typeof data.userId === 'string';
}

/** Replaces any scheduled focus alerts with the ones this state needs. Permission is asked only on Start or Resume. */
export async function syncFocusAlerts(userId: string, state: FocusState, language: LanguagePreference, requestPermission = false): Promise<FocusAlertResult> {
  return queue(async () => {
    try {
      const Notifications = await nativeNotifications();
      if (!Notifications) return 'unsupported';
      for (const item of await Notifications.getAllScheduledNotificationsAsync()) {
        if (isFocusData(item.content.data)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
      const now = Date.now();
      const alerts = focusAlerts(state).filter((alert) => alert.at > now);
      if (!alerts.length) return 'ok';
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: translate(language, 'focus.channelName'),
          description: translate(language, 'focus.channelDescription'),
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: colors.brandBlue,
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return 'permissionDenied';
      for (const alert of alerts) {
        const done = alert.kind === 'focusDone';
        await Notifications.scheduleNotificationAsync({
          identifier: `unifyd-focus-${alert.kind}`,
          content: {
            title: translate(language, done ? 'focus.alertFocusTitle' : 'focus.alertBreakTitle'),
            body: translate(language, done ? 'focus.alertFocusBody' : 'focus.alertBreakBody'),
            ...(Platform.OS === 'android' ? { color: colors.brandBlue } : {}),
            data: { unifydKind: 'focus', userId, kind: alert.kind },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(alert.at), ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
        });
      }
      return 'ok';
    } catch { return 'error'; }
  });
}

/** Re-schedules from the stored state (app start, sign-in, language change); never asks for permission. */
export async function refreshFocusAlerts(userId: string, language: LanguagePreference): Promise<void> {
  const state = await loadFocusState(userId);
  if (state) await syncFocusAlerts(userId, state, language);
}

export async function clearFocusAlerts(): Promise<void> {
  await queue(async () => {
    try {
      const Notifications = await nativeNotifications();
      if (!Notifications) return;
      for (const item of await Notifications.getAllScheduledNotificationsAsync()) {
        if (isFocusData(item.content.data)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    } catch { /* A failed cleanup is retried on the next sign-in or app start. */ }
  });
}

/** Tapping a focus alert opens Unifyd Focus for the signed-in student. */
export async function observeFocusAlertTaps(userId: string, openFocus: () => void): Promise<() => void> {
  const Notifications = await nativeNotifications();
  if (!Notifications) return () => undefined;
  function handle(response: { notification: { request: { content: { data?: unknown } } } }) {
    const data = response.notification.request.content.data;
    if (isFocusData(data) && data.userId === userId) { openFocus(); return true; }
    return false;
  }
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  const initial = Notifications.getLastNotificationResponse();
  if (initial && handle(initial)) Notifications.clearLastNotificationResponse();
  return () => listener.remove();
}
