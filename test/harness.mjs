// Headless smoke + perf run. Opens the game in a phone-sized touch-emulated
// Chromium, drives synthetic thumbs (pumping and weaving), auto-restarts on
// death, and reports errors, progress and frame-time statistics as JSON.
//
//   node test/harness.mjs [--url <page>] [--mode two|one] [--seconds 20] [--out .harness]
//                         [--throttle N] [--dpr 2] [--serve dist] [--reps N]
//                         [--floor] [--prof] [--fx full|auto] [--seed-storage file.json] [--gate]
//
// --serve <dir> starts `vite preview` on that build output (port 4173) and
// runs against http://localhost:4173/ instead of --url: Chromium refuses
// type=module scripts from file://, so the multi-asset build needs http.
// --dpr sets deviceScaleFactor (2 is the phone-class default, 3 the trend line).
// --floor first measures test/floor.html (a bare canvas cleared per rAF, same
//   viewport/dpr/throttle, same thumbs, 10 s) and reports its p50/p95 as
//   `floor`: the cheapest frame this Chromium can produce, which the game's
//   numbers are read against.
// --prof appends ?prof=1 so main.js fills window.BellTheory.prof, a ring of
//   per-frame {update, draw, hud} ms; p50/p95 per section are reported and
//   the JS budget (p95 of update+draw+hud per frame) is gated.
// --fx full|auto is appended as ?fx= (the adaptive-quality pin; W19 reads it).
// --seed-storage <file.json> writes the file's contents to localStorage
//   'thumbtone.v3' before the page loads (persistence/migration tests). The
//   file must hold a COMPLETE state object with a 2-entry `slots` array:
//   src/state.js loadState() discards anything else and falls back to the
//   defaults, so a minimal {"best":4321} is silently ignored. The seeded best
//   is only visible after the first death (#deadBest -> lastBest / timeline).
// --reps N runs the whole measurement N times in fresh contexts and reports
//   each run plus the median p50/p95/over33% (and prof medians).
//
// The gate (printed after the JSON as one GATE PASS/FAIL line): median p95 <=
// 40 ms and frames over 33 ms <= 15%, plus update+draw+hud p95 < 6 ms when
// --prof is on. The on-device target (p95 < 16.7 ms) is out of reach for
// this software-rasterising headless Chromium; see docs/AUDIT.md.
//
// Report shape: `summary` (medians) + `runs[]`, with the median run's fps,
// timeline, screenshots, audio, deaths, maxDist and lastCoins mirrored at the
// root for readers of the single-run shape.
//
// Exit code is 1 if any page error or in-game frame error was seen (errors[]
// and inGameFrameErrors, the floor page included), 2 when the gate fails and
// --gate was passed, 64 on a malformed flag, else 0. Console lines of the form
// 'Failed to load resource' go to resourceErrors[] and do not set the exit
// code (the fonts are self-hosted since W03, so none is expected now).

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
// A malformed flag fails loudly here (usage on stderr, exit 64), before
// Chromium is launched, instead of producing a normal-looking report from
// NaN seconds, zero runs or ?fx=bogus.
function usage(msg) {
  process.stderr.write(`harness: ${msg}\nusage: node test/harness.mjs [--url <page>] [--mode two|one] [--seconds N] [--out dir]`
    + ` [--throttle N] [--dpr N] [--serve dir] [--reps N] [--floor] [--prof] [--fx full|auto|low] [--seed-storage file.json] [--gate]\n`);
  process.exit(64);
}
const opt = (k, d) => {
  const i = argv.indexOf(k);
  if (i < 0) return d;
  const v = argv[i + 1];
  // No value, or the next flag taken as the value (--fx --gate).
  if (v === undefined || v.startsWith('--')) usage(`${k} needs a value`);
  return v;
};
const has = (k) => argv.includes(k);
const num = (k, d) => { const v = Number(opt(k, d)); if (!Number.isFinite(v) || v <= 0) usage(`${k} must be a number > 0, got ${opt(k, d)}`); return v; };
const oneOf = (k, d, allowed) => { const v = opt(k, d); if (v != null && !allowed.includes(v)) usage(`${k} must be one of ${allowed.join('|')}, got ${v}`); return v; };

