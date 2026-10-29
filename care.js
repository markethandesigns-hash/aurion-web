/* Aurion's needs, the Tamagotchi part (same rules as Elder Fern's care.js). Pure logic (no screen, no network) so it can be tested on its own.
   Needs run 0-100: belly (full), energy, joy. Bond is a slow-growing level. He never dies: neglect only makes him
   grumpy, droopy and asleep, and a little care brings him straight back. */
(function(g){
'use strict';
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/* points lost per real hour while awake */
const RATE = { belly: 10, energy: 7, joy: 6 };
/* when you've been away: needs sink at this fraction of the normal rate, for at most this many hours */
const AWAY_FACTOR = .3, AWAY_CAP_H = 10;

const FOODS = [
  { id: 'starfruit',   icon: '⭐', name: 'Star fruit',     belly: 20, joy: 6,  energy: 4,  bond: 2, line: 'Tastes like a sunrise on Alcyone.', lvl: 0, arrive: 'beam' },
  { id: 'moonberries', icon: '🫐', name: 'Moon berries',   belly: 14, joy: 9,  energy: 2,  bond: 2, line: 'Little bites of moonlight.', lvl: 0, arrive: 'roll' },
  { id: 'manna',       icon: '🍞', name: 'Manna loaf',     belly: 32, joy: 2,  energy: 0,  bond: 2, line: 'Simple bread. Infinite love baked in.', lvl: 0, arrive: 'drop' },
  { id: 'mushroom',    icon: '🍄', name: 'Moon mushroom',  belly: 22, joy: 5,  energy: 0,  bond: 2, line: 'The mycelium says hello.', lvl: 0, arrive: 'sprout' },
  { id: 'tea',         icon: '🍵', name: 'Nebula tea',     belly: 6,  joy: 6,  energy: 14, bond: 2, line: 'Ahh. I can taste three galaxies.', lvl: 0, arrive: 'float' },
  { id: 'honey',       icon: '🍯', name: 'Celestial honey', belly: 8, joy: 16, energy: 8,  bond: 3, line: 'The bees of Earth are secretly ascended masters.', lvl: 2, arrive: 'drone' }
];
const BOND_NAMES = ['Earthling', 'Fellow traveler', 'Friend', 'Kindred spirit', 'Soul family', 'Star family', 'Twin flame'];
const BOND_AT = [0, 30, 100, 250, 550, 1100, 2200];

function fresh(now){
  now = now || Date.now();
  return { v: 1, born: now, last: now, belly: 72, energy: 82, joy: 70, bond: 0, bondLvlSeen: 0, fed: 0, pets: 0, chats: 0, kicks: 0, meditations: 0, naps: 0, lastGreetDay: '', x: null };
}

/* advance the clock. `asleep` = napping (energy comes back); `away` = the app was closed, so go gently */
function tick(s, now, opts){
  opts = opts || {}; now = now || Date.now();
  let h = Math.max(0, (now - s.last) / 3600000);
  if(opts.away){ h = Math.min(h, AWAY_CAP_H) * AWAY_FACTOR; }
  s.last = now;
  if(h <= 0) return s;
  const hungry = s.belly < 25, tired = s.energy < 20;
  s.belly = clamp(s.belly - RATE.belly * h);
  if(opts.asleep){ s.energy = clamp(s.energy + 480 * h); s.joy = clamp(s.joy - RATE.joy * .25 * h); }
  else { s.energy = clamp(s.energy - RATE.energy * h * (hungry ? 1.25 : 1)); s.joy = clamp(s.joy - RATE.joy * h * ((hungry || tired) ? 1.8 : 1)); }
  /* a long absence wears the bond down a hair, never below the start of the level he has reached */
  if(opts.away && (now - (opts.lastSeen || now)) > 3 * 86400000){ s.bond = Math.max(bondFloor(s.bond), s.bond - 1); }
  return s;
}

function bondLevel(b){ let l = 0; for(let i = 0; i < BOND_AT.length; i++) if(b >= BOND_AT[i]) l = i; return l; }
function bondFloor(b){ return BOND_AT[bondLevel(b)]; }
function bondInfo(b){
  const l = bondLevel(b), next = BOND_AT[l + 1], lo = BOND_AT[l];
  return { level: l, name: BOND_NAMES[l], pct: next ? clamp((b - lo) / (next - lo) * 100) : 100, max: !next };
}

/* what a state of being reads as. One word drives his face and his talk. */
function mood(s){
  if(s.belly < 10) return 'starving';
  if(s.energy < 8) return 'exhausted';
  if(s.belly < 28) return 'hungry';
  if(s.energy < 22) return 'sleepy';
  if(s.joy < 22) return 'sad';
  if(s.joy < 42) return 'meh';
  if(s.joy > 86 && s.belly > 45) return 'ecstatic';
  if(s.joy > 62) return 'happy';
  return 'content';
}

function feed(s, food){
  if(s.belly >= 96) return { ok: false, why: 'full' };
  s.belly = clamp(s.belly + food.belly); s.joy = clamp(s.joy + food.joy); s.energy = clamp(s.energy + food.energy);
  s.fed++; s.bond += food.bond;
  return { ok: true };
}
function pet(s){ s.joy = clamp(s.joy + 3); s.bond += .6; s.pets++; }
function chat(s){ s.joy = clamp(s.joy + 2.5); s.bond += 1.5; s.chats++; }
function kick(s){ s.joy = clamp(s.joy + 1.4); s.energy = clamp(s.energy - .5); s.bond += .25; s.kicks++; }
function meditate(s){ s.joy = clamp(s.joy + 9); s.energy = clamp(s.energy + 4); s.bond += 4; s.meditations++; }
/* returns true when this action pushed him up a level */
function levelUp(s){ const l = bondLevel(s.bond); if(l > s.bondLvlSeen){ s.bondLvlSeen = l; return true; } return false; }
function daysTogether(s, now){ return Math.max(1, Math.floor(((now || Date.now()) - s.born) / 86400000) + 1); }

const api = { clamp, RATE, FOODS, BOND_NAMES, BOND_AT, fresh, tick, mood, feed, pet, chat, kick, meditate, levelUp, bondLevel, bondInfo, daysTogether };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else g.Care = api;
})(typeof window !== 'undefined' ? window : globalThis);
