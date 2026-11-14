// Breathing break timing (Wellbeing Phase 2, SRS-FR-1102). Pure: time comes in as elapsed ms from the start,
// so the screen can work it out from one start timestamp and ticks only redraw.

export const BREATH_IN_MS = 4_000;
export const BREATH_OUT_MS = 6_000;
export const BREATH_CYCLE_MS = BREATH_IN_MS + BREATH_OUT_MS;
export const BREATH_CYCLES = 6;
export const BREATHING_SESSION_MS = BREATH_CYCLE_MS * BREATH_CYCLES; // one minute

export type BreathPhase = 'in' | 'out';
export type BreathStep =
  | { done: false; phase: BreathPhase; cycle: number; secondsLeft: number; phaseLeftMs: number }
  | { done: true };

/** Where a session is after `elapsedMs`. A clock moved backwards counts as the start. */
export function breathStep(elapsedMs: number): BreathStep {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (elapsed >= BREATHING_SESSION_MS) return { done: true };
  const cycle = Math.floor(elapsed / BREATH_CYCLE_MS);
  const within = elapsed - cycle * BREATH_CYCLE_MS;
  const phase: BreathPhase = within < BREATH_IN_MS ? 'in' : 'out';
  const phaseLeftMs = phase === 'in' ? BREATH_IN_MS - within : BREATH_CYCLE_MS - within;
  return { done: false, phase, cycle, secondsLeft: Math.max(1, Math.ceil(phaseLeftMs / 1000)), phaseLeftMs };
}
