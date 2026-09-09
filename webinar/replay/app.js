/* Vitalis Tower — Replay page.
   The registrant's session arrives as ?session=<ISO> (from replay emails)
   or is recovered from this browser's stored registration. The page then
   resolves ONE of six states from the central config — never guessing:

     upcoming   session hasn't started      → confirmation link
     live       inside the live window      → join link
     pending    ended, window open, no replay video configured yet
     available  ended, window open, video configured → player + CTA
     expired    ended, replay window closed → next-session invitation
     none       no session identifiable    → email pointer + register

   Replay viewing is tracked by SECONDS ACTUALLY PLAYED (accumulated from
   timeupdate deltas), so seeking to the end never counts as "watched". */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;

  var EVENT_MS = ((CFG.EVENT && CFG.EVENT.MINUTES) || 60) * 60000;
  var R = CFG.REPLAY || {};
  var WINDOW_MS = (R.AVAILABLE_DAYS || 7) * 86400000;

  var session = C.sessionFromParam(null);
  var interest = '';
  if (!session) {
    var reg = C.getRegistration();
    if (reg) { session = new Date(reg.session); interest = reg.interest || ''; }
  } else {
    var reg2 = C.getRegistration();
    if (reg2) interest = reg2.interest || '';
  }

  function show(id) {
    ['rp-available', 'rp-upcoming', 'rp-live', 'rp-pending', 'rp-expired', 'rp-none']
      .forEach(function (s) { $(s).hidden = s !== id; });
    return id;
  }

  function resolveState() {
    if (!session) return show('rp-none');
    var now = Date.now();
    var start = session.getTime();
    var end = start + EVENT_MS;
    if (now < start) {
      $('rp-upcoming-sub').textContent = 'Your session runs ' + C.sessionDisplay(session) + '.';
      $('rp-upcoming-link').href = '/webinar/confirmed/?session=' + encodeURIComponent(session.toISOString());
      return show('rp-upcoming');
    }
    if (now < end) {
      $('rp-live-link').href = C.joinUrl(session);
      return show('rp-live');
    }
    if (!R.ENABLED || now > end + WINDOW_MS) {
      return show('rp-expired');
    }
    if (!R.VIDEO_URL) return show('rp-pending'); // [VITALIS-SETUP] replay not produced yet
    return show('rp-available');
  }

  function renderCopy(state) {
    var sub = $('rp-sub'), kicker = $('rp-kicker'), announce = $('announce-text');
    var titles = {
      'rp-available': ['The Replay', 'Missed the live hour — or want to rewatch a segment? The full session is below.'],
      'rp-upcoming': ['You’re Early', 'The replay appears here after your session ends.'],
      'rp-live': ['Right Now', 'The session is live at this very moment.'],
      'rp-pending': ['Almost Ready', 'Your session has ended; the replay is on its way.'],
      'rp-expired': ['Window Closed', 'This replay is no longer available.'],
      'rp-none': ['The Replay', 'Replay access comes with your registration.']
    };
    var t = titles[state] || titles['rp-none'];
    kicker.textContent = t[0];
    sub.textContent = t[1];
    if (session) announce.textContent = 'Session of ' + C.fmtET(session, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function setupPlayer() {
    var video = $('rp-video');
    video.src = R.VIDEO_URL;
    var endAt = session.getTime() + EVENT_MS + WINDOW_MS;
    var daysLeft = Math.max(1, Math.ceil((endAt - Date.now()) / 86400000));
    $('rp-window').textContent = 'Available for ' + daysLeft + ' more day' + (daysLeft === 1 ? '' : 's') +
      ' · Session of ' + C.fmtET(session, { month: 'long', day: 'numeric' });

    if (interest) {
      $('rp-book-cta').href = '/consultation/?interest=' + encodeURIComponent(interest);
    }

    // Honest watch measurement: accumulate seconds actually played.
    var played = 0, lastT = null, fired = {};
    video.addEventListener('play', function () {
      if (!fired.play) {
        fired.play = true;
        track('replay_view', { webinar_session: session.toISOString() });
        pixel('ReplayView', {}, true);
      }
      lastT = video.currentTime;
    });
    video.addEventListener('timeupdate', function () {
      if (lastT == null) { lastT = video.currentTime; return; }
      var delta = video.currentTime - lastT;
      if (delta > 0 && delta < 2) played += delta; // seeks/jumps don't count
      lastT = video.currentTime;
      if (!video.duration) return;
      var pct = played / video.duration;
      [0.25, 0.5, 0.75, 0.95].forEach(function (m) {
        if (pct >= m && !fired[m]) {
          fired[m] = true;
          track('replay_progress', { progress: m, webinar_session: session.toISOString() });
        }
      });
    });
    video.addEventListener('seeking', function () { lastT = null; });
  }

  /* ---------- Boot ---------- */
  var state = resolveState();
  renderCopy(state);
  if (state === 'rp-available') setupPlayer();

  C.initDust('hero-dust', 18);
  C.initReveals();
  C.initCtaTracking();
  C.fillYear();

  track('funnel_page_view', { funnel_page: 'webinar-replay', replay_state: state.replace('rp-', '') });
  track('view_content', { content_name: 'webinar-replay' });
  pixel('ViewContent', { content_name: 'webinar-replay' });
})();
