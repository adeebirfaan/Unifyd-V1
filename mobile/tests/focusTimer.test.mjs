import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_FOCUS_SETTINGS, FOCUS_PRESETS, advanceFocus, applyFocusAction, breakAfter, elapsedMs, focusAlerts, formatFocusClock, initialFocusState,
  newFocusId, nextBreak, normalizeFocusSettings, parseFocusState, phaseEndsAt, remainingMs, roundNumber, settingsForPreset,
} from '../lib/focusTimer.ts';

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 16, 2, 0);
let ids = 0;
const nextId = () => `block-${++ids}`;
/** Applies actions in order, each at its own fake time; collects every finished block. */
function run(state, steps) {
  const finished = [];
  for (const [action, at] of steps) {
    const result = applyFocusAction(state, typeof action === 'string' ? { type: action } : action, at, nextId);
    state = result.state;
    finished.push(...result.finished);
  }
  return { state, finished };
}

test('every preset sets its focus and short break; the long break defaults to 15 minutes', () => {
  for (const [preset, values] of Object.entries(FOCUS_PRESETS)) {
    const settings = settingsForPreset(DEFAULT_FOCUS_SETTINGS, preset);
    assert.deepEqual(settings, { preset, ...values, longBreakMinutes: 15 });
    const { state } = run(initialFocusState(settings), [['start', T0]]);
    assert.equal(remainingMs(state, T0), values.focusMinutes * MIN);
    assert.equal(remainingMs(state, T0 + 10 * MIN), (values.focusMinutes - 10) * MIN);
  }
  assert.deepEqual([FOCUS_PRESETS.classic, FOCUS_PRESETS.deep, FOCUS_PRESETS.quick], [
    { focusMinutes: 25, shortBreakMinutes: 5 }, { focusMinutes: 50, shortBreakMinutes: 10 }, { focusMinutes: 15, shortBreakMinutes: 3 },
  ]);
});

test('custom durations stay within limits and keep the student’s own values; presets ignore stray values', () => {
  assert.deepEqual(normalizeFocusSettings({ preset: 'custom', focusMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 20 }),
    { preset: 'custom', focusMinutes: 40, shortBreakMinutes: 7, longBreakMinutes: 20 });
  assert.deepEqual(normalizeFocusSettings({ preset: 'custom', focusMinutes: 500, shortBreakMinutes: 0, longBreakMinutes: 1 }),
    { preset: 'custom', focusMinutes: 120, shortBreakMinutes: 1, longBreakMinutes: 5 });
  assert.deepEqual(normalizeFocusSettings({ preset: 'deep', focusMinutes: 3, shortBreakMinutes: 99, longBreakMinutes: 30 }),
    { preset: 'deep', focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 30 });
  assert.equal(normalizeFocusSettings({ preset: 'custom', focusMinutes: Number.NaN, shortBreakMinutes: 5, longBreakMinutes: 15 }).focusMinutes, 25);
  // Switching to Custom keeps the current durations to edit.
  assert.deepEqual(settingsForPreset({ preset: 'quick', focusMinutes: 15, shortBreakMinutes: 3, longBreakMinutes: 15 }, 'custom'),
    { preset: 'custom', focusMinutes: 15, shortBreakMinutes: 3, longBreakMinutes: 15 });
  const custom = { preset: 'custom', focusMinutes: 35, shortBreakMinutes: 4, longBreakMinutes: 25 };
  const { state } = run(initialFocusState(), [[{ type: 'settings', settings: custom }, T0], ['start', T0]]);
  assert.equal(remainingMs(state, T0), 35 * MIN);
  assert.equal(advanceFocus(state, T0 + 35 * MIN).state.phaseMs, 4 * MIN);
});

