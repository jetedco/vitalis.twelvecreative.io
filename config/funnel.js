/* ============================================================
   VITALIS TOWER — WEBINAR FUNNEL CONFIGURATION
   ------------------------------------------------------------
   THE single source of truth for every public page in this
   funnel. Edit values here; never hard-code dates, URLs, or
   copy inside page scripts.

   Anything marked  [VITALIS-SETUP]  must be filled in before
   launch — the funnel runs without it, but that feature stays
   visibly disconnected (never silently simulated).

   Server-side twin: /config/funnel.php (used by event.php ICS
   generation). Keep EVENT + ACCESS + PROJECT values in sync —
   the fields shared by both files are marked "(sync php)".
   ============================================================ */
window.VITALIS = {

  /* ---------- Project identity ---------- */
  PROJECT: {
    NAME: 'Vitalis Tower',                       // approved public name (brochure English P8 V5) (sync php)
    DISTRICT: 'Aventura Medical District',
    // [VITALIS-SETUP] the domain this funnel deploys to (no trailing slash) (sync php)
    DOMAIN: 'https://vitalis.twelvecreative.io',
    MAIN_SITE: 'https://vitalistower.com',
    INSTAGRAM: 'https://www.instagram.com/vitalistoweraventura',
    SALES_CENTER: '2820 NE 214th St, Suite 903, Aventura, FL 33180',
    SITE_ADDRESS: '21291 NE 28th Ave, Aventura, FL 33180',
    // [VITALIS-SETUP] monitored inbox for registrant corrections / help
    CONTACT_EMAIL: 'info@vitalistower.com',
    // Sales line — also the "Save our number" contact card on the watch page
    CONTACT_PHONE: '(305) 395-3416'
  },

  /* ---------- The webinar event ---------- */
  EVENT: {
    // (sync php)
    TITLE: 'Vitalis Tower: An Introduction to Medical Office Ownership in Aventura',
    SHORT_TITLE: 'Medical Office Ownership in Aventura',
    // Title used by the professional-positioning variant (/webinar/pro/) —
    // same sessions, same CRM; only the framing differs. (sync php)
    TITLE_PRO: 'Vitalis Tower: An Introduction to Professional Office Ownership in Aventura',
    MINUTES: 60,                                  // event length (sync php)
    // 'live' = real-time presentation · 'recorded' = scheduled broadcast of a
    // recording. Copy on every page adjusts so the format is never misstated.
    FORMAT: 'recorded',
    // [VITALIS-SETUP] verified presenter(s). Until individual presenters are
    // approved, the safe default is the sales organization itself.
    PRESENTER: 'The Vitalis Tower Sales Team',
    PRESENTER_SUB: 'Fortune Development Sales'
  },

  /* ---------- Recurring schedule (America/New_York wall time) ---------- */
  SCHEDULE: {
    TZ: 'America/New_York',
    WEEKDAY: 3,              // 0=Sun … 3=Wednesday … 6=Sat
    HOUR: 19, MINUTE: 0,     // 7:00 PM ET
    CUTOFF_MINUTES: 15,      // registration closes this many min before start
    // One-off sessions IN ADDITION to the weekly pattern - ET date + time,
    // e.g. { date: '2026-09-20', hour: 11, minute: 0 }
    SPECIAL_SESSIONS: [],
    // Weekly dates to SKIP (canceled / rescheduled away), as ET 'YYYY-MM-DD'.
    // Registrants of a canceled date must also be messaged via CRM — see
    // /crm/README.md → "Cancel / reschedule runbook".
    CANCELED_DATES: [],
    // Optional capacity. null = uncapped. Enforced in the CRM workflow
    // (browser cannot know the count) — see /crm/README.md.
    CAPACITY: null
  },

  /* ---------- How attendees join ---------- */
  ACCESS: {
    // 'room' = this funnel's own /webinar/live/ page (default)
    // 'external' = a Zoom/webinar-platform URL (paste in JOIN_URL)
    MODE: 'room',
    // [VITALIS-SETUP] only when MODE:'external' — the provider join URL (sync php)
    JOIN_URL: '',
    ROOM_PATH: '/webinar/live/'
  },

  /* ---------- Live room behavior ---------- */
  LIVE: {
    // [VITALIS-SETUP] direct MP4 URL of the final webinar cut. Empty = the
    // room shows an explicit "broadcast not armed" slate (never a fake one).
    VIDEO_URL: '',
    DURATION_MINUTES: 60,    // set to the real video length when known
    UNLOCK_MINUTES: 40,      // consultation CTA reveals at this minute mark
    GRACE_MINUTES: 30,       // room stays on the ended slate this long after
    // Show the real number of people on the page (from presence.php).
    // Counts are REAL or hidden — this funnel never simulates attendance.
    SHOW_PRESENCE: false,
    PRESENCE_MIN: 10         // hide the counter below this real count
  },

  /* ---------- Replay ---------- */
  REPLAY: {
    ENABLED: true,
    AVAILABLE_DAYS: 7,       // replay window after each session ends
    // [VITALIS-SETUP] replay video URL (mp4) or leave '' until produced
    VIDEO_URL: ''
  },

  /* ---------- On-demand gated webinar (/webinar/pro/) ---------- */
  ONDEMAND: {
    // Silent looping preview shown behind the lock.
    PREVIEW_URL: '/media/bernardo-preview.mp4',
    PREVIEW_POSTER: '/images/webinar/preview-poster.jpg',
    // The full webinar, one file per language. The watch page shows an
    // English / Español switch above the player. Start language: ?lang=es|en,
    // else the viewer's saved choice, else their device language, else DEFAULT_LANG.
    // (For launch-scale traffic, move these to a video CDN and swap the URLs.)
    VIDEOS: {
      en: '/media/webinar-en.mp4?v=2',
      es: '/media/webinar-es.mp4'
    },
    DEFAULT_LANG: 'en',
    // Seconds of preview playback before the registration pop-up opens.
    POPUP_DELAY_SECONDS: 6,
    // The preview stops after this many loops (no endless motion).
    PREVIEW_MAX_LOOPS: 3,
    // Where registrants land (confetti + the webinar playing).
    WATCH_PATH: '/webinar/pro/watch/',
    // Vitalis Tower Dropbox behind "Learn more" on the watch page.
    // Empty = the button shows as pending (never a dead link).
    DROPBOX_URL: 'https://www.dropbox.com/scl/fo/rznymtup6qvap7fa6484a/AHM5i5NPn0LzMCZy39_vZt0?rlkey=586pt1phk9bnpk9o22liv2mmh&st=llbk5m7f&e=2&dl=0',
    // Contact card behind "Save our number".
    CONTACT_CARD: '/media/vitalis-tower.vcf',
    // What "Save or share" sends: the REGISTRATION page, so a friend
    // registers too — tagged so referred leads are attributable.
    SHARE_URL: 'https://vitalis.twelvecreative.io/webinar/pro/?utm_source=share&utm_medium=referral&utm_campaign=passive-income-webinar',
    SHARE_TEXT: 'Passive Income Webinar — generating passive income through commercial real estate investing, hosted by developer Bernardo Rieber. Free to watch:',
    // The open page (/passive-income/) has no registration wall, so its
    // share button sends the open page itself.
    OPEN_SHARE_URL: 'https://vitalis.twelvecreative.io/passive-income/?utm_source=share&utm_medium=referral&utm_campaign=passive-income-webinar'
  },

  /* ---------- Confirmation-page preview video (optional) ---------- */
  PREVIEW: {
    // [VITALIS-SETUP] short teaser mp4 for the confirmation page. Empty =
    // the preview section is hidden (no placeholder shown to visitors).
    VIDEO_URL: '',
    POSTER: '/images/renders/exterior-dusk.webp'
  },

  /* ---------- Consultation booking ---------- */
  BOOKING: {
    // [VITALIS-SETUP] the Vitalis sales calendar embed URL —
    // GoHighLevel calendar widget link or Calendly event link.
    // MUST be a Vitalis-only calendar. Never a JetEdCo calendar.
    URL: '',
    PROVIDER: '',            // 'ghl' | 'calendly' — set with URL
    CONFIRMED_URL: '/consultation/confirmed/',
    // Confirmed-page early-booking unlock timer (minutes). 0 disables the
    // timed reveal and shows the booking CTA immediately.
    UNLOCK_MINUTES: 5
  },

  /* ---------- GoHighLevel (Vitalis sub-account ONLY) ---------- */
  GHL: {
    // [VITALIS-SETUP] inbound-webhook URL of the Vitalis
    // "Webinar — Registration Intake" workflow (see /crm/README.md).
    WEBHOOK_URL: '',
    // [VITALIS-SETUP] fallback: native form endpoint IDs (Vitalis location!)
    ENDPOINT: 'https://backend.leadconnectorhq.com/forms/submit',
    FORM_ID: '',
    LOCATION_ID: '',
    // Custom-field keys (create in the Vitalis GHL location, keys verbatim)
    SESSION_FIELD_KEY: 'webinar_session_date',        // ET calendar day, MM-DD-YYYY
    SESSION_DISPLAY_FIELD_KEY: 'webinar_session_display', // pre-formatted ET text for merges
    SESSION_ISO_FIELD_KEY: 'webinar_session_iso',     // exact instant, ISO 8601 UTC
    INTEREST_FIELD_KEY: 'buyer_interest',             // practice | investment | both
    SMS_CONSENT_FIELD_KEY: 'sms_consent',             // yes | no
    TAG: 'vitalis-webinar-registrant'                 // applied in GHL, not from browser
  },

  /* ---------- Analytics ---------- */
  ANALYTICS: {
    // [VITALIS-SETUP] Vitalis GTM loader — BOTH values from the Vitalis
    // container (never JetEdCo's server.jetedco.com container).
    //   GTM_SRC: full script src, e.g. 'https://www.googletagmanager.com/gtm.js'
    //            or a Vitalis server-side tagging URL
    //   GTM_ID:  the container/query id appended as ?id=…
    GTM_SRC: '',
    GTM_ID: ''
  },

  /* ---------- Calendar invitations ---------- */
  CALENDAR: {
    ORGANIZER_NAME: 'Vitalis Tower',                 // (sync php)
    // [VITALIS-SETUP] real monitored mailbox for the ORGANIZER field (sync php)
    ORGANIZER_EMAIL: 'events@vitalistower.com',
    REMINDER_MINUTES: 30                             // VALARM lead time (sync php)
  }
};
