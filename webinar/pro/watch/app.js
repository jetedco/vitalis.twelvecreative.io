/* Vitalis Tower — /webinar/pro/watch/ — where registrants land.

   Confetti greets a fresh arrival (straight from registration, or via an
   email access link) and the webinar starts playing. The player, the
   English / Español switch, and the three actions beneath it come from
   the shared kit (/webinar/pro/watch-kit.js).

   · Access: the <head> script already bounced anyone without a
     registration in this browser or a ?watch=1 email link.
   · Share sends the REGISTRATION page (tagged utm_source=share), so a
     friend registers too — never the watch page. */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C || !window.VITALIS_WATCHKIT) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel;
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
     BOOT
     ========================================================== */
  var kit = window.VITALIS_WATCHKIT({ variant: VARIANT, shareUrl: OD.SHARE_URL });
  C.initCtaTracking();
  C.fillYear();
  kit.startPlayback();
  if (justRegistered || fromLink) setTimeout(confetti, RM ? 0 : 250);

  track('funnel_page_view', { funnel_page: 'webinar-watch-pro', funnel_variant: VARIANT, arrival: justRegistered ? 'registration' : (fromLink ? 'access-link' : 'return') });
  track('view_content', { content_name: 'webinar-watch-pro' });
  pixel('ViewContent', { content_name: 'webinar-watch-pro' });
})();
