<?php
// ============================================================
// VITALIS TOWER — server-side funnel configuration.
// Twin of /config/funnel.js — keep the "(sync php)" values in
// that file identical to these. Used by:
//   /webinar/confirmed/event.php   (ICS calendar file)
//   /webinar/live/chat.php         (admin key)
// ============================================================

return [
  'PROJECT_NAME'   => 'Vitalis Tower',
  // [VITALIS-SETUP] deployed domain, no trailing slash
  'DOMAIN'         => 'https://vitalis.twelvecreative.io',

  'EVENT_TITLE'    => 'Vitalis Tower: An Introduction to Medical Office Ownership in Aventura',
  // Used when the invite is requested with ?v=pro (professional variant)
  'EVENT_TITLE_PRO'=> 'Vitalis Tower: An Introduction to Professional Office Ownership in Aventura',
  'EVENT_MINUTES'  => 60,

  // How attendees join. 'room' => the funnel's own live room;
  // 'external' => JOIN_URL below (Zoom / webinar platform).
  'ACCESS_MODE'    => 'room',
  'JOIN_URL'       => '',          // [VITALIS-SETUP] only for ACCESS_MODE 'external'
  'ROOM_PATH'      => '/webinar/live/',

  'ORGANIZER_NAME'  => 'Vitalis Tower',
  // [VITALIS-SETUP] real monitored mailbox for calendar ORGANIZER
  'ORGANIZER_EMAIL' => 'events@vitalistower.com',
  'REMINDER_MINUTES'=> 30,

  // [VITALIS-SETUP] admin key for /webinar/live/admin/ chat console.
  // Generate one (openssl rand -hex 16) and set it ON THE SERVER — while
  // this placeholder value remains, chat.php refuses all admin reads.
  'CHAT_ADMIN_KEY' => 'CHANGE-ME-BEFORE-LAUNCH',
];
