import assert from 'node:assert/strict';
import test from 'node:test';

import { REFLECTION_FEELINGS, checkInFollowUp, checkInInviteDecision, localDateKey, reflectionOutcome, shouldInviteReflection, startOfLocalDay } from '../lib/wellbeing.ts';

test('high stress and low mood: breathing, a trusted person, and rest', () => {
  assert.deepEqual(checkInFollowUp({ mood_level: 1, stress_level: 5 }), { breathing: true, tips: ['wellbeing.tip.friend', 'wellbeing.tip.rest'] });
});

test('high stress only: breathing, a study break, and a walk', () => {
  assert.deepEqual(checkInFollowUp({ mood_level: 4, stress_level: 4 }), { breathing: true, tips: ['wellbeing.tip.break', 'wellbeing.tip.walk'] });
});

test('low mood only: breathing, a trusted person, and a walk', () => {
  assert.deepEqual(checkInFollowUp({ mood_level: 2, stress_level: 1 }), { breathing: true, tips: ['wellbeing.tip.friend', 'wellbeing.tip.walk'] });
});

test('moderate stress offers breathing with everyday tips', () => {
  assert.deepEqual(checkInFollowUp({ mood_level: 3, stress_level: 3 }), { breathing: true, tips: ['wellbeing.tip.water', 'wellbeing.tip.rest'] });
});

test('a calm check-in gets everyday tips and no breathing invitation', () => {
  assert.deepEqual(checkInFollowUp({ mood_level: 5, stress_level: 1 }), { breathing: false, tips: ['wellbeing.tip.water', 'wellbeing.tip.rest'] });
  assert.equal(checkInFollowUp({ mood_level: 3, stress_level: 2 }).breathing, false);
});

test('always exactly two tips and never a number', () => {
  for (let mood = 1; mood <= 5; mood++) for (let stress = 1; stress <= 5; stress++) {
    const result = checkInFollowUp({ mood_level: mood, stress_level: stress });
    assert.equal(result.tips.length, 2);
    assert.deepEqual(Object.keys(result).sort(), ['breathing', 'tips']);
  }
});

test('local date keys use the local calendar, not UTC', () => {
  // 00:30 on 15 Nov in Kuala Lumpur is still 14 Nov in UTC.
  assert.equal(localDateKey(new Date(2026, 10, 15, 0, 30)), '2026-11-15');
  assert.equal(localDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(startOfLocalDay(new Date(2026, 10, 15, 18, 45)).getTime(), new Date(2026, 10, 15).getTime());
});

test('the daily invite shows once per local day and never after a check-in', () => {
  assert.equal(checkInInviteDecision(false, null, '2026-11-15'), 'show');
  assert.equal(checkInInviteDecision(false, '2026-11-14', '2026-11-15'), 'show');
  assert.equal(checkInInviteDecision(false, '2026-11-15', '2026-11-15'), 'keep');
  assert.equal(checkInInviteDecision(true, null, '2026-11-15'), 'hide');
  assert.equal(checkInInviteDecision(true, '2026-11-14', '2026-11-15'), 'hide');
});

test('the reflection has the five approved feelings', () => {
  assert.deepEqual(REFLECTION_FEELINGS, ['wellbeing.feel.relax', 'wellbeing.feel.low', 'wellbeing.feel.worried', 'wellbeing.feel.energy', 'wellbeing.feel.sleep']);
});

test('any Often suggests help; otherwise calm; never a score', () => {
  assert.equal(reflectionOutcome(['notReally', 'notReally', 'notReally', 'notReally', 'notReally']), 'calm');
  assert.equal(reflectionOutcome(['sometimes', 'sometimes', 'sometimes', 'sometimes', 'sometimes']), 'calm');
  assert.equal(reflectionOutcome(['notReally', 'sometimes', 'often', 'notReally', 'notReally']), 'suggestHelp');
  assert.equal(reflectionOutcome(['often', 'often', 'often', 'often', 'often']), 'suggestHelp');
  assert.equal(typeof reflectionOutcome([]), 'string');
});

test('the reflection invitation needs the low-mood rule and respects Not now for the day', () => {
  assert.equal(shouldInviteReflection(true, null, '2026-11-15'), true);
  assert.equal(shouldInviteReflection(true, '2026-11-14', '2026-11-15'), true);
  assert.equal(shouldInviteReflection(true, '2026-11-15', '2026-11-15'), false);
  assert.equal(shouldInviteReflection(false, null, '2026-11-15'), false);
});
