---
paths:
  - "output/form_line/**/css/**"
  - "output/form_line/**/*.css"
  - "template/form_line/**/css/**"
---

# CSS ルール

### 1. ファイル冒頭と全体構成

- 1 LP = 1 ファイル (`css/style.css`) で完結。分割・@import・プリプロセッサは使わない。
- ファイル先頭は **必ず `@charset "utf-8";`**。
- セクションは下記の順で並べ、`/****** Name ******/` のコメントブロックで区切る:

```
@charset "utf-8";

/************************************
 * Reset
************************************/

/************************************
 * Base
************************************/

/************************************
 * Utility
************************************/

/************************************
 * Page
************************************/

/************************************
 * Animation
************************************/
```

---

### 2. Reset (改変禁止・必ずそのまま使用)

`template/form_line/calendar-lp/css/style.css:3-80` の Reset ブロックを **改変せずそのまま使用** すること。modern-css-reset 系。

```css
/************************************
 * Reset
************************************/
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -moz-text-size-adjust: none;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

body,
h1,
h2,
h3,
h4,
p,
figure,
blockquote,
dl,
dd {
  margin: 0;
}

ul,
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  line-height: 1.5;
}

h1,
h2,
h3,
h4,
button,
input,
label {
  line-height: 1.1;
}

a:not([class]) {
  color: currentColor;
}

img,
picture {
  max-width: 100%;
  display: block;
}

input,
button,
textarea,
select {
  font: inherit;
}

textarea:not([rows]) {
  min-height: 10em;
}

:target {
  scroll-margin-block: 5ex;
}

em {
  font-style: normal;
}
```

---

### 3. Base (改変禁止・必ずそのまま使用)

`template/form_line/calendar-lp/css/style.css:82-244` の Base ブロックを **改変せずそのまま使用** すること。`:root` のフルード rem 設計、`body` のグローバルタイポ、`a / img / input / select / button` のグローバルスタイルを含む。

```css
/************************************
 * Base
 ************************************/
:root {
  --base-width: 375;
  /* 基準幅 */
  --max-width: 600;
  /* 最大幅 */
  --base-font-size: 10;
  /* 基準フォントサイズ (10px) */
  /* 最大横幅サイズ時の最大フォントサイズ */
  --max-font-size: calc((var(--base-font-size) / var(--base-width)) * var(--max-width) * 1px);
}

html {
  /** 以下指定で、横幅が --base-width 時に 1rem が 10pxとなる */
  font-size: min(calc((var(--base-font-size) / var(--base-width)) * 100vw), var(--max-font-size));
  scroll-behavior: smooth;
}

body {
  background: #fff;
  font-family: "Noto Sans JP", sans-serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-style: normal;
  font-size: 1.4rem;
  letter-spacing: 0.1rem;
  -webkit-tap-highlight-color: transparent;
  color: #242424;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: 1.4rem;
}

img,
video {
  width: 100%;
  height: auto;
  vertical-align: bottom;
}

a {
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s;
}

@media (hover: hover) {
  a:hover {
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  button:hover {
    cursor: pointer;
  }

  label:hover {
    cursor: pointer;
  }
}

input,
textarea,
select,
button {
  margin: 0;
  padding: 0;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
  font-size: 1.4rem;
}

input[type="radio"] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  position: relative;
  width: 1.3rem;
  height: 1.3rem;
  margin-right: .5rem;
  border: 2px solid #D8D8D8;
  border-radius: 50%;
  cursor: pointer;
  vertical-align: middle;
}

input[type="radio"]::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: auto;
  width: .7rem;
  height: .7rem;
  background-color: #EF4B7D;
  border-radius: 50%;
  opacity: 0;
  transition: opacity .2s ease;
}

input[type="radio"]:checked {
  border: 1px solid #EF4B7D;
}

input[type="radio"]:checked::before {
  opacity: 1;
}

select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 100%;
  background-color: #fff;
  border: 1px solid #D8D8D8;
  border-radius: 0.8rem;
  padding: 1rem 1.7rem;
  background-image: url(../img/icon_arrow_down.svg);
  background-repeat: no-repeat;
  background-position: calc(100% - 1.2rem) center;
  background-size: 1rem;
  font-size: 1.3rem;
  color: #000;
}

select.is-selected {
  color: #EF4B7D;
  font-weight: bold;
}

select:disabled {
  background-color: #fff;
  border: 1px solid #D8D8D8;
}

input:focus,
textarea:focus,
select:focus,
button:focus {
  outline: none;
}

button {
  border: none;
  border-radius: 0.7rem;
  cursor: pointer;
}

label {
  font-size: 1.3rem;
}
```

#### Base 設計の意味
- `:root` のカスタムプロパティで **フルード rem 設計** を実現:
  - 画面幅 **375px のときに `1rem = 10px`** になる。
  - 画面幅が広くなると比例して `font-size` が大きくなり、**600px で頭打ち** (`--max-width` で上限)。
  - これにより、モバイル基準のデザインを **1 LP の中で全要素 rem 指定するだけで** スケーラブルにできる。
