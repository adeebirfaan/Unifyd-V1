import assert from 'node:assert/strict';
import test from 'node:test';

import {
  equalShares, inferSplitMethod, isBillSettled, orderParticipants, outstandingCents, sharesMismatch,
  splitIssues, totalOutstandingCents, unpaidCount,
} from '../lib/splitBills.ts';

const sum = (values) => values.reduce((a, b) => a + b, 0);
const person = (name, shareCents, isSelf = false) => ({ name, shareCents, isSelf });

test('equal splits are exact, with leftover cents going to You first', () => {
  assert.deepEqual(equalShares(6000, 3), [2000, 2000, 2000]);
  assert.deepEqual(equalShares(1000, 3), [334, 333, 333]);
  assert.deepEqual(equalShares(1002, 4), [251, 251, 250, 250]);
  assert.deepEqual(equalShares(1, 1), null);
  for (const [total, people] of [[1000, 3], [9999, 7], [1, 1], [12345, 20], [101, 2]]) {
    const shares = equalShares(total, people);
    if (shares) assert.equal(sum(shares), total, `${total}/${people}`);
  }
});

test('equal splits refuse zero shares and invalid input', () => {
  assert.equal(equalShares(3, 4), null);
  assert.deepEqual(equalShares(4, 4), [1, 1, 1, 1]);
  assert.equal(equalShares(0, 2), null);
  assert.equal(equalShares(1000, 1), null);
  assert.equal(equalShares(1000, 21), null);
  assert.equal(equalShares(10.5, 2), null);
});

test('a valid split includes exactly one You, at least two people, and shares equal to the total', () => {
  assert.deepEqual(splitIssues(6000, [person('You', 2000, true), person('Amir', 2000), person('Sarah', 2000)]), []);
  assert.deepEqual(splitIssues(6000, [person('You', 6000, true)]).map((issue) => issue.kind), ['tooFewPeople']);
  assert.ok(splitIssues(6000, [person('Amir', 3000), person('Sarah', 3000)]).some((issue) => issue.kind === 'selfRequired'));
  assert.ok(splitIssues(6000, [person('You', 3000, true), person('Me', 3000, true)]).some((issue) => issue.kind === 'selfRequired'));
});

test('custom shares cannot save unless they add up to the total exactly', () => {
  assert.deepEqual(splitIssues(6000, [person('You', 2000, true), person('Amir', 2000), person('Sarah', 1500)]), [{ kind: 'totalMismatch', remainingCents: 500 }]);
  assert.deepEqual(splitIssues(6000, [person('You', 2000, true), person('Amir', 2500), person('Sarah', 2000)]), [{ kind: 'totalMismatch', remainingCents: -500 }]);
  assert.deepEqual(splitIssues(6000, [person('You', 3000, true), person('Amir', 3000), person('Sarah', 0)]), [{ kind: 'shareInvalid', index: 2 }]);
  assert.deepEqual(splitIssues(6000, [person('You', 3000, true), person('Amir', null)]).map((issue) => issue.kind), ['shareInvalid', 'totalMismatch']);
  assert.deepEqual(splitIssues(6000, [person('You', 7000, true), person('Amir', -1000)]).map((issue) => issue.kind), ['shareInvalid', 'totalMismatch']);
});

test('other people need distinct, non-blank names; no account is involved', () => {
  assert.deepEqual(splitIssues(6000, [person('You', 3000, true), person('  ', 3000)]), [{ kind: 'nameRequired', index: 1 }]);
  assert.deepEqual(splitIssues(6000, [person('You', 2000, true), person('Amir', 2000), person(' amir ', 2000)]), [{ kind: 'duplicateName', index: 2 }]);
});

const bill = (participants) => ({ total_amount: '60.00', split_bill_participants: participants });
const you = { id: 's', participant_name: 'You', share_amount: '20.00', is_self: true, is_settled: true, settled_at: '2026-10-12T00:00:00Z' };
const amir = { id: 'a', participant_name: 'Amir', share_amount: '20.00', is_self: false, is_settled: false, settled_at: null };
const sarah = { id: 'b', participant_name: 'Sarah', share_amount: '20.00', is_self: false, is_settled: false, settled_at: null };

test('outstanding is the sum of unsettled shares of other people, never your own', () => {
  assert.equal(outstandingCents([you, amir, sarah]), 4000);
  assert.equal(outstandingCents([you, { ...amir, is_settled: true, settled_at: 'x' }, sarah]), 2000);
  assert.equal(outstandingCents([{ ...you, is_settled: false }, amir]), 2000);
  assert.equal(totalOutstandingCents([bill([you, amir, sarah]), bill([you, { ...amir, share_amount: '5.55' }])]), 4555);
  assert.equal(unpaidCount([you, amir, sarah]), 2);
});

test('a bill is settled only when every other person is settled', () => {
  assert.equal(isBillSettled([you, amir, sarah]), false);
  assert.equal(isBillSettled([you, { ...amir, is_settled: true }, sarah]), false);
  assert.equal(isBillSettled([you, { ...amir, is_settled: true }, { ...sarah, is_settled: true }]), true);
  assert.equal(isBillSettled([you]), false);
  assert.equal(isBillSettled([]), false);
});

test('saved shares that no longer match the total are flagged', () => {
  assert.equal(sharesMismatch(bill([you, amir, sarah])), false);
  assert.equal(sharesMismatch(bill([you, amir])), true);
});

test('You come first, then others by name; equal splits are recognised for editing', () => {
  assert.deepEqual(orderParticipants([sarah, you, amir]).map((p) => p.participant_name), ['You', 'Amir', 'Sarah']);
  assert.equal(inferSplitMethod(1000, [334, 333, 333]), 'equal');
  assert.equal(inferSplitMethod(1000, [500, 250, 250]), 'custom');
  assert.equal(inferSplitMethod(null, [500, 500]), 'custom');
});
