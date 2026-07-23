<?php
require_once __DIR__ . '/../../../common.php';

$pm = post2params($_POST);

$pm['media_id'] = get_media();

switch ($pm['type']) {
    case 5:
        update_status($pm);
        break;
}


/**
 * @param array $pm
 */
function update_status($pm)
{
    if (empty($pm['ad_id'])){
        return ;
    }

    if(empty($pm['status_id'])){
        return ;
    }

    $datetime = new Datetime();

    $db = DbConnection::get();

    $sql  = " INSERT INTO ad_count SET ";
    $sql .= " created_at = :created_at ";
    $sql .= ",ad_id = :ad_id ";
    $sql .= ",media_id = :media_id ";
    $sql .= ",status_id = :status_id ";
    $sql .= ",count = 1 ";
    $sql .= " ON DUPLICATE KEY UPDATE ";
    $sql .= " count = count + 1";
    $sql_params = array();
    $sql_params[] = $db->sqlStrParam(':created_at', $datetime->format("Y-m-d"));
    $sql_params[] = $db->sqlIntParam(':ad_id', $pm["ad_id"]);
    $sql_params[] = $db->sqlIntParam(':media_id', $pm["media_id"]);
    $sql_params[] = $db->sqlIntParam(':status_id', $pm["status_id"]);

    $ret = DbConnection::get()->execute($sql, $sql_params);
}
