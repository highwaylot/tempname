// Simulation and run lifecycle. W/H come from render.view and are read into
// locals at the top of each function that uses them.
import { state, saveState, reduceMotion } from './state.js';
import { world } from './world.js';
import { startBeds, driveAudio, blip, thump, crashSound, arp } from './audio.js';
import { view } from './render.js';
import { overlayReady, overlayDead, comboBadge, comboNum, comboMult, gauge, resetComboStat, showDeath, syncOneHand } from './ui.js';
import { sidePointer } from './input.js';
import { haptic } from './native.js';

// ===================== game state =====================
export var PHASE_READY = 0, PHASE_RUN = 1, PHASE_DEAD = 2;
export var game = {
  phase: PHASE_READY,
  dist: 0,
  coins: 0,
  speed: 0,
  obstacles: [],
  pickups: [],
  sparks: [],
  spawnTimer: 0,
  shake: 0,
  deadAt: 0,
  combo: 0,
  bestCombo: 0,
  texts: [],
  rings: [],
  charge: 0,
  boost: 0,
  boostMult: 1,
  recentClean: [],
  diffAdj: 0,
  runTime: 0,
  hinted: false,
  wreck: 0,
  wreckTarget: 5,
  debris: [],
  flash: 0,
  flashColor: "255,190,140",
  dying: 0,
  rampT: 0,
  grace: 0,
  paused: false,
  litTime: 0,
  slowmo: 0,
  // Loop-owned values that were closure vars: grid scroll phase, the
  // parallel-play flag and the mirror ghost strength.
  scrollOffset: 0,
  parallelOn: false,
  mirrorHint: 0
};

// Pump: rhythmic vertical strokes build charge, full charge fires a boost.
// Strokes are read off the thumb's target, not the eased avatar, so it
// tracks what the hand is actually doing.
export var STROKE_MIN = 34;
export var STROKE_WINDOW = 0.5;
export var STROKE_CHARGE = 0.085;
export var CHARGE_DECAY = 0.32;
export var BOOST_DRAIN = 0.4;
export var BOOST_SPEED = 1.85;
export var MAGNET_R = 120;
// One thumb registers half the strokes and never earns the 1.8x bilateral
// bonus; 3.0 lands ignition ~1.6 s at a casual 2.9 strokes/s (two-thumb
// 1.4 s); 3.6 = exact two-thumb parity, 1.8 = the bilateral bonus alone.
// First guess pending play reports.
export var ONE_HAND_PUMP = 3.0;

// On touch the thumb covers the avatar, so it rides above the contact point.
export var TOUCH_OFFSET = 62;
function makeCursor(){
  return { x:0, y:0, tx:0, ty:0, rawX:0, rawY:0, offset:0, active:false, trail:[],
           prevTy:0, strokeDir:0, strokeStart:0, lastStrokeAt:-9,
           px:0, py:0, vx:0, vy:0, dy:0 };
}
export var cursors = [ makeCursor(), makeCursor() ];
export function lanes(){ return state.oneHand ? 1 : 2; }
export function laneList(){ return state.oneHand ? [0] : [0,1]; }
export function laneBounds(side){
  var W = view.W;
  if(state.oneHand) return { x0:0, x1:W };
  return side === 0 ? { x0:0, x1:W/2 } : { x0:W/2, x1:W };
}
export function resetCursors(){
  var H = view.H;
  [0,1].forEach(function(side){
    var b = laneBounds(side);
    var c = cursors[side];
    c.x = c.tx = (b.x0 + b.x1)/2;
    c.y = c.ty = H * 0.75;
    c.px = c.x; c.py = c.y; c.vx = 0; c.vy = 0;
    c.trail.length = 0;
  });
}

export var HIT_R = 12;
export var DRAW_R = 17;

