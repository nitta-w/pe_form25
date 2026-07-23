<?php
require_once __DIR__ . "/../common.php";

$db = DbConnection::get();

$url = "";

// popup画像デフォルト
$img = 'linepopup_img1.jpg';

if (!empty($_COOKIE['agent_id'])) {
	$agent_id = (int)$_COOKIE['agent_id'];

	$sql  = " select popup_url as url from ad_agent ";
	$sql .= " where ad_agent.id = {$agent_id} ";
	$res = $db->execute($sql);
	$row = $db->fetch($res);

	if (!empty($row["url"])) {
		$url = $row["url"];
	}

	// popup画像制御
	switch ($_COOKIE['agent_id']) {
	    case 12:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 27:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 29:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 30:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 48:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 79:
	        $img = 'linepopup_img2.jpg';
	        break;

	    case 107:
	        $img = 'linepopup_img2.jpg';
	        break;

	    case 118:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 123:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 127:
	        $img = 'linepopup_img3.jpg';
	        break;

	    case 128:
	        $img = 'linepopup_img3.jpg';
	        break;
	}

	// 画像が存在してない場合はデフォルトを出す
	if (! file_exists('img/' . $img)) {
		$img = 'linepopup_img1.jpg';
	}
}

$serverdata = array('url'=> $url, 'img' => $img);
header('Content-type: application/json');
echo json_encode($serverdata);