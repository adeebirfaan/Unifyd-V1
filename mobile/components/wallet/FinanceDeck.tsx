import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { CardDeck } from '@/components/home/CardDeck';
import { colors, radius } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type FinanceDeckCard = {
  key: string;
  name: string;
  /** `hero` uses the Home overview card's brand gradient; `plain` the standard dark card surface. */
  surface: 'hero' | 'plain';
  render: (front: boolean) => ReactNode;
};

const INITIAL_HEIGHT = 220;

/**
 * Wallet's insight cards (overview, by category, needs attention) in the same stacked, swipeable deck as Home
 * (`CardDeck`: native paging, peeking cards, dots, Reduce Motion aware). The deck is as tall as its tallest
 * card, measured from the content, so every card fits on any phone and text size. A single card is shown
 * as a normal card with no deck affordances.
 */
export function FinanceDeck({ cards }: { cards: FinanceDeckCard[] }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measure = (key: string) => (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    setHeights((current) => current[key] === next ? current : { ...current, [key]: next });
  };
  const surface = (card: FinanceDeckCard, children: ReactNode, fill: boolean) => card.surface === 'hero'
    ? <LinearGradient colors={colors.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill ? StyleSheet.absoluteFill : styles.single}>{children}</LinearGradient>
    : <View style={[fill ? StyleSheet.absoluteFill : styles.single, styles.plain, { backgroundColor: tokens.cardBackground, borderColor: tokens.border }]}>{children}</View>;

  if (cards.length === 1) {
    const [only] = cards;
    return <View testID="finance-deck-single">{surface(only, only.render(true), false)}</View>;
  }
  const height = Math.max(INITIAL_HEIGHT, ...cards.map((card) => heights[card.key] ?? 0));
  return <CardDeck
    testID="finance-deck"
    height={height}
    dotLabel={(card, position, total) => t('wallet.deckDot', { name: card.name, position: position + 1, total })}
    backToFirstLabel={t('wallet.deckBack')}
    cards={cards.map((card) => ({
      key: card.key,
      name: card.name,
      render: ({ front }) => surface(card, <View onLayout={measure(card.key)}>{card.render(front)}</View>, true),
    }))}
  />;
}

const styles = StyleSheet.create({
  single: { borderRadius: radius.radiusLg, overflow: 'hidden' },
  plain: { borderWidth: 1, borderRadius: radius.radiusLg },
});
