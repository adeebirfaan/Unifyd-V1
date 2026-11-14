import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/constants/theme';
import type { TranslationKey } from '@/constants/i18n';
import { FOCUS_LIMITS, FOCUS_PRESETS, normalizeFocusSettings, settingsForPreset } from '@/lib/focusTimer';
import type { FocusLink, FocusPresetId, FocusSettings } from '@/lib/focusTimer';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const PRESETS: { id: FocusPresetId; label: TranslationKey }[] = [
  { id: 'classic', label: 'focus.presetClassic' }, { id: 'deep', label: 'focus.presetDeep' },
  { id: 'quick', label: 'focus.presetQuick' }, { id: 'custom', label: 'focus.presetCustom' },
];
type Duration = keyof typeof FOCUS_LIMITS;
const DURATIONS: { key: Duration; label: TranslationKey }[] = [
  { key: 'focusMinutes', label: 'focus.focusLength' }, { key: 'shortBreakMinutes', label: 'focus.shortBreakLength' }, { key: 'longBreakMinutes', label: 'focus.longBreakLength' },
];

/**
 * Unifyd Focus session setup: what the student is studying (optional; General study by default) and the timer
 * preset. Custom shows steppers inside fixed limits. Everything is locked while a round or break is running, and
 * the note says when it can change.
 */
export function FocusSetup({ settings, link, locked, onSettings, onOpenSubject, onOpenTask }: {
  settings: FocusSettings; link: FocusLink; locked: boolean; onSettings: (settings: FocusSettings) => void; onOpenSubject: () => void; onOpenTask: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const step = (key: Duration, direction: 1 | -1) => onSettings(normalizeFocusSettings({ ...settings, [key]: settings[key] + direction * FOCUS_LIMITS[key].step }));

  const row = (testID: string, icon: ComponentProps<typeof Ionicons>['name'], label: string, value: string, onPress: () => void) =>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ disabled: locked }} disabled={locked} onPress={onPress}
      style={({ pressed }) => [styles.linkRow, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }, (pressed || locked) && styles.dimmed]}>
      <Ionicons name={icon} size={20} color={tokens.brandCyan} />
      <View style={styles.linkCopy}>
        <Text style={[styles.linkLabel, { color: tokens.cardMutedText }]}>{label}</Text>
        <Text style={[styles.linkValue, { color: tokens.cardText }]} numberOfLines={2}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.cardMutedText} />
    </Pressable>;

  return <View testID="focus-setup" style={[styles.card, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: tokens.cardText }]}>{t('focus.setupTitle')}</Text>
    {locked && <Text testID="focus-locked-note" style={[styles.note, { color: tokens.cardMutedText }]}>{t('focus.lockedNote')}</Text>}
    {row('focus-subject', 'book-outline', t('focus.subject'), link.subjectLabel ?? t('focus.generalStudy'), onOpenSubject)}
    {row('focus-task', 'checkbox-outline', t('focus.task'), link.taskTitle ?? t('focus.noTask'), onOpenTask)}

    <View style={styles.presets} accessibilityRole="radiogroup">
      {PRESETS.map((preset) => {
        const selected = settings.preset === preset.id;
        const detail = preset.id === 'custom' ? t('focus.presetCustomDetail')
          : t('focus.presetDetail', { focus: FOCUS_PRESETS[preset.id].focusMinutes, rest: FOCUS_PRESETS[preset.id].shortBreakMinutes });
        return <Pressable key={preset.id} testID={`focus-preset-${preset.id}`} accessibilityRole="radio" accessibilityLabel={`${t(preset.label)}, ${detail}`}
          accessibilityState={{ checked: selected, disabled: locked }} aria-checked={selected} disabled={locked} onPress={() => onSettings(settingsForPreset(settings, preset.id))}
          style={({ pressed }) => [styles.preset, { backgroundColor: tokens.cardElevated, borderColor: selected ? tokens.brandCyan : tokens.border }, (pressed || locked) && styles.dimmed]}>
          <View style={styles.presetTop}>
            <Text style={[styles.presetLabel, { color: tokens.cardText }]} numberOfLines={2}>{t(preset.label)}</Text>
            {selected && <Ionicons name="checkmark-circle" size={18} color={tokens.brandCyan} />}
          </View>
          <Text style={[styles.presetDetail, { color: tokens.cardMutedText }]}>{detail}</Text>
        </Pressable>;
      })}
    </View>

    {settings.preset === 'custom' && <View testID="focus-custom" style={styles.steppers}>
      {DURATIONS.map(({ key, label }) => {
        const name = t(label);
        const value = settings[key];
        const button = (direction: 1 | -1) => {
          const disabled = locked || (direction < 0 ? value <= FOCUS_LIMITS[key].min : value >= FOCUS_LIMITS[key].max);
          return <Pressable testID={`focus-${key}-${direction > 0 ? 'more' : 'less'}`} accessibilityRole="button" accessibilityLabel={t(direction > 0 ? 'focus.increase' : 'focus.decrease', { name })}
            accessibilityState={{ disabled }} disabled={disabled} onPress={() => step(key, direction)}
            style={({ pressed }) => [styles.stepButton, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }, (pressed || disabled) && styles.dimmed]}>
            <Ionicons name={direction > 0 ? 'add' : 'remove'} size={20} color={tokens.cardText} />
          </Pressable>;
        };
        return <View key={key} style={[styles.stepper, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
          <Text style={[styles.stepLabel, { color: tokens.cardText }]}>{name}</Text>
          <View style={styles.stepControls}>
            {button(-1)}
            <Text testID={`focus-${key}-value`} accessibilityLabel={`${name}: ${t('focus.minutes', { count: value })}`} style={[styles.stepValue, { color: tokens.cardText }]}>{t('focus.minutes', { count: value })}</Text>
            {button(1)}
          </View>
        </View>;
      })}
      <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('focus.longBreakNote')}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusLg, padding: spacing.space5, gap: spacing.space3 },
  title: { ...typography.sectionTitle }, note: { ...typography.label, fontWeight: '400', lineHeight: 18 },
  dimmed: { opacity: 0.6 },
  linkRow: { minHeight: 56, borderWidth: 1, borderRadius: radius.radiusMd, paddingHorizontal: spacing.space4, paddingVertical: spacing.space3, flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  linkCopy: { flex: 1, gap: 2 }, linkLabel: { ...typography.label }, linkValue: { ...typography.body, fontWeight: '600' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space2, marginTop: spacing.space1 },
  preset: { flexGrow: 1, flexBasis: '45%', minHeight: 64, borderWidth: 1, borderRadius: radius.radiusMd, padding: spacing.space3, gap: spacing.space1 },
  presetTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.space1 },
  presetLabel: { ...typography.label, fontSize: 15, flex: 1 }, presetDetail: { ...typography.label, fontWeight: '400' },
  steppers: { gap: spacing.space2 },
  // Label and controls share one row; on a narrow phone or with a long label the controls wrap below, right-aligned.
  stepper: { minHeight: 56, borderWidth: 1, borderRadius: radius.radiusMd, paddingLeft: spacing.space4, paddingRight: spacing.space2, paddingVertical: spacing.space1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.space2 },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, marginLeft: 'auto' },
  stepLabel: { ...typography.label, fontSize: 15, flexGrow: 1, flexShrink: 1, minHeight: 44, textAlignVertical: 'center', paddingVertical: 12 },
  stepButton: { width: 44, height: 44, borderRadius: radius.radiusFull, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...typography.body, fontWeight: '700', minWidth: 60, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
