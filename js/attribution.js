/* Vitalis Tower first-touch marketing attribution.
   Remembers which ad/campaign brought the visitor — 90 days, first touch
   wins — and hands it onward two ways:
     1. a .vitalistower.com cookie other Vitalis properties can read
     2. decorating outbound booking links (Calendly / GHL widgets)
   Accepts both tag dialects: utm_id or campaign_id, utm_content or utm_term.
   Must never throw — attribution is not worth breaking a page.
   NOTE: this record holds campaign identifiers only, never contact PII. */
(function () {
  'use strict';
  var KEY = 'vitalis.attribution.firstTouch';
  var COOKIE = 'vitalis_attr';
  var MAX_AGE_DAYS = 90;

  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fresh(rec) {
    if (!rec || !rec.firstTouchAt) return null;
    if (Date.now() - new Date(rec.firstTouchAt).getTime() > MAX_AGE_DAYS * 86400000) return null;
    return rec;
  }

  function stored() {
    try {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) {}
      if (!raw) raw = readCookie(COOKIE);
      return raw ? fresh(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  function persist(rec) {
    var json = JSON.stringify(rec);
    try { localStorage.setItem(KEY, json); } catch (e) {}
    try {
      document.cookie = COOKIE + '=' + encodeURIComponent(json) +
        ';max-age=' + (MAX_AGE_DAYS * 86400) + ';path=/;domain=.vitalistower.com;SameSite=Lax';
    } catch (e) {}
  }

  var rec = stored();
  try {
    var p = new URLSearchParams(location.search);
    var clickId = p.get('fbclid') || p.get('gclid') || '';
    if ((p.get('utm_source') || clickId) && !rec) {
      rec = {
        source: p.get('utm_source') || '',
        medium: p.get('utm_medium') || '',
        campaign: p.get('utm_campaign') || '',
        campaignId: p.get('utm_id') || p.get('campaign_id') || '',
        content: p.get('utm_term') || p.get('utm_content') || '',
        clickId: clickId,
        landing: location.pathname,
        firstTouchAt: new Date().toISOString()
      };
      persist(rec);
    } else if (rec) {
      persist(rec); // refresh the cookie's clock
    }
  } catch (e) {}

  if (!rec || (!rec.source && !rec.clickId)) return;

  function decorate() {
    var sel = 'a[href*="calendly.com"],a[href*="leadconnectorhq.com"],' +
              'a[href*="msgsndr.com"],a[href*="vitalistower.com"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) {
      try {
        var u = new URL(links[i].href);
        if (u.searchParams.get('utm_source') || u.searchParams.get('fbclid')) continue;
        if (rec.source) u.searchParams.set('utm_source', rec.source);
        if (rec.medium) u.searchParams.set('utm_medium', rec.medium);
        if (rec.campaign) u.searchParams.set('utm_campaign', rec.campaign);
        if (rec.campaignId) u.searchParams.set('campaign_id', rec.campaignId);
        if (rec.content) u.searchParams.set('utm_term', rec.content);
        if (rec.clickId) u.searchParams.set('fbclid', rec.clickId);
        links[i].href = u.toString();
      } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorate);
  } else {
    decorate();
  }
})();
