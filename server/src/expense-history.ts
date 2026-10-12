import { createClient } from '@supabase/supabase-js';

import { MAX_TRAINING_EXPENSES, isExpenseCategory } from './expense-classifier.js';
import type { LabelledExpense } from './expense-classifier.js';

/**
 * Loads the caller's latest labelled expenses (title and category only) for training.
 * The client carries the caller's own token, so Supabase RLS limits rows to that student,
 * and the query also filters by the user ID taken from the verified token, never from the request.
 * Notes, amounts, dates, and OCR text are not selected.
 */
export async function loadExpenseHistory(url: string, publishableKey: string, token: string, makeClient: typeof createClient = createClient): Promise<{ userId: string; history: LabelledExpense[] }> {
  const client = makeClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  const userId = auth.user?.id;
  if (authError || !userId) throw new Error('The caller could not be verified.');
  const { data, error } = await client.from('expenses').select('title,category')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_TRAINING_EXPENSES);
  if (error) throw new Error('The expense history query failed.');
  const history = ((data ?? []) as { title: unknown; category: unknown }[])
    .flatMap((row) => typeof row.title === 'string' && isExpenseCategory(row.category) ? [{ title: row.title, category: row.category }] : []);
  return { userId, history };
}
