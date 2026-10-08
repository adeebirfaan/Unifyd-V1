import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { createApp } from './app.js';
import { buildInsightFacts, startOfLocalDay } from './insight-facts.js';
import type { InsightFacts, MoodRow, TaskRow } from './insight-facts.js';
import { groqMessages, groqPayload, validateSummary } from './insight-summary.js';

const KL = 'Asia/Kuala_Lumpur';
// 1 Nov 2026, 01:30 in Kuala Lumpur (still 31 Oct in UTC).
const now = new Date('2026-10-31T17:30:00Z');
const hoursFromNow = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();

function facts(overrides: Partial<Parameters<typeof buildInsightFacts>[0]> = {}): InsightFacts {
  return buildInsightFacts({ expenses: [], monthlyBudget: null, tasks: [], moods: [], now, timeZone: KL, ...overrides });
}

test('local day boundaries follow the student time zone', () => {
  assert.equal(startOfLocalDay('2026-11-01', KL).toISOString(), '2026-10-31T16:00:00.000Z');
});

test('finance uses the local calendar month, integer cents, and budget balance', () => {
  const result = facts({
    monthlyBudget: '500.00',
    expenses: [
      { amount: '99.99', category: 'food', expense_date: '2026-10-31' }, // previous local month
      { amount: '12.10', category: 'food', expense_date: '2026-11-01' },
      { amount: '0.20', category: 'transport', expense_date: '2026-11-01' },
      { amount: 7.7, category: 'food', expense_date: '2026-11-30' },
    ],
  }).finance;
  assert.deepEqual(result, {
    monthStart: '2026-11-01', monthEnd: '2026-11-30', expenseCount: 3, spentCents: 2000,
    budgetCents: 50000, remainingCents: 48000, percentUsed: 4,
    topCategories: [{ category: 'food', percent: 99 }, { category: 'transport', percent: 1 }],
  });
  assert.equal(facts({ monthlyBudget: 10, expenses: [{ amount: 15, category: 'other', expense_date: '2026-11-02' }] }).finance.remainingCents, -500);
});

test('academic counts overdue, due-soon, recently completed, and the next deadline', () => {
  const tasks: TaskRow[] = [
    { title: 'Late lab', subject: 'BCS2233', deadline: hoursFromNow(-2), status: 'pending', completed_at: null },
    { title: 'Quiz', subject: 'BCN2113', deadline: hoursFromNow(5), status: 'ongoing', completed_at: null },
    { title: 'Report', subject: 'BCS2143', deadline: hoursFromNow(24 * 10), status: 'pending', completed_at: null },
    { title: 'Done', subject: 'X', deadline: hoursFromNow(-48), status: 'completed', completed_at: hoursFromNow(-24) },
    { title: 'Old', subject: 'X', deadline: hoursFromNow(-480), status: 'completed', completed_at: hoursFromNow(-24 * 9) },
  ];
  assert.deepEqual(facts({ tasks }).academic, {
    pending: 2, ongoing: 1, overdue: 1, dueSoon: 1, completedRecently: 1,
    nextDeadline: { title: 'Quiz', subject: 'BCN2113', deadline: hoursFromNow(5) },
  });
});

