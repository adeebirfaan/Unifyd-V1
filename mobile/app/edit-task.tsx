import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskForm } from '@/components/planner/TaskForm';
import type { TaskInput } from '@/components/planner/TaskForm';
import { TaskLoadCard, TaskPageHeader } from '@/components/planner/TaskPage';
import { spacing } from '@/constants/theme';
import { reminderFireTime } from '@/lib/reminderMath';
import { useTaskRecord } from '@/hooks/useTaskRecord';
import { supabase } from '@/lib/supabase';
import { syncTaskReminders } from '@/lib/taskReminders';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, task, reload } = useTaskRecord(typeof id === 'string' ? id : undefined);
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language } = useI18n();
  const insets = useSafeAreaInsets();

  async function save(input: TaskInput): Promise<boolean> {
    if (!task || !session) return false;
    const completedAt = input.status === 'completed'
      ? (task.status === 'completed' ? task.completed_at ?? new Date().toISOString() : new Date().toISOString())
      : null;
    try {
      const { data, error } = await supabase.from('tasks').update({
        title: input.title,
        subject: input.subject,
        description: input.description,
        deadline: input.deadline,
        priority: input.priority,
        status: input.status,
        completed_at: completedAt,
        ...(input.reminderOffsetMinutes !== null || task.reminder_offset_minutes !== undefined
          ? { reminder_offset_minutes: input.reminderOffsetMinutes } : {}),
      }).eq('id', task.id).eq('user_id', session.user.id).select('id').maybeSingle();
      if (error || !data) return false;
      const reminderResult = input.reminderOffsetMinutes !== null || task.reminder_offset_minutes != null
        ? await syncTaskReminders(session.user.id, language, input.reminderOffsetMinutes !== null && input.status !== 'completed') : 'ok';
      const passed = input.reminderOffsetMinutes !== null && input.status !== 'completed'
        && !reminderFireTime(input.deadline, input.reminderOffsetMinutes);
      router.replace({ pathname: '/(tabs)/planner', params: { updated: '1', reminderIssue: passed ? 'past' : reminderResult === 'ok' ? '' : reminderResult } });
      return true;
    } catch { return false; }
  }

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <TaskPageHeader titleKey="task.edit" helperKey="task.editHelper" />
        {state === 'ready' && task ? <TaskForm key={task.id} initial={task} onSave={save} editing /> : <TaskLoadCard state={state === 'ready' ? 'error' : state} onRetry={() => { void reload(); }} />}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' } });
