// Original ambient space soundtrack for the long-form videos. Generated
// from scratch (no samples, no licensed music), so nothing can be claimed.
//
//   node ads/ambient.mjs --seconds 600 --events ads/out/zen-600.events.json --out ads/out/zen-600.wav [--seed 3]
//
// Layers: a slow pad cycling four chords in D (20 s each, long crossfades),
// a sub that follows the root, "space wind" (brown noise through a slowly
// sweeping band-pass), sparse far-off bells, and soft sounds on the game's
// own events from the video (coin: glassy tink; boost: gentle swell; smash:
// muffled low thump; crash: a soft boom). Bells and events go through a
// stereo reverb. Loudness is set in the mux step (ffmpeg loudnorm).
import fs from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SR = 44100;
const seconds = +opt('--seconds', 60);
const out = opt('--out', 'ads/out/ambient.wav');
const events = opt('--events') ? JSON.parse(fs.readFileSync(opt('--events'), 'utf8')) : [];
let seed = +opt('--seed', 3) >>> 0;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const N = Math.round(seconds * SR);
const ONLY = opt('--only', '');   // debug: pad | sub | wind | shots, renders one layer
const TWO_PI = Math.PI * 2;
const TBL = 8192, SIN = new Float32Array(TBL + 1);
for (let i = 0; i <= TBL; i++) SIN[i] = Math.sin(i / TBL * TWO_PI);
const sinP = (ph) => { const x = (ph - Math.floor(ph)) * TBL, i = x | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i); }; // phase in cycles
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ---- pad: four chords, 20 s each, 6 s raised-cosine crossfades ----
const CHORDS = [
  [50, 54, 57, 61, 64],   // Dmaj9  (D3 F#3 A3 C#4 E4)
  [47, 50, 54, 57, 64],   // Bm11   (B2 D3 F#3 A3 E4)
  [43, 47, 50, 54, 57],   // Gmaj9  (G2 B2 D3 F#3 A3)
  [45, 49, 52, 54, 59],   // A6add9 (A2 C#3 E3 F#3 B3)
];
const ROOTS = [38, 35, 31, 33];  // sub: D2 B1 G1 A1
const CH_LEN = 20, XF = 6;
function chordWeights(t) {
  const pos = t / CH_LEN, i = Math.floor(pos) % CHORDS.length, f = (t % CH_LEN);
  const w = new Array(CHORDS.length).fill(0);
  if (f > CH_LEN - XF / 2) { const k = (f - (CH_LEN - XF / 2)) / XF; const c = 0.5 - 0.5 * Math.cos(Math.PI * k); w[i] = 1 - c; w[(i + 1) % CHORDS.length] = c; }
  else if (f < XF / 2) { const k = (f + XF / 2) / XF; const c = 0.5 - 0.5 * Math.cos(Math.PI * k); w[i] = c; w[(i + CHORDS.length - 1) % CHORDS.length] = 1 - c; }
  else w[i] = 1;
  return w;
}
// every voice keeps its own phase and a slow amplitude LFO
const padVoices = [];
CHORDS.forEach((ch, ci) => ch.forEach((m, ni) => {
  [-3, 3].forEach((cents, k) => padVoices.push({ ci, f: hz(m) * Math.pow(2, cents / 1200), ph: rnd(), lfo: 0.03 + rnd() * 0.05, lph: rnd(), pan: k === 0 ? 0.35 : 0.65, g: 1 / Math.sqrt(ni + 1.5) }));
}));
const subVoices = ROOTS.map((m, ci) => ({ ci, f: hz(m), ph: 0 }));

// ---- one-shots: bells and game events ----
const shots = [];   // { start, dur, kind, f, pan, g }
const PENTA = [74, 76, 78, 81, 83, 86];   // D5 E5 F#5 A5 B5 D6
for (let t = 6 + rnd() * 6; t < seconds - 4; t += 5 + rnd() * 8) shots.push({ start: t, dur: 4.5, kind: 'bell', f: hz(PENTA[Math.floor(rnd() * PENTA.length)]), pan: 0.2 + rnd() * 0.6, g: 0.05 });
let coinStep = 0;
const COIN = [86, 88, 90, 93, 95, 98];   // an octave up, walks the scale
for (const e of events) {
  if (e.t >= seconds - 0.2) continue;
  if (e.type === 'coin') shots.push({ start: e.t, dur: 0.9, kind: 'tink', f: hz(COIN[coinStep++ % COIN.length]), pan: 0.3 + rnd() * 0.4, g: 0.035 });
  else if (e.type === 'boost') shots.push({ start: e.t, dur: 2.2, kind: 'swell', f: hz(62), pan: 0.5, g: 0.05 });
  else if (e.type === 'smash') shots.push({ start: e.t, dur: 0.45, kind: 'thump', f: 88, pan: 0.4 + rnd() * 0.2, g: 0.10 });
  else if (e.type === 'crash') shots.push({ start: e.t, dur: 1.4, kind: 'boom', f: 60, pan: 0.5, g: 0.12 });
}
shots.sort((a, b) => a.start - b.start);

// ---- reverb: Schroeder, stereo-decorrelated ----
function makeVerb(scale) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(Math.round(d * scale)), i: 0, lp: 0 }));
  const aps = [556, 225].map((d) => ({ buf: new Float32Array(Math.round(d * scale)), i: 0 }));
  return (x) => {
    let y = 0;
    for (const c of combs) { const o = c.buf[c.i]; c.lp = o * 0.62 + c.lp * 0.38; c.buf[c.i] = x + c.lp * 0.86; c.i = (c.i + 1) % c.buf.length; y += o; }
    y *= 0.25;
    for (const a of aps) { const o = a.buf[a.i]; const v = y + o * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; y = o - v * 0.5; }
    return y;
  };
}
const verbL = makeVerb(1.0), verbR = makeVerb(1.037);

