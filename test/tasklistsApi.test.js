const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./harness');

function load() {
  return loadGas(['src/errors.js', 'src/validation.js', 'src/tasklistsApi.js'], {});
}

test('listTasklists は items を DTO 配列に変換する', () => {
  const ctx = load();
  const svc = {
    Tasklists: {
      list: () => ({ items: [{ id: 'a', title: 'マイタスク', updated: 't', extra: 'x' }] })
    }
  };
  assert.deepEqual(ctx.listTasklists(svc, {}), [{ id: 'a', title: 'マイタスク', updated: 't' }]);
});

test('listTasklists は items 無しで空配列を返す', () => {
  const ctx = load();
  const svc = { Tasklists: { list: () => ({}) } };
  assert.deepEqual(ctx.listTasklists(svc, {}), []);
});

test('listTasklists は nextPageToken を辿って全ページを集約する', () => {
  const ctx = load();
  const pages = [
    { items: [{ id: 'a', title: 'マイタスク', updated: 't1' }], nextPageToken: 'p2' },
    { items: [{ id: 'b', title: '買い物', updated: 't2' }] }
  ];
  const seenOptions = [];
  let call = 0;
  const svc = {
    Tasklists: {
      list: (options) => {
        seenOptions.push(options);
        return pages[call++];
      }
    }
  };
  const result = ctx.listTasklists(svc, {});
  assert.deepEqual(result, [
    { id: 'a', title: 'マイタスク', updated: 't1' },
    { id: 'b', title: '買い物', updated: 't2' }
  ]);
  assert.deepEqual(seenOptions, [{ maxResults: 100 }, { maxResults: 100, pageToken: 'p2' }]);
});

test('createTasklist は title を渡して DTO を返す', () => {
  const ctx = load();
  let received = null;
  const svc = {
    Tasklists: {
      insert: (resource) => { received = resource; return { id: 'n', title: resource.title, updated: 't' }; }
    }
  };
  const result = ctx.createTasklist(svc, { title: '買い物' });
  assert.deepEqual(received, { title: '買い物' });
  assert.deepEqual(result, { id: 'n', title: '買い物', updated: 't' });
});

test('createTasklist は title 欠落で VALIDATION を投げる', () => {
  const ctx = load();
  const svc = { Tasklists: { insert: () => ({}) } };
  assert.throws(() => ctx.createTasklist(svc, {}), (e) => e.code === 'VALIDATION');
});

test('updateTasklist は patch に resource と id を渡す', () => {
  const ctx = load();
  const calls = [];
  const svc = {
    Tasklists: {
      patch: (resource, id) => { calls.push([resource, id]); return { id: id, title: resource.title, updated: 't' }; }
    }
  };
  const result = ctx.updateTasklist(svc, { tasklistId: 'a', title: '新名称' });
  assert.deepEqual(calls, [[{ title: '新名称' }, 'a']]);
  assert.deepEqual(result, { id: 'a', title: '新名称', updated: 't' });
});

test('deleteTasklist は remove を呼び deleted を返す', () => {
  const ctx = load();
  let removed = null;
  const svc = { Tasklists: { remove: (id) => { removed = id; } } };
  const result = ctx.deleteTasklist(svc, { tasklistId: 'a' });
  assert.strictEqual(removed, 'a');
  assert.deepEqual(result, { deleted: true, tasklistId: 'a' });
});

test('getTasklist は get を呼び DTO を返す', () => {
  const ctx = load();
  const svc = { Tasklists: { get: (id) => ({ id: id, title: 'T', updated: 't' }) } };
  assert.deepEqual(ctx.getTasklist(svc, { tasklistId: 'a' }), { id: 'a', title: 'T', updated: 't' });
});