export function startRun(){
  game.phase = PHASE_RUN;
  game.dist = 0;
  game.coins = 0;
  game.speed = 200;
  game.obstacles.length = 0;
  game.pickups.length = 0;
  game.sparks.length = 0;
  game.spawnTimer = 0.5;
  game.shake = 0;
  game.combo = 0;
  game.texts.length = 0;
  game.rings.length = 0;
  game.charge = 0;
  game.boost = 0;
  game.boostMult = 1;
  game.recentClean.length = 0;
  game.diffAdj = 0;
  game.runTime = 0;
  game.hinted = false;
  game.wreck = 0;
  game.debris.length = 0;
  game.flash = 0;
  game.dying = 0;
  game.rampT = 0;
  game.grace = 0;
  game.litTime = 0;
  game.slowmo = 0;
  cursors.forEach(function(c){ c.strokeDir = 0; c.lastStrokeAt = -9; c.prevTy = c.ty; c.strokeStart = c.ty; c.trail.length = 0; });
  resetComboStat();
  overlayReady.classList.add("gone");
  overlayDead.classList.add("gone");
  startBeds();
}
// The hit itself: burst, sound, shake, and half a second of slow motion so
// the crash reads before the screen changes. finishDeath() does the rest.
export function die(x, y, reason){
  if(game.phase !== PHASE_RUN || game.dying > 0) return;
  game.dying = 0.55;
  game.boost = 0; game.wreck = 0;
  game.shake = 1;
  game.flash = 0.6; game.flashColor = "255,111,111";
  game.combo = 0;
  resetComboStat();
  world.perturb(x, y, 1.6, 2.2);
  for(var i=0;i<26;i++){
    var a = Math.random()*Math.PI*2, sp = 60 + Math.random()*260;
    game.sparks.push({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1.3, color:"#ff6f6f" });
  }
  if(reason === "steel"){
    game.texts.push({ x:x, y:y - 34, text:"STEEL", life:1.6, color:"#ff6f6f", size:16 });
    while(game.texts.length > 5) game.texts.shift();
  }
  if(state.soundOn) crashSound();
  haptic("die");
}
export function finishDeath(){
  game.phase = PHASE_DEAD;
  game.deadAt = world.time;
  var score = Math.floor(game.dist);
  if(score > state.best){ state.best = score; }
  saveState();
  showDeath(score);
}

// Barrier rects break into chunks with real velocity away from the impact,
// gravity, spin, and fade. The visceral half of smashing.
function spawnDebris(o, ix, iy, n){
  o.rects.forEach(function(rc){
    for(var i=0;i<n;i++){
      var w = 8 + Math.random()*Math.min(28, rc.w);
      var h = 6 + Math.random()*Math.min(14, o.h);
      var x = rc.x + Math.random()*Math.max(1, rc.w - w);
      var y = o.y + Math.random()*Math.max(1, o.h - h);
      var dx = (x + w/2) - ix, dy = (y + h/2) - iy;
      var d = Math.hypot(dx, dy) || 1;
      var sp = 120 + Math.random()*260;
      game.debris.push({
        x:x, y:y, w:w, h:h,
        vx: dx/d*sp + (Math.random()-0.5)*80, vy: dy/d*sp - 120,
        rot:(Math.random()-0.5)*0.6, vr:(Math.random()-0.5)*9, life:1
      });
    }
  });
  while(game.debris.length > 60) game.debris.shift();
}

// Wrecking is its own loop, not a worse version of threading: a chain that
// escalates within one boost, CRUNCH as the variable-magnitude hit, a
// refund per smash so wrecking sustains wrecking, and a storm as payoff.
function shatter(o, c){
  var idx = game.obstacles.indexOf(o);
  if(idx >= 0) game.obstacles.splice(idx, 1);
  game.wreck += 1;
  game.combo += 1;
  if(game.combo > game.bestCombo) game.bestCombo = game.combo;
  var crunch = Math.random() < 0.12;
  var power = Math.min(1, game.wreck/6);
  var pts = Math.round(6 * (1 + game.wreck*0.25) * (crunch ? 3 : 1));
  game.dist += pts;
  game.charge = Math.min(1, game.charge + 0.08);
  world.perturb(c.x, c.y, 1.0 + power*0.8, 1.4);
  game.shake = Math.max(game.shake, 0.4 + power*0.5);
  spawnDebris(o, c.x, c.y, 5 + Math.round(power*5) + (crunch ? 4 : 0));
  game.texts.push({
    x:c.x, y:c.y - 30,
    text:(crunch ? "CRUNCH" : "SMASH") + (game.wreck > 1 ? " ×" + game.wreck : "") + " +" + pts,
    life: crunch ? 1.4 : 1,
    color: crunch ? "#f2c14e" : "#ff9b6a",
    size: (crunch ? 14 : 12) + Math.min(6, game.wreck)
  });
  while(game.texts.length > 5) game.texts.shift();
  if(state.soundOn){
    thump(170 - power*50, 0.22 + power*0.1, 0.45 + power*0.2);
    blip(140, 0.18, "square", 0.16);
    if(crunch){ blip(880, 0.1, "triangle", 0.12); blip(1320, 0.18, "triangle", 0.1); }
  }
  if(crunch) haptic("crunch"); else haptic("smash", power);
  comboNum.textContent = game.combo;
  comboMult.textContent = "×" + (1 + Math.floor(game.combo/5));
  comboBadge.classList.remove("pop"); void comboBadge.offsetWidth; comboBadge.classList.add("pop");
  if(game.wreck >= game.wreckTarget) wreckStorm();
}

