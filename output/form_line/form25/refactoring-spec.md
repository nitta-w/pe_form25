---
approved: true
---

# form25 リファクタリング仕様書

対象案件: JUNOビューティークリニック「スルリム式 脂肪破壊術」横スクロール風ストーリーLP
「脂肪はなぜ、消えないの？｜2026年夏・ダイエットの答え合わせ」

入力ソース: `input/index.html`（1498行・単一HTML完結、開発版 v0.6）+ `input/assets/*.webp`（30点）

---

## 0. 実装メモ（実装後追記）

承認後の実装で判明した、spec からの軽微な差分・修正点。

| 項目 | 内容 |
|---|---|
| アセット数の誤記 | §背景に「32点」と記載していたが実際は30点（`pose_1`/`pose_7` は納品物に存在しない）。上記見出しを修正済み |
| 事前読み込みリストの修正 | input のプリロード配列に存在しない `pose_7_おねがい.webp` への参照があった（納品アセットに該当ファイルなし＝input側のバグ）。output では該当行を削除 |
| `GIRL.pose()` のネガ/ポジ判定バグ修正 | input の `NEGA_POSES` は日本語ラベル（'ショック'等）でファイル名を判定していたが、実ファイル名は英字（`pose_2_shock.webp`等）のため常に不一致でガーン音が鳴らない状態だった。ファイル名ベースの判定に修正 |
| エリア→院フェッチの事前実行（プリフェッチ）を見送り | §5-1 で「ナレーション演出中に裏で取得」と書いたが、実装では簡素化し、院選択画面に遷移した時点で fetch する方式にした（軽いローディング表示のみ）。挙動・正しさに影響なし |
| `isCouponTime` / `isToday` の送信キー | `addParamsToCtaUrl` で計算・分岐は実装済みだが、L-Step 側に対応する変数IDが未確定のため、暫定で `varMapping['isCouponTime']` / `varMapping['isToday']` という文字列キーのまま送信している（§10 オープン項目に追記） |
| 院名の画面表示 | 診断書・クリア画面で `answers.clinic`（`sururim_list.php` 由来のクリニック表示名）を `POP.show()` の html に文字列展開している。ユーザーの自由入力ではなく自社バックエンド（BigQuery）由来の運用データのため XSS リスクは実質的にないと判断し、`.text()` 経由への変更は行っていない |
| `select` の iOS ズーム対策 | Base の `select{font-size:1.3rem}` は改変禁止のため、`.reserve__clinic-select` に `font-size:16px` の Page 側上書きを追加 |
| **`.story` 配下の単位を rem → px に方針変更** | `.story` の `max-width` を固定 480px にした結果、Base のフルード rem 設計（画面幅に応じて `1rem` が 10〜16px まで変化）に乗せたままだと文字サイズ・余白が input より最大60%大きく表示される不整合が発生した。ユーザー指摘を受け、`.story` 配下（Page セクションのほぼ全体）を **input のオリジナル px 値に戻す**方針に変更。Reset / Base / Utility は無改変のまま維持し、Page セクションのみ px 直書きとする（`coding-css.md` §4 の原則からは外れるが、480px 固定フレームという input の設計意図を正確に再現するための明示的な例外として Page セクション冒頭にコメントで明記） |
| Utility 誤用の修正 | 実装当初、LP 固有の微調整をテンプレ流用の `u-color-red`(`#EF4B7D`) 等で代用していたが、input の実際の指定色と異なっていた（例:「10年無事故」は `#e0426e` が正、`u-color-red` は `#EF4B7D` で不一致）。`u-fs-*`/`u-color-*` の LP 独自追加分は削除し、`.pop__accent` / `.pop__note` / `.pop__strong` / `.caro__reason-num` / `.ba-case__title` / `.ba-case__disclaimer` 等の Page 層 BEM クラスに置き換えて input と同じ色・サイズに修正 |
| タイプライター表示のフォントサイズ計算 | `UI.say()` の自動フィット処理も rem 変数（1.45 起点）で実装していたが、CSS 側の px 統一に合わせて px 計算（14.5 起点、12.5 下限）に戻した |
| `.fat img` / `.prop img` の意図しない拡大を修正 | Base の `img, video { width: 100%; height: auto; }` により、`height` のみ指定していた `.fat img` / `.prop img` が横幅いっぱいに引き伸ばされる不具合を実装中に発見。`width: auto;` を明示して修正 |
| Q2「年代」の選択肢を4→8択に変更 | ユーザー指示により `20代/30代/40代/50代以上` の4択から `17歳以下・高校生/18〜19歳 ※高校生を除く/20代/30代/40代/50代/60代/70代以上` の8択に変更。`value` は `label` と同一文字列のまま L-Step 変数 `var_2184988` にそのまま送信される（他ロジックとの依存なし・関連箇所への影響なし） |

