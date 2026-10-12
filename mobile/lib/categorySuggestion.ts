import { EXPENSE_CATEGORIES } from '@/lib/expenseForm';
import type { ExpenseCategory } from '@/lib/expenseForm';
import { ocrBaseUrl } from '@/lib/receiptOcr';
import { supabase } from '@/lib/supabase';

export const SUGGESTION_TITLE_MIN = 3;
const TITLE_MAX = 120;

export type CategorySuggestionResult =
  | { status: 'suggested'; category: ExpenseCategory; confidence: number; trainingExpenseCount: number }
  | { status: 'notEnoughData'; trainingExpenseCount: number }
  | { status: 'lowConfidence' }
  | { status: 'unavailable' };

/**
 * Asks the Unifyd server's Naive Bayes model for an optional category. Only the draft title is sent:
 * never notes, amounts, OCR text, or IDs. The server trains on this student's own saved expenses.
 * Any failure becomes `unavailable`; the student always chooses the category.
 */
export async function requestCategorySuggestion(title: string): Promise<CategorySuggestionResult> {
  const baseUrl = ocrBaseUrl();
  if (!baseUrl) return { status: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 'unavailable' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}/api/ml/expense-category-suggestion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim().slice(0, TITLE_MAX) }),
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'unavailable' };
    const body = await response.json() as Record<string, unknown>;
    const count = typeof body.trainingExpenseCount === 'number' ? body.trainingExpenseCount : 0;
    if (body.available === true && (EXPENSE_CATEGORIES as readonly unknown[]).includes(body.category)
      && typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1) {
      return { status: 'suggested', category: body.category as ExpenseCategory, confidence: body.confidence, trainingExpenseCount: count };
    }
    if (body.available === false && body.reason === 'not_enough_data') return { status: 'notEnoughData', trainingExpenseCount: count };
    if (body.available === false) return { status: 'lowConfidence' };
    return { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
