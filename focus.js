/* Aurion's Focus Mode (web): a gentle body-double. He sits calmly in his corner while you work, checks in now and then,
   notices if you drift to another tab, celebrates when you finish. Kind, brief, never a nag. Everything stays in this browser. */
(function(){
'use strict';
const A = window.aurion, $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const SCALE = +Q.get('focustest') > 0 ? 1 / +Q.get('focustest') : 1;   // test flag: ?focustest=60 makes a minute last a second
const MIN = 60000 * SCALE, now = () => Date.now();
const KEY = 'aurion_focus_v1';
const pickNR = (() => { const used = []; return (arr, u) => { const fresh = arr.filter(x => !used.includes(x)); const l = (fresh.length ? fresh : arr)[Math.floor(Math.random() * (fresh.length ? fresh : arr).length)]; used.push(l); if(used.length > 8) used.shift(); return l.replace(/\{u\}/g, u || A.S.cfg.user).replace(/\{i\}/g, ses ? ses.intent : 'your work').replace(/\{m\}/g, ses ? left() : ''); }; })();
let st = load(), ses = null, tick = null, awaiting = null;
function load(){ try{ return Object.assign({ sessions: 0, minutes: 0, streak: 0, lastDay: '', interval: 'auto', cloudOnly: false, pomodoro: false, len: 25 }, JSON.parse(localStorage.getItem(KEY) || '{}')); }catch(_){ return { sessions: 0, minutes: 0, streak: 0, lastDay: '', interval: 'auto', cloudOnly: false, pomodoro: false, len: 25 }; } }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(_){} }

const L = {
  start: ['Okay, {u}. Focusing on {i}. I\'ll sit right here with you.', 'Let\'s do this together: {i}. I\'m keeping you company.', 'Focus field on for {i}. I\'ve got your back.', 'Settling in with you. Just {i}, one step at a time.'],
  half: ['Halfway there, {u}. How\'s it going?', 'Little check-in: halfway through. Good, or stuck?', 'You\'re halfway. Still flowing?', 'Halfway mark. How\'s {i} coming along?'],
  check: ['Quick check-in, {u}. How\'s it going?', 'Just floating by. Good, or stuck?', 'Still with {i}? How does it feel?'],
  five: ['Five minutes left. Nice and easy to the finish.', 'Five more minutes, {u}. You\'re almost there.', 'Last five minutes. Let\'s land this softly.'],
  good: ['Love that. Keep going.', 'Beautiful. I\'ll stay quiet.', 'Nice. Back to it, I\'m right here.', 'That\'s the flow. Carry on.'],
  stuck: ['That\'s okay. What\'s the tiniest next step? Just write one sentence.', 'Let\'s shrink it. Open the thing and do only the first two minutes.', 'Try three slow breaths with me. In… and out. Then just the next small piece.', 'Stuck is normal. Name the very next action out loud, then do only that.', 'Let\'s reset. Stand up, shake your hands out, sit back down, one small piece.'],
  drift: ['Welcome back. Let\'s float back to {i}, {m} left.', 'Hey, you\'re back. {i} is right here waiting, {m} to go.', 'No worries, {u}. Let\'s drift back to {i}. {m} left.', 'Back in the field. {i}, {m} left. You\'ve got this.'],
  snooze: ['Enjoy your break. I\'ll check back in 5 minutes.', 'Break time. I\'ll hold the space for 5 minutes.'],
  brk: ['Break time, {u}. Stretch, sip some water, look at something far away.', 'Five-minute break. Water, a stretch, maybe a window.', 'Nice block. Stand up, roll your shoulders, drink some water.'],
  back: ['Break\'s over. Back to {i}, gently.', 'Ready for another round of {i}?'],
  paused: ['Paused. Take whatever time you need.', 'Paused. I\'ll be right here.'],
  resumed: ['Back in it. {i}.', 'Resuming. {m} left.'],
  end: ['You did it, {u}! What did you get done?', 'Session complete! Tell me, what did you get done?', 'That\'s a wrap! What did you get done?'],
  early: ['Ending here is okay. Every bit counts. What did you get done?', 'Good call. What did you manage to do?'],
  praise: ['That\'s real progress. I\'m proud of you.', 'Look at you go. That counts, {u}.', 'Beautiful work. Rest a moment, you earned it.', 'Every finished block is a little star. That one shines.'],
  artHalf: ['Halfway, {u}. How\'s the piece coming along?', 'Halfway through. How are your hands and the piece feeling?', 'Little check-in from the stars: how\'s the making going?'],
  artCheck: ['How\'s the piece coming along?', 'Just floating by. Is the wire behaving?', 'How\'s the creation flowing, {u}?'],
  artFive: ['Five minutes left. A good moment to find a resting point for the piece.', 'Five more minutes of making. Enjoy it.'],
  artStuck: ['Put it down for three slow breaths, then pick up just the next wrap.', 'Step back and look at it from across the room. What does it want next?', 'Do the smallest next thing: one coil, one bead, one layer.'],
  artDrift: ['Welcome back. The piece is waiting for you, {m} left.', 'Hey, you\'re back. Let\'s float back to {i}, {m} to go.'],
  artEnd: ['Beautiful session, {u}! What did you make?', 'Making time complete! How did the piece turn out?'],
  ask: ['What would you like to focus on? Type it, or tell me.', 'What are we focusing on?'],
};
const fmt = ms => { const m = Math.max(0, Math.ceil(ms / MIN)); return m + (m === 1 ? ' minute' : ' minutes'); };
function left(){ return ses ? fmt(ses.end - (ses.pausedAt || now())) : ''; }
const ART = { half: 'artHalf', check: 'artCheck', five: 'artFive', stuck: 'artStuck', drift: 'artDrift', end: 'artEnd' };
function talk(k, o){ o = o || {}; if(ses && ses.art && ART[k]) k = ART[k]; else if(!ses && lastArt && k === 'end') k = 'artEnd'; const line = typeof k === 'string' && L[k] ? pickNR(L[k]) : k;
  const spoken = o.spoken !== false && !st.cloudOnly && A.cfg().voice;
  A.say(line, Object.assign({ convo: true, speak: spoken, quiet: !spoken, ms: 6000 }, o.cloud || {})); log(k + ': ' + line); return line; }
const logs = []; function log(m){ logs.push(m); if(window.host && host.log) host.log('focus ' + m); }

/* ---------- the panel ---------- */
const panel = document.createElement('div'); panel.id = 'focusPanel'; panel.className = 'hit panel'; panel.hidden = true;
panel.innerHTML = `<div class="ptitle">🎯 Focus with Aurion <button class="x" id="fClose">✕</button></div>
<div id="fSetup"><div class="btnrow" id="fPicks"><button data-i="Art / making">🎨 Art / making</button><button data-i="A project">🛠️ A project</button><button data-i="">✨ Something else</button></div>
<label class="row">Intention <input id="fIntent" maxlength="60" placeholder="e.g. the newsletter"></label>
<div class="btnrow" id="fLens"><button data-m="25">25 min</button><button data-m="50">50 min</button><button data-m="90">90 min</button><input id="fCustom" type="number" min="1" max="240" placeholder="custom" style="width:70px"></div>
<label class="row chk"><input type="checkbox" id="fPomo"> Pomodoro (5-min breaks between blocks)</label>
<label class="row">Check-ins <select id="fInt"><option value="auto">Halfway + 5 min before end</option><option value="10">Every 10 min</option><option value="15">Every 15 min</option><option value="20">Every 20 min</option><option value="off">Only near the end</option></select></label>
<label class="row chk"><input type="checkbox" id="fCloud"> Nudges in the cloud only (not spoken)</label>
<div class="btnrow"><button id="fGo">✨ Start focusing</button></div></div>
<div id="fLive" hidden><div id="fNow"></div><div class="btnrow"><button id="fPause">⏸ Pause</button><button id="fBreak">☕ On a break</button><button id="fEnd">⏹ End</button></div></div>
<div class="pfoot" id="fStats"></div>`;
document.body.appendChild(panel);
const ring = document.createElement('div'); ring.id = 'focusRing'; ring.hidden = true;
ring.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="bg"/><circle cx="50" cy="50" r="46" class="fg" id="fArc"/></svg><span id="fTime"></span>';
document.body.appendChild(ring);
let chosenLen = st.len;
panel.querySelectorAll('#fPicks button').forEach(b => b.onclick = () => { const v = b.dataset.i; $('#fIntent').value = v === 'Art / making' ? 'your art' : v === 'A project' ? 'your project' : ''; if(!v) $('#fIntent').focus(); });
panel.querySelectorAll('#fLens button').forEach(b => b.onclick = () => { chosenLen = +b.dataset.m; $('#fCustom').value = ''; markLen(); });
$('#fCustom').oninput = e => { if(+e.target.value > 0){ chosenLen = +e.target.value; markLen(); } };
function markLen(){ panel.querySelectorAll('#fLens button').forEach(b => b.classList.toggle('on', +b.dataset.m === chosenLen)); }
$('#fClose').onclick = () => { panel.hidden = true; };
$('#fGo').onclick = () => { st.pomodoro = $('#fPomo').checked; st.interval = $('#fInt').value; st.cloudOnly = $('#fCloud').checked; st.len = chosenLen; save(); start($('#fIntent').value.trim() || 'your work', chosenLen); };
$('#fPause').onclick = () => ses && (ses.pausedAt ? resume() : pause());
$('#fBreak').onclick = () => snooze();
$('#fEnd').onclick = () => finish(true);
$('#fInt').onchange = e => { st.interval = e.target.value; save(); if(ses) plan(); };
$('#fCloud').onchange = e => { st.cloudOnly = e.target.checked; save(); };
function open(){
  A.closePanels(); panel.hidden = false;
  $('#fSetup').hidden = !!ses; $('#fLive').hidden = !ses;
  $('#fPomo').checked = st.pomodoro; $('#fInt').value = st.interval; $('#fCloud').checked = st.cloudOnly; chosenLen = st.len; markLen(); stats(); live();
  if(!ses) setTimeout(() => $('#fIntent').focus(), 50);
}
function stats(){ $('#fStats').textContent = st.sessions ? '⭐ ' + st.sessions + ' sessions · ' + Math.round(st.minutes) + ' min focused · 🔥 ' + st.streak + '-day streak' : 'Your first session is waiting.'; }
function live(){ if(!ses) return; $('#fNow').textContent = (ses.onBreak ? '☕ Break · ' : '🎯 ' + ses.intent + ' · ') + left() + (ses.pausedAt ? ' (paused)' : '') + (st.pomodoro ? ' · block ' + ses.block : ''); $('#fPause').textContent = ses.pausedAt ? '▶ Resume' : '⏸ Pause'; }

/* ---------- a session ---------- */
function start(intent, mins){
  mins = Math.max(1, Math.min(240, +mins || 25));
  const art = /\b(art|making|make|orgonite|tensor|ring|wire|wrap|jewel|pendant|craft|paint|draw|sculpt|bead|resin)/i.test(intent);
  ses = { art, intent, mins, start: now(), end: now() + mins * MIN, block: 1, fired: {}, onBreak: false, pausedAt: 0, lastNudge: 0, snoozeUntil: 0, hiddenAt: 0, worked: 0 };
  plan(); panel.hidden = true; A.closePanels(); A.hideBubble(); A.goHome();
  ring.hidden = false; document.body.classList.add('focusing');
  clearInterval(tick); tick = setInterval(step, Math.max(250, 1000 * SCALE));
  talk('start');
  if('Notification' in window && Notification.permission === 'default'){ try{ Notification.requestPermission(); }catch(_){} }   // asked only now, when focus starts
  log('start ' + intent + ' ' + mins + 'm');
}
function plan(){ const d = ses.mins * MIN, pts = [];
  if(st.interval === 'auto'){ if(ses.mins >= 10) pts.push(['half', d / 2]); }
  else if(st.interval !== 'off'){ for(let t = +st.interval * MIN; t < d - 5 * MIN - 1; t += +st.interval * MIN) pts.push(['check', t]); }
  if(ses.mins > 6) pts.push(['five', d - 5 * MIN]);
  ses.points = pts.map(p => ({ k: p[0], at: ses.start + p[1] })); }
function step(){
  if(!ses || ses.pausedAt) return draw();
  const t = now();
  if(ses.onBreak){ if(t >= ses.end){ ses.onBreak = false; ses.block++; ses.start = t; ses.end = t + ses.mins * MIN; plan(); talk('back'); } return draw(); }
  for(const p of ses.points) if(!p.done && t >= p.at && !document.hidden){ p.done = true; if(t < ses.snoozeUntil) continue; checkIn(p.k); break; }   // a check-in due while you're away waits until you're back
  if(t >= ses.end){ ses.worked += ses.mins; if(st.pomodoro){ ses.onBreak = true; ses.start = t; ses.end = t + 5 * MIN; talk('brk'); A.act('wave', 2); return draw(); } return finish(false); }
  draw(); live();
}
function checkIn(k){
  awaiting = 'check';
  talk(k, { cloud: k === 'five' ? {} : { sticky: true, buttons: [['👍 Good', () => reply('good')], ['😵 Stuck', () => reply('stuck')], ['☕ Break', () => snooze()]] } });
  if(k === 'five') awaiting = null;
  else setTimeout(() => { if(awaiting === 'check'){ awaiting = null; A.hideBubble(); } }, 45000 * Math.max(SCALE, .02));
}
function reply(kind){ awaiting = null; if(kind === 'stuck'){ A.act('namaste', 3); return talk('stuck'); } return talk('good'); }
function pause(){ ses.pausedAt = now(); talk('paused'); live(); }
function resume(){ const d = now() - ses.pausedAt; ses.end += d; ses.start += d; ses.points.forEach(p => p.at += d); ses.pausedAt = 0; talk('resumed'); live(); }
function snooze(){ if(!ses) return; ses.snoozeUntil = now() + 5 * MIN; awaiting = null; talk('snooze'); log('snoozed'); }
function draw(){
  if(!ses){ ring.hidden = true; return; }
  const total = ses.end - ses.start, done = Math.min(1, ((ses.pausedAt || now()) - ses.start) / total);
  const arc = $('#fArc'), C = 2 * Math.PI * 46; arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C * done;
  ring.classList.toggle('brk', ses.onBreak); ring.classList.toggle('paused', !!ses.pausedAt);
  const msLeft = Math.max(0, ses.end - (ses.pausedAt || now())), m = Math.floor(msLeft / MIN), s = Math.floor((msLeft % MIN) / (MIN / 60));
  $('#fTime').textContent = m + ':' + String(s).padStart(2, '0');
}
function place(){ if(!ses){ return requestAnimationFrame(place); }
  try{ const h = A.rig.headPoint(), r = (h.cy - h.top) * 2.3; ring.style.width = ring.style.height = r + 'px'; ring.style.transform = 'translate(' + (h.x - r / 2) + 'px,' + (h.cy - r / 2) + 'px)'; }catch(_){}
  requestAnimationFrame(place); }
requestAnimationFrame(place);
async function finish(early){
  if(!ses) return; const s = ses; clearInterval(tick);
  const mins = early ? s.worked + Math.max(0, (now() - s.start) / MIN) : s.worked;
  lastArt = !!s.art; ses = null; ring.hidden = true; document.body.classList.remove('focusing'); panel.hidden = true; A.hideBubble();
  const today = new Date().toDateString(), yest = new Date(Date.now() - 864e5).toDateString();
  if(mins >= 1 || !early){ st.sessions++; st.minutes += mins; if(st.lastDay !== today){ st.streak = st.lastDay === yest ? st.streak + 1 : 1; st.lastDay = today; } save(); }
  log('end ' + (early ? 'early' : 'complete') + ' ' + mins.toFixed(1) + 'm');
  if(!early){ if(Math.random() < .5 && A.startPlay) A.startPlay(); else if(A.ride) A.ride(); celebrated = true; }
  else A.act('wave', 2);
  setTimeout(() => { awaiting = 'reflect'; reflectIntent = s.intent;
    talk(early ? 'early' : 'end', { cloud: { sticky: true, buttons: [['✍️ Tell him', () => { A.openChat(); }], ['🙏 Done', () => { awaiting = null; talk(pickNR(L.praise)); }]] } }); }, early ? 300 : 2500);
}
let lastArt = false, celebrated = false, reflectIntent = '';

/* ---------- drift: tab hidden or window blurred ---------- */
function drifted(){ if(!ses || ses.pausedAt || ses.onBreak || artIdleOK()) return;
  if(!ses.hiddenAt) ses.hiddenAt = now();
  clearTimeout(drifted.n); drifted.n = setTimeout(() => { if(ses && ses.hiddenAt && document.hidden && now() > ses.snoozeUntil && (!ses.lastNotif || now() - ses.lastNotif > 4 * MIN)) notify(); else log('no notification (back, snoozed or rate-limited)'); }, 60000 * SCALE + 50); }
function notify(){ if(!('Notification' in window) || Notification.permission !== 'granted' || !ses){ log('notification not allowed'); return; } ses.lastNotif = now();
  try{ new Notification('Aurion', { body: 'Whenever you\'re ready: ' + ses.intent + ', ' + left() + ' left.', icon: 'icon-192.png', tag: 'aurion-focus', silent: false }); log('notification'); }catch(e){ log('notification failed ' + e.message); } }
function returned(){ if(!ses || !ses.hiddenAt) return; const away = now() - ses.hiddenAt; ses.hiddenAt = 0;
  if(away < 60000 * SCALE || ses.pausedAt || ses.onBreak || now() < ses.snoozeUntil) return;
  if(now() - ses.lastNudge < 4 * MIN && ses.lastNudge) { log('nudge rate-limited'); return; }
  ses.lastNudge = now(); chime(); A.act('wave', 1.6);
  talk('drift', { cloud: { buttons: [['👍 Back on it', () => talk('good')], ['☕ On a break', () => snooze()]] } }); }
document.addEventListener('visibilitychange', () => document.hidden ? drifted() : returned());
const phone = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
function artIdleOK(){ return ses && ses.art && phone; }   // a phone resting on the table during art is fine, not drift

function chime(){ try{ const ac = new (window.AudioContext || window.webkitAudioContext)(); const g = ac.createGain(); g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.06, ac.currentTime + .05); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + 1.6); g.connect(ac.destination);
  [880, 1318.5].forEach((f, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(ac.currentTime + i * .12); o.stop(ac.currentTime + 1.7); }); setTimeout(() => ac.close(), 2000); }catch(_){} }

