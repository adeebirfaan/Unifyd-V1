import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import type { ExpenseDetail } from '@/lib/expenseHistory';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type ExpenseLoadState = 'loading' | 'ready' | 'notFound' | 'error';

export function useExpenseRecord(id: string | undefined) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<ExpenseLoadState>('loading');
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setState('loading');
    setExpense(null);
    if (!id) {
      setState('notFound');
      return;
    }
    if (!userId) {
      setState('error');
      return;
    }
    try {
      const { data, error } = await supabase.from('expenses')
        .select('id,title,amount,category,expense_date,notes,created_at,entry_source')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (version !== requestVersion.current) return;
      if (error) {
        setState('error');
        return;
      }
      if (!data) {
        setState('notFound');
        return;
      }
      setExpense(data as ExpenseDetail);
      setState('ready');
    } catch {
      if (version === requestVersion.current) setState('error');
    }
  }, [id, userId]);

  useFocusEffect(useCallback(() => {
    void reload();
    return () => { ++requestVersion.current; };
  }, [reload]));

  return { state, expense, reload };
}
