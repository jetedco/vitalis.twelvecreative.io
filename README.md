# Vitalis Tower — Webinar Funnel

A complete webinar funnel for **Vitalis Tower** (Aventura Medical District),
built as a functional reproduction of the JetEdCo webinar funnel
(`landing.jetedco.com`, audited in full from its source), re-strategized for
a medical/professional office real-estate education → private-presentation
sales journey. Brand, imagery, and approved facts come from the official
brochure *Vitalis_Tower_Brochure_English_P8_V5*.

## The journey

```
Ad / referral (UTMs captured, 90-day first-touch)
   └▶ /webinar/                 registration (interest: practice / investment / both)
        └▶ /webinar/confirmed/  confirmation · 5 calendar actions · timed early-booking unlock
             └▶ /webinar/live/  session room · wall-clock video · chat · mid-session booking CTA
                  ├▶ /consultation/            booking (interest-adapted)
                  │    └▶ /consultation/confirmed/
                  └▶ /webinar/replay/          replay window · expiry · next steps
CRM (GoHighLevel, Vitalis location): /crm/README.md + /crm/templates/
```

Supported off-path states: registered-but-absent (replay + next-session),
attended-no-booking (recap path), CTA-without-booking (abandoned-booking
follow-up), booked, replay-watched, future-session re-registration,
unsubscribed (CRM suppression) — see `/crm/README.md` W1–W8.

## Layout

| Path | Purpose |
|---|---|
| `config/funnel.js` | **Single source of truth** — schedule, event, access, booking, GHL, analytics. All admin knobs. |
| `config/funnel.php` | Server twin (ICS + chat admin key). |
| `js/core.js` | Shared engine: DST-safe ET session clock, calendar links, attribution reads, motion system. |
| `js/attribution.js` | 90-day first-touch UTM/click-id capture + outbound link decoration. |
| `css/brand.css` / `css/site.css` | Brand tokens (brochure palette: gold `#C2A264`, cream `#F2ECDF`, charcoal, Montserrat) + shared components. |
| `webinar/` | Registration page. |
| `webinar/confirmed/` (+ `event.php`) | Confirmation, calendar suite, timed booking unlock. |
| `webinar/live/` (+ `chat.php`, `presence.php`, `admin/`) | Session room, moderated chat, real presence, chat console. |
| `webinar/replay/` | Replay with availability window + expiry. |
| `consultation/` + `consultation/confirmed/` | Booking + appointment confirmation. |
| `crm/` | GHL fields/tags/pipeline/workflow spec + full email & SMS templates. |
| `images/` | Web-optimized brochure renders + gold logo + favicon/OG. |
| `.github/workflows/deploy.yml` | FTP deploy (Vitalis secrets required). |

## Hosting

Two modes, same repo:
- **GitHub Pages (current):** served from `main` at **https://vitalis.twelvecreative.io**
  (`CNAME` + `.nojekyll` in root). Static-only — the three PHP endpoints don't
  run, and the funnel degrades honestly: the Apple calendar button detects the
  missing `event.php` and serves a client-built `.ics` instead, and the live-room
  chat announces that messages aren't reaching the team. DNS: a `CNAME` record
  `vitalis → jetedco.github.io` at name.com (twelvecreative.io's DNS).
- **PHP host (launch):** configure the FTP secrets and the `deploy.yml` workflow
  takes over (it skips itself while the secrets are absent). This enables
  `event.php` (iOS-native calendar), `chat.php`, and `presence.php`, and the
  server-side `CHAT_ADMIN_KEY` must be set (the committed placeholder refuses
  all admin reads).

Local preview: `node .claude/serve.js` → http://localhost:8123 (same static
behavior as Pages).

Tests: `node tests/test-session.js` — 24/24 passing, covering DST
fall-back/spring-forward instants, cutoff rollover, canceled/special
sessions, running-session windows, ICS UID stability, and calendar-link
correctness.

---

## 1 · JetEdCo mechanics reproduced (verified against source)

