---
paths:
  - "**/time-calendar-sync/**"
  - "output/form_line/**/js/script.js"
  - "output/form_line/**/index.php"
  - "template/form_line/**"
---

# カレンダーモジュール仕様書 (time-calendar-sync)

`template/form_line/calendar-lp/js/time-calendar-sync/` の利用リファレンス。
現行コードの範囲でできることと、現行レスポンスデータで実現できる実装を整理する。

---

## 1. 概要

選択した医院 ID をサーバーに渡し、紐づく予約可能日時を取得してカレンダー形式で表示する ESM モジュール。

- **依存**: jQuery (global `$` が必須)、`structuredClone` (ブラウザネイティブ)
- **配置場所**: `template/form_line/calendar-lp/js/time-calendar-sync/` をプロジェクトごとにそのままコピーして使用
- **エントリポイント**: `export function embedTimeCalendar(config)` 1 つのみ
- **読み込み**: `<script type="module">` または `import` で取り込む

---

## 1-1. 責務分離の方針

**カレンダーの `main.js` はカレンダーと選択した希望日時リストの生成・操作のみに専念する**。
ページに依存するロジック（送信ボタン・バリデーション・遷移制御など）は **読み込み側のスクリプト (`script.js` 等) で実装する**。

- ✅ `main.js` の責務（モジュール側 / 全案件共通）
  - 月／週グリッドの描画、日時セルのクリック・選択状態管理
  - 希望日時リスト（`.pref` 行）の描画と時間セレクトの制御
  - 選択結果を hidden input (`.js-tc-hidden-input`) に反映し `change` イベントを発火する

- ❌ `main.js` に **含めない** もの
  - 「次へ」「送信」ボタンの DOM 生成・クリックハンドラ
  - 入力チェック・件数チェックなどのバリデーション
  - フロー前進・モーダル表示など案件固有の UI 制御

- ✅ 読み込み側 (`script.js`) の責務（案件固有）
  - 「次へ」ボタンの設置・スタイリング・クリック時の挙動
  - 「第1・第2希望の両方が必須」など案件固有のバリデーション
  - 必要件数を満たしたかどうかでボタンの `disabled` を切り替える等の制御
  - hidden input の `change` イベントを購読して判定する

### 実装例：script.js 側で「次へ」ボタンを設置し、第1・第2希望を必須にする

```js
// script.js
const cal = embedTimeCalendar({ parentSelector: '#js-time-calendar-1', ... });
cal.init();
await cal.createCalendar({ params: { clinicId: 1, days: 21 } });

// 「次へ」ボタンをカレンダーの外に設置（案件固有 UI）
const $nbw = $('<div class="nbw"><button id="calDone" disabled>次へ</button></div>');
$nbw.insertAfter('#js-time-calendar-1');

// バリデーション：第1・第2希望が両方入力されるまで disabled を維持
const REQUIRED = 2;
const getFilled = () =>
  $('#js-time-calendar-1 .js-tc-hidden-input').toArray()
    .map((el) => $(el).val())
    .filter((v) => v !== '');

$('#js-time-calendar-1').on('change', '.js-tc-hidden-input', () => {
  $nbw.find('#calDone').prop('disabled', getFilled().length < REQUIRED);
});

$nbw.on('click', '#calDone', () => {
  // 送信処理 / フロー前進
});
```

> 案件ごとに必須件数・ボタンの形・遷移先が変わるため、`main.js` には書かないこと。
> `main.js` を案件都合で書き換えると、他案件にコピーした際にデグレを誘発する。

---

## 2. 同梱ファイル

| ファイル | 役割 |
|---|---|
| `main.js` | モジュール本体。`embedTimeCalendar` をエクスポート |
| `style.css` | カレンダー UI のスタイル。`<link>` で別途読み込む |
| `dummy-data.json` | 本番 API レスポンスのダミー。ローカル開発時に使用 |
| `img/icon__schedule-available.svg` | ◎ アイコン (style.css 側はコメントアウト中 / 将来拡張用) |
| `img/icon__schedule-pending.svg` | △ アイコン (同上) |
| `img/icon__schedule-unavailable.svg` | × アイコン (同上) |
| `img/icon__schedule-coupon.svg` | クーポン対象アイコン (アクティブに使用) |
| `img/icon__arrow-left.svg` | 週送りナビの左矢印 |
| `img/icon__arrow-right.svg` | 週送りナビの右矢印 |
| `img/icon__close.svg` | 選択クリアボタンのアイコン |

---

## 3. 公開 API

### 3-1. `embedTimeCalendar(config)` — シグネチャ

```js
import { embedTimeCalendar } from './time-calendar-sync/main.js';

const cal = embedTimeCalendar({
  parentSelector,    // 必須: ルート要素の ID セレクタ (例: '#time-calendar')
  checkBoxAttrName,  // 必須: hidden input の name 属性名 (例: 'date_1')
  scheduleFetchUrl,  // 必須: スケジュール取得 URL (文字列)
  options,           // 省略可: 下表参照
});
```

### 3-2. `options` 一覧

