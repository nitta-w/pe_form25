---
name: page-check
description: LP（ランディングページ）完成後のリリース前チェックフロー。output/form_line/<lp-name>/ 配下のページを対象に、必須コード・JS構造・カレンダー・状態更新ロジック・動的生成・パフォーマンスを6セクションに分けて検証し、レポートを出力する。`/page-check`、`/page-check <lp-name>`、`/page-check --with-browser` 等で起動。
---

# ページ完成チェックフロー

LP のリリース前検証を実行する。**修正は行わずレポート出力のみ**。

---

## 1. 引数

- `<lp-name>` (任意) ─ 対象 LP のディレクトリ名 (`output/form_line/<lp-name>/`)
- `--with-browser` (任意) ─ Playwright を使った動作確認を追加実施

```
/page-check                          ← output/form_line/ 配下を自動検出（1つなら自動、複数ならユーザに選ばせる）
/page-check <lp-name>                ← 引数指定
/page-check <lp-name> --with-browser
```

---

## 2. 対象 LP の特定

1. 引数で `<lp-name>` が渡されていれば `output/form_line/<lp-name>/` を対象とする
2. 引数なしの場合、`output/form_line/` 配下のディレクトリを列挙
   - 1 つだけなら自動でそれを対象に
   - 複数あれば `AskUserQuestion` でユーザに選ばせる
3. 対象パスが存在しない・index.php (or index.html) がない場合はエラーで終了

---

## 3. チェックフロー

以下 6 セクションを順番に実行する。各セクションは **静的解析（ファイル読み込み + grep）** のみで完結。`--with-browser` 指定時のみ §7 を追加実行。

### §1 必須コードチェック (`index.html` / `index.php`)

参照: `.claude/rules/coding-rules.md` §PHP/HTML §1（ベースラインコード）/ `CLAUDE.md` § 外部前提

確認項目:

- [ ] PHP ヘッダ (`require_once __DIR__ . '/../../common.php';` 以降の3変数定義) が存在
- [ ] `<meta charset="UTF-8" />` / `<meta name="viewport">` あり
- [ ] `<title>` / `<meta name="description">` が空でない
- [ ] jQuery CDN (`ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js`) 読み込み
- [ ] `<script src="../../js/common.js">` が存在
- [ ] `<script src="../../js/jquery.cookie.js">` が存在（LINE popup ブロック内 or その付近）
- [ ] `js/script.js` 読み込み（`type="module"` の有無は許容）
- [ ] LINE popup ブロック (`<?php if ($lineat_flag) { ?>`...) が存在
- [ ] `<?= r_rt_header() ?>` / `<?= r_rt_header_lp() ?>` / `<?= r_rt_header_sim_only() ?>` が head 内に存在
- [ ] `<?= ptengine() ?>` が body 直後に存在
- [ ] `<input type="hidden" name="bot_basic_id" value="<?= $bot_basic_id ?>">` が存在
- [ ] CTA リンクが `href="" data-href="<?= $url ?>" class="js-cta-link"` の3点セット
- [ ] `<?= r_rt() ?>` / `<?= r_rt_lp() ?>` / `<?= r_rt_sim_only() ?>` が body 末尾に存在

### §2 JS 全体構造チェック (`js/script.js`)

参照: `.claude/rules/coding-rules.md` §JavaScript §1〜§3

確認項目:

- [ ] 全体が `$(() => { ... })` でラップされている
- [ ] 機能は `function` 宣言で定義されている（巻き上げ前提）
- [ ] `state` オブジェクトに必須プロパティ（`adCountStatus: 3` 初期値）を含む
- [ ] DOM 生成箇所がテンプレートリテラルで書かれている（`$('<tag>').addClass()` のメソッドチェーンが残っていないか）
- [ ] `js-*` プレフィックスのフッククラスを使用
- [ ] `formatDate` 関数がテンプレートと完全一致（改変なし）
- [ ] `touchstart` / `touchmove` / `wheel` / `scroll` リスナーに `{ passive: true }` 付与
- [ ] **重複操作防止**: 次の処理へ進む操作（`change` / `click`）のハンドラ内で、`setTimeout` などの遅延より前に当該 `<input>` / `<button>` を即座に `disabled` にしている。または `.one()` で1回限り受け付けにしている（coding-rules §10）

### §3 カレンダー仕様チェック（カレンダー使用 LP のみ）

参照: `.claude/rules/calendar-spec.md`

LP 内に `embedTimeCalendar` の利用がある場合のみ実施。

確認項目:

