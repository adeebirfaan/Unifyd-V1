import assert from 'node:assert/strict';
import test from 'node:test';

import { translate } from '../constants/i18n.ts';
import { answerQuestion, buildSummary, detectIntent, isPoofActionId, usesAi } from '../lib/poofEngine.ts';
import { buildPoofFacts, poofAiPayload, poofPeriods } from '../lib/poofFacts.ts';

// Thursday 15 Oct 2026, 10:00 device-local time. The week runs Mon 12 to Sun 18 Oct.
const now = new Date(2026, 9, 15, 10, 0);
const at = (hours) => new Date(now.getTime() + hours * 3_600_000).toISOString();
const ctx = (language = 'en') => ({ language, now, t: (key, values) => translate(language, key, values) });

const empty = { profile: { full_name: 'Aina', faculty: 'FK', programme: null, study_year: 2 }, expenses: [], budgets: [], tasks: [], completedRecently: 0, moods: [], semester: null };
const facts = (overrides = {}) => buildPoofFacts({ ...empty, ...overrides }, now);

const sample = {
  budgets: [
    { amount: '440.00', period_type: 'weekly', period_start: '2026-10-12' },
    { amount: '1200.00', period_type: 'monthly', period_start: '2026-10-01' },
    { amount: '999.00', period_type: 'weekly', period_start: '2026-10-05' }, // last week: ignored
  ],
  expenses: [
    { amount: '120.00', category: 'food', expense_date: '2026-10-12' },
    { amount: '65.00', category: 'food', expense_date: '2026-10-15' },
    { amount: '30.00', category: 'transport', expense_date: '2026-10-14' },
    { amount: '200.00', category: 'personal', expense_date: '2026-10-02' }, // this month, not this week
    { amount: '50.00', category: 'food', expense_date: '2026-09-30' }, // previous month
    { amount: '5.00', category: 'unknown', expense_date: '2026-10-13' }, // unknown category: ignored
  ],
  tasks: [
    { title: 'Late essay', subject: 'BHE', deadline: at(-5), priority: 'medium', status: 'pending' },
    { title: 'Lab report', subject: 'BCS2233', deadline: at(6), priority: 'high', status: 'ongoing' },
    { title: 'Quiz prep', subject: 'BCS1023', deadline: at(30), priority: 'low', status: 'pending' },
    { title: 'Group slides', subject: 'BCS3013', deadline: at(60), priority: 'medium', status: 'pending' },
    { title: 'Project', subject: 'BCS3263', deadline: at(24 * 6), priority: 'high', status: 'pending' },
    { title: 'Far away', subject: 'X', deadline: at(24 * 20), priority: 'low', status: 'pending' },
  ],
  completedRecently: 2,
  moods: [
    { mood_level: 2, stress_level: 5, recorded_at: at(-2) },
    { mood_level: 1, stress_level: 4, recorded_at: at(-26) },
    { mood_level: 2, stress_level: 4, recorded_at: at(-50) },
    { mood_level: 5, stress_level: 1, recorded_at: at(-24 * 10) }, // outside the 7-day window
  ],
  semester: {
    subjects: 5,
    classes: [
      { course_code: 'BCS2233', course_name: 'Data Structures', day_of_week: 4, start_time: '14:00:00', end_time: '16:00:00', location: 'DK1' },
      { course_code: 'BCS1023', course_name: 'Programming', day_of_week: 4, start_time: '08:00:00', end_time: '10:00:00', location: null }, // already started
      { course_code: 'BCS3013', course_name: 'Software Eng', day_of_week: 5, start_time: '09:00:00', end_time: '11:00:00', location: null },
    ],
  },
};

test('periods follow Monday weeks and calendar months in local time', () => {
  const periods = poofPeriods(now);
  assert.deepEqual(periods.week, { start: '2026-10-12', end: '2026-10-18', daysLeft: 4 });
  assert.deepEqual(periods.month, { start: '2026-10-01', end: '2026-10-31', daysLeft: 17 });
});