- `body` フォントは `Noto Sans JP` 固定 (Google Fonts で読み込み)。
- `@media (hover: hover)` でホバー演出はマウス環境に限定 (タップ環境での誤発火回避)。

---

### 4. 単位ルール (重要)

| プロパティ | 使用単位 | 理由 |
|---|---|---|
| `font-size` | **`rem`** | フルード rem 設計に乗せる (375px 基準で `1rem = 10px`) |
| `margin` / `padding` / `gap` | **`rem`**、レイアウト幅は **`%`** | デバイス幅に追従させる |
| `width` / `height` (要素サイズ) | **`rem`** または **`%`** | 同上 |
| `top` / `left` / `right` / `bottom` (位置) | **`rem`** または **`%`** | 同上 |
| `border` の太さ | **`px`** | デバイスサイズに依存させない (1px の細線は常に 1px であってほしい) |
| `border-radius` | **`rem`** | デザイン幅に比例させる |
| `outline` の太さ | **`px`** | `border` と同様 |
| `box-shadow` の `blur` / `spread` | **`px`** | 微細効果はピクセル固定 |
| メディアクエリのブレークポイント | **`px`** | デバイス判定なので絶対値 |

**原則**:
- **font-size、余白 (margin/padding)、サイズ系は `rem` または `%` で指定する**。
- **`px` は border / outline / box-shadow のような「デバイスサイズに依存させたくないもの」にのみ使用する**。
- 数値の単位を Utility クラス名に書く時は、小数点を `_` に置換する (`1.7rem` → `u-mb-1_7`)。

#### 例 (○ / ×)
```css
/* OK */
.page-header__text {
  font-size: 1.4rem;       /* rem */
  margin-bottom: 2rem;     /* rem */
  padding: 1rem 1.7rem;    /* rem */
  width: 80%;              /* % */
  border: 1px solid #ccc;  /* border は px */
  border-radius: 0.8rem;   /* radius は rem */
}

/* NG */
.page-header__text {
  font-size: 14px;         /* ✕ font-size は rem */
  margin-bottom: 20px;     /* ✕ 余白は rem */
  padding: 10px 17px;      /* ✕ 余白は rem */
  width: 300px;            /* ✕ サイズは rem or % */
  border: 0.1rem solid;    /* ✕ border は px */
}
```

---

### 5. BEM 命名規則 (義務)

Page 層の独自スタイルは **必ず BEM (Block__Element)** 形式で命名する。

#### 5-1. 基本形
```
{block}__{element}
```

例:
| OK | 説明 |
|---|---|
| `.page-header` | Block (ページヘッダ) |
| `.page-header__logo` | Element (ヘッダ内のロゴ) |
| `.page-header__text` | Element |
| `.page-header__text-sub` | Element (サブテキスト) |
| `.csl__nav` | Block (carousel ナビ) |
| `.csl__nav-item` | Element |
| `.csl__item-head` | Element |

| NG | 理由 |
|---|---|
| `.pageHeader` | キャメルケース禁止。ハイフン接続 |
| `.page-header > .text` | 子孫セレクタ禁止。Element として命名する |
| `.text` | 単独単語禁止。必ず Block を冠する |
| `.page-header--large` | `--Modifier` 禁止 (下記 5-2 参照) |

#### 5-2. Modifier は使わない (代わりに状態クラス `is-*`)
BEM の `--Modifier` 形式は **使わない**。状態は **`is-*` クラスを別途併記** する。

```html
<!-- OK -->
<div class="csl__nav-item is-active">...</div>

<!-- NG -->
<div class="csl__nav-item--active">...</div>
```

代表的な状態クラス:
| クラス | 意味 |
|---|---|
| `.is-active` | アクティブ状態 |
| `.is-selected` | 選択済み |
| `.is-checked` | チェック済み |
| `.is-disabled` | 非活性 |
| `.is-allow` / `.is-disallow` | 操作可能 / 不可 (カレンダー) |
| `.is-coupon` | クーポン対象 |

#### 5-3. JS フックは別クラスで併記
DOM 取得用のクラスは **`js-` プレフィックス** で別に作り、スタイルクラスとは **必ず分離** する。

```html
<!-- OK: スタイル用 (csl__nav-item) と JS フック用 (js-csl__nav-item) を併記 -->
<div class="js-csl__nav-item csl__nav-item is-active">...</div>
```

`js-*` クラスには **CSS を書かない**。

#### 5-4. 数値の小数点は `_` に置換
クラス名に数値を含む場合、小数点 `.` を `_` に置換する。

| 値 | クラス名 |
|---|---|
| `1.7rem` の余白 | `.u-mb-1_7` |
| `0.7rem` のフォント | `.u-fs-0_7` |
| `1.2rem` のフォント | `.u-fs-1_2` |