// ---- wind: brown noise through a sweeping state-variable band-pass ----
// A one-pole high-pass at ~220 Hz after the band-pass keeps the brown noise's
// rumble out: it sits under the mix as air, not as bass.
function makeWind(rate) {
  let b = 0, low = 0, band = 0, ph = rnd(), hpY = 0, hpX = 0;
  const a = 1 / (1 + 2 * Math.PI * 220 / SR);
  return (tSec) => {
    b = (b + (rnd() * 2 - 1) * 0.02) * 0.998;
    const fc = 420 + 900 * (0.5 + 0.5 * sinP(ph + tSec * rate));
    const f = 2 * Math.sin(Math.PI * fc / SR), q = 0.6;
    low += f * band; const high = b - low - q * band; band += f * high;
    hpY = a * (hpY + band - hpX); hpX = band;
    return hpY;
  };
}
const windL = makeWind(0.017), windR = makeWind(0.021);

// ---- render in 1-second blocks straight to a 16-bit WAV ----
const fd = fs.openSync(out, 'w');
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + N * 4, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(N * 4, 40);
fs.writeSync(fd, hdr);

let si = 0, peak = 0, w = chordWeights(0);
const active = [];
for (let n0 = 0; n0 < N; n0 += SR) {
  const n1 = Math.min(N, n0 + SR), buf = Buffer.alloc((n1 - n0) * 4);
  for (let n = n0; n < n1; n++) {
    const t = n / SR;
    if ((n & 511) === 0) w = chordWeights(t);
    let L = 0, R = 0;
    // pad
    for (const v of padVoices) {
      const cw = w[v.ci]; v.ph += v.f / SR; if (cw <= 0) continue;
      const amp = cw * v.g * (0.6 + 0.4 * sinP(v.lph + t * v.lfo));
      const s = sinP(v.ph) + 0.12 * sinP(v.ph * 2) + 0.05 * sinP(v.ph * 3);
      L += s * amp * (1 - v.pan); R += s * amp * v.pan;
    }
    L *= 0.07; R *= 0.07;
    if (ONLY && ONLY !== 'pad') { L = 0; R = 0; }
    for (const v of subVoices) { v.ph += v.f / SR; const cw = w[v.ci]; if (cw > 0 && (!ONLY || ONLY === 'sub')) { const s = sinP(v.ph) * cw * 0.025; L += s; R += s; } }
    // wind
    const wl = windL(t) * 0.8, wr = windR(t) * 0.8; if (!ONLY || ONLY === 'wind') { L += wl; R += wr; }
    // one-shots
    while (si < shots.length && shots[si].start <= t) { const s = shots[si++]; s.ph = 0; s.age = 0; active.push(s); }
    let sendL = 0, sendR = 0;
    for (let k = active.length - 1; k >= 0; k--) {
      const s = active[k]; const a = s.age; s.age += 1 / SR;
      if (a > s.dur) { active.splice(k, 1); continue; }
      let x = 0;
      if (s.kind === 'bell') { s.ph += s.f / SR; const env = Math.min(1, a / 0.012) * Math.exp(-a * 1.2); x = (sinP(s.ph) + 0.35 * sinP(s.ph * 2.76) * Math.exp(-a * 2.5)) * env; }
      else if (s.kind === 'tink') { s.ph += s.f / SR; const env = Math.min(1, a / 0.004) * Math.exp(-a * 7); x = (sinP(s.ph) + 0.2 * sinP(s.ph * 3.01)) * env; }
      else if (s.kind === 'swell') { const f = s.f * (1 + a * 0.35); s.ph += f / SR; const env = Math.sin(Math.PI * Math.min(1, a / s.dur)); x = (sinP(s.ph) + 0.5 * sinP(s.ph * 1.5)) * env * env; }
      else if (s.kind === 'thump') { const f = s.f * Math.exp(-a * 3); s.ph += f / SR; x = sinP(s.ph) * Math.min(1, a / 0.006) * Math.exp(-a * 11); }
      else if (s.kind === 'boom') { const f = s.f * Math.exp(-a * 1.2); s.ph += f / SR; x = sinP(s.ph) * Math.min(1, a / 0.01) * Math.exp(-a * 3); }
      x *= s.g; if (ONLY && ONLY !== 'shots') x = 0;
      L += x * (1 - s.pan) * 0.8; R += x * s.pan * 0.8;
      sendL += x * (1 - s.pan); sendR += x * s.pan;
    }
    // reverb: all one-shots plus a little pad
    L += verbL(sendL + L * 0.15) * 0.9; R += verbR(sendR + R * 0.15) * 0.9;
    // fades and a soft clip
    const fade = Math.min(1, t / 3, (seconds - t) / 5);
    L = Math.tanh(L * fade * 1.6) * 0.8; R = Math.tanh(R * fade * 1.6) * 0.8;
    peak = Math.max(peak, Math.abs(L), Math.abs(R));
    const o = (n - n0) * 4;
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L * 32767))), o);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R * 32767))), o + 2);
  }
  fs.writeSync(fd, buf);
}
fs.closeSync(fd);
console.log(JSON.stringify({ out, seconds, events: events.length, shots: shots.length, peak: +peak.toFixed(3) }));
