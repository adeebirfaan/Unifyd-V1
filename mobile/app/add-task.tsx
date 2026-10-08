import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskForm } from '@/components/planner/TaskForm';
import type { TaskInput } from '@/components/planner/TaskForm';
import { TaskPageHeader } from '@/components/planner/TaskPage';
import { spacing } from '@/constants/theme';
import { reminderFireTime } from '@/lib/reminderMath';
import { supabase } from '@/lib/supabase';
import { syncTaskReminders } from '@/lib/taskReminders';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function AddTaskScreen() {
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language } = useI18n();
  const insets = useSafeAreaInsets();

  async function save(input: TaskInput): Promise<boolean> {
    if (!session) return false;
    try {
      const { data, error } = await supabase.from('tasks').insert({
        user_id: session.user.id,
        title: input.title,
        subject: input.subject,
        description: input.description,
        deadline: input.deadline,
        priority: input.priority,
        ...(input.reminderOffsetMinutes !== null ? { reminder_offset_minutes: input.reminderOffsetMinutes } : {}),
      }).select('id').single();
      if (error || !data) return false;
      // INSERT permissions deliberately exclude status/completed_at. Set a
      // non-default initial status through the separate permitted UPDATE path.
      if (input.status !== 'pending') {
        const changed = await supabase.from('tasks').update({
          status: input.status,
          completed_at: input.status === 'completed' ? new Date().toISOString() : null,
        }).eq('id', data.id).eq('user_id', session.user.id).select('id').maybeSingle();
        if (changed.error || !changed.data) {
          await supabase.from('tasks').delete().eq('id', data.id).eq('user_id', session.user.id);
          return false;
        }
      }
      const reminderResult = input.reminderOffsetMinutes !== null && input.status !== 'completed'
        ? await syncTaskReminders(session.user.id, language, true) : 'ok';
      const passed = input.reminderOffsetMinutes !== null && input.status !== 'completed'
        && !reminderFireTime(input.deadline, input.reminderOffsetMinutes);
      router.replace({ pathname: '/(tabs)/planner', params: { saved: '1', reminderIssue: passed ? 'past' : reminderResult === 'ok' ? '' : reminderResult } });
      return true;
    } catch { return false; }
  }

  return <KeyboardAvoidingView style={[styles.fill, { backgroundColor: tokens.screenBackground }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.space4, paddingBottom: insets.bottom + spacing.space8 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}><TaskPageHeader titleKey="task.add" helperKey="task.addHelper" /><TaskForm onSave={save} /></View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.space6 }, inner: { width: '100%', maxWidth: 520, alignSelf: 'center' } });
