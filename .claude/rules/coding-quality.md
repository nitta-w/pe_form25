---
paths:
  - "output/form_line/**"
  - "template/form_line/**"
---

# パフォーマンス / セキュリティ / クロスブラウザ ルール

## パフォーマンスルール

### 1. 画像

- `<img>` には **`width` / `height` 属性を必ず指定** (CLS 防止)。
- ファーストビュー以外の画像は **`loading="lazy"`** を付与。
- 形式の使い分け:
  - **`.svg`**: アイコン・ロゴ・ナビ番号など (ベクタ・色置換可)
  - **`.webp`**: 写真・テキスト組版画像・バナー
  - **`.gif`**: **アニメーションが必要な場合のみ** 許容 (静止画には使わない)

### 2. フォント

- Google Fonts の URL に **`&display=swap`** を必ず付与 (FOIT 回避)。

### 3. キャッシュバスター

- ページ専用 CSS / JS の `<link>` / `<script>` には **`?time=<?= time() ?>`** を付与 (デプロイ後の古いキャッシュ事故防止)。

### 4. DOM クエリ

- 同じセレクタを複数回呼ばず、一度変数に保持する:
  ```js
  const slideItems = document.querySelectorAll('.js-csl__item');
  // 以降 slideItems を使い回す
  ```

### 5. setInterval / setTimeout のクリーンアップ

- `setInterval` を使った場合、**ページ離脱時 (`pagehide`) や非表示時 (`visibilitychange`) に `clearInterval`** する。
  ```js
  const timerId = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(timerId);
  });
  ```

### 6. スクロール / リサイズ最適化

`coding-js.md` §11 (Observer の使用方針) を参照。`IntersectionObserver` / `ResizeObserver` を優先。直接 `scroll` を使う場合は `requestAnimationFrame` + `passive: true`。

### 7. jQuery イベントの解除

不要になったイベントハンドラは **必ず `.off()` で解除**する。特に以下のケース:

- 動的に追加・削除される DOM に紐づくイベント (削除時に解除)
- 一度きりのフロー（モーダル等）で離脱時に解除
- `pagehide` / `visibilitychange` でグローバルなイベントを解除

```js
// 名前空間でグルーピングして一括解除
$(document).on('click.modal', '.js-modal-close', closeModal);
// 終了時
$(document).off('.modal');
```

### 8. アニメーション

CSS でアニメーションを実装する際は、**`transform` / `opacity` を優先**する（コンポジタ層のみで処理されレイアウト・ペイントが走らない）。

- ✅ 推奨: `transform`, `opacity`, `filter`
- ❌ 非推奨: `width`, `height`, `top`, `left`, `margin`（毎フレーム reflow が走る）

---

## セキュリティルール

### 1. XSS 対策

- ユーザー入力由来の値を DOM に挿入する際は **`textContent` を使う** (`innerHTML` は禁止)。
  ```js
  // OK
  el.textContent = userInput;
  // NG
  el.innerHTML = userInput;
  ```
- `innerHTML` は **静的テンプレ専用**。動的な値を混ぜる場合は必ずエスケープする。

### 2. hidden input の取扱い

- `bot_basic_id` のように JS 連携用に hidden へ出力するのは OK。
- **個人情報 (氏名・メール・電話番号) を hidden に入れない** (URL 含めページ全体で漏洩リスク)。

### 3. SVG の取扱い

- 外部から取得した SVG をそのまま `innerHTML` に挿入しない (中に `<script>` が仕込まれる可能性)。
- インライン化は信頼できる固定 SVG ファイルのみ。

### 4. 動的コード実行の禁止

以下の API は **使用禁止**。文字列を実行可能なコードとして評価するため、外部入力が混入すると XSS の温床になる。

- `eval()`
- `Function()` コンストラクタ（例: `new Function('return 1')`）
- `setTimeout(string)` / `setInterval(string)` の文字列引数（必ず関数を渡す）
- `document.write()`

```js
// ❌ NG
setTimeout('doSomething()', 1000);

// ✅ OK
setTimeout(() => doSomething(), 1000);
```

### 5. URL パラメータ・ストレージへの機密情報

- **`var_*` パラメータに個人情報（氏名・メール・電話番号・住所）を入れない**。L ステップに渡す情報は属性値（性別・年代・希望部位等）に限定。
- `localStorage` / `sessionStorage` / `cookie` に機密情報を保存しない。カウンタ・タイマー等の表示用一時データのみ許容。