| キー | 型 | デフォルト | 説明 |
|---|---|---|---|
| `maxSelectedDate` | number | `1` | 第 N 希望まで選択可能にする。`2` なら第 1・第 2 希望を選択できる |
| `showSlotCount` | boolean | `false` | セル内に空き枠数 (`count`) を表示する |
| `useScheduleDummyData` | boolean | `false` | `true` または `hostname === '127.0.0.1'` でダミーデータ使用 |
| `couponSettings` | object | なし | **必須実装**。クーポン枠を有効にする場合に指定 (省略でクーポン機能 OFF) |
| `couponSettings.showStartDays` | number | — | クーポン対象開始 (何日後から) |
| `couponSettings.showDays` | number | — | クーポン対象日数 |
| `couponSettings.showTimeList` | string[] | — | クーポン対象の時刻リスト (`isAllTimeCoupon: false` の場合に使用) |
| `couponSettings.isAllTimeCoupon` | boolean | `false` | `true` で全時間帯クーポン扱い |

> `couponSettings` を指定する場合は `showStartDays` / `showDays` / `showTimeList` の 3 つが必須。

### 3-2-1. `couponSettings` 詳細仕様（必須実装）

**このモジュールを組み込むすべての LP で `couponSettings` を必ず指定すること。**  
省略するとクーポン機能が OFF になり、`data-tc-is-coupon-day` / `data-tc-is-coupon-time` 属性が正しく設定されない。

#### クーポン対象日の決定 (`showStartDays` / `showDays`)

```
スケジュールデータの先頭から数えて
showStartDays 日目 〜 showStartDays + showDays - 1 日目
```

例: `showStartDays: 0, showDays: 7` → 最初の 7 日間がクーポン対象日

カレンダーの日付 checkbox に `data-tc-is-coupon-day="true"` が付与される。  
script.js 側での読み取り:
```js
$('[name="date_1"]:checked').attr('data-tc-is-coupon-day') === 'true'
```

#### クーポン対象時間の決定 (`isAllTimeCoupon` / `showTimeList`)

| `isAllTimeCoupon` | 挙動 |
|---|---|
| `true` | クーポン対象日の **全時間** を対象。`showTimeList` は空配列 `[]` でよい |
| `false` | `showTimeList` に含まれる時間のみ対象 |

時間 select の option タグに `data-tc-is-coupon-time="true"` が付与される。  
script.js 側での読み取り:
```js
$('[name="date_1_time_1"] option:selected').attr('data-tc-is-coupon-time') === 'true'
```

#### `showTimeList` のフォーマット

API レスポンスの `timeSlots` キーと **完全一致** させること。  
形式: `"H:MM"` (ゼロ埋めなし)。30分刻みにも対応。

```js
// 正しい例
showTimeList: ['9:00', '9:30', '10:00', '10:30']

// NG（ゼロ埋めは一致しない）
showTimeList: ['09:00', '09:30']
```

#### 実装パターン早見表

```js
// パターン A: 全時間帯クーポン（推奨）
couponSettings: {
  isAllTimeCoupon: true,
  showStartDays: 0,   // 今日から
  showDays: 7,        // 7日間
  showTimeList: [],   // isAllTimeCoupon: true なので不要
}

// パターン B: 特定時間のみクーポン
couponSettings: {
  isAllTimeCoupon: false,
  showStartDays: 0,
  showDays: 14,
  showTimeList: ['9:00', '9:30', '10:00'], // この時間帯のみ対象
}
```

### 3-3. 返却値 `{ init, createCalendar }`

| メソッド | 用途 |
|---|---|
| `init()` | 骨格 DOM (body / loading / message / navigator + リスト枠) を描画する。ページ初期化時に 1 回呼ぶ |
| `createCalendar({ params: { clinicId, days? } })` | フェッチ → バリデート → カレンダー描画 まで実行 (async)。医院選択変更のたびに呼ぶ |

`createCalendar` の引数:

| キー | 型 | デフォルト | 説明 |
|---|---|---|---|
| `clinicId` | string \| number | 必須 | 医院 ID。リクエストボディの `clinic_id` にセットされる |
| `days` | number | `21` | 取得するスケジュール日数 (21 日 = 3 週が標準) |

---

## 4. HTML 側の必要コンテナ

`parentSelector` で指定した要素の直下に `.js-tc` と `.js-tc-list` を **事前配置** しておくこと。モジュールはこれらを起点に内部 DOM を描画する。

```html
<!-- parentSelector: '#time-calendar' の場合 -->
<div id="time-calendar">
  <div class="js-tc"></div>
  <div class="js-tc-list"></div>
</div>
```

---

## 5. 利用例

### 5-1. インスタンス作成と初期化

```html
<!-- style -->
<link rel="stylesheet" href="../../time-calendar-sync/style.css">

<!-- HTML コンテナ (parentSelector 直下に .js-tc と .js-tc-list が必要) -->
<div id="js-time-calendar-1">
  <div class="js-tc"></div>
  <div class="js-tc-list"></div>
</div>
<!-- hidden input はモジュールが自動生成するため HTML 側には不要 -->
```

```js
import { embedTimeCalendar } from '../../js/time-calendar-sync/main.js';

// fetchUrl は new URL() で組み立てる (文字列直書き禁止)
const fetchUrl = new URL(
  '/js/schedule.php',
  window.location.origin,
);

// カレンダーインスタンス作成
const embedTimeCalendarInstance = embedTimeCalendar({
  parentSelector: '#js-time-calendar-1',
  checkBoxAttrName: 'date_1',
  scheduleFetchUrl: fetchUrl,
  options: {
    couponSettings: {
      isAllTimeCoupon: true,  // 全時間帯をクーポン対象にする
      showStartDays: 0,       // 今日から
      showDays: 7,            // 7 日間
      showTimeList: [],       // 空配列 = isAllTimeCoupon が true なので不要
    },
  },
});

embedTimeCalendarInstance.init();
```

