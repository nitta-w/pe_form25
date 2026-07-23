---
paths:
  - "output/form_line/**/js/**"
  - "output/form_line/**/*.js"
  - "template/form_line/**/js/**"
---

# JavaScript ルール

リファレンスは `template/form_line/calendar-lp/js/script.js`。

### 1. 全体構造

- ファイル全体を **jQuery の DOMContentLoaded** (`$(() => { ... })`) でラップする。
- 内部は **トップで関数呼び出し → 下に `function` 宣言** という巻き上げ前提の書き方にする。
- 機能単位で **`function` で関数を定義**する。状態を持つ機能は `func2` のように **関数の中に `state` オブジェクトを閉じ込めて管理**する。

```js
$(() => {
  func();
  func2();

  function func() {
    // 状態を持たない処理
  }

  function func2() {
    const state = {
      isMoving: false,
      currentStep: 1,
      achievedMaxStep: 1,
      maxStep: $('.js-csl__item').length,
      adCountStatus: 3,
      adCountStatusMax: $('.js-csl__item').length + 2,
    };

    // ...内部関数群
    init();
  }
});
```

### 2. テンプレートリテラルの使用方針

**テンプレートリテラルを推奨する。特に DOM を生成する箇所では必ず使用すること。**

#### 2-1. DOM 生成

jQuery のメソッドチェーン（`$('<tag>').addClass(...).append(...)`）ではなく、テンプレートリテラルで HTML 文字列を組み立てて一括生成する。

```js
// ❌ 非推奨
const $el = $('<label>').addClass('cls');
const $input = $('<input>').attr({ type: 'radio', value: v }).addClass('opt__input');
$el.append($input).append(document.createTextNode(text));

// ✅ 推奨
const $el = $(`
  <label class="cls">
    <input type="radio" value="${v}" class="opt__input">
    ${text}
  </label>`);
```

複数要素を生成する場合は `Array.map()` と組み合わせる。

```js
const html = items.map(item => `<option value="${item.value}">${item.label}</option>`).join('');
$select.html(`<option value="">選択してください</option>${html}`);
```

#### 2-2. 動的値の挿入に関する注意

ユーザー入力由来の値をテンプレートリテラルに直接埋め込まない（XSS リスク）。ユーザー入力は `.text()` / `textContent` で設定するか、埋め込む場合は必ず `escapeHTML()` を通すこと。

### 3. state オブジェクトの必須プロパティ

画面遷移を持つ LP では、`state` に以下のプロパティを **必ず** 含める。

| プロパティ | 初期値 | 意味 |
|---|---|---|
| `isMoving` | `false` | スライド遷移アニメ中フラグ。二重操作防止 |
| `currentStep` | `1` | 現在の画面番号 (1 始まり) |
| `achievedMaxStep` | `1` | これまでに到達した最大画面番号 (戻っても保持) |
| `maxStep` | `$('.js-csl__item').length` | 画面総数 |
| `adCountStatus` | **`3`** | 計測ステータス ID (**デフォルト 3 スタート**) |
| `adCountStatusMax` | `$('.js-csl__item').length + 2` | 計測ステータスの上限 |

`achievedMaxStep` は「最大進んだ画面数」を保持するためのもので、戻ってもデクリメントしない。

### 3. 画面遷移処理

#### 3-1. `moveScreen(isNext)`
画面切替アニメーションを起こす。先頭にスクロール (`window.scrollTo(0, 0)`) を入れる。

```js
const moveScreen = (isNext = true) => {
  setTimeout(() => window.scrollTo(0, 0), 200);

  const $slideItems = $('.js-csl__item');
  const destinationStep = state.currentStep + (isNext ? 1 : -1);

  $slideItems.removeClass('is-active');
  $slideItems.eq(destinationStep - 1).addClass('is-active');
};
```

#### 3-2. `validation()` — 入力値チェックとアラート表示

画面遷移する際は **必ず** `validation()` を呼び、戻り値 (エラーメッセージ文字列) があれば `alert()` で表示し、遷移を中断する。

```js
const validation = () => {
  const message = [];
  switch (state.currentStep) {
    case 2:
      if ($('[name="body_part"]:checked').length === 0) {
        message.push('〇〇を選択してください');
      }
      break;
    case 3:
      if ($('[name="coupon"]:checked').length === 0) {
        message.push('〇〇を選択してください');
      }
      break;
    case 4:
      if (!$('[name="clinic_shop"]').val()) {
        message.push('〇〇を選択してください');
      }
      break;
  }
  return message.join('\n');
};
```
- LP に応じて `case` の中身を書き換える。
- メッセージは複数行を `\n` で結合してから `alert()` に渡す。

