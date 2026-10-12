import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { createApp } from './app.js';
import type { LabelledExpense } from './expense-classifier.js';
import { loadExpenseHistory } from './expense-history.js';

const PATH = '/api/ml/expense-category-suggestion';
// Fictional labelled history for tests only.
const history: LabelledExpense[] = [
  ...['KFC Gambang', 'Nasi lemak kafe', 'Mamak roti canai', 'KFC dinner', 'Kopi kafe', 'Nasi ayam kafe', 'McDonald lunch', 'KFC lunch'].map((title) => ({ title, category: 'food' as const })),
  ...['Grab to campus', 'Bas kampus', 'Grab to Kuantan', 'Petrol motor', 'Grab ride home'].map((title) => ({ title, category: 'transport' as const })),
  ...['Shopee order', 'Shopee baju', 'Haircut'].map((title) => ({ title, category: 'personal' as const })),
];

function setup(options: { history?: LabelledExpense[]; fail?: boolean; max?: number } = {}) {
  const loads: string[] = [];
  const app = createApp({
    verifyToken: async (token) => token.startsWith('valid-'),
    detectText: async () => '',
    categories: {
      loadHistory: async (token) => {
        loads.push(token);
        if (options.fail) throw new Error('database down: KFC Gambang');
        return { userId: `user-for-${token}`, history: options.history ?? history };
      },
      rateLimit: { max: options.max ?? 60, windowMs: 60_000 },
    },
  });
  return { app, loads };
}

test('unauthenticated suggestion requests are rejected before any history is read', async () => {
  const { app, loads } = setup();
  await request(app).post(PATH).send({ title: 'KFC' }).expect(401);
  await request(app).post(PATH).set('Authorization', 'Bearer wrong').send({ title: 'KFC' }).expect(401);
  assert.deepEqual(loads, []);
});

test('history is read only for the verified caller token, never for an ID in the body', async () => {
  const { app, loads } = setup();
  const response = await request(app).post(PATH).set('Authorization', 'Bearer valid-student-a').send({ title: 'KFC Gambang lunch' }).expect(200);
  assert.deepEqual(loads, ['valid-student-a']);
  assert.equal(response.body.available, true);
  assert.equal(response.body.category, 'food');
  assert.equal(response.body.trainingExpenseCount, history.length);
  assert.ok(response.body.confidence >= 0.7 && response.body.confidence <= 1);
  // Only the typed result is returned: no titles, vocabulary, or history.
  assert.deepEqual(Object.keys(response.body).sort(), ['available', 'category', 'confidence', 'trainingExpenseCount']);
  // Extra fields such as a user ID are refused rather than trusted.
  await request(app).post(PATH).set('Authorization', 'Bearer valid-student-a').send({ title: 'KFC', userId: 'someone-else' }).expect(400);
  assert.equal(loads.length, 1);
});

test('the request shape and title length are validated', async () => {
  const { app } = setup();
  const send = (body: unknown) => request(app).post(PATH).set('Authorization', 'Bearer valid-a').send(body as object);
  for (const body of [{}, { title: '' }, { title: '   ' }, { title: 42 }, { title: 'x'.repeat(121) }, ['KFC']]) {
    const response = await send(body).expect(400);
    assert.equal(response.body.error.code, 'INVALID_REQUEST');
  }
  await send({ title: 'x'.repeat(120) }).expect(200);
});

test('insufficient data and low confidence return typed unavailable results', async () => {
  const small = setup({ history: history.slice(0, 10) });
  const notEnough = await request(small.app).post(PATH).set('Authorization', 'Bearer valid-a').send({ title: 'KFC' }).expect(200);
  assert.deepEqual(notEnough.body, { available: false, reason: 'not_enough_data', trainingExpenseCount: 10 });
  const { app } = setup();
  const unknown = await request(app).post(PATH).set('Authorization', 'Bearer valid-a').send({ title: 'Zxqv' }).expect(200);
  assert.deepEqual(unknown.body, { available: false, reason: 'low_confidence', trainingExpenseCount: history.length });
});

test('requests are rate-limited per session, and failures are safe and never logged', async () => {
  const { app } = setup({ max: 2 });
  for (let i = 0; i < 2; i++) await request(app).post(PATH).set('Authorization', 'Bearer valid-a').send({ title: 'KFC' }).expect(200);
  const limited = await request(app).post(PATH).set('Authorization', 'Bearer valid-a').send({ title: 'KFC' }).expect(429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  await request(app).post(PATH).set('Authorization', 'Bearer valid-b').send({ title: 'KFC' }).expect(200);

  const logged: unknown[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = console.warn = console.error = console.info = (...args: unknown[]) => { logged.push(...args); };
  try {
    const failing = setup({ fail: true });
    const response = await request(failing.app).post(PATH).set('Authorization', 'Bearer valid-secret-token').send({ title: 'KFC Gambang' }).expect(503);
    assert.equal(response.body.error.code, 'HISTORY_UNAVAILABLE');
    assert.ok(!JSON.stringify(response.body).includes('KFC'));
  } finally {
    Object.assign(console, original);
  }
  assert.ok(!logged.some((entry) => String(entry).includes('KFC') || String(entry).includes('valid-secret-token')));
});

test('without the dependency the endpoint reports unavailable instead of guessing', async () => {
  const app = createApp({ verifyToken: async () => true, detectText: async () => '' });
  const response = await request(app).post(PATH).set('Authorization', 'Bearer valid-a').send({ title: 'KFC' }).expect(503);
  assert.equal(response.body.error.code, 'SUGGESTION_UNAVAILABLE');
});

test('the history loader selects only titles and categories for the verified user', async () => {
  const calls: { select?: string; eq?: [string, string]; limit?: number; header?: string } = {};
  const fakeClient = ((_url: string, _key: string, options: { global: { headers: { Authorization: string } } }) => {
    calls.header = options.global.headers.Authorization;
    const query = {
      select(columns: string) { calls.select = columns; return query; },
      eq(column: string, value: string) { calls.eq = [column, value]; return query; },
      order() { return query; },
      limit(count: number) {
        calls.limit = count;
        return Promise.resolve({ data: [{ title: 'KFC', category: 'food' }, { title: 'Bad', category: 'bills' }, { title: null, category: 'food' }], error: null });
      },
    };
    return { auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }) }, from: (table: string) => { assert.equal(table, 'expenses'); return query; } };
  }) as unknown as Parameters<typeof loadExpenseHistory>[3];
  const result = await loadExpenseHistory('https://example.invalid', 'publishable', 'caller-token', fakeClient);
  assert.equal(calls.header, 'Bearer caller-token');
  assert.equal(calls.select, 'title,category');
  assert.deepEqual(calls.eq, ['user_id', 'verified-user']);
  assert.equal(calls.limit, 500);
  assert.deepEqual(result, { userId: 'verified-user', history: [{ title: 'KFC', category: 'food' }] });
});
