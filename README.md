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