/* ---------- words: typed or spoken ---------- */
function onText(text){
  const t = text.toLowerCase().trim();
  if(awaiting === 'intent'){ awaiting = null; const len = (t.match(/(\d{1,3})\s*(?:min|minutes?)?/) || [])[1]; const intent = text.replace(/\b(for )?\d{1,3}\s*(min(ute)?s?)?\b/gi, '').replace(/^(on|the)\s+/i, '').trim() || 'your work';
    setTimeout(() => start(intent, len || st.len), 50); return 'Okay. ' + intent + ', ' + (len || st.len) + ' minutes. Here we go.'; }
  let m = t.match(/\bfocus(?:ing)?\s+(?:for\s+)?(\d{1,3})\s*(?:min|minutes?)\b(?:\s+on\s+(.+))?/) || t.match(/\bfocus(?:ing)?\s+on\s+(.+?)(?:\s+for\s+(\d{1,3})\s*(?:min|minutes?))?$/);
  if(m && !ses){ let len, intent; if(/^\d/.test(m[1])){ len = +m[1]; intent = m[2]; } else { intent = m[1]; len = m[2] ? +m[2] : 0; }
    intent = (intent || '').replace(/[.!?]+$/, '').trim();
    if(intent && len){ setTimeout(() => start(text.match(new RegExp(intent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))[0], len), 50); return 'Okay, ' + len + ' minutes on ' + intent + '. I\'m right here.'; }
    if(len){ st.len = len; save(); awaiting = 'intent'; setTimeout(open, 50); return pickNR(L.ask); }
    if(intent){ setTimeout(() => { open(); $('#fIntent').value = intent; }, 50); return 'Lovely. How long? 25, 50 or 90 minutes?'; } }
  if(/\b(help me focus|focus mode|let'?s focus|start (a )?focus|i need to focus|body ?double)\b/.test(t) && !ses){ awaiting = 'intent'; setTimeout(open, 50); return pickNR(L.ask) + ' And how long: 25, 50 or 90 minutes?'; }
  if(!ses && awaiting !== 'reflect') return null;
  if(ses && /\b(on a break|taking a break|break)\b/.test(t)){ ses.snoozeUntil = now() + 5 * MIN; awaiting = null; log('snoozed'); return pickNR(L.snooze); }
  if(ses && /\b(pause)\b/.test(t)){ setTimeout(pause, 10); return pickNR(L.paused); }
  if(ses && /\b(resume|unpause|continue)\b/.test(t) && ses.pausedAt){ setTimeout(resume, 10); return pickNR(L.resumed); }
  if(ses && /\b(end|stop|finish|done)\b.*\b(focus|session)\b|\b(end|stop) (it|now)\b/.test(t)){ setTimeout(() => finish(true), 50); return 'Okay, ending the session.'; }
  if(ses && /\b(how (much|long)|time left|minutes left)\b/.test(t)) return left() + ' left on ' + ses.intent + '.';
  if(awaiting === 'check' || (ses && /^(good|great|fine|okay|ok|stuck|i'?m stuck|not good|bad|struggling)\b/.test(t))){
    awaiting = null; A.hideBubble();
    if(/stuck|struggl|hard|not good|bad|lost|distract|can'?t/.test(t)){ A.act('namaste', 3); return pickNR(ses && ses.art ? L.artStuck : L.stuck); }
    return pickNR(L.good); }
  if(awaiting === 'reflect'){ awaiting = null; reflect(text); return pickNR(L.praise); }
  return null;
}
async function reflect(text){   // optional brain: a warmer personal reflection, only if it answers fast
  if(!A.brainLine) return; const r = await Promise.race([A.brainLine('I just finished a focus session on "' + reflectIntent + '". What I got done: ' + text + '. Reply in one short, warm sentence celebrating it.'), new Promise(r => setTimeout(() => r(null), 4000))]);
  if(r) setTimeout(() => talk(r), 3500); }

window.Focus = { active: () => !!ses, onBreak: () => !!(ses && ses.onBreak), onText, open, start, finish, snooze, pause, resume, state: () => ses, stats: () => st, logs, _drift: { drifted, returned } };
})();
