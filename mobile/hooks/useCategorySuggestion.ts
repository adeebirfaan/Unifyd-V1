import { useCallback, useEffect, useRef, useState } from 'react';

import { SUGGESTION_TITLE_MIN, requestCategorySuggestion } from '@/lib/categorySuggestion';
import type { CategorySuggestionResult } from '@/lib/categorySuggestion';

export type SuggestionState = { status: 'idle' } | { status: 'loading' } | CategorySuggestionResult;
const DEBOUNCE_MS = 600;

/**
 * Optional category suggestion for a draft title. Requests are debounced, only for titles of at least
 * 3 characters, and a newer title always wins over an older reply. Call `clear` when the title changes
 * so a suggestion for an old title is never shown against a new one.
 */
export function useCategorySuggestion() {
  const [state, setState] = useState<SuggestionState>({ status: 'idle' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    version.current += 1;
  }, []);

  const clear = useCallback(() => {
    cancel();
    setState({ status: 'idle' });
  }, [cancel]);

  const request = useCallback((title: string, delay = DEBOUNCE_MS) => {
    cancel();
    const trimmed = title.trim();
    if (trimmed.length < SUGGESTION_TITLE_MIN) return;
    const current = version.current;
    timer.current = setTimeout(() => {
      timer.current = null;
      setState({ status: 'loading' });
      void requestCategorySuggestion(trimmed).then((result) => { if (current === version.current) setState(result); });
    }, delay);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);
  return { state, request, clear };
}
