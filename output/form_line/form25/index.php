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
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
	<title>脂肪はなぜ、消えないの？｜2026年夏・ダイエットの答え合わせ | JUNOビューティークリニック</title>
	<meta name="description" content="JUNOビューティークリニックのスルリム式脂肪破壊術を、2026年夏・ダイエットの答え合わせストーリーで診断＆ご紹介。LINE登録で診断書と特典をお届けします。">
	<meta name="keywords" content="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap"
		rel="stylesheet">
	<link rel="stylesheet" href="js/time-calendar-sync/style.css?time=<?= time() ?>">
	<link rel="stylesheet" href="css/style.css?time=<?= time() ?>">

	<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
	<script src="../../js/common.js"></script>
	<script type="module" src="js/script.js?time=<?= time() ?>"></script>

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
			<div class="story js-story">
				<div class="stage js-stage">
					<div class="stage__bgstrip js-bgstrip"></div>
					<div class="storybar js-storybar"></div>
					<div class="js-props"></div>
					<div class="js-fats"></div>
					<div class="girl js-girl">
						<img src="img/walk_1.webp" width="220" height="380" class="is-on" alt="">
						<img src="img/walk_2.webp" width="220" height="380" alt="">
						<img src="img/walk_3.webp" width="220" height="380" alt="">
						<img src="img/walk_4.webp" width="220" height="380" alt="">
					</div>
					<div class="stage__fat-counter js-fat-counter">脂肪くん×0</div>
					<div class="stage__timer js-timer"></div>
					<div class="hud">
						<button type="button" class="hud__btn js-mute-btn" title="音の切り替え">♪</button>
					</div>
					<div class="banner js-banner">
						<div class="banner__rays"></div>
						<div class="banner__inner">
							<div class="banner__badge"><img alt="" class="js-banner-img" width="90" height="90"></div>
							<div class="banner__title js-banner-title"></div>
							<div class="banner__sub js-banner-sub"></div>
						</div>
					</div>
					<svg class="stage__syringe js-syringe" viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<rect x="30" y="12" width="44" height="16" rx="4" fill="#fff" stroke="#e0679a" stroke-width="2.5"/>
						<rect x="36" y="16" width="26" height="8" rx="2" fill="#ffd3e4"/>
						<rect x="74" y="9" width="7" height="22" rx="2" fill="#e0679a"/>
						<rect x="81" y="17" width="14" height="6" rx="3" fill="#e0679a"/>
						<line x1="30" y1="20" x2="6" y2="20" stroke="#b3477a" stroke-width="2.5" stroke-linecap="round"/>
					</svg>
					<div class="stage__flash js-flash"></div>
				</div>
				<div class="talk">
					<div class="talk__head">
						<div class="talk__name js-talk-name">ナレーション</div>
						<div class="talk__qdots js-qdots"></div>
					</div>
					<div class="talk__text js-talk-text"></div>
				</div>
				<div class="choices js-choices"></div>

				<div class="pop js-pop"></div>

				<div class="js-answers u-hidden"></div>

				<a href="" data-href="<?= $url ?>" class="line-btn js-cta-link is-hidden">
					<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19.365 10.41C19.365 7.103 16.043 4.42 11.96 4.42c-4.083 0-7.404 2.683-7.404 5.99 0 2.963 2.632 5.444 6.183 5.915.241.052.569.159.651.364.074.186.048.478.024.667l-.105.631c-.033.186-.148.73.638.398.786-.332 4.243-2.498 5.79-4.277 1.068-1.17 1.629-2.358 1.629-3.698z" fill="currentColor"/></svg>LINEで受け取る
				</a>

				<div class="gate js-gate">
					<div class="gate__card">
						<div class="gate__clinic">JUNO BEAUTY CLINIC</div>
						<img class="gate__mascot" src="img/fat_2_m.webp" width="112" height="112" alt="">
						<div class="gate__title">脂肪はなぜ、<br>消えないの？</div>
						<div class="gate__sub">2026年夏・ダイエットの答え合わせ</div>
						<div class="gate__chips"><span>約3分で読めます</span><span>個人情報の入力なし</span></div>
						<div class="gate__btns">
							<button type="button" class="gate__btn-sound js-gate-start" data-sound="1">♪ 音ありで始める</button>
							<button type="button" class="gate__btn-mute js-gate-start" data-sound="0">音なしで始める</button>
						</div>
					</div>
				</div>
			</div>
		</main>
	</div>

	<?= r_rt() ?>
	<?= r_rt_lp() ?>
	<?= r_rt_sim_only() ?>
</body>

</html>
