/* ============================================================
   VITALIS TOWER — SHARED FUNNEL CORE
   One engine for every page: the session clock (single source
   of truth, DST-safe via Intl), analytics, attribution reads,
   calendar-link building, and the motion system.

   Load order on every page:
     /config/funnel.js  →  /js/attribution.js  →  /js/core.js  →  page app.js
   ============================================================ */
(function () {
  'use strict';
  var CFG = window.VITALIS || {};
  var TZ = (CFG.SCHEDULE && CFG.SCHEDULE.TZ) || 'America/New_York';

  var REDUCED_MOTION = false;
  try {
    REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  /* ==========================================================
     ANALYTICS — dataLayer (GTM) + Meta Pixel hooks.
     GTM only loads when the Vitalis container is configured;
     dataLayer events queue regardless, so wiring GTM later
     never requires code changes.
     ========================================================== */
  function loadGtm() {
    var a = CFG.ANALYTICS || {};
    if (!a.GTM_SRC || !a.GTM_ID) return; // [VITALIS-SETUP] analytics disconnected
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var s = document.createElement('script');
      s.async = true;
      s.src = a.GTM_SRC + '?' + (a.GTM_SRC.indexOf('gtm.js') > -1 ? 'id=' : '') + a.GTM_ID;
      document.head.appendChild(s);
    } catch (e) {}
  }

  function track(event, detail) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, detail || {}));
    } catch (e) { /* analytics must never break a page */ }
  }
  function pixel(name, params, custom) {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq(custom ? 'trackCustom' : 'track', name, params || {});
      }
    } catch (e) {}
  }

  /* ==========================================================
     SESSION CLOCK — single source of truth.
     All wall-time math runs through Intl in America/New_York,
     so EDT/EST transitions are handled with no hard-coded
     offsets anywhere.
     ========================================================== */
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function wallParts(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false, weekday: 'short',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }).formatToParts(date);
    var o = {};
    for (var i = 0; i < parts.length; i++) o[parts[i].type] = parts[i].value;
    return {
      y: +o.year, mo: +o.month, d: +o.day,
      h: +o.hour % 24, mi: +o.minute, s: +o.second,
      wd: WD.indexOf(o.weekday)
    };
  }

  // The exact instant when the ET wall clock reads y-mo-d h:mi.
  // Two correction passes settle DST-transition edge cases.
  function etInstant(y, mo, d, h, mi) {
    var want = Date.UTC(y, mo - 1, d, h, mi, 0);
    var utc = want;
    for (var i = 0; i < 2; i++) {
      var p = wallParts(new Date(utc));
      var got = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
      utc += want - got;
    }
    return new Date(utc);
  }

  function etDayKey(date) {
    var p = wallParts(date);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return p.y + '-' + z(p.mo) + '-' + z(p.d);
  }

  // Every configured session (weekly pattern + specials − cancels) from
  // `now − lookBackDays` forward, ascending. Capped list; callers filter.
  function upcomingSessions(now, lookBackDays, count) {
    now = now || new Date();
    var S = CFG.SCHEDULE || {};
    var out = [];
    var p = wallParts(new Date(now.getTime() - (lookBackDays || 0) * 86400000));
    var base = Date.UTC(p.y, p.mo - 1, p.d);
    var startOffset = ((S.WEEKDAY - p.wd) % 7 + 7) % 7;
    for (var add = startOffset; out.length < (count || 8) * 2 && add < 120; add += 7) {
      var day = new Date(base + add * 86400000);
      var s = etInstant(day.getUTCFullYear(), day.getUTCMonth() + 1,
                        day.getUTCDate(), S.HOUR, S.MINUTE);
      if ((S.CANCELED_DATES || []).indexOf(etDayKey(s)) === -1) out.push(s);
    }
    (S.SPECIAL_SESSIONS || []).forEach(function (sp) {
      try {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sp.date);
        if (m) out.push(etInstant(+m[1], +m[2], +m[3], sp.hour || 0, sp.minute || 0));
      } catch (e) {}
    });
    out.sort(function (a, b) { return a - b; });
    return out.slice(0, Math.max(count || 8, 8));
  }

  // Next session still open for registration (more than CUTOFF_MINUTES away).
  function nextOpenSession(now) {
    now = now || new Date();
    var cutoff = ((CFG.SCHEDULE || {}).CUTOFF_MINUTES || 15) * 60000;
    var list = upcomingSessions(now, 0, 8);
    for (var i = 0; i < list.length; i++) {
      if (list[i].getTime() - now.getTime() > cutoff) return list[i];
    }
    return null;
  }

  // Next session that is upcoming OR still inside `pastWindowMs` after start
  // (live rooms and watch pages stay on a running session).
  function sessionWithin(now, pastWindowMs) {
    now = now || new Date();
    var list = upcomingSessions(now, 2, 8);
    for (var i = 0; i < list.length; i++) {
      if (list[i].getTime() - now.getTime() > -pastWindowMs) return list[i];
    }
    return null;
  }

  // ?session=<ISO> — the registrant's own assigned session. Returns null when
  // absent/invalid, or when the session ended more than maxPastMs ago.
  function sessionFromParam(maxPastMs) {
    try {
      var iso = new URLSearchParams(location.search).get('session');
      if (!iso) return null;
      var d = new Date(iso);
      if (isNaN(d)) return null;
      if (maxPastMs != null && d.getTime() - Date.now() <= -maxPastMs) return null;
      return d;
    } catch (e) { return null; }
  }

  function fmtET(date, opts) {
    return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, opts)).format(date);
  }
  function partsET(date, opts) {
    var out = {};
    new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, opts))
      .formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  // "Wednesday, October 14 at 7:00 PM EDT" — merge-safe display text.
  function sessionDisplay(d) {
    return fmtET(d, {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).replace(/, (\d{1,2}:)/, ' at $1');
  }
  function sessionShort(d) {
    var p = partsET(d, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
    return p.weekday + ', ' + p.month + ' ' + p.day + ' · ' +
      p.hour + ':' + p.minute + ' ' + p.dayPeriod + ' ' + p.timeZoneName;
  }
  // The visitor's own local time, only when it differs from ET.
  function localEcho(d) {
    try {
      var localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!localTz || localTz === TZ) return '';
      var et = fmtET(d, { hour: 'numeric', minute: '2-digit' });
      var loc = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      }).format(d);
      if (loc.indexOf(et) === 0) return '';
      return loc + ' your time';
    } catch (e) { return ''; }
  }

  /* ==========================================================
     JOIN URL — how a registrant reaches their session
     ========================================================== */
  function joinUrl(session) {
    var A = CFG.ACCESS || {};
    if (A.MODE === 'external' && A.JOIN_URL) return A.JOIN_URL;
    var base = A.ROOM_PATH || '/webinar/live/';
    return session ? base + '?session=' + encodeURIComponent(session.toISOString()) : base;
  }

  /* ==========================================================
     ATTRIBUTION — read the first-touch record + current UTMs
     (written by /js/attribution.js). Never returns PII.
     ========================================================== */
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function attributionFields() {
    var out = {};
    try {
      var p = new URLSearchParams(location.search);
      p.forEach(function (v, k) {
        if (/^utm_/i.test(k) || k === 'fbclid' || k === 'gclid' || k === 'campaign_id') out[k] = v;
      });
      var raw = null;
      try { raw = localStorage.getItem('vitalis.attribution.firstTouch'); } catch (e) {}
      if (!raw) raw = readCookie('vitalis_attr');
      if (raw) {
        var r = JSON.parse(raw);
        if (r.source && !out.utm_source) out.utm_source = r.source;
        if (r.medium && !out.utm_medium) out.utm_medium = r.medium;
        if (r.campaign && !out.utm_campaign) out.utm_campaign = r.campaign;
        if (r.campaignId && !out.campaign_id) out.campaign_id = r.campaignId;
        if (r.content && !out.utm_content) out.utm_content = r.content;
        if (r.clickId && !out.fbclid) out.fbclid = r.clickId;
        if (r.landing) out.first_touch_page = r.landing;
        if (r.firstTouchAt) out.first_touch_at = r.firstTouchAt;
      }
      var fbp = readCookie('_fbp'); if (fbp) out.fbp = fbp;
      var fbc = readCookie('_fbc'); if (fbc) out.fbc = fbc;
      out.page_url = location.href.split('#')[0];
      if (document.referrer) out.referrer = document.referrer;
    } catch (e) {}
    return out;
  }

  /* ==========================================================
     REGISTRATION MEMORY — recover the visitor's own registration
     on return visits (duplicate-submission recovery).
     ========================================================== */
  var REG_KEY = 'vitalis.webinar.registration';
  function storeRegistration(iso, interest) {
    try {
      localStorage.setItem(REG_KEY, JSON.stringify({
        session: iso, interest: interest || '', at: new Date().toISOString()
      }));
    } catch (e) {}
  }
  function getRegistration() {
    try {
      var r = JSON.parse(localStorage.getItem(REG_KEY));
      if (!r || !r.session || isNaN(new Date(r.session))) return null;
      return r;
    } catch (e) { return null; }
  }

  /* ==========================================================
     CALENDAR LINKS — every option built from the SAME session
     instant. UID scheme matches event.php so a re-download of
     the same session never creates a second event identity.
     ========================================================== */
  function icsStamp(x) {
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return x.getUTCFullYear() + z(x.getUTCMonth() + 1) + z(x.getUTCDate()) + 'T' +
           z(x.getUTCHours()) + z(x.getUTCMinutes()) + z(x.getUTCSeconds()) + 'Z';
  }

  function calendarModel(session) {
    var minutes = (CFG.EVENT && CFG.EVENT.MINUTES) || 60;
    var end = new Date(session.getTime() + minutes * 60000);
    var domain = (CFG.PROJECT && CFG.PROJECT.DOMAIN) || '';
    var join = joinUrl(session);
    var joinAbs = /^https?:/i.test(join) ? join : domain + join;
    var confirmAbs = domain + '/webinar/confirmed/?session=' + encodeURIComponent(session.toISOString());
    return {
      title: (CFG.EVENT && CFG.EVENT.TITLE) || 'Vitalis Tower Webinar',
      start: session, end: end,
      joinUrl: joinAbs,
      description:
        'Join the session here: ' + joinAbs +
        '\n\nPresented by ' + ((CFG.EVENT && CFG.EVENT.PRESENTER) || 'the Vitalis Tower team') +
        ' · ' + minutes + ' minutes.' +
        '\n\nYour confirmation page (calendar links + details): ' + confirmAbs,
      domain: domain
    };
  }

  function calendarLinks(session) {
    var m = calendarModel(session);
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    var gParams =
      'text=' + encodeURIComponent(m.title) +
      '&dates=' + icsStamp(m.start) + '/' + icsStamp(m.end) +
      '&details=' + encodeURIComponent(m.description) +
      '&location=' + encodeURIComponent(m.joinUrl);
    var msParams =
      'path=%2Fcalendar%2Faction%2Fcompose&rru=addevent' +
      '&subject=' + encodeURIComponent(m.title) +
      '&startdt=' + encodeURIComponent(m.start.toISOString()) +
      '&enddt=' + encodeURIComponent(m.end.toISOString()) +
      '&body=' + encodeURIComponent(m.description) +
      '&location=' + encodeURIComponent(m.joinUrl);
    return {
      // Phones: the Google Calendar app drops params on the render?action
      // form — the /r/eventedit deep link carries them through.
      google: isMobile
        ? 'https://calendar.google.com/calendar/u/0/r/eventedit?' + gParams
        : 'https://calendar.google.com/calendar/render?action=TEMPLATE&' + gParams,
      outlookLive: 'https://outlook.live.com/calendar/0/deeplink/compose?' + msParams,
      office365: 'https://outlook.office.com/calendar/0/deeplink/compose?' + msParams,
      // Served .ics (event.php): the reliable Apple/iOS path — data: URIs
      // are ignored by iOS Safari and most in-app browsers.
      ics: '/webinar/confirmed/event.php?session=' + encodeURIComponent(m.start.toISOString())
    };
  }

  // Client-built .ics blob — fallback for "Other calendar" and for local
  // preview where PHP isn't running. Same UID as event.php.
  function icsBlobUrl(session) {
    var m = calendarModel(session);
    var cal = CFG.CALENDAR || {};
    var host = (m.domain || 'vitalistower.com').replace(/^https?:\/\//, '');
    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Vitalis Tower//Webinar//EN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:vitalis-webinar-' + icsStamp(m.start) + '@' + host,
      'DTSTAMP:' + icsStamp(new Date()),
      'DTSTART:' + icsStamp(m.start),
      'DTEND:' + icsStamp(m.end),
      'SUMMARY:' + m.title,
      'DESCRIPTION:' + m.description.replace(/\n/g, '\\n'),
      'LOCATION:' + m.joinUrl,
      'URL:' + m.joinUrl,
      (cal.ORGANIZER_EMAIL
        ? 'ORGANIZER;CN=' + (cal.ORGANIZER_NAME || 'Vitalis Tower') + ':mailto:' + cal.ORGANIZER_EMAIL
        : ''),
      'BEGIN:VALARM',
      'TRIGGER:-PT' + (cal.REMINDER_MINUTES || 30) + 'M',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + m.title + ' starts soon',
      'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].filter(Boolean);
    return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  }

  /* ==========================================================
     UI HELPERS
     ========================================================== */
  function $(id) { return document.getElementById(id); }

  function setSessionText(key, text) {
    var els = document.querySelectorAll('[data-session="' + key + '"]');
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  function initReveals() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || REDUCED_MOTION) return; // stay visible
    document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      group.querySelectorAll('[data-reveal]').forEach(function (kid, i) {
        kid.style.transitionDelay = (i * 90) + 'ms';
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  function initCountdown(boxId, getTarget, onZero) {
    var box = $(boxId);
    if (!box) return;
    var nums = {
      d: box.querySelector('[data-count="d"]'),
      h: box.querySelector('[data-count="h"]'),
      m: box.querySelector('[data-count="m"]'),
      s: box.querySelector('[data-count="s"]')
    };
    var dChip = box.querySelector('[data-chip="d"]');
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var target = getTarget();
      if (!target) { box.hidden = true; return; }
      var ms = target.getTime() - Date.now();
      if (ms <= 0) { if (onZero) onZero(); return; }
      var t = Math.floor(ms / 1000);
      var d = Math.floor(t / 86400);
      if (nums.d) nums.d.textContent = '' + d;
      if (nums.h) nums.h.textContent = pad(Math.floor(t % 86400 / 3600));
      if (nums.m) nums.m.textContent = pad(Math.floor(t % 3600 / 60));
      if (nums.s) nums.s.textContent = pad(t % 60);
      if (dChip) dChip.style.display = d === 0 ? 'none' : '';
      setTimeout(tick, 1000);
    }
    tick();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  }

  function initStickyCta(stickyId, watchSelector) {
    var bar = $(stickyId);
    var target = document.querySelector(watchSelector);
    if (!bar || !target) return;
    var targetInView = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        targetInView = entries[0].isIntersecting;
        update();
      }, { threshold: 0.05 }).observe(target);
    }
    function update() { bar.classList.toggle('show', window.scrollY > 520 && !targetInView); }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // District marquee — text chips of Aventura Medical District anchors,
  // as identified in the approved brochure's district aerial.
  var DISTRICT = [
    'Aventura Hospital & Medical Center', 'HCA Florida Aventura Hospital',
    'Aventura Medical Tower', 'Pulmonary & Cardiology Aventura',
    'Royal Palm Health & Rehabilitation', 'Art Medical Building',
    'Hilton Aventura', 'Aventura Mall District', 'Founders Park',
    'Ives Estates', 'NE 28th Avenue Corridor'
  ];
  function buildMarquee(trackId) {
    var track = $(trackId);
    if (!track) return;
    var html = '';
    for (var copy = 0; copy < 2; copy++) {
      html += (copy ? '<li aria-hidden="true"><strong>' : '<li><strong>') + 'Vitalis Tower</strong></li>';
      for (var i = 0; i < DISTRICT.length; i++) {
        html += '<li' + (copy ? ' aria-hidden="true"' : '') + '>' + DISTRICT[i] + '</li>';
      }
    }
    track.innerHTML = html;
  }

  /* ==========================================================
     MOTION — gold dust + the skyline pulse line
     ========================================================== */
  function initDust(hostId, count) {
    var host = $(hostId);
    if (!host || REDUCED_MOTION) return;
    for (var i = 0; i < (count || 26); i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.setProperty('--dur', (11 + Math.random() * 14).toFixed(1) + 's');
      p.style.setProperty('--delay', (Math.random() * 14).toFixed(1) + 's');
      p.style.setProperty('--sway', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
      p.style.setProperty('--peak', (0.25 + Math.random() * 0.5).toFixed(2));
      var s = (2 + Math.random() * 3).toFixed(1);
      p.style.width = s + 'px'; p.style.height = s + 'px';
      host.appendChild(p);
    }
  }

  // The pulse line: an EKG heartbeat that rises into the tower silhouette.
  // Draws itself once, then a glowing orb travels it forever.
  function initPulseLine(svgId) {
    var svg = $(svgId);
    if (!svg) return;
    var path = svg.querySelector('.pulse-path');
    var orb = svg.querySelector('.pulse-orb');
    if (!path || !path.getTotalLength) return;
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    if (REDUCED_MOTION) { path.style.strokeDashoffset = 0; return; }
    path.style.strokeDashoffset = len;
    path.style.transition = 'stroke-dashoffset 3.2s cubic-bezier(.4,.1,.2,1) .4s';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { path.style.strokeDashoffset = 0; });
    });
    if (!orb) return;
    var DUR = 12000, raf = 0;
    function frame(ts) {
      var t = (ts % DUR) / DUR;
      var p = path.getPointAtLength(t * len);
      var op = t < 0.05 ? t / 0.05 : (t > 0.95 ? (1 - t) / 0.05 : 1);
      orb.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      orb.setAttribute('opacity', (op * 0.95).toFixed(2));
      raf = requestAnimationFrame(frame);
    }
    setTimeout(function () { raf = requestAnimationFrame(frame); }, 3600);
    document.addEventListener('visibilitychange', function () {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    });
  }

  function confetti(count) {
    if (REDUCED_MOTION) return;
    var COLORS = ['#C2A264', '#DCC28C', '#F2ECDF', '#FBF8F1', '#9A7E45'];
    var box = document.createElement('div');
    box.className = 'v-confetti';
    box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < (count || 60); i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = COLORS[i % COLORS.length];
      p.style.setProperty('--dur', (2.8 + Math.random() * 2.4).toFixed(2) + 's');
      p.style.setProperty('--delay', (Math.random() * 0.9).toFixed(2) + 's');
      p.style.setProperty('--drift', ((Math.random() - 0.5) * 220).toFixed(0) + 'px');
      p.style.setProperty('--spin', (360 + Math.random() * 540).toFixed(0) + 'deg');
      if (Math.random() < 0.35) { p.style.borderRadius = '50%'; p.style.height = p.style.width = '9px'; }
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 6500);
  }

  function initCtaTracking() {
    document.addEventListener('click', function (e) {
      var cta = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
      if (cta) track('cta_click', { cta_location: cta.getAttribute('data-cta') });
    });
  }

  function fillYear() {
    var el = $('year');
    if (el) el.textContent = new Date().getFullYear();
  }

  // Presenter identity comes from config — pages carry safe defaults in
  // their HTML, but the config always wins.
  function fillPresenter() {
    var E = CFG.EVENT || {};
    if (E.PRESENTER) {
      document.querySelectorAll('[data-presenter="name"]').forEach(function (el) {
        el.textContent = E.PRESENTER;
      });
    }
    if (E.PRESENTER_SUB) {
      document.querySelectorAll('[data-presenter="sub"]').forEach(function (el) {
        el.textContent = E.PRESENTER_SUB;
      });
    }
  }

  /* ==========================================================
     EXPORT
     ========================================================== */
  loadGtm();
  window.VITALIS_CORE = {
    CFG: CFG, TZ: TZ, REDUCED_MOTION: REDUCED_MOTION,
    track: track, pixel: pixel,
    wallParts: wallParts, etInstant: etInstant, etDayKey: etDayKey,
    upcomingSessions: upcomingSessions, nextOpenSession: nextOpenSession,
    sessionWithin: sessionWithin, sessionFromParam: sessionFromParam,
    fmtET: fmtET, partsET: partsET,
    sessionDisplay: sessionDisplay, sessionShort: sessionShort, localEcho: localEcho,
    joinUrl: joinUrl,
    attributionFields: attributionFields,
    storeRegistration: storeRegistration, getRegistration: getRegistration,
    calendarLinks: calendarLinks, icsBlobUrl: icsBlobUrl, calendarModel: calendarModel,
    $: $, setSessionText: setSessionText,
    initReveals: initReveals, initCountdown: initCountdown, initStickyCta: initStickyCta,
    buildMarquee: buildMarquee, initDust: initDust, initPulseLine: initPulseLine,
    confetti: confetti, initCtaTracking: initCtaTracking, fillYear: fillYear,
    fillPresenter: fillPresenter
  };
})();
