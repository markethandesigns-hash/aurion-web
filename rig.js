/* Aurion's body. No pictures: he is drawn as layered SVG parts (legs, robe, cape, arms, head, halo) and every part
   is moved by a little skeleton in code. A "clip" is a function of time that returns a pose (joint angles, hover
   height, face); the rig eases from wherever he is toward that pose every frame, so every move blends into the
   next. Two-bone IK puts his hands where they need to be (mouth, chin, heart, knees).
   Rig units: origin = the floor under him, y up is negative, he is about 300 units tall. k = px per unit. */
(function(g){
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ez = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const bump = (u, a, b) => ez((u - a[0]) / (a[1] - a[0])) * (1 - ez((u - b[0]) / (b[1] - b[0])));

/* ---------------------------------------------------------------- 2D matrices, same layout as SVG matrix(a b c d e f) */
const mul = (m, n) => [m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1], m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3], m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = (deg, cx, cy) => { const a = deg * D2R, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, cx - c*cx + s*cy, cy - s*cx - c*cy]; };
const ap = (m, x, y) => ({ x: m[0]*x + m[2]*y + m[4], y: m[1]*x + m[3]*y + m[5] });
const mstr = m => 'matrix(' + m.map(v => +v.toFixed(4)).join(' ') + ')';

/* skeleton (rest positions) */
const SH = { R: [24, -196], L: [-24, -196] }, UA = 40, FA = 43;          // shoulder, upper arm, forearm-to-palm
const HIP = { R: [10, -120], L: [-10, -120] }, TH = 52, SN = 50;          // hip, thigh, shin
const NECK = [0, -207], PELVIS = [0, -122];
const MOUTH = [0, -224];

/* two-bone IK in torso space: angles that put the palm on (tx,ty), elbow out to `side` (+1 right, -1 left) */
function ik(s, tx, ty, side){
  const sx = s[0], sy = s[1]; let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || .001;
  d = clamp(d, Math.abs(UA - FA) + .5, UA + FA - .3);
  const base = Math.atan2(-dx, dy), a = Math.acos(clamp((UA*UA + d*d - FA*FA) / (2*UA*d), -1, 1));
  let best = null;
  for(const sg of [1, -1]){
    const t1 = base + sg * a, ex = sx - UA * Math.sin(t1), ey = sy + UA * Math.cos(t1);
    const t2 = Math.atan2(-(sx + dx/Math.hypot(dx,dy)*d - ex), (sy + dy/Math.hypot(dx,dy)*d - ey));
    const sc = side * ex + ey * .15;                    // elbow out to his side
    if(!best || sc > best.sc) best = { sc, t1, t2 };
  }
  const wrap = v => ((v + 540) % 360) - 180;          // keep every angle in [-180, 180) so poses blend the short way
  return [wrap(best.t1 / D2R), wrap((best.t2 - best.t1) / D2R)];
}

/* ---------------------------------------------------------------- the clips */
const BASE = { hover: 18, drop: 0, tilt: 0, head: 0, uaL: 9, faL: -8, uaR: -9, faR: 8, thL: 2, shL: -2, thR: -2, shR: 2,
  mouth: 0, eyes: 1, smile: .65, glow: .5, lookX: 0, lookY: 0, hand: 0, cross: 0 };
