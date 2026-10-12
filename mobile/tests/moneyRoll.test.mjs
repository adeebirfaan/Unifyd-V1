import assert from 'node:assert/strict';
import test from 'node:test';

import { amountDigits, rollColumns } from '../lib/moneyRoll.ts';

test('amounts keep two decimals, thousands separators, and a leading minus', () => {
  assert.equal(amountDigits(0), '0.00');
  assert.equal(amountDigits(12550), '125.50');
  assert.equal(amountDigits(123456789), '1,234,567.89');
  assert.equal(amountDigits(-500), '-5.00');
});

test('columns always match the target length and end on the target text', () => {
  for (const [from, to] of [['0.00', '1,234.50'], ['1,234.50', '5.00'], ['9.99', '10.00'], ['125.50', '125.50'], ['-5.00', '5.00']]) {
    const columns = rollColumns(from, to, true);
    assert.equal(columns.length, to.length);
    assert.equal(columns.map((column) => column.at(-1)).join(''), to);
  }
});

test('digits roll through the digits in between, upwards when rising and downwards when falling', () => {
  assert.deepEqual(rollColumns('0.00', '0.30', true)[2], ['0', '1', '2', '3']);
  assert.deepEqual(rollColumns('0.80', '0.30', false)[2], ['8', '7', '6', '5', '4', '3']);
  // Rising from 9 wraps to 0 in one step, like an odometer.
  assert.deepEqual(rollColumns('9.99', '10.00', true), [[' ', '1'], ['9', '0'], ['.'], ['9', '0'], ['9', '0']]);
});

test('unchanged characters and separators stay static; new leading positions appear from blank', () => {
  const columns = rollColumns('999.00', '1,000.00', true);
  assert.deepEqual(columns[0], [' ', '1']);
  assert.deepEqual(columns[1], [' ', ',']);
  assert.deepEqual(columns.slice(-3), [['.'], ['0'], ['0']]);
  assert.ok(rollColumns('125.50', '125.50', true).every((column) => column.length === 1));
});
