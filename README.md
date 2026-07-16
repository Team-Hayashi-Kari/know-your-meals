<div align="center">

# 🍚 Know Your Meals

**「あの店、美味しかったな」を、地図の上に残していく。**

友達と「食べたお店」を共有する、位置情報ベースのグルメ共有アプリ

[![React Native](https://img.shields.io/badge/React_Native-Expo-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![Hono](https://img.shields.io/badge/Hono-Cloudflare_Workers-E36002?style=flat-square&logo=cloudflare&logoColor=white)](https://hono.dev/)
[![Bun](https://img.shields.io/badge/Bun-1.x-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)
[![Biome](https://img.shields.io/badge/Biome-Lint%2FFormat-60A5FA?style=flat-square&logo=biome&logoColor=white)](https://biomejs.dev/)

</div>

---

## 📖 概要

`Know Your Meals` は、行ったお店の記録をマップ上にピンとして残し、友達(FF)と共有できるグルメSNSアプリです。
「どこで何を食べたか」を、テキストの羅列ではなく **地図という直感的なUI** の上に蓄積していくことを目指しています。

Web / iOS / Android、すべて同一コードベースで動作します。

---

## ✨ 機能

### MVP

- 📍 **投稿** — マップから店舗を検索 → 画像と情報を添えて投稿
- 🗺️ **マップ表示** — 投稿がピンとしてマップ上に表示される
- 🔖 **保存** — 気になる投稿をブックマーク
- 🔑 **ログイン / サインアップ** — Google認証のみ、初回は初期プロフィール作成
- 👤 **プロフィール** — 閲覧・編集
- 🤝 **FF機能** — フォロー / フォロワー
- 🌐 **Web対応** — ブラウザからもアクセス可能

### V2 (今後)

- 🏷️ タグ付け
- ❤️ ふぁぼ
- 📑 保存リストの一覧化

---

## 🛠️ 技術スタック

| レイヤー | 採用技術 |
|---|---|
| Frontend | [React Native](https://reactnative.dev/) ([Expo](https://expo.dev/)) — Web / iOS / Android |
| Backend | [Hono](https://hono.dev/) on [Cloudflare Workers](https://workers.cloudflare.com/) |
| Database | [Neon](https://neon.tech/) (PostgreSQL) + [Drizzle ORM](https://orm.drizzle.team/) |
| Auth | [better-auth](https://www.better-auth.com/) (Google OAuth) |
| Storage | Cloudflare R2 (Presigned URL方式) |
| Map / Places | Google Maps Platform |
| Monorepo | [Turborepo](https://turbo.build/) + [Bun Workspaces](https://bun.sh/docs/install/workspaces) |
| Lint / Format | [Biome](https://biomejs.dev/) |
| 型共有 | Hono RPC (`hc` client) |

---

## 📂 ディレクトリ構成

```
know-your-meals/
├── apps/
│   ├── mobile/          # Expo (React Native, Web対応込み)
│   └── api/             # Hono on Cloudflare Workers
├── packages/
│   ├── db/              # Drizzle schema, migrations, Neon client
│   ├── shared/          # zodスキーマ, 共通型
│   └── api-types/       # Hono RPCの型export用
├── turbo.json
├── biome.json
└── package.json
```

---

## 🚀 Getting Started

### 前提条件

以下がインストールされていることを確認してください。

- [Bun](https://bun.sh/) `1.x`
- [Google Cloud Console](https://console.cloud.google.com/) の OAuth クライアント(Web用・Native用)
- [Neon](https://neon.tech/) のプロジェクト(接続文字列)
- [Cloudflare](https://dash.cloudflare.com/) アカウント(R2バケット用)

### 1. リポジトリをクローン

```bash
git clone https://github.com/<your-org>/know-your-meals.git
cd know-your-meals
```

### 2. 依存関係のインストール

```bash
bun install
```

### 3. 環境変数の設定

`apps/api/.dev.vars` を作成し、以下を記入します(**絶対にコミットしないでください**)。

```bash
DATABASE_URL="postgresql://..."
GOOGLE_CLIENT_ID_WEB="..."
GOOGLE_CLIENT_ID_NATIVE="..."
GOOGLE_CLIENT_SECRET="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
```

### 4. データベースのマイグレーション

```bash
cd packages/db
bun run db:generate
bun run db:migrate
cd ../..
```

### 5. 開発サーバーの起動

ルートから両方(API / Mobile)を同時に起動できます。

```bash
bun run dev
```

個別に起動したい場合は以下です。

```bash
# バックエンドのみ
cd apps/api && bun run dev   # http://localhost:8787

# フロントエンドのみ
cd apps/mobile && bun run dev   # w でWeb / i でiOS / a でAndroid
```

---

## 📜 主なスクリプト

| コマンド | 内容 |
|---|---|
| `bun run dev` | API / Mobile を同時起動(Turborepo TUI) |
| `bun run build` | 全workspaceをビルド |
| `bun run typecheck` | 全workspaceの型チェック(`tsc --noEmit`) |
| `bun run lint` | Biomeによるlint |
| `bun run format` | Biomeによる自動フォーマット |
| `bun run check` | lint + format を一括チェック・修正 |

---

## 🌱 Staging環境

Cloudflare Workers (API) / Pages (Web) 上に、本番と分離したstaging環境を用意しています。

- **API**: `apps/api/wrangler.toml` の `[env.staging]` にデプロイされ、Worker名は自動的に `know-your-meals-api-staging` になります。R2バケット (`know-your-meals-images`) は本番と共用です。
- **Web**: 既存のPagesプロジェクト `know-your-meals` の `staging` ブランチとしてプレビューデプロイされます(`https://staging.know-your-meals.pages.dev`)。
- **DB**: Neonのstaging用ブランチを使用します(本番と分離)。

### デプロイ方法

GitHub Actionsの [`Deploy to Staging`](.github/workflows/staging.yml) ワークフローを **手動実行 (workflow_dispatch)** します。push等では自動デプロイされません。

### 事前準備 (初回のみ)

1. **Neonでstaging用ブランチを作成**し、その接続文字列を取得する。
2. GitHubリポジトリの Settings → Secrets and variables → Actions に以下を追加する。

   | 種別 | 名前 | 内容 |
   |---|---|---|
   | Secret | `DATABASE_URL_STAGING` | Neon staging ブランチの接続文字列 |
   | Secret | `BETTER_AUTH_SECRET_STAGING` | staging用のbetter-authシークレット(本番と別値を推奨) |
   | Secret | `BETTER_AUTH_URL_STAGING` | staging APIのURL(例: `https://know-your-meals-api-staging.<your-subdomain>.workers.dev`) |
   | Variable | `STAGING_API_URL` | 上記と同じstaging APIのURL(Web側の`EXPO_PUBLIC_API_URL`用) |

   `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_PLACES_API_KEY` / `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` / `EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID` は本番と共用のため追加不要です。

3. Google Cloud ConsoleのOAuthクライアントに、staging APIのコールバックURL (`<STAGING_API_URL>/api/auth/callback/google`) を許可済みリダイレクトURIとして追加する。
4. 初回デプロイ後にWorkerの実際のURLが確定するので、`BETTER_AUTH_URL_STAGING` / `STAGING_API_URL` を実URLに更新して再実行する。

`DATABASE_URL` / `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_PLACES_API_KEY` のWorkerシークレットは、ワークフロー実行のたびに `wrangler secret put --env staging` で自動的に同期されます。

---

## 🤝 Contributing

このプロジェクトはハッカソン期間中に開発されています。Issue / PR お気軽にどうぞ。

---

<div align="center">

Made with 🍙 during a hackathon

</div>
