import type { BrandMarkKey } from '@/constants/brandMarks.generated';

/**
 * Visual identity for a subscription row, derived from its name only. Nothing is stored or changed, and
 * no migration is needed. Matching is case-insensitive, ignores accents and punctuation, and uses whole words.
 *
 * - `mark`: a brand mark from Simple Icons (CC0 vector data copied locally into constants/brandMarks.generated.ts).
 * - `logo`: a brand mark already bundled in Ionicons, for brands Simple Icons no longer carries.
 * - `category`: an original category icon for known services with no available mark.
 * - `initial`: a neutral tile with the name's first letter for every other name.
 * Brand marks only identify the student's own plan and imply no affiliation. Nothing is fetched remotely.
 */
export type SubscriptionVisual =
  | { kind: 'mark'; brand: BrandMarkKey }
  | { kind: 'logo'; brand: string; icon: BundledIcon }
  | { kind: 'category'; brand: string; icon: CategoryIcon }
  | { kind: 'initial'; letter: string };

type BundledIcon = 'logo-apple' | 'logo-google' | 'logo-microsoft' | 'logo-amazon';
type CategoryIcon = 'musical-notes-outline' | 'film-outline' | 'sparkles-outline' | 'color-palette-outline' | 'document-text-outline' | 'brush-outline' | 'cloud-outline';
type Visual = Exclude<SubscriptionVisual, { kind: 'initial' }>;

const mark = (brand: BrandMarkKey): Visual => ({ kind: 'mark', brand });
const logo = (brand: string, icon: BundledIcon): Visual => ({ kind: 'logo', brand, icon });
const category = (brand: string, icon: CategoryIcon): Visual => ({ kind: 'category', brand, icon });

/**
 * First match wins, so more specific names come first ("Apple Music" before other Apple plans,
 * "Google Drive" before other Google plans). `exact` aliases match only the whole name.
 */
const RULES: { aliases: string[]; exact?: string[]; visual: Visual }[] = [
  { aliases: ['spotify'], visual: mark('spotify') },
  { aliases: ['youtube'], visual: mark('youtube') },
  { aliases: ['claude'], visual: mark('claude') },
  { aliases: ['anthropic'], visual: mark('anthropic') },
  { aliases: ['netflix'], visual: mark('netflix') },
  { aliases: ['apple music'], visual: mark('appleMusic') },
  { aliases: ['icloud'], visual: mark('icloud') },
  { aliases: ['google drive'], exact: ['drive'], visual: mark('googleDrive') },
  { aliases: ['notion'], visual: mark('notion') },
  { aliases: ['grammarly'], visual: mark('grammarly') },
  { aliases: ['duolingo'], visual: mark('duolingo') },
  { aliases: ['figma'], visual: mark('figma') },
  { aliases: ['dropbox'], visual: mark('dropbox') },
  { aliases: ['zoom'], visual: mark('zoom') },
  // Not in the installed Simple Icons version: kept on the existing Ionicons marks.
  { aliases: ['google one', 'google workspace', 'gemini'], visual: logo('googleOne', 'logo-google') },
  { aliases: ['microsoft', 'office 365', 'xbox game pass'], visual: logo('microsoft', 'logo-microsoft') },
  { aliases: ['prime video', 'amazon prime', 'amazon'], visual: logo('amazon', 'logo-amazon') },
  { aliases: ['apple tv', 'apple one'], visual: logo('apple', 'logo-apple') },
  // No mark available anywhere approved: original category icons.
  { aliases: ['chatgpt', 'chat gpt', 'openai', 'open ai'], visual: category('openai', 'sparkles-outline') },
  { aliases: ['disney plus', 'disney'], visual: category('disneyPlus', 'film-outline') },
  { aliases: ['canva'], visual: category('canva', 'color-palette-outline') },
  { aliases: ['adobe', 'creative cloud', 'photoshop', 'lightroom'], visual: category('adobe', 'brush-outline') },
  { aliases: ['deezer', 'tidal', 'joox'], visual: category('music', 'musical-notes-outline') },
  { aliases: ['viu', 'iqiyi', 'hbo', 'astro'], visual: category('video', 'film-outline') },
  { aliases: ['copilot', 'perplexity'], visual: category('ai', 'sparkles-outline') },
  { aliases: ['evernote'], visual: category('notes', 'document-text-outline') },
  { aliases: ['onedrive', 'mega'], visual: category('storage', 'cloud-outline') },
];

/** Lowercase, strip accents, read "+" as "plus", turn other punctuation into spaces, collapse spaces. */
export function normaliseSubscriptionName(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/\+/g, ' plus ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Brand key for a name, or null for unknown or custom names. */
export function subscriptionBrandKey(name: string): string | null {
  const visual = subscriptionVisual(name);
  return visual.kind === 'initial' ? null : visual.brand;
}

export function subscriptionVisual(name: string): SubscriptionVisual {
  const normalised = normaliseSubscriptionName(name);
  const padded = ` ${normalised} `;
  for (const rule of RULES) {
    if (rule.exact?.includes(normalised) || rule.aliases.some((alias) => padded.includes(` ${alias} `))) return rule.visual;
  }
  const letter = [...normalised.replace(/[^\p{L}\p{N}]/gu, '')][0]?.toUpperCase() ?? '?';
  return { kind: 'initial', letter };
}
