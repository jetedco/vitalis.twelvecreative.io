# Vitalis Tower — CRM Configuration (GoHighLevel)

Everything the funnel expects from the CRM side, in one place. This is a
**dedicated Vitalis GHL sub-account (location)** — no Vitalis contact, tag,
workflow, calendar, or sender identity may live in, or reference, the
JetEdCo location. The two businesses share code, never data.

> **Status:** the funnel's browser side is built and pointed at
> `/config/funnel.js → GHL.*`, which is empty until the Vitalis location
> exists. Until those IDs are filled in, the registration form shows an
> explicit "not connected" error instead of pretending to submit.

---

## 1. Custom fields (create on Contact, keys verbatim)

| Field key | Type | Written by | Purpose |
|---|---|---|---|
| `webinar_session_date` | Date | form submit | Registrant's session, **ET calendar day** (MM-DD-YYYY). Drives day-of reminder triggers. Never format from ISO — 7 PM ET is past midnight UTC and shifts the day. |
| `webinar_session_display` | Text | form submit | Pre-formatted ET text, e.g. "Wednesday, October 14 at 7:00 PM EDT". **Merge this verbatim** into every email/SMS — never re-format the date field. |
| `webinar_session_iso` | Text | form submit | Exact instant (ISO 8601 UTC). Builds `?session=` links: confirmation, live room, replay. |
| `buyer_interest` | Dropdown: practice / investment / both | form submit | Owner-user vs investor segmentation for every message and for sales routing. |
| `sms_consent` | Dropdown: yes / no | form submit | Explicit SMS opt-in. **No SMS ever sends when `no`.** |
| `webinar_attendance` | Dropdown: registered / joined / attended / no-show | workflows (below) | Current status for the registrant's session. |
| `attendance_basis` | Text | workflows | *How* attendance was determined (e.g. `join-click`, `watch-30min`, `manual`). Never claim more than the basis supports. |
| `replay_activity` | Dropdown: none / opened / watched | workflows | From replay email clicks + `replay_progress` events. |
| `booking_status` | Dropdown: none / started / booked / completed / no-show / canceled | workflows + calendar | Sales appointment state (separate from the webinar). |
| `assigned_owner` | User | routing workflow | Vitalis sales owner. |

Contact identity stays separate from session registrations: a re-registration
**updates** the session fields on the same contact (GHL dedupes by email) and
re-enrolls the reminder workflow — it must never create a second contact.
Past sessions are preserved as notes by the intake workflow (step 2 below).

## 2. Tags

`vitalis-webinar-registrant` · `vitalis-attended` · `vitalis-no-show` ·
`vitalis-replay-watched` · `vitalis-booked` · `vitalis-booking-abandoned` ·
`vitalis-nurture` · `interest-practice` / `interest-investment` / `interest-both`

Tags are applied **inside GHL workflows**, never posted from the browser
(a posted tag can be spoofed).

## 3. Pipeline: "Vitalis Tower — Webinar Funnel"

Stages: **Registered → Attended → Engaged (CTA click) → Booking Started →
Presentation Booked → Presentation Held → Negotiation → Won / Lost / Nurture**

## 4. Workflows

### W1 — Webinar Registration Intake  *(trigger: inbound webhook)*
The registration form POSTs to this workflow's inbound-webhook URL
(paste it into `GHL.WEBHOOK_URL` in `/config/funnel.js`).
1. Create/update contact; map all fields incl. UTMs (`utm_source`, `utm_medium`,
   `utm_campaign`, `campaign_id`, `utm_content`, `fbclid`, `gclid`, `fbp`, `fbc`,
   `first_touch_page`, `first_touch_at`) into attribution fields.
2. If `webinar_session_date` already had a different value: add a contact note
   "Previously registered for {{old value}}" (session history), then overwrite.
3. Tag `vitalis-webinar-registrant` + `interest-…`; set `webinar_attendance=registered`.
4. Send **E1 confirmation email** immediately; if `sms_consent=yes`, send **S1**.
5. Enroll in W2. Remove from W5/W6 (a re-registration cancels stale follow-up).

### W2 — Session Reminders  *(re-entry allowed; keyed to `webinar_session_date`)*
Every send is gated: **only if the session is still in the future** — a wait-until
condition per step, so late registrants never receive a stale backlog, and a
changed `webinar_session_date` (reschedule/re-registration) restarts cleanly.
| When | Email | SMS (only `sms_consent=yes`) |
|---|---|---|
| T−3 days (skip if registered later) | E2 educational | — |
| T−24 h | E3 | S2 |
| T−3 h | E4 | — |
| T−15 min | — | S3 |
| T+0 (start) | E5 "we're live" | S4 |
Duplicate protection: GHL "allow re-entry only after exit" + each step's
wait-until; a contact can never hold two reminder tracks at once.

