/* Vitalis Tower — /webinar/pro/ — on-demand gated webinar.

   There is no session date: registration unlocks the webinar right here.
     locked     a silent preview loops behind a lock; after
                ONDEMAND.POPUP_DELAY_SECONDS of playback the registration
                pop-up opens (once per visit — a dismissal is respected)
     unlocking  CRM acknowledged the registration → the lock springs open
     unlocked   the full webinar plays with sound and controls

   Returning visitors (this browser) and email access links (?watch=1)
   arrive unlocked. The gate is deliberately soft — the lead is captured
   by the CRM intake; the video URL itself is public on a static host.

   Honesty rules kept from the rest of the funnel:
     · registration only "succeeds" after the CRM acknowledges it
     · watch progress counts seconds actually played — seeking to the
       end never registers as watched
     · until ONDEMAND.VIDEO_URL is set, the unlocked player plays the
       preview with sound (a stand-in, flagged in config) */
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

  var player = $('player'), video = $('pv'), fill = $('pl-fill');
  var dialog = $('reg-dialog'), dlgVideo = $('dlg-video');
  var state = { unlocked: false, registered: false, autoOpened: false, previewPlayed: 0, loops: 0, lastT: null, interest: '' };

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

  /* ==========================================================
     PREVIEW — silent loop behind the lock
     ========================================================== */
  function startPreview() {
    video.src = OD.PREVIEW_URL || '/media/bernardo-preview.mp4';
    if (OD.PREVIEW_POSTER) video.poster = OD.PREVIEW_POSTER;
    video.muted = true;
    video.loop = true;
    if (RM) return; // reduced motion: poster + lock only, no autoplay
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay blocked — poster stays up */ });
    track('preview_autoplay', { funnel_variant: VARIANT });
  }

  function onTimeUpdate() {
    var t = video.currentTime;
    if (!state.unlocked) {
      // Loop detection (currentTime jumps back to ~0 on each loop)
      if (state.lastT != null && t < state.lastT - 1) {
        state.loops++;
        if (state.loops >= (OD.PREVIEW_MAX_LOOPS || 3)) { video.loop = false; }
      }
      if (state.lastT != null) {
        var d = t - state.lastT;
        if (d > 0 && d < 1.5) state.previewPlayed += d;
      }
      state.lastT = t;
      // The filled segment tracks the preview; the striped rest reads "locked".
      if (video.duration && fill) fill.style.width = (t / video.duration * 16).toFixed(2) + '%';
      if (state.previewPlayed >= (OD.POPUP_DELAY_SECONDS || 6)) maybeAutoOpen();
      return;
    }
    watchProgress();
  }
  video.addEventListener('timeupdate', onTimeUpdate);

  function maybeAutoOpen() {
    if (state.unlocked || state.autoOpened || dismissedThisVisit()) return;
    state.autoOpened = true;
    openDialog('auto');
  }

  /* ==========================================================
     REGISTRATION POP-UP
     ========================================================== */
  function openDialog(trigger) {
    if (state.unlocked) { playFromCta(); return; }
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.classList.add('dlg-fallback');
    }
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
    if (!state.unlocked && !state.registered) {
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
      track('registration_popup_dismissed', { funnel_variant: VARIANT });
    }
  }
  dialog.addEventListener('close', onDialogClosed);
  $('dlg-close').addEventListener('click', closeDialog);
  // A click on the backdrop (outside the panel) closes.
  dialog.addEventListener('click', function (e) {
    if (e.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog();
  });

  $('pl-lock').addEventListener('click', function () { openDialog('player'); });
  document.querySelectorAll('[data-open-reg]').forEach(function (btn) {
    btn.addEventListener('click', function () { openDialog(btn.getAttribute('data-open-reg')); });
  });

  /* ==========================================================
     UNLOCK — the lock springs open, the webinar takes over
     ========================================================== */
  function fullVideoUrl() { return OD.VIDEO_URL || OD.PREVIEW_URL || '/media/bernardo-preview.mp4'; }

  function unlock(source, autoplay, interest) {
    if (state.unlocked) return;
    state.unlocked = true;
    state.interest = interest || '';
    document.body.classList.add('is-unlocked');
    document.querySelectorAll('[data-cta-label]').forEach(function (el) { el.textContent = 'Watch now'; });
    var next = $('pl-next-link');
    if (next && state.interest) next.href = '/consultation/?interest=' + encodeURIComponent(state.interest);
    track('webinar_unlocked', { unlock_source: source, funnel_variant: VARIANT });

    player.setAttribute('data-state', 'unlocking');
    setTimeout(function () {
      player.setAttribute('data-state', 'unlocked');
      $('pl-next').hidden = false;
      video.loop = false;
      video.controls = true;
      var src = fullVideoUrl();
      if (video.getAttribute('src') !== src) video.src = src;
      try { video.currentTime = 0; } catch (e) {}
      resetProgress();
      if (!autoplay) { video.pause(); video.muted = false; return; }
      playWithSound();
    }, RM ? 0 : 650);
  }

  function playWithSound() {
    video.muted = false;
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      // Sound blocked (no fresh user gesture): play muted, offer sound.
      video.muted = true;
      video.play().catch(function () {});
      $('pl-sound').hidden = false;
    });
  }

  $('pl-sound').addEventListener('click', function () {
    video.muted = false;
    video.play().catch(function () {});
    $('pl-sound').hidden = true;
    track('webinar_sound_on', { funnel_variant: VARIANT });
  });

  function playFromCta() {
    player.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    $('pl-sound').hidden = true;
    playWithSound();
  }

  /* ==========================================================
     WATCH PROGRESS — seconds actually played (seeks excluded)
     ========================================================== */
  var watch = { played: 0, lastT: null, fired: {}, started: false };
  function resetProgress() { watch = { played: 0, lastT: null, fired: {}, started: false }; }
  function watchProgress() {
    var t = video.currentTime;
    if (watch.lastT != null && !video.paused) {
      var d = t - watch.lastT;
      if (d > 0 && d < 2) watch.played += d;
    }
    watch.lastT = t;
    if (!video.duration) return;
    var pct = watch.played / video.duration;
    [0.25, 0.5, 0.75, 0.95].forEach(function (m) {
      if (pct >= m && !watch.fired[m]) {
        watch.fired[m] = true;
        track('ondemand_watch_progress', {
          progress: m, funnel_variant: VARIANT,
          full_webinar: !!OD.VIDEO_URL // false while the preview stands in
        });
      }
    });
  }
  video.addEventListener('seeking', function () { if (state.unlocked) watch.lastT = null; });
  video.addEventListener('play', function () {
    if (state.unlocked && !watch.started) {
      watch.started = true;
      track('webinar_play', { funnel_variant: VARIANT, full_webinar: !!OD.VIDEO_URL });
    }
  });

  /* ==========================================================
     FORM — validate, submit to the CRM, unlock on acknowledgment
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
      track('webinar_registration_completed', {
        webinar_format: 'on-demand', buyer_interest: interest, funnel_variant: VARIANT
      });
      pixel('CompleteRegistration', { content_name: 'vitalis-webinar-ondemand' });
      submitBtn.classList.add('is-done');
      submitLabel.textContent = 'Unlocked';
      setTimeout(function () {
        closeDialog();
        unlock('registration', true, interest);
      }, RM ? 150 : 700);
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
     SPONSOR ROWS — clone each set so the loop is seamless on
     wide screens (4 copies; the animation shifts by exactly half)
     ========================================================== */
  function buildMarquees() {
    if (RM) return; // static, wrapped rows
    document.querySelectorAll('[data-mq] .mq-track').forEach(function (trackEl) {
      var originals = Array.prototype.slice.call(trackEl.children);
      for (var copy = 0; copy < 3; copy++) {
        originals.forEach(function (li) {
          var c = li.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          var img = c.querySelector('img');
          if (img) img.alt = '';
          trackEl.appendChild(c);
        });
      }
    });
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  buildMarquees();
  C.initCtaTracking();
  C.fillYear();

  var access = readAccess();
  var qp = new URLSearchParams(location.search);
  if (!access && qp.get('watch') === '1') {
    storeAccess('', 'access-link');
    access = readAccess();
  }
  if (access) {
    video.src = fullVideoUrl();
    if (OD.PREVIEW_POSTER) video.poster = OD.PREVIEW_POSTER;
    unlock(access.source === 'access-link' ? 'access-link' : 'returning', false, access.interest);
  } else {
    startPreview();
    // If autoplay is blocked (or reduced motion), open on a timer instead.
    setTimeout(function () {
      if (!state.unlocked && (video.paused || RM)) maybeAutoOpen();
    }, ((OD.POPUP_DELAY_SECONDS || 6) + 2) * 1000);
  }

  track('funnel_page_view', { funnel_page: 'webinar-ondemand-pro', funnel_variant: VARIANT });
  track('view_content', { content_name: 'webinar-ondemand-pro' });
  pixel('ViewContent', { content_name: 'webinar-ondemand-pro' });
})();
