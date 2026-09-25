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
import { startBeds } from '../src/audio.js';

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
  len: +(q.get("len") || 600),
  // Ads start mid-run instead of at the slow opening seconds (0 = the real opening).
  heat: +(q.get("heat") || (q.get("zen") === "1" ? 0 : 0.36)),
  heatRise: +(q.get("heatRise") || 0.02)
};
var rng = window.__adBotRng;
function gamma2(mean){ return -(mean/2) * Math.log((1 - rng()) * (1 - rng())); } // Erlang k=2

var failAt = P.zen ? [Infinity, Infinity] : [0, 1].map(function(){
  if(rng() < P.early) return 0.8 + rng() * (P.safe - 0.8);
  return P.safe + 0.8 + gamma2(P.mean);
});

var zenPumpUntil = -1, zenNextPump = 25 + rng() * 30, restartAt = -1, events = [], seenPass = new WeakSet(), lastCoins = 0, lastWreck = 0, lastBoost = 0, crashes = 0;
var t = 0, started = false, deathT = -1, loser = -1, smashPick = new WeakMap(), failDir = new WeakMap(), grazePick = new WeakMap();
var pumpPh = [rng() * 6.28, rng() * 6.28], readyClock = 0;

// How each style plays. Hype (the ads) plays like a good player showing off:
// quick short pump strokes nearly all the time, boosts chained by pumping
// through them, decisive flicks between resting spots instead of a sway,
// every coin it can get to and back from, walls skimmed for GRAZE, slate
// smashed. Calm (long-form) is the same brain at half the energy.
var HYPE = P.style === "hype";
var S = HYPE ? {
  // Stroke reach (px) and tempo (Hz). The game counts a stroke only if the
  // turn-to-turn travel it samples is >= 34 px (STROKE_MIN); at 30 fps a
  // 4 Hz sine loses up to a third of that to sampling, hence 40.
  pump: 40, hzLo: 3.4, hzHi: 4.6,
  w: 30, z: 0.78, wUrgent: 40, vmax: 3400,   // flick spring (rad/s), damping, top speed (px/s)
  hold: [0.28, 0.75], spread: 0.8,           // rest in the gap this long between flicks, this far off centre
  margin: 0.1, marginEarly: 0.2,             // seconds spare after a coin to get back into the gap
  graze: 0.4, smash: 0.85, chain: 0.4, fadeIn: 0.18
} : {
  pump: 46, hzLo: 2.4, hzHi: 3.4,
  w: 10, z: 0.9, wUrgent: 26, vmax: 1500,
  hold: [0.8, 1.8], spread: 0.45,
  margin: 0.4, marginEarly: 0.4,
  graze: 0, smash: 0.7, chain: 0, fadeIn: 0.25
};
// Seconds to move the thumb dx px and settle (fit to the spring above).
function moveTime(dx){ return HYPE ? 0.07 + dx / 2600 : 0.15 + dx / 1200; }
var thumb = [null, null], pumpAmp = [0, 0], pumpHz = [(S.hzLo + S.hzHi) / 2, (S.hzLo + S.hzHi) / 2], strokeAmp = [1, 1];
var pc0 = [0, 0], chase = [null, null], rest = [0, 0], restUntil = [0, 0], restFor = [null, null], chainGo = false, wasLit = false;
var stat = { grazes: 0, smashes: 0, boosts: 0, speed: 0, lit: 0, missed: 0, jerk: [0, 0], flips: [0, 0], frames: 0, vx: [[0, 0], [0, 0]] }, seenGraze = new WeakSet(), wreckSeen = 0, seenMiss = new WeakSet();

