import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDaysISO, advanceBillingDate, daysUntil, isBillingFrequency, isReminderDays, monthlyEquivalentCents,
  renewalStatus, sortSubscriptions, subscriptionReminderFireTime, upcomingRenewals,
} from '../lib/subscriptions.ts';

test('only the four database billing frequencies are accepted', () => {
  for (const value of ['weekly', 'monthly', 'quarterly', 'yearly']) assert.equal(isBillingFrequency(value), true);
  for (const value of ['daily', 'Monthly', '', null, 1]) assert.equal(isBillingFrequency(value), false);
});

test('reminder days follow the 0–30 database range', () => {
  for (const value of [0, 3, 30]) assert.equal(isReminderDays(value), true);
  for (const value of [-1, 31, 1.5, '3', null]) assert.equal(isReminderDays(value), false);
});

test('renewal advances exactly one cycle and clamps short months', () => {
  assert.equal(advanceBillingDate('2026-10-18', 'weekly'), '2026-10-25');
  assert.equal(advanceBillingDate('2026-12-29', 'weekly'), '2027-01-05');
  assert.equal(advanceBillingDate('2026-10-18', 'monthly'), '2026-11-18');
  assert.equal(advanceBillingDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(advanceBillingDate('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(advanceBillingDate('2026-11-30', 'quarterly'), '2027-02-28');
  assert.equal(advanceBillingDate('2026-10-25', 'quarterly'), '2027-01-25');
  assert.equal(advanceBillingDate('2028-02-29', 'yearly'), '2029-02-28');
  assert.equal(advanceBillingDate('2026-13-01', 'monthly'), null);
});

test('date-only maths ignores the device clock and DST', () => {
  assert.equal(addDaysISO('2026-03-01', -1), '2026-02-28');
  assert.equal(daysUntil('2026-10-18', '2026-10-12'), 6);
  assert.equal(daysUntil('2026-10-10', '2026-10-12'), -2);
  assert.equal(daysUntil('bad', '2026-10-12'), null);
});

test('one reminder fires at 09:00 local time on billing date minus reminder days', () => {
  const now = new Date(2026, 9, 12, 8, 0).getTime();
  const fire = subscriptionReminderFireTime('2026-10-18', 3, now);
  assert.deepEqual([fire.getFullYear(), fire.getMonth(), fire.getDate(), fire.getHours(), fire.getMinutes()], [2026, 9, 15, 9, 0]);
  const sameDay = subscriptionReminderFireTime('2026-10-12', 0, now);
  assert.deepEqual([sameDay.getDate(), sameDay.getHours()], [12, 9]);
});

test('past or invalid reminder times are not scheduled', () => {
  const now = new Date(2026, 9, 12, 9, 30).getTime();
  assert.equal(subscriptionReminderFireTime('2026-10-12', 0, now), null);
  assert.equal(subscriptionReminderFireTime('2026-10-14', 3, now), null);
  assert.equal(subscriptionReminderFireTime('2026-10-14', 31, now), null);
  assert.equal(subscriptionReminderFireTime('not-a-date', 1, now), null);
});

test('renewal status never treats a passed date as renewed', () => {
  assert.equal(renewalStatus('2026-10-11', 3, '2026-10-12'), 'overdue');
  assert.equal(renewalStatus('2026-10-12', 3, '2026-10-12'), 'today');
  assert.equal(renewalStatus('2026-10-19', 3, '2026-10-12'), 'soon');
  assert.equal(renewalStatus('2026-10-20', 3, '2026-10-12'), 'later');
  assert.equal(renewalStatus('2026-10-26', 14, '2026-10-12'), 'soon');
});

test('monthly equivalent sums integer cents of active plans only', () => {
  const subs = [
    { amount: '15.90', billing_frequency: 'monthly', is_active: true },
    { amount: '8.90', billing_frequency: 'monthly', is_active: true },
    { amount: 120, billing_frequency: 'yearly', is_active: true },
    { amount: '30.00', billing_frequency: 'quarterly', is_active: true },
    { amount: '99.00', billing_frequency: 'monthly', is_active: false },
  ];
  assert.equal(monthlyEquivalentCents(subs), 1590 + 890 + 1000 + 1000);
  // Weekly uses 52 weeks ÷ 12 months: RM 3.00 × 52 / 12 = RM 13.00.
  assert.equal(monthlyEquivalentCents([{ amount: '3.00', billing_frequency: 'weekly', is_active: true }]), 1300);
  // RM 0.10 per week is 43.33… cents; the total is rounded once at the end.
  assert.equal(monthlyEquivalentCents([{ amount: '0.10', billing_frequency: 'weekly', is_active: true }, { amount: '0.10', billing_frequency: 'weekly', is_active: true }]), 87);
});

test('no monthly equivalent is shown when it cannot be calculated honestly', () => {
  assert.equal(monthlyEquivalentCents([]), null);
  assert.equal(monthlyEquivalentCents([{ amount: '10.00', billing_frequency: 'monthly', is_active: false }]), null);
  assert.equal(monthlyEquivalentCents([{ amount: 'abc', billing_frequency: 'monthly', is_active: true }]), null);
  assert.equal(monthlyEquivalentCents([{ amount: '10.00', billing_frequency: 'daily', is_active: true }]), null);
});

test('upcoming renewals cover active plans due within 30 days, including passed dates', () => {
  const subs = [
    { id: 'a', name: 'Spotify', next_billing_date: '2026-10-18', is_active: true },
    { id: 'b', name: 'Canva Pro', next_billing_date: '2026-11-11', is_active: true },
    { id: 'c', name: 'Old plan', next_billing_date: '2026-10-05', is_active: true },
    { id: 'd', name: 'Paused', next_billing_date: '2026-10-13', is_active: false },
    { id: 'e', name: 'Later', next_billing_date: '2026-11-12', is_active: true },
  ];
  assert.deepEqual(upcomingRenewals(subs, '2026-10-12').map((s) => s.id), ['c', 'a', 'b']);
});

test('active plans sort by nearest date, then paused plans by name', () => {
  const subs = [
    { name: 'Zed', next_billing_date: '2026-10-01', is_active: false },
    { name: 'Google One', next_billing_date: '2026-10-25', is_active: true },
    { name: 'Alpha', next_billing_date: '2026-12-01', is_active: false },
    { name: 'Spotify', next_billing_date: '2026-10-18', is_active: true },
  ];
  assert.deepEqual(sortSubscriptions(subs).map((s) => s.name), ['Spotify', 'Google One', 'Alpha', 'Zed']);
});

test('only active, reminder-enabled subscriptions with a future time get a reminder', async () => {
  const { planSubscriptionReminders } = await import('../lib/subscriptions.ts');
  const now = new Date(2026, 9, 12, 8, 0).getTime();
  const base = { next_billing_date: '2026-10-18', reminder_days_before: 3, is_active: true, notifications_enabled: true };
  const plan = planSubscriptionReminders('u1', [
    { ...base, id: 'on' },
    { ...base, id: 'paused', is_active: false },
    { ...base, id: 'off', notifications_enabled: false },
    { ...base, id: 'past', next_billing_date: '2026-10-13' },
  ], now);
  assert.deepEqual(plan.map((item) => item.identifier), ['unifyd-subscription-u1-on']);
});

test('reconcile cancels paused, deleted, edited, or other-user reminders and schedules missing ones', async () => {
  const { reconcileReminders } = await import('../lib/subscriptions.ts');
  const wanted = new Map([['keep', 'sig-1'], ['edited', 'sig-new'], ['new', 'sig-3']]);
  const scheduled = [
    { identifier: 'keep', userId: 'u1', signature: 'sig-1' },
    { identifier: 'edited', userId: 'u1', signature: 'sig-old' },
    { identifier: 'deleted-or-paused', userId: 'u1', signature: 'sig-x' },
    { identifier: 'other-user', userId: 'u2', signature: 'sig-y' },
  ];
  assert.deepEqual(reconcileReminders('u1', scheduled, wanted), { cancel: ['edited', 'deleted-or-paused', 'other-user'], schedule: ['edited', 'new'] });
  // With nothing wanted (all paused, deleted, or reminders off), every scheduled reminder is cancelled.
  assert.deepEqual(reconcileReminders('u1', scheduled, new Map()).schedule, []);
  assert.equal(reconcileReminders('u1', scheduled, new Map()).cancel.length, 4);
});

test('attention lists only overdue, today, and soon plans, at most three, in priority order', async () => {
  const { attentionSubscriptions } = await import('../lib/subscriptions.ts');
  const base = { reminder_days_before: 3, is_active: true };
  const subs = [
    { ...base, name: 'Soon B', next_billing_date: '2026-10-16' },
    { ...base, name: 'Later', next_billing_date: '2026-11-30' },
    { ...base, name: 'Today', next_billing_date: '2026-10-12' },
    { ...base, name: 'Paused overdue', next_billing_date: '2026-10-01', is_active: false },
    { ...base, name: 'Overdue', next_billing_date: '2026-10-09' },
    { ...base, name: 'Soon A', next_billing_date: '2026-10-14' },
  ];
  assert.deepEqual(attentionSubscriptions(subs, '2026-10-12').map((entry) => [entry.subscription.name, entry.status]),
    [['Overdue', 'overdue'], ['Today', 'today'], ['Soon A', 'soon']]);
  assert.deepEqual(attentionSubscriptions([{ ...base, name: 'Later', next_billing_date: '2026-11-30' }], '2026-10-12'), []);
});
