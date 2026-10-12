import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PoofAvatar } from '@/components/mascot/PoofAvatar';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { PoofActionId, PoofNotice } from '@/lib/poofEngine';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type PoofReplyMessage = { id: string; role: 'poof'; text: string; details: string[]; actions: PoofActionId[]; notice: PoofNotice; source: 'ai' | 'rules' | 'greeting' };
export type PoofChatMessage = { id: string; role: 'user'; text: string } | PoofReplyMessage;

type IconName = ComponentProps<typeof Ionicons>['name'];
export const ACTION_ICONS: Record<PoofActionId, IconName> = {
  openWallet: 'wallet-outline', setBudget: 'pie-chart-outline', addExpense: 'add-circle-outline', openPlanner: 'calendar-outline',
  addTask: 'create-outline', mySemester: 'school-outline', openTimetable: 'time-outline', openMind: 'heart-outline', completeProfile: 'person-outline',
};

// Malaysian support lines shown for crisis messages. Tapping one opens the phone dialler; nothing is called automatically.
const SUPPORT_LINES = [
  { key: 'poof.crisis.emergency', tel: '999' },
  { key: 'poof.crisis.befrienders', tel: '0376272929' },
  { key: 'poof.crisis.heal', tel: '15555' },
] as const satisfies readonly { key: TranslationKey; tel: string }[];

export function PoofActionButton({ id, onPress }: { id: PoofActionId; onPress: (id: PoofActionId) => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(id)} style={({ pressed }) => [styles.action, { borderColor: tokens.brandCyan }, pressed && styles.pressed]}>
      <Ionicons name={ACTION_ICONS[id]} size={16} color={tokens.brandCyan} />
      <Text style={[styles.actionText, { color: tokens.brandCyan }]}>{t(`poof.action.${id}` as TranslationKey)}</Text>
    </Pressable>
  );
}

function CrisisCard() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return (
    <View testID="poof-crisis" accessibilityRole="alert" style={[styles.notice, styles.crisis]}>
      <View style={styles.noticeHeader}>
        <Ionicons name="heart" size={18} color={colors.danger} />
        <Text style={[styles.noticeTitle, { color: tokens.cardText }]}>{t('poof.notice.crisisTitle')}</Text>
      </View>
      <Text style={[styles.noticeBody, { color: tokens.cardText }]}>{t('poof.notice.crisisBody')}</Text>
      {SUPPORT_LINES.map((line) => (
        <Pressable key={line.tel} accessibilityRole="link" accessibilityLabel={t('poof.call', { name: t(line.key) })}
          onPress={() => { Linking.openURL(`tel:${line.tel}`).catch(() => undefined); }} style={({ pressed }) => [styles.line, pressed && styles.pressed]}>
          <Ionicons name="call-outline" size={16} color={tokens.brandCyan} />
          <Text style={[styles.lineText, { color: tokens.brandCyan }]}>{t(line.key)}</Text>
        </Pressable>
      ))}
      <Text style={[styles.noticeBody, { color: tokens.cardMutedText }]}>{t('poof.crisis.campus')}</Text>
    </View>
  );
}

export function PoofMessage({ message, onAction }: { message: PoofChatMessage; onAction: (id: PoofActionId) => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  if (message.role === 'user') {
    return (
      <View testID="poof-message-user" accessible accessibilityLabel={t('poof.youSaid', { text: message.text })} style={[styles.bubble, styles.user, { backgroundColor: tokens.brandBlue }]}>
        <Text style={[styles.text, styles.userText]}>{message.text}</Text>
      </View>
    );
  }
  return (
    <View testID="poof-message-poof" style={styles.poofRow}>
      <PoofAvatar size={28} />
      <View style={styles.poofColumn}>
        <View accessible accessibilityLabel={t('poof.poofSaid', { text: [message.text, ...message.details].join(' ') })}
          style={[styles.bubble, styles.poof, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
          <Text style={[styles.text, { color: tokens.cardText }]}>{message.text}</Text>
          {message.details.length > 0 && <View style={styles.details}>
            {message.details.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                <View style={[styles.dot, { backgroundColor: tokens.brandCyan }]} />
                <Text style={[styles.detailText, { color: tokens.cardText }]}>{detail}</Text>
              </View>
            ))}
          </View>}
          {message.source !== 'greeting' && <Text style={[styles.source, { color: tokens.cardMutedText }]}>{t(message.source === 'ai' ? 'poof.source.ai' : 'poof.source.rules')}</Text>}
        </View>
        {message.notice === 'crisis' && <CrisisCard />}
        {message.notice === 'support' && <View style={[styles.notice, { borderColor: tokens.border }]}>
          <View style={styles.noticeHeader}>
            <Ionicons name="leaf-outline" size={18} color={colors.success} />
            <Text style={[styles.noticeTitle, { color: tokens.cardText }]}>{t('poof.notice.supportTitle')}</Text>
          </View>
          <Text style={[styles.noticeBody, { color: tokens.cardMutedText }]}>{t('poof.notice.supportBody')}</Text>
        </View>}
        {message.notice === 'scope' && <View style={[styles.notice, styles.scope, { borderColor: tokens.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={tokens.cardMutedText} />
          <Text style={[styles.noticeBody, styles.flex, { color: tokens.cardMutedText }]}>{t('poof.notice.scope')}</Text>
        </View>}
        {message.actions.length > 0 && <View style={styles.actions}>
          {message.actions.map((id) => <PoofActionButton key={id} id={id} onPress={onAction} />)}
        </View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, gap: spacing.space2 },
  user: { alignSelf: 'flex-end', maxWidth: '85%', borderBottomRightRadius: spacing.space1 },
  userText: { color: colors.white },
  poofRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2, maxWidth: '100%' },
  poofColumn: { flex: 1, gap: spacing.space2 },
  poof: { borderWidth: 1, borderTopLeftRadius: spacing.space1 },
  text: { ...typography.body, lineHeight: 22 },
  details: { gap: spacing.space1 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  detailText: { ...typography.body, fontSize: 15, lineHeight: 21, flex: 1 },
  source: { ...typography.label, fontWeight: '500', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space2, borderWidth: 1, borderRadius: radius.radiusFull, paddingHorizontal: spacing.space4, backgroundColor: 'rgba(52,193,252,0.08)' },
  actionText: { ...typography.label, fontSize: 14 },
  pressed: { opacity: 0.75 },
  notice: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space3, gap: spacing.space2 },
  crisis: { borderColor: 'rgba(239,68,68,0.55)', backgroundColor: 'rgba(239,68,68,0.10)' },
  scope: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  noticeTitle: { ...typography.body, fontWeight: '700', flex: 1 },
  noticeBody: { ...typography.label, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  line: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  lineText: { ...typography.body, fontWeight: '600', fontSize: 15 },
});
