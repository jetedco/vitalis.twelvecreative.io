<?php
// Serves the registrant's webinar session as a real .ics download — the
// reliable "Add to Calendar" path for Apple/iOS (data: calendar URIs are
// ignored by iOS Safari and most in-app browsers) and the target of the
// calendar link in confirmation emails.
//
//   GET /webinar/confirmed/event.php?session=<ISO 8601 date-time>
//
// The UID is derived from the session start, so re-downloading the same
// session's invite always updates ONE event instead of stacking copies.
// All event content comes from /config/funnel.php — nothing hard-coded.

$cfg = require __DIR__ . '/../../config/funnel.php';

$iso = isset($_GET['session']) ? $_GET['session'] : '';
$ts  = $iso !== '' ? strtotime($iso) : false;
if ($ts === false) {
  http_response_code(400);
  header('Content-Type: text/plain; charset=utf-8');
  echo 'Missing or invalid session date. Please use the calendar buttons on your confirmation page.';
  exit;
}

$domain = rtrim($cfg['DOMAIN'], '/');
$host   = preg_replace('#^https?://#', '', $domain);

if ($cfg['ACCESS_MODE'] === 'external' && $cfg['JOIN_URL'] !== '') {
  $join = $cfg['JOIN_URL'];
} else {
  $join = $domain . $cfg['ROOM_PATH'] . '?session=' . rawurlencode($iso);
}
$page  = $domain . '/webinar/confirmed/?session=' . rawurlencode($iso);

$title = $cfg['EVENT_TITLE'];
$desc  = 'Join the session here: ' . $join
       . '\n\nPresented by the ' . $cfg['PROJECT_NAME'] . ' team · '
       . $cfg['EVENT_MINUTES'] . ' minutes.'
       . '\n\nYour confirmation page (calendar links + details): ' . $page;

$start = gmdate('Ymd\THis\Z', $ts);
$end   = gmdate('Ymd\THis\Z', $ts + $cfg['EVENT_MINUTES'] * 60);
$now   = gmdate('Ymd\THis\Z');

$lines = array(
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//' . $cfg['PROJECT_NAME'] . '//Webinar//EN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
  'UID:vitalis-webinar-' . $start . '@' . $host,
  'DTSTAMP:' . $now,
  'DTSTART:' . $start,
  'DTEND:' . $end,
  'SUMMARY:' . $title,
  'DESCRIPTION:' . $desc,
  'LOCATION:' . $join,
  'URL:' . $join,
);
if (!empty($cfg['ORGANIZER_EMAIL'])) {
  $lines[] = 'ORGANIZER;CN=' . $cfg['ORGANIZER_NAME'] . ':mailto:' . $cfg['ORGANIZER_EMAIL'];
}
$lines = array_merge($lines, array(
  'BEGIN:VALARM',
  'TRIGGER:-PT' . (int)$cfg['REMINDER_MINUTES'] . 'M',
  'ACTION:DISPLAY',
  'DESCRIPTION:' . $title . ' starts soon',
  'END:VALARM',
  'END:VEVENT',
  'END:VCALENDAR',
));
$ics = implode("\r\n", $lines);

// iOS Safari opens an inline text/calendar response straight into the
// native event preview ("Add All"); everything else gets a download.
$ua     = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
$inline = preg_match('/iPhone|iPad|iPod/i', $ua) ? 'inline' : 'attachment';

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: ' . $inline . '; filename="vitalis-webinar.ics"');
header('Cache-Control: no-cache, must-revalidate');
echo $ics;
