import { embedTimeCalendar } from './time-calendar-sync/main.js';

$(() => {
  const ASSET = 'img/';

  const AREA_OPTIONS = [
    { label: '北海道・東北地方', value: '1' },
    { label: '関東地方', value: '2' },
    { label: '中部地方', value: '3' },
    { label: '近畿地方', value: '4' },
    { label: '中国・四国地方', value: '5' },
    { label: '九州・沖縄地方', value: '6' },
  ];

  const state = {
    isMoving: false,
    currentStep: 1,
    achievedMaxStep: 1,
    maxStep: 8,
    adCountStatus: 3,
    adCountStatusMax: 8 + 2,
  };

  const answers = { gender: '', age: '', body_parts: [], diet_history: [] };

  init();

  function init() {
    try {
      addEventListener();
      postAdCountStatus();
    } catch (e) {
      console.error(e);
    }
  }

  function addEventListener() {
    $('.js-gate-start').on('click', function () {
      boot($(this).data('sound') === 1);
    });
    $('.js-mute-btn').on('click', function () {
      const m = !SND.isMuted();
      SND.setMuted(m);
      $(this).text(m ? '×' : '♪');
    });
    $('.js-cta-link').on('click', (e) => onClickCtaBtn(e));
    $(document).on(
      'pointerdown',
      '.choices__item, .pop__btn, .gate__btn-sound, .gate__btn-mute, .line-btn',
      addRipple,
    );
    $(window).on('load', onWindowLoad);
    $(window).on('resize', () => BG.load('bg_room.webp'));
  }

  function onWindowLoad() {
    BG.load('bg_room.webp');
    GIRL.start(); // ゲートの背後でも歩いている（「ちゃんと作ってある」感）
    // 全素材の事前読み込み（場面転換・演出の白抜けを防ぐ）
    setTimeout(() => {
      [
        'bg_street.webp', 'bg_gym.webp', 'bg_clinic.webp',
        'pose_2_shock.webp', 'pose_3_onaka.webp', 'pose_4_naki.webp', 'pose_5_kangae.webp',
        'pose_6_hirameki.webp', 'pose_8_guts.webp',
        'fat_1_s.webp', 'fat_3_l.webp', 'fat_4_niyari.webp', 'fat_5_warai.webp',
        'fat_6_dakitsuki.webp', 'fat_8_haretsu.webp', 'fat_9_shometsu.webp',
        'prop_1_sofa.webp', 'prop_2_parfait.webp', 'prop_3_cake.webp', 'prop_4_conveni.webp',
        'prop_5_dumbbell.webp', 'prop_6_scale.webp', 'prop_7_fridge.webp', 'prop_8_salad.webp',
      ].forEach((f) => { const im = new Image(); im.src = ASSET + f; });
    }, 800);
  }

  function boot(withSound) {
    SND.unlock(withSound);
    $('.js-mute-btn').text(withSound ? '♪' : '×');
    $('.js-gate').remove();
    story();
  }

  function addRipple(e) {
    const el = this;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 0.9;
    const $s = $('<span class="ripple"></span>');
    $s.css({
      width: d + 'px',
      height: d + 'px',
      left: ((e.clientX || (r.left + r.width / 2)) - r.left - d / 2) + 'px',
      top: ((e.clientY || (r.top + r.height / 2)) - r.top - d / 2) + 'px',
    });
    $(el).append($s);
    setTimeout(() => $s.remove(), 700);
  }

  /**
   * チャプター進行（ストーリーズ進捗の更新＋広告計測）
   */
  function advanceChapter(n) {
    STORY.set(n);
    if (n > state.currentStep) {
      state.currentStep = n;
      if (state.currentStep > state.achievedMaxStep) {
        state.achievedMaxStep = state.currentStep;
      }
      state.adCountStatus++;
      postAdCountStatus();
    }
  }

  /**
   * 回答値を L-Step 変数キーで hidden input に同期（チャットボット型 LP の commit パターン）
   */
  function commitAnswer(name, value, attrs) {
    $(`.js-answers input[name="${name}"]`).remove();
    const $input = $('<input type="hidden">').attr('name', name).val(value);
    if (attrs) $input.attr(attrs);
    $input.appendTo('.js-answers');
  }

  function commitAnswerMulti(name, values) {
    $(`.js-answers input[name="${name}"]`).remove();
    values.forEach((v) => {
      $('<input type="hidden">').attr('name', name).val(v).appendTo('.js-answers');
    });
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

  /**
   * 計測ステータス送信
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
   * 画面遷移時の入力チェック（このLPは常に選択必須のQ&Aで進行するため常に通過）
   */
  const validation = () => '';

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
   * aタグのCTAリンク先URLにパラメータを追加
   */
  const addParamsToCtaUrl = () => {
    const gender = $('[name="gender"]').val() || '';
    const age = $('[name="age"]').val() || '';
    const bodyPart = $('[name="body_parts"]').map((_, el) => $(el).val()).get().join(',');
    const dietHistory = $('[name="diet_history"]').map((_, el) => $(el).val()).get().join(',');
    const requestClinic = $('[name="clinic_shop"]').val() || '';

    // プルダウンリストの医院取得エラーのフラグ
    const isClinicListError = $('[name="clinic_shop"]').is('[data-clinic-list-error]');
    // カレンダーの表示エラーのフラグ
    const isCalendarError = $('[data-tc-is-error]').length > 0;

    // 選択順=希望順（第1〜第3）で3つ生成される
    const dateInputs = $('[name="date_1"]').toArray();
    const [d1, d2, d3] = dateInputs;

    // 第1希望の日時がクーポン対象かどうか（calendar-spec.md §10-3）
    const isCouponTime = $('[name="date_1"]').attr('data-tc-is-coupon-time') === 'true';
    // 第1希望の日付が当日（スケジュール初日）かどうか
    const isToday = $('[name="date_1"]').attr('data-tc-is-today') === 'true';

    // BotベーシックID
    const botBasicId = $('[name="bot_basic_id"]').val().trim();

    const errorCodes = [];
    isCalendarError && errorCodes.push('E01_カレンダー表示');
    isClinicListError && errorCodes.push('E02_店舗表示');

    const varMapping = {};

    switch (botBasicId) {
      case '897vblrf':
        //@form25
        varMapping['2184987'] = gender;
        varMapping['2184988'] = age;
        varMapping['2184994'] = bodyPart;
        varMapping['2460256'] = dietHistory;
        varMapping['2184995'] = '夏の3大特典';
        varMapping['2504096'] = 'sururim_walk_v1';

        // 医院プルダウンメニューがエラーでない場合のみパラメータ追加
        if (!isClinicListError) {
          varMapping['2184547'] = $('[name="area"]').val() || '';
          varMapping['2184548'] = requestClinic;
        }

        // プルダウンリストの医院取得&カレンダーがエラーでない場合のみチェック
        if (!isClinicListError && !isCalendarError) {
          const [requestDate1, requestTime1] = (d1 ? $(d1).val() : '').split(' ');
          const [requestDate2, requestTime2] = (d2 ? $(d2).val() : '').split(' ');
          const [requestDate3, requestTime3] = (d3 ? $(d3).val() : '').split(' ');
          const requestFormattedDate1 = requestDate1 ? formatDate(requestDate1, 'MM月DD日(dow)') : '';
          const requestFormattedDate2 = requestDate2 ? formatDate(requestDate2, 'MM月DD日(dow)') : '';
          const requestFormattedDate3 = requestDate3 ? formatDate(requestDate3, 'MM月DD日(dow)') : '';

          if (requestFormattedDate1) varMapping['2184549'] = requestFormattedDate1;
          if (requestTime1) varMapping['2184551'] = requestTime1;
          if (requestFormattedDate2) varMapping['2349620'] = requestFormattedDate2;
          if (requestTime2) varMapping['2349621'] = requestTime2;
          if (requestFormattedDate3) varMapping['2433744'] = requestFormattedDate3;
          if (requestTime3) varMapping['2433745'] = requestTime3;

          // 日時特典・当日希望フラグ（本番投入前にL-Step側の変数IDを確定要・refactoring-spec.md §10参照）
          varMapping['isCouponTime'] = isCouponTime ? '日時特典あり' : '日時特典なし';
          if (isToday) {
            varMapping['isToday'] = '当日希望';
          }
        }
        break;
    }

    // エラーコード（常に送信）
    varMapping['errorCodes'] = errorCodes.join(',');

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

  /* ================= サウンド（WebAudio・軽量） ================= */
  const SND = (() => {
    let ctx = null, muted = true, bgmTimer = null;
    function ac() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
    function tone(f, dur, type, vol, when) {
      if (muted) return;
      try {
        const c = ac(), o = c.createOscillator(), g = c.createGain();
        const t = c.currentTime + (when || 0);
        o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol || .12, t + .015);
        g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .05);
      } catch (e) { /* noop */ }
    }
    // ゆるかわBGM: 常時再生。歩き中=軽快 / 停止・カード中=ゆったり低め
    const seqWalk = [523, 659, 784, 659, 587, 698, 880, 698];
    const seqCalm = [392, 494, 587, 494, 440, 523, 659, 523];
    let step = 0, mood = 'calm';
    function bgmStart() {
      if (bgmTimer) return;
      bgmTimer = setInterval(() => {
        if (mood === 'calm' && step % 2 === 1) { step++; return; }
        const s = (mood === 'walk') ? seqWalk : seqCalm;
        tone(s[step % 8], mood === 'walk' ? .28 : .55, 'triangle', mood === 'walk' ? .05 : .032);
        step++;
      }, 240);
    }
    function bgmStop() { clearInterval(bgmTimer); bgmTimer = null; }
    $(document).on('visibilitychange', () => { if (document.hidden) bgmStop(); else if (!muted) bgmStart(); });
    return {
      unlock(withSound) { muted = !withSound; try { ac().resume(); } catch (e) { /* noop */ } if (withSound) bgmStart(); },
      setMuted(m) { muted = m; if (m) bgmStop(); else bgmStart(); },
      isMuted() { return muted; },
      tap() { tone(880, .09, 'sine', .09); },
      pop() { tone(392, .16, 'sine', .14); tone(523, .12, 'sine', .1, .05); },
      burst() { tone(784, .1, 'square', .07); tone(1047, .25, 'sine', .1, .06); tone(1568, .3, 'sine', .06, .12); },
      levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .12, i * .09)); },
      gaan() { tone(196, .55, 'sawtooth', .07); tone(185, .55, 'sawtooth', .05, .03); },
      blip() { tone(1250, .025, 'square', .02); },
      walkOn() { mood = 'walk'; }, walkOff() { mood = 'calm'; },
    };
  })();

  /* ================= 背景（鏡面タイル・パララックス） ================= */
  const BG = (() => {
    const strip = $('.js-bgstrip')[0];
    let x = 0, tileW = 0, cur = '';
    function load(file) {
      cur = file;
      strip.innerHTML = '';
      x = 0;
      const h = $('.js-stage')[0].clientHeight;
      tileW = Math.ceil(h * 1536 / 1024);
      const need = Math.ceil($('.js-story')[0].clientWidth / tileW) + 2;
      for (let i = 0; i < need + 1; i++) {
        const im = document.createElement('img');
        im.src = ASSET + file;
        im.alt = '';
        if (i % 2 === 1) im.className = 'is-flip'; // 鏡面タイルで継ぎ目ゼロ
        im.draggable = false;
        strip.appendChild(im);
      }
      strip.style.transform = 'translateX(0)';
    }
    function scroll(dx) {
      x -= dx;
      if (x <= -tileW * 2) x += tileW * 2; // 原画+反転の2枚周期でループ
      strip.style.transform = `translateX(${x}px)`;
    }
    // 場面転換（ふわっと白フェード→差し替え→フェード戻し）
    function change(file) {
      if (file === cur) return Promise.resolve();
      return new Promise((res) => {
        let fade = $('.js-bgfade')[0];
        if (!fade) {
          fade = document.createElement('div');
          fade.className = 'stage__bgfade js-bgfade';
          $('.js-stage')[0].appendChild(fade);
        }
        fade.classList.add('is-show');
        setTimeout(() => {
          // 画像の読み込み完了を待ってから差し替え（本番回線での「白抜け」対策）
          const pre = new Image();
          const go = () => {
            load(file);
            requestAnimationFrame(() => {
              fade.classList.remove('is-show');
              setTimeout(res, 460);
            });
          };
          pre.onload = go;
          pre.onerror = go;
          pre.src = ASSET + file;
        }, 480);
      });
    }
    return { load, scroll, change };
  })();

  /* ================= ゆい（歩行エンジン） ================= */
  const GIRL = (() => {
    const el = $('.js-girl')[0];
    const imgs = [...el.querySelectorAll('img')];
    let frame = 0, walking = false, raf = null, last = 0, acc = 0;
    const FRAME_MS = 1000 / 7, SPEED = 2.6; // 歩きテストで決めた7コマ/秒
    function show(n) {
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === n));
      el.classList.toggle('is-bob', n === 1 || n === 3);
    }
    function loop(t) {
      if (!walking) return;
      if (!last) last = t;
      const dt = t - last; last = t; acc += dt;
      while (acc >= FRAME_MS) { acc -= FRAME_MS; frame = (frame + 1) % 4; show(frame); }
      BG.scroll(SPEED * dt / 16.7);
      FAT.drift(SPEED * dt / 16.7);
      raf = requestAnimationFrame(loop);
    }
    // 基本は歩き続ける。止まるのは演出上の特別な瞬間だけ
    function start() {
      if (walking) return;
      walking = true; last = 0; SND.walkOn();
      el.classList.remove('is-idle');
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      walking = false; cancelAnimationFrame(raf);
      show(0); frame = 0; SND.walkOff();
      el.classList.add('is-idle'); // 停止中も呼吸モーション（完全静止させない）
    }
    function walk(ms) { start(); return new Promise((res) => setTimeout(res, ms)); }
    // 正面ポーズ（表情リアクション）への切り替え。ネガ表情=ガーン音／ポジ表情=レベルアップ音
    let poseImg = null;
    const NEGA_POSES = ['pose_2_shock', 'pose_3_onaka', 'pose_4_naki', 'pose_5_kangae'];
    function pose(file) {
      stop();
      if (!poseImg) {
        poseImg = document.createElement('img');
        poseImg.alt = '';
        el.appendChild(poseImg);
      }
      poseImg.src = ASSET + file;
      imgs.forEach((im) => im.classList.remove('is-on'));
      poseImg.classList.add('is-on');
      if (NEGA_POSES.some((n) => file.includes(n))) SND.gaan(); else SND.levelup();
    }
    function unpose() {
      if (poseImg) poseImg.classList.remove('is-on');
      show(0);
    }
    return { start, stop, walk, pose, unpose };
  })();

  /* ================= 脂肪くん（浮遊システム） ================= */
  const FAT = (() => {
    const wrap = $('.js-fats')[0];
    const counter = $('.js-fat-counter')[0];
    // スマホ縦基準の散布表（ゆいの背後の空間）
    const spots = [
      { left: 6, bottom: 62 }, { left: 1, bottom: 44 }, { left: 9, bottom: 30 },
      { left: 2, bottom: 74 }, { left: 11, bottom: 50 }, { left: 5, bottom: 20 },
      { left: 13, bottom: 68 }, { left: 12, bottom: 38 },
    ];
    const faces = ['fat_1_s.webp', 'fat_2_m.webp', 'fat_5_warai.webp', 'fat_4_niyari.webp', 'fat_2_m.webp', 'fat_6_dakitsuki.webp', 'fat_1_s.webp', 'fat_5_warai.webp'];
    const list = [];
    let busy = false; // 破裂演出中は追加禁止（配列競合でお化け脂肪くんが残る）
    function update(n) { counter.textContent = '脂肪くん×' + n; counter.classList.toggle('is-show', !!n); }
    return {
      add(size) {
        if (busy || list.length >= spots.length) return;
        const p = spots[list.length];
        const el = document.createElement('div');
        el.className = 'fat';
        el.style.left = p.left + '%'; el.style.bottom = p.bottom + '%';
        el.style.animationDelay = (-list.length * .7) + 's';
        el.style.animationDuration = (2.2 + (list.length % 3) * .5) + 's';
        const file = (size === 'L') ? 'fat_3_l.webp' : faces[list.length % faces.length];
        if (size === 'L') el.style.height = '15%'; // ドカ食い産は大きい
        el.innerHTML = `<img src="${ASSET}${file}" alt="">`;
        wrap.appendChild(el);
        el.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' });
        SND.pop();
        list.push(el); update(list.length);
      },
      drift(dx) { /* 歩行中は妖精なのでふわっと追従（現状は位置固定＝一緒に移動して見える） */ },
      burstAll() {
        if (busy || !list.length) return;
        busy = true;
        const snapshot = [...list];
        list.length = 0; // 先に空にして以降のaddと衝突させない
        let remaining = snapshot.length;
        snapshot.forEach((el, k) => {
          setTimeout(() => {
            const img = el.querySelector('img');
            img.src = ASSET + 'fat_8_haretsu.webp'; SND.burst();
            el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }], { duration: 200, fill: 'forwards' });
            setTimeout(() => { img.src = ASSET + 'fat_9_shometsu.webp'; el.style.opacity = '0'; }, 220);
            setTimeout(() => {
              el.remove();
              remaining--;
              if (remaining === 0) busy = false;
            }, 650);
          }, k * 330);
        });
        // カウンタは破裂のたびに減らす（表示専用）
        let shown = snapshot.length;
        snapshot.forEach((_, k) => setTimeout(() => { shown--; update(shown); }, k * 330 + 230));
      },
      shrinkAll() { // 学習パート: 小さくなる（でも消えない）
        [...wrap.querySelectorAll('.fat img')].forEach((im) => {
          im.style.transition = 'transform .9s ease';
          im.style.transform = 'scale(.55)';
        });
        SND.tap();
      },
      restoreAll() { // 学習パート: ぷくーっと元に戻る
        [...wrap.querySelectorAll('.fat img')].forEach((im) => {
          im.style.transition = 'transform .7s cubic-bezier(.3,1.6,.5,1)';
          im.style.transform = 'scale(1)';
        });
        SND.pop();
      },
      count() { return list.length; },
    };
  })();

  /* ================= 小物（シーンの演出アイテム） ================= */
  const PROP = (() => {
    const wrap = $('.js-props')[0];
    return {
      show(files) {
        wrap.innerHTML = '';
        files.forEach((f, i) => {
          const d = document.createElement('div');
          d.className = 'prop';
          d.style.left = (54 + i * 22) + '%';
          d.style.height = (22 - i * 5) + '%';
          d.innerHTML = `<img src="${ASSET}${f}" alt="">`;
          wrap.appendChild(d);
          d.animate([{ transform: 'translateX(70vw)', opacity: .4 }, { transform: 'translateX(0)', opacity: 1 }],
            { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' });
        });
      },
      clear() {
        [...wrap.children].forEach((d) => {
          d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' });
        });
        setTimeout(() => { wrap.innerHTML = ''; }, 380);
      },
    };
  })();

  /* ================= ストーリーズ式チャプター進捗（IG/Telegramの型） ================= */
  const STORY = (() => {
    const el = $('.js-storybar')[0];
    const TOTAL = state.maxStep; // 導入/プロフィール/思い出/ひみつ/スルリム/診断とGIFT/予約/受け取り
    el.innerHTML = Array(TOTAL).fill('<span></span>').join('');
    const segs = [...el.children];
    return { set(n) { segs.forEach((s, i) => s.classList.toggle('is-done', i < n)); } };
  })();

  /* ================= 会話・選択肢UI ================= */
  const UI = (() => {
    const nameEl = $('.js-talk-name')[0];
    const textEl = $('.js-talk-text')[0];
    const chEl = $('.js-choices')[0];
    let typeTimer = null, fullText = '';
    function say(name, text) {
      nameEl.textContent = name;
      fullText = text;
      const talk = textEl.closest('.talk');
      // 自動フィット: 全文で測ってから打ち始める（見切れ防止）
      textEl.innerHTML = text;
      let size = 1.45;
      textEl.style.fontSize = size + 'rem';
      while (talk.scrollHeight > talk.clientHeight + 2 && size > 1.25) { // 可読性の下限12.5px相当
        size -= 0.05;
        textEl.style.fontSize = size + 'rem';
      }
      // タイプライター表示（タグは瞬時・文字は1つずつ）
      clearInterval(typeTimer);
      const tokens = text.match(/<[^>]+>|[\s\S]/g) || [];
      let i = 0, out = '';
      textEl.innerHTML = '';
      typeTimer = setInterval(() => {
        while (i < tokens.length && tokens[i].startsWith('<')) out += tokens[i++];
        if (i < tokens.length) out += tokens[i++];
        textEl.innerHTML = out;
        if (i % 4 === 0) SND.blip();
        if (i >= tokens.length) { clearInterval(typeTimer); typeTimer = null; }
      }, 26);
      talk.scrollTop = 0;
    }
    // 会話帯タップで全文スキップ
    $('.talk').on('click', () => {
      if (typeTimer) {
        clearInterval(typeTimer); typeTimer = null;
        textEl.innerHTML = fullText;
      }
    });
    function progress(cur, total) { // Q1〜Q4の進捗ドット（0で非表示）
      const d = $('.js-qdots')[0];
      d.textContent = cur ? '●'.repeat(cur) + '○'.repeat(total - cur) : '';
    }
    function buttons(items) { // items: [{label, value}] → Promise<value>（単一選択・radio）
      return new Promise((res) => {
        chEl.innerHTML = items.map((it) => `
          <label class="choices__item opt">
            <input type="radio" name="q_radio" value="${it.value}" class="opt__input">
            ${it.label}
          </label>`).join('');
        let picked = false; // 素早い2連タップでタイマーが二重に走る事故を防ぐ
        $(chEl).find('.opt__input').on('change', function () {
          if (picked) return;
          picked = true;
          const value = $(this).val();
          SND.tap();
          $(this).closest('.opt').addClass('is-selected'); // 選択状態を一瞬見せてから進む（Noom式）
          $(chEl).find('.opt__input').prop('disabled', true);
          setTimeout(() => { chEl.innerHTML = ''; res(value); }, 220);
        });
      });
    }
    function multi(items, okLabel) { // 複数選択 → Promise<value[]>（checkbox）
      return new Promise((res) => {
        chEl.innerHTML = items.map((it) => `
          <label class="choices__item opt">
            <input type="checkbox" name="q_check" value="${it.value}" class="opt__input">
            ${it.label}
          </label>`).join('') +
          `<button type="button" class="choices__item choices__multi-ok js-multi-ok is-hidden">${okLabel || '▶ これで決定！'}</button>`;
        const $ok = $(chEl).find('.js-multi-ok');
        $(chEl).find('.opt__input').on('change', function () {
          SND.tap();
          $(this).closest('.opt').toggleClass('is-selected', this.checked);
          $ok.toggleClass('is-hidden', $(chEl).find('.opt__input:checked').length === 0);
        });
        $ok.one('click', () => {
          SND.tap();
          const vals = $(chEl).find('.opt__input:checked').map((_, el) => $(el).val()).get();
          chEl.innerHTML = '';
          res(vals);
        });
      });
    }
    function tapNext(label) {
      return new Promise((res) => {
        chEl.innerHTML = '';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choices__item choices__tap-next';
        b.innerHTML = label || '▶ タップですすむ';
        b.onclick = () => { SND.tap(); chEl.innerHTML = ''; res(); };
        chEl.appendChild(b);
      });
    }
    return { say, buttons, multi, tapNext, progress, el: chEl };
  })();

  /* ================= 全画面ポップアップ ================= */
  const POP = (() => {
    const el = $('.js-pop')[0];
    function show({ title, html, btn }) {
      return new Promise((res) => {
        el.innerHTML = `<div class="pop__card">
          ${title ? `<div class="pop__title">${title}</div>` : ''}
          <div class="pop__body">${html}</div>
          <button type="button" class="pop__btn">${btn || '▶ つづける'}</button>
        </div>`;
        el.classList.add('is-show');
        // 中身がはみ出す場合は「スクロールできます」を明示
        const body = el.querySelector('.pop__body');
        requestAnimationFrame(() => {
          if (body.scrollHeight > body.clientHeight + 4) {
            const hint = document.createElement('div');
            hint.className = 'pop__scroll-hint';
            hint.textContent = '▼ 下にスクロールできます';
            body.appendChild(hint);
            body.addEventListener('scroll', () => hint.remove(), { once: true, passive: true });
          }
        });
        el.querySelector('.pop__btn').onclick = () => {
          SND.tap();
          el.classList.remove('is-show');
          el.innerHTML = '';
          res();
        };
      });
    }
    // カルーセル型カード（スワイプで送り・ボタンは1つ）
    function carousel({ title, cards, btn }) {
      return new Promise((res) => {
        const inner = cards.map((c) => `<div>${c}</div>`).join('');
        el.innerHTML = `<div class="pop__card">
          ${title ? `<div class="pop__title">${title}</div>` : ''}
          <div class="pop__body"><div class="caro">${inner}</div>
            <div class="caro__dots">${cards.map((_, i) => `<span data-i="${i}">●</span>`).join('')}</div>
            <div class="caro__hint">← 横にスワイプ →</div>
          </div>
          <button type="button" class="pop__btn">${btn || '▶ つづける'}</button>
        </div>`;
        el.classList.add('is-show');
        const caro = el.querySelector('.caro');
        const dots = [...el.querySelectorAll('.caro__dots span')];
        const updateDots = () => {
          const i = Math.min(cards.length - 1, Math.round(caro.scrollLeft / (caro.firstElementChild.offsetWidth + 10)));
          dots.forEach((d, k) => { d.innerHTML = k === i ? '<b>●</b>' : '●'; });
        };
        caro.addEventListener('scroll', updateDots, { passive: true });
        updateDots();
        el.querySelector('.pop__btn').onclick = () => {
          SND.tap(); el.classList.remove('is-show'); el.innerHTML = ''; res();
        };
      });
    }
    return { show, carousel };
  })();

  /* ================= 紙吹雪 ================= */
  function confetti(n) {
    const stage = $('.js-stage')[0];
    const colors = ['#ff8fb3', '#f5b93c', '#7ac97a', '#8fb3ff', '#e0679a', '#ffd3e4'];
    for (let i = 0; i < (n || 40); i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
      c.style.animationDelay = (Math.random() * .8) + 's';
      stage.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  /* ================= スルリム撃退FX（注射器＋シェイク＋フラッシュ） ================= */
  function sururimFX(n) {
    const sy = $('.js-syringe')[0];
    const fl = $('.js-flash')[0];
    const story = $('.js-story')[0];
    sy.classList.add('is-in');
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        sy.classList.add('is-jab');
        fl.classList.add('is-show');
        story.classList.add('is-shake');
        setTimeout(() => { sy.classList.remove('is-jab'); fl.classList.remove('is-show'); }, 140);
        setTimeout(() => { story.classList.remove('is-shake'); }, 330);
      }, 300 + k * 330);
    }
    setTimeout(() => { sy.classList.remove('is-in'); }, 300 + n * 330 + 500);
  }

  /* ================= 全画面セレブレーション ================= */
  function banner(title, ms, img, sub) {
    return new Promise((res) => {
      const b = $('.js-banner')[0];
      b.querySelector('.banner__title').innerHTML = title;
      b.querySelector('.banner__sub').innerHTML = sub || '';
      const im = b.querySelector('.banner__badge img');
      im.src = ASSET + (img || 'fat_9_shometsu.webp');
      b.classList.add('is-show');
      SND.burst();
      setTimeout(() => { b.classList.remove('is-show'); res(); }, ms || 2000);
    });
  }

  /* ================= 24時間タイマー ================= */
  const TIMER = (() => {
    const el = $('.js-timer')[0];
    function start() {
      let target = parseInt(store_get('sururim_timer_target') || '0', 10);
      if (!target || target < Date.now()) {
        target = Date.now() + 24 * 3600 * 1000;
        store_set('sururim_timer_target', String(target));
      }
      el.classList.add('is-show');
      // 秒を刻むカウントダウンは「広告疲れ」を誘発するため、静かな期限表示にする
      const d = new Date(target);
      const isTomorrow = d.getDate() !== new Date().getDate();
      el.textContent = `特典の有効期限: ${isTomorrow ? 'あす' : '本日'} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}まで`;
    }
    return { start };
  })();

  /* ================= storeラッパー（ストレージ不可環境対策） ================= */
  const storeMem = {};
  let storeOk = true;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); } catch (e) { storeOk = false; }
  function store_get(k) { try { return storeOk ? localStorage.getItem(k) : (storeMem[k] ?? null); } catch (e) { return storeMem[k] ?? null; } }
  function store_set(k, v) { try { if (storeOk) localStorage.setItem(k, v); else storeMem[k] = v; } catch (e) { storeMem[k] = v; } }

  /* ================= 脂肪タイプ診断 ================= */
  function fatType() {
    const tried = answers.diet_history || [];
    const parts = answers.body_parts || [];
    if (tried.length >= 2) return {
      name: 'がんこ型しぼう',
      desc: 'いくつものダイエットを生きのびた<b>歴戦の脂肪</b>。運動や食事制限では脂肪細胞の<b>大きさ</b>しか変わらず、<b>数はそのまま</b>だったのが原因です。あなたの意思の弱さではありません。',
      plan: '細胞の「数」そのものにアプローチする<b>スルリム式（最大35%破壊）</b>が近道です。',
    };
    if (tried.length === 1) return {
      name: 'ふっかつ型しぼう',
      desc: '一度は小さくなっても、細胞が残っているかぎり<b>元に戻って（リバウンドして）</b>くるタイプ。がんばりがムダになりやすいのが特徴です。',
      plan: '復活のもとである脂肪細胞ごと破壊し、<b>数を減らす</b>のが対策です。',
    };
    if (parts.length >= 2) return {
      name: 'ちらばり型しぼう',
      desc: '複数の部位に分かれて陣取るタイプ。全身ダイエットでは<b>狙い撃ちしにくい</b>のが特徴です。',
      plan: '1部位およそ15分の<b>ピンポイントケア</b>で、気になる部位から順に対策するのが近道です。',
    };
    return {
      name: 'かくれ型しぼう',
      desc: '1か所にひそんで動かないタイプ。まわりは痩せても<b>そこだけ残りやすい</b>のが特徴です。',
      plan: '弱点をねらった<b>ピンポイントケア（1部位およそ15分）</b>が最も刺さります。',
    };
  }

  /* ================= 予約導線: エリア ================= */
  async function pickArea() {
    const areaId = await UI.buttons(AREA_OPTIONS);
    commitAnswer('area', areaId);
    return areaId;
  }

  /* ================= 予約導線: 院（sururim_list.php から取得） ================= */
  async function pickClinic(areaId) {
    const chEl = UI.el;
    chEl.innerHTML = `
      <select class="reserve__clinic-select js-clinic-select" disabled>
        <option value="">読み込み中…</option>
      </select>
      <button type="button" class="choices__item choices__confirm js-clinic-ok is-hidden">▶ この院で決定</button>`;
    const $select = $(chEl).find('.js-clinic-select');
    const $ok = $(chEl).find('.js-clinic-ok');
    let isError = false;

    try {
      const requestUrl = new URL('/form_line/form25/js/sururim_list.php', window.location.origin);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: areaId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`);
      }

      const data = await response.json();
      $select.empty();
      $select.append($('<option>').attr('value', '').text('選択してください'));
      data.forEach((item) => {
        $select.append(
          $('<option>').attr('value', item.value).data('clinic-id', item.clinic_id).text(item.label),
        );
      });
      $select.prop('disabled', false);
    } catch (e) {
      console.error(e);
      isError = true;
      $select.attr('data-clinic-list-error', '');
      $select.empty().append($('<option>').attr('value', '').text('現在、院一覧を取得できません')).prop('disabled', true);
    }

    return new Promise((resolve) => {
      if (isError) {
        $(chEl).prepend('<div class="reserve__clinic-error">現在、院一覧の取得が混み合っております。院を選択せずにお進みください。ご予約後にトーク画面でご希望の院をお知らせください。</div>');
        $ok.text('▶ 院を選択せずに進む').removeClass('is-hidden');
      } else {
        $select.on('change', () => {
          SND.tap();
          $ok.toggleClass('is-hidden', !$select.val());
        });
      }
      $ok.one('click', () => {
        SND.tap();
        const name = isError ? '' : $select.val();
        const clinicId = isError ? '' : $select.find('option:selected').data('clinic-id');
        commitAnswer('clinic_shop', name, isError ? { 'data-clinic-list-error': '' } : null);
        chEl.innerHTML = '';
        resolve({ name, clinicId, isError });
      });
    });
  }

  /* ================= 予約導線: カレンダー（time-calendar-sync／第1〜3希望） ================= */
  function pickCalendar(clinicId, isClinicError) {
    const chEl = UI.el;
    return new Promise((resolve) => {
      if (isClinicError || !clinicId) {
        chEl.innerHTML = `
          <div class="reserve__clinic-error">院が未確定のため、日時の仮押さえは一旦スキップします。ご予約後にトーク画面でご希望の日時をお知らせください。</div>
          <button type="button" class="choices__item choices__confirm js-cal-ok">▶ このまま進む</button>`;
        $(chEl).find('.js-cal-ok').one('click', () => { SND.tap(); chEl.innerHTML = ''; resolve(); });
        return;
      }

      chEl.innerHTML = `
        <div class="reserve__calendar" id="js-time-calendar">
          <div class="js-tc"></div>
          <div class="js-tc-list"></div>
        </div>
        <button type="button" class="choices__item choices__confirm js-cal-ok is-hidden">▶ この内容で仮押さえ！</button>`;
      const $ok = $(chEl).find('.js-cal-ok');

      const cal = embedTimeCalendar({
        parentSelector: '#js-time-calendar',
        checkBoxAttrName: 'date_1',
        scheduleFetchUrl: new URL('/form_line/form25/js/sururim_schedule.php', window.location.origin),
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

      const updateOk = () => {
        const isError = $('#js-time-calendar[data-tc-is-error]').length > 0;
        const filled = $('[name="date_1"]').toArray().filter((el) => $(el).val()).length;
        $ok.toggleClass('is-hidden', !(isError || filled > 0));
      };
      cal.createCalendar({ params: { clinicId, days: 21 } }).then(updateOk);
      $('#js-time-calendar').on('change', '.js-tc-hidden-input', updateOk);

      $ok.one('click', () => {
        SND.tap();
        // 選択済み hidden input (date_1 x3) を保持したまま choices パネル外へ退避する
        $('#js-time-calendar').addClass('u-hidden').appendTo('.js-answers');
        chEl.innerHTML = '';
        resolve();
      });
    });
  }

  /* ================= 店舗エリア表示用ラベル（S7ナレーション内で使用） ================= */
  const AREA_LABELS = Object.fromEntries(AREA_OPTIONS.map((o) => [o.value, o.label]));

  /* ================= シナリオ ================= */
  async function story() {
    advanceChapter(1);
    UI.say('', 'ある夜のこと。ゆいさんはベッドの中で、ぼんやり考えていました。');
    await UI.tapNext();

    UI.say('ゆい', '「……また体重、戻ってる。あんなに頑張ったのに」');
    await UI.tapNext();

    UI.say('ナレーション', 'その夜、ゆいさんは——これまでのダイエットの思い出を振り返りながら、ゆっくり眠りにつきました……。');
    await UI.tapNext('▶ 夢の中へ');

    // ここからは夢の中（部屋着のまま、どこへでも歩いていける）
    await BG.change('bg_street.webp');
    UI.say('ナレーション', 'ここは、ゆいさんの<b>夢の中</b>。今夜は<b>あなた</b>も一緒に、思い出の道を——少しだけ、歩いてみましょう。');
    await UI.tapNext('▶ 一緒に歩く');

    // Q1 性別
    UI.progress(1, 4);
    UI.say('ナレーション', 'まず教えてください。あなたは——');
    answers.gender = await UI.buttons([
      { label: '女性です', value: '女性' },
      { label: '男性です', value: '男性' },
    ]);
    commitAnswer('gender', answers.gender);

    // Q2 年代
    UI.progress(2, 4);
    UI.say('ナレーション', 'ありがとうございます。年代はどちらですか？<br><small>（診断の精度が上がります）</small>');
    answers.age = await UI.buttons([
      { label: '20代', value: '20代' }, { label: '30代', value: '30代' },
      { label: '40代', value: '40代' }, { label: '50代以上', value: '50代以上' },
    ]);
    commitAnswer('age', answers.age);

    // Q3 部位（複数）
    UI.progress(3, 4);
    UI.say('ナレーション', '鏡を見るたび気になるのは、どのあたりですか？<br><small>（当てはまるもの全部どうぞ）</small>');
    answers.body_parts = await UI.multi([
      { label: 'アゴ下・フェイスライン', value: 'アゴ下' },
      { label: '二の腕', value: '二の腕' },
      { label: 'お腹（上部）', value: '上腹部' },
      { label: 'お腹（下部）', value: '下腹部' },
      { label: 'ウエスト・脇腹', value: '側腹部' },
      { label: '太もも（外側）', value: '太もも外側' },
      { label: '太もも（内側）', value: '太もも内側' },
      { label: 'お尻', value: 'お尻' },
      { label: '背中・ハミ肉', value: '背中' },
    ]);
    commitAnswerMulti('body_parts', answers.body_parts);

    // 選んだ部位のぶんだけ、脂肪くんがすでに憑いている演出
    if (answers.body_parts.length) {
      GIRL.stop();
      UI.say('ナレーション', '……実は、もうお気づきかもしれません。いま選んだ部位のぶんだけ——<b>脂肪くんが、すでに一緒に歩いている</b>ことに。');
      // 部位ぶんの脂肪くん（最大4匹まで＝後の失敗イベント分の枠を残す）
      answers.body_parts.slice(0, 4).forEach((_, i) => setTimeout(() => FAT.add('S'), 700 + i * 450));
      await UI.tapNext('▶ 気を取り直して進む');
      GIRL.start();
    }

    // Q4 ダイエット歴（複数）→ 失敗街道の分岐に使う
    UI.progress(4, 4);
    UI.say('ナレーション', 'これまでに試したことがあるダイエット、正直に教えてください。');
    answers.diet_history = await UI.multi([
      { label: '食事制限（サラダだけ・置き換え）', value: '食事制限' },
      { label: '運動・ジム', value: '運動' },
      { label: 'サプリ・酵素', value: 'サプリ' },
      { label: 'エステ・マッサージ', value: 'エステ' },
      { label: '特になし', value: 'なし' },
    ]);
    commitAnswerMulti('diet_history', answers.diet_history);

    // ===== S2 ダイエット失敗街道（Q4で選んだ思い出だけが出てくる） =====
    advanceChapter(2);
    UI.progress(0, 0);
    UI.say('ナレーション', '……正直にありがとうございます。それでは、その頑張りの思い出を、少しだけ一緒にたどってみましょう。');
    await UI.tapNext();

    const EVENTS = {
      '食事制限': {
        bg: 'bg_room.webp',
        props: ['prop_8_salad.webp'],
        intro: '『今日からサラダだけ！』と決めた日、ありませんでしたか？',
        choices: [
          { label: '3日は続いた', value: 'a' },
          { label: '初日の夜にはお腹グーグー', value: 'b' },
          { label: '「明日から」が口ぐせになった', value: 'c' },
        ],
        result: 'ゆいさんも同じでした。数日後、体はガス欠でフラフラ。「もう限界！」——反動で、食欲が爆発してしまいました。',
        pose: 'pose_4_naki.webp',
        fat: 'M',
        learn: '食事を極端に減らすと、体は<em>省エネモード</em>に切り替わります。消費カロリーまで減って、むしろ<b>やせにくい体</b>になってしまうんです。',
      },
      'ドカ食い': { // 食事制限の連鎖イベント（我慢→反動を一続きの物語で見せる）
        bg: 'bg_room.webp',
        props: ['prop_7_fridge.webp', 'prop_4_conveni.webp'],
        intro: 'その数日後、夜中の冷蔵庫の前——あの背徳感、ご存知ですよね？',
        choices: [
          { label: '気づいたら完食してた', value: 'a' },
          { label: '「明日から本気出す」と唱えた', value: 'b' },
          { label: '罪悪感でなかなか眠れなかった', value: 'c' },
        ],
        result: '我慢していた分だけ、反動は大きくなります。この夜、ゆいさんの脂肪くんは<b>いつもより大きく</b>育ちました。',
        pose: 'pose_2_shock.webp',
        fat: 'L',
        learn: 'リバウンドのたびに、脂肪細胞は<em>パンパンに再肥大</em>します。我慢→反動のループが、実はいちばんの遠回りなんです。',
      },
      '運動': {
        bg: 'bg_gym.webp',
        props: ['prop_5_dumbbell.webp'],
        intro: '入会金を払って、最初の月だけ通ったジム……心当たりはありませんか？',
        choices: [
          { label: '筋肉痛で3日目に挫折', value: 'a' },
          { label: '予定が合わなくて幽霊会員', value: 'b' },
          { label: 'ウェアだけ可愛いのが揃った', value: 'c' },
        ],
        result: '続かないのは、意志が弱いからではありません。でも、やめた途端に体重はじわじわ元通り……。',
        pose: 'pose_3_onaka.webp',
        fat: 'M',
        learn: '運動で脂肪は<b>小さく</b>なります。でも脂肪細胞の<em>“数”はそのまま</em>。やめれば、元のサイズに戻るだけなんです。',
      },
      'サプリ': {
        bg: 'bg_room.webp',
        props: ['prop_6_scale.webp'],
        intro: '「飲むだけでスッキリ」——そのサプリ、いま何袋目ですか？',
        choices: [
          { label: '飲んだ安心感で、つい食べちゃった', value: 'a' },
          { label: '効果を感じる前にやめた', value: 'b' },
          { label: '定期購入だけが続いている', value: 'c' },
        ],
        result: '翌朝、体重計の数字は——昨日と同じ。「飲んだから大丈夫」の安心感だけが残りました。',
        pose: 'pose_5_kangae.webp',
        fat: 'M',
        learn: 'サプリだけで脂肪細胞の<em>“数”が減ることはありません</em>。「飲んだから大丈夫」が、むしろ食欲の言い訳になりがちなんです。',
      },
      'エステ': {
        bg: 'bg_room.webp',
        props: ['prop_1_sofa.webp'],
        intro: 'エステ帰りの、あの「痩せた気がする」——覚えがありませんか？',
        choices: [
          { label: '翌朝、体重は変わってなかった', value: 'a' },
          { label: '回数券が余ったまま期限切れ', value: 'b' },
          { label: '気持ちよくて寝てただけだった', value: 'c' },
        ],
        result: '施術後はスッキリ。でも数日たつと、シルエットはいつも通りに……。',
        pose: 'pose_5_kangae.webp',
        fat: 'M',
        learn: 'エステで流れるのは主に<em>水分（むくみ）</em>。脂肪細胞そのものの数は変わらないため、数日で戻りやすいんです。',
      },
      '甘いもの': { // 全員共通のフィナーレイベント（夢の散歩は必ず街に出る）
        bg: 'bg_street.webp',
        props: ['prop_2_parfait.webp', 'prop_3_cake.webp'],
        intro: 'そして誰にでもある——がんばった日の、ご褒美スイーツ。先週は何回ありましたか？',
        choices: [
          { label: 'ご褒美が毎日になってた', value: 'a' },
          { label: '別腹は実在すると思う', value: 'b' },
          { label: '「シェアしよ」と言って1人で完食', value: 'c' },
        ],
        result: 'ご褒美は、悪いことではありません。ただ——脂肪くんにとってもご褒美だった。それだけのことでした。',
        pose: 'pose_5_kangae.webp',
        fat: 'M',
        learn: '糖は脂肪細胞の大好物。ご褒美のたびに、脂肪くんはこつこつ<em>“貯金”</em>を増やしていきます。',
      },
    };

    // 再生キュー: 選んだもの(最大3つ)＋食事制限は反動ドカ食いへ連鎖＋甘いものは全員共通
    const picked = answers.diet_history.filter((v) => v !== 'なし').slice(0, 3);
    const queue = [];
    picked.forEach((k) => { queue.push(k); if (k === '食事制限') queue.push('ドカ食い'); });
    queue.push('甘いもの');

    for (const key of queue) {
      const ev = EVENTS[key];
      if (!ev) continue;
      await BG.change(ev.bg);
      await GIRL.walk(1300);
      GIRL.stop();
      PROP.show(ev.props);
      UI.say('思い出', ev.intro);
      await UI.buttons(ev.choices); // どちらを選んでも「あるある」に落ちる設計
      GIRL.pose(ev.pose); // リアクション（ガーン音と同時）
      UI.say('ナレーション', ev.result);
      await UI.tapNext();
      FAT.add(ev.fat);
      GIRL.unpose();
      PROP.clear();
      GIRL.start(); // 学びは歩きながら（静止画時間を最小に）
      UI.say('✎ まなび', ev.learn);
      await UI.tapNext();
    }

    // ===== 街道の締め → S3への引き =====
    await BG.change('bg_street.webp');
    await GIRL.walk(1300);
    GIRL.stop();
    if (FAT.count() > 0) {
      UI.say('ナレーション', `ふと振り返ると——あなたの後ろに、<b>脂肪くん×${FAT.count()}</b>。`);
      await UI.tapNext();
    }
    GIRL.start();
    UI.say('ナレーション', '……がんばってなかったわけじゃない。<b>やり方が、脂肪くんに効いていなかっただけ</b>なんです。');
    await UI.tapNext('▶ その理由を知る');

    // ===== S3 学習「脂肪くんのひみつ」（夕暮れの街を歩きながら） =====
    advanceChapter(3);
    UI.say('ナレーション', 'ここで、ゆいさんが長年知らなかった<b>脂肪くんのひみつ</b>を、特別にお話しします。');
    await UI.tapNext('▶ ひみつを聞く');

    await POP.show({
      title: '脂肪くんのひみつ',
      html: '大人になってから、脂肪細胞の<b>“数”</b>はほとんど変わらないことが分かっています。<br>ダイエットで変わるのは、<b>“大きさ”だけ</b>。<div class="imgph">脂肪細胞の変化イメージ（画像・動画枠）<br>実素材が届いたら差し替え</div>',
      btn: '▶ つまり…？',
    });

    const nFat = FAT.count();
    FAT.shrinkAll();
    UI.say('ナレーション', 'ダイエットをがんばると、脂肪くんはたしかに<b>小さく</b>なります。');
    await UI.tapNext();
    UI.say('ナレーション', nFat > 1
      ? `でも……よく見てください。${nFat}匹いた脂肪くん、<b>1匹もいなくなってはいません</b>。`
      : 'でも……よく見てください。小さくなっただけで、<b>いなくなってはいません</b>。');
    await UI.tapNext();
    FAT.restoreAll();
    UI.say('ナレーション', 'そして食べれば、ぷくーっと元どおり。<br>——これが、<b>リバウンドの正体</b>です。');
    await UI.tapNext();
    GIRL.pose('pose_6_hirameki.webp');
    UI.say('ゆい', '「じゃあ……脂肪くんの<b>“数”そのもの</b>を減らせたら、もう戻らないんじゃない？」');
    await UI.tapNext('▶ その方法は…？');
    GIRL.unpose();

    // ===== S4 スルリム登場 =====
    await BG.change('bg_clinic.webp');
    GIRL.start();
    await GIRL.walk(1500);
    GIRL.stop();
    advanceChapter(4);
    UI.say('ナレーション', 'あります。脂肪細胞を、<b>壊して、外に出す。</b><br>JUNOの<b>スルリム式・脂肪破壊術</b>です。');
    await UI.tapNext('▶ え？スルリムって何？');

    UI.say('ナレーション', '<b>韓国で大バズした施術</b>を、JUNOが日本人の体質に合わせて<em>独自にアップデート</em>したもの——それがスルリム式です。');
    await UI.tapNext('▶ 安全性は？');

    await POP.show({
      title: 'はじめに、安心してください',
      html: 'スルリム式 脂肪破壊術は<br><b class="u-color-red u-fs-1_9">10年無事故<small>※</small></b> で安全性の高い施術です。<div class="badges"><div>韓国で<br>独自開発</div><div>治験検証<br>済み</div><div>症例実績<br>15万人</div></div><small class="u-color-gray">※期間: 2015/6/30-2025/6/30<br>※施術直後は一時的に腫れ感が出る場合があります</small>',
      btn: '▶ くわしく知る',
    });

    const REASONS = [
      ['1回で従来の約5回分', 'FDA承認のデオキシコール酸を高濃度配合。少ない回数で効果を実感いただけます。'],
      ['脂肪細胞を最大35%破壊', '脂肪細胞の“数”自体を減らすため、リバウンドしにくい仕組みです。'],
      ['1部位およそ15分', '切開不要・麻酔不要。お仕事帰りにも通えます。当日シャワーOK。'],
      ['ダウンタイムほぼなし', '翌日からメイク可能。一時的な腫れや内出血は通常1〜2週間で改善します。'],
      ['韓国で大バズの超人気メニュー', '韓国で爆発的に流行した施術を、JUNOが日本人の体質に合わせて独自にパワーアップ。'],
    ];
    await POP.carousel({
      title: 'スルリムが選ばれる5つの理由',
      cards: REASONS.map((r, i) =>
        `<b class="u-color-pink u-fs-1_55">${i + 1}. ${r[0]}</b><div class="imgph">イメージ画像・動画枠<br>実素材が届いたら差し替え</div>${r[1]}`),
      btn: '▶ なるほど…！',
    });

    const fatN = FAT.count();
    if (fatN > 0) {
      UI.say('ナレーション', 'それでは——ゆいさんの後ろの脂肪くんたちで、<b>実際にお見せしましょう</b>。');
      await UI.tapNext('▶ スルリム注射！');
      sururimFX(fatN); // 注射器＋シェイク＋フラッシュ
      setTimeout(() => FAT.burstAll(), 300); // 注射のタイミングに合わせて破裂
      await new Promise((r) => setTimeout(r, 300 + fatN * 330 + 1300));
    }
    await banner('脂肪細胞 最大35% はかい！', 2300, 'fat_9_shometsu.webp', 'つぶれた脂肪細胞は、体の外へ');
    UI.say('ナレーション', '小さくするのではなく、<b>数ごと、いなくなる</b>。<br>だから「<b>リバウンド知らずの脂肪破壊術</b>」なんです。');
    await UI.tapNext();
    const BA_CASES = [
      ['CASE 01｜20代・お腹まわり', '2か月で「あのデニム」が入るように'],
      ['CASE 02｜30代・二の腕', 'ノースリーブを買い足した夏に'],
      ['CASE 03｜40代・アゴ下', '横顔の写真、逃げなくなりました'],
    ];
    await POP.carousel({
      title: 'みんなのビフォー・アフター',
      cards: BA_CASES.map((c) =>
        `<div class="ba-case__head"><span class="ba-case__badge"></span><b class="u-fs-1_25">${c[0]}</b></div>
        <div class="imgph ba-case__imgph">症例写真（Before/After）枠<br>実素材が届いたら差し替え</div>
        <div class="ba-case__note">♡ ${c[1]}</div>
        <small class="u-color-gray">※個人の感想です。効果には個人差があります</small>`),
      btn: '▶ あなたの場合は？',
    });

    // ===== S5 脂肪タイプ診断書 =====
    advanceChapter(5);
    const ft = fatType();
    await POP.show({
      title: 'あなたの脂肪タイプ 診断書',
      html: `<div class="karte"><div class="karte__type">${ft.name}</div>
        <div class="karte__meta">気になる部位: ${answers.body_parts.join('・') || '—'} ／ 経験: ${answers.diet_history.join('・') || '—'}</div>
        ${ft.desc}<br><br><b>対策:</b> ${ft.plan}</div>
        <small class="karte__note">※この診断書は、最後にLINEへ保存できます（保存しないと消えてしまいます）</small>`,
      btn: '▶ つぎへ',
    });

    // ===== S6 特典（4枚ポンポン出現・タップは1回だけ） =====
    [450, 1100, 1750, 2400].forEach((t) => setTimeout(() => SND.pop(), t));
    await POP.show({
      title: 'あなたに届いた 4つのGIFT',
      html: `
        <div class="gcard is-g1"><div class="gcard__num">GIFT 01｜7月末まで！サマーキャンペーン</div><div class="gcard__t">1部位目</div><div class="gcard__d"><span class="price__old">定価 74,800円 → 9,800円</span>　<span class="price__now">4,900円</span></div></div>
        <div class="gcard is-g2"><div class="gcard__num">GIFT 02</div><div class="gcard__t">2部位目以降も特別価格</div><div class="gcard__d">何部位でも <b>14,800円</b> <small>※1部位のみでもOK</small></div></div>
        <div class="gcard is-g3"><div class="gcard__num">GIFT 03</div><div class="gcard__t">人気の美容施術が1つ無料</div><div class="gcard__d">飲む医療ダイエット・ボツリヌス施術・美容内服薬などから選べます</div></div>
        <div class="gcard is-g4"><div class="gcard__num">GIFT 04</div><div class="gcard__t">優先仮押さえ権</div><div class="gcard__d"><b>このページ限定</b>で、人気枠を含めた優先的な仮押さえができます</div></div>`,
      btn: '▶ すべて受け取る',
    });
    answers.coupon = '夏の3大特典';
    TIMER.start();
    UI.say('ナレーション', 'このGIFTは、<em>24時間以内にLINEのトーク画面で受け取る</em>と有効になります（有効期限は画面上部に表示しています）。');
    await UI.tapNext();
    UI.say('ナレーション', '現在スルリム式は大変混み合っていて、<em>人気の時間帯は1〜2週間待ち</em>になることも。ですが、GIFT 04の権利で——<em>このページ限定の優先仮押さえ</em>ができます。<br><small>（無料・キャンセル自由です）</small>');
    await UI.tapNext('▶ 優先仮押さえをする');

    // ===== S7 優先予約（仮押さえ・必須） =====
    // ⚠この案件は「予約先行型」（事前予約つき送客＝高単価）。通常LINE追加のみの導線は作らない
    //   代わりに「1/3→2/3→3/3」の進捗表示で体感の重さを軽減する
    advanceChapter(7);
    UI.say('ナレーション', '施術は<b>1部位およそ15分</b>で完了。お仕事帰りや<b>スキマ時間の活用</b>も人気です。——お住まいのエリアはどちらですか？<br><small>（仮押さえ 1／3）</small>');
    const areaId = await pickArea();
    UI.say('ナレーション', `<b>${AREA_LABELS[areaId] || ''}</b>のお近くの院をお選びください。<br><small>（仮押さえ 2／3）</small>`);
    const clinicResult = await pickClinic(areaId);
    answers.clinic = clinicResult.name;
    UI.say('ナレーション', 'あと少し！ご希望の日時を<b>第1〜第3希望</b>までタップしてください。<br><small>（仮押さえ 3／3）</small>');
    await pickCalendar(clinicResult.clinicId, clinicResult.isError);
    UI.say('ナレーション', `${answers.clinic ? `<b>${answers.clinic}</b> でのご希望、` : 'ご希望、'}お預かりしました。<em>LINE追加で仮押さえが確定</em>します。<br><small>※無料・キャンセル自由。確定のご連絡はLINEでお届けします</small>`);
    await UI.tapNext();

    // ===== S8 クリア → LINE =====
    advanceChapter(8);
    GIRL.start();
    UI.say('ナレーション', '長かった思い出の散歩も、もうすぐおしまいです。');
    await GIRL.walk(1800);
    GIRL.pose('pose_8_guts.webp');
    confetti(52);
    await banner('思い出の散歩 クリア！', 2300, 'pose_8_guts.webp', '2026年夏・答え合わせ 完了');
    await POP.show({
      title: 'あなたが手に入れたもの',
      html: `✔ 脂肪タイプ診断書（${ft.name}）<br>✔ GIFT 01: 1部位目 4,900円<br>✔ GIFT 02: 2部位目以降 14,800円<br>✔ GIFT 03: 人気施術1つ無料<br>${answers.clinic ? `✔ ${answers.clinic} の仮押さえ` : '✔ GIFT 04: 優先仮押さえ権（LINEから使えます）'}<br><br><b class="u-color-pink">LINE追加で、すべて受け取れます。</b><br><small>診断書の保存・特典チケットの発行・仮押さえの確定連絡が届きます</small>`,
      btn: '▶ 受け取りに進む',
    });
    // クロージング（社会的証明 → 損失回避 → 安心 → CTA）
    UI.say('ナレーション', 'この診断を受けた方の<em>9割以上</em>が、あなたと同じ悩みを抱えていました。そして——<b>変わりはじめた人から、夏を楽しんでいます</b>。');
    await UI.tapNext();
    UI.say('ナレーション', '特典チケットは<em>24時間で消え、1部位目は元の金額に戻ります</em>。受け取りは<b>LINE追加だけ・約10秒</b>。カウンセリングは無料で、<b>無理な勧誘は一切ありません</b>。');
    await UI.tapNext();
    UI.say('ナレーション', 'スルリムは、<b>痩せたいけど食べたい</b>——運動や食事制限なしで変わりたい、そんな方のための施術です。脂肪細胞の“数”から変えて、<em>食べても戻りにくい体へ</em>。');
    await UI.tapNext();
    UI.say('ナレーション', 'この夏は思う存分、<em>脂肪を破壊して体の外へ</em>出しましょう。');
    await UI.tapNext();
    confetti(30);
    UI.say('ゆい', '「がんばり方を、変えるだけ。<em>今年の夏は、我慢しないで楽しみましょ</em>」');

    const chFinal = UI.el;
    chFinal.innerHTML = `
      <div class="closing__badges">
        ${['カウンセリング無料', '無理な勧誘なし', '通知オフ・ブロック自由'].map((t) =>
    `<span class="closing__badge">✓ ${t}</span>`).join('')}
      </div>
      <div class="closing__lead">診断書と4つのGIFTを <b class="closing__lead-em">LINEで送信</b></div>`;

    $('.js-cta-link').removeClass('is-hidden').appendTo(chFinal);

    const micro = document.createElement('div');
    micro.className = 'closing__micro';
    micro.textContent = 'タップするとLINEの友だち追加画面が開きます（約10秒）';
    chFinal.appendChild(micro);

    // 注釈（ボタン下をスクロールで表示・フッター準拠）
    const fine = document.createElement('div');
    fine.className = 'closing__fine';
    fine.innerHTML =
      '※自由診療（保険適用外）／表示価格はすべて税込です<br>' +
      '※副作用: 内出血・腫れ・鈍痛（通常1〜2週間で改善します）<br>' +
      '※効果には個人差があります<br>' +
      '※GIFT 01は1部位目、GIFT 02は2部位目以降の価格です（1部位のみのご利用も可能です）<br>' +
      '※特典・価格は予告なく変更される場合があります。最新の情報は公式サイトをご確認ください<br>' +
      '<span class="closing__fine-links"><a href="#">運営者情報</a>　<a href="#">プライバシーポリシー</a></span><br>' +
      'JUNO BEAUTY CLINIC';
    chFinal.appendChild(fine);
  }
});