### 6. URL クエリ・ハッシュからの値を DOM に直接挿入しない

`location.search` / `location.hash` から取得した値をエスケープ無しで DOM に挿入すると **DOM-based XSS** になる。挿入する場合は必ず `textContent` 経由 or `escapeHTML` 通過。

```js
// ❌ NG
const ref = new URLSearchParams(location.search).get('ref');
$('#welcome').html(`Welcome ${ref}!`);  // XSS 攻撃可能

// ✅ OK
$('#welcome').text(`Welcome ${ref}!`);
```

### 7. postMessage の origin 検証

`window.addEventListener('message', ...)` で外部 iframe からメッセージを受け取る場合、**必ず `e.origin` を許可リストと照合**する。

```js
const ALLOWED_ORIGINS = ['https://xb596558.xbiz.jp', 'https://xb740800.xbiz.jp'];
window.addEventListener('message', (e) => {
  if (!ALLOWED_ORIGINS.includes(e.origin)) return;
  // ...
});
```

### 8. エラーメッセージで内部情報を漏らさない

- ユーザー向けの `alert()` には汎用文言のみ。スタックトレース・パス・SQL エラー等を出さない。
- `console.error()` でログには出してよい（開発者用）が、`alert()` / 画面表示には出さない。

### 9. CTA URL のドメイン検証

`addParamsToCtaUrl` で `<?= $url ?>` から取得した `data-href` をパラメータ付与しているが、**期待するドメイン (`line.me/R/ti/p/...`) であることを前提**にしている。万一 `$url` が改ざんされた値だと、フィッシング先へ送信される可能性がある。

- 本番では `common.php` の `ad_line_url()` 戻り値を信頼。
- LP 側で `data-href` を動的に書き換えない。

---

## クロスブラウザ対応ルール

このプロジェクトは **ビルドステップを持たない**（jQuery + ES Modules を生で配信）。Babel / autoprefixer / PostCSS を通さないため、**使える機能はターゲットブラウザの最新版がネイティブサポートする範囲に限定** する。ポリフィル / シムは **全面禁止**。

### 1. サポート対象ブラウザ

| ブラウザ | 対象 |
|---|---|
| Chrome (Desktop) | 最新安定版 |
| Edge (Desktop) | 最新安定版 |
| Firefox (Desktop) | 最新安定版 |
| Safari (macOS) | 最新安定版 |
| iOS Safari | **iOS 17+**（N-1 までサポート） |
| iOS Chrome / Firefox / Edge | 中身は WKWebView = iOS Safari と同等扱い |
| Android WebView (LINE / アプリ内ブラウザ) | 最新版 (Chromium ベース)。機種により 1〜2 メジャー古いことがある前提 |

> **重要:** iOS のサードパーティブラウザは全て WKWebView ラッパーのため、レンダリングは Safari と同じ。**iOS = Safari のクセ** として一括して扱う。

### 2. JavaScript / Web API の使用基準

#### 使用可（全ターゲット最新版でサポート）

- **言語機能** (ES2022 以前): `async/await` / Optional chaining `?.` / Nullish coalescing `??` / Logical assignment (`??=` `||=` `&&=`) / Class fields / `Array.at()` / `Object.hasOwn()` / Top-level await (in modules)
- **言語機能** (ES2023+, iOS 17+ で OK): `Array.prototype.toSorted` / `toReversed` / `toSpliced` / `findLast` / `findLastIndex` / 正規表現 Lookbehind `(?<=)`
- **DOM / Web API**: `IntersectionObserver` / `ResizeObserver` / `MutationObserver` / `fetch` / `AbortController` / `URL` / `URLSearchParams` / `localStorage` / `sessionStorage` / `requestAnimationFrame` / `matchMedia` / `structuredClone`
- **ES Modules** (`import` / `export`)

#### 使用注意（クセあり / 形式に制約）

| 機能 | 注意点 |
|---|---|
| `new Date('YYYY-MM-DD HH:mm:ss')` | iOS Safari は **`-` 区切りの datetime を Invalid Date** にすることがある。**`'YYYY/MM/DD HH:mm:ss'` または ISO 8601 (`YYYY-MM-DDTHH:mm:ss`)** で渡す |
| Top-level await | ES Modules 内のみ。`<script type="module">` 必須 |
| `navigator.share` | Firefox Desktop 未サポート。使うときは `if ('share' in navigator)` でフィーチャ検出 |
| Service Worker / PWA 機能 | 本プロジェクトでは未使用。導入時は iOS Safari の制約を別途調査 |

