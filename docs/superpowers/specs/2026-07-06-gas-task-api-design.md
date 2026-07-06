# Googleタスク CRUD API (GAS) 設計書

- 日付: 2026-07-06
- 対象: Google Apps Script (V8), Tasks Advanced Service (v1)
- ステータス: 承認済み（実装計画へ）

## 1. 目的

Googleタスクのタスクおよびタスクリストを、外部からHTTP経由でCRUD操作できるAPIを
GAS Webアプリとして提供する。

## 2. 決定事項サマリー

| 項目 | 決定 |
|---|---|
| 呼び出し方式 | Web API (HTTP) |
| 認証 | Google認証（Webアプリのアクセス制御に委譲） |
| 許可範囲 | 自分のアカウントのみ（デプロイ: 実行=自分 / アクセス=自分のみ） |
| タスクリスト | リストもAPIで操作（一覧/取得/作成/更新/削除） |
| インターフェース | actionパラメータ方式（全てPOST + JSONボディ） |
| 対応フィールド | title / notes / due / status / parent すべて対応 |

## 3. アーキテクチャ

GASのWebアプリとして `doPost` を単一エンドポイントに公開。全リクエストは
POST + JSONボディ + `action` 指定で操作を振り分ける。バックエンドは
有効化済みの Tasks Advanced Service (v1) を利用する。

- デプロイ設定: 実行=自分 / アクセス=自分のみ。Googleが認証を担保するため、
  GAS内での追加の認証チェック（トークン照合や許可メールリスト）は不要。
- HTTPメソッド制約: GAS Webアプリは GET / POST のみ受信可能。PUT/PATCH/DELETE は
  使えないため、操作は `action` 文字列で表現する。

### ファイル構成

GASは全ファイルが同一名前空間にフラット化されるが、責務ごとにファイルを分割する。

| ファイル | 責務 |
|---|---|
| `Router.gs` | `doPost`、action振り分け、全体のtry/catch |
| `TasksApi.gs` | タスクの各操作 |
| `TasklistsApi.gs` | タスクリストの各操作 |
| `Response.gs` | レスポンス整形（共通envelope） |
| `Validation.gs` | 入力検証 |
| `Tests.gs` | エディタ実行用のテスト関数 |

## 4. API仕様（action一覧）

### タスクリスト操作

| action | 必須パラメータ | 内容 | 使用API |
|---|---|---|---|
| `listTasklists` | – | タスクリスト一覧取得 | `Tasks.Tasklists.list` |
| `getTasklist` | `tasklistId` | 1件取得 | `Tasks.Tasklists.get` |
| `createTasklist` | `title` | 作成 | `Tasks.Tasklists.insert` |
| `updateTasklist` | `tasklistId`, `title` | タイトル変更 | `Tasks.Tasklists.patch` |
| `deleteTasklist` | `tasklistId` | 削除 | `Tasks.Tasklists.remove` |

### タスク操作

| action | 必須 | 任意 | 内容 | 使用API |
|---|---|---|---|---|
| `listTasks` | `tasklistId` | `showCompleted`, `showHidden` | 一覧取得 | `Tasks.Tasks.list` |
| `getTask` | `tasklistId`, `taskId` | – | 1件取得 | `Tasks.Tasks.get` |
| `createTask` | `tasklistId`, `title` | `notes`, `due`, `status`, `parent` | 作成 | `Tasks.Tasks.insert` |
| `updateTask` | `tasklistId`, `taskId` | `title`, `notes`, `due`, `status` | 部分更新 | `Tasks.Tasks.patch` |
| `deleteTask` | `tasklistId`, `taskId` | – | 削除 | `Tasks.Tasks.remove` |
| `moveTask` | `tasklistId`, `taskId` | `parent`, `previous` | 親変更・並び替え | `Tasks.Tasks.move` |

### 補足仕様

- `tasklistId` は `@default`（マイタスク）を指定可能。
- `due` は `YYYY-MM-DD` 形式で受け取り、内部でRFC3339（例: `2026-07-10T00:00:00.000Z`）へ
  変換する。Googleタスクは日付のみ保持し時刻は無視されるため、レスポンスでも日付部分を返す。
- `status` は `needsAction`（未完了） / `completed`（完了）。
- 既存タスクの親変更（サブタスク化）は仕様上 `Tasks.Tasks.patch` では行えず
  `Tasks.Tasks.move` が必要なため、`moveTask` を独立アクションとして分離する。
  作成時の親指定は `createTask` の `parent`（insertのオプション引数）で対応する。

## 5. リクエスト / レスポンス形式

### リクエスト

```
POST /exec
Authorization: Bearer <OAuthアクセストークン>
Content-Type: application/json

{ "action": "createTask", "tasklistId": "@default", "title": "牛乳を買う", "due": "2026-07-10" }
```

### レスポンス（共通envelope, ContentService の JSON）

```json
// 成功
{ "success": true, "data": { "id": "...", "title": "牛乳を買う", "due": "2026-07-10", "status": "needsAction" } }
```

```json
// 失敗
{ "success": false, "error": { "code": "VALIDATION", "message": "title は必須です" } }
```

GAS Webアプリは常にHTTPステータス200を返すため、成否は必ずボディの `success` で判定する。

## 6. エラーハンドリング

- `Router.gs` で全体を try/catch し、例外は必ずenvelopeの `success:false` に変換する
  （スタックトレースを外部に漏らさない）。
- `Validation.gs` で必須パラメータと値域を事前チェックし、不備は `VALIDATION` エラーを返す。
- 不明な `action` は `UNKNOWN_ACTION` エラーを返す。
- エラーコード（初期案）: `VALIDATION` / `UNKNOWN_ACTION` / `NOT_FOUND` / `INTERNAL`。

## 7. テスト

GASはローカルテストランナーが無いため、`Tests.gs` にエディタから実行できる関数を用意する。

- スモークテスト: 一時タスクリストを作成 → タスクを create → get → update → delete →
  タスクリスト delete、の一連を実行し結果をログ検証する。
- `doPost` 模擬ヘルパー: JSONオブジェクトを渡して各actionを直接叩けるようにし、
  ルーティングとバリデーションを検証する。

## 8. スコープ外（YAGNI）

- 共有トークン認証、許可メールアドレスリスト（アクセス=自分のみのため不要）。
- バッチ操作、ページネーションの独自ラッパー（必要になったら追加）。
- `due` の時刻対応（Googleタスクが非対応のため）。
