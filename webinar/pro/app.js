/* Vitalis Tower — /webinar/pro/ — on-demand registration page.

   There is no session date. A silent preview loops behind a lock; after
   ONDEMAND.POPUP_DELAY_SECONDS of playback the registration pop-up opens
   (once per visit — a dismissal is respected). A CRM-acknowledged
   registration springs the lock and takes the visitor to the watch page
   (ONDEMAND.WATCH_PATH), where confetti greets them and the webinar plays.

   Visitors who already registered in this browser see "Continue to the
   webinar" instead of the pop-up. Legacy /webinar/pro/?watch=1 email
   links forward to the watch page. The gate is deliberately soft — the
   lead is captured by the CRM intake; video URLs are public on a static
   host. Registration only "succeeds" after the CRM acknowledges it. */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;
  var OD = CFG.ONDEMAND || {};
  var RM = C.REDUCED_MOTION;
  var VARIANT = 'professional';
  var ACCESS_KEY = 'vitalis.webinar.ondemand';
  var DISMISS_KEY = 'vitalis.od.popupDismissed';
  var WELCOME_KEY = 'vitalis.od.justRegistered';
  var WATCH = OD.WATCH_PATH || '/webinar/pro/watch/';

  var video = $('pv'), fill = $('pl-fill'), dialog = $('reg-dialog'), dlgVideo = $('dlg-video');
  var state = { registered: false, autoOpened: false, previewPlayed: 0, loops: 0, lastT: null };

  function readAccess() {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY)); } catch (e) { return null; }
  }
  function storeAccess(interest, source) {
    try {
      localStorage.setItem(ACCESS_KEY, JSON.stringify({
        at: new Date().toISOString(), interest: interest || '', source: source
      }));
    } catch (e) {}
  }
  function dismissedThisVisit() {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  }
  function goWatch(extra) { location.href = WATCH + (extra || ''); }

  /* ==========================================================
     PREVIEW — silent loop behind the lock
     ========================================================== */
  function startPreview() {
    video.src = OD.PREVIEW_URL || '/media/bernardo-preview.mp4';
    if (OD.PREVIEW_POSTER) video.poster = OD.PREVIEW_POSTER;
    video.muted = true;
    video.loop = true;
    if (RM) return; // reduced motion: poster + lock only
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked — poster stays */ });
  }

  video.addEventListener('timeupdate', function () {
    var t = video.currentTime;
    if (state.lastT != null && t < state.lastT - 1) {
      state.loops++;
      if (state.loops >= (OD.PREVIEW_MAX_LOOPS || 3)) video.loop = false;
    }
    if (state.lastT != null) {
      var d = t - state.lastT;
      if (d > 0 && d < 1.5) state.previewPlayed += d;
    }
    state.lastT = t;
    // The filled segment tracks the preview; the striped rest reads "locked".
    if (video.duration && fill) fill.style.width = (t / video.duration * 16).toFixed(2) + '%';
    if (state.previewPlayed >= (OD.POPUP_DELAY_SECONDS || 6)) maybeAutoOpen();
  });

  function maybeAutoOpen() {
    if (state.registered || state.autoOpened || dismissedThisVisit()) return;
    state.autoOpened = true;
    openDialog('auto');
  }

  /* ==========================================================
     REGISTRATION POP-UP
     ========================================================== */
  function openDialog(trigger) {
    if (state.registered) { goWatch(); return; }
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); dialog.classList.add('dlg-fallback'); }
    if (dlgVideo && !RM) {
      if (!dlgVideo.getAttribute('src')) dlgVideo.src = OD.PREVIEW_URL || '/media/bernardo-preview.mp4';
      try { dlgVideo.currentTime = video.currentTime || 0; } catch (e) {}
      var p = dlgVideo.play();
      if (p && p.catch) p.catch(function () {});
    }
    track('registration_popup_open', { popup_trigger: trigger, funnel_variant: VARIANT });
  }

  function closeDialog() {
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else { dialog.removeAttribute('open'); onDialogClosed(); }
  }
  function onDialogClosed() {
    if (dlgVideo) dlgVideo.pause();
    if (!state.registered) {
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      track('registration_popup_dismissed', { funnel_variant: VARIANT });
    }
  }
  dialog.addEventListener('close', onDialogClosed);
  $('dlg-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (e) {
    if (e.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
  });

  $('pl-lock').addEventListener('click', function () { openDialog('player'); });
  document.querySelectorAll('[data-open-reg]').forEach(function (btn) {
    btn.addEventListener('click', function () { openDialog(btn.getAttribute('data-open-reg')); });
  });

  /* Registered in this browser: every CTA leads to the watch page. */
  function showRegistered() {
    state.registered = true;
    document.body.classList.add('is-registered');
    document.querySelectorAll('[data-cta-label]').forEach(function (el) { el.textContent = 'Watch now'; });
    var cta = document.querySelector('.pl-cta');
    if (cta) cta.textContent = 'Continue to the webinar';
    $('pl-lock').setAttribute('aria-label', 'Continue to the full webinar');
  }

  /* ==========================================================
     FORM — validate, submit to the CRM, go on acknowledgment
     ========================================================== */
  var form = $('reg-form');
  var submitBtn = $('reg-submit');
  var submitLabel = $('reg-submit-label');
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
  function showFormError(msg) { formError.textContent = msg; formError.hidden = false; }
  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    submitLabel.textContent = on ? 'Unlocking…' : 'Unlock the webinar';
  }
  function selectedInterest() {
    var el = document.querySelector('input[name="buyer_interest"]:checked');
    return el ? el.value : 'investment';
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    formError.hidden = true;
    var hp = $('company');
    if (hp && hp.value) return; // honeypot
    if (!validateAll()) return;

    var G = CFG.GHL || {};
    if (!G.WEBHOOK_URL && (!G.FORM_ID || !G.LOCATION_ID)) {
      showFormError('Registration isn’t connected yet. Please try again later, or reach us via vitalistower.com.');
      track('webinar_registration_unconfigured', { funnel_variant: VARIANT, webinar_format: 'on-demand' });
      return;
    }
    setBusy(true);

    var interest = selectedInterest();
    var smsConsent = $('sms_consent').checked ? 'yes' : 'no';
    var payload = {
      first_name: $('first_name').value.trim(),
      last_name: $('last_name').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.trim(),
      funnel_variant: VARIANT,
      webinar_format: 'on-demand'
    };
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
        '&buyer_interest=' + encodeURIComponent(interest) +
        '&sms_consent=' + encodeURIComponent(smsConsent) +
        '&funnel_variant=' + VARIANT + '&webinar_format=on-demand';
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
      state.registered = true;
      storeAccess(interest, 'registration');
      try { sessionStorage.setItem(WELCOME_KEY, '1'); } catch (e) {}
      track('webinar_registration_completed', {
        webinar_format: 'on-demand', buyer_interest: interest, funnel_variant: VARIANT
      });
      pixel('CompleteRegistration', { content_name: 'vitalis-webinar-ondemand' });
      submitBtn.classList.add('is-done');
      submitLabel.textContent = 'Unlocked';
      // Let the lock spring open, then the watch page takes over.
      setTimeout(function () { goWatch(); }, RM ? 150 : 750);
    }).catch(function () {
      if (timer) clearTimeout(timer);
      setBusy(false);
      showFormError('We couldn’t complete your registration. Check your connection and try again — your details are still filled in.');
      track('webinar_registration_failed', { funnel_variant: VARIANT, webinar_format: 'on-demand' });
    });
  }

  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', function (e) {
    if (!formStarted) {
      formStarted = true;
      track('registration_form_started', { funnel_variant: VARIANT, webinar_format: 'on-demand' });
      pixel('RegistrationFormStarted', {}, true);
    }
    var t = e.target;
    if (t && t.id) FIELDS.forEach(function (f) {
      if (f.id === t.id && f.valid(t.value)) setFieldError(t.id, false);
    });
  });

  /* ==========================================================
     BOOT
     ========================================================== */
  C.initCtaTracking();
  C.fillYear();

  var qp = new URLSearchParams(location.search);
  if (qp.get('watch') === '1') {
    // Legacy email link — forward to the watch page (which grants access).
    location.replace(WATCH + '?watch=1');
    return;
  }

  startPreview();
  if (readAccess()) {
    showRegistered();
  } else {
    // If autoplay is blocked (or reduced motion), open on a timer instead.
    setTimeout(function () {
      if (!state.registered && (video.paused || RM)) maybeAutoOpen();
    }, ((OD.POPUP_DELAY_SECONDS || 6) + 2) * 1000);
  }

  track('funnel_page_view', { funnel_page: 'webinar-ondemand-pro', funnel_variant: VARIANT });
  track('view_content', { content_name: 'webinar-ondemand-pro' });
  pixel('ViewContent', { content_name: 'webinar-ondemand-pro' });
})();
