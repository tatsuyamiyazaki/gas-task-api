# Googleタスク CRUD API 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GoogleタスクのタスクリストとタスクをHTTP経由でCRUD操作できるGAS Webアプリを、ローカルでTDDしながら実装する。

**Architecture:** GAS Webアプリの `doPost` を単一エンドポイントとし、POST + JSONボディの `action` で操作を振り分ける。各API関数は `Tasks` Advanced Service を引数 `svc` として受け取る純粋関数にし、`doPost` のみが実グローバル `Tasks` を注入する。これによりNodeの `vm` でGASのグローバル名前空間を再現し、モックを注入して `node --test` で単体テストできる。

**Tech Stack:** Google Apps Script (V8), Tasks Advanced Service (v1), clasp, Node.js 組み込みテストランナー（`node:test` / `node:assert`、追加依存なし）。

## Global Constraints

- ランタイム: V8 / タイムゾーン: Asia/Tokyo（`appsscript.json` は既存）。
- Tasks Advanced Service (v1) は `appsscript.json` で有効化済み（`userSymbol: "Tasks"`）。
- HTTPメソッドは GET / POST のみ。操作は `action` 文字列で表現する。
- 認証はデプロイ設定（実行=自分 / アクセス=自分のみ）に委譲。GAS内での追加認証チェックは実装しない。
- レスポンスは常にHTTP 200。成否はボディの `success` フィールドで表す。
- `due` は入力 `YYYY-MM-DD` を RFC3339（`YYYY-MM-DDT00:00:00.000Z`）へ変換。出力は日付部分のみ返す。
- `status` は `needsAction` / `completed` のみ許可。
- 例外は必ず envelope の `success:false` に変換し、スタックトレースを外部へ出さない。
- エラーコード: `VALIDATION` / `UNKNOWN_ACTION` / `INTERNAL`。
- ソースコードは `src/*.js`。`test/` `docs/` `package.json` は `.claspignore` でpush対象外。
- コミットはconventional commits形式。

## ファイル構成

| ファイル | 責務 |
|---|---|
| `src/response.js` | 共通レスポンス envelope（`ok` / `fail`） |
| `src/errors.js` | `ApiError` コンストラクタと `assert` |
| `src/validation.js` | 入力検証（`requireFields` / `parseDue` / `formatDue` / `validateStatus`） |
| `src/tasklistsApi.js` | タスクリスト操作と DTO 変換 |
| `src/tasksApi.js` | タスク操作、リソース構築、DTO 変換 |
| `src/router.js` | `handleRequest` 振り分け、`doPost`、`jsonOutput`（GASエントリ） |
| `src/tests.js` | エディタ実行用スモークテスト（GAS上でのみ動作） |
| `test/harness.js` | `vm` でGASグローバルを再現しモック注入するテスト土台 |
| `test/*.test.js` | 各モジュールの単体テスト |
| `package.json` | `npm test` = `node --test` |
| `.claspignore` | 非ソースをpush対象外に |
| `README.md` | デプロイ手順 |

---

### Task 1: テスト土台とレスポンス envelope

**Files:**
- Create: `package.json`
- Create: `test/harness.js`
- Create: `src/response.js`
- Test: `test/response.test.js`

**Interfaces:**
- Consumes: なし
- Produces:
  - `loadGas(files: string[], mocks: object): vm.Context` — 指定した相対パスのソースを順にvmコンテキストへ読み込み、コンテキスト（グローバル関数群を保持）を返す。
  - `ok(data): { success: true, data }`
  - `fail(code: string, message: string): { success: false, error: { code, message } }`

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "gas-task-api",
  "version": "1.0.0",
  "private": true,
  "description": "Google Tasks CRUD API on Google Apps Script",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: テスト土台 test/harness.js を作成**

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * GASのグローバル名前空間を vm コンテキストで再現する。
 * @param {string[]} files プロジェクトルートからの相対パス（読み込み順）
 * @param {object} mocks コンテキストに注入するグローバル（Tasks, ContentService 等）
 * @returns {object} 読み込み済みグローバルを持つ vm コンテキスト
 */
