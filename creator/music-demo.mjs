// Renders a 29 s preview of the creator page's techno bed, offline, with the
// game's coin sound (same recipe as src/audio.js blip + thump) dropped in so
// the balance can be heard: intro, 3-2-1 build, drop, pumping, a boost, a
// second boost, the crash, the outro.
//   node creator/music-demo.mjs [--out creator-upload/music-preview.m4a]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(here, '../creator-upload/music-preview.m4a');
const core = fs.readFileSync(path.join(here, 'music-core.js'), 'utf8').replace(/^export /gm, '');

const b = await chromium.launch();
const page = await b.newPage();
const b64 = await page.evaluate(async (core) => {
  const api = new Function(core + '; return { createMusic, BUILD_SECS };')();
  const SR = 48000, LEN = 29, ctx = new OfflineAudioContext(2, SR * LEN, SR);
  // The game's master chain: volume 0.75 into its compressor.
  const master = ctx.createGain(); master.gain.value = 0.75;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.12;
  master.connect(comp); comp.connect(ctx.destination);
  // The round, as the music reads it.
  const T_BUILD = 4, T_DROP = T_BUILD + 0.02 + api.BUILD_SECS, T_CRASH = 22;
  const lit = t => (t > 9.5 && t < 14) || (t > 17 && t < 20.5);
  const state = t => ({
    lit: lit(t),
    charge: lit(t) ? 0.8 : Math.max(0, Math.min(1, t < 14 ? (t - T_DROP) / 2.7 : (t - 14.5) / 2.5)),
    speed: 330 + Math.max(0, t - T_DROP) * 18 * (lit(t) ? 1.85 : 1)
  });
  const m = api.createMusic(ctx, master, state);
  m.scene('intro', 0); m.tick(T_BUILD);
  m.scene('build', T_BUILD); m.tick(T_CRASH);
  m.scene('drop', T_CRASH);
  m.scene('outro', T_CRASH + 1.1); m.tick(LEN);
  // Coin pickups, about 3 a second in play, with the game's own recipe.
  function blip(t, f, d, type, v){ const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + d * 0.8); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02); }
  function thump(t, f, d, v){ const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(120, f * 0.7), t + d); lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02); }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for(let t = T_DROP + 0.4; t < T_CRASH - 0.2; t += 0.18 + rnd() * 0.3){ blip(t, 660, 0.16, 'triangle', 0.12); thump(t, 220, 0.11, 0.38); }
  // The crash: the game's crashSound body.
  (function(t){ const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.65); })(T_CRASH);
  const buf = await ctx.startRendering();
  const n = buf.length, dv = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => { for(let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for(let i = 0; i < n; i++){ dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  const bytes = new Uint8Array(dv.buffer); let bin = '';
  for(let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
  return btoa(bin);
}, core);
await b.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
const wav = out.replace(/\.[^.]+$/, '.wav');
fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '192k', out]);
console.log('wrote', path.relative(process.cwd(), out), '(and the .wav)');