#### 3-3. `onClickSelectBtn(e)` — 進む

```js
const onClickSelectBtn = (e) => {
  if (state.isMoving) return;
  if (state.currentStep >= state.maxStep) return;

  const message = validation();
  if (message) {
    alert(message);
    return;
  }

  moveScreen();
  state.currentStep++;

  if (state.currentStep > state.achievedMaxStep) {
    state.achievedMaxStep = state.currentStep;
  }

  state.adCountStatus++;
  postAdCountStatus();
};
```
- 進むときは `state.adCountStatus++` → `postAdCountStatus()` を **必ず実行**。
- `achievedMaxStep` は到達最大値の更新のみ (戻った時に減らさない)。

#### 3-4. `onClickPrevBtn(e)` — 戻る

```js
const onClickPrevBtn = (e) => {
  if (state.isMoving) return;
  if (state.currentStep <= 1) return;

  moveScreen(false);
  state.currentStep--;
  state.adCountStatus--;
};
```
- 戻る時は `currentStep--` と `adCountStatus--` のみ。
- **`postAdCountStatus()` は呼ばない** (戻りでステータス送信しない)。
- 戻る時は `validation()` を実行しない (入力チェックは進む時のみ)。

#### 3-5. `onClickCtaBtn(e)` — CTA クリック

```js
const onClickCtaBtn = (e) => {
  const message = validation();

  if (message) {
    e.preventDefault();
    alert(message);
    return;
  }

  addParamsToCtaUrl();
};
```

### 4. `formatDate` — 日付フォーマット (必須・完全コピー)

以下のコードを **完全コピーで使用する** (改変禁止)。`addParamsToCtaUrl` 内の日付変換に使用する。

```js
/**
 * 日付フォーマット
 */
function formatDate(date, format) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');

  const tokens = [
    ['YYYY', d.getFullYear()],
    ['MM', pad(d.getMonth() + 1)],
    ['DD', pad(d.getDate())],
    ['hh', pad(d.getHours())],
    ['mm', pad(d.getMinutes())],
    ['ss', pad(d.getSeconds())],
    ['dow', ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]],

    // 先に処理されると「YYYY」と重複して置換されるため、必ず後に処理する
    ['M', d.getMonth() + 1],
    ['D', d.getDate()],
    ['h', d.getHours()],
    ['m', d.getMinutes()],
    ['s', d.getSeconds()],
  ];

  return tokens.reduce((result, [key, value]) => {
    return result.replace(new RegExp(key, 'g'), value);
  }, format);
}
```

#### フォーマットトークン一覧

| トークン | 出力 | 例 |
|---|---|---|
| `YYYY` | 4 桁年 (ゼロ埋め) | `2026` |
| `MM` | 月 (2 桁ゼロ埋め) | `04` |
| `M` | 月 (ゼロ埋めなし) | `4` |
| `DD` | 日 (2 桁ゼロ埋め) | `09` |
| `D` | 日 (ゼロ埋めなし) | `9` |
| `hh` | 時 (2 桁ゼロ埋め) | `09` |
| `h` | 時 (ゼロ埋めなし) | `9` |
| `mm` | 分 (2 桁ゼロ埋め) | `05` |
| `dow` | 曜日 (日本語) | `木` |

> `YYYY` / `MM` / `DD` 等の 2 文字トークンを **先に** 処理してから `M` / `D` 等を処理する順序で実装されている。この順序を変えると重複置換バグが発生するため、**トークン配列の順序を変えてはいけない**。

#### varMapping に渡す日付は必ず `'MM月DD日(dow)'` 形式

`varMapping` に日付データをセットする際は **必ず `'MM月DD日(dow)'` フォーマットを使用する**。

```js
// OK
const formattedRequestDate = formatDate(requestDate, 'MM月DD日(dow)');
varMapping['4444444'] = formattedRequestDate;  // 例: "04月09日(木)"

// NG
varMapping['4444444'] = requestDate;            // 生の日付文字列を渡してはいけない
varMapping['4444444'] = formatDate(requestDate, 'YYYY/MM/DD');  // 別フォーマット禁止
```

---

### 5. `addParamsToCtaUrl` — Lステップ CTA リンク生成

L ステップに保存される値を CTA リンクの URL クエリにセットする処理。**原則編集禁止**。
変更してよいのは以下 3 つのみ:

1. **取得項目** — その LP で取得する値 (例: `bodyPart`, `coupon`, `requestClinic`, `requestDate` 等)
2. **アカウント ID** — `switch (botBasicId)` の case 値 (BotベーシックID)
3. **mapping ID** — `varMapping['xxxxxxx']` のキー (L ステップ側の変数 ID)