function loadGas(files, mocks) {
  const sandbox = Object.assign({ console }, mocks || {});
  const context = vm.createContext(sandbox);
  for (const file of files) {
    const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  }
  return context;
}

module.exports = { loadGas };
```

- [ ] **Step 3: 失敗するテスト test/response.test.js を作成**

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./harness');

test('ok は success エンベロープで data を包む', () => {
  const ctx = loadGas(['src/response.js'], {});
  assert.deepStrictEqual(ctx.ok({ id: '1' }), { success: true, data: { id: '1' } });
});

test('fail は code と message を error に包む', () => {
  const ctx = loadGas(['src/response.js'], {});
  assert.deepStrictEqual(
    ctx.fail('VALIDATION', 'bad'),
    { success: false, error: { code: 'VALIDATION', message: 'bad' } }
  );
});
```

- [ ] **Step 4: テストを実行して失敗を確認**

Run: `node --test test/response.test.js`
Expected: FAIL（`src/response.js` が存在せず読み込みエラー）

- [ ] **Step 5: src/response.js を実装**

```js
function ok(data) {
  return { success: true, data: data };
}

function fail(code, message) {
  return { success: false, error: { code: code, message: message } };
}
```

- [ ] **Step 6: テストを実行して成功を確認**

Run: `node --test test/response.test.js`
Expected: PASS（2件）

- [ ] **Step 7: コミット**

```bash
git add package.json test/harness.js test/response.test.js src/response.js
git commit -m "feat: テスト土台とレスポンスエンベロープを追加"
```

---

### Task 2: エラー型と入力検証

**Files:**
- Create: `src/errors.js`
- Create: `src/validation.js`
- Test: `test/validation.test.js`

**Interfaces:**
- Consumes: なし（グローバル関数として定義）
- Produces:
  - `ApiError(code: string, message: string)` — `isApiError: true`, `code`, `message` を持つコンストラクタ。
  - `assert(condition, code, message)` — 偽なら `ApiError` を throw。
  - `requireFields(params: object, fields: string[])` — 欠落フィールドで `VALIDATION` を throw。
  - `parseDue(dateStr: string): string` — `YYYY-MM-DD` を RFC3339 へ変換。不正で `VALIDATION` を throw。
  - `formatDue(rfc3339: string): string|undefined` — 先頭10文字（日付）を返す。falsyなら `undefined`。
  - `validateStatus(status: string): string` — `needsAction`/`completed` のみ許可、それ以外は `VALIDATION`。

- [ ] **Step 1: 失敗するテスト test/validation.test.js を作成**

```js
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/validation.test.js`
Expected: FAIL（`src/errors.js` 未作成で読み込みエラー）

- [ ] **Step 3: src/errors.js を実装**

```js
function ApiError(code, message) {
  this.name = 'ApiError';
  this.isApiError = true;
  this.code = code;
  this.message = message;
}

function assert(condition, code, message) {
  if (!condition) {
    throw new ApiError(code, message);
  }
}
```

- [ ] **Step 4: src/validation.js を実装**

```js
function requireFields(params, fields) {
  fields.forEach(function (field) {
    var value = params ? params[field] : undefined;
    assert(value !== undefined && value !== null && value !== '', 'VALIDATION', field + ' は必須です');
  });
}

function parseDue(dateStr) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(dateStr), 'VALIDATION', 'due は YYYY-MM-DD 形式で指定してください');
  return dateStr + 'T00:00:00.000Z';
}

function formatDue(rfc3339) {
  if (!rfc3339) {
    return undefined;
  }
  return String(rfc3339).slice(0, 10);
}

function validateStatus(status) {
  assert(status === 'needsAction' || status === 'completed', 'VALIDATION', 'status は needsAction か completed を指定してください');
  return status;
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `node --test test/validation.test.js`
Expected: PASS（9件）

- [ ] **Step 6: コミット**

```bash
git add src/errors.js src/validation.js test/validation.test.js
git commit -m "feat: エラー型と入力検証ユーティリティを追加"
```

---

### Task 3: タスクリスト操作

**Files:**
- Create: `src/tasklistsApi.js`
- Test: `test/tasklistsApi.test.js`

**Interfaces:**
- Consumes: `requireFields`（Task 2）
- Produces（すべて第1引数 `svc` に Tasks サービスを受け取る）:
  - `listTasklists(svc, params): object[]`
  - `getTasklist(svc, params): object`
  - `createTasklist(svc, params): object`
  - `updateTasklist(svc, params): object`
  - `deleteTasklist(svc, params): { deleted: true, tasklistId }`
  - `toTasklistDto(tl): { id, title, updated }`

- [ ] **Step 1: 失敗するテスト test/tasklistsApi.test.js を作成**

```js
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
  assert.deepStrictEqual(ctx.listTasklists(svc, {}), [{ id: 'a', title: 'マイタスク', updated: 't' }]);
});