function sideTarget(s){
  var H = view.H, c = cursors[s], b = laneBounds(s);
  var T = thumb[s] || (thumb[s] = { x: c.x, v: 0 });
  var baseY = H * 0.73, laneC = (b.x0 + b.x1) / 2;
  var failing = t >= failAt[s], early = t < P.safe, lit = game.boost > 0;
  var speed = Math.max(60, game.speed);
  // The orb's vertical reach right now (current pump), and at a full pump.
  var amp = S.pump * strokeAmp[s] * pumpAmp[s];
  var lowNow = Math.max(c.y, baseY + pc0[s] + amp) + HIT_R + 4, highNow = Math.min(c.y, baseY + pc0[s] - amp) - HIT_R - 4;
  function room(o){ return Math.max(0, o.gapW / 2 - HIT_R - 3); }
  // Slate the orb will hit while the tank is still lit, with margin: a boost
  // that runs out on the way turns a smash into a crash.
  function smashable(o){
    if(!lit || o.hard) return false;
    var eta = Math.max(0, (c.y - HIT_R - (o.y + o.h)) / speed);
    return game.charge - BOOST_DRAIN * eta > (early ? 0.35 : 0.2);
  }
  var walls = game.obstacles.filter(function(o){ return o.side === s; });
  // The next barrier to get through: the lowest one not yet passed.
  var up = null;
  walls.forEach(function(o){ if(!o.passed && (!up || o.y > up.y)) up = o; });

  var goal = laneC, urgent = false, tU = Infinity;
  if(up){
    tU = (highNow - (up.y + up.h)) / speed;
    var r = room(up);
    // Rest spot: a new one on every barrier and every so often in between,
    // reached by a flick. Holding still, then moving with intent, is what
    // reads as a hand.
    if(restFor[s] !== up || t >= restUntil[s]){
      restFor[s] = up; rest[s] = (rng() * 2 - 1) * S.spread;
      restUntil[s] = t + S.hold[0] + rng() * (S.hold[1] - S.hold[0]);
    }
    goal = up.gapC + rest[s] * r;
    // GRAZE: on some barriers, skim one wall (< 7 px clearance).
    if(S.graze && !failing){
      if(!grazePick.has(up)) grazePick.set(up, { go: rng() < S.graze, dir: rng() < 0.5 ? -1 : 1, g: 2.5 + rng() * 3 });
      var gp = grazePick.get(up);
      var hasWall = up.rects.some(function(q){ return gp.dir < 0 ? q.x < up.gapC : q.x > up.gapC; });
      if(gp.go && hasWall) goal = up.gapC + gp.dir * (up.gapW / 2 - HIT_R - (early ? 6 : gp.g));
    }
    // A coin just beyond the barrier and inside its gap: line up with it.
    for(var pq=0;pq<game.pickups.length;pq++){
      var pc = game.pickups[pq];
      if(pc.y < up.y && pc.y > up.y - 170 && Math.abs(pc.x - up.gapC) < r){ goal = pc.x; break; }
    }
    // Slate while lit: smash it (most of the time).
    if(lit && !up.hard && !failing){
      if(!smashPick.has(up)) smashPick.set(up, { go: rng() < S.smash, r: Math.floor(rng() * 8) });
      var pick = smashPick.get(up);
      if(pick.go && up.rects.length && smashable(up)){ var rc = up.rects[pick.r % up.rects.length]; goal = rc.x + rc.w / 2; }
    }
    urgent = tU < 0.45;
  }
  // Coins come first: any coin in this lane the thumb can reach in time and
  // still get back into the gap from. Once picked, stay on it until it's
  // taken or out of reach.
  function coinOk(pk, keep){
    if(pk.taken || pk.x < b.x0 || pk.x > b.x1 || pk.y > c.y - 2) return false;
    if(up && pk.y < up.y + up.h + 6) return false;
    var tc = (c.y - pk.y) / speed;
    if(moveTime(Math.abs(pk.x - T.x)) > tc + (keep ? 0.06 : 0.02)) return false;
    if(!up) return true;
    var back = moveTime(Math.max(0, Math.abs(pk.x - up.gapC) - room(up) * 0.5));
    var m = (early ? S.marginEarly : S.margin) - (pk.tier ? 0.04 : 0) - (keep ? 0.03 : 0);
    return tc + back + m < tU;
  }
  if(!failing){
    var grab = null;
    if(chase[s] && game.pickups.indexOf(chase[s]) >= 0 && coinOk(chase[s], true)) grab = chase[s];
    else {
      for(var pj=0;pj<game.pickups.length;pj++){
        var pk = game.pickups[pj];
        if(!coinOk(pk, false)) continue;
        if(!grab || (pk.tier && !grab.tier) || (!!pk.tier === !!grab.tier && pk.y > grab.y)) grab = pk;
      }
      chase[s] = grab;
    }
    if(grab) goal = grab.x;
  }
  // The slip: clip the wall just past the gap edge, a near miss that doesn't make it.
  if(failing && up && !smashable(up)){
    if(!failDir.has(up)){
      var hasL = up.rects.some(function(q){ return q.x < up.gapC; }), hasR = up.rects.some(function(q){ return q.x > up.gapC; });
      failDir.set(up, hasL && hasR ? (rng() < 0.5 ? -1 : 1) : (hasL ? -1 : 1));
    }
    goal = up.gapC + failDir.get(up) * (up.gapW / 2 + HIT_R * 0.6);
  }
  // Hard rule: while a wall is within the orb's current vertical reach, the
  // goal stays inside its gap (unless it's slate to smash, or this is the slip).
  walls.forEach(function(o){
    if(failing || smashable(o) || o.y > lowNow || o.y + o.h < highNow) return;
    goal = Math.max(o.gapC - room(o), Math.min(o.gapC + room(o), goal));
    urgent = true;
  });

  // Pump: nearly always in hype, and through a boost to chain it. A wall
  // whose gap the orb (or where it's headed) is outside of blocks the side
  // it's on: then pump in the free half only (above or below the rest
  // line), and stop only when both sides are blocked.
  var want = !failing && (!P.zen || t < zenPumpUntil) && (!lit || chainGo);
  var A = S.pump, look = speed * 0.12;
  function conflict(o){
    if(smashable(o)) return false;
    var e = o.gapW / 2 - HIT_R - 4;
    return Math.abs(c.x - o.gapC) > e || Math.abs(T.x - o.gapC) > e || Math.abs(goal - o.gapC) > e;
  }
  function blocked(y0, y1){ return walls.some(function(o){ return o.y <= y1 && o.y + o.h >= y0 && conflict(o); }); }
  var aboveA = blocked(baseY - A - HIT_R - 8 - look, baseY - HIT_R), belowA = blocked(baseY + HIT_R, baseY + A + HIT_R + 8);
  var above2 = blocked(baseY - 2 * A - HIT_R - 8 - look, baseY - HIT_R), below2 = blocked(baseY + HIT_R, baseY + 2 * A + HIT_R + 8);
  var c0 = 0;
  if(want){
    if(!aboveA && !belowA) c0 = 0;
    else if(belowA && !above2) c0 = -A;
    else if(aboveA && !below2) c0 = A;
    else want = false;
  }
  // Nowhere to pump and a conflicting wall already inside the orb's span: drop it now.
  var span = S.pump * strokeAmp[s] * pumpAmp[s];
  var hold = !want && blocked(baseY + pc0[s] - span - HIT_R - 4, baseY + pc0[s] + span + HIT_R + 4);
  return { tx: Math.max(b.x0 + DRAW_R, Math.min(b.x1 - DRAW_R, goal)), pump: want, c0: c0, hold: hold, urgent: urgent, baseY: baseY };
}

