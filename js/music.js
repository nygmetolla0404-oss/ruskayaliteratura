/* Домбыра стиліндегі музыка — Karplus–Strong синтезі (Web Audio API) */
window.Music = (function () {
  let ctx, master, wet, timer, playing = false, step = 0, nextT = 0, cache = {};
  let duckLevel = 1, baseVol = 0.32;
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // D dorian-ish kui scale: D4 E4 F4 G4 A4 B4 C5 D5 E5 F5
  const S = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77].map(N);
  const DR = [N(50), N(55), N(57)]; // D3, G3, A3 (open strings)
  // phrases: 12 eighths per bar (6/8 x2). -1 = rest. Each entry: melody index
  const P = [
    [4,4,3,4,6,4, 3,2,3,4,3,2],
    [2,2,1,2,3,2, 1,0,1,2,1,0],
    [4,5,6,7,6,4, 6,5,4,3,2,3],
    [4,-1,4,3,2,1, 0,-1,0,-1,0,-1],
    [7,7,6,7,8,7, 6,5,6,7,6,4],
    [3,3,4,3,2,1, 2,1,0,1,0,-1],
    [0,2,4,2,4,6, 4,6,7,6,4,3],
    [2,3,4,3,2,1, 0,-1,0,0,-1,-1]
  ];
  const ORDER = [0, 1, 0, 3, 2, 5, 4, 7, 6, 1, 2, 3];
  const DRONE = [0, 0, 0, 0, 1, 1, 0, 0, 2, 2, 0, 0]; // drone per bar

  function pluckBuf(f, bright) {
    const key = f.toFixed(2) + bright;
    if (cache[key]) return cache[key];
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.2), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const p = Math.max(2, Math.round(sr / f)); const ring = new Float32Array(p);
    for (let i = 0; i < p; i++) ring[i] = (Math.random() * 2 - 1) * (i < p * 0.5 ? 1 : bright);
    // pre-filter for a nylon/gut dombra string tone
    for (let k = 0; k < 2; k++) for (let i = 1; i < p; i++) ring[i] = 0.6 * ring[i] + 0.4 * ring[i - 1];
    let idx = 0, decay = 0.9965;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], nb = ring[(idx + 1) % p];
      const v = decay * 0.5 * (a + nb);
      d[i] = a; ring[idx] = v; idx = (idx + 1) % p;
    }
    // soft attack click removal
    for (let i = 0; i < 64; i++) d[i] *= i / 64;
    return (cache[key] = b);
  }
  function pluck(f, t, vol, bright, pan) {
    const s = ctx.createBufferSource(); s.buffer = pluckBuf(f, bright == null ? 0.6 : bright);
    const g = ctx.createGain(); g.gain.value = vol;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.connect(g); if (pn) { pn.pan.value = pan || 0; g.connect(pn); pn.connect(master); pn.connect(wet); } else { g.connect(master); g.connect(wet); }
    s.start(t); s.stop(t + 2.2);
  }
  function impulse() {
    const sr = ctx.sampleRate, len = sr * 2.4, b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    return b;
  }
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const conv = ctx.createConvolver(); conv.buffer = impulse();
    wet = ctx.createGain(); wet.gain.value = 0.35; wet.connect(conv); conv.connect(ctx.destination);
    const wetOut = ctx.createGain(); wetOut.gain.value = 1;
    // route reverb through master volume
    conv.disconnect(); conv.connect(wetOut); wetOut.connect(master);
    wet.disconnect(); wet.connect(conv);
  }
  const E = 0.19; // eighth-note length (s) — lively kui tempo
  function schedule() {
    while (nextT < ctx.currentTime + 0.35) {
      const bar = Math.floor(step / 12), pos = step % 12;
      const ph = P[ORDER[bar % ORDER.length]], m = ph[pos];
      const dr = DR[DRONE[bar % DRONE.length]];
      const swing = (pos % 3 === 1) ? 0.012 : 0;
      const t = nextT + swing;
      const accent = pos % 3 === 0 ? 1 : 0.62;
      // strum: drone + melody, down-up feel
      if (pos % 3 !== 2 || m >= 0) pluck(dr, t, 0.16 * accent, 0.35, -0.25);
      if (m >= 0) {
        pluck(S[m], t + 0.012, 0.3 * accent, 0.7, 0.2);
        if (pos % 6 === 0) pluck(S[m] / 2, t + 0.02, 0.1, 0.4, 0); // body resonance
      }
      nextT += E; step++;
    }
  }
  function setVol(v, time) {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(v, ctx.currentTime, time || 0.4);
  }
  return {
    start() {
      init(); if (ctx.state === 'suspended') ctx.resume();
      if (playing) return; playing = true; nextT = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 60); setVol(baseVol * duckLevel, 0.8);
      try { localStorage.setItem('lit_music', '1'); } catch (e) {}
    },
    stop() {
      if (!playing) return; playing = false; setVol(0, 0.3);
      setTimeout(() => { if (!playing) clearInterval(timer); }, 900);
      try { localStorage.setItem('lit_music', '0'); } catch (e) {}
    },
    toggle() { playing ? this.stop() : this.start(); return playing; },
    get playing() { return playing; },
    duck(on) { duckLevel = on ? 0.22 : 1; if (playing) setVol(baseVol * duckLevel, 0.5); },
    pluckNote(i) { init(); if (ctx.state === 'suspended') ctx.resume(); pluck(S[i % S.length], ctx.currentTime + 0.01, 0.25, 0.7, 0); },
    scratch() { // quill scratch sound for the simulator
      init(); if (ctx.state === 'suspended') ctx.resume();
      const len = Math.floor(ctx.sampleRate * 0.06), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600 + Math.random() * 1800; f.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.value = 0.18;
      s.connect(f); f.connect(g); g.connect(ctx.destination); s.start();
    }
  };
})();