test('listTasklists は items 無しで空配列を返す', () => {
  const ctx = load();
  const svc = { Tasklists: { list: () => ({}) } };
  assert.deepStrictEqual(ctx.listTasklists(svc, {}), []);
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
  assert.deepStrictEqual(received, { title: '買い物' });
  assert.deepStrictEqual(result, { id: 'n', title: '買い物', updated: 't' });
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
  assert.deepStrictEqual(calls, [[{ title: '新名称' }, 'a']]);
  assert.deepStrictEqual(result, { id: 'a', title: '新名称', updated: 't' });
});

test('deleteTasklist は remove を呼び deleted を返す', () => {
  const ctx = load();
  let removed = null;
  const svc = { Tasklists: { remove: (id) => { removed = id; } } };
  const result = ctx.deleteTasklist(svc, { tasklistId: 'a' });
  assert.strictEqual(removed, 'a');
  assert.deepStrictEqual(result, { deleted: true, tasklistId: 'a' });
});

test('getTasklist は get を呼び DTO を返す', () => {
  const ctx = load();
  const svc = { Tasklists: { get: (id) => ({ id: id, title: 'T', updated: 't' }) } };
  assert.deepStrictEqual(ctx.getTasklist(svc, { tasklistId: 'a' }), { id: 'a', title: 'T', updated: 't' });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/tasklistsApi.test.js`
Expected: FAIL（`src/tasklistsApi.js` 未作成）

- [ ] **Step 3: src/tasklistsApi.js を実装**

```js
function listTasklists(svc, params) {
  var res = svc.Tasklists.list();
  return (res.items || []).map(toTasklistDto);
}

function getTasklist(svc, params) {
  requireFields(params, ['tasklistId']);
  return toTasklistDto(svc.Tasklists.get(params.tasklistId));
}

function createTasklist(svc, params) {
  requireFields(params, ['title']);
  return toTasklistDto(svc.Tasklists.insert({ title: params.title }));
}

function updateTasklist(svc, params) {
  requireFields(params, ['tasklistId', 'title']);
  return toTasklistDto(svc.Tasklists.patch({ title: params.title }, params.tasklistId));
}

function deleteTasklist(svc, params) {
  requireFields(params, ['tasklistId']);
  svc.Tasklists.remove(params.tasklistId);
  return { deleted: true, tasklistId: params.tasklistId };
}

function toTasklistDto(tl) {
  return { id: tl.id, title: tl.title, updated: tl.updated };
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/tasklistsApi.test.js`
Expected: PASS（7件）

- [ ] **Step 5: コミット**

```bash
git add src/tasklistsApi.js test/tasklistsApi.test.js
git commit -m "feat: タスクリストのCRUD操作を追加"
```

---

### Task 4: タスク操作

**Files:**
- Create: `src/tasksApi.js`
- Test: `test/tasksApi.test.js`

**Interfaces:**
- Consumes: `requireFields`, `parseDue`, `formatDue`, `validateStatus`（Task 2）
- Produces（すべて第1引数 `svc`）:
  - `listTasks(svc, params): object[]`
  - `getTask(svc, params): object`
  - `createTask(svc, params): object`
  - `updateTask(svc, params): object`
  - `deleteTask(svc, params): { deleted: true, taskId }`
  - `moveTask(svc, params): object`
  - `buildTaskResource(params): object` — 指定されたフィールドのみ含むリソース。`due` は変換、`status` は検証。
  - `toTaskDto(task): { id, title, notes, status, due, parent, position, updated }`

Google Tasks Advanced Service のシグネチャ:
- `svc.Tasks.list(tasklistId, optionalArgs)`
- `svc.Tasks.get(tasklistId, taskId)`
- `svc.Tasks.insert(resource, tasklistId, optionalArgs)`
- `svc.Tasks.patch(resource, tasklistId, taskId)`
- `svc.Tasks.remove(tasklistId, taskId)`
- `svc.Tasks.move(tasklistId, taskId, optionalArgs)`

- [ ] **Step 1: 失敗するテスト test/tasksApi.test.js を作成**

```js
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
  assert.deepStrictEqual(calls, [['@default', { showCompleted: true }]]);
  assert.strictEqual(result[0].due, '2026-07-10');
  assert.strictEqual(result[0].title, 'A');
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
  assert.deepStrictEqual(captured.resource, { title: '牛乳', due: '2026-07-10T00:00:00.000Z' });
  assert.strictEqual(captured.tasklistId, '@default');
  assert.deepStrictEqual(captured.options, { parent: 'p1' });
  assert.strictEqual(result.due, '2026-07-10');
});

test('createTask は parent 無しで空オプションを渡す', () => {
  const ctx = load();
  let options = null;
  const svc = {
    Tasks: { insert: (resource, tasklistId, opt) => { options = opt; return { id: 'n', title: resource.title }; } }
  };
  ctx.createTask(svc, { tasklistId: '@default', title: 'x' });
  assert.deepStrictEqual(options, {});
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
  assert.deepStrictEqual(captured.resource, { status: 'completed' });
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
  assert.deepStrictEqual(result, { deleted: true, taskId: 't1' });
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
  assert.deepStrictEqual(captured.options, { parent: 'p1', previous: 't0' });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/tasksApi.test.js`
Expected: FAIL（`src/tasksApi.js` 未作成）

- [ ] **Step 3: src/tasksApi.js を実装**

```js
function listTasks(svc, params) {
  requireFields(params, ['tasklistId']);
  var options = {};
  if (params.showCompleted !== undefined) {
    options.showCompleted = params.showCompleted;
  }
  if (params.showHidden !== undefined) {
    options.showHidden = params.showHidden;
  }
  var res = svc.Tasks.list(params.tasklistId, options);
  return (res.items || []).map(toTaskDto);
}

function getTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  return toTaskDto(svc.Tasks.get(params.tasklistId, params.taskId));
}

function createTask(svc, params) {
  requireFields(params, ['tasklistId', 'title']);
  var resource = buildTaskResource(params);
  var options = {};
  if (params.parent) {
    options.parent = params.parent;
  }
  return toTaskDto(svc.Tasks.insert(resource, params.tasklistId, options));
}

function updateTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  var resource = buildTaskResource(params);
  return toTaskDto(svc.Tasks.patch(resource, params.tasklistId, params.taskId));
}

function deleteTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  svc.Tasks.remove(params.tasklistId, params.taskId);
  return { deleted: true, taskId: params.taskId };
}

