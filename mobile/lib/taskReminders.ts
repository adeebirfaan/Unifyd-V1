import { Platform } from 'react-native';

import { translate } from '@/constants/i18n';
import type { LanguagePreference } from '@/constants/i18n';
import { colors } from '@/constants/theme';
import { isReminderOffset, reminderFireTime } from '@/lib/reminderMath';
import type { ReminderOffset } from '@/lib/reminderMath';
import { supabase } from '@/lib/supabase';

type ReminderTask = {
  id: string;
  user_id: string;
  title: string;
  deadline: string;
  status: string;
  reminder_offset_minutes: ReminderOffset;
};

type ReminderData = { unifydKind: 'task'; userId: string; taskId: string; deadline: string; offset: number; title: string; language: LanguagePreference };
export type ReminderSyncResult = 'ok' | 'permissionDenied' | 'unsupported' | 'error';
const CHANNEL_ID = 'unifyd-task-reminders';
const PAGE_SIZE = 500;
let syncQueue: Promise<unknown> = Promise.resolve();

function queue<T>(work: () => Promise<T>): Promise<T> {
  const result = syncQueue.then(work, work);
  syncQueue = result.catch(() => undefined);
  return result;
}

function notificationId(userId: string, taskId: string) {
  return `unifyd-task-${userId}-${taskId}`;
}

async function nativeNotifications() {
  if (Platform.OS === 'web') return null;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  return Notifications;
}

async function loadTasks(userId: string): Promise<ReminderTask[]> {
  const tasks: ReminderTask[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from('tasks')
      .select('*')
      .eq('user_id', userId).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as ReminderTask[];
    tasks.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return tasks;
}

function isTaskData(value: unknown): value is ReminderData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.unifydKind === 'task' && typeof data.userId === 'string' && typeof data.taskId === 'string';
}

export async function syncTaskReminders(userId: string, language: LanguagePreference, requestPermission = false): Promise<ReminderSyncResult> {
  return queue(async () => {
    try {
      const Notifications = await nativeNotifications();
      if (!Notifications) return 'unsupported';
      const tasks = await loadTasks(userId);
      const now = Date.now();
      const wanted = new Map<string, { task: ReminderTask; fire: Date; offset: number }>();
      for (const task of tasks) {
        const offset = task.reminder_offset_minutes;
        if (task.status === 'completed' || !isReminderOffset(offset) || offset === null) continue;
        const fire = reminderFireTime(task.deadline, offset, now);
        if (fire) wanted.set(notificationId(userId, task.id), { task, fire, offset });
      }
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const present = new Map<string, ReminderData>();
      for (const item of scheduled) {
        if (!isTaskData(item.content.data)) continue;
        const data = item.content.data;
        const expected = wanted.get(item.identifier);
        const usesLegacyChannel = Platform.OS === 'android' && item.trigger &&
          'channelId' in item.trigger && item.trigger.channelId === 'academic-tasks';
        if (data.userId !== userId || !expected || data.taskId !== expected.task.id || data.deadline !== expected.task.deadline || data.offset !== expected.offset || data.title !== expected.task.title || data.language !== language || usesLegacyChannel) {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
        } else present.set(item.identifier, data);
      }
      if (wanted.size === present.size) return 'ok';
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: translate(language, 'reminder.channelName'),
          description: translate(language, 'reminder.channelDescription'),
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 120, 250],
          lightColor: colors.brandBlue,
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) return 'permissionDenied';
      for (const [identifier, { task, fire, offset }] of wanted) {
        if (present.has(identifier)) continue;
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: translate(language, 'reminder.notificationTitle'),
            body: translate(language, offset === 0 ? 'reminder.notificationDueNow' : 'reminder.notificationBody', { title: task.title }),
            ...(Platform.OS === 'android' ? { color: colors.brandBlue } : {}),
            data: { unifydKind: 'task', userId, taskId: task.id, deadline: task.deadline, offset, title: task.title, language },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire, ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}) },
        });
      }
      return 'ok';
    } catch { return 'error'; }
  });
}

export async function clearTaskReminders(): Promise<void> {
  await queue(async () => {
    try {
      const Notifications = await nativeNotifications();
      if (!Notifications) return;
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const item of scheduled) {
        if (isTaskData(item.content.data)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    } catch { /* A failed cleanup is retried on next launch or sign-in. */ }
  });
}

export async function observeTaskReminderTaps(userId: string, openTask: (taskId: string) => void): Promise<() => void> {
  const Notifications = await nativeNotifications();
  if (!Notifications) return () => undefined;
  function handle(response: { notification: { request: { content: { data?: unknown } } } }) {
    const data = response.notification.request.content.data;
    if (isTaskData(data) && data.userId === userId) openTask(data.taskId);
  }
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  const initial = Notifications.getLastNotificationResponse();
  if (initial) {
    handle(initial);
    Notifications.clearLastNotificationResponse();
  }
  return () => listener.remove();
}