医院選択後に `createCalendar` を呼ぶ:

```js
// クリニック <select> の change イベントなどで呼び出す
await embedTimeCalendarInstance.createCalendar({
  params: { clinicId: selectedClinicId, days: 21 },
});
```

### 5-2. 選択データの取得

カレンダーで選択された値は hidden input (`[name="<checkBoxAttrName>"]`) の値と `data-tc-*` 属性から取得する。具体的な参照コード・属性一覧・エラー判定・errorCodes の組み立て例は §10 (外部 JS との連携) と §11 (エラーハンドリング) を参照。

---

## 6. リクエスト仕様

### 6-1. 本番リクエスト

| 項目 | 値 |
|---|---|
| メソッド | `POST` |
| ヘッダー | `Content-Type: application/json` |
| ボディ | `{ "clinic_id": clinicId, "days": days }` |

> 引数 `clinicId` は内部で `clinic_id` に詰め替えられる。

### 6-2. ダミーモード

以下いずれかの条件でダミーデータに切り替わる:

| 条件 | 動作 |
|---|---|
| `window.location.hostname === '127.0.0.1'` | 同ディレクトリの `dummy-data.json` を GET |
| `options.useScheduleDummyData === true` | 同上 |

ローカル開発中は `useScheduleDummyData: true` を渡すのが最も確実。

---

## 7. レスポンス仕様

### 7-1. スキーマ

```ts
interface CalendarResponse {
  clinicName: string;              // クリニック名
  businessHours: {                 // 営業時間 ※現在未使用
    open: number;                  //   24h 表記の時 (例: 9)
    close: number;                 //   24h 表記の時 (例: 20)
  };
  timeSlots: string[];             // 画面表示する時間範囲 (カレンダーの時刻軸)
                                   //   形式: "H:MM" (ゼロ埋めなし, 30 分刻み)
                                   //   例: ["9:00", "9:30", "10:00", ...]
  schedules: DaySchedule[];        // 日付ごとのスケジュールデータ (21 日分 = 3 週)
}

interface DaySchedule {
  date: string;           // "YYYY/MM/DD" (スラッシュ区切り, ゼロ埋めあり)
  isHoliday: 0 | 1;       // 休日フラグ
  isClosed: 0 | 1;        // 休診日フラグ
  isScheduleFull: 0 | 1;  // 予約満席フラグ (日単位)
  slots: {
    [time: string]: {     // key は timeSlots と同じ "H:MM"
      count: number;      // 空き枠数 (showSlotCount: true で表示)
      symbol: 1 | 2 | 3;  // 記号番号: 1=× / 2=△ / 3=◎
    };
  };
}
```

### 7-2. 各フィールドの意味

| フィールド | 意味 | 備考 |
|---|---|---|
| `clinicName` | クリニック名 | レスポンスに clinic_id は含まれない |
| `businessHours` | 営業時間 | **現在未使用**。将来拡張用 |
| `timeSlots` | 画面表示する時間範囲 | カレンダーの縦軸 (時刻列) を決定する |
| `isHoliday` | 休日フラグ | `1` の場合、曜日列に休日スタイルが適用される |
| `isClosed` | 休診日フラグ | `1` の場合、日全体が予約不可 (`is-disallow`) になる |
| `isScheduleFull` | 予約満席フラグ | `1` の場合、日全体が選択不可になる |
| `slots[t].count` | 空き枠数 | `showSlotCount: true` でセル内に表示 |
| `slots[t].symbol` | 記号番号 | **1=× / 2=△ / 3=◎** (下表参照) |

### 7-3. symbol と表示状態の対応

| symbol | 記号 | アイコン (SVG) | セルの状態 | 意味 |
|---|---|---|---|---|
| `1` | × | `icon__schedule-unavailable.svg` | `is-disallow` / 予約不可 | 満席・受付終了など |
| `2` | △ | `icon__schedule-pending.svg` | `is-allow` (残枠わずか) | 残枠あり (少) |
| `3` | ◎ | `icon__schedule-available.svg` | `is-allow` (空き十分) | 残枠あり (十分) |

> アイコン SVG の有効化方法 (style.css の ::before コメントアウト解除) は §12 を参照。

### 7-4. 日付・時刻の形式

| 値 | 形式 | 例 |
|---|---|---|
| `date` | `YYYY/MM/DD` (スラッシュ区切り、ゼロ埋めあり) | `"2026/04/23"` |
| `timeSlots` / `slots[t]` のキー | `H:MM` (ゼロ埋めなし) | `"9:00"`, `"10:30"` |
| hidden input に入る値 | `YYYY-MM-DD HH:mm` (ハイフン区切り、ゼロ埋めあり) | `"2026-04-23 10:00"` |

---

## 8. 描画される DOM 構造

### 8-1. 全体ツリー