function moveTask(svc, params) {
  requireFields(params, ['tasklistId', 'taskId']);
  var options = {};
  if (params.parent) {
    options.parent = params.parent;
  }
  if (params.previous) {
    options.previous = params.previous;
  }
  return toTaskDto(svc.Tasks.move(params.tasklistId, params.taskId, options));
}

function buildTaskResource(params) {
  var resource = {};
  if (params.title !== undefined) {
    resource.title = params.title;
  }
  if (params.notes !== undefined) {
    resource.notes = params.notes;
  }
  if (params.due !== undefined) {
    resource.due = parseDue(params.due);
  }
  if (params.status !== undefined) {
    resource.status = validateStatus(params.status);
  }
  return resource;
}

function toTaskDto(task) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: task.status,
    due: formatDue(task.due),
    parent: task.parent,
    position: task.position,
    updated: task.updated
  };
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/tasksApi.test.js`
Expected: PASS（9件）

- [ ] **Step 5: コミット**

```bash
git add src/tasksApi.js test/tasksApi.test.js
git commit -m "feat: タスクのCRUD・移動操作を追加"
```

---

### Task 5: ルーターとGASエントリポイント

**Files:**
- Create: `src/router.js`
- Test: `test/router.test.js`

**Interfaces:**
- Consumes: `ok`, `fail`（Task 1）、`assert`, `ApiError`（Task 2）、`src/tasklistsApi.js` と `src/tasksApi.js` の全ハンドラ（Task 3, 4）
- Produces:
  - `handleRequest(svc, body): object` — `action` を振り分け、成功で `ok(data)`、`ApiError` で `fail(code,message)`、その他例外で `fail('INTERNAL', message)` を返す。
  - `parseBody(contents: string): object` — JSON解析。失敗で `ApiError('VALIDATION', ...)`。
  - `doPost(e): TextOutput` — GASエントリ。実グローバル `Tasks` を注入し `jsonOutput` で返す。
  - `jsonOutput(obj): TextOutput` — ContentServiceでJSON化。

- [ ] **Step 1: 失敗するテスト test/router.test.js を作成**

```js
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `node --test test/router.test.js`
Expected: FAIL（`src/router.js` 未作成）

