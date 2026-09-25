// Renders ad videos from the real game. Nothing here ships in the app.
//
//   node ads/render.mjs sim      [--n 100] [--safe 6] [--mean 5]
//       Plays N seeds without recording and prints when and who crashed:
//       the check that nobody dies before the safe window.
//   node ads/render.mjs versus   --left br --right ar [--seed 7] [--count 1]
//                                [--safe 6] [--mean 5] [--fps 30] [--hook "…"]
//       Records AI-vs-AI rounds to ads/out/<left>-vs-<right>-s<seed>.mp4
//       (1080x1920, H.264, no audio: sound goes on in the edit).
//   node ads/render.mjs endcards [--only who-next] [--fps 30]
//       Records every end-card variant to ads/endcards/<id>.mp4 plus a
//       transparent PNG of its final frame.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('--port', 5199);

function startServer(){
  const child = spawn('npx', ['vite', '--config', 'ads/vite.render.config.mjs', '--port', String(PORT), '--strictPort', '--logLevel', 'error'], { cwd: root, detached: true, stdio: 'ignore' });
  return child;
}
function stopServer(child){ try{ process.kill(-child.pid, 'SIGTERM'); }catch(e){} }
async function waitServer(){
  for(let i=0;i<150;i++){
    try{ const r = await fetch(`http://localhost:${PORT}/ads/versus.html`); if(r.ok) return; }catch(e){}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('vite dev server did not start');
}
function encoder(file, fps){
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ff = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
  return { write: (buf) => new Promise(r => ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)), end: async () => { ff.stdin.end(); await done; } };
}
async function openVersus(browser, params, dsf = 2){
  // Same 540x960 layout either way, so the game plays identically; dsf 1 is
  // only a cheaper raster for simulations that record nothing.
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: dsf });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
  const qs = new URLSearchParams({ fx: 'full', ...params }).toString();
  // The dev server can reload a page once while it optimizes dependencies on
  // first use; one retry covers it.
  for(let attempt = 0; ; attempt++){
    await page.goto(`http://localhost:${PORT}/ads/versus.html?${qs}`);
    try{ await page.waitForFunction(() => window.AD && window.AD.ready, null, { timeout: 45000 }); break; }
    catch(e){ if(attempt >= 2) throw e; }
  }
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

