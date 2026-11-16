/* Vitalis Tower — /webinar/pro/watch/ — floor plans & pricing form gate.

   The Typeform (ONDEMAND.TYPEFORM_ID) stays locked until the viewer has
   actually watched ONDEMAND.FORM_UNLOCK_SECONDS of the webinar: only real
   playback counts (paused time and forward seeks don't), across both
   languages, and progress is kept in this browser so a reload resumes it.
   Once unlocked it stays unlocked here, and the form is created in place,
   in the language the viewer is watching, with the page's UTM / ad
   parameters passed to its hidden fields. */
(function () {
  'use strict';
  var CFG = window.VITALIS || {};
  var OD = CFG.ONDEMAND || {};
  var FORM_ID = OD.TYPEFORM_ID;
  var NEED = OD.FORM_UNLOCK_SECONDS || 300;
  var box = document.getElementById('w-form-embed');
  if (!box || !FORM_ID) return;

  var KEY_SECONDS = 'vitalis.od.watchedSeconds';
  var KEY_UNLOCKED = 'vitalis.od.formUnlocked';
  var PASS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
              'campaign_id', 'adset_id', 'ad_id', 'fbclid'];
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tr(key, fallback) {
    var I = window.VITALIS_I18N;
    return I && I.t ? I.t(key, fallback) : fallback;
  }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function track(name, data) {
    var C = window.VITALIS_CORE;
    if (C && C.track) try { C.track(name, data || {}); } catch (e) {}
  }

  var lock = document.getElementById('w-lock');
  var fill = document.getElementById('w-lock-fill');
  var count = document.getElementById('w-lock-count');
  var status = document.getElementById('w-lock-status');
  var video = document.getElementById('wv');

  var watched = parseFloat(load(KEY_SECONDS)) || 0;
  var unlocked = load(KEY_UNLOCKED) === '1' || watched >= NEED;
  var mounted = false;

  document.querySelectorAll('[data-unlock-min]').forEach(function (el) {
    el.textContent = String(Math.round(NEED / 60));
  });

  function clock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }
  function paint() {
    if (fill) fill.style.width = Math.min(100, (watched / NEED) * 100).toFixed(2) + '%';
    if (count) count.textContent = tr('lock_left', '{t} left').replace('{t}', clock(NEED - watched));
  }

  function whenTypeform(cb) {
    if (window.tf && window.tf.createWidget) return cb(window.tf);
    var tries = 0;
    var iv = setInterval(function () {
      if (window.tf && window.tf.createWidget) { clearInterval(iv); cb(window.tf); }
      else if (++tries > 150) clearInterval(iv); // give up after ~15s
    }, 100);
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    whenTypeform(function (tf) {
      box.classList.remove('is-locked');
      if (lock) lock.remove();
      var holder = document.createElement('div');
      holder.className = 'w-form-tf';
      box.appendChild(holder);
      tf.createWidget(FORM_ID, {
        container: holder,
        opacity: 100,
        medium: 'snippet',
        inlineOnMobile: true,
        transitiveSearchParams: PASS,
        hidden: { lang: (video && video.getAttribute('lang')) || (window.VITALIS_I18N && window.VITALIS_I18N.lang) || 'en' },
        iframeProps: { title: tr('tf_title', 'Vitalis Tower – Floor plans & pricing') }
      });
    });
  }

  function unlock() {
    if (unlocked && mounted) return;
    unlocked = true;
    watched = Math.max(watched, NEED);
    save(KEY_UNLOCKED, '1');
    save(KEY_SECONDS, String(Math.round(watched)));
    paint();
    if (count) count.textContent = tr('lock_unlocked', 'Unlocked');
    if (lock) lock.classList.add('is-open');
    if (status) status.textContent = tr('lock_status', 'The questionnaire is unlocked.');
    track('webinar_form_unlocked', { seconds_watched: Math.round(watched) });
    setTimeout(mount, RM ? 0 : 900);
  }

  // Count real playback only.
  if (video && !unlocked) {
    var lastT = null, lastSaved = watched;
    video.addEventListener('timeupdate', function () {
      var t = video.currentTime;
      if (lastT != null && !video.paused && !unlocked) {
        var d = t - lastT;
        if (d > 0 && d < 1.5) {
          watched += d;
          if (watched - lastSaved >= 5) { save(KEY_SECONDS, watched.toFixed(1)); lastSaved = watched; }
          paint();
          if (watched >= NEED) unlock();
        }
      }
      lastT = t;
    });
    ['seeking', 'pause', 'emptied', 'loadstart', 'ended'].forEach(function (ev) {
      video.addEventListener(ev, function () {
        lastT = null;
        if (!unlocked) save(KEY_SECONDS, watched.toFixed(1));
      });
    });
  }

  // For QA / previews: window.VITALIS_FORM_GATE.unlock()
  window.VITALIS_FORM_GATE = { unlock: unlock, watched: function () { return watched; } };

  if (unlocked) mount(); else paint();
})();
