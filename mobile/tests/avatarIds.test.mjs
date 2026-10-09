import assert from 'node:assert/strict';
import test from 'node:test';

import { AVATAR_IDS, DEFAULT_AVATAR_ID, isAvatarId, resolveAvatarId } from '../lib/avatarIds.ts';

test('there are 12 unique, stable, non-path avatar IDs', () => {
  assert.equal(AVATAR_IDS.length, 12);
  assert.equal(new Set(AVATAR_IDS).size, 12);
  for (const id of AVATAR_IDS) assert.match(id, /^[a-z]+(_[a-z]+)*$/, `${id} must be a plain ID, not a filename or URL`);
  assert.equal(DEFAULT_AVATAR_ID, AVATAR_IDS[0]);
});

test('curated IDs are kept as they are', () => {
  assert.equal(resolveAvatarId('music_girl'), 'music_girl');
  assert.equal(isAvatarId('hijab_girl'), true);
});

test('legacy, remote, file-path, and missing values fall back to the default', () => {
  for (const value of ['avatar-01', 'avatar-12', 'https://api.dicebear.com/10.x/notionists/png?seed=unifyd-ember',
    '04-music girl.png', 'file:///data/avatar.png', 'data:image/png;base64,AAAA', '', null, undefined, 42, 'MUSIC_GIRL']) {
    assert.equal(resolveAvatarId(value), DEFAULT_AVATAR_ID, String(value));
    assert.equal(isAvatarId(value), false, String(value));
  }
});
