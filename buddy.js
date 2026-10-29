/* Aurion, the starseed desktop buddy. A higher-dimensional being who flies onto your screen in his ship, beams down,
   and keeps you company: floats around, plays hacky sack, eats star food, shares the peace pipe, meditates, naps,
   and talks. Same bones as Elder Fern (a transparent always-on-top window, a state machine that decides what he does
   next, needs from care.js), but his body is drawn in code (rig.js), so there are no image files at all.
   Everything that touches the computer goes through window.host (preload.js); in a plain browser it runs as a demo. */
(function(){
'use strict';
const $ = s => document.querySelector(s);
const WEB = !window.host || !!window.host.web;
const host = window.host || webHost();
const now = () => Date.now();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ez = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const eoc = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const safeEl = document.createElement('div'); safeEl.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)'; document.documentElement.appendChild(safeEl);
const safeB = () => parseFloat(getComputedStyle(safeEl).paddingBottom) || 0;
const W = () => innerWidth, H = () => innerHeight - safeB();
const Q = new URLSearchParams(location.search);
if(WEB) document.body.classList.add('web');

/* ------------------------------------------------------------------ saved state */
const SAVE_KEY = 'aurion_save_v1';
const CFG = { user: 'starseed', size: 240, voice: true, convo: false, wake: true, home: 'right', voiceName: '', voiceSpeed: .9, wander: true, thoughts: true, visor: false, brainUrl: '', arrive: true };
let S = { pet: Care.fresh(), cfg: Object.assign({ voiceV2: true }, CFG), seen: now() };
function persist(){ S.seen = now(); try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(_){} }
function loadSave(){ try{ const j = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if(j && j.pet){ S.pet = Object.assign(Care.fresh(), j.pet); S.cfg = Object.assign({}, CFG, j.cfg || {}); if(!S.cfg.voiceV2){ S.cfg.voiceV2 = true; S.cfg.voice = true; } S.seen = j.seen || now(); if(j.mem) S.mem = j.mem; } }catch(_){} }
const say$ = k => Wisdom.line(k, S.cfg.user);

/* ------------------------------------------------------------------ his body */
const beingEl = $('#being'), shadowEl = $('#shadow');
const rig = new Rig(beingEl);
const size = () => S.cfg.size;
/* F = Aurion on the stage. x = centre (px), y = height above the floor (px) */
const F = { x: 0, y: 0, vy: 0, vx: 0, mode: 'idle', until: 0, target: 0, dir: 1, then: null, sitKind: null, resting: false, chatting: false };
function pose(clip, restart){ rig.play(clip, restart); }
function act(clip, secs, then){ F.mode = 'act'; pose(clip, true); F.until = now() + secs * 1000; F.then = then || null; }
function idle(secs){ F.mode = 'idle'; pose('idle'); F.until = now() + (secs == null ? rand(2.5, 6) : secs) * 1000; }
function place(){
  const fy = H() - F.y;
  beingEl.style.transform = 'translate(' + F.x.toFixed(1) + 'px,' + fy.toFixed(1) + 'px)';
  rig.setAnchor(F.x, fy);
  const lift = F.y + rig.p.hover * rig.k, k = clamp(1 - lift / 500, .15, 1);
  shadowEl.style.transform = 'translate(' + (F.x - size() * .22) + 'px,' + (H() - 10) + 'px) scale(' + k.toFixed(3) + ')';
  shadowEl.style.width = (size() * .44) + 'px'; shadowEl.style.opacity = (beingEl.style.opacity === '' ? 1 : +beingEl.style.opacity) * k;
  placePill();
}
/* tiny status pill beside his feet: running dot + voice state; click toggles voice */
const pillEl = $('#pill');
function placePill(){
  if(!pillEl) return;
  pillEl.hidden = F.mode === 'away';
  const w = pillEl.offsetWidth || 110, side = F.x > W() / 2 ? -1 : 1;
  const x = clamp(F.x + side * size() * .26 - (side < 0 ? w : 0), 6, W() - w - 6);
  pillEl.style.transform = 'translate(' + x.toFixed(0) + 'px,' + (H() - 26) + 'px)';
}
function syncPill(){
  if(!pillEl) return;
  const st = pillBusy ? 'think' : Voice.recording() ? 'listen' : Voice.listening() ? 'ears' : S.cfg.voice ? 'on' : 'off';
  pillEl.className = 'hit pill ' + st;
  if(pillHeard && now() < pillHeard.until && !pillBusy){ const lbl2 = '🗣️ "' + (pillHeard.text.length > 34 ? pillHeard.text.slice(0, 33) + '…' : pillHeard.text) + '" · ' + pillHeard.note; if(pillEl.querySelector('.pv').textContent !== lbl2) pillEl.querySelector('.pv').textContent = lbl2; return; }
  const lbl = { think: '💭 thinking…', listen: '🎙️ listening', ears: '👂 ' + (S.cfg.convo && S.cfg.wake ? 'say "Aurion"' : 'listening for you'), on: '🔊 voice on', off: '🔇 voice off' }[st];
  if(pillEl.querySelector('.pv').textContent !== lbl) pillEl.querySelector('.pv').textContent = lbl; pillEl.className = 'hit pill ' + (st === 'ears' ? 'listen' : st);
  pillEl.title = 'Aurion on · click to turn his voice ' + (S.cfg.voice ? 'off' : 'on');
}

/* ------------------------------------------------------------------ speech bubble */
const bub = $('#bubble'), bubText = $('#bubbleText'), bubBtns = $('#bubbleBtns');
let bubUntil = 0, talkUntil = 0;
/* his words float up in a small thought cloud; long lines show a sentence (or two) at a time */
let cloudQ = [], cloudT = null;
function cloudChunks(text){
  const parts = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*["')\]]*\s*/g) || [String(text)];
  const out = []; let cur = '';
  for(let p of parts){ p = p.trim(); if(!p) continue;
    while(p.length > 120){ const cut = p.lastIndexOf(' ', 110) > 40 ? p.lastIndexOf(' ', 110) : 110; out.push(p.slice(0, cut).trim() + '…'); p = p.slice(cut).trim(); }
    if(cur && (cur + ' ' + p).length > 110){ out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; }
  if(cur) out.push(cur); return out.length ? out : [String(text)];
}
function say(text, o){
  o = o || {};
  if(!o.convo && inConvo()) return;    // no idle chatter over a conversation
  if(S.cfg.convo && !o.convo) o.quiet = true;                     // in conversation mode his idle lines stay silent (cloud only)
  clearTimeout(cloudT);
  const chunks = cloudChunks(text);
  if(o.speak || (S.cfg.voice && !o.quiet && !o.silent)) speak(text);
  showCloud(chunks, o, 0);
}
function showCloud(chunks, o, i){
  const text = chunks[i], last = i === chunks.length - 1;
  bub.classList.remove('fade');
  bubText.textContent = text; bub.classList.toggle('thought', !!o.thought);
  bubBtns.innerHTML = '';
  (o.buttons || []).forEach(b => { const e = document.createElement('button'); e.textContent = b[0]; e.onclick = () => { hideBubble(); b[1](); }; bubBtns.appendChild(e); });
  if(!last) bubBtns.innerHTML = '';
  bub.hidden = false; bub.style.animation = 'none'; void bub.offsetWidth; bub.style.animation = '';
  const ms = last && o.ms ? Math.max(o.ms / chunks.length, 2600) : clamp(2200 + text.length * 60, 2600, 9000);
  bubUntil = o.sticky && last ? Infinity : now() + ms + 700;
  if(!last) cloudT = setTimeout(() => showCloud(chunks, o, i + 1), ms);
  else if(!o.sticky) cloudT = setTimeout(() => bub.classList.add('fade'), ms);
  if(!o.thought){ talkUntil = now() + clamp(500 + text.length * 48, 900, 6500); if(F.mode === 'idle') act('talk', Math.min(ms, 6000) / 1000); }
  placeBubble();
}
function hideBubble(){ bub.hidden = true; bubUntil = 0; clearTimeout(cloudT); }
function placeBubble(){
  if(!bub.hidden && now() > bubUntil) hideBubble();
  if(bub.hidden) return;
  const hp = rig.headPoint(), r = bub.getBoundingClientRect();
  const left = clamp(hp.x - r.width / 2, 8, W() - r.width - 8);
  let top = hp.top - r.height - 30;
  if(!$('#menu').hidden) top -= $('#menu').offsetHeight + 8;
  if(top < 8) top = 8;
  bub.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  bub.style.setProperty('--tail', clamp(hp.x - left, 18, r.width - 18) + 'px');
}
/* little floating things: hearts, sparkles, Zs */
function puff(txt, x, y, cls){
  const e = document.createElement('span'); e.className = 'fxp' + (cls ? ' ' + cls : ''); e.textContent = txt;
  e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.setProperty('--dx', rand(-30, 30) + 'px');
  $('#fx').appendChild(e); setTimeout(() => e.remove(), 2700);
}
function sparkle(x, y, n, spread, col){
  for(let i = 0; i < (n || 8); i++){
    const sp = document.createElement('div'); sp.className = 'spark'; sp.style.color = col || pick(['#ffe7a3', '#9ff3ff', '#ff9ee8', '#c9a6ff', '#ffffff']); $('#fx').appendChild(sp);
    const a = rand(0, Math.PI * 2), d = rand(20, spread || 70), t0 = now(), life = rand(700, 1300);
    const go = () => { const k = (now() - t0) / life; if(k >= 1){ sp.remove(); return; }
      sp.style.transform = 'translate(' + (x + Math.cos(a) * d * eoc(k)) + 'px,' + (y + Math.sin(a) * d * eoc(k) - 20 * k) + 'px) scale(' + (1 - k * .6) + ')'; sp.style.opacity = String(1 - k); requestAnimationFrame(go); };
    go();
  }
}
/* a tween that resolves when done (the ship, the beam, materializing) */
function tween(ms, fn){ return new Promise(res => { const t0 = performance.now(); const go = t => { const u = Math.min(1, (t - t0) / ms); fn(u); if(u < 1) requestAnimationFrame(go); else res(); }; requestAnimationFrame(go); }); }
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ what he does on his own */
function walkTo(x, then){
  F.target = clamp(x, size() * .3, W() - size() * .3); F.then = null; F.onArrive = then || null;
  if(Math.abs(F.target - F.x) < 6){ const t = F.onArrive; F.onArrive = null; if(t) t(); else idle(); return; }
  F.mode = 'walk'; F.dir = F.target > F.x ? 1 : -1; rig.dir = F.dir; pose('walk');
}
/* home: he mostly hangs out near one edge (Right by default; Left; or Auto = whichever side he is nearer) */
function homeSide(){ const h = S.cfg.home || 'right'; return h === 'auto' ? (F.x < W() / 2 ? 'left' : 'right') : h; }
function homeX(){
  const m = size() * .45, zone = Math.max(W() * .15, size() * .6), u = rand(0, zone - m > 0 ? zone - m : 1);
  return homeSide() === 'left' ? m + u : W() - m - u;
}
const atHome = () => homeSide() === 'left' ? F.x < Math.max(W() * .15, size() * .6) + 10 : F.x > W() - Math.max(W() * .15, size() * .6) - 10;
function wander(){
  if(Math.random() < .8) return walkTo(homeX());            // most glides stay in his home corner
  const span = Math.min(W() * .3, 420);                       // the odd short trip out, then home again later
  const sgn = homeSide() === 'left' ? 1 : -1;
  walkTo(clamp(F.x + sgn * rand(120, span), size() * .5, W() - size() * .5));
}
const lateNight = () => { const h = new Date().getHours(); return h >= 23 || h < 5; };
let lastActive = now();
const userIdle = () => now() - lastActive;
function decide(){
  if(window.Focus && Focus.active()){   // focus mode: calm, still, at home in his corner
    if(!atHome()) return walkTo(homeX(), () => idle(2));
    F.mode = 'sit'; F.sitKind = 'focus'; pose(Focus.onBreak() ? 'sit' : 'meditate');
    clearTimeout(sitFor.t); sitFor.t = setTimeout(() => { if(F.sitKind === 'focus'){ F.sitKind = null; idle(4); } }, 20000); return;
  }
  if(inConvo()) return idle(2);
  const p = S.pet, m = Care.mood(p);
  if(items.food.length) return goEat(items.food[0]);
  if(items.sack) return;
  if(m === 'exhausted' || (m === 'sleepy' && userIdle() > 120000) || (lateNight() && userIdle() > 300000 && p.energy < 60)) return rest(true);
  if(!atHome() && Math.random() < .85) return walkTo(homeX(), () => idle(rand(2, 5)));   // float back home after a pause
  const opts = [];
  if(S.cfg.wander) opts.push([1.1, wander]);
  opts.push([1.6, () => { act('think', rand(3, 6)); if(Math.random() < .25) say(Wisdom.thought(), { thought: true, quiet: true }); }]);
  opts.push([1.5, () => idle(rand(5, 10))]);
  if(m === 'hungry' || m === 'starving') opts.push([4, () => { act('rumble', 2.4); if(Math.random() < .6) say(say$(m)); }]);
  if(m === 'sleepy') opts.push([3, () => { act('doze', rand(5, 9)); if(Math.random() < .5) say(say$('sleepy')); }]);
  if(m === 'sad' || m === 'meh') opts.push([2.5, () => { act('doze', rand(4, 8)); if(Math.random() < .4) say(say$('sad')); }]);
  if(m === 'happy' || m === 'ecstatic') opts.push([1.4, () => { act(Math.random() < .5 ? 'hop' : 'wave', 2.4); if(Math.random() < .3) say(say$('happy')); }]);
  opts.push([.7, () => sitFor(rand(12, 25))]);
  opts.push([.4, () => act('groove', rand(4, 7))]);
  opts.push([.3, () => act('namaste', 3)]);
  if(p.joy > 35 && p.energy > 25) opts.push([.25, smoke]);
  if(p.joy > 60) opts.push([.4, visorMoment]);
  let t = opts.reduce((s, o) => s + o[0], 0) * Math.random();
  for(const o of opts){ t -= o[0]; if(t <= 0) return o[1](); }
}
function visorMoment(){
  const on = !rig.visorOn; rig.visorOn = on; rig.setVisor(on || S.cfg.visor);
  act('idle', 3.5);
  if(on) say(pick(['Star visor: engaged.', 'Your sun is very bright, {u}.'.replace('{u}', S.cfg.user), 'Cosmic and cool.']), { ms: 2600 });
  if(on && !S.cfg.visor) setTimeout(() => { rig.visorOn = false; rig.setVisor(S.cfg.visor); }, rand(20000, 60000));
}
function sitFor(secs){
  F.mode = 'sit'; F.sitKind = 'chill'; pose('sit');
  clearTimeout(sitFor.t); sitFor.t = setTimeout(() => { if(F.sitKind === 'chill'){ F.sitKind = null; idle(); } }, secs * 1000);
}

/* ------------------------------------------------------------------ the main loop */
let lastT = performance.now();
function loop(t){
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  step(dt);
  rig.vx = F.vx; rig.talking = now() < talkUntil || speaking(); rig.aura = auraState();
  rig.look = cur.x >= 0 ? cur : null;
  if(items.sack) rig.look = { x: items.sack.x, y: H() - items.sack.y - 20 };
  rig.update(dt); offerTick(); smokeTick(); stepItems(dt); place(); placeBubble(); placeFloating();
  requestAnimationFrame(loop);
}
/* mood aura: what he's doing beats how he feels */
function auraState(){
  if(F.resting || rig.clip === 'doze' || rig.clip === 'rest') return 'sleepy';
  if(F.sitKind === 'meditate' || rig.clip === 'meditate') return 'calm';
  if(smoking) return 'smoke';
  if(items.sack || rig.clip === 'groove') return 'playful';
  if(rig.talking) return 'talking';
  if(now() - (F.petAt || 0) < 4000) return 'loved';
  const m = Care.mood(S.pet);
  if(m === 'hungry' || m === 'starving') return 'hungry';
  if(m === 'sleepy' || m === 'exhausted') return 'sleepy';
  if(Care.bondLevel(S.pet.bond) >= 3 && m !== 'sad' && m !== 'meh' && Math.floor(now() / 20000) % 3 === 0) return 'loved';
  return 'joyful';
}
function step(dt){
  if(F.mode === 'ship' || F.mode === 'away') { F.vx = 0; return; }
  if(F.mode === 'drag') return;
  if(F.mode === 'fall'){
    /* he doesn't fall, he floats down */
    F.vy = Math.max(F.vy - 900 * dt, -240); F.y += F.vy * dt; F.vx *= Math.pow(.1, dt); F.x = clamp(F.x + F.vx * dt, size() * .3, W() - size() * .3);
    if(F.y <= 0){ F.y = 0; F.vy = 0; idle(1.5); act('hop', .8); if(Math.random() < .6) say(say$('drop'), { ms: 2200 }); }
    return;
  }
  if(F.mode === 'walk'){
    const sp = 74 * size() / 240;
    F.vx += (F.dir * sp - F.vx) * Math.min(1, dt * 4);
    F.x += F.vx * dt;
    if((F.dir > 0 && F.x >= F.target) || (F.dir < 0 && F.x <= F.target)){ F.x = F.target; const t2 = F.onArrive; F.onArrive = null; if(t2) t2(); else idle(); }
    return;
  }
  F.vx *= Math.pow(.02, dt);
  if(F.mode === 'eat' || F.mode === 'sit' || F.mode === 'listen') return;
  if(F.chatting){ if(F.mode === 'act' && now() > F.until){ const th = F.then; F.then = null; F.mode = 'idle'; pose('idle'); F.until = Infinity; if(th) th(); } return; }
  if(items.sack) return play(dt);
  if(now() > F.until){
    if(F.mode === 'act'){ const th = F.then; F.then = null; idle(); if(th) th(); }
    else decide();
  }
}
function careTick(){
  Care.tick(S.pet, now(), { asleep: F.resting });
  if(F.resting && S.pet.energy >= 96 && now() - F.restSince > 60000) wakeUp(false);
  if(!$('#needs').hidden) drawNeeds();
  S.pet.x = Math.round(F.x); persist();
}

/* ------------------------------------------------------------------ the ship */
const shipLayer = $('#shipLayer'), beamEl = $('#beam');
let ship = null;
function makeShip(){ if(ship) ship.el.remove(); const w = size() * 1.45; ship = { el: Props.ship(w), w, h: w * .62, x: -999, y: -999, tilt: 0 }; shipLayer.appendChild(ship.el); ship.el.style.display = 'none'; }
function shipAt(x, y, tilt){ ship.x = x; ship.y = y; ship.tilt = tilt || 0; ship.el.style.transform = 'translate(' + (x - ship.w / 2).toFixed(1) + 'px,' + (y - ship.h / 2).toFixed(1) + 'px) rotate(' + ship.tilt.toFixed(2) + 'deg)'; }
const hoverY = () => Math.max(ship.h * .7, H() - size() * 1.75 - ship.h * .45);
let hum = null;
function shipSound(on){
  try{
    const ac = audio(); if(!ac) return;
    if(on && !hum){ const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sine'; o.frequency.value = 110; o2.type = 'triangle'; o2.frequency.value = 220.7; lfo.frequency.value = 5.5; lg.gain.value = 6;
      lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); o.connect(g); o2.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.05, ac.currentTime + .6); o.start(); o2.start(); lfo.start(); hum = { o, o2, g, lfo, ac }; }
    if(!on && hum){ const h = hum; hum = null; h.g.gain.linearRampToValueAtTime(0, h.ac.currentTime + .6); setTimeout(() => { try{ h.o.stop(); h.o2.stop(); h.lfo.stop(); }catch(_){} }, 700); }
  }catch(_){}
}
function chimeUp(down){
  try{ const ac = audio(); if(!ac) return; const t = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = down ? f / 2 : f;
      const s = t + (down ? (4 - i) : i) * .12; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.06, s + .03); g.gain.exponentialRampToValueAtTime(.0001, s + 1.4); o.connect(g); g.connect(ac.destination); o.start(s); o.stop(s + 1.5); });
  }catch(_){}
}
async function shipFlyIn(tx){
  ship.el.style.display = ''; ship.el.classList.remove('leaving');
  const fromLeft = Q.get('from') ? Q.get('from') === 'left' : tx > W() / 2, x0 = fromLeft ? -ship.w : W() + ship.w, y0 = H() * .08, hy = hoverY();
  shipSound(true);
  await tween(2600, u => { const e = eoc(u); shipAt(x0 + (tx - x0) * e, y0 + (hy - y0) * e - Math.sin(u * Math.PI) * 50, (1 - e) * (fromLeft ? 16 : -16) + Math.sin(now() / 260) * 1.5); });
  await tween(400, u => shipAt(tx, hy + Math.sin(u * Math.PI) * 6, Math.sin(u * Math.PI * 2) * 3));
}
async function shipFlyOut(){
  const x0 = ship.x, y0 = ship.y, toRight = x0 < W() / 2;
  await tween(500, u => shipAt(x0, y0 - 30 * ez(u), 0));
  ship.el.classList.add('leaving');
  await tween(1400, u => { const e = u * u * u; shipAt(x0 + (toRight ? 1 : -1) * (W() + ship.w * 2) * e, y0 - 30 - (y0 + ship.h) * e * .9, (toRight ? 1 : -1) * 14 * ez(u * 3)); });
  ship.el.style.display = 'none'; shipSound(false);
}
async function shipMove(tx){
  const x0 = ship.x, y0 = ship.y;
  await tween(1700, u => { const e = ez(u); shipAt(x0 + (tx - x0) * e, y0 - Math.sin(u * Math.PI) * 40, Math.sin(u * Math.PI) * (tx > x0 ? 12 : -12)); });
}
function beamGeo(open){
  const top = ship.y + ship.h * .32, bot = H(), wTop = ship.w * .28, wBot = size() * .95;
  beamEl.style.left = (ship.x - wBot / 2) + 'px'; beamEl.style.top = top + 'px'; beamEl.style.width = wBot + 'px'; beamEl.style.height = (bot - top) + 'px';
  beamEl.style.setProperty('--tw', (wTop / wBot * 100).toFixed(1) + '%');
  beamEl.style.transform = 'scaleY(' + open.toFixed(3) + ')'; beamEl.style.opacity = String(Math.min(1, open * 1.5));
}
async function beam(on){
  beamEl.hidden = false; chimeUp(!on);
  await tween(550, u => beamGeo(on ? ez(u) : 1 - ez(u)));
  if(!on) beamEl.hidden = true;
}
const beamTopY = () => H() - (ship.y + ship.h * .3);
function beamSparkles(ms){
  const t0 = now(); const iv = setInterval(() => { if(now() - t0 > ms) return clearInterval(iv);
    const x = ship.x + rand(-1, 1) * size() * .35, y = rand(ship.y + ship.h * .4, H() - 10); sparkle(x, y, 2, 25, '#e9fdff'); }, 70);
}
/* he comes down the beam out of the ship: a column of light first, then he condenses out of it */
async function materialize(){
  F.mode = 'ship'; pose('beam', true); const y0 = beamTopY() - size() * .9;
  beingEl.classList.add('materialize'); beamSparkles(2400);
  await tween(2400, u => { const e = ez(u); F.y = Math.max(0, y0 * (1 - e)); beingEl.style.opacity = String(Math.min(1, u * 1.6)); beingEl.style.setProperty('--mat', String(1 - e)); });
  F.y = 0; beingEl.classList.remove('materialize'); beingEl.style.opacity = '1'; beingEl.style.setProperty('--mat', '0');
  sparkle(F.x, H() - size() * .5, 18, 110);
}
async function dematerialize(){
  F.mode = 'ship'; pose('beam', true); const y1 = beamTopY() - size() * .9;
  beingEl.classList.add('materialize'); beamSparkles(2200);
  await tween(2200, u => { const e = ez(u); F.y = y1 * e; beingEl.style.opacity = String(Math.min(1, (1 - u) * 1.8)); beingEl.style.setProperty('--mat', String(e)); });
  beingEl.style.opacity = '0'; beingEl.classList.remove('materialize');
}
let shipBusy = false;
async function arrive(){
  if(shipBusy) return; shipBusy = true; closePanels(); hideBubble();
  F.mode = 'ship'; beingEl.style.opacity = '0'; makeShip();
  F.x = homeX(); await shipFlyIn(F.x); await beam(true); await materialize(); await beam(false);
  pose('namaste', true);
  say(say$('arrive'), { ms: 4800 });
  await wait(900); shipFlyOut().then(() => { shipBusy = false; });
  await wait(1700);
  idle(1); F.mode = 'act'; pose('wave', true); F.until = now() + 2200; F.then = () => setTimeout(greet, 400);
}
async function depart(then){
  if(shipBusy) return; shipBusy = true; closePanels(); endEverything();
  F.mode = 'ship'; pose('namaste', true); say(say$('leaving'), { ms: 4200 });
  await wait(1400); makeShip(); await shipFlyIn(F.x); await beam(true); hideBubble(); await dematerialize(); await beam(false);
  F.mode = 'away'; await shipFlyOut(); shipBusy = false;
  if(then) then();
}
/* a joyride: up into the ship, across the screen, and back down somewhere new */
async function ride(){
  if(shipBusy) return; shipBusy = true; closePanels(); endEverything();
  F.mode = 'ship'; say(say$('ride'), { ms: 2600 }); pose('wave', true);
  await wait(900); makeShip(); await shipFlyIn(F.x); await beam(true); hideBubble(); await dematerialize(); await beam(false);
  let nx = F.x > W() / 2 ? rand(size(), W() * .4) : rand(W() * .6, W() - size()); nx = clamp(nx, size() * .5, W() - size() * .5);
  await shipMove(nx); F.x = nx; await tween(300, u => shipAt(nx, hoverY() + Math.sin(u * Math.PI) * 4, 0));
  await beam(true); await materialize(); await beam(false);
  pose('hop', true); say(pick(['Wheee! Faster than light, slower than love.', 'New spot! Same good vibes.', 'Never gets old.']), { ms: 3000 });
  await wait(600); await shipFlyOut(); shipBusy = false; idle(2);
}
function endEverything(){
  if(items.sack) endPlay(true);
  if(smoking) endSmoke(true);
  if(F.sitKind === 'meditate') stopMeditate();
  if(F.resting){ F.resting = false; $('#night').classList.remove('on'); }
  F.sitKind = null;
}

