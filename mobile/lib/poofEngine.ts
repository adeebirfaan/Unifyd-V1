import type { LanguagePreference, TranslationKey } from '@/constants/i18n';
import type { ExpenseCategory } from '@/lib/expenseForm';
import type { ClassBrief, PoofFacts, SpendingPeriod, TaskBrief } from '@/lib/poofFacts';

// Poof's rule-based answers. They use only the PoofFacts snapshot, so they work
// offline and act as the fallback whenever the AI service is unavailable. Pure
// functions only; translations are injected so the rules can be unit-tested.
//
// Phase 1 is read-only: Poof only suggests in-app navigation. A future action
// that creates or changes data (for example a task or budget) must show the
// student a preview and wait for their confirmation before saving.

export const POOF_ACTION_IDS = ['openWallet', 'setBudget', 'addExpense', 'openPlanner', 'addTask', 'mySemester', 'openTimetable', 'openMind', 'completeProfile'] as const;
export type PoofActionId = (typeof POOF_ACTION_IDS)[number];
export const MAX_POOF_ACTIONS = 2;

export function isPoofActionId(value: unknown): value is PoofActionId {
  return typeof value === 'string' && (POOF_ACTION_IDS as readonly string[]).includes(value);
}

export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;
export type PoofContext = { t: Translate; language: LanguagePreference; now?: Date };

export type PoofIntent =
  | 'crisis' | 'wellbeing'
  | 'canSpend' | 'categoryCheck' | 'topSpending' | 'improveBudget' | 'budgetStatus'
  | 'overdue' | 'nextDeadline' | 'prioritise' | 'classes'
  | 'profile' | 'greeting' | 'help' | 'general';

