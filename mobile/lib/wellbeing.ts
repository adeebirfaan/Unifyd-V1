// Wellbeing support rules (SRS §5.12, SDD §7.11). Pure, local, no AI. Never returns a score or level.
import type { TranslationKey } from '@/constants/i18n';

export type CheckInLevels = { mood_level: number; stress_level: number };
export type CheckInFollowUp = { breathing: boolean; tips: readonly [TranslationKey, TranslationKey] };

/**
 * What to offer right after a check-in is saved (SRS-FR-1103): a breathing invitation when stress is
 * moderate or higher or mood is low, and two short general tips from the owner's approved list.
 */
export function checkInFollowUp(levels: CheckInLevels): CheckInFollowUp {
  const stressed = levels.stress_level >= 4;
  const low = levels.mood_level <= 2;
  const breathing = levels.stress_level >= 3 || low;
  if (stressed && low) return { breathing, tips: ['wellbeing.tip.friend', 'wellbeing.tip.rest'] };
  if (stressed) return { breathing, tips: ['wellbeing.tip.break', 'wellbeing.tip.walk'] };
  if (low) return { breathing, tips: ['wellbeing.tip.friend', 'wellbeing.tip.walk'] };
  return { breathing, tips: ['wellbeing.tip.water', 'wellbeing.tip.rest'] };
}

/** Local calendar date as YYYY-MM-DD (never UTC), for once-a-day rules. */
export function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Start of the local calendar day, for "a check-in today" queries. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export type CheckInInviteDecision = 'show' | 'hide' | 'keep';

/**
 * Daily check-in invite (SRS-FR-1104), at most once per local day.
 * 'hide' when there is already a check-in today; 'show' when today's invite has not been shown yet;
 * 'keep' leaves whatever is on screen (an invite already shown today stays until dismissed).
 */
export function checkInInviteDecision(checkedInToday: boolean, lastInviteDate: string | null, today: string): CheckInInviteDecision {
  if (checkedInToday) return 'hide';
  return lastInviteDate === today ? 'keep' : 'show';
}

// "How have you been?" reflection (SRS-FR-1105). Plain feelings chosen for this app, not DASS items.
export const REFLECTION_FEELINGS = [
  'wellbeing.feel.relax', 'wellbeing.feel.low', 'wellbeing.feel.worried', 'wellbeing.feel.energy', 'wellbeing.feel.sleep',
] as const satisfies readonly TranslationKey[];
export type ReflectionAnswer = 'notReally' | 'sometimes' | 'often';
export type ReflectionOutcome = 'calm' | 'suggestHelp';

/** Any "Often" suggests a counsellor or doctor; otherwise a calm line. Never a number, level, or label. */
export function reflectionOutcome(answers: readonly ReflectionAnswer[]): ReflectionOutcome {
  return answers.includes('often') ? 'suggestHelp' : 'calm';
}

/** Reflection invitation (SRS-FR-1106): only when the low-mood rule is met, and not after Not now today. */
export function shouldInviteReflection(lowMoodRuleMet: boolean, notNowDate: string | null, today: string): boolean {
  return lowMoodRuleMet && notNowDate !== today;
}