/* ------------------------------------------------------------------ resting and meditating */
function rest(own){
  closePanels(); F.mode = 'sit'; F.sitKind = 'rest'; F.resting = true; F.restSince = now(); pose('rest');
  $('#night').classList.add('on'); say(say$('rest'), { ms: 3500, quiet: true }); S.pet.naps++;
}
function wakeUp(byYou){
  F.resting = false; $('#night').classList.remove('on'); F.sitKind = null;
  const grumpy = byYou && S.pet.energy < 45;
  act('idle', 2.5); say(grumpy ? say$('grumpy') : say$('woke'), { ms: 3200 });
}
let drone = null;
function meditate(){
  closePanels(); endEverything(); F.mode = 'sit'; F.sitKind = 'meditate'; pose('meditate');
  $('#aura').classList.add('on'); $('#mandala').classList.add('on');
  say(say$('meditate'), { ms: 4000, quiet: true });
  rig.chakra = 0; const t0 = now(); clearInterval(meditate.iv); meditate.iv = setInterval(() => { rig.chakra = Math.min(1, (now() - t0) / 9000); }, 50);
  try{ const ac = audio(); if(ac && !drone){ const g = ac.createGain(); g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(.04, ac.currentTime + 3);
    const os = [136.1, 204.15, 272.2].map((f, i) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = ac.createGain(); og.gain.value = [1, .35, .2][i]; o.connect(og); og.connect(g); o.start(); return o; });
    g.connect(ac.destination); drone = { g, os, ac }; } }catch(_){}
  clearTimeout(meditate.t); meditate.t = setTimeout(endMeditate, 32000);
}
function stopMeditate(){
  clearTimeout(meditate.t); clearInterval(meditate.iv); rig.chakra = 0; $('#aura').classList.remove('on'); $('#mandala').classList.remove('on');
  if(drone){ const d = drone; drone = null; d.g.gain.linearRampToValueAtTime(0, d.ac.currentTime + 1.5); setTimeout(() => d.os.forEach(o => { try{ o.stop(); }catch(_){} }), 1700); }
}
async function endMeditate(){
  if(F.sitKind !== 'meditate') return;
  stopMeditate(); F.sitKind = null; Care.meditate(S.pet); bondCheck();
  act('namaste', 3.2);
  const line = await brainLine('You and ' + S.cfg.user + ' just meditated together for a minute. Say one short, calm, uplifting sentence to close it.') || Wisdom.thought();
  setTimeout(() => say(line, { thought: true, ms: 9000 }), 800);
}

