import type { ExpenseCategory } from '@/lib/expenseForm';

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 20;
export const SPLIT_METHODS = ['equal', 'custom'] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export const PARTICIPANT_COLUMNS = 'id,participant_name,share_amount,is_self,is_settled,settled_at';
export const SPLIT_BILL_COLUMNS = `id,title,total_amount,bill_date,category,notes,split_bill_participants(${PARTICIPANT_COLUMNS})`;

export type ParticipantRecord = {
  id: string;
  participant_name: string;
  share_amount: number | string;
  is_self: boolean;
  is_settled: boolean;
  settled_at: string | null;
};

export type SplitBillRecord = {
  id: string;
  title: string;
  total_amount: number | string;
  bill_date: string;
  category: ExpenseCategory | null;
  notes: string | null;
  split_bill_participants: ParticipantRecord[];
};

export type ShareDraft = { name: string; shareCents: number | null; isSelf: boolean };
export type SplitIssue =
  | { kind: 'tooFewPeople' }
  | { kind: 'nameRequired'; index: number }
  | { kind: 'duplicateName'; index: number }
  | { kind: 'shareInvalid'; index: number }
  | { kind: 'selfRequired' }
  | { kind: 'totalMismatch'; remainingCents: number };

export function toCents(amount: number | string): number | null {
  const cents = Math.round(Number(amount) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/**
 * Splits `totalCents` across `people` exactly. Every share is the floor of the even split;
 * the leftover cents (fewer than `people`) go one each to the first shares, starting with You,
 * so the person who paid absorbs rounding and others never owe more than an even share.
 * Returns null when any share would be zero or the input is invalid.
 */
export function equalShares(totalCents: number, people: number): number[] | null {
  if (!Number.isInteger(totalCents) || !Number.isInteger(people) || totalCents <= 0 || people < MIN_PEOPLE || people > MAX_PEOPLE) return null;
  const base = Math.floor(totalCents / people);
  if (base <= 0) return null;
  const remainder = totalCents - base * people;
  return Array.from({ length: people }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function assignedCents(shares: readonly ShareDraft[]): number {
  return shares.reduce((sum, share) => sum + (share.shareCents !== null && share.shareCents > 0 ? share.shareCents : 0), 0);
}

/** Every rule a split must pass before it can be saved. An empty list means it is valid. */
export function splitIssues(totalCents: number | null, shares: readonly ShareDraft[]): SplitIssue[] {
  const issues: SplitIssue[] = [];
  if (shares.length < MIN_PEOPLE) issues.push({ kind: 'tooFewPeople' });
  if (shares.filter((share) => share.isSelf).length !== 1) issues.push({ kind: 'selfRequired' });
  const seen = new Set<string>();
  shares.forEach((share, index) => {
    const name = share.name.trim().toLocaleLowerCase();
    if (!share.isSelf && !name) issues.push({ kind: 'nameRequired', index });
    else if (name && seen.has(name)) issues.push({ kind: 'duplicateName', index });
    if (name) seen.add(name);
    if (share.shareCents === null || !Number.isInteger(share.shareCents) || share.shareCents <= 0) issues.push({ kind: 'shareInvalid', index });
  });
  if (totalCents !== null && totalCents > 0) {
    const remainingCents = totalCents - assignedCents(shares);
    if (remainingCents !== 0) issues.push({ kind: 'totalMismatch', remainingCents });
  }
  return issues;
}

/** Sum of unsettled shares owed by other people. Your own share never counts. */
export function outstandingCents(participants: readonly Pick<ParticipantRecord, 'share_amount' | 'is_self' | 'is_settled'>[]): number {
  return participants.reduce((sum, participant) => participant.is_self || participant.is_settled ? sum : sum + (toCents(participant.share_amount) ?? 0), 0);
}

/** A bill is settled only when it has other people and every one of them is settled. */
export function isBillSettled(participants: readonly Pick<ParticipantRecord, 'is_self' | 'is_settled'>[]): boolean {
  const others = participants.filter((participant) => !participant.is_self);
  return others.length > 0 && others.every((participant) => participant.is_settled);
}

export function unpaidCount(participants: readonly Pick<ParticipantRecord, 'is_self' | 'is_settled'>[]): number {
  return participants.filter((participant) => !participant.is_self && !participant.is_settled).length;
}

/** True when saved shares no longer add up to the bill total (for example, after an interrupted edit). */
export function sharesMismatch(bill: Pick<SplitBillRecord, 'total_amount' | 'split_bill_participants'>): boolean {
  const total = toCents(bill.total_amount);
  const sum = bill.split_bill_participants.reduce((acc, participant) => acc + (toCents(participant.share_amount) ?? 0), 0);
  return total === null || sum !== total;
}

/** You first, then everyone else by name, so the order is stable however the rows are returned. */
export function orderParticipants<T extends Pick<ParticipantRecord, 'is_self' | 'participant_name'>>(participants: readonly T[]): T[] {
  return [...participants].sort((a, b) => Number(b.is_self) - Number(a.is_self) || a.participant_name.localeCompare(b.participant_name));
}

export type OutstandingParticipant = Pick<ParticipantRecord, 'share_amount' | 'is_self' | 'is_settled'>;

export function totalOutstandingCents(bills: readonly { split_bill_participants: readonly OutstandingParticipant[] }[]): number {
  return bills.reduce((sum, bill) => sum + outstandingCents(bill.split_bill_participants), 0);
}

/** The split method that reproduces saved shares: equal when they match an equal split exactly. */
export function inferSplitMethod(totalCents: number | null, shareCents: readonly number[]): SplitMethod {
  if (totalCents === null) return 'custom';
  const equal = equalShares(totalCents, shareCents.length);
  return equal && equal.every((cents, index) => cents === shareCents[index]) ? 'equal' : 'custom';
}