// Matched case-insensitively against the student's question, in English and Bahasa Melayu.
const CRISIS = /\b(suicid\w*|kill (myself|me)|end (my life|it all)|want(ed)? to die|wanna die|don'?t want to (live|be alive)|self[- ]?harm\w*|hurt(ing)? myself|cut(ting)? myself|no reason to live)\b|bunuh diri|nak mati|ingin mati|mahu mati|cederakan diri|tamatkan hidup|tak nak hidup/;
const WELLBEING = /\b(stress\w*|anxi\w*|sad|depress\w*|tired|exhaust\w*|burn(ed|t)? ?out|overwhelm\w*|mood|mental|lonely|worried|wellbeing|well-being)\b|tertekan|stres|cemas|sedih|letih|penat|emosi|murung|risau|kesejahteraan|perasaan/;
const MONEY = /\b(spen[dt]\w*|money|budget\w*|wallet|expenses?|cash|ringgit|rm\s?\d+)\b|belanja\w*|duit|wang|bajet|dompet/;
const CAN_SPEND = /can i (still )?(spend|afford|buy|eat)|afford|how much (can i|do i have|is left|have i got)|(money|budget) (left|remaining)|boleh (lagi )?(belanja|beli|makan)|mampu|berapa baki/;
const TOO_MUCH = /too much|overspend\w*|spending (a lot|more)|terlalu banyak|berlebihan/;
const TOP = /\b(most|biggest|highest|top|largest)\b|where (did|does|do) (i|my)|paling (banyak|tinggi)|ke mana/;
const IMPROVE = /improve|\bsave\b|saving|\btips?\b|cut (back|down)|reduce|spend less|jimat|simpan|kurangkan|tingkatkan|baiki/;
const OVERDUE = /\b(overdue|late|missed|behind)\b|lewat|tertunggak|terlepas/;
const DEADLINE = /deadline|\bdue\b|next (assignment|task|submission)|tarikh akhir/;
const PRIORITISE = /prioriti[sz]\w*|\bpriority|\bfocus\b|what should i (do|work on|start)|where (do|should) i start|\btoday\b|keutamaan|utamakan|fokus|hari ini|patut (buat|mula)/;
const CLASSES = /\b(class(es)?|lectures?|timetable|schedule|subjects?|courses?|semester|tutorials?)\b|kelas|kuliah|jadual|subjek|kursus/;
const TASKS = /\b(tasks?|assignments?|homework|planner|to-?dos?)\b|tugasan|kerja rumah|perancang/;
const PROFILE = /\bprofile\b|profil/;
const GREETING = /^(hi|hello|hey|hai|helo|yo|assalamualaikum|salam|selamat (pagi|petang|malam|tengah hari))( poof)?[\s!.,]*$/;
const HELP = /what can you do|how (can|do) you help|\bhelp\b|apa (yang )?(boleh|kamu|awak) (buat|bantu)|bantu|tolong/;

// Whole words only: Malay affixes would otherwise match inside other words ("utamakan" contains "makan").
const CATEGORY_WORDS: readonly [ExpenseCategory, RegExp][] = [
  ['food', /\b(food|eat\w*|meals?|lunch|dinner|breakfast|snacks?|drinks?|coffee|groceries|makan(an)?|minum(an)?|sarapan|kopi|runcit)\b/],
  ['transport', /\b(transport\w*|grab|bus|train|lrt|mrt|petrol|fuel|taxi|parking|travel|pengangkutan|tambang|minyak|teksi|bas)\b/],
  ['academic_materials', /\b(books?|academic|stationery|printing|textbooks?|materials?|buku|akademik|alat tulis|cetak\w*)\b/],
  ['personal', /\b(personal|shopping|clothes|entertainment|peribadi|pakaian|hiburan|beli-belah)\b/],
];

export function detectIntent(question: string): { intent: PoofIntent; category: ExpenseCategory | null } {
  const text = question.toLowerCase().replace(/\s+/g, ' ').trim();
  const category = CATEGORY_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
  const result = (intent: PoofIntent) => ({ intent, category });
  if (CRISIS.test(text)) return result('crisis');
  if (WELLBEING.test(text)) return result('wellbeing');
  if (MONEY.test(text) || category || CAN_SPEND.test(text) || TOO_MUCH.test(text)) {
    if (CAN_SPEND.test(text)) return result('canSpend');
    if (TOO_MUCH.test(text)) return result(category ? 'categoryCheck' : 'topSpending');
    if (TOP.test(text)) return result('topSpending');
    if (IMPROVE.test(text)) return result('improveBudget');
    return result(category ? 'categoryCheck' : 'budgetStatus');
  }
  if (OVERDUE.test(text)) return result('overdue');
  if (DEADLINE.test(text)) return result('nextDeadline');
  if (PRIORITISE.test(text)) return result('prioritise');
  if (CLASSES.test(text)) return result('classes');
  if (TASKS.test(text)) return result('prioritise');
  if (PROFILE.test(text)) return result('profile');
  if (GREETING.test(text)) return result('greeting');
  if (HELP.test(text)) return result('help');
  return result('general');
}

/** Crisis messages, greetings, and help never go to the AI service. */
export const usesAi = (intent: PoofIntent) => intent !== 'crisis' && intent !== 'greeting' && intent !== 'help';

// ---------------------------------------------------------------------------
// Formatting

const locale = (language: LanguagePreference) => language === 'ms' ? 'ms-MY' : 'en-MY';
export const formatMoney = (cents: number) => `RM ${new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
const formatPercent = (value: number) => `${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 1 }).format(value)}%`;
const round1 = (value: number) => Math.round(value * 10) / 10;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function categoryName(category: ExpenseCategory, { t, language }: PoofContext) {
  const label = t(`expense.category.${category}` as TranslationKey);
  return language === 'en' ? label.toLowerCase() : label.toLocaleLowerCase('ms-MY');
}

function plural(ctx: PoofContext, count: number, one: TranslationKey, many: TranslationKey, values: Record<string, string | number> = {}) {
  return ctx.t(count === 1 ? one : many, { count, ...values });
}

/** "today at 3:00 pm", "tomorrow at 9:00 am", or "Fri, 16 Oct at 11:59 pm". */
export function formatWhen(iso: string, ctx: PoofContext): string {
  const date = new Date(iso);
  const now = ctx.now ?? new Date();
  const time = new Intl.DateTimeFormat(locale(ctx.language), { hour: 'numeric', minute: '2-digit' }).format(date);
  if (sameDay(date, now)) return ctx.t('poof.when.today', { time });
  if (sameDay(date, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))) return ctx.t('poof.when.tomorrow', { time });
  const day = new Intl.DateTimeFormat(locale(ctx.language), { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return ctx.t('poof.when.date', { day, time });
}

function classDay(item: ClassBrief, ctx: PoofContext): string {
  if (item.daysAhead === 0) return ctx.t('poof.day.today');
  if (item.daysAhead === 1) return ctx.t('poof.day.tomorrow');
  const now = ctx.now ?? new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + item.daysAhead);
  return ctx.t('poof.day.on', { day: new Intl.DateTimeFormat(locale(ctx.language), { weekday: 'long' }).format(date) });
}

const className = (item: ClassBrief) => item.code ? `${item.code} ${item.name}` : item.name;

function taskLine(task: TaskBrief, ctx: PoofContext, overdue: boolean) {
  const when = formatWhen(task.deadline, ctx);
  return ctx.t(overdue ? 'poof.detail.taskOverdue' : 'poof.detail.task', { title: task.title, subject: task.subject, when });
}

function classLine(item: ClassBrief, ctx: PoofContext) {
  return ctx.t(item.location ? 'poof.detail.classAt' : 'poof.detail.class', { name: className(item), start: item.start, end: item.end, location: item.location ?? '' });
}

// ---------------------------------------------------------------------------
// Budget helpers

type BudgetWords = { thisPeriod: string; periodBudget: string };
function budgetWords(period: 'week' | 'month', ctx: PoofContext): BudgetWords {
  return period === 'week'
    ? { thisPeriod: ctx.t('poof.period.thisWeek'), periodBudget: ctx.t('poof.period.weeklyBudget') }
    : { thisPeriod: ctx.t('poof.period.thisMonth'), periodBudget: ctx.t('poof.period.monthlyBudget') };
}

/** The weekly budget when one is set, otherwise the monthly one. */
function activeBudget(facts: PoofFacts): { period: SpendingPeriod; kind: 'week' | 'month' } | null {
  if (facts.finance.week.budgetCents !== null) return { period: facts.finance.week, kind: 'week' };
  if (facts.finance.month.budgetCents !== null) return { period: facts.finance.month, kind: 'month' };
  return null;
}

const daysPhrase = (days: number, ctx: PoofContext) => days <= 1 ? ctx.t('poof.daysLeftOne') : ctx.t('poof.daysLeftMany', { count: days });
const NEAR_BUDGET_PERCENT = 85;

function budgetStatusLine(budget: { period: SpendingPeriod; kind: 'week' | 'month' }, ctx: PoofContext): { text: string; tone: PoofTone } {
  const { period, kind } = budget;
  const words = budgetWords(kind, ctx);
  const remaining = period.remainingCents ?? 0;
  if (remaining < 0) return { tone: 'attention', text: ctx.t('poof.sum.overBudget', { amount: formatMoney(-remaining), ...words }) };
  const values = { percent: formatPercent(period.percentUsed ?? 0), remaining: formatMoney(remaining), days: daysPhrase(period.daysLeft, ctx), ...words };
  if ((period.percentUsed ?? 0) >= NEAR_BUDGET_PERCENT) return { tone: 'attention', text: ctx.t('poof.sum.nearBudget', values) };
  return { tone: 'good', text: ctx.t('poof.sum.budgetOk', values) };
}

// ---------------------------------------------------------------------------
// Summary

export type PoofArea = 'money' | 'planner' | 'academic' | 'wellbeing' | 'profile';
export type PoofTone = 'good' | 'info' | 'attention';
export type PoofInsight = { id: string; area: PoofArea; tone: PoofTone; text: string; action: PoofActionId | null };

/** Short, scannable insights backed only by the student's recorded data. */
export function buildSummary(facts: PoofFacts, ctx: PoofContext): PoofInsight[] {
  const insights: PoofInsight[] = [];
  const add = (id: string, area: PoofArea, tone: PoofTone, text: string, action: PoofActionId | null) => insights.push({ id, area, tone, text, action });
  const { week, month } = facts.finance;
  const budget = activeBudget(facts);

  if (week.expenseCount === 0 && month.expenseCount === 0) {
    add('money-empty', 'money', 'info', ctx.t(budget ? 'poof.sum.noExpensesBudget' : 'poof.sum.moneyEmpty'), 'addExpense');
  } else {
    const kind = week.expenseCount ? 'week' : 'month';
    const period = kind === 'week' ? week : month;
    const top = period.categories[0];
    if (top) {
      const words = budgetWords(kind, ctx);
      const values = { category: categoryName(top.category, ctx), amount: formatMoney(top.cents), ...words };
      add('money-top', 'money', 'info', period.budgetCents
        ? ctx.t('poof.sum.topCategoryBudget', { ...values, percent: formatPercent(round1(top.cents / period.budgetCents * 100)) })
        : ctx.t('poof.sum.topCategory', { ...values, percent: formatPercent(top.percent) }), 'openWallet');
    }
    if (budget) {
      const line = budgetStatusLine(budget, ctx);
      add('money-budget', 'money', line.tone, line.text, 'openWallet');
    } else {
      add('money-no-budget', 'money', 'info', ctx.t('poof.sum.noBudget'), 'setBudget');
    }
  }

  const { planner } = facts;
  if (planner.overdue) add('planner-overdue', 'planner', 'attention', plural(ctx, planner.overdue, 'poof.sum.overdueOne', 'poof.sum.overdueMany'), 'openPlanner');
  if (planner.dueSoon) add('planner-soon', 'planner', 'info', plural(ctx, planner.dueSoon, 'poof.sum.dueSoonOne', 'poof.sum.dueSoonMany'), 'openPlanner');
  if (planner.active === 0) add('planner-empty', 'planner', 'info', ctx.t('poof.sum.noTasks'), 'addTask');
  else if (!planner.overdue && !planner.dueSoon && planner.next) {
    add('planner-next', 'planner', 'good', ctx.t('poof.sum.nextTask', { title: planner.next.title, when: formatWhen(planner.next.deadline, ctx) }), 'openPlanner');
  }

  const { academic } = facts;
  if (!academic.semesterSet || academic.subjects === 0) add('academic-setup', 'academic', 'info', ctx.t('poof.sum.noSemester'), 'mySemester');
  else if (academic.weeklyClasses === 0) add('academic-timetable', 'academic', 'info', plural(ctx, academic.subjects, 'poof.sum.noTimetableOne', 'poof.sum.noTimetableMany'), 'openTimetable');
  else if (academic.classesLeftToday.length) {
    const first = academic.classesLeftToday[0]!;
    add('academic-today', 'academic', 'info', plural(ctx, academic.classesLeftToday.length, 'poof.sum.classesTodayOne', 'poof.sum.classesTodayMany', { name: className(first), time: first.start }), 'openTimetable');
  } else if (academic.nextClass) {
    add('academic-next', 'academic', 'info', ctx.t('poof.sum.nextClass', { name: className(academic.nextClass), day: classDay(academic.nextClass, ctx), time: academic.nextClass.start }), 'openTimetable');
  }

  const { wellness } = facts;
  if (wellness.checkIns === 0) {
    add('wellbeing-checkin', 'wellbeing', 'info', wellness.daysSinceLastCheckIn === null
      ? ctx.t('poof.sum.noCheckIns')
      : plural(ctx, wellness.daysSinceLastCheckIn, 'poof.sum.staleCheckInOne', 'poof.sum.staleCheckInMany'), 'openMind');
  } else if (wellness.repeatedLowMood) {
    add('wellbeing-low', 'wellbeing', 'attention', ctx.t('poof.sum.lowMood'), 'openMind');
  } else if (wellness.highStress) {
    add('wellbeing-stress', 'wellbeing', 'attention', ctx.t('poof.sum.highStress', { stress: wellness.averageStress ?? 0 }), 'openMind');
  } else {
    add('wellbeing-ok', 'wellbeing', 'good', plural(ctx, wellness.checkIns, 'poof.sum.moodOkOne', 'poof.sum.moodOkMany', { mood: wellness.averageMood ?? 0 }), null);
  }

  if (!facts.profile.complete) add('profile', 'profile', 'info', ctx.t('poof.sum.profile'), 'completeProfile');
  return insights;
}

// ---------------------------------------------------------------------------
// Answers

/** `crisis` shows emergency contacts, `support` a gentle wellbeing note, `scope` the limits of what Poof can help with. */
export type PoofNotice = 'crisis' | 'support' | 'scope' | null;
export type PoofAnswer = { intent: PoofIntent; text: string; details: string[]; actions: PoofActionId[]; notice: PoofNotice };

const SHARE_HIGH = 40;
const SHARE_MEDIUM = 25;
const TOP_CATEGORY_TIP = 35;

export function answerQuestion(question: string, facts: PoofFacts, ctx: PoofContext): PoofAnswer {
  const { intent, category } = detectIntent(question);
  const { t } = ctx;
  const { week, month } = facts.finance;
  const { planner, academic, wellness } = facts;
  const parts: string[] = [];
  let details: string[] = [];
  let actions: PoofActionId[] = [];
  let notice: PoofNotice = null;
  const done = (): PoofAnswer => ({ intent, text: parts.join(' '), details, actions: actions.slice(0, MAX_POOF_ACTIONS), notice });
  const noExpenses = () => { parts.push(t('poof.ans.noExpenses')); actions = ['addExpense']; return done(); };
  const categoryLines = (period: SpendingPeriod) => period.categories.map((item) => t('poof.detail.category', {
    category: t(`expense.category.${item.category}` as TranslationKey), amount: formatMoney(item.cents), percent: formatPercent(item.percent),
  }));

  switch (intent) {
    case 'crisis':
      parts.push(t('poof.ans.crisis'));
      notice = 'crisis';
      return done();

    case 'wellbeing': {
      parts.push(t('poof.ans.wellAck'));
      if (wellness.checkIns === 0) parts.push(t('poof.ans.wellNoData'));
      else if (wellness.repeatedLowMood) parts.push(t('poof.ans.wellLow'));
      else if (wellness.highStress) parts.push(t('poof.ans.wellStress', { stress: wellness.averageStress ?? 0 }));
      else parts.push(plural(ctx, wellness.checkIns, 'poof.ans.wellOkOne', 'poof.ans.wellOkMany', { mood: wellness.averageMood ?? 0, stress: wellness.averageStress ?? 0 }));
      if (planner.dueSoon >= 3) parts.push(t('poof.ans.wellBusy', { count: planner.dueSoon }));
      parts.push(t('poof.ans.wellTip'));
      notice = 'support';
      actions = ['openMind'];
      return done();
    }

    case 'topSpending': {
      if (month.expenseCount === 0) return noExpenses();
      const top = month.categories[0]!;
      parts.push(t('poof.ans.topSpending', { category: categoryName(top.category, ctx), amount: formatMoney(top.cents), percent: formatPercent(top.percent), total: formatMoney(month.spentCents) }));
      details = categoryLines(month);
      actions = ['openWallet'];
      return done();
    }

    case 'categoryCheck': {
      if (month.expenseCount === 0) return noExpenses();
      const item = month.categories.find((value) => value.category === category);
      const name = categoryName(category!, ctx);
      if (!item) parts.push(t('poof.ans.categoryNone', { category: name }));
      else {
        parts.push(t('poof.ans.categoryShare', { category: name, amount: formatMoney(item.cents), percent: formatPercent(item.percent) }));
        parts.push(t(item.percent >= SHARE_HIGH ? 'poof.ans.shareHigh' : item.percent >= SHARE_MEDIUM ? 'poof.ans.shareMedium' : 'poof.ans.shareLow', { category: name }));
        if (month.budgetCents) parts.push(t('poof.ans.categoryOfBudget', { percent: formatPercent(round1(item.cents / month.budgetCents * 100)) }));
      }
      details = categoryLines(month);
      actions = ['openWallet'];
      return done();
    }

    case 'canSpend': {
      const budget = activeBudget(facts);
      const categoryPart = (period: SpendingPeriod, words: BudgetWords) => {
        if (!category) return;
        const spent = period.categories.find((value) => value.category === category)?.cents ?? 0;
        parts.push(t('poof.ans.categorySoFar', { amount: formatMoney(spent), category: categoryName(category, ctx), thisPeriod: words.thisPeriod }));
      };
      if (!budget) {
        parts.push(t('poof.ans.canSpendNoBudget'));
        categoryPart(week, budgetWords('week', ctx));
        actions = ['setBudget', 'openWallet'];
        return done();
      }
      const words = budgetWords(budget.kind, ctx);
      const remaining = budget.period.remainingCents ?? 0;
      if (remaining < 0) {
        parts.push(t('poof.ans.canSpendOver', { amount: formatMoney(-remaining), ...words }));
        categoryPart(budget.period, words);
      } else {
        const perDay = Math.floor(remaining / Math.max(1, budget.period.daysLeft));
        parts.push(t('poof.ans.canSpendLeft', { remaining: formatMoney(remaining), days: daysPhrase(budget.period.daysLeft, ctx), perDay: formatMoney(perDay), ...words }));
        categoryPart(budget.period, words);
        parts.push(t((budget.period.percentUsed ?? 0) >= NEAR_BUDGET_PERCENT ? 'poof.ans.canSpendTight' : 'poof.ans.canSpendOk'));
      }
      actions = ['openWallet'];
      return done();
    }

    case 'improveBudget': {
      const budget = activeBudget(facts);
      const tips: string[] = [];
      if (!budget) tips.push(t('poof.tip.setBudget'));
      if (month.expenseCount === 0) tips.push(t('poof.tip.logExpenses'));
      else {
        const top = month.categories[0]!;
        if (top.percent >= TOP_CATEGORY_TIP) tips.push(t('poof.tip.topCategory', { category: categoryName(top.category, ctx), percent: formatPercent(top.percent) }));
      }
      if (budget && (budget.period.remainingCents ?? 0) < 0) tips.push(t('poof.tip.over', budgetWords(budget.kind, ctx)));
      else if (budget) tips.push(t('poof.tip.pace', { perDay: formatMoney(Math.floor((budget.period.remainingCents ?? 0) / Math.max(1, budget.period.daysLeft))) }));
      tips.push(t('poof.tip.weekly'));
      parts.push(t('poof.ans.improveIntro'));
      details = tips.slice(0, 3);
      actions = budget ? ['openWallet'] : ['setBudget', 'openWallet'];
      return done();
    }

    case 'budgetStatus': {
      if (month.expenseCount === 0 && week.expenseCount === 0) return noExpenses();
      parts.push(plural(ctx, month.expenseCount, 'poof.ans.spentMonthOne', 'poof.ans.spentMonthMany', { amount: formatMoney(month.spentCents) }));
      const budget = activeBudget(facts);
      if (budget) parts.push(budgetStatusLine(budget, ctx).text);
      else parts.push(t('poof.sum.noBudget'));
      details = [t('poof.detail.week', { amount: formatMoney(week.spentCents) }), t('poof.detail.month', { amount: formatMoney(month.spentCents) })];
      actions = budget ? ['openWallet'] : ['setBudget', 'openWallet'];
      return done();
    }

    case 'overdue':
      if (planner.overdue === 0) {
        parts.push(t('poof.ans.noOverdue'));
        if (planner.next) parts.push(t('poof.ans.nextUp', { title: planner.next.title, when: formatWhen(planner.next.deadline, ctx) }));
      } else {
        parts.push(plural(ctx, planner.overdue, 'poof.ans.overdueOne', 'poof.ans.overdueMany'));
        parts.push(t('poof.ans.overdueTip'));
        details = planner.overdueTasks.map((task) => taskLine(task, ctx, true));
      }
      actions = ['openPlanner'];
      return done();

    case 'nextDeadline':
      if (!planner.next) {
        parts.push(t(planner.overdue ? 'poof.ans.noUpcomingOverdue' : 'poof.ans.noUpcoming'));
        details = planner.overdueTasks.map((task) => taskLine(task, ctx, true));
        actions = planner.active ? ['openPlanner'] : ['addTask'];
        return done();
      }
      parts.push(t('poof.ans.nextDeadline', { title: planner.next.title, subject: planner.next.subject, when: formatWhen(planner.next.deadline, ctx) }));
      if (planner.dueSoon > 1) parts.push(plural(ctx, planner.dueSoon - 1, 'poof.ans.alsoDueOne', 'poof.ans.alsoDueMany'));
      parts.push(t('poof.ans.deadlineTip'));
      details = planner.upcomingTasks.slice(0, 3).map((task) => taskLine(task, ctx, false));
      actions = ['openPlanner'];
      return done();

    case 'prioritise': {
      if (planner.active === 0) {
        parts.push(t('poof.ans.noTasks'));
        actions = ['addTask'];
      } else {
        const overdue = planner.overdueTasks[0];
        const first = overdue ?? planner.upcomingTasks[0] ?? planner.next;
        if (overdue) parts.push(t('poof.ans.startOverdue', { title: overdue.title }));
        else if (first) parts.push(t('poof.ans.startNext', { title: first.title, when: formatWhen(first.deadline, ctx) }));
        details = [
          ...planner.overdueTasks.map((task) => taskLine(task, ctx, true)),
          ...planner.upcomingTasks.map((task) => taskLine(task, ctx, false)),
        ].slice(0, 4);
        actions = ['openPlanner'];
      }
      if (academic.classesLeftToday.length) parts.push(plural(ctx, academic.classesLeftToday.length, 'poof.ans.classesTooOne', 'poof.ans.classesTooMany'));
      if (wellness.repeatedLowMood || wellness.highStress) parts.push(t('poof.ans.goGently'));
      return done();
    }

    case 'classes':
      if (!academic.semesterSet || academic.subjects === 0) {
        parts.push(t('poof.ans.noSemester'));
        actions = ['mySemester'];
        return done();
      }
      if (academic.weeklyClasses === 0) {
        parts.push(plural(ctx, academic.subjects, 'poof.sum.noTimetableOne', 'poof.sum.noTimetableMany'));
        actions = ['openTimetable'];
        return done();
      }
      if (academic.classesLeftToday.length) {
        parts.push(plural(ctx, academic.classesLeftToday.length, 'poof.ans.classesTodayOne', 'poof.ans.classesTodayMany'));
        details = academic.classesLeftToday.map((item) => classLine(item, ctx));
      } else if (academic.nextClass) {
        parts.push(t('poof.sum.nextClass', { name: className(academic.nextClass), day: classDay(academic.nextClass, ctx), time: academic.nextClass.start }));
        details = [classLine(academic.nextClass, ctx)];
      }
      parts.push(t('poof.ans.semesterCount', { subjects: academic.subjects, classes: academic.weeklyClasses }));
      actions = ['openTimetable'];
      return done();

    case 'profile':
      parts.push(t(facts.profile.complete ? 'poof.ans.profileOk' : 'poof.ans.profileMissing'));
      details = facts.profile.missing.map((gap) => t(`poof.profileGap.${gap}` as TranslationKey));
      actions = facts.profile.complete ? [] : ['completeProfile'];
      return done();

    case 'greeting':
      parts.push(t('poof.ans.hello'));
      return done();

    case 'help':
      parts.push(t('poof.ans.help'));
      details = [t('poof.help.money'), t('poof.help.planner'), t('poof.help.academic'), t('poof.help.wellbeing')];
      return done();

    case 'general':
      parts.push(t('poof.ans.unknown'));
      notice = 'scope';
      return done();
  }
}
