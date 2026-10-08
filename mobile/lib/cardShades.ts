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
export type ModuleCardKey = 'money' | 'studies' | 'wellbeing';

export const DEFAULT_CARD_SHADES: Readonly<Record<ModuleCardKey, CardShade>> = {
  money: 'emerald',
  studies: 'midnight',
  wellbeing: 'amethyst',
};
