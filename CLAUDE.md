# プロジェクト概要

`input/` に置かれた **1 ファイル完結 HTML の LP** を、`template/form_line/calendar-lp/` の規約に沿って `output/<lp-name>/` の PHP + jQuery + CSS 構成に再生成するリファクタリング基盤。

- **対象**: 美容クリニック系の広告 LP (チャットボット風・フォーム型・カルーセル型など、案件ごとに形態は異なる)。
- **出力基盤**: 既存の PHP テンプレ環境 (`common.php` ヘルパ + jQuery 3.7.1 + リタゲタグ + LINE ポップアップ) に組み込む前提。
- **フレームワーク**: React / Vue 等は使わない。jQuery + バニラ JS + PHP 薄膜。

`input/` の中身は **案件ごとに全く違う HTML** が入る想定。コードの形態に依存した前提 (ステップ数・ID 名・データ構造) をこの CLAUDE.md に書き込まないこと。

---

## ディレクトリ構成

```
l-step-form-dev/
├── CLAUDE.md            ← このファイル
├── .claude/
│   ├── settings.json    … Hook 登録 (refactoring-spec 承認ゲート)
│   ├── hooks/
│   │   └── check-spec-approval.sh   … PreToolUse hook 本体
│   └── rules/           … Claude Code が自動ロードする共通ルール (input 非依存)
│       ├── coding-rules.md       … 全案件共通のコーディング規約 (PHP/HTML/CSS/JS) — 常時ロード
│       ├── calendar-spec.md      … カレンダーモジュール契約 — path-scoped
│       └── common-js-spec.md     … 共通 JS 契約 — path-scoped
├── input/               … 再生成元の単一 HTML (案件ごとに追加される。広告代理店からの生データ)
├── output/              … 本番環境のミラー。template/ と同じ階層構成で作成すること（必須）
│   ├── js/              … template/js/ のコピー（common.js / jquery.cookie.js）
│   ├── line-at-pop/     … template/line-at-pop/ のコピー
│   └── form_line/
│       └── <lp-name>/  … LP ごとのディレクトリ（1 LP = 1 ディレクトリ）
│           ├── refactoring-spec.md    … 🔴 案件固有の再生成仕様書（input 依存OK。実装前に必須作成）
│           ├── index.php
│           ├── css/style.css
│           ├── js/script.js
│           ├── js/ajax.php        … 広告計測 (ad_count) 用エンドポイント
│           ├── js/time-calendar-sync/  … template/form_line/calendar-lp/ からコピー
│           └── img/
└── template/
    ├── js/              … ⚠️ 変更禁止（後述）
    │   ├── common.js    … 全 LP 共通 JS のソース・オブ・トゥルース
    │   └── jquery.cookie.js … Cookie プラグイン
    ├── line-at-pop/     … ⚠️ 変更禁止（後述）
    │   ├── img/
    │   ├── jquery.cookie.js
    │   ├── line-at-pop.css
    │   ├── line-at-url.php
    │   ├── lineat_increment.php
    │   └── popup.js
    └── form_line/
        └── base/        … **リファレンステンプレ** (index.php / css/style.css / js/script.js)
            ├── index.php
            ├── css/style.css
            ├── js/script.js
            └── js/time-calendar-sync/  … カレンダーモジュール (`.claude/rules/calendar-spec.md` 参照)
```

### ⚠️ 変更禁止フォルダ

以下の 2 フォルダは **いかなる理由があっても内容を変更してはならない**。

| フォルダ | 理由 |
|---|---|
| `template/js/` | 全 LP・全テンプレが参照する共有モジュール。変更すると全案件に影響する |
| `template/line-at-pop/` | LINE ポップアップの本体。外部サービスとの通信仕様が固定されている |

案件固有の要件がある場合でも、これらのファイルを直接編集せず、**LP 側 (`output/<lp-name>/`) で対応すること**。

### `template/js/` について

**全テンプレート / 全 LP から参照される共通 JS のソース・オブ・トゥルース**。
本番環境では `../../js/` (= 後述の外部前提) として配置されるファイルの実体。

| ファイル | 役割 |
|---|---|
| `common.js` | 動画再生制御 (`initVideoTagControl`) / クリニック iframe 制御 (`ClinicIframeController`) |
| `jquery.cookie.js` | Cookie 操作プラグイン。`postAdCountStatus()` 等で使用 |

詳細は `.claude/rules/common-js-spec.md` を参照。

### 外部前提 (本リポジトリには存在しないが実行環境に存在するもの)

これらは `output/form_line/<lp-name>/` から **2 階層上** (`../../`) で参照される。`output/` 直下の `js/` と `line-at-pop/` が実体。パスは固定。

