// Stable avatar IDs: the only avatar values ever stored in profiles.avatar_id.
// Kept free of image imports so the rules can be unit-tested in Node.
export const AVATAR_IDS = [
  'women_turban', 'afro_guy', 'gorpcore_guy', 'music_girl', 'cap_guy', 'normal_guy',
  'genius_guy', 'cool_guy', 'floral_girl', 'hijab_girl', 'it_girl', 'curly_guy',
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

/** Used only when a profile has no valid selection (for example a legacy generated-avatar value). */
export const DEFAULT_AVATAR_ID: AvatarId = 'women_turban';

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value);
}

/** Any missing, legacy ('avatar-01'), remote URL, or unknown value falls back to the default avatar. */
export function resolveAvatarId(value: unknown): AvatarId {
  return isAvatarId(value) ? value : DEFAULT_AVATAR_ID;
}
