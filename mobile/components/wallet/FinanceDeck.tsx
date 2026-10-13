import { InsightDeck } from '@/components/home/InsightDeck';
import type { InsightDeckCard } from '@/components/home/InsightDeck';
import { useI18n } from '@/providers/LanguageProvider';

export type FinanceDeckCard = InsightDeckCard;

/**
 * Wallet's insight cards (overview, by category, needs attention) in the shared `InsightDeck`: stable direct
 * selection, dots named "Finance card N of M", and `hint` at the bottom of the overview card.
 */
export function FinanceDeck({ cards, hint }: { cards: FinanceDeckCard[]; hint?: string }) {
  const { t } = useI18n();
  return <InsightDeck testID="finance-deck" cards={cards} hint={hint}
    dotLabel={(card, position, total) => t('wallet.deckDot', { name: card.name, position: position + 1, total })} />;
}