const serve = opt('--serve', null);
const PREVIEW_URL = 'http://localhost:4173/';
const baseUrl = serve ? PREVIEW_URL : opt('--url', pathToFileURL(path.resolve(here, '../prototype/index.html')).href);
const mode = oneOf('--mode', 'two', ['two', 'one']);
const seconds = num('--seconds', 20);
const outDir = path.resolve(opt('--out', path.resolve(here, '../.harness')));
// CPU throttle multiplier (CDP). ~6 approximates a mid-range phone on canvas 2D.
const throttle = num('--throttle', 1);
const dpr = num('--dpr', 2);
const reps = num('--reps', 1);
if (!Number.isInteger(reps)) usage(`--reps must be an integer >= 1, got ${reps}`);
const wantFloor = has('--floor');
const wantProf = has('--prof');
const wantGate = has('--gate');
const fx = oneOf('--fx', null, ['full', 'auto', 'low']);
const seedFile = opt('--seed-storage', null);
let seedJson = null;
if (seedFile) {
  try { seedJson = fs.readFileSync(path.resolve(seedFile), 'utf8'); } catch (e) { usage(`--seed-storage: cannot read ${seedFile} (${e.message})`); }
}
fs.mkdirSync(outDir, { recursive: true });

// Query string for the game page. The URL API keeps this right for file://
// as well as http, and Chromium populates location.search for file URLs.
const pageUrl = (() => {
  const u = new URL(baseUrl);
  if (wantProf) u.searchParams.set('prof', '1');
  if (fx) u.searchParams.set('fx', fx);
  return u.href;
})();
const floorUrl = pathToFileURL(path.resolve(here, 'floor.html')).href;
const FLOOR_SECONDS = 10;
const GATE = { p95ms: 40, over33pct: 15, jsP95ms: 6 };

// `vite preview` child for --serve. Spawned in its own process group so the
// vite process behind npx dies with it: SIGTERM first, SIGKILL after 2 s.
let preview = null;
async function startPreview(dir) {
  preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--outDir', dir], {
    cwd: path.resolve(here, '..'), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  let log = '';
  preview.stdout.on('data', (d) => { log += d; });
  preview.stderr.on('data', (d) => { log += d; });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`vite preview exited with ${preview.exitCode}\n${log}`);
    try { const r = await fetch(PREVIEW_URL); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`vite preview did not answer on ${PREVIEW_URL}\n${log}`);
}
function stopPreview() {
  const child = preview;
  preview = null;
  if (!child || child.exitCode !== null) return Promise.resolve();
  const signal = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch {} } };
  return new Promise((resolve) => {
    const hard = setTimeout(() => signal('SIGKILL'), 2000);
    child.once('exit', () => { clearTimeout(hard); resolve(); });
    signal('SIGTERM');
  });
}
// A signal must still take the preview down with us.
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopPreview().then(() => process.exit(130)); });

