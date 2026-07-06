# gas-task-api

Google Apps Script で提供する Google タスクの CRUD API。
単一の `doPost` エンドポイントに対し、POST + JSONボディの `action` で操作を振り分ける RPC スタイルの Web API。

## セットアップ

1. `clasp push` でソース（`src/`）と `appsscript.json` をGASへ反映。
2. Apps Script エディタで `smokeTest` を実行し、Tasks サービスの権限（`https://www.googleapis.com/auth/tasks`）を承認・動作確認。
3. **デプロイ > 新しいデプロイ > ウェブアプリ**
   - 実行するユーザー: **自分**（`executeAs: USER_DEPLOYING`）
   - アクセスできるユーザー: **全員**（`access: ANYONE_ANONYMOUS`）
4. 発行された `/exec` URL をエンドポイントとして使用。

> `appsscript.json` に `webapp` セクションを定義済みのため、実行ユーザー / アクセス範囲は上記が既定値になる。
> `clasp push` 後に**新しいデプロイの作成（またはデプロイの更新）**をしないと設定は反映されない。

## 認証とセキュリティ

このAPIは **`ANYONE_ANONYMOUS`（認証不要で全員公開）** でデプロイされている。
呼び出しに `Authorization` ヘッダーは**不要**。

- **URL が実質的な鍵**。`/exec` URL を知っている人は、デプロイしたユーザー本人の権限で
  Google タスクを読み・作成・更新・削除できる（`executeAs: USER_DEPLOYING` のため）。
- アクセスできるのは **Google タスクのみ**（OAuth スコープは `tasks` だけ）。
  メール・ドライブ等のアカウント全体には一切アクセスできない。
- 通信は HTTPS で暗号化される。
- **URL を公開・共有しないこと。** 漏洩が疑われる場合は再デプロイして URL をローテーションする。

## リクエスト

すべて **POST + JSONボディ**。`action` で操作を指定する。

```
POST /exec
Content-Type: application/json

{ "action": "createTask", "tasklistId": "@default", "title": "牛乳を買う", "due": "2026-07-10" }
```

レスポンスは常に HTTP 200。成否はボディの `success` で判定する。

```json
{ "success": true,  "data": { "id": "...", "title": "牛乳を買う", "due": "2026-07-10T00:00:00.000Z", "status": "needsAction" } }
{ "success": false, "error": { "code": "VALIDATION", "message": "title は必須です" } }
```

## curl での呼び出し

GAS の `/exec` は 302 で `script.googleusercontent.com` にリダイレクトして結果を返す。
正しく叩くには以下の 2 点に注意する。

- **`-L`（リダイレクト追従）が必須。** 付けないと 302 の本文しか返らない。
- **`-X POST` は付けない。** 付けるとリダイレクト後も POST が強制され、
  ボディが失われて `HTTP 411 (Length Required)` になる。`-d` があれば curl は自動で POST する。

```bash
EXEC_URL="https://script.google.com/.../exec"   # 発行された /exec URL

# タスクリスト一覧
curl -sS -L "$EXEC_URL" \
  -H "Content-Type: application/json" \
  -d '{"action":"listTasklists"}'

# タスク作成
curl -sS -L "$EXEC_URL" \
  -H "Content-Type: application/json" \
  -d '{"action":"createTask","tasklistId":"@default","title":"牛乳を買う","due":"2026-07-10"}'
```

## スマホのショートカット（iOS ショートカット / Android）からの利用

「URL の内容を取得」アクションを次の設定で使う。

- **URL**: 発行された `/exec` URL
- **方法（Method）**: `POST`
- **ヘッダ**: `Content-Type` = `application/json`
- **本文（Request Body）**: `JSON`（または「テキスト」で下記 JSON を貼り付け）

```json
{ "action": "createTask", "tasklistId": "@default", "title": "牛乳を買う" }
```

レスポンスの `success` / `data` を後続アクションで参照して結果を表示・通知できる。
リダイレクトはショートカット側が自動追従するため、curl のような追加設定は不要。

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

- `tasklistId` は `@default`（マイタスク）を指定可能。
- `due` はリクエスト時 `YYYY-MM-DD`。レスポンスは RFC 3339（例 `2026-07-10T00:00:00.000Z`）。
- `status` は `needsAction`（未完了）/ `completed`（完了）。

## 開発

```bash
npm test   # node --test（追加依存なし）
```

`src/` の各 API 関数は `Tasks` Advanced Service を引数 `svc` として受け取る純粋関数として実装されており、
Node の `vm` で GAS グローバルを再現してモックを注入し、追加依存なしで単体テストできる。
