---
paths:
  - "output/form_line/**/index.php"
  - "output/form_line/**/js/**"
  - "template/js/**"
  - "template/form_line/**"
---

# 共通 JS 仕様書 (`template/js/common.js`)

`template/js/common.js` の利用リファレンス。
全テンプレート・全 LP から参照される共通 JS のソース・オブ・トゥルース。

---

## 1. 概要

LP 全体で常に有効化したい横断的な制御をまとめたスクリプト。本番環境では `../../js/common.js` として配置される実体のソースが本ファイル。

- **依存**: jQuery (global `$` が必須)、`IntersectionObserver` (ブラウザネイティブ)
- **配置場所**: `template/js/common.js` (リポジトリ内ソース) / `<site-root>/js/common.js` (本番環境)
- **読み込み**: `output/<lp-name>/index.php` の `<script>` から `../../js/common.js` を参照
- **エントリポイント**: jQuery `$(function () { ... })` 内で自動初期化されるため、利用側の追加コードは不要

---

## 2. 責務

| 機能 | 関数 / クラス | 役割 |
|---|---|---|
| 動画再生制御 | `initVideoTagControl()` | ページ内 `<video>` 要素のオートプレイ・スクロール連動再生／停止 |
| クリニック一覧 iframe 制御 | `ClinicIframeController` | `#js-clinic-list-iframe` 内 iframe の高さ自動調整・差し替え制御 |

下記スコープ外の処理 (案件固有 UI、フォーム制御、計測タグ送信、CTA リンク制御など) は **書かない**。
それらは各案件の `output/<lp-name>/js/script.js` 側に置く。

---

## 3. `initVideoTagControl()` — 動画再生制御

### 3-1. 動作概要

1. ページ内のすべての `<video>` 要素を対象に、初回のユーザ操作 (`touchstart` / `click`) で `muted = true` にして `play()` を発火する (モバイルブラウザのオートプレイ規制対策)。
2. `IntersectionObserver` で各 `<video>` の表示状態を監視し
   - 画面内に入ったら `play()`
   - 画面外に出たら `pause()`
3. ページ最上部から `window.height * 3` を超える位置にある動画は、画面外に出た際に `currentTime = 0` にリセット (メモリ節約)。

### 3-2. 利用側で書く HTML

```html
<video src="img/sample.mp4" muted playsinline loop></video>
```

- `muted` / `playsinline` / `loop` は **HTML 側で付与**しておく (iOS のインライン再生条件)。
- `autoplay` 属性は付けてもよいが、`common.js` 側でも play 制御するため必須ではない。

### 3-3. 制御を無効化したい動画

`js-ignore-video-play` クラスを付与すると、初回再生・スクロール連動再生・停止すべての対象から外れる。

```html
<!-- 任意のタイミングで JS から制御したい動画 -->
<video class="js-ignore-video-play" src="..." controls></video>
```

### 3-4. エラーハンドリング

`try / catch` で全体を包んでおり、例外が発生しても他の処理を止めない (コンソールにエラーを出力するのみ)。

---

## 4. `ClinicIframeController` — クリニック一覧 iframe 制御

### 4-1. 動作概要

`#js-clinic-list-iframe > iframe` を対象に、外部ドメインに置かれたクリニック一覧 iframe との `postMessage` 通信で高さを動的に同期させる。

1. `scrolling="no"` を強制し、`transition: height .2s` で高さ変化をアニメーションさせる。
2. iframe 側からの `{ action: 'sendIframeHeight', iframeHeight: <number> }` メッセージを受信し、親の iframe `height` を更新。
3. iframe 側へ `{ action: 'getHeight' }` を送信する起点を `load` イベントで起動。

### 4-2. 受信を許可するオリジン

`srcPageOrigin` (コンストラクタで定義) のオリジンからの postMessage のみ受け付ける。それ以外は無視。

```js
this.srcPageOrigin = [
  'https://xb596558.xbiz.jp',
  'https://xb740800.xbiz.jp',
  'https://xb489399.xbiz.jp',
];
```

新しいオリジンを追加する場合は **`template/js/common.js` を直接編集**する (各案件で個別に書き換えない)。

### 4-3. 利用側で書く HTML

```html
<div id="js-clinic-list-iframe">
  <iframe src="https://xb596558.xbiz.jp/clinic-list/" allowfullscreen></iframe>
</div>
```

要素が存在しなければ `init()` は何もしない (フェイルセーフ)。

### 4-4. iframe ソースの差し替え

別オリジンの同一コンテンツに動的に差し替えたい場合は、コンストラクタで以下を設定する。

```js
this.isReplaceIframe = true;
this.replaceOrigin = 'https://xb489399.xbiz.jp';
```

`replaceIframeTag()` が呼ばれ、元 iframe の `src` のオリジンを `replaceOrigin` に書き換えた新 iframe を生成・差し替えする。

### 4-5. 識別パターン

複数 iframe が並ぶ場合に備え、`postMessage` 受信時は `e.source === this.$iframe[0].contentWindow` でメッセージ送信元の iframe と一致しているかを確認している。同一 URL の iframe が複数あっても誤動作しない。

---

## 5. 改修ガイド / 注意点

### 5-1. 改修ポリシー

- **案件固有のロジックを `common.js` に書かない**。書きたい場合は `output/<lp-name>/js/script.js` で実装する。
- 新機能を追加する場合は「全 LP・全テンプレに影響しても問題ないか」を確認してから手を入れる。
- 改修したら、関連する LP すべてで動作確認を行う (リグレッションを起こしやすい場所)。

### 5-2. デプロイ時の注意

- 本リポジトリ内の `template/js/common.js` は **ソース**。本番環境では `<site-root>/js/common.js` に同じ内容を配置する運用。
- 案件作業で `output/<lp-name>/js/` 配下に `common.js` をコピーしないこと (混乱の元)。

### 5-3. ローカルでの動作確認

- 動画制御: `<video>` を含む LP をブラウザで開き、スクロールで再生・停止が切り替わることを確認。
- iframe 制御: 本番環境の iframe ソース (xbiz.jp 系) はローカルから読めないため、ステージング URL を Playwright 等で叩いて検証する。

---

## 6. チェックリスト (改修時)

- [ ] 案件固有のロジックを混入させていない
- [ ] try/catch で囲み、例外で他処理が止まらない
- [ ] `IntersectionObserver` / `postMessage` の対象セレクタを変更していない (HTML 側との契約)
- [ ] 新規オリジンを追加する場合、`srcPageOrigin` のみで完結している
- [ ] 全 LP で動作確認済み
