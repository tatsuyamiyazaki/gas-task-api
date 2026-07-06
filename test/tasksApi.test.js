const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./harness');

function load() {
  return loadGas(['src/errors.js', 'src/validation.js', 'src/tasksApi.js'], {});
}

test('listTasks は tasklistId とオプションを渡し DTO 配列を返す', () => {
  const ctx = load();
  const calls = [];
  const svc = {
    Tasks: {
      list: (tasklistId, options) => {
        calls.push([tasklistId, options]);
        return { items: [{ id: 't1', title: 'A', status: 'needsAction', due: '2026-07-10T00:00:00.000Z' }] };
      }
    }
  };
  const result = ctx.listTasks(svc, { tasklistId: '@default', showCompleted: true });
  assert.deepEqual(calls, [['@default', { maxResults: 100, showCompleted: true }]]);
  assert.strictEqual(result[0].due, '2026-07-10');
  assert.strictEqual(result[0].title, 'A');
});

test('listTasks は nextPageToken を辿って全ページを集約する', () => {
  const ctx = load();
  const pages = [
    { items: [{ id: 't1', title: 'A' }], nextPageToken: 'p2' },
    { items: [{ id: 't2', title: 'B' }] }
  ];
  const seenTokens = [];
  let call = 0;
  const svc = {
    Tasks: {
      list: (tasklistId, options) => {
        seenTokens.push(options.pageToken);
        return pages[call++];
      }
    }
  };
  const result = ctx.listTasks(svc, { tasklistId: '@default' });
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].id, 't1');
  assert.strictEqual(result[1].id, 't2');
  assert.deepEqual(seenTokens, [undefined, 'p2']);
});

test('listTasks は tasklistId 欠落で VALIDATION を投げる', () => {
  const ctx = load();
  const svc = { Tasks: { list: () => ({}) } };
  assert.throws(() => ctx.listTasks(svc, {}), (e) => e.code === 'VALIDATION');
});

test('createTask は due を変換し parent をオプションで渡す', () => {
  const ctx = load();
  let captured = null;
  const svc = {
    Tasks: {
      insert: (resource, tasklistId, options) => {
        captured = { resource: resource, tasklistId: tasklistId, options: options };
        return { id: 'new', title: resource.title, status: 'needsAction', due: resource.due };
      }
    }
  };
  const result = ctx.createTask(svc, { tasklistId: '@default', title: '牛乳', due: '2026-07-10', parent: 'p1' });
  assert.deepEqual(captured.resource, { title: '牛乳', due: '2026-07-10T00:00:00.000Z' });
  assert.strictEqual(captured.tasklistId, '@default');
  assert.deepEqual(captured.options, { parent: 'p1' });
  assert.strictEqual(result.due, '2026-07-10');
});

test('createTask は parent 無しで空オプションを渡す', () => {
  const ctx = load();
  let options = null;
  const svc = {
    Tasks: { insert: (resource, tasklistId, opt) => { options = opt; return { id: 'n', title: resource.title }; } }
  };
  ctx.createTask(svc, { tasklistId: '@default', title: 'x' });
  assert.deepEqual(options, {});
});

test('createTask は title 欠落で VALIDATION を投げる', () => {
  const ctx = load();
  const svc = { Tasks: { insert: () => ({}) } };
  assert.throws(() => ctx.createTask(svc, { tasklistId: '@default' }), (e) => e.code === 'VALIDATION');
});

test('updateTask は指定フィールドのみで patch する', () => {
  const ctx = load();
  let captured = null;
  const svc = {
    Tasks: {
      patch: (resource, tasklistId, taskId) => {
        captured = { resource: resource, tasklistId: tasklistId, taskId: taskId };
        return { id: taskId, title: resource.title, status: 'completed' };
      }
    }
  };
  ctx.updateTask(svc, { tasklistId: '@default', taskId: 't1', status: 'completed' });
  assert.deepEqual(captured.resource, { status: 'completed' });
  assert.strictEqual(captured.taskId, 't1');
});

test('updateTask は不正 status で VALIDATION を投げる', () => {
  const ctx = load();
  const svc = { Tasks: { patch: () => ({}) } };
  assert.throws(() => ctx.updateTask(svc, { tasklistId: '@default', taskId: 't1', status: 'done' }), (e) => e.code === 'VALIDATION');
});

test('deleteTask は remove を呼び deleted を返す', () => {
  const ctx = load();
  const calls = [];
  const svc = { Tasks: { remove: (tasklistId, taskId) => calls.push([tasklistId, taskId]) } };
  const result = ctx.deleteTask(svc, { tasklistId: '@default', taskId: 't1' });
  assert.deepStrictEqual(calls, [['@default', 't1']]);
  assert.deepEqual(result, { deleted: true, taskId: 't1' });
});

test('moveTask は parent と previous をオプションで渡す', () => {
  const ctx = load();
  let captured = null;
  const svc = {
    Tasks: {
      move: (tasklistId, taskId, options) => {
        captured = { tasklistId: tasklistId, taskId: taskId, options: options };
        return { id: taskId, title: 'A', parent: options.parent };
      }
    }
  };
  ctx.moveTask(svc, { tasklistId: '@default', taskId: 't1', parent: 'p1', previous: 't0' });
  assert.deepEqual(captured.options, { parent: 'p1', previous: 't0' });
});