/* ------------------------------------------------------------------ star food */
const items = { food: [], sack: null };
function spawnFood(food){
  if(S.pet.belly >= 96){ closePanels(); say(say$('full')); return; }
  closePanels();
  const px = size() * .16, el = Props.make(food.id, px); $('#items').appendChild(el);
  const side = F.x > W() / 2 ? -1 : 1;
  const it = { el, food, x: clamp(F.x + side * rand(150, 230), 70, W() - 70), y: 0, vy: 0, rot: 0, state: 'enter', t0: now(), held: false, w: parseFloat(el.style.width), h: parseFloat(el.style.height) };
  el.classList.add('hit', 'grabbable'); el.addEventListener('pointerdown', e => grabFood(it, e));
  const ground = () => { it.state = 'ground'; it.y = 0; it.rot = 0; if(F.mode === 'idle' || F.mode === 'act') F.until = 0; };
  it.ground = ground;
  const a = food.arrive;
  if(a === 'sprout'){ el.classList.add('sprout'); sparkle(it.x, H() - 20, 10, 40); setTimeout(ground, 750); }
  else if(a === 'roll'){ it.from = side > 0 ? W() + 30 : -30; it.x0 = it.x; it.x = it.from; }
  else if(a === 'drop'){ it.y = H() * .6; it.vy = 0; }
  else if(a === 'float'){ it.y = H() * .4; }
  else if(a === 'drone'){ it.drone = Props.ship(px * 1.6, true); $('#items').appendChild(it.drone); it.bx = side > 0 ? W() + 60 : -60; it.y = H() * .45; }
  else { /* beam: a thin column of light, and it condenses out of it */
    const col = document.createElement('div'); col.className = 'minibeam'; col.style.left = (it.x - px * .45) + 'px'; col.style.width = (px * .9) + 'px'; $('#fxBack').appendChild(col);
    setTimeout(() => col.classList.add('off'), 900); setTimeout(() => col.remove(), 1500);
    el.classList.add('condense'); sparkle(it.x, H() - px * .5, 10, 40); setTimeout(ground, 900);
  }
  it.update = dt => {
    if(it.dragging){ it.el.style.transform = 'translate(' + (cur.x - it.w / 2) + 'px,' + (cur.y - it.h / 2) + 'px) rotate(' + (Math.sin(now() / 300) * 6) + 'deg)'; return; }
    if(it.lift){ /* telekinesis: it rises from the floor into his hand */
      const u = ez((now() - it.lift.t0) / it.lift.ms), hp = rig.handR;
      const x = it.lift.x + (hp.x - it.lift.x) * u, y = it.lift.y + (hp.y - it.lift.y) * u - Math.sin(u * Math.PI) * 30;
      it.el.style.transform = 'translate(' + (x - it.w / 2) + 'px,' + (y - it.h * .6) + 'px) rotate(' + (Math.sin(u * 9) * 10 * (1 - u)) + 'deg)';
      if(Math.random() < .5) sparkle(x, y, 1, 14);
      if(u >= 1){ it.lift = null; it.held = true; }
      return;
    }
    if(it.held){ const hp = rig.handR; it.el.style.transform = 'translate(' + (hp.x - it.w / 2) + 'px,' + (hp.y - it.h * .6) + 'px)'; return; }
    if(it.state === 'enter'){
      const t = (now() - it.t0) / 1000;
      if(a === 'roll'){ const u = Math.min(1, t / 1.3), e = 1 - Math.pow(1 - u, 3); it.x = it.from + (it.x0 - it.from) * e; it.rot = (it.x - it.from) * 4; if(u >= 1) ground(); }
      if(a === 'drop'){ it.vy -= 1800 * dt; it.y += it.vy * dt; if(it.y <= 0){ it.y = 0; if(it.vy < -200) it.vy = -it.vy * .35; else ground(); } it.rot = Math.sin(t * 9) * 8 * Math.max(0, 1 - t); if(Math.random() < .3) sparkle(it.x, H() - it.y - it.h / 2, 1, 12, '#ffe7a3'); }
      if(a === 'float'){ it.y = Math.max(0, H() * .4 * (1 - t / 2.4)); it.rot = Math.sin(t * 3) * 6 * (it.y / (H() * .4)); if(it.y <= 0) ground(); }
      if(a === 'drone'){
        const u = Math.min(1, t / 2.4); it.bx += (it.x - it.bx) * Math.min(1, dt * 1.8); const by = H() * .45 - u * H() * .28 + Math.sin(t * 6) * 6;
        it.y = Math.max(0, by - px * 1.0);
        it.drone.style.transform = 'translate(' + (it.bx - px * .8) + 'px,' + (H() - by - px * 1.0) + 'px) rotate(' + (Math.sin(t * 4) * 5) + 'deg)';
        if(u >= 1){ it.state = 'drop'; it.vy = 0; const d = it.drone, dir = it.x > W() / 2 ? 1 : -1, x0 = it.bx, y0 = H() - by - px; it.drone = null;
          tween(1100, k => { d.style.transform = 'translate(' + (x0 - px * .8 + dir * k * k * 600) + 'px,' + (y0 - k * 360) + 'px) rotate(' + (dir * 15) + 'deg)'; }).then(() => d.remove()); }
      }
    } else if(it.state === 'drop'){ it.vy -= 1500 * dt; it.y = Math.max(0, it.y + it.vy * dt); if(it.y === 0) ground(); }
    it.el.style.transform = 'translate(' + (it.x - it.w / 2) + 'px,' + (H() - it.y - it.h) + 'px) rotate(' + it.rot + 'deg)';
  };
  items.food.push(it);
  if(F.resting) wakeUp(false);
  else if(F.mode === 'sit'){ if(F.sitKind === 'meditate') stopMeditate(); F.sitKind = null; idle(.3); }
}
function goEat(it){
  if(it.state !== 'ground'){ idle(.4); return; }
  it.state = 'claimed';
  walkTo(it.x - size() * .2, () => eatSequence(it));
}
function eatSequence(it){
  if(!items.food.includes(it) || it.state !== 'claimed') return idle();
  F.mode = 'eat'; F.until = Infinity; pose('pickup', true);
  const r = it.el.getBoundingClientRect();
  setTimeout(() => { it.el.classList.remove('sprout', 'condense'); it.lift = { t0: now(), ms: 1000, x: r.left + r.width / 2, y: r.top + r.height * .6 }; pose('hold'); }, 450);
  setTimeout(() => startEating(it), 1600);
}
function startEating(it){
  const id = it.food.id;
  if(id === 'tea' || id === 'honey') return sipIt(it);
  takeBites(it, 3);
}
function takeBites(it, n){
  pose('eat', true); let b = 0;
  const one = () => {
    if(!items.food.includes(it)) return;
    Props.bite(it.el); b++;
    const mp = rig.mouth; for(let i = 0; i < 4; i++) crumb(mp.x + rand(-6, 6), mp.y + 4, it.food.id === 'moonberries' ? '#9fe0ff' : it.food.id === 'mushroom' ? '#7af0e0' : '#ffe08a');
    if(b >= n) setTimeout(() => finishFood(it), 500); else setTimeout(one, Rig.EAT_P * 1000);
  };
  setTimeout(one, Rig.EAT_P * 1000 * .42);
}
function sipIt(it){
  pose('sip', true);
  if(it.food.id === 'honey') setTimeout(() => say(pick(['Straight from the jar. No regrets.', 'Mmm... liquid sunlight.']), { ms: 2600 }), 1200);
  setTimeout(() => finishFood(it), Rig.SIP_P * 2000 * .95);
}
function crumb(x, y, col){
  const c = document.createElement('div'); c.className = 'crumb'; c.style.background = col; $('#fx').appendChild(c);
  const vx = rand(-60, 60), t0 = now(); let vy = rand(-80, -20), yy = y, xx = x;
  const go = () => { const dt = 1 / 60; vy += 600 * dt; yy += vy * dt; xx += vx * dt; c.style.transform = 'translate(' + xx + 'px,' + yy + 'px)'; if(now() - t0 < 700) requestAnimationFrame(go); else c.remove(); };
  go();
}
function finishFood(it){
  const i = items.food.indexOf(it); if(i >= 0) items.food.splice(i, 1);
  const r = it.el.getBoundingClientRect(); sparkle(r.left + r.width / 2, r.top + r.height / 2, 10, 40); it.el.remove();
  const res = Care.feed(S.pet, it.food);
  if(!res.ok){ say(say$('full')); return idle(2); }
  act(it.food.id === 'honey' ? 'groove' : 'hop', 1.8);
  say(it.food.line, { ms: 3400 });
  const hp = rig.headPoint(); puff('✨', hp.x, hp.mouth); bondCheck(); persist();
}
/* handing him food: grab it, hold it near him and he reaches, let go and he takes it */
let foodDrag = null;
function grabFood(it, e){
  if(it.held || it.lift || e.button !== 0) return;
  e.stopPropagation(); e.preventDefault();
  if(it.drone){ it.drone.remove(); it.drone = null; }
  it.dragging = true; it.state = 'drag'; it.el.classList.remove('sprout', 'condense'); foodDrag = it;
  if(F.mode === 'walk'){ F.onArrive = null; idle(.2); }
}
function offerTick(){
  const it = foodDrag; if(!it) return;
  const r = rig.box(), s = size(), near = cur.x > r.left - s * .45 && cur.x < r.right + s * .45 && cur.y > r.top - s * .2 && cur.y < H();
  if(near && !it.reaching && F.mode !== 'eat' && F.mode !== 'drag' && F.mode !== 'ship'){
    if(F.resting) wakeUp(false);
    it.reaching = true; F.mode = 'act'; F.until = Infinity; pose('reach');
    if(Math.random() < .5) say(say$('reach'), { ms: 2200 });
  } else if(!near && it.reaching){ it.reaching = false; idle(1); }
}
document.addEventListener('pointerup', () => {
  const it = foodDrag; if(!it) return; foodDrag = null; it.dragging = false;
  const hp = rig.handR, r = rig.box();
  const close = Math.hypot(cur.x - hp.x, cur.y - hp.y) < size() * .4 || (cur.x > r.left && cur.x < r.right && cur.y > r.top && cur.y < r.bottom);
  if(close && F.mode !== 'eat' && F.mode !== 'ship') return takeFromHand(it);
  it.reaching = false; it.x = clamp(cur.x, 30, W() - 30); it.y = Math.max(0, H() - cur.y - it.h / 2); it.vy = 0; it.state = 'drop'; it.rot = 0;
  if(F.mode === 'act') idle(.5);
});
function takeFromHand(it){
  it.state = 'handed'; it.held = true; F.mode = 'eat'; F.until = Infinity; pose('hold');
  say(say$('thanks'), { ms: 2400 });
  Care.pet(S.pet); S.pet.bond += 1; bondCheck();
  setTimeout(() => startEating(it), 500);
}