const ANG = new Set(['uaL', 'faL', 'uaR', 'faR', 'thL', 'shL', 'thR', 'shR']);
const SMOKE_P = 4.6, EAT_P = 1.5, SIP_P = 3.2, KICK_T = .47;
const arms = (p, R2, L2) => { if(R2){ const a = ik(SH.R, R2[0], R2[1], 1); p.uaR = a[0]; p.faR = a[1]; } if(L2){ const a = ik(SH.L, L2[0], L2[1], -1); p.uaL = a[0]; p.faL = a[1]; } return p; };
const lotus = (p, high) => Object.assign(p, { drop: 22, thR: -30, shR: 60, thL: 30, shL: -60, hover: high, cross: 1 });
const CLIPS = {
  idle: t => ({ hover: 18 + 4 * Math.sin(t * 1.7), uaR: -9 + 3 * Math.sin(t * 1.7 + 1), uaL: 9 - 3 * Math.sin(t * 1.7 + 1.3), head: 3 * Math.sin(t * .6), tilt: 1.2 * Math.sin(t * .9),
    thL: 3 + 2 * Math.sin(t * 1.7), thR: -3 - 2 * Math.sin(t * 1.7 + .5), shL: -4, shR: 4 }),
  walk: (t, r) => { const d = r.dir || 1, ph = t * 5;
    return { hover: 26 + 4 * Math.sin(ph * 2), tilt: d * 6, head: -d * 3, thL: d * 14 + 5 * Math.sin(ph), thR: d * 14 + 5 * Math.sin(ph + Math.PI), shL: 10 + 8 * Math.sin(ph), shR: -2 + 8 * Math.sin(ph + Math.PI) + 10,
      uaR: -14 + d * 14 + 4 * Math.sin(ph), uaL: 14 + d * 14 - 4 * Math.sin(ph), faR: 10, faL: -10, lookX: d * .8 }; },
  wave: t => ({ hover: 20 + 3 * Math.sin(t * 2), uaR: -142, faR: -16 + 28 * Math.sin(t * 9), head: 7, smile: 1, mouth: .25, tilt: -2, uaL: 12 }),
  hop: t => { const j = Math.abs(Math.sin(t * 5.5)); return { hover: 18 + j * 34, uaR: -120 - 20 * j, faR: -20, uaL: 120 + 20 * j, faL: 20, smile: 1, mouth: .35, thR: -8 * j, shR: 18 * j, thL: 8 * j, shL: -18 * j }; },
  talk: t => ({ hover: 18 + 3 * Math.sin(t * 1.6), uaR: -28 + 10 * Math.sin(t * 2.3), faR: -62 + 16 * Math.sin(t * 3.1), uaL: 12 + 6 * Math.sin(t * 1.7), faL: -10, head: 4 * Math.sin(t * 1.3), smile: .8, hand: 1 }),
  think: t => arms({ hover: 16 + 2 * Math.sin(t * 1.2), head: 9, tilt: -2, smile: .25, lookX: .5, lookY: -.9 }, [9, -210], [-2, -158]),
  doze: t => ({ hover: 11 + 2 * Math.sin(t * .8), head: -11 + 5 * Math.sin(t * .8), tilt: 2, eyes: 0, smile: .3, uaR: -4, uaL: 4, faR: 2, faL: -2, glow: .3 }),
  rumble: t => arms({ hover: 15, tilt: 2.5 * Math.sin(t * 22) * Math.max(0, 1 - t / 1.4), smile: .1, eyes: .8, mouth: .2, lookY: .6 }, [8, -150], [-8, -146]),
  namaste: t => arms({ hover: 20 + 2 * Math.sin(t * 1.5), head: -7 * ez(t / .6), eyes: t < .4 ? 1 : .15, smile: .9, tilt: 0 }, [3, -180], [-3, -180]),
  beam: t => ({ hover: 22, uaR: -96 + 6 * Math.sin(t * 2), faR: -14, uaL: 96 - 6 * Math.sin(t * 2), faL: 14, head: -4, eyes: .1, smile: .8, thR: -3, thL: 3, shR: 6, shL: -6, glow: 1 }),
  float: t => ({ hover: 20, uaR: -70 + 8 * Math.sin(t * 6), faR: -10, uaL: 70 - 8 * Math.sin(t * 6), faL: 10, smile: 1, mouth: .3, thR: -6, thL: 6, shR: 14, shL: -14 }),
  drag: (t, r) => { const v = clamp((r.vx || 0) * .05, -30, 30); return { hover: 0, uaR: -150 + 10 * Math.sin(t * 7), faR: -10, uaL: 40 + v * .5, faL: -15, thR: v + 6 * Math.sin(t * 5), shR: 18 + 10 * Math.sin(t * 5 + 1), thL: v - 6 * Math.sin(t * 5), shL: -10 + 10 * Math.sin(t * 5 + 2), mouth: .55, eyes: 1.15, smile: .2, tilt: v * .2, head: -v * .3 }; },
  ready: t => ({ hover: 14 + 2 * Math.sin(t * 3), uaR: -30, faR: -20, uaL: 30, faL: 20, thR: -4, shR: 12, thL: 4, shL: -12, smile: .9, tilt: 1.5 * Math.sin(t * 3) }),
  toss: t => ({ hover: 14, uaR: -45 - 30 * Math.sin(clamp(t / .26, 0, 1) * Math.PI), faR: -80, uaL: 30, faL: 20, smile: .9 }),
  kickR: t => { const u = clamp(t / KICK_T, 0, 1), b = Math.sin(Math.PI * u); return { hover: 14, thR: -58 * b, shR: 116 * b, thL: 4, shL: -10, uaR: -40 - 10 * b, faR: -25, uaL: 40 + 15 * b, faL: 25, tilt: -5 * b, head: 4 * b, smile: 1, lookY: .9, rate: 24 }; },
  kickL: t => { const u = clamp(t / KICK_T, 0, 1), b = Math.sin(Math.PI * u); return { hover: 14, thL: 58 * b, shL: -116 * b, thR: -4, shR: 10, uaR: -40 - 15 * b, faR: -25, uaL: 40 + 10 * b, faL: 25, tilt: 5 * b, head: -4 * b, smile: 1, lookY: .9, rate: 24 }; },
  pickup: t => ({ hover: 8, drop: 14, tilt: 7, head: 8, uaR: -38, faR: -6, uaL: 14, faL: -8, thR: -14, shR: 26, thL: 10, shL: -22, lookX: .6, lookY: .8, smile: .7, hand: 1 }),
  reach: t => ({ hover: 20, uaR: -78 + 4 * Math.sin(t * 4), faR: -8, tilt: 4, head: 5, smile: 1, mouth: .2, lookX: .8, hand: 1 }),
  hold: t => arms({ hover: 18 + 3 * Math.sin(t * 1.6), smile: .9 }, [36, -168], null),
  eat: t => { const u = (t % EAT_P) / EAT_P, k = bump(u, [.05, .4], [.55, .85]);
    return arms({ hover: 18 + 2 * Math.sin(t * 1.6), mouth: k > .7 ? .9 * (1 - (u - .4) * 4) : k * .7, smile: .5, head: 3 * k, eyes: .9 - .3 * k, chew: u > .5 }, [36 - 30 * k, -168 - 51 * k], [-14, -150]); },
  /* sip: the cup hand rises smoothly to just under his mouth (elbow low and out), tips gently, comes back down;
     the other hand stays still in front of his chest, holding the saucer. Explicit angles, no IK flips. */
  sip: t => { const u = (t % SIP_P) / SIP_P, k = bump(u, [.06, .34], [.62, .9]), tip = bump(u, [.3, .42], [.52, .62]);
    return { hover: 18 + 1.5 * Math.sin(t * 1.4), head: -6 * k - 3 * tip, eyes: 1 - .8 * k, mouth: .12 * k, smile: .6 + .3 * (u > .75), tilt: -1.2 * k,
      uaR: -25 + 15 * k, faR: clamp(95 + 65 * k + 6 * tip, 0, 168), uaL: 20, faL: -72, rate: 7 }; },
  smoke: t => { const u = (t % SMOKE_P) / SMOKE_P, k = bump(u, [.06, .22], [.48, .6]), ex = bump(u, [.6, .68], [.88, .98]);
    return arms({ hover: 18 + 2 * Math.sin(t * 1.4), eyes: k > .6 ? .1 : ex > .3 ? .35 : .9, mouth: ex * .75, smile: .55, head: -10 * ex + 2 * k, tilt: -2 * ex }, [34 - 8 * k, -170 - 46 * k], [-12, -152]); },
  groove: t => ({ hover: 20 + 5 * Math.abs(Math.sin(t * 3)), tilt: 6 * Math.sin(t * 3), uaR: -50 + 25 * Math.sin(t * 3), faR: -40, uaL: 50 + 25 * Math.sin(t * 3 + Math.PI), faL: 40, head: 8 * Math.sin(t * 3 + .6), smile: 1, eyes: .55, thR: -6 * Math.sin(t * 3), thL: -6 * Math.sin(t * 3), shR: 8, shL: -8 }),
  sit: t => arms(lotus({ smile: .8, head: 3 * Math.sin(t * .5), tilt: 0 }, 28 + 2 * Math.sin(t * 1.1)), [40, -108], [-40, -108]),
  meditate: t => arms(lotus({ eyes: 0, smile: .6, glow: 1, head: -2, tilt: 0 }, 62 + 6 * Math.sin(t * 1.1)), [38, -110 - 2 * Math.sin(t * 1.1)], [-38, -110 - 2 * Math.sin(t * 1.1)]),
  rest: t => arms(lotus({ eyes: 0, smile: .35, head: -12 + 3 * Math.sin(t * .7), tilt: 3, glow: .25 }, 20 + 2 * Math.sin(t * .7)), [36, -106], [-36, -106])
};

