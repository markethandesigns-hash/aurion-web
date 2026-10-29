/* Aurion's wake word and "was that really speech?" checks (v1.2.2).
   Shared by the desktop app, the web version and the tests (works in a page or in Node).
   - The name only counts as a distinct word at the START of what you said ("Aurion, ...", "Hey Aurion ...",
     "Okay so, Aurion ..."), or right after "hey/hi/okay" later on when it is an exact spelling.
   - Fuzzy spellings must be very close (one letter off) and start like his name, so TV words such as
     "Marion", "Aurora", "orient", "origin", "onion" no longer wake him.
   - Whisper's stock hallucinations on noise/music ("Thank you.", "[BLANK_AUDIO]", "(music)", "you") and
     low-confidence or too-short/too-quiet turns are rejected before the wake word is even looked at. */
(function(root){
'use strict';
const WAKE_SET = new Set(['aurion','aurian','auryon','auriyon','orion','orian','oryan','oreon','orien','arion','aureon','ourion','aurionn']);
function lev(a, b){ const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for(let j = 1; j <= b.length; j++) d[0][j] = j;
  for(let i = 1; i <= a.length; i++) for(let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)); return d[a.length][b.length]; }
const NOT_HIM = new Set(['origin','onion','oregon','orange','arena','aaron','marion','aurora','orient','oran','aryan','arian','urine','ryan','iron','irony','union','opinion','option','motion','lotion','ocean','region','legion','orinoco','aria','arizona','auron']);
function isWakeTok(t, strict){
  if(!t || t.length < 5 || t.length > 8 || NOT_HIM.has(t)) return false;
  if(WAKE_SET.has(t)) return true;
  if(strict) return false;
  return /^(au|o|ow)/.test(t) && /r/.test(t) && /(on|an|en|yn)$/.test(t) && (lev(t, 'aurion') <= 1 || lev(t, 'orion') <= 1);
}
const GREET = new Set(['hey','hi','hello','ok','okay','yo','oh','so','um','uh','hmm','well']);
const strip = s => s.replace(/^[\s,.!?;:'"\-…]+/, '').trim();
function findWake(text){
  const raw = String(text || ''), toks = []; const re = /[A-Za-z']+/g; let m;
  while((m = re.exec(raw))) toks.push({ w: m[0].toLowerCase().replace(/'/g, ''), start: m.index, end: m.index + m[0].length });
  /* 1) at the start: up to two filler/greeting words, then his name */
  for(let i = 0; i < toks.length && i < 3; i++){
    if(isWakeTok(toks[i].w)) return { hit: true, where: 'start', rest: strip(raw.slice(toks[i].end)) };
    if(toks[i+1] && toks[i].w.length <= 2 && isWakeTok(toks[i].w + toks[i+1].w)) return { hit: true, where: 'start', rest: strip(raw.slice(toks[i+1].end)) };   // "O Ryan", "Au rion"
    if(!GREET.has(toks[i].w)) break;
  }
  /* 2) later in a sentence only as a clear call: "hey/hi/okay Aurion" with the exact name, set off as its own word */
  for(let i = 1; i < toks.length - 0; i++){
    if(!/^(hey|hi|okay|ok|yo)$/.test(toks[i-1].w)) continue;
    if(isWakeTok(toks[i].w, true)) return { hit: true, where: 'call', rest: strip(raw.slice(toks[i].end)) };
  }
  /* 3) at the start of a later sentence, said TO him: "...made them work. Aurion, can you hear me?" (name set off by a comma/?/end) */
  for(let i = 1; i < toks.length; i++){
    const before = raw.slice(0, toks[i].start).trimEnd(), after = raw.slice(toks[i].end);
    if(!/[.!?]$/.test(before) || !isWakeTok(toks[i].w) || !/^\s*([,?!.]|$)/.test(after)) continue;
    return { hit: true, where: 'sentence', rest: strip(after) };
  }
  return { hit: false, rest: raw };
}
/* Whisper output that is almost always made up from noise, music, TV or silence */
const JUNK = [/^\W*$/, /^\[.*\]$/, /^\(.*\)$/, /^♪/, /♪\W*$/,
  /^(thank you|thanks|thank you so much|thanks for watching|thank you for watching|bye|bye bye|goodbye|you|okay|ok|oh|uh|um|hmm|mm|so|yeah|yes|no|i|the|and|music|applause|laughter|silence)\W*$/i,
  /subscribe|subtitles? by|captions? by|amara\.org|transcribed by|www\.|\.com\b/i];
function cleanText(t){ return String(t || '').replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.,!?]+|[\s]+$/g, '').trim(); }
/* meta: { noSpeech, logprob } from Whisper when available; stats: { voiced, len, snr } from the VAD.
   Returns '' when it looks like real speech, else the reason it was dropped. */
function junkReason(raw, meta, stats, o){
  o = o || {}; const text = cleanText(raw), words = text.split(/\s+/).filter(w => /[a-z]/i.test(w));
  if(!text || !words.length) return 'no words (' + JSON.stringify(String(raw || '').slice(0, 30)) + ')';
  const wk = findWake(text);
  const sure = meta && meta.noSpeech != null && meta.noSpeech < .3 && meta.logprob != null && meta.logprob > -.6 && (!stats || (stats.voiced || 0) >= .3);
  if(!wk.hit && JUNK.some(r => r.test(String(raw).trim()) || r.test(text)) && !(o.follow && sure && JUNK[5].test(text))) return 'whisper noise phrase ' + JSON.stringify(text);   // a clear "yes"/"thank you" right after he answered is fine
  if(/\b(\w+)\b(?:[\s.,…-]+\1\b){2,}/i.test(text)) return 'recognition stutter';
  if(meta){
    if(meta.noSpeech != null && meta.noSpeech > .6 && !(wk.hit && meta.noSpeech < .8)) return 'whisper says no speech (' + meta.noSpeech.toFixed(2) + ')';
    if(meta.logprob != null && meta.logprob < (wk.hit ? -1.2 : -0.9)) return 'low confidence (' + meta.logprob.toFixed(2) + ')';
  }
  if(stats && o.handsFree){
    if(stats.voiced != null && stats.voiced < .15) return 'too little voice (' + stats.voiced.toFixed(2) + 's)';
    if(stats.snr != null && stats.snr < 3.2) return 'not loud enough above the room (x' + stats.snr.toFixed(1) + ')';
  }
  return '';
}
const api = { findWake, isWakeTok, junkReason, cleanText, lev, WAKE_SET };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.Wake = api;
})(typeof window !== 'undefined' ? window : globalThis);
