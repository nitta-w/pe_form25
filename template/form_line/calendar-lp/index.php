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
	<meta name="keywords" content="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=Poppins:wght@600;700;800;900&display=swap"
		rel="stylesheet">
	<link rel="stylesheet" href="js/time-calendar-sync/style.css">
	<link rel="stylesheet" href="css/style.css">

	<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
	<script src="../../js/common.js"></script>
	<script type="module" src="js/script.js"></script>

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