それ以外 (URL 生成・パラメータセット・`$('.js-cta-link').each(...)` の処理) は **改変禁止**。

#### 5-1. 変数名規約（必須・固定）

`addParamsToCtaUrl` 内で使う変数名は以下に固定する。案件が変わっても **リネーム禁止**。

| 変数名 | 用途 | 必須 |
|---|---|---|
| `requestClinic` | 選択されたクリニック名 | ✅ |
| `requestDate` | 選択日（生の日付文字列） | ✅ |
| `requestFormattedDate` | 選択日（表示用フォーマット済み） | ✅ |
| `requestTime1` | 第1希望時間 | ✅ |
| `requestTime2` | 第2希望時間 | 任意 |
| `requestTime3` | 第3希望時間 | 任意 |
| `isCouponDay` または `isCouponTime` | クーポン対象フラグ | ✅ |
| `isToday` | 選択日が当日かどうか | ✅ |
| `isClinicListError` | 店舗プルダウン取得エラーフラグ | ✅ |
| `isCalendarError` | カレンダー表示エラーフラグ | ✅ |
| `errorCodes` | エラーコード配列 | ✅ |
| `botBasicId` | BotベーシックID | ✅ |
| `varMapping` | Lステップ変数マッピング | ✅ |

#### 5-2. エラーコード規約（必須・固定）

エラーコードは以下の名称を使用する。追加する場合は `E03_` 以降で連番。

| コード | 意味 |
|---|---|
| `E01_カレンダー表示` | カレンダーの表示・取得エラー |
| `E02_店舗表示` | 店舗プルダウンの取得エラー |

```js
const errorCodes = [];
isCalendarError   && errorCodes.push('E01_カレンダー表示');
isClinicListError && errorCodes.push('E02_店舗表示');
```

#### 5-3. varMapping の必須構造

以下の条件分岐・コメント構造を **必ず守る**。mapping ID のキー値は案件ごとに異なるが、構造は固定。

```js
// 医院プルダウンメニューがエラーでない場合のみパラメータ追加
if (!isClinicListError) {
  varMapping['XXXXXXX'] = requestClinic;
}

// プルダウンリストの医院取得&カレンダーがエラーでない場合のみチェック
if (!isClinicListError && !isCalendarError) {
  varMapping['XXXXXXX'] = requestFormattedDate;
  varMapping['XXXXXXX'] = requestTime1;
  varMapping['XXXXXXX'] = requestTime2;  // 任意
  varMapping['XXXXXXX'] = requestTime3;  // 任意

  varMapping['XXXXXXX'] = isCouponDay  // または isCouponTime
    ? '日時特典あり'
    : '日時特典なし';

  if (isToday) {
    varMapping['XXXXXXX'] = '当日希望';
  }
}

// エラーコード（常に送信）
varMapping['XXXXXXX'] = errorCodes;
```