- DST-safe weekly session engine via `Intl` (same two-pass `etInstant` math), single source of truth for every rendered date, the submitted ISO, countdowns, and calendar links.
- Registration → GHL inbound-webhook POST with query-string identity duplication + no-cors fallback, 20 s abort timeout, honeypot, per-field validation with live clearing, busy-state submit button as the retry, success **only** on acknowledged response, ET-calendar-day + pre-formatted display fields (the "September 4 texts for a September 3 webinar" fix carried over).
- Cutoff-aware rollover (page re-renders at cutoff; re-render immediately before submit so nobody registers into a closed session).
- Confirmation page driven by `?session=` — never recalculated after the public page rolls forward.
- Calendar actions: Google (mobile `/r/eventedit` deep-link vs desktop template), Outlook deeplink, served `.ics` via PHP with iOS inline disposition, stable per-session UID, 30-min alarm.
- Timed booking unlock with persisted arrival (refresh-proof), confetti, Calendly postMessage funnel (`slot_selected` → `event_scheduled` as the only conversion) with origin anchoring.
- Live room: wall-clock-locked playback (late joiners synced, pause played over, background-tab resync), pre/live/post phase machine, grace window, automatic weekly rollover, 2-minute preload, tap-for-sound, mid-session CTA unlock with clock-time preview, ended-slate messaging.
- Moderated send-only chat (ndjson storage, admin-key console with day selector, sms: links, broadcast timestamps), presence heartbeats (sendBeacon, per-tab ids, strict id shape), `.htaccess`-blocked data dir.
- First-touch attribution (90-day, both tag dialects, cookie + localStorage, outbound decoration, `fbp`/`fbc` capture) and the full dataLayer event vocabulary (page views, form start, registration complete/failed, calendar_add per type, join clicks, phases, unlocks, booking funnel).
- Deploy pattern (FTP action + HTML no-cache `.htaccess`), config-block architecture, motion system (reveals, marquee, countdowns, sticky mobile CTA, hero animation layer).

## 2 · Mechanics adapted for Vitalis (and why)

| JetEdCo | Vitalis | Why |
|---|---|---|
| Partner-recruiting narrative, Jordan/Carlos bios, income-opportunity framing, aviation testimonials, employment disclaimers | Property-education narrative for owner-users + investors; presenter = sales team (Fortune Development Sales) pending named-presenter approval | Brief §2/§3 — nothing JetEdCo-specific carried over |
| Simulated "watching" counter shaped by a curve | **Real** presence count (public `presence.php?count=1`), shown only above a configurable floor, off by default | Brief §8 — no manufactured attendance |
| Typeform application → Calendly | Direct booking embed (GHL calendar or Calendly), interest-adapted qualification handled by the booking form | Brief §11 — concise qualification, no long questionnaire |
| Zoom join URL hard-coded in 3 files | Central `ACCESS` config: own room or external URL | Brief §13 — one authoritative source |
| Per-page CONFIG blocks (duplicated session math ×3) | One `config/funnel.js` + shared `js/core.js` | Same behavior, one place to administer |
| 3 calendar options | 5 (adds Microsoft 365 + universal `.ics` download) | Brief §7 |
| "Watch before we go live" 3-secrets page | Replay page with availability window/expiry/state machine | Brief §10 — replay journey was the required equivalent |
| Implied SMS consent via footer text | Explicit SMS opt-in checkbox → `sms_consent` field gating all SMS | Brief §5/§9 — channel consent |
| No duplicate-registration UX | Already-registered recovery card (view confirmation / re-register) | Brief §5 |
| Blue/Satoshi brand, plane motif | Gold/cream/charcoal, Montserrat, brochure renders, EKG-to-skyline pulse line, palm-shadow drift | Brochure aesthetics ("visual spectacle") |

## 3 · Additional requirements implemented from the brief

- Interest selector (practice / investment / both) flowing through registration → confirmation copy → live-room CTA → booking page → CRM field, with distinct owner-user vs investor messaging at every step.
- Local-time echo alongside ET wherever the session shows.
- Cancel/reschedule support: `CANCELED_DATES` + `SPECIAL_SESSIONS` in config, plus the CRM runbook (W8) covering the ".ics doesn't auto-update" caveat.
- Honest replay measurement (seconds actually played; seeking never counts) and live watch-progress milestones as the attendance basis, recorded with `attendance_basis`.
- Complete CRM blueprint: fields, tags, pipeline, 8 workflows (incl. late-registrant gating — every reminder step conditioned on "session still in future"), suppression rules, capacity enforcement, conversion dedup via shared `event_id`, no-PII-in-analytics rule.
- Full Vitalis message library: 15 emails + 8 SMS, written out (not placeholders), with owner/investor conditionals.
- Explicit "not connected" states for every unconfigured integration (registration, booking, broadcast, replay) — nothing simulated.

