// Checks the built creator page (npm run creator:build first) on a phone-sized
// touch viewport with two simulated thumbs:
//   1. first crash loses: countdown, live counters, a real crash, result card
//   2. coin race: time runs out tied → sudden death → next coin wins, world frozen
//   3. cup: 8 random entrants, a match played to a crash, the winner advances,
//      Part moves on, the bracket screen renders, the cup survives a reload
//   node creator/test.mjs [--shots <dir>] [--size 375x667]
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(here, '../dist-creator/creator/index.html') + '?test=1';
const i = process.argv.indexOf('--shots'), shots = i > 0 ? process.argv[i + 1] : null;
const si = process.argv.indexOf('--size'), size = (si > 0 ? process.argv[si + 1] : '390x844').split('x').map(Number);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if(!cond) fails++; };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, k) => ({ x: p[0], y: p[1], id: k })) });
const shot = async (name) => { if(shots) await page.screenshot({ path: path.join(shots, name + '.png') }); };
const hud = () => page.evaluate(() => ({
  phase: window.BellTheory.phase(), cls: document.querySelector('.cr-hud').className,
  banner: document.getElementById('crBanner').textContent, tag: document.getElementById('crTag').textContent,
  win: document.getElementById('crWinName').textContent, sub: document.getElementById('crWinSub').textContent,
  paused: window.__cr.game.paused, coins: window.__cr.game.coinsBy.slice()
}));
const L = [size[0] / 4, size[1] * 0.76], R = [size[0] * 3 / 4, size[1] * 0.76];
// Wiggle both thumbs (pumping, drifting) until the run ends in a crash.
async function playToCrash(maxMs){
  for(let k = 0; k * 33 < maxMs; k++){
    const dy = Math.sin(k * 0.9) * 40, dx = Math.sin(k * 0.07) * 80;
    await touch('touchMove', [[L[0] + dx, L[1] + dy], [R[0] - dx, R[1] - dy]]);
    await page.waitForTimeout(33);
    if(k % 15 === 0 && (await hud()).cls.includes('over')) return true;
  }
  return false;
}

await page.goto(url);
await page.waitForSelector('.cr-menu');

// 1. first crash loses
await page.click('[data-act=play]');
await page.waitForTimeout(300);
ok(await page.evaluate(() => { const n = document.querySelectorAll('.cr-name'); return [...n].every(x => x.scrollWidth <= x.clientWidth + 1); }), 'names fit the banner');
await touch('touchStart', [L, R]);
await page.waitForTimeout(1300);
let h = await hud();
ok(h.phase === 1 && /^[123]$/.test(h.banner), 'both thumbs start the run into a 3-2-1 (banner ' + h.banner + ')');
ok(await page.evaluate(() => window.__cr.game.grace > 0), 'world held during the count');
await page.waitForTimeout(2000);
ok((await hud()).banner === 'GO', 'GO after the count');
await shot('1-live');
ok(await playToCrash(40000), 'a crash ends the match');
await page.waitForTimeout(1300);
await shot('1-win');
await page.waitForTimeout(2300);
h = await hud();
ok(/wins$/.test(h.win) && /hit the wall$/.test(h.sub), 'result: "' + h.win + '" / "' + h.sub + '"');
ok(h.cls.includes('end') && h.cls.includes('acts'), 'who\'s-next card and buttons follow');
await shot('1-end');
await touch('touchEnd', []);

// 2. coin race with sudden death
await page.click('[data-a=menu]');
await page.click('[data-seg=mtype][data-v=coins]');
await page.click('[data-seg=msecs][data-v="15"]');
await page.click('[data-act=play]');
await touch('touchStart', [L, R]);
await page.waitForTimeout(3400);
// Keep the field clear and jump the clock to the buzzer with the coins level.
await page.evaluate(() => { const g = window.__cr.game; g.obstacles.length = 0; g.runTime = 14.9; g.coinsBy[0] = 5; g.coinsBy[1] = 5; });
await page.waitForTimeout(400);
h = await hud();
ok(/SUDDEN DEATH/.test(h.banner) && !h.cls.includes('over'), 'tie at the buzzer goes to sudden death');
await page.evaluate(() => { const g = window.__cr.game; g.obstacles.length = 0; g.coinsBy[1] = 6; });
await page.waitForTimeout(300);
h = await hud();
ok(h.cls.includes('over') || h.win !== '', 'next coin ends it');
ok(/wins$/.test(h.win) && h.sub === 'sudden death' && h.paused, 'right side wins on sudden death, world frozen (' + h.win + ')');
await page.waitForTimeout(3600);
await shot('2-end');
await touch('touchEnd', []);

// 3. cup
await page.click('[data-a=menu]');
await page.click('[data-seg=tab][data-v=cup]');
await page.click('[data-act=cupfill]');
ok(await page.evaluate(() => !document.querySelector('[data-act=cupstart]').disabled), '8 random entrants fill the cup');
await page.click('[data-act=cupstart]');
await shot('3-cup-menu');
await page.click('[data-act=cupnext]');
await page.waitForTimeout(300);
h = await hud();
ok(h.tag === 'Day 1 · Part 1 · Quarterfinal', 'match tag: ' + h.tag);
await touch('touchStart', [L, R]);
await page.waitForTimeout(3400);
ok(await playToCrash(40000), 'cup match ends in a crash');
await page.waitForTimeout(3600);
const cup = await page.evaluate(() => window.__cr.store.cup);
const m0 = cup.rounds[0][0], adv = cup.rounds[1][0].a;
ok(m0.w != null && JSON.stringify(adv) === JSON.stringify(m0.w ? m0.b : m0.a), 'winner advances to the semifinal');
ok(cup.part === 2, 'part moves on to 2');
await touch('touchEnd', []);
await page.click('[data-a=next]');
await page.waitForTimeout(300);
ok((await hud()).tag === 'Day 1 · Part 2 · Quarterfinal', 'next match is Part 2');
await page.click('#crQuit');
await page.click('[data-act=cupshow]');
await page.waitForTimeout(500);
ok(await page.evaluate(() => document.querySelectorAll('.cr-show .cr-bm').length === 7), 'bracket screen shows 7 matches');
await shot('3-bracket');
await page.reload();
await page.waitForSelector('.cr-menu');
ok(await page.evaluate(() => window.__cr.store.cup && window.__cr.store.cup.part === 2), 'cup survives a reload');

ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