/* ------------------------------------------------------------------ the peace pipe */
let smoking = null;
function smoke(){
  closePanels();
  if(smoking) return endSmoke();
  if(F.resting) wakeUp(false);
  if(F.sitKind === 'meditate') stopMeditate();
  F.sitKind = null;
  const L = size() * .32, el = Props.make('pipe', L); el.classList.add('pipe'); $('#items').appendChild(el);
  smoking = { el, L, h: parseFloat(el.style.height), puffNo: 0, lastU: null, did: {}, lastWisp: 0 };
  F.mode = 'eat'; F.until = Infinity; pose('smoke', true);
  setTimeout(() => { if(smoking) say(say$('smoke'), { ms: 3200 }); }, 300);
}
function smokeTick(){
  const sm = smoking; if(!sm) return;
  if(rig.clip !== 'smoke'){ return; }
  const u = (rig.t % Rig.SMOKE_P) / Rig.SMOKE_P;
  if(sm.lastU != null && u < sm.lastU - .5){ sm.puffNo++; sm.did = {}; }
  sm.lastU = u;
  if(sm.puffNo >= 3) return endSmoke();
  const k = ez((u - .06) / .16) * (1 - ez((u - .48) / .12)), hp = rig.handR, mp = rig.mouth, L = sm.L;
  const a0 = -38, a1 = 10, ang = a0 + (a1 - a0) * k, r = ang * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  const restX = hp.x - cs * L * .3, restY = hp.y - sn * L * .3;
  const mx = restX + (mp.x - restX) * k, my = restY + (mp.y + 1 - restY) * k;
  sm.el.style.transform = 'translate(' + mx.toFixed(1) + 'px,' + (my - sm.h / 2).toFixed(1) + 'px) rotate(' + ang.toFixed(1) + 'deg)';
  const tip = { x: mx + cs * L * .91 - sn * -sm.h * .3, y: my + sn * L * .91 + cs * -sm.h * .3 };
  sm.el.classList.toggle('drawing', u > .22 && u < .48);
  if(now() - sm.lastWisp > 260){ sm.lastWisp = now(); cloudPuff(tip.x, tip.y, { r: size() * .02, life: 2200, rise: size() * .25, hue: rand(260, 330), a: .5 }); }
  if(u > .62 && u < .9){
    const once = (key, fn) => { if(!sm.did[key]){ sm.did[key] = true; fn(); } };
    if(sm.puffNo === 0) once('c0', () => smokeCloud(mp.x, mp.y, 14));
    if(sm.puffNo === 1){ [0, 1, 2].forEach(i => { if(u > .64 + i * .07) once('r' + i, () => smokeRing(mp.x, mp.y)); }); once('c1', () => smokeCloud(mp.x, mp.y, 6)); }
    if(sm.puffNo === 2) once('big', () => { smokeCloud(mp.x, mp.y, 10); geoBloom(mp.x, mp.y - size() * .55); });
  }
}
function cloudPuff(x, y, o){
  const d = document.createElement('div'); d.className = 'smoke'; d.style.setProperty('--h', String(o.hue || 280)); $(o.front ? '#fx' : '#fxBack').appendChild(d);
  const t0 = now(), vx = (o.dx || 0) + rand(-14, 14), start = o.r, life = o.life || 2400;
  const go = () => { const k = (now() - t0) / life; if(k >= 1){ d.remove(); return; }
    const rr = start * (1 + k * 2.6); d.style.width = d.style.height = (rr * 2) + 'px';
    d.style.transform = 'translate(' + (x + vx * k * 3 + Math.sin(k * 6 + start) * 8 - rr) + 'px,' + (y - (o.rise || 60) * k - rr) + 'px)';
    d.style.opacity = String((o.a || .7) * (1 - k) * (k < .1 ? k / .1 : 1)); requestAnimationFrame(go); };
  go();
}
function smokeCloud(x, y, n){ const s = size(); for(let i = 0; i < n; i++) setTimeout(() => cloudPuff(x + rand(-4, 4), y, { r: s * rand(.03, .06), life: rand(3000, 4400), rise: s * rand(.35, .55), dx: rand(5, 25), hue: 200 + i * 14 + rand(-10, 10), a: .65, front: Math.random() < .4 }), i * 55); }
function smokeRing(x, y){
  const d = document.createElement('div'); d.className = 'sring'; d.style.setProperty('--h', String(rand(180, 320))); $('#fx').appendChild(d);
  const t0 = now(), life = 2600, s = size();
  const go = () => { const k = (now() - t0) / life; if(k >= 1){ d.remove(); return; } const r = s * (.03 + .09 * eoc(k));
    d.style.width = (r * 2) + 'px'; d.style.height = (r * 1.3) + 'px'; d.style.transform = 'translate(' + (x + 30 * k + 10 - r) + 'px,' + (y - s * .5 * k - r * .65) + 'px)'; d.style.opacity = String(.85 * (1 - k)); requestAnimationFrame(go); };
  go();
}
/* the big exhale opens into sacred geometry: a flower of life, Metatron's lines, then sparkles */
function geoBloom(cx, cy){
  const R = size() * .62, el = document.createElement('div'); el.className = 'geo';
  el.style.left = (cx - R) + 'px'; el.style.top = (cy - R) + 'px'; el.style.width = el.style.height = (R * 2) + 'px';
  const r = 10, COLS = ['#ffd36b', '#ff7ad9', '#7af0ff', '#b98cff', '#8dff9e', '#ffa86b'];
  const circ = (x, y, rr, col, dl) => '<circle class="ln" cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="' + rr + '" fill="none" stroke="' + col + '" stroke-width=".7" pathLength="100" style="animation-delay:' + dl.toFixed(2) + 's"/>';
  const pts = [[50, 50]]; for(let ring = 1; ring <= 2; ring++) for(let k = 0; k < 6 * ring; k++){ const a = Math.PI * 2 * k / (6 * ring) - Math.PI / 2, d = ring === 1 ? r : (k % 2 ? r * Math.sqrt(3) : 2 * r); pts.push([50 + d * Math.cos(a), 50 + d * Math.sin(a)]); }
  let g1 = pts.map((p, i) => circ(p[0], p[1], r, COLS[i % 6], i * .06)).join('') + circ(50, 50, 3 * r, '#ffe7b0', 1) + circ(50, 50, 3 * r + 2.5, '#c9a6ff', 1.2);
  const M = [[50, 50]]; for(let k = 0; k < 6; k++){ const a = Math.PI * 2 * k / 6 - Math.PI / 2; M.push([50 + 20 * Math.cos(a), 50 + 20 * Math.sin(a)], [50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)]); }
  let g2 = ''; for(let i = 0; i < M.length; i++) for(let j = i + 1; j < M.length; j++) g2 += '<line class="ln" x1="' + M[i][0].toFixed(2) + '" y1="' + M[i][1].toFixed(2) + '" x2="' + M[j][0].toFixed(2) + '" y2="' + M[j][1].toFixed(2) + '" stroke="#9fe8ff" stroke-width=".35" pathLength="100" style="animation-delay:' + (1.3 + (i + j) * .02).toFixed(2) + 's"/>';
  el.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%"><g class="g1">' + g1 + '</g><g class="g2" opacity=".85">' + g2 + '</g></svg>';
  $('#fx').appendChild(el);
  const g1e = el.querySelector('.g1'), g2e = el.querySelector('.g2'), t0 = now(), LIFE = 7000;
  const go = () => { const t = (now() - t0) / LIFE; if(t >= 1){ el.remove(); return; }
    const s = .25 + .8 * eoc(t / .3) + .04 * Math.sin(t * 15) + .3 * ez((t - .82) / .18);
    el.style.transform = 'scale(' + s.toFixed(3) + ')'; el.style.opacity = String(Math.min(1, t / .06) * (1 - ez((t - .84) / .16)));
    g1e.setAttribute('transform', 'rotate(' + (140 * t) + ' 50 50)'); g2e.setAttribute('transform', 'rotate(' + (-90 * t) + ' 50 50)'); requestAnimationFrame(go); };
  go();
  setTimeout(() => sparkle(cx, cy, 34, R * 1.1), 5800);
}
function endSmoke(quiet){
  const sm = smoking; if(!sm) return; smoking = null;
  sm.el.style.transition = 'opacity .5s'; sm.el.style.opacity = '0'; setTimeout(() => sm.el.remove(), 600);
  if(quiet) return;
  S.pet.joy = Care.clamp(S.pet.joy + 10); S.pet.energy = Care.clamp(S.pet.energy - 4); S.pet.bond += 1.5; bondCheck(); persist();
  act('groove', 7); setTimeout(() => say(say$('smokeEnd'), { ms: 3800 }), 200);
}

/* ------------------------------------------------------------------ hacky sack (same physics as Fern's) */
function startPlay(){
  closePanels();
  if(items.sack){ endPlay(); return; }
  if(F.resting){ F.resting = false; $('#night').classList.remove('on'); }
  if(F.sitKind === 'meditate') stopMeditate(); F.sitKind = null;
  const el = Props.make('sack', size() * .085); el.classList.add('sack', 'hit'); $('#items').appendChild(el);
  const sk = { el, x: F.x + size() * .14, y: size() * .4, vx: 0, vy: 0, t0: now(), streak: 0, best: 0, lastKick: 0, lastToss: now(), lastHit: 0, byYou: 0, rally: 0, bestRally: 0, lastBy: '' };
  el.addEventListener('pointerdown', e => { e.stopPropagation(); youHit(sk, rand(-140, 140), 920); });
  items.sack = sk; F.mode = 'play'; pose('ready');
  say(pick(['Hacky sack! Earth\'s greatest invention.', 'Ooh, the footbag. Watch this.', 'Let\'s get the energy moving!']) + ' Swipe it with your mouse to pass it to me.', { ms: 4200 });
  tossUp(sk);
}
function endPlay(quiet){
  const sk = items.sack; if(!sk) return; sk.el.remove(); items.sack = null;
  if(quiet) return;
  say((sk.bestRally >= 3 ? 'Best rally: ' + sk.bestRally + '. ' : sk.best >= 5 ? 'Best run: ' + sk.best + '. ' : '') + say$('playEnd'), { ms: 3200 }); idle(3);
}
const GRAV = 1500, KICK_PEAK = Rig.KICK_T * .5;
function tossUp(sk){ sk.lastToss = now(); pose('toss', true); setTimeout(() => { if(items.sack === sk && !sk.kicking) pose('ready'); }, 280);
  sk.x = rig.handR.x; sk.y = H() - rig.handR.y; sk.vy = rand(480, 560); sk.vx = (F.x - sk.x) * 1.4; }
