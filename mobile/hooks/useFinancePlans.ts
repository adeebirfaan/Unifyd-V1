import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { localDateISO } from '@/lib/expenseForm';
import { totalOutstandingCents } from '@/lib/splitBills';
import type { OutstandingParticipant } from '@/lib/splitBills';
import { daysUntil, upcomingRenewals } from '@/lib/subscriptions';
import type { SubscriptionRecord } from '@/lib/subscriptions';
import { supabase } from '@/lib/supabase';
import { RENEWAL_ATTENTION_DAYS } from '@/lib/walletOverview';

export type FinancePlans = { renewals: { name: string; days: number }[] | null; owedCents: number | null };

/**
 * Subscription renewals due soon and the amount still owed in split bills, for Wallet's attention card.
 * Both are separate planning records and never feed spending totals. A source that fails to load is
 * `null`, so its item is simply left out rather than guessed.
 */
export function useFinancePlans(userId: string | undefined): FinancePlans {
  const [plans, setPlans] = useState<FinancePlans>({ renewals: null, owedCents: null });
  const requestVersion = useRef(0);
  useFocusEffect(useCallback(() => {
    const version = ++requestVersion.current;
    if (userId) {
      const today = localDateISO();
      void Promise.all([
        supabase.from('subscriptions').select('id,name,next_billing_date,is_active').eq('user_id', userId).eq('is_active', true).limit(500)
          .then(({ data, error }) => error ? null : upcomingRenewals((data ?? []) as Pick<SubscriptionRecord, 'name' | 'next_billing_date' | 'is_active'>[], today, RENEWAL_ATTENTION_DAYS)
            .map((subscription) => ({ name: subscription.name, days: daysUntil(subscription.next_billing_date, today) ?? 0 })), () => null),
        supabase.from('split_bills').select('id,split_bill_participants(share_amount,is_self,is_settled)').eq('user_id', userId).limit(500)
          .then(({ data, error }) => error ? null : totalOutstandingCents((data ?? []) as { split_bill_participants: OutstandingParticipant[] }[]), () => null),
      ]).then(([renewals, owedCents]) => { if (version === requestVersion.current) setPlans({ renewals, owedCents }); });
    }
    return () => { ++requestVersion.current; };
  }, [userId]));
  return plans;
}
