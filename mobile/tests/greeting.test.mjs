import assert from 'node:assert/strict';
import test from 'node:test';

import { greetingKey } from '../lib/greeting.ts';

test('greetings follow the local hour, with boundaries at the start of each period', () => {
  const at = (hours, language = 'en') => hours.map((hour) => greetingKey(hour, language));
  assert.deepEqual(at([5, 11]), ['home.greetingMorning', 'home.greetingMorning']);
  assert.deepEqual(at([12, 13]), ['home.greetingMidday', 'home.greetingMidday']);
  assert.deepEqual(at([14, 17]), ['home.greetingAfternoon', 'home.greetingAfternoon']);
  assert.deepEqual(at([18, 23, 0, 4]), Array(4).fill('home.greetingEvening'));
});

test('Malay keeps "petang" until 7 pm', () => {
  assert.equal(greetingKey(18, 'ms'), 'home.greetingAfternoon');
  assert.equal(greetingKey(19, 'ms'), 'home.greetingEvening');
  assert.equal(greetingKey(18, 'en'), 'home.greetingEvening');
});
