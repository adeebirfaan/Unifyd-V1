/**
 * Unifyd Focus timer rules (pure, clock injected). Wall-clock timestamps are the source of truth: remaining time is
 * always worked out from when the current run started and how much of the phase had already run, so a locked phone,
 * a backgrounded or restarted app, or a skipped interval tick never loses or invents time. Interval ticks only redraw.
 *
 * - A finished focus block moves straight into its break, counted from the moment the block ended.
 * - After a break the next focus block waits for the student to press Start, so time away is never counted as study.
 * - Paused time and breaks are never focus time.
 * - Completed: a block that reached its planned length. Partial: ended early with at least one minute of focus.
 *   Discarded: reset or ended with less than a minute; nothing is kept. Reset touches only the current block.
 */

export type FocusPresetId = 'classic' | 'deep' | 'quick' | 'custom';
export type FocusPhase = 'focus' | 'shortBreak' | 'longBreak';
export type FocusStatus = 'idle' | 'running' | 'paused';
export type FocusSettings = { preset: FocusPresetId; focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number };
/** The optional subject and task a block is linked to; null subject means General study. Titles are local display copies. */
export type FocusLink = { courseId: string | null; subjectLabel: string | null; taskId: string | null; taskTitle: string | null };
export type FocusNotice = 'focusDone' | 'breakDone' | 'partialKept' | 'discarded' | null;

export type FocusState = {
  version: 1;
  status: FocusStatus;
  phase: FocusPhase;
  /** Planned length of the current phase. */
  phaseMs: number;
  /** Time of this phase that ran before the current run (pauses split a phase into runs). */
  bankedMs: number;
  /** Wall-clock start of the current run; set only while running. */
  runStartedAt: number | null;
  /** The current focus block, from its first Start until it finishes or is discarded. */
  blockId: string | null;
  blockStartedAt: number | null;
  /** Focus blocks completed in this sitting; drives the round number and the long break. */
  completedRounds: number;
  settings: FocusSettings;
  link: FocusLink;
  notice: FocusNotice;
};

/** A finished focus block, kept on the device for syncing (Phase 3). Seconds exclude pauses and breaks. */
export type FocusBlock = {
  id: string; status: 'completed' | 'partial'; preset: FocusPresetId; plannedFocusSeconds: number; focusSeconds: number; roundNumber: number;
  startedAt: string; endedAt: string; courseId: string | null; subjectLabel: string | null; taskId: string | null;
  /** Copied with the link (Phase 3), so the round stays readable if the task is deleted. Older rounds may lack it. */
  taskTitle?: string | null;
};

export type FocusAction =
  | { type: 'start' } | { type: 'pause' } | { type: 'resume' } | { type: 'reset' } | { type: 'skipBreak' } | { type: 'end' }
  | { type: 'settings'; settings: FocusSettings } | { type: 'link'; link: FocusLink } | { type: 'dismissNotice' };

export const FOCUS_PRESETS: Record<Exclude<FocusPresetId, 'custom'>, { focusMinutes: number; shortBreakMinutes: number }> = {
  classic: { focusMinutes: 25, shortBreakMinutes: 5 },
  deep: { focusMinutes: 50, shortBreakMinutes: 10 },
  quick: { focusMinutes: 15, shortBreakMinutes: 3 },
};
export const FOCUS_LIMITS = {
  focusMinutes: { min: 5, max: 120, step: 5 },
  shortBreakMinutes: { min: 1, max: 30, step: 1 },
  longBreakMinutes: { min: 5, max: 60, step: 5 },
} as const;
export const DEFAULT_LONG_BREAK_MINUTES = 15;
export const ROUNDS_BEFORE_LONG_BREAK = 4;
export const MIN_PARTIAL_FOCUS_MS = 60_000;
const MINUTE = 60_000;

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = { preset: 'classic', ...FOCUS_PRESETS.classic, longBreakMinutes: DEFAULT_LONG_BREAK_MINUTES };
export const GENERAL_STUDY: FocusLink = { courseId: null, subjectLabel: null, taskId: null, taskTitle: null };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Whole minutes inside the limits; anything unreadable falls back to the default. */
export function normalizeFocusSettings(settings: FocusSettings): FocusSettings {
  const fit = (key: keyof typeof FOCUS_LIMITS, value: number, fallback: number) => Number.isFinite(value)
    ? clamp(Math.round(value), FOCUS_LIMITS[key].min, FOCUS_LIMITS[key].max) : fallback;
  const preset: FocusPresetId = settings.preset in FOCUS_PRESETS || settings.preset === 'custom' ? settings.preset : 'classic';
  const base = preset === 'custom' ? settings : { ...settings, ...FOCUS_PRESETS[preset] };
  return {
    preset,
    focusMinutes: fit('focusMinutes', base.focusMinutes, DEFAULT_FOCUS_SETTINGS.focusMinutes),
    shortBreakMinutes: fit('shortBreakMinutes', base.shortBreakMinutes, DEFAULT_FOCUS_SETTINGS.shortBreakMinutes),
    longBreakMinutes: fit('longBreakMinutes', settings.longBreakMinutes, DEFAULT_LONG_BREAK_MINUTES),
  };
}