```
#time-calendar  (parentSelector)
├─ .js-tc                                 ルートコンテナ
│  ├─ .js-tc-body__body                   縦スクロール枠 (max-height: 310px)
│  │  ├─ .js-tc-body__scroll-sentinel     スクロール最下部検知用ダミー
│  │  └─ .js-tc-body__body-inner          flex row
│  │     ├─ .js-tc-body__time-warp        時刻列 (sticky 左端)
│  │     │  ├─ .js-tc-body__time-item-blank   左上角の空セル (sticky 上端)
│  │     │  └─ .js-tc-body__time-item     時刻ラベル (height 40px / .is-tall 50px)
│  │     └─ .js-tc-body__table-warp       日付グリッドエリア
│  │        └─ .js-tc-body__table         1 週ごとにスライドする横並びコンテナ
│  │           └─ .js-tc-body__table-item 1 週分のまとまり
│  │              └─ .js-tc-body__table-column  1 日の縦列 (7 等分)
│  │                 ├─ .js-tc-body__table-cell-day    曜日・日付ヘッダ (sticky 上端)
│  │                 └─ .js-tc-body__table-cell        時間スロットセル
│  │                    ├─ .js-tc-body__table-cell-inner       丸角枠
│  │                    ├─ .js-tc-body__table-cell-count       空き枠数テキスト
│  │                    └─ .js-tc-body__table-cell-selected-num 選択番号バッジ
│  ├─ .js-tc-loading / __inner            ローディングスピナー
│  ├─ .js-tc-message / __inner / __em-text  エラー・空メッセージ
│  └─ .js-tc-navigator                    週送りナビ (表示専用 / クリックは LP 側で実装)
│
└─ .js-tc-list                            下部「選択中日時」リスト
   └─ .js-tc-list__item
      ├─ .js-tc-list__title               ラベル (第N希望日時)
      └─ .js-tc-list__content
         └─ .js-tc-list__content-inner
            ├─ .js-tc-list__value         選択値テキスト
            │  └─ .js-tc-list__coupon     クーポンアイコン
            └─ .js-tc-list__clear-btn
               └─ .js-tc-list__clear-btn-icon  クリアボタン (close.svg)

   .js-tc-hidden-input (name="date_1")    hidden input (js-tc-list 内に生成)
```

### 8-2. 状態クラス一覧

| クラス | 付与対象 | 意味 |
|---|---|---|
| `is-tall` | `.js-tc-body__time-warp`, `.js-tc-body__table-cell` | セル高を 40px → 50px に拡張 (枠数表示時) |
| `is-sat` | `.js-tc-body__table-column` | 土曜日 (青系) |
| `is-sun` / `is-holiday` | `.js-tc-body__table-column` | 日曜・祝日 (赤系) |
| `is-allow` | `.js-tc-body__table-cell` | クリック可 (予約可のセル) |
| `is-disallow` | `.js-tc-body__table-cell` | 予約不可 (斜線ハッチング) |
| `is-checked` | `.js-tc-body__table-cell` | 選択済み (LINE グリーン `#06c755`) |
| `is-disabled` | `.js-tc-body__table-cell` | 選択上限到達後の未選択セルを無効化 |
| `is-coupon` | `.js-tc-body__table-cell` | クーポン対象枠 |
| `is-visible` | `.js-tc-loading`, `.js-tc-message` | 表示 ON (フェードイン) |
| `is-scroll-end` | `.js-tc-body__body` | 縦スクロール最下部到達 |

### 8-3. `data-tc-*` 属性一覧

> hidden input (`.js-tc-hidden-input`) に付与される属性の外部 JS 利用例は §10-1 を参照。

| 属性 | 付与対象 | 値の形式 | 意味 |
|---|---|---|---|
| `data-tc-date` | `.js-tc-body__table-cell`, `.js-tc-list__clear-btn`, `.js-tc-hidden-input` | `"YYYY-MM-DD HH:mm"` | セルまたは選択済み枠の日時 |
| `data-tc-is-coupon-time` | `.js-tc-body__table-cell`, `.js-tc-hidden-input` | `'true'` \| `'false'` \| `''` | クーポン対象日時かどうか |
| `data-tc-is-today` | `.js-tc-hidden-input` | `'true'` \| `'false'` \| `''` | 選択日が初日 (レスポンスの `schedules[0].date`) と一致するか |
| `data-tc-is-error` | `$parent` (parentSelector の要素) | `''` (値なし) | フェッチまたはバリデーションエラー時に付与 |

---

## 9. ユーザ操作

### 9-1. セルクリック (選択 / 解除)

- `.is-allow` のセルのみクリック可能 (`.is-disallow` / `.is-disabled` は無効)。
- 未選択セルをクリック → `is-checked` を付与し hidden input に日時をセット。
- 選択済みセルをクリック → `is-checked` を除去し hidden input を空文字に。
- `maxSelectedDate: 1` (デフォルト) では 1 つ選んだ時点で他の `is-checked` をリセット。
- 選択上限 (`maxSelectedDate`) に達すると未選択セルに `is-disabled` を付与し操作を封じる。
- 選択のたびに `.js-tc-hidden-input` へ `change` イベントを発火する。

### 9-2. 第 N 希望モード

`maxSelectedDate: 2` 以上の場合:
- 選択順にバッジ番号 (`.js-tc-body__table-cell-selected-num`) が付く。
- `.js-tc-list` に「第 1 希望日時」「第 2 希望日時」…と順に表示。
- hidden input は `maxSelectedDate` 個生成される (すべて `name="date_1"`)。

### 9-3. クリアボタン

`.js-tc-list__clear-btn` クリックで `data-tc-date` と同じ日時の選択を解除し、hidden input を空文字にリセットする。

### 9-4. 週送りナビ (`.js-tc-navigator`)