// ---------- statistics ----------
const sortedOf = (xs) => [...xs].sort((a, b) => a - b);
const pctOf = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null;
const r1 = (x) => (x == null ? null : +x.toFixed(1));
const r2 = (x) => (x == null ? null : +x.toFixed(2));
const median = (xs) => {
  const s = sortedOf(xs.filter((x) => x != null));
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function frameStats(frames) {
  const total = frames.reduce((a, b) => a + b, 0) / 1000;
  const sorted = sortedOf(frames);
  const buckets = [];
  let acc = 0, n = 0;
  for (const f of frames) { acc += f; n++; if (acc >= 1000) { buckets.push(n); acc = 0; n = 0; } }
  const over33 = frames.filter((f) => f > 33).length;
  return {
    avg: +(frames.length / total).toFixed(1),
    minSecond: buckets.length ? Math.min(...buckets) : null,
    p50ms: r1(pctOf(sorted, 0.5)), p95ms: r1(pctOf(sorted, 0.95)), p99ms: r1(pctOf(sorted, 0.99)),
    over33ms: over33, over33pct: frames.length ? r1(over33 * 100 / frames.length) : null, frames: frames.length,
  };
}

// ---------- browser plumbing ----------
let browser = null;
// One fresh context per measurement: same viewport/dpr/touch/throttle every
// time, the storage seed installed before the first script runs.
async function openPage(url, errors, resourceErrors) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true,
    ignoreHTTPSErrors: true, // the sandbox proxy re-signs TLS; fonts would otherwise fail
  });
  if (seedJson != null) {
    await ctx.addInitScript((j) => { try { localStorage.setItem('thumbtone.v3', j); } catch {} }, seedJson);
  }
  const page = await ctx.newPage();
  if (throttle > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // A resource that failed to load is not a page error: recorded apart, no exit 1.
    (m.text().startsWith('Failed to load resource') ? resourceErrors : errors).push('console: ' + m.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#stage');
  await page.waitForTimeout(500);
  return { ctx, page };
}

// Synthetic touch pointers on the canvas, plus a frame-time recorder that is
// independent of the game's own loop. The thumbs are pointerIds 11/12:
// Chromium's mouse is pointerId 1, and a trusted mouse pointerout with that
// id would otherwise read as the left thumb lifting.
async function installProbe(page) {
  await page.evaluate(() => {
    const stage = document.getElementById('stage');
    const rect = () => stage.getBoundingClientRect();
    const ev = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: id === 11,
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
}
function laneSetup(w, h) {
  const lanes = mode === 'one'
    ? [{ id: 11, cx: w * 0.5, phase: 0 }]
    : [{ id: 11, cx: w * 0.25, phase: 0 }, { id: 12, cx: w * 0.75, phase: 1.3 }];
  return { lanes, baseY: h * 0.72 };
}
async function pressThumbs(page, lanes, baseY) {
  for (const l of lanes) await page.evaluate(([id, x, y]) => window.__pd(id, x, y), [l.id, l.cx, baseY]);
}
// One step of the drive: weave across the lane and pump vertically; the pump
// is what fills boost.
async function moveThumbs(page, lanes, baseY, w, t) {
  for (const l of lanes) {
    const x = l.cx + Math.sin(t * 1.7 + l.phase) * w * (mode === 'one' ? 0.34 : 0.17);
    const y = baseY + Math.sin(t * 9 + l.phase) * 72;
    await page.evaluate(([id, px, py]) => window.__pm(id, px, py), [l.id, x, y]);
  }
}
const readFrames = (page) => page.evaluate(() => window.__frames.slice(1));

// ---------- the floor ----------
async function measureFloor() {
  const errors = [], resourceErrors = [];
  const { ctx, page } = await openPage(floorUrl, errors, resourceErrors);
  await installProbe(page);
  const { w, h } = await page.evaluate(() => window.__size());
  const { lanes, baseY } = laneSetup(w, h);
  await pressThumbs(page, lanes, baseY);
  const start = Date.now();
  while (Date.now() - start < FLOOR_SECONDS * 1000) {
    await moveThumbs(page, lanes, baseY, w, (Date.now() - start) / 1000);
    await page.waitForTimeout(40);
  }
  const frames = await readFrames(page);
  await ctx.close();
  const s = frameStats(frames);
  return { seconds: FLOOR_SECONDS, p50ms: s.p50ms, p95ms: s.p95ms, frames: s.frames, errors, resourceErrors };
}

// ---------- one game run ----------
async function runGame(rep, errors, resourceErrors) {
  const tag = reps > 1 ? `${mode}-rep${rep}` : mode;
  // The three shot paths are recorded as taken (not scanned from outDir, where
  // a `two-` prefix would also match stale `two-rep1-*` files of an earlier run).
  const shots = [];
  const shot = async (name) => { const p = path.join(outDir, `${tag}-${name}.png`); await page.screenshot({ path: p }); shots.push(p); };
  const { ctx, page } = await openPage(pageUrl, errors, resourceErrors);
  await shot('1-title');
  await installProbe(page);

  if (mode === 'one') {
    await page.click('#modeSeg [data-mode="one"]');
    await page.waitForTimeout(150);
  }

  const { w, h } = await page.evaluate(() => window.__size());
  const { lanes, baseY } = laneSetup(w, h);
  await pressThumbs(page, lanes, baseY);
  // The prof ring (main.js, ?prof=1) has been filling since the first frame
  // after load; drop the title-screen frames so only run frames are read.
  if (wantProf) await page.evaluate(() => { const p = window.BellTheory && window.BellTheory.prof; if (p) { p.head = 0; p.count = 0; } });

  const readState = () => page.evaluate(() => ({
    dist: Number(document.getElementById('distVal')?.textContent || 0),
    coins: Number(document.getElementById('coinVal')?.textContent || 0),
    dead: !document.getElementById('overlayDead')?.classList.contains('gone'),
    ready: !document.getElementById('overlayReady')?.classList.contains('gone'),
    gauge: document.getElementById('gaugeNum')?.textContent,
    best: document.getElementById('deadBest')?.textContent,
    audio: document.getElementById('audioStatus')?.textContent,
    err: document.getElementById('errStatus')?.textContent || '',
  }));

  const samples = [];
  let deaths = 0, wasDead = false, maxDist = 0, shotMid = false;
  const start = Date.now();
  while (Date.now() - start < seconds * 1000) {
    const t = (Date.now() - start) / 1000;
    await moveThumbs(page, lanes, baseY, w, t);
    if (Math.round(t * 1000) % 500 < 45) {
      const s = await readState();
      samples.push({ t: +t.toFixed(1), ...s });
      if (s.dead && !wasDead) deaths++;
      wasDead = s.dead;
      if (s.dist > maxDist) maxDist = s.dist;
      if (!shotMid && t > 3 && !s.dead) {
        shotMid = true;
        await shot('2-run');
      }
    }
    await page.waitForTimeout(40);
  }
  await shot('3-end');

  const frames = await readFrames(page);
  // The in-page section timers (main.js, ?prof=1): one {update, draw, hud}
  // per frame since the thumbs went down (ring reset above), oldest
  // overwritten, so a run longer than 600 frames reads its tail.
  const prof = !wantProf ? undefined : await page.evaluate(() => {
    const p = window.BellTheory && window.BellTheory.prof;
    if (!p) return null;
    const out = { update: [], draw: [], hud: [], total: [] };
    for (let k = 0; k < p.count; k++) {
      const e = p.entries[k];
      out.update.push(e.update); out.draw.push(e.draw); out.hud.push(e.hud);
      out.total.push(e.update + e.draw + e.hud);
    }
    return out;
  });
  await ctx.close();

  const last = samples[samples.length - 1] || {};
  const profStats = prof === undefined ? undefined : (prof === null ? null : Object.fromEntries(
    Object.entries(prof).map(([k, v]) => { const s = sortedOf(v); return [k, { p50ms: r2(pctOf(s, 0.5)), p95ms: r2(pctOf(s, 0.95)), frames: v.length }]; }),
  ));
  return {
    rep,
    inGameFrameErrors: last.err || '',
    audio: last.audio,
    deaths, maxDist, lastCoins: last.coins, lastBest: last.best,
    // Highest boost-tank reading seen across all samples (the timeline below is decimated).
    gaugeMax: samples.length ? Math.max(...samples.map((s) => Number(s.gauge) || 0)) : null,
    fps: frameStats(frames),
    prof: profStats,
    timeline: samples.filter((_, i) => i % 4 === 0),
    screenshots: shots,
  };
}

// ---------- main ----------
let exitCode = 1;
try {

if (serve) await startPreview(serve);

browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const floor = wantFloor ? await measureFloor() : undefined;

const errors = [], resourceErrors = [];
// A broken floor page must set the exit code like any other page error.
if (floor) {
  for (const e of floor.errors) errors.push('floor: ' + e);
  for (const e of floor.resourceErrors) resourceErrors.push('floor: ' + e);
}
const runs = [];
for (let rep = 1; rep <= reps; rep++) runs.push(await runGame(rep, errors, resourceErrors));
await browser.close();
browser = null;

// Medians across runs (a single run is its own median).
const med = (pick) => median(runs.map(pick));
const summary = {
  runs: runs.length,
  p50ms: r1(med((r) => r.fps.p50ms)),
  p95ms: r1(med((r) => r.fps.p95ms)),
  over33pct: r1(med((r) => r.fps.over33pct)),
};
if (wantProf) {
  const have = runs.filter((r) => r.prof);
  summary.prof = have.length ? Object.fromEntries(['update', 'draw', 'hud', 'total'].map((k) => [k, {
    p50ms: r2(median(have.map((r) => r.prof[k].p50ms))),
    p95ms: r2(median(have.map((r) => r.prof[k].p95ms))),
  }])) : null;
}

// The gate, evaluated on the medians.
const reasons = [];
if (summary.p95ms == null || summary.p95ms > GATE.p95ms) reasons.push(`p95 ${summary.p95ms} ms > ${GATE.p95ms}`);
if (summary.over33pct == null || summary.over33pct > GATE.over33pct) reasons.push(`over33 ${summary.over33pct}% > ${GATE.over33pct}%`);
if (wantProf) {
  if (!summary.prof) reasons.push('prof ring missing (window.BellTheory.prof not filled; is ?prof=1 reaching main.js?)');
  else if (summary.prof.total.p95ms >= GATE.jsP95ms) reasons.push(`JS budget update+draw+hud p95 ${summary.prof.total.p95ms} ms >= ${GATE.jsP95ms}`);
}
const frameErr = runs.map((r) => r.inGameFrameErrors).filter(Boolean).join(' | ');
const gate = { pass: reasons.length === 0, reasons, limits: GATE };

// The run whose p95 is the median (the only run with --reps 1) is mirrored at
// the root so readers of the pre-W02 single-run shape (fps, timeline,
// screenshots, audio, deaths, maxDist, lastCoins) keep working; new readers
// use summary/runs.
const medianRun = runs.reduce((best, r) => (
  Math.abs(r.fps.p95ms - summary.p95ms) < Math.abs(best.fps.p95ms - summary.p95ms) ? r : best
), runs[0]);
const mirrored = medianRun ? {
  audio: medianRun.audio, deaths: medianRun.deaths, maxDist: medianRun.maxDist, lastCoins: medianRun.lastCoins,
  fps: medianRun.fps, timeline: medianRun.timeline, screenshots: medianRun.screenshots,
} : {};

const report = {
  url: pageUrl, mode, seconds, throttle, dpr, reps, fx: fx || null, seedStorage: seedFile || null,
  errors,
  resourceErrors,
  inGameFrameErrors: frameErr,
  ...mirrored,
  floor,
  summary,
  gate,
  runs,
};
console.log(JSON.stringify(report, null, 2));
if (floor) console.log(`floor p50 ${floor.p50ms} ms / p95 ${floor.p95ms} ms (${floor.frames} frames, ${floor.seconds} s)`);
if (summary.prof) {
  console.log('prof ' + ['update', 'draw', 'hud', 'total'].map((k) => `${k} p50 ${summary.prof[k].p50ms} / p95 ${summary.prof[k].p95ms} ms`).join(' · '));
}
for (const r of runs) console.log(`run ${r.rep}: p50 ${r.fps.p50ms} / p95 ${r.fps.p95ms} / p99 ${r.fps.p99ms} ms, over33 ${r.fps.over33pct}%, ${r.fps.avg} fps, deaths ${r.deaths}, maxDist ${r.maxDist}`);
if (reps > 1) console.log(`median: p50 ${summary.p50ms} / p95 ${summary.p95ms} ms, over33 ${summary.over33pct}%`);
console.log(gate.pass ? 'GATE PASS' : 'GATE FAIL: ' + reasons.join('; '));

if (errors.length || frameErr) exitCode = 1;
else if (wantGate && !gate.pass) exitCode = 2;
else exitCode = 0;

} finally {
  if (browser) await browser.close().catch(() => {});
  await stopPreview();
}
process.exit(exitCode);
