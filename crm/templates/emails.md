# Vitalis Tower — Email Templates

Sender: **Vitalis Tower** `events@vitalistower.com` *(verify DKIM/SPF on the
Vitalis domain before launch — [VITALIS-SETUP])*.

Merge fields used:
- `{{contact.first_name}}`
- `{{contact.webinar_session_display}}` — merged **verbatim**, never re-formatted
- `{{contact.webinar_session_iso}}` — URL-encoded into links
- `{{contact.buyer_interest}}` — for conditional blocks

Link building (replace `{ISO}` with the URL-encoded `webinar_session_iso`):
- Confirmation page: `https://vitalis.twelvecreative.io/webinar/confirmed/?session={ISO}`
- Join link: `https://vitalis.twelvecreative.io/webinar/live/?session={ISO}`
- Calendar (.ics): `https://vitalis.twelvecreative.io/webinar/confirmed/event.php?session={ISO}`
- Replay: `https://vitalis.twelvecreative.io/webinar/replay/?session={ISO}`
- Booking: `https://vitalis.twelvecreative.io/consultation/?interest={{contact.buyer_interest}}`

---

## E1 — Registration confirmation *(immediate, transactional)*
**Subject:** You're registered — {{contact.webinar_session_display}}
**Preheader:** Your access link is inside. Add it to your calendar now.

> {{contact.first_name}}, your seat is reserved.
>
> **Vitalis Tower: An Introduction to Medical Office Ownership in Aventura**
> 🗓 {{contact.webinar_session_display}} · 60 minutes · online
>
> **[Join the session]({join link})** ← save this button; it's your door in.
>
> **[Add to calendar]({.ics link})** · or use the one-tap Google/Outlook/Apple
> options on **[your confirmation page]({confirmation link})**.
>
> What you'll get in one hour: the own-vs-lease math, what a medical building
> must get right, the investor's lens on this category, and where Vitalis
> Tower fits — plus live Q&A.
>
> Can't make it after all? You'll get a replay link, and you can re-register
> for a later date anytime.
>
> — The Vitalis Tower Team
> Sales Center: 2820 NE 214th St, Suite 903, Aventura, FL 33180

## E2 — Educational pre-event *(T−3 days; skip if <3 days remain)*
**Subject:** Before Wednesday: the one number to bring
**Body theme (conditional on `buyer_interest`):**
- *practice / both:* "Find your current monthly rent and your lease renewal
  date. Bring both — during the session you'll place them into the own-vs-lease
  comparison and see, on your own numbers, what twenty years of each looks
  like." Short teaser on the 3 building features practices ask about most.
- *investment:* "Bring one question you'd ask of any income asset. Medical
  office answers it differently — tenant retention, lease length, NNN
  structures — and we'll show you how to pressure-test those claims."
End: session line `{{contact.webinar_session_display}}` + join button + calendar link.

## E3 — 24-hour reminder
**Subject:** Tomorrow: your Vitalis Tower session
> {{contact.first_name}} — quick reminder: your session runs
> **{{contact.webinar_session_display}}**.
> One hour, education first, live Q&A at the end.
> **[Join the session]({join link})** · **[Add to calendar]({.ics link})**

## E4 — 3-hour reminder
**Subject:** Tonight — doors open 10 minutes early
> The room opens shortly before start. Grab your seat, settle in, and drop
> your first question in the chat — the team answers every one.
> **[Join the session]({join link})**

## E5 — Session start *(T+0, transactional)*
**Subject:** We're live — join now
> It's on. **[Join the session]({join link})** — you've missed nothing yet.

## E6 — Attended: recap *(T+2 h)*
**Subject:** Your recap — and the door it opens
> Great having you today, {{contact.first_name}}. The three things worth
> keeping: (1) the own-vs-lease comparison only settles on *your* numbers;
> (2) clinical buildings live or die on features you can verify — ceilings,
> corridors, drop-off, parking; (3) in this district, location is the moat.
>
> The natural next step is 30 private minutes with the team —
> {{#if buyer_interest == investment}}the asset case on real inventory{{else}}your floor plan, on real availability{{/if}}.
> **[Schedule your private presentation]({booking link})**

## E7 — Engaged, didn't book *(T+2 days)*
**Subject:** Still thinking it over? Fair.
> A building you might practice in — or hold — for decades deserves a slow
> decision. The private presentation exists to speed up your *information*,
> not your decision: floor plans, availability, timeline, structure. Thirty
> minutes, no obligation. **[Pick a time]({booking link})**

## E8 — Attended, quiet *(T+3 days)*
**Subject:** One question before we file this away
> If the session left you with a "yes, but…" — that *but* is exactly what a
> private presentation is for. And if it's simply not for you, that's a
> useful answer too. **[30 minutes with the team]({booking link})** — or just
> reply and tell us what was missing.

## E9 — No-show: replay *(T+2 h, transactional access)*
**Subject:** You missed it — here's the replay
> Life happens, {{contact.first_name}}. The full session is here for the next
> 7 days: **[Watch the replay]({replay link})**
> Prefer live? **[Register for the next session](https://vitalis.twelvecreative.io/webinar/)**

## E10 — No-show: next session *(T+3 days)*
**Subject:** Your seat, re-offered
> The replay clock is running out, and the next live session is open.
> **[Watch the replay]({replay link})** · **[Grab the next date](https://vitalis.twelvecreative.io/webinar/)**

## E11 — Booking abandoned *(1 h after `booking_slot_selected` with no booking)*
**Subject:** Your time slot is still open
> You were one click from booked. The calendar's still open —
> **[finish booking your presentation]({booking link})**. If something held
> you back, reply and tell us; a human reads this inbox.

## E12 — Nurture (monthly, value-first)
Rotating themes, all from approved materials only: district anchors and what
they mean for practices; construction/delivery updates as officially released;
"ownership math" explainers; amenity deep-dives (conference & telemedicine
facilities, drop-off design, 12-ft ceilings). Every issue ends with one quiet
link to the next webinar date. No invented pricing, returns, or urgency.

## E13 — Appointment prep *(on booking, transactional)*
**Subject:** Confirmed — your Vitalis Tower presentation
> Booked. Your appointment details, meeting link or Sales Center address, and
> reschedule/cancel links are in your booking confirmation (separate email,
> from our scheduling system).
> To make the half hour count:
> {{#if buyer_interest == investment}}bring your target hold period and your
> toughest underwriting question{{else}}bring your practice type, rough square
> footage, and your lease renewal date{{/if}}.
> Meeting in person? 2820 NE 214th St, Suite 903, Aventura — visitor parking available.

## E14 — Appointment no-show rebook
**Subject:** We held your file — shall we rebook?
> We missed you today. No drama — calendars collide. Your notes are still on
> file; **[pick a new time]({booking link})** and we'll take it from there.

## E15 — Session rescheduled/canceled *(manual trigger from runbook W8)*
**Subject:** ⚠️ New date for your Vitalis Tower session
> {{contact.first_name}}, your session has moved to
> **{{contact.webinar_session_display}}** *(updated)*.
> **Important:** if you saved the earlier invite, your calendar does **not**
> update by itself — tap **[Add the new date]({.ics link})** and it will
> replace the old event. Same access link as always:
> **[Join the session]({join link})**. Sorry for the shuffle — see you there.
