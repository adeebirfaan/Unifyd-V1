import type { LanguagePreference } from '@/constants/i18n';

export type GreetingKey = 'home.greetingMorning' | 'home.greetingMidday' | 'home.greetingAfternoon' | 'home.greetingEvening';

/**
 * Time-of-day greeting for the device's local hour. Malay "petang" lasts until
 * about dusk, so its evening greeting starts an hour later than English.
 */
export function greetingKey(hour: number, language: LanguagePreference): GreetingKey {
  if (hour >= 5 && hour < 12) return 'home.greetingMorning';
  if (hour >= 12 && hour < 14) return 'home.greetingMidday';
  if (hour >= 14 && hour < (language === 'ms' ? 19 : 18)) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}