- [ ] **Step 3: src/router.js を実装**

```js
var ACTIONS = {
  listTasklists: listTasklists,
  getTasklist: getTasklist,
  createTasklist: createTasklist,
  updateTasklist: updateTasklist,
  deleteTasklist: deleteTasklist,
  listTasks: listTasks,
  getTask: getTask,
  createTask: createTask,
  updateTask: updateTask,
  deleteTask: deleteTask,
  moveTask: moveTask
};

function handleRequest(svc, body) {
  try {
    assert(body && typeof body === 'object', 'VALIDATION', 'リクエストボディが不正です');
    assert(body.action, 'VALIDATION', 'action は必須です');
    var handler = ACTIONS[body.action];
    if (!handler) {
      throw new ApiError('UNKNOWN_ACTION', '不明な action です: ' + body.action);
    }
    return ok(handler(svc, body));
  } catch (err) {
    if (err && err.isApiError) {
      return fail(err.code, err.message);
    }
    return fail('INTERNAL', err && err.message ? err.message : String(err));
  }
}

function parseBody(contents) {
  try {
    return JSON.parse(contents);
  } catch (e) {
    throw new ApiError('VALIDATION', 'JSON の解析に失敗しました');
  }
}

function doPost(e) {
  var body;
  try {
    body = parseBody(e && e.postData ? e.postData.contents : '');
  } catch (err) {
    return jsonOutput(fail(err.code || 'VALIDATION', err.message));
  }
  return jsonOutput(handleRequest(Tasks, body));
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `node --test test/router.test.js`
Expected: PASS（7件）

- [ ] **Step 5: 全テストを実行して回帰を確認**

Run: `node --test`
Expected: PASS（全ファイル合計 34件）

- [ ] **Step 6: コミット**

```bash
git add src/router.js test/router.test.js
git commit -m "feat: リクエストルーターとdoPostエントリを追加"
```

---

### Task 6: GAS配線・clasp設定・スモークテスト・ドキュメント

このタスクはGASデプロイ用の配線と運用ドキュメントを整える。Nodeの新規単体テストは無いが、`node --test` が引き続き通ること、`.claspignore` が非ソースを除外することを確認して完了とする。

**Files:**
- Delete: `code.js`
- Create: `.claspignore`
- Create: `src/tests.js`
- Create: `README.md`

**Interfaces:**
- Consumes: `handleRequest`（Task 5）、`ok`/`fail`（Task 1）
- Produces: なし（エントリ配線とドキュメント）

- [ ] **Step 1: 旧 code.js を削除**

```bash
git rm --cached code.js 2>/dev/null || true
rm -f code.js
```

（`code.js` は未追跡のため `rm -f code.js` のみで可。空の `myFunction` を除去する。）

- [ ] **Step 2: .claspignore を作成（非ソースをpush対象外に）**

```
**/**
!appsscript.json
!src/**
```

- [ ] **Step 3: src/tests.js を作成（GASエディタ実行用スモークテスト）**

```js
/**
 * GASエディタから実行する手動スモークテスト。
 * 一時タスクリストを作り、タスクを create→get→update→delete し、
 * 最後にタスクリストを削除して結果をログ出力する。
 * 実行にはこのプロジェクトのTasks Advanced Serviceが有効である必要がある。
 */
