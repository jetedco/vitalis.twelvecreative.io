/* Vitalis Tower — Session Room.

   The broadcast is a scheduled video played against the wall clock:
   playback position is always (now − session start), so everyone —
   including late joiners — sees the same moment, with no scrubber and
   no pause. The session instant comes from ?session=<ISO> (email links)
   or falls back to the configured schedule, DST-safe via core.js.

   Room timeline:
     T−…       countdown overlay, chat open
     T+0       video starts (muted until first tap)
     T+UNLOCK  the private-presentation booking opens under the player
     T+DUR     ended slate; booking stays open for the grace window
     later     the room rolls to the next scheduled session on its own

   Honesty rules (differences from the JetEdCo reference on purpose):
     · The "in the room" counter shows the REAL presence count from
       presence.php, and only when LIVE.SHOW_PRESENCE is on and the count
       clears LIVE.PRESENCE_MIN. Nothing on this page simulates people.
     · With no VIDEO_URL configured the room says so plainly.

   Chat is send-only for attendees: messages POST to chat.php and appear
   in the sender's own feed; the full feed is visible only on the
   key-protected admin console (/webinar/live/admin/). */
(function () {
  'use strict';
  var C = window.VITALIS_CORE;
  if (!C) return;
  var CFG = C.CFG, track = C.track, pixel = C.pixel, $ = C.$;
  var L = CFG.LIVE || {};

  var CHAT_ENDPOINT = '/webinar/live/chat.php';
  var PRESENCE_ENDPOINT = '/webinar/live/presence.php';
  var PRESENCE_MS = 15000;

  function roomWindowMs() {
    return ((L.DURATION_MINUTES || 60) + (L.GRACE_MINUTES || 30)) * 60000;
  }

  var state = {
    session: C.sessionFromParam(roomWindowMs()) || C.sessionWithin(new Date(), roomWindowMs()),
    phase: '',          // 'pre' | 'live' | 'post'
    unlocked: false,
    videoArmed: false,
    soundOn: false,
    timer: 0
  };

  function elapsedSec() { return (Date.now() - state.session.getTime()) / 1000; }

  function fmtSession() { return C.sessionShort(state.session); }
  function fmtUnlockClock() {
    var at = new Date(state.session.getTime() + (L.UNLOCK_MINUTES || 40) * 60000);
    var p = C.partsET(at, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    return p.hour + ':' + p.minute + ' ' + p.dayPeriod + ' ' + p.timeZoneName;
  }

  /* ==========================================================
     VIDEO — wall-clock-locked playback
     ========================================================== */
  var video = $('live-video');

  function armVideo() {
    if (state.videoArmed) return;
    state.videoArmed = true;
    if (!L.VIDEO_URL) return; // "not armed" slate handled in goLive()
    video.src = L.VIDEO_URL;
    video.preload = 'auto';
    video.load();
  }

  function syncVideo(force) {
    if (!L.VIDEO_URL || state.phase !== 'live') return;
    var target = elapsedSec();
    if (target < 0) return;
    if (video.readyState >= 1 && video.duration && target >= video.duration) return;
    if (force || Math.abs(video.currentTime - target) > 4) {
      try { video.currentTime = target; } catch (e) {}
    }
    if (video.paused) {
      var p = video.play();
      if (p && p.catch) p.catch(function () { $('overlay-sound').hidden = false; });
    }
  }

  function goLive() {
    armVideo();
    $('overlay-pre').hidden = true;
    $('overlay-post').hidden = true;
    $('live-pill').hidden = false;

    if (!L.VIDEO_URL) {
      // [VITALIS-SETUP] nothing to play — say so explicitly, never fake it.
      var post = $('overlay-post');
      post.hidden = false;
      post.querySelector('.overlay-title').textContent = 'Broadcast Not Armed';
      $('post-note').textContent = 'Set LIVE.VIDEO_URL in /config/funnel.js to arm this session.';
      return;
    }

    video.muted = !state.soundOn;
    syncVideo(true);
    if (!state.soundOn) $('overlay-sound').hidden = false;
  }

  // The stream never pauses. Any pause that isn't ours gets played over,
  // re-synced to the clock so a backgrounded tab can't fall behind.
  video.addEventListener('pause', function () {
    if (state.phase === 'live' && !video.ended) syncVideo(true);
  });
  video.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) syncVideo(true);
  });
  setInterval(function () { syncVideo(false); }, 10000);

  $('overlay-sound').addEventListener('click', function () {
    state.soundOn = true;
    video.muted = false;
    $('overlay-sound').hidden = true;
    syncVideo(true);
    track('live_sound_on');
  });

  // Watched-progress milestones — the honest basis for "attended":
  // milestones fire only while the clock-synced video is actually playing.
  var progressFired = {};
  setInterval(function () {
    if (state.phase !== 'live' || !L.VIDEO_URL || video.paused) return;
    var mins = Math.floor(elapsedSec() / 60);
    [5, 15, 30, 45].forEach(function (m) {
      if (mins >= m && !progressFired[m]) {
        progressFired[m] = true;
        track('webinar_watch_progress', { minutes: m, webinar_session: state.session.toISOString() });
      }
    });
  }, 30000);

  /* ==========================================================
     PHASES — pre → live → post → (rolls to next session)
     ========================================================== */
  function setPhase(phase) {
    if (state.phase === phase) return;
    state.phase = phase;
    track('live_room_phase', { room_phase: phase });

    $('overlay-pre').hidden = true;
    $('overlay-sound').hidden = true;
    $('overlay-post').hidden = true;
    $('live-pill').hidden = true;

    if (phase === 'pre') {
      $('overlay-pre').hidden = false;
      $('pre-date').textContent = fmtSession();
      lockBooking();
    }
    if (phase === 'live') {
      goLive();
      chatSystem('The session is underway — welcome in! 🏛️');
    }
    if (phase === 'post') {
      try { video.pause(); } catch (e) {}
      video.removeAttribute('src');
      $('overlay-post').hidden = false;
      if (state.unlocked) {
        $('post-note').textContent = 'The booking calendar below is still open — grab a time before you go.';
      }
    }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function tick() {
    var now = Date.now();
    var start = state.session.getTime();
    var endMs = start + (L.DURATION_MINUTES || 60) * 60000;
    var closeMs = start + roomWindowMs();

    if (now >= closeMs) {
      // Grace window over — roll to the next scheduled session.
      state.session = C.sessionWithin(new Date(), roomWindowMs());
      state.unlocked = false;
      state.videoArmed = false;
      state.phase = '';
      progressFired = {};
      setPhase('pre');
    } else if (now >= endMs) {
      if (!state.unlocked) unlockBooking(); // late arrivals still get the CTA
      setPhase('post');
    } else if (now >= start) {
      setPhase('live');
      if (!state.unlocked && elapsedSec() >= (L.UNLOCK_MINUTES || 40) * 60) unlockBooking();
    } else {
      setPhase('pre');
      var t = Math.floor((start - now) / 1000);
      var box = $('countdown');
      box.querySelector('[data-count="d"]').textContent = Math.floor(t / 86400);
      box.querySelector('[data-count="h"]').textContent = pad(Math.floor(t % 86400 / 3600));
      box.querySelector('[data-count="m"]').textContent = pad(Math.floor(t % 3600 / 60));
      box.querySelector('[data-count="s"]').textContent = pad(t % 60);
      if (t <= 120) armVideo(); // preload in the final stretch
    }

    state.timer = setTimeout(tick, 1000);
  }

  /* ==========================================================
     BOOKING — locked card until T+UNLOCK, then the Vitalis
     sales calendar embeds right under the player.
     ========================================================== */
  function lockBooking() {
    $('book-locked').hidden = false;
    $('book-open').hidden = true;
    $('book-locked-note').textContent =
      'The booking calendar unlocks live, during the session — around ' + fmtUnlockClock() + '.';
  }

  function interestContext() {
    var reg = C.getRegistration();
    return (reg && reg.interest) || '';
  }

  function unlockBooking() {
    if (state.unlocked) return;
    state.unlocked = true;
    $('book-locked').hidden = true;
    $('book-open').hidden = false;

    var interest = interestContext();
    if (interest === 'investment') {
      $('book-open-title').textContent = 'Discuss the Investment Case';
      $('book-open-lede').textContent = 'A one-on-one with the sales team — tenant strategy, lease structures, and the numbers behind medical office assets. Pick any time that works.';
    } else if (interest === 'practice') {
      $('book-open-title').textContent = 'Discuss Your Office Needs';
      $('book-open-lede').textContent = 'A one-on-one with the sales team — your practice, your space needs, floor plans, and current availability. Pick any time that works.';
    }

    renderBookingEmbed(interest);
    chatSystem('🔓 Private presentation booking just opened — it’s right under the video.');
    track('cta_unlocked', { cta: 'live-booking', buyer_interest: interest || 'unknown' });
    pixel('LiveBookingUnlocked', {}, true);
  }

  function renderBookingEmbed(interest) {
    var mount = $('book-embed');
    var B = CFG.BOOKING || {};
    if (!B.URL) {
      // [VITALIS-SETUP] no Vitalis sales calendar configured yet.
      mount.querySelector('.book-loading').innerHTML =
        '<p>The booking calendar isn’t connected yet.<br><small>Set BOOKING.URL in /config/funnel.js — see the launch checklist.</small></p>';
      return;
    }
    var url = B.URL;
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    if (B.PROVIDER === 'calendly') {
      url += sep + 'embed_domain=' + encodeURIComponent(location.hostname) +
        '&embed_type=Inline&hide_gdpr_banner=1';
      sep = '&';
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
      var loading = mount.querySelector('.book-loading');
      if (loading) loading.remove();
    });
    mount.appendChild(iframe);
    track('booking_embed_view', { booking_source: 'live-room' });

    var interacted = false, booked = false;
    window.addEventListener('message', function (e) {
      var name = e.data && e.data.event;
      if (!name) return;
      if (!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin || '')) return;
      if (name === 'calendly.date_and_time_selected' && !interacted) {
        interacted = true;
        track('booking_slot_selected', { booking_source: 'live-room' });
      }
      if (name === 'calendly.event_scheduled' && !booked) {
        booked = true;
        track('presentation_booked', { booking_source: 'live-room' }); // PRIMARY CONVERSION
        pixel('Schedule', { content_name: 'vitalis-webinar-live' });
      }
    });
  }

  /* ==========================================================
     CHAT — send-only for attendees; feed lives on the admin console
     ========================================================== */
  var NAME_KEY = 'vitalis.live.chatName';
  var PHONE_KEY = 'vitalis.live.chatPhone';

  function chatName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function chatPhone() { try { return localStorage.getItem(PHONE_KEY) || ''; } catch (e) { return ''; } }

  function feedAdd(node) {
    var feed = $('chat-feed');
    var pinned = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
    feed.appendChild(node);
    if (pinned) feed.scrollTop = feed.scrollHeight;
  }
  function chatSystem(text) {
    var div = document.createElement('div');
    div.className = 'msg msg-system';
    var p = document.createElement('p');
    p.textContent = text;
    div.appendChild(p);
    feedAdd(div);
  }
  function chatMine(name, text) {
    var div = document.createElement('div');
    div.className = 'msg msg-mine';
    var n = document.createElement('span');
    n.className = 'msg-name'; n.textContent = name;
    var p = document.createElement('p'); p.textContent = text;
    div.appendChild(n); div.appendChild(p);
    feedAdd(div);
  }

  function liveMark() {
    var s = Math.max(0, Math.floor(elapsedSec()));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  var chatDown = false;
  function chatUnavailable() {
    // Honesty over silence: on a host without the PHP endpoints (static
    // preview), say once that messages aren't reaching the team.
    if (chatDown) return;
    chatDown = true;
    chatSystem('⚠️ Chat isn’t connected on this host yet — messages here don’t reach the team. Use the contact details in your confirmation email instead.');
  }

  function postChat(name, text, phone) {
    var payload = {
      name: name,
      phone: phone || chatPhone(),
      text: text,
      at: state.phase === 'live' ? liveMark() : state.phase,
      session: state.session.toISOString()
    };
    try {
      fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function (res) {
        if (!res.ok) chatUnavailable();
      }).catch(function () { chatUnavailable(); });
    } catch (e) { chatUnavailable(); }
  }

  function setupChat() {
    var joinBox = $('chat-join');
    var compose = $('chat-compose');
    var nameInput = $('chat-name');
    var phoneInput = $('chat-phone');
    var input = $('chat-input');
    var joinErr = $('chat-join-err');

    function showErr(msg) { joinErr.textContent = msg; joinErr.hidden = false; }
    function joined() { joinBox.hidden = true; compose.hidden = false; input.focus(); }

    function join() {
      var name = nameInput.value.trim().slice(0, 40);
      var phone = phoneInput.value.trim().slice(0, 24);
      var digits = phone.replace(/\D/g, '');
      if (!name) { showErr('Add your first name.'); nameInput.focus(); return; }
      if (digits.length < 7) { showErr('Add your mobile number so the team can text you the answer.'); phoneInput.focus(); return; }
      joinErr.hidden = true;
      try {
        localStorage.setItem(NAME_KEY, name);
        localStorage.setItem(PHONE_KEY, phone);
      } catch (e) {}
      postChat(name, 'joined the chat', phone);
      chatSystem('You’re in, ' + name + ' 👋 Ask away — the team is reading every message.');
      track('chat_join');
      joined();
    }

    function send() {
      var text = input.value.trim().slice(0, 280);
      if (!text) return;
      input.value = '';
      var name = chatName() || 'Guest';
      chatMine(name, text);
      postChat(name, text, chatPhone());
      track('chat_message_sent');
    }

    $('chat-join-btn').addEventListener('click', join);
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') phoneInput.focus(); });
    phoneInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
    $('chat-send').addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

    if (chatName() && chatPhone()) joined();
  }

  /* ==========================================================
     PRESENCE — per-tab heartbeat in, REAL count out.
     The header counter renders only when SHOW_PRESENCE is on
     and the real count clears PRESENCE_MIN.
     ========================================================== */
  function presenceId() {
    var k = 'vitalis.live.pid';
    try {
      var v = sessionStorage.getItem(k);
      if (!v) {
        v = (Date.now().toString(36) + Math.random().toString(36).slice(2))
          .replace(/[^a-z0-9]/gi, '').slice(0, 32);
        if (v.length < 8) v = ('pid' + v + '00000000').slice(0, 16);
        sessionStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return ('pid' + Math.random().toString(36).slice(2) + '00000000').slice(0, 16);
    }
  }

  function startPresence() {
    var id = presenceId();
    function ping() {
      try {
        var body = JSON.stringify({ id: id });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(PRESENCE_ENDPOINT, new Blob([body], { type: 'application/json' }));
        } else {
          fetch(PRESENCE_ENDPOINT, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: body, keepalive: true
          }).catch(function () {});
        }
      } catch (e) {}
    }
    ping();
    setInterval(ping, PRESENCE_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) ping();
    });

    if (!L.SHOW_PRESENCE) return;
    function poll() {
      fetch(PRESENCE_ENDPOINT + '?count=1', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var n = d && d.count;
          var box = $('watching');
          if (typeof n === 'number' && n >= (L.PRESENCE_MIN || 1)) {
            box.hidden = false;
            $('watching-num').textContent = n.toLocaleString('en-US');
            $('watching-label').textContent = state.phase === 'live' ? 'watching now' : 'in the room';
          } else {
            box.hidden = true;
          }
        })
        .catch(function () { $('watching').hidden = true; });
    }
    poll();
    setInterval(poll, 20000);
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  lockBooking();
  setupChat();
  startPresence();
  tick();
  C.fillYear();
  C.fillPresenter();

  track('funnel_page_view', { funnel_page: 'webinar-live' });
  track('view_content', { content_name: 'webinar-live' });
  pixel('ViewContent', { content_name: 'webinar-live' });
})();