test('start, pause, resume: paused time is never focus time, and remaining time is worked out from timestamps', () => {
  const { state, finished } = run(initialFocusState(), [['start', T0], ['pause', T0 + 10 * MIN], ['resume', T0 + 40 * MIN]]);
  assert.equal(state.status, 'running');
  assert.equal(elapsedMs(state, T0 + 40 * MIN), 10 * MIN);
  assert.equal(remainingMs(state, T0 + 45 * MIN), 10 * MIN);
  assert.equal(phaseEndsAt(state), T0 + 55 * MIN);
  assert.deepEqual(finished, []);
  // While paused the clock is frozen, however long the phone sleeps.
  const paused = run(state, [['pause', T0 + 45 * MIN]]).state;
  assert.equal(remainingMs(paused, T0 + 10 * 60 * MIN), 10 * MIN);
  const done = advanceFocus(run(paused, [['resume', T0 + 600 * MIN]]).state, T0 + 610 * MIN);
  assert.equal(done.finished.length, 1);
  assert.equal(done.finished[0].focusSeconds, 25 * 60);
  assert.equal(done.finished[0].startedAt, new Date(T0).toISOString());
  assert.equal(done.finished[0].endedAt, new Date(T0 + 610 * MIN).toISOString());
});

test('a finished focus block is kept as completed and its break starts when the block ended', () => {
  const started = run(initialFocusState(), [[{ type: 'link', link: { courseId: 'c1', subjectLabel: 'BCS3153 — Software Evolution', taskId: 't1', taskTitle: 'Revise chapter 4' } }, T0], ['start', T0]]).state;
  const { state, finished } = advanceFocus(started, T0 + 27 * MIN);
  assert.equal(state.phase, 'shortBreak');
  assert.equal(state.status, 'running');
  assert.equal(state.notice, 'focusDone');
  assert.equal(state.completedRounds, 1);
  assert.equal(remainingMs(state, T0 + 27 * MIN), 3 * MIN);
  assert.deepEqual(finished, [{
    id: started.blockId, status: 'completed', preset: 'classic', plannedFocusSeconds: 1500, focusSeconds: 1500, roundNumber: 1,
    startedAt: new Date(T0).toISOString(), endedAt: new Date(T0 + 25 * MIN).toISOString(), courseId: 'c1', subjectLabel: 'BCS3153 — Software Evolution', taskId: 't1', taskTitle: 'Revise chapter 4',
  }]);
  // Advancing again at the same time adds nothing (no duplicate block).
  assert.deepEqual(advanceFocus(state, T0 + 27 * MIN).finished, []);
});

test('after a break the next block waits for Start, even if the student was away for hours', () => {
  const started = run(initialFocusState(), [['start', T0]]).state;
  const { state, finished } = advanceFocus(started, T0 + 8 * 60 * MIN);
  assert.equal(finished.length, 1);
  assert.equal(state.status, 'idle');
  assert.equal(state.phase, 'focus');
  assert.equal(state.notice, 'breakDone');
  assert.equal(roundNumber(state), 2);
  assert.equal(remainingMs(state, T0 + 9 * 60 * MIN), 25 * MIN);
  assert.deepEqual(focusAlerts(state), []);
});

test('the fourth completed round is followed by the long break, then short breaks again', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8].map(breakAfter), ['shortBreak', 'shortBreak', 'shortBreak', 'longBreak', 'shortBreak', 'longBreak']);
  let state = initialFocusState(settingsForPreset({ ...DEFAULT_FOCUS_SETTINGS, longBreakMinutes: 20 }, 'quick'));
  let at = T0;
  const breaks = [];
  for (let round = 1; round <= 5; round++) {
    state = run(state, [['start', at]]).state;
    at += 15 * MIN;
    state = advanceFocus(state, at).state;
    breaks.push([state.phase, state.phaseMs / MIN]);
    state = run(state, [['skipBreak', at]]).state;
  }
  assert.deepEqual(breaks, [['shortBreak', 3], ['shortBreak', 3], ['shortBreak', 3], ['longBreak', 20], ['shortBreak', 3]]);
  assert.equal(state.completedRounds, 5);
  assert.equal(nextBreak(state), 'shortBreak');
});

