/* Everything Aurion handles, drawn as small inline SVGs (no emoji, no image files): his star-food, the peace pipe,
   the footbag, and his ship. Props.make(id, px) returns a sized element; Props.bite(el) makes a piece go missing. */
(function(g){
'use strict';
const svg = (w, h, body) => '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">' + body + '</svg>';
let uid = 0;
const ART = {
  /* a slice of star fruit that glows from inside */
  starfruit: [44, 42, u => `
    <defs><radialGradient id="sf${u}" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fffbe0"/><stop offset=".55" stop-color="#ffe36b"/><stop offset="1" stop-color="#f0a52a"/></radialGradient></defs>
    <circle cx="22" cy="22" r="20" fill="#ffe36b" opacity=".25" filter="blur(3px)"/>
    ${[0,1,2,3,4].map(i => { const a = -Math.PI/2 + i*2*Math.PI/5, b = a + Math.PI/5, b2 = a - Math.PI/5;
      return '<g class="bitepart"><path d="M22 22 L' + (22 + 9*Math.cos(b2)).toFixed(1) + ' ' + (22 + 9*Math.sin(b2)).toFixed(1) + ' L' + (22 + 20*Math.cos(a)).toFixed(1) + ' ' + (22 + 20*Math.sin(a)).toFixed(1) + ' L' + (22 + 9*Math.cos(b)).toFixed(1) + ' ' + (22 + 9*Math.sin(b)).toFixed(1) + ' Z" fill="url(#sf' + u + ')" stroke="#d48a1c" stroke-width=".8" stroke-linejoin="round"/>' +
      '<circle cx="' + (22 + 7*Math.cos(a)).toFixed(1) + '" cy="' + (22 + 7*Math.sin(a)).toFixed(1) + '" r="1.2" fill="#a8641a"/></g>'; }).join('')}
    <circle cx="22" cy="22" r="3" fill="#fff8c8"/>`],
  /* moon berries: little glowing blue orbs on a silver sprig */
  moonberries: [38, 32, u => `
    <defs><radialGradient id="mb${u}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#e9fbff"/><stop offset=".4" stop-color="#7fd8ff"/><stop offset="1" stop-color="#3a52c8"/></radialGradient></defs>
    <path d="M18 3 Q22 0 27 2" stroke="#c9d6ff" stroke-width="1.4" fill="none"/><ellipse cx="28" cy="3" rx="4.5" ry="2" fill="#dfe8ff" transform="rotate(-20 28 3)"/>
    <g class="bitepart"><circle cx="11" cy="20" r="7.5" fill="url(#mb${u})"/></g>
    <g class="bitepart"><circle cx="25" cy="21" r="7.5" fill="url(#mb${u})"/></g>
    <g class="bitepart"><circle cx="18" cy="11" r="7.5" fill="url(#mb${u})"/></g>
    <circle cx="18" cy="17" r="14" fill="#7fd8ff" opacity=".18"/>`],
  moonberry: [14, 14, u => `<defs><radialGradient id="m1${u}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#e9fbff"/><stop offset=".4" stop-color="#7fd8ff"/><stop offset="1" stop-color="#3a52c8"/></radialGradient></defs><circle cx="7" cy="7" r="6" fill="url(#m1${u})"/>`],
  /* manna: a golden loaf with a glowing glyph baked in */
  manna: [48, 30, u => `
    <defs><radialGradient id="mn${u}" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#fff0c0"/><stop offset=".6" stop-color="#eebc63"/><stop offset="1" stop-color="#b9792e"/></radialGradient></defs>
    <g class="bitepart"><path d="M3 17 Q3 4 17 4 L24 4 L24 27 L17 27 Q3 27 3 17 Z" fill="url(#mn${u})" stroke="#8a5420" stroke-width=".8"/></g>
    <g class="bitepart"><path d="M24 4 L31 4 Q45 4 45 17 Q45 27 31 27 L24 27 Z" fill="url(#mn${u})" stroke="#8a5420" stroke-width=".8"/></g>
    <path d="M18 10 L24 20 L30 10 Z M18 17 L24 7 L30 17 Z" fill="none" stroke="#fffbe0" stroke-width="1.2" opacity=".9"/>`],
  /* moon mushroom: a teal-glowing cap with stars for spots */
  mushroom: [40, 44, u => `
    <defs><radialGradient id="mc${u}" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#b9fff2"/><stop offset=".6" stop-color="#3fd6c8"/><stop offset="1" stop-color="#2a5fb8"/></radialGradient>
    <linearGradient id="ms${u}" x1="0" x2="1"><stop offset="0" stop-color="#d9d2fb"/><stop offset=".6" stop-color="#ffffff"/><stop offset="1" stop-color="#c0b6ee"/></linearGradient></defs>
    <ellipse cx="20" cy="18" rx="19" ry="14" fill="#3fd6c8" opacity=".22"/>
    <path d="M15 22 Q13 36 12 42 Q20 45 28 42 Q27 36 25 22 Z" fill="url(#ms${u})" stroke="#8f86c8" stroke-width=".8"/>
    <g class="bitepart"><path d="M3 23 Q4 5 20 4 Q36 5 37 23 Q20 27 3 23 Z" fill="url(#mc${u})" stroke="#1f4a8a" stroke-width=".8"/>
    <path d="M12 10 l1 2.2 2.3.3 -1.7 1.5.5 2.3 -2.1-1.2 -2.1 1.2.5-2.3 -1.7-1.5 2.3-.3Z M26 12 l.8 1.6 1.7.2 -1.2 1.1.3 1.7 -1.6-.9 -1.6.9.3-1.7 -1.2-1.1 1.7-.2Z" fill="#fff"/></g>`],
  /* nebula tea in a glass cup: a swirl of violet and teal, sparkly steam */
  tea: [40, 42, u => `
    <defs><linearGradient id="tg${u}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".5" stop-color="#8a5cff"/><stop offset="1" stop-color="#3fd6e8"/></linearGradient></defs>
    <g class="steam"><path class="s1" d="M14 12 Q10 7 14 2" stroke="#e9d8ff" stroke-width="1.6" fill="none" opacity=".75" stroke-linecap="round"/><path class="s2" d="M22 12 Q26 7 22 1" stroke="#c9f7ff" stroke-width="1.6" fill="none" opacity=".65" stroke-linecap="round"/></g>
    <path d="M30 18 Q38 18 37 25 Q36 31 28 30" stroke="#d9e8ff" stroke-width="2.6" fill="none" opacity=".9"/>
    <path d="M6 14 L31 14 L29 35 Q28 39 18.5 39 Q9 39 8 35 Z" fill="url(#tg${u})" opacity=".9"/>
    <path d="M6 14 L31 14 L29 35 Q28 39 18.5 39 Q9 39 8 35 Z" fill="none" stroke="#e9f3ff" stroke-width="1.1"/>
    <path d="M12 24 Q18 19 24 24 Q18 29 13 26" stroke="#fff" stroke-width="1" fill="none" opacity=".6"/>
    <circle cx="22" cy="30" r=".9" fill="#fff"/><circle cx="13" cy="20" r=".7" fill="#fff"/>
    <ellipse cx="18.5" cy="14" rx="12.5" ry="2.4" fill="#d9c4ff" stroke="#e9f3ff" stroke-width=".8"/>`],
  /* celestial honey: a golden jar with a star on the lid */
  honey: [36, 42, u => `
    <defs><linearGradient id="hj${u}" x1="0" x2="1"><stop offset="0" stop-color="#d9951e"/><stop offset=".45" stop-color="#ffd558"/><stop offset="1" stop-color="#c47e1a"/></linearGradient></defs>
    <circle cx="18" cy="26" r="17" fill="#ffd558" opacity=".2"/>
    <path d="M7 14 Q5 22 6 32 Q7 40 18 40 Q29 40 30 32 Q31 22 29 14 Z" fill="url(#hj${u})" stroke="#8a5a10" stroke-width=".9"/>
    <rect x="8" y="8" width="20" height="7" rx="2" fill="#4b3aa8" stroke="#2a1f6e" stroke-width=".8"/>
    <path d="M18 4 l1.4 3 3.2.4 -2.4 2.2.7 3.2 -2.9-1.6 -2.9 1.6.7-3.2 -2.4-2.2 3.2-.4Z" fill="#ffe7a3" stroke="#c8932e" stroke-width=".4"/>
    <path d="M12 24 Q20 27 26 24" stroke="#fff" stroke-width="1.2" opacity=".4" fill="none"/><path d="M9 28 Q10 34 12 37" stroke="#fff" stroke-width="1.6" opacity=".4" fill="none"/>`],
  /* the peace pipe: carved stem with beads and two feathers, a rose-quartz bowl. Mouthpiece at x=0, bowl at the right. */
  pipe: [80, 22, u => `
    <defs><linearGradient id="pw${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c58a52"/><stop offset=".5" stop-color="#8a5228"/><stop offset="1" stop-color="#5e3418"/></linearGradient>
    <linearGradient id="pq${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe0f0"/><stop offset=".5" stop-color="#f59ac8"/><stop offset="1" stop-color="#b85a9a"/></linearGradient></defs>
    <path d="M0 9.4 L62 8 L62 12 L0 11.6 Z" fill="url(#pw${u})" stroke="#4a2810" stroke-width=".5"/>
    <rect x="0" y="9" width="4" height="3.2" rx="1" fill="#e9d8b0"/>
    <circle cx="20" cy="10.5" r="1.8" fill="#3bc4ff"/><circle cx="24" cy="10.5" r="1.8" fill="#ff4d6d"/><circle cx="28" cy="10.5" r="1.8" fill="#ffd93b"/><circle cx="32" cy="10.5" r="1.8" fill="#fff"/>
    <path d="M30 12 Q31 18 27 22 Q26 17 30 12 Z" fill="#fff" stroke="#8a7a6a" stroke-width=".4"/><path d="M33 12 Q36 19 33 23 Q31 18 33 12 Z" fill="#e8e0d0" stroke="#8a7a6a" stroke-width=".4"/>
    <path d="M58 6 L72 4 L74 14 Q72 18 66 18 Q60 18 59 14 Z" fill="url(#pq${u})" stroke="#8a3a6a" stroke-width=".6"/>
    <ellipse cx="73" cy="4.6" rx="3.4" ry="1.6" fill="#3a1a2a"/>
    <ellipse class="ember" cx="73" cy="4.2" rx="2.6" ry="1.3" fill="#ff8a3a"/>`],
  /* the footbag: a crocheted rainbow ball */
  sack: [24, 24, u => `
    <defs><radialGradient id="hs${u}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset=".4" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <clipPath id="hc${u}"><circle cx="12" cy="12" r="10.5"/></clipPath></defs>
    <g clip-path="url(#hc${u})"><rect width="24" height="5" y="0" fill="#ff4d6d"/><rect width="24" height="4" y="5" fill="#ff9a3b"/><rect width="24" height="4" y="9" fill="#ffd93b"/><rect width="24" height="4" y="13" fill="#4dff8a"/><rect width="24" height="4" y="17" fill="#3bc4ff"/><rect width="24" height="4" y="21" fill="#a86bff"/>
    <path d="M0 4 Q12 8 24 4 M0 12 Q12 16 24 12 M0 20 Q12 24 24 20" stroke="#000" stroke-opacity=".15" fill="none"/></g>
    <circle cx="12" cy="12" r="10.5" fill="url(#hs${u})" stroke="#2a1f6e" stroke-width=".8"/>`]
};
function make(id, px){
  const a = ART[id], u = ++uid, el = document.createElement('div');
  el.className = 'item item-' + id; el.style.width = px + 'px'; el.style.height = (px * a[1] / a[0]) + 'px';
  el.innerHTML = svg(a[0], a[1], a[2](u)); return el;
}
function bite(el){ const parts = [...el.querySelectorAll('.bitepart')].filter(p => p.style.opacity !== '0'); if(!parts.length) return 0; const p = parts[Math.floor(Math.random() * parts.length)]; p.style.transition = 'opacity .2s'; p.style.opacity = '0'; return parts.length - 1; }

/* ---- the ship: an opalescent saucer, glass dome, chasing rim lights, a flower of life on its belly ---- */
function ship(px, small){
  const el = document.createElement('div'); el.className = 'ship' + (small ? ' mini' : ''); el.style.width = px + 'px'; el.style.height = (px * .62) + 'px';
  const u = ++uid; let lights = '';
  for(let i = 0; i < 11; i++){ const x = 18 + i * 16.4, y = 62 + Math.sin(i / 10 * Math.PI) * 6.5; lights += '<circle class="rl" style="animation-delay:' + (i * .09).toFixed(2) + 's" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.2"/>'; }
  el.innerHTML = svg(200, 124, `
    <defs><linearGradient id="hull${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#d6d9ff"/><stop offset=".7" stop-color="#9d93e8"/><stop offset="1" stop-color="#4c3fa8"/></linearGradient>
    <linearGradient id="opal${u}" x1="0" x2="1"><stop offset="0" stop-color="#ff9ee8" stop-opacity=".55"/><stop offset=".35" stop-color="#9ff3ff" stop-opacity=".0"/><stop offset=".65" stop-color="#ffe7a3" stop-opacity=".45"/><stop offset="1" stop-color="#9ff3ff" stop-opacity=".55"/></linearGradient>
    <radialGradient id="dome${u}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".35" stop-color="#c9f7ff" stop-opacity=".55"/><stop offset="1" stop-color="#6a7cff" stop-opacity=".35"/></radialGradient>
    <radialGradient id="under${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e9fdff"/><stop offset=".5" stop-color="#7af0ff" stop-opacity=".7"/><stop offset="1" stop-color="#7af0ff" stop-opacity="0"/></radialGradient></defs>
    <ellipse class="uglow" cx="100" cy="86" rx="60" ry="22" fill="url(#under${u})"/>
    <path d="M30 46 Q36 14 100 10 Q164 14 170 46 Z" fill="url(#dome${u})" stroke="#e9fdff" stroke-width="1.2"/>
    <path d="M58 36 Q70 20 100 18" stroke="#fff" stroke-width="2.4" fill="none" opacity=".8" stroke-linecap="round"/>
    <g class="pilot" opacity=".35"><ellipse cx="100" cy="34" rx="10" ry="12" fill="#cfe0ff"/><circle cx="100" cy="20" r="3" fill="#9ff3ff"/></g>
    <path d="M2 60 Q10 44 100 42 Q190 44 198 60 Q190 76 100 80 Q10 76 2 60 Z" fill="url(#hull${u})" stroke="#2a1f6e" stroke-width="1"/>
    <path d="M2 60 Q10 44 100 42 Q190 44 198 60 Q190 76 100 80 Q10 76 2 60 Z" fill="url(#opal${u})"/>
    <path d="M8 58 Q100 50 192 58" stroke="#ffe7a3" stroke-width="1.6" fill="none"/>
    <g class="rls">${lights}</g>
    <path d="M60 76 Q100 96 140 76 Q100 84 60 76 Z" fill="#3a2f93" stroke="#9ff3ff" stroke-width=".8"/>
    <circle class="core" cx="100" cy="83" r="7" fill="#e9fdff"/>
  `);
  return el;
}
g.Props = { make, bite, ship, ART };
})(window);
