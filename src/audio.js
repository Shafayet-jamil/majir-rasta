// সব শব্দ WebAudio দিয়া বানানো — কোনো ফাইল লাগে না
let ctx = null;
let master = null;
let muted = false;
let sirenNodes = null;
let noiseBuf = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  noiseBuf = makeNoise(2);
  startAmbient();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05);
}
export const isMuted = () => muted;

function makeNoise(sec) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(gainNode, t, a, peak, hold, r) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + a);
  g.setValueAtTime(peak, t + a + hold);
  g.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
}

// নদীর পানির শব্দ
function startAmbient() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0.06;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.03;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(lp).connect(g).connect(master);
  src.start();
  lfo.start();
}

// লঞ্চের হর্ন: ভোঁওওও
export function horn(vol = 0.35, dur = 1.1, base = 98) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800;
  [base, base * 1.335, base * 2.01].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.15);
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.4);
  });
  lp.connect(g).connect(master);
  env(g, t, 0.08, vol, dur, 0.3);
}

// মাঝির ছোট হর্ন/বাঁশি
export function whistle() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(520, t);
  o.frequency.setValueAtTime(440, t + 0.15);
  o.connect(g).connect(master);
  env(g, t, 0.01, 0.12, 0.25, 0.1);
  o.start(t);
  o.stop(t + 0.5);
}

export function coin() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [988, 1319].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(g).connect(master);
    env(g, t + i * 0.08, 0.005, 0.2, 0.05, 0.2);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.4);
  });
}

export function powerup() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g).connect(master);
    env(g, t + i * 0.06, 0.005, 0.18, 0.04, 0.15);
    o.start(t + i * 0.06);
    o.stop(t + i * 0.06 + 0.3);
  });
}

export function bump(strength = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  const g = ctx.createGain();
  src.connect(lp).connect(g).connect(master);
  env(g, t, 0.005, 0.5 * strength, 0.03, 0.25);
  src.start(t);
  src.stop(t + 0.4);
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  o.connect(og).connect(master);
  env(og, t, 0.005, 0.4 * strength, 0.02, 0.25);
  o.start(t);
  o.stop(t + 0.35);
}

export function splash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1800, t);
  bp.frequency.exponentialRampToValueAtTime(500, t + 0.4);
  const g = ctx.createGain();
  src.connect(bp).connect(g).connect(master);
  env(g, t, 0.01, 0.25, 0.05, 0.35);
  src.start(t);
  src.stop(t + 0.5);
}

export function crash() {
  if (!ctx) return;
  bump(1.6);
  horn(0.4, 1.4, 82);
  setTimeout(splash, 250);
  setTimeout(splash, 500);
}

export function siren(on) {
  if (!ctx) return;
  if (on && !sirenNodes) {
    const o = ctx.createOscillator();
    o.type = 'square';
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.6;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 140;
    o.frequency.value = 760;
    lfo.connect(lfoG).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.4);
    o.connect(lp).connect(g).connect(master);
    o.start();
    lfo.start();
    sirenNodes = { o, lfo, g };
  } else if (!on && sirenNodes) {
    const { o, lfo, g } = sirenNodes;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    o.stop(ctx.currentTime + 1);
    lfo.stop(ctx.currentTime + 1);
    sirenNodes = null;
  }
}

// নৌ-পুলিশ কত দূরে তার উপর সাইরেনের জোর
export function sirenVolume(v) {
  if (sirenNodes) sirenNodes.g.gain.setTargetAtTime(Math.max(0.0001, v * 0.08), ctx.currentTime, 0.1);
}
