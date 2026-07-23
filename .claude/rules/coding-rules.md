# コーディングルール

`input/` のソースを `output/` へ再生成する際の規約。リファレンスは `template/form_line/calendar-lp/`。

このファイルは常時ロードされる **総論 + 各論ファイルへの目次**。詳細は対応するファイルを参照する（path-scoped で必要時のみロードされる）。

---

## ディレクトリ構成ルール

### 1. 基本構成 (1 LP = 1 ディレクトリ)

1 ページを 1 ディレクトリに完結させ、必要資産をすべて同梱する。

```
output/<lp-name>/
├── index.php          … エントリ HTML
├── css/
│   └── style.css      … 単一 CSS
├── js/
│   └── script.js      … ページコントローラ
└── img/               … 画像ファイル
```

### 2. 各ディレクトリ・ファイルの役割

| パス | 役割 |
|---|---|
| `index.php` | ページ本体。HTML + 必要最小限の PHP |
| `css/style.css` | このページの全スタイルを格納する単一 CSS |
| `js/script.js` | このページの全 JS を格納するメインスクリプト |
| `img/` | このページで使用する全画像 |

### 3. 配置ルール

- **CSS / JS / 画像はすべて LP ディレクトリ内に同梱** する (ポータビリティ重視)。
- `css/`, `js/`, `img/` ディレクトリ名は **固定**。サブディレクトリは原則作らない (フラット配置)。
- 1 ファイル完結を崩さない。CSS や JS を機能別に分割しない。

---

## 各論ルールファイル（path-scoped）

該当パスを編集するときに自動ロードされる。**新規案件着手前にざっと一読推奨**。

| ファイル | スコープ | 内容 |
|---|---|---|
| [coding-php-html.md](./coding-php-html.md) | `output/form_line/**/index.php` ほか | PHP / HTML の必須ベースライン、CTA リンク 3 点セット、インライン禁止、チェックリスト |
| [coding-css.md](./coding-css.md) | `output/form_line/**/css/**` ほか | Reset / Base（改変禁止）、フルード rem、BEM、Utility (`u-*`)、単位ルール |
| [coding-form-input.md](./coding-form-input.md) | `output/form_line/**/index.php` + `js/**` | radio / checkbox / select の使い分け、`<label>` + `.sel` パターン、name 命名 |
| [coding-js.md](./coding-js.md) | `output/form_line/**/js/**` | 全体構造、state、画面遷移、`formatDate`、`addParamsToCtaUrl`、`postAdCountStatus`、Observer、動画、クリニック一覧取得 |
| [coding-quality.md](./coding-quality.md) | `output/form_line/**` | パフォーマンス、セキュリティ（XSS / 動的コード実行 / postMessage 等）、クロスブラウザ（iOS Safari / Android WebView） |
| [calendar-spec.md](./calendar-spec.md) | `**/time-calendar-sync/**` ほか | `embedTimeCalendar()` / `createCalendar()` API、`data-tc-*` 属性、エラーハンドリング |
| [common-js-spec.md](./common-js-spec.md) | `output/form_line/**/index.php` + `js/**` ほか | `template/js/common.js` の責務（動画再生制御 / iframe 制御）と利用側契約 |

---

## カレンダーモジュール

`time-calendar-sync` の組み込み・仕様については **[calendar-spec.md](./calendar-spec.md)** を参照。
