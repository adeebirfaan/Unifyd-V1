import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { POOF_ASPECT, POOF_IMAGE, PoofMascot } from '@/components/mascot/PoofMascot';
import type { TranslationKey } from '@/constants/i18n';
import { radius, spacing, typography } from '@/constants/theme';
import { focusDuration } from '@/lib/focusInsights';
import type { FocusSuggestion } from '@/lib/focusInsights';
import type { FocusReflection } from '@/lib/focusStorage';
import type { CompanionMessage, CompanionPose } from '@/lib/focusTimer';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const SIZE = 40;
const MESSAGES: Record<CompanionMessage, TranslationKey> = {
  ready: 'focus.poofReady', readyNext: 'focus.poofReadyNext', focus: 'focus.poofFocus', paused: 'focus.poofPaused',
  break: 'focus.poofBreak', longBreak: 'focus.poofLongBreak', celebrate: 'focus.poofCelebrate',
};
const REFLECTIONS: { value: FocusReflection; key: TranslationKey }[] = [
  { value: 'great', key: 'focus.reflectGreat' }, { value: 'okay', key: 'focus.reflectOkay' },
  { value: 'struggled', key: 'focus.reflectStruggled' }, { value: 'tired', key: 'focus.reflectTired' },
];

/** The sentence for one suggestion, from recorded facts only (durations rounded down). */
export function useSuggestionText() {
  const { t } = useI18n();
  const duration = (seconds: number) => {
    const { hours, minutes } = focusDuration(seconds);
    return hours ? t('focus.durationHM', { hours, minutes }) : t('focus.durationM', { minutes });
  };
  return (suggestion: FocusSuggestion): string => {
    switch (suggestion.kind) {
      // A long title is shortened so Poof's line stays a few lines long on a narrow phone.
      case 'dueSoon': return t(suggestion.when === 'today' ? 'focus.suggestDueToday' : 'focus.suggestDueTomorrow', { title: suggestion.title.length > 48 ? `${suggestion.title.slice(0, 47).trimEnd()}…` : suggestion.title });
      case 'goalReached': return t(suggestion.period === 'day' ? 'focus.suggestGoalReachedDay' : 'focus.suggestGoalReachedWeek');
      case 'goalNear': return t(suggestion.period === 'day' ? 'focus.suggestGoalNearDay' : 'focus.suggestGoalNearWeek', { left: duration(suggestion.leftSeconds) });
      case 'todayMilestone': return t('focus.suggestToday', { duration: duration(suggestion.seconds) });
      case 'subjectGap': return t('focus.suggestSubjectGap', { subject: suggestion.subject });
      case 'starter': return t('focus.suggestStarter');
    }
  };
}

/** Poof without movement: the same approved image on the same disc, for focus rounds and pauses. */
function StillPoof() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View testID="focus-poof-still" accessible accessibilityRole="image" accessibilityLabel={t('focus.poofLabel')} style={[styles.disc, { width: SIZE * 1.18, height: SIZE * 1.18, borderRadius: SIZE, backgroundColor: tokens.mascotBackdrop }]}>
    <Image source={POOF_IMAGE} resizeMode="contain" style={{ width: SIZE * POOF_ASPECT, height: SIZE }} />
  </View>;
}

/**
 * Poof's compact row under the timer (Phase 5): the official mascot, one short message, and a hide button.
 * Poof holds still while focusing or paused, floats gently when ready and on breaks (the shared idle loop), and plays
 * the shared celebration once when a round completes. Reduced motion keeps every pose still (handled by PoofMascot).
 * Hidden, it shrinks to a single "Show Poof" button. Poof is never interactive here, so it cannot distract or
 * trigger anything; a ready-state suggestion may carry one action.
 */