DOM は生成されるが、**現行 `main.js` 側には週送りのクリックハンドラが実装されていない**。週の切り替えは CSS 変数 `--calendar-slide-num` を外部 JS から操作する方式 (LP 側で独自実装が必要)。

---

## 10. 外部 JS との連携

### 10-1. hidden input の値

> hidden input を含む全 `data-tc-*` 属性の一覧は §8-3 を参照。

| 属性 | 値の形式 | 例 |
|---|---|---|
| `name` | `checkBoxAttrName` で指定した値 | `"date_1"` |
| `value` | `"YYYY-MM-DD HH:mm"` | `"2026-04-23 10:00"` |
| `data-tc-is-coupon-time` | `'true'` or `'false'` | クーポン対象かどうか |
| `data-tc-is-today` | `'true'` or `'false'` | 選択日が当日 (最初の予約可能日) かどうか |

### 10-2. `change` イベント

日時を選択または解除するたびに `.js-tc-hidden-input` で `change` イベントが発火する。`script.js` 側でリッスンする場合:

```js
$('[name="date_1"]').on('change', () => {
  const dateTime = $('[name="date_1"]').val();
  const formattedDateTime = formatDate(dateTime, 'M月D日(dow) h:mm');

  const isCouponTime =
    $('[name="date_1"]').attr('data-tc-is-coupon-time') === 'true';
  const isToday =
    $('[name="date_1"]').attr('data-tc-is-today') === 'true';
  const isCalendarError = $('[data-tc-is-error]').length > 0;
  // ...
});
```

### 10-3. `script.js:addParamsToCtaUrl` が参照する属性

`addParamsToCtaUrl` は以下の属性を読み取る。カレンダーモジュールが付与するこれらの値は **改変しない**。

| 取得コード | 用途 |
|---|---|
| `$('[name="date_1"]').val()` | 選択日時 (`"YYYY-MM-DD HH:mm"`)。`formatDate()` でフォーマットして varMapping にセット |
| `$('[name="date_1"]').attr('data-tc-is-coupon-time') === 'true'` | `'日時特典あり'` / `'日時特典なし'` を varMapping にセット |
| `$('[name="date_1"]').attr('data-tc-is-today') === 'true'` | `'当日希望'` を varMapping にセット (当日のみ) |
| `$('[data-tc-is-error]').length > 0` | `isCalendarError` — エラー時は日時パラメータを CTA URL に追加しない |
| `$('[data-recommend-date-error]').length > 0` | `isRecommendDateError` — おすすめ日時のエラー判定 (カレンダーとは独立) |

エラー時のエラーコード管理例:

```js
const errorCodes = [];
isCalendarError      && errorCodes.push('E01_カレンダー表示');
isRecommendDateError && errorCodes.push('E03_おすすめ表示');
```

---

## 11. エラーハンドリング

### 11-1. エラー時の挙動

| 条件 | 処理 |
|---|---|
| フェッチ失敗 (`response.ok === false`) | `throw new Error(...)` → catch へ |
| ネットワーク障害 / JSON パース失敗 | `catch` で捕捉 |
| バリデーション失敗 (レスポンス構造不正) | `catch` で捕捉 |

`catch` 内で実行される処理:
1. `.js-tc-message` を `is-visible` にしてエラー文言を表示
2. `$parent` (parentSelector の要素) に `data-tc-is-error=""` を付与
3. `console.error(e)`

### 11-2. 外部 JS からのエラー判定

`$('[data-tc-is-error]').length > 0` で真ならカレンダーはエラー状態。CTA URL には日時パラメータを追加しない。参照箇所と用途は §10-3 の表を参照。

### 11-3. エラー時の進行許可（利用側 LP の必須要件）

カレンダーフェッチ失敗で完全ストップさせず、ユーザーが **CTA（LINE 追加等）まで到達できる導線** を必ず残す。

| 項目 | 要件 |
|---|---|
| エラー文言 | モジュール側 (`.js-tc-message`) が表示するため、利用側 LP は **追加文言を出さない** |
| 後段の進行ボタン（次へ等） | `[data-tc-is-error]` を判定し、エラー時は活性化して **日時未選択でも次ステップへ進める分岐** を持つ |
| 進行時の値の扱い | 日時系の値は空のまま `addParamsToCtaUrl` に渡される（§10-3 の `isCalendarError` 分岐でスキップされる） |

### 11-4. 第3希望以降の時間絞り込み（モジュール仕様）

`maxSelectedDate >= 3` の場合、**第3希望以降（行 index >= 2）の時間 `<select>`** は以下のオプション構成で生成される。

| オプション | 値 | 備考 |
|---|---|---|
| 時間（プレースホルダ） | `value=""` | 全行共通の未選択状態 |
| 【指定しない】 | `value="【指定しない】"` | 第3希望以降のみに付与される明示的な「指定しない」選択肢 |
| 時間枠 | スロットデータの `time` | **16:00〜17:30 の枠のみ**（範囲外はスキップ）。`symbol === 1` は `disabled`、slots に存在しない時間はスキップ |

**目的**: 第1・第2希望の時間帯を優先的に押さえつつ、第3希望以降は土日祝・夕方の人気枠を埋める or 「指定しない」で柔軟性を持たせる運用設計に対応する。

**注記**:
- 第1希望・第2希望（行 index 0, 1）は従来どおり全枠を表示する
- 「【指定しない】」を選択した場合、`<select>` の `.val()` は `'【指定しない】'` 文字列が返る（CTA URL にもそのまま載る）
- 範囲（16:00〜17:30）はモジュール内の固定値。LP 案件側でこの範囲を変更したい場合は別途オプション化を検討すること

