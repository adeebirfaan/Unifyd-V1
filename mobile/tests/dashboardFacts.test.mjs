import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDashboardFacts, dashboardMonth } from '../lib/dashboardFacts.ts';
import { buildInsightFacts } from '../../server/src/insight-facts.ts';

// Run with TZ=Asia/Kuala_Lumpur so device-local dates match the server's zone.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const now = new Date(2026, 10, 1, 1, 30); // 1 Nov 2026, 01:30 local
const hoursFromNow = (hours) => new Date(now.getTime() + hours * 3_600_000).toISOString();
const localAt = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString(); // October

const sample = {
  monthlyBudget: '50.00',
  expenses: [
    { amount: '99.99', category: 'food', expense_date: '2026-10-31' },
    { amount: '40.10', category: 'food', expense_date: '2026-11-01' },
    { amount: '15.00', category: 'transport', expense_date: '2026-11-30' },
  ],
  tasks: [
    { title: 'Late lab', subject: 'A', deadline: hoursFromNow(-2), status: 'pending', completed_at: null },
    { title: 'Quiz', subject: 'B', deadline: hoursFromNow(5), status: 'ongoing', completed_at: null },
    { title: 'Report', subject: 'C', deadline: hoursFromNow(24 * 10), status: 'pending', completed_at: null },
    { title: 'Done', subject: 'D', deadline: hoursFromNow(-48), status: 'completed', completed_at: hoursFromNow(-24) },
  ],
  moods: [
    { mood_level: 4, stress_level: 2, recorded_at: localAt(20) },
    { mood_level: 4, stress_level: 2, recorded_at: localAt(21) },
    { mood_level: 2, stress_level: 4, recorded_at: localAt(26) },
    { mood_level: 1, stress_level: 5, recorded_at: localAt(28) },
    { mood_level: 2, stress_level: 4, recorded_at: localAt(30) },
  ],
};

test('month bounds use local calendar dates', () => {
  assert.deepEqual(dashboardMonth(now), { start: '2026-11-01', end: '2026-11-30' });
});

test('dashboard facts are calculated from owned rows without guessing', () => {
  const facts = buildDashboardFacts({ ...sample, now });
  assert.deepEqual(facts.finance, {
    monthStart: '2026-11-01', monthEnd: '2026-11-30', expenseCount: 2, spentCents: 5510,
    budgetCents: 5000, remainingCents: -510, percentUsed: 110.2,
    topCategories: [{ category: 'food', percent: 72.8 }, { category: 'transport', percent: 27.2 }],
  });
  assert.deepEqual(facts.academic, {
    pending: 2, ongoing: 1, overdue: 1, dueSoon: 1, completedRecently: 1,
    nextDeadline: { title: 'Quiz', subject: 'B', deadline: hoursFromNow(5) },
  });
  assert.deepEqual(facts.wellness, {
    windowDays: 7, checkIns: 3, averageMood: 1.7, averageStress: 4.3,
    moodVsPrevious: 'lower', stressVsPrevious: 'higher', repeatedLowMood: true,
  });
});

test('empty records give zero counts, null averages, and no low-mood notice', () => {
  const facts = buildDashboardFacts({ expenses: [], monthlyBudget: null, tasks: [], moods: [], now });
  assert.equal(facts.finance.spentCents, 0);
  assert.equal(facts.finance.percentUsed, null);
  assert.deepEqual(facts.finance.topCategories, []);
  assert.equal(facts.academic.nextDeadline, null);
  assert.equal(facts.wellness.averageMood, null);
  assert.equal(facts.wellness.repeatedLowMood, false);
});

test('device facts match the server facts sent to Groq', { skip: zone !== 'Asia/Kuala_Lumpur' && `device zone is ${zone}` }, () => {
  assert.deepEqual(buildDashboardFacts({ ...sample, now }), buildInsightFacts({ ...sample, now, timeZone: zone }));
});
