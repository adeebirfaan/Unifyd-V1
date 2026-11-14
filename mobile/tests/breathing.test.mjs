import assert from 'node:assert/strict';
import test from 'node:test';

import { BREATHING_SESSION_MS, BREATH_CYCLE_MS, BREATH_IN_MS, breathStep } from '../lib/breathing.ts';

test('a session is one minute of six 4 s in / 6 s out cycles', () => {
  assert.equal(BREATH_IN_MS, 4000);
  assert.equal(BREATH_CYCLE_MS, 10000);
  assert.equal(BREATHING_SESSION_MS, 60000);
});

test('starts breathing in with 4 seconds left', () => {
  assert.deepEqual(breathStep(0), { done: false, phase: 'in', cycle: 0, secondsLeft: 4, phaseLeftMs: 4000 });
  assert.equal(breathStep(3999).phase, 'in');
  assert.equal(breathStep(3999).secondsLeft, 1);
});

test('switches to breathing out at 4 s and back in at 10 s', () => {
  assert.deepEqual(breathStep(4000), { done: false, phase: 'out', cycle: 0, secondsLeft: 6, phaseLeftMs: 6000 });
  assert.equal(breathStep(9500).secondsLeft, 1);
  assert.deepEqual(breathStep(10000), { done: false, phase: 'in', cycle: 1, secondsLeft: 4, phaseLeftMs: 4000 });
});

test('the last cycle ends the session at exactly one minute', () => {
  const last = breathStep(59999);
  assert.equal(last.done, false);
  assert.equal(last.cycle, 5);
  assert.equal(last.phase, 'out');
  assert.deepEqual(breathStep(60000), { done: true });
  assert.deepEqual(breathStep(10 * 60000), { done: true });
});

test('a backwards clock or bad input counts as the start', () => {
  assert.deepEqual(breathStep(-5000), breathStep(0));
  assert.deepEqual(breathStep(Number.NaN), breathStep(0));
});
