# Vitalis Tower — SMS Templates

Send **only** when `sms_consent = yes`. Sender: the Vitalis-provisioned
number ([VITALIS-SETUP] — provision in the Vitalis GHL location; never a
JetEdCo number). Every first-touch SMS carries opt-out language. Promo
sends respect 8 am–9 pm ET quiet hours; transactional reminders follow the
session clock.

`{JOIN}` = `https://vitalis.twelvecreative.io/webinar/live/?session={ISO}`
`{REPLAY}` = `https://vitalis.twelvecreative.io/webinar/replay/?session={ISO}`
`{BOOK}` = `https://vitalis.twelvecreative.io/consultation/`

---

**S1 — Registration confirmation** *(immediate)*
> Vitalis Tower: you're registered! 🎟 {{contact.webinar_session_display}}.
> Your join link: {JOIN}
> Save this text. Reply STOP to opt out.

**S2 — 24-hour reminder**
> Tomorrow: your Vitalis Tower session — {{contact.webinar_session_display}}.
> Join here: {JOIN}

**S3 — 15-minute reminder**
> Starting in 15 minutes 🏛 Grab your seat: {JOIN}

**S4 — Session start**
> We're live now — join here: {JOIN}

**S5 — Attended, didn't book** *(T+1 day, promo window)*
> Yesterday's session, made personal: 30 private minutes with the Vitalis
> team on your numbers. Pick a time: {BOOK}

**S6 — No-show replay** *(T+1 day, promo window)*
> Missed the Vitalis session — the replay's up for a few more days:
> {REPLAY}

**S7 — Booking abandoned** *(next morning, promo window)*
> Your presentation slot is still open — finish booking in one tap: {BOOK}

**S8 — Appointment prep** *(on booking)*
> Booked ✔ Your Vitalis Tower presentation details + reschedule links are in
> your email. In person? 2820 NE 214th St, Suite 903, Aventura.
