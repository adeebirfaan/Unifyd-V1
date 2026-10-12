import type { LanguagePreference } from '@/constants/i18n';
import { isPoofActionId } from '@/lib/poofEngine';
import type { PoofActionId } from '@/lib/poofEngine';
import type { PoofAiPayload } from '@/lib/poofFacts';
import { ocrBaseUrl } from '@/lib/receiptOcr';
import { supabase } from '@/lib/supabase';

export const POOF_MESSAGE_MAX = 500;

export type PoofAiResult =
  | { source: 'ai'; reply: string; actions: PoofActionId[]; inScope: boolean }
  | { source: 'fallback'; reason: 'not_configured' | 'unavailable' | 'invalid_response' | 'server_unreachable' | 'rate_limited' };

/**
 * Asks the Unifyd server for an AI-written reply. Only the question and the
 * aggregate payload are sent (no task titles, notes, or names). Any failure
 * becomes a fallback, and Poof answers with its built-in rules instead.
 */
export async function requestPoofReply(message: string, payload: PoofAiPayload, language: LanguagePreference): Promise<PoofAiResult> {
  const baseUrl = ocrBaseUrl();
  if (!baseUrl) return { source: 'fallback', reason: 'not_configured' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { source: 'fallback', reason: 'unavailable' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}/api/poof/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, message: message.slice(0, POOF_MESSAGE_MAX), facts: payload }),
      signal: controller.signal,
    });
    if (response.status === 429) return { source: 'fallback', reason: 'rate_limited' };
    if (!response.ok) return { source: 'fallback', reason: 'unavailable' };
    const body = await response.json() as { source?: unknown; reply?: unknown; actions?: unknown; scope?: unknown; fallbackReason?: unknown };
    if (body.source === 'ai' && typeof body.reply === 'string' && body.reply.trim()) {
      // Only known navigation actions are ever shown, whatever the server returns.
      const actions = Array.isArray(body.actions) ? body.actions.filter(isPoofActionId) : [];
      return { source: 'ai', reply: body.reply.trim(), actions: [...new Set(actions)], inScope: body.scope !== 'out' };
    }
    const reason = body.fallbackReason === 'not_configured' || body.fallbackReason === 'invalid_response' ? body.fallbackReason : 'unavailable';
    return { source: 'fallback', reason };
  } catch {
    return { source: 'fallback', reason: 'server_unreachable' };
  } finally {
    clearTimeout(timeout);
  }
}
