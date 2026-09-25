// AI vs AI director for country-vs-country ads. Loaded instead of the game's
// entry by ads/versus.html; boots the real game (src/main.js) and then plays
// both lanes with bots. Nothing here ships in the app.
//
// Fail model (all from the seed, so any run can be re-rendered exactly):
//   * Before `safe` seconds (default 6) the bots play clean. The only way to
//     crash early is the one roll at the start with probability `early`
//     (default 1e-8, i.e. 0.000001%).
//   * Each side draws its own fail time: safe + gap + a gamma-shaped extra
//     (mean `mean` s). Whichever side's time comes first starts aiming at a
//     wall and loses. Near misses, smashes and boosts happen on the way.
//   * The bots can still crash by accident after `safe`, which is fine: that
//     is a real, random loss too.
import '../src/main.js';
import { game, cursors, startRun, laneBounds, HIT_R, DRAW_R, PHASE_RUN, PHASE_DEAD, BOOST_DRAIN } from '../src/game.js';
import { state } from '../src/state.js';
import { view, clearImageCache, clearHaloCache } from '../src/render.js';
import { world } from '../src/world.js';

var q = new URLSearchParams(location.search);
var P = {
  seed: parseInt(q.get("seed") || "1", 10),
  left: (q.get("left") || "br").toLowerCase(),
  right: (q.get("right") || "ar").toLowerCase(),
  leftName: q.get("leftName") || "",
  rightName: q.get("rightName") || "",
  safe: +(q.get("safe") || 6),
  early: +(q.get("early") || 1e-8),
  mean: +(q.get("mean") || 5),
  maxLen: +(q.get("maxLen") || 24),
  hook: q.get("hook") || "Who hits the wall first?",
  fps: +(q.get("fps") || 30),
  clean: q.get("clean") === "1" || q.get("zen") === "1",   // no flags, no banners: the game as players see it
  // Zen: long-form ambient footage. No scheduled crash, calm difficulty that
  // breathes over minutes, a boost now and then, and a quiet restart if a bot
  // slips by accident. `len` is the length in seconds.
  zen: q.get("zen") === "1",
  // Bot personality: "hype" chases coins, skims walls for GRAZE and snaps
  // fast (the ads); "calm" chases coins with wide margins, never skims (zen).
  style: q.get("style") || (q.get("zen") === "1" ? "calm" : "hype"),
  len: +(q.get("len") || 600)
};
var rng = window.__adBotRng;
function gamma2(mean){ return -(mean/2) * Math.log((1 - rng()) * (1 - rng())); } // Erlang k=2

var failAt = P.zen ? [Infinity, Infinity] : [0, 1].map(function(){
  if(rng() < P.early) return 0.8 + rng() * (P.safe - 0.8);
  return P.safe + 0.8 + gamma2(P.mean);
});

var zenPumpUntil = -1, zenNextPump = 25 + rng() * 30, restartAt = -1, events = [], seenPass = new WeakSet(), lastCoins = 0, lastWreck = 0, lastBoost = 0, crashes = 0;
var t = 0, started = false, deathT = -1, loser = -1, smashPick = new WeakMap(), failDir = new WeakMap(), grazePick = new WeakMap();
var pumpPh = [rng() * 6.28, rng() * 6.28], wob = [rng() * 6.28, rng() * 6.28];
// Human hands, not a servo: each lane has a virtual thumb that the bot's goal
// pulls on through a damped spring (a touch of overshoot when relaxed, dead
// stiff when a wall is about to arrive). The pump keeps a loose, drifting
// tempo with a different reach on every stroke, and fades in and out instead
// of switching. The game's own Follow smoothing then sits on top, as it does
// for a player.
var thumb = [null, null], pumpAmp = [0, 0], pumpHz = [2.9, 2.9], strokeAmp = [1, 1], chase = [null, null];
var stat = { grazes: 0, smashes: 0, jerk: [0, 0], flips: [0, 0], frames: 0, vx: [[0, 0], [0, 0]] }, seenGraze = new WeakSet(), wreckSeen = 0;

