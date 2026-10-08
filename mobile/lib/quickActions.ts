// Quick-action shortcuts for the centre tab-bar sheet. Students choose up to
// MAX_QUICK_ACTIONS; the choice is stored on the device per account.
export const QUICK_ACTION_IDS = ['addExpense', 'scanReceipt', 'setBudget', 'addTask', 'reminders', 'mySemester', 'logMood'] as const;
export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

export const MAX_QUICK_ACTIONS = 4;
export const DEFAULT_QUICK_ACTIONS: readonly QuickActionId[] = ['addExpense', 'scanReceipt', 'addTask', 'logMood'];

export const quickActionsStorageKey = (userId: string) => `unifyd:quick-actions:${userId}`;

export function isQuickActionId(value: unknown): value is QuickActionId {
  return typeof value === 'string' && (QUICK_ACTION_IDS as readonly string[]).includes(value);
}

/** Reads a stored choice; anything missing, malformed, or out of range falls back to the defaults. */
export function parseQuickActions(raw: string | null): QuickActionId[] {
  if (!raw) return [...DEFAULT_QUICK_ACTIONS];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [...DEFAULT_QUICK_ACTIONS];
    const ids = value.filter(isQuickActionId).filter((id, index, list) => list.indexOf(id) === index);
    if (ids.length !== value.length || ids.length < 1 || ids.length > MAX_QUICK_ACTIONS) return [...DEFAULT_QUICK_ACTIONS];
    return sortQuickActions(ids);
  } catch {
    return [...DEFAULT_QUICK_ACTIONS];
  }
}

/** Shortcuts always appear in the catalogue order, whatever order they were picked in. */
export function sortQuickActions(ids: readonly QuickActionId[]): QuickActionId[] {
  return QUICK_ACTION_IDS.filter((id) => ids.includes(id));
}

/** Adds or removes one shortcut, keeping between 1 and MAX_QUICK_ACTIONS selected. */
export function toggleQuickAction(ids: readonly QuickActionId[], id: QuickActionId): QuickActionId[] {
  if (ids.includes(id)) return ids.length > 1 ? ids.filter((value) => value !== id) : [...ids];
  return ids.length < MAX_QUICK_ACTIONS ? sortQuickActions([...ids, id]) : [...ids];
}