/* ---------------------------------------------------------------- the drawing */
const LEG = side => { const x = side * 10, s = side;
  return `<g class="thigh"><path d="M${x-7.5} -124 L${x+7.5} -124 L${x+5.8} -68 L${x-5.8} -68 Z" fill="url(#aLeg)"/>
    <circle cx="${x}" cy="-68" r="6" fill="url(#aLeg)"/><circle cx="${x + s*2}" cy="-104" r=".9" fill="#cfe8ff" opacity=".8"/><circle cx="${x - s*2.5}" cy="-86" r=".7" fill="#fff" opacity=".7"/></g>
  <g class="shin"><path d="M${x-5.6} -68 L${x+5.6} -68 L${x+4} -22 L${x-4} -22 Z" fill="url(#aLeg)"/><circle cx="${x+s*1.5}" cy="-48" r=".8" fill="#fff" opacity=".7"/>
    <path d="M${x-6.5} -24 Q${x} -28 ${x+6.5} -24" stroke="url(#aGold)" stroke-width="2.2" fill="none"/>
    <path d="M${x - s*6} -23 Q${x - s*7} -12 ${x + s*2} -11 Q${x + s*12} -10 ${x + s*12} -15 Q${x + s*9} -21 ${x + s*6} -23 Z" fill="url(#aBoot)"/>
    <ellipse cx="${x + s*3}" cy="-11" rx="9" ry="2.2" fill="#9ff3ff" opacity=".55" filter="url(#aSoft)"/></g>`; };
const ARM = side => { const x = side * 24, s = side;
  return `<g class="upper"><path d="M${x - s*8} -202 Q${x + s*8} -206 ${x + s*8.5} -192 L${x + s*10} -158 Q${x} -150 ${x - s*8} -157 Z" fill="url(#aRobe)" stroke="#b7aee6" stroke-width=".6"/>
    <path d="M${x + s*10} -158 Q${x} -150 ${x - s*8} -157" stroke="url(#aGold)" stroke-width="2" fill="none"/></g>
  <g class="fore"><path d="M${x-3.8} -158 L${x+3.8} -158 L${x+3} -121 L${x-3} -121 Z" fill="url(#aSkin)"/>
    <path d="M${x-4.4} -126 L${x+4.4} -126" stroke="url(#aGold)" stroke-width="2.4"/><circle cx="${x}" cy="-126" r="1.2" fill="#7af0ff"/>
    <g class="hand"><path d="M${x - s*5} -122 Q${x - s*6.5} -112 ${x - s*4.5} -106 Q${x - s*3.5} -101 ${x - s*2.6} -106 L${x - s*2} -110 Q${x - s*1.3} -100 ${x} -100.5 Q${x + s*1.3} -100 ${x + s*1.6} -109
      Q${x + s*2.8} -101 ${x + s*4} -103 Q${x + s*5} -105 ${x + s*4.6} -112 Q${x + s*5.5} -116 ${x + s*8} -117 Q${x + s*7} -122 ${x + s*4} -122 Z" fill="url(#aSkin)" stroke="#c8b8f2" stroke-width=".5"/>
    <circle cx="${x}" cy="-113" r="2" fill="#fff" opacity=".55" filter="url(#aSoft)"/></g></g>`; };

