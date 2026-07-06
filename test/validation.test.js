const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./harness');

function load() {
  return loadGas(['src/errors.js', 'src/validation.js'], {});
}

function isValidationError(err) {
  return err && err.isApiError === true && err.code === 'VALIDATION';
}

test('requireFields は欠落フィールドで VALIDATION を投げる', () => {
  const ctx = load();
  assert.throws(() => ctx.requireFields({ a: 1 }, ['a', 'b']), isValidationError);
});

test('requireFields は空文字を欠落として扱う', () => {
  const ctx = load();
  assert.throws(() => ctx.requireFields({ title: '' }, ['title']), isValidationError);
});

test('requireFields は全て揃っていれば投げない', () => {
  const ctx = load();
  assert.doesNotThrow(() => ctx.requireFields({ a: 1, b: 2 }, ['a', 'b']));
});

test('parseDue は YYYY-MM-DD を RFC3339 に変換する', () => {
  const ctx = load();
  assert.strictEqual(ctx.parseDue('2026-07-10'), '2026-07-10T00:00:00.000Z');
});

test('parseDue は不正な形式で VALIDATION を投げる', () => {
  const ctx = load();
  assert.throws(() => ctx.parseDue('2026/07/10'), isValidationError);
});

test('formatDue は日付部分だけを返す', () => {
  const ctx = load();
  assert.strictEqual(ctx.formatDue('2026-07-10T00:00:00.000Z'), '2026-07-10');
});

test('formatDue は falsy なら undefined を返す', () => {
  const ctx = load();
  assert.strictEqual(ctx.formatDue(undefined), undefined);
});

test('validateStatus は許可値をそのまま返す', () => {
  const ctx = load();
  assert.strictEqual(ctx.validateStatus('completed'), 'completed');
});

test('validateStatus は不正値で VALIDATION を投げる', () => {
  const ctx = load();
  assert.throws(() => ctx.validateStatus('done'), isValidationError);
});