test('facts combine wallet, budgets, planner, academic, and mind data', () => {
  const result = facts(sample);
  assert.equal(result.finance.week.spentCents, 21500);
  assert.equal(result.finance.week.budgetCents, 44000);
  assert.equal(result.finance.week.percentUsed, 48.9);
  assert.deepEqual(result.finance.week.categories.map((c) => c.category), ['food', 'transport']);
  assert.equal(result.finance.month.spentCents, 41500);
  assert.equal(result.finance.month.expenseCount, 4);
  assert.equal(result.finance.month.categories[0].category, 'personal');

  assert.equal(result.planner.active, 6);
  assert.equal(result.planner.overdue, 1);
  assert.equal(result.planner.dueToday, 1);
  assert.equal(result.planner.dueSoon, 3);
  assert.equal(result.planner.dueThisWeek, 4);
  assert.equal(result.planner.highPriorityOpen, 2);
  assert.equal(result.planner.next.title, 'Lab report');
  assert.equal(result.planner.completedRecently, 2);

  assert.equal(result.academic.semesterSet, true);
  assert.equal(result.academic.weeklyClasses, 3);
  assert.deepEqual(result.academic.classesLeftToday.map((c) => c.code), ['BCS2233']);
  assert.equal(result.academic.nextClass.start, '14:00');

  assert.equal(result.wellness.checkIns, 3);
  assert.equal(result.wellness.repeatedLowMood, true);
  assert.equal(result.wellness.highStress, true);
  assert.equal(result.wellness.daysSinceLastCheckIn, 0);
  assert.equal(result.profile.complete, true);
});

test('an empty account produces no invented figures', () => {
  const result = facts({ profile: null });
  assert.equal(result.finance.week.budgetCents, null);
  assert.equal(result.finance.week.percentUsed, null);
  assert.equal(result.planner.next, null);
  assert.equal(result.academic.nextClass, null);
  assert.equal(result.wellness.averageMood, null);
  assert.equal(result.wellness.daysSinceLastCheckIn, null);
  assert.deepEqual(result.profile.missing, ['name', 'faculty', 'studyYear']);
});

test('the AI payload carries aggregates only, never titles, subjects, or class names', () => {
  const payload = poofAiPayload(facts(sample));
  const text = JSON.stringify(payload);
  for (const secret of ['Late essay', 'Lab report', 'BCS2233', 'Data Structures', 'DK1', 'Aina']) assert.ok(!text.includes(secret), secret);
  assert.equal(payload.finance.thisWeek.spent, '215.00');
  assert.equal(payload.finance.thisWeek.remaining, '225.00');
  assert.equal(payload.planner.dueInNext3Days, 3);
  assert.equal(payload.academic.classesLeftToday, 1);
});

test('intents are recognised in English and Bahasa Melayu', () => {
  const cases = [
    ['Where did I spend the most this month?', 'topSpending'],
    ['Can I still spend money on food this week?', 'canSpend', 'food'],
    ['What should I prioritise today?', 'prioritise'],
    ['Do I have any overdue tasks?', 'overdue'],
    ['How can I improve my budget?', 'improveBudget'],
    ['Am I spending too much on transport?', 'categoryCheck', 'transport'],
    ['What should I focus on before my next deadline?', 'nextDeadline'],
    ['When is my next class?', 'classes'],
    ['I feel so stressed lately', 'wellbeing'],
    ['I want to kill myself', 'crisis'],
    ['hi poof!', 'greeting'],
    ['What can you do?', 'help'],
    ['Who won the football match?', 'general'],
    ['Di mana saya paling banyak berbelanja bulan ini?', 'topSpending'],
    ['Berapa baki bajet saya untuk makanan minggu ini?', 'canSpend', 'food'],
    ['Apa yang patut saya utamakan hari ini?', 'prioritise'],
    ['Ada tugasan saya yang lewat?', 'overdue'],
    ['Bagaimana saya boleh baiki bajet saya?', 'improveBudget'],
    ['Adakah saya berbelanja terlalu banyak untuk pengangkutan?', 'categoryCheck', 'transport'],
    ['Apa yang perlu saya fokuskan sebelum tarikh akhir seterusnya?', 'nextDeadline'],
    ['Saya rasa nak bunuh diri', 'crisis'],
  ];
  for (const [question, intent, category] of cases) {
    const result = detectIntent(question);
    assert.equal(result.intent, intent, question);
    if (category) assert.equal(result.category, category, question);
  }
  assert.equal(usesAi('crisis'), false);
  assert.equal(usesAi('topSpending'), true);
});