function wreckStorm(){
  var W = view.W, H = view.H;
  game.wreck = 0;
  game.wreckTarget = 4 + Math.floor(Math.random()*3);
  var bonus = 40;
  game.dist += bonus;
  game.charge = Math.min(1, game.charge + 0.25);
  game.shake = 1;
  game.flash = 1; game.flashColor = "255,190,140";
  world.perturb(W/2, H/2, 2.0, 2.4);
  for(var i=game.obstacles.length-1;i>=0;i--){
    var o = game.obstacles[i];
    if(o.hard) continue;
    spawnDebris(o, o.gapC, o.y + o.h/2, 4);
    game.obstacles.splice(i,1);
  }
  game.texts.push({ x:W/2, y:H*0.45, text:"WRECKED +" + bonus, life:1.6, color:"#ff9b6a", size:26 });
  while(game.texts.length > 5) game.texts.shift();
  if(state.soundOn){
    thump(110, 0.4, 0.6);
    thump(160, 0.3, 0.4);
    blip(440, 0.3, "sawtooth", 0.14);
    blip(660, 0.45, "triangle", 0.12);
  }
  haptic("storm");
}


// The rare coin. The value is the smaller half of it; the moment is the point.
function collectSpecial(p, gain){
  var purple = p.tier === 2;
  var hex = purple ? "#b04bff" : "#3d7bff";
  world.perturb(p.x, p.y, purple ? 1.6 : 1.1, 1.6);
  game.shake = Math.max(game.shake, purple ? 0.7 : 0.35);
  game.flash = purple ? 0.9 : 0.5;
  game.flashColor = purple ? "176,75,255" : "61,123,255";
  if(purple) game.slowmo = 0.35;
  game.rings.push({ x:p.x, y:p.y, r:p.r, max: purple ? 90 : 60, life:1, special:hex });
  if(purple) game.rings.push({ x:p.x, y:p.y, r:p.r, max:130, life:1.2, special:"#eef0f4" });
  var n = purple ? 30 : 18;
  for(var k=0;k<n;k++){
    var a = Math.random()*Math.PI*2, sp = 80 + Math.random()*(purple ? 300 : 200);
    game.sparks.push({ x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1.2,
                       color: (purple && k % 3 === 0) ? "#eef0f4" : hex });
  }
  game.texts.push({ x:p.x, y:p.y - 34, text:(purple ? "PURPLE +" : "BLUE +") + gain,
                    life: purple ? 1.9 : 1.5, color:hex, size: purple ? 22 : 16 });
  while(game.texts.length > 5) game.texts.shift();
  if(state.soundOn){
    thump(purple ? 160 : 240, purple ? 0.3 : 0.12, purple ? 0.5 : 0.32);
    if(purple) arp([523, 659, 784, 1047, 1319], 55, "triangle", 0.15);
    else arp([659, 988, 1319], 60, "triangle", 0.14);
  }
  haptic(purple ? "purple" : "blue");
}

