/* Vitalis Tower — Private presentation booking page.
   Embeds the Vitalis sales calendar (BOOKING.URL in /config/funnel.js),
   carries attribution + known contact details into the booking where the
   provider supports prefill, adapts copy to owner-user vs investor
   context (?interest= or the stored registration), and — for Calendly —
   redirects to /consultation/confirmed/ once a booking is confirmed.
   GHL calendars should instead set their own booking-confirmed redirect
   to /consultation/confirmed/ (see /crm/README.md).

   Booking-funnel events:
     booking_page_view → booking_embed_view → booking_slot_selected
     → presentation_booked (PRIMARY CONVERSION)
   An abandoned start (slot selected, never booked) is the CRM's
   "booking started, not finished" trigger — see /crm/README.md.   */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;
  var B = CFG.BOOKING || {};

  /* ---------- Context: interest + prefill ---------- */
  var qp = new URLSearchParams(location.search);
  var interest = qp.get('interest') || '';
  if (!interest) {
    var reg = C.getRegistration();
    if (reg) interest = reg.interest || '';
  }
  // Prefill only from explicit query params (set by CRM email links, e.g.
  // ?name=…&email=…). Never invented, never stored here.
  var prefillName = qp.get('name') || '';
  var prefillEmail = qp.get('email') || '';

  function adaptCopy() {
    if (interest === 'investment') {
      $('cs-eyebrow').textContent = 'Private Presentation · Investors';
      $('cs-lede').textContent = 'A one-on-one with the Vitalis Tower sales team — the asset case, tenant strategy, lease structures, and current availability.';
      $('covers-lede').textContent = 'Your session leads with the investment case — the owner-user side stays on the table if you want it.';
      var inv = $('cover-investor');
      inv.parentNode.insertBefore(inv, $('cover-owner'));
    } else if (interest === 'practice') {
      $('cs-eyebrow').textContent = 'Private Presentation · Practice Owners';
      $('covers-lede').textContent = 'Your session leads with your space needs — bring your practice type, rough square footage, and timing.';
    }
  }

  /* ---------- Calendar embed ---------- */
  function embedCalendar() {
    var mount = $('calendar-embed');
    var placeholder = $('calendar-placeholder');
    if (!B.URL) {
      // [VITALIS-SETUP] no Vitalis sales calendar connected yet — say so.
      placeholder.innerHTML =
        '<p><strong>The booking calendar isn’t connected yet.</strong><br>' +
        '<small>Set BOOKING.URL (+ PROVIDER) in /config/funnel.js. Until then, reach the team via ' +
        (CFG.PROJECT.CONTACT_EMAIL ? '<a href="mailto:' + CFG.PROJECT.CONTACT_EMAIL + '">' + CFG.PROJECT.CONTACT_EMAIL + '</a>' : 'vitalistower.com') +
        '.</small></p>';
      track('booking_unconfigured');
      return;
    }

    var url = B.URL;
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    if (B.PROVIDER === 'calendly') {
      url += sep + 'embed_domain=' + encodeURIComponent(location.hostname) + '&embed_type=Inline&hide_gdpr_banner=1';
      sep = '&';
      if (prefillName) { url += sep + 'name=' + encodeURIComponent(prefillName); sep = '&'; }
      if (prefillEmail) { url += sep + 'email=' + encodeURIComponent(prefillEmail); sep = '&'; }
    } else {
      // GHL calendar widgets accept first_name/last_name/email/phone params
      // for prefill when "Auto-fill from URL" is enabled on the calendar.
      if (prefillName) { url += sep + 'full_name=' + encodeURIComponent(prefillName); sep = '&'; }
      if (prefillEmail) { url += sep + 'email=' + encodeURIComponent(prefillEmail); sep = '&'; }
    }
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
      if (interest) url += sep + 'utm_content=' + encodeURIComponent('interest-' + interest);
    } catch (e) {}

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'Book your private presentation';
    iframe.addEventListener('load', function () {
      if (placeholder) placeholder.remove();
    });
    mount.appendChild(iframe);
    track('booking_embed_view', { booking_source: 'consultation-page', buyer_interest: interest || 'unknown' });
  }

  /* ---------- Booking detection (Calendly postMessage) ---------- */
  function wireBookingDetection() {
    var interacted = false, booked = false;
    window.addEventListener('message', function (e) {
      var name = e.data && e.data.event;
      if (!name) return;
      if (!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin || '')) return;
      if (name === 'calendly.date_and_time_selected' && !interacted) {
        interacted = true;
        track('booking_slot_selected', { booking_source: 'consultation-page' });
      }
      if (name === 'calendly.event_scheduled' && !booked) {
        booked = true;
        track('presentation_booked', { booking_source: 'consultation-page' }); // PRIMARY CONVERSION
        pixel('Schedule', { content_name: 'vitalis-consultation' });
        setTimeout(function () {
          location.assign((B.CONFIRMED_URL || '/consultation/confirmed/') +
            (interest ? '?interest=' + encodeURIComponent(interest) : ''));
        }, 1200);
      }
    });
  }

  /* ---------- In-page CTAs ---------- */
  function setupCtas() {
    document.querySelectorAll('a[href="#calendar"]').forEach(function (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        var target = $('calendar-heading');
        target.focus({ preventScroll: true });
        $('calendar').scrollIntoView({ behavior: C.REDUCED_MOTION ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- Boot ---------- */
  adaptCopy();
  embedCalendar();
  wireBookingDetection();
  setupCtas();
  C.initReveals();
  C.initCtaTracking();
  C.fillYear();

  track('funnel_page_view', { funnel_page: 'consultation', buyer_interest: interest || 'unknown' });
  track('view_content', { content_name: 'consultation' });
  pixel('ViewContent', { content_name: 'consultation' });
})();
