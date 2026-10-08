import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { TaskLoadCard, TaskPageHeader } from '@/components/planner/TaskPage';
import { radius, spacing, typography } from '@/constants/theme';
import { useTaskRecord } from '@/hooks/useTaskRecord';
import { isReminderOffset, reminderLabelKey } from '@/lib/reminderMath';
import { formatTaskDeadline, isOverdue } from '@/lib/tasks';
import { supabase } from '@/lib/supabase';
import { syncTaskReminders } from '@/lib/taskReminders';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, task, reload } = useTaskRecord(typeof id === 'string' ? id : undefined);
  const { session } = useAuth();
  const { tokens } = useAppearance();
  const { language, t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<'status' | 'delete' | null>(null);

  async function toggleComplete() {
    if (!task || !session || busy) return;
    setBusy(true);
    setActionError(null);
    const completing = task.status !== 'completed';
    try {
      const { data, error } = await supabase.from('tasks').update({
        status: completing ? 'completed' : 'pending',
        completed_at: completing ? new Date().toISOString() : null,
      }).eq('id', task.id).eq('user_id', session.user.id).select('id').maybeSingle();
      if (error || !data) { setActionError('status'); return; }
      const result = task.reminder_offset_minutes != null
        ? await syncTaskReminders(session.user.id, language, !completing) : 'ok';
      router.replace({ pathname: '/(tabs)/planner', params: { statusChanged: completing ? 'completed' : 'reopened', reminderIssue: result === 'ok' || (completing && result === 'unsupported') ? '' : completing ? 'updateError' : result } });
    } catch { setActionError('status'); }
    finally { setBusy(false); }
  }

  async function deleteTask() {
    if (!task || !session || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const { data, error } = await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', session.user.id).select('id').maybeSingle();
      if (error || !data) { setActionError('delete'); return; }
      const reminderResult = task.reminder_offset_minutes != null
        ? await syncTaskReminders(session.user.id, language) : 'ok';
      setConfirm(false);
      router.replace({ pathname: '/(tabs)/planner', params: { deleted: '1', reminderIssue: reminderResult === 'ok' || reminderResult === 'unsupported' ? '' : 'updateError' } });
    } catch { setActionError('delete'); }
    finally { setBusy(false); }
  }

  const overdue = task ? isOverdue(task) : false;
  return <Screen>
    <TaskPageHeader titleKey="task.detail" />
    {state === 'ready' && task ? <>
      <View style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
        <View style={styles.chips}>
          <Text style={[styles.chip, { color: tokens.brandCyan, backgroundColor: tokens.cardElevated }]}>{t(`task.${task.priority}`)}</Text>
          <Text style={[styles.chip, { color: tokens.cardText, backgroundColor: tokens.cardElevated }]}>{t(`task.${task.status}`)}</Text>
          {overdue && <Text style={[styles.chip, { color: tokens.cardErrorText, backgroundColor: tokens.cardElevated }]}>{t('task.overdue')}</Text>}
        </View>
        <Text style={[styles.title, { color: tokens.cardText }]}>{task.title}</Text>
        <Text style={[styles.subject, { color: tokens.cardMutedText }]}>{task.subject}</Text>
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <View style={styles.dateRow}><Ionicons name="calendar-outline" size={20} color={overdue ? tokens.cardErrorText : tokens.brandCyan} /><Text style={[styles.body, { color: overdue ? tokens.cardErrorText : tokens.cardText }]}>{formatTaskDeadline(task.deadline, language)}</Text></View>
        <View style={styles.dateRow}><Ionicons name="notifications-outline" size={20} color={tokens.brandCyan} /><Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('task.reminder')}: {t(reminderLabelKey(isReminderOffset(task.reminder_offset_minutes) ? task.reminder_offset_minutes : null))}</Text></View>
        {task.description?.trim() ? <Text style={[styles.body, { color: tokens.cardMutedText }]}>{task.description.trim()}</Text> : null}
      </View>
      {actionError === 'status' && <Text style={[styles.error, { color: tokens.errorText }]} accessibilityRole="alert">{t('task.statusError')}</Text>}
      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push({ pathname: '/edit-task', params: { id: task.id } })} disabled={busy}>{t('task.edit')}</PrimaryButton>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => { void toggleComplete(); }} style={[styles.secondaryButton, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
          {busy && !confirm ? <ActivityIndicator color={tokens.brandCyan} /> : <Text style={[styles.buttonText, { color: tokens.cardText }]}>{task.status === 'completed' ? t('task.reopen') : t('task.markComplete')}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { setActionError(null); setConfirm(true); }} style={[styles.secondaryButton, { backgroundColor: tokens.destructiveBackground }]}>
          <Ionicons name="trash-outline" size={20} color={tokens.destructiveForeground} /><Text style={[styles.buttonText, { color: tokens.destructiveForeground }]}>{t('task.delete')}</Text>
        </Pressable>
      </View>
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirm(false); }}>
        <View style={styles.modalRoot}>
          <Pressable style={[styles.scrim, { backgroundColor: tokens.modalScrim }]} disabled={busy} onPress={() => setConfirm(false)} accessibilityLabel={t('task.cancel')} />
          <View style={[styles.dialog, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]} accessibilityViewIsModal>
            <Text style={[styles.dialogTitle, { color: tokens.cardText }]}>{t('task.deleteConfirm')}</Text>
            <Text style={[styles.body, { color: tokens.cardMutedText }]}>{t('task.deleteBody', { title: task.title })}</Text>
            {actionError === 'delete' && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{t('task.deleteError')}</Text>}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setConfirm(false)} style={[styles.dialogButton, { borderColor: tokens.border, borderWidth: 1, backgroundColor: tokens.cardElevated }]}><Text style={[styles.buttonText, { color: tokens.cardText }]}>{t('task.cancel')}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => { void deleteTask(); }} style={[styles.dialogButton, { backgroundColor: tokens.destructiveBackground }]}>{busy ? <ActivityIndicator color={tokens.destructiveForeground} /> : <Text style={[styles.buttonText, { color: tokens.destructiveForeground }]}>{t('task.delete')}</Text>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </> : <TaskLoadCard state={state === 'ready' ? 'error' : state} onRetry={() => { void reload(); }} />}
  </Screen>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space6, gap: spacing.space4 },
  chips: { flexDirection: 'row', gap: spacing.space2, flexWrap: 'wrap' }, chip: { ...typography.label, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space3, paddingVertical: spacing.space2, overflow: 'hidden' },
  title: { ...typography.screenTitle }, subject: { ...typography.body }, divider: { height: 1 }, dateRow: { flexDirection: 'row', gap: spacing.space3, alignItems: 'center' }, body: { ...typography.body, lineHeight: 23 },
  actions: { gap: spacing.space3, marginTop: spacing.space6 }, secondaryButton: { minHeight: 54, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', gap: spacing.space2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space4 }, buttonText: { ...typography.body, fontWeight: '700' }, error: { ...typography.label, marginTop: spacing.space3 },
  modalRoot: { flex: 1, justifyContent: 'center', padding: spacing.space5 }, scrim: { ...StyleSheet.absoluteFill }, dialog: { width: '100%', maxWidth: 420, alignSelf: 'center', borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space4 }, dialogTitle: { ...typography.sectionTitle }, dialogActions: { flexDirection: 'row', gap: spacing.space3 }, dialogButton: { flex: 1, minHeight: 50, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 },
});