/** A preset's durations (custom keeps the student's own), with the long break left as chosen. */
export function settingsForPreset(current: FocusSettings, preset: FocusPresetId): FocusSettings {
  return normalizeFocusSettings(preset === 'custom' ? { ...current, preset } : { ...current, preset, ...FOCUS_PRESETS[preset] });
}

export function initialFocusState(settings: FocusSettings = DEFAULT_FOCUS_SETTINGS, link: FocusLink = GENERAL_STUDY): FocusState {
  const normal = normalizeFocusSettings(settings);
  return {
    version: 1, status: 'idle', phase: 'focus', phaseMs: normal.focusMinutes * MINUTE, bankedMs: 0, runStartedAt: null,
    blockId: null, blockStartedAt: null, completedRounds: 0, settings: normal, link, notice: null,
  };
}

export function phaseLengthMs(settings: FocusSettings, phase: FocusPhase): number {
  return (phase === 'focus' ? settings.focusMinutes : phase === 'shortBreak' ? settings.shortBreakMinutes : settings.longBreakMinutes) * MINUTE;
}

/** The break that follows the given number of completed rounds: long after every fourth. */
export function breakAfter(completedRounds: number): Exclude<FocusPhase, 'focus'> {
  return completedRounds > 0 && completedRounds % ROUNDS_BEFORE_LONG_BREAK === 0 ? 'longBreak' : 'shortBreak';
}

/** The break after the current (or next) focus block. */
export function nextBreak(state: FocusState): Exclude<FocusPhase, 'focus'> {
  return breakAfter(state.completedRounds + 1);
}

/** Time of the current phase that has run. A clock moved backwards counts as no time, never as negative time. */
export function elapsedMs(state: FocusState, now: number): number {
  const running = state.status === 'running' && state.runStartedAt !== null ? clamp(now - state.runStartedAt, 0, state.phaseMs - state.bankedMs) : 0;
  return clamp(state.bankedMs + running, 0, state.phaseMs);
}

export function remainingMs(state: FocusState, now: number): number {
  return state.phaseMs - elapsedMs(state, now);
}

/** When the running phase ends, or null when nothing is running. */
export function phaseEndsAt(state: FocusState): number | null {
  return state.status === 'running' && state.runStartedAt !== null ? state.runStartedAt + state.phaseMs - state.bankedMs : null;
}

/** True while a focus block has started and not finished (running or paused). */
export function hasActiveBlock(state: FocusState): boolean {
  return state.phase === 'focus' && state.status !== 'idle' && state.blockId !== null;
}

export function roundNumber(state: FocusState): number {
  return state.phase === 'focus' ? state.completedRounds + 1 : state.completedRounds;
}

function block(state: FocusState, status: FocusBlock['status'], focusMs: number, endedAt: number): FocusBlock {
  return {
    id: state.blockId!, status, preset: state.settings.preset, plannedFocusSeconds: Math.round(state.phaseMs / 1000),
    focusSeconds: Math.floor(focusMs / 1000), roundNumber: state.completedRounds + 1,
    startedAt: new Date(state.blockStartedAt ?? endedAt).toISOString(), endedAt: new Date(endedAt).toISOString(),
    courseId: state.link.courseId, subjectLabel: state.link.subjectLabel, taskId: state.link.taskId, taskTitle: state.link.taskTitle,
  };
}

