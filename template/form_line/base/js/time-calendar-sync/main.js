/**
 * 日時カレンダーの埋め込み
 *
 * @param {object} params
 * @param {string} params.parentSelector - カレンダーを埋め込む親要素のIDセレクタ（必須）
 * @param {string} params.checkBoxAttrName - 日時のチェックボックスのname属性名（必須）
 * @param {object} [params.options={}] - オプション設定（省略可能）
 * @param {number} [params.options.maxSelectedDate=2] - 最大選択日数
 */
export function embedTimeCalendar({
  parentSelector,
  checkBoxAttrName,
  scheduleFetchUrl,
  options = {},
}) {
  // ──────────────── 引数バリデーション ────────────────
  try {
    validateArgument({
      parentSelector,
      checkBoxAttrName,
      scheduleFetchUrl,
      options,
    });
  } catch (e) {
    console.error(e);
  }
  // ──────────────── / 引数バリデーション ────────────────

  // ──────────────── グローバル変数の定義 ────────────────
  const defaultOptions = {
    maxSelectedDate: 1, // 最大選択日数
    useScheduleDummyData: false, // フェッチ先のダミーデータの使用フラグ
    showSlotCount: false, // 空き枠数を表示のフラグ
    couponSettings: {
      isAllTimeCoupon: false, // 時間セルにクーポンアイコンを表示するか否か
    },
  };
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    couponSettings: {
      ...defaultOptions.couponSettings,
      ...options?.couponSettings,
    },
  };
  const {
    maxSelectedDate,
    useScheduleDummyData,
    showSlotCount,
    couponSettings,
  } = mergedOptions;

  // カレンダー全体の親要素
  const $parent = $(parentSelector);

  // 状態管理
  const state = {
    selectedDate: clearSelectedDate(), // 最大選択数分の要素を持った配列（例：[{ date: '', isCouponTime: false }, ...]）
    // フェッチデータ格納用
    scheduleData: {
      clinicName: '',
      timeSlots: [],
      businessHours: null,
      schedules: [],
    },
    weeksCount: 0,
    currentSlideNum: 1,
    isMoving: false,
    scrollObserver: null,
  };

  // 初期化用（簡易ディープコピー）
  const initState = structuredClone(state);

  // ──────────────── / グローバル変数の定義 ────────────────

  /**
   * インスタンス引数のバリデーション処理
   * @param {object} params
   * @param {string} params.parentSelector - カレンダーを埋め込む親要素のIDセレクタ
   * @param {string} params.checkBoxAttrName - 日時のチェックボックスのname属性名
   * @param {object} [params.options] - オプション設定
   */
  function validateArgument({
    parentSelector,
    checkBoxAttrName,
    scheduleFetchUrl,
    options,
  }) {
    // ──────── 親要素セレクタ、チェックボックスname属性名 ────────
    if (!parentSelector || !checkBoxAttrName || !scheduleFetchUrl) {
      ('"parentSelector" and "checkBoxAttrName" and "scheduleFetchUrl" are required.');
    } else {
      // IDセレクタかのチェック
      const isIdSelector = parentSelector.trim().startsWith('#');

      if (!isIdSelector) {
        throw new Error('Please specify an ID selector.');
      }
    }

    // ──────── オプション設定 ────────
    const {
      maxSelectedDate,
      useScheduleDummyData,
      showSlotCount,
      couponSettings,
    } = options;

    // 最大選択数
    if (maxSelectedDate !== undefined && typeof maxSelectedDate !== 'number') {
      throw new Error('"maxSelectedDate" must be a number.');
    }

    // ダミーデータの使用フラグ
    if (
      useScheduleDummyData !== undefined &&
      typeof useScheduleDummyData !== 'boolean'
    ) {
      throw new Error('"useScheduleDummyData" must be a boolean.');
    }

    // 空き枠数
    if (showSlotCount !== undefined && typeof showSlotCount !== 'boolean') {
      throw new Error('"showSlotCount" must be a boolean.');
    }

    // クーポン設定
    if (couponSettings !== undefined) {
      if (typeof couponSettings !== 'object' || couponSettings === null) {
        throw new Error('"couponSettings" must be an object.');
      }

      // 必須項目プロパティ
      const requiredFields = ['showStartDays', 'showDays', 'showTimeList'];
      requiredFields.forEach((key) => {
        if (!(key in couponSettings)) {
          throw new Error(`"${key}" is required in couponSettings.`);
        }
      });

      // 型チェック
      const { isAllTimeCoupon, showStartDays, showDays, showTimeList } =
        couponSettings;

      if (
        isAllTimeCoupon !== undefined &&
        typeof isAllTimeCoupon !== 'boolean'
      ) {
        throw new Error('"isAllTimeCoupon" must be a boolean.');
      }

      if (typeof showStartDays !== 'number') {
        throw new Error('"showStartDays" must be a number.');
      }

      if (typeof showDays !== 'number') {
        throw new Error('"showDays" must be a number.');
      }

      if (
        !Array.isArray(showTimeList) ||
        !showTimeList.every((item) => typeof item === 'string')
      ) {
        throw new Error('"showTimeList" must be an array of strings.');
      }
    }
  }

  /**
   * フェッチデータのバリデーション処理
   * @param {object} scheduleData - スケジュールデータ
   * @param {string} scheduleData.clinicName - クリニック名
   * @param {object} scheduleData.businessHours - 営業時間
   * @param {number} scheduleData.businessHours.open - 開始時間（数値）
   * @param {number} scheduleData.businessHours.close - 終了時間（数値）
   * @param {string[]} scheduleData.timeSlots - 時間スロットのリスト
   * @param {Array<object>} scheduleData.schedules - スケジュールリスト
   * @param {string} scheduleData.schedules[].date - 日付（YYYY/MM/DD）
   * @param {number} scheduleData.schedules[].isHoliday - 祝日フラグ（0 or 1）
   * * @param {number} scheduleData.schedules[].isScheduleFull - 空枠が存在するかのフラグ（0 or 1）
   * @param {number} scheduleData.schedules[].isClosed - 休診日フラグ（0 or 1）
   * @param {object} scheduleData.schedules[].slots - 時間ごとの予約枠情報
   * @param {number} scheduleData.schedules[].slots[].count - 空き枠数
   * @param {number} scheduleData.schedules[].slots[].symbol - スロットの記号（状態を表す）
   */
  const validateFetchedScheduleData = (scheduleData) => {
    const { clinicName, businessHours, timeSlots, schedules } = scheduleData;

    // ──────── クリニック名 ────────
    if (typeof clinicName !== 'string' || clinicName === '') {
      throw new Error('"clinicName" is invalid.');
    }

    // ──────── 営業時間 ────────
    if (businessHours == null) {
      throw new Error('"businessHours" is invalid.');
    }

    const { open, close } = businessHours;
    if (typeof open !== 'number' || typeof close !== 'number') {
      throw new Error('"open or close" is invalid.');
    }

    // ──────── 時間リスト ────────
    if (
      !Array.isArray(timeSlots) ||
      timeSlots.length === 0 ||
      !timeSlots.every((item) => typeof item === 'string')
    ) {
      throw new Error('"timeSlots" is invalid.');
    }

    if (!Array.isArray(schedules) || schedules.length === 0) {
      throw new Error('"schedules" is invalid.');
    }

    // ──────── スケジュールリスト ────────
    schedules.forEach((schedule, index) => {
      // 日付
      if (typeof schedule.date !== 'string' || schedule.date === '') {
        throw new Error(`"schedules[${index}].date" is invalid.`);
      }

      // 祝日・休診日フラグ
      if (
        typeof schedule.isHoliday !== 'number' ||
        typeof schedule.isClosed !== 'number' ||
        typeof schedule.isScheduleFull !== 'number'
      ) {
        throw new Error(
          `"schedules[${index}].isHoliday or isClosed" or "isScheduleFull" is invalid.`,
        );
      }

      // 秋枠状態
      if (
        schedule.slots == null ||
        typeof schedule.slots !== 'object' ||
        Array.isArray(schedule.slots) ||
        Object.keys(schedule.slots).length === 0
      ) {
        throw new Error(`"schedules[${index}].slots" is invalid.`);
      }

      for (const [time, slotInfo] of Object.entries(schedule.slots)) {
        if (
          typeof slotInfo?.count !== 'number' ||
          typeof slotInfo?.symbol !== 'number'
        ) {
          throw new Error(
            `"schedules[${index}].slots[${time}].count or symbol" is invalid.`,
          );
        }
      }
    });
  };

  /**
   * 引数のテキストをエスケープして返す
   * @param {string} str
   * @returns {string} エスケープ済み文字列
   */
  const escapeHTML = (str) => {
    return str.replace(/[&<>"']/g, (match) => {
      switch (match) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return match;
      }
    });
  };

  /**
   * 日付フォーマット
   * @param {Date|string|number} date - 日付オブジェクトが受け入れ可能なデータ
   * @param {string} format - フォーマット（例: 'YYYY/MM/DD hh:mm:ss'）
   * @returns {string} フォーマット済み文字列
   */
  const formatDate = (date, format) => {
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
  };

  /**
   * 時間フォーマット
   * @param {string} time - 時間（例: '1:30'）
   * @returns {string} フォーマット済み文字列
   */
  const padTime = (time) => {
    const [h, m] = time.split(':').map(Number);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  /**
   * APIから取得したスケジュールの最初の要素の日付
   * フォーマットを合わせた文字列比較の簡易チェック
   */
  const isFirstDate = (targetDate) => {
    let isFirstDate = false;
    const formattedTargetDate = formatDate(targetDate, 'YYYY-MM-DD');
    const formattedFirstDate = formatDate(
      state.scheduleData.schedules[0]?.date,
      'YYYY-MM-DD',
    );

    if (formattedTargetDate === formattedFirstDate) {
      isFirstDate = true;
    }

    return isFirstDate;
  };

  /**
   * 日付選択が最大数まで選択されてるかのフラグ
   */
  const isEveryDateSelected = () =>
    state.selectedDate.every((item) => item.date !== '');

  /**
   * 全てのステートを初期状態にクリア
   */
  const resetState = () => {
    Object.assign(state, structuredClone(initState));
  };

  /**
   * スケジュールデータの週数
   *
   * - フェッチデータのスケジュールデータから算出
   */
  const setWeeksCount = () => {
    const count = (state.scheduleData?.schedules || []).length;
    state.weeksCount = Math.ceil(count / 7); // 7日単位で週数を計算
  };

  /**
   * スケジュールデータのプレースホルダーを追加
   *
   * - 7日単位でスケジュールが揃うように、最後の週に足りない日付を補完
   * - 例: 3日分しかない場合、4日目〜7日目の4つの要素を追加
   */
  const fillSchedulePlaceholders = () => {
    const schedules = state.scheduleData?.schedules || [];
    const remainder = schedules.length % 7;
    const missingCount = remainder === 0 ? 0 : 7 - remainder;

    if (missingCount > 0 && schedules.length > 0) {
      const lastDate = new Date(schedules[schedules.length - 1].date); // スケジュールデータの最後の要素の日付オブジェクト

      for (let i = 1; i <= missingCount; i++) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + i);

        schedules.push({
          date: formatDate(nextDate, 'YYYY-MM-DD'),
          isHoliday: 0,
          isClosed: 0,
          slots: {},
          isPlaceholder: 1, // 使わないけど代替データの判定用として
        });
      }
    }
  };

  /**
   * フェッチしたスケジュールデータに各種フラグを付与する
   *
   * - 各スケジュールに対して以下の処理を行う
   *   - クーポン対象日かどうかを判定し `isCouponDay` を追加
   *   - クーポン対象日の場合、対象時間枠に `isCouponTime` を追加
   */
  const adaptScheduleData = () => {
    const schedules = state.scheduleData?.schedules || [];
    const timeSlots = state.scheduleData?.timeSlots || [];

    schedules.forEach((schedule, scheduleIndex) => {
      // クーポン対象日か否かのフラグ追加
      const showStart = couponSettings?.showStartDays ?? 0;
      const showDays = couponSettings?.showDays ?? 0;
      const isCouponDay =
        scheduleIndex >= showStart && scheduleIndex < showStart + showDays;
      schedule.isCouponDay = isCouponDay ? 1 : 0;

      // クーポン対象時間にフラグ追加
      // クーポン期間内の補填データでない場合のみ処理する
      if (isCouponDay && !schedule.isPlaceholder) {
        const showTimeList = couponSettings?.showTimeList || [];
        timeSlots.forEach((time) => {
          if (schedule.slots[time]) {
            schedule.slots[time].isCouponTime = showTimeList.includes(time);
          }
        });
      }
    });
  };

  /**
   * 選択した日付の保存・削除処理
   *
   * @param {string} date - 日付文字列（例：YYYY/MM/dd）
   * @param {string} isCouponTime - false：クーポン時間, true：クーポン未対象時間
   * @param {boolean} isDelete - false：追加処理, true：削除処理
   */
  const updateSelectedDate = ({
    date,
    isCouponTime = false,
    isDelete = false,
  }) => {
    if (date === undefined) {
      throw new Error('selectedDate is required');
    }

    if (isDelete) {
      const index = state.selectedDate.findIndex((item) => item.date === date);
      if (index !== -1) {
        state.selectedDate[index].date = '';
      }
    } else {
      // 先頭の空要素に追加する
      const index = state.selectedDate.findIndex((item) => item.date === '');

      if (index !== -1) {
        state.selectedDate[index].date = date;
        state.selectedDate[index].isCouponTime = isCouponTime;
      }
    }
  };

  /**
   * 選択中の日時リセット
   */
  function clearSelectedDate() {
    const template = {
      date: '',
      isCouponTime: false,
    };

    return new Array(maxSelectedDate)
      .fill(template)
      .map((obj) => structuredClone(obj)); //ディープコピー
  }

  /**
   * カレンダー本体の日時選択エリアを生成
   *
   * @returns {jQuery} カレンダー本体のjQuery要素
   */
  const createTable = () => {
    const $base = $(`
      <div class="js-tc-body__body">
        <div class="js-tc-body__body-inner">
          <div class="js-tc-body__time-warp ${
            showSlotCount ? 'is-tall' : ''
          }"></div>
          <div class="js-tc-body__table-warp"><div class="js-tc-body__table"></div></div>
        </div>
        <div class="js-tc-body__scroll-sentinel"></div>
      </div>
    `);

    // ▼▼▼ 時間列 ▼▼▼
    let timeHtml = '<div class="js-tc-body__time-item-blank"></div>'; //最上部ブランク用
    timeHtml += state.scheduleData.timeSlots
      .map((time) => {
        return `<div class="js-tc-body__time-item">${time}</div>`;
      })
      .join('');

    $base.find('.js-tc-body__time-warp').html(timeHtml);

    // ▼▼▼ スケジュールテーブル ▼▼▼
    const schedules = state.scheduleData?.schedules || [];

    let innerHtml = '';
    let itemsHtml = '';
    let tableColumnsHtml = '';
    let columnCellsHtml = '';

    for (let dayIndex = 0; dayIndex < schedules.length; dayIndex++) {
      const {
        date,
        isHoliday,
        isClosed,
        isScheduleFull,
        isCouponDay,
        slots,
        isPlaceholder, // 代替データかのフラグ（フェッチデータには含まれてない）
      } = schedules[dayIndex];

      // 最上部の日にち、曜日セル
      const dateStr = formatDate(date, 'M/D');
      const dow = formatDate(date, 'dow');
      const isDisallow = isScheduleFull || isClosed || isPlaceholder;

      // 時間毎のセルを追加
      columnCellsHtml += `
        <div class="js-tc-body__table-cell-day">
          <span>${dateStr}</span><span>${dow}</span>
        </div>
      `;

      // 時間のループ
      for (
        let timeIndex = 0;
        timeIndex < state.scheduleData.timeSlots.length;
        timeIndex++
      ) {
        const time = padTime(state.scheduleData.timeSlots[timeIndex]);
        const slot = slots[state.scheduleData.timeSlots[timeIndex]] || {};
        const isEmptyTime = Object.keys(slot).length === 0; // 営業時間が存在しないかのフラグ
        const { symbol, count, isCouponTime } = slot;

        // ステータスに応じたアイコン・クラス・disabled属性を設定
        let cellClass =
          'js-tc-body__table-cell' +
          (showSlotCount ? ' is-tall' : '') +
          (isEmptyTime || isDisallow ? ' is-disallow' : ' is-allow');

        /*
        if (!isClosed && !isPlaceholder) {
          switch (symbol) {
            // 記号 "×"
            case 1:
              cellClass += ' is-disallow is-unavailable';
              break;
            // 記号 "△"
            case 2:
              cellClass += ' is-allow';
              cellClass +=
                isCouponTime && !couponSettings.isAllTimeCoupon
                  ? ' is-coupon'
                  : ' is-pending';
              break;
            // 記号 "◎"
            case 3:
              cellClass += ' is-allow';
              cellClass +=
                isCouponTime && !couponSettings.isAllTimeCoupon
                  ? ' is-coupon'
                  : ' is-available';
              break;
            // 上記以外の記号 "-"
            default:
              console.log(222);
              cellClass += ' is-disallow is-unknown';
          }
        } else {
          // 休診日も "-"
          cellClass += ' is-disallow is-unknown';
        }
        */

        const formattedDate = formatDate(date, 'YYYY-MM-DD');
        const dataAttr = !!(
          isCouponTime ||
          (isCouponDay && couponSettings.isAllTimeCoupon)
        );
        const isShowCount =
          showSlotCount && !isClosed && !isCouponTime && symbol === 2; // 空枠表示が有効 かつ 記号が"△" の場合

        // 時間毎のセルを追加
        columnCellsHtml += `
          <div class="${cellClass}" data-tc-date="${formattedDate} ${time}" data-tc-is-coupon-time="${dataAttr}">
            <div class="js-tc-body__table-cell-inner">${
              isShowCount
                ? `<span class="js-tc-body__table-cell-count">残${count}</span>`
                : ''
            }</div>
          </div>
        `;
      }

      const dateObj = new Date(date);
      const day = dateObj.getDay();
      const className =
        'js-tc-body__table-column' +
        (day === 6 ? ' is-sat' : '') +
        (day === 0 ? ' is-sun' : '') +
        (isHoliday === 1 ? ' is-holiday' : '');

      // 1日の列を追加
      tableColumnsHtml += `<div class="${className}">${columnCellsHtml}</div>`;
      columnCellsHtml = '';

      // 7日分が揃ったかのフラグ（例：7, 14, 21, ...）ループ初回（0）を除くために `dayIndex + 1` を使用
      const isWeekEnd = (dayIndex + 1) % 7 === 0;

      if (isWeekEnd) {
        // 1週間分の行を追加
        itemsHtml += `<div class="js-tc-body__table-item">${tableColumnsHtml}</div>`;
        tableColumnsHtml = '';
      }

      innerHtml += itemsHtml;
      itemsHtml = '';
    }

    // 全体をDOMに追加
    $base.find('.js-tc-body__table').html(innerHtml);

    return $base;
  };

  /**
   * カレンダー下部の選択日時リストの生成
   *
   * @returns {string} HTML文字列
   */
  const createSelectedList = () => {
    let html = '';

    for (let i = 0; i < state.selectedDate.length; i++) {
      const label = maxSelectedDate === 1 ? '希望日時' : `第${i + 1}希望日時`;

      html += `
        <div class="js-tc-list__item">
          <div class="js-tc-list__title"><span>${label}</span></div>
          <div class="js-tc-list__content">
            <div class="js-tc-list__content-inner"></div>
            <input type="hidden" name="${checkBoxAttrName}" value="" data-tc-is-coupon-time="" data-tc-is-today="" class="js-tc-hidden-input">
          </div>
        </div>
      `;
    }

    return html;
  };

  /**
   * 初期画面の生成
   *
   * - カレンダーの大枠を生成
   */
  const initDisplay = () => {
    const $tc = $parent.find('.js-tc');
    const $body = $('<div class="js-tc-body"></div>');
    const $loading = $(
      '<div class="js-tc-loading"><div class="js-tc-loading__inner"></div></div>',
    );
    const $messageBox = $(
      '<div class="js-tc-message"><div class="js-tc-message__inner"></div></div>',
    );

    const $navigator = $(
      '<div class="js-tc-navigator"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg></div>',
    );

    // ヘッダー、本体、ローダーを追加
    $tc.append($body).append($loading).append($messageBox).append($navigator);

    // カレンダー下部mの選択日時リスト
    const selectedListHtml = createSelectedList();
    $parent.find('.js-tc-list').html(selectedListHtml);
  };

  /**
   * カレンダーの初期化処理
   */
  const initCalendarDisplay = () => {
    const $body = $parent.find('.js-tc-body');
    const $bodyBody = createTable();

    $body.empty(); // 既存の要素をクリア
    $body.append($bodyBody);
  };

  /*
   * 読み込み中のローダー表示制御
   *
   * - ローダ要素へのクラス付与で表示・非表示を制御
   */
  const toggleLoadingDisplay = ({ isVisible = true }) => {
    $parent.find('.js-tc-loading').toggleClass('is-visible', isVisible);
  };

  /*
   * メッセージ表示制御
   *
   * - メッセージ要素へのクラス付与で表示・非表示を制御
   */
  const toggleMessageDisplay = ({ isVisible = true, message = '' }) => {
    $parent.find('.js-tc-message__inner').html(message);
    $parent.find('.js-tc-message').toggleClass('is-visible', isVisible);
  };

  /**
   * カレンダー下部の選択中日付リストの更新
   *
   * - state.selectedDate に応じて表示状態を変更
   */
  const updateSelectedListDisplay = () => {
    const $listItems = $parent.find('.js-tc-list__item');

    $listItems.each((index, element) => {
      const $item = $(element);
      const $content = $item.find('.js-tc-list__content-inner');
      const $input = $content.siblings(`[name="${checkBoxAttrName}"]`);
      const { date, isCouponTime } = state.selectedDate[index];
      const formattedDate = formatDate(date, 'M/D h:mm');
      const isExist = date !== '';

      if (isExist) {
        const html = `
          <span class="js-tc-list__value">
          ${formattedDate}
          ${
            isCouponTime && couponSettings.isAllTimeCoupon
              ? '<span class="js-tc-list__coupon"></span>'
              : ''
          }
          </span>
          <button class="js-tc-list__clear-btn" data-tc-date="${date}"><span class="js-tc-list__clear-btn-icon"></span></button>
        `;
        $content.html(html);
        $input.val(date);
        $input.attr('data-tc-is-coupon-time', !!isCouponTime);
        $input.attr('data-tc-is-today', isFirstDate(date));
      } else {
        $content.empty();
        $input.val('');
        $input.attr('data-tc-is-coupon-time', '');
        $input.attr('data-tc-is-today', '');
      }
    });
  };

  /**
   * カレンダーの日時選択肢セルの有効・無効を制御
   *
   * - 最大選択数に達している場合は、選択中の項目以外を無効化
   * - 未達成の場合は、すべての選択肢を有効
   */
  const updateCalendarCellDisplay = () => {
    const $cells = $parent.find('.js-tc-body__table-cell');
    const isSingleSelect = maxSelectedDate === 1;
    const selectedDates = state.selectedDate;

    // 単一選択モードなら全チェックリセット
    if (isSingleSelect) {
      $cells.removeClass('is-checked');
    } else {
      // 複数選択モードなら番号をリセット
      $cells.find('.js-tc-body__table-cell-selected-num').remove();
    }

    $cells.each((_, element) => {
      const $cell = $(element);
      const date = ($cell.attr('data-tc-date') || '').trim();
      const isSelected = selectedDates.some((item) => item.date === date);

      // 無効化を判定しクラス操作
      $cell.toggleClass(
        'is-disabled',
        !isSingleSelect && !isSelected && isEveryDateSelected(),
      );

      $cell.toggleClass('is-checked', isSelected);

      // 選択番号付与（複数選択モードのみ）
      if (isSelected && !isSingleSelect) {
        const index = selectedDates.findIndex((item) =>
          item.date.includes(date),
        );
        $cell.append(
          `<span class="js-tc-body__table-cell-selected-num">${
            index + 1
          }</span>`,
        );
      }
    });
  };

  /**
   * イベント登録
   *
   * - 既存のイベントを解除してからイベントを登録
   */
  const addEventListener = () => {
    // 既存の名前付きイベントを全て解除
    $parent.off('.tc');

    /**
     * 日時選択時の処理
     */
    $parent.on('click.tc', '.js-tc-body__table-cell.is-allow', (e) => {
      const $cell = $(e.currentTarget);
      const isSelected = $cell.hasClass('is-checked'); // すでに選択済みかどうか
      const date = $cell.attr('data-tc-date') || '';
      const isCouponTime = $cell.attr('data-tc-is-coupon-time') === 'true'; // stateへの保存はboolean型に変換
      const isSingleSelect = maxSelectedDate === 1;

      // チェックを外す場合は、state.selectedDate から選択日付を削除
      if (isSelected) {
        updateSelectedDate({ date, isDelete: true });
      } else {
        if (isSingleSelect) {
          // 単一選択モードでは、選択済みをリセット
          state.selectedDate = clearSelectedDate();
        }
        // チェックを付けた場合は、state.selectedDate に選択日付を保存
        updateSelectedDate({ date, isCouponTime, isDelete: false });
      }

      updateCalendarCellDisplay();
      updateSelectedListDisplay();

      // hiddenのchangeイベントを発火（組み込みページで値を検知するため）
      const $hidden = $parent.find('.js-tc-hidden-input');
      $hidden.trigger('change');
    });

    /**
     * カレンダー下部の選択日時のクリア処理
     */
    $parent.on('click.tc', '.js-tc-list__clear-btn', (e) => {
      const $button = $(e.currentTarget);
      const date = $button.attr('data-tc-date').trim();

      updateSelectedDate({ date, isDelete: true });
      updateCalendarCellDisplay();
      updateSelectedListDisplay();
    });

    /**
     * スライド切り替わり中のフラグ更新処理
     */
    $parent.on('transitionstart.tc', '.js-tc-body__table', (e) => {
      if (e.target === e.currentTarget) {
        state.isMoving = true;
      }
    });

    /**
     * スライド切り替わり中のフラグ更新処理
     */
    $parent.on('transitionend.tc', '.js-tc-body__table', (e) => {
      if (e.target === e.currentTarget) {
        state.isMoving = false;
      }
    });
  };

  /**
   * カレンダーのスライドに必要なCSSをstyleタグで埋め込む
   */
  const embedStyleTag = () => {
    // 親のID名から styleタグ のid名を決める
    const parentIdName = parentSelector.replace(/^#/, '');
    const styleTagIdName = `${parentIdName}__style`;
    const dayCount = (state.scheduleData?.schedules || []).length;

    // 既存のstyleタグをクリア
    $(`#${styleTagIdName}`).remove();

    let styles = `
      ${parentSelector} .js-tc {
        --calendar-slide-num: ${state.weeksCount};
      }
      ${parentSelector} .js-tc .js-tc-body__table {
        width: calc(60px * ${dayCount} + 100px);
      }
      ${parentSelector} .js-tc .js-tc-body__body-inner {
        width: calc(60px * ${dayCount} + 100px);
      }
    `;

    // styleタグ埋め込み
    $('<style>')
      .attr('id', styleTagIdName)
      .prop('type', 'text/css')
      .html(styles)
      .appendTo('head');
  };

  /**
   * スケジュールデータ（JSON）を取得し state に保存
   *
   * - 将来的なパラメータ拡張に備え、params オブジェクトにしとく
   * @param {{ clinicId: string }} params - クリニックID（必須）
   * @param {{ clinicId: number }} params - スケジュール取得日数（デフォルト：21）
   */
  const fetchScheduleWithSetData = async ({ params = {} }) => {
    const { clinicId, days = 21 } = params;

    if (!clinicId) {
      throw new Error('clinicId is required');
    }

    if (typeof days !== 'number' || Number.isNaN(days)) {
      throw new Error('days must be a number');
    }

    try {
      let response = null;

      // ローカル環境の場合はダミーデータを取得
      if (window.location.hostname === '127.0.0.1' || useScheduleDummyData) {
        const fetchUrl = new URL(`dummy-data.json`, import.meta.url);
        response = await fetch(fetchUrl);
      } else {
        response = await fetch(scheduleFetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            days,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`);
      }

      const data = await response.json();
      // レスポンスデータのバリデーション
      validateFetchedScheduleData(data);
      state.scheduleData = data;
    } catch (e) {
      throw e;
    }
  };

  /**
   * フェッチ処理を行い、レスポンスのスケジュールデータからカレンダーを生成
   *
   * @param {{ clinicId: string }} params - POSTで渡すパラメータ
   */
  const createCalendar = async ({ params }) => {
    try {
      // 全ての状態をクリア
      resetState();

      // ローディング表示
      toggleLoadingDisplay({});

      // メッセージ初期化
      toggleMessageDisplay({ isVisible: false });

      // スケジュールデータの取得と state への保存
      await fetchScheduleWithSetData({ params });
      fillSchedulePlaceholders();
      adaptScheduleData();

      // スケジュールデータに基づいた state の初期化
      setWeeksCount();

      // スタイルタグの埋め込み
      embedStyleTag();

      // カレンダーのDOM生成
      initCalendarDisplay();

      // イベント登録
      addEventListener();

      // UIの初期表示更新
      updateSelectedListDisplay();

      // デバック用
      //throw new Error();
    } catch (e) {
      // エラーメッセージ表示
      toggleMessageDisplay({
        isVisible: true,
        message: `現在、アクセスが集中しており\nカレンダーが正しく表示されない場合があります。\n\nその際は、<span class="js-tc-message__em-text">日程を入力せずにそのまま予約をお進めください。</span>\n\nご予約後に、トーク画面でご希望の日時をお知らせください。\n（例：12/5 9:00　または　12月10日 13:30 など）\n\nお手数をおかけしますが、確認後スタッフより順次ご連絡いたします🙇‍♀️`,
      });
      // エラーフラグ付与
      $parent.attr('data-tc-is-error', '');
      console.error(e);
    } finally {
      // ローディング非表示
      toggleLoadingDisplay({ isVisible: false });
    }
  };

  /**
   * 初期化
   */
  const init = () => {
    try {
      initDisplay();
    } catch (e) {
      console.error(e);
    }
  };

  return {
    init,
    createCalendar,
  };
}