export function FocusCompanion({ pose, message, suggestion, hidden, onToggle, onAction }: {
  pose: CompanionPose; message: CompanionMessage; suggestion: FocusSuggestion | null; hidden: boolean; onToggle: () => void; onAction?: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const suggestionText = useSuggestionText();
  if (hidden) {
    return <Pressable testID="focus-poof-show" accessibilityRole="button" accessibilityLabel={t('focus.poofShow')} onPress={onToggle}
      style={({ pressed }) => [styles.show, pressed && styles.pressed]}>
      <Ionicons name="eye-outline" size={16} color={tokens.mutedText} />
      <Text style={[styles.showText, { color: tokens.mutedText }]}>{t('focus.poofShow')}</Text>
    </Pressable>;
  }
  const text = suggestion ? suggestionText(suggestion) : t(MESSAGES[message]);
  return <View testID="focus-poof" style={[styles.row, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.mascot}>
      {pose === 'still' ? <StillPoof />
        : <PoofMascot key={pose} testID="focus-poof-mascot" variant={pose === 'celebrate' ? 'celebrate' : 'idle'} size={SIZE} interactive={false} label={t('focus.poofLabel')} />}
    </View>
    <View style={styles.copy}>
      <Text testID="focus-poof-message" accessibilityLiveRegion="polite" style={[styles.message, { color: tokens.cardText }]}>{text}</Text>
      {suggestion?.kind === 'dueSoon' && onAction && <Pressable testID="focus-poof-action" accessibilityRole="button" onPress={onAction} style={styles.action}>
        <Text style={[styles.actionText, { color: tokens.brandCyan }]}>{t('focus.suggestFocusOn')}</Text>
      </Pressable>}
    </View>
    <Pressable testID="focus-poof-hide" accessibilityRole="button" accessibilityLabel={t('focus.poofHide')} onPress={onToggle} style={({ pressed }) => [styles.hide, pressed && styles.pressed]}>
      <Ionicons name="chevron-down" size={18} color={tokens.cardMutedText} />
    </Pressable>
  </View>;
}

/**
 * The optional question after a completed round. It never blocks the timer or the save: the round is already kept,
 * and answering or skipping only closes the card. One answer per round; it stays private and is never interpreted.
 */
export function FocusReflectionCard({ answered, onAnswer, onSkip }: { answered: boolean; onAnswer: (value: FocusReflection) => void; onSkip: () => void }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  return <View testID="focus-reflection" style={[styles.reflection, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    {answered ? <View style={styles.thanks}>
      <Ionicons name="checkmark-circle" size={18} color={tokens.brandCyan} />
      <Text accessibilityRole="alert" style={[styles.message, { color: tokens.cardText }]}>{t('focus.reflectThanks')}</Text>
    </View> : <>
      <View style={styles.reflectionHeader}>
        <Text accessibilityRole="header" style={[styles.reflectionTitle, { color: tokens.cardText }]}>{t('focus.reflectTitle')}</Text>
        <Pressable testID="focus-reflection-skip" accessibilityRole="button" onPress={onSkip} style={styles.action}>
          <Text style={[styles.actionText, { color: tokens.brandCyan }]}>{t('focus.reflectSkip')}</Text>
        </Pressable>
      </View>
      <View style={styles.choices}>
        {REFLECTIONS.map((item) => <Pressable key={item.value} testID={`focus-reflect-${item.value}`} accessibilityRole="button" onPress={() => onAnswer(item.value)}
          style={({ pressed }) => [styles.choice, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, pressed && styles.pressed]}>
          <Text style={[styles.choiceText, { color: tokens.cardText }]} numberOfLines={1}>{t(item.key)}</Text>
        </Pressable>)}
      </View>
      <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('focus.reflectNote')}</Text>
    </>}
  </View>;
}

/** Up to three of Poof's suggestions on Focus insights (no actions; the timer lives on Focus). */
export function FocusSuggestionsCard({ suggestions }: { suggestions: FocusSuggestion[] }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const text = useSuggestionText();
  if (!suggestions.length) return null;
  return <View testID="focus-suggestions" style={[styles.reflection, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <View style={styles.suggestionsHeader}>
      <PoofMascot testID="focus-suggestions-poof" variant="idle" size={28} interactive={false} label={t('focus.poofLabel')} />
      <Text accessibilityRole="header" style={[styles.reflectionTitle, { color: tokens.cardText }]}>{t('focus.suggestionsTitle')}</Text>
    </View>
    {suggestions.map((suggestion, index) => <View key={`${suggestion.kind}-${index}`} testID="focus-suggestion" style={styles.suggestion}>
      <Ionicons name="sparkles-outline" size={16} color={tokens.brandCyan} style={styles.suggestionIcon} />
      <Text style={[styles.message, { color: tokens.cardText }]}>{text(suggestion)}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3, borderWidth: 1, borderRadius: radius.radiusMd, paddingLeft: spacing.space3, paddingVertical: spacing.space2, minHeight: 64 },
  mascot: { width: SIZE * 1.3, alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  message: { ...typography.body, fontSize: 15, lineHeight: 21, flexShrink: 1 },
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, actionText: { ...typography.label, fontSize: 14, fontWeight: '700' },
  hide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  show: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.space1, alignSelf: 'flex-end', paddingHorizontal: spacing.space2 },
  showText: { ...typography.label },
  pressed: { opacity: 0.75 },
  reflection: { borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space4, gap: spacing.space3 },
  reflectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.space2 },
  reflectionTitle: { ...typography.body, fontWeight: '700', flexShrink: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2 },
  choice: { flexGrow: 1, flexBasis: '22%', minHeight: 44, borderWidth: 1, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space2 },
  choiceText: { ...typography.label, fontSize: 14 },
  note: { ...typography.label, fontWeight: '400', lineHeight: 18 },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2 },
  suggestion: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.space2 }, suggestionIcon: { marginTop: 3 },
});
