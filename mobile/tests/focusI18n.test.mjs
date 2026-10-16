import assert from 'node:assert/strict';
import test from 'node:test';

import { translate } from '../constants/i18n.ts';

// Every Unifyd Focus string exists in English and Malay with the same {placeholders}, and Malay is really Malay.
test('Focus strings are translated in English and Malay with matching placeholders', async () => {
  const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../constants/i18n.ts', import.meta.url), 'utf8'));
  const keys = [...new Set([...source.matchAll(/'(focus\.\w+)':/g)].map((match) => match[1]))];
  assert.ok(keys.length > 150, `found ${keys.length} keys`);
  const same = new Set(['focus.actionA11y', 'focus.title', 'focus.durationM', 'focus.minutes', 'focus.dayA11y', 'focus.subjectA11y']);
  for (const key of keys) {
    const en = translate('en', key);
    const ms = translate('ms', key);
    assert.ok(en && ms, key);
    const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(holes(ms), holes(en), key);
    if (!same.has(key) && en.length > 12) assert.notEqual(ms, en, `${key} is not translated`);
  }
});
