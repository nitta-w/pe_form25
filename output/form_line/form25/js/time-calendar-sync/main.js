export function embedTimeCalendar({
  parentSelector,
  checkBoxAttrName,
  scheduleFetchUrl,
  options = {},
}) {
  // ──────────────── 引数バリデーション ────────────────
  try {
    validateArgument({ parentSelector, checkBoxAttrName, scheduleFetchUrl, options });
  } catch (e) {
    console.error(e);
  }

  // ──────────────── グローバル変数の定義 ────────────────
  const defaultOptions = {
    maxSelectedDate: 3,
    useScheduleDummyData: false,
    couponSettings: { isAllTimeCoupon: false, showCouponIcon: false },
  };
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    couponSettings: { ...defaultOptions.couponSettings, ...options?.couponSettings },
  };
  const { maxSelectedDate, useScheduleDummyData, couponSettings } = mergedOptions;

  const $parent = $(parentSelector);
  const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];


  // 状態管理
  const state = {
    scheduleData: { clinicName: '', timeSlots: [], businessHours: null, schedules: [] },
    currentYear: 0,
    currentMonth: 0,
    scheduleMap: {},
    prefTimes: new Array(maxSelectedDate).fill(''),
    isMoving: false,
  };
  const initState = structuredClone(state);
  // ──────────────── / グローバル変数の定義 ────────────────

  /**
   * インスタンス引数のバリデーション処理
   */
  function validateArgument({ parentSelector, checkBoxAttrName, scheduleFetchUrl, options }) {
    if (!parentSelector || !checkBoxAttrName || !scheduleFetchUrl) {
      throw new Error('"parentSelector" and "checkBoxAttrName" and "scheduleFetchUrl" are required.');
    }
    if (!parentSelector.trim().startsWith('#')) {
      throw new Error('Please specify an ID selector.');
    }
    const { maxSelectedDate, useScheduleDummyData, couponSettings } = options;
    if (maxSelectedDate !== undefined && typeof maxSelectedDate !== 'number') {
      throw new Error('"maxSelectedDate" must be a number.');
    }
    if (useScheduleDummyData !== undefined && typeof useScheduleDummyData !== 'boolean') {
      throw new Error('"useScheduleDummyData" must be a boolean.');
    }
    if (couponSettings !== undefined) {
      if (typeof couponSettings !== 'object' || couponSettings === null) {
        throw new Error('"couponSettings" must be an object.');
      }
      ['showStartDays', 'showDays', 'showTimeList'].forEach((key) => {
        if (!(key in couponSettings)) throw new Error(`"${key}" is required in couponSettings.`);
      });
      const { isAllTimeCoupon, showStartDays, showDays, showTimeList } = couponSettings;
      if (isAllTimeCoupon !== undefined && typeof isAllTimeCoupon !== 'boolean') {
        throw new Error('"isAllTimeCoupon" must be a boolean.');
      }
      if (typeof showStartDays !== 'number') throw new Error('"showStartDays" must be a number.');
      if (typeof showDays !== 'number') throw new Error('"showDays" must be a number.');
      if (!Array.isArray(showTimeList) || !showTimeList.every((i) => typeof i === 'string')) {
        throw new Error('"showTimeList" must be an array of strings.');
      }
    }
  }

  /**
   * フェッチデータのバリデーション処理
   */
  const validateFetchedScheduleData = (scheduleData) => {
    const { clinicName, businessHours, timeSlots, schedules } = scheduleData;
    if (typeof clinicName !== 'string' || clinicName === '') throw new Error('"clinicName" is invalid.');
    if (businessHours == null) throw new Error('"businessHours" is invalid.');
    const { open, close } = businessHours;
    if (typeof open !== 'number' || typeof close !== 'number') throw new Error('"open or close" is invalid.');
    if (!Array.isArray(timeSlots) || timeSlots.length === 0 || !timeSlots.every((i) => typeof i === 'string')) {
      throw new Error('"timeSlots" is invalid.');
    }
    if (!Array.isArray(schedules) || schedules.length === 0) throw new Error('"schedules" is invalid.');
    schedules.forEach((schedule, index) => {
      if (typeof schedule.date !== 'string' || schedule.date === '') {
        throw new Error(`"schedules[${index}].date" is invalid.`);
      }
      if (
        typeof schedule.isHoliday !== 'number' ||
        typeof schedule.isClosed !== 'number' ||
        typeof schedule.isScheduleFull !== 'number'
      ) {
        throw new Error(`"schedules[${index}].isHoliday or isClosed or isScheduleFull" is invalid.`);
      }
      if (
        schedule.slots == null ||
        typeof schedule.slots !== 'object' ||
        Array.isArray(schedule.slots) ||
        Object.keys(schedule.slots).length === 0
      ) {
        throw new Error(`"schedules[${index}].slots" is invalid.`);
      }
      for (const [time, slotInfo] of Object.entries(schedule.slots)) {
        if (typeof slotInfo?.count !== 'number' || typeof slotInfo?.symbol !== 'number') {
          throw new Error(`"schedules[${index}].slots[${time}].count or symbol" is invalid.`);
        }
      }
    });
  };

  /**
   * 引数のテキストをエスケープして返す
   */
  const escapeHTML = (str) =>
    str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));

  /**
   * 日付フォーマット（coding-rules.md JS §4 準拠・改変禁止）
   */
  const formatDate = (date, format) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const tokens = [
      ['YYYY', d.getFullYear()], ['MM', pad(d.getMonth() + 1)], ['DD', pad(d.getDate())],
      ['hh', pad(d.getHours())], ['mm', pad(d.getMinutes())], ['ss', pad(d.getSeconds())],
      ['dow', DOW_LABELS[d.getDay()]],
      ['M', d.getMonth() + 1], ['D', d.getDate()],
      ['h', d.getHours()], ['m', d.getMinutes()], ['s', d.getSeconds()],
    ];
    return tokens.reduce((result, [key, value]) => result.replace(new RegExp(key, 'g'), value), format);
  };

  /**
   * 最初のスケジュール日かどうか
   */
  const isFirstDate = (targetDate) => {
    const a = formatDate(targetDate, 'YYYY-MM-DD');
    const b = formatDate(state.scheduleData.schedules[0]?.date, 'YYYY-MM-DD');
    return a === b;
  };

  /**
   * state を初期状態にリセット（選択日・時間もクリア）
   */
  const resetState = () => Object.assign(state, structuredClone(initState));

  /**
   * フェッチしたスケジュールデータにクーポンフラグを付与
   */
  const adaptScheduleData = () => {
    const schedules = state.scheduleData?.schedules || [];
    const timeSlots = state.scheduleData?.timeSlots || [];
    schedules.forEach((schedule, i) => {
      const showStart = couponSettings?.showStartDays ?? 0;
      const showDays = couponSettings?.showDays ?? 0;
      const isCouponDay = i >= showStart && i < showStart + showDays;
      schedule.isCouponDay = isCouponDay ? 1 : 0;
      if (isCouponDay && !schedule.isPlaceholder) {
        const showTimeList = couponSettings?.showTimeList || [];
        timeSlots.forEach((time) => {
          if (schedule.slots[time]) schedule.slots[time].isCouponTime = showTimeList.includes(time);
        });
      }
    });
  };


  // ──────────────── 月グリッドカレンダー ────────────────

  /**
   * スケジュールデータから高速ルックアップ用マップを構築し、表示月を初期化
   */
  const buildScheduleMap = () => {
    state.scheduleMap = {};
    const schedules = state.scheduleData?.schedules || [];
    schedules.forEach((s) => {
      state.scheduleMap[formatDate(s.date, 'YYYY-MM-DD')] = s;
    });
    if (schedules.length > 0) {
      const d = new Date(schedules[0].date);
      state.currentYear = d.getFullYear();
      state.currentMonth = d.getMonth();
    } else {
      const now = new Date();
      state.currentYear = now.getFullYear();
      state.currentMonth = now.getMonth();
    }
  };

  /**
   * 月グリッド HTML を生成して返す
   * @param {string} [preSelectedDate] - 月ナビ時に引き継ぐ選択済み日付（YYYY-MM-DD）
   */
  const createMonthGrid = (preSelectedDate = '') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = state.currentYear;
    const month = state.currentMonth;
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // ナビゲーション範囲（スケジュールデータの最初・最後の月）
    const schedules = state.scheduleData.schedules;
    const minD = schedules.length ? new Date(schedules[0].date) : new Date();
    const maxD = schedules.length ? new Date(schedules[schedules.length - 1].date) : new Date();
    const canPrev = year > minD.getFullYear() || (year === minD.getFullYear() && month > minD.getMonth());
    const canNext = year < maxD.getFullYear() || (year === maxD.getFullYear() && month < maxD.getMonth());

    // 曜日ヘッダー
    const dowHtml = DOW_LABELS.map((d, i) =>
      `<span${i === 0 ? ' style="color:#E04040"' : i === 6 ? ' style="color:#4080E0"' : ''}>${d}</span>`
    ).join('');

    // 日付セル
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div class="cal__day empty"></div>';
    for (let dd = 1; dd <= daysInMonth; dd++) {
      const dt = new Date(year, month, dd);
      const dw = dt.getDay();
      const dateStr = formatDate(dt, 'YYYY-MM-DD');
      const isPast = dt < today;
      const isWeekend = dw === 0 || dw === 6;
      const s = state.scheduleMap[dateStr];
      const maxD = schedules.length ? new Date(schedules[schedules.length - 1].date) : null;
      if (maxD) maxD.setHours(0, 0, 0, 0);
      const isBeyondData = maxD ? dt > maxD : false;
      const isClosed = !isPast && !isBeyondData && s?.isClosed === 1;
      const isFull = !isPast && !isBeyondData && !isClosed && (!s || s.isScheduleFull === 1);
      const isSelected = preSelectedDate === dateStr;
      const isDisabled = isPast || isFull || isClosed || isBeyondData;

      const cls = ['cal__day'];
      if (isPast) cls.push('past');
      else if (isClosed) cls.push('closed');
      else if (isFull) cls.push('full');
      else if (isBeyondData) cls.push('beyond');
      if (dw === 0) cls.push('sun');
      if (dw === 6) cls.push('sat');

      const isCouponDay = s?.isCouponDay === 1;
      const isToday     = isFirstDate(dateStr);
      const popTag = isWeekend && !isPast && !isFull && !isBeyondData ? '<span class="pop-tag"></span>' : '';
      cells += `<label class="${cls.join(' ')}" data-tc-date="${dateStr}">
        <input type="checkbox" name="${checkBoxAttrName}" value="${dateStr}" class="cal__day-input"
          data-tc-is-coupon-day="${isCouponDay}"
          data-tc-is-today="${isToday}"
          ${isSelected ? 'checked' : ''}${isDisabled ? ' disabled' : ''}>
        ${dd}${popTag}
      </label>`;
    }

    return `
      <div class="cal">
        <div class="cal__head">
          <div class="cal__month">${year}年 ${month + 1}月</div>
          <div class="cal__nav">
            <button id="calPrev"${!canPrev ? ' disabled' : ''}>
              <svg viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            </button>
            <button id="calNext"${!canNext ? ' disabled' : ''}>
              <svg viewBox="0 0 20 20" fill="none"><path d="M7 4L13 10L7 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="cal__dow">${dowHtml}</div>
        <div class="cal__grid">${cells}</div>
        <p class="cal__help"><span style="color:var(--gold)">●</span> <strong style="color:var(--gold)">金の印</strong>＝土日祝の人気枠（LINE限定で予約可能）</p>
      </div>
    `;
  };

  /**
   * 希望行（第1〜第3希望）HTML を生成して返す
   */
  const createPrefRows = () => {
    const date = $parent.find(`[name="${checkBoxAttrName}"]:checked`).val() || '';
    const filled = date !== '';
    const d = filled ? new Date(date) : null;
    const dateLabel = filled
      ? `${d.getMonth() + 1}/${d.getDate()}(${DOW_LABELS[d.getDay()]})`
      : 'タップで選択';

    const timeLabels = ['第1希望時間', '第2希望時間', '第3希望時間'];

    let html = '<div class="pref">';

    // 選択日の表示行
    html += `
      <div class="pref__row" data-pref-date>
        <span class="pref__label">選択日</span>
        <div class="pref__date${filled ? ' filled' : ''}" id="pref-date-display">${dateLabel}</div>
        ${filled ? `<button class="pref__clear" data-pref-clear-date><svg viewBox="0 0 14 14" fill="none"><path d="M10 4L4 10M4 4l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>` : ''}
      </div>
    `;

    // 時間スロット行（maxSelectedDate 本）
    for (let i = 0; i < maxSelectedDate; i++) {
      const isFiltered = i >= 2;
      const timeOptions = isFiltered
        ? `<option value="【指定しない】">【指定しない】</option>${buildFilteredTimeOptions(date)}`
        : buildTimeOptions(date);
      html += `
        <div class="pref__row" data-pref-time-index="${i}">
          <span class="pref__label">${timeLabels[i] || `第${i + 1}希望時間`}</span>
          <div class="pref__time">
            <select name="${checkBoxAttrName}_time_${i + 1}" data-tc-date="${filled ? date : ''}"${!filled ? ' disabled' : ''}>
              <option value="">時間</option>
              ${timeOptions}
            </select>
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  };

  // ──────────────── 初期化・表示制御 ────────────────

  const initDisplay = () => {
    const $tc = $parent.find('.js-tc');
    $tc.append('<div class="js-tc-loading"><div class="js-tc-loading__inner"></div></div>');
    $tc.append('<div class="js-tc-message"><div class="js-tc-message__inner"></div></div>');
  };

  const initCalendarDisplay = () => {
    $parent.find('.js-tc').prepend(createMonthGrid());
    $parent.find('.js-tc-list').html(createPrefRows());
  };

  const toggleLoadingDisplay = ({ isVisible = true }) =>
    $parent.find('.js-tc-loading').toggleClass('is-visible', isVisible);

  const toggleMessageDisplay = ({ isVisible = true, message = '' }) => {
    $parent.find('.js-tc-message__inner').html(message);
    $parent.find('.js-tc-message').toggleClass('is-visible', isVisible);
  };

  // ──────────────── 時間オプション生成 ────────────────

  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  /**
   * 選択日のスロットデータから時間 <option> HTML を生成
   * 日付未選択またはスロットデータなし → timeSlots を一律表示
   */
  const buildTimeOptions = (date) => {
    const scheduleData = state.scheduleMap[date];
    if (!date || !scheduleData) {
      return state.scheduleData.timeSlots
        .map(t => `<option value="${t}">${t}</option>`)
        .join('');
    }

    const { slots, isCouponDay } = scheduleData;
    const timeSlots = state.scheduleData.timeSlots;
    let html = '';

    for (const time of timeSlots) {
      if (slots[time] === undefined) continue; // 営業外はスキップ

      const { symbol, isCouponTime } = slots[time];
      const dataAttrIsCouponTime = !!(
        isCouponTime || (isCouponDay && couponSettings.isAllTimeCoupon)
      );
      const isUnavailable = symbol === 1; // × = 選択不可
      const showCouponIcon =
        !couponSettings.isAllTimeCoupon &&
        couponSettings.showCouponIcon &&
        isCouponTime;

      html += `<option value="${time}" data-tc-is-coupon-time="${dataAttrIsCouponTime}"${isUnavailable ? ' disabled' : ''}>${time}${showCouponIcon ? ' 🉐' : ''}</option>`;
    }
    return html;
  };

  /**
   * 第3希望以降用：16:00〜17:30 の枠のみに絞った <option> HTML を生成
   * symbol=1（満員/×）は disabled、slots に存在しない時間はスキップ
   */
  const buildFilteredTimeOptions = (date) => {
    const scheduleData = state.scheduleMap[date];
    if (!date || !scheduleData) return '';

    const { slots, isCouponDay } = scheduleData;
    const timeSlots = state.scheduleData.timeSlots;
    const rangeMin = toMinutes('16:00');
    const rangeMax = toMinutes('17:30');
    let html = '';

    for (const time of timeSlots) {
      if (toMinutes(time) < rangeMin || toMinutes(time) > rangeMax) continue;
      if (slots[time] === undefined) continue;

      const { symbol, isCouponTime } = slots[time];
      const dataAttrIsCouponTime = !!(
        isCouponTime || (isCouponDay && couponSettings.isAllTimeCoupon)
      );
      const isUnavailable = symbol === 1;
      const showCouponIcon =
        !couponSettings.isAllTimeCoupon &&
        couponSettings.showCouponIcon &&
        isCouponTime;

      html += `<option value="${time}" data-tc-is-coupon-time="${dataAttrIsCouponTime}"${isUnavailable ? ' disabled' : ''}>${time}${showCouponIcon ? ' 🉐' : ''}</option>`;
    }
    return html;
  };

  // ──────────────── UI 更新 ────────────────

  /**
   * カレンダーグリッドの選択セル表示を更新
   */

  /**
   * 希望行の表示を state に合わせて更新（hidden input 値も更新）
   */
  const updateSelectedListDisplay = () => {
    const date = $parent.find(`[name="${checkBoxAttrName}"]:checked`).val() || '';
    const filled = date !== '';
    const d = filled ? new Date(date) : null;
    const dateLabel = filled
      ? `${d.getMonth() + 1}/${d.getDate()}(${DOW_LABELS[d.getDay()]})`
      : 'タップで選択';

    // 選択日行の更新
    const $dateRow = $parent.find('[data-pref-date]');
    $dateRow.find('#pref-date-display').text(dateLabel).toggleClass('filled', filled);

    if (filled && !$dateRow.find('[data-pref-clear-date]').length) {
      $dateRow.find('.pref__date').after(
        `<button class="pref__clear" data-pref-clear-date><svg viewBox="0 0 14 14" fill="none"><path d="M10 4L4 10M4 4l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`
      );
    } else if (!filled) {
      $dateRow.find('[data-pref-clear-date]').remove();
    }

    // 時間セレクトの更新（日付変更のたびにスロットデータからオプションを再構築）
    for (let i = 0; i < maxSelectedDate; i++) {
      const isFiltered = i >= 2;
      const timeOptions = isFiltered
        ? `<option value="【指定しない】">【指定しない】</option>${buildFilteredTimeOptions(date)}`
        : buildTimeOptions(date);
      const newTimeOptions = `<option value="">時間</option>${timeOptions}`;
      const time = state.prefTimes[i] || '';
      const $select = $parent.find(`[data-pref-time-index="${i}"] select`);
      $select.html(newTimeOptions);
      $select.prop('disabled', !filled).attr('data-tc-date', filled ? date : '').val(filled ? time : '');
      if (!filled) state.prefTimes[i] = '';
    }
  };

  // ──────────────── イベント登録 ────────────────

  const addEventListener = () => {
    $parent.off('.tc');

    // 日付 checkbox 変更（1件のみ選択を強制）
    $parent.on('change.tc', `[name="${checkBoxAttrName}"]`, (e) => {
      const $cb = $(e.currentTarget);
      if ($cb.prop('checked')) {
        // 他の checkbox をすべて解除
        $parent.find(`[name="${checkBoxAttrName}"]`).not($cb).prop('checked', false);
        state.prefTimes.fill('');
      } else {
        state.prefTimes.fill('');
      }
      updateSelectedListDisplay();
      $parent.find(`[name^="${checkBoxAttrName}_time_"]`).trigger('change');
    });

    // 時間セレクト変更
    $parent.on('change.tc', '[data-pref-time-index] select', (e) => {
      const i = parseInt($(e.currentTarget).closest('[data-pref-time-index]').attr('data-pref-time-index'), 10);
      state.prefTimes[i] = $(e.currentTarget).val();
    });

    // クリアボタン（日付の checkbox を解除して全時間もリセット）
    $parent.on('click.tc', '[data-pref-clear-date]', () => {
      $parent.find(`[name="${checkBoxAttrName}"]:checked`).prop('checked', false);
      state.prefTimes.fill('');
      updateSelectedListDisplay();
      $parent.find(`[name^="${checkBoxAttrName}_time_"]`).trigger('change');
    });

    // 前月ボタン（選択日を引き継いでグリッド再生成）
    $parent.on('click.tc', '#calPrev', () => {
      const sel = $parent.find(`[name="${checkBoxAttrName}"]:checked`).val() || '';
      state.currentMonth--;
      if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
      $parent.find('.cal').replaceWith(createMonthGrid(sel));
    });

    // 次月ボタン
    $parent.on('click.tc', '#calNext', () => {
      const sel = $parent.find(`[name="${checkBoxAttrName}"]:checked`).val() || '';
      state.currentMonth++;
      if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
      $parent.find('.cal').replaceWith(createMonthGrid(sel));
    });
  };

  // ──────────────── データ取得 ────────────────

  const fetchScheduleWithSetData = async ({ params = {} }) => {
    const { clinicId, days = 21 } = params;
    if (!clinicId) throw new Error('clinicId is required');
    if (typeof days !== 'number' || Number.isNaN(days)) throw new Error('days must be a number');

    let response = null;
    if (window.location.hostname === '127.0.0.1' || useScheduleDummyData) {
      const fetchUrl = new URL('dummy-data.json', import.meta.url);
      response = await fetch(fetchUrl);
    } else {
      response = await fetch(scheduleFetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_id: clinicId, days }),
      });
    }
    if (!response.ok) throw new Error(`HTTP error status: ${response.status}`);
    const data = await response.json();
    validateFetchedScheduleData(data);
    state.scheduleData = data;
  };

  // ──────────────── 公開 API ────────────────

  const createCalendar = async ({ params }) => {
    try {
      resetState();
      toggleLoadingDisplay({});
      toggleMessageDisplay({ isVisible: false });

      await fetchScheduleWithSetData({ params });
      adaptScheduleData();
      buildScheduleMap();

      initCalendarDisplay();
      addEventListener();
      updateSelectedListDisplay();
    } catch (e) {
      toggleMessageDisplay({
        isVisible: true,
        message: `<span class="js-tc-message__em-text">現在、アクセスが集中しており\nカレンダーが表示できません。\n日程を入力せずにそのままお進みください。\n\nお手数をおかけいたしますが、公式LINEのトーク画面にて\n\nご希望の\n①店舗\n②日時\n③時間\n\nをお送りください。</span>`,});
      $parent.attr('data-tc-is-error', '');
      console.error(e);
    } finally {
      toggleLoadingDisplay({ isVisible: false });
    }
  };

  const init = () => {
    try { initDisplay(); } catch (e) { console.error(e); }
  };

  return { init, createCalendar };
}