```js
const addParamsToCtaUrl = () => {
  const selectedBodyPart = [];
  $('[name="body_part"]:checked').map((_, element) => {
    selectedBodyPart.push($(element).val());
  });
  const bodyPart = `,${selectedBodyPart.join(',')},`;
  const coupon = $('[name="coupon"]:checked').val().trim();
  const requestClinic = $('[name="clinic_shop"]').val().trim();
  const [requestDate, requestTime1] = $('[name="date_1"]').val().split(' ');
  const formattedRequestDate = formatDate(requestDate, 'MM月DD日(dow)');

  // BotベーシックID
  const botBasicId = $('[name="bot_basic_id"]').val().trim();

  // 選択した日時がクーポン対象の場合、パラメータ追加
  const isCouponTime =
    $('[name="date_1"]').attr('data-tc-is-coupon-time') === 'true';

  // 選択した日付が当日であるかどうかを判定
  const isToday =
    $('[name="date_1"]').attr('data-tc-is-today') === 'true';

  // カレンダーの表示エラーのフラグ
  const isCalendarError = $('[data-tc-is-error]').length > 0;

  const varMapping = {};

  switch (botBasicId) {
    case '111dummy':
      //@111dummy
      varMapping['1111111'] = bodyPart;
      varMapping['2222222'] = coupon;
      varMapping['3333333'] = requestClinic;

      // カレンダーがエラーでない場合のみパラメータ追加
      if (!isCalendarError) {
        varMapping['4444444'] = formattedRequestDate;
        varMapping['5555555'] = requestTime1;
        varMapping['6666666'] = isCouponTime
          ? '日時特典あり'
          : '日時特典なし';

        if (isToday) {
          varMapping['7777777'] = '当日希望';
        }
      }
      break;

    case '222dummy':
      //@222dummy
      varMapping['1111111'] = bodyPart;
      varMapping['2222222'] = coupon;
      varMapping['3333333'] = requestClinic;

      if (!isCalendarError) {
        varMapping['4444444'] = formattedRequestDate;
        varMapping['5555555'] = requestTime1;
        varMapping['6666666'] = isCouponTime
          ? '日時特典あり'
          : '日時特典なし';

        if (isToday) {
          varMapping['7777777'] = '当日希望';
        }
      }
      break;
  }

  // aタグのURLにパラメータ追加
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

#### 5-4. `is_update_disabled` を追加しない

`$('.js-cta-link').each(...)` 内で **`url.searchParams.set('is_update_disabled', '1')` を追加してはいけない**。

過去に「AnswerForm 用 非更新フラグ」として記述する実装が出回っているが、本プロジェクトでは **使用しない**。

❌ NG（このプロジェクトでやってはいけない例）:

```js
$('.js-cta-link').each((_, element) => {
  const $link = $(element);
  const url = new URL($link.attr('data-href'));

  Object.keys(varMapping).forEach((key) => {
    url.searchParams.set(`var_${key}`, varMapping[key]);
  });

  // AnswerForm用 非更新フラグ ← 追加禁止
  url.searchParams.set('is_update_disabled', '1');

  $link.attr('href', url.toString());
});
```

✅ OK（§5 のテンプレ通り、`is_update_disabled` を含めない）:

```js
$('.js-cta-link').each((_, element) => {
  const $link = $(element);
  const url = new URL($link.attr('data-href'));

  Object.keys(varMapping).forEach((key) => {
    url.searchParams.set(`var_${key}`, varMapping[key]);
  });

  $link.attr('href', url.toString());
});
```

### 6. `postAdCountStatus` — 計測ステータス送信

以下のコードを **完全コピーで使用する** (改変禁止)。

```js
const postAdCountStatus = () => {
  if ($.cookie('status_id') < state.adCountStatusMax) {
    if ($.cookie('status_id') < state.adCountStatus) {
      const postData = {
        type: 5,
        ad_id: $.cookie('ad_id'),
        status_id: state.adCountStatus,
      };
      $.ajax({
        type: 'POST',
        url: `./js/ajax.php`,
        data: postData,
      }).done(() => {
        $.cookie('status_id', state.adCountStatus, {
          expires: 3,
          path: '/',
          domain: location.hostname,
        });
      });
    }
  }
};
```

#### 呼び出しタイミング (必須)
1. **ページ読み込み時** (`init()` 内で 1 回)
2. **画面が進んだ時** (`onClickSelectBtn` で `state.adCountStatus++` の直後)

**戻る時 (`onClickPrevBtn`) は実行しない**。

### 7. イベント登録 (`addEventListener`)

```js
const addEventListener = () => {
  $('.js-csl__select-btn').on('click', (e) => onClickSelectBtn(e));
  $('.js-csl__prev-btn').on('click', (e) => onClickPrevBtn(e));
  $('.js-cta-link').on('click', (e) => onClickCtaBtn(e));

  // スライド切り替わり中のフラグ更新処理
  $('.js-csl__item').on('animationstart', (e) => {
    // 自身のイベントのみ処理
    if (e.target === e.currentTarget) {
      state.isMoving = true;
    }
  });
  $('.js-csl__item').on('animationend', (e) => {
    // 自身のイベントのみ処理
    if (e.target === e.currentTarget) {
      state.isMoving = false;
    }
  });
};
```
- セレクタは **`js-` プレフィックスのフッククラス**で取得する (スタイルクラスは使わない)。
- `animationstart` / `animationend` は **`e.target === e.currentTarget` で自身のイベントのみ拾う** (子要素のアニメで誤発火させない)。
- スクロールに干渉しないリスナー (`touchstart` / `touchmove` / `wheel` 等) を貼るときは **`{ passive: true }`** を付ける。詳細は §9 参照。

### 8. `init`

```js
const init = () => {
  try {
    addEventListener();
    postAdCountStatus();
  } catch (e) {
    console.error(e);
  }
};

