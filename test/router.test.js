const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./harness');

const SRC = [
  'src/response.js',
  'src/errors.js',
  'src/validation.js',
  'src/tasklistsApi.js',
  'src/tasksApi.js',
  'src/router.js'
];

test('handleRequest は不明な action で UNKNOWN_ACTION を返す', () => {
  const ctx = loadGas(SRC, {});
  const result = ctx.handleRequest({}, { action: 'noSuchThing' });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error.code, 'UNKNOWN_ACTION');
});

test('handleRequest は action 欠落で VALIDATION を返す', () => {
  const ctx = loadGas(SRC, {});
  const result = ctx.handleRequest({}, {});
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error.code, 'VALIDATION');
});

test('handleRequest は検証エラーを fail に変換する', () => {
  const ctx = loadGas(SRC, {});
  const svc = { Tasks: { insert: () => ({}) } };
  const result = ctx.handleRequest(svc, { action: 'createTask', tasklistId: '@default' });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error.code, 'VALIDATION');
});

test('handleRequest は成功時に ok エンベロープを返す', () => {
  const ctx = loadGas(SRC, {});
  const svc = { Tasks: { insert: (resource) => ({ id: 'n', title: resource.title, status: 'needsAction' }) } };
  const result = ctx.handleRequest(svc, { action: 'createTask', tasklistId: '@default', title: '牛乳' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.title, '牛乳');
});

test('handleRequest は予期しない例外を INTERNAL に変換する', () => {
  const ctx = loadGas(SRC, {});
  const svc = { Tasklists: { list: () => { throw new Error('boom'); } } };
  const result = ctx.handleRequest(svc, { action: 'listTasklists' });
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error.code, 'INTERNAL');
  assert.strictEqual(result.error.message, 'boom');
});

test('doPost は JSON を解析し ContentService の出力を返す', () => {
  const captured = {};
  const ContentService = {
    createTextOutput: (s) => {
      captured.text = s;
      return { setMimeType: function (m) { captured.mime = m; return this; } };
    },
    MimeType: { JSON: 'application/json' }
  };
  const Tasks = { Tasklists: { list: () => ({ items: [{ id: 'a', title: 'マイタスク' }] }) } };
  const ctx = loadGas(SRC, { ContentService: ContentService, Tasks: Tasks });
  ctx.doPost({ postData: { contents: JSON.stringify({ action: 'listTasklists' }) } });
  const body = JSON.parse(captured.text);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data[0].title, 'マイタスク');
  assert.strictEqual(captured.mime, 'application/json');
});

test('doPost は不正 JSON で VALIDATION を返す', () => {
  const captured = {};
  const ContentService = {
    createTextOutput: (s) => { captured.text = s; return { setMimeType: function () { return this; } }; },
    MimeType: { JSON: 'application/json' }
  };
  const ctx = loadGas(SRC, { ContentService: ContentService, Tasks: {} });
  ctx.doPost({ postData: { contents: '{ not json' } });
  const body = JSON.parse(captured.text);
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, 'VALIDATION');
});
