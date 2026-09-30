/* Vitalis Tower — shared webinar player + actions.
   Used by every page that plays the full webinar: the registrants' watch
   page (/webinar/pro/watch/) and the open page (/passive-income/).

     var kit = VITALIS_WATCHKIT({ variant: 'professional', shareUrl: '…' });
     kit.startPlayback();   // try sound, fall back to muted + "Tap for sound"
     kit.getLang();         // 'en' | 'es'

   · Language: the English / Español switch (ONDEMAND.VIDEOS). Start
     language: ?lang= link → saved choice → device language → default.
     Switching keeps the viewer's place proportionally (the two cuts
     differ in length), continues with sound, and is remembered.
   · Watch progress counts seconds actually played (seeks excluded),
     per language version.
   · Actions: save/share (native share sheet, or a copy / email /
     WhatsApp / text panel), the Vitalis Tower Dropbox (pending when
     unset — never a dead link), and the Vitalis Tower contact card. */
(function () {
  'use strict';

  window.VITALIS_WATCHKIT = function (opts) {
    opts = opts || {};
    var C = window.VITALIS_CORE;
    if (!C) return null;
    var CFG = C.CFG, track = C.track, $ = C.$;
    var OD = CFG.ONDEMAND || {};
    var VARIANT = opts.variant || 'professional';

    /* ==========================================================
       THE WEBINAR + LANGUAGE SWITCH
       ========================================================== */
    var video = $('wv'), soundBtn = $('w-sound'), langBox = $('w-lang');
    var VIDEOS = OD.VIDEOS || {};
    var LANGS = Object.keys(VIDEOS).filter(function (k) { return VIDEOS[k]; });
    var FULL = LANGS.length > 0;
    var LANG_KEY = 'vitalis.webinar.lang';

    function pickLang() {
      var q = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
      if (VIDEOS[q]) return q;
      try {
        var saved = localStorage.getItem(LANG_KEY);
        if (saved && VIDEOS[saved]) return saved;
      } catch (e) {}
      if ((navigator.language || '').toLowerCase().indexOf('es') === 0 && VIDEOS.es) return 'es';
      return VIDEOS[OD.DEFAULT_LANG] ? OD.DEFAULT_LANG : (LANGS[0] || '');
    }
    var lang = pickLang();

    function srcFor(l) { return VIDEOS[l] || OD.PREVIEW_URL || '/media/bernardo-preview.mp4'; }
    function paintSwitch() {
      if (!langBox) return;
      langBox.setAttribute('data-active', lang);
      langBox.querySelectorAll('.w-lang-btn').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
      });
      video.setAttribute('lang', lang || 'en');
      video.setAttribute('aria-label', 'Passive Income Webinar (' + (lang === 'es' ? 'Español' : 'English') + ')');
    }

    if (langBox && LANGS.length < 2) langBox.hidden = true; // the switch needs both versions
    video.src = srcFor(lang);
    if (OD.PREVIEW_POSTER) video.poster = OD.PREVIEW_POSTER;
    paintSwitch();

    // Progress is per language version: a switch starts a fresh count.
    var watch;
    function resetWatch() { watch = { played: 0, lastT: null, fired: {}, started: false }; }
    resetWatch();

    function setLang(next) {
      if (next === lang || !VIDEOS[next]) return;
      var ratio = video.duration ? video.currentTime / video.duration : 0;
      var from = lang;
      lang = next;
      paintSwitch();
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      resetWatch();
      video.src = srcFor(lang);
      video.addEventListener('loadedmetadata', function resume() {
        video.removeEventListener('loadedmetadata', resume);
        // Same moment in the talk. The two cuts differ in length, so the
        // position carries over proportionally rather than by timestamp.
        if (ratio > 0.01 && ratio < 0.98) {
          try { video.currentTime = ratio * video.duration; } catch (e) {}
        }
      });
      // The tap on the switch is a user gesture: continue with sound.
      video.muted = false;
      soundBtn.hidden = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      track('webinar_language_switch', {
        from: from, to: lang, at_ratio: Math.round(ratio * 100) / 100, funnel_variant: VARIANT
      });
    }
    if (langBox) langBox.querySelectorAll('.w-lang-btn').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });

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

    video.addEventListener('play', function () {
      if (watch.started) return;
      watch.started = true;
      track('webinar_play', { funnel_variant: VARIANT, full_webinar: FULL, language: lang });
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
          track('ondemand_watch_progress', { progress: m, funnel_variant: VARIANT, full_webinar: FULL, language: lang });
        }
      });
    });

    /* ==========================================================
       1 · SAVE OR SHARE THE LINK
       ========================================================== */
    var shareUrl = opts.shareUrl || OD.SHARE_URL || (location.origin + '/webinar/pro/');
    var shareText = opts.shareText || OD.SHARE_TEXT || 'Passive Income Webinar';
    var shareBtn = $('w-share'), sharePanel = $('w-share-panel'), shareSub = $('w-share-sub');

    if (shareBtn) {
      var shareSubDefault = shareSub.textContent;
      var flash = function (text) {
        shareBtn.classList.add('is-copied');
        shareSub.textContent = text;
        setTimeout(function () { shareBtn.classList.remove('is-copied'); shareSub.textContent = shareSubDefault; }, 2400);
      };
      var copyLink = function () {
        function done() { flash('Link copied ✓'); track('share_channel', { channel: 'copy', funnel_variant: VARIANT }); }
        function legacyCopy() {
          var input = $('w-share-url');
          input.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(done, legacyCopy);
        } else legacyCopy();
      };

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
    }

    /* ==========================================================
       2 · VITALIS TOWER DROPBOX
       ========================================================== */
    var db = $('w-dropbox');
    if (db) {
      if (OD.DROPBOX_URL) {
        db.href = OD.DROPBOX_URL;
        db.addEventListener('click', function () { track('dropbox_click', { funnel_variant: VARIANT }); });
      } else {
        // [VITALIS-SETUP] no link yet — visibly pending, never a dead link.
        db.removeAttribute('href');
        db.removeAttribute('target');
        db.setAttribute('role', 'link');
        db.setAttribute('aria-disabled', 'true');
        $('w-dropbox-go').textContent = 'Link pending';
      }
    }

    /* ==========================================================
       3 · SAVE OUR NUMBER (contact card)
       ========================================================== */
    var ct = $('w-contact');
    if (ct) {
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
    }

    return {
      startPlayback: startPlayback,
      getLang: function () { return lang; }
    };
  };
})();