init();
```
- `try / catch` で全体を囲み、初期化失敗時はコンソールにエラー出力。
- ページ読み込み直後に **`postAdCountStatus()` を必ず実行** (ステータス送信タイミングの 1 回目)。

### 9. イベントリスナーの passive オプション

`{ passive: true }` を付けると、ブラウザは「このリスナーは `preventDefault()` を呼ばない」と判断でき、**スクロールをブロックせず先行して画面を動かせる**。タップ・スクロール系のリスナーでは必須。

| イベント | passive 推奨 | 理由 |
|---|---|---|
| `touchstart` / `touchmove` | **`{ passive: true }`** 必須 | スクロール性能 (Chrome は明示しないと警告) |
| `wheel` / `mousewheel` | **`{ passive: true }`** 必須 | 同上 |
| `scroll` | **`{ passive: true }`** 推奨 | 同上 |
| `click` / `change` / `submit` | passive 指定不要 | スクロールに影響しない |

**`preventDefault()` を呼びたい場合は `{ passive: false }`** を明示する (デフォルトは仕様上 listener により異なるため明示推奨)。

```js
// OK
el.addEventListener('touchstart', onTouchStart, { passive: true });
el.addEventListener('scroll', onScroll, { passive: true });

// preventDefault が必要なときだけ false
el.addEventListener('touchmove', onSwipe, { passive: false });
```

### 10. ユーザー操作の重複発火防止

ボタン・ラジオ・チェックボックスなど、**ユーザー操作をトリガーにして次の画面へ進む処理**は、連打・誤タップ・イベントの多重発火により同じ処理が複数回実行されるリスクがある。以下のルールで防ぐ。

#### 原則：操作と同時に入力をロックする

操作（`change` / `click`）を検知したその場で、関連する `<input>` / `<button>` を **即座に `disabled`** にする。  
`setTimeout` で遅延処理を挟む場合でも、ロックは遅延させない。

```js
// NG: setTimeout の中で disabled にしている → 遅延中に再操作できる
$w.on('change', '.opt__input', function () {
  setTimeout(() => {
    $w.find('.opt__input').prop('disabled', true);
    next();
  }, 280);
});

// OK: change と同時に disabled → setTimeout 中は再操作不可
$w.on('change', '.opt__input', function () {
  $w.find('.opt__input').prop('disabled', true);          // ← 即ロック
  $(this).closest('.opt').addClass('sel');
  setTimeout(() => next(), 280);
});
```

#### ボタンの場合

`click` ハンドラの先頭でボタン自身を `disabled` にするか、DOM から取り除く。

```js
// OK: クリックと同時にボタンを除去
$btn.one('click', () => {
  $btn.remove();   // または $btn.prop('disabled', true)
  proceed();
});
```

#### `.one()` の活用

1回限りの操作（モーダルを開く・ステップを進める等）には `.on()` ではなく **`.one()`** を使う。自動的に1回で解除されるため、ハンドラ内でのロック処理が不要になる。

```js
// OK
$baBtn.find('.nb').one('click', () => { $baBtn.remove(); resolve(); });
```

#### チェックリスト
- [ ] `change` / `click` と同時(setTimeout の外)で input / button を `disabled` にしている
- [ ] 1回限りの操作には `.one()` を使っている
- [ ] `commit()` / `next()` のような進行関数が複数回呼ばれないことを確認している

### 11. Observer の使用方針

`scroll` / `resize` イベントを直接監視するのは高頻度発火でパフォーマンスを損なうため、**該当 API がある場合は Observer を優先**する。

| 用途 | 使うべき API |
|---|---|
| 要素が画面に入ったか判定 (遅延読み込み・出現アニメ・無限スクロール検知) | **`IntersectionObserver`** |
| 要素のサイズ変化検知 (レスポンシブレイアウト調整) | **`ResizeObserver`** |
| DOM の変化検知 (動的追加要素へのフック付与) | **`MutationObserver`** |
| スクロール位置で何か変える (ヘッダ縮小等) | `IntersectionObserver` でセンチネル要素を観測 |
| 純粋なスクロール量の追跡 (パララックス等) | `scroll` + `requestAnimationFrame` (passive) |

#### 10-1. IntersectionObserver の例
```js
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target); // 一度きりなら解除
    }
  });
}, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