// Fired the instant a barrier clears your avatar without touching it.
// Reward scales with how near the gap's centre you threaded it, and a
// GRAZE pays extra for clearing a wall by a hair.
function threaded(o, c){
  var off = Math.abs(c.x - o.gapC) / (o.gapW/2);
  var clean = off < 0.34;
  var near = !clean && off < 0.52;
  var graze = o.minGraze < 7;
  var steel = graze && o.hard && game.boost > 0;
  // Variable magnitude. A fixed payout stops producing a prediction error once
  // learned; some passes pay far more and the player cannot know which.
  var surge = clean && Math.random() < 0.12;
  game.combo += 1;
  if(game.combo > game.bestCombo) game.bestCombo = game.combo;
  var mult = 1 + Math.floor(game.combo/5);
  var base = (surge ? 10 : (clean ? 3 : 1)) + (graze ? (steel ? 10 : 4) : 0);
  var pts = base * mult;
  game.dist += pts;

  game.recentClean.push(clean);
  while(game.recentClean.length > 10) game.recentClean.shift();
  if(game.recentClean.length >= 6){
    var rate = game.recentClean.filter(Boolean).length / game.recentClean.length;
    var target = rate > 0.7 ? 0.1 : (rate < 0.3 ? -0.1 : 0);
    game.diffAdj += (target - game.diffAdj) * 0.25;
  }

  world.perturb(c.x, c.y, surge ? 1.0 : (clean ? 0.7 : 0.4), 1.2);
  game.rings.push({ x:c.x, y:c.y, r:HIT_R, max: surge ? 56 : (clean ? 44 : 30), life:1, clean:clean, surge:surge });
  if(graze) game.rings.push({ x:c.x, y:c.y, r:HIT_R, max:36, life:1, graze:true });
  var label = (graze ? (steel ? "STEEL GRAZE " : "GRAZE ") : "") + (surge ? "SURGE +" + pts : (clean ? "CLEAN +" + pts : (near ? "CLOSE +" + pts : "+" + pts)));
  game.texts.push({
    x:c.x, y:c.y - 30, text:label, life: (surge || graze) ? 1.4 : 1,
    color: surge ? "#f2c14e" : (clean ? "#7dd3c0" : (graze ? "#eef0f4" : (near ? "#5fa89a" : "#8991a1"))),
    size: surge ? 14 : (clean ? 12 : 11)
  });
  while(game.texts.length > 4) game.texts.shift();

  if(game.combo % 5 === 0){
    if(state.soundOn) blip(520 + Math.min(6, game.combo/5)*90, 0.3, "sine", 0.17);
    // The surge beat below is the stronger, rarer one; it must never be
    // de-duped by the combo beat landing first.
    if(!surge) haptic("combo");
  }
  if(state.soundOn){
    var step = Math.min(14, game.combo);
    if(surge){
      blip(660, 0.12, "triangle", 0.16);
      blip(990, 0.22, "triangle", 0.14);
      thump(200, 0.16, 0.42);
    } else {
      blip(330 + step*26, clean ? 0.16 : 0.1, clean ? "triangle" : "sine", clean ? 0.14 : 0.08);
      if(clean) thump(240, 0.07, 0.16);
      if(graze) blip(1180, 0.09, "sine", 0.12);
    }
  }
  if(surge) haptic("surge");
  comboNum.textContent = game.combo;
  comboMult.textContent = "×" + mult;
  comboBadge.classList.remove("pop");
  void comboBadge.offsetWidth;
  comboBadge.classList.add("pop");
}

var lastTickAt = -9;
export function registerStroke(side, amp){
  if(game.dying > 0 || game.paused || game.phase !== PHASE_RUN) return;
  var now = world.time;
  var c = cursors[side];
  var rhythm = (now - c.lastStrokeAt) < STROKE_WINDOW;
  var bilateral = (now - cursors[1 - side].lastStrokeAt) < 0.22;
  c.lastStrokeAt = now;
  // ±30% jitter so the exact stroke that tips the meter is never certain.
  // Sustained uncertainty about when the payoff lands is what keeps the
  // ramp toward it alive.
  var add = STROKE_CHARGE * (0.7 + Math.random()*0.6) * (rhythm ? 1.4 : 0.8) * (bilateral ? 1.8 : 1) * (state.oneHand ? ONE_HAND_PUMP : 1);
  game.charge = Math.min(1, game.charge + add);
  if(!state.taughtPump){ state.taughtPump = true; saveState(); }
  gauge.classList.remove("tick"); void gauge.offsetWidth; gauge.classList.add("tick");
  // Frantic pumping can hit 20 strokes/s; cap the tick so it does not spawn
  // a fresh audio graph on every one.
  if(state.soundOn && now - lastTickAt > 0.08){
    lastTickAt = now;
    blip(220 + game.charge*520, 0.05, "square", 0.05 + game.charge*0.06);
  }
  if(game.charge >= 1 && game.boost === 0) fireBoost();
}
export function fireBoost(){
  var W = view.W, H = view.H;
  game.boost = 1;
  game.wreck = 0;
  game.litTime = 0;
  // Storm lands somewhere in 4–6: known to be coming, not exactly when.
  game.wreckTarget = 4 + Math.floor(Math.random()*3);
  game.shake = Math.max(game.shake, 0.35);
  world.perturb(W/2, H*0.6, 1.4, 2.0);
  game.texts.push({ x:W/2, y:H*0.5, text:"BOOST", life:1.2, color:"#7dd3c0", size:22 });
  while(game.texts.length > 4) game.texts.shift();
  if(state.soundOn){
    blip(330, 0.35, "sawtooth", 0.14);
    blip(660, 0.5, "triangle", 0.12);
    thump(180, 0.34, 0.45);
  }
  haptic("ignite");
}

