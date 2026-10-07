/** Stable avatar IDs are the only avatar values persisted in profiles. */
export const AVATARS = [
  { id: 'avatar-01', seed: 'unifyd-ember' },
  { id: 'avatar-02', seed: 'unifyd-orbit' },
  { id: 'avatar-03', seed: 'unifyd-sage' },
  { id: 'avatar-04', seed: 'unifyd-nova' },
  { id: 'avatar-05', seed: 'unifyd-river' },
  { id: 'avatar-06', seed: 'unifyd-pixel' },
  { id: 'avatar-07', seed: 'unifyd-lumen' },
  { id: 'avatar-08', seed: 'unifyd-cove' },
  { id: 'avatar-09', seed: 'unifyd-sky' },
  { id: 'avatar-10', seed: 'unifyd-moss' },
  { id: 'avatar-11', seed: 'unifyd-echo' },
  { id: 'avatar-12', seed: 'unifyd-spark' },
] as const;

export type AvatarId = (typeof AVATARS)[number]['id'];
export const DEFAULT_AVATAR_ID: AvatarId = 'avatar-01';

/** Use a fixed DiceBear version and seed so each saved ID keeps its appearance. */
export function getAvatarUrl(id: string): string {
  const avatar = AVATARS.find((option) => option.id === id) ?? AVATARS[0];
  return `https://api.dicebear.com/10.x/notionists/png?seed=${encodeURIComponent(avatar.seed)}&size=128&backgroundColor=f8fafc`;
}