function kickSack(sk){
  if(now() - sk.byYou < 8000 && cur.x >= 0){
    sk.vy = rand(820, 940); sk.vx = clamp((cur.x - sk.x) * .85, -560, 560);
    if(sk.lastBy === 'you'){ sk.rally++; if(sk.rally > sk.bestRally) sk.bestRally = sk.rally; if([3, 6, 10, 15, 20, 30].includes(sk.rally)) say('Rally of ' + sk.rally + '! ' + pick(['Cosmic pass!', 'You\'ve got moves.', 'Keep it alive!']), { ms: 1800, quiet: true }); }
  } else { sk.vy = rand(640, 780); sk.vx = (F.x - sk.x) * 2.2 + rand(-45, 45); }
  sk.lastBy = 'aurion'; sk.streak++; Care.kick(S.pet); thock(.25); sparkle(sk.x, H() - sk.y, 4, 22);
  if(sk.streak > sk.best) sk.best = sk.streak;
  if(sk.streak === 5 || sk.streak % 10 === 0) say(sk.streak + ' in a row! ' + say$('play'), { ms: 1800, quiet: true });
}
function startKick(sk, side, tHit, lands){
  sk.lastKick = now(); sk.kicking = true; pose('kick' + side, true);
  setTimeout(() => { sk.kicking = false; if(items.sack === sk && F.mode === 'play') pose('ready'); }, Rig.KICK_T * 1000);
  setTimeout(() => {
    if(items.sack !== sk || sk.y > size() * .6 || Math.abs(sk.x - F.x) > size() * .3) return;
    if(lands){ const f = side === 'L' ? rig.footL : rig.footR; sk.x += (f.x - sk.x) * .6; kickSack(sk); }
  }, Math.max(0, tHit * 1000));
}
function play(dt){
  const sk = items.sack, s = size();
  if(now() - sk.t0 > 120000 || S.pet.energy < 10) return endPlay();
  if(F.mode === 'idle' || (F.mode === 'act' && now() > F.until)){ F.mode = 'play'; pose('ready'); F.vx = 0; }
  if(F.mode !== 'play') return;
  const kickH = 70 * rig.k, inAir = sk.y > .5 || sk.vy > 0;
  let want = 0;
  if(inAir){
    const disc = sk.vy * sk.vy + 2 * GRAV * (sk.y - kickH), tHit = disc > 0 ? (sk.vy + Math.sqrt(disc)) / GRAV : 0;
    const tx = clamp(sk.x + sk.vx * tHit, s * .3, W() - s * .3), d = tx - F.x;
    if(Math.abs(d) > s * .03) want = clamp(d * 4.5, -260 * s / 240, 260 * s / 240);
    if(sk.vy < 0 && !sk.kicking && tHit <= KICK_PEAK + .02 && tHit > 0 && Math.abs(tx - F.x) < s * .22 && now() - sk.lastKick > 380){
      const skill = .95 - Math.min(.3, sk.streak * .012) - (S.pet.energy < 30 ? .15 : 0);
      startKick(sk, tx < F.x ? 'L' : 'R', tHit, Math.random() < skill);
    }
  } else {
    if(sk.streak){ if(sk.streak >= 3) say(pick(['Ah, dropped it. ', 'Whoops. ', 'Gravity wins this round. ']) + sk.streak + ' that time.', { ms: 1800, quiet: true }); sk.streak = 0; }
    const d = (sk.x - s * .12) - F.x;
    if(Math.abs(d) > s * .05) want = clamp(d * 3, -110 * s / 240, 110 * s / 240);
    else if(now() - sk.lastToss > 900){ tossUp(sk); }
  }
  const k = Math.abs(want) > Math.abs(F.vx) ? 7 : 5;
  F.vx += (want - F.vx) * Math.min(1, dt * k);
  if(sk.kicking) F.vx *= Math.pow(.02, dt);
  F.x = clamp(F.x + F.vx * dt, s * .25, W() - s * .25);
}
function youHit(sk, vx, vy){
  if(sk.lastBy === 'aurion' && now() - sk.byYou > 8000) sk.rally = 0;
  sk.vx = clamp(vx, -760, 760); sk.vy = clamp(vy, 380, 1150); if(sk.y < 2) sk.y = 2;
  sk.lastHit = now(); sk.byYou = now(); sk.lastBy = 'you'; sk.streak = 0;
  thock(.35); puff('✨', sk.x, H() - sk.y - 20);
}
let audioCtx = null;
function audio(){ try{ audioCtx = audioCtx || new AudioContext(); if(audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx; }catch(_){ return null; } }
function thock(v){
  try{ const ac = audio(); if(!ac) return; const t = ac.currentTime, len = Math.floor(ac.sampleRate * .07);
    const b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = b; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = v || .3;
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t); }catch(_){}
}
function stepItems(dt){
  for(const it of items.food) it.update(dt);
  const sk = items.sack;
  if(sk){
    sk.vy -= GRAV * dt; sk.y += sk.vy * dt; sk.x += sk.vx * dt;
    if(sk.y <= 0){ sk.y = 0; if(sk.vy < -160){ sk.vy = -sk.vy * .42; sk.streak = 0; } else sk.vy = 0; sk.vx *= .9; }
    if(sk.x < 14){ sk.x = 14; sk.vx = Math.abs(sk.vx) * .6; } if(sk.x > W() - 14){ sk.x = W() - 14; sk.vx = -Math.abs(sk.vx) * .6; }
    if(sk.y > H() - 30){ sk.y = H() - 30; sk.vy = -Math.abs(sk.vy) * .5; }
    if(now() - sk.lastHit > 180 && cur.x >= 0){
      const d = Math.hypot(cur.x - sk.x, cur.y - (H() - sk.y - 10)), fresh = now() - curV.t < 150, sp = fresh ? Math.hypot(curV.x, curV.y) : 0;
      if(d < 62 && sp > 90) youHit(sk, curV.x * .6, -curV.y * .6 + 520);
      else if(d < 42 && sk.vy < 0) youHit(sk, (sk.x - cur.x) * 6, rand(680, 820));
    }
    if(sk.y === 0) sk.vx *= Math.pow(.2, dt);
    sk.el.style.transform = 'translate(' + sk.x + 'px,' + (H() - sk.y) + 'px) translate(-50%,-100%) rotate(' + (sk.x * 2 % 360) + 'deg)';
  }
}

/* ------------------------------------------------------------------ bond */
function bondCheck(){
  if(Care.levelUp(S.pet)){
    const b = Care.bondInfo(S.pet.bond);
    act('hop', 2.6);
    setTimeout(() => say('We\'re ' + b.name.toLowerCase() + ' now, ' + S.cfg.user + '. That means the universe to me.', { ms: 6000 }), 300);
    for(let i = 0; i < 8; i++) setTimeout(() => { const hp = rig.headPoint(); puff(pick(['💜', '✨', '🌟']), hp.x + rand(-40, 40), hp.top + rand(20, 80)); }, i * 120);
    renderPantry();
  }
}

/* ------------------------------------------------------------------ mouse: hover, click-through, petting, dragging */
let interactive = false, cur = { x: -1, y: -1 }, press = null, dragging = false;
let curV = { x: 0, y: 0, t: 0 }, lastMv = null;
function overSomething(x, y){
  if(dragging || press || foodDrag) return true;
  if(F.mode !== 'away' && rig.hit(x, y)) return true;
  const el = document.elementFromPoint(x, y);
  return !!(el && el.closest && el.closest('.hit'));
}
function updateHover(x, y){ const on = overSomething(x, y); if(on !== interactive){ interactive = on; host.ignoreMouse(!on); } document.body.classList.toggle('overHim', on && rig.hit(x, y)); }
let petTrail = [], lastPet = 0;
function onMove(x, y){
  if(x !== cur.x || y !== cur.y){
    if(userIdle() > 15 * 60000 && !F.resting && F.mode !== 'sit' && F.mode !== 'away') setTimeout(() => say(say$('back')), 400);
    lastActive = now();
  }
  const tt = performance.now();
  if(lastMv){ const ddt = (tt - lastMv.t) / 1000; if(ddt > .004 && ddt < .2) curV = { x: (x - lastMv.x) / ddt, y: (y - lastMv.y) / ddt, t: now() }; }
  lastMv = { x, y, t: tt };
  cur = { x, y }; updateHover(x, y);
  if(press && !dragging && Math.hypot(x - press.x, y - press.y) > 6) startDrag();
  if(dragging){ const nx = clamp(x - press.ox, 10, W() - 10); F.vx = F.vx * .7 + (nx - F.x) * 60 * .3; F.x = nx; F.y = clamp(H() - y - press.oy, 0, H() - 40); return; }
  if(!press && rig.hit(x, y) && !F.resting && F.mode !== 'ship'){
    const t = now(); petTrail.push({ x, y, t }); petTrail = petTrail.filter(p => t - p.t < 1600);
    let d = 0; for(let i = 1; i < petTrail.length; i++) d += Math.hypot(petTrail[i].x - petTrail[i - 1].x, petTrail[i].y - petTrail[i - 1].y);
    if(d > 420 && t - lastPet > 2500){ lastPet = t; petTrail = []; petted(); }
  }
}
function petted(){
  F.petAt = now();
  Care.pet(S.pet); bondCheck();
  const hp = rig.headPoint();
  for(let i = 0; i < 3; i++) setTimeout(() => puff(pick(['💜', '✨', '💫']), hp.x + rand(-26, 26), hp.top + rand(30, 70)), i * 140);
  if(F.mode === 'idle' || F.mode === 'act') act('wave', 1.6);
  if(Math.random() < .5) say(say$('pet'), { ms: 1800, quiet: true });
}
document.addEventListener('pointermove', e => onMove(e.clientX, e.clientY));
host.onCursor(p => onMove(p.x, p.y));
document.addEventListener('pointerdown', e => {
  if(e.button !== 0 || F.mode === 'ship' || F.mode === 'away') return;
  if(!rig.hit(e.clientX, e.clientY)) return;
  e.preventDefault(); audio();
  press = { x: e.clientX, y: e.clientY, ox: e.clientX - F.x, oy: (H() - F.y) - e.clientY };
});
document.addEventListener('pointerup', () => {
  if(!press) return;
  if(dragging){ dragging = false; document.body.classList.remove('dragging'); F.mode = F.y > 2 ? 'fall' : 'idle'; F.vy = 0; if(F.mode === 'idle') idle(1); else pose('float'); }
  else clickHim();
  press = null; updateHover(cur.x, cur.y);
});
document.addEventListener('contextmenu', e => {
  if(!rig.hit(e.clientX, e.clientY) || F.mode === 'ship' || F.mode === 'away') return;
  e.preventDefault(); togglePanel('menu');
});
function startDrag(){
  if(smoking) endSmoke(true);
  dragging = true; document.body.classList.add('dragging'); closePanels();
  if(F.resting){ F.resting = false; $('#night').classList.remove('on'); }
  if(F.sitKind === 'meditate') stopMeditate(); F.sitKind = null; clearTimeout(sitFor.t);
  F.mode = 'drag'; pose('drag');
  press.ox = press.x - F.x; press.oy = (H() - F.y) - press.y;
  if(Math.random() < .35) say(pick(['Whoa! Where are we going?', 'Wheee!', 'Interdimensional taxi!']), { ms: 1600, quiet: true });
}
function clickHim(){
  if(F.resting){ wakeUp(true); return; }
  if(F.sitKind === 'meditate'){ endMeditate(); return; }
  if(F.sitKind === 'chill'){ F.sitKind = null; idle(6); togglePanel('menu'); return; }
  togglePanel('menu');
}

