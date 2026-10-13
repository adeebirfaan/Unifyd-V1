import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { CardDeck } from '@/components/home/CardDeck';
import type { DeckCard } from '@/components/home/CardDeck';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';

export type InsightDeckCard = {
  key: string;
  name: string;
  /** `hero` uses the Home overview card's brand gradient; `plain` the standard dark card surface. */
  surface: 'hero' | 'plain';
  render: (front: boolean) => ReactNode;
};

const INITIAL_HEIGHT = 220;

/**
 * A page's insight cards (Wallet's Finance cards, the Studies cards) in the same stacked, swipeable deck as Home
 * (`CardDeck`: native paging, peeking cards, dots, Reduce Motion aware). The deck is as tall as its tallest card,
 * measured from the content, so every card fits on any phone and text size, and it never shrinks while cards
 * change. Cards change like slides in one fixed place (`stableFront`): there is no "back to overview" step.
 * `hint` is a quiet guide pinned to the bottom of the first card only.
 * A single card is shown as a normal card with no deck affordances.
 */
export function InsightDeck({ cards, hint, testID, dotLabel }: {
  cards: InsightDeckCard[]; hint?: string; testID: string;
  /** Accessible name of each dot, the screen-reader alternative to swiping. */
  dotLabel: (card: DeckCard, position: number, total: number) => string;
}) {
  const { tokens } = useAppearance();
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = (key: string) => (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    setHeights((current) => current[key] === next ? current : { ...current, [key]: next });
  };
  const surface = (card: InsightDeckCard, children: ReactNode, fill: boolean) => card.surface === 'hero'
    ? <LinearGradient colors={colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill ? StyleSheet.absoluteFill : styles.single}>{children}</LinearGradient>
    : <View style={[fill ? StyleSheet.absoluteFill : styles.single, styles.plain, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>{children}</View>;

  if (cards.length === 1) {
    const [only] = cards;
    return <View testID={`${testID}-single`}>{surface(only, only.render(true), false)}</View>;
  }
  const height = Math.max(INITIAL_HEIGHT, ...cards.map((card) => heights[card.key] ?? 0));
  return <CardDeck
    testID={testID}
    height={height}
    dotLabel={dotLabel}
    stableFront
    cards={cards.map((card, position) => {
      const hero = card.surface === 'hero';
      const showHint = !!hint && position === 0;
      return {
        key: card.key,
        name: card.name,
        // At least the deck's height, so a shorter card keeps its guide at the bottom; a taller card grows the deck.
        render: ({ front }) => surface(card, <View onLayout={measure(card.key)} style={[styles.page, { minHeight: height }]}>
          <View>{card.render(front)}</View>
          {/* Plain text, not a control: the dots remain the screen-reader way to change cards. */}
          {showHint && <View testID={`${testID}-hint`} style={styles.hint}>
            <Ionicons name="swap-horizontal" size={16} color={hero ? colors.white : tokens.brandCyan} />
            <Text style={[styles.hintText, { color: hero ? colors.white : tokens.cardMutedText }]}>{hint}</Text>
          </View>}
        </View>, true),
      };
    })}
  />;
}

const styles = StyleSheet.create({
  single: { borderRadius: radius.radiusLg, overflow: 'hidden' },
  plain: { borderWidth: 1, borderRadius: radius.radiusLg },
  page: { justifyContent: 'space-between' },
  // On the brand gradient the guide is white, as on the Home overview card's swipe hint.
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.space2, paddingHorizontal: spacing.space4, paddingBottom: spacing.space4 },
  hintText: { ...typography.label, fontWeight: '500', flexShrink: 1 },
});
