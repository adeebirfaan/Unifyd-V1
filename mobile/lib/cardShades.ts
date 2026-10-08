// Dark shades for the Home deck's module cards. They are deliberately deep so
// the blue-to-cyan Overview card always stands out; text on them is light.
export const CARD_SHADES = {
  midnight: '#141B2D',
  emerald: '#0F2620',
  amethyst: '#221A31',
  topaz: '#2B2113',
  ocean: '#0D2230',
  graphite: '#1C1C22',
} as const;
export type CardShade = keyof typeof CARD_SHADES;
export const CARD_SHADE_IDS = Object.keys(CARD_SHADES) as CardShade[];

export const MODULE_CARD_KEYS = ['money', 'studies', 'wellbeing'] as const;
export type ModuleCardKey = (typeof MODULE_CARD_KEYS)[number];
export type CardShadeChoice = Record<ModuleCardKey, CardShade>;

export const DEFAULT_CARD_SHADES: Readonly<CardShadeChoice> = {
  money: 'emerald',
  studies: 'midnight',
  wellbeing: 'amethyst',
};

// Each student's choice is kept on this device, like quick-action shortcuts.
export const cardShadesStorageKey = (userId: string) => `unifyd:card-shades:${userId}`;

export function isCardShade(value: unknown): value is CardShade {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CARD_SHADES, value);
}

/** Reads a stored choice; any missing or unknown value falls back to that card's default. */
export function parseCardShades(raw: string | null): CardShadeChoice {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) stored = value as Record<string, unknown>;
  } catch { /* fall back to defaults */ }
  const choice = { ...DEFAULT_CARD_SHADES };
  for (const key of MODULE_CARD_KEYS) {
    const shade = stored[key];
    if (isCardShade(shade)) choice[key] = shade;
  }
  return choice;
}
