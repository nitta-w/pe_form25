import { embedTimeCalendar } from './time-calendar-sync/main.js';

$(() => {
  func();
  func2();
  initCalendar();

  function func() {

  }

  /**
   * カレンダーモジュール (time-calendar-sync) の組み込み
   * calendar-spec.md §3 / §10-3 / §11 準拠
   */
  function initCalendar() {
    const cal = embedTimeCalendar({
      parentSelector: '#js-time-calendar-1',
      checkBoxAttrName: 'date_1',
      scheduleFetchUrl: './js/schedule.php',
      options: {
        maxSelectedDate: 3,
        couponSettings: {
          isAllTimeCoupon: true,
          showStartDays: 0,
          showDays: 7,
          showTimeList: [],
        },
      },
    });
    cal.init();

    // 店舗 <select> 変更でカレンダーを再描画
    $('[name="clinic_shop"]').on('change', async function () {
      const $selected = $(this).find('option:selected');
      const clinicId = parseInt($selected.attr('data-clinic-id'), 10) || 0;
      if (!clinicId) return;
      await cal.createCalendar({ params: { clinicId, days: 21 } });
    });
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

    const moveScreen = (isNext = true) => {
      setTimeout(() => window.scrollTo(0, 0), 200);

      const $slideItems = $('.js-csl__item');
      const destinationStep = state.currentStep + (isNext ? 1 : -1);

      $slideItems.removeClass('is-active');
      $slideItems.eq(destinationStep - 1).addClass('is-active');
    };

    /**
     * スライド画面毎のエラーメッセージの取得処理
     */
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

    /**
     * aタグのCTAリンク先URLにパラメータを追加
     * クリニック取得・カレンダーがエラー時は該当項目をスキップし、errorCodes でエラー内容を渡す
     * calendar-spec.md §10-3 / §11 準拠
     */
    const addParamsToCtaUrl = () => {
      const requestClinic = $('[name="clinic_shop"]').val()?.trim() ?? '';

      const $checkedDate         = $('[name="date_1"]:checked');
      const requestDate          = $checkedDate.val() ?? '';
      const requestFormattedDate = formatDate(requestDate, 'M月D日(dow)');
      const isCouponDay          = $checkedDate.attr('data-tc-is-coupon-day') === 'true';
      const isToday              = $checkedDate.attr('data-tc-is-today') === 'true';

      const requestTime1 = $('[name="date_1_time_1"]').val() ?? '';
      const requestTime2 = $('[name="date_1_time_2"]').val() ?? '';
      const requestTime3 = $('[name="date_1_time_3"]').val() ?? '';

      const isClinicListError = $('[data-clinic-list-error]').length > 0;
      const isCalendarError   = $('[data-tc-is-error]').length > 0;
      const errorCodes = [];
      isCalendarError   && errorCodes.push('E01_カレンダー表示');
      isClinicListError && errorCodes.push('E02_店舗表示');

      const botBasicId = $('[name="bot_basic_id"]').val().trim();
      const varMapping = {};

      switch (botBasicId) {
        case '111dummy':
          //@111dummy
          if (!isClinicListError) {
            varMapping['1111111'] = requestClinic;
          }

          if (!isClinicListError && !isCalendarError) {
            varMapping['2222222'] = requestFormattedDate;
            varMapping['3333333'] = requestTime1;
            varMapping['4444444'] = requestTime2;
            varMapping['5555555'] = requestTime3;

            varMapping['6666666'] = isCouponDay
              ? '日時特典あり'
              : '日時特典なし';

            if (isToday) {
              varMapping['7777777'] = '当日希望';
            }
          }

          varMapping['8888888'] = errorCodes;
          break;

        case '222dummy':
          //@222dummy
          if (!isClinicListError) {
            varMapping['1111111'] = requestClinic;
          }

          if (!isClinicListError && !isCalendarError) {
            varMapping['2222222'] = requestFormattedDate;
            varMapping['3333333'] = requestTime1;
            varMapping['4444444'] = requestTime2;
            varMapping['5555555'] = requestTime3;

            varMapping['6666666'] = isCouponDay
              ? '日時特典あり'
              : '日時特典なし';

            if (isToday) {
              varMapping['7777777'] = '当日希望';
            }
          }

          varMapping['8888888'] = errorCodes;
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

    /**
     * DB画面遷移ステータス更新
     */
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

    /**
     * スライド進む
     */
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

    /**
     * スライド戻る
     */
    const onClickPrevBtn = (e) => {
      if (state.isMoving) return;
      if (state.currentStep <= 1) return;

      moveScreen(false);
      state.currentStep--;
      state.adCountStatus--;
    };

    /**
     * CTAボタンクリック時の処理
     */
    const onClickCtaBtn = (e) => {
      const message = validation();
      
      if (message) {
        e.preventDefault();
        alert(message);
        return;
      }

      addParamsToCtaUrl();
    };

    /**
     * イベント登録
     */
    const addEventListener = () => {
      $('.js-csl__select-btn').on('click', (e) => onClickSelectBtn(e));
      $('.js-csl__prev-btn').on('click', (e) => onClickPrevBtn(e));
      $('.js-cta-link').on('click', (e) => onClickCtaBtn(e));

      $('.js-csl__item').on('animationstart', (e) => {
        if (e.target === e.currentTarget) {
          state.isMoving = true;
        }
      });
      $('.js-csl__item').on('animationend', (e) => {
        if (e.target === e.currentTarget) {
          state.isMoving = false;
        }
      });
    };

    const init = () => {
      try {
        addEventListener();
        postAdCountStatus();
      } catch (e) {
        console.error(e);
      }
    };

    init();
  }

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
});
