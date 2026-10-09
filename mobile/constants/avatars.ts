import type { ImageSourcePropType } from 'react-native';

import type { TranslationKey } from '@/constants/i18n';
import { AVATAR_IDS, DEFAULT_AVATAR_ID, resolveAvatarId } from '@/lib/avatarIds';
import type { AvatarId } from '@/lib/avatarIds';

export { AVATAR_IDS, DEFAULT_AVATAR_ID, isAvatarId, resolveAvatarId } from '@/lib/avatarIds';
export type { AvatarId } from '@/lib/avatarIds';

export type AvatarOption = { id: AvatarId; labelKey: TranslationKey; source: ImageSourcePropType };

/**
 * The curated local avatar library. Images are bundled with the app (resized
 * copies of the approved files in /assets/avatars); nothing is generated or
 * downloaded. Every screen reads avatars from this manifest.
 */
export const AVATARS: readonly AvatarOption[] = [
  { id: 'women_turban', labelKey: 'avatar.name.women_turban', source: require('../assets/avatars/women_turban.png') },
  { id: 'afro_guy', labelKey: 'avatar.name.afro_guy', source: require('../assets/avatars/afro_guy.png') },
  { id: 'gorpcore_guy', labelKey: 'avatar.name.gorpcore_guy', source: require('../assets/avatars/gorpcore_guy.png') },
  { id: 'music_girl', labelKey: 'avatar.name.music_girl', source: require('../assets/avatars/music_girl.png') },
  { id: 'cap_guy', labelKey: 'avatar.name.cap_guy', source: require('../assets/avatars/cap_guy.png') },
  { id: 'normal_guy', labelKey: 'avatar.name.normal_guy', source: require('../assets/avatars/normal_guy.png') },
  { id: 'genius_guy', labelKey: 'avatar.name.genius_guy', source: require('../assets/avatars/genius_guy.png') },
  { id: 'cool_guy', labelKey: 'avatar.name.cool_guy', source: require('../assets/avatars/cool_guy.png') },
  { id: 'floral_girl', labelKey: 'avatar.name.floral_girl', source: require('../assets/avatars/floral_girl.png') },
  { id: 'hijab_girl', labelKey: 'avatar.name.hijab_girl', source: require('../assets/avatars/hijab_girl.png') },
  { id: 'it_girl', labelKey: 'avatar.name.it_girl', source: require('../assets/avatars/it_girl.png') },
  { id: 'curly_guy', labelKey: 'avatar.name.curly_guy', source: require('../assets/avatars/curly_guy.png') },
];

if (__DEV__ && AVATARS.map((avatar) => avatar.id).join() !== AVATAR_IDS.join()) {
  throw new Error('The avatar manifest must list every AVATAR_IDS entry in order.');
}

/** The avatar to show for any stored value; invalid or legacy values use the default. */
export function getAvatar(value: unknown): AvatarOption {
  const id = resolveAvatarId(value);
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS.find((avatar) => avatar.id === DEFAULT_AVATAR_ID)!;
}
