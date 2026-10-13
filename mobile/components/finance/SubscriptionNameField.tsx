import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SubscriptionBrandIcon } from '@/components/finance/SubscriptionBrandIcon';
import { radius, spacing, typography } from '@/constants/theme';
import { matchSubscriptionSuggestions, selectedSuggestion } from '@/lib/subscriptionBrands';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

const TILE = 44;
const WEB = Platform.OS === 'web';

/**
 * The editable "Subscription name" field with its icon preview and a compact list of suggested names.
 * - The icon is always derived from the current text (`subscriptionVisual`), so editing a chosen name into a
 *   different one updates or resets it; a blank field shows a neutral placeholder.
 * - The list opens on focus or typing, and closes after a choice, Escape, Return, or when focus leaves both the
 *   field and the list. It is part of the card's layout (not floating), so no parent can clip it, and choices
 *   are plain buttons that work while the keyboard is open (the screen's scroll view keeps taps).
 * - Choosing a name fills only the name. Any other name can be typed.
 */
export function SubscriptionNameField({ value, onChangeText, error }: { value: string; onChangeText: (value: string) => void; error?: string }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const options = useRef<(View | null)[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a choice on the web, focus returns to the field without reopening the list.
  const skipNextFocus = useRef(false);
  const matches = matchSubscriptionSuggestions(value);
  const selected = selectedSuggestion(value);
  const showList = open && matches.length > 0;

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  function cancelClose() { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } }
  // Focus moving from the field to a choice (Tab or a web click) blurs the field first, so closing waits a moment.
  function scheduleClose() { cancelClose(); closeTimer.current = setTimeout(() => { closeTimer.current = null; setOpen(false); }, 120); }

  function choose(name: string) {
    cancelClose();
    onChangeText(name);
    setOpen(false);
    if (WEB) { skipNextFocus.current = true; input.current?.focus(); }
  }

  return <View style={styles.field}>
    <Text style={[styles.label, { color: tokens.cardText }]}>{t('subscription.name')}</Text>
    <View style={[styles.control, { backgroundColor: tokens.cardElevated, borderColor: error ? tokens.cardErrorText : focused || showList ? tokens.brandCyan : tokens.border }]}>
      <View testID="subscription-name-preview">
        {value.trim() ? <SubscriptionBrandIcon name={value} size={TILE} />
          : <View testID="subscription-icon-placeholder" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.placeholder, { borderColor: tokens.border, backgroundColor: tokens.cardBackground }]}>
            <Ionicons name="apps-outline" size={22} color={tokens.cardMutedText} />
          </View>}
      </View>
      <TextInput ref={input} value={value} maxLength={120} autoCorrect={false} returnKeyType="done"
        onChangeText={(text) => { onChangeText(text); setOpen(true); }}
        onFocus={() => { setFocused(true); cancelClose(); if (skipNextFocus.current) { skipNextFocus.current = false; return; } setOpen(true); }}
        onBlur={() => { setFocused(false); scheduleClose(); }} onSubmitEditing={() => setOpen(false)}
        onKeyPress={(event) => {
          const key = event.nativeEvent.key;
          if (key === 'Escape') setOpen(false);
          else if (key === 'ArrowDown' && showList) { event.preventDefault?.(); options.current[0]?.focus?.(); }
        }}
        placeholder={t('subscription.namePlaceholder')} placeholderTextColor={tokens.cardMutedText} selectionColor={tokens.brandCyan}
        accessibilityLabel={t('subscription.name')} aria-expanded={showList} style={[styles.input, { color: tokens.cardText }]} />
    </View>
    {showList && <View testID="subscription-suggestions" role="list" accessibilityLabel={t('subscription.suggestionsLabel')} style={[styles.list, { backgroundColor: tokens.cardElevated, borderColor: tokens.border }]}>
      <Text style={[styles.note, { color: tokens.cardMutedText }]}>{t('subscription.suggestionsNote')}</Text>
      {matches.map((name, index) => {
        const isSelected = name === selected;
        return <Pressable key={name} ref={(node) => { options.current[index] = node; }} accessibilityRole="button" accessibilityState={{ selected: isSelected }}
          accessibilityLabel={isSelected ? `${name}, ${t('subscription.suggestionSelected')}` : t('subscription.suggestionUse', { name })}
          onPressIn={cancelClose} onFocus={cancelClose} onBlur={scheduleClose} onPress={() => choose(name)}
          style={({ pressed, hovered }) => [styles.option, (pressed || hovered) && { backgroundColor: tokens.cardBackground }, isSelected && { backgroundColor: tokens.cardBackground }]}>
          <SubscriptionBrandIcon name={name} size={32} />
          <Text style={[styles.optionText, { color: isSelected ? tokens.brandCyan : tokens.cardText }]} numberOfLines={1}>{name}</Text>
          {isSelected && <Ionicons name="checkmark-circle" size={20} color={tokens.brandCyan} />}
        </Pressable>;
      })}
    </View>}
    {error && <Text style={[styles.error, { color: tokens.cardErrorText }]} accessibilityRole="alert">{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.space2 }, label: { ...typography.label },
  control: { minHeight: 60, borderRadius: radius.radiusMd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingLeft: spacing.space2, paddingRight: spacing.space4 },
  placeholder: { width: TILE, height: TILE, borderRadius: radius.radiusSm, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  // minWidth 0 lets the web <input> shrink below its intrinsic width on narrow phones.
  input: { ...typography.body, fontSize: 18, fontWeight: '600', flex: 1, minWidth: 0, minHeight: 56, paddingVertical: spacing.space3 },
  list: { borderWidth: 1, borderRadius: radius.radiusMd, paddingVertical: spacing.space1, paddingHorizontal: spacing.space1 },
  note: { ...typography.label, fontWeight: '500', paddingHorizontal: spacing.space3, paddingTop: spacing.space2, paddingBottom: spacing.space1 },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.space3, paddingHorizontal: spacing.space2, borderRadius: radius.radiusSm },
  optionText: { ...typography.body, fontWeight: '600', flex: 1 },
  error: { ...typography.label },
});
