---
paths:
  - "output/form_line/**/index.php"
  - "template/form_line/**/index.php"
---

# PHP / HTML ルール

リファレンスは `template/form_line/calendar-lp/index.php`。

### 1. ベースラインコード (丸ごと必須)

`template/form_line/calendar-lp/index.php` の **全コードは必須**。出力先 `index.php` にはこのテンプレートを **そのままコピーして配置** し、可変部 (§2) だけを差し替える。削除・リネーム・順序変更は禁止。

```php
<?php
require_once __DIR__ . '/../../common.php';

$url = ad_line_url();
$lineat_flag = is_display_line_popup();
$bot_basic_id = ad_messaging_api_bot_basic_id();
?>
<!doctype html>
<html lang="ja">

<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title></title>
	<meta name="description" content="">
	<link rel="stylesheet" href="css/style.css">

	<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
	<script src="../../js/common.js"></script>
	<script src="js/script.js"></script>

	<!-- LINE popup -->
	<script src="../../js/jquery.cookie.js"></script>
	<?php if ($lineat_flag) { ?>
		<link rel="stylesheet" href="../../line-at-pop/line-at-pop.css">
		<script src="../../line-at-pop/popup.js"></script>
	<?php } ?>
	<!--/ LINE popup -->
	<?= r_rt_header() ?>
	<?= r_rt_header_lp() ?>
	<?= r_rt_header_sim_only() ?>
</head>

<body>
	<?= ptengine() ?>
	<input type="hidden" name="bot_basic_id" value="<?= $bot_basic_id ?>">

	<div class="page-wrap">
		<main>
			<a href="" data-href="<?= $url ?>" class="js-cta-link">
				この内容で予約を申し込む
			</a>
		</main>
	</div>

	<?= r_rt() ?>
	<?= r_rt_lp() ?>
	<?= r_rt_sim_only() ?>
</body>

</html>
```

#### 1-1. 必須要素 (削除・改変禁止)

| 区分 | 要素 | 備考 |
|---|---|---|
| PHP 読み込み | `require_once __DIR__ . '/../../common.php';` | 共通関数群を読み込む。パス固定 |
| PHP 変数 | `$url = ad_line_url();` | CTA の L ステップ URL |
| PHP 変数 | `$lineat_flag = is_display_line_popup();` | LINE ポップアップ表示判定 |
| PHP 変数 | `$bot_basic_id = ad_messaging_api_bot_basic_id();` | Bot ベーシック ID (JS で参照) |
| 宣言 | `<!doctype html>` / `<html lang="ja">` | 言語属性は `ja` 固定 |
| head | `<meta charset="UTF-8">` | |
| head | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` | |
| head | `<link rel="stylesheet" href="css/style.css">` | LP 専用 CSS |
| head | jQuery 3.7.1 CDN (`ajax.googleapis.com`) | バージョン固定 |
| head | `<script src="../../js/common.js">` | 共通 JS (パス固定) |
| head | `<script src="js/script.js">` | LP 専用 JS |
| head | `<script src="../../js/jquery.cookie.js">` | Cookie プラグイン (パス固定) |
| head | LINE popup 条件ブロック (`<?php if ($lineat_flag) { ?> … <?php } ?>`) | CSS / JS 含めて丸ごと残す |
| head | `<?= r_rt_header() ?>` / `r_rt_header_lp()` / `r_rt_header_sim_only()` | リマーケティングタグ (head) |
| body 先頭 | `<?= ptengine() ?>` | 計測タグ |
| body 先頭 | `<input type="hidden" name="bot_basic_id" value="<?= $bot_basic_id ?>">` | JS の `addParamsToCtaUrl` が参照 |
| body | `<div class="page-wrap"><main>…</main></div>` | 外枠。BEM の `page-wrap` は固定 |
| CTA | `<a href="" data-href="<?= $url ?>" class="js-cta-link">…</a>` | `href=""` + `data-href` + `js-cta-link` の 3 点セット必須 |
| body 末尾 | `<?= r_rt() ?>` / `r_rt_lp()` / `r_rt_sim_only()` | リマーケティングタグ (body) |

### 2. 可変部 (LP ごとに差し替える箇所)

以下のみ LP に応じて書き換える。それ以外は改変禁止。

| 場所 | 差し替える内容 |
|---|---|
| `<title></title>` | LP のタイトル |
| `<meta name="description" content="">` | LP の説明文 |
| `<main>` 内のマークアップ | LP 本文 (スライド、カレンダー、店舗一覧などのコンテンツ) |
| CTA リンクの表示テキスト | `この内容で予約を申し込む` の文言 |

### 3. CTA リンクの規約

CTA は必ず次の 3 点セットで出力する。JS (`addParamsToCtaUrl`) がこの構造に依存している。

```html
<a href="" data-href="<?= $url ?>" class="js-cta-link">
  …表示テキスト…