/* ------------------------------------------------------------------ panels */
const PANELS = ['menu', 'pantry', 'needs', 'chat', 'settings'];
function closePanels(keepChat){ PANELS.forEach(p => { if(keepChat && p === 'chat') return; $('#' + p).hidden = true; }); if(!keepChat) F.chatting = false; }
function togglePanel(name){
  const el = $('#' + name), open = el.hidden;
  closePanels(name !== 'chat' && !$('#chat').hidden);
  if(open){ el.hidden = false; placeFloating(); if(name !== 'menu') hideBubble(); }
}
function placeFloating(){
  const hp = rig.headPoint(), m = $('#menu');
  const cy = H() - F.y - size() * .5;
  $('#aura').style.transform = 'translate(' + F.x + 'px,' + cy + 'px)';
  $('#mandala').style.transform = 'translate(' + F.x + 'px,' + (H() - F.y - (62 + 140) * rig.k) + 'px)';
  $('#night').style.setProperty('--nx', F.x + 'px'); $('#night').style.setProperty('--ny', cy + 'px');
  if(F.resting && now() > (F.nextZ || 0)){ F.nextZ = now() + 1700; puff('z', hp.x + 16, hp.top + 40, 'z'); }
  if(!m.hidden){ const r = m.getBoundingClientRect(); m.style.transform = 'translate(' + clamp(hp.x - r.width / 2, 8, W() - r.width - 8) + 'px,' + Math.max(8, hp.top - r.height - 4) + 'px)'; }
  for(const id of ['pantry', 'needs', 'settings', 'chat']){
    const el = $('#' + id); if(el.hidden) continue;
    const r = el.getBoundingClientRect(), half = size() * .3;
    let left = F.x > W() / 2 ? F.x - half - r.width - 14 : F.x + half + 14;
    if(left < 8 || left + r.width > W() - 8) left = clamp(hp.x - r.width / 2, 8, W() - r.width - 8);
    const top = clamp(H() - r.height - 18, 8, H() - r.height - 8);
    el.style.transform = 'translate(' + left + 'px,' + top + 'px)';
  }
}
$('#menu').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return; audio();
  const a = b.dataset.act;
  if(a === 'menuClose'){ closePanels(); return; }
  if(a === 'talk'){ closePanels(); openChat(); }
  else if(a === 'listen'){ closePanels(); talkOutLoud(); }
  else if(a === 'voice') setVoice(!S.cfg.voice);
  else if(a === 'convo') setConvo(!S.cfg.convo);
  else if(a === 'feed'){ renderPantry(); togglePanel('pantry'); }
  else if(a === 'play') startPlay();
  else if(a === 'meditate') meditate();
  else if(a === 'smoke') smoke();
  else if(a === 'rest') rest(false);
  else if(a === 'wisdom'){ closePanels(); transmission(); }
  else if(a === 'ship'){ closePanels(); ride(); }
  else if(a === 'needs'){ drawNeeds(); togglePanel('needs'); }
  else if(a === 'settings'){ fillSettings(); togglePanel('settings'); }
  else if(a === 'bye') bye();
  else if(a === 'focus'){ closePanels(); if(window.Focus) Focus.open(); }
  else if(a === 'forget'){ closePanels(); forgetMe(); }
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $('#' + b.dataset.close).hidden = true; if(b.dataset.close === 'chat') F.chatting = false; }));
addEventListener('keydown', e => { if(e.key === 'Escape'){ closePanels(); hideBubble(); } });
function renderPantry(){
  const lvl = Care.bondLevel(S.pet.bond), box = $('#foods'); box.innerHTML = '';
  Care.FOODS.forEach(f => {
    const b = document.createElement('button'), locked = lvl < f.lvl;
    b.innerHTML = '<b>' + (locked ? '🔒' : f.icon) + '</b>' + (locked ? Care.BOND_NAMES[f.lvl] : f.name);
    b.disabled = locked; b.title = locked ? 'Unlocks when you two are ' + Care.BOND_NAMES[f.lvl].toLowerCase() : f.name;
    b.onclick = () => spawnFood(f); box.appendChild(b);
  });
}
function drawNeeds(){
  const p = S.pet, bar = (id, v) => { const e = $(id); e.style.width = v + '%'; e.className = v < 25 ? 'low' : v < 50 ? 'mid' : ''; };
  bar('#mBelly', p.belly); bar('#mEnergy', p.energy); bar('#mJoy', p.joy);
  const b = Care.bondInfo(p.bond); $('#mBond').style.width = b.pct + '%'; $('#bondName').textContent = b.name;
  $('#moodWord').textContent = Care.mood(p) + (F.resting ? ' · recharging' : ''); $('#needs').title = 'Mood: ' + Care.mood(p) + ' · aura: ' + auraState();
  $('#daysLine').textContent = 'Day ' + Care.daysTogether(p) + ' on Earth together · fed ' + p.fed + ' times · ' + p.chats + ' talks · ' + p.kicks + ' kicks';
}
function transmission(){ act('think', 1.2, () => { rig.chakra = 1; setTimeout(() => rig.chakra = 0, 3500); act('namaste', 1); say(Wisdom.transmission(S.cfg.user), { ms: 10000 }); }); const hp = rig.headPoint(); sparkle(hp.x, hp.top + 60 * rig.k, 16, 60); }

/* ------------------------------------------------------------------ settings */
function fillSettings(){
  const c = S.cfg;
  $('#sUser').value = c.user; $('#sSize').value = String(c.size); $('#sVoice').checked = c.voice; $('#sWander').checked = c.wander; $('#sThoughts').checked = c.thoughts; if($('#sBig')){ $('#sBig').checked = !!c.bigBrain; $('#brainRow').hidden = !host.canBigBrain; } if(WEB && $('#sBrain')){ $('#sBrain').parentNode.hidden = true; if($('#sBrain').parentNode.nextElementSibling) $('#sBrain').parentNode.nextElementSibling.hidden = true; }
  $('#sSpeed').value = c.voiceSpeed; $('#sSpeedVal').textContent = (+c.voiceSpeed).toFixed(2) + '×'; fillVoices(); $('#sHome').value = c.home || 'right'; $('#sVisor').checked = c.visor; $('#sArrive').checked = c.arrive; $('#sBrain').value = c.brainUrl || '';
  $('#autoRow').hidden = WEB; $('#bHide').hidden = WEB;
  if(!WEB) host.autostart().then(on => { $('#sAuto').checked = !!on; });
}
$('#settings').addEventListener('change', e => {
  const c = S.cfg, t = e.target;
  if(t.id === 'sUser') c.user = t.value.trim() || 'starseed';
  if(t.id === 'sSize'){ c.size = +t.value; rig.setSize(c.size); }
  if(t.id === 'sVoice') setVoice(t.checked);
  if(t.id === 'sConvo') setConvo(t.checked);
  if(t.id === 'sWake'){ c.wake = t.checked; }
  if(t.id === 'sHome'){ c.home = t.value; if(!F.chatting) walkTo(homeX()); }
  if(t.id === 'sWander') c.wander = t.checked;
  if(t.id === 'sThoughts') c.thoughts = t.checked;
  if(t.id === 'sBig'){ c.bigBrain = t.checked; if(t.checked && host.loadBrain) host.loadBrain().then(x => say(x ? 'My mind just got a lot bigger, ' + c.user + '.' : 'This device can\'t run my bigger brain, so I\'ll speak from the heart.', { ms: 4000 })); }
  if(t.id === 'sVisor'){ c.visor = t.checked; rig.setVisor(c.visor); }
  if(t.id === 'sArrive') c.arrive = t.checked;
  if(t.id === 'sBrain') c.brainUrl = t.value.trim();
  if(t.id === 'sAuto') host.autostart(t.checked);
  persist();
});
$('#sUser').addEventListener('input', e => { S.cfg.user = e.target.value.trim() || 'starseed'; persist(); });
$('#bRide').onclick = () => { closePanels(); ride(); };
$('#bHide').onclick = () => host.hide();
$('#bQuit').onclick = () => bye();

/* ------------------------------------------------------------------ voice (voice.js: Piper → Windows voice → browser voice) */
function speak(text){ Voice.speak(text, { voice: S.cfg.voiceName, speed: S.cfg.voiceSpeed }); }
const speaking = () => Voice.speaking();
function stopSpeech(){ Voice.stop(); }
/* one switch, three places: his menu, the tray, and settings */
function setVoice(on, quiet){
  S.cfg.voice = !!on; persist();
  if(!on) stopSpeech(); else if(!quiet) speak('Hello, ' + S.cfg.user + '. This is my voice.');
  syncVoiceUI();
}
function setConvo(on){ S.cfg.convo = !!on; persist(); syncVoiceUI(); if(on){ closePanels(true); startHandsFree(); } else { stopHandsFree(); say('Okay, ' + S.cfg.user + ', I\'ll only listen when you ask.', { ms: 3000, convo: true }); } }
function syncVoiceUI(){
  syncPill();
  const cb = $('#menu [data-act="convo"]'); if(cb) cb.innerHTML = S.cfg.convo ? '<span>🗣️</span>Conversation: On' : '<span>🗣️</span>Conversation: Off';
  if($('#sConvo')) $('#sConvo').checked = !!S.cfg.convo; if($('#sWake')) $('#sWake').checked = !!S.cfg.wake;
  const b = $('#menu [data-act="voice"]'); if(b) b.innerHTML = S.cfg.voice ? '<span>🔊</span>Voice: On' : '<span>🔇</span>Voice: Off';
  $('#sVoice').checked = S.cfg.voice; if(host.voiceState) host.voiceState(S.cfg.voice);
}
async function fillVoices(){
  const inf = await Voice.info(true), sel = $('#sVoiceName'); sel.innerHTML = '';
  const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
  if(inf.piper && inf.voices.length) inf.voices.forEach(v => add(v, v.replace(/^en_(GB|US)-/, '').replace(/-(medium|high|low)$/, '') + ' (' + v + ')'));
  if(!inf.piper || !inf.voices.length) add('', WEB ? 'Browser voice' : 'Windows built-in voice');
  sel.value = inf.voices.includes(S.cfg.voiceName) ? S.cfg.voiceName : sel.options[0].value;
  $('#voiceHint').textContent = WEB ? 'Neural Piper voice loads in the background (the browser voice speaks until it is ready). Ears: Whisper runs right in your browser; nothing is sent anywhere.' :
    (inf.piper && inf.voices.length ? 'Neural voice (Piper) ready. ' : 'Piper voice not found, so he uses the Windows voice. ') +
    (inf.ears ? 'Ears: VERDANT Whisper is listening.' : inf.wakeable ? 'Ears: VERDANT Whisper wakes up when you talk.' : 'Ears: Windows dictation.');
}
$('#sVoiceName').addEventListener('change', e => { S.cfg.voiceName = e.target.value; if(host.setVoice) host.setVoice(e.target.value); persist(); speak('This is how I sound now, ' + S.cfg.user + '.'); });
$('#sSpeed').addEventListener('input', e => { S.cfg.voiceSpeed = +e.target.value; $('#sSpeedVal').textContent = S.cfg.voiceSpeed.toFixed(2) + '×'; persist(); });
$('#sSpeed').addEventListener('change', () => speak('Slow and starry, ' + S.cfg.user + '.'));
$('#bTestVoice').onclick = () => speak('Greetings, ' + S.cfg.user + '. I am Aurion of the Pleiades. Can you hear the stars in my voice?');