test('repeated low mood needs low check-ins on three different local days', () => {
  const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00+08:00`).toISOString();
  const low = (date: string, time?: string): MoodRow => ({ mood_level: 2, stress_level: 4, recorded_at: at(date, time) });
  const sameDay = facts({ moods: [low('2026-10-30', '08:00'), low('2026-10-30', '12:00'), low('2026-10-30', '20:00')] }).wellness;
  assert.equal(sameDay.repeatedLowMood, false);
  assert.equal(sameDay.checkIns, 3);
  const threeDays = facts({ moods: [low('2026-10-26'), low('2026-10-29'), low('2026-11-01', '00:30')] }).wellness;
  assert.equal(threeDays.repeatedLowMood, true);
  // 25 Oct is outside the current seven local days (26 Oct to 1 Nov).
  assert.equal(facts({ moods: [low('2026-10-25'), low('2026-10-29'), low('2026-11-01', '00:30')] }).wellness.repeatedLowMood, false);
});

test('wellbeing comparison appears only with two check-ins in both windows', () => {
  const entry = (date: string, mood: number): MoodRow => ({ mood_level: mood, stress_level: 3, recorded_at: new Date(`${date}T09:00:00+08:00`).toISOString() });
  const one = facts({ moods: [entry('2026-10-20', 2), entry('2026-10-21', 2), entry('2026-10-30', 4)] }).wellness;
  assert.equal(one.moodVsPrevious, null);
  const both = facts({ moods: [entry('2026-10-20', 2), entry('2026-10-21', 2), entry('2026-10-30', 4), entry('2026-10-31', 5)] }).wellness;
  assert.deepEqual([both.averageMood, both.moodVsPrevious, both.stressVsPrevious], [4.5, 'higher', 'similar']);
});

const sampleFacts = facts({
  monthlyBudget: '500.00',
  expenses: [{ amount: '1234.50', category: 'food', expense_date: '2026-11-01' }],
  tasks: [{ title: 'Secret thesis title', subject: 'Private subject', deadline: hoursFromNow(5), status: 'pending', completed_at: null }],
  moods: [{ mood_level: 4, stress_level: 2, recorded_at: hoursFromNow(-1) }],
});
const payload = groqPayload(sampleFacts);

test('Groq payload contains aggregates only, never task text', () => {
  const text = JSON.stringify(groqMessages(payload, 'en'));
  assert.ok(!text.includes('Secret thesis title'));
  assert.ok(!text.includes('Private subject'));
  assert.equal(payload.finance.overBudgetBy, '734.50');
  assert.equal(payload.finance.remaining, null);
});

const good = {
  finance: 'You have spent RM 1,234.50 this month, which is RM 734.50 over your RM 500.00 budget.',
  academic: 'You have 1 pending task, with 1 due in the next 7 days.',
  wellness: 'Your 1 check-in this week shows an average mood of 4 and stress of 2.',
};

test('a factual summary is accepted', () => {
  assert.deepEqual(validateSummary(JSON.stringify(good), payload), good);
});

test('invented numbers, unsafe language, and malformed shapes are rejected', () => {
  const reject = (change: Record<string, unknown>) => assert.equal(validateSummary(JSON.stringify({ ...good, ...change }), payload), null);
  reject({ finance: 'You have spent RM 1,300.00 this month.' });
  reject({ academic: 'You have 3 pending tasks.' });
  reject({ wellness: 'This may suggest depression.' });
  reject({ wellness: 'Your mood will likely improve next week.' });
  reject({ finance: 'Consider investing your savings.' });
  reject({ wellness: 'Anda mungkin mengalami kemurungan.' });
  reject({ academic: 'See https://example.com for help.' });
  reject({ extra: 'field' });
  reject({ finance: 'x'.repeat(301) });
  reject({ finance: '' });
  assert.equal(validateSummary('not json', payload), null);
});

type Call = { messages: unknown };
function insightApp(options: { summarize?: ((messages: unknown) => Promise<string>) | null; loadFails?: boolean } = {}) {
  const calls: Call[] = [];
  const loads: { token: string; timeZone: string }[] = [];
  const app = createApp({
    verifyToken: async (token) => token === 'valid-test-token',
    detectText: async () => '',
    insights: {
      now: () => now,
      loadFacts: async (token, timeZone) => {
        loads.push({ token, timeZone });
        if (options.loadFails) throw new Error('database down');
        return { userId: 'user-1', facts: sampleFacts };
      },
      summarize: options.summarize === undefined
        ? async (messages) => { calls.push({ messages }); return JSON.stringify(good); }
        : options.summarize === null ? null : async (messages) => { calls.push({ messages }); return options.summarize!(messages); },
    },
  });
  return { app, calls, loads };
}

const post = (app: ReturnType<typeof createApp>, body: object = { language: 'en', timeZone: KL }, token = 'valid-test-token') =>
  request(app).post('/api/insights/generate').set('Authorization', `Bearer ${token}`).send(body);

test('insights require a verified sign-in before loading data', async () => {
  const { app, loads } = insightApp();
  await request(app).post('/api/insights/generate').send({}).expect(401);
  await post(app, {}, 'wrong').expect(401);
  assert.equal(loads.length, 0);
});

test('a valid AI summary is returned with verified facts and then reused', async () => {
  const { app, calls, loads } = insightApp();
  const first = await post(app).expect(200);
  assert.equal(first.body.source, 'ai');
  assert.deepEqual(first.body.summary, good);
  assert.equal(first.body.facts.finance.spentCents, 123450);
  assert.equal(first.body.fallbackReason, null);
  assert.deepEqual(loads[0], { token: 'valid-test-token', timeZone: KL });
  await post(app).expect(200);
  assert.equal(calls.length, 1, 'identical facts reuse the cached summary');
});

test('facts remain available when Groq is missing, failing, or unsafe', async () => {
  const cases = [
    { summarize: null, reason: 'not_configured' },
    { summarize: async () => { throw new Error('provider secret detail'); }, reason: 'unavailable' },
    { summarize: async () => JSON.stringify({ ...good, wellness: 'This is a diagnosis.' }), reason: 'invalid_response' },
  ] as const;
  for (const { summarize, reason } of cases) {
    const { app } = insightApp({ summarize });
    const response = await post(app).expect(200);
    assert.equal(response.body.source, 'fallback');
    assert.equal(response.body.summary, null);
    assert.equal(response.body.fallbackReason, reason);
    assert.equal(response.body.facts.academic.pending, 1);
    assert.ok(!JSON.stringify(response.body).includes('provider secret detail'));
  }
});

test('invalid time zones and unavailable data return safe errors', async () => {
  await post(insightApp().app, { timeZone: 'Mars/Base' }).expect(400);
  const failed = await post(insightApp({ loadFails: true }).app).expect(503);
  assert.equal(failed.body.error.code, 'FACTS_UNAVAILABLE');
  assert.ok(!JSON.stringify(failed.body).includes('database down'));
});

test('Expo Web preflight is allowed for the insights endpoint', async () => {
  const response = await request(insightApp().app).options('/api/insights/generate').set('Origin', 'http://localhost:8081')
    .set('Access-Control-Request-Method', 'POST').expect(204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:8081');
});
