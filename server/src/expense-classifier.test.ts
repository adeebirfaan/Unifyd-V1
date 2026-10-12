import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_CONFIDENCE, MIN_MARGIN, MIN_TRAINING_EXPENSES, evaluateClassifier, holdOutSplit,
  normaliseTitle, predictNaiveBayes, suggestCategory, tokenise, trainNaiveBayes,
} from './expense-classifier.js';
import type { LabelledExpense } from './expense-classifier.js';

// Fictional labelled expenses for automated tests only. Never inserted into any database.
const history: LabelledExpense[] = [
  ['KFC Gambang', 'food'], ['Nasi lemak kafe', 'food'], ['Mamak roti canai', 'food'], ['Grab Food nasi ayam', 'food'],
  ['KFC dinner', 'food'], ['Kopi kafe kampus', 'food'], ['Nasi ayam kafe', 'food'], ['McDonald lunch', 'food'],
  ['Grab to campus', 'transport'], ['Bas kampus', 'transport'], ['Grab to Kuantan', 'transport'], ['Petrol motor', 'transport'],
  ['Touch n Go reload', 'transport'], ['Grab ride home', 'transport'],
  ['Buku rujukan', 'academic_materials'], ['Print assignment', 'academic_materials'], ['Fotostat nota kuliah', 'academic_materials'],
  ['Shopee order', 'personal'], ['Shopee baju', 'personal'], ['Haircut', 'personal'],
].map(([title, category]) => ({ title: title!, category: category as LabelledExpense['category'] }));

test('normalisation lowercases, strips accents and punctuation, and collapses whitespace', () => {
  assert.equal(normaliseTitle('  KFC—Gambang!!  (Café)  '), 'kfc gambang cafe');
  assert.equal(normaliseTitle('Touch\'n Go   RM10.50'), 'touch n go rm10 50');
  assert.equal(normaliseTitle(''), '');
});

test('tokens drop 1-character noise, pure numbers, and linking words in English and Malay', () => {
  assert.deepEqual(tokenise('Grab to campus'), ['grab', 'campus']);
  assert.deepEqual(tokenise('Nasi lemak dan teh ais di kafe 2 x 10'), ['nasi', 'lemak', 'teh', 'ais', 'kafe']);
  assert.deepEqual(tokenise('   ...  '), []);
});

test('training counts priors and words per category', () => {
  const model = trainNaiveBayes(history);
  assert.deepEqual(model.categories, ['food', 'transport', 'academic_materials', 'personal']);
  assert.equal(model.trainingCount, history.length);
  assert.ok(Math.abs(Math.exp(model.logPrior.get('food')!) - 8 / 20) < 1e-12);
  assert.equal(model.wordCounts.get('transport')!.get('grab'), 3);
  assert.equal(model.wordCounts.get('food')!.get('grab'), 1);
  assert.ok(model.vocabulary.has('shopee'));
});

test('probabilities sum to 1 and clear titles predict their category', () => {
  const model = trainNaiveBayes(history);
  const { scores } = predictNaiveBayes(model, 'KFC Kuantan');
  assert.ok(Math.abs(scores.reduce((sum, score) => sum + score.probability, 0) - 1) < 1e-9);
  assert.equal(scores[0]!.category, 'food');
  assert.equal(predictNaiveBayes(model, 'Grab to UMPSA campus').scores[0]!.category, 'transport');
  assert.equal(predictNaiveBayes(model, 'Shopee kasut').scores[0]!.category, 'personal');
});

test('an eligible, confident title returns one suggestion with its model score', () => {
  const result = suggestCategory(history, 'KFC Gambang lunch');
  assert.equal(result.available, true);
  if (!result.available) return;
  assert.equal(result.category, 'food');
  assert.ok(result.confidence >= MIN_CONFIDENCE && result.confidence <= 1);
  assert.equal(result.trainingExpenseCount, history.length);
});

test('fewer than 15 labelled expenses is not enough data', () => {
  const small = history.slice(0, MIN_TRAINING_EXPENSES - 1);
  assert.deepEqual(suggestCategory(small, 'KFC Gambang'), { available: false, reason: 'not_enough_data', trainingExpenseCount: 14 });
  // Titles with no usable words do not count as training examples.
  const padded = [...small, { title: '!!', category: 'food' as const }];
  assert.equal(suggestCategory(padded, 'KFC').available, false);
});

test('a single category is not enough data, however many expenses there are', () => {
  const foodOnly = Array.from({ length: 30 }, (_, i) => ({ title: `Kafe meal ${String.fromCharCode(97 + (i % 26))}x`, category: 'food' as const }));
  assert.deepEqual(suggestCategory(foodOnly, 'Kafe meal'), { available: false, reason: 'not_enough_data', trainingExpenseCount: 30 });
});