test('the summary reflects real data and links to the right screens', () => {
  const summary = buildSummary(facts(sample), ctx());
  const byId = Object.fromEntries(summary.map((item) => [item.id, item]));
  assert.equal(byId['money-top'].text, 'You’ve spent RM 185.00 on food this week, which is 42% of your weekly budget.');
  assert.equal(byId['money-budget'].text, 'You have RM 225.00 left in your weekly budget for the next 4 days.');
  assert.equal(byId['planner-overdue'].text, 'You have 1 overdue task.');
  assert.equal(byId['planner-soon'].text, 'You have 3 tasks due in the next 3 days.');
  assert.equal(byId['academic-today'].action, 'openTimetable');
  assert.equal(byId['wellbeing-low'].tone, 'attention');
  assert.ok(summary.every((item) => item.action === null || isPoofActionId(item.action)));
});

test('the summary explains what to add when data is missing', () => {
  const summary = buildSummary(facts({ profile: null }), ctx());
  assert.deepEqual(summary.map((item) => [item.id, item.action]), [
    ['money-empty', 'addExpense'],
    ['planner-empty', 'addTask'],
    ['academic-setup', 'mySemester'],
    ['wellbeing-checkin', 'openMind'],
    ['profile', 'completeProfile'],
  ]);
  const malay = buildSummary(facts({ profile: null }), ctx('ms'));
  assert.equal(malay[2].text, 'Anda belum menambah subjek semester anda.');
});

test('answers use real figures and suggest navigation only', () => {
  const data = facts(sample);
  const top = answerQuestion('Where did I spend the most this month?', data, ctx());
  assert.match(top.text, /biggest spend is personal at RM 200\.00, 48\.2% of the RM 415\.00/);
  assert.deepEqual(top.actions, ['openWallet']);

  const spend = answerQuestion('Can I still spend money on food this week?', data, ctx());
  assert.match(spend.text, /RM 225\.00 left in your weekly budget for the next 4 days, about RM 56\.25 a day/);
  assert.match(spend.text, /RM 185\.00 on food this week/);

  const first = answerQuestion('What should I prioritise today?', data, ctx());
  assert.match(first.text, /^Start with Late essay\. It’s already overdue\./);
  assert.match(first.text, /1 class left today/);
  assert.equal(first.details.length, 4);

  const transport = answerQuestion('Am I spending too much on transport?', data, ctx());
  assert.match(transport.text, /RM 30\.00 on transport, 7\.2% of your total spending\. That’s a modest share/);

  for (const question of ['Do I have any overdue tasks?', 'How can I improve my budget?', 'What should I focus on before my next deadline?', 'next class?']) {
    const answer = answerQuestion(question, data, ctx());
    assert.ok(answer.text.length > 0 && answer.actions.length <= 2, question);
    assert.ok(answer.actions.every(isPoofActionId), question);
  }
});

test('answers stay honest when there is no data', () => {
  const data = facts();
  assert.deepEqual(answerQuestion('Where did I spend the most?', data, ctx()).actions, ['addExpense']);
  assert.deepEqual(answerQuestion('Can I afford dinner out?', data, ctx()).actions, ['setBudget', 'openWallet']);
  assert.deepEqual(answerQuestion('What should I do first today?', data, ctx()).actions, ['addTask']);
  assert.deepEqual(answerQuestion('Show my timetable', data, ctx()).actions, ['mySemester']);
  assert.equal(answerQuestion('How is my mood?', data, ctx()).notice, 'support');
});

test('crisis messages get support contacts and never an app action', () => {
  const answer = answerQuestion('I want to end my life', facts(sample), ctx());
  assert.equal(answer.notice, 'crisis');
  assert.deepEqual(answer.actions, []);
  assert.equal(answerQuestion('Tell me a joke about cats', facts(sample), ctx()).notice, 'scope');
});
