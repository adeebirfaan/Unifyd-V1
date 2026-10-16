import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { LanguagePreference } from '@/constants/i18n';
import { syncFocusAlerts } from '@/lib/focusNotifications';
import type { FocusAlertResult } from '@/lib/focusNotifications';
import { keepFocusBlocks, loadFocusState, saveFocusState } from '@/lib/focusStorage';
import { syncFocusRounds } from '@/lib/focusSync';
import { advanceFocus, applyFocusAction, initialFocusState, newFocusId } from '@/lib/focusTimer';
import type { FocusAction, FocusBlock, FocusState } from '@/lib/focusTimer';

/**
 * The Focus screen's timer: restores the stored state whenever the screen gains focus or the app returns to the
 * foreground, catches up with the clock, and saves every change at once. Leaving the screen never resets it.
 * Only the countdown re-renders each second (see `FocusDial`); this state changes on transitions only.
 */
export function useFocusSession(userId: string | undefined, language: LanguagePreference) {
  // `at`: when this state was taken, so the countdown can render it without reading the clock during render.
  const [snapshot, setSnapshot] = useState<{ state: FocusState; at: number } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [alertResult, setAlertResult] = useState<FocusAlertResult>('ok');
  // The last round completed while this screen was open (not one found finished on load): Poof celebrates it and
  // the optional reflection asks about it. Cleared when the next round starts or the student answers or skips.
  const [lastCompleted, setLastCompleted] = useState<string | null>(null);
  const current = useRef<FocusState | null>(null);

  const commit = useCallback((next: FocusState, finished: FocusBlock[], requestPermission = false, live = true) => {
    if (!userId) return;
    const changed = next !== current.current;
    current.current = next;
    setSnapshot({ state: next, at: Date.now() });
    const completedRounds = finished.filter((block) => block.status === 'completed');
    const completed = completedRounds[completedRounds.length - 1];
    if (live && completed) setLastCompleted(completed.id);
    else if (next.status === 'running' && next.phase === 'focus') setLastCompleted(null);
    // Finished blocks are kept before the state that no longer mentions them, then sent to the database.
    const kept = keepFocusBlocks(userId, finished);
    if (finished.length) void kept.then(() => syncFocusRounds(userId), () => undefined);
    void kept
      .then(() => changed ? saveFocusState(userId, next) : undefined)
      .then(() => setSaveFailed(false), () => setSaveFailed(true));
    if (changed) void syncFocusAlerts(userId, next, language, requestPermission).then(setAlertResult);
  }, [userId, language]);

  /** Applies whatever the clock says has happened (a focus block or break ending) since the last look. */
  const catchUp = useCallback(() => {
    if (!current.current) return;
    const { state: next, finished } = advanceFocus(current.current, Date.now());
    if (next !== current.current) commit(next, finished);
  }, [commit]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) return;
    void loadFocusState(userId).then((stored) => {
      if (!active) return;
      const { state: next, finished } = advanceFocus(stored ?? current.current ?? initialFocusState(), Date.now());
      current.current = null; // force one save and alert sync, so the stored copy and alerts match after a restart
      commit(next, finished, false, false);
    });
    const subscription = AppState.addEventListener('change', (appState) => { if (appState === 'active') catchUp(); });
    return () => { active = false; subscription.remove(); };
  }, [userId, commit, catchUp]));

  const dispatch = useCallback((action: FocusAction) => {
    if (!current.current) return;
    const { state: next, finished } = applyFocusAction(current.current, action, Date.now(), newFocusId);
    commit(next, finished, action.type === 'start' || action.type === 'resume');
  }, [commit]);

  const clearLastCompleted = useCallback(() => setLastCompleted(null), []);
  return { snapshot, dispatch, catchUp, saveFailed, alertResult, lastCompleted, clearLastCompleted };
}
