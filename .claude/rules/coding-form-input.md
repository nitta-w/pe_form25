---
paths:
  - "output/form_line/**/index.php"
  - "output/form_line/**/js/**"
  - "template/form_line/**/index.php"
  - "template/form_line/**/js/**"
---

# フォームインプットルール

選択結果は URL パラメータ（L-Step 変数）として送信するため、**選択肢の値は必ず適切な `<input>` タグで保持する**。ボタンだけで「見た目上の選択状態」を管理して値を持たない実装は禁止。

### 1. 入力要素の選定基準

| UI の意図 | 使用するタグ | 用途例 |
|---|---|---|
| 単一選択（どれか 1 つ） | `<input type="radio">` | 性別・年代・エリア選択 |
| 複数選択（いくつでも） | `<input type="checkbox">` | 部位選択・施術経験 |
| リスト選択（ドロップダウン） | `<select>` | クリニック選択 |
| 自由テキスト入力 | `<input type="text">` | 氏名・希望内容など |
| メールアドレス入力 | `<input type="email">` | メールアドレス |

### 2. 実装パターン

チャットボット型 LP などでボタン風に見せる場合は、**`<label>` で `<input>` を内包し `display: none` にして視覚的に隠す**。選択状態は `.sel` クラスを `<label>` に付与して表現する。

#### 2-1. ラジオ（単一選択）

```html
<label class="opt">
  <input type="radio" name="<key>" value="<value>" class="opt__input">
  <!-- 例: name="age" value="20代" -->
</label>
```

```css
/* <input> を完全に非表示にし、<label> の視覚だけで選択状態を表現する */
.opt__input { display: none; }
/* 選択済みスタイルは .sel クラスで表現 */
.opt.sel { background: var(--pk); color: #fff; }
```

```js
$input.on('change', () => {
  $w.find('.opt').removeClass('sel');
  $label.addClass('sel');
  setTimeout(() => commit(), 280);
});

// commit — L-Step 変数キーで hidden input に同期
$('<input>').attr({ type: 'hidden', name: s.key, value: vals[0] }).appendTo('body');
```

#### 2-2. チェックボックス（複数選択）

```html
<label class="opt opt--m">
  <input type="checkbox" name="<key>" value="<value>" class="opt__input">
  <!-- 例: name="concern" value="option-a" -->
</label>
```

```js
$input.on('change', () => {
  $label.toggleClass('sel', $input.prop('checked'));
  const hasAny = $w.find('.opt__input:checked').length > 0;
  $nbW.find('.nb').prop('disabled', !hasAny);
});

// commit — L-Step 変数キーで checked checkbox に同期
vals.forEach(v => {
  $('<input>').attr({ type: 'checkbox', name: s.key, value: v, checked: true })
    .addClass('u-hidden').appendTo('body');
});
```

#### 2-3. セレクトボックス

```html
<select name="clinic_shop" class="field__sel">
  <option value="">選択してください</option>
  <option value="新宿店">新宿店（新宿東口）</option>
</select>
```

### 3. 値の取得方法

| タグ | 値の取得方法 |
|---|---|
| `radio` | `$('[name="KEY"]:checked').val()` |
| `checkbox` | `$('[name="KEY"]:checked').map((_, el) => $(el).val()).get()` |
| `select` | `$('[name="KEY"]').val()` |
| `text` / `email` | `$('[name="KEY"]').val().trim()` |

- `.data('v')` でボタンに値を持たせて後から読み出す実装は **禁止**。値は常に `:checked` または `.val()` で取得する。

### 4. `name` 属性の命名

- **L-Step へ渡す最終的な `name`** は `refactoring-spec.md` のマッピング表で定義されたキーを使用する。
- チャットボット型 LP で動的生成する選択肢グループの `<input>` の `name` は `s.key`（bare key）をそのまま使う。
- `addParamsToCtaUrl` はこれらの name を直接参照する（`$('[name="<key>"]:checked')` 等）。hidden への変換は行わない。
- `type="hidden"` を使う input は `bot_basic_id`（index.php/html に静的配置）のみ。

### 5. チェックリスト

- [ ] 単一選択に `<input type="radio">` を使っている
- [ ] 複数選択に `<input type="checkbox">` を使っている
- [ ] ドロップダウンに `<select>` を使っている
- [ ] すべての `<input>` に `name` 属性がある
- [ ] 値の取得に `.data('v')` を使わず `:checked` / `.val()` を使っている
- [ ] ボタン風の外見は `<label>` + `.sel` クラスで実現し `<input>` は `display: none` にしている