const server = startServer();
let browser;
try{
  await import('./build-page.mjs');
  await waitServer();
  browser = await chromium.launch({ args: ['--disable-gpu-vsync'] });
  const common = { safe: opt('--safe', '6'), mean: opt('--mean', '5'), fps: opt('--fps', '30') };

  if(cmd === 'sim'){
    const n = +opt('--n', 100), start = +opt('--from', 1);
    const rows = [], jobs = +opt('--jobs', 3);
    let nextSeed = start;
    async function worker(){
      while(nextSeed < start + n){
        const seed = nextSeed++;
        const { page, errors } = await openVersus(browser, { ...common, seed: String(seed), left: 'br', right: 'ar' }, 1);
        const st = await page.evaluate(() => { let s; do { s = window.AD.step(30); } while(!s.done); return { s, failAt: window.AD.failAt }; });
        rows.push({ seed, deathT: st.s.deathT, loser: st.s.loser, failAt: st.failAt.map(x => +x.toFixed(2)), errors: errors.length });
        await page.close();
        process.stdout.write(`seed ${seed}: crash ${st.s.deathT.toFixed ? st.s.deathT.toFixed(2) : st.s.deathT}s, ${st.s.loser === 0 ? 'left' : st.s.loser === 1 ? 'right' : 'none'} lost${errors.length ? ', ' + errors.length + ' errors' : ''}\n`);
      }
    }
    // Warm the dev server's dependency cache with one page before fanning out.
    await (await openVersus(browser, { ...common, seed: '0' }, 1)).page.close();
    await Promise.all(Array.from({ length: jobs }, worker));
    rows.sort((a, b) => a.seed - b.seed);
    const d = rows.map(r => r.deathT).filter(x => x >= 0).sort((a, b) => a - b);
    const q = p => d[Math.min(d.length - 1, Math.floor(d.length * p))];
    const early = rows.filter(r => r.deathT >= 0 && r.deathT < +common.safe);
    const accidental = rows.filter(r => r.deathT >= 0 && r.deathT < Math.min(...r.failAt) - 0.05);
    console.log(JSON.stringify({
      runs: rows.length, crashed: d.length, before_safe: early.length, before_scheduled_fail: accidental.length,
      left_lost: rows.filter(r => r.loser === 0).length, right_lost: rows.filter(r => r.loser === 1).length,
      crash_seconds: { min: d[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: d[d.length - 1] },
      errors: rows.reduce((a, r) => a + r.errors, 0), early_seeds: early.map(r => r.seed)
    }, null, 2));
    fs.mkdirSync(path.join(here, 'out'), { recursive: true });
    fs.writeFileSync(path.join(here, 'out', 'sim.json'), JSON.stringify(rows, null, 1));
  }

  else if(cmd === 'versus'){
    const left = opt('--left', 'br'), right = opt('--right', 'ar');
    const count = +opt('--count', 1), seed0 = +opt('--seed', 1);
    for(let seed = seed0; seed < seed0 + count; seed++){
      const params = { ...common, seed: String(seed), left, right };
      if(opt('--hook')) params.hook = opt('--hook');
      if(argv.includes('--clean')) params.clean = '1';
      if(opt('--leftName')) params.leftName = opt('--leftName');
      if(opt('--rightName')) params.rightName = opt('--rightName');
      const { page, errors } = await openVersus(browser, params);
      const file = path.join(here, 'out', argv.includes('--clean') ? `clean-s${seed}.mp4` : `${left}-vs-${right}-s${seed}.mp4`);
      const enc = encoder(file, +common.fps);
      let st, frames = 0;
      do {
        await enc.write(await page.screenshot({ type: 'png' }));
        st = await page.evaluate(() => window.AD.step(1));
        frames++;
      } while(!st.done);
      await enc.write(await page.screenshot({ type: 'png' }));
      await enc.end();
      await page.close();
      console.log(JSON.stringify({ file: path.relative(root, file), seconds: +(frames / +common.fps).toFixed(2), crashAt: st.deathT, loser: st.loser === 0 ? left : right, errors }));
    }
  }

  else if(cmd === 'batch'){
    // Every pair in the list, one round each, `jobs` at a time.
    const list = JSON.parse(fs.readFileSync(path.resolve(root, opt('--list', 'ads/matchups.json')), 'utf8')).render;
    const jobs = +opt('--jobs', 2), seed0 = +opt('--seed', 1);
    let i = 0;
    async function worker(){
      while(i < list.length){
        const k = i++, m = list[k], seed = seed0 + k;
        const params = { ...common, seed: String(seed), left: m.left, right: m.right };
        if(m.leftName) params.leftName = m.leftName;
        if(m.rightName) params.rightName = m.rightName;
        const { page, errors } = await openVersus(browser, params);
        const file = path.join(here, 'out', `${m.left}-vs-${m.right}-s${seed}.mp4`);
        const enc = encoder(file, +common.fps);
        let st, frames = 0;
        do {
          await enc.write(await page.screenshot({ type: 'png' }));
          st = await page.evaluate(() => window.AD.step(1));
          frames++;
        } while(!st.done);
        await enc.write(await page.screenshot({ type: 'png' }));
        await enc.end();
        await page.close();
        console.log(JSON.stringify({ file: path.relative(root, file), seconds: +(frames / +common.fps).toFixed(2), crashAt: +st.deathT.toFixed(2), winner: st.loser === 0 ? m.right : m.left, errors: errors.length }));
      }
    }
    await (await openVersus(browser, { ...common, seed: '0' }, 1)).page.close();
    await Promise.all(Array.from({ length: jobs }, worker));
  }

  else if(cmd === 'brand'){
    // Logo set, launch post and story, and the coming-soon reel.
    //   --clean ads/out/clean-s7.mp4 --from 2.5   gameplay for the reel's first 5 s
    //   --vs ads/out/br-vs-ar-s101.mp4 --crash 11.3   rivalry moment around the crash
    const { execFileSync } = await import('node:child_process');
    const ff = (args) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
    const out = path.join(here, 'brand'); fs.mkdirSync(out, { recursive: true });
    const tmp = path.join(here, 'out', 'brand-tmp'); fs.mkdirSync(tmp, { recursive: true });
    const clean = path.resolve(root, opt('--clean', 'ads/out/clean-s7.mp4')), from = +opt('--from', 2.5);
    const vs = path.resolve(root, opt('--vs', 'ads/out/br-vs-ar-s101.mp4')), crash = +opt('--crash', 11.3);
    ff(['-ss', String(from + 2.0), '-i', clean, '-frames:v', '1', path.join(here, 'out', 'shot.png')]);
    const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${PORT}/ads/brand.html`);
    await page.waitForFunction(() => window.BK && window.BK.ready, null, { timeout: 30000 });
    const names = await page.evaluate(() => window.BK.names);
    for(const n of names){
      const b64 = await page.evaluate((k) => window.BK.still(k), n);
      fs.writeFileSync(path.join(n.startsWith('reel-') ? tmp : out, n + '.png'), Buffer.from(b64, 'base64'));
    }
    const fps = 30, enc = encoder(path.join(tmp, 'outro.mp4'), fps);
    for(let i = 0; i <= 4.5 * fps; i++) await enc.write(Buffer.from(await page.evaluate((tt) => window.BK.outro(tt), i / fps), 'base64'));
    await enc.end();
    fs.copyFileSync(path.join(tmp, 'outro.mp4'), path.join(out, 'logo-reveal.mp4'));
    // Segment A: clean gameplay with the two hook lines.
    ff(['-ss', String(from), '-t', '5', '-i', clean, '-loop', '1', '-t', '5', '-i', path.join(tmp, 'reel-hook-1.png'), '-loop', '1', '-t', '5', '-i', path.join(tmp, 'reel-hook-2.png'),
      '-filter_complex', "[1]format=rgba,fade=t=in:st=0:d=0.15:alpha=1,fade=t=out:st=2.3:d=0.15:alpha=1[h1];[2]format=rgba,fade=t=in:st=2.5:d=0.15:alpha=1[h2];[0][h1]overlay[a];[a][h2]overlay=enable='gte(t,2.45)',format=yuv420p",
      '-r', String(fps), '-c:v', 'libx264', '-crf', '18', '-an', path.join(tmp, 'a.mp4')]);
    // Segment B: the rivalry moment, crash and winner card, with the pivot line.
    ff(['-ss', String(crash - 1.5), '-t', '3.6', '-i', vs, '-loop', '1', '-t', '3.6', '-i', path.join(tmp, 'reel-hook-3.png'),
      '-filter_complex', "[1]format=rgba,fade=t=in:st=0.1:d=0.2:alpha=1[h];[0][h]overlay,format=yuv420p",
      '-r', String(fps), '-c:v', 'libx264', '-crf', '18', '-an', path.join(tmp, 'b.mp4')]);
    // A -> B -> outro with short crossfades.
    ff(['-i', path.join(tmp, 'a.mp4'), '-i', path.join(tmp, 'b.mp4'), '-i', path.join(tmp, 'outro.mp4'),
      '-filter_complex', "[0][1]xfade=transition=fade:duration=0.25:offset=4.75[ab];[ab][2]xfade=transition=fadeblack:duration=0.35:offset=7.95,format=yuv420p",
      '-r', String(fps), '-c:v', 'libx264', '-crf', '18', '-movflags', '+faststart', '-an', path.join(out, 'launch-reel.mp4')]);
    await page.close();
    console.log(JSON.stringify({ wrote: fs.readdirSync(out) }));
  }

  else if(cmd === 'longform'){
    // 1920x1080 ambient video: the game in a centre column over a looping
    // space background, an original soundtrack driven by the run's events.
    //   --minutes 10 --seed 3
    const { execFileSync } = await import('node:child_process');
    const minutes = +opt('--minutes', 10), seed = opt('--seed', '3'), fps = 30, len = minutes * 60;
    const outDir = path.join(here, 'out'); fs.mkdirSync(outDir, { recursive: true });
    const bgFile = path.join(outDir, 'bg-loop.mp4');
    if(!fs.existsSync(bgFile)){
      const bp = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
      await bp.goto(`http://localhost:${PORT}/ads/brand.html`);
      await bp.waitForFunction(() => window.BK && window.BK.ready, null, { timeout: 30000 });
      const ff = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', bgFile], { stdio: ['pipe', 'inherit', 'inherit'] });
      const done = new Promise((res) => ff.on('close', res));
      for(let i = 0; i < 60 * fps; i++){
        const b = Buffer.from(await bp.evaluate((tt) => window.BK.bg(tt), i / fps), 'base64');
        if(!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end(); await done; await bp.close();
      console.log('background loop ready');
    }
    const page = await browser.newPage({ viewport: { width: 540, height: 1080 }, deviceScaleFactor: 1 });
    for(let attempt = 0; ; attempt++){
      await page.goto(`http://localhost:${PORT}/ads/versus.html?fx=full&zen=1&len=${len}&seed=${seed}&fps=${fps}`);
      try{ await page.waitForFunction(() => window.AD && window.AD.ready, null, { timeout: 45000 }); break; }
      catch(e){ if(attempt >= 2) throw e; }
    }
    const base = path.join(outDir, `zen-${minutes}min-s${seed}`);
    const vid = spawn(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-stream_loop', '-1', '-i', bgFile, '-filter_complex', '[1][0]overlay=690:0:shortest=1,format=yuv420p',
      '-r', String(fps), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', base + '.video.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
    const vdone = new Promise((res, rej) => vid.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    const total = len * fps, t0 = Date.now();
    let st;
    for(let i = 0; i < total; i++){
      const shot = await page.screenshot({ type: 'jpeg', quality: 90 });
      if(!vid.stdin.write(shot)) await new Promise(r => vid.stdin.once('drain', r));
      st = await page.evaluate(() => window.AD.step(1));
      if(i % 1800 === 0 && i){ const el = (Date.now() - t0) / 1000; console.log(`${(i / fps / 60).toFixed(1)} of ${minutes} min rendered, ${(el / 60).toFixed(1)} min elapsed, about ${((total - i) * el / i / 60).toFixed(0)} min to go, crashes so far ${st.crashes}`); }
    }
    vid.stdin.end(); await vdone;
    const events = await page.evaluate(() => window.AD.events());
    fs.writeFileSync(base + '.events.json', JSON.stringify(events));
    await page.close();
    execFileSync('node', [path.join(here, 'ambient.mjs'), '--seconds', String(len), '--events', base + '.events.json', '--out', base + '.wav', '--seed', seed], { stdio: 'inherit' });
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', base + '.video.mp4', '-i', base + '.wav', '-c:v', 'copy',
      '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', base + '.mp4'], { stdio: 'inherit' });
    fs.rmSync(base + '.video.mp4'); fs.rmSync(base + '.wav');
    const counts = events.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {});
    console.log(JSON.stringify({ file: path.relative(root, base + '.mp4'), minutes, crashes: st.crashes, events: counts, renderMinutes: +((Date.now() - t0) / 60000).toFixed(1) }));
  }

  else if(cmd === 'thumbs'){
    // YouTube thumbnails (1280x720) for the long-form videos.
    const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${PORT}/ads/brand.html`);
    await page.waitForFunction(() => window.BK && window.BK.ready, null, { timeout: 30000 });
    const out = path.join(here, 'brand'); fs.mkdirSync(out, { recursive: true });
    for(const m of (opt('--minutes', '10,20,30')).split(',')){
      fs.writeFileSync(path.join(out, `thumb-${m}min.png`), Buffer.from(await page.evaluate((k) => window.BK.thumb(+k), m), 'base64'));
    }
    console.log('thumbnails written');
  }

  else if(cmd === 'endcards'){
    const fps = +opt('--fps', 30);
    const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/ads/endcard.html`);
    await page.waitForFunction(() => window.EC && window.EC.ready, null, { timeout: 30000 });
    const variants = await page.evaluate(() => window.EC.variants.map(v => ({ id: v.id, seconds: window.EC.seconds })));
    const only = opt('--only');
    for(const v of variants){
      if(only && !only.split(',').includes(v.id)) continue;
      const file = path.join(here, 'endcards', `${v.id}.mp4`);
      const enc = encoder(file, fps);
      const n = Math.round(v.seconds * fps);
      for(let i = 0; i <= n; i++){
        const b64 = await page.evaluate(([id, tt]) => window.EC.frame(id, tt, false), [v.id, i / fps]);
        await enc.write(Buffer.from(b64, 'base64'));
      }
      await enc.end();
      const png = await page.evaluate(([id, tt]) => window.EC.frame(id, tt, true), [v.id, v.seconds]);
      fs.writeFileSync(path.join(here, 'endcards', `${v.id}-overlay.png`), Buffer.from(png, 'base64'));
      console.log(JSON.stringify({ file: path.relative(root, file), seconds: v.seconds }));
    }
    if(errors.length) console.log('page errors', errors);
  }
  else {
    console.log('usage: node ads/render.mjs sim|versus|endcards [options]');
  }
} finally {
  if(browser) await browser.close();
  stopServer(server);
}
