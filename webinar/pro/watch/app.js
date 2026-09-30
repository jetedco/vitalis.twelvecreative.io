/* Vitalis Tower — /webinar/pro/watch/ — where registrants land.

   Confetti greets a fresh arrival (straight from registration, or via an
   email access link), the webinar starts playing, and three actions sit
   beneath it: save/share the link, the Vitalis Tower Dropbox, and save
   the Vitalis Tower number as a contact.

   · Access: the <head> script already bounced anyone without a
     registration in this browser or a ?watch=1 email link.
   · Sound: browsers only allow sound after a tap on THIS page, so the
     video starts muted when needed and offers "Tap for sound".
   · Watch progress counts seconds actually played (seeks excluded) and
     is flagged full_webinar:false while the preview stands in.
   · Share sends the REGISTRATION page (tagged utm_source=share), so a
     friend registers too — never the watch page. */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;
  var OD = CFG.ONDEMAND || {};
  var RM = C.REDUCED_MOTION;
  var VARIANT = 'professional';
  var ACCESS_KEY = 'vitalis.webinar.ondemand';
  var WELCOME_KEY = 'vitalis.od.justRegistered';

  /* ---------- Access + welcome ---------- */
  var fromLink = new URLSearchParams(location.search).get('watch') === '1';
  var access = null;
  try { access = JSON.parse(localStorage.getItem(ACCESS_KEY)); } catch (e) {}
  if (!access && fromLink) {
    try {
      localStorage.setItem(ACCESS_KEY, JSON.stringify({
        at: new Date().toISOString(), interest: '', source: 'access-link'
      }));
    } catch (e) {}
  }
  var justRegistered = false;
  try {
    justRegistered = sessionStorage.getItem(WELCOME_KEY) === '1';
    sessionStorage.removeItem(WELCOME_KEY);
  } catch (e) {}

  /* ==========================================================
     THE WEBINAR — plays on arrival
     ========================================================== */
  var video = $('wv'), soundBtn = $('w-sound');
  var FULL = !!OD.VIDEO_URL;
  video.src = OD.VIDEO_URL || OD.PREVIEW_URL || '/media/bernardo-preview.mp4';
  if (OD.PREVIEW_POSTER) video.poster = OD.PREVIEW_POSTER;

  function startPlayback() {
    video.muted = false;
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      // No tap on this page yet: play muted and offer sound.
      video.muted = true;
      video.play().catch(function () {});
      soundBtn.hidden = false;
    });
  }
  soundBtn.addEventListener('click', function () {
    video.muted = false;
    video.play().catch(function () {});
    soundBtn.hidden = true;
    track('webinar_sound_on', { funnel_variant: VARIANT });
  });
  video.addEventListener('volumechange', function () { if (!video.muted) soundBtn.hidden = true; });

  var watch = { played: 0, lastT: null, fired: {}, started: false };
  video.addEventListener('play', function () {
    if (watch.started) return;
    watch.started = true;
    track('webinar_play', { funnel_variant: VARIANT, full_webinar: FULL });
  });
  video.addEventListener('seeking', function () { watch.lastT = null; });
  video.addEventListener('timeupdate', function () {
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
        track('ondemand_watch_progress', { progress: m, funnel_variant: VARIANT, full_webinar: FULL });
      }
    });
  });

  /* ==========================================================
     CONFETTI — two gold-and-ink cannons, then a soft top burst
     ========================================================== */
  function confetti() {
    if (RM) return;
    var canvas = document.createElement('canvas');
    canvas.className = 'w-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    var COLORS = ['#111316', '#C2A264', '#DCC28C', '#9A7E45', '#E9E2D2'];
    var parts = [];
    function burst(x, y, angle, spread, count, power) {
      for (var i = 0; i < count; i++) {
        var a = angle + (Math.random() - 0.5) * spread;
        var v = power * (0.5 + Math.random() * 0.7);
        parts.push({
          x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          w: 6 + Math.random() * 6, h: 9 + Math.random() * 9,
          rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.3,
          tilt: Math.random() * Math.PI, vtilt: 0.06 + Math.random() * 0.1,
          c: COLORS[i % COLORS.length], round: Math.random() < 0.22
        });
      }
    }
    burst(0, H, -Math.PI / 3.2, 0.9, 110, 21);
    burst(W, H, -Math.PI + Math.PI / 3.2, 0.9, 110, 21);
    setTimeout(function () { burst(W / 2, H * 0.18, Math.PI / 2, Math.PI * 1.6, 70, 6); }, 380);

    var last = performance.now(), born = last;
    function frame(now) {
      var dt = Math.min((now - last) / 16.67, 2.5); // frame-rate independent
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.vy += 0.34 * dt;
        p.vx *= Math.pow(0.985, dt);
        p.vy *= Math.pow(0.985, dt);
        if (p.vy > 4.2) p.vy = 4.2;                   // flutter, don't fall
        p.x += (p.vx + Math.sin(p.tilt) * 0.8) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.tilt += p.vtilt * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath(); ctx.arc(0, 0, p.w / 2.3, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.scale(1, Math.cos(p.tilt));
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      parts = parts.filter(function (p) { return p.y < H + 40; });
      if (parts.length && now - born < 9000) requestAnimationFrame(frame);
      else { window.removeEventListener('resize', size); canvas.remove(); }
    }
    requestAnimationFrame(frame);
  }

  /* ==========================================================
     1 · SAVE OR SHARE THE LINK
     ========================================================== */
  var shareUrl = OD.SHARE_URL || (location.origin + '/webinar/pro/');
  var shareText = OD.SHARE_TEXT || 'Passive Income Webinar';
  var shareBtn = $('w-share'), sharePanel = $('w-share-panel'), shareSub = $('w-share-sub');

  function flash(text) {
    var original = 'Send it to a friend';
    shareBtn.classList.add('is-copied');
    shareSub.textContent = text;
    setTimeout(function () { shareBtn.classList.remove('is-copied'); shareSub.textContent = original; }, 2400);
  }

  function copyLink() {
    function done() { flash('Link copied ✓'); track('share_channel', { channel: 'copy', funnel_variant: VARIANT }); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(done, legacyCopy);
    } else legacyCopy();
    function legacyCopy() {
      var input = $('w-share-url');
      input.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
    }
  }

  $('w-share-url').value = shareUrl;
  $('w-email').href = 'mailto:?subject=' + encodeURIComponent('Passive Income Webinar') +
    '&body=' + encodeURIComponent(shareText + '\n\n' + shareUrl);
  $('w-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(shareText + ' ' + shareUrl);
  $('w-sms').href = 'sms:?&body=' + encodeURIComponent(shareText + ' ' + shareUrl);
  $('w-copy').addEventListener('click', copyLink);
  ['w-email', 'w-whatsapp', 'w-sms'].forEach(function (id) {
    $(id).addEventListener('click', function () {
      track('share_channel', { channel: id.replace('w-', ''), funnel_variant: VARIANT });
    });
  });

  shareBtn.addEventListener('click', function () {
    if (navigator.share) {
      track('share_open', { method: 'native', funnel_variant: VARIANT });
      navigator.share({ title: 'Passive Income Webinar', text: shareText, url: shareUrl })
        .then(function () { track('share_complete', { method: 'native', funnel_variant: VARIANT }); })
        .catch(function () { /* closed without sharing */ });
      return;
    }
    var open = sharePanel.hidden;
    sharePanel.hidden = !open;
    shareBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) track('share_open', { method: 'panel', funnel_variant: VARIANT });
  });

  /* ==========================================================
     2 · VITALIS TOWER DROPBOX
     ========================================================== */
  var db = $('w-dropbox');
  if (OD.DROPBOX_URL) {
    db.href = OD.DROPBOX_URL;
    db.addEventListener('click', function () { track('dropbox_click', { funnel_variant: VARIANT }); });
  } else {
    // [VITALIS-SETUP] no link yet — visibly pending, never a dead link.
    db.removeAttribute('href');
    db.removeAttribute('target');
    db.setAttribute('role', 'link');
    db.setAttribute('aria-disabled', 'true');
    $('w-dropbox-sub').innerHTML = '<span class="w-pending">Link pending</span>';
  }

  /* ==========================================================
     3 · SAVE OUR NUMBER (contact card)
     ========================================================== */
  var ct = $('w-contact');
  ct.href = OD.CONTACT_CARD || '/media/vitalis-tower.vcf';
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // iOS opens a served contact card straight into "Add to Contacts";
  // everywhere else a named download opens in the contacts app.
  if (!isIOS) ct.setAttribute('download', 'Vitalis Tower.vcf');
  if (CFG.PROJECT && CFG.PROJECT.CONTACT_PHONE) {
    $('w-contact-sub').textContent = CFG.PROJECT.CONTACT_PHONE + ' · Vitalis Tower';
  }
  ct.addEventListener('click', function () { track('save_contact_click', { funnel_variant: VARIANT }); });

  /* ==========================================================
     BOOT
     ========================================================== */
  C.initCtaTracking();
  C.fillYear();
  startPlayback();
  if (justRegistered || fromLink) setTimeout(confetti, RM ? 0 : 250);

  track('funnel_page_view', { funnel_page: 'webinar-watch-pro', funnel_variant: VARIANT, arrival: justRegistered ? 'registration' : (fromLink ? 'access-link' : 'return') });
  track('view_content', { content_name: 'webinar-watch-pro' });
  pixel('ViewContent', { content_name: 'webinar-watch-pro' });
})();
