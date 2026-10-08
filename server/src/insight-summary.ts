import type { InsightFacts } from './insight-facts.js';

export type SummaryLanguage = 'en' | 'ms';
export type InsightSummary = { finance: string; academic: string; wellness: string };

const MAX_SECTION_LENGTH = 300;
const ringgit = (cents: number) => (cents / 100).toFixed(2);

/**
 * The only data sent to Groq: aggregate numbers and fixed labels. Task titles,
 * subjects, notes, names, IDs, and dates are deliberately excluded.
 */
export function groqPayload(facts: InsightFacts) {
  const { finance, academic, wellness } = facts;
  return {
    currency: 'RM',
    finance: {
      period: 'this calendar month',
      expenseCount: finance.expenseCount,
      spent: ringgit(finance.spentCents),
      monthlyBudget: finance.budgetCents === null ? null : ringgit(finance.budgetCents),
      remaining: finance.remainingCents !== null && finance.remainingCents >= 0 ? ringgit(finance.remainingCents) : null,
      overBudgetBy: finance.remainingCents !== null && finance.remainingCents < 0 ? ringgit(-finance.remainingCents) : null,
      percentOfBudgetUsed: finance.percentUsed,
      topCategories: finance.topCategories.map(({ category, percent }) => ({ category: category.replace('_', ' '), percentOfSpending: percent })),
    },
    academic: {
      pendingTasks: academic.pending,
      ongoingTasks: academic.ongoing,
      overdueTasks: academic.overdue,
      dueInNext7Days: academic.dueSoon,
      completedInLast7Days: academic.completedRecently,
    },
    wellbeing: {
      period: `last ${wellness.windowDays} days`,
      scale: '1 (very low) to 5 (very high), self-reported',
      checkIns: wellness.checkIns,
      averageMood: wellness.averageMood,
      averageStress: wellness.averageStress,
      moodComparedWithPrevious7Days: wellness.moodVsPrevious,
      stressComparedWithPrevious7Days: wellness.stressVsPrevious,
      repeatedLowMoodDays: wellness.repeatedLowMood,
    },
  };
}

export function groqMessages(payload: ReturnType<typeof groqPayload>, language: SummaryLanguage) {
  const system = [
    'You write a short, neutral, supportive summary of a university student\'s own recorded data for a personal dashboard.',
    language === 'ms'
      ? 'Write every field entirely in Bahasa Melayu (Malaysian Malay), addressing the student as "anda". The data labels are English, but your sentences must not be.'
      : 'Write every field in English, addressing the student as "you".',
    'Return JSON with exactly three fields: finance, academic, wellness. Each is one or two plain sentences, at most 220 characters.',
    'Rules:',
    '- Describe only the facts provided. Never invent, estimate, round differently, or calculate new numbers; copy numbers exactly as given.',
    '- If a section has no records (for example zero expenses, tasks, or check-ins), say briefly that there is not enough recorded data yet.',
    '- Do not predict the future, diagnose, or give medical, mental-health, financial, investment, or academic advice.',
    '- Do not mention illness, disorders, therapy, medication, or self-harm.',
    '- For wellbeing, describe self-reported levels gently and neutrally. If repeatedLowMoodDays is true, acknowledge it kindly without alarm.',
    '- No greetings, emojis, links, or markdown.',
  ].join('\n');
  const request = language === 'ms' ? 'Tulis ringkasan dalam Bahasa Melayu sahaja. Data:\n' : 'Data:\n';
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: request + JSON.stringify(payload) },
  ];
}

export const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    finance: { type: 'string' },
    academic: { type: 'string' },
    wellness: { type: 'string' },
  },
  required: ['finance', 'academic', 'wellness'],
  additionalProperties: false,
} as const;

// Phrases that would turn a description into diagnosis, prediction, or advice.
// English and Bahasa Melayu forms are matched case-insensitively.
const BLOCKED = [
  /diagnos/i, /depress/i, /disorder/i, /illness/i, /clinical/i, /therap/i, /medicat/i, /suicid/i, /self[- ]?harm/i,
  /predict/i, /forecast/i, /will (likely|probably)/i, /guarantee/i, /invest/i,
  /kemurungan/i, /gangguan mental/i, /penyakit/i, /terapi/i, /ubat/i, /bunuh diri/i, /ramal/i, /pasti akan/i,
  /https?:\/\//i, /www\./i, /@/,
];

function allowedNumbers(payload: ReturnType<typeof groqPayload>): Set<string> {
  const allowed = new Set<string>(['1', '5', '7']);
  const add = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      allowed.add(String(value));
      allowed.add(String(Math.round(value)));
      if (!Number.isInteger(value)) allowed.add(value.toFixed(1));
    } else if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
      allowed.add(value);
      allowed.add(String(Number(value)));
      allowed.add(String(Math.round(Number(value))));
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(add);
    }
  };
  add(payload);
  return allowed;
}

// Common English words that should not appear in a Bahasa Melayu summary.
const ENGLISH_MARKERS = /\b(you|your|the|and|this|have|over|last|with|tasks?)\b/gi;

/** Returns a safe summary, or null when the response must fall back to facts only. */
export function validateSummary(raw: string, payload: ReturnType<typeof groqPayload>, language: SummaryLanguage = 'en'): InsightSummary | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(',') !== 'academic,finance,wellness') return null;
  const allowed = allowedNumbers(payload);
  const summary = {} as InsightSummary;
  for (const key of ['finance', 'academic', 'wellness'] as const) {
    const text = record[key];
    if (typeof text !== 'string') return null;
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length > MAX_SECTION_LENGTH) return null;
    if (BLOCKED.some((pattern) => pattern.test(trimmed))) return null;
    if (language === 'ms' && (trimmed.match(ENGLISH_MARKERS)?.length ?? 0) >= 2) return null;
    // Thousands separators are removed; every remaining number must be a supplied fact.
    const numbers = trimmed.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) ?? [];
    if (numbers.some((number) => !allowed.has(number) && !allowed.has(String(Number(number))))) return null;
    summary[key] = trimmed;
  }
  return summary;
}

export type GroqConfig = { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number };

/** A provider failure carrying only the HTTP status and Groq error code, never content or keys. */
export class GroqError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(`Groq request failed (${status} ${code}).`); }
}

/** Calls Groq's OpenAI-compatible endpoint with a strict JSON schema; returns the raw message content. */
export async function requestGroqSummary(messages: ReturnType<typeof groqMessages>, config: GroqConfig): Promise<string> {
  // Low reasoning effort keeps gpt-oss replies fast and within free-tier token limits.
  const reasoning = config.model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {};
  const attempt = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000);
    try {
      const response = await (config.fetchImpl ?? fetch)('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          max_completion_tokens: 1024,
          ...reasoning,
          response_format: { type: 'json_schema', json_schema: { name: 'dashboard_summary', strict: true, schema: SUMMARY_SCHEMA } },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { code?: unknown } } | null;
        throw new GroqError(response.status, typeof body?.error?.code === 'string' ? body.error.code : 'unknown');
      }
      const body = await response.json() as { choices?: { message?: { content?: unknown } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new GroqError(response.status, 'no_content');
      return content;
    } finally {
      clearTimeout(timeout);
    }
  };
  try {
    return await attempt();
  } catch (error) {
    // The model occasionally misses the strict schema; one retry usually succeeds. Rate limits are not retried.
    if (error instanceof GroqError && error.code === 'json_validate_failed') return attempt();
    throw error;
  }
}