const SVG = `
<defs>
  <radialGradient id="aSkin" cx=".35" cy=".3" r=".95"><stop offset="0" stop-color="#fbf6ff"/><stop class="sk1" offset=".45" stop-color="#d7e4ff"/><stop class="sk2" offset=".8" stop-color="#e3c9ff"/><stop class="sk3" offset="1" stop-color="#f7c9e8"/></radialGradient>
  <radialGradient id="aHead" cx=".38" cy=".32" r=".85"><stop offset="0" stop-color="#ffffff"/><stop class="sk1" offset=".42" stop-color="#d9e6ff"/><stop class="sk2" offset=".78" stop-color="#dcc6ff"/><stop class="sk3" offset="1" stop-color="#f3bfe6"/></radialGradient>
  <linearGradient id="aSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7af0ff" stop-opacity=".0"/><stop offset=".5" stop-color="#9ff7ff" stop-opacity=".35"/><stop offset="1" stop-color="#ff9ee8" stop-opacity="0"/></linearGradient>
  <linearGradient id="aRobe" x1="0" x2="1"><stop offset="0" stop-color="#c6bdf2"/><stop offset=".38" stop-color="#fbf9ff"/><stop offset=".62" stop-color="#f1ecff"/><stop offset="1" stop-color="#b3a8e6"/></linearGradient>
  <linearGradient id="aGold" x1="0" x2="1"><stop offset="0" stop-color="#c8932e"/><stop offset=".5" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d9a240"/></linearGradient>
  <linearGradient id="aLeg" x1="0" x2="1"><stop offset="0" stop-color="#1c1650"/><stop offset=".5" stop-color="#3b2f93"/><stop offset="1" stop-color="#1c1650"/></linearGradient>
  <linearGradient id="aBoot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fbff"/><stop offset="1" stop-color="#8fd8ff"/></linearGradient>
  <linearGradient id="aCape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d1d78"/><stop offset=".6" stop-color="#1a1150"/><stop offset="1" stop-color="#3a1468"/></linearGradient>
  <radialGradient id="aNeb" cx=".3" cy=".6" r=".6"><stop offset="0" stop-color="#ff6ad5" stop-opacity=".45"/><stop offset="1" stop-color="#ff6ad5" stop-opacity="0"/></radialGradient>
  <radialGradient id="aNeb2" cx=".7" cy=".35" r=".5"><stop offset="0" stop-color="#57e1ff" stop-opacity=".4"/><stop offset="1" stop-color="#57e1ff" stop-opacity="0"/></radialGradient>
  <radialGradient id="aIris" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#bffcff"/><stop offset=".45" stop-color="#46c9f0"/><stop offset=".8" stop-color="#5a3fd0"/><stop offset="1" stop-color="#22145e"/></radialGradient>
  <radialGradient id="aEyeBg" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#2b2170"/><stop offset="1" stop-color="#0c0828"/></radialGradient>
  <radialGradient id="aGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".35" stop-color="#ffe7a3" stop-opacity=".8"/><stop offset="1" stop-color="#b98cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="aAura" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop class="au1" offset=".45" stop-color="#9fd8ff" stop-opacity=".22"/><stop class="au2" offset=".75" stop-color="#c49bff" stop-opacity=".12"/><stop offset="1" stop-color="#c49bff" stop-opacity="0"/></radialGradient>
  <linearGradient id="aCrystal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9ff3ff"/><stop offset="1" stop-color="#c79bff"/></linearGradient>
  <filter id="aSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
  <filter id="aBloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g class="root">
  <ellipse class="aura" cx="0" cy="-160" rx="100" ry="158" fill="url(#aAura)"/>
  <g class="halo" opacity=".6"></g>
  <g class="cape"><path class="capeP" fill="url(#aCape)" stroke="#ffd98a" stroke-opacity=".55" stroke-width=".9"/><path class="capeN" fill="url(#aNeb)"/><path class="capeN2" fill="url(#aNeb2)"/><g class="capeStars"></g></g>
  <g class="legL">${LEG(-1)}</g>
  <g class="legR">${LEG(1)}</g>
  <g class="skirt">
    <path d="M-17 -154 L17 -154 Q25 -126 35 -88 Q18 -82 0 -85 Q-18 -82 -35 -88 Q-25 -126 -17 -154 Z" fill="url(#aRobe)" stroke="#b7aee6" stroke-width=".6"/>
    <path d="M35 -88 Q18 -82 0 -85 Q-18 -82 -35 -88" stroke="url(#aGold)" stroke-width="2.6" fill="none"/>
    <path d="M0 -146 L0 -88" stroke="#d6cdfa" stroke-width="1"/>
    <path d="M0 -110 L5 -102 L0 -94 L-5 -102 Z" fill="none" stroke="url(#aGold)" stroke-width=".9"/><circle cx="0" cy="-102" r="1.6" fill="#9ff3ff"/>
  </g>
  <g class="lotus" opacity="0">
    <path d="M-52 -104 Q-40 -120 -12 -114 Q0 -110 12 -114 Q40 -120 52 -104 Q55 -90 40 -86 Q20 -92 0 -88 Q-20 -92 -40 -86 Q-55 -90 -52 -104 Z" fill="url(#aLeg)" stroke="#5a4cc0" stroke-width=".6"/>
    <path d="M-40 -100 Q-12 -104 14 -94 M40 -100 Q12 -104 -14 -94" stroke="#6d5fd6" stroke-width="1" fill="none" opacity=".7"/>
    <path d="M10 -96 Q22 -101 30 -97 Q30 -91 20 -90 Q12 -91 10 -96 Z M-10 -96 Q-22 -101 -30 -97 Q-30 -91 -20 -90 Q-12 -91 -10 -96 Z" fill="url(#aBoot)"/>
    <ellipse cx="0" cy="-86" rx="44" ry="4" fill="#9ff3ff" opacity=".35" filter="url(#aSoft)"/>
    <circle cx="-30" cy="-108" r=".9" fill="#fff" opacity=".8"/><circle cx="34" cy="-102" r=".8" fill="#fff" opacity=".7"/>
  </g>
  <g class="torso">
    <path d="M-11 -208 Q-24 -206 -29 -197 Q-25 -176 -18 -153 L18 -153 Q25 -176 29 -197 Q24 -206 11 -208 Q0 -194 -11 -208 Z" fill="url(#aRobe)" stroke="#b7aee6" stroke-width=".6"/>
    <path d="M-11 -208 Q0 -194 11 -208" stroke="url(#aGold)" stroke-width="2.2" fill="none"/>
    <path d="M-18.5 -156 L18.5 -156 L18 -148 L-18 -148 Z" fill="url(#aGold)"/>
    <circle cx="0" cy="-152" r="3" fill="#7af0ff" filter="url(#aBloom)"/>
    <g class="emblem" transform="translate(0 -178)"><circle r="9" fill="#fff" opacity=".0" class="heartGlow" filter="url(#aSoft)"/>
      <g fill="none" stroke="url(#aGold)" stroke-width=".8"><circle r="3.3"/><circle cx="3.30" cy="0.00" r="3.3"/><circle cx="1.65" cy="2.86" r="3.3"/><circle cx="-1.65" cy="2.86" r="3.3"/><circle cx="-3.30" cy="0.00" r="3.3"/><circle cx="-1.65" cy="-2.86" r="3.3"/><circle cx="1.65" cy="-2.86" r="3.3"/><circle r="6.8" stroke-width="1"/></g><circle r="1.5" fill="#8dff9e"/></g>
    <g class="chakras"></g>
  </g>
  <g class="head">
    <rect x="-4.6" y="-218" width="9.2" height="14" rx="3" fill="url(#aSkin)"/>
    <path d="M-28 -248 Q-37 -258 -38 -264 Q-31 -257 -26 -239 Z M28 -248 Q37 -258 38 -264 Q31 -257 26 -239 Z" fill="url(#aSkin)" stroke="#cdb9f5" stroke-width=".5"/>
    <path class="skull" d="M0 -292 C23 -292 31 -270 29 -249 C28 -232 18 -214 0 -211 C-18 -214 -28 -232 -29 -249 C-31 -270 -23 -292 0 -292 Z" fill="url(#aHead)" stroke="#cdb9f5" stroke-width=".7"/>
    <path d="M-17 -284 C-8 -291 10 -291 19 -281 C8 -287 -6 -287 -17 -284 Z" fill="#fff" opacity=".55"/>
    <path d="M-29 -249 C-28 -232 -18 -214 0 -211 C-14 -218 -22 -232 -24 -249 Z" fill="url(#aSheen)"/>
    <g class="circlet"><path d="M-22 -268 Q0 -280 22 -268" stroke="url(#aGold)" stroke-width="1.6" fill="none" opacity=".9"/><path class="glyph" d="M-18 -271 L-9 -274.5 L0 -275 L9 -274.5 L18 -271 M-18 -271 L0 -275 L18 -271 M-9 -274.5 L9 -274.5 M-14 -264 L-9 -274.5 M14 -264 L9 -274.5" stroke="#9ff3ff" stroke-width=".45" fill="none" opacity=".55" filter="url(#aBloom)"/><g fill="#fff6d8"><circle cx="-18" cy="-268.6" r="1.1"/><circle cx="-9" cy="-271.3" r="1.1"/><circle cx="0" cy="-274.0" r="1.5"/><circle cx="9" cy="-271.3" r="1.1"/><circle cx="18" cy="-268.6" r="1.1"/></g></g>
    <ellipse cx="-16" cy="-229" rx="5" ry="3" fill="#ff8fcf" opacity=".35" filter="url(#aSoft)"/><ellipse cx="16" cy="-229" rx="5" ry="3" fill="#ff8fcf" opacity=".35" filter="url(#aSoft)"/>
    <g class="eyeL" transform="translate(-11.5 -242)"><g class="eyeS">
      <path d="M-9.5 1 Q-3 -9 9.5 -3 Q5 7 -9.5 1 Z" fill="#9ff3ff" opacity=".25" filter="url(#aSoft)"/><path d="M-9 1 Q-3 -8 9 -3 Q4 6 -9 1 Z" fill="url(#aEyeBg)"/>
      <g class="iris"><circle r="6.2" fill="#9ff3ff" opacity=".35" filter="url(#aSoft)"/><circle r="4.8" fill="url(#aIris)"/><g class="geo" fill="none" stroke="#e9fdff" stroke-width=".32" opacity=".85"><circle r="1.55"/><circle cx="1.55" cy="0.00" r="1.55"/><circle cx="0.78" cy="1.34" r="1.55"/><circle cx="-0.77" cy="1.34" r="1.55"/><circle cx="-1.55" cy="0.00" r="1.55"/><circle cx="-0.78" cy="-1.34" r="1.55"/><circle cx="0.78" cy="-1.34" r="1.55"/><circle r="3.2" stroke-width=".28"/><path d="M0 -3.1 L2.68 1.55 L-2.68 1.55 Z M0 3.1 L2.68 -1.55 L-2.68 -1.55 Z" stroke="#ffe7a3" stroke-width=".3"/></g><circle r="1.15" fill="#120a3a"/><circle r=".55" fill="#bffcff"/><circle cx="-1.9" cy="-2" r="1.3" fill="#fff"/><circle cx="1.7" cy="1.4" r=".6" fill="#fff" opacity=".8"/></g>
      <path d="M-9 1 Q-3 -8 9 -3" stroke="#3a2a7a" stroke-width="1.1" fill="none"/></g>
      <path class="lid" d="M-8 -.5 Q0 4 8 -1.5" stroke="#4a3a92" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0"/></g>
    <g class="eyeR" transform="translate(11.5 -242)"><g class="eyeS">
      <path d="M9.5 1 Q3 -9 -9.5 -3 Q-5 7 9.5 1 Z" fill="#9ff3ff" opacity=".25" filter="url(#aSoft)"/><path d="M9 1 Q3 -8 -9 -3 Q-4 6 9 1 Z" fill="url(#aEyeBg)"/>
      <g class="iris"><circle r="6.2" fill="#9ff3ff" opacity=".35" filter="url(#aSoft)"/><circle r="4.8" fill="url(#aIris)"/><g class="geo" fill="none" stroke="#e9fdff" stroke-width=".32" opacity=".85"><circle r="1.55"/><circle cx="1.55" cy="0.00" r="1.55"/><circle cx="0.78" cy="1.34" r="1.55"/><circle cx="-0.77" cy="1.34" r="1.55"/><circle cx="-1.55" cy="0.00" r="1.55"/><circle cx="-0.78" cy="-1.34" r="1.55"/><circle cx="0.78" cy="-1.34" r="1.55"/><circle r="3.2" stroke-width=".28"/><path d="M0 -3.1 L2.68 1.55 L-2.68 1.55 Z M0 3.1 L2.68 -1.55 L-2.68 -1.55 Z" stroke="#ffe7a3" stroke-width=".3"/></g><circle r="1.15" fill="#120a3a"/><circle r=".55" fill="#bffcff"/><circle cx="-1.9" cy="-2" r="1.3" fill="#fff"/><circle cx="1.7" cy="1.4" r=".6" fill="#fff" opacity=".8"/></g>
      <path d="M9 1 Q3 -8 -9 -3" stroke="#3a2a7a" stroke-width="1.1" fill="none"/></g>
      <path class="lid" d="M8 -.5 Q0 4 -8 -1.5" stroke="#4a3a92" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0"/></g>
    <path d="M-17 -253 Q-11 -256 -5 -253 M17 -253 Q11 -256 5 -253" stroke="#b9a5ee" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M0 -236 Q-1.5 -231 0 -230" stroke="#c3b0ef" stroke-width=".9" fill="none" stroke-linecap="round"/>
    <path class="mouth" fill="#3b1f5e" stroke="#9a6fc4" stroke-width=".9" stroke-linejoin="round"/>
    <g class="visor" opacity="0"><path d="M-27 -250 Q0 -258 27 -250 L25 -236 Q12 -232 0 -238 Q-12 -232 -25 -236 Z" fill="#10123a" opacity=".88" stroke="#7af0ff" stroke-width="1"/>
      <path d="M-22 -247 Q-10 -251 0 -248" stroke="#ff8ff0" stroke-width="1.4" opacity=".8" fill="none"/></g>
    <g class="thirdEye" transform="translate(0 -263)"><circle r="9" fill="url(#aGlow)" class="teGlow"/><g class="teGeo" fill="none" stroke-linejoin="round"><circle r="5.6" stroke="url(#aGold)" stroke-width=".7"/><path d="M0 -4.8 L4.16 2.4 L-4.16 2.4 Z" stroke="#ffe7a3" stroke-width=".55"/><path d="M0 4.8 L4.16 -2.4 L-4.16 -2.4 Z" stroke="#9ff3ff" stroke-width=".55"/><path d="M0 -2.9 L2.5 1.45 L-2.5 1.45 Z" stroke="#ffb0f0" stroke-width=".45"/><path d="M0 2.9 L2.5 -1.45 L-2.5 -1.45 Z" stroke="#ffe7a3" stroke-width=".45"/></g><circle r="1.1" fill="#fff" filter="url(#aBloom)"/></g>
    <g class="crown"><path d="M0 -326 L5.5 -309 L0 -296 L-5.5 -309 Z" fill="url(#aCrystal)" stroke="#fff" stroke-width=".5" filter="url(#aBloom)"/>
      <path d="M-15 -309 L-11.5 -301 L-15 -295 L-18.5 -301 Z M15 -309 L18.5 -301 L15 -295 L11.5 -301 Z" fill="url(#aCrystal)" stroke="#fff" stroke-width=".4" opacity=".9"/></g>
    <g class="orbs"><circle r="2.2" fill="#fff" filter="url(#aBloom)"/><circle r="1.7" fill="#9ff3ff" filter="url(#aBloom)"/><circle r="1.9" fill="#ffb0f0" filter="url(#aBloom)"/><circle r="1.1" fill="#ffe7a3" filter="url(#aBloom)"/><circle r="1.2" fill="#c9a6ff" filter="url(#aBloom)"/><circle r="1" fill="#fff" filter="url(#aBloom)"/></g>
  </g>
  <g class="armL">${ARM(-1)}</g>
  <g class="armR">${ARM(1)}</g>
</g>`;

