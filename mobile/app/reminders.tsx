import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { TaskPageHeader } from '@/components/planner/TaskPage';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { buildReminderHistory } from '@/lib/reminderHistory';
import type { ReminderHistoryTask, ReminderItem } from '@/lib/reminderHistory';
import { reminderLabelKey } from '@/lib/reminderMath';
import { supabase } from '@/lib/supabase';
import { formatTaskDeadline } from '@/lib/tasks';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const PAGE_SIZE = 500;
type History = ReturnType<typeof buildReminderHistory>;
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; history: History };

export default function RemindersScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (pull = false) => {
    const version = ++request.current;
    if (pull) setRefreshing(true); else setState({ status: 'loading' });
    try {
      if (!userId) throw new Error('No session');
      const tasks: ReminderHistoryTask[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from('tasks')
          .select('id,title,subject,deadline,status,completed_at,reminder_offset_minutes')
          .eq('user_id', userId).not('reminder_offset_minutes', 'is', null)
          .order('id').range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        tasks.push(...(data ?? []) as ReminderHistoryTask[]);
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
      if (version === request.current) setState({ status: 'ready', history: buildReminderHistory(tasks) });
    } catch {
      if (version === request.current) setState({ status: 'error' });
    } finally {
      if (version === request.current) setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++request.current; };
  }, [load]));

  const section = (titleKey: TranslationKey, emptyKey: TranslationKey, items: ReminderItem[], testID: string) => (
    <View testID={testID} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tokens.screenText }]}>{t(titleKey)}</Text>
      {items.length === 0
        ? <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t(emptyKey)}</Text></View>
        : items.map((item) => {
          const fireTime = formatTaskDeadline(item.fireAt, language);
          return <Pressable key={item.taskId} accessibilityRole="button" accessibilityLabel={t('reminders.openTask', { title: item.title, time: fireTime })}
            onPress={() => router.push({ pathname: '/task-detail', params: { id: item.taskId } })}
            style={[styles.item, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: tokens.cardElevated }]}><Ionicons name="notifications-outline" size={19} color={tokens.brandCyan} /></View>
            <View style={styles.itemCopy}>
              <Text style={[styles.itemTitle, { color: tokens.cardText }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.meta, { color: tokens.cardMutedText }]} numberOfLines={1}>{item.subject}</Text>
              <Text style={[styles.meta, { color: tokens.cardText }]}>{t('reminders.fireAt', { time: fireTime })} · {t(reminderLabelKey(item.offset))}</Text>
              <Text style={[styles.meta, { color: tokens.cardMutedText }]}>{t('reminders.due', { time: formatTaskDeadline(item.deadline, language) })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.cardMutedText} />
          </Pressable>;
        })}
    </View>
  );

  return <ScrollView style={{ backgroundColor: tokens.screenBackground }}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={tokens.brandCyan} colors={[tokens.brandBlue]} />}>
    <TaskPageHeader titleKey="reminders.title" helperKey="reminders.helper" />
    {state.status === 'loading' && <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><ActivityIndicator color={tokens.brandCyan} /><Text style={[styles.muted, { color: tokens.cardMutedText }]}>{t('reminders.loading')}</Text></View>}
    {state.status === 'error' && <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}><Text style={[styles.muted, { color: tokens.cardText }]} accessibilityRole="alert">{t('reminders.loadError')}</Text><PrimaryButton onPress={() => { void load(); }}>{t('reminders.retry')}</PrimaryButton></View>}
    {state.status === 'ready' && <>
      {section('reminders.upcoming', 'reminders.upcomingEmpty', state.history.upcoming, 'reminders-upcoming')}
      {section('reminders.past', 'reminders.pastEmpty', state.history.past, 'reminders-past')}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 568, alignSelf: 'center', paddingHorizontal: spacing.space6 },
  section: { gap: spacing.space3, marginBottom: spacing.space6 },
  sectionTitle: { ...typography.sectionTitle },
  card: { borderRadius: radius.radiusLg, borderWidth: 1, padding: spacing.space5, gap: spacing.space4 },
  muted: { ...typography.body, lineHeight: 22 },
  item: { borderRadius: radius.radiusMd, borderWidth: 1, padding: spacing.space4, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, minHeight: 72 },
  iconWrap: { width: 40, height: 40, borderRadius: radius.radiusSm, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, gap: spacing.space1 },
  itemTitle: { ...typography.body, fontWeight: '700' },
  meta: { ...typography.label, lineHeight: 18 },
});