- [ ] `embedTimeCalendar` が `import` されている
- [ ] `parentSelector` / `checkBoxAttrName` / `scheduleFetchUrl` / `options` の4引数を渡している
- [ ] `couponSettings` を必ず渡している（calendar-spec §3-2-1 より必須）
- [ ] `couponSettings.showStartDays` / `showDays` / `showTimeList` が定義されている
- [ ] script.js 内で **当日判定** が読まれている（`data-tc-is-today` 属性）
- [ ] script.js 内で **クーポン判定** が読まれている（`data-tc-is-coupon-day` または `data-tc-is-coupon-time` 属性）
- [ ] カレンダーエラーフラグ (`[data-tc-is-error]`) を `addParamsToCtaUrl` 内で参照
- [ ] **エラー時の進行許可**（`.claude/rules/calendar-spec.md` §11-3）: `[data-tc-is-error]` を判定して**後段の進行ボタンを活性化**し、日時未選択でも次ステップへ進める分岐がある。利用側で追加のエラー文言は出していない（モジュール側の `.js-tc-message` に任せる）
- [ ] **第3希望以降の時間絞り込み**（`.claude/rules/calendar-spec.md` §11-4）: `maxSelectedDate >= 3` の LP では、第3希望以降の `<select>` に `value="【指定しない】"` の選択肢が含まれ、時間枠が 16:00〜17:30 のみに絞られている（モジュール側で自動適用される。利用側で破壊していないか確認）

### §4 状態更新ロジックの厳密チェック

参照: `.claude/rules/coding-rules.md` §JS §5（addParamsToCtaUrl）/ §6（postAdCountStatus）

#### 4-1. `postAdCountStatus`

- [ ] 関数が定義されている（template/form_line/calendar-lp/js/script.js と完全一致・改変なし）
- [ ] 初期化時 (`init` 相当) に `postAdCountStatus()` を呼んでいる
- [ ] 画面遷移（進む）の各箇所で `state.adCountStatus++` の直後に `postAdCountStatus()` を呼んでいる
- [ ] 戻る処理では呼んでいない（戻り判定の有無）

#### 4-2. `addParamsToCtaUrl`

参照: `.claude/rules/coding-rules.md` §JS §5-1（変数名規約）/ §5-2（エラーコード規約）/ §5-3（varMapping 必須構造）

- [ ] 変数名が固定名で書かれている: `requestClinic` / `requestDate` / `requestFormattedDate` / `requestTime1` / `isCouponDay` (または `isCouponTime`) / `isToday` / `isClinicListError` / `isCalendarError` / `errorCodes` / `botBasicId` / `varMapping`
- [ ] エラーコードが `E01_カレンダー表示` / `E02_店舗表示` で定義されている
- [ ] `if (!isClinicListError) { varMapping[...] = requestClinic; }` の条件分岐構造
- [ ] `if (!isClinicListError && !isCalendarError) {...}` の条件分岐構造とその内部に日付・時間・クーポン・当日のセットがある
- [ ] `errorCodes` を varMapping にセットしている
- [ ] URL 生成・パラメータセット・`$('.js-cta-link').each(...)` 部分が改変されていない
- [ ] `$('.js-cta-link').each(...)` 内で `url.searchParams.set('is_update_disabled', '1')` を追加していない（coding-rules §5-4）
- [ ] `$(document).on('click', '.js-cta-link', ...)` で `addParamsToCtaUrl()` を呼んでいる

### §5 動的生成 + エラーフラグ立てチェック

確認項目（各機能で fetch がエラーになった場合の処理を確認）:

- [ ] **医院一覧取得** (`fetchClinicList` または相当)
  - エラー時に `$('[name="clinic_shop"]').attr('data-clinic-list-error', '')` を付与
  - 参照: `.claude/rules/coding-rules.md` § クリニック一覧取得ルール
  - **エラー時のフォールバック UI**（`.claude/rules/coding-rules.md` § クリニック一覧取得ルール §5-3）: エラー文言を画面に表示し、`<select>` は `disabled` のまま、後段の進行ボタンを活性化して店舗未選択でも次ステップへ進める分岐がある
- [ ] **エリア ID マッピング** (`AREA_IDS` または相当の定数)
  - 参照: `.claude/rules/coding-rules.md` § クリニック一覧取得ルール §1（エリア ID 対応表）
  - 各エリア名がそれぞれ仕様通りの ID にマッピングされているか:
    | ID | 仕様上のエリア名 |
    |---|---|
    | `1` | 北海道・東北地方 |
    | `2` | 関東地方 |
    | `3` | 中部地方 |
    | `4` | 近畿地方 |
    | `5` | 中国・四国地方 |
    | `6` | 九州・沖縄地方 |
  - LP 側の表示名（例: `北海道・東北`、`関西` 等）が「地方」を省略していたり別名であっても、**紐づく ID `'1'`〜`'6'` が一致していれば OK**。ID が違っていれば NG として報告。
  - エリア `value=""`（未選択）が初期状態として残っているか。
- [ ] **カレンダー** (`embedTimeCalendar` の `createCalendar`)
  - エラー時に `$parent.attr('data-tc-is-error', '')` を付与（モジュール側で実装済み・利用側で何もしなくてよい）
- [ ] **日付選択 (checkbox)**
  - 動的生成された `<input type="checkbox" name="${checkBoxAttrName}">` にイベント委譲が機能しているか（`change` 委譲）
- [ ] エリア → 医院の連動: エリア未選択時に医院 fetch を呼んでいないか