/* flower of life for the halo (behind the head), drawn once */
function haloSVG(){
  /* 19 circles: centre, 6 at r, 6 at 2r and 6 at r*sqrt(3) (between), inside an outer ring of 3r */
  const r = 15, pts = [[0, 0]], P = Math.PI / 3;
  for(let i = 0; i < 6; i++) pts.push([r * Math.cos(i * P), r * Math.sin(i * P)]);
  for(let i = 0; i < 6; i++) pts.push([2 * r * Math.cos(i * P), 2 * r * Math.sin(i * P)]);
  for(let i = 0; i < 6; i++) pts.push([r * Math.sqrt(3) * Math.cos(i * P + P / 2), r * Math.sqrt(3) * Math.sin(i * P + P / 2)]);
  let s = '<g fill="none" filter="url(#aBloom)">';
  pts.forEach((p, i) => { s += '<circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="' + r + '" stroke="' + (i < 7 ? '#ffe7a3' : '#9ff3ff') + '" stroke-width=".7"/>'; });
  s += '<circle r="' + (3 * r) + '" stroke="#ffe7a3" stroke-width="1"/><circle r="' + (3 * r + 3.5) + '" stroke="#9ff3ff" stroke-width=".45" stroke-dasharray="2 3"/></g>';
  for(let i = 0; i < 12; i++){ const a = i * Math.PI / 6; s += '<circle cx="' + ((3 * r + 7) * Math.cos(a)).toFixed(2) + '" cy="' + ((3 * r + 7) * Math.sin(a)).toFixed(2) + '" r="1" fill="#fff"/>'; }
  return s;
}
const CHAKRA = [['#ff3b5c', -124], ['#ff8a3b', -138], ['#ffd93b', -160], ['#4dff8a', -178], ['#3bc4ff', -205]];