test('unknown words, weak confidence, or a narrow lead return low_confidence, never a guess', () => {
  // No title word was ever seen: the answer would only echo the most common category.
  assert.deepEqual(suggestCategory(history, 'Zxqv blorp'), { available: false, reason: 'low_confidence', trainingExpenseCount: 20 });
  // "Grab" appears in both food and transport titles, so the lead is too small to offer a suggestion.
  const result = suggestCategory(history, 'Grab');
  const { scores } = predictNaiveBayes(trainNaiveBayes(history), 'Grab');
  const tooWeak = scores[0]!.probability < MIN_CONFIDENCE || scores[0]!.probability - scores[1]!.probability < MIN_MARGIN;
  assert.equal(tooWeak, true);
  assert.equal(result.available, false);
});

test('only title and category are used: extra fields such as notes or OCR text have no effect', () => {
  const withPrivateFields = history.map((row) => ({ ...row, notes: 'Shopee Shopee Shopee', rawText: 'TOTAL RM 99 KFC', userId: 'someone-else' }));
  assert.deepEqual(suggestCategory(withPrivateFields as LabelledExpense[], 'Shopee order'), suggestCategory(history, 'Shopee order'));
  assert.deepEqual(trainNaiveBayes(withPrivateFields as LabelledExpense[]).vocabulary, trainNaiveBayes(history).vocabulary);
});

test('only the latest 500 labelled expenses are used for training', () => {
  const many = Array.from({ length: 620 }, (_, i) => ({ title: i % 2 ? 'Grab ride' : 'Kafe meal', category: (i % 2 ? 'transport' : 'food') as LabelledExpense['category'] }));
  const result = suggestCategory(many, 'Grab ride');
  assert.equal(result.trainingExpenseCount, 500);
});

test('evaluation is deterministic and reports accuracy, precision, recall, F1, and a confusion matrix', () => {
  // Hand-checkable: vocabulary {kfc, meal, lunch, grab, ride, bus}, 4 words per class, add-one smoothing,
  // so P(kfc|food) = 3/10, P(grab|transport) = 2/10, and unseen-in-class words get 1/10.
  const train: LabelledExpense[] = [
    { title: 'kfc meal', category: 'food' }, { title: 'kfc lunch', category: 'food' },
    { title: 'grab ride', category: 'transport' }, { title: 'bus ride', category: 'transport' },
  ];
  const heldOut: LabelledExpense[] = [
    { title: 'kfc dinner', category: 'food' },          // → food ✓ ("dinner" is unseen and ignored)
    { title: 'grab trip', category: 'transport' },      // → transport ✓
    { title: 'grab kfc kfc', category: 'transport' },   // → food ✗ (0.009 vs 0.002)
    { title: 'kfc box', category: 'personal' },         // → food ✗ (personal was never trained)
  ];
  const report = evaluateClassifier(train, heldOut);
  assert.deepEqual(report, evaluateClassifier(train, heldOut));
  assert.equal(report.trainCount, 4);
  assert.equal(report.testCount, 4);
  assert.equal(report.accuracy, 0.5);
  assert.deepEqual(report.confusion.food, { food: 1, transport: 0, academic_materials: 0, personal: 0, other: 0 });
  assert.deepEqual(report.confusion.transport, { food: 1, transport: 1, academic_materials: 0, personal: 0, other: 0 });
  assert.deepEqual(report.confusion.personal, { food: 1, transport: 0, academic_materials: 0, personal: 0, other: 0 });
  const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);
  close(report.perCategory.food.precision, 1 / 3); close(report.perCategory.food.recall, 1); close(report.perCategory.food.f1, 0.5);
  close(report.perCategory.transport.precision, 1); close(report.perCategory.transport.recall, 0.5); close(report.perCategory.transport.f1, 2 / 3);
  close(report.perCategory.personal.precision, 0); close(report.perCategory.personal.recall, 0); close(report.perCategory.personal.f1, 0);
  assert.equal(report.perCategory.other.support, 0);
  // Macro F1 averages only categories present in the test set.
  close(report.macroF1, (0.5 + 2 / 3 + 0) / 3);
});

test('a fixed hold-out split of the fictional history gives a reproducible score', () => {
  const { train, test: heldOut } = holdOutSplit(history, 5);
  assert.equal(train.length, 16);
  assert.equal(heldOut.length, 4);
  const first = evaluateClassifier(train, heldOut);
  assert.deepEqual(first, evaluateClassifier(train, heldOut));
  // Held-out titles here mostly use words never seen in training, so the score is low (a known limitation of small
  // personal histories); the point is that the split and metrics are reproducible.
  assert.ok(first.accuracy >= 0 && first.accuracy <= 1);
});
