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

// forever: survivable deep past the end of the ramp, gaps marked, one fall ends it
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  const res = await page.evaluate(() => {
    const O = window.__ol, S = O.S, DEEP = 4000, out = { runs: 0, falls: [], gaps: 0, minRows: Infinity, topBase: 0 };
    for(let seed = 1; seed <= 20; seed++){
      O.startStation({ name: 'Forever', forever: true, seed }, {});
      const G = S.G; let steps = 0;
      while(S.mode === 'ride' && S.z / O.D < DEEP && steps < 120 * 600){
        const st = S.st, tw = G.S / st.C, row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
        const target = (st.trail[row] + st.wid[row] / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
        const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
        O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4;
        if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
        O.update(1 / 120); steps++;
      }
      O.input.left = O.input.right = false;
      out.runs++;
      if(S.mode !== 'ride' || S.dead > 0) out.falls.push(seed);
      out.minRows = Math.min(out.minRows, Math.floor(S.z / O.D));
      out.gaps += S.st.gap.filter((g, i) => g && !S.st.gap[i - 1] && i < S.z / O.D).length;
      out.topBase = Math.max(out.topBase, S.st.p.speed);
    }
    // gap marks agree with the rows on a built stop
    const t = O.buildStation(O.STOPS[9]); let markOk = true;
    for(let r = 0; r < t.len; r++) if(!!t.gap[r] !== t.rows[r].every(v => !v)) markOk = false;
    out.markOk = markOk;
    return out;
  });
  ok(res.falls.length === 0 && res.minRows >= 4000, 'forever: autopilot survives 20 random runs 4,000 rows deep, past the end of the ramp (' + res.gaps + ' jump-gaps, base speed up to ' + res.topBase.toFixed(1) + ', falls on seeds: ' + (res.falls.join(', ') || 'none') + ')');
  ok(res.markOk, 'every fully empty row is marked as a jump-gap (and nothing else is)');
  // one fall ends the run on its card and saves the best; the bar races it next time
  await page.evaluate(() => { localStorage.removeItem('outerline.forever'); window.__ol.S.mode = 'ride'; document.getElementById('foreverMap').click(); });
  await page.click('#playForever'); await page.waitForTimeout(300);
  const ride = await page.evaluate(() => ({ forever: !!window.__ol.S.st.forever, label: document.getElementById('stnName').textContent, bar: document.getElementById('progFill').style.width }));
  await page.evaluate(() => { const S = window.__ol.S; S.z = 512; S.grounded = false; S.h = -1.3; S.vh = -5; });
  await page.waitForTimeout(1400);
  const end = await page.evaluate(() => ({ shown: !document.getElementById('foreverScreen').hidden, dist: document.getElementById('foreverDist').textContent, head: document.getElementById('foreverHead').textContent, rec: JSON.parse(localStorage.getItem('outerline.forever') || '{}') }));
  ok(ride.forever && /^FOREVER/.test(ride.label) && parseFloat(ride.bar) === 0, 'Forever starts an endless ride; with no best yet the bar is empty (' + ride.label + ', bar ' + ride.bar + ')');
  ok(end.shown && /new best/.test(end.head) && end.rec.m >= 512 && /M$/.test(end.dist), 'one fall ends the run on its card and saves the best (' + end.dist + ')');
  await page.click('#foreverAgain'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => /BEST/.test(document.getElementById('stnName').textContent)), 'the next run shows the best to beat');
  ok(errs.length === 0, 'no errors (forever)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// hills: downhill is common, slowing down is rare, crests launch, and no
// jump-gap ever hides behind the top of a hill
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  const res = await page.evaluate(() => {
    const O = window.__ol, S = O.S, out = { stops: [], hidden: [] };
    for(let i = 0; i < O.STOPS.length; i++){
      for(const noFlow of [false, true]){
        O.rideStop(i); const st = S.st, G = S.G, tw = G.S / st.C;
        let n = 0, down = 0, up = 0, slow = 0, launched = 0, steps = 0, top = 0;
        while(S.mode === 'ride' && steps < 120 * 60){
          const row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
          const target = (st.trail[row] + st.width / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
          const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
          O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4;
          if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
          if(noFlow){ S.flow = 0; S.flowS = 0; }
          O.update(1 / 120); steps++; n++;
          const g = O.gradeAt(S.z); if(g < -.02) down++; if(g > .02) up++; if(S.carry < -.01) slow++;
          if(O.pops.some(p => p.text.startsWith('CREST') && p.t < .009)) launched++;
          top = Math.max(top, S.carry);
        }
        out.stops.push({ name: st.p.name, noFlow, down: down / n, up: up / n, slow: slow / n, launched, arrived: S.arrived });
      }
      // sight lines: from 4 to 10 rows before each jump-gap, the gap's near edge projects above every floor row in between
      O.rideStop(i); const st = S.st, G = S.G, tw = G.S / st.C;
      for(let g = 14; g < st.len; g++){
        if(!st.gap[g] || st.gap[g - 1]) continue;
        for(let back = 4; back <= 10; back++){
          const r0 = g - back; S.z = r0 * O.D; S.p = (st.trail[r0] + st.width / 2) * tw; S.roll = O.upAt(G, S.p); S.rollV = 0;
          S.pitch = O.vgradeAt(S.z); S.h = 0; S.flowS = .5; S.mode = 'still'; O.draw();
          const col = (st.trail[g] + st.width / 2) * tw, pt = O.surf(G, col);
          const yAt = z => { const q = S.cam.proj(pt.x, pt.y, z); return q ? q[1] : Infinity; };
          const yGap = yAt(g * O.D); let lip = Infinity;
          for(let k = 4 * (r0 + 1); k < 4 * g; k++) lip = Math.min(lip, yAt(k * O.D / 4));
          if(pt.s !== O.surf(G, S.p).s) continue;   // only the floor you're riding: a gap up a wall is seen across the tunnel
          if(!(yGap < lip + 1 && yGap > 0)) out.hidden.push(st.p.name + ' gap ' + g + ' from ' + back + ' back');
        }
      }
      S.mode = 'ride';
    }
    return out;
  });
  const flow = res.stops.filter(r => !r.noFlow), none = res.stops.filter(r => r.noFlow);
  const pct = x => Math.round(x * 100);
  ok(res.stops.every(r => r.arrived), 'with hills, the autopilot still lands every spot, with and without flow');
  ok(flow.filter(r => r.down > .2).length >= 9, 'downhill is common: ' + flow.map(r => pct(r.down)).join('/') + ' % of each spot');
  ok(flow.some(r => r.up > .05), 'uphills exist (' + flow.map(r => pct(r.up)).join('/') + ' %)');
  ok(res.stops.every(r => r.slow < .02), 'slowing down is rare: time spent below flow speed ' + Math.max(...res.stops.map(r => pct(r.slow))) + ' % at most, even with no flow at all');
  ok(flow.reduce((a, r) => a + r.launched, 0) >= 3, 'crests launch you when you bring speed (' + flow.reduce((a, r) => a + r.launched, 0) + ' across the spots)');
  ok(res.hidden.length === 0, 'every jump-gap on your floor is in sight from 10 rows out (half a second at top speed); no hill hides one' + (res.hidden.length ? ': ' + res.hidden.slice(0, 4).join('; ') + ' (' + res.hidden.length + ')' : ''));
  ok(errs.length === 0, 'no errors (hills)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// hills, as you actually see them on a phone, with the live (easing) camera:
// the next gap on your floor is in sight and drawn at least 2 px tall from 4–10
// rows out, every frame, on busy spots, the daily and deep Forever at top
// speed; and a real downhill is never drawn as an uphill
{
  const { ctx, page, errs } = await open({ width: 390, height: 844 }, true);
  const res = await page.evaluate(() => {
    const O = window.__ol, S = O.S, out = { frames: 0, hidden: [], thin: [], backwards: [] };
    const rides = [['Halo Junction', () => O.rideStop(2)], ['Quarry Steps', () => O.rideStop(3)], ['Comet Yard', () => O.rideStop(8)], ['Terminus', () => O.rideStop(9)],
      ['daily #1', () => O.startStation(O.dailyParams(1), {})], ['forever 1000', () => O.startStation({ name: 'Forever', forever: true, seed: 1000 }, {})], ['forever 1001', () => O.startStation({ name: 'Forever', forever: true, seed: 1001 }, {})]];
    for(const [name, start] of rides){
      start(); const G = S.G; let steps = 0;
      while(S.mode === 'ride' && steps < 120 * 150 && S.z / O.D < 3000){
        const st = S.st, tw = G.S / st.C, w = st.wid ? st.wid : null, row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
        const target = (st.trail[row] + (w ? w[row] : st.width) / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
        const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
        O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4; O.input.tuck = true;
        if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
        O.update(1 / 120); steps++;
        if(steps % 4 || S.dead > 0) continue;
        const r0 = Math.floor(S.z / O.D); let g = -1;
        for(let k = r0 + 4; k <= r0 + 10; k++) if(st.gap[k] && !st.gap[k - 1]){ g = k; break; }
        if(g < 0) continue;
        const pt = O.surf(G, (st.trail[g] + (w ? w[g] : st.width) / 2) * tw); if(pt.s !== O.surf(G, S.p).s) continue;
        const mode = S.mode; S.mode = 'still'; O.draw(); S.mode = mode; out.frames++;
        const yAt = z => { const q = S.cam.proj(pt.x, pt.y, z); return q ? q[1] : Infinity; };
        let ge = g; while(st.gap[ge + 1]) ge++;
        const yGap = yAt(g * O.D), yEnd = yAt((ge + 1) * O.D); let lip = Infinity;
        // only floor seen from above (below the horizon) can be hidden by nearer floor; a column above eye level is in view by construction
        { const c = S.cam, ux = Math.cos(c.up), uy = Math.sin(c.up); if((pt.x - c.x) * ux + (pt.y - c.y) * uy + c.bendAt(g * O.D) > -.05) continue; }
        // the floor under the rider (the next two rows) is below the egg and can't hide a gap 4+ rows on; near rows also pick up sideways parallax
        for(let k = 4 * (r0 + 2); k < 4 * g; k++) lip = Math.min(lip, yAt(k * O.D / 4));
        if(!(yGap < lip + 1 && yGap > 0)){ out.hidden.push(name + ' gap ' + g + ' from ' + (g - S.z / O.D).toFixed(1)); continue; }
        // (hidden means its near edge projects more than 1 px below the floor in front: a column seen side-on lines up within a pixel without anything in the way)
        // thin: hills may not draw the gap thinner than the same frame without hills (a far gap on a phone is small either way)
        const tall = yGap - yEnd;
        if(tall < 2){ O.tune({ HILL_VIS: 0 }); S.mode = 'still'; O.draw(); S.mode = mode; const flat = yAt(g * O.D) - yAt((ge + 1) * O.D); O.tune({ HILL_VIS: 3 });
          if(flat >= 2 ? tall < flat * .75 : tall < flat - .6) out.thin.push(name + ' gap ' + g + ' ' + tall.toFixed(1) + 'px vs ' + flat.toFixed(1) + ' flat'); }
      }
      O.input.tuck = false;
      const st = S.st; let down = 0, back = 0;
      for(let r = 0; r < st.vgrade.length; r++) if(st.grade[r] < -.02){ down++; if(st.vgrade[r] > .02) back++; }
      out.backwards.push(name + ' ' + back + '/' + down);
      S.mode = 'ride';
    }
    return out;
  });
  ok(res.frames > 500 && res.hidden.length === 0, 'live camera at top speed: the next gap on your floor stays in sight from 4–10 rows out (' + res.frames + ' frames' + (res.hidden.length ? '; hidden: ' + res.hidden.slice(0, 3).join('; ') + ' (' + res.hidden.length + ')' : '') + ')');
  ok(res.thin.length === 0, 'and hills never squash it: at least 2 px tall, or 75 % of its height without hills (within 0.6 px when it is sub-2 px anyway)' + (res.thin.length ? ' (' + res.thin.length + ': ' + res.thin.slice(0, 3).join('; ') + ')' : ''));
  ok(res.backwards.every(x => { const [b, d] = x.split(' ').pop().split('/').map(Number); return b <= d * .05; }), 'a real downhill is (almost) never drawn as an uphill: ' + res.backwards.join(', '));
  ok(errs.length === 0, 'no errors (hills on a phone)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// holes can't be skated over: a hole you don't jump is a fall at any speed,
// a jump still clears it, and a carve that brushes a hole's side survives
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  const res = await page.evaluate(() => {
    const O = window.__ol, S = O.S, out = { glide: [], jump: 0, brush: 0, n: 0 };
    const setup = (r, c, mult) => {
      O.rideStop(0); const st = S.st, G = S.G, tw = G.S / st.C;
      for(let k = r - 3; k <= r + 3; k++) st.rows[k].fill(1);
      st.rows[r][c] = 0;
      S.p = (c + .5) * tw; S.z = (r - 2) * O.D; S.vl = 0; S.carry = 0; S.grounded = true; S.h = 0; S.dead = 0;
      O.input.left = O.input.right = false; O.input.jumpQ = 0; O.input.tuck = mult > 1.8;
      return { st, tw };
    };
    for(const mult of [1, 1.4, 1.8, 2.07]){
      let fell = 0;
      for(let t = 0; t < 8; t++){
        const r = 40 + t * 5, { st } = setup(r, 0, mult); const c = st.trail[r] + 1; st.rows[r].fill(1); st.rows[r][c] = 0; S.p = (c + .5) * (S.G.S / st.C);
        let died = false;
        for(let i = 0; i < 120; i++){ S.vl = 0; S.flow = S.flowS = Math.min(1, (mult - 1) / .8); O.update(1 / 120); if(S.dead > 0){ died = true; break; } if(S.z > (r + 3) * O.D && S.grounded) break; }
        if(died) fell++;
      }
      out.glide.push(mult + '×: ' + fell + '/8');
      // the same hole, jumped
      const r = 60, { st } = setup(r, 0, mult); const c = st.trail[r] + 1; st.rows[r].fill(1); st.rows[r][c] = 0; S.p = (c + .5) * (S.G.S / st.C);
      let died = false;
      for(let i = 0; i < 180; i++){ S.vl = 0; S.flow = S.flowS = Math.min(1, (mult - 1) / .8); if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15; O.update(1 / 120); if(S.dead > 0){ died = true; break; } if(S.z > (r + 4) * O.D && S.grounded) break; }
      if(!died) out.jump++;
      O.input.tuck = false;
    }
    // brushing a hole's side: carve across the edge of a hole beside you and straight back
    for(let t = 0; t < 8; t++){
      const r = 40 + t * 5; O.rideStop(0); const st = S.st, G = S.G, tw = G.S / st.C, c = st.trail[r] + 1;
      for(let k = r - 4; k <= r + 4; k++){ st.rows[k].fill(1); st.rows[k][c + 1] = 0; }
      S.p = (c + .5) * tw + tw * .4; S.z = (r - 3) * O.D; S.grounded = true; S.h = 0; S.dead = 0; O.input.jumpQ = 0;
      let died = false;
      for(let i = 0; i < 60; i++){ S.vl = i < 4 ? 6 : -6; O.update(1 / 120); if(S.dead > 0){ died = true; break; } }
      out.n++; if(!died) out.brush++;
    }
    return out;
  });
  ok(res.glide.every(x => /: 8\/8$/.test(x)), 'rolling over a hole without jumping is a fall at every speed (' + res.glide.join(', ') + '); it used to glide over from 1.4× base up');
  ok(res.jump === 4, 'jumping the same hole still clears it at every speed (' + res.jump + '/4)');
  ok(res.brush === res.n, 'a carve that brushes the side of a hole survives (' + res.brush + '/' + res.n + ')');
  ok(errs.length === 0, 'no errors (holes)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// glide and coins
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  const res = await page.evaluate(() => {
    const O = window.__ol, S = O.S, out = { stops: [], chainMax: 0 };
    for(let i = 0; i < 10; i++){
      O.rideStop(i); const st = S.st, G = S.G, tw = G.S / st.C; let steps = 0;
      const gapStarts = st.gap.filter((g, r) => g && !st.gap[r - 1]).length, arcs = new Set(st.coins.filter(c => c.grp[0] === 'g').map(c => c.grp)).size;
      const crests = st.crest.filter((c, r) => c && r < st.len - 8).length, crestLines = new Set(st.coins.filter(c => c.grp[0] === 'c').map(c => c.grp)).size;
      while(S.mode === 'ride' && steps < 120 * 60){
        const row = Math.min(st.len - 1, Math.floor((S.z + O.D * .6) / O.D));
        const target = (st.trail[row] + st.width / 2) * tw, d = ((target - S.p) % G.P + G.P * 1.5) % G.P - G.P / 2;
        const vmax = O.VL_BASE + O.VL_FLOW * S.flow, want = Math.max(-vmax, Math.min(vmax, d * 7));
        O.input.left = want - S.vl < -.4; O.input.right = want - S.vl > .4;
        if(S.grounded && !O.tileAt(S.p, S.z + O.D * .55)) O.input.jumpQ = .15;
        O.update(1 / 120); steps++; out.chainMax = Math.max(out.chainMax, S.coinChain);
      }
      out.stops.push({ name: st.p.name, coins: S.coins, total: st.coins.length, gapStarts, arcs, crests, crestLines });
    }
    const air = held => { O.rideStop(0); const st = S.st; for(let k = 20; k < 60; k++) st.rows[k].fill(1); S.z = 22 * O.D; S.flow = S.flowS = 0; S.carry = 0; S.grounded = true; S.h = 0; O.input.jumpQ = .15; O.input.jumpHeld = held; const z0 = S.z; let t = 0; do { O.update(1 / 120); t++; } while((!S.grounded && t < 600) || t < 3); O.input.jumpHeld = false; return { rows: (S.z - z0) / O.D, carry: S.carry }; };
    out.plain = air(false); out.glide = air(true);
    O.rideStop(0); { const st = S.st, G = S.G, tw = G.S / st.C, r = 40, c = st.trail[r] + 1; for(let k = r - 3; k <= r + 3; k++) st.rows[k].fill(1); st.rows[r][c] = 0; S.p = (c + .5) * tw; S.z = (r - 2) * O.D; S.grounded = true; S.h = 0; O.input.jumpHeld = true; let died = false; for(let i = 0; i < 120; i++){ S.vl = 0; O.update(1 / 120); if(S.dead > 0){ died = true; break; } } O.input.jumpHeld = false; out.edge = died; }
    return out;
  });
  ok(res.stops.every(s => s.arcs === s.gapStarts && s.crestLines === s.crests), 'every jump-gap has a coin arc and every crest a glide line (' + res.stops.map(s => s.arcs + '/' + s.gapStarts + ' ' + s.crestLines + '/' + s.crests).join(', ') + ')');
  ok(res.stops.every(s => s.coins > 0), 'coins can be collected on every spot without gliding (' + res.stops.map(s => s.coins + '/' + s.total).join(' ') + ')');
  ok(res.chainMax >= 5, 'coins chain (longest chain ×' + res.chainMax + ', so the dings climb)');
  ok(res.glide.rows > res.plain.rows * 1.5 && res.glide.carry < res.plain.carry, 'holding glide stretches a jump (' + res.plain.rows.toFixed(1) + ' → ' + res.glide.rows.toFixed(1) + ' rows) and costs speed');
  ok(res.edge, 'gliding can\'t rescue rolling off an edge into a hole');
  ok(errs.length === 0, 'no errors (glide and coins)' + (errs.length ? ': ' + errs[0] : ''));
  await ctx.close();
}

// gaps you can see: the floor you ride is a lit surface at least 3:1 against
// a hole, on every spot colour, measured on rendered pixels too
{
  const { ctx, page, errs } = await open({ width: 1280, height: 800 });
  const res = await page.evaluate(() => {
    const O = window.__ol, S = O.S, cols = ['#c6ff00', '#2ee6ff', '#ff2e88'];
    const ratio = c => (O.relLum(c) + .05) / .05;
    const byColour = cols.map(c => +ratio(O.floorColor(c)).toFixed(2));
    // rendered: a floor tile and a hole on the side under the rider, a few rows ahead
    const cv = document.getElementById('c'), g = cv.getContext('2d'), dpr = cv.width / innerWidth, px = [];
    for(const idx of [0, 4, 8]){
      O.rideStop(idx); const st = S.st, G = S.G, tw = G.S / st.C;
      let found = null;
      for(let r = 20; r < st.len - 10 && !found; r++) for(let c = 0; c < st.cols && !found; c++)
        if(c % st.C < st.C - 1 && !st.rows[r][c] && st.rows[r][c + 1] && !st.gap[r] && st.rows[r - 1][c] && st.rows[r - 1][c + 1]) found = { r, c };
      S.z = (found.r - 6) * O.D; S.p = (found.c + 1) * tw; S.roll = O.upAt(G, S.p); S.rollV = 0; S.mode = 'still'; S.h = 0; S.shake = 0; O.draw();
      // sample the centre of that hole and of the floor tile beside it, through the frame's own camera
      const at = (col, row) => { const a = O.surf(G, (col + .5) * tw), q = S.cam.proj(a.x, a.y, (row + .5) * O.D), d = g.getImageData(Math.round(q[0] * dpr), Math.round(q[1] * dpr), 1, 1).data; return O.relLum([d[0], d[1], d[2]]); };
      px.push({ spot: st.p.name, dark: +at(found.c, found.r).toFixed(4), light: +at((found.c + 1) % st.cols, found.r).toFixed(4) });
      S.mode = 'ride';
    }
    return { byColour, px };
  });
  ok(res.byColour.every(r => r >= 3), 'floor vs hole contrast is at least 3:1 on every spot colour (' + res.byColour.join(', ') + '; it was about 1.1)');
  ok(res.px.every(p => (p.light + .05) / (p.dark + .05) >= 3), 'rendered frames show it: a hole vs the floor tile beside it, 6 rows ahead (' + res.px.map(p => p.spot + ' ' + ((p.light + .05) / (p.dark + .05)).toFixed(1) + ':1').join(', ') + ')');
  ok(errs.length === 0, 'no errors (gap contrast)' + (errs.length ? ': ' + errs[0] : ''));
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
