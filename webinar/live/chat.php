<?php
// Vitalis Tower Session Room chat endpoint.
//
//   POST /webinar/live/chat.php        {name, phone, text, at, session}
//     Appends the message to data/chat-<ET date>.ndjson. Attendees only
//     ever write — nothing here echoes other people's messages back, so
//     the feed is readable exclusively through the admin GET below.
//
//   GET  /webinar/live/chat.php?key=…[&day=YYYY-MM-DD]
//     Admin-only (CHAT_ADMIN_KEY in /config/funnel.php). Returns every
//     message for the given ET day (default: today), the list of days
//     with messages, and the real presence count.
//
// Storage is newline-delimited JSON in ./data/, blocked from direct web
// access by data/.htaccess. Deploys must not overwrite runtime files there.

$cfg = require __DIR__ . '/../../config/funnel.php';
define('ADMIN_KEY', $cfg['CHAT_ADMIN_KEY']);

const DATA_DIR = __DIR__ . '/data';
const MAX_TEXT = 300;
const MAX_NAME = 40;
const MAX_PHONE = 24;
const MAX_BODY = 4096;

const ONLINE_WINDOW = 90;   // presence seen within 90s = on the page now
const ONLINE_PRUNE  = 600;  // delete presence files older than 10 min

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond($code, $payload) {
  http_response_code($code);
  echo json_encode($payload);
  exit;
}

function et_day($ts = null) {
  $d = new DateTime($ts === null ? 'now' : '@' . $ts);
  $d->setTimezone(new DateTimeZone('America/New_York'));
  return $d->format('Y-m-d');
}

function clean($s, $max) {
  $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$s);
  $s = trim($s);
  if (function_exists('mb_substr')) return mb_substr($s, 0, $max, 'UTF-8');
  return substr($s, 0, $max);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ---------- Attendee write ---------- */
if ($method === 'POST') {
  $raw = file_get_contents('php://input', false, null, 0, MAX_BODY);
  $body = json_decode($raw, true);
  if (!is_array($body)) respond(400, ['ok' => false, 'error' => 'bad json']);

  $name  = clean($body['name'] ?? '', MAX_NAME);
  $text  = clean($body['text'] ?? '', MAX_TEXT);
  $phone = clean($body['phone'] ?? '', MAX_PHONE);
  if ($name === '' || $text === '') respond(400, ['ok' => false, 'error' => 'empty']);

  $entry = [
    't'  => time(),
    'n'  => $name,
    'p'  => $phone,                              // number to text the answer to
    'm'  => $text,
    'at' => clean($body['at'] ?? '', 12),        // mm:ss into the broadcast
    's'  => clean($body['session'] ?? '', 40),   // session ISO the viewer saw
  ];

  if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0755, true);
  $file = DATA_DIR . '/chat-' . et_day() . '.ndjson';
  $line = json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n";
  if (@file_put_contents($file, $line, FILE_APPEND | LOCK_EX) === false) {
    respond(500, ['ok' => false, 'error' => 'write failed']);
  }
  respond(200, ['ok' => true]);
}

/* ---------- Admin read ---------- */
if ($method === 'GET') {
  $key = (string)($_GET['key'] ?? '');
  // A placeholder key means the console is not provisioned — refuse
  // everything rather than run with a publicly known value.
  if (ADMIN_KEY === 'CHANGE-ME-BEFORE-LAUNCH' ||
      $key === '' || !hash_equals(ADMIN_KEY, $key)) {
    respond(403, ['ok' => false, 'error' => 'forbidden']);
  }

  $day = (string)($_GET['day'] ?? et_day());
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) {
    respond(400, ['ok' => false, 'error' => 'bad day']);
  }

  $days = [];
  foreach (glob(DATA_DIR . '/chat-*.ndjson') ?: [] as $f) {
    if (preg_match('/chat-(\d{4}-\d{2}-\d{2})\.ndjson$/', $f, $m)) $days[] = $m[1];
  }
  rsort($days);

  $messages = [];
  $file = DATA_DIR . '/chat-' . $day . '.ndjson';
  if (is_file($file)) {
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
      $msg = json_decode($line, true);
      if (is_array($msg)) $messages[] = $msg;
    }
  }

  // Real people on the page right now: presence files (touched by
  // presence.php heartbeats) seen within ONLINE_WINDOW. Stale files
  // older than ONLINE_PRUNE are cleaned up here, on the admin's poll.
  $online   = 0;
  $presDir  = DATA_DIR . '/presence';
  $now      = time();
  if (is_dir($presDir)) {
    foreach (glob($presDir . '/*') ?: [] as $f) {
      $mt = @filemtime($f);
      if ($mt === false) continue;
      if ($now - $mt <= ONLINE_WINDOW) $online++;
      elseif ($now - $mt > ONLINE_PRUNE) @unlink($f);
    }
  }

  respond(200, [
    'ok' => true, 'day' => $day, 'days' => $days,
    'messages' => $messages, 'online' => $online,
  ]);
}

respond(405, ['ok' => false, 'error' => 'method not allowed']);