document.querySelectorAll('.js-fade-in').forEach((el) => io.observe(el));
```

#### 10-2. scroll / resize を直接使う場合
- **必ず `requestAnimationFrame` で間引く** (1 フレームに 1 回まで)。
- `passive: true` を付与する。

```js
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    // スクロール処理
    ticking = false;
  });
}, { passive: true });
```

#### 10-3. Observer の解除
- 役目が終わった Observer は **必ず `disconnect()` または `unobserve()`** する (メモリリーク防止)。
- ページ離脱時 (`pagehide` / `visibilitychange`) に解除するのも有効。

### 11. 動画 (`<video>`) の設置規約

#### 11-1. 基本仕様・方針

- `template/js/common.js` (本番では `../../js/common.js`) の `initVideoTagControl()` がページ内全 `<video>` を `IntersectionObserver` で自動 `play` / `pause` する。**案件側で独自の再生制御を書かないこと**。詳細は `.claude/rules/common-js-spec.md` を参照。
- 全 `<video>` 共通の必須属性: **`muted`** / **`playsinline`** (iOS のインラインオートプレイ条件)。
- ループさせる場合は **`loop`** を付与。
- 共通 JS の制御から外したい動画には **`js-ignore-video-play`** クラスを付与する (例: ボタンで再生/停止する装飾動画、モーダル内動画)。

**アンチパターン**:

- 非 `js-ignore-video-play` 動画に対し案件側 `script.js` で `play()` / `pause()` を独自に呼ぶ (共通 JS と衝突)
- 静的配置の `<video>` 用に独自 `IntersectionObserver` を作る (二重監視)

#### 11-2. 設置パターン (FV / 非 FV)

##### 11-2-1. FV 動画

```html
<video src="img/fv.mp4" poster="img/fv-thumbnail.webp"
       width="640" height="400"
       autoplay loop playsinline muted></video>
```

| 属性 | 目的 |
|---|---|
| `poster` | 読み込み中の見た目担保・LCP 改善 |
| `width` / `height` | CLS 防止 (レイアウトシフト対策) |
| `autoplay` | FV は即再生で印象を作るため必須 |
| `loop` `playsinline` `muted` | §11-1 の共通必須 |

> ⚠ FV に `preload="none"` を付けないこと (即再生したいのにメタデータすら無いと再生開始が遅れる)。

##### 11-2-2. 非 FV 動画

```html
<video src="img/fv-2.mp4" preload="none"
       loop playsinline muted></video>
```

| 属性 | 目的 |
|---|---|
| `preload="none"` | 初回ロードのデータ転送を抑制 (FV 以外は表示までメタデータも要らない) |
| `loop` `playsinline` `muted` | §11-1 の共通必須 |

`autoplay` は不要 (`common.js` が画面内に入った時点で `play()` するため)。
`poster` は強く推奨 (画面に入る前の見た目担保)。

#### 11-3. 動的追加パターン (JS で後から挿入する動画)

**前提となる制約**:

`initVideoTagControl()` は `$(document).ready` 時点で `<video>` をスナップショットして Observer を貼るため、後から DOM に追加した `<video>` は **共通制御の対象外**。さらに、`body` の `touchstart` / `click` ハンドラは初回発火後 `off()` されるため、ユーザの初回操作後に挿入された動画はミュート再生フックも受けられない。

**ルール**:

1. **`preload="none"` を必ず付ける**
   - 回線・メモリの無駄な消費を防ぐ。挿入時点でメタデータすら取得させない。

2. **`js-ignore-video-play` を必ず付ける**
   - 動的挿入動画は「自前で完結させる」のが原則であることを明示する目印。
   - 将来 `common.js` に MutationObserver 追加等の拡張が入った場合の二重制御を予防。

3. **挿入側で個別 `IntersectionObserver` を設定**
   - 案件側 `script.js` で監視し、画面内に入ったら `play()`、画面外で `pause()`。
   - チャット型 LP のように「挿入＝即可視」が確実な場合は、挿入直後に `play().catch()` で再生開始してもよい (ユーザ操作起因でなら成功する)。

4. **不要になった Observer は `unobserve()` / `disconnect()`**
   - §10-3 (Observer の解除) と同じ方針。動画 DOM を削除する場合、必ず Observer も解除する。

> 補足: 案件側で `IntersectionObserver` を都度書くのが面倒な場合は、`template/js/common.js` に `MutationObserver` を追加して動的挿入動画も拾えるよう拡張する選択肢もある。ただし全 LP に影響するため、`common-js-spec.md` の改修と全 LP での動作確認が必須。本規約改定とは別プランとして扱う。

### 12. JavaScript チェックリスト

- [ ] 全体を `$(() => { ... })` でラップしている
- [ ] 機能は `function` 宣言で定義し、巻き上げを利用してトップから呼んでいる
- [ ] 状態を持つ機能は関数内に `state` オブジェクトを閉じ込めている
- [ ] `state` に `isMoving / currentStep / achievedMaxStep / maxStep / adCountStatus / adCountStatusMax` を含めている
- [ ] `adCountStatus` の初期値が **3** になっている
- [ ] `validation()` で入力チェック → エラー時 `alert()` 表示
- [ ] `formatDate` 関数はテンプレートと完全一致している (改変なし・トークン順序そのまま)
- [ ] varMapping に渡す日付は `formatDate(date, 'MM月DD日(dow)')` で変換している
- [ ] `addParamsToCtaUrl` は取得項目・アカウント ID・mapping ID 以外を改変していない
- [ ] `$('.js-cta-link').each(...)` 内で `url.searchParams.set('is_update_disabled', '1')` を追加していない（§5-4 参照）
- [ ] `postAdCountStatus` のコードはテンプレートと完全一致している (改変なし)
- [ ] `postAdCountStatus()` をページ読み込み時 (`init`) と画面遷移 (進) の両方で呼んでいる
- [ ] 戻るときは `postAdCountStatus()` を呼んでいない
- [ ] 進む時は `state.adCountStatus++`、戻る時は `state.adCountStatus--`
- [ ] `achievedMaxStep` は到達最大値のみ更新 (戻っても減らさない)
- [ ] `animationstart` / `animationend` で `e.target === e.currentTarget` をチェックしている
- [ ] イベントのセレクタは `js-` プレフィックスのフッククラスを使っている
- [ ] `touchstart` / `touchmove` / `wheel` / `scroll` リスナーに `{ passive: true }` を付けている
- [ ] スクロール監視は `IntersectionObserver` を優先し、直接 `scroll` を使う場合は `requestAnimationFrame` で間引いている
- [ ] 役目を終えた Observer は `disconnect()` / `unobserve()` で解除している
- [ ] FV の `<video>` は `poster` / `width` / `height` / `autoplay` / `loop` / `playsinline` / `muted` を全て付与している
- [ ] FV 以外の `<video>` は `preload="none"` / `loop` / `playsinline` / `muted` を付与している
- [ ] JS で動的に挿入する動画には `js-ignore-video-play` を付与し、自前の `IntersectionObserver` で制御している
- [ ] 動的挿入動画用に作った Observer は不要になった時点で `unobserve()` / `disconnect()` している

---

## クリニック一覧取得ルール

エリア `<select>` の選択値 (エリア ID) に応じて、紐づくクリニック (医院) 一覧をサーバーから取得してクリニック `<select>` を動的に更新する処理の規約。

### 1. エリア ID 対応表

エリア `<select>` の `<option value>` は下表の ID を **必ずこの対応で** 使用する (サーバー側と揃える)。

| `value` | エリア名 |
|---|---|
| `""` | 選択してください (未選択) |
| `1` | 北海道・東北地方 |
| `2` | 関東地方 |
| `3` | 中部地方 |
| `4` | 近畿地方 |
| `5` | 中国・四国地方 |
| `6` | 九州・沖縄地方 |

```html
<select name="area" class="js-area-select">
  <option value="">選択してください</option>
  <option value="1">北海道・東北地方</option>
  <option value="2">関東地方</option>
  <option value="3">中部地方</option>
  <option value="4">近畿地方</option>
  <option value="5">中国・四国地方</option>
  <option value="6">九州・沖縄地方</option>
