import assert from 'node:assert/strict';
import test from 'node:test';

import { CARD_SHADES, DEFAULT_CARD_SHADES, parseCardShades } from '../lib/cardShades.ts';

test('a stored choice is applied per card', () => {
  assert.deepEqual(parseCardShades(JSON.stringify({ money: 'ocean', studies: 'topaz', wellbeing: 'graphite' })),
    { money: 'ocean', studies: 'topaz', wellbeing: 'graphite' });
});

test('missing, unknown, or malformed values fall back to each card default', () => {
  assert.deepEqual(parseCardShades(null), DEFAULT_CARD_SHADES);
  assert.deepEqual(parseCardShades('not json'), DEFAULT_CARD_SHADES);
  assert.deepEqual(parseCardShades('["ocean"]'), DEFAULT_CARD_SHADES);
  assert.deepEqual(parseCardShades(JSON.stringify({ money: 'ocean', studies: 'neon-pink', wellbeing: 'toString' })),
    { ...DEFAULT_CARD_SHADES, money: 'ocean' });
});

test('every shade is a dark colour, so the gradient Overview card stays the most prominent', () => {
  for (const [name, hex] of Object.entries(CARD_SHADES)) {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    assert.ok(luminance < 0.15, `${name} is too light (${luminance.toFixed(3)})`);
  }
});
