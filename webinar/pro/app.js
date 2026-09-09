/* Vitalis Tower — /webinar/pro/ registration logic.
   The professional-positioning variant of /webinar/: identical machinery
   (same session clock, same CRM intake, same duplicate recovery), quieter
   surface. Differences from the flagship page:
     · no marquee/dust/pulse/sticky — a single arrival fade is the motion
     · countdown renders as one quiet text line, not chips
     · submissions carry funnel_variant:"professional" for CRM segmentation
     · the confirmation redirect appends &v=pro so calendar invitations use
       EVENT.TITLE_PRO (professional title) instead of the medical framing */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;
  var VARIANT = 'pro';

  /* ---------- Session render (one clock, quiet output) ---------- */
  var state = { session: null, rollTimer: 0 };

  function render() {
    var s = C.nextOpenSession();
    if (!s) return;
    state.session = s;
    var dayDate = C.fmtET(s, { weekday: 'long', month: 'long', day: 'numeric' });
    var time = C.fmtET(s, { hour: 'numeric', minute: '2-digit' });
    C.setSessionText('hero', dayDate + ' at ' + time + ' ET');
    C.setSessionText('reg-date', dayDate);
    C.setSessionText('reg-time', time + ' Eastern Time · online · registration closes 15 minutes before start');
    C.setSessionText('reg-local', C.localEcho(s));
    var iso = $('webinar_session_iso');
    if (iso) iso.value = s.toISOString();

    clearTimeout(state.rollTimer);
    var cutoffMs = (CFG.SCHEDULE.CUTOFF_MINUTES || 15) * 60000;
    var untilCutoff = s.getTime() - cutoffMs - Date.now() + 1000;
    state.rollTimer = setTimeout(function () { render(); showAlready(); },
      Math.max(Math.min(untilCutoff, 2147000000), 1000));
  }

  // "Begins in 2 days, 4 hours" — a sentence, not a scoreboard.
  function tickCountdown() {
    var el = $('p-countdown');
    if (!el || !state.session) return;
    var ms = state.session.getTime() - Date.now();
    if (ms <= 0) { el.textContent = ''; return; }
    var d = Math.floor(ms / 86400000);
    var h = Math.floor(ms % 86400000 / 3600000);
    var m = Math.floor(ms % 3600000 / 60000);
    var parts = [];
    if (d) parts.push(d + (d === 1 ? ' day' : ' days'));
    if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (!d && m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
    el.textContent = parts.length ? 'Begins in ' + parts.join(', ') : 'Begins momentarily';
    setTimeout(tickCountdown, 30000);
  }

  /* ---------- Already-registered recovery ---------- */
  function showAlready() {
    var card = $('already-card');
    var reg = C.getRegistration();
    if (!card || !reg || !state.session) return;
    if (new Date(reg.session).getTime() !== state.session.getTime()) return;
    card.hidden = false;
    $('reg-form').style.display = 'none';
    $('already-sub').textContent = C.sessionDisplay(new Date(reg.session));
    $('already-link').href = '/webinar/confirmed/?session=' +
      encodeURIComponent(reg.session) + '&v=' + VARIANT +
      (reg.interest ? '&interest=' + encodeURIComponent(reg.interest) : '');
    $('already-again').addEventListener('click', function () {
      card.hidden = true;
      $('reg-form').style.display = '';
      track('registration_reopened', { funnel_variant: 'professional' });
    });
  }

  /* ---------- Form ---------- */
  var form = $('reg-form');
  var submitBtn = $('reg-submit');
  var formError = $('form-error');
  var busy = false, formStarted = false;

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
    formError.textContent = msg;
    formError.hidden = false;
  }
  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    submitBtn.textContent = on ? 'Reserving Your Seat…' : 'Reserve My Seat';
  }
  function selectedInterest() {
    var el = document.querySelector('input[name="buyer_interest"]:checked');
    return el ? el.value : 'practice';
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    formError.hidden = true;
    var hp = $('company');
    if (hp && hp.value) return; // honeypot
    if (!validateAll()) return;

    render(); // never register into a closed session
    var session = state.session;
    var iso = session.toISOString();
    var G = CFG.GHL || {};

    if (!G.WEBHOOK_URL && (!G.FORM_ID || !G.LOCATION_ID)) {
      showFormError('Registration isn’t connected yet. Please try again later, or reach us via vitalistower.com.');
      track('webinar_registration_unconfigured', { funnel_variant: 'professional' });
      return;
    }
    setBusy(true);

    var sessionEtDate = C.fmtET(session, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    var sessionDisplay = C.sessionDisplay(session);
    var interest = selectedInterest();
    var smsConsent = $('sms_consent').checked ? 'yes' : 'no';

    var payload = {
      first_name: $('first_name').value.trim(),
      last_name: $('last_name').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.trim(),
      funnel_variant: 'professional'
    };
    payload[G.SESSION_FIELD_KEY || 'webinar_session_date'] = sessionEtDate;
    payload[G.SESSION_DISPLAY_FIELD_KEY || 'webinar_session_display'] = sessionDisplay;
    payload[G.SESSION_ISO_FIELD_KEY || 'webinar_session_iso'] = iso;
    payload[G.INTEREST_FIELD_KEY || 'buyer_interest'] = interest;
    payload[G.SMS_CONSENT_FIELD_KEY || 'sms_consent'] = smsConsent;
    var attr = C.attributionFields();
    for (var k in attr) if (Object.prototype.hasOwnProperty.call(attr, k)) payload[k] = attr[k];

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 20000);

    var req;
    if (G.WEBHOOK_URL) {
      var qs = '?email=' + encodeURIComponent(payload.email) +
        '&phone=' + encodeURIComponent(payload.phone) +
        '&first_name=' + encodeURIComponent(payload.first_name) +
        '&last_name=' + encodeURIComponent(payload.last_name) +
        '&webinar_session_date=' + encodeURIComponent(sessionEtDate) +
        '&webinar_session_display=' + encodeURIComponent(sessionDisplay) +
        '&buyer_interest=' + encodeURIComponent(interest) +
        '&sms_consent=' + encodeURIComponent(smsConsent) +
        '&funnel_variant=professional';
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
      C.storeRegistration(iso, interest);
      track('webinar_registration_completed', {
        webinar_session: iso, buyer_interest: interest, funnel_variant: 'professional'
      });
      pixel('CompleteRegistration', { content_name: 'vitalis-webinar-pro' });
      pixel('WebinarRegistrationCompleted', { webinar_session: iso }, true);
      var url = '/webinar/confirmed/?session=' + encodeURIComponent(iso) +
        '&interest=' + encodeURIComponent(interest) + '&v=' + VARIANT;
      setTimeout(function () { location.href = url; }, 250);
    }).catch(function () {
      if (timer) clearTimeout(timer);
      setBusy(false);
      showFormError('We couldn’t complete your registration. Please check your connection and tap “Reserve My Seat” again — your information is still filled in.');
      track('webinar_registration_failed', { funnel_variant: 'professional' });
    });
  }

  /* ---------- Boot ---------- */
  render();
  tickCountdown();
  showAlready();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { render(); tickCountdown(); }
  });
  C.initCtaTracking();
  C.fillYear();
  C.fillPresenter();

  if (form) {
    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', function (e) {
      if (!formStarted) {
        formStarted = true;
        track('registration_form_started', { funnel_variant: 'professional' });
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

  track('funnel_page_view', { funnel_page: 'webinar-register-pro', funnel_variant: 'professional' });
  track('view_content', { content_name: 'webinar-register-pro' });
  pixel('ViewContent', { content_name: 'webinar-register-pro' });
})();