function sideTarget(s, dt){
  var W = view.W, H = view.H, c = cursors[s], b = laneBounds(s);
  var baseY = H * 0.73, laneC = (b.x0 + b.x1) / 2;
  var failing = t >= failAt[s];
  // Nearest barrier still above the orb in this lane.
  // The barrier that matters is the closest one whose top is still above
  // the orb's lowest pumping reach, passed or not: pumping down into a wall
  // the orb has just cleared is a crash too.
  var PUMP = 46, reachLo = baseY + PUMP + HIT_R + 8, reachHi = baseY - PUMP - HIT_R - 8;
  var next = null, inBand = false;
  for(var i=0;i<game.obstacles.length;i++){
    var o = game.obstacles[i];
    if(o.side !== s) continue;
    if(o.y > reachLo) continue;
    if(o.y + o.h > reachHi) inBand = true;
    if(!next || o.y > next.y) next = o;
  }
  var tx = laneC, lit = game.boost > 0, hype = P.style === "hype", early = t < P.safe;
  var speed = Math.max(60, game.speed);
  // The next barrier the orb still has to get through (not yet passed).
  var up = null;
  for(var ui=0;ui<game.obstacles.length;ui++){
    var uo = game.obstacles[ui];
    if(uo.side !== s || uo.passed || uo.y + uo.h > c.y + HIT_R) continue;
    if(!up || uo.y > up.y) up = uo;
  }
  if(next){
    var room = Math.max(0, next.gapW/2 - HIT_R - 8);
    tx = next.gapC + (0.62 * Math.sin(t * (hype ? 1.25 : 0.8) + wob[s]) + 0.38 * Math.sin(t * (hype ? 2.1 : 1.4) + wob[s] * 1.7)) * room * (hype ? 0.75 : 0.45);
    // Near misses: on some barriers, skim one wall close enough for GRAZE
    // (< 7 px of clearance). Wider before the safe window.
    if(hype && !next.passed){
      if(!grazePick.has(next)) grazePick.set(next, { go: rng() < 0.4, dir: rng() < 0.5 ? -1 : 1, g: 2.5 + rng() * 3 });
      var gp = grazePick.get(next);
      if(gp.go){
        var hasWall = next.rects.some(function(r){ return gp.dir < 0 ? r.x < next.gapC : r.x > next.gapC; });
        if(hasWall) tx = next.gapC + gp.dir * (next.gapW/2 - HIT_R - (early ? 6 : gp.g));
      }
    }
    // Coins: dart out for one that reaches the orb before this barrier does,
    // with enough time left to get back into the gap. Rare coins are worth a
    // tighter margin. Only once the barrier behind is fully clear.
    if(next === up || !next.passed){
      var tU = (c.y - HIT_R - (next.y + next.h)) / speed, grab = null;
      var coinOk = function(pk, keep){
        if(pk.taken || pk.x < b.x0 || pk.x > b.x1 || pk.y > c.y - 4) return false;
        var tc = (c.y - pk.y) / speed;
        var margin = (early ? 0.36 : (hype ? 0.22 : 0.42)) - (pk.tier ? 0.06 : 0) + Math.abs(pk.x - tx) / 1500 - (keep ? 0.04 : 0);
        return pk.y > next.y + next.h + 8 && tc < tU - margin;
      };
      // Once a coin is picked, stay on it until it's taken or out of reach:
      // switching targets every frame is what reads as a robot.
      if(chase[s] && game.pickups.indexOf(chase[s]) >= 0 && coinOk(chase[s], true)) grab = chase[s];
      else {
        for(var pj=0;pj<game.pickups.length;pj++){
          var pk = game.pickups[pj];
          if(coinOk(pk, false) && (!grab || pk.y > grab.y)) grab = pk;
        }
        chase[s] = grab;
      }
      if(grab && !(lit && !next.hard)) tx = grab.x;
      else if(!grab){
        // A coin just beyond the barrier and inside its gap: line up with it.
        for(var pq=0;pq<game.pickups.length;pq++){
          var pc = game.pickups[pq];
          if(pc.y < next.y && pc.y > next.y - 160 && Math.abs(pc.x - next.gapC) < room){ tx = pc.x; break; }
        }
      }
    }
    // While lit, most slate gets smashed on purpose: that's the show.
    if(lit && !next.hard){
      if(!smashPick.has(next)) smashPick.set(next, { go: rng() < (hype ? 0.85 : 0.7), r: Math.floor(rng() * 8) });
      var pick = smashPick.get(next);
      // Only smash if the tank will still be lit on impact, with margin:
      // a boost that runs out on the way turns a smash into a crash.
      var eta = Math.max(0, (c.y - HIT_R - (next.y + next.h)) / Math.max(60, game.speed));
      var litOnImpact = game.charge - BOOST_DRAIN * eta;
      if(pick.go && next.rects.length && litOnImpact > (t < P.safe ? 0.35 : 0.2)){
        var rc = next.rects[pick.r % next.rects.length];
        tx = rc.x + rc.w/2;
      }
    }
    if(failing && (!lit || next.hard)){
      // Clip the wall just past the gap edge: reads as a near miss that didn't make it.
      if(!failDir.has(next)){
        var hasL = next.rects.some(function(r){ return r.x < next.gapC; }), hasR = next.rects.some(function(r){ return r.x > next.gapC; });
        failDir.set(next, hasL && hasR ? (rng() < 0.5 ? -1 : 1) : (hasL ? -1 : 1));
      }
      tx = next.gapC + failDir.get(next) * (next.gapW/2 + HIT_R * 0.6);
    }
  } else {
    // Nothing coming: drift toward a coin in this lane, else the lane centre.
    var best = null;
    for(var j=0;j<game.pickups.length;j++){
      var p = game.pickups[j];
      if(p.x < b.x0 || p.x > b.x1 || p.y > c.y) continue;
      if(!best || p.y > best.y) best = p;
    }
    if(best) tx = best.x;
  }
  // Pump while the tank isn't lit, but hold still when a barrier is close
  // and the orb is still travelling sideways.
  var closeBy = next && (c.y - (next.y + next.h)) < 150 && Math.abs(c.x - tx) > 10;
  // A wall about to enter pumping reach: start easing the pump out now.
  var bandSoon = inBand;
  for(var k=0;k<game.obstacles.length && !bandSoon;k++){
    var ob = game.obstacles[k];
    if(ob.side === s && ob.y <= reachLo && ob.y + ob.h > reachHi - speed * 0.14) bandSoon = true;
  }
  var pump = !lit && !closeBy && !bandSoon && !failing && (!P.zen || t < zenPumpUntil);
  var urgent = !!(up && (c.y - HIT_R - (up.y + up.h)) / speed < 0.5);
  return { tx: Math.max(b.x0 + DRAW_R, Math.min(b.x1 - DRAW_R, tx)), pump: pump, hold: inBand, urgent: urgent, baseY: baseY, PUMP: PUMP };
}