---

## 1. 背景・目的

`input/index.html` は、スマホ縦画面をゲーム風に使った「夢の中の散歩」ストーリー体験 LP。
歩行アニメ・脂肪くん浮遊演出・WebAudio による BGM/SE・タイプライター表示・全画面ポップアップ
（学習カード／カルーセル／診断書／GIFT）・予約仮押さえ（エリア→院→第1〜第3希望日時）・LINE 追加
CTA までを 1 ファイルの `<style>` + `<script>` に内包した「開発版」。

目的は、この体験を **壊さずに** `template/form_line/calendar-lp/` の PHP + jQuery + CSS 構成へ移植し、
本番の `common.php` ヘルパ・広告計測（`ad_count`）・L-Step 連携・共通 JS（`common.js`）・LINE ポップアップに
正しく接続すること。

## 2. スコープ

- **今回のスコープ**: input に実装されている **S0（ゲート）〜S8（LINE CTA）まで全部**。
  input 冒頭コメントに「未実装: S2失敗街道以降（次版）」とあるが、実際の `story()` 関数は S2〜S8 まで
  実装済みであり、ユーザー確認の上でこの記述は古い情報として無視し、全部を移植対象とする。
- **予約導線の刷新**: エリア選択・院選択・カレンダー（第1〜第3希望日時）は、input の「固定JSON院リスト
  ＋自作14日カレンダー」を廃止し、テンプレ標準構成に置き換える（詳細 §5）。
  - 院リスト取得: `template/form_line/base/js/sururim_list.php` を移植（BigQuery 連携・本番稼働実績あり）
  - 予約可能日時取得: `template/form_line/base/js/sururim_schedule.php` を移植（同上）
  - カレンダー UI: `template/form_line/calendar-lp/js/time-calendar-sync/`（`embedTimeCalendar()`）を移植
- **広告計測の新規追加**: input には `adCountStatus` / `postAdCountStatus()` の仕組みが存在しないため、
  新規に組み込む（詳細 §4-6）。
- **L-Step CTA URL 生成の標準化**: input の独自 `buildUrl()` を廃止し、`addParamsToCtaUrl()` 標準実装に
  揃える（詳細 §7）。

### スコープ外（このLPでは対応しない・input のまま据え置き）

| 項目 | 扱い |
|---|---|
| 3 種の画像/動画差し替え枠（`imgph`） | 「脂肪細胞の変化イメージ」（`img/fat.webp` 349×281）、「選ばれる5つの理由」の画像枠5点（`img/sl_illust_01.webp`〜`05.webp` 各647×258、`REASONS` 配列の順に対応）は納品済みのため実装済み（`.pop__img` クラス、`width`/`height`/`loading="lazy"` 付与）。残り1種（症例写真Before/After枠 ×3）は実素材未着のため `.imgph` プレースホルダのまま |
| フッター「運営者情報」「プライバシーポリシー」リンク | input と同じ `href="#"` のまま（差し替えは別途） |
| GIFT 01 の価格表記（サマーキャンペーン 4,900円） | 本日 (2026-07-23) は 7/31 以前のため現状表記のまま。8月更新は別タスク |
| `google-bigquery-api` 本体・認証情報 | 本番環境に実在する前提。ローカルでは PHP 未定義関数警告が出るが無視してよい |
| L-Step 変数 ID (`var_*`)・エリア ID と BigQuery 側 `area_id` の整合確認 | 実装後、本番導入前にクライアント側で最終確認が必要（§10 オープン項目） |

---

## 3. 成果物のディレクトリ構成