#### 使用禁止（クロスブラウザで未対応 / 評価不安定）

- View Transitions API (`document.startViewTransition`) — Chrome / Edge のみ
- CSS Container **Style Queries** (`@container style(...)`) — Chrome のみ
- Anchor Positioning (`anchor-name` / `position-anchor`) — Chrome のみ
- Web Bluetooth / Web USB / Web NFC — iOS 非対応
- `window.showOpenFilePicker` (File System Access) — iOS 非対応
- Speech Recognition API — iOS 限定的
- Notification API — iOS Safari は PWA 限定で実質使えない
- ポリフィル / シムの導入（core-js, polyfill.io 等）

### 3. CSS の使用基準

#### 使用可

- Flexbox / Grid / `gap` / `aspect-ratio` / `clamp()` / カスタムプロパティ / `:is()` / `:where()` / `:has()` / `inset` / `accent-color` / `color-mix()`
- **Container Queries** (`@container (min-width: ...)`) — **size container のみ**
- 論理プロパティ (`margin-inline` / `padding-block` 等)
- **動的ビューポート単位** (`dvh` / `svh` / `lvh` / `dvw` 等)

#### ベンダプレフィックス必須（手書きで両方記述）

autoprefixer がないため、以下は **手動で `-webkit-` を併記**:

| プロパティ | 必須プレフィックス |
|---|---|
| `backdrop-filter` | `-webkit-backdrop-filter` も併記 |
| `mask` / `mask-image` | `-webkit-mask` / `-webkit-mask-image` も併記 |
| 行数省略 | `-webkit-line-clamp: N` + `display: -webkit-box` + `-webkit-box-orient: vertical` の 3 点セット |
| `text-size-adjust` | `-moz-text-size-adjust` / `-webkit-text-size-adjust`（Reset で対応済み） |
| `tap-highlight-color` | `-webkit-tap-highlight-color`（Base で対応済み） |

#### ビューポート単位

- **`100vh` を使わない**。iOS でツールバー分が含まれて hairline がはみ出す。
- 画面いっぱい想定は **`100dvh`**（動的）または **`100svh`**（最小）を使う。

#### 使用禁止

- `@container style()`（style query）
- `anchor-name` / `position-anchor`
- ネスティングの **`&` なし記法** （Safari 17.0 で挙動差あり、`& .bar { ... }` 形式で書く）
- `field-sizing: content`（Chrome のみ）

### 4. iOS Safari / WKWebView 特有の罠（必須対応）

| 項目 | ルール |
|---|---|
| 動画自動再生 | `<video muted playsinline>` 必須（`coding-js.md` §11 参照） |
| `position: fixed` × ソフトキーボード | キーボード表示中は fixed が浮く。**入力欄を含む UI に fixed CTA を置く場合、input フォーカス時に CTA を `display:none`** 等のワークアラウンドを必ず入れる |
| `<input>` フォーカス時の自動ズーム | **`font-size: 1.6rem` (= 16px) 以上** を `input` / `select` / `textarea` に必ず指定。これ未満だとフォーカス時にページがズームインする |
| 日付パース | `new Date('YYYY-MM-DD')` は UTC、`new Date('YYYY/MM/DD')` はローカル。**API/URL から受け取った日付を Date 化するときは `/` 区切り or ISO 8601** に統一 |
| `100vh` 問題 | §3 参照（`dvh` を使う） |
| `:focus` ハイライト | iOS は `:focus-visible` のみ反応。マウス操作時は出ない前提で OK |
| `scroll-behavior: smooth` / `scrollIntoView({behavior:'smooth'})` | iOS Safari 15.4+ で動作。本ルール (iOS 17+) では OK |
| Sticky のスクロール親 | 親に `overflow: hidden` があると iOS で sticky が効かない |
| `<select>` UI | iOS はネイティブピッカー固定。`appearance: none` の効きが限定的 |
| Cookie SameSite | iOS Safari は `SameSite=None; Secure` 厳格。広告計測 Cookie は **本番が HTTPS** であること前提 |

### 5. Android WebView (LINE / アプリ内ブラウザ) 特有の罠