// Turn a goal into a thumb position: a damped spring (a touch of overshoot
// on a relaxed flick, dead stiff when a wall is close), and a pump with a
// loose tempo and a different reach on every stroke that fades in and out.
function moveThumb(s, g, dt){
  var T = thumb[s];
  var w = g.urgent ? S.wUrgent : S.w, z = g.urgent ? 1 : S.z;
  for(var i=0;i<4;i++){
    var h = dt / 4;
    T.v += (w * w * (g.tx - T.x) - 2 * z * w * T.v) * h;
    T.v = Math.max(-S.vmax, Math.min(S.vmax, T.v));
    T.x += T.v * h;
  }
  if(g.hold) pumpAmp[s] = 0;
  else pumpAmp[s] += ((g.pump ? 1 : 0) - pumpAmp[s]) * Math.min(1, dt / (g.pump ? S.fadeIn : 0.06));
  if(pumpAmp[s] > 0.01){
    var prev = Math.sin(pumpPh[s]);
    pumpPh[s] += dt * 6.28 * pumpHz[s];
    // New tempo and reach every half stroke, where sin crosses 0 so the change is seamless.
    if((prev < 0) !== (Math.sin(pumpPh[s]) < 0)){
      pumpHz[s] = Math.max(S.hzLo, Math.min(S.hzHi, pumpHz[s] + (rng() - 0.5) * 0.8));
      strokeAmp[s] = 0.75 + rng() * 0.25;
    }
  }
  pc0[s] += ((g.pump ? g.c0 : 0) - pc0[s]) * Math.min(1, dt / 0.06);
  var b = laneBounds(s);
  return { tx: Math.max(b.x0 + DRAW_R, Math.min(b.x1 - DRAW_R, T.x)), ty: g.baseY + pc0[s] + Math.sin(pumpPh[s]) * S.pump * strokeAmp[s] * pumpAmp[s] };
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
  if(!P.zen && started && P.heat > 0){
    // Ads open mid-run: difficulty starts at `heat` and climbs `heatRise`
    // per second (the in-game curve reaches 0.36 at about 940 distance).
    game.diffAdj = Math.min(0.8, P.heat + P.heatRise * t) - game.dist / 2600;
  }
  if(P.zen && started){
    // Calm pacing: difficulty drifts between ~0.12 and ~0.34 over 5-minute swells.
    var dT = 0.23 + 0.11 * Math.sin(t * 2 * Math.PI / 300);
    game.diffAdj = dT - game.dist / 2600;
    if(t >= zenNextPump){ zenPumpUntil = t + 6; zenNextPump = t + 45 + rng() * 50; }
    if(game.boost > 0) zenPumpUntil = -1;
  }
  if(started && game.phase === PHASE_RUN && game.dying === 0){
    var lit = game.boost > 0;
    if(lit && !wasLit){ chainGo = rng() < S.chain; stat.boosts++; }
    wasLit = lit;
    [0,1].forEach(function(s){ var g = moveThumb(s, sideTarget(s), dt); cursors[s].tx = g.tx; cursors[s].ty = g.ty; cursors[s].active = true; });
  }
  window.__adStepFrame(1000 / P.fps);
  if(started && game.phase === PHASE_RUN && game.dying === 0){
    // Stats for the sim: how busy the round was and how smooth the orbs moved.
    game.obstacles.forEach(function(o){ if(o.passed && o.minGraze < 7 && !seenGraze.has(o)){ seenGraze.add(o); stat.grazes++; } });
    if(game.wreck > wreckSeen) stat.smashes += game.wreck - wreckSeen;
    wreckSeen = game.wreck;
    stat.frames++; stat.speed += game.speed; if(game.boost > 0) stat.lit++;
    game.pickups.forEach(function(p){ if(p.y > cursors[0].y + 40 && !seenMiss.has(p)){ seenMiss.add(p); stat.missed++; } });
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
      if(restartAt >= 0 && t >= restartAt && game.phase === PHASE_DEAD){ restartAt = -1; lastCoins = 0; lastWreck = 0; thumb = [null, null]; chase = [null, null]; pumpAmp = [0, 0]; pc0 = [0, 0]; restFor = [null, null]; startRun(); }
    } else if(deathT < 0 && (game.dying > 0 || game.phase === PHASE_DEAD)){ deathT = t; loser = loserSide(); crown(); }
  }
  paintLayer();
}