/* ---- talking out loud: push-to-talk in the chat ---- */
const micEl = $('#mic');
let micBusy = false, micDownAt = 0;
function tell(m){ addMsg('aurion', m); say(m); }
async function micStart(){
  if(micBusy || Voice.recording()) return;
  if(!Voice.canListen()){ tell('My ears cannot open in this browser, ' + S.cfg.user + '. Type to me here instead.'); return; }
  stopSpeech();
  try{ await Voice.record(() => { if(Voice.recording()) micStop(); }); micEl.classList.add('on'); micEl.title = 'Listening… click again to send'; syncPill(); if($('#chat').hidden) say('Listening, ' + S.cfg.user + '… click me when you are done.', { sticky: true, silent: true, buttons: [['✓ Done', () => micStop()]] });
    clearTimeout(micStart.cap); micStart.cap = setTimeout(micStop, 20000); }
  catch(_){ tell('I cannot reach your microphone, ' + S.cfg.user + '. Check that one is plugged in and allowed for this page' + (WEB ? ' (tap the lock icon by the address bar).' : ' in Windows privacy settings (Microphone).')); }
}
async function micStop(){
  clearTimeout(micStart.cap);
  const r = Voice.stopRecord(); micEl.classList.remove('on'); micEl.title = 'Push to talk'; syncPill();
  if(!r) return; if(bubUntil === Infinity) hideBubble();
  if(r.secs < .5){ return; }
  heardTurn(r.wav, 'ptt');
}
/* one spoken turn: transcribe → the chat's own reply → spoken in the cloud. He ALWAYS answers. */
let convoUntil = 0, pillBusy = '';
function inConvo(){ return micBusy || now() < convoUntil; }
/* how: 'ptt' (button), 'once' (Talk out loud: one hands-free turn), 'free' (conversation mode, always listening) */
const WAKE = /\b(a[uw]?r[iy]?[aeo]?n|orion|o'?r[iy]?[ae]?n|oreon|arian|marion|aurora)\b[,.!?]?\s*/i;   // Whisper spells his name many ways
let lastReplyAt = 0, heardRecent = [];
function echoOfHim(text){
  /* is this just his own recent words coming back through the speakers? */
  const w = t => String(t).toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(x => x.length > 2);
  const mine = w(text); if(mine.length < 2) return false;
  if(mine.length < 6){ /* short phrases (e.g. a repeated question) share common words with his answers: only call it echo if it is a contiguous piece of a line he JUST said */
    if(Voice.spokeAgo() > 4000) return false;
    const ph = mine.join(' '); return Voice.recentLines().some(l => (' ' + w(l).join(' ') + ' ').includes(' ' + ph + ' '));
  }
  return Voice.recentLines().some(l => { const his = new Set(w(l)); const hit = mine.filter(x => his.has(x)).length; return hit / mine.length >= .6; });
}
/* fuzzy, punctuation-proof wake word: "Aurion", "Orion.", "O'Ryan", "Arion", "a ryan", "Oreon"... in the first few words */
const WAKE_SET = new Set(['aurion','aurian','auryon','orion','orian','oryan','oreon','arion','arian','aryan','orien','aureon','auron','oran','marion','aurora','ourion','orient']);
function lev(a, b){ const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for(let j = 1; j <= b.length; j++) d[0][j] = j;
  for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)); return d[a.length][b.length]; }
function isWakeTok(t){ if(!t || t.length < 4 || t.length > 8) return false; if(WAKE_SET.has(t)) return true;
  return /^[aeiouh]/.test(t) && (lev(t, 'aurion') <= 2 || lev(t, 'orion') <= 1); }
