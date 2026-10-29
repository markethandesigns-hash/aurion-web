/* Aurion's voice and ears (page side). Voice.speak(text) cuts whatever he was saying and says the new line:
   main-process Piper / Windows voice → played through a soft starry reverb; else the browser's speechSynthesis.
   Voice.record() / Voice.stopRecord() capture the mic as a 16 kHz mono WAV for transcription. */
(function(){
'use strict';
const host = window.host || {};
const vlog = m => { try{ if(host.log) host.log('voice: ' + m); }catch(_){} };
addEventListener('error', e => vlog('page error ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
addEventListener('unhandledrejection', e => vlog('page rejection ' + (e.reason && e.reason.message || e.reason)));
let recent = [], lastSpokeEnd = 0, lastPlay = null, ctx = null, out = null, cur = null, token = 0, playing = false, info = null;
function audio(){
  if(!ctx){
    ctx = new AudioContext();
    /* dry + a little shimmering hall: generated impulse, no files */
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (1 + .3 * Math.sin(i / 37)); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const dry = ctx.createGain(); dry.gain.value = .92;
    const wet = ctx.createGain(); wet.gain.value = .22;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    out = ctx.createGain(); out.gain.value = 1;
    out.connect(dry).connect(ctx.destination);
    out.connect(hp).connect(conv).connect(wet).connect(ctx.destination);
  }
  if(ctx.state === 'suspended') ctx.resume();
  return ctx;
}
async function getInfo(force){ if(!host.voiceInfo) return { voices: [], piper: false }; if(!info || force){ try{ info = await host.voiceInfo(); }catch(_){ info = { voices: [] }; } } return info; }
let srcs = [];
function stop(){ if(playing) lastSpokeEnd = performance.now(); token++; playing = false; if(cur){ try{ cur.stop(); }catch(_){} cur = null; } srcs.forEach(x => { try{ x.stop(); }catch(_){} }); srcs = []; try{ speechSynthesis.cancel(); }catch(_){} }
function browserSay(text, speed){
  try{
    if(!('speechSynthesis' in window)) return false;
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const v = vs.find(v => /Guy|Ryan|Daniel|Google UK English Male|George|David|Arthur|Mark/i.test(v.name)) || vs[0];
    const u = new SpeechSynthesisUtterance(text); if(v) u.voice = v; u.pitch = .85; u.rate = speed || .9; u.volume = .9;
    speechSynthesis.speak(u); return true;
  }catch(_){ return false; }
}
async function speak(text, o){
  o = o || {}; text = String(text || '').replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
  if(text.length < 3) return 'short';
  stop(); const my = token; playing = true; recent.push({ t: Date.now(), text }); recent = recent.filter(x => Date.now() - x.t < 30000);
  const parts = (text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text]).map(x => x.trim()).filter(x => x.length > 1);
  if(host.voiceSay && parts.length > 1) return speakParts(parts, o, my);
  if(host.voiceSay){
    try{
      const r = await host.voiceSay({ text, voice: o.voice, speed: o.speed });
      if(my !== token) return 'cut';
      if(r && r.ok && (r.b64 || r.wav)){
        const a = audio();
        if(a.state !== 'running'){ try{ await a.resume(); }catch(_){} }
        let ab;
        if(r.b64){ const bin = atob(r.b64), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); ab = u8.buffer; }
        else ab = r.wav.buffer ? r.wav.buffer.slice(r.wav.byteOffset, r.wav.byteOffset + r.wav.byteLength) : r.wav;
        const buf = await a.decodeAudioData(ab); if(my !== token) return 'cut';
        vlog('playing ' + r.engine + ' ' + buf.duration.toFixed(2) + 's, audio ' + a.state + (window.__turnEnd ? ' - timing: ' + Math.round(performance.now() - window.__turnEnd) + 'ms after you stopped talking' : '')); window.__turnEnd = 0;
        const src = a.createBufferSource(); src.buffer = buf; src.detune.value = -40;   // a touch deeper, otherworldly
        src.connect(out); src.onended = () => { if(cur === src){ lastSpokeEnd = performance.now(); cur = null; if(!queued) playing = false; } };
        cur = src; srcs.push(src); src.start(); endAt = a.currentTime + buf.duration; lastPlay = { engine: r.engine, secs: buf.duration, state: a.state }; return 'played';
      }
      vlog('no audio from host: ' + (r && r.why));
    }catch(err){ vlog('playback failed: ' + (err && err.message || err)); if(my !== token) return 'cut'; }
  }
  vlog('fallback: browser speechSynthesis');
  playing = false;
  if(!browserSay(text, o.speed)) return 'none';
  return 'browser';
}
/* long replies: synthesize sentence by sentence and start playing the first one while the rest are made */
/* add more speech after what he is saying now (synthesized right away, played right after) */
let endAt = 0, queued = 0;
async function queue(text, o){
  o = o || {}; text = String(text || '').replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim(); if(text.length < 3) return;
  const my = token; playing = true; queued++; recent.push({ t: Date.now(), text });
  try{
    const r = await host.voiceSay({ text, voice: o.voice, speed: o.speed }); if(my !== token || !(r && r.ok && r.b64)) return;
    const a = audio(), bin = atob(r.b64), u8 = new Uint8Array(bin.length); for(let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const buf = await a.decodeAudioData(u8.buffer); if(my !== token) return;
    for(let w = 0; w < 300 && !cur && my === token; w++) await new Promise(r => setTimeout(r, 30));   // wait for the first sentence to be scheduled
    if(my !== token) return;
    const src = a.createBufferSource(); src.buffer = buf; src.detune.value = -40; src.connect(out);
    const at = Math.max(endAt, a.currentTime + .05); src.start(at); endAt = at + buf.duration; srcs.push(src); cur = src;
    src.onended = () => { if(cur === src && my === token){ lastSpokeEnd = performance.now(); cur = null; playing = false; } };
    vlog('queued ' + buf.duration.toFixed(2) + 's after the first sentence');
  }catch(err){ vlog('queue failed ' + (err && err.message)); }
  finally{ queued--; if(my === token && !cur && !queued) playing = false; }
}
async function speakParts(parts, o, my){
  const t0 = performance.now(), a = audio(); if(a.state !== 'running'){ try{ await a.resume(); }catch(_){} }
  const jobs = parts.map(p => host.voiceSay({ text: p, voice: o.voice, speed: o.speed }).catch(() => null));   // all queued now; Piper makes them in order
  let at = 0, first = true;
  for(let i = 0; i < jobs.length; i++){
    const r = await jobs[i]; if(my !== token) return 'cut';
    if(!(r && r.ok && r.b64)){ vlog('part ' + i + ' had no audio: ' + (r && r.why)); continue; }
    const bin = atob(r.b64), u8 = new Uint8Array(bin.length); for(let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const buf = await a.decodeAudioData(u8.buffer); if(my !== token) return 'cut';
    const src = a.createBufferSource(); src.buffer = buf; src.detune.value = -40; src.connect(out);
    if(first){ at = a.currentTime + .02; first = false; vlog('timing: first sentence audio ' + Math.round(performance.now() - t0) + 'ms after speak' + (window.__turnEnd ? ', ' + Math.round(performance.now() - window.__turnEnd) + 'ms after you stopped talking' : '')); window.__turnEnd = 0; }
    else at = Math.max(at, a.currentTime + .01);
    src.start(at); at += buf.duration; endAt = at; cur = src; srcs.push(src); lastPlay = { engine: r.engine, secs: buf.duration, state: a.state };
    if(i === jobs.length - 1) src.onended = () => { if(my === token && cur === src){ lastSpokeEnd = performance.now(); cur = null; if(!queued) playing = false; } };
  }
  vlog('playing ' + parts.length + ' sentences');
  if(first){ playing = false; return 'none'; }
  return 'played';
}
const speaking = () => { if(playing) return true; try{ return speechSynthesis.speaking; }catch(_){ return false; } };   // true from the moment a line is asked for until it ends

/* ---- the microphone ----
   One open stream feeds two modes: push-to-talk ('ptt': keep everything until stopRecord) and hands-free
   ('vad': calibrate the room's noise floor, start on speech, end after 1.2 s of quiet). While Aurion himself is
   speaking, hands-free frames are ignored so he never records his own voice (echo cancellation is on too). */
let mic = null;
async function openMic(){
  if(mic) return mic;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nomic');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const a = new AudioContext(), src = a.createMediaStreamSource(stream), proc = a.createScriptProcessor(2048, 1, 1), mute = a.createGain(); mute.gain.value = 0;
  mic = { stream, a, src, proc, rate: a.sampleRate, mode: null, chunks: [], t0: 0, vad: null, level: 0 };
  proc.onaudioprocess = e => onFrame(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc); proc.connect(mute); mute.connect(a.destination);
  vlog('mic open ' + a.sampleRate + ' Hz');
  return mic;
}
function closeMic(){ if(!mic) return; const m = mic; mic = null; try{ m.proc.disconnect(); m.src.disconnect(); }catch(_){} m.stream.getTracks().forEach(t => t.stop()); try{ m.a.close(); }catch(_){} }
const rmsOf = f => { let s = 0; for(let i = 0; i < f.length; i++) s += f[i] * f[i]; return Math.sqrt(s / f.length); };
function onFrame(f){
  const m = mic; if(!m) return;
  const r = rmsOf(f); m.level = r; m.peak = Math.max(m.peak || 0, r);
  if(m.mode === 'ptt'){
    m.chunks.push(f);
    /* push-to-talk also ends by itself after a 1.5 s pause once you've said something */
    const fs = f.length / m.rate, p = m.ptt; if(p){ p.n++; if(p.n < 10){ p.floor = Math.min(p.floor, r); } const thr = Math.min(.06, Math.max(.007, p.floor * 2.6));
      if(r > thr){ p.voiced += fs; p.quiet = 0; } else p.quiet += fs;
      if(p.voiced > .4 && p.quiet > 1.5 && p.onPause){ const cb = p.onPause; p.onPause = null; setTimeout(cb, 0); } }
    return;
  }
  if(m.mode !== 'vad') return;
  const v = m.vad, fs = f.length / m.rate, t = performance.now();
  v.tele.n++; v.tele.sum += r; v.tele.max = Math.max(v.tele.max, r);
  if(t - v.tele.t0 > 5000){ vlog('vad level avg ' + (v.tele.sum / v.tele.n).toFixed(4) + ' max ' + v.tele.max.toFixed(4) + ' floor ' + v.floor.toFixed(4) + ' thr ' + thrOf(v).toFixed(4) + (speaking() ? ' (he is speaking)' : '')); v.tele = { t0: t, n: 0, sum: 0, max: 0 }; }
  /* echo guard: deaf while he talks and for 0.8 s after his last word */
  if(speaking() || t < v.mutedUntil || t - lastSpokeEnd < 800){
    if(v.on){ v.on = false; m.chunks = []; } v.pre = []; v.loud = 0;
    /* barge-in: echo cancellation leaves his own voice very faint at the mic (~0.001), so a clearly loud voice while he talks is you */
    v.bp = (v.bp || []); v.bp.push(f); if(v.bp.length > Math.ceil(.6 / fs)) v.bp.shift();
    if(speaking()){ v.spk = v.spk == null ? r : (r < v.spk ? r : v.spk * .995 + r * .005);
      const bthr = Math.max(.05, (v.spk || 0) * 10);
      v.bl = r > bthr ? (v.bl || 0) + fs : Math.max(0, (v.bl || 0) - fs * .5);
      if(v.bl >= .25){ vlog('barge-in: you spoke over him (level ' + r.toFixed(3) + ' > ' + bthr.toFixed(3) + '), stopping his voice and listening');
        v.bl = 0; stop(); lastSpokeEnd = t - 1000; v.mutedUntil = 0; v.on = true; v.quiet = 0; v.len = 0; v.voiced = .25; m.chunks = v.bp.slice(); v.bp = []; if(v.cb.onStart) v.cb.onStart(); }
      else if(r > .03 && !v.loggedDeaf){ v.loggedDeaf = true; vlog('heard sound while he was speaking (level ' + r.toFixed(3) + ') - not loud enough to interrupt him'); }
    }
    return;
  }
  v.loggedDeaf = false; v.bl = 0; v.bp = [];
  /* adaptive noise floor: the 20th percentile of the last ~4 s of quiet frames */
  if(!v.on){ v.hist.push(r); if(v.hist.length > Math.ceil(4 / fs)) v.hist.shift();
    if(v.hist.length >= 8 && (v.hist.length % 8 === 0)){ const so = v.hist.slice().sort((x, y) => x - y); v.floor = so[Math.floor(so.length * .2)] || .002; } }
  if(v.hist.length < Math.ceil(.5 / fs)) return;                                 // half a second to learn the room
  const thr = thrOf(v);
  if(!v.on){
    v.pre.push(f); if(v.pre.length > Math.ceil(.5 / fs)) v.pre.shift();           // 500 ms pre-roll so the first syllable (his name) is never clipped
    v.run = r > thr ? (v.run || 0) + 1 : 0;                                       // 1.2.2: two frames in a row above the room before it counts
    v.loud = v.run >= 2 ? v.loud + fs : Math.max(0, v.loud - fs * .5);
    if(v.loud >= .18){ v.sum2 = 0; v.n2 = 0; v.on = true; v.quiet = 0; v.len = 0; v.voiced = 0; m.chunks = v.pre.slice(); v.pre = []; if(v.cb.onStart) v.cb.onStart(); }
    return;
  }
  m.chunks.push(f); v.len += fs; if(r > thr){ v.voiced += fs; v.sum2 = (v.sum2 || 0) + r; v.n2 = (v.n2 || 0) + 1; } v.quiet = r > thr * .75 ? 0 : v.quiet + fs;
  if((v.quiet >= (v.len - v.quiet < 1.1 ? .8 : .55) && v.len >= .6) || v.len >= 10){   // 1.2.2: 0.55 s of quiet ends the turn (was 0.8 s); after a lone short word ("Aurion,") wait 0.8 s so the question isn't cut off
    window.__turnEnd = performance.now() - v.quiet * 1000; const wav = encode(m.chunks, m.rate); m.chunks = []; v.on = false; v.loud = 0;
    vlog('vad turn ' + v.len.toFixed(2) + 's (voiced ' + v.voiced.toFixed(2) + 's), peak rms ' + (m.peak || 0).toFixed(3) + ', thr ' + thr.toFixed(4)); m.peak = 0;
    window.__lastTurnStats = { voiced: v.voiced, len: v.len, snr: (v.n2 ? v.sum2 / v.n2 : 0) / Math.max(.001, v.floor) };
    if(v.voiced < .15){ vlog('vad: too little voice (' + v.voiced.toFixed(2) + 's voiced), dropped'); return; }   // a lone "Aurion" is only ~0.3 s of voice
    if(v.cb.onTurn) v.cb.onTurn(wav);
  } else if(v.quiet >= 1.2){ m.chunks = []; v.on = false; v.loud = 0; }           // a click or cough, not speech
}
/* speech must stand clearly above the room, but a loud room must not make him deaf */
function thrOf(v){ return Math.min(.07, Math.max(.009, v.floor * 3.4)); }   // 1.2.2: higher margin over the room (was x2.6, min .007)
function encode(chunks, rate){
  let n = 0; chunks.forEach(c => n += c.length);
  const all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
  /* box-filter down to 16 kHz (each output sample = mean of the input samples it covers) */
  const ratio = rate / 16000, m = Math.floor(all.length / ratio), pcm = new Int16Array(m);
  for(let i = 0; i < m; i++){ const s = Math.floor(i * ratio), e = Math.min(all.length, Math.floor((i + 1) * ratio)); let acc = 0; for(let j = s; j < e; j++) acc += all[j]; const v = Math.max(-1, Math.min(1, acc / Math.max(1, e - s))); pcm[i] = v < 0 ? v * 32768 : v * 32767; }
  const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf), w = (p, s) => { for(let i = 0; i < s.length; i++) dv.setUint8(p + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return { wav: new Uint8Array(buf), secs: pcm.length / 16000 };
}
async function record(onPause){ const m = await openMic(); m.mode = 'ptt'; m.chunks = []; m.t0 = Date.now(); m.peak = 0; m.ptt = { n: 0, floor: 1, voiced: 0, quiet: 0, onPause }; return true; }
function stopRecord(){
  if(!mic || mic.mode !== 'ptt') return null;
  const m = mic, out = encode(m.chunks, m.rate); vlog('ptt ' + out.secs.toFixed(2) + 's, peak rms ' + (m.peak || 0).toFixed(3));
  m.chunks = []; m.mode = null; if(!handsFree) closeMic();
  return out;
}
let handsFree = false;
async function listen(cb){
  const m = await openMic(); handsFree = true;
  m.mode = 'vad'; m.chunks = []; m.peak = 0;
  m.vad = { cb, floor: .003, hist: [], on: false, loud: 0, quiet: 0, len: 0, voiced: 0, pre: [], mutedUntil: 0, tele: { t0: performance.now(), n: 0, sum: 0, max: 0 } };
}
function mute(ms){ if(mic && mic.vad) mic.vad.mutedUntil = performance.now() + ms; }
function stopListen(){ handsFree = false; if(mic){ mic.mode = null; mic.vad = null; } closeMic(); }
/* a few seconds of raw level, for the self-test */
async function levelProbe(ms){ const m = await openMic(); const was = m.mode; m.mode = 'probe'; m.peak = 0; let sum = 0, n = 0; const t = setInterval(() => { sum += m.level; n++; }, 50);
  await new Promise(r => setTimeout(r, ms)); clearInterval(t); const out = { avg: n ? sum / n : 0, peak: m.peak, rate: m.rate }; m.mode = was; if(!handsFree) closeMic(); return out; }
/* self-test: run audio (Float32 at `rate`) through the real hands-free detector, as if it came from the mic */
async function testVad(f32, rate, cb){
  const keep = mic; mic = { rate, mode: 'vad', chunks: [], level: 0, peak: 0, vad: { cb, floor: .003, hist: [], on: false, loud: 0, quiet: 0, len: 0, voiced: 0, pre: [], mutedUntil: 0, tele: { t0: performance.now(), n: 0, sum: 0, max: 0 } } };
  for(let i = 0; i + 2048 <= f32.length; i += 2048){ onFrame(f32.slice(i, i + 2048)); if(i % (2048 * 16) === 0) await new Promise(r => setTimeout(r, 0)); }
  mic = keep;
}
function unlock(){ try{ const a = audio(); const b = a.createBuffer(1, 1, 22050), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); }catch(_){} }
window.Voice = { unlock, queue, recentLines: () => recent.map(x => x.text), testVad, spokeAgo: () => performance.now() - lastSpokeEnd, last: () => lastPlay, log: vlog, speak, stop, speaking, info: getInfo, record, stopRecord, recording: () => !!(mic && (mic.mode === 'ptt' || (mic.vad && mic.vad.on))), listening: () => handsFree, listen, stopListen, mute, levelProbe, canListen: () => !!host.transcribe };
})();
