// Unit tests for the Vitalis session engine — loads config + core in a stubbed window.
const fs = require('fs');
const SITE = require('path').resolve(__dirname, '..');
global.window = global;
global.document = { addEventListener(){}, querySelectorAll(){return[]}, getElementById(){return null}, createElement(){return {style:{},setAttribute(){},appendChild(){}}}, head:{appendChild(){}}, cookie:'' };
global.location = { search:'', href:'http://localhost/', pathname:'/', hostname:'localhost' };
global.localStorage = { getItem(){return null}, setItem(){}, removeItem(){} };
global.navigator = { userAgent: 'node' };
global.URL = URL;
eval(fs.readFileSync(SITE + '/config/funnel.js', 'utf8'));
eval(fs.readFileSync(SITE + '/js/core.js', 'utf8'));
const C = window.VITALIS_CORE;

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}
function et(d) { return C.fmtET(d, {weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}); }

// Config: Wednesday 19:00 ET, cutoff 15
// 1. From a Monday noon ET, next session is that Wednesday 7 PM ET.
let now = new Date('2026-10-12T16:00:00Z'); // Mon Oct 12 2026, noon EDT
let s = C.nextOpenSession(now);
t('Mon→Wed same week', et(s) === 'Wed, 10/14/2026, 07:00 PM EDT', et(s));

// 2. Wednesday 6:50 PM ET (10 min before start, inside 15-min cutoff) → rolls a week
now = new Date('2026-10-14T22:50:00Z'); // Wed 6:50 PM EDT
s = C.nextOpenSession(now);
t('cutoff rolls to next week', et(s) === 'Wed, 10/21/2026, 07:00 PM EDT', et(s));

// 3. Wednesday 6:40 PM ET (20 min before) → still today
now = new Date('2026-10-14T22:40:00Z');
s = C.nextOpenSession(now);
t('before cutoff stays today', et(s) === 'Wed, 10/14/2026, 07:00 PM EDT', et(s));

// 4. DST fall-back: Nov 1 2026 clocks go EDT→EST. Session Wed Nov 4 must be 7 PM EST = 00:00 UTC Thu.
now = new Date('2026-10-30T12:00:00Z');
s = C.nextOpenSession(now);
t('fall-back week wall time', et(s) === 'Wed, 11/04/2026, 07:00 PM EST', et(s));
t('fall-back UTC instant', s.toISOString() === '2026-11-05T00:00:00.000Z', s.toISOString());

// 5. Session before the transition is EDT (23:00 UTC)
now = new Date('2026-10-26T12:00:00Z');
s = C.nextOpenSession(now);
t('pre-transition EDT instant', s.toISOString() === '2026-10-28T23:00:00.000Z', s.toISOString());

// 6. Spring-forward 2027: Mar 14 2027 EST→EDT. Wed Mar 17 must be 7 PM EDT = 23:00 UTC.
now = new Date('2027-03-15T12:00:00Z');
s = C.nextOpenSession(now);
t('spring-forward wall time', et(s) === 'Wed, 03/17/2027, 07:00 PM EDT', et(s));
t('spring-forward UTC instant', s.toISOString() === '2027-03-17T23:00:00.000Z', s.toISOString());

// 7. Canceled date is skipped
window.VITALIS.SCHEDULE.CANCELED_DATES = ['2026-10-14'];
now = new Date('2026-10-12T16:00:00Z');
s = C.nextOpenSession(now);
t('canceled date skipped', et(s) === 'Wed, 10/21/2026, 07:00 PM EDT', et(s));
window.VITALIS.SCHEDULE.CANCELED_DATES = [];

// 8. Special session earlier than weekly is preferred
window.VITALIS.SCHEDULE.SPECIAL_SESSIONS = [{date:'2026-10-13', hour: 11, minute: 0}];
s = C.nextOpenSession(new Date('2026-10-12T16:00:00Z'));
t('special session wins when sooner', et(s) === 'Tue, 10/13/2026, 11:00 AM EDT', et(s));
window.VITALIS.SCHEDULE.SPECIAL_SESSIONS = [];

// 9. sessionWithin keeps a running session (30 min in, 90-min window)
now = new Date('2026-10-14T23:30:00Z'); // 7:30 PM EDT — session started 30 min ago
s = C.sessionWithin(now, 90*60000);
t('sessionWithin keeps running session', et(s) === 'Wed, 10/14/2026, 07:00 PM EDT', et(s));

// 10. sessionWithin rolls after window closes
now = new Date('2026-10-15T01:35:00Z'); // 9:35 PM EDT — 2h35m after start
s = C.sessionWithin(now, 90*60000);
t('sessionWithin rolls after window', et(s) === 'Wed, 10/21/2026, 07:00 PM EDT', et(s));

// 11. ICS blob content: stable UID + correct UTC stamps
global.Blob = class { constructor(parts){ this.text = parts.join(''); } };
global.URL.createObjectURL = (b) => { global.__ics = b.text; return 'blob:x'; };
const sess = new Date('2026-11-05T00:00:00.000Z');
C.icsBlobUrl(sess);
t('ICS DTSTART UTC', global.__ics.includes('DTSTART:20261105T000000Z'));
t('ICS DTEND +60min', global.__ics.includes('DTEND:20261105T010000Z'));
t('ICS stable UID', global.__ics.includes('UID:vitalis-webinar-20261105T000000Z@vitalis.twelvecreative.io'));
t('ICS organizer', global.__ics.includes('ORGANIZER;CN=Vitalis Tower:mailto:events@vitalistower.com'));
t('ICS alarm', global.__ics.includes('TRIGGER:-PT30M'));
const again = (C.icsBlobUrl(sess), global.__ics);
t('ICS UID identical on re-download', again.match(/UID:[^\r\n]+/)[0] === 'UID:vitalis-webinar-20261105T000000Z@vitalis.twelvecreative.io');

// 12. calendarLinks: google/outlook/office365 params carry same instant
const links = C.calendarLinks(sess);
t('google dates param', links.google.includes('dates=20261105T000000Z%2F20261105T010000Z') || links.google.includes('dates=20261105T000000Z/20261105T010000Z'), links.google.slice(0,140));
t('outlook startdt', links.outlookLive.includes(encodeURIComponent('2026-11-05T00:00:00.000Z')));
t('office365 host', links.office365.startsWith('https://outlook.office.com/calendar/0/deeplink/compose?'));
t('ics url session param', links.ics === '/webinar/confirmed/event.php?session=' + encodeURIComponent(sess.toISOString()));

// 13. sessionDisplay format
t('sessionDisplay text', C.sessionDisplay(sess) === 'Wednesday, November 4 at 7:00 PM EST', C.sessionDisplay(sess));

// 14. registration-day field format (MM-DD-YYYY, ET day)
const dayField = C.fmtET(sess, {year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'-');
t('ET calendar-day field', dayField === '11-04-2026', dayField);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