### W3 — Attendance Marking
- **Join click:** the confirmation/live pages fire `webinar_join_click` and the
  live room fires `webinar_watch_progress` (5/15/30/45 min) into GTM. Feed
  these back via a GTM server-side webhook → GHL inbound webhook, or nightly
  CSV if the provider exports attendance.
  - `webinar_join_click` → `webinar_attendance=joined`, `attendance_basis=join-click`
  - `webinar_watch_progress ≥ 30` → `webinar_attendance=attended`, `attendance_basis=watch-30min`, tag `vitalis-attended`
- **T+2 h after session:** anyone still `registered` → `no-show`, tag `vitalis-no-show`.
- A join click alone is **never** reported as attendance — the basis field says
  exactly what we know.

### W4 — Post-Session Paths *(trigger: T+2 h, branch on status/tags)*
| Segment | Sequence |
|---|---|
| Attended + booked | → W7 (appointment prep) only |
| Attended, CTA clicked, no booking | E6 recap+invite (T+2 h), E7 (T+2 d), S5 if consented (T+1 d) |
| Attended, no CTA activity | E6 recap (T+2 h), E8 next-step (T+3 d) |
| No-show | E9 replay (T+2 h), E10 next-session (T+3 d), S6 if consented (T+1 d) |
| Replay watched (from `replay_progress ≥ 50%`) | tag `vitalis-replay-watched` → E7 invite |
| No engagement after sequence | tag `vitalis-nurture` → W8 |

### W5 — Booking Abandoned
Trigger: `booking_slot_selected` fired (via GTM feedback) but no appointment
created within 1 h → tag `vitalis-booking-abandoned`, `booking_status=started`
→ E11 (1 h), S7 if consented (next morning).
**Exit immediately when an appointment is created** — a booked contact must
never receive an incomplete-booking message.

### W6 — Longer Nurture *(monthly, value-first)*
E12 series: district updates, ownership education, delivery-timeline updates.
Exit on any booking or reply. Only approved project claims — nothing invented.

### W7 — Appointment Booked *(trigger: appointment created on the Vitalis calendar)*
1. `booking_status=booked`, tag `vitalis-booked`; stop W2 promos, W4, W5, W6.
2. Route: assign owner by round-robin — configure separate round-robins per
   `buyer_interest` if the team splits owner-user vs investor coverage; set
   `assigned_owner`; internal notification to that owner with full context
   (interest, session, attendance, attribution).
3. E13 prep email + S8 if consented; provider handles its own reminders +
   reschedule/cancel links. The sales appointment is a **separate calendar
   event** from the webinar — never reuse the webinar event content.
4. No-show on appointment → `booking_status=no-show` → E14 rebook.

### W8 — Cancel / Reschedule runbook (a session is canceled or moved)
1. Add the ET date to `SCHEDULE.CANCELED_DATES` in `/config/funnel.js`
   (+ a `SPECIAL_SESSIONS` entry if it moved) and deploy — pages,
   countdowns, and new calendar links update everywhere at once.
2. In GHL: find contacts with that `webinar_session_date` → send E15
   (reschedule notice; new date + new calendar links), update their session
   fields, re-enroll W2.
3. **Calendar caveat:** downloaded .ics invites do NOT auto-update on
   attendees' calendars. E15 must say so explicitly and lead with the new
   add-to-calendar links (the funnel's stable per-session UID means saving
   the new invite replaces the old one in most clients).
4. Unsubscribed/canceled contacts are excluded automatically (suppression).

## 5. Compliance
- Transactional (confirmation, access, reminders) vs promotional (nurture,
  invitations) stay in separate GHL categories; unsubscribe applies to
  promotional immediately and suppresses W4/W5/W6.
- SMS only with `sms_consent=yes`; STOP handling is GHL-native; quiet hours
  8 am–9 pm ET on promo SMS.
- Sender identities: a Vitalis domain email (e.g. `events@vitalistower.com`,
  DKIM/SPF verified in the Vitalis location) and a Vitalis-provisioned SMS
  number. **Never JetEdCo senders.**

## 6. Attribution & conversion dedup
- Browser events (GTM dataLayer) and CRM records both carry the same UTM set;
  the CRM record is authoritative for people, GTM/CAPI for ad platforms.
- For Meta: browser pixel events and server (CAPI) events must share an
  `event_id` (configure in GTM server container) so Meta deduplicates.
  `fbp`/`fbc` are posted with registration for match quality.
- Never put email/phone/names in analytics URLs or event labels — the funnel
  code already follows this; keep it true in GTM tag config.
- Integration failures: the registration form surfaces failures to the
  visitor with a retry (nothing silently lost). On the CRM side, add a
  GHL workflow error notification to the admin email for W1 failures.

## 7. Session capacity (if used)
The browser can't know the registrant count. If `SCHEDULE.CAPACITY` is set,
enforce in W1: count contacts with the same `webinar_session_date`; if at
capacity, branch — register for the following session instead and say so in
a modified confirmation (E1-alt).

## 8. Message templates
All email copy: `templates/emails.md` · all SMS copy: `templates/sms.md`.
Templates merge `{{contact.webinar_session_display}}` verbatim and build links
from `{{contact.webinar_session_iso}}` — never re-format dates in GHL.
