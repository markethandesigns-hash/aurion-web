# Aurion · by Jah Love

A higher-dimensional starseed buddy who flies in on his spaceship to keep you company: hacky sack, star food, peace pipe, tea, meditation, sacred-geometry eyes, flower-of-life halo, mood aura and thought-cloud speech.

Open the page, tap **Tap to call him down**, then tap Aurion for his menu. Turn on **Conversation** and say "Aurion, ..." to talk out loud.

Everything runs in your browser: Piper neural voice (ONNX/WASM), Whisper tiny.en hearing (transformers.js), built-in answers, optional WebLLM brain (WebGPU). Memory stays in this browser's localStorage. No servers, no keys.

## Credits
- Piper TTS (MIT) by Rhasspy; voice en_US-norman (public domain)
- Whisper tiny.en (MIT, OpenAI) via transformers.js (Apache-2.0)
- Optional: Qwen2.5-0.5B-Instruct (Apache-2.0) via WebLLM (Apache-2.0)

## 1.2.3 (Oct 30, 2026)
- Grounded facts (facts.js): date, time and western zodiac signs are worked out exactly and answered directly (e.g. "Is October a Pisces month?" -> No, Libra then Scorpio). The AI only adds colour and is corrected if it names a wrong sign.
- Brain temperature 0.5, tighter "say you're not sure" rules, 15 s brain wait with a "thinking" line.
- Brain choice on the web: only Qwen2.5-0.5B (WebLLM, WebGPU) is offered. Bigger models (1.5B+) are too heavy for phones and most laptops in a browser tab, so there is no picker here; the desktop app has the full Brain picker (Settings > Brain).
