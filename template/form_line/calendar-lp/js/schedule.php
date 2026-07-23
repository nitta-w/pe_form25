<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("HTTP/1.1 200 OK");
    exit;
}

require_once __DIR__ . '/../../../google-bigquery-api/vendor/autoload.php';

$clinic_id = '';
$days = '';
$json_data = file_get_contents('php://input');
$post_data = json_decode($json_data, true);

if (isset($post_data['clinic_id'])) {
    $clinic_id = trim($post_data['clinic_id']);
}

if (isset($post_data['days'])) {
    $days = trim($post_data['days']);
}

$start_date = new DateTime();

$credentials_json = __DIR__ . '/../../../google-bigquery-api/clinic-calendar-464805-a107f309a932.json';

$big_query = new \Google\Cloud\BigQuery\BigQueryClient([
    'projectId' => 'clinic-calendar-464805',
    'keyFilePath' =>  $credentials_json,
]);


if (!empty($clinic_id) && !empty($days)) {

    $limit_days = (int)$days;

    // SQL構築
    $sql  = " WITH Dates AS ( ";
    $sql .= "   SELECT DISTINCT date ";
    $sql .= "   FROM `clinic-calendar-464805.sururim_calendar.sururim_calendar_holiday` ";
    $sql .= "   WHERE clinic_id = @clinic_id ";
    $sql .= "   ORDER BY date ";
    $sql .= "   LIMIT @limit_days ";
    $sql .= " ), ";

    $sql .= " Adjs AS ( ";
    $sql .= "   SELECT date, ARRAY_AGG(STRUCT(start_time, close_time)) as periods ";
    $sql .= "   FROM `clinic-calendar-464805.sururim_calendar.sururim_calendar_adjustment` ";
    $sql .= "   GROUP BY date ";
    $sql .= " ) ";

    $sql .= " SELECT ";
    $sql .= "   h.date ";
    $sql .= "   ,h.is_holiday_flag ";
    $sql .= "   ,h.is_closed_flag ";
    $sql .= "   ,i.name AS clinic_name ";
    $sql .= "   ,i.start_time AS default_start ";
    $sql .= "   ,i.close_time AS default_close ";
    $sql .= "   ,c.start_time AS daily_start ";
    $sql .= "   ,c.close_time AS daily_close ";
    $sql .= "   ,adj.periods ";
    $sql .= " FROM `clinic-calendar-464805.sururim_calendar.sururim_calendar_holiday` AS h ";
    $sql .= " JOIN Dates ON h.date = Dates.date ";
    $sql .= " LEFT JOIN `clinic-calendar-464805.sururim_calendar.sururim_calendar_info` AS i ON h.clinic_id = i.clinic_id ";
    $sql .= " LEFT JOIN `clinic-calendar-464805.sururim_calendar.sururim_calendar` AS c ON h.clinic_id = c.clinic_id AND h.date = c.date ";
    $sql .= " LEFT JOIN Adjs AS adj ON h.date = adj.date ";
    $sql .= " WHERE h.clinic_id = @clinic_id ";
    $sql .= " ORDER BY h.date ";

    $query = $big_query->query($sql)
    ->parameters([
        'clinic_id' => (int)$clinic_id,
        'limit_days' => $limit_days
    ]);

    $result = $big_query->runQuery($query);

    $a_clinic_info = [];
    $a_schedules = [];

    function floatToTimeStr($floatTime) {
        $hour = floor($floatTime);
        $minute = ($floatTime - $hour) * 60;
        return sprintf('%d:%02d', $hour, $minute);
    }

    foreach ($result as $row) {

        if (empty($a_clinic_info)) {
            $a_time_slots = [];

            if (isset($row['default_start']) && isset($row['default_close'])) {
                for ($t = (float)$row['default_start']; $t < (float)$row['default_close']; $t += 0.5) {
                    $a_time_slots[] = floatToTimeStr($t);
                }
            }

            $a_clinic_info = [
                'clinicName' => $row['clinic_name'],
                'businessHours' => [
                    'open' => (float)$row['default_start'],
                    'close' => (float)$row['default_close']
                ],
                'timeSlots' => $a_time_slots
            ];
        }

        $datetime_obj = new DateTime($row['date']);
        $set_date = $datetime_obj->format('Y/m/d');

        $daily_slots = new stdClass();

        // 調整時間
        $adj_periods = isset($row['periods']) ? $row['periods'] : [];

        if (isset($row['daily_start']) && isset($row['daily_close'])) {
            for ($t = (float)$row['daily_start']; $t < (float)$row['daily_close']; $t += 0.5) {
                $time_key = floatToTimeStr($t);

                $symbol = 0;

                foreach ($adj_periods as $period) {
                    $start = (float)$period['start_time'];
                    $close = (float)$period['close_time'];

                    if ($t >= $start && $t < $close) {
                        $symbol = 1;
                        break;
                    }
                }

                $daily_slots->{$time_key} = (object)[
                    'count' => 0,
                    'symbol' => $symbol
                ];
            }
        }

        $a_schedules[] = [
            'date' => $set_date,
            'isHoliday' => (int)$row['is_holiday_flag'],
            'isClosed' => (int)$row['is_closed_flag'],
            'isScheduleFull' => 0,
            'slots' => $daily_slots,
        ];
    }

    $response = $a_clinic_info;
    $response['schedules'] = $a_schedules;

    header('Content-Type: application/json');
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} else {
    header('Content-Type: application/json; charset=utf-8', true, 400);
    echo json_encode(['error' => 'clinic is required.']);
    exit;
}
?>