test('reset discards only the current block; completed rounds stay', () => {
  const started = run(initialFocusState(), [['start', T0]]).state;
  const afterFirst = advanceFocus(started, T0 + 30 * MIN);
  let { state, finished } = run(afterFirst.state, [['skipBreak', T0 + 30 * MIN], ['start', T0 + 31 * MIN], ['reset', T0 + 40 * MIN]]);
  assert.equal(afterFirst.finished.length, 1);
  assert.deepEqual(finished, []);
  assert.equal(state.notice, 'discarded');
  assert.equal(state.status, 'idle');
  assert.equal(state.completedRounds, 1);
  assert.equal(state.blockId, null);
  // Reset with no block running changes nothing.
  assert.equal(run(state, [['reset', T0 + 41 * MIN]]).state.notice, 'discarded');
});

test('ending early keeps a partial block from one minute of focus; under a minute is discarded', () => {
  const kept = run(initialFocusState(), [['start', T0], ['pause', T0 + 5 * MIN], ['resume', T0 + 20 * MIN], ['end', T0 + 22 * MIN + 30_000]]);
  assert.equal(kept.finished.length, 1);
  assert.equal(kept.finished[0].status, 'partial');
  assert.equal(kept.finished[0].focusSeconds, 7 * 60 + 30);
  assert.equal(kept.finished[0].plannedFocusSeconds, 1500);
  assert.equal(kept.state.notice, 'partialKept');
  assert.equal(kept.state.status, 'idle');
  assert.equal(kept.state.completedRounds, 0);

  const short = run(initialFocusState(), [['start', T0], ['end', T0 + 59_000]]);
  assert.deepEqual(short.finished, []);
  assert.equal(short.state.notice, 'discarded');
  // Ending during a break keeps the finished block once and starts a fresh sitting.
  const inBreak = run(run(initialFocusState(), [['start', T0]]).state, [['end', T0 + 26 * MIN]]);
  assert.equal(inBreak.finished.length, 1);
  assert.equal(inBreak.finished[0].status, 'completed');
  assert.equal(inBreak.state.notice, null);
  assert.equal(inBreak.state.completedRounds, 0);
});

test('ending after the planned end keeps a completed block, not a partial one', () => {
  const { finished } = run(initialFocusState(), [['start', T0], ['end', T0 + 26 * MIN]]);
  assert.deepEqual(finished.map((item) => item.status), ['completed']);
});

test('duplicate presses are harmless, and settings or links cannot change mid-block', () => {
  const once = run(initialFocusState(), [['start', T0]]).state;
  const twice = run(once, [['start', T0 + 1000], ['resume', T0 + 2000], ['skipBreak', T0 + 3000]]).state;
  assert.equal(twice.blockId, once.blockId);
  assert.equal(twice.runStartedAt, T0);
  const changed = run(twice, [[{ type: 'settings', settings: settingsForPreset(DEFAULT_FOCUS_SETTINGS, 'deep') }, T0 + 4000], [{ type: 'link', link: { courseId: 'x', subjectLabel: 'X', taskId: null, taskTitle: null } }, T0 + 5000]]).state;
  assert.equal(changed.settings.preset, 'classic');
  assert.equal(changed.link.courseId, null);
  assert.equal(run(changed, [['pause', T0 + MIN], ['pause', T0 + 2 * MIN]]).state.bankedMs, MIN);
});

test('a clock moved backwards never gives negative or extra time', () => {
  const state = run(initialFocusState(), [['start', T0]]).state;
  assert.equal(remainingMs(state, T0 - 10 * MIN), 25 * MIN);
  assert.equal(elapsedMs(state, T0 - 10 * MIN), 0);
  assert.equal(remainingMs(state, T0 + 99 * MIN) >= 0, true);
  assert.equal(run(state, [['pause', T0 - 5 * MIN]]).state.bankedMs, 0);
});

test('alerts: focus end and the break after it while focusing; break end while on a break; none when paused or waiting', () => {
  const state = run(initialFocusState(), [['start', T0]]).state;
  assert.deepEqual(focusAlerts(state), [{ kind: 'focusDone', at: T0 + 25 * MIN }, { kind: 'breakDone', at: T0 + 30 * MIN }]);
  assert.deepEqual(focusAlerts(advanceFocus(state, T0 + 26 * MIN).state), [{ kind: 'breakDone', at: T0 + 30 * MIN }]);
  assert.deepEqual(focusAlerts(run(state, [['pause', T0 + MIN]]).state), []);
  assert.deepEqual(focusAlerts(initialFocusState()), []);
});

test('stored state survives a restart exactly, and unreadable data is rejected', () => {
  const paused = run(initialFocusState(), [['start', T0], ['pause', T0 + 4 * MIN]]).state;
  const restored = parseFocusState(JSON.parse(JSON.stringify(paused)));
  assert.deepEqual(restored, paused);
  assert.equal(remainingMs(restored, T0 + 3 * 60 * MIN), 21 * MIN);
  const running = run(initialFocusState(), [['start', T0]]).state;
  assert.equal(remainingMs(parseFocusState(JSON.parse(JSON.stringify(running))), T0 + 5 * MIN), 20 * MIN);
  for (const bad of [null, 'x', { ...paused, version: 2 }, { ...paused, status: 'done' }, { ...paused, bankedMs: -1 }, { ...paused, bankedMs: paused.phaseMs + 1 },
    { ...running, runStartedAt: null }, { ...paused, runStartedAt: T0 }, { ...paused, blockId: null }, { ...paused, link: null }, { ...paused, settings: { preset: 'other' } }]) {
    assert.equal(parseFocusState(bad), null);
  }
});

test('clock text rounds up and switches to hours from 60 minutes', () => {
  assert.deepEqual([25 * MIN, 25 * MIN - 1, 61_000, 999, 0, -5, 65 * MIN].map(formatFocusClock), ['25:00', '25:00', '1:01', '0:01', '0:00', '0:00', '1:05:00']);
});

test('block IDs are version 4 UUIDs', () => {
  assert.match(newFocusId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  let seed = 1;
  assert.match(newFocusId(() => (seed = (seed * 16807) % 2147483647) / 2147483647), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('Poof stays still while focusing or paused, floats when ready or on a break, and celebrates a just-completed round', async () => {
  const { companionState } = await import('../lib/focusTimer.ts');
  const ready = initialFocusState();
  const running = run(ready, [['start', T0]]).state;
  const paused = run(running, [['pause', T0 + MIN]]).state;
  const shortBreak = advanceFocus(running, T0 + 26 * MIN).state;
  assert.deepEqual(companionState(ready, false), { pose: 'idle', message: 'ready' });
  assert.deepEqual(companionState(running, true), { pose: 'still', message: 'focus' });
  assert.deepEqual(companionState(paused, false), { pose: 'still', message: 'paused' });
  assert.deepEqual(companionState(shortBreak, true), { pose: 'celebrate', message: 'celebrate' });
  assert.deepEqual(companionState(shortBreak, false), { pose: 'idle', message: 'break' });
  assert.deepEqual(companionState(run(shortBreak, [['pause', T0 + 27 * MIN]]).state, true), { pose: 'still', message: 'paused' });
  assert.deepEqual(companionState(run(shortBreak, [['skipBreak', T0 + 27 * MIN]]).state, false), { pose: 'idle', message: 'readyNext' });
  const longBreak = { ...shortBreak, phase: 'longBreak', completedRounds: 4 };
  assert.deepEqual(companionState(longBreak, true), { pose: 'celebrate', message: 'longBreak' });
  assert.deepEqual(companionState(longBreak, false), { pose: 'idle', message: 'longBreak' });
});
