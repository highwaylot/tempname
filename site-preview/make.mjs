// Builds the Bell Theory preview for the Trip and Route site:
//   site-preview/bell-theory/
//     index.html     the game page (trailer, rivalry clip, play in page)
//     play.html      the game itself, single file (npm run build:single)
//     game.json      title, copy, tags, controls, assets for the portal grid
//     trailer.mp4    launch reel, 720x1280, muted      + trailer.jpg poster
//     match.mp4      AI vs AI Brazil v Argentina round, with game audio + match.jpg
//     *.webm         VP9 copies of both clips, the fallback source
//     logo.png, icon-512.png, card-16x9.jpg (1280x720), og.jpg (1200x630)
// Sources: ads/brand/*, ads/out/br-vs-ar-s1.mp4 (node ads/render.mjs versus
// --left br --right ar --seed 1 regenerates it), dist/index.html.
//   node site-preview/make.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..'), out = path.join(here, 'bell-theory');
const ff = (...a) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
fs.mkdirSync(out, { recursive: true });

execFileSync('npm', ['run', '-s', 'build:single'], { cwd: root, stdio: 'inherit' });
fs.copyFileSync(path.join(root, 'dist/index.html'), path.join(out, 'play.html'));

const brand = p => path.join(root, 'ads/brand', p);
const match = path.join(root, 'ads/out/br-vs-ar-s1.mp4');
if(!fs.existsSync(match)) throw new Error('missing ' + match + ': node ads/render.mjs versus --left br --right ar --seed 1');
const v = (src, dst, audio) => ff('-i', src, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p',
  ...(audio ? ['-c:a', 'aac', '-b:a', '128k'] : ['-an']), '-movflags', '+faststart', path.join(out, dst));
v(brand('launch-reel.mp4'), 'trailer.mp4', false);
v(match, 'match.mp4', true);
// VP9 copies: the second <source>, for browsers without H.264 (and Chromium test builds).
const w = (src, dst, audio) => ff('-i', src, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
  ...(audio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']), path.join(out, dst));
w(brand('launch-reel.mp4'), 'trailer.webm', false);
w(match, 'match.webm', true);
ff('-ss', '3.2', '-i', brand('launch-reel.mp4'), '-frames:v', '1', '-vf', 'scale=720:1280', '-q:v', '4', path.join(out, 'trailer.jpg'));
ff('-ss', '6.0', '-i', match, '-frames:v', '1', '-vf', 'scale=720:1280', '-q:v', '4', path.join(out, 'match.jpg'));
ff('-i', brand('logo-horizontal-dark.png'), '-vf', 'scale=1160:-1', path.join(out, 'logo.png'));
ff('-i', brand('logo-mark.png'), '-vf', 'scale=512:512', path.join(out, 'icon-512.png'));
// Grid card and link preview: a dimmed, blurred frame of real play behind the logo.
const card = (w, h, dst) => ff('-ss', '9.5', '-i', match, '-i', brand('logo-horizontal-dark.png'), '-frames:v', '1', '-filter_complex',
  `[0]scale=${w}:-1,crop=${w}:${h},gblur=sigma=6,eq=brightness=-0.22:saturation=1.1[bg];[1]scale=${Math.round(w * 0.72)}:-1[lg];[bg][lg]overlay=(W-w)/2:(H-h)/2`,
  '-q:v', '3', path.join(out, dst));
card(1280, 720, 'card-16x9.jpg');
card(1200, 630, 'og.jpg');

fs.copyFileSync(path.join(here, 'page.html'), path.join(out, 'index.html'));
fs.writeFileSync(path.join(out, 'game.json'), JSON.stringify({
  slug: 'bell-theory', title: 'Bell Theory', studio: 'Trip and Route',
  tagline: 'Thread it, or wreck it.',
  short: 'A two-thumb runner: one orb per thumb, one wall ends it.',
  description: 'Each thumb drives its own orb down its own lane. Thread the gaps, take the coins, pump to fill the tank, then light it up and smash through. One hit on a wall ends the run.',
  status: 'preview', platforms: { web: 'play.html', ios: 'coming soon', android: 'coming soon' },
  controls: { touch: 'one thumb per lane; pump up and down to charge', mouse: 'one-lane mode, the orb follows the pointer' },
  orientation: 'portrait', aspect: '9:16', tags: ['arcade', 'runner', 'reflex', 'two-thumb', 'rhythm'],
  ageNote: 'No chat, no accounts, no ads, no data leaves the device in this preview.',
  assets: { card: 'card-16x9.jpg', og: 'og.jpg', icon: 'icon-512.png', logo: 'logo.png', trailer: 'trailer.mp4', trailerWebm: 'trailer.webm', trailerPoster: 'trailer.jpg', clip: 'match.mp4', clipWebm: 'match.webm', clipPoster: 'match.jpg' }
}, null, 2) + '\n');
const kb = f => Math.round(fs.statSync(path.join(out, f)).size / 1024);
console.log(fs.readdirSync(out).map(f => f + ' ' + kb(f) + ' kB').join('\n'));