// ===================== spawning =====================
// Three pattern classes. Mirror is easiest (motor system defaults to it),
// parallel fights the mirror reflex, independent is the real ceiling.
// Distance ramp plus a small performance nudge, so the challenge tracks the
// player's actual skill instead of one fixed curve for everyone.
export function difficulty(){
  return Math.max(0, Math.min(1, game.dist / 2600 + game.diffAdj));
}
function spawnRow(){
  var W = view.W;
  var d = difficulty();
  var laneW = W / lanes();
  var gapW = laneW * (state.oneHand ? (0.34 - 0.18*d) : (0.52 - 0.26*d));
  gapW = Math.max(56, gapW);
  // Steel: boost cannot break it. Rare at baseline so the look is learned;
  // more common the longer you stay continuously lit, so infinite boost
  // demands threading at speed instead of replacing it.
  var pHard = 0.06 + (game.boost > 0 ? Math.min(0.5, 0.14 + game.litTime*0.05) : 0);
  // The rare coin, rolled per row. Blue ~1 in 50, purple ~1 in 400.
  var sr = Math.random();
  var specialTier = sr < 1/400 ? 2 : (sr < 1/50 ? 1 : 0);
  var specialSide = lanes() === 1 ? 0 : (Math.random() < 0.5 ? 0 : 1);
  var h = 22 + Math.random()*26;

  var roll = Math.random();
  var pMirror = 0.45 - 0.25*d;
  var pParallel = 0.35 - 0.05*d;
  var kind = roll < pMirror ? "mirror" : (roll < pMirror + pParallel ? "parallel" : "independent");

  var relL, relR;
  var margin = (gapW/2) / laneW;
  function randRel(){ return margin + Math.random()*(1 - margin*2); }
  if(kind === "mirror"){ relL = randRel(); relR = 1 - relL; }
  else if(kind === "parallel"){ relL = randRel(); relR = relL; }
  else { relL = randRel(); relR = randRel(); }

  laneList().forEach(function(side){
    var b = laneBounds(side);
    var rel = side === 0 ? relL : relR;
    var gapC = b.x0 + rel*laneW;
    var gs = gapC - gapW/2, ge = gapC + gapW/2;
    var rects = [];
    if(gs - b.x0 > 3) rects.push({ x:b.x0, w:gs - b.x0 });
    if(b.x1 - ge > 3) rects.push({ x:ge, w:b.x1 - ge });
    var hard = Math.random() < pHard;
    game.obstacles.push({ y:-h, h:h, rects:rects, side:side, kind:kind, gapC:gapC, gapW:gapW, passed:false, flash:0, minGraze:99, hard:hard, warned:false });
    if(Math.random() < 0.62){
      game.pickups.push({ x:gapC + (Math.random()-0.5)*gapW*0.5, y:-h - 40 - Math.random()*70, r:9, taken:false, tier:0, val:1 });
    }
    if(specialTier && side === specialSide){
      // Off the safe line on purpose: you have to leave the gap to take it
      // and get back before the barrier arrives.
      var dir = Math.random() < 0.5 ? -1 : 1;
      var srel = Math.max(0.1, Math.min(0.9, rel + dir*(0.28 + Math.random()*0.14)));
      game.pickups.push({ x:b.x0 + srel*laneW, y:-h - 90, r:11, taken:false, tier:specialTier, val: specialTier === 2 ? 100 : 25 });
    }
  });
  // occasional coin arc that sits off the safe line — greed costs you
  if(Math.random() < 0.22){
    var side = lanes() === 1 ? 0 : (Math.random() < 0.5 ? 0 : 1);
    var b = laneBounds(side);
    var cx = b.x0 + laneW*(0.2 + Math.random()*0.6);
    for(var i=0;i<4;i++){
      game.pickups.push({ x:cx + Math.sin(i*0.9)*26, y:-140 - i*30, r:9, taken:false, tier:0, val:1 });
    }
  }
}