---

### 6. Utility 層 (`u-*`)

汎用クラスは `template/form_line/calendar-lp/css/style.css:246-335` の Utility ブロックをベースにする。

#### 6-1. 既存 Utility 一覧 (テンプレ準拠)

| クラス | スタイル | 用途 |
|---|---|---|
| `.u-text-right` | `text-align: right` | 右寄せ |
| `.u-text-center` | `text-align: center` | 中央寄せ |
| `.u-text-left` | `text-align: left` | 左寄せ |
| `.u-text-discount` | 斜め斜線 (`::before`) | 値引き表現 (打ち消し線) |
| `.u-fw-bold` | `font-weight: bold` | 太字 |
| `.u-fs-0_7` | `font-size: .7rem` | フォントサイズ |
| `.u-fs-1` | `font-size: 1rem` | 同上 |
| `.u-fs-1_2` | `font-size: 1.2rem` | 同上 |
| `.u-fs-1_4` | `font-size: 1.4rem` | 同上 |
| `.u-color-red` | `color: #EF4B7D` | メインピンク |
| `.u-mr-1` | `margin-right: 1rem` | 右マージン |
| `.u-mb-0_7` | `margin-bottom: .7rem` | 下マージン |
| `.u-mb-1` | `margin-bottom: 1rem` | 同上 |
| `.u-mb-1_7` | `margin-bottom: 1.7rem` | 同上 |
| `.u-mb-1_9` | `margin-bottom: 1.9rem` | 同上 |
| `.u-mb-2` | `margin-bottom: 2rem` | 同上 |
| `.u-mb-3` | `margin-bottom: 3rem` | 同上 |
| `.u-mb-4` | `margin-bottom: 4rem` | 同上 |
| `.u-mb-5` | `margin-bottom: 5rem` | 同上 |

#### 6-2. Utility 命名規則
- プレフィックスは **必ず `u-`**。
- カテゴリは記号で略す:
  - `text` (テキスト揃え)、`fw` (font-weight)、`fs` (font-size)、`color`
  - `mb` (margin-bottom)、`mr` (margin-right)、`mt` (margin-top)、`ml` (margin-left)
  - 必要に応じて `pb`, `pt`, `pr`, `pl` (padding) を追加可
- 数値は **`rem` 値そのまま** (単位は名前に書かない)、小数点は `_`:
  - `2rem` → `-2`
  - `1.7rem` → `-1_7`
  - `0.7rem` → `-0_7`
- 色名は単語 (`red`, `red-2`) で命名。直値は書かない。

#### 6-3. Utility のスタイル記述ルール
- **すべてのプロパティに `!important` を付与** (Page 層のスタイルより常に優先される単発調整用)。

```css
.u-mb-1_7 {
  margin-bottom: 1.7rem !important;
}
```

#### 6-4. Utility を新規追加する場合
- 既存の規則に乗せる (上記命名規則・`!important` 必須)。
- 1 用途 1 クラス。複数プロパティを 1 クラスに混ぜない。
- LP 固有の細かい調整は Utility ではなく Page 層の BEM クラスで対応する。

---

### 7. セレクタの書き方

- **セレクタの深さは最大 2〜3 段**。BEM でフラット化されているため深くする必要はない。
- 状態分岐は親クラスとの組合せで:
  ```css
  .csl__btn-wrap.column-two .csl__select-btn { width: 49%; }
  .csl__nav-item.is-active img { ... }
  ```
- `:has()` を積極的に使う (モダンブラウザ前提):
  ```css
  .csl__select-btn:has([type="checkbox"]:checked) { ... }
  ```
- ID セレクタ (`#xxx`) は **原則使わない** (アンカー / モジュールのルート要素のみ)。

---

### 8. メディアクエリ

- フルード rem 設計のため **基本ブレークポイントは使わない**。
- どうしても必要な場合のみ `@media screen and (max-width: 620px)` のような最大幅指定で局所対応。
- ブレークポイントの数値は **`px`** で指定。
- `@media (hover: hover)` は Base に既出。フィーチャクエリとして使う。

---

### 9. チェックリスト

- [ ] `@charset "utf-8";` がファイル先頭にある
- [ ] Reset ブロックは template そのままで改変していない
- [ ] Base ブロックは template そのままで改変していない
- [ ] Page 層のクラスは BEM (`block__element`) 形式で命名している
- [ ] `--Modifier` 形式を使わず、状態は `is-*` クラスで表現している
- [ ] JS フック (`js-*`) には CSS が付いていない
- [ ] font-size / 余白 / サイズ は **`rem` または `%`** で指定している
- [ ] `px` は border / outline / box-shadow / メディアクエリ にのみ使用している
- [ ] クラス名の数値は小数点を `_` に置換している
- [ ] 汎用調整は Utility (`u-*`) で行い、`!important` を付けている
- [ ] セレクタの深さが 3 段以下に収まっている
