/* Vitalis Tower — /passive-income/ — the open webinar page.

   Everything from the registrants' experience, with no registration
   wall: the webinar in English / Español, save-or-share, the Dropbox,
   and "Save our number" (all from /webinar/pro/watch-kit.js), plus an
   optional "Have our team reach out" request.

   The request goes to the same Vitalis CRM intake as registration, as a
   sales contact request: request_type "contact-request", the preferred
   channel (call / text / whatsapp / email), and the language the visitor
   watched in. Text and WhatsApp require the texting consent box. The
   thank-you only appears after the CRM acknowledges the request. */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C || !window.VITALIS_WATCHKIT) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;
  var OD = CFG.ONDEMAND || {};
  var VARIANT = 'open';

  var kit = window.VITALIS_WATCHKIT({ variant: VARIANT, shareUrl: OD.OPEN_SHARE_URL });

  /* ==========================================================
     HAVE OUR TEAM REACH OUT
     ========================================================== */
  var form = $('reach-form');
  var submitBtn = $('reach-submit');
  var submitLabel = $('reach-submit-label');
  var formError = $('form-error');
  var busy = false, formStarted = false;

  var METHOD = {
    call:     { button: 'Have us call me',     thanks: 'A Vitalis Tower advisor will reach out by phone.' },
    text:     { button: 'Have us text me',     thanks: 'A Vitalis Tower advisor will reach out by text.' },
    whatsapp: { button: 'Have us WhatsApp me', thanks: 'A Vitalis Tower advisor will reach out on WhatsApp.' },
    email:    { button: 'Have us email me',    thanks: 'A Vitalis Tower advisor will reach out by email.' }
  };
  function method() {
    var el = document.querySelector('input[name="contact_method"]:checked');
    return el ? el.value : 'call';
  }
  function interest() {
    var el = document.querySelector('input[name="buyer_interest"]:checked');
    return el ? el.value : 'investment';
  }
  function needsConsent() { var m = method(); return m === 'text' || m === 'whatsapp'; }

  document.querySelectorAll('input[name="contact_method"]').forEach(function (r) {
    r.addEventListener('change', function () {
      submitLabel.textContent = METHOD[method()].button;
      if (!needsConsent()) $('err-consent').hidden = true;
    });
  });
  $('sms_consent').addEventListener('change', function () {
    if (this.checked) $('err-consent').hidden = true;
  });

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
    if (!firstBad && needsConsent() && !$('sms_consent').checked) {
      $('err-consent').hidden = false;
      firstBad = $('sms_consent');
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }
  function showFormError(msg) { formError.textContent = msg; formError.hidden = false; }
  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    submitLabel.textContent = on ? 'Sending…' : METHOD[method()].button;
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
      showFormError('Requests aren’t connected yet. Please call us at ' +
        ((CFG.PROJECT && CFG.PROJECT.CONTACT_PHONE) || 'the number above') + '.');
      track('contact_request_unconfigured', { funnel_variant: VARIANT });
      return;
    }
    setBusy(true);

    var m = method(), i = interest();
    var smsConsent = $('sms_consent').checked ? 'yes' : 'no';
    var lang = kit ? kit.getLang() : '';
    var payload = {
      first_name: $('first_name').value.trim(),
      last_name: $('last_name').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.trim(),
      request_type: 'contact-request',
      preferred_contact: m,
      webinar_language: lang,
      funnel_variant: VARIANT,
      webinar_format: 'on-demand'
    };
    payload[G.INTEREST_FIELD_KEY || 'buyer_interest'] = i;
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
        '&buyer_interest=' + encodeURIComponent(i) +
        '&sms_consent=' + encodeURIComponent(smsConsent) +
        '&preferred_contact=' + encodeURIComponent(m) +
        '&request_type=contact-request&funnel_variant=' + VARIANT +
        '&webinar_language=' + encodeURIComponent(lang);
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
      track('contact_request_completed', {
        preferred_contact: m, buyer_interest: i, webinar_language: lang, funnel_variant: VARIANT
      });
      pixel('Lead', { content_name: 'vitalis-contact-request' });
      form.hidden = true;
      $('reach-thanks-sub').textContent = METHOD[m].thanks;
      var thanks = $('reach-thanks');
      thanks.hidden = false;
      thanks.focus();
    }).catch(function () {
      if (timer) clearTimeout(timer);
      setBusy(false);
      showFormError('We couldn’t send your request. Check your connection and try again — your details are still filled in.');
      track('contact_request_failed', { funnel_variant: VARIANT });
    });
  }

  form.addEventListener('submit', onSubmit);
  form.addEventListener('input', function (e) {
    if (!formStarted) {
      formStarted = true;
      track('contact_request_started', { funnel_variant: VARIANT });
    }
    var t = e.target;
    if (t && t.id) FIELDS.forEach(function (f) {
      if (f.id === t.id && f.valid(t.value)) setFieldError(t.id, false);
    });
  });

  // Hero CTA: glide to the form and put focus on its heading.
  document.querySelectorAll('a[href="#reach-out"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      $('reach-out').scrollIntoView({ behavior: C.REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () { $('o-reach-h').focus({ preventScroll: true }); }, C.REDUCED_MOTION ? 0 : 450);
    });
  });

  var phone = CFG.PROJECT && CFG.PROJECT.CONTACT_PHONE;
  if (phone) {
    var link = $('o-call-link');
    link.textContent = phone;
    link.href = 'tel:+1' + phone.replace(/\D/g, '').slice(-10);
    $('o-call-link').addEventListener('click', function () { track('call_click', { funnel_variant: VARIANT }); });
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  C.initCtaTracking();
  C.fillYear();
  if (kit) kit.startPlayback();

  track('funnel_page_view', { funnel_page: 'webinar-open', funnel_variant: VARIANT });
  track('view_content', { content_name: 'webinar-open' });
  pixel('ViewContent', { content_name: 'webinar-open' });
})();