### §6 パフォーマンス・セキュリティチェック

**参照: `.claude/rules/coding-rules.md` § パフォーマンスルール / § セキュリティルール / § パフォーマンス / セキュリティ チェックリスト**

このセクションは **`.claude/rules/coding-rules.md` の §パフォーマンス / セキュリティ チェックリスト全項目** を順に確認する。下記は要点抜粋（追加・更新は coding-rules.md 側を編集すること）。

#### パフォーマンス（参照: §パフォーマンスルール §1〜§8）

- [ ] 画像の `width` / `height` 属性 (CLS 防止)
- [ ] 非 FV 画像の `loading="lazy"`
- [ ] 画像形式: SVG / WebP 優先、GIF はアニメ用途のみ
- [ ] Google Fonts: `display=swap`
- [ ] `setInterval` / `setTimeout` の `pagehide` / `visibilitychange` クリーンアップ
- [ ] 不要になった jQuery イベントの `.off()` 解除
- [ ] アニメーションが `transform` / `opacity` ベース
- [ ] スクロール監視: `IntersectionObserver` または `requestAnimationFrame` + `passive`
- [ ] 動画タグ: FV は §JS §11-2-1 / 非 FV は §11-2-2 / 動的挿入は §11-3 準拠

#### セキュリティ（参照: §セキュリティルール §1〜§9）

- [ ] XSS: 動的値の DOM 挿入は `textContent` / `.text()`（`innerHTML` 直書き禁止）
- [ ] hidden input に個人情報を入れていない
- [ ] 外部取得 SVG を `innerHTML` に挿入していない
- [ ] `eval()` / `Function()` / `setTimeout(string)` / `document.write()` 不使用
- [ ] `var_*` パラメータ・localStorage に個人情報なし
- [ ] `location.search` / `location.hash` をエスケープなしで DOM 挿入していない
- [ ] `postMessage` 受信で `e.origin` 検証
- [ ] エラーメッセージで内部情報漏洩なし
- [ ] CTA `data-href` を JS で動的書き換えしていない

#### クロスブラウザ対応（参照: §クロスブラウザ対応ルール §2〜§4）

- [ ] CSS で `100vh` を使っていない（`100dvh` / `100svh` を使用）
- [ ] `input` / `select` / `textarea` の `font-size` が `1.6rem` 以上（iOS ズーム回避）
- [ ] `new Date(...)` の引数が `/` 区切り or ISO 8601（iOS の `-` 区切り Invalid Date 回避）
- [ ] `navigator.userAgent` での OS / ブラウザ判定なし（機能検出を使用）
- [ ] §クロスブラウザ §2「使用禁止」API（View Transitions / Style Queries / Anchor Positioning 等）を使っていない

#### リリース前最終確認

- [ ] `DEBUG_MODE` が `false`
- [ ] `useScheduleDummyData` が `false`（カレンダー LP のみ）

### §7 動作確認（`--with-browser` 指定時のみ）

Playwright で対象 LP を開き、以下を確認:

- [ ] ページがエラーなく表示される（コンソールエラーなし）
- [ ] チャットフローが進める（DEBUG_MODE が一時的に true でも可）
- [ ] CTA リンク (`.js-cta-link`) クリックで `var_*` パラメータが付与された URL に遷移する
- [ ] クーポンモーダルが開閉する

---

## 4. レポート出力フォーマット

各セクションを **詳細レポート形式** で出力。以下構造に従う。

```markdown
# ページチェックレポート: <lp-name>

実行日時: <YYYY-MM-DD HH:MM>
対象パス: output/form_line/<lp-name>/
ブラウザ確認: なし / あり

---

## §1 必須コードチェック (`index.php`)

| 項目 | 結果 | 備考 |
|---|---|---|
| PHP ヘッダ | ✅ | |
| `<title>` 設定 | ✅ | |
| `../../js/common.js` 読み込み | ❌ | **欠落** |
| ... | ... | ... |

**問題点:** ../../js/common.js が読み込まれていない。動画自動再生が機能しない。

---

## §2 JS 全体構造チェック

...

---

(以下 §3〜§6、--with-browser 時は §7)

---

## サマリ

- ✅ パス: 30 項目
- ⚠️ 警告: 2 項目（要確認）
- ❌ NG: 1 項目（要修正）

**最優先修正:**
1. §1 ../../js/common.js の読み込み欠落 (index.php:24)
2. ...
```

---

## 5. 重要原則

- **修正は行わない**。問題を見つけても自動修正せず、レポートで報告のみ
- **仕様書の参照を明示**。各チェック項目の根拠 (`.claude/rules/xxx.md` §N) を備考に書く
- **LP 種別の違いを尊重**。カレンダーを使わない LP では §3 をスキップ等、LP 構成に応じて柔軟に
- **TaskCreate で進捗管理**。各セクションをタスクにし、終わったら completed にする
- **セクション完了ごとに進捗を一文で報告**（例: "§1 完了。3 件の問題を検出"）
