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
  clean: q.get("clean") === "1"   // no flags, no banners: the game as players see it
};
var rng = window.__adBotRng;
function gamma2(mean){ return -(mean/2) * Math.log((1 - rng()) * (1 - rng())); } // Erlang k=2

var failAt = [0, 1].map(function(){
  if(rng() < P.early) return 0.8 + rng() * (P.safe - 0.8);
  return P.safe + 0.8 + gamma2(P.mean);
});

var t = 0, started = false, deathT = -1, loser = -1, smashPick = new WeakMap(), failDir = new WeakMap();
var pumpPh = [rng() * 6.28, rng() * 6.28], wob = [rng() * 6.28, rng() * 6.28];

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
  var tx = laneC, lit = game.boost > 0;
  if(next){
    var room = Math.max(0, next.gapW/2 - HIT_R - 8);
    tx = next.gapC + Math.sin(t * 2.1 + wob[s]) * room * 0.45;
    // While lit, most slate gets smashed on purpose: that's the show.
    if(lit && !next.hard){
      if(!smashPick.has(next)) smashPick.set(next, { go: rng() < 0.7, r: Math.floor(rng() * 8) });
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
  var ty = baseY;
  var closeBy = next && (c.y - (next.y + next.h)) < 150 && Math.abs(c.x - tx) > 10;
  if(!lit && !closeBy && !inBand && !failing){ pumpPh[s] += dt * 6.28 * 2.9; ty = baseY + Math.sin(pumpPh[s]) * PUMP; }
  else if(inBand){ ty = baseY; }
  return { tx: Math.max(b.x0 + DRAW_R, Math.min(b.x1 - DRAW_R, tx)), ty: ty };
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
  if(started && game.phase === PHASE_RUN && game.dying === 0){
    [0,1].forEach(function(s){ var g = sideTarget(s, dt); cursors[s].tx = g.tx; cursors[s].ty = g.ty; cursors[s].active = true; });
  }
  window.__adStepFrame(1000 / P.fps);
  if(started){
    t += dt;
    if(deathT < 0 && (game.dying > 0 || game.phase === PHASE_DEAD)){ deathT = t; loser = loserSide(); crown(); }
  }
  paintLayer();
}

window.AD = {
  params: P, failAt: failAt, _g: { game: game, cursors: cursors, view: view },
  ready: false,
  step: function(n){ for(var i=0;i<(n||1);i++) step(); return window.AD.status(); },
  status: function(){ return { t: +t.toFixed(3), deathT: deathT, loser: loser, phase: game.phase, dist: Math.floor(game.dist), done: deathT >= 0 && t - deathT >= 1.9 || t >= P.maxLen }; }
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
  // Two frames on the title so the orbs settle, then both thumbs down.
  window.__adStepFrame(1000 / P.fps); window.__adStepFrame(1000 / P.fps);
  var H = view.H;
  [0,1].forEach(function(s){ var b = laneBounds(s), c = cursors[s]; c.active = true; c.tx = c.x = (b.x0 + b.x1)/2; c.ty = c.y = H * 0.73; c.offset = 0; });
  startRun();
  started = true;
  paintLayer();
  window.AD.ready = true;
})();