/** Ready for the next focus block (after a break, a skip, or a reset). */
function ready(state: FocusState, notice: FocusNotice, completedRounds = state.completedRounds): FocusState {
  return { ...state, status: 'idle', phase: 'focus', phaseMs: state.settings.focusMinutes * MINUTE, bankedMs: 0, runStartedAt: null, blockId: null, blockStartedAt: null, completedRounds, notice };
}

/**
 * Applies every phase change the clock says has happened: a finished focus block (kept as completed) starts its
 * break from the moment it ended, and a finished break waits for Start. Returns the blocks finished on the way.
 */
export function advanceFocus(state: FocusState, now: number): { state: FocusState; finished: FocusBlock[] } {
  const finished: FocusBlock[] = [];
  let current = state;
  for (;;) {
    const end = phaseEndsAt(current);
    if (end === null || now < end) return { state: current, finished };
    if (current.phase === 'focus') {
      if (current.blockId) finished.push(block(current, 'completed', current.phaseMs, end));
      const rounds = current.completedRounds + 1;
      const phase = breakAfter(rounds);
      current = { ...current, phase, phaseMs: phaseLengthMs(current.settings, phase), bankedMs: 0, runStartedAt: end, blockId: null, blockStartedAt: null, completedRounds: rounds, notice: 'focusDone' };
    } else {
      current = ready(current, 'breakDone');
    }
  }
}

/** Brings the state up to `now`, then applies one student action. Actions that do not fit the state change nothing. */
export function applyFocusAction(state: FocusState, action: FocusAction, now: number, newId: () => string): { state: FocusState; finished: FocusBlock[] } {
  const advanced = advanceFocus(state, now);
  const current = advanced.state;
  const done = (next: FocusState, extra: FocusBlock[] = []) => ({ state: next, finished: [...advanced.finished, ...extra] });
  switch (action.type) {
    case 'start':
      if (current.status !== 'idle' || current.phase !== 'focus') return done(current);
      return done({ ...current, status: 'running', phaseMs: current.settings.focusMinutes * MINUTE, bankedMs: 0, runStartedAt: now, blockId: newId(), blockStartedAt: now, notice: null });
    case 'pause':
      if (current.status !== 'running') return done(current);
      return done({ ...current, status: 'paused', bankedMs: elapsedMs(current, now), runStartedAt: null });
    case 'resume':
      if (current.status !== 'paused') return done(current);
      return done({ ...current, status: 'running', runStartedAt: now });
    case 'reset':
      // Only the current focus block is discarded; completed rounds and kept blocks are untouched.
      if (!hasActiveBlock(current)) return done(current);
      return done(ready(current, 'discarded'));
    case 'skipBreak':
      if (current.phase === 'focus') return done(current);
      return done(ready(current, null));
    case 'end': {
      const fresh = { ...initialFocusState(current.settings, current.link) };
      if (!hasActiveBlock(current)) return done(fresh);
      const focus = elapsedMs(current, now);
      if (focus < MIN_PARTIAL_FOCUS_MS) return done({ ...fresh, notice: 'discarded' });
      return done({ ...fresh, notice: 'partialKept' }, [block(current, 'partial', focus, now)]);
    }
    case 'settings':
      if (current.status !== 'idle') return done(current);
      { const settings = normalizeFocusSettings(action.settings);
        return done({ ...current, settings, phaseMs: current.phase === 'focus' ? settings.focusMinutes * MINUTE : current.phaseMs }); }
    case 'link':
      if (current.status !== 'idle') return done(current);
      return done({ ...current, link: action.link });
    case 'dismissNotice':
      return done(current.notice ? { ...current, notice: null } : current);
  }
}

export type FocusAlert = { kind: 'focusDone' | 'breakDone'; at: number };

/** The device alerts the running state needs: the end of focus (and of the break that follows it), or of the break. */
export function focusAlerts(state: FocusState): FocusAlert[] {
  const end = phaseEndsAt(state);
  if (end === null) return [];
  if (state.phase !== 'focus') return [{ kind: 'breakDone', at: end }];
  return [{ kind: 'focusDone', at: end }, { kind: 'breakDone', at: end + phaseLengthMs(state.settings, nextBreak(state)) }];
}