</a>
```

- `href=""` … 空で出力する (JS がクリック時に `data-href` を元に URL を組み立てて `href` にセットする)。
- `data-href="<?= $url ?>"` … `$url = ad_line_url()` の値。
- `class="js-cta-link"` … JS フック。スタイル用クラスと併用する場合は併記 (例: `class="js-cta-link btn btn--primary"`)。
- ページ内に CTA が複数あっても同じ 3 点セットで出せば `$('.js-cta-link').each(...)` で全てに param が付与される。

### 4. マークアップ規約

- **PHP 短縮タグ**: `<?= ?>` を使う (テンプレート踏襲)。
- **インデント**: タブ (テンプレート準拠)。
- **`class` 名**: BEM (CSS 章参照)、JS フックは `js-*` を別クラスで併記。
- **`lang`**: `<html lang="ja">` 固定。
- **文字コード**: UTF-8 で保存。
- **空属性の削除禁止**: `<title></title>` / `<meta name="description" content="">` は中身を書かなくても **タグ自体は残す** (テンプレート踏襲)。

#### 4-1. インラインスタイル / インラインスクリプトの禁止

スタイルと JavaScript は **外部ファイル** (`css/style.css` / `js/script.js`) に集約する。HTML (PHP) 内への以下の埋め込み形態は **禁止**。

| 名称 | 禁止対象 | 例 |
|---|---|---|
| **インラインスタイルシート** | `<style>` 要素の埋め込み | `<style>.foo { color: red; }</style>` |
| **インラインスタイル属性** | `style` 属性の指定 | `<div style="margin-top: 2rem;">` |
| **インラインスクリプト** | `<script>` 要素への JS 記述 | `<script>$(() => { … });</script>` |
| **インラインイベントハンドラ** | HTML 属性でのイベント指定 | `<button onclick="fn()">` |

**代替:**
- スタイルは `css/style.css` に記述し、**BEM クラス** または **Utility クラス (`u-*`)** をマークアップに適用する
- JavaScript は `js/script.js` に記述し、イベントバインド (`$().on(...)`) で DOM 操作する

```html
<!-- NG: インラインスタイルシート -->
<style>.lead { font-size: 1.4rem; }</style>

<!-- NG: インラインスタイル属性 (静的デザイン目的) -->
<div style="margin-top: 2rem; color: #EF4B7D;">…</div>

<!-- NG: インラインスクリプト -->
<script>$(() => { /* 処理 */ });</script>

<!-- NG: インラインイベントハンドラ -->
<button onclick="submit()">送信</button>

<!-- OK: 外部 CSS + BEM / Utility クラス -->
<div class="section__lead u-color-red u-mb-2">…</div>

<!-- OK: 外部スクリプトの読み込み (禁止対象外) -->
<script src="js/script.js"></script>
```

**JS テンプレート文字列内でも同様に禁止:**

`addCard()` や DOM 生成のテンプレートリテラル内で `style="..."` を使うことも禁止。CSS クラスを定義して適用すること。

```js
// NG: JS テンプレート内でのインラインスタイル
addCard(`<div style="border:1px solid #B8E6C8;background:#F0FFF4">…</div>`);
$('<div class="nbw" style="justify-content:center">');

// OK: CSS クラスを定義して使う
addCard(`<div class="card card--line">…</div>`);
$('<div class="nbw nbw--c">');
```

**唯一の許容例外:**

実行時に決まる純粋な数値のみ（ループで生成するアニメーション `delay`、CSS カスタムプロパティへの注入など）。デザイン上の色・余白・フォントサイズを `style=""` で指定することは禁止。

```js
// OK: 実行時に決まる純粋な数値
`<span class="ico" style="width:${w}px;height:${w}px">`
`<div class="sparkle" style="left:${x}%;animation-delay:${d}s">`

// NG: デザイン値をインラインで指定
`<strong style="color:#C2614A">` // → .em--acc クラスを使う
`<div class="nbw" style="justify-content:center">` // → .nbw--c クラスを使う
```

### 5. ファイル配置とパス

- 出力先は `output/<lp-name>/index.php`。
- `common.php` / `js/common.js` / `js/jquery.cookie.js` / `line-at-pop/` はすべて **2 階層上** (`../../`) から参照する。ディレクトリ階層を変えない。
- `css/style.css` / `js/script.js` は **LP ディレクトリ内** (同階層からの相対参照)。

### 6. PHP / HTML チェックリスト

- [ ] `template/form_line/calendar-lp/index.php` の 55 行すべてに相当するコードが出力 `index.php` にある
- [ ] インラインスタイルシート (`<style>…</style>`) が HTML 内にない
- [ ] インラインスタイル属性 (`style="…"`) が静的デザイン目的で使われていない
- [ ] インラインスクリプト (`<script>` 要素への JS 直書き) が HTML 内にない
- [ ] インラインイベントハンドラ (`onclick` / `onload` 等の属性) が使われていない
- [ ] `require_once __DIR__ . '/../../common.php';` が冒頭にある
- [ ] `$url` / `$lineat_flag` / `$bot_basic_id` の 3 変数を head 前で取得している
- [ ] `<html lang="ja">` / `<meta charset="UTF-8">` / viewport メタがある
- [ ] jQuery は googleapis CDN の **3.7.1** を読み込んでいる
- [ ] `../../js/common.js` と `js/script.js` の両方を読み込んでいる
- [ ] `../../js/jquery.cookie.js` を読み込んでいる
- [ ] LINE popup 条件ブロック (`<?php if ($lineat_flag) { ?>`) が残っている
- [ ] `r_rt_header()` / `r_rt_header_lp()` / `r_rt_header_sim_only()` を head に出力している
- [ ] `<?= ptengine() ?>` を body 冒頭に出力している
- [ ] `bot_basic_id` の hidden input が body 冒頭にある
- [ ] 外枠が `<div class="page-wrap"><main>…</main></div>` になっている
- [ ] CTA リンクが `href="" data-href="<?= $url ?>" class="js-cta-link"` の 3 点セットで出力されている
- [ ] `r_rt()` / `r_rt_lp()` / `r_rt_sim_only()` を body 末尾に出力している
- [ ] `<title>` / `<meta description>` / `<main>` 内以外は改変していない
