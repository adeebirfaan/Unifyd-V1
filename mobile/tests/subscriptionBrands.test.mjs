import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

import { BRAND_MARKS, SIMPLE_ICONS_VERSION } from '../constants/brandMarks.generated.ts';
import { semanticThemes } from '../constants/theme.ts';
import { normaliseSubscriptionName, subscriptionBrandKey, subscriptionVisual } from '../lib/subscriptionBrands.ts';

const require = createRequire(import.meta.url);

test('every required name and alias maps to its brand', () => {
  const expected = {
    Spotify: 'spotify', 'Spotify Premium': 'spotify',
    YouTube: 'youtube', 'YouTube Premium': 'youtube',
    ChatGPT: 'openai', 'Chat GPT': 'openai', OpenAI: 'openai', 'OpenAI Plus': 'openai',
    Claude: 'claude', 'Claude Pro': 'claude', Anthropic: 'anthropic',
    Netflix: 'netflix', 'Disney+': 'disneyPlus', 'Disney Plus': 'disneyPlus',
    'Apple Music': 'appleMusic', iCloud: 'icloud', 'iCloud+': 'icloud',
    'Google One': 'googleOne', 'Google Drive': 'googleDrive', Drive: 'googleDrive',
    Canva: 'canva', Notion: 'notion', Adobe: 'adobe', 'Adobe Creative Cloud': 'adobe',
    'Microsoft 365': 'microsoft', 'Office 365': 'microsoft',
    'Prime Video': 'amazon', 'Amazon Prime': 'amazon', 'Amazon Prime Video': 'amazon',
    Grammarly: 'grammarly', Duolingo: 'duolingo', Figma: 'figma', Dropbox: 'dropbox', Zoom: 'zoom',
  };
  for (const [name, brand] of Object.entries(expected)) assert.equal(subscriptionBrandKey(name), brand, name);
});

test('brands in the installed Simple Icons use its local marks; the rest keep Ionicons or category icons', () => {
  for (const name of ['Spotify', 'YouTube', 'Claude', 'Anthropic', 'Netflix', 'Apple Music', 'iCloud', 'Google Drive', 'Notion', 'Grammarly', 'Duolingo', 'Figma', 'Dropbox', 'Zoom']) {
    assert.equal(subscriptionVisual(name).kind, 'mark', name);
  }
  assert.deepEqual(subscriptionVisual('Google One'), { kind: 'logo', brand: 'googleOne', icon: 'logo-google' });
  assert.deepEqual(subscriptionVisual('Microsoft 365'), { kind: 'logo', brand: 'microsoft', icon: 'logo-microsoft' });
  assert.deepEqual(subscriptionVisual('Prime Video'), { kind: 'logo', brand: 'amazon', icon: 'logo-amazon' });
  assert.deepEqual(subscriptionVisual('ChatGPT Plus'), { kind: 'category', brand: 'openai', icon: 'sparkles-outline' });
  assert.deepEqual(subscriptionVisual('Disney+'), { kind: 'category', brand: 'disneyPlus', icon: 'film-outline' });
  assert.deepEqual(subscriptionVisual('Canva Pro'), { kind: 'category', brand: 'canva', icon: 'color-palette-outline' });
  assert.deepEqual(subscriptionVisual('Adobe Creative Cloud'), { kind: 'category', brand: 'adobe', icon: 'brush-outline' });
});

test('matching is case-insensitive and tolerant of spacing and punctuation, but needs whole words', () => {
  assert.equal(normaliseSubscriptionName('  SPOTIFY   premium!! '), 'spotify premium');
  assert.equal(subscriptionBrandKey('  SPOTIFY   premium!! '), 'spotify');
  assert.equal(subscriptionBrandKey('you tube'), null);
  assert.equal(subscriptionBrandKey('youTUBE  -  Premium'), 'youtube');
  assert.equal(subscriptionBrandKey('Chat-GPT'), 'openai');
  assert.equal(subscriptionBrandKey('disney+hotstar'), 'disneyPlus');
  assert.equal(subscriptionBrandKey('Spotifyish'), null);
  assert.equal(subscriptionBrandKey('Zoomba class'), null);
  // "Drive" alone means Google Drive; "Test drive lessons" does not.
  assert.equal(subscriptionBrandKey('drive'), 'googleDrive');
  assert.equal(subscriptionBrandKey('Test drive lessons'), null);
});

