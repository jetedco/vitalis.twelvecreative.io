<?php
// Live presence for /webinar/live/.
//
//   POST /webinar/live/presence.php   {id:"<per-tab id>"}
//     Records that this viewer is currently on the page by touching an
//     empty file data/presence/<id> (its mtime = last-seen). One tiny
//     file per open tab, so counting freshness gives the REAL number of
//     people on the page, with no write contention between tabs.
//
//   GET  /webinar/live/presence.php?count=1
//     Public, read-only: {"ok":true,"count":N} — the number of tabs seen
//     in the last 90 seconds. This feeds the room's honest "in the room"
//     counter (shown only when LIVE.SHOW_PRESENCE is enabled and the
//     count clears LIVE.PRESENCE_MIN). This funnel never simulates
//     attendance; if the real number is unavailable, nothing is shown.

const PRES_DIR = __DIR__ . '/data/presence';
const ONLINE_WINDOW = 90;
const ONLINE_PRUNE  = 600;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  if (!isset($_GET['count'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'use ?count=1']);
    exit;
  }
  $online = 0;
  $now = time();
  if (is_dir(PRES_DIR)) {
    foreach (glob(PRES_DIR . '/*') ?: [] as $f) {
      $mt = @filemtime($f);
      if ($mt === false) continue;
      if ($now - $mt <= ONLINE_WINDOW) $online++;
      elseif ($now - $mt > ONLINE_PRUNE) @unlink($f);
    }
  }
  echo json_encode(['ok' => true, 'count' => $online]);
  exit;
}

if ($method !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'method not allowed']);
  exit;
}

$raw  = file_get_contents('php://input', false, null, 0, 512);
$body = json_decode($raw, true);
$id   = is_array($body) ? ($body['id'] ?? '') : '';

// Strict id shape so <id> can never escape the presence directory.
if (!preg_match('/^[A-Za-z0-9]{8,64}$/', (string)$id)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'bad id']);
  exit;
}

if (!is_dir(PRES_DIR)) @mkdir(PRES_DIR, 0755, true);
@touch(PRES_DIR . '/' . $id);

echo json_encode(['ok' => true]);