```
output/form_line/form25/
├── refactoring-spec.md
├── index.php
├── css/
│   └── style.css
├── js/
│   ├── script.js
│   ├── ajax.php                      … calendar-lp/js/ajax.php をそのままコピー（広告計測エンドポイント）
│   ├── sururim_list.php              … base/js/sururim_list.php をそのままコピー（エリア→院リスト取得）
│   ├── sururim_schedule.php          … base/js/sururim_schedule.php をそのままコピー（院→スケジュール取得）
│   └── time-calendar-sync/           … calendar-lp/js/time-calendar-sync/ をそのままコピー
└── img/
    └── （input/assets/*.webp を移設。ファイル名はそのまま）
```

`output/js/`・`output/line-at-pop/` は既にリポジトリに配置済み（コピー不要）。

---

## 4. 画面フロー / ステップ仕様

input の `story()` を素材に、以下のチャプター構成をそのまま踏襲する（`STORY.set(n)` の値 = チャプター番号）。

| # | チャプター | 内容 | input 内の主な範囲（行） |
|---|---|---|---|
| S0 | ゲート | 音あり/音なし選択の起動画面 | 374-387（HTML）, 1452-1457, 1489-1490（JS） |
| S1 | 導入・プロフィール4問 | ナレーション→夢の中→性別/年代/気になる部位(複数)/ダイエット歴(複数) | 1062-1128 |
| S2 | 失敗街道 | 選んだダイエット歴ごとの「あるある」イベント（食事制限→ドカ食い連鎖／運動／サプリ／エステ／甘いもの共通） | 1130-1259 |
| S3 | 脂肪くんのひみつ | 学習カード（脂肪細胞の数と大きさ） | 1261-1287 |
| S4 | スルリム紹介 | 施術紹介・安全性・5つの理由カルーセル・脂肪破壊FX・Before/Afterカルーセル | 1288-1347 |
| S5 | 脂肪タイプ診断書 | 回答から診断タイプを算出しポップアップ表示 | 1012-1027, 1349-1359 |
| S6 | GIFT（4特典） | 特典カード表示・24時間タイマー起動 | 1361-1378 |
| S7 | 予約仮押さえ | エリア→院→カレンダー（第1〜3希望）→時間 | 1380-1394（**§5 で標準実装に置換**） |
| S8 | クリア → LINE CTA | クリア演出→まとめ→クロージング→LINE追加ボタン | 1396-1449 |

歩行エンジン (`GIRL`)・背景パララックス (`BG`)・脂肪くん浮遊 (`FAT`)・小物演出 (`PROP`)・WebAudio (`SND`)・
タイプライター/選択肢 UI (`UI`)・全画面ポップアップ (`POP`)・紙吹雪/FX/バナー等の演出関数は **input のロジックを
そのまま移植**する（演出の削除・簡略化はしない）。

---

## 5. 予約導線の標準化（エリア・院・カレンダー）

### 5-1. エリア選択

- input の `UI.buttons(Object.keys(CLINICS)...)` を、`<input type="radio" name="area">` を内包した
  `<label class="opt">` のチャットボタン群に置き換える（`coding-form-input.md` §2-1 パターン）。
- `value` は **1〜6 の数値文字列**（`coding-js.md` クリニック一覧取得ルール §1 の対応表に準拠）。

| value | エリア名（表示ラベル） |
|---|---|
| 1 | 北海道・東北地方 |
| 2 | 関東地方 |
| 3 | 中部地方 |
| 4 | 近畿地方 |
| 5 | 中国・四国地方 |
| 6 | 九州・沖縄地方 |

  → input の `CLINICS` オブジェクトのキー（北海道・東北／関東／中部／関西／中国・四国／九州・沖縄）と対応するが、
  「関西」は「近畿地方」表記に統一する（`sururim_list.php` の `area_id` と揃える。§10 オープン項目参照）。
- `change`（＝タップ選択確定）のタイミングで `sururim_list.php` へ fetch し、院リストを裏で取得しておく
  （ナレーション演出中にプリフェッチすることで、次の質問表示時には院一覧が準備済みになる）。

### 5-2. 院選択

- 取得件数が可変（0〜24件程度）のため、`<select name="clinic_shop">` のネイティブドロップダウンに変更する
  （チャット吹き出し風の `#choices` 内に設置し、選択後に「▶ この院で決定」ボタンで確定する2アクション構成）。
- 取得・エラーハンドリングは `coding-js.md`「クリニック一覧取得ルール」§2〜§5 のテンプレをそのまま使用し、
  エンドポイントのみ `sururim_list.php` に読み替える。
- 取得失敗時は `data-clinic-list-error` を `<select>` に付与し、店舗未選択でも先に進める分岐を必ず用意する
  （§2-5-3 のフォールバック要件）。
- 選択された `<option>` の `data-clinic-id` 属性（fetch レスポンスの `clinic_id`）を、カレンダー取得時の
  `clinicId` として使う。

### 5-3. カレンダー（第1〜第3希望日時）

- `time-calendar-sync` の `embedTimeCalendar()` を採用する。input の「希望3つまで＝タップ順が希望順」という
  仕様は `options.maxSelectedDate: 3` でネイティブに満たせる。

```js
const cal = embedTimeCalendar({
  parentSelector: '#js-time-calendar',
  checkBoxAttrName: 'date_1',
  scheduleFetchUrl: new URL('/form_line/form25/js/sururim_schedule.php', window.location.origin),
  options: {
    maxSelectedDate: 3,
    couponSettings: {
      isAllTimeCoupon: true,
      showStartDays: 0,
      showDays: 7,
      showTimeList: [],
    },
  },
});
cal.init();
await cal.createCalendar({ params: { clinicId: selectedClinicId, days: 21 } });
```

  - `couponSettings` の値（7日間・全時間帯クーポン）は input の「日時特典」相当が存在しないための仮設定。
    本番の特典条件が別途あれば要調整（§10 オープン項目）。
  - `maxSelectedDate: 3` のため、`[name="date_1"]` は選択順に **3つ生成**される
    （`calendar-spec.md` §9-2）。`addParamsToCtaUrl` 側は `$('[name="date_1"]').toArray()` で
    `[0]=第1希望 / [1]=第2希望 / [2]=第3希望` として読み取る（§7）。
  - エラー時（`[data-tc-is-error]`）は `isCalendarError = true` とし、日時パラメータを CTA URL に載せず、
    かつ「日時未選択でも進める」ボタンで導線を維持する。

---

## 6. HTML / CSS / JS 移行指針

### 6-1. index.php

- `template/form_line/calendar-lp/index.php` を丸ごとコピーし、`<title>`・`<meta description>`・`<main>` 内
  のみ差し替える（`.claude/rules/coding-php-html.md` §1）。
- `<main>` 内に input の `.app` 構造一式（ステージ／トークバー／選択肢パネル／ポップアップ／ゲート）を配置する。
- 最終画面の LINE ボタンは、動的生成 (`document.createElement('button')`) をやめ、**実 `<a>` タグ**の
  CTA 3点セットに変更する。

```html
<a href="" data-href="<?= $url ?>" class="js-cta-link lineBtn">
  <svg>…</svg>LINEで受け取る
</a>
```

  - `href=""` を空にし、クリック時に `onClickCtaBtn` → `addParamsToCtaUrl()` が `href` を組み立てる。
  - このLPで CTA は実質この1箇所のみ（S8 到達までは常に「進む」操作のみで、外部遷移は発生しない）。

### 6-2. css/style.css

- ファイル先頭 `@charset "utf-8";` → Reset（`calendar-lp/css/style.css:3-80` を無改変コピー）→
  Base（同 82-244 を無改変コピー）→ Utility → Page → Animation の順で構成する。
- **単位方針（実装確定版）**: input の `.app` は 480px 固定のスマホフレーム（フルード rem 設計を前提としない
  固定サイズ UI）のため、`.story` 配下（Page セクションのほぼ全体）は Base のフルード rem 設計に乗せず、
  **input のオリジナル px 値をそのまま使用する**。rem 化すると画面幅 600px 以上で文字サイズ・余白が
  input より最大60%大きくなり、意図した見た目から外れるため（実装当初は px÷10 の rem に変換していたが、
  ユーザー指摘により全面 px 化に修正）。`border`／`outline`／`box-shadow` の blur・spread はもともと px。
  - 例: `.talk { flex:0 0 118px; }`（input と同一の値のまま）
  - Reset／Base／Utility の3ブロックは無改変・rem のまま（テンプレ規約 §2〜§3 準拠）。
- **`body` の上書き**: Base の `body { background:#fff; font-family:"Noto Sans JP"...; color:#242424; }` は
  テキストとして改変しないが、Page セクションで `body` 向けの追加ルール
  （`background:#3a2f3d; font-family:'Zen Maru Gothic',...; display:flex; justify-content:center;` 等）を
  後方に追記し、カスケードで上書きする。Base ブロック自体の削除・書き換えは行わない。
- **`100vh` の置換**: input の紙吹雪アニメーション (`translateY(110vh)`) 等、`vh` 単位は `dvh` 系に統一する
  （`coding-quality.md` クロスブラウザ §3）。`html,body{height:100%}` は `.app`側で `height:100dvh` に統一。
- BEM 化: `.gate`, `.talk`, `.choices`, `.pop`, `.karte`, `.gcard`, `.caro`, `.cal` 等のクラス名は
  Block__Element 形式を維持しつつ、状態は `.sel` → `is-selected` 系に寄せる（既存 `.sel`/`.done` 等は
  input からの継承クラス名だが、コーディングルール §5-2 に沿って `is-*` に統一する）。
- Utility は `u-*` 命名・`!important` 付与のテンプレ規約に従う（マージン等の単発調整のみ）。

### 6-3. js/script.js

- 全体を `$(() => { ... })` でラップし、input の各 IIFE モジュール（`BG` / `GIRL` / `FAT` / `PROP` /
  `STORY` / `UI` / `POP` / `SND`）は `function BG(){...}` のような**関数宣言 + 内部 `state`**の形に変換し、
  トップで呼び出す（`coding-js.md` §1）。
- **ページ全体の `state`**（新設）:

```js
const state = {
  isMoving: false,
  currentStep: 1,       // STORY.set(n) の n と同期
  achievedMaxStep: 1,
  maxStep: 8,            // S1〜S8 の8チャプター
  adCountStatus: 3,
  adCountStatusMax: 8 + 2,
};
```

  - `STORY.set(n)` を呼ぶ箇所（S1〜S8 の各チャプター開始時）で `state.currentStep = n` に同期し、
    `state.adCountStatus++` → `postAdCountStatus()` を実行する（`coding-js.md` §3-3・§6）。
  - 戻る操作はこの LP に存在しないため `onClickPrevBtn` は実装しない（該当なし）。
  - `postAdCountStatus` / `formatDate` は**完全コピーで使用**（改変禁止）。
- **回答値の hidden input 化**（新設・重要）: `coding-form-input.md` により「ボタンだけで値を持たない実装」は
  禁止のため、input の `answers` オブジェクトへの代入に加えて、選択確定のたびに実 `<input>` を生成・追記する。
  ボタン自体は選択後に消える（input のアニメーション演出は維持）が、値は hidden input に残す。

  | 質問 | input 要素 | name |
  |---|---|---|
  | 性別 | `<input type="hidden" name="gender">` | `gender` |
  | 年代 | `<input type="hidden" name="age">` | `age` |
  | 気になる部位（複数） | `<input type="hidden" name="body_parts">` を選択数分 | `body_parts` |
  | ダイエット歴（複数） | `<input type="hidden" name="diet_history">` を選択数分 | `diet_history` |
  | エリア | `<input type="radio" name="area">`（§5-1） | `area` |
  | 院 | `<select name="clinic_shop">`（§5-2） | `clinic_shop` |
  | 第1〜3希望日時 | `time-calendar-sync` が生成する `<input name="date_1">` ×3（§5-3） | `date_1` |

- **`addParamsToCtaUrl`**: §7 を参照。
- **動画**: input に `<video>` は存在しない（静止画のみ）ため `initVideoTagControl()` は自動的に対象なし。
  将来 `imgph` 枠に動画を差し込む場合は `coding-js.md` §11 に従う。
- **インラインスタイル排除**: input の JS 内に多数存在する `style.cssText = '...'` / テンプレート内
  `style="..."` （例: `PROP.show()` の `d.style.left`、`UI.timePick()` の `SEL_CSS` 等）は、
  `coding-php-html.md` §4-1 に従い CSS クラス化する。実行時に決まる純粋な数値（アニメーション delay・
  浮遊位置の `left`/`bottom`% 等）のみ `style=""` 許容。
- **セキュリティ**: `UI.say()` の `textEl.innerHTML = text` は固定テンプレ文言のみを差し込む
  （ユーザー入力は混在しない）ため許容だが、`answers.clinic` 等の値を `POP.show()` の `html` に
  差し込む箇所（S8「あなたが手に入れたもの」等）は、選択肢由来（ユーザー自由入力ではない）ため
  現状のまま許容。念のため `escapeHTML()` 相当の処理を通す。

