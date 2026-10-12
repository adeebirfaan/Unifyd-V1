/**
 * Smart expense category suggestion: a small, explainable Multinomial Naive Bayes text classifier.
 *
 * It learns only from one student's own saved expense titles and confirmed categories, is rebuilt in
 * memory for every request, and is never stored. It is a suggestion aid: the student always chooses.
 * No LLM, Groq, remote model, or merchant/category keyword table is involved.
 */
export const EXPENSE_CATEGORIES = ['food', 'transport', 'academic_materials', 'personal', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type LabelledExpense = { title: string; category: ExpenseCategory };

/** Safety thresholds: no suggestion is offered unless every one is met. */
export const MIN_TRAINING_EXPENSES = 15;
export const MIN_CATEGORIES = 2;
export const MIN_CONFIDENCE = 0.7;
export const MIN_MARGIN = 0.15;
/** Only the latest labelled expenses are used, keeping training small and current. */
export const MAX_TRAINING_EXPENSES = 500;
/** Laplace (add-one) smoothing, so an unseen word in a category never zeroes its probability. */
export const SMOOTHING = 1;
export const MAX_TITLE_LENGTH = 120;

// Linking words that carry no category meaning in English or Malay titles. Not a category mapping.
const STOP_WORDS = new Set(['and', 'the', 'for', 'from', 'with', 'dan', 'di', 'ke', 'ya', 'yang', 'untuk', 'dari', 'to', 'at', 'of', 'in', 'on']);

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/** Lowercase, strip accents, turn punctuation into spaces, and collapse whitespace. Deterministic. */
export function normaliseTitle(title: string): string {
  return title.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Words of a title: at least 2 characters, not purely digits (amounts, codes), and not a linking word. */
export function tokenise(title: string): string[] {
  return normaliseTitle(title).split(' ').filter((token) => token.length >= 2 && !/^\d+$/.test(token) && !STOP_WORDS.has(token));
}

export type NaiveBayesModel = {
  categories: ExpenseCategory[];
  /** log P(category): how often the student used each category. */
  logPrior: Map<ExpenseCategory, number>;
  /** Word counts per category, and the total words seen in each category. */
  wordCounts: Map<ExpenseCategory, Map<string, number>>;
  totalWords: Map<ExpenseCategory, number>;
  vocabulary: Set<string>;
  trainingCount: number;
};

export function trainNaiveBayes(examples: readonly LabelledExpense[]): NaiveBayesModel {
  const docCounts = new Map<ExpenseCategory, number>();
  const wordCounts = new Map<ExpenseCategory, Map<string, number>>();
  const totalWords = new Map<ExpenseCategory, number>();
  const vocabulary = new Set<string>();
  for (const { title, category } of examples) {
    docCounts.set(category, (docCounts.get(category) ?? 0) + 1);
    const counts = wordCounts.get(category) ?? new Map<string, number>();
    for (const token of tokenise(title)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
      totalWords.set(category, (totalWords.get(category) ?? 0) + 1);
      vocabulary.add(token);
    }
    wordCounts.set(category, counts);
  }
  // Fixed category order keeps every calculation, tie-break, and test deterministic.
  const categories = EXPENSE_CATEGORIES.filter((category) => docCounts.has(category));
  const logPrior = new Map(categories.map((category) => [category, Math.log(docCounts.get(category)! / examples.length)]));
  return { categories, logPrior, wordCounts, totalWords, vocabulary, trainingCount: examples.length };
}

export type CategoryScore = { category: ExpenseCategory; probability: number };

/**
 * Posterior P(category | title) for each trained category, highest first.
 * log P(c | words) ∝ log P(c) + Σ count(w) · log((n(w, c) + α) / (N(c) + α·|V|)), normalised with softmax.
 * Words never seen in training are ignored; `knownTokens` counts the ones that were used.
 */
export function predictNaiveBayes(model: NaiveBayesModel, title: string): { scores: CategoryScore[]; knownTokens: number } {
  const tokens = tokenise(title).filter((token) => model.vocabulary.has(token));
  const vocabularySize = model.vocabulary.size;
  const logScores = model.categories.map((category) => {
    const counts = model.wordCounts.get(category)!;
    const denominator = (model.totalWords.get(category) ?? 0) + SMOOTHING * vocabularySize;
    let score = model.logPrior.get(category)!;
    for (const token of tokens) score += Math.log(((counts.get(token) ?? 0) + SMOOTHING) / denominator);
    return score;
  });
  const max = Math.max(...logScores);
  const exps = logScores.map((score) => Math.exp(score - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const scores = model.categories.map((category, index) => ({ category, probability: exps[index]! / sum }))
    .sort((a, b) => b.probability - a.probability);
  return { scores, knownTokens: tokens.length };
}

export type CategorySuggestion =
  | { available: true; category: ExpenseCategory; confidence: number; trainingExpenseCount: number }
  | { available: false; reason: 'not_enough_data' | 'low_confidence'; trainingExpenseCount: number };

/**
 * Trains on the student's labelled history and suggests a category only when it is safe to:
 * at least 15 expenses across at least 2 categories, a known word in the title (so the answer is not
 * just the student's most common category), confidence ≥ 0.70, and a lead of ≥ 0.15 over second place.
 */
export function suggestCategory(history: readonly LabelledExpense[], title: string): CategorySuggestion {
  const examples = history.filter((row) => isExpenseCategory(row.category) && typeof row.title === 'string' && tokenise(row.title).length > 0)
    .slice(0, MAX_TRAINING_EXPENSES);
  const trainingExpenseCount = examples.length;
  const model = trainNaiveBayes(examples);
  if (trainingExpenseCount < MIN_TRAINING_EXPENSES || model.categories.length < MIN_CATEGORIES) {
    return { available: false, reason: 'not_enough_data', trainingExpenseCount };
  }
  const { scores, knownTokens } = predictNaiveBayes(model, title);
  const [top, second] = scores;
  if (!top || !knownTokens || top.probability < MIN_CONFIDENCE || top.probability - (second?.probability ?? 0) < MIN_MARGIN) {
    return { available: false, reason: 'low_confidence', trainingExpenseCount };
  }
  return { available: true, category: top.category, confidence: Math.round(top.probability * 100) / 100, trainingExpenseCount };
}

// ---------------------------------------------------------------------------
// Evaluation (thesis support). Pure and deterministic; run only on fixtures or
// data the evaluator is entitled to use, never automatically on real users' data.
// ---------------------------------------------------------------------------

export type ClassMetrics = { precision: number; recall: number; f1: number; support: number };
export type EvaluationReport = {
  trainCount: number;
  testCount: number;
  accuracy: number;
  macroF1: number;
  perCategory: Record<ExpenseCategory, ClassMetrics>;
  /** confusion[actual][predicted] counts. A test title is skipped only when the model has no categories. */
  confusion: Record<ExpenseCategory, Record<ExpenseCategory, number>>;
};

/** Deterministic split: every k-th example (by position) is held out for testing. */
export function holdOutSplit<T>(examples: readonly T[], everyKth = 5): { train: T[]; test: T[] } {
  const train: T[] = [];
  const test: T[] = [];
  examples.forEach((example, index) => ((index + 1) % everyKth === 0 ? test : train).push(example));
  return { train, test };
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

/** Trains on `train`, predicts the top category for each `test` title (thresholds not applied), and scores it. */
export function evaluateClassifier(train: readonly LabelledExpense[], test: readonly LabelledExpense[]): EvaluationReport {
  const model = trainNaiveBayes(train);
  const zeroRow = () => Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category, 0])) as Record<ExpenseCategory, number>;
  const confusion = Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category, zeroRow()])) as EvaluationReport['confusion'];
  let correct = 0;
  for (const example of test) {
    const predicted = predictNaiveBayes(model, example.title).scores[0]?.category ?? null;
    if (predicted) confusion[example.category][predicted] += 1;
    if (predicted === example.category) correct += 1;
  }
  const perCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((category) => {
    const truePositive = confusion[category][category];
    const predictedTotal = EXPENSE_CATEGORIES.reduce((sum, actual) => sum + confusion[actual][category], 0);
    const support = test.filter((example) => example.category === category).length;
    const precision = ratio(truePositive, predictedTotal);
    const recall = ratio(truePositive, support);
    return [category, { precision, recall, f1: ratio(2 * precision * recall, precision + recall), support }];
  })) as Record<ExpenseCategory, ClassMetrics>;
  const present = EXPENSE_CATEGORIES.filter((category) => perCategory[category].support > 0);
  const macroF1 = ratio(present.reduce((sum, category) => sum + perCategory[category].f1, 0), present.length);
  return { trainCount: train.length, testCount: test.length, accuracy: ratio(correct, test.length), macroF1, perCategory, confusion };
}