function findWake(text){
  const raw = String(text || ''), toks = []; const re = /[A-Za-z']+/g; let m;
  while((m = re.exec(raw)) && toks.length < 6) toks.push({ w: m[0].toLowerCase().replace(/'/g, ''), end: m.index + m[0].length });
  const greet = new Set(['hey','hi','hello','ok','okay','yo','oh','so','um','uh']);
  for(let i = 0; i < toks.length && i < 4; i++){
    if(isWakeTok(toks[i].w)) return { hit: true, rest: raw.slice(toks[i].end).replace(/^[\s,.!?;:'"-]+/, '').trim() };
    if(toks[i+1] && isWakeTok(toks[i].w + toks[i+1].w)) return { hit: true, rest: raw.slice(toks[i+1].end).replace(/^[\s,.!?;:'"-]+/, '').trim() };   // "O Ryan", "a ryan"
    if(!greet.has(toks[i].w) && i >= 1) break;      // his name has to come near the start
  }
  /* ...or anywhere, when you call him: "so check it out. Hey, Aurion, can you..." */
  const hm = /\b(hey|hi|okay|ok|yo)[\s,]+([A-Za-z']+)(?:[\s]+([A-Za-z']+))?/gi; let h;
  while((h = hm.exec(raw))){ const a = h[2].toLowerCase().replace(/'/g, ''), b = (h[3] || '').toLowerCase().replace(/'/g, '');
    if(isWakeTok(a)) return { hit: true, rest: raw.slice(h.index + h[0].length - (h[3] ? h[3].length : 0)).replace(/^[\s,.!?;:'"-]+/, '').trim() };
    if(b && isWakeTok(a + b)) return { hit: true, rest: raw.slice(h.index + h[0].length).replace(/^[\s,.!?;:'"-]+/, '').trim() }; }
  return { hit: false, rest: raw };
}
/* common mishears of the words people say to him */
function fixMishears(t){ return String(t)
  .replace(/\b(pilates|pilate's|pleiadies|pleiadas|pleiadeans?|plaides|playadies|pleadies|pleiadis|pleiades's|palladians?|play ?a ?d[ei]e?s|plea ?d[ei]e?s|ple ?ya ?d[ei]e?s)\b/gi, 'Pleiades'); }
/* what the bar shows is exactly the text being processed, plus what happened to it */
let pillHeard = null;
function showHeard(text, note){ pillHeard = { text, note, until: now() + 5000 }; syncPill(); Voice.log('bar: ' + JSON.stringify(text) + ' -> ' + note); }
let pendingTurn = null;
async function heardTurn(wav, how){
  how = how || 'ptt';
  const loud = how !== 'free';                     // in conversation mode, stay quiet until we know it was meant for him
  micBusy = true; micEl.classList.add('busy'); convoUntil = now() + 60000; pillBusy = 'thinking'; syncPill();
  if(loud) say('thinking…', { sticky: true, silent: true, convo: true });
  const tT = now(); let res = null; try{ res = await host.transcribe(wav); }catch(err){ Voice.log('transcribe threw ' + (err && err.message)); }
  micBusy = false; micEl.classList.remove('busy'); pillBusy = ''; syncPill();
  let text = res && res.ok ? String(res.text || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/^[\s.,!?]+|[\s]+$/g, '').trim() : '';
  const conf = res && res.conf != null ? res.conf : 0;
  Voice.log('turn(' + how + ') heard ' + JSON.stringify(text) + ' conf ' + conf + ' via ' + (res && res.engine) + ' - timing: transcribe ' + Math.round(now() - tT) + 'ms');
  const key = text.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if(key && key === heardTurn.lastKey && now() - heardTurn.lastAt < 4000){ Voice.log('turn ignored: duplicate of the last one'); return afterTurn(how); }
  heardTurn.lastKey = key; heardTurn.lastAt = now();
  if(text && echoOfHim(text)){ Voice.log('turn ignored: that was his own voice'); showHeard(text, 'my own voice, ignored'); if(loud) hideBubble(); convoUntil = now() + 3000; return afterTurn(how); }
  text = fixMishears(text);
  const wk = findWake(text), follow = now() - lastReplyAt < 30000;   // right after he answers, no need to say his name again
  Voice.log('wake check: ' + (wk.hit ? 'name heard' : 'no name') + ', follow-up window ' + (follow ? 'open (' + Math.round((now() - lastReplyAt) / 1000) + 's since reply)' : 'closed') + ', rest ' + JSON.stringify(wk.rest));
  if(how === 'free' && S.cfg.wake && !wk.hit && !follow){ Voice.log('turn ignored: no wake word'); if(text) showHeard(text, 'say "Aurion" first'); convoUntil = 0; return afterTurn(how); }
  if(wk.hit && !/[a-z]{2}/i.test(wk.rest)){             // just his name: answer and keep listening for the question
    showHeard(text, 'yes?'); lastReplyAt = now();
    await convoSay(pick(['Yes, ' + S.cfg.user + '? I\'m listening.', 'I\'m here. What would you like to know?', 'Mm-hm? Go ahead, I\'m listening.']));
    lastReplyAt = now(); keepOpen = true; return afterTurn(how);
  }
  if(wk.hit) text = wk.rest;
  const words = text.split(/\s+/).filter(w => /[a-z]/i.test(w)).length;
  if(!res || !res.ok){ await convoSay('My ears are not working right now, ' + S.cfg.user + '. You can always type to me.'); return afterTurn(how); }
  if(!text || words === 0 || (res.engine === 'windows' && conf < .5)){
    if(how === 'free'){ Voice.log('turn ignored: nothing clear (hands-free stays quiet)'); convoUntil = 0; return afterTurn(how); }   // noise, echo or mumble in an open room: let it go
    await convoSay(pick(['I didn\'t quite catch that, ' + S.cfg.user + '. Say it again?', 'Mm? Say that again for me, a little closer?']));
    return afterTurn(how);
  }
  showHeard(text, 'answering');
  await send(text, { convo: true });
  lastReplyAt = now(); keepOpen = true;
  afterTurn(how);
}
async function convoSay(m){ addMsg('aurion', m); hideBubble(); say(m, { convo: true, speak: true }); await untilQuiet(); }
async function untilQuiet(){ await wait(400); const t0 = now(); while(speaking() && now() - t0 < 30000) await wait(150); Voice.mute(600); }
let turnsDone = 0;
let keepOpen = false;
function afterTurn(how){ turnsDone++; convoUntil = Math.max(convoUntil, now() + 8000); syncPill();
  const open = keepOpen && now() - lastReplyAt < 30000; keepOpen = false;
  if(!S.cfg.convo && how !== 'ptt' && !open) stopHandsFree();
  else if(!S.cfg.convo && open){ clearTimeout(afterTurn.t); afterTurn.t = setTimeout(() => { if(Voice.listening() && !S.cfg.convo && !micBusy && !chatBusy && now() - lastReplyAt >= 29000) stopHandsFree(); }, 30500); }
  if(pendingTurn){ const p = pendingTurn; pendingTurn = null; Voice.log('processing the turn that came in while I was busy'); setTimeout(() => heardTurn(p.wav, p.how), 50); } }
/* hands-free: voice activity starts and ends the turn by itself */
async function startHandsFree(){
  if(!Voice.canListen()){ tell('My ears only open in the desktop app, ' + S.cfg.user + '.'); return; }
  if(Voice.listening()) return;
  try{
    const how = S.cfg.convo ? 'free' : 'once'; let got = false;
    await Voice.listen({ onStart: () => syncPill(), onTurn: r => { got = true; if(micBusy || chatBusy){ Voice.log('turn queued: I was still busy with the last one'); pendingTurn = { wav: r.wav, how: S.cfg.convo ? 'free' : how }; return; } heardTurn(r.wav, S.cfg.convo ? 'free' : how); } });
    if(how === 'once'){ clearTimeout(startHandsFree.t); startHandsFree.t = setTimeout(() => { if(!got && Voice.listening() && !S.cfg.convo){ stopHandsFree(); say('I\'m here whenever you want to talk, ' + S.cfg.user + '.', { ms: 3000, convo: true, silent: true }); } }, 12000); }
    convoUntil = now() + 60000; syncPill();
    say(S.cfg.convo ? (S.cfg.wake ? 'I\'m listening. Say "Aurion" when you want me.' : 'I\'m all ears, ' + S.cfg.user + '. Just talk.') : 'Listening, ' + S.cfg.user + '… just speak.', { ms: 3500, convo: true, silent: true });
  }catch(err){ Voice.log('mic open failed ' + (err && err.message)); tell('I cannot reach your microphone, ' + S.cfg.user + '. Check that one is plugged in and allowed for this page' + (WEB ? ' (tap the lock icon by the address bar).' : ' in Windows privacy settings (Microphone).')); }
}
function stopHandsFree(){ Voice.stopListen(); syncPill(); }
setInterval(() => { if(Voice.listening() || micBusy) syncPill(); }, 250);
micEl.addEventListener('pointerdown', e => { e.preventDefault(); micDownAt = now(); if(Voice.recording()) micStop(); else micStart(); });
micEl.addEventListener('pointerup', () => { if(Voice.recording() && now() - micDownAt > 600) micStop(); });   // held = walkie-talkie
function talkOutLoud(){ closePanels(true); startHandsFree(); }   // hands-free turn; his answer shows in the thought cloud

/* ------------------------------------------------------------------ talking */
const logEl = $('#log'), inputEl = $('#input');
let chatBusy = false, hist = [];
function openChat(){
  togglePanel('chat'); if($('#chat').hidden) return;
  F.chatting = true; if(F.mode === 'walk' || F.mode === 'idle') { F.mode = 'idle'; pose('idle'); F.until = Infinity; }
  if(!logEl.children.length) addMsg('aurion', Wisdom.fill('Greetings, {u}. Ask me anything, or just tell me how your heart is today.', S.cfg.user));
  setTimeout(() => inputEl.focus(), 50); host.focus();
}
function addMsg(who, text){ const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = text; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; return d; }
let brainPartCb = null, saidRecently = [];
/* no-repeat for brain replies too: too close to one of his last 8 answers? */
function tooSimilar(r){ const w = t => String(t).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(x => x.length > 3);
  const mine = w(r); if(mine.length < 3) return false;
  return saidRecently.some(p => { const s = new Set(w(p)); return mine.filter(x => s.has(x)).length / mine.length >= .6; }); }
if(host.onBrainPart) host.onBrainPart(p => { if(brainPartCb) brainPartCb(String(p).replace(/^\s*Aurion\s*:\s*/i, '').trim()); });
async function brainReply(messages, onFirst){
  const url = S.cfg.brainUrl || 'http://127.0.0.1:8080';   // VERDANT's brain, if it happens to be running
  brainPartCb = onFirst || null;
  try{ const r = await host.chat({ url, messages, stream: !!onFirst }); return r && r.ok && r.text ? String(r.text).replace(/^\s*Aurion\s*:\s*/i, '').trim() : null; }catch(_){ return null; }
  finally{ brainPartCb = null; }
}
async function brainLine(ask){ const r = await brainReply([{ role: 'system', content: Wisdom.fill(Wisdom.PERSONA, S.cfg.user) }, { role: 'user', content: ask }]); return r; }
async function send(text, o){
  o = o || {}; text = text.trim(); if(!text || chatBusy) return;
  chatBusy = true; addMsg('you', text); inputEl.value = ''; Care.chat(S.pet); bondCheck();
  const memo = (window.Focus && Focus.onText(text)) || memoryReply(text);
  if(memo){ addMsg('aurion', memo); hist.push({ role: 'user', content: text }, { role: 'assistant', content: memo }); saidRecently.push(memo); F.mode = 'idle'; act('talk', 2.5); say(memo, { convo: true, speak: !!o.convo }); chatBusy = false; persist(); if(o.convo) await untilQuiet(); return; }
  const thinking = addMsg('aurion', '…'); thinking.classList.add('thinking');
  act('think', 30);
  hist.push({ role: 'user', content: text }); hist = hist.slice(-12);
  const tB = now(); let spokeFirst = '';   // when you talked to him: start speaking his first sentence while the brain writes the rest
  const sys = Wisdom.fill(Wisdom.PERSONA, S.cfg.user) + memFacts() + (saidRecently.length ? ' Do not repeat yourself; you recently said: ' + saidRecently.slice(-4).map(x => '"' + x.slice(0, 90) + '"').join(' ') + '. Say something new.' : '');
  let reply = await brainReply([{ role: 'system', content: sys }].concat(hist), o.convo ? (p => { if(!tooSimilar(p)){ spokeFirst = p; speak(p); } }) : null);
  if(reply && tooSimilar(reply) && !spokeFirst){ Voice.log('brain reply too close to a recent one, asking again: ' + JSON.stringify(reply.slice(0, 80)));
    const again = await brainReply([{ role: 'system', content: sys + ' Your last draft repeated an earlier answer. Answer differently, with a fresh detail.' }].concat(hist));
    reply = again && !tooSimilar(again) ? again : null; if(!reply) Voice.log('still repetitive, using a built-in answer'); }
  Voice.log('timing: brain step ' + Math.round(now() - tB) + 'ms' + (reply ? '' : ' (no brain reply, using built-in answers)'));
  if(!reply){ await wait(o.convo ? 0 : rand(600, 1300)); reply = Wisdom.reply(text, S.cfg.user); }
  hist.push({ role: 'assistant', content: reply }); saidRecently.push(reply); saidRecently = saidRecently.slice(-8);
  thinking.classList.remove('thinking'); thinking.textContent = reply; logEl.scrollTop = logEl.scrollHeight;
  F.mode = 'idle'; act('talk', clamp(reply.length * .055, 2, 7));
  talkUntil = now() + clamp(500 + reply.length * 48, 900, 7000);
  hideBubble();
  if(spokeFirst && reply.startsWith(spokeFirst)){ const rest = reply.slice(spokeFirst.length).trim(); if(rest.length > 2) Voice.queue(rest, { voice: S.cfg.voiceName, speed: S.cfg.voiceSpeed }); say(reply, { convo: true }); }
  else { if(spokeFirst) Voice.stop(); say(reply, { convo: true, speak: !!o.convo }); }   // you spoke to him, so he always answers out loud (even with Voice off)            // the reply floats up in his cloud (and is spoken if voice is on)
  Voice.log('reply ' + JSON.stringify(reply.slice(0, 120)));
  chatBusy = false; persist();
  if(o.convo) await untilQuiet();
}
$('#say').addEventListener('submit', e => { e.preventDefault(); send(inputEl.value); });
inputEl.addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(inputEl.value); } });

/* ---- memory: his friend's name and things to remember (saved in this browser only) ---- */
function mem(){ if(!S.mem) S.mem = { facts: [] }; return S.mem; }
function memFacts(){ const f = mem().facts; return f.length ? ' Things ' + S.cfg.user + ' asked you to remember: ' + f.slice(-10).join('; ') + '.' : ''; }
function memoryReply(t){
  const u = () => S.cfg.user; let m;
  if((m = t.match(/\b(?:my name is|my name's|call me|i am called|i'm called)\s+([a-z][a-z' -]{0,22})/i))){
    const n = m[1].trim().split(/\s+/).slice(0, 2).join(' ').replace(/\b\w/g, c => c.toUpperCase()); S.cfg.user = n; persist();
    return pick(['Beautiful to meet you, ' + n + '. I\'ll remember that.', n + '. That name has a nice glow to it. Got it.', 'Okay, ' + n + ', your name is written in my stars now.']); }
  if((m = t.match(/\bremember (?:that )?(.{3,140})/i)) && !/\bwhat do you remember\b/i.test(t)){
    let f = m[1].replace(/[.!?]+$/, '').replace(/\bmy\b/gi, 'your').replace(/\bI am\b|\bI'm\b/gi, "you're").replace(/\bme\b/gi, 'you').replace(/\bI\b/g, 'you').trim();
    mem().facts.push(f); mem().facts = mem().facts.slice(-30); persist();
    return pick(['Got it, I\'ll remember that ' + f + '.', 'Tucked into my memory crystal: ' + f + '.', 'Noted in the stars, ' + u() + '.']); }
  if(/\b(what do you (remember|know) about me|what have i told you|do you remember)\b/i.test(t)){
    const f = mem().facts; if(!f.length) return 'So far I know your name is ' + u() + '. Tell me "remember that…" and I\'ll keep it.';
    return 'I remember your name is ' + u() + ', and that ' + f.slice(-4).join(', and that ') + '.'; }
  if(/\b(forget (everything|me|all)|erase (your )?memory)\b/i.test(t)){ forgetMe(true); return 'Done. My memory is clear as a fresh night sky.'; }
  return null;
}
function forgetMe(quiet){
  if(!quiet && !confirm('Forget everything Aurion remembers about you (your name and the things you told him)?')) return;
  S.mem = { facts: [] }; S.cfg.user = CFG.user; hist = []; persist(); if(!quiet) say('Memory cleared. Hello again, new friend.', { ms: 3500 });
}

/* ------------------------------------------------------------------ hello and goodbye */
function greet(){
  const h = new Date().getHours(), today = new Date().toDateString(), p = S.pet, m = Care.mood(p);
  let line;
  if(p.lastGreetDay !== today){ p.lastGreetDay = today; line = say$(h < 5 || h >= 23 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'day' : 'evening'); }
  else line = say$('back');
  if(m === 'hungry' || m === 'starving') line += ' ' + say$(m);
  else if(m === 'sleepy' || m === 'exhausted') line += ' ' + say$('sleepy');
  say(line, { ms: 5000 }); persist();
}
function bye(){
  closePanels(); persist();
  depart(() => {
    if(!WEB) return host.quit();
    $('#callBack').hidden = false;
  });
}
$('#callBack').onclick = () => { $('#callBack').hidden = true; F.x = clamp(F.x, size(), W() - size()); arrive(); };
let nextThought = now() + rand(3, 6) * 60000;
function maybeThought(){
  if(inConvo() || (window.Focus && Focus.active())) return;
  if(!S.cfg.thoughts || now() < nextThought || F.mode === 'ship' || F.mode === 'away' || F.resting || F.chatting || items.sack || smoking) return;
  nextThought = now() + rand(12, 25) * 60000;
  say(Wisdom.thought(), { thought: true, ms: 9000 });
}

/* ------------------------------------------------------------------ start */
function start(){
  loadSave();
  Care.tick(S.pet, now(), { away: true, lastSeen: S.seen });
  if(Q.get('size')) S.cfg.size = +Q.get('size');
  rig.setSize(S.cfg.size); rig.setVisor(S.cfg.visor);
  F.x = Q.get('x') ? +Q.get('x') : S.pet.x != null ? clamp(S.pet.x, 120, W() - 120) : W() - 260;
  F.x = clamp(F.x, size() * .5, W() - size() * .5);
  renderPantry(); place(); syncVoiceUI(); if(WEB && S.cfg.bigBrain && host.loadBrain) host.loadBrain(); if(WEB && S.cfg.voiceName && host.setVoice) host.setVoice(S.cfg.voiceName); if(S.cfg.convo && !WEB) setTimeout(() => { if(S.cfg.convo) startHandsFree(); }, 9000);
  if(pillEl) pillEl.addEventListener('click', e => { e.stopPropagation(); if(Voice.listening()) stopHandsFree(); else if(Voice.recording()) micStop(); else setVoice(!S.cfg.voice); });
  requestAnimationFrame(loop);
  setInterval(careTick, 5000);
  setInterval(maybeThought, 5000);
  host.ignoreMouse(true);
  if(S.cfg.arrive && Q.get('arrive') !== '0') arrive(); else { idle(1); setTimeout(greet, 600); }
}
host.onResize(() => { F.x = clamp(F.x, 60, W() - 60); });
host.onHello(() => { if(F.mode === 'away') { arrive(); return; } act('wave', 2); say('Still here, ' + S.cfg.user + '.'); });
host.onVoice && host.onVoice(on => setVoice(on));
host.onListen && host.onListen(() => { if(F.mode === 'away' || F.mode === 'ship') return; talkOutLoud(); });
host.onArrive && host.onArrive(() => { if(F.mode === 'away' || F.mode === 'ship') return; ride(); });
addEventListener('beforeunload', persist);

/* plain browser: no Electron host, so he runs as a web demo */
function webHost(){
  const noop = () => {};
  return { ignoreMouse: noop, focus: noop, onCursor: noop, onResize: noop, onHello: noop, hide: noop, quit: noop,
    autostart: async () => false,
    chat: async ({ url, messages }) => { try{ const r = await fetch(url.replace(/\/$/, '') + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, max_tokens: 160, temperature: .8 }) }); const j = await r.json(); return { ok: true, text: j.choices[0].message.content }; }catch(_){ return { ok: false }; } } };
}

/* a handle for testing and for the demo page */
window.aurion = { setCfg: (k, v) => { S.cfg[k] = v; persist(); syncVoiceUI(); }, restoreCfg: (convo, wake) => { S.cfg.wake = wake; persist(); if(!!S.cfg.convo !== convo){ S.cfg.convo = convo; persist(); syncVoiceUI(); if(convo) startHandsFree(); else stopHandsFree(); } }, testFree: async (b64, rate) => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const f32 = new Float32Array(u8.buffer), n0 = turnsDone, l0 = logEl.children.length; S.cfg.convo = true; S.cfg.wake = true;
    let fired = 0; await Voice.testVad(f32, rate, { onTurn: r => { fired++; heardTurn(r.wav, 'free'); } });
    const t0 = now(); while(now() - t0 < 40000 && (micBusy || chatBusy || speaking() || (fired && turnsDone === n0))) await wait(200);
    await wait(300); return { vadTurns: fired, newChat: [...logEl.children].slice(l0).map(e => e.textContent) }; },
  speakAndWait: async t => { speak(t); await untilQuiet(); return Voice.spokeAgo(); },
  testTurn: async b64 => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const t0 = now(); await heardTurn(u8); return { ms: now() - t0, last: Voice.last(), log: [...logEl.children].slice(-2).map(e => e.textContent) }; }, get S(){ return S; }, F, rig, act, say, idle, walkTo, rest, wakeUp, meditate, endMeditate, startPlay, endPlay, spawnFood, smoke, openChat, send, petted, items, arrive, depart, ride, transmission,
  memoryReply, forgetMe, brainLine, goHome: () => walkTo(homeX(), () => idle(2)), closePanels, hideBubble, cfg: () => S.cfg, speaking: () => speaking(), findWake, heardTurn, feed: id => spawnFood(Care.FOODS.find(f => f.id === id)), setPet: (k, v) => { S.pet[k] = v; }, menu: () => togglePanel('menu') };
if(window.host && window.host.gate) window.host.gate(start); else start();
})();
