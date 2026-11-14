import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { REFLECTION_FEELINGS, reflectionOutcome } from '@/lib/wellbeing';
import type { ReflectionAnswer } from '@/lib/wellbeing';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const ANSWERS: readonly { value: ReflectionAnswer; label: TranslationKey }[] = [
  { value: 'notReally', label: 'wellbeing.answer.notReally' },
  { value: 'sometimes', label: 'wellbeing.answer.sometimes' },
  { value: 'often', label: 'wellbeing.answer.often' },
];

// Wellbeing Phase 5 (SRS-FR-1105): a short, non-clinical reflection. Answers live only in this screen's state:
// no score, level, or label is shown, and nothing is saved or sent (SRS-FR-1108).
export default function HowHaveYouBeenScreen() {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  // null = intro; 0..4 = the feeling being asked; REFLECTION_FEELINGS.length = result.
  const [index, setIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<ReflectionAnswer[]>([]);
  const total = REFLECTION_FEELINGS.length;

  function answer(value: ReflectionAnswer) {
    if (index === null || index >= total) return;
    setAnswers([...answers.slice(0, index), value]);
    setIndex(index + 1);
  }

  function goBack() {
    if (index === null) { router.back(); return; }
    setIndex(index === 0 ? null : index - 1);
  }

  const done = index !== null && index >= total;
  const outcome = done ? reflectionOutcome(answers) : null;

  return (
    <Screen>
      <Pressable testID="reflect-back" onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={tokens.screenText} />
      </Pressable>

      {index === null && <>
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t('wellbeing.reflect.title')}</Text>
        <Text style={[styles.body, { color: tokens.mutedText }]}>{t('wellbeing.reflect.intro')}</Text>
        <View style={styles.private}><Ionicons name="lock-closed-outline" size={16} color={tokens.pageAccent} /><Text style={[styles.small, { color: tokens.mutedText }]}>{t('wellbeing.reflect.private')}</Text></View>
        <Pressable testID="reflect-start" accessibilityRole="button" onPress={() => { setAnswers([]); setIndex(0); }} style={({ pressed }) => [styles.primary, { backgroundColor: tokens.brandBlue }, pressed && styles.pressed]}>
          <Text style={[styles.buttonText, { color: colors.white }]}>{t('wellbeing.breathe.start')}</Text>
        </Pressable>
      </>}

      {index !== null && !done && <View testID="reflect-question">
        <Text style={[styles.small, { color: tokens.mutedText }]}>{t('wellbeing.reflect.progress', { current: index + 1, total })}</Text>
        <Text style={[styles.lately, { color: tokens.mutedText }]}>{t('wellbeing.reflect.lately')}</Text>
        <Text accessibilityRole="header" style={[styles.feeling, { color: tokens.screenText }]}>{t(REFLECTION_FEELINGS[index])}</Text>
        <View style={styles.answers} accessibilityRole="radiogroup">
          {ANSWERS.map((option) => {
            const selected = answers[index] === option.value;
            return <Pressable key={option.value} testID={`reflect-answer-${option.value}`} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => answer(option.value)}
              style={({ pressed }) => [styles.answer, { backgroundColor: tokens.cardBackground, borderColor: selected ? tokens.brandCyan : tokens.border }, pressed && styles.pressed]}>
              <Text style={[styles.buttonText, { color: tokens.cardText }]}>{t(option.label)}</Text>
            </Pressable>;
          })}
        </View>
      </View>}

      {done && <View testID="reflect-result">
        <Text accessibilityRole="header" style={[styles.title, { color: tokens.screenText }]}>{t('wellbeing.reflect.title')}</Text>
        <Text testID="reflect-result-line" accessibilityLiveRegion="polite" style={[styles.result, { color: tokens.screenText }]}>{t(outcome === 'suggestHelp' ? 'wellbeing.reflect.help' : 'wellbeing.reflect.calm')}</Text>
        <View style={styles.resultActions}>
          {/* Get help is offered either way; it leads when any feeling was often (SRS-FR-1101, 1105). */}
          <Pressable testID="reflect-get-help" accessibilityRole="button" onPress={() => router.replace('/get-help')}
            style={({ pressed }) => [outcome === 'suggestHelp' ? [styles.primary, { backgroundColor: tokens.brandBlue }] : [styles.primary, styles.outlined, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }], pressed && styles.pressed]}>
            <Ionicons name="help-buoy-outline" size={20} color={outcome === 'suggestHelp' ? colors.white : tokens.brandCyan} />
            <Text style={[styles.buttonText, { color: outcome === 'suggestHelp' ? colors.white : tokens.cardText }]}>{t('wellbeing.getHelp')}</Text>
          </Pressable>
          <Pressable testID="reflect-done" accessibilityRole="button" onPress={() => router.back()}
            style={({ pressed }) => [outcome === 'suggestHelp' ? [styles.primary, styles.outlined, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }] : [styles.primary, { backgroundColor: tokens.brandBlue }], pressed && styles.pressed]}>
            <Text style={[styles.buttonText, { color: outcome === 'suggestHelp' ? tokens.cardText : colors.white }]}>{t('wellbeing.reflect.done')}</Text>
          </Pressable>
        </View>
      </View>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.space3, marginBottom: spacing.space3 },
  title: { ...typography.screenTitle },
  body: { ...typography.body, lineHeight: 23, marginTop: spacing.space2 },
  private: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginTop: spacing.space4, marginBottom: spacing.space8 },
  small: { ...typography.label },
  lately: { ...typography.body, marginTop: spacing.space6 },
  feeling: { ...typography.display, marginTop: spacing.space2, marginBottom: spacing.space8 },
  answers: { gap: spacing.space3 },
  answer: { minHeight: 56, borderWidth: 1.5, borderRadius: radius.radiusMd, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.space5 },
  result: { ...typography.sectionTitle, lineHeight: 28, marginTop: spacing.space6, marginBottom: spacing.space8 },
  resultActions: { gap: spacing.space3 },
  primary: { minHeight: 56, borderRadius: radius.radiusMd, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.space2, paddingHorizontal: spacing.space5 },
  outlined: { borderWidth: 1 },
  buttonText: { ...typography.body, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