### 11-5. 日付セルの状態と選択可否（モジュール仕様）

カレンダー本体は、各日付セルについて以下の状態判定を行う。**月ナビゲーション以外、利用側 LP で挙動を変えてはならない**。

| 状態 | 判定条件 | 選択可否 | ラベル表示 |
|---|---|---|---|
| 過去 | 当日より前の日付 | ❌ | なし |
| 休診 | `schedules[i].isClosed === 1` | ❌ | **`休診`** を表示（必須） |
| 満席 | `schedules[i].isScheduleFull === 1` または scheduleMap に該当データなし | ❌ | **`満席`** を表示（必須） |
| データ範囲外 | `schedules[最後].date` より後の日付 | ❌ | なし |
| 選択可能 | 上記いずれにも該当しない | ✅ | なし |

**判定の優先順位**（else if チェーン）: 過去 → 休診 → 満席 → データ範囲外  
（過去で同時に休診・満席条件を満たしても「過去」として扱う）

**ラベル文言の固定ルール**:
- 休診セルには `休診` の文言を必ず表示する
- 満席セルには `満席` の文言を必ず表示する
- 文言の変更・省略・別名化（例: `closed` / `Full` 等）は **NG**

### 11-6. 時間オプションの状態と選択可否（モジュール仕様）

時間 `<select>` の各 `<option>` について、スロットデータから以下のように生成する。

| 状態 | 判定条件 | 描画 |
|---|---|---|
| 営業外 | `slots[time]` が `undefined` | `<option>` を生成しない（スキップ） |
| 不可（満員/×） | `slots[time].symbol === 1` | `<option>` を生成し `disabled` を付与 |
| 選択可能 | 上記以外 | 通常の `<option>` として生成 |

**注記**:
- 第1・第2希望は全 `timeSlots` を対象、第3希望以降は §11-4 の絞り込みが適用される
- クーポン対象判定（`isCouponTime` / `isCouponDay && isAllTimeCoupon`）は `data-tc-is-coupon-time` 属性として付与される（選択可否には影響しない）

---

## 12. カスタマイズ範囲

### ✅ 変更 OK

| 対象 | 内容 |
|---|---|
| `options.maxSelectedDate` | 第 N 希望の選択数 |
| `options.showSlotCount` | 空き枠数の表示 ON/OFF |
| `options.useScheduleDummyData` | ダミーデータの使用 |
| `options.couponSettings` | クーポン対象の設定 |
| `style.css` テーマ色 | `#EF4B7D` (ローダー/バッジ/リスト文字)、`#06c755` (選択セル)、`#ff2c37` (クーポン) |
| `style.css` セル高 | `.js-tc-body__table-cell { height }` と `.is-tall` を合わせて変更 |
| `style.css` 曜日色 | `.is-sat` / `.is-sun` / `.is-holiday` の背景・文字色 |
| ラベル文言 | `main.js` 内の `'希望日時'` / `'第N希望日時'` |
| エラーメッセージ文言 | `main.js:1001` 付近のエラー文言 |
| アイコン SVG | `img/*.svg` を差し替え |
| アイコン ::before の有効化 | `style.css` の `.is-available` / `.is-pending` / `.is-unavailable` のコメントアウトを外せばアイコン表示可能 |

### ❌ 変更 NG (コアロジック)

| 対象 | 理由 |
|---|---|
| 週は 7 日固定 (`width: calc(100%/7)`) | JS 側の日付生成ロジックと CSS が依存 |
| `validateFetchedScheduleData` | レスポンスの正当性検証。変えると壊れる |
| `fetchScheduleWithSetData` | フェッチ本体 |
| `createTable` / `updateSelectedDate` | DOM 生成・更新コアロジック |
| `addEventListener` | 内部イベント管理 |
| `embedStyleTag` | セル幅などのハードコードスタイルを動的注入 |
| `data-tc-*` 属性名 | `script.js:addParamsToCtaUrl` と連携しているため変更不可 |
| hidden input の `name` と値の形式 | `addParamsToCtaUrl` が `[name="date_1"]` で参照 |

---

## 13. ダミーデータで実現可能な範囲

ダミーデータ (`dummy-data.json`) で表現されている状態:

| 機能 | 実現可否 |
|---|---|
| `symbol=1 (×)` の予約不可セル表示 | ✅ ダミー内に出現 |
| `symbol=2 (△)` の残枠わずかセル表示 | ✅ ダミー内に出現 |
| `symbol=3 (◎)` の空き十分セル表示 | ✅ ダミー内に出現 |
| `count` による空き枠数の表示 | ✅ (showSlotCount: true で有効) |
| `isHoliday=1` の休日表示 | ✅ ダミー内に出現 |
| `isClosed=1` の休診日表示 | ✅ ダミー内に出現 |
| `isScheduleFull=1` の満席表示 | ✅ (ダミーは全 0 だがコード上は対応済み) |
| クーポン対象セルの表示 | ✅ `options.couponSettings` を渡せば JS 側で計算 (レスポンスにクーポン専用フィールドは無し) |
| `businessHours` の活用 | ❌ 現在未使用 (将来拡張用) |
| アイコン (◎△×) の SVG 表示 | ⚠️ ファイルはあるが style.css がコメントアウト中。有効化すれば表示可 |

---

## 14. チェックリスト

