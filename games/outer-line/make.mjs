// Builds Outer Line's preview folder for the Trip and Route site, following
// docs/GAME-PAGE-PLAYBOOK.md with the "daily" scheme and no video (the
// founder asked for no new videos): stills from the real game instead.
//   games/outer-line/dist/
//     index.html  the page          play.html  the game (one file)
//     ride.jpg    hero still         map.jpg    spot list still
//     beanies.jpg Scramble's locker, every beanie earned
//     card-16x9.jpg, og.jpg, icon-512.png, game.json
//   node games/outer-line/make.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, 'dist');
const ff = (...a) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(here, 'game.html'), path.join(out, 'play.html'));
fs.copyFileSync(path.join(here, 'page.html'), path.join(out, 'index.html'));

// Stills from the real game: the bot rides stop 5 until it's deep in a
// combo at speed, then the frame is frozen with the callouts on screen.
const exe = !fs.existsSync(chromium.executablePath()) && fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, 'game.html') + '?test=1');
await page.waitForFunction(() => window.__ol);
await page.screenshot({ path: path.join(out, 'map.png') });
// Scramble's locker with every beanie earned, for the page
const lockerBox = await page.evaluate(() => {
  const O = window.__ol; O.BEANIES.forEach(b => O.unlock(b.id, true)); O.wear('send'); O.renderLocker();
  const h = document.querySelector('.locker-head'), l = document.getElementById('locker'); h.scrollIntoView({ block: 'center' });
  const a = h.getBoundingClientRect(), z = l.getBoundingClientRect();
  return { x: Math.floor(z.left) - 16, y: Math.floor(a.top) - 16, width: Math.ceil(z.width) + 32, height: Math.ceil(z.bottom - a.top) + 32 };
});
await page.screenshot({ path: path.join(out, 'beanies.png'), clip: lockerBox });
await page.evaluate(() => { localStorage.clear(); });
await page.goto('file://' + path.join(here, 'game.html') + '?test=1');
await page.waitForFunction(() => window.__ol);
await page.evaluate(() => {
  const O = window.__ol, S = O.S; ['send', 'combo', 'gold'].forEach(id => O.unlock(id, true)); O.rideStop(4);
  const st = S.st, G = S.G, tw = G.S / st.C;
  for(let i = 0; i < 120 * 12 && S.mode === 'ride'; i++){
    const row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
    const target = (st.trail[row] + st.width / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
    const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
    O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4;
    if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
    O.update(1 / 120);
    // stop on a good frame: fast, airborne, a callout fresh on screen
    if(i > 120 * 5 && S.flow > .7 && !S.grounded && S.h > .6 && O.pops.some(p => p.t < .4)) break;
  }
  O.input.left = O.input.right = false;
  document.getElementById('hint').hidden = true;
  O.S.mode = 'still';
});
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(out, 'ride.png') });
// a 512 icon: the rider in the tunnel mouth, cropped from the still
await b.close();

ff('-i', path.join(out, 'ride.png'), '-q:v', '3', path.join(out, 'ride.jpg'));
ff('-i', path.join(out, 'map.png'), '-q:v', '3', path.join(out, 'map.jpg'));
ff('-i', path.join(out, 'beanies.png'), '-q:v', '3', path.join(out, 'beanies.jpg'));
ff('-i', path.join(out, 'ride.png'), '-vf', 'crop=420:420:430:300,scale=512:512', path.join(out, 'icon-512.png'));
const card = (w, h, dst) => ff('-i', path.join(out, 'ride.png'), '-filter_complex',
  `[0]scale=${w}:-1,crop=${w}:${h},eq=brightness=-0.06,drawbox=x=0:y=ih-10:w=iw*0.4:h=10:color=0xc6ff00:t=fill,drawbox=x=iw*0.4:y=ih-10:w=iw*0.3:h=10:color=0x2ee6ff:t=fill,drawbox=x=iw*0.7:y=ih-10:w=iw*0.3:h=10:color=0xff2e88:t=fill`,
  '-q:v', '3', path.join(out, dst));
card(1280, 720, 'card-16x9.jpg');
card(1200, 630, 'og.jpg');
fs.rmSync(path.join(out, 'ride.png')); fs.rmSync(path.join(out, 'map.png')); fs.rmSync(path.join(out, 'beanies.png'));

fs.writeFileSync(path.join(out, 'game.json'), JSON.stringify({
  slug: 'outer-line', title: 'Outer Line', studio: 'Trip and Route',
  tagline: 'Walls are floors. Tricks are speed.',
  short: 'Scramble, an egg on a skateboard, in the space metro. Tricks are speed.',
  description: 'You\'re Scramble, an egg on a skateboard, skating the space metro after hours. Carve the tunnel, step onto a wall when the floor runs out, and chain wall rides, gaps and hops into a line that keeps getting faster. One route a day, the same for everyone.',
  status: 'preview', platforms: { web: 'play.html' },
  controls: { keys: '← → carve, ↑ jump (or Space), ↓ tuck, Esc for the spots', touch: 'hold a side to carve, tap or swipe up to jump, hold both to tuck' },
  orientation: 'any', aspect: '16:9', tags: ['skate', 'runner', 'tunnel', 'momentum', 'daily', 'endless', 'egg'],
  ageNote: 'No chat, no accounts, no ads, no data leaves the device in this preview.',
  scheme: 'daily',
  modes: { spots: 10, daily: '?daily=1', forever: '?forever=1' },
  daily: { resetsAt: '00:00 UTC', epoch: '2026-10-25', attempts: 'first ride counts, practice after' },
  character: { name: 'Scramble', unlockables: '9 beanies, earned in play' },
  assets: { card: 'card-16x9.jpg', og: 'og.jpg', icon: 'icon-512.png', hero: 'ride.jpg', map: 'map.jpg', beanies: 'beanies.jpg' }
}, null, 2) + '\n');
console.log(fs.readdirSync(out).map(f => f + ' ' + Math.round(fs.statSync(path.join(out, f)).size / 1024) + ' kB').join('\n'));