/** "24:59", or "1:05:00" from an hour; rounds up so 0:00 shows only at the very end. */
export function formatFocusClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isText = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** Reads a stored state, or null when it is missing, from another version, or not trustworthy. */
export function parseFocusState(value: unknown): FocusState | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const settings = raw.settings as Record<string, unknown> | undefined;
  const link = raw.link as Record<string, unknown> | undefined;
  if (raw.version !== 1 || !settings || typeof settings !== 'object' || !link || typeof link !== 'object') return null;
  if (!['idle', 'running', 'paused'].includes(raw.status as string) || !['focus', 'shortBreak', 'longBreak'].includes(raw.phase as string)) return null;
  if (!isNumber(raw.phaseMs) || raw.phaseMs <= 0 || !isNumber(raw.bankedMs) || raw.bankedMs < 0 || raw.bankedMs > raw.phaseMs) return null;
  if (!isNumber(raw.completedRounds) || raw.completedRounds < 0 || !Number.isInteger(raw.completedRounds)) return null;
  if (raw.status === 'running' ? !isNumber(raw.runStartedAt) : raw.runStartedAt !== null) return null;
  if (!isText(raw.blockId) || !(raw.blockStartedAt === null || isNumber(raw.blockStartedAt))) return null;
  // A started focus block always has its ID; a break or a waiting state never does.
  if ((raw.phase === 'focus' && raw.status !== 'idle') !== (typeof raw.blockId === 'string')) return null;
  if (!isText(link.courseId) || !isText(link.subjectLabel) || !isText(link.taskId) || !isText(link.taskTitle)) return null;
  if (!['focusDone', 'breakDone', 'partialKept', 'discarded', null].includes(raw.notice as string | null)) return null;
  if (!['classic', 'deep', 'quick', 'custom'].includes(settings.preset as string) || !isNumber(settings.focusMinutes) || !isNumber(settings.shortBreakMinutes) || !isNumber(settings.longBreakMinutes)) return null;
  return {
    version: 1, status: raw.status as FocusStatus, phase: raw.phase as FocusPhase, phaseMs: raw.phaseMs, bankedMs: raw.bankedMs,
    runStartedAt: raw.runStartedAt as number | null, blockId: raw.blockId, blockStartedAt: raw.blockStartedAt as number | null,
    completedRounds: raw.completedRounds, notice: raw.notice as FocusNotice,
    settings: normalizeFocusSettings(settings as FocusSettings),
    link: { courseId: link.courseId, subjectLabel: link.subjectLabel, taskId: link.taskId, taskTitle: link.taskTitle },
  };
}

/** A random v4 UUID for a block (the Phase 3 row ID, so a retried save can never create a duplicate). */
export function newFocusId(random: () => number = Math.random): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (random === Math.random && typeof native?.randomUUID === 'function') return native.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16));
  hex[12] = 4; hex[16] = (hex[16] & 0x3) | 0x8;
  const text = hex.map((digit) => digit.toString(16)).join('');
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}

export type CompanionPose = 'still' | 'idle' | 'celebrate';
export type CompanionMessage = 'ready' | 'readyNext' | 'focus' | 'paused' | 'break' | 'longBreak' | 'celebrate';

/**
 * Poof's pose and message on Focus (Phase 5, owner decision 2026-10-16): Poof holds still during focus rounds and
 * pauses, floats gently when ready and on breaks, and celebrates once when a round completes while Focus is open.
 */
export function companionState(state: FocusState, celebrating: boolean): { pose: CompanionPose; message: CompanionMessage } {
  if (state.status === 'paused') return { pose: 'still', message: 'paused' };
  if (state.status === 'idle') return { pose: 'idle', message: state.completedRounds > 0 ? 'readyNext' : 'ready' };
  if (state.phase === 'focus') return { pose: 'still', message: 'focus' };
  return { pose: celebrating ? 'celebrate' : 'idle', message: state.phase === 'longBreak' ? 'longBreak' : celebrating ? 'celebrate' : 'break' };
}
