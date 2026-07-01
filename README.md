# 日報システム（旭建設株式会社）

GAS（Google Apps Script）版の日報システムを Cloudflare Pages + Pages Functions（Workers）+ D1 + R2 に移行したものです。

## 構成
- `public/` … フロントエンド（各画面を実ファイルとして分割。通常のページ遷移のためブラウザバックが標準で使えます）
- `functions/api/[[path]].js` … APIルーター（Cloudflare Pages Functions = Workers）
- `functions/_lib/` … APIロジック（認証・各日報CRUD・ユーザー管理など）
- `schema.sql` … D1のテーブル定義
- `scripts/migrate.mjs` … `日報システム.xlsx` の内容をD1投入用SQLに変換するスクリプト

## 初回セットアップ
```bash
npm install

# D1データベース作成（初回のみ）→ 出力されたdatabase_idをwrangler.tomlに反映
npx wrangler d1 create nippo-db

# スキーマ投入
npx wrangler d1 execute nippo-db --remote --file=schema.sql

# Excelデータ移行
node scripts/migrate.mjs
npx wrangler d1 execute nippo-db --remote --file=migration.sql

# R2バケット作成（事前にCloudflareダッシュボードでR2を有効化してください）
npx wrangler r2 bucket create nippo-genba-images
```

## デプロイ
本番URL: https://asahi-nippo.pages.dev
（旧URL https://nippo-b6f.pages.dev も同じD1/R2を参照する別プロジェクトとして残しています）

```bash
npx wrangler pages deploy public --project-name=asahi-nippo --branch=main
```

## ローカル開発
```bash
npx wrangler pages dev public
```

## 認証
パスワードはPBKDF2-SHA256でハッシュ化してD1に保存しています。ログイン時はHttpOnly Cookieのセッショントークンで認証します（`sessions`テーブル）。

## 注意事項
- 現場管理日報の画像はCloudflare R2に保存されます（元のExcelには画像本体は含まれていないため、移行直後は画像なしの状態です。今後の入力分から新システムに保存されます）。
- 出勤簿・運転日報・管理者レビュー画面の表編集は、矢印キーでの上下移動に対応した簡易スプレッドシート入力です（元のGAS版にあったドラッグ入力・クリップボード貼り付け・Undoは含まれていません）。
