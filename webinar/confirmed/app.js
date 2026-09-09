/* Vitalis Tower — Confirmation page.
   The registrant's assigned session arrives as ?session=<ISO> and is
   NEVER recalculated here — the public schedule can roll forward, but
   this page keeps showing the session they registered for. Everything
   renders from it: hero card, countdown, announce bar, and every
   calendar action (all built from the same instant by core.js).

   Events fired here:
     funnel_page_view / view_content
     calendar_add          — which calendar took the invite (type)
     webinar_join_click    — join link tapped on session day (a join CLICK,
                             not verified attendance — see /crm/README.md)
     booking_unlocked      — the timed reveal opened the booking calendar
     booking_slot_selected — first real interaction inside Calendly
     presentation_booked   — PRIMARY CONVERSION (confirmed booking)      */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;

  var EVENT_MS = ((CFG.EVENT && CFG.EVENT.MINUTES) || 60) * 60000;
  var UNLOCK_MIN = (CFG.BOOKING && CFG.BOOKING.UNLOCK_MINUTES) || 0;
  var ARRIVAL_KEY = 'vitalis.cf.arrivedAt';

  /* ==========================================================
     SESSION — from ?session= (no recalculation)
     ========================================================== */
  var session = C.sessionFromParam(null); // even a past session still renders
  var interest = '', variant = '';
  try {
    var qp0 = new URLSearchParams(location.search);
    interest = qp0.get('interest') || '';
    variant = qp0.get('v') || ''; // 'pro' = professional-positioning variant
  } catch (e) {}
  if (!interest) {
    var reg = C.getRegistration();
    if (reg) {
      interest = reg.interest || '';
      if (!session) session = new Date(reg.session); // refresh/direct return without params
    }
  }

  function renderSession() {
    if (!session) {
      // No recoverable registration — keep generic copy, hide what needs a date.
      $('countdown').hidden = true;
      $('cal-grid').hidden = true;
      $('cal-fallback').hidden = false;
      $('cf-date').textContent = 'Check your confirmation email';
      $('cf-time').textContent = 'It carries your session date and access link.';
      return;
    }
    var p = C.partsET(session, {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
    $('cf-date').textContent = p.weekday + ', ' + p.month + ' ' + p.day;
    $('cf-time').textContent = p.hour + ':' + p.minute + ' ' + p.dayPeriod + ' ' + p.timeZoneName + ' · Online session';
    $('cf-local').textContent = C.localEcho(session);

    var short = C.sessionShort(session);
    C.setSessionText('bar', 'See you ' + short);
    C.setSessionText('short', short);
  }

  function renderSmsNote() {
    // The hero mentions texts only when this browser opted in (best effort).
    var el = $('cf-sms-note');
    if (el && /[?&]sms=1/.test(location.search)) el.textContent = ' and phone';
  }

  /* ==========================================================
     COUNTDOWN — flips to the live join link during the event
     ========================================================== */
  function startCountdown() {
    if (!session) return;
    var live = $('cf-live-now');
    live.href = C.joinUrl(session);
    C.initCountdown('countdown', function () { return session; }, function () {
      $('countdown').hidden = true;
      var sinceStart = Date.now() - session.getTime();
      if (sinceStart < EVENT_MS) {
        live.hidden = false;
      } else {
        // Session over: point at the replay journey instead.
        var cta = $('cf-cal-cta');
        cta.textContent = 'This session has ended — watch the replay';
        cta.href = '/webinar/replay/?session=' + encodeURIComponent(session.toISOString());
      }
    });
  }

  /* ==========================================================
     CALENDAR ACTIONS — one authoritative instant, five doors
     ========================================================== */
  function buildCalendarLinks() {
    if (!session) return;
    var links = C.calendarLinks(session, variant);
    $('cal-google').href = links.google;
    $('cal-outlook').href = links.outlookLive;
    $('cal-office365').href = links.office365;
    $('cal-apple').href = links.ics; // served .ics via event.php (iOS-safe)
    // "Other" downloads a client-built .ics (identical UID) — works even
    // where PHP isn't available, e.g. local preview.
    try { $('cal-other').href = C.icsBlobUrl(session, variant); } catch (e) { $('cal-other').href = links.ics; }
    // Static hosts (GitHub Pages, local preview) can't run event.php —
    // detect that once and quietly reroute the Apple button to the
    // client-built .ics so the tap still lands in a calendar.
    fetch(links.ics, { method: 'HEAD' }).then(function (res) {
      var type = (res.headers.get('content-type') || '');
      if (!res.ok || type.indexOf('text/calendar') === -1) throw new Error('no php');
    }).catch(function () {
      try {
        var apple = $('cal-apple');
        apple.href = C.icsBlobUrl(session, variant);
        apple.setAttribute('download', 'vitalis-webinar.ics');
      } catch (e) {}
    });

    var KINDS = {
      'cal-google': 'google', 'cal-apple': 'apple', 'cal-outlook': 'outlook',
      'cal-office365': 'office365', 'cal-other': 'ics-download'
    };
    Object.keys(KINDS).forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('click', function () {
        // A click means the invite was opened — not that it was saved.
        track('calendar_add', { calendar_type: KINDS[id] });
      });
    });

    var mail = $('contact-mail');
    if (mail && CFG.PROJECT.CONTACT_EMAIL) {
      mail.href = 'mailto:' + CFG.PROJECT.CONTACT_EMAIL + '?subject=' +
        encodeURIComponent('Webinar registration change');
    }
  }

  /* ==========================================================
     PREVIEW VIDEO — only when configured; never a placeholder
     ========================================================== */
  function setupPreview() {
    var url = CFG.PREVIEW && CFG.PREVIEW.VIDEO_URL;
    if (!url) return; // section stays hidden
    var shell = $('pv-shell'), video = $('pv-video');
    shell.hidden = false;
    video.src = url;
    if (CFG.PREVIEW.POSTER) video.poster = CFG.PREVIEW.POSTER;
    var fired = {};
    video.addEventListener('play', function () {
      if (!fired.play) { fired.play = true; track('preview_video_play'); }
    });
    video.addEventListener('timeupdate', function () {
      if (!video.duration) return;
      var pct = video.currentTime / video.duration;
      [0.25, 0.5, 0.75, 0.95].forEach(function (m) {
        if (pct >= m && !fired[m]) { fired[m] = true; track('preview_video_progress', { progress: m }); }
      });
    });
  }

  /* ==========================================================
     BOOKING UNLOCK — a real timer (arrival persisted, so a
     refresh can't reset or contradict it). Hidden entirely
     until a Vitalis booking calendar is configured.
     ========================================================== */
  function setupUnlock() {
    var B = CFG.BOOKING || {};
    if (!B.URL) return; // [VITALIS-SETUP] no booking calendar yet — section stays hidden
    var section = $('unlock');
    section.hidden = false;

    // Investor vs owner-user copy
    if (interest === 'investment') {
      $('unlock-lede').textContent = 'Most investors wait for the webinar to book a private presentation. If you already want the one-on-one — tenant strategy, lease structures, the numbers — stay on this page a few minutes and the calendar opens right here.';
      $('unlock-sub').textContent = 'Pick any time that works. A real conversation with the sales team about the investment case — no obligation.';
    } else if (interest === 'practice') {
      $('unlock-lede').textContent = 'Most practice owners wait for the webinar to book a private presentation. If you already know you want to talk through your space needs — stay on this page a few minutes and the calendar opens right here.';
      $('unlock-sub').textContent = 'Pick any time that works. A real conversation about your practice, your space needs, and your timeline — no obligation.';
    }

    var ring = $('lk-ring'), time = $('lk-time');
    var CIRC = 339.3;
    var UNLOCK_MS = UNLOCK_MIN * 60000;

    var arrived = Date.now();
    try {
      var stored = parseInt(localStorage.getItem(ARRIVAL_KEY), 10);
      if (stored && stored <= arrived) arrived = stored;
      else localStorage.setItem(ARRIVAL_KEY, String(arrived));
    } catch (e) { /* private mode: in-memory timer still runs */ }
    var unlockAt = arrived + UNLOCK_MS;

    function embedBooking() {
      var mount = $('lk-embed');
      if (!mount || mount.firstChild) return;
      var url = B.URL;
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      if (B.PROVIDER === 'calendly') {
        url += sep + 'embed_domain=' + encodeURIComponent(location.hostname) +
          '&embed_type=Inline&hide_gdpr_banner=1';
        sep = '&';
      }
      // First-touch attribution rides into the booking record by hand —
      // the iframe appears long after attribution.js's link decoration ran.
      try {
        var raw = localStorage.getItem('vitalis.attribution.firstTouch');
        if (raw) {
          var rec = JSON.parse(raw);
          if (rec.source) { url += sep + 'utm_source=' + encodeURIComponent(rec.source); sep = '&'; }
          if (rec.medium) { url += sep + 'utm_medium=' + encodeURIComponent(rec.medium); sep = '&'; }
          if (rec.campaign) { url += sep + 'utm_campaign=' + encodeURIComponent(rec.campaign); sep = '&'; }
          if (rec.campaignId) { url += sep + 'campaign_id=' + encodeURIComponent(rec.campaignId); sep = '&'; }
          if (rec.clickId) { url += sep + 'fbclid=' + encodeURIComponent(rec.clickId); sep = '&'; }
        }
        if (interest) { url += sep + 'utm_content=' + encodeURIComponent('interest-' + interest); }
      } catch (e) { /* attribution must never break the calendar */ }
      var iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = 'Book your private presentation';
      mount.appendChild(iframe);
    }

    var unlockedOnLoad = Date.now() >= unlockAt;
    var announced = false;
    function unlock() {
      embedBooking();
      section.setAttribute('data-state', 'unlocked');
      C.confetti(46);
      if (!announced) {
        announced = true;
        track('booking_unlocked', { unlocked_on_load: unlockedOnLoad, buyer_interest: interest || 'unknown' });
      }
    }

    if (UNLOCK_MS <= 0) { unlock(); return; } // timer disabled — open immediately

    function tick() {
      var left = unlockAt - Date.now();
      if (left <= 0) { unlock(); return; }
      var s = Math.ceil(left / 1000);
      time.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
      ring.style.strokeDashoffset = (CIRC * (left / UNLOCK_MS)).toFixed(1);
      setTimeout(tick, 1000);
    }
    ring.style.strokeDashoffset = CIRC;
    tick();
  }

  // Calendly lifecycle via postMessage — only a confirmed booking counts
  // as the conversion. (GHL calendars confirm via their own redirect —
  // set it to /consultation/confirmed/ in the calendar settings.)
  function wireBookingDetection() {
    var interacted = false, booked = false;
    window.addEventListener('message', function (e) {
      var name = e.data && e.data.event;
      if (!name) return;
      var fromCalendly = typeof e.origin === 'string' &&
        /^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin);
      if (!fromCalendly) return;
      if (name === 'calendly.date_and_time_selected' && !interacted) {
        interacted = true;
        track('booking_slot_selected', { booking_source: 'confirmed-page' });
      }
      if (name === 'calendly.event_scheduled' && !booked) {
        booked = true;
        track('presentation_booked', { booking_source: 'confirmed-page' }); // PRIMARY CONVERSION
        pixel('Schedule', { content_name: 'vitalis-webinar-confirmed' });
      }
    });
  }

  /* ==========================================================
     IN-PAGE CTAS + join-click tracking
     ========================================================== */
  function setupCtas() {
    document.querySelectorAll('.cf-cal-cta[href^="#"]').forEach(function (cta) {
      var target = document.getElementById(cta.getAttribute('href').slice(1));
      if (!target) return;
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        target.scrollIntoView({ behavior: C.REDUCED_MOTION ? 'auto' : 'smooth' });
      });
    });
    var live = $('cf-live-now');
    if (live) live.addEventListener('click', function () {
      track('webinar_join_click', { join_source: 'confirmed-page' });
    });
  }

  function setupSticky() {
    var cta = $('sticky-cta');
    var hero = document.querySelector('.cf-hero');
    var grid = $('cal-grid');
    if (!cta || !hero || !grid || !('IntersectionObserver' in window)) return;
    if (grid.hidden) return;
    var pastHero = false, gridInView = true;
    function update() { cta.classList.toggle('show', pastHero && !gridInView); }
    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting; update();
    }, { threshold: 0.05 }).observe(hero);
    new IntersectionObserver(function (entries) {
      gridInView = entries[0].isIntersecting; update();
    }, { threshold: 0.15 }).observe(grid);
    cta.addEventListener('click', function () { cta.classList.remove('show'); });
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  renderSession();
  renderSmsNote();
  buildCalendarLinks();
  startCountdown();
  setupPreview();
  setupUnlock();
  wireBookingDetection();
  setupCtas();
  setupSticky();
  C.initDust('hero-dust', 20);
  C.initReveals();
  C.initCtaTracking();
  C.fillYear();
  C.confetti(70);

  track('funnel_page_view', { funnel_page: 'webinar-confirmed' });
  track('view_content', { content_name: 'webinar-confirmed' });
  pixel('ViewContent', { content_name: 'webinar-confirmed' });
})();
