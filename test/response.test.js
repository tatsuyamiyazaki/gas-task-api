const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./harness');

test('ok は success エンベロープで data を包む', () => {
  const ctx = loadGas(['src/response.js'], {});
  // vm コンテキストが返すオブジェクトは Node のメインレルムとは異なる
  // Object.prototype を持つため、deepStrictEqual ではプロトタイプ不一致で
  // 失敗する。構造比較のみで十分なため deepEqual を使う。
  assert.deepEqual(ctx.ok({ id: '1' }), { success: true, data: { id: '1' } });
});

test('fail は code と message を error に包む', () => {
  const ctx = loadGas(['src/response.js'], {});
  assert.deepEqual(
    ctx.fail('VALIDATION', 'bad'),
    { success: false, error: { code: 'VALIDATION', message: 'bad' } }
  );
});