// Turn a goal into a thumb position.
function moveThumb(s, g, dt){
  var c = cursors[s], hype = P.style === "hype";
  var T = thumb[s] || (thumb[s] = { x: c.x, v: 0 });
  var w = g.urgent ? 26 : (hype ? 15 : 10), z = g.urgent ? 1 : (hype ? 0.7 : 0.9), VMAX = hype ? 2400 : 1500;
  for(var i=0;i<4;i++){
    var h = dt / 4;
    T.v += (w * w * (g.tx - T.x) - 2 * z * w * T.v) * h;
    T.v = Math.max(-VMAX, Math.min(VMAX, T.v));
    T.x += T.v * h;
  }
  // Pump envelope: fade in over ~0.25 s, out over ~0.07 s; gone at once if a
  // wall is already in reach.
  var want = g.pump ? 1 : 0;
  if(g.hold) pumpAmp[s] = 0;
  else pumpAmp[s] += (want - pumpAmp[s]) * Math.min(1, dt / (want ? 0.25 : 0.07));
  if(pumpAmp[s] > 0.01){
    var prev = Math.sin(pumpPh[s]);
    pumpPh[s] += dt * 6.28 * pumpHz[s];
    // New tempo and reach at every half stroke (where sin crosses 0, so the
    // change is seamless): a bit faster or slower, a bit longer or shorter.
    if((prev < 0) !== (Math.sin(pumpPh[s]) < 0)){
      pumpHz[s] = Math.max(2.4, Math.min(3.4, pumpHz[s] + (rng() - 0.5) * 0.5));
      strokeAmp[s] = 0.72 + rng() * 0.28;
    }
  }
  var ty = g.baseY + Math.sin(pumpPh[s]) * g.PUMP * strokeAmp[s] * pumpAmp[s];
  var b = laneBounds(s);
  return { tx: Math.max(b.x0 + DRAW_R, Math.min(b.x1 - DRAW_R, T.x)), ty: ty };
}

// The game marks every crash with a ripple of strength 1.6 and life 2.2 at
// the exact hit point (game.js die()); its x says which lane crashed.
function loserSide(){
  for(var i = world.ripples.length - 1; i >= 0; i--){
    var r = world.ripples[i];
    if(r.strength === 1.6 && r.life === 2.2) return r.x < view.W / 2 ? 0 : 1;
  }
  return -1;
}

