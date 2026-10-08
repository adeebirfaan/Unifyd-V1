import type { TranslationKey } from '@/constants/i18n';
import type { CheckInLevel } from '@/lib/moodEntries';

export type TrendPeriod = 7 | 30;
export type TrendEntry = {
  mood_level: CheckInLevel;
  stress_level: CheckInLevel;
  recorded_at: string;
};
export type DailyAverage = { date: Date; count: number; mood: number | null; stress: number | null };
export type Direction = 'higher' | 'lower' | 'similar';
export type MoodTrend = {
  count: number;
  mood: number | null;
  stress: number | null;
  days: DailyAverage[];
  comparison: { mood: Direction; stress: Direction } | null;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function moodPeriodBounds(period: TrendPeriod, now = new Date()) {
  const today = startOfLocalDay(now);
  return {
    previousStart: addLocalDays(today, 1 - period * 2),
    currentStart: addLocalDays(today, 1 - period),
    endExclusive: addLocalDays(today, 1),
  };
}

function average(entries: TrendEntry[], field: 'mood_level' | 'stress_level'): number | null {
  return entries.length ? entries.reduce((sum, entry) => sum + entry[field], 0) / entries.length : null;
}

function direction(current: number, previous: number): Direction {
  const difference = current - previous;
  return difference >= 0.25 ? 'higher' : difference <= -0.25 ? 'lower' : 'similar';
}

export function summarizeMoodTrend(entries: TrendEntry[], period: TrendPeriod, now = new Date()): MoodTrend {
  const { previousStart, currentStart, endExclusive } = moodPeriodBounds(period, now);
  const current: TrendEntry[] = [];
  const previous: TrendEntry[] = [];
  const byDay = new Map<string, TrendEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.recorded_at);
    if (Number.isNaN(date.getTime()) || date < previousStart || date >= endExclusive) continue;
    if (date < currentStart) { previous.push(entry); continue; }
    current.push(entry);
    const key = localDayKey(date);
    const group = byDay.get(key) ?? [];
    group.push(entry);
    byDay.set(key, group);
  }
  const days = Array.from({ length: period }, (_, index) => {
    const date = addLocalDays(currentStart, index);
    const group = byDay.get(localDayKey(date)) ?? [];
    return { date, count: group.length, mood: average(group, 'mood_level'), stress: average(group, 'stress_level') };
  });
  const mood = average(current, 'mood_level');
  const stress = average(current, 'stress_level');
  const previousMood = average(previous, 'mood_level');
  const previousStress = average(previous, 'stress_level');
  const comparison = current.length >= 2 && previous.length >= 2 && mood !== null && stress !== null && previousMood !== null && previousStress !== null
    ? { mood: direction(mood, previousMood), stress: direction(stress, previousStress) }
    : null;
  return { count: current.length, mood, stress, days, comparison };
}

export function suggestionKeys(latest: Pick<TrendEntry, 'mood_level' | 'stress_level'> | null): readonly [TranslationKey, TranslationKey] {
  if (!latest) return ['mind.ideaRoutine', 'mind.ideaPause'];
  if (latest.stress_level >= 4 && latest.mood_level <= 2) return ['mind.ideaScreenBreak', 'mind.ideaReachOut'];
  if (latest.stress_level >= 4) return ['mind.ideaScreenBreak', 'mind.ideaSmallTask'];
  if (latest.mood_level <= 2) return ['mind.ideaWrite', 'mind.ideaCalm'];
  return ['mind.ideaRoutine', 'mind.ideaGoodThing'];
}