</select>
```

### 2. 取得処理 (テンプレ・必須)

以下のコードを **ベースラインとして使用** する。`// ここで選択肢を更新` / `finally` の中身は LP に応じて実装してよいが、URL・メソッド・ヘッダ・ボディ・エラーハンドリングは改変禁止。

```js
try {
  const requestUrl = new URL(
    '/js/houreisen_list.php',
    window.location.origin,
  );
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ area_id: areaId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error status: ${response.status}`);
  }

  const data = await response.json();
  // ここで選択肢を更新

} catch (e) {
  console.error(e);
  // エラー時判定用属性をセット
  $clinicSelect.attr('data-clinic-list-error', '');
  /* デバック用
  const data = [
    { clinic_id: 1, value: '札幌店', label: '札幌店（大森駅）' },
  ];
  */
} finally {

}
```

### 3. リクエスト仕様

| 項目 | 値 |
|---|---|
| エンドポイント | `/js/houreisen_list.php` (`window.location.origin` ベースで `new URL()` を使用) |
| メソッド | `POST` |
| Content-Type | `application/json` |
| ボディ | `JSON.stringify({ area_id: areaId })` |

- `areaId` はエリア `<select>` の `val()` (文字列の `"1"`〜`"6"`)。未選択 (`""`) の場合は fetch を **呼ばない** こと。
- URL は必ず `new URL('/js/houreisen_list.php', window.location.origin)` で生成する (直書き禁止)。

### 4. レスポンス仕様 (正常時)

JSON 配列で返却される。各要素の構造:

```json
[
  { "clinic_id": 1, "value": "札幌店", "label": "札幌店（大森駅）" }
]
```

| フィールド | 型 | 用途 |
|---|---|---|
| `clinic_id` | number | 医院の識別 ID |
| `value` | string | `<option value>` にセットする値 |
| `label` | string | `<option>` の表示テキスト |

`<select name="clinic_shop">` の選択肢を、先頭の「選択してください」を残した上で `data` で再構築する:

```js
const $clinicSelect = $('[name="clinic_shop"]');
$clinicSelect.empty();
$clinicSelect.append('<option value="">選択してください</option>');
data.forEach((item) => {
  $clinicSelect.append(
    $('<option>').attr('value', item.value).text(item.label),
  );
});
```

> XSS 対策: `<option>` への挿入は `.text()` / `.attr()` を使用する (`.html()` 禁止)。セキュリティ §1 参照。

### 5. エラーハンドリング (必須)

| 条件 | 処理 |
|---|---|
| `response.ok === false` | `throw new Error(\`HTTP error status: ${response.status}\`)` で catch に流す |
| 通信失敗・JSON パース失敗 | `catch` で受ける |
| `catch` 内 | `console.error(e)` と `$clinicSelect.attr('data-clinic-list-error', '')` を **必ず実行** |

#### 5-1. `data-clinic-list-error` 属性の役割

エラー発生時に **クリニック `<select>` 要素** (`$clinicSelect`) に `data-clinic-list-error` 属性を付与する。これは **後段のエラー判定に使用する共通フラグ**。

```js
// エラー時
$clinicSelect.attr('data-clinic-list-error', '');
```

- **目的**: クリニック一覧取得が失敗したことを DOM 上に残し、後続の処理 (バリデーション、CTA URL 生成、アラート表示、画面遷移制御など) から判定できるようにする。
- **後段での判定例**:
  ```js
  // バリデーションや CTA 処理でエラー状態をチェック
  const isClinicListError = $('[data-clinic-list-error]').length > 0;
  if (isClinicListError) {
    // エラー時の分岐処理 (alert / 遷移中断 / CTA パラメータ除外 など)
  }
  ```
- **ルール**:
  - 属性名は `data-clinic-list-error` **固定** (リネーム禁止)。
  - 付与対象は **クリニック `<select>` 要素** (`$clinicSelect`) 固定。
  - 値は空文字 (`''`) でよい (存在判定のみで使うため)。
  - 取得成功後に再試行する場合は `removeAttr('data-clinic-list-error')` で属性を削除してからフェッチすること。

#### 5-2. デバッグ用ダミーデータ

`catch` 内のダミーデータはコメントアウトのまま残す (ローカルデバッグ時に一時的に外して使う用)。本番コードでは有効化しない。

#### 5-3. エラー時のフォールバック UI（必須）

クリニック一覧取得エラーで完全ストップさせず、ユーザーが **CTA（LINE 追加等）まで到達できる導線** を必ず残す。具体的な文言・要素・関数名は LP 側で決めてよいが、以下の要件は満たすこと。

| 項目 | 要件 |
|---|---|
| エラー文言 | エラーが起きたことと「店舗を選択せずに進んでよい」旨を画面上に表示する |
| クリニック `<select>` | エラー時は `disabled` のままにし、操作させない |
| 後段の進行ボタン（次へ等） | エラー時は活性化し、店舗未選択でも次ステップへ進める分岐を持つ |
| `data-clinic-list-error` 属性 | §5-1 の通り `<select>` に付与（CTA URL 側のエラー判定に使用） |

CTA URL 側では `addParamsToCtaUrl` の `isClinicListError` 分岐で店舗パラメータをスキップしつつ `errorCodes` に `E02_店舗表示` を載せる（§5-1〜§5-2 参照）。

### 6. 呼び出しタイミング

- エリア `<select>` の `change` イベントで発火する。
  ```js
  $('[name="area"]').on('change', async (e) => {
    const areaId = $(e.currentTarget).val();
    if (!areaId) return;
    await fetchClinicList(areaId);
  });
  ```
- クリニック `<select>` は **エリア未選択時は `disabled`** にしておき、取得成功後に `removeAttr('disabled')` する。
- 取得前に `<select>` をリセット (`empty()` + プレースホルダ追加)、`finally` でローディング状態解除などの後処理を入れる。

### 7. チェックリスト

- [ ] エリア `<option value>` が 1〜6 の対応表通りになっている
- [ ] 未選択 (`""`) の場合は fetch を呼んでいない
- [ ] URL は `new URL('/js/houreisen_list.php', window.location.origin)` で生成している
- [ ] メソッド・ヘッダ・ボディの形式がテンプレと一致している
- [ ] `response.ok` チェックで HTTP エラーを検出している
- [ ] `catch` 内で `console.error` と `data-clinic-list-error` 属性セットの両方を実行している
- [ ] 選択肢更新は `.text()` / `.attr()` を使い `.html()` を使っていない
- [ ] レスポンスの `value` / `label` / `clinic_id` 以外のフィールドに依存していない