---

## 7. `addParamsToCtaUrl` 実装方針

input の `buildUrl()` を廃止し、`coding-js.md` §5 のテンプレ構造に合わせて実装する。

```js
const addParamsToCtaUrl = () => {
  const gender = $('[name="gender"]').val();
  const age = $('[name="age"]').val();
  const bodyParts = $('[name="body_parts"]').map((_, el) => $(el).val()).get().join(',');
  const dietHistory = $('[name="diet_history"]').map((_, el) => $(el).val()).get().join(',');
  const requestClinic = $('[name="clinic_shop"]').val();
  const isClinicListError = $('[name="clinic_shop"]').attr('data-clinic-list-error') !== undefined;
  const isCalendarError = $('[data-tc-is-error]').length > 0;

  const dateInputs = $('[name="date_1"]').toArray(); // 選択順=希望順（第1〜第3）
  const [d1, d2, d3] = dateInputs;

  const botBasicId = $('[name="bot_basic_id"]').val().trim();
  const errorCodes = [];
  isCalendarError && errorCodes.push('E01_カレンダー表示');
  isClinicListError && errorCodes.push('E02_店舗表示');

  const varMapping = {};

  switch (botBasicId) {
    case '897vblrf': // @form25
      varMapping['2184987'] = gender;
      varMapping['2184988'] = age;
      varMapping['2184994'] = bodyParts;
      varMapping['2460256'] = dietHistory;
      varMapping['2184995'] = '夏の3大特典';
      varMapping['2504096'] = 'sururim_walk_v1';

      if (!isClinicListError) {
        varMapping['2184547'] = $('[name="area"]:checked').val();
        varMapping['2184548'] = requestClinic;
      }

      if (!isClinicListError && !isCalendarError) {
        [d1, d2, d3].forEach((el, i) => {
          if (!el) return;
          const $el = $(el);
          const [date, time] = $el.val().split(' ');
          varMapping[['2184549','2349620','2433744'][i]] = formatDate(date, 'MM月DD日(dow)');
          varMapping[['2184551','2349621','2433745'][i]] = time;
        });
      }
      break;
  }

  varMapping['errorCodes'] = errorCodes; // ← 送信キーは要確認（§10）

  $('.js-cta-link').each((_, element) => {
    const $link = $(element);
    const url = new URL($link.attr('data-href'));
    Object.keys(varMapping).forEach((key) => {
      url.searchParams.set(`var_${key}`, varMapping[key]);
    });
    $link.attr('href', url.toString());
  });
};
```

- `is_update_disabled` は付与しない（`coding-js.md` §5-4）。
- `botBasicId` の `switch` case 値・`varMapping` のキーは input の `CONFIG.VAR_IDS`
  （`897vblrf` / 各 ID）を**そのまま採用**する。クライアント指定の実在 ID のため改変しない。
  本番投入前に L-Step 側の変数 ID と最終一致確認が必要（§10）。

---

## 8. ID → class/data 置換表（実装確定版）

| input | output |
|---|---|
| `#app` | `.story` (Block) + `.js-story` |
| `#stage` | `.stage` + `.js-stage` |
| `#bgstrip` | `.stage__bgstrip` + `.js-bgstrip` |
| `#girl` | `.girl` + `.js-girl` |
| `#fatCounter` | `.stage__fat-counter` + `.js-fat-counter`（表示切替は `.is-show`） |
| `#gate` | `.gate` + `.js-gate` |
| `#startSound` / `#startMute` | `.gate__btn-sound` / `.gate__btn-mute`、共通で `.js-gate-start[data-sound="1\|0"]` |
| `#pop` | `.pop` + `.js-pop`（表示切替は `.is-show`） |
| `#banner` | `.banner` + `.js-banner`（`.bn__*` は `.banner__*` にリネーム） |
| `#timer` | `.stage__timer` + `.js-timer` |
| `#syringe` | `.stage__syringe` + `.js-syringe`（`.in`/`.jab` → `.is-in`/`.is-jab`） |
| `#flash` | `.stage__flash` + `.js-flash` |
| `#muteBtn` | `.hud__btn` + `.js-mute-btn` |
| `.choices button.opt`（動的生成） | `<label class="choices__item opt"><input type="radio\|checkbox" class="opt__input">…</label>`（`coding-form-input.md` 準拠） |
| `.choices .tapNext` | `.choices__tap-next` |
| `.choices .multiOk` | `.choices__multi-ok` |
| `.cal`（自作カレンダー一式） | 廃止。`time-calendar-sync` モジュールに置換（§5-3） |
| 状態クラス `.sel`/`.done`/`.show`/`.flip`/`.on`/`.bob`/`.idle` | すべて `.is-selected`/`.is-done`/`.is-show`/`.is-flip`/`.is-on`/`.is-bob`/`.is-idle` に統一 |