## 4 · Source features that could not be verified

- **GHL/GTM/Zoom/Calendly/Vidalytics account internals** — the JetEdCo funnel's server-side workflows, GTM container tags, Zoom meeting settings, and Vidalytics analytics live in third-party accounts I had no access to. Their *browser-visible contracts* (endpoints, payloads, events) were reproduced from source; the account-side halves are specified in `/crm/README.md` for rebuild in the Vitalis accounts. Exact parity with JetEdCo's account-side automation cannot be verified.
- JetEdCo's paid-checkout/partner/press/channel-landing pages exist in the source but serve the partner-program business, not the webinar journey — deliberately excluded (JetEdCo-specific purpose). Channel-specific ad entry points for Vitalis are handled by UTMs + first-touch capture instead of per-channel page copies.
- PHP endpoints were code-reviewed and pattern-matched to the working JetEdCo originals but not executed locally (no PHP on this machine) — smoke-test `event.php`, `chat.php`, `presence.php` on the real host at deploy.

## 5 · Exact assets & settings still required for launch

Search the repo for **`[VITALIS-SETUP]`** — every item is marked in place.

1. `GHL.WEBHOOK_URL` (or `FORM_ID` + `LOCATION_ID`) from the new **Vitalis** GHL location, after building `/crm/README.md` §1–4 (fields, tags, workflows W1–W8, templates).
2. `BOOKING.URL` + `PROVIDER` — the Vitalis sales calendar (GHL calendar or Calendly), with its booking-confirmed redirect set to `/consultation/confirmed/`, owner round-robin, and reschedule/cancel emails enabled.
3. `ANALYTICS.GTM_SRC` + `GTM_ID` — a Vitalis GTM container (web or server-side) with Meta pixel + CAPI (shared `event_id` dedup) and GA4 mapped to the dataLayer events.
4. `LIVE.VIDEO_URL` + `DURATION_MINUTES` — the produced webinar master (mp4); `REPLAY.VIDEO_URL`; optional `PREVIEW.VIDEO_URL`.
5. `PROJECT.DOMAIN` (final hosting domain), `PROJECT.CONTACT_EMAIL`/`PHONE`, `CALENDAR.ORGANIZER_EMAIL` (real monitored mailbox), privacy-policy URL (two `data-placeholder="privacy-url"` links).
6. Schedule sign-off: default is **Wednesdays 7:00 PM ET** — confirm with the sales team (`SCHEDULE`).
7. `CHAT_ADMIN_KEY` regenerated in `config/funnel.php`; FTP secrets in the GitHub repo (Vitalis hosting account).
8. Approved-claims review of all copy (pages + `/crm/templates/`) by the developer/sales team, incl. presenter naming.
9. **Naming flag:** all current materials (brochure V5, vitalistower.com, @vitalistoweraventura) say *Vitalis Tower*; earlier context mentioned a rebrand to *Avitera Tower*. If the rebrand lands, `PROJECT.NAME` + logo assets + domain are the only required changes — do **not** mix names.

## Verification performed

- 24/24 unit tests on the session engine (DST fall-back & spring-forward instants and wall-times, cutoff rollover, cancels, specials, running-window logic, ICS UID stability, link params, display formats).
- Browser walkthrough of all 7 pages (desktop + 375 px mobile): registration validation/error/success (stubbed webhook) → confirmation redirect with session+interest; duplicate-registration recovery card and its "register again" path; all five calendar links built from the same instant; `.ics` blob content; live-now flip gating; timed unlock countdown → embed with attribution + interest params + `booking_unlocked` event; live room pre/live/post/rollover phases incl. honest "Broadcast Not Armed" slate; replay available/expired/upcoming/none states with window math; consultation interest adaptation + real Calendly embed; admin key gate; root redirect; no horizontal scroll on mobile; zero console errors.
- Fixed during verification: announce-bar stacking, `[hidden]` vs display rules (live-now link), palm-texture overflow on mobile.