| 項目 | ルール |
|---|---|
| WebView バージョンの差 | システム WebView 経由でレンダラのバージョンが端末ごとに違う。**最新を仮定しすぎない** |
| LINE 内ブラウザ (LIFF/IAB) | UA に `Line/x.x.x` が入る。外部リンクが LINE 内で開く場合がある。CTA は `target` に依存しない設計（既存リダイレクト方式で OK） |
| ファイル入力 / カメラ | アプリ次第で動作しない。LP では使わない |
| `localStorage` の永続性 | アプリのキャッシュクリアで消える前提。**重要データを localStorage 単独に保存しない** |

### 6. 機能検出と Graceful Degradation

- **UA 文字列で分岐しない**（`navigator.userAgent` で iOS / Android / LINE を判定するのは NG）。**機能検出** を使う:

```js
// JS での feature detection
if ('IntersectionObserver' in window) { /* ... */ }
if ('share' in navigator) { /* ... */ }

// CSS での feature detection
if (CSS.supports('height: 100dvh')) { /* ... */ }

// CSS 内
@supports (height: 100dvh) {
  .foo { height: 100dvh; }
}
```

- 非対応時の代替: 固定値・no-op・最低限の表示で **崩れずに動く** ことを優先。**ポリフィル投入は禁止**。

### 7. テスト方法

リリース前の **動作確認の最低ライン**:

1. **PC Chrome** で実機チェック（DevTools の Device Mode で iPhone / Android プリセット切替）
2. **本物の iOS Safari** で確認（Mac の Safari 開発メニューから実機 USB デバッグ、または BrowserStack）
3. **Android 実機 Chrome**（最低 1 機種）
4. **LINE 内ブラウザでの開封テスト**（実 LINE アプリで URL を踏む）

> Playwright MCP の `browser_navigate` は WebKit エンジンを起動できるため、Safari 系の自動テストにも流用可能。

---

## パフォーマンス / セキュリティ / ブラウザ チェックリスト

- [ ] `<img>` に `width` / `height` がある
- [ ] FV 以外の画像に `loading="lazy"`
- [ ] 画像形式は svg / webp 優先、gif はアニメ用途のみ
- [ ] Google Fonts に `display=swap`
- [ ] CSS / JS に `?time=<?= time() ?>` キャッシュバスター
- [ ] DOM クエリを変数キャッシュしている
- [ ] `setInterval` を `pagehide` / `visibilitychange` でクリーンアップしている
- [ ] 不要になった jQuery イベントを `.off()` で解除している
- [ ] アニメーションは `transform` / `opacity` ベース（`width` / `top` のフレーム毎変更を避けている）
- [ ] スクロール監視に `IntersectionObserver` または `requestAnimationFrame + passive` を使用
- [ ] 動的値の DOM 挿入は `textContent` (`innerHTML` を使っていない)
- [ ] hidden input に個人情報を入れていない
- [ ] 外部取得 SVG を `innerHTML` に挿入していない
- [ ] `eval()` / `Function()` / `setTimeout(string)` / `document.write()` を使っていない
- [ ] `var_*` パラメータ・localStorage に個人情報（氏名・メール・電話・住所）を入れていない
- [ ] `location.search` / `location.hash` の値をエスケープなしで DOM 挿入していない
- [ ] `postMessage` 受信時に `e.origin` を許可リストで検証している
- [ ] `alert()` でスタックトレース等の内部情報を表示していない
- [ ] CTA の `data-href` を JS で動的に書き換えていない
- [ ] §クロスブラウザ §2 の「使用禁止」API を使っていない（View Transitions / Style Queries / Anchor Positioning 等）
- [ ] CSS で `100vh` を使っていない（`100dvh` / `100svh` を使用）
- [ ] `input` / `select` / `textarea` の font-size が `1.6rem` (= 16px) 以上（iOS フォーカス時ズーム回避）
- [ ] `new Date(...)` に渡す文字列が `/` 区切り or ISO 8601（iOS Safari の `-` 区切り Invalid Date 回避）
- [ ] `backdrop-filter` / `mask` / `line-clamp` 等にベンダプレフィックス (`-webkit-`) を併記
- [ ] `navigator.userAgent` で OS / ブラウザ判定をしていない（機能検出を使う）
- [ ] iOS Safari 実機（または WebKit）で 1 周動作確認済み
- [ ] LINE 内ブラウザで開封テスト済み
