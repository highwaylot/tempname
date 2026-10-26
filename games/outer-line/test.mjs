// Outer Line checks, in headless Chromium:
//   1. every stop and today's route can be finished: an autopilot that only
//      follows the guaranteed path and jumps at gaps rides each one to the end
//   2. keyboard play moves you and turns the tunnel; touch tap jumps
//   3. arriving unlocks the next stop; the daily card fills in
//   node games/outer-line/test.mjs [--shots <dir>]
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(here, 'game.html') + '?test=1';
const si = process.argv.indexOf('--shots'), shots = si > 0 ? process.argv[si + 1] : null;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if(!c) fails++; };

// Use Playwright's own browser if it's installed, else the machine's Chromium
// (cloud containers ship one at /opt/pw-browsers/chromium).
const exe = !fs.existsSync(chromium.executablePath()) && fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const b = await chromium.launch(exe ? { executablePath: exe } : {});
async function open(viewport, touch){
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__ol);
  return { ctx, page, errs };
}
const shot = async (page, n) => { if(shots) await page.screenshot({ path: path.join(shots, 'ol-' + n + '.png') }); };

// 1. solvability
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  ok(await page.evaluate(() => document.querySelectorAll('#spots .spot').length === 10), 'spot list shows 10 stops');
  await shot(page, 'map');
  const results = await page.evaluate(() => {
    const O = window.__ol, S = O.S, out = [];
    function ride(start){
      start();
      const st = S.st, G = S.G, tw = G.S / st.C;
      let deaths = 0, steps = 0, lastDead = 0;
      while(S.mode === 'ride' && steps < 60 * 120){
        const row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
        const target = (st.trail[row] + st.width / 2) * tw;
        let d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
        // steer like a skater: aim a sideways speed at the target and hold
        // whichever key closes the difference (momentum, not teleporting)
        const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
        O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4;
        if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
        O.update(1 / 120); steps++;
        if(S.dead > 0 && !lastDead) deaths++;
        lastDead = S.dead > 0;
      }
      O.input.left = O.input.right = false;
      return { arrived: S.mode !== 'ride' && S.arrived, deaths, secs: +(steps / 120).toFixed(1), rows: st.len, style: S.style, combo: S.bestCombo, top: +(S.topSpeed / st.p.speed).toFixed(2) };
    }
    for(let i = 0; i < O.STOPS.length; i++) out.push(Object.assign({ name: O.STOPS[i].name }, ride(() => O.rideStop(i))));
    out.push(Object.assign({ name: 'daily' }, ride(() => O.playDaily(true))));
    // the next 60 days of routes too, not just today's
    let bad = [];
    for(let n = 1; n <= 60; n++){ const r = ride(() => O.startStation(O.dailyParams(n), {})); if(!r.arrived || r.deaths) bad.push(n); }
    out.push({ name: 'routes #1–60', arrived: bad.length === 0, deaths: bad.length, secs: 0, rows: 200, bad });
    return out;
  });
  for(const r of results) ok(r.arrived && r.deaths === 0, `autopilot finishes ${r.name} (${r.rows} rows, ${r.secs}s, ${r.deaths} deaths${r.style != null ? `, style ${r.style}, best combo ×${r.combo}, top speed ${r.top}× base` : ''})`);
  const stops = results.filter(r => r.style != null && r.name !== 'daily');
  ok(stops.every(r => r.style > 0 && r.top > 1.15), 'momentum builds on every stop: tricks score and top speed beats base by 15 %+ (lowest ' + Math.min(...stops.map(r => r.top)) + '×)');
  ok(await page.evaluate(() => window.__ol.S.best >= 10), 'finishing a stop unlocks the next (best = ' + await page.evaluate(() => window.__ol.S.best) + ')');
  ok(errs.length === 0, 'no errors (solvability)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// 2-3. real-time play on desktop
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  await page.click('#playNext');
  await page.waitForTimeout(400);
  const z0 = await page.evaluate(() => window.__ol.S.z);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
  const after = await page.evaluate(() => ({ z: window.__ol.S.z, p: window.__ol.S.p, mode: window.__ol.S.mode }));
  ok(after.z > z0 + 4 && after.mode === 'ride', 'the ride moves forward in real time (z ' + z0.toFixed(1) + ' → ' + after.z.toFixed(1) + ')');
  await page.keyboard.press('Space'); await page.waitForTimeout(80);
  ok(await page.evaluate(() => !window.__ol.S.grounded || window.__ol.S.dead > 0), 'Space jumps');
  await page.waitForTimeout(500);
  await shot(page, 'ride-desktop');
  // walk onto a wall: the tunnel rolls so it becomes the floor
  const side0 = await page.evaluate(() => { const O = window.__ol, S = O.S; S.dead = 0; S.h = 0; S.grounded = true; S.vl = 0; O.input.left = O.input.right = false; return S.side; });
  await page.evaluate(() => { const O = window.__ol, S = O.S; S.p += O.S.G.S; S.vl = 0; for(let i = 0; i < 120; i++){ S.vl = 0; S.dead = 0; S.h = 0; S.grounded = true; O.update(1 / 120); } });
  const roll = await page.evaluate(() => { const O = window.__ol, S = O.S, w = a => Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    return { side: S.side, diff: w(O.upAt(S.G, S.p) - S.roll), normal: w(O.surf(S.G, S.p).up - S.roll), half: Math.PI / S.G.N }; });
  ok(roll.side !== side0 && roll.diff < 0.05 && roll.normal < roll.half, 'stepping onto the next wall rolls the camera to it (side ' + side0 + ' → ' + roll.side + ')');
  await page.evaluate(() => { const O = window.__ol, S = O.S; S.dead = 0; S.h = 0; S.vh = 0; S.grounded = true; O.input.jumpQ = 0; });
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(80);
  ok(await page.evaluate(() => !window.__ol.S.grounded || window.__ol.S.dead > 0), '↑ jumps');
  // smooth motion: the bot rides a stop with walls; the camera never jumps
  // between frames and the roll eases (both were steps before)
  const mot = await page.evaluate(() => {
    const O = window.__ol, S = O.S; O.rideStop(4); const st = S.st, G = S.G, tw = G.S / st.C;
    let prev = null, prevUp = null, prevDu = 0, maxStep = 0, maxJerk = 0, sides = 0, side = S.side;
    for (let i = 0; i < 60 * 12 && S.mode === 'ride'; i++) {
      const row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
      const target = (st.trail[row] + st.width / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
      const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
      O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4;
      if (S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
      O.update(1 / 120); O.update(1 / 120); O.draw();
      if (S.side !== side) { sides++; side = S.side; }
      const c = S.cam;
      if (prev) { maxStep = Math.max(maxStep, Math.hypot(c.x - prev.x, c.y - prev.y)); const du = c.up - prevUp; maxJerk = Math.max(maxJerk, Math.abs(du - prevDu)); prevDu = du; }
      prev = { x: c.x, y: c.y }; prevUp = c.up;
    }
    O.input.left = O.input.right = false;
    return { maxStep, maxJerk, sides, arrived: S.mode !== 'ride' };
  });
  ok(!mot.arrived && mot.sides >= 3 && mot.maxStep < .25 && mot.maxJerk < .02, 'wall to wall is smooth: ' + mot.sides + ' wall changes, camera step ≤ ' + mot.maxStep.toFixed(3) + ' per frame (was 1.5), roll jerk ≤ ' + mot.maxJerk.toFixed(4) + ' (was .17)');
  await page.evaluate(() => window.__ol.rideStop(0)); await page.waitForTimeout(100);
  // arrive
  await page.evaluate(() => { const S = window.__ol.S; S.dead = 0; S.h = 0; S.grounded = true; S.z = (S.st.len - 3) * window.__ol.D; });
  await page.waitForTimeout(900);
  ok(await page.evaluate(() => !document.getElementById('arriveScreen').hidden), 'reaching the end shows the arrival card');
  await shot(page, 'arrive');
  // daily, first ride: forced to the end
  await page.click('#arriveMap');
  await page.evaluate(() => { try{ localStorage.removeItem('outerline.daily'); }catch(e){} });
  await page.click('#playDaily');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const S = window.__ol.S; S.z = (S.st.len - 3) * window.__ol.D; S.h = 0; S.grounded = true; });
  await page.waitForTimeout(900);
  const card = await page.evaluate(() => ({ shown: !document.getElementById('dailyScreen').hidden, text: document.getElementById('shareText').textContent }));
  ok(card.shown && /OUTER LINE · ROUTE #\d+/.test(card.text) && /100%/.test(card.text), 'today\'s route ends on a share card: ' + JSON.stringify(card.text));
  await shot(page, 'daily');
  ok(errs.length === 0, 'no errors (desktop)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// Scramble's beanies: start with one, earn the rest, wear what you've earned
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  const start = await page.evaluate(() => ({ owned: window.__ol.owned(), worn: window.__ol.worn(), cards: document.querySelectorAll('#locker .beanie').length, locked: document.querySelectorAll('#locker .beanie.locked').length, name: document.getElementById('eggName').textContent }));
  ok(start.owned.join() === 'og' && start.worn === 'og' && start.cards === 9 && start.locked === 8 && start.name === 'Scramble', 'a new rider is Scramble with the OG beanie and 8 to earn');
  // landing Dockyard earns Lime Rib, shown on the arrival card
  await page.click('#playNext'); await page.waitForTimeout(200);
  await page.evaluate(() => { const S = window.__ol.S; S.dead = 0; S.h = 0; S.grounded = true; S.z = (S.st.len - 3) * window.__ol.D; });
  await page.waitForTimeout(900);
  const arr = await page.evaluate(() => ({ owned: window.__ol.owned(), strip: !document.getElementById('arriveUnlocks').hidden && document.getElementById('arriveUnlocks').textContent }));
  ok(arr.owned.includes('lime') && /Lime Rib/.test(arr.strip || ''), 'landing Dockyard unlocks Lime Rib and the arrival card says so');
  // FULL SEND mid-ride earns Full Send with a callout
  await page.click('#arriveAgain'); await page.waitForTimeout(200);
  const send = await page.evaluate(() => { const O = window.__ol, S = O.S; S.flow = .62; S.tier = 1; O.input.left = O.input.right = false; S.p += S.G.S; S.grounded = true; S.h = 0; S.wallT = -9; for(let i = 0; i < 40; i++) O.update(1 / 120); return { owned: O.owned(), pop: O.pops.some(p => p.text === "NEW BEANIE!" && p.sub === "FULL SEND") }; });
  ok(send.owned.includes('send') && send.pop, 'hitting FULL SEND unlocks the Full Send beanie mid-ride, with a callout');
  // wear it, survive a reload; locked beanies can't be worn
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  await page.click('#locker .beanie:nth-child(2)');
  await page.evaluate(() => window.__ol.wear('gold'));
  await page.reload(); await page.waitForFunction(() => window.__ol);
  const after = await page.evaluate(() => ({ worn: window.__ol.worn(), on: document.querySelector('#locker .beanie.on .nm').textContent, owned: window.__ol.owned().length }));
  ok(after.worn === 'lime' && after.on === 'Lime Rib' && after.owned === 3, 'the worn beanie is saved; a locked one can\'t be worn (' + after.on + ', ' + after.owned + ' owned)');
  // returning riders get progress beanies quietly
  await page.evaluate(() => { localStorage.setItem('outerline.best', '10'); });
  await page.reload(); await page.waitForFunction(() => window.__ol);
  const ret = await page.evaluate(() => window.__ol.owned());
  ok(['lime', 'cyan', 'nightbus', 'flag'].every(id => ret.includes(id)), 'a rider who already landed every spot gets the progress beanies on load');
  await page.evaluate(() => document.getElementById('locker').scrollIntoView());
  await shot(page, 'locker');
  ok(errs.length === 0, 'no errors (beanies)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// touch
{
  const { ctx, page, errs } = await open({ width: 390, height: 844 }, true);
  await page.tap('#playNext');
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 600, id: 1 }] });
  await page.waitForTimeout(400);
  const steer = await page.evaluate(() => window.__ol.input.right);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(steer, 'holding the right half steers right');
  await page.evaluate(() => { const S = window.__ol.S; S.dead = 0; S.h = 0; S.grounded = true; S.z = 2; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 500, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(60);
  ok(await page.evaluate(() => !window.__ol.S.grounded), 'a quick tap jumps');
  await page.waitForTimeout(600);
  await shot(page, 'ride-phone');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on a phone');
  ok(errs.length === 0, 'no errors (touch)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}
await b.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
