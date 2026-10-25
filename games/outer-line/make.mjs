// Builds Outer Line's preview folder for the Trip and Route site, following
// docs/GAME-PAGE-PLAYBOOK.md with the "daily" scheme and no video (the
// founder asked for no new videos): stills from the real game instead.
//   games/outer-line/dist/
//     index.html  the page          play.html  the game (one file)
//     ride.jpg    hero still         map.jpg    line map still
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

// Stills from the real game: the bot rides stop 3 for a few seconds so the
// frame has holes, walls and the rider mid-run.
const exe = !fs.existsSync(chromium.executablePath()) && fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(here, 'game.html') + '?test=1');
await page.waitForFunction(() => window.__ol);
await page.screenshot({ path: path.join(out, 'map.png') });
await page.evaluate(() => {
  const O = window.__ol, S = O.S; O.rideStop(2);
  const st = S.st, G = S.G, tw = G.S / st.C;
  for(let i = 0; i < 120 * 7.3; i++){
    const row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
    const target = (st.trail[row] + st.width / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
    O.input.left = d < -tw * .12; O.input.right = d > tw * .12;
    if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
    O.update(1 / 120);
  }
  O.input.left = O.input.right = false;
  document.getElementById('hint').hidden = true;
  O.S.mode = 'still';           // freeze the frame for the screenshot
});
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(out, 'ride.png') });
// a 512 icon: the rider in the tunnel mouth, cropped from the still
await b.close();

ff('-i', path.join(out, 'ride.png'), '-q:v', '3', path.join(out, 'ride.jpg'));
ff('-i', path.join(out, 'map.png'), '-q:v', '3', path.join(out, 'map.jpg'));
ff('-i', path.join(out, 'ride.png'), '-vf', 'crop=560:560:360:80,scale=512:512', path.join(out, 'icon-512.png'));
const card = (w, h, dst) => ff('-i', path.join(out, 'ride.png'), '-filter_complex',
  `[0]scale=${w}:-1,crop=${w}:${h},eq=brightness=-0.12,drawbox=x=0:y=ih-8:w=iw*0.4:h=8:color=0xff8a3d:t=fill,drawbox=x=iw*0.4:y=ih-8:w=iw*0.3:h=8:color=0x46c2ff:t=fill,drawbox=x=iw*0.7:y=ih-8:w=iw*0.3:h=8:color=0xb07cff:t=fill`,
  '-q:v', '3', path.join(out, dst));
card(1280, 720, 'card-16x9.jpg');
card(1200, 630, 'og.jpg');
fs.rmSync(path.join(out, 'ride.png')); fs.rmSync(path.join(out, 'map.png'));

fs.writeFileSync(path.join(out, 'game.json'), JSON.stringify({
  slug: 'outer-line', title: 'Outer Line', studio: 'Trip and Route',
  tagline: 'Walls are floors.',
  short: 'A space-metro tunnel runner. Step onto a wall and it becomes the floor.',
  description: 'Run the line stop to stop, jump the gaps, and step onto a wall when the floor runs out: the tunnel turns and the wall becomes the floor. One route a day, the same for everyone.',
  status: 'preview', platforms: { web: 'play.html' },
  controls: { keys: '← → or A D to move, Space or ↑ to jump, Esc for the map', touch: 'hold left or right side to move, tap or swipe up to jump' },
  orientation: 'any', aspect: '16:9', tags: ['runner', 'tunnel', 'platformer', 'daily', 'keyboard'],
  ageNote: 'No chat, no accounts, no ads, no data leaves the device in this preview.',
  scheme: 'daily',
  daily: { resetsAt: '00:00 UTC', epoch: '2026-10-25', attempts: 'first ride counts, practice after' },
  assets: { card: 'card-16x9.jpg', og: 'og.jpg', icon: 'icon-512.png', hero: 'ride.jpg', map: 'map.jpg' }
}, null, 2) + '\n');
console.log(fs.readdirSync(out).map(f => f + ' ' + Math.round(fs.statSync(path.join(out, f)).size / 1024) + ' kB').join('\n'));
