/* Aurion on the web: stands in for the desktop app's Electron bridge.
   Voice: Piper neural voice in the browser (lazy, cached) with the browser's own voice until it's ready.
   Ears: Whisper (tiny.en) running in the browser. Brain: built-in answers, optional WebLLM if WebGPU. No servers, no keys. */
(function(){
'use strict';
const PIPER = new URL('vendor/piper.mjs', location.href).href;
const ORT_WASM = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
const PH = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5';
const WLLM = 'https://esm.run/@mlc-ai/web-llm@0.2.79';
const LLM_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const VOICES = ['en_US-norman-medium'];   // public-domain Piper voice only (alan/joe/ryan are non-commercial or unclear)
const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const log = [];
const H = window.host = { web: true,
  ignoreMouse(){}, focus(){}, onCursor(){}, onHello(){}, hide(){}, quit(){},
  onResize(cb){ addEventListener('resize', () => cb({ w: innerWidth, h: innerHeight })); },
  autostart: async () => false,
  log(m){ log.push(new Date().toISOString().slice(11, 19) + ' ' + m); if(log.length > 400) log.shift(); },
  getLog: () => log.slice(),
  status: { piper: 'idle', ears: 'idle', brain: 'off' }
};
function setStatus(k, v){ H.status[k] = v; const el = document.getElementById('webStatus'); if(el) el.textContent = '🔊 ' + H.status.piper + ' · 👂 ' + H.status.ears + ' · 🧠 ' + H.status.brain; }

/* ---------------- voice: Piper in the browser ---------------- */
let piper = null, piperLoading = null, wantVoice = 'en_US-norman-medium';
const piperOK = !!(window.WebAssembly && navigator.storage && navigator.storage.getDirectory);
const sessions = {};
async function session(id){
  if(!sessions[id]) sessions[id] = piper.TtsSession.create({ voiceId: id, wasmPaths: { onnxWasm: ORT_WASM, piperData: PH + '.data', piperWasm: PH + '.wasm' },
    progress: p => { if(p.total) setStatus('piper', 'voice ' + Math.round(p.loaded * 100 / p.total) + '%'); }, logger: () => {} })
    .then(async x => { piper.TtsSession._instance = null; return x; });
  return sessions[id];
}
function loadPiper(id){
  if(!piperOK) { setStatus('piper', 'browser voice'); return Promise.resolve(null); }
  if(piperLoading) return piperLoading;
  setStatus('piper', 'loading neural voice…');
  piperLoading = import(PIPER).then(async tts => {
    piper = tts; const t0 = performance.now();
    const ss = await session(id || wantVoice); const test = await ss.predict('Hello.');   // prove it really speaks before switching over
    if(!test || test.size < 1000) throw new Error('empty test audio');
    H.voiceSay = piperSay; setStatus('piper', 'neural voice'); H.log('piper ready ' + (id || wantVoice) + ' in ' + Math.round(performance.now() - t0) + 'ms'); return tts;
  }).catch(e => { H.log('piper failed ' + e.message); H.voiceSay = undefined; setStatus('piper', 'browser voice'); return null; });
  return piperLoading;
}
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
let chain = Promise.resolve(), piperFails = 0;
function piperSay(req){
  const voice = VOICES.includes(req.voice) ? req.voice : wantVoice;
  const job = chain.then(async () => {
    try{ const ss = await session(voice); const wav = await ss.predict(req.text); piperFails = 0; return { ok: true, engine: 'piper-web', b64: b64(await wav.arrayBuffer()) }; }
    catch(e){ H.log('piper say failed ' + e.message); if(++piperFails >= 2){ H.voiceSay = undefined; setStatus('piper', 'browser voice'); } return { ok: false, why: e.message }; }
  });
  chain = job.catch(() => {}); return job;
}
/* voiceSay stays undefined until Piper is ready, so voice.js uses speechSynthesis meanwhile (fast first audio) */
H.voiceInfo = async () => ({ piper: !!piper || piperOK, voices: piperOK ? VOICES.slice() : [], ears: H.status.ears === 'ready' });
H.setVoice = id => { if(VOICES.includes(id) && id !== wantVoice){ wantVoice = id; if(piper && H.voiceSay){ H.voiceSay = undefined; session(id).then(ss => ss.predict('Hi.')).then(() => { H.voiceSay = piperSay; }).catch(() => {}); } } };
H.voiceState = () => {};

/* ---------------- ears: Whisper in the browser ---------------- */
let asr = null, asrLoading = null;
function loadEars(){
  if(asrLoading) return asrLoading;
  setStatus('ears', 'loading…');
  asrLoading = import(TJS).then(async T => {
    let dev = 'wasm'; try{ if(navigator.gpu && !mobile && await navigator.gpu.requestAdapter()) dev = 'webgpu'; }catch(_){}
    try{ asr = await T.pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', { device: dev, dtype: dev === 'webgpu' ? 'fp32' : 'q8', progress_callback: p => { if(p.status === 'progress' && p.file && /onnx/.test(p.file)) setStatus('ears', Math.round(p.progress) + '%'); } }); }
    catch(e){ H.log('asr ' + dev + ' failed, wasm: ' + e.message); asr = await T.pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', { device: 'wasm', dtype: 'q8' }); }
    setStatus('ears', 'ready'); return asr;
  }).catch(e => { H.log('ears failed ' + e.message); setStatus('ears', 'unavailable'); asrLoading = null; return null; });
  return asrLoading;
}
function wavToF32(u8){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let p = 12, rate = 16000, data = null;
  while(p + 8 <= dv.byteLength){ const id = String.fromCharCode(u8[p], u8[p+1], u8[p+2], u8[p+3]), n = dv.getUint32(p + 4, true);
    if(id === 'fmt ') rate = dv.getUint32(p + 12, true); if(id === 'data'){ data = [p + 8, Math.min(n, dv.byteLength - p - 8)]; break; } p += 8 + n + (n & 1); }
  if(!data) return null; const f = new Float32Array(data[1] >> 1); for(let i = 0; i < f.length; i++) f[i] = dv.getInt16(data[0] + i * 2, true) / 32768;
  return { f, rate };
}
H.transcribe = async wav => {
  const t0 = performance.now(); const m = await loadEars(); if(!m) return { ok: false, why: 'ears unavailable' };
  const a = wavToF32(wav instanceof Uint8Array ? wav : new Uint8Array(wav)); if(!a) return { ok: false, why: 'bad audio' };
  const out = await m(a.f, { sampling_rate: a.rate });
  H.log('whisper ' + Math.round(performance.now() - t0) + 'ms: ' + out.text);
  return { ok: true, text: out.text || '', conf: 1, engine: 'whisper-web' };
};

/* ---------------- brain: optional WebLLM (WebGPU), else built-ins ---------------- */
let llm = null, llmLoading = null;
H.canBigBrain = !!navigator.gpu;
if(navigator.gpu) navigator.gpu.requestAdapter().then(a => { H.canBigBrain = !!a; }).catch(() => { H.canBigBrain = false; });
H.loadBrain = () => {
  if(!navigator.gpu){ setStatus('brain', 'no WebGPU'); return Promise.resolve(null); }
  if(llmLoading) return llmLoading;
  setStatus('brain', 'loading…');
  llmLoading = import(WLLM).then(async W => { llm = await W.CreateMLCEngine(LLM_ID, { initProgressCallback: p => setStatus('brain', Math.round(p.progress * 100) + '%') }); setStatus('brain', 'AI on'); return llm; })
    .catch(e => { H.log('brain failed ' + e.message); setStatus('brain', 'built-in'); llmLoading = null; return null; });
  return llmLoading;
};
H.chat = async ({ messages }) => {
  if(!llm) return { ok: false };
  const t = new Promise(r => setTimeout(() => r(null), 7000));
  const go = llm.chat.completions.create({ messages, max_tokens: 70, temperature: .85 }).then(j => j.choices[0].message.content).catch(() => null);
  const text = await Promise.race([go, t]); return text ? { ok: true, text } : { ok: false };
};

/* ---------------- tap to start (unlocks audio + mic permission prompts) ---------------- */
H.gate = start => {
  const g = document.getElementById('tap');
  const go = async () => {
    g.classList.add('gone'); setTimeout(() => g.remove(), 700);
    try{ const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }catch(_){}
    start();
    setTimeout(() => loadPiper(), 1500);
    setTimeout(() => loadEars(), 4000);
  };
  g.addEventListener('click', go, { once: true });
};
setStatus('piper', 'idle');
})();
