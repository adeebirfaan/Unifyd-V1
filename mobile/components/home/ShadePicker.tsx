import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TranslationKey } from '@/constants/i18n';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { CARD_SHADE_IDS, CARD_SHADES } from '@/lib/cardShades';
import type { CardShade } from '@/lib/cardShades';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

/** Sheet for choosing a dark shade for one module card; a choice applies immediately. */
export function ShadePicker({ cardName, value, onChange, onClose }: {
  cardName: string | null; value: CardShade; onChange: (shade: CardShade) => void; onClose: () => void;
}) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={cardName !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: tokens.modalScrim }]} accessibilityLabel={t('home.colourDone')} onPress={onClose} />
        <View testID="shade-picker" style={[styles.sheet, { backgroundColor: tokens.cardBackground, borderColor: tokens.border, paddingBottom: Math.max(insets.bottom, spacing.space4) + spacing.space2 }]}>
          <View style={[styles.handle, { backgroundColor: tokens.border }]} />
          <Text style={[styles.title, { color: tokens.cardText }]}>{t('home.chooseColour', { name: cardName ?? '' })}</Text>
          <Text style={[styles.hint, { color: tokens.cardMutedText }]}>{t('home.colourHint')}</Text>
          <View style={styles.grid} accessibilityRole="radiogroup">
            {CARD_SHADE_IDS.map((shade) => {
              const selected = shade === value;
              return (
                <Pressable key={shade} accessibilityRole="radio" accessibilityLabel={t(`shade.${shade}` as TranslationKey)} accessibilityState={{ checked: selected }} aria-checked={selected}
                  onPress={() => onChange(shade)} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                  <View style={[styles.swatch, { backgroundColor: CARD_SHADES[shade], borderColor: selected ? tokens.brandCyan : 'rgba(255,255,255,0.14)' }]}>
                    <View style={styles.swatchLine} />
                    {selected && <View style={[styles.check, { backgroundColor: tokens.brandCyan }]}><Ionicons name="checkmark" size={14} color={colors.background} /></View>}
                  </View>
                  <Text style={[styles.name, { color: selected ? tokens.cardText : tokens.cardMutedText }, selected && styles.nameSelected]}>{t(`shade.${shade}` as TranslationKey)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.done, { borderColor: tokens.border }, pressed && styles.pressed]}>
            <Text style={[styles.doneText, { color: tokens.cardText }]}>{t('home.colourDone')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 568, alignSelf: 'center', borderTopLeftRadius: radius.radiusLg, borderTopRightRadius: radius.radiusLg, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: spacing.space5, paddingTop: spacing.space3, gap: spacing.space4 },
  handle: { width: 40, height: 4, borderRadius: radius.radiusFull, alignSelf: 'center' },
  title: { ...typography.sectionTitle },
  hint: { ...typography.label, lineHeight: 18, marginTop: -spacing.space2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.space3 },
  option: { flexBasis: '30%', flexGrow: 1, gap: spacing.space2, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  swatch: { width: '100%', height: 64, borderRadius: radius.radiusMd, borderWidth: 2, justifyContent: 'flex-end', padding: spacing.space2 },
  swatchLine: { width: 28, height: 3, borderRadius: radius.radiusFull, backgroundColor: colors.brandCyan, opacity: 0.8 },
  check: { position: 'absolute', top: spacing.space2, right: spacing.space2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.label },
  nameSelected: { fontWeight: '700' },
  done: { minHeight: 48, borderRadius: radius.radiusMd, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  doneText: { ...typography.body, fontWeight: '700' },
});