/* ---------------------------------------------------------------- the rig */
class Rig {
  constructor(parent){
    this.el = document.createElementNS(NS, 'svg'); this.el.setAttribute('viewBox', '-130 -330 260 350'); this.el.setAttribute('class', 'rig');
    this.el.innerHTML = SVG; parent.appendChild(this.el);
    const q = s => this.el.querySelector(s);
    this.g = { root: q('.root'), halo: q('.halo'), cape: q('.cape'), capeP: q('.capeP'), capeN: q('.capeN'), capeN2: q('.capeN2'), capeStars: q('.capeStars'),
      legL: q('.legL'), legR: q('.legR'), thL: q('.legL .thigh'), shL: q('.legL .shin'), thR: q('.legR .thigh'), shR: q('.legR .shin'),
      skirt: q('.skirt'), lotus: q('.lotus'), torso: q('.torso'), head: q('.head'), armL: q('.armL'), armR: q('.armR'), uaL: q('.armL .upper'), faL: q('.armL .fore'), uaR: q('.armR .upper'), faR: q('.armR .fore'),
      eyeL: q('.eyeL .eyeS'), eyeR: q('.eyeR .eyeS'), irisL: q('.eyeL .iris'), irisR: q('.eyeR .iris'), lidL: q('.eyeL .lid'), lidR: q('.eyeR .lid'), mouth: q('.mouth'),
      te: q('.teGlow'), teGeo: q('.teGeo'), geos: [...this.el.querySelectorAll('.iris .geo')], glyph: q('.glyph'), crown: q('.crown'), orbs: [...this.el.querySelectorAll('.orbs circle')], aura: q('.aura'), chakras: q('.chakras'), heart: q('.heartGlow'), visor: q('.visor'),
      au1: q('.au1'), au2: q('.au2'), stops1: [...this.el.querySelectorAll('.sk1')], stops2: [...this.el.querySelectorAll('.sk2')], stops3: [...this.el.querySelectorAll('.sk3')] };
    this.g.halo.innerHTML = haloSVG();
    let st = ''; for(let i = 0; i < 16; i++) st += '<circle cx="' + (Math.random() * 80 - 40).toFixed(1) + '" cy="' + (-190 + Math.random() * 150).toFixed(1) + '" r="' + (Math.random() * .9 + .3).toFixed(2) + '" fill="#fff" opacity="' + (Math.random() * .6 + .3).toFixed(2) + '"/>';
    this.g.capeStars.innerHTML = st;
    this.g.chakras.innerHTML = CHAKRA.map(c => '<circle cx="0" cy="' + c[1] + '" r="3.4" fill="' + c[0] + '" opacity="0" filter="url(#aBloom)"/>').join('');
    this.chakraEls = [...this.g.chakras.children];
    this.k = 1; this.clip = 'idle'; this.t = 0; this.p = Object.assign({}, BASE); this.dir = 1; this.vx = 0;
    this.look = null; this.talking = false; this.blinkAt = 2; this.blinkT = 0; this.time = 0; this.chakra = 0; this.ax = 0; this.ay = 0; this.M = {};
    this.update(0);
  }
  setSize(px){ this.k = px / 300; this.el.style.width = (260 * this.k) + 'px'; this.el.style.height = (350 * this.k) + 'px'; this.el.style.left = (-130 * this.k) + 'px'; this.el.style.top = (-330 * this.k) + 'px'; }
  play(name, restart){ if(!CLIPS[name]) name = 'idle'; if(name !== this.clip || restart){ this.clip = name; this.t = 0; } }
  setAnchor(x, y){ this.ax = x; this.ay = y; }
  setVisor(on){ this.g.visor.setAttribute('opacity', on ? 1 : 0); }
  update(dt){
    this.t += dt; this.time += dt;
    const target = Object.assign({}, BASE, CLIPS[this.clip](this.t, this));
    const rate = target.rate || 9, a = dt ? 1 - Math.exp(-dt * rate) : 1, p = this.p;
    for(const k in BASE){
      let d = target[k] - p[k];
      if(ANG.has(k)){ d = ((d + 540) % 360) - 180; p[k] = ((p[k] + d * a + 540) % 360) - 180; }   // joints turn the short way
      else p[k] += d * a;
    }
    p.chew = target.chew;
    /* the skeleton */
    const root = T(0, -p.hover), pel = mul(root, T(0, p.drop)), torso = mul(pel, R(p.tilt, PELVIS[0], PELVIS[1]));
    const head = mul(torso, R(p.head, NECK[0], NECK[1]));
    const limb = (base, j, a1, len, a2) => { const m1 = mul(base, R(a1, j[0], j[1])), m2 = mul(m1, R(a2, j[0], j[1] + len)); return [m1, m2]; };
    const [uaR, faR] = limb(torso, SH.R, p.uaR, UA, p.faR), [uaL, faL] = limb(torso, SH.L, p.uaL, UA, p.faL);
    const [thR, shR] = limb(pel, HIP.R, p.thR, TH, p.shR), [thL, shL] = limb(pel, HIP.L, p.thL, TH, p.shL);
    const skirt = mul(pel, R(p.tilt * .5 + Math.sin(this.time * 1.9) * 1.2 - this.vx * .012, 0, -152));
    this.M = { root, pel, torso, head, uaR, faR, uaL, faL, thR, shR, thL, shL };
    const set = (el, m) => el.setAttribute('transform', mstr(m));
    set(this.g.torso, torso); set(this.g.head, head); set(this.g.skirt, skirt);
    set(this.g.uaR, uaR); set(this.g.faR, faR); set(this.g.uaL, uaL); set(this.g.faL, faL);
    set(this.g.thR, thR); set(this.g.shR, shR); set(this.g.thL, thL); set(this.g.shL, shL);
    set(this.g.cape, torso); set(this.g.lotus, pel);
    const cr = clamp((p.cross - .5) * 2.5 + .5, 0, 1);
    this.g.lotus.setAttribute('opacity', cr.toFixed(3)); this.g.legL.setAttribute('opacity', (1 - cr).toFixed(3)); this.g.legR.setAttribute('opacity', (1 - cr).toFixed(3));
    this.g.aura.setAttribute('transform', mstr(root));
    /* mood aura: two colours (inner, outer) per state, crossfaded over ~1.5 s; a few states move */
    const tm = this.time, AU = {
      joyful: [[44, 95, 72], [36, 90, 66]], playful: [[185 + 60 * (.5 + .5 * Math.sin(tm * 2.4)), 95, 66], [300 - 40 * (.5 + .5 * Math.sin(tm * 2.4 + 1)), 90, 70]],
      loved: [[335, 90, 82], [320, 80, 78]], calm: [[268, 75, 58], [258, 70, 45]], hungry: [[34, 98, 60], [28, 95, 52]],
      sleepy: [[238, 55, 42], [245, 50, 32]], smoke: [[(tm * 40) % 360, 90, 70], [(tm * 40 + 120) % 360, 90, 70]], talking: [[205, 80, 90], [215, 75, 82]] };
    const want = AU[this.aura] || AU.joyful, ka = 1 - Math.exp(-dt * 2.6);
    if(!this.auC) this.auC = want.map(c => c.slice());
    this.auC.forEach((c, i) => { let dh = ((want[i][0] - c[0] + 540) % 360) - 180; c[0] = (c[0] + dh * ka + 360) % 360; c[1] += (want[i][1] - c[1]) * ka; c[2] += (want[i][2] - c[2]) * ka; });
    const hsl = c => 'hsl(' + c[0].toFixed(0) + ',' + c[1].toFixed(0) + '%,' + c[2].toFixed(0) + '%)';
    this.g.au1.setAttribute('stop-color', hsl(this.auC[0])); this.g.au2.setAttribute('stop-color', hsl(this.auC[1]));
    let pulse = .08 * Math.sin(tm * 2);
    if(this.aura === 'calm') pulse = .14 * Math.sin(tm * 1.05);                       // slow breathing
    else if(this.aura === 'hungry') pulse = .07 * Math.sin(tm * 9) * Math.sin(tm * 3.3); // amber flicker
    else if(this.aura === 'talking') pulse = this.talking ? .1 * Math.abs(Math.sin(tm * 6)) : 0;
    else if(this.aura === 'sleepy') pulse = .04 * Math.sin(tm * .8) - .12;
    this.g.aura.setAttribute('opacity', clamp(.55 + p.glow * .4 + pulse, .3, 1).toFixed(3));
    /* the halo turns slowly behind his head */
    const hs_ = 1 + .025 * Math.sin(this.time * 1.6);                                  // soft pulse
    set(this.g.halo, mul(mul(mul(head, T(0, -254)), R(this.time * 8, 0, 0)), [hs_, 0, 0, hs_, 0, 0]));
    this.g.halo.setAttribute('opacity', clamp(.3 + p.glow * .55 + .06 * Math.sin(this.time * 1.6), 0, 1).toFixed(3));
    /* the cape ripples and trails behind when he moves */
    const tt = this.time, sw = clamp(-this.vx * .06, -22, 22), w = i => Math.sin(tt * 2.2 + i) * 3;
    const yB = -38 - p.cross * 24;
    const cape = 'M-25 -200 Q-38 -150 ' + (-46 + sw + w(0)).toFixed(1) + ' ' + (yB + 2).toFixed(1) + ' Q' + (-24 + sw + w(1)).toFixed(1) + ' ' + (yB + 6 + w(2)).toFixed(1) + ' ' + (sw * .9).toFixed(1) + ' ' + (yB + w(3)).toFixed(1) +
      ' Q' + (24 + sw + w(4)).toFixed(1) + ' ' + (yB + 6 + w(5)).toFixed(1) + ' ' + (46 + sw + w(6)).toFixed(1) + ' ' + (yB + 2).toFixed(1) + ' Q38 -150 25 -200 Q0 -212 -25 -200 Z';
    this.g.capeP.setAttribute('d', cape); this.g.capeN.setAttribute('d', cape); this.g.capeN2.setAttribute('d', cape);
    /* face: blink, look, mouth */
    this.blinkAt -= dt; if(this.blinkAt <= 0){ this.blinkT = .14; this.blinkAt = 2 + Math.random() * 4.5; }
    if(this.blinkT > 0) this.blinkT -= dt;
    const open = clamp(p.eyes * (this.blinkT > 0 ? .08 : 1), 0, 1.25);
    [this.g.eyeL, this.g.eyeR].forEach(e => e.setAttribute('transform', 'scale(1 ' + Math.max(.06, open).toFixed(3) + ')'));
    [this.g.lidL, this.g.lidR].forEach(e => e.setAttribute('opacity', open < .25 ? 1 : 0));
    let lx = p.lookX * 3, ly = p.lookY * 2;
    if(this.look && Math.abs(p.lookX) < .3 && Math.abs(p.lookY) < .3){
      const hp = this.point('head', 0, -242), dx = this.look.x - hp.x, dy = this.look.y - hp.y, d = Math.hypot(dx, dy) || 1, s = Math.min(1, d / 200);
      lx = dx / d * 3 * s; ly = dy / d * 2 * s;
    }
    const ir = 'translate(' + lx.toFixed(2) + ' ' + ly.toFixed(2) + ')'; this.g.irisL.setAttribute('transform', ir); this.g.irisR.setAttribute('transform', ir);
    let mo = p.mouth; if(this.talking) mo = Math.max(mo, .25 + .45 * Math.abs(Math.sin(this.time * 11)) * Math.abs(Math.sin(this.time * 3.7 + 1)));
    if(p.chew) mo = .12 + .18 * Math.abs(Math.sin(this.time * 12));
    const sm = p.smile * 3.2, my = MOUTH[1], wd = 6.5 - mo * 2;
    this.g.mouth.setAttribute('d', 'M' + (-wd) + ' ' + my + ' Q0 ' + (my + sm - mo * 1.5).toFixed(2) + ' ' + wd + ' ' + my + ' Q0 ' + (my + sm + mo * 9 + .6).toFixed(2) + ' ' + (-wd) + ' ' + my + ' Z');
    /* the third eye and the crown breathe light */
    this.g.te.setAttribute('r', (8 + 3 * p.glow + 1.5 * Math.sin(this.time * 2.6)).toFixed(2));
    this.g.te.setAttribute('opacity', (.55 + .45 * p.glow).toFixed(3));
    this.g.teGeo.setAttribute('transform', 'rotate(' + ((this.time * 9) % 360).toFixed(1) + ')');
    this.g.geos.forEach((gq, i) => gq.setAttribute('transform', 'rotate(' + (((i ? -1 : 1) * this.time * 16) % 360).toFixed(1) + ')'));
    this.g.glyph.setAttribute('opacity', (.35 + .3 * Math.sin(this.time * 1.3) + .3 * p.glow).toFixed(2));
    this.g.crown.setAttribute('transform', 'translate(0 ' + (2.2 * Math.sin(this.time * 2)).toFixed(2) + ')');
    this.g.orbs.forEach((o, i) => { const n = this.g.orbs.length, a = this.time * (i % 2 ? -1.1 : 1.4) + i * 6.283 / n, rr = i % 2 ? 36 : 44; o.setAttribute('cx', (rr * Math.cos(a)).toFixed(2)); o.setAttribute('cy', (-282 + 9 * Math.sin(a)).toFixed(2)); o.setAttribute('opacity', (.55 + .45 * Math.sin(a)).toFixed(2)); });
    /* opalescent skin: the colours drift slowly round the rainbow */
    const h = (this.time * 14) % 360, hs = (o, l) => 'hsl(' + ((h + o) % 360).toFixed(0) + ',85%,' + l + '%)';
    this.g.stops1.forEach(s => s.setAttribute('stop-color', hs(210, 91))); this.g.stops2.forEach(s => s.setAttribute('stop-color', hs(265, 88))); this.g.stops3.forEach(s => s.setAttribute('stop-color', hs(320, 87)));
    /* chakras light up one by one while he meditates */
    this.chakraEls.forEach((c, i) => c.setAttribute('opacity', clamp(this.chakra * 5 - i, 0, 1).toFixed(2)));
    this.g.heart.setAttribute('opacity', (p.glow * .7).toFixed(2));
  }
  /* rig point in a named frame -> page px */
  point(frame, x, y){ const q = ap(this.M[frame] || this.M.root, x, y); return { x: this.ax + q.x * this.k, y: this.ay + q.y * this.k }; }
  get handR(){ return this.point('faR', SH.R[0], SH.R[1] + UA + FA); }
  get handL(){ return this.point('faL', SH.L[0], SH.L[1] + UA + FA); }
  get mouth(){ return this.point('head', MOUTH[0], MOUTH[1] + 1); }
  get footR(){ return this.point('shR', HIP.R[0] + 3, HIP.R[1] + TH + SN + 4); }
  get footL(){ return this.point('shL', HIP.L[0] - 3, HIP.L[1] + TH + SN + 4); }
  headPoint(){ const t = this.point('head', 0, -320), c = this.point('head', 0, -245); return { x: t.x, top: t.y, cy: c.y, mouth: this.mouth.y }; }
  box(){ const t = this.headPoint(); return { left: this.ax - 42 * this.k, right: this.ax + 42 * this.k, top: t.top + 20 * this.k, bottom: this.ay - this.p.hover * this.k * .4 }; }
  hit(x, y){
    const c = this.point('torso', 0, -170), h = this.point('head', 0, -250), k = this.k;
    const inE = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
    return inE(c.x, c.y, 40 * k, 62 * k) || inE(h.x, h.y, 32 * k, 44 * k) || inE(this.point('pel', 0, -80).x, this.point('pel', 0, -80).y, 30 * k, 60 * k);
  }
}
Rig.CLIPS = CLIPS; Rig.SMOKE_P = SMOKE_P; Rig.EAT_P = EAT_P; Rig.SIP_P = SIP_P; Rig.KICK_T = KICK_T;
g.Rig = Rig;
})(window);
