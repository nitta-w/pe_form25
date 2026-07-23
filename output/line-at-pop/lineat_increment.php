<?php
require_once __DIR__ . "/../common.php";

$pm = post2params($_POST);

if (empty($pm["ad_id"])) {
    $pm["ad_id"] = 0;
}


$db = DbConnection::get();

$sql  = " insert into line_count set ";
$sql .= " created_at = :created_at ";
$sql .= ",ad_id = :ad_id ";
$sql .= ",media_id = :media_id ";
$sql .= ",status_id = 0 ";
$sql .= ",count = 1";
$sql .= " on duplicate key update count = count + 1 ";

$sql_params = [];
$sql_params[] = $db->sqlStrParam(':created_at', date('Y-m-d'));
$sql_params[] = $db->sqlStrParam(':ad_id', $pm["ad_id"]);
$sql_params[] = $db->sqlStrParam(':media_id', get_media());

$ret = $db->execute($sql, $sql_params);