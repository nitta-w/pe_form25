<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit;
}

require_once __DIR__ . '/../../../google-bigquery-api/vendor/autoload.php';

// 地域
$area_id = '';
$json_data = file_get_contents('php://input');
$post_data = json_decode($json_data, true);

if (isset($post_data['area_id'])) {
    $area_id = trim($post_data['area_id']);
}

$start_date = new DateTime();

$credentials_json = __DIR__ . '/../../../google-bigquery-api/clinic-calendar-464805-a107f309a932.json';

$big_query = new \Google\Cloud\BigQuery\BigQueryClient([
    'projectId' => 'clinic-calendar-464805',
    'keyFilePath' =>  $credentials_json,
]);

if (!empty($area_id) ) {

    // SQL構築
    $sql  = " SELECT ";
    $sql .= " clinic_id ";
    $sql .= " ,name ";
    $sql .= " ,disp_name ";
    $sql .= " FROM `clinic-calendar-464805.sururim_calendar.sururim_calendar_info` ";
    $sql .= " WHERE area_id = @area_id ";
    $sql .= " AND disp_flag = 1 ";
    $sql .= " ORDER BY sort_num ";

    $query = $big_query->query($sql)
    ->parameters([
        'area_id' => (int)$area_id
    ]);

    $result = $big_query->runQuery($query);

    $a_clinics = [];

    foreach ($result as $row) {
        $a_clinics[] = [
            'clinic_id' => (int)$row['clinic_id'],
            'label' => $row['disp_name'],
            'value' => $row['name']
        ];
    }

    header('Content-Type: application/json');
    echo json_encode($a_clinics, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} else {
    header('Content-Type: application/json; charset=utf-8', true, 400);
    echo json_encode(['error' => 'clinic is required.']);
    exit;
}
?>