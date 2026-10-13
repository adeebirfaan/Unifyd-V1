import assert from 'node:assert/strict';
import test from 'node:test';

import { SUBSCRIPTION_SUGGESTIONS, SUGGESTION_LIMIT, matchSubscriptionSuggestions, selectedSuggestion, subscriptionVisual } from '../lib/subscriptionBrands.ts';
import { canRetryReminder, createSubscription, retryReminder } from '../lib/subscriptionCreate.ts';
import { SWIPE_COMPLETE_RATIO, coverRadius, isHorizontalSwipe, swipeCompletes, swipePosition, swipeTravel } from '../lib/swipeToSave.ts';

const input = { name: 'Spotify', amount: 15.9, category: null, billing_frequency: 'monthly', next_billing_date: '2026-10-18', reminder_days_before: 3, notifications_enabled: true, is_active: true, notes: null };

test('the suggestion catalogue holds the 12 requested names, each with a local icon (never the initial fallback)', () => {
  assert.deepEqual(SUBSCRIPTION_SUGGESTIONS.map((item) => item.name), [
    'Spotify', 'Netflix', 'YouTube Premium', 'Apple Music', 'Google One', 'iCloud+', 'Microsoft 365', 'Canva', 'Adobe Creative Cloud', 'ChatGPT', 'Disney+', 'Notion',
  ]);
  for (const { name } of SUBSCRIPTION_SUGGESTIONS) assert.notEqual(subscriptionVisual(name).kind, 'initial', name);
});

test('suggestions filter case-insensitively, prefix matches first, and keywords find other common names', () => {
  assert.deepEqual(matchSubscriptionSuggestions('SPO'), ['Spotify']);
  assert.deepEqual(matchSubscriptionSuggestions('  netf '), ['Netflix']);
  // "Apple Music" starts with "apple"; iCloud+ only matches through its "apple storage" keyword, so it comes after.
  assert.deepEqual(matchSubscriptionSuggestions('apple'), ['Apple Music', 'iCloud+']);
  assert.deepEqual(matchSubscriptionSuggestions('music'), ['YouTube Premium', 'Apple Music']);
  assert.deepEqual(matchSubscriptionSuggestions('office'), ['Microsoft 365']);
  assert.deepEqual(matchSubscriptionSuggestions('gpt'), ['ChatGPT']);
  assert.deepEqual(matchSubscriptionSuggestions('disney plus'), ['Disney+']);
  assert.deepEqual(matchSubscriptionSuggestions('icloud+'), ['iCloud+']);
  assert.deepEqual(matchSubscriptionSuggestions('Gym membership'), []);
  assert.equal(matchSubscriptionSuggestions('').length, SUGGESTION_LIMIT);
  assert.ok(matchSubscriptionSuggestions('o').length <= SUGGESTION_LIMIT);
});

test('a name is selected only when it equals a suggestion; custom or edited names are not', () => {
  assert.equal(selectedSuggestion('spotify'), 'Spotify');
  assert.equal(selectedSuggestion(' Disney + '), 'Disney+');
  assert.equal(selectedSuggestion('Spotify Family'), null);
  assert.equal(selectedSuggestion('Spotif'), null);
  assert.equal(selectedSuggestion(''), null);
  // The icon follows the text: an edited name keeps a matching brand only while it still names it.
  assert.equal(subscriptionVisual('Spotify Family').kind, 'mark');
  assert.deepEqual(subscriptionVisual('Spotif'), { kind: 'initial', letter: 'S' });
});

test('swipe maths: travel, clamping, the 90% threshold, and sideways-only drags', () => {
  assert.equal(swipeTravel(320, 52, 4), 260);
  assert.equal(swipeTravel(40, 52, 4), 0);
  assert.equal(swipePosition(-20, 260), 0);
  assert.equal(swipePosition(400, 260), 260);
  assert.equal(SWIPE_COMPLETE_RATIO, 0.9);
  assert.equal(swipeCompletes(233, 260), false);
  assert.equal(swipeCompletes(234, 260), true);
  assert.equal(swipeCompletes(0, 0), false, 'an unmeasured track never completes');
  assert.equal(isHorizontalSwipe(4, 0), false, 'within the slop');
  assert.equal(isHorizontalSwipe(20, 4), true);
  assert.equal(isHorizontalSwipe(20, 18), false, 'a diagonal or vertical move is left to scrolling');
  assert.equal(isHorizontalSwipe(-20, 0), false);
  assert.equal(Math.round(coverRadius(300, 700, 400, 800)), Math.round(Math.hypot(300, 700)));
});

test('a saved subscription stays saved when the reminder fails, and retrying never inserts again', async () => {
  let inserts = 0;
  const insert = async () => { inserts += 1; return true; };
  assert.deepEqual(await createSubscription(input, insert, async () => { throw new Error('scheduler'); }), { saved: true, reminderIssue: 'error' });
  assert.deepEqual(await createSubscription(input, insert, async () => 'permissionDenied'), { saved: true, reminderIssue: 'permissionDenied' });
  assert.equal(inserts, 2);
  let reminders = 0;
  assert.equal(await retryReminder(input, async () => { reminders += 1; return ''; }), '');
  assert.equal(reminders, 1);
  assert.equal(inserts, 2, 'retrying the reminder does not insert');
});

test('a failed insert reports not saved and never schedules a reminder', async () => {
  let reminders = 0;
  const reminder = async () => { reminders += 1; return ''; };
  assert.deepEqual(await createSubscription(input, async () => false, reminder), { saved: false });
  assert.deepEqual(await createSubscription(input, async () => { throw new Error('network'); }, reminder), { saved: false });
  assert.equal(reminders, 0);
  assert.equal(canRetryReminder('error'), true);
  assert.equal(canRetryReminder('permissionDenied'), true);
  assert.equal(canRetryReminder('unsupported'), false);
  assert.equal(canRetryReminder('past'), false);
  assert.equal(canRetryReminder(''), false);
});