window.AD = {
  params: P, failAt: failAt, _g: { game: game, cursors: cursors, view: view },
  ready: false,
  step: function(n){ for(var i=0;i<(n||1);i++) step(); return window.AD.status(); },
  status: function(){ return { t: +t.toFixed(3), deathT: deathT, loser: loser, phase: game.phase, dist: Math.floor(game.dist), crashes: crashes, done: P.zen ? t >= P.len : (deathT >= 0 && t - deathT >= 1.9 || t >= P.maxLen) }; },
  stats: function(){ var f = Math.max(1, stat.frames), secs = f / P.fps; return { coins: game.coins, coinsPerSec: +(game.coins / secs).toFixed(2), boosts: stat.boosts, litFrac: +(stat.lit / f).toFixed(2), missed: stat.missed, speed: Math.round(stat.speed / f), grazes: stat.grazes, smashes: stat.smashes, jerk: +((stat.jerk[0] + stat.jerk[1]) / 2 / f).toFixed(1), flipsPerSec: +((stat.flips[0] + stat.flips[1]) / 2 / secs).toFixed(2) }; },
  events: function(){ return events; },
  // The round's game audio as WAV (base64), aligned to the first video frame.
  audio: function(seconds){ return window.__adAudio ? window.__adAudio(readyClock, readyClock + seconds * 1000) : null; }
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
  if(HYPE) state.follow = 40;   // snappier than the default 26: the in-game Follow slider
  // Two frames on the title so the orbs settle, then both thumbs down.
  window.__adStepFrame(1000 / P.fps); window.__adStepFrame(1000 / P.fps);
  var H = view.H;
  [0,1].forEach(function(s){ var b = laneBounds(s), c = cursors[s]; c.active = true; c.tx = c.x = (b.x0 + b.x1)/2; c.ty = c.y = H * 0.73; c.offset = 0; });
  // Sound on (not zen): start the beds the way a first touch would. The
  // clock of the offline context is the stepped clock (prelude.js).
  if(state.soundOn) startBeds();
  readyClock = window.__adClock;
  startRun();
  started = true;
  paintLayer();
  window.AD.ready = true;
})();