`js-*` フッククラスは既存の `id` セレクタから移行する分を新設し、それ以外の id 依存 JS 取得は
すべて `js-*` クラスセレクタへ置き換えた（`coding-css.md` §7: ID セレクタは原則不使用）。
`index.php` / `js/script.js` に `id` 属性は残していない。

---

## 9. 実装ステップ順序

1. `index.php` 雛形コピー＋ `<title>`/`<meta description>` 設定、`<main>` に `.app` 骨格配置（S0ゲートまで表示確認）
2. `css/style.css`: Reset/Base コピー → input の `<style>` を rem 変換しつつ Page セクションへ移植（レイアウト崩れがないか Playwright で確認）
3. `js/script.js`: `BG`/`GIRL`/`FAT`/`PROP`/`SND`/`UI`/`POP` の各モジュールを関数宣言化して移植（演出確認）
4. S1（プロフィール4問）の hidden input 化・`state`/広告計測の組み込み
5. S2（失敗街道）〜S6（GIFT）の移植（データ・演出のみ、フォーム要素なし）
6. S7 予約導線を `sururim_list.php` / `sururim_schedule.php` / `time-calendar-sync` で再実装（§5）
7. S8 CTA を `<a class="js-cta-link">` 化し、`addParamsToCtaUrl` / `postAdCountStatus` を実装（§7）
8. `js/ajax.php` 設置・広告計測エンドポイントの動作確認（ローカルは疎通不可、コード整合のみ確認）
9. `/page-check` で最終チェック（必須コード・JS構造・カレンダー・パフォーマンス）

各 Phase 完了時点でブラウザ動作確認（Playwright MCP）を行う。

---

## 10. オープン項目（ユーザー確認待ち）

1. **エリア ID / BigQuery `area_id` の対応**: `coding-js.md` の 1〜6 対応表と `sururim_calendar_info.area_id`
   の実データが一致しているか、本番導入前に確認が必要。「関西」→「近畿地方」表記変更も含め確認したい。
2. **`couponSettings`（時間帯クーポン）の要否**: input には日時クーポンの概念がないため、仮に
   「7日間・全時間帯クーポン」を設定した。本番で日時クーポン運用が不要なら `couponSettings` を
   どう扱うか（最小構成のダミー値のままでよいか）確認したい。
3. **errorCodes の送信キー**: `coding-js.md` のテンプレ例では `varMapping['XXXXXXX'] = errorCodes;`
   のように専用の L-Step 変数 ID を割り当てる想定だが、input の `CONFIG.VAR_IDS` にはエラーコード用の
   ID が存在しない。新規に ID を発行してもらうか、送信を割愛してよいか確認したい。
4. **L-Step 変数 ID の最終確認**: `CONFIG.VAR_IDS`（`897vblrf` 用）は input に記載された値をそのまま
   採用する方針だが、本番の L-Step 設定と一致しているか最終確認をお願いしたい。
5. **`REDIRECT_URL` は使用しない**: 本番では `common.php` の `ad_line_url()` が URL 生成を担うため、
   input の `CONFIG.REDIRECT_URL` の仕組みは丸ごと不要になる想定。問題なければこの前提で進める。
6. **`isCouponTime` / `isToday` の変数ID**: `addParamsToCtaUrl` は calendar-spec.md の必須構造に従い
   第1希望日時のクーポン対象・当日希望フラグを計算しているが、対応する L-Step 変数 ID が
   `CONFIG.VAR_IDS` に存在しない。現状は `varMapping['isCouponTime']` / `varMapping['isToday']`
   という暫定キーのまま送信している。本番投入前に ID を発行するか、送信を割愛するか確認したい。
