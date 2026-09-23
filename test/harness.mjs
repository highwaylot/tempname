// Headless smoke + perf run. Opens the game in a phone-sized touch-emulated
// Chromium, drives synthetic thumbs (pumping and weaving), auto-restarts on
// death, and reports errors, progress and frame-time statistics as JSON.
//
//   node test/harness.mjs [--url <page>] [--mode two|one] [--seconds 20] [--out .harness]
//
// Exit code is 1 if any page error or in-game frame error was seen.

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const url = opt('--url', pathToFileURL(path.resolve(here, '../prototype/index.html')).href);
const mode = opt('--mode', 'two');
const seconds = Number(opt('--seconds', 20));
const outDir = path.resolve(opt('--out', path.resolve(here, '../.harness')));
// CPU throttle multiplier (CDP). ~6 approximates a mid-range phone on canvas 2D.
const throttle = Number(opt('--throttle', 1));
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  ignoreHTTPSErrors: true, // the sandbox proxy re-signs TLS; fonts would otherwise fail
});
const page = await ctx.newPage();
if (throttle > 1) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
}
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('#stage');
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, `${mode}-1-title.png`) });

// Synthetic touch pointers on the canvas, plus a frame-time recorder that is
// independent of the game's own loop.
await page.evaluate(() => {
  const stage = document.getElementById('stage');
  const rect = () => stage.getBoundingClientRect();
  const ev = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: 'touch', isPrimary: id === 1,
    clientX: rect().left + x, clientY: rect().top + y, bubbles: true, cancelable: true,
  }));
  window.__pd = (id, x, y) => ev('pointerdown', id, x, y);
  window.__pm = (id, x, y) => ev('pointermove', id, x, y);
  window.__pu = (id, x, y) => ev('pointerup', id, x, y);
  window.__size = () => { const b = rect(); return { w: b.width, h: b.height }; };
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

if (mode === 'one') {
  await page.click('#modeSeg [data-mode="one"]');
  await page.waitForTimeout(150);
}

const { w, h } = await page.evaluate(() => window.__size());
const lanes = mode === 'one'
  ? [{ id: 1, cx: w * 0.5, phase: 0 }]
  : [{ id: 1, cx: w * 0.25, phase: 0 }, { id: 2, cx: w * 0.75, phase: 1.3 }];
const baseY = h * 0.72;

for (const l of lanes) await page.evaluate(([id, x, y]) => window.__pd(id, x, y), [l.id, l.cx, baseY]);

const readState = () => page.evaluate(() => ({
  dist: Number(document.getElementById('distVal')?.textContent || 0),
  coins: Number(document.getElementById('coinVal')?.textContent || 0),
  dead: !document.getElementById('overlayDead')?.classList.contains('gone'),
  ready: !document.getElementById('overlayReady')?.classList.contains('gone'),
  gauge: document.getElementById('gaugeNum')?.textContent,
  audio: document.getElementById('audioStatus')?.textContent,
  err: document.getElementById('errStatus')?.textContent || '',
}));

const samples = [];
let deaths = 0, wasDead = false, maxDist = 0, shotMid = false;
const start = Date.now();
while (Date.now() - start < seconds * 1000) {
  const t = (Date.now() - start) / 1000;
  for (const l of lanes) {
    // Weave across the lane and pump vertically; the pump is what fills boost.
    const x = l.cx + Math.sin(t * 1.7 + l.phase) * w * (mode === 'one' ? 0.34 : 0.17);
    const y = baseY + Math.sin(t * 9 + l.phase) * 72;
    await page.evaluate(([id, px, py]) => window.__pm(id, px, py), [l.id, x, y]);
  }
  if (Math.round(t * 1000) % 500 < 45) {
    const s = await readState();
    samples.push({ t: +t.toFixed(1), ...s });
    if (s.dead && !wasDead) deaths++;
    wasDead = s.dead;
    if (s.dist > maxDist) maxDist = s.dist;
    if (!shotMid && t > 3 && !s.dead) {
      shotMid = true;
      await page.screenshot({ path: path.join(outDir, `${mode}-2-run.png`) });
    }
  }
  await page.waitForTimeout(40);
}
await page.screenshot({ path: path.join(outDir, `${mode}-3-end.png`) });

const frames = await page.evaluate(() => window.__frames.slice(1));
const total = frames.reduce((a, b) => a + b, 0) / 1000;
const sorted = [...frames].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const buckets = [];
let acc = 0, n = 0;
for (const f of frames) { acc += f; n++; if (acc >= 1000) { buckets.push(n); acc = 0; n = 0; } }
const last = samples[samples.length - 1] || {};

const report = {
  url, mode, seconds, throttle,
  errors,
  inGameFrameErrors: last.err || '',
  audio: last.audio,
  deaths, maxDist, lastCoins: last.coins,
  fps: {
    avg: +(frames.length / total).toFixed(1),
    minSecond: buckets.length ? Math.min(...buckets) : null,
    p50ms: +pct(0.5).toFixed(1), p95ms: +pct(0.95).toFixed(1), p99ms: +pct(0.99).toFixed(1),
    over33ms: frames.filter((f) => f > 33).length, frames: frames.length,
  },
  timeline: samples.filter((_, i) => i % 4 === 0),
  screenshots: fs.readdirSync(outDir).filter((f) => f.startsWith(mode + '-')).map((f) => path.join(outDir, f)),
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(errors.length || (last.err && last.err.length) ? 1 : 0);
