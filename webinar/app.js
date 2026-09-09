/* Vitalis Tower — Webinar registration page.
   Session dates, countdown, and the submitted ISO all come from ONE
   source: VITALIS_CORE.nextOpenSession() (config-driven, DST-safe).
   Registration posts to the Vitalis GoHighLevel intake (webhook or
   native form endpoint) and redirects to /webinar/confirmed/ only after
   the submission is durably acknowledged — never on a timer. */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG;
  var track = C.track, pixel = C.pixel, $ = C.$;

  /* ==========================================================
     SESSION RENDER — every [data-session] slot from one clock
     ========================================================== */
  var state = { session: null, rollTimer: 0 };

  function render() {
    var s = C.nextOpenSession();
    if (!s) return;
    state.session = s;

    var dayDate = C.fmtET(s, { weekday: 'long', month: 'long', day: 'numeric' });
    var time = C.fmtET(s, { hour: 'numeric', minute: '2-digit' });

    C.setSessionText('bar', 'Next session: ' + dayDate + ' at ' + time + ' ET');
    C.setSessionText('hero', dayDate + ' at ' + time + ' ET');
    C.setSessionText('reg-date', dayDate);
    C.setSessionText('reg-time', time + ' Eastern Time · Online');
    C.setSessionText('reg-local', C.localEcho(s));
    C.setSessionText('short', C.fmtET(s, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + time + ' ET');

    var iso = $('webinar_session_iso');
    if (iso) iso.value = s.toISOString();

    // Re-render the moment this session passes its cutoff and rolls forward.
    clearTimeout(state.rollTimer);
    var cutoffMs = (CFG.SCHEDULE.CUTOFF_MINUTES || 15) * 60000;
    var untilCutoff = s.getTime() - cutoffMs - Date.now() + 1000;
    state.rollTimer = setTimeout(function () { render(); showAlready(); }, Math.max(Math.min(untilCutoff, 2147000000), 1000));
  }

  /* ==========================================================
     ALREADY-REGISTERED RECOVERY — a returning registrant sees
     their existing registration, not a second form.
     ========================================================== */
  function showAlready() {
    var card = $('already-card');
    var reg = C.getRegistration();
    if (!card || !reg || !state.session) return;
    if (new Date(reg.session).getTime() !== state.session.getTime()) return; // different session — let them register
    card.hidden = false;
    $('reg-card').style.display = 'none';
    $('already-sub').textContent = C.sessionDisplay(new Date(reg.session));
    $('already-link').href = '/webinar/confirmed/?session=' +
      encodeURIComponent(reg.session) + (reg.interest ? '&interest=' + encodeURIComponent(reg.interest) : '');
    $('already-again').addEventListener('click', function () {
      card.hidden = true;
      $('reg-card').style.display = '';
      track('registration_reopened');
    });
  }

  /* ==========================================================
     FORM — validate, submit, redirect on confirmed success
     ========================================================== */
  var form = $('reg-form');
  var submitBtn = $('reg-submit');
  var formError = $('form-error');
  var busy = false;
  var formStarted = false;

  var FIELDS = [
    { id: 'first_name', valid: function (v) { return v.trim().length > 0; } },
    { id: 'last_name',  valid: function (v) { return v.trim().length > 0; } },
    { id: 'email',      valid: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
    { id: 'phone',      valid: function (v) { return v.replace(/\D/g, '').length >= 10; } }
  ];

  function setFieldError(id, show) {
    var input = $(id), err = $('err-' + id);
    if (!input || !err) return;
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
    err.hidden = !show;
  }
  function validateAll() {
    var firstBad = null;
    FIELDS.forEach(function (f) {
      var input = $(f.id);
      var ok = input && f.valid(input.value);
      setFieldError(f.id, !ok);
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }
  function showFormError(msg) {
    if (!formError) return;
    formError.textContent = msg;
    formError.hidden = false;
  }
  function setBusy(on) {
    busy = on;
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Reserving Your Seat…' : 'Reserve My Seat';
  }

  function selectedInterest() {
    var el = document.querySelector('input[name="buyer_interest"]:checked');
    return el ? el.value : 'practice';
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return; // duplicate-submission guard
    if (formError) formError.hidden = true;

    var hp = $('company');
    if (hp && hp.value) return; // honeypot

    if (!validateAll()) return;

    // Refresh right before submit in case the page sat open past the
    // cutoff — the visitor registers for a genuinely open session.
    render();
    var session = state.session;
    var iso = session.toISOString();
    var G = CFG.GHL || {};

    if (!G.WEBHOOK_URL && (!G.FORM_ID || !G.LOCATION_ID)) {
      showFormError('Registration isn’t connected yet. Please try again later, or reach us via vitalistower.com.');
      track('webinar_registration_unconfigured');
      return;
    }

    setBusy(true);

    // ET calendar day (MM-DD-YYYY) for GHL's date field — sending the UTC
    // ISO shifts a 7 PM ET session to the next UTC day and breaks
    // day-of reminder triggers. The display field is merged verbatim
    // into SMS/email templates.
    var sessionEtDate = C.fmtET(session, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    var sessionDisplay = C.sessionDisplay(session);
    var interest = selectedInterest();
    var smsConsent = $('sms_consent') && $('sms_consent').checked ? 'yes' : 'no';

    var payload = {
      first_name: $('first_name').value.trim(),
      last_name: $('last_name').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.trim()
    };
    payload[G.SESSION_FIELD_KEY || 'webinar_session_date'] = sessionEtDate;
    payload[G.SESSION_DISPLAY_FIELD_KEY || 'webinar_session_display'] = sessionDisplay;
    payload[G.SESSION_ISO_FIELD_KEY || 'webinar_session_iso'] = iso;
    payload[G.INTEREST_FIELD_KEY || 'buyer_interest'] = interest;
    payload[G.SMS_CONSENT_FIELD_KEY || 'sms_consent'] = smsConsent;
    var attr = C.attributionFields();
    for (var k in attr) if (Object.prototype.hasOwnProperty.call(attr, k)) payload[k] = attr[k];

    // Never leave the visitor on an endless spinner: hard 20s timeout.
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 20000);

    var req;
    if (G.WEBHOOK_URL) {
      // Inbound webhook: JSON body; identity duplicated in the query string
      // so GHL's mapping can read either. A no-cors fallback keeps the
      // submission flowing if the endpoint omits CORS headers — an opaque
      // response counts as delivered.
      var qs = '?email=' + encodeURIComponent(payload.email) +
        '&phone=' + encodeURIComponent(payload.phone) +
        '&first_name=' + encodeURIComponent(payload.first_name) +
        '&last_name=' + encodeURIComponent(payload.last_name) +
        '&webinar_session_date=' + encodeURIComponent(sessionEtDate) +
        '&webinar_session_display=' + encodeURIComponent(sessionDisplay) +
        '&buyer_interest=' + encodeURIComponent(interest) +
        '&sms_consent=' + encodeURIComponent(smsConsent);
      req = fetch(G.WEBHOOK_URL + qs, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        return fetch(G.WEBHOOK_URL + qs, {
          method: 'POST', mode: 'no-cors', keepalive: true,
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
          signal: ctrl ? ctrl.signal : undefined
        });
      });
    } else {
      var fd = new FormData();
      fd.append('formId', G.FORM_ID);
      fd.append('locationId', G.LOCATION_ID);
      for (var kk in payload) if (Object.prototype.hasOwnProperty.call(payload, kk)) fd.append(kk, payload[kk]);
      req = fetch(G.ENDPOINT, { method: 'POST', body: fd, signal: ctrl ? ctrl.signal : undefined });
    }

    req.then(function (res) {
      if (timer) clearTimeout(timer);
      if (res.type !== 'opaque' && !res.ok) throw new Error('HTTP ' + res.status);
      // Success confirmed by the submission response — never by a timer.
      C.storeRegistration(iso, interest);
      track('webinar_registration_completed', { webinar_session: iso, buyer_interest: interest });
      pixel('CompleteRegistration', { content_name: 'vitalis-webinar' });
      pixel('WebinarRegistrationCompleted', { webinar_session: iso }, true);
      var url = '/webinar/confirmed/?session=' + encodeURIComponent(iso) +
        '&interest=' + encodeURIComponent(interest);
      setTimeout(function () { location.href = url; }, 250); // let analytics flush
    }).catch(function () {
      if (timer) clearTimeout(timer);
      setBusy(false); // entered info is untouched — the button is the retry
      showFormError('We couldn’t complete your registration. Please check your connection and tap “Reserve My Seat” again — your information is still filled in.');
      track('webinar_registration_failed');
    });
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  render();
  showAlready();
  C.initCountdown('countdown', function () { return state.session; }, function () { render(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) render(); // catch cutoffs passed while backgrounded
  });

  C.buildMarquee('marquee-track');
  C.initDust('hero-dust', 26);
  C.initPulseLine('pulse-svg');
  C.initReveals();
  C.initStickyCta('sticky-cta', '#register');
  C.initCtaTracking();
  C.fillYear();
  C.fillPresenter();

  if (form) {
    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', function (e) {
      if (!formStarted) {
        formStarted = true;
        track('registration_form_started');
        pixel('RegistrationFormStarted', {}, true);
      }
      var t = e.target;
      if (t && t.id) {
        FIELDS.forEach(function (f) {
          if (f.id === t.id && f.valid(t.value)) setFieldError(t.id, false);
        });
      }
    });
  }

  track('funnel_page_view', { funnel_page: 'webinar-register' });
  track('view_content', { content_name: 'webinar-register' });
  pixel('ViewContent', { content_name: 'webinar-register' });
})();