組み込み時に確認する項目:

- [ ] `<link>` で `time-calendar-sync/style.css` を読み込んでいる
- [ ] jQuery が `embedTimeCalendar` より先に読み込まれている
- [ ] HTML に `parentSelector` 直下の `.js-tc` と `.js-tc-list` が存在する
- [ ] `parentSelector` は **ID セレクタ** (`#` 始まり) になっている
- [ ] `checkBoxAttrName` が `addParamsToCtaUrl` で参照する `name` 属性名と一致している (例: `'date_1'`)
- [ ] `scheduleFetchUrl` は `new URL('/js/...', window.location.origin)` 等で適切に組み立てている
- [ ] `cal.init()` を 1 回呼んでから `cal.createCalendar(...)` を呼んでいる
- [ ] 医院選択が変わるたびに `createCalendar` を呼び直している
- [ ] エラー時 (`$('[data-tc-is-error]').length > 0`) に CTA パラメータ生成をスキップしている
- [ ] `[name="date_1"]` の `data-tc-is-coupon-time` / `data-tc-is-today` を `addParamsToCtaUrl` 内で参照している
- [ ] ローカル開発時は `useScheduleDummyData: true` を渡してダミーデータで動作確認している
- [ ] `style.css` のテーマ色をプロジェクトに合わせて上書きしている (必要な場合)

---

## 15. main.js / style.css の改修ガイド

`time-calendar-sync` を案件別 LP にコピーして使う際、UI 要件に合わせて `main.js` と `style.css` を改修することがある。
本セクションでは「改修してよい関数」「改修禁止の関数」と、改修時に必ず維持すべき制約を定める。
案件 (input) に依存しないモジュールとしての契約仕様。

---

### 15-1. 全関数インベントリ（改修可否）

| 関数名 | 行 | 役割 | 改修 |
|---|---|---|---|
| **引数バリデーション** | | | |
| `validateArgument` | 84 | 初期化引数のバリデーション | ❌ NG |
| `validateFetchedScheduleData` | 187 | fetch レスポンスのバリデーション | ❌ NG |
| **ユーティリティ** | | | |
| `escapeHTML` | 264 | HTML エスケープ | ❌ NG |
| `formatDate` | 289 | 日付フォーマット | ❌ NG |
| `isFirstDate` | 331 | スケジュール最初日判定 | ❌ NG |
| `isEveryDateSelected` | 349 | 最大選択数到達判定 | ❌ NG |
| **state 管理** | | | |
| `clearSelectedDate` | 465 | 選択済み日付の初期配列生成 | ❌ NG |
| `updateSelectedDate` | 437 | 選択日付の追加/削除 | ❌ NG |
| `setWeeksCount` | 364 | 週数計算 | ✅ OK |
| **データ加工** | | | |
| `adaptScheduleData` | 405 | クーポンフラグ付与 | ❌ NG |
| `fillSchedulePlaceholders` | 375 | 7日単位にパディング | ✅ OK |
| **DOM 生成・操作** | | | |
| `createTable` | 481 | カレンダー本体の DOM 生成 | ✅ OK |
| `createSelectedList` | 642 | 選択日時リストの HTML 生成 | ✅ OK |
| `initDisplay` | 667 | カレンダー大枠の DOM 初期化 | ❌ NG |
| `initCalendarDisplay` | 692 | カレンダー本体の DOM 挿入 | ✅ OK |
| `embedStyleTag` | 879 | スライド・UI 用の動的 CSS 注入 | ✅ OK |
| **表示更新** | | | |
| `toggleLoadingDisplay` | 705 | ローダー表示切替 | ❌ NG |
| `toggleMessageDisplay` | 714 | メッセージ表示切替 | ❌ NG |
| `updateCalendarCellDisplay` | 766 | セルの選択状態表示更新 | ✅ OK |
| `updateSelectedListDisplay` | 724 | 下部リストの表示更新 | ✅ OK（hidden input 仕様は維持） |
| **イベント** | | | |
| `addEventListener` | 811 | 全イベントリスナー登録 | ✅ OK（`.tc` 名前空間は維持） |
| **fetch** | | | |
| `fetchScheduleWithSetData` | 915 | スケジュール取得・state 格納 | ❌ NG |
| **公開 API** | | | |
| `init` | 1015 | 初期化エントリ | ❌ NG |
| `createCalendar` | 964 | カレンダー生成メイン | ⚠️ 部分的 OK（§15-2 制約 1, 2 参照） |

---

### 15-2. 改修時に必ず維持すべき制約

#### 制約 1: 公開 API の `return` 構造

```js
return {
  init,
  createCalendar,
};
```
返却するキー名・関数参照は **変更禁止**。外部 (`script.js` 等) の `cal.init()` / `cal.createCalendar(...)` 呼び出しと連動するため。

#### 制約 2: `createCalendar` の引数とエラー処理ブロック

`createCalendar` の **try ブロック内の処理ロジックは UI/データ加工要件に応じて変更可**。
ただし以下は **変更禁止**:

```js
const createCalendar = async ({ params }) => {  // ← params 引数構造は変更禁止
  try {
    // ── ここは変更可 ──
    // 例: resetState() / fetchScheduleWithSetData() / fillSchedulePlaceholders() /
    //     adaptScheduleData() / setWeeksCount() / embedStyleTag() /
    //     initCalendarDisplay() / addEventListener() / updateSelectedListDisplay() などの呼び出し順序
  } catch (e) {
    // ↓ catch ブロック全体は変更禁止
    toggleMessageDisplay({
      isVisible: true,
      message: `現在、アクセスが集中しており\nカレンダーが正しく表示されない場合があります。\n\nその際は、<span class="js-tc-message__em-text">日程を入力せずにそのまま予約をお進めください。</span>\n\nご予約後に、トーク画面でご希望の日時をお知らせください。\n（例：12/5 9:00　または　12月10日 13:30 など）\n\nお手数をおかけしますが、確認後スタッフより順次ご連絡いたします🙇‍♀️`,
    });
    $parent.attr('data-tc-is-error', '');
    console.error(e);
  } finally {
    // ↓ finally ブロックも変更禁止
    toggleLoadingDisplay({ isVisible: false });
  }
};
```
- `params` 引数の構造（`{ clinicId, days }` 等）は変更禁止
- catch 内のメッセージ文言・`data-tc-is-error` 属性付与・`console.error(e)` は維持
- finally 内のローディング非表示処理は維持

#### 制約 3: `addEventListener` の `.tc` イベント名前空間

```js
const addEventListener = () => {
  $parent.off('.tc');                        // ← 関数冒頭で必ず実行
  $parent.on('click.tc', '...', handler);    // ← 全イベントは .tc 名前空間で登録
  $parent.on('change.tc', '...', handler);
};
```
- `createCalendar()` 再呼び出し（医院切替時など）でイベント重複を防ぐ仕組み
- イベントの種類・セレクタは UI に合わせて変更可だが、`.tc` 名前空間の使用と `$parent.off('.tc')` は維持必須

#### 制約 4: hidden input の構造

`createSelectedList()` で生成する hidden input は次の構造を必ず維持する:

```html
<input type="hidden"
  name="${checkBoxAttrName}"
  value=""
  data-tc-is-coupon-time=""
  data-tc-is-today=""
  class="js-tc-hidden-input">
```

| 属性 | 役割 | 変更可否 |
|---|---|---|
| `name="${checkBoxAttrName}"` | 外部 `addParamsToCtaUrl` が `[name="date_1"]` 等で参照 | ❌ 名前変更禁止 |
| `value` | 選択日時 `"YYYY-MM-DD HH:mm"`（未選択時は `""`） | ❌ フォーマット固定 |
| `data-tc-is-coupon-time` | クーポン対象時間フラグ（`"true"` / `"false"` / `""`） | ❌ 属性名・値仕様固定 |
| `data-tc-is-today` | スケジュール最初日フラグ（`"true"` / `"false"` / `""`） | ❌ 属性名・値仕様固定 |
| `class="js-tc-hidden-input"` | イベント委譲セレクタ | ❌ クラス名変更禁止 |

UI 形態を変更しても、`createSelectedList()` でこの構造を生成し、`updateSelectedListDisplay()` で値・属性を更新する処理は維持必須。

#### 制約 5: `resetState` の仕組み

```js
const initState = structuredClone(state);
const resetState = () => Object.assign(state, structuredClone(initState));
```
- `createCalendar()` 冒頭で `resetState()` を必ず呼ぶ仕組みは維持
- `structuredClone` による完全な初期化を担保する
- state にプロパティを追加する場合は、`initState` 取得タイミング（state 定義直後）も併せて確認すること

---

### 15-3. 改修 OK な関数の使い方ガイド

| 関数 | 変更してよい範囲 |
|---|---|
| `setWeeksCount` | 週数算出ロジックを UI 要件に応じて変更可（月単位への変更も可） |
| `fillSchedulePlaceholders` | 7日パディングの代わりに月末までパディング等、補填ロジックを変更可 |
| `createTable` | グリッド構造（横スライド・月グリッド等）、セルクラス付与ロジック、HTML 構造全般 |
| `createSelectedList` | 選択リストの表示形式（文言・レイアウト・追加要素）。**ただし制約 4 の hidden input 構造は必ず生成する** |
| `initCalendarDisplay` | カレンダー DOM の挿入先・挿入方法 |
| `embedStyleTag` | スライドや UI に必要な動的 CSS の内容・注入先。不要なら関数内を空にしてよい |
| `updateCalendarCellDisplay` | セルの選択状態・無効状態の表示方法。クラス名は UI 側に合わせて変更可 |
| `updateSelectedListDisplay` | リストの表示・装飾ロジック。**ただし制約 4 の hidden input 値・属性更新処理は維持必須** |
| `addEventListener` | イベントの種類・セレクタを UI に合わせて変更可。**ただし制約 3 の `.tc` 名前空間の仕組みは維持必須** |
| `createCalendar`（try 内のみ） | データ取得後の処理フローは UI に合わせて変更可。**ただし制約 1, 2 を維持** |

---

### 15-4. style.css の改修方針

- 色・フォント・余白・角丸など見た目のスタイルは自由に変更可
- `.cal*` / `.pref*` / `.js-tc-body__*` 等のクラス名は **JS 側のセレクタと連動** しているため、リネームする場合は対応する `addEventListener()` のセレクタも合わせて変更する
- `.js-tc` / `.js-tc-loading` / `.js-tc-message` / `.js-tc-list` / `.js-tc-hidden-input` の各クラス名は **JS 側で固定参照** しているため変更禁止
- アニメーション keyframes (`tcFadeIn`, `spin-1`, `spin-2`) はローダー・メッセージで使用されるため削除禁止
