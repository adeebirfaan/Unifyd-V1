import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useAppearance } from '@/providers/AppearanceProvider';
import { useI18n } from '@/providers/LanguageProvider';

export type DeckControls = { goTo: (index: number) => void };
export type DeckCard = { key: string; name: string; render: (controls: DeckControls) => ReactNode };

export const DECK_CARD_HEIGHT = 404;
const PEEK = 14; // visible strip of each card stacked behind the front card
const STACK_DEPTH = 2;
const isWeb = Platform.OS === 'web';
const useNative = !isWeb;
// React Native Web wraps each child of a paging ScrollView in its own container, which
// breaks the deck's stacking order. On the web the same snapping uses CSS scroll-snap.
const webSnapScroller = (isWeb ? { scrollSnapType: 'x mandatory' } : {}) as object;
const webSnapPage = (isWeb ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : {}) as object;

/**
 * A stacked card deck built on a native horizontal paging scroll view, so the
 * phone's own scrolling handles swipes (and cooperates with the vertical page).
 * Each card's position, peek, and scale follow the scroll offset: upcoming cards
 * sit stacked behind the front card, and the front card slides away as you swipe.
 * Swipe, tap a peeking edge, or use the dots. Only the front card is interactive
 * or visible to screen readers.
 */
export function CardDeck({ cards }: { cards: DeckCard[] }) {
  const { tokens } = useAppearance();
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(0));
  // Held in state (via a callback ref) so cards can be given goTo during render.
  const [scroller, setScroller] = useState<ScrollView | null>(null);
  const attachScroller = useCallback((node: unknown) => setScroller(node as ScrollView | null), []);

  const goTo = (target: number) => {
    const clamped = Math.max(0, Math.min(cards.length - 1, target));
    scroller?.scrollTo({ x: clamped * width, animated: true });
  };
  const controls: DeckControls = { goTo };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: useNative,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return;
      const page = Math.max(0, Math.min(cards.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
      setIndex((current) => (current === page ? current : page));
    },
  });

  const pageHeight = DECK_CARD_HEIGHT + PEEK * STACK_DEPTH;
  return (
    // Deck text is not selectable: on the web a drag would otherwise select text.
    <View style={styles.noSelect}>
      <View style={{ height: pageHeight }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.ScrollView ref={attachScroller} testID="card-deck" horizontal pagingEnabled={!isWeb} showsHorizontalScrollIndicator={false}
            onScroll={onScroll} scrollEventThrottle={16} decelerationRate="fast" style={[styles.scroller, webSnapScroller]}>
            {cards.map((card, position) => {
              // p < 0: card is waiting behind the front; p = 0: front; p > 0: sliding out to the left.
              const p = Animated.subtract(Animated.divide(scrollX, width), position);
              const translateX = p.interpolate({ inputRange: [-(STACK_DEPTH + 1), 0, 1], outputRange: [-(STACK_DEPTH + 1) * width, 0, 0], extrapolate: 'clamp' });
              const translateY = p.interpolate({ inputRange: [-STACK_DEPTH, 0, 1], outputRange: [-STACK_DEPTH * PEEK, 0, 0], extrapolate: 'clamp' });
              const scale = p.interpolate({ inputRange: [-STACK_DEPTH, 0, 1], outputRange: [1 - STACK_DEPTH * 0.04, 1, 0.96], extrapolate: 'clamp' });
              const opacity = p.interpolate({ inputRange: [-(STACK_DEPTH + 0.6), -STACK_DEPTH, 0, 1], outputRange: [0, 1, 1, 1], extrapolate: 'clamp' });
              const front = position === index;
              const peeking = position > index && position <= index + STACK_DEPTH;
              return (
                // box-none: the transparent page lets taps reach the peeking edge of the card behind.
                <View key={card.key} pointerEvents="box-none" style={[styles.page, webSnapPage, { width, height: pageHeight, zIndex: cards.length - position }]}>
                  <Animated.View testID={`deck-card-${card.key}`} aria-hidden={!front} importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
                    accessibilityElementsHidden={!front} pointerEvents={front ? 'auto' : 'box-none'}
                    style={[styles.card, { opacity, transform: [{ translateX }, { translateY }, { scale }], transformOrigin: 'top' }]}>
                    <View pointerEvents={front ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>{card.render(controls)}</View>
                    {/* The peeking edge of a waiting card brings it to the front. */}
                    {peeking && <Pressable style={styles.peek} onPress={() => goTo(position)} />}
                  </Animated.View>
                </View>
              );
            })}
          </Animated.ScrollView>
        )}
      </View>
      <View style={styles.dots}>
        {cards.map((card, position) => {
          const active = position === index;
          return (
            <Pressable key={card.key} accessibilityRole="button" accessibilityLabel={t('home.showCard', { name: card.name })}
              accessibilityState={{ selected: active }} aria-selected={active} onPress={() => goTo(position)} style={styles.dotTarget}>
              <View style={[styles.dot, { width: active ? 22 : 8, backgroundColor: active ? tokens.pageAccent : tokens.subtleText }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noSelect: { userSelect: 'none' },
  scroller: { flex: 1, overflow: 'visible' },
  page: { paddingTop: PEEK * STACK_DEPTH },
  card: { height: DECK_CARD_HEIGHT, borderRadius: radius.radiusLg, overflow: 'hidden' },
  peek: { position: 'absolute', left: 0, right: 0, top: 0, height: PEEK + spacing.space2 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.space1 },
  dotTarget: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: radius.radiusFull },
});