function circleRectHit(cx, cy, cr, rx, ry, rw, rh){
  var nx = Math.max(rx, Math.min(cx, rx+rw));
  var ny = Math.max(ry, Math.min(cy, ry+rh));
  var dx = cx-nx, dy = cy-ny;
  return dx*dx + dy*dy <= cr*cr;
}

export function update(dt){
  var W = view.W, H = view.H;
  var lerp = reduceMotion ? 1 : Math.min(1, (state.follow/100) * dt * 60);

  laneList().forEach(function(side){
    var c = cursors[side];
    var b = laneBounds(side);
    c.tx = Math.max(b.x0 + DRAW_R, Math.min(b.x1 - DRAW_R, c.tx));
    c.ty = Math.max(DRAW_R, Math.min(H - DRAW_R, c.ty));
    c.x += (c.tx - c.x) * lerp;
    c.y += (c.ty - c.y) * lerp;
    if(dt > 0){
      c.vx = Math.max(-1400, Math.min(1400, (c.x - c.px)/dt));
      c.vy = Math.max(-1400, Math.min(1400, (c.y - c.py)/dt));
    }
    c.dy = c.y - c.py; c.px = c.x; c.py = c.y;
    // Paused thumbs resync strokeDir/strokeStart on resume instead of
    // counting the pre-pause half stroke.
    if(game.phase === PHASE_RUN && c.active && !game.paused){
      var dyT = c.ty - c.prevTy;
      var dir = dyT > 1.5 ? 1 : (dyT < -1.5 ? -1 : 0);
      if(dir !== 0 && dir !== c.strokeDir){
        var amp = Math.abs(c.ty - c.strokeStart);
        if(c.strokeDir !== 0 && amp >= STROKE_MIN) registerStroke(side, amp);
        c.strokeDir = dir;
        c.strokeStart = c.ty;
      }
    } else {
      c.strokeDir = 0; c.strokeStart = c.ty;
    }
    c.prevTy = c.ty;
    var maxTrail = Math.min(40, state.trailLength + (game.boost > 0 ? 14 : 0));
    if(maxTrail > 0 && !reduceMotion){
      c.trail.push({ x:c.x, y:c.y });
      while(c.trail.length > maxTrail) c.trail.shift();
    } else { c.trail.length = 0; }
  });

  // parallel detection: same relative position within each lane
  var laneW = W/2;
  var relL = (cursors[0].x - 0) / laneW;
  var relR = (cursors[1].x - laneW) / laneW;
  var dRel = Math.abs(relL - relR);
  var dY = Math.abs(cursors[0].y - cursors[1].y) / H;
  game.parallelOn = lanes() === 2 && game.phase === PHASE_RUN && cursors[0].active && cursors[1].active && dRel < 0.09 && dY < 0.09;
  game.mirrorHint = (lanes() === 2 && cursors[0].active && cursors[1].active)
    ? Math.max(0, 1 - Math.max(dRel, dY)/0.3)
    : 0;

  if(game.paused) return;
  if(game.dying > 0){
    game.dying -= dt;
    if(game.dying <= 0){ game.dying = 0; finishDeath(); }
  }
  if(game.grace > 0) game.grace -= dt;
  if(game.slowmo > 0) game.slowmo -= dt;

  if(game.phase === PHASE_RUN){
    // World time is scaled: slow motion while dying, held still during the
    // post-tab-return grace, and eased in over the first second of a run.
    // Feedback (sparks, text, rings) stays at full rate.
    var wdt = dt * (game.dying > 0 ? 0.12 : (game.grace > 0 ? 0 : (game.slowmo > 0 ? 0.3 : 1)));
    game.rampT += wdt;
    if(game.boost > 0) game.litTime += wdt;
    var ramp = Math.min(1, game.rampT/1.2); ramp = ramp*ramp*(3 - 2*ramp);
    var d = difficulty();
    game.runTime += wdt;
    // Ramp is fully finished at 1.2 s; the first barrier reaches the orb at
    // ~3.3 s, so the hint is up before it and fades from 3.86 s.
    if(!state.taughtPump && !game.hinted && game.runTime > 1.2){
      game.hinted = true;
      game.texts.push({ x:W/2, y:H*0.8, text:"pump ↕ to charge", life:4.0, color:"#7dd3c0", size:12 });
      while(game.texts.length > 4) game.texts.shift();
    }
    // Boost is a spendable tank: ignites at full, drains while lit, and
    // pumping during it tops it back up so a good player can chain it.
    if(game.boost > 0){
      game.charge -= BOOST_DRAIN*wdt;
      game.boostMult += (BOOST_SPEED - game.boostMult) * Math.min(1, dt*8);
      if(game.charge <= 0){
        game.charge = 0; game.boost = 0; game.wreck = 0; game.litTime = 0;
        haptic("empty");
      }
    } else {
      game.boostMult += (1 - game.boostMult) * Math.min(1, dt*5);
      game.charge = Math.max(0, game.charge - CHARGE_DECAY*dt);
    }
    game.speed = (200 + d*420) * game.boostMult * (0.25 + 0.75*ramp);
    game.dist += game.speed * wdt / 10;
    game.scrollOffset = (game.scrollOffset + game.speed*wdt) % 42;

    game.spawnTimer -= wdt;
    if(game.spawnTimer <= 0){
      spawnRow();
      game.spawnTimer = Math.max(0.42, 1.05 - d*0.5) * (0.85 + Math.random()*0.3);
    }

    for(var i=game.obstacles.length-1;i>=0;i--){
      // A storm fired from shatter() can empty this array mid-loop.
      if(i >= game.obstacles.length) continue;
      var o = game.obstacles[i];
      var mv = game.speed*wdt; o.y += mv;
      o.flash = Math.max(0, o.flash - dt*3.2);
      if(o.y > H + 60){ game.obstacles.splice(i,1); continue; }
      if(o.side >= lanes()) continue;
      if(o.hard && !o.warned && o.y > -4){
        o.warned = true;
        if(game.boost > 0 && state.soundOn) blip(150, 0.12, "square", 0.12);
      }
      // While dying, the barrier that got you must neither hit again nor
      // pay out as a pass.
      if(game.dying > 0) continue;
      var c = cursors[o.side];
      var hit = false;
      var rel = mv - c.dy; /* barrier down + avatar up, this frame */
      /* > 0 only when the relative travel exceeds the band, i.e. a tunnel was
         possible; 0 on every ordinary frame so the test is bit-identical to
         the unswept one. */
      var ext = Math.max(0, rel - o.h - HIT_R);
      var inBand = o.y - ext < c.y + HIT_R && o.y + o.h > c.y - HIT_R;
      for(var r=0;r<o.rects.length;r++){
        var rc = o.rects[r];
        if(circleRectHit(c.x, c.y, HIT_R, rc.x, o.y - ext, rc.w, o.h + ext)){
          // Boost breaks slate, not steel.
          if(game.boost > 0 && !o.hard) shatter(o, c);
          else die(c.x, c.y, (o.hard && game.boost > 0) ? "steel" : "");
          hit = true;
          break;
        }
        if(inBand){
          // Horizontal clearance to this wall while level with it, for GRAZE.
          var gz = c.x < rc.x ? rc.x - (c.x + HIT_R) : (c.x - HIT_R) - (rc.x + rc.w);
          if(gz < o.minGraze) o.minGraze = gz;
        }
      }
      if(!hit && !o.passed && o.y > c.y + HIT_R){
        o.passed = true;
        o.flash = 1;
        threaded(o, c);
      }
    }

    for(var j=game.pickups.length-1;j>=0;j--){
      var p = game.pickups[j];
      p.y += game.speed*wdt;
      if(p.y > H + 40){ game.pickups.splice(j,1); continue; }
      // Cue on entry. The reward-predictive signal is what carries the pull,
      // more than the reward itself.
      if(!p.cued && p.y > -4){
        p.cued = true; p.glint = p.tier ? 1.6 : 1;
        if(state.soundOn){
          if(p.tier === 2) arp([880, 1320, 1760], 70, "sine", 0.08);
          else if(p.tier === 1) arp([880, 1320], 70, "sine", 0.07);
          else if(Math.random() < 0.5) blip(1320, 0.05, "sine", 0.035);
        }
      }
      p.glint = Math.max(0, (p.glint || 0) - dt*2.2);
      if(game.boost > 0){
        for(var ms=0; ms<lanes(); ms++){
          var mc = cursors[ms];
          var mdx = mc.x - p.x, mdy = mc.y - p.y, md = Math.hypot(mdx, mdy);
          if(md < MAGNET_R && md > 1){
            var pull = (1 - md/MAGNET_R) * 900 * wdt;
            p.x += mdx/md * pull; p.y += mdy/md * pull;
          }
        }
      }
      for(var s=0;s<lanes();s++){
        var cc = cursors[s];
        if(Math.hypot(cc.x-p.x, cc.y-p.y) < HIT_R + p.r + 3){
          var gain = (p.val || 1) * (game.parallelOn ? 2 : 1);
          game.coins += gain;
          game.dist += gain * 2;
          if(p.tier){ collectSpecial(p, gain); }
          else {
            world.perturb(p.x, p.y, 0.5, 1.1);
            game.shake = Math.max(game.shake, 0.1);
            if(state.soundOn){
              blip(game.parallelOn ? 880 : 660, 0.16, "triangle", 0.12);
              thump(220, 0.11, 0.32);
            }
            for(var k=0;k<7;k++){
              var a = Math.random()*Math.PI*2, sp = 40 + Math.random()*140;
              game.sparks.push({ x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1, color:"#f2c14e" });
            }
          }
          game.pickups.splice(j,1);
          break;
        }
      }
    }
  }

  for(var q=game.sparks.length-1;q>=0;q--){
    var sp2 = game.sparks[q];
    sp2.x += sp2.vx*dt; sp2.y += sp2.vy*dt;
    sp2.vx *= 0.92; sp2.vy *= 0.92;
    sp2.life -= dt*1.7;
    if(sp2.life <= 0) game.sparks.splice(q,1);
  }

  for(var ti=game.texts.length-1;ti>=0;ti--){
    var ft = game.texts[ti];
    ft.y -= dt*38;
    ft.life -= dt*1.05;
    if(ft.life <= 0) game.texts.splice(ti,1);
  }
  for(var ri=game.rings.length-1;ri>=0;ri--){
    var rg = game.rings[ri];
    rg.r += (rg.max - rg.r) * Math.min(1, dt*7);
    rg.life -= dt*2.1;
    if(rg.life <= 0) game.rings.splice(ri,1);
  }
  for(var di=game.debris.length-1;di>=0;di--){
    var db = game.debris[di];
    db.vy += 900*dt;
    db.x += db.vx*dt;
    db.y += db.vy*dt + game.speed*dt*0.6;
    db.rot += db.vr*dt;
    db.vx *= 0.985;
    db.life -= dt*0.9;
    if(db.life <= 0 || db.y > H + 60) game.debris.splice(di,1);
  }
  game.flash = Math.max(0, game.flash - dt*4);

  game.shake = Math.max(0, game.shake - dt*2.4);

  var tier = Math.min(1, Math.floor(game.combo/5) * 0.18);
  var targetEntropy = game.phase === PHASE_RUN
    ? Math.min(1, 0.2 + difficulty()*0.7 + (game.boost > 0 ? 0.3 : 0)) : 0.1;
  var targetWarmth = game.boost > 0 ? 1
    : (game.parallelOn ? 0.92 : (game.phase === PHASE_RUN ? 0.4 + game.charge*0.35 + tier*0.2 : 0.2));
  targetWarmth = Math.min(1, targetWarmth);
  world.tick(dt, targetEntropy, targetWarmth);
  driveAudio();
}

export function setOneHand(on){
  state.oneHand = !!on;
  saveState();
  sidePointer[1] = null;
  cursors[1].active = false;
  if(game.phase !== PHASE_RUN) resetCursors();
  syncOneHand();
}