// ---------- overlays ----------
function flagUrl(code){ return "/node_modules/flag-icons/flags/1x1/" + code + ".svg"; }
var NAMES = {};
function nameOf(code, override){ return override || NAMES[code] || code.toUpperCase(); }
var layer, top, hook, timer, win, dim;
function buildLayer(){
  var wrap = view.wrap;
  layer = document.createElement("div"); layer.className = "ad-layer";
  layer.innerHTML =
    '<div class="ad-dim"></div>' +
    '<div class="ad-top"><div class="ad-vs"><span class="ad-flag" style="background-image:url(' + flagUrl(P.left) + ')"></span>' +
    '<span class="ad-name"></span><span class="ad-x">VS</span><span class="ad-name"></span>' +
    '<span class="ad-flag" style="background-image:url(' + flagUrl(P.right) + ')"></span></div>' +
    '<div class="ad-hook"></div><div class="ad-timer"></div></div>' +
    '<div class="ad-win"><span class="ad-flag"></span><div class="ad-win-name"></div><div class="ad-win-sub"></div></div>';
  wrap.appendChild(layer);
  var names = layer.querySelectorAll(".ad-name");
  names[0].textContent = nameOf(P.left, P.leftName); names[1].textContent = nameOf(P.right, P.rightName);
  top = layer.querySelector(".ad-top"); hook = layer.querySelector(".ad-hook"); hook.textContent = P.hook;
  timer = layer.querySelector(".ad-timer"); win = layer.querySelector(".ad-win"); dim = layer.querySelector(".ad-dim");
}
function ease(x){ x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
function paintLayer(){
  hook.style.opacity = String(1 - ease((t - 3.2) / 0.5));
  timer.textContent = (deathT >= 0 ? deathT : t).toFixed(1) + "s";
  if(deathT >= 0){
    var k = t - deathT;
    var a = ease((k - 0.45) / 0.35), s = 0.82 + 0.18 * ease((k - 0.45) / 0.3) + 0.05 * Math.sin(Math.min(1, Math.max(0,(k-0.45)/0.5)) * Math.PI);
    dim.style.opacity = String(ease((k - 0.3) / 0.4));
    win.style.opacity = String(a);
    win.style.transform = "scale(" + s.toFixed(3) + ")";
  }
}
function crown(){
  var w = 1 - loser;
  var code = w === 0 ? P.left : P.right, lcode = loser === 0 ? P.left : P.right;
  win.querySelector(".ad-flag").style.backgroundImage = "url(" + flagUrl(code) + ")";
  win.querySelector(".ad-win-name").textContent = nameOf(code, w === 0 ? P.leftName : P.rightName) + " wins";
  win.querySelector(".ad-win-sub").textContent = nameOf(lcode, loser === 0 ? P.leftName : P.rightName) + " hit the wall";
}

function rasterFlag(code){
  return new Promise(function(resolve){
    var img = new Image();
    img.onload = function(){
      var c = document.createElement("canvas"); c.width = c.height = 256;
      c.getContext("2d").drawImage(img, 0, 0, 256, 256);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = function(){ resolve(null); };
    img.src = flagUrl(code);
  });
}

function step(){
  var dt = 1 / P.fps;
  if(P.zen && started){
    // Calm pacing: difficulty drifts between ~0.12 and ~0.34 over 5-minute swells.
    var dT = 0.23 + 0.11 * Math.sin(t * 2 * Math.PI / 300);
    game.diffAdj = dT - game.dist / 2600;
    if(t >= zenNextPump){ zenPumpUntil = t + 6; zenNextPump = t + 45 + rng() * 50; }
    if(game.boost > 0) zenPumpUntil = -1;
  }
  if(started && game.phase === PHASE_RUN && game.dying === 0){
    [0,1].forEach(function(s){ var g = moveThumb(s, sideTarget(s, dt), dt); cursors[s].tx = g.tx; cursors[s].ty = g.ty; cursors[s].active = true; });
  }
  window.__adStepFrame(1000 / P.fps);
  if(started && game.phase === PHASE_RUN && game.dying === 0){
    // Stats for the sim: how busy the round was and how smooth the orbs moved.
    game.obstacles.forEach(function(o){ if(o.passed && o.minGraze < 7 && !seenGraze.has(o)){ seenGraze.add(o); stat.grazes++; } });
    if(game.wreck > wreckSeen) stat.smashes += game.wreck - wreckSeen;
    wreckSeen = game.wreck;
    stat.frames++;
    [0,1].forEach(function(s){
      var v = cursors[s].vx || 0, pv = stat.vx[s][0];
      stat.jerk[s] += Math.abs(v - pv);
      if(Math.abs(v) > 40 && Math.abs(pv) > 40 && (v < 0) !== (pv < 0)) stat.flips[s]++;
      stat.vx[s][0] = v;
    });
  } else wreckSeen = game.wreck;
  if(started){
    t += dt;
    if(P.zen){
      // Event log for the soundtrack: what happened, and when.
      if(game.coins > lastCoins) events.push({ t: +t.toFixed(3), type: "coin", n: game.coins - lastCoins });
      lastCoins = game.coins;
      if(game.boost > 0 && lastBoost === 0) events.push({ t: +t.toFixed(3), type: "boost" });
      lastBoost = game.boost;
      if(game.wreck > lastWreck) events.push({ t: +t.toFixed(3), type: "smash" });
      lastWreck = game.wreck;
      game.obstacles.forEach(function(o){ if(o.passed && !seenPass.has(o)){ seenPass.add(o); events.push({ t: +t.toFixed(3), type: "pass", side: o.side }); } });
      if(restartAt < 0 && (game.dying > 0 || game.phase === PHASE_DEAD)){ crashes++; events.push({ t: +t.toFixed(3), type: "crash" }); restartAt = t + 1.6; }
      if(restartAt >= 0 && t >= restartAt && game.phase === PHASE_DEAD){ restartAt = -1; lastCoins = 0; lastWreck = 0; thumb = [null, null]; chase = [null, null]; pumpAmp = [0, 0]; startRun(); }
    } else if(deathT < 0 && (game.dying > 0 || game.phase === PHASE_DEAD)){ deathT = t; loser = loserSide(); crown(); }
  }
  paintLayer();
}

window.AD = {
  params: P, failAt: failAt, _g: { game: game, cursors: cursors, view: view },
  ready: false,
  step: function(n){ for(var i=0;i<(n||1);i++) step(); return window.AD.status(); },
  status: function(){ return { t: +t.toFixed(3), deathT: deathT, loser: loser, phase: game.phase, dist: Math.floor(game.dist), crashes: crashes, done: P.zen ? t >= P.len : (deathT >= 0 && t - deathT >= 1.9 || t >= P.maxLen) }; },
  stats: function(){ var f = Math.max(1, stat.frames), secs = f / P.fps; return { coins: game.coins, grazes: stat.grazes, smashes: stat.smashes, jerk: +((stat.jerk[0] + stat.jerk[1]) / 2 / f).toFixed(1), flipsPerSec: +((stat.flips[0] + stat.flips[1]) / 2 / secs).toFixed(2) }; },
  events: function(){ return events; }
};

(async function(){
  var countries = await fetch("/node_modules/flag-icons/country.json").then(function(r){ return r.json(); }).catch(function(){ return []; });
  countries.forEach(function(c){ NAMES[c.code] = c.name.replace(/ \(.*\)$/, ""); });
  NAMES.us = "USA"; NAMES.gb = "UK"; NAMES["gb-eng"] = "England"; NAMES.kr = "South Korea"; NAMES.kp = "North Korea";
  // Wait for the game to boot (it queues its first frame when ready).
  while(!(view.canvas && window.__adQueued() > 0)) await new Promise(function(r){ setTimeout(r, 20); });
  if(!P.clean){
    var imgs = await Promise.all([rasterFlag(P.left), rasterFlag(P.right)]);
    [0,1].forEach(function(s){ if(imgs[s]){ state.slots[s].mode = "image"; state.slots[s].image = imgs[s]; } });
    clearImageCache(); clearHaloCache();
  }
  buildLayer();
  if(P.clean) layer.style.display = "none";
  if(P.zen) document.documentElement.classList.add("zen");
  if(P.style === "hype") state.follow = 34;   // a little snappier than the default 26: the in-game Follow slider
  // Two frames on the title so the orbs settle, then both thumbs down.
  window.__adStepFrame(1000 / P.fps); window.__adStepFrame(1000 / P.fps);
  var H = view.H;
  [0,1].forEach(function(s){ var b = laneBounds(s), c = cursors[s]; c.active = true; c.tx = c.x = (b.x0 + b.x1)/2; c.ty = c.y = H * 0.73; c.offset = 0; });
  startRun();
  started = true;
  paintLayer();
  window.AD.ready = true;
})();