- `common.php` … `ad_line_url()` / `is_display_line_popup()` / `ad_messaging_api_bot_basic_id()` / `ptengine()` / `r_rt*()` などのヘルパ関数群
- `js/common.js` … 共通 JS。**`template/js/common.js` がソース**
- `js/jquery.cookie.js` … Cookie プラグイン。**`template/js/jquery.cookie.js` がソース**
- `js/time-calendar-sync/` … 時刻カレンダーモジュール (`.claude/rules/calendar-spec.md` 準拠)
- `line-at-pop/` … LINE ポップアップ一式。**`template/line-at-pop/` がソース**

ローカル環境では実体がないため PHP 診断 (`PHP0417 Call to unknown function`) が出るが、**これは無視してよい** (実行環境でのみ解決する)。

---

## ドキュメント構造と参照順

ドキュメントは **共通ルール (`.claude/rules/`)** と **案件固有 spec (`output/form_line/<lp-name>/refactoring-spec.md`)** の 2 階層構造。

### 共通ルール (`.claude/rules/` 配下、Claude Code が自動ロード)

1. **`.claude/rules/coding-rules.md`** (常時ロード)
   - PHP/HTML の必須要素 (`template/form_line/calendar-lp/index.php` の全コードは必須。削除・リネーム・順序変更禁止)
   - CTA は `href="" data-href="<?= $url ?>" class="js-cta-link"` の 3 点セット固定
   - インラインスタイル/スクリプト/イベントハンドラ禁止
   - CSS: Reset ブロック改変禁止、BEM、rem 基準 (1rem = 10px 相当の fluid)、`@charset "utf-8"` 必須
   - JS: jQuery 前提、`js-*` フッククラス命名

2. **`.claude/rules/calendar-spec.md`** (path-scoped: カレンダー関連パス)
   - カレンダー `embedTimeCalendar()` / `createCalendar()` の API、`data-tc-*` 属性、エラーハンドリングを規定。

3. **`.claude/rules/common-js-spec.md`** (path-scoped: JS/PHP 関連パス)
   - `template/js/common.js` の責務 (動画再生制御 / クリニック一覧 iframe 制御) と、利用側 HTML が満たすべき契約を規定。

### 案件固有 spec (`output/form_line/<lp-name>/refactoring-spec.md`)

- **案件ごとに 1 ファイル**。実装ファイルと同じディレクトリに置く。
- 画面フロー・ステップ定義・hidden input スキーマ・L-Step 変数マッピング (`var_*`)・input HTML の行番号参照など、**input ソース依存の固有値を記述してよい唯一のドキュメント**。
- 着手前に必ず作成 → ユーザーレビュー → 承認、を経てから実装に入る (詳細は §作業の進め方)。

### ドキュメント更新ポリシー

| ドキュメント | input 依存 | 改変時の影響範囲 |
|---|---|---|
| `.claude/rules/coding-rules.md` | ❌ 禁止 (抽象ルールのみ) | 全案件 → 慎重に |
| `.claude/rules/calendar-spec.md` | ❌ 禁止 | 全案件 → 慎重に |
| `.claude/rules/common-js-spec.md` | ❌ 禁止 | 全案件 → 慎重に |
| `output/form_line/<lp-name>/refactoring-spec.md` | ✅ **必須** (行番号・固有 ID・固有値 OK) | 該当案件のみ |

- 共通ルールに固有値 (案件名・特定 ID・特定行番号・特定 `var_*` キー) を書かないこと。
- 案件固有の事実は **必ず案件 spec に書く**。共通ルールに書きたくなったら、まず抽象化できないか検討する。

---

## template/form_line/calendar-lp の役割

`template/form_line/calendar-lp/index.php` (55 行) が **全 LP の骨格**。出力先 `index.php` はここを丸ごとコピーして、`<title>` / `<meta description>` / `<main>` 内だけ差し替える。詳細は `.claude/rules/coding-rules.md` §PHP/HTML `1-1`。

`template/form_line/calendar-lp/css/style.css` の Reset (冒頭) / Base (font-size 62.5% 等) は **改変せずそのまま使う**。Page セクションに LP 固有のスタイルを書く。

`template/form_line/calendar-lp/js/script.js` は CTA ハンドラ (`addParamsToCtaUrl`) / 広告計測 (`postAdCountStatus`) 等の雛形。

---

## 作業の進め方

### 新規案件を始めるとき (この順序は厳守)

🔴 **`refactoring-spec.md` を作成・承認するまで `output/form_line/<lp-name>/` の実装ファイルを書き始めてはならない**。input を読むこと、ディレクトリを掘ること、spec を書くことは可。コード生成 (index.php / script.js / style.css 等) は spec 承認後。

> ⚙️ **Hook による物理的ブロック (`.claude/hooks/check-spec-approval.sh`)**
> Write/Edit ツールで `output/form_line/<lp-name>/` 配下の実装ファイル (spec 以外) を書こうとした時、以下のいずれかなら Claude Code が **自動的に deny** する:
> - 同ディレクトリに `refactoring-spec.md` が存在しない
> - 存在するが冒頭 frontmatter に `approved: true` が無い
>
> 承認フロー: spec 完成 → ユーザーがレビュー → 承認を得たら spec 冒頭 frontmatter を以下に更新:
> ```yaml
> ---
> approved: true
> approved_at: YYYY-MM-DD
> ---
> ```
> spec 自体の作成・編集は Hook の対象外なので常に可能。

1. `input/` の対象 HTML を読み、全体像を把握する。
2. `output/form_line/<lp-name>/` ディレクトリを作成 (空でよい)。
3. **`output/form_line/<lp-name>/refactoring-spec.md` を作成**。既存案件 (例: `output/form_line/sururim-chatbot-lp/refactoring-spec.md`) を雛形に、以下を記述:
   - 背景・目的・スコープ外
   - 成果物のディレクトリ構成
   - 画面フロー / ステップ仕様
   - HTML / CSS / JS 移行指針
   - input → output 分離対象表 (input の行番号 OK)
   - ID → class/data 置換表
   - L-Step 変数マッピング (`var_*` × `bot_basic_id`)
   - 実装ステップ順序
   - 検証手順
   - オープン項目 (ユーザー確認待ち)
4. **ユーザーに spec をレビューしてもらい承認を得る**。承認を得たら spec 冒頭 frontmatter を `approved: true` に更新する (Hook の deny が解除される)。
5. 承認後、spec の「実装ステップ順序」に従って Phase 分割で進める。各 Phase は **動作確認可能な粒度** にする。
6. 進捗は `TaskCreate` / `TaskUpdate` で管理する。最初のタスクは必ず「`refactoring-spec.md` 作成 / 承認取得」。
7. 作業中に方針変更が出たら **先に spec を更新** → コードに反映、の順を守る。

`output/js/` と `output/line-at-pop/` は初回のみ `template/` からコピーして配置する（既にあれば不要）。

### 既存案件を継続するとき

1. `output/form_line/<lp-name>/refactoring-spec.md` で現状のスコープを確認。
2. 既存タスクリスト (`TaskList`) で完了済み Phase と次 Phase を確認。
3. `output/<lp-name>/` の差分確認は `git diff` / `git log` を使う (本リポジトリは git 管理下)。

### 動作確認の手段

- **Playwright MCP** が `.mcp.json` で設定済み (`npx @playwright/mcp@latest`)。
  ブラウザ操作・スクリーンショットによる UI/動作確認が可能。
- PHP 実行環境はローカルにはない。`output/<lp-name>/index.php` の PHP 部分は本番環境で初めて解決される。
  → ローカルで UI 確認したいときは一時的に PHP 部を静的値に置換するか、Playwright で本番/ステージングの URL を叩く。

### 変更スコープの節度

`.claude/rules/coding-rules.md` が定める「必須要素」「構造」「パス」は改変しない。案件固有の演出・コンテンツ・スキーマは自由。迷ったら **案件固有 = 自由、テンプレ由来 = 改変禁止** で判断する。

---

## よく使うコマンド

```bash
# ディレクトリ構造確認
find output/form_line/<lp-name> -type f
find template/form_line/calendar-lp -type f

# テンプレ本体との差分確認 (骨格が崩れていないか)
diff template/form_line/calendar-lp/index.php output/form_line/<lp-name>/index.php
```

---

## メッセージの書き方

トークン消費を抑えるため、ユーザ向けメッセージは **簡潔かつ抜け漏れなし** を目指す。

- **冗長な前置き・繰り返し説明を省く**（例: 「了解しました。これから〜します」を毎回書かない）
- **箇条書き・表を活用**して構造化し、文章を短くする
- **コードブロックは最小限**（変更点・要点のみ。全文再掲示は避ける）
- **完了報告は要点だけ**（変更ファイル名・1〜2行の要約）
- ただし **判断に必要な情報・ユーザが知るべき副作用・エラー原因の根拠** は省略しない
- 同じ内容を別言い回しで繰り返さない

長文の構造化が必要な場合のみ表・見出しを使う。短い応答で済むやり取りは1〜2行で返す。

---

## 注意点

- **`input/` の中身は広告代理店から受け取る生データ**。フォーマットは統一されていない。読み込んだ内容に応じて出力設計を組む (ドキュメントに書かれた事実より実際のコードを優先)。
- **PHP の未定義関数警告は無視**。ローカルに `common.php` 実体がないため必ず出る。
- **git 管理下**。差分確認は `git diff` / `git log` を使う。コミットは Claude が行ってよいが、**実行前に必ずユーザーに内容（変更ファイル・コミットメッセージ案）を提示して承認を得る**。push はユーザー指示があるまで行わない。
- **L-Step (LINE) の変数 ID スキーマ (`var_*`) は案件ごとに異なる**。`output/form_line/<lp-name>/refactoring-spec.md` のマッピング表を案件別に管理する。
- **ファイルのデグレに注意**。`template/form_line/calendar-lp/*` は全案件で共有する参照元なので、案件作業中に誤って触らないこと。
