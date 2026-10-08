import type { LanguagePreference, TranslationKey } from '@/constants/i18n';

export type CheckInLevel = 1 | 2 | 3 | 4 | 5;

export type MoodEntry = {
  id: string;
  mood_level: CheckInLevel;
  stress_level: CheckInLevel;
  note: string | null;
  recorded_at: string;
};

export const CHECK_IN_LEVELS = [1, 2, 3, 4, 5] as const;

const moodKeys = {
  1: 'mind.mood1', 2: 'mind.mood2', 3: 'mind.mood3',
  4: 'mind.mood4', 5: 'mind.mood5',
} as const satisfies Record<CheckInLevel, TranslationKey>;

const stressKeys = {
  1: 'mind.stress1', 2: 'mind.stress2', 3: 'mind.stress3',
  4: 'mind.stress4', 5: 'mind.stress5',
} as const satisfies Record<CheckInLevel, TranslationKey>;

export function isCheckInLevel(value: unknown): value is CheckInLevel {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function moodLabelKey(level: CheckInLevel) { return moodKeys[level]; }
export function stressLabelKey(level: CheckInLevel) { return stressKeys[level]; }

export function formatCheckInDate(value: string, language: LanguagePreference): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}