test('unknown or custom names fall back to a stable initial tile and never throw', () => {
  assert.deepEqual(subscriptionVisual('Gym membership'), { kind: 'initial', letter: 'G' });
  assert.deepEqual(subscriptionVisual('gym MEMBERSHIP'), subscriptionVisual('Gym membership'));
  assert.deepEqual(subscriptionVisual('  émission locale'), { kind: 'initial', letter: 'E' });
  assert.deepEqual(subscriptionVisual('123 Storage'), { kind: 'initial', letter: '1' });
  assert.deepEqual(subscriptionVisual('!!!'), { kind: 'initial', letter: '?' });
  assert.deepEqual(subscriptionVisual(''), { kind: 'initial', letter: '?' });
});

test('mapping never changes the stored name or any other subscription data', () => {
  const record = Object.freeze({ id: 'x', name: '  Spotify Premium ', amount: '15.90', billing_frequency: 'monthly' });
  subscriptionVisual(record.name);
  subscriptionBrandKey(record.name);
  assert.deepEqual(record, { id: 'x', name: '  Spotify Premium ', amount: '15.90', billing_frequency: 'monthly' });
});

test('the bundled marks match the installed Simple Icons data exactly', () => {
  const icons = require('simple-icons');
  const exports = { spotify: 'siSpotify', youtube: 'siYoutube', claude: 'siClaude', anthropic: 'siAnthropic', netflix: 'siNetflix', appleMusic: 'siApplemusic', icloud: 'siIcloud',
    googleDrive: 'siGoogledrive', notion: 'siNotion', grammarly: 'siGrammarly', duolingo: 'siDuolingo', figma: 'siFigma', dropbox: 'siDropbox', zoom: 'siZoom' };
  assert.deepEqual(Object.keys(BRAND_MARKS).sort(), Object.keys(exports).sort());
  for (const [key, name] of Object.entries(exports)) assert.equal(BRAND_MARKS[key].path, icons[name].path, key);
  const { version } = JSON.parse(readFileSync(new URL('../node_modules/simple-icons/package.json', import.meta.url), 'utf8'));
  assert.equal(SIMPLE_ICONS_VERSION, version);
});

test('rendering has no network dependency and does not bundle the whole Simple Icons package', () => {
  const component = readFileSync(new URL('../components/finance/SubscriptionBrandIcon.tsx', import.meta.url), 'utf8');
  const generated = readFileSync(new URL('../constants/brandMarks.generated.ts', import.meta.url), 'utf8');
  for (const source of [component, generated]) {
    assert.doesNotMatch(source, /https?:\/\//);
    assert.doesNotMatch(source, /from 'simple-icons'|require\('simple-icons'\)/);
    assert.doesNotMatch(source, /\buri\s*=|<Image\b|fetch\(/);
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies['simple-icons'], undefined, 'build-time only');
  assert.ok(pkg.devDependencies['simple-icons']);
});

test('every tile kind uses the one accent colour, with strong contrast on the tile in Dark and Light (tiles stay dark in both)', () => {
  const component = readFileSync(new URL('../components/finance/SubscriptionBrandIcon.tsx', import.meta.url), 'utf8');
  assert.match(component, /const ink = tokens\.brandCyan;/);
  assert.doesNotMatch(component, /tokens\.cardText/, 'no mark is drawn in white');
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  for (const mode of ['dark', 'light']) {
    const theme = semanticThemes[mode];
    assert.ok(contrast(theme.brandCyan, theme.cardElevated) >= 4.5, `${mode} accent contrast`);
  }
});
