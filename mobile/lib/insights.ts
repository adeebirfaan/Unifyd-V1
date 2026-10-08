import type { LanguagePreference } from '@/constants/i18n';
import { ocrBaseUrl } from '@/lib/receiptOcr';
import { supabase } from '@/lib/supabase';

export type InsightSummary = { finance: string; academic: string; wellness: string };
export type InsightResult =
  | { source: 'ai'; summary: InsightSummary }
  | { source: 'fallback'; reason: 'not_configured' | 'unavailable' | 'invalid_response' | 'server_unreachable' };

function isSummary(value: unknown): value is InsightSummary {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ['finance', 'academic', 'wellness'].every((key) => typeof record[key] === 'string' && (record[key] as string).length > 0);
}

/**
 * Asks the Unifyd server for a validated AI summary. Any failure becomes a
 * fallback result: the Home facts never depend on this request.
 */
export async function requestInsightSummary(language: LanguagePreference): Promise<InsightResult> {
  const baseUrl = ocrBaseUrl();
  if (!baseUrl) return { source: 'fallback', reason: 'not_configured' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { source: 'fallback', reason: 'unavailable' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${baseUrl}/api/insights/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      signal: controller.signal,
    });
    if (!response.ok) return { source: 'fallback', reason: 'unavailable' };
    const body = await response.json() as { source?: unknown; summary?: unknown; fallbackReason?: unknown };
    if (body.source === 'ai' && isSummary(body.summary)) return { source: 'ai', summary: body.summary };
    const reason = body.fallbackReason === 'not_configured' || body.fallbackReason === 'invalid_response' ? body.fallbackReason : 'unavailable';
    return { source: 'fallback', reason };
  } catch {
    return { source: 'fallback', reason: 'server_unreachable' };
  } finally {
    clearTimeout(timeout);
  }
}