function smokeTest() {
  var created = handleRequest(Tasks, { action: 'createTasklist', title: 'SMOKE_' + new Date().getTime() });
  Logger.log('createTasklist: ' + JSON.stringify(created));
  var tasklistId = created.data.id;

  try {
    var task = handleRequest(Tasks, {
      action: 'createTask',
      tasklistId: tasklistId,
      title: 'スモークタスク',
      notes: 'メモ',
      due: '2026-07-10'
    });
    Logger.log('createTask: ' + JSON.stringify(task));
    var taskId = task.data.id;

    Logger.log('getTask: ' + JSON.stringify(handleRequest(Tasks, { action: 'getTask', tasklistId: tasklistId, taskId: taskId })));

    Logger.log('updateTask: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'updateTask', tasklistId: tasklistId, taskId: taskId, status: 'completed'
    })));

    Logger.log('listTasks: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'listTasks', tasklistId: tasklistId, showCompleted: true
    })));

    Logger.log('deleteTask: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'deleteTask', tasklistId: tasklistId, taskId: taskId
    })));
  } finally {
    Logger.log('deleteTasklist: ' + JSON.stringify(handleRequest(Tasks, {
      action: 'deleteTasklist', tasklistId: tasklistId
    })));
  }
}
```

- [ ] **Step 4: README.md を作成（デプロイ・利用手順）**

````markdown
# gas-task-api

Google Apps Script で提供する Google タスクの CRUD API。

## セットアップ

1. `clasp push` でソース（`src/`）と `appsscript.json` をGASへ反映。
2. Apps Script エディタで `smokeTest` を実行し、Tasks サービスの権限を承認・動作確認。
3. **デプロイ > 新しいデプロイ > ウェブアプリ**
   - 実行するユーザー: 自分
   - アクセスできるユーザー: 自分のみ
4. 発行された `/exec` URL をエンドポイントとして使用。

## 認証

デプロイ設定「アクセス: 自分のみ」により、Googleが認証を担保する。
呼び出し時は `Authorization: Bearer <OAuthアクセストークン>` を付与する。

## リクエスト

すべて POST + JSONボディ。`action` で操作を指定する。

```
POST /exec
Authorization: Bearer <token>
Content-Type: application/json

{ "action": "createTask", "tasklistId": "@default", "title": "牛乳を買う", "due": "2026-07-10" }
```

レスポンスは常にHTTP 200。成否はボディの `success` で判定する。

```json
{ "success": true, "data": { "id": "...", "title": "牛乳を買う", "due": "2026-07-10", "status": "needsAction" } }
{ "success": false, "error": { "code": "VALIDATION", "message": "title は必須です" } }
```

## action 一覧

| action | 必須 | 任意 |
|---|---|---|
| listTasklists | – | – |
| getTasklist | tasklistId | – |
| createTasklist | title | – |
| updateTasklist | tasklistId, title | – |
| deleteTasklist | tasklistId | – |
| listTasks | tasklistId | showCompleted, showHidden |
| getTask | tasklistId, taskId | – |
| createTask | tasklistId, title | notes, due, status, parent |
| updateTask | tasklistId, taskId | title, notes, due, status |
| deleteTask | tasklistId, taskId | – |
| moveTask | tasklistId, taskId | parent, previous |

`tasklistId` は `@default`（マイタスク）を指定可能。`due` は `YYYY-MM-DD`。`status` は `needsAction` / `completed`。

## 開発

```bash
npm test   # node --test（追加依存なし）
```
````

- [ ] **Step 5: 全テストと除外設定を確認**

Run: `node --test`
Expected: PASS（全34件、`code.js` 削除後も回帰なし）

Run: `git status --short`
Expected: `code.js` が削除され、`.claspignore` / `src/tests.js` / `README.md` が新規表示される。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "chore: GAS配線・clasp設定・スモークテスト・READMEを追加"
```

---

## 完了後の確認（デプロイは手動）

- `clasp push` 実行後、Apps Scriptエディタで `smokeTest` を実行し全操作が成功することを確認。
- ウェブアプリとしてデプロイ（実行=自分 / アクセス=自分のみ）し、`/exec` にPOSTして疎通確認。
