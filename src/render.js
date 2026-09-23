// Canvas and drawing. view holds what were closure vars (canvas, ctx2d, wrap,
// W, H, dpr); functions read them into locals at the top.
import { state, reduceMotion } from './state.js';
import { world } from './world.js';
import { audio } from './audio.js';
import { game, cursors, lanes, laneList, laneBounds, difficulty, DRAW_R, PHASE_READY, PHASE_RUN, PHASE_DEAD } from './game.js';

export var imgCache = {};
export function ensureImage(slot){
  if(!slot.image) return null;
  if(imgCache[slot.id] && imgCache[slot.id].src === slot.image) return imgCache[slot.id];
  var img = new Image();
  img.src = slot.image;
  imgCache[slot.id] = img;
  return img;
}
export function clearImageCache(){ imgCache = {}; }

// ===================== canvas =====================
// The backing store is capped at DPR 2 (W06): a 3x phone rasterises 2.25x
// the pixels of a 2x one for lines and text that read the same at arm's
// length. realDpr keeps the true ratio so blur radii set in CSS units can be
// scaled back to the same on-screen size (shadowBlur is in store pixels).
var DPR_CAP = 2;
export var view = { canvas:null, ctx2d:null, wrap:null, W:0, H:0, dpr:1, realDpr:1 };
// The centre seam lives in the DOM (#seamEl, under the canvas); its opacity
// is written only when it moves by more than a rounding step.
var seamEl = null, seamLastA = -1;
// The camera (shake + sway) is a CSS transform on the canvas and the seam,
// written only when the string changes.
var camXf = "";
export function resize(){
  var rect = view.wrap.getBoundingClientRect();
  view.W = rect.width; view.H = rect.height;
  var realDpr = Math.max(1, window.devicePixelRatio || 1);
  var dpr = Math.min(DPR_CAP, realDpr);
  var dprChanged = dpr !== view.dpr || realDpr !== view.realDpr;
  view.realDpr = realDpr; view.dpr = dpr;
  view.canvas.width = Math.round(view.W*view.dpr);
  view.canvas.height = Math.round(view.H*view.dpr);
  view.ctx2d.setTransform(view.dpr,0,0,view.dpr,0,0);
  // The halo sprites are keyed on dpr/realDpr, not W/H, so a resize that
  // keeps both needs no rebuild; when one changes, rebuild in idle slices
  // rather than on the next run frame.
  if(dprChanged){ clearHaloCache(); prewarmHalos(); }
}
export function initRender(){
  view.canvas = document.getElementById("stage");
  view.ctx2d = view.canvas.getContext("2d");
  view.wrap = view.canvas.parentElement;
  seamEl = document.getElementById("seamEl");
  resize();
  window.addEventListener("resize", resize);
  state.slots.forEach(ensureImage);
  prewarmHalos();
  initFx();
}

// ===================== adaptive quality =====================
// Straight grid rows and no spectrum bars, only on a device that is already
// dropping frames (W19). A 120-entry ring of rAF intervals is filled while a
// run is on; every 60 frames, once the run is 3 s old, a ring p95 over 33 ms
// drops the tier to "low". The step back to "full" happens only at the next
// startRun, when the previous run's last 120 frames held p95 under 20 ms, so
// the change is never seen as a pop. ?fx=full / ?fx=low pin the tier (the
// gate is measured pinned full); the Auto quality switch (state.autoFx) off
// holds full. The saved grid/fft toggles are untouched either way.
export var fx = { level:"full", auto:true };
var FX_N = 120;
var fxRing = new Float32Array(FX_N), fxSorted = new Float32Array(FX_N);
var fxHead = 0, fxCount = 0, fxFrames = 0, fxRunMs = 0, fxPinned = false;
function fxReset(){ fxHead = 0; fxCount = 0; fxFrames = 0; fxRunMs = 0; }
// p95 of the ring (the harness's percentile: sorted[floor(n*0.95)]); null
// until the ring is full.
function fxP95(){
  if(fxCount < FX_N) return null;
  fxSorted.set(fxRing);
  fxSorted.sort();
  return fxSorted[Math.floor(FX_N*0.95)];
}
// Once per frame from main.js with the raw rAF interval in ms.
export function fxFrame(ms){
  if(!fx.auto || game.phase !== PHASE_RUN || !(ms > 0)) return;
  fxRing[fxHead] = ms; fxHead = (fxHead + 1) % FX_N;
  if(fxCount < FX_N) fxCount++;
  fxRunMs += ms;
  if(++fxFrames % 60) return;
  if(fx.level === "low" || fxRunMs < 3000) return;
  var p95 = fxP95();
  if(p95 !== null && p95 > 33) fx.level = "low";
}
// startRun: the one place the tier may step back up.
export function fxRunStart(){
  if(fx.auto && fx.level === "low"){
    var p95 = fxP95();
    if(p95 !== null && p95 < 20) fx.level = "full";
  }
  fxReset();
}
// The Auto quality switch; a URL pin wins over it.
export function setFxAuto(on){
  if(fxPinned) return;
  fx.auto = !!on;
  if(!fx.auto) fx.level = "full";
  fxReset();
}
function initFx(){
  var m = /(^|[?&])fx=(full|low)(&|$)/.exec(location.search);
  if(m){ fxPinned = true; fx.auto = false; fx.level = m[2]; return; }
  setFxAuto(state.autoFx);
}

// ===================== drawing helpers =====================
function drawShape(shape, x, y, r, color, g){
  var ctx2d = g || view.ctx2d;
  if(shape === "ring"){
    ctx2d.beginPath(); ctx2d.arc(x,y,r,0,Math.PI*2);
    ctx2d.lineWidth = Math.max(4, r*0.32); ctx2d.strokeStyle = color; ctx2d.stroke();
  } else if(shape === "star"){
    ctx2d.beginPath();
    for(var i=0;i<10;i++){
      var ang = -Math.PI/2 + i*Math.PI/5;
      var rad = (i%2===0) ? r : r*0.45;
      var px = x + Math.cos(ang)*rad, py = y + Math.sin(ang)*rad;
      if(i===0) ctx2d.moveTo(px,py); else ctx2d.lineTo(px,py);
    }
    ctx2d.closePath(); ctx2d.fillStyle = color; ctx2d.fill();
  } else if(shape === "diamond"){
    ctx2d.save(); ctx2d.translate(x,y); ctx2d.rotate(Math.PI/4);
    ctx2d.fillStyle = color; ctx2d.fillRect(-r*0.72,-r*0.72,r*1.44,r*1.44);
    ctx2d.restore();
  } else {
    ctx2d.beginPath(); ctx2d.arc(x,y,r,0,Math.PI*2);
    ctx2d.fillStyle = color; ctx2d.fill();
  }
}
function drawImageBlob(x,y,r,img){
  var ctx2d = view.ctx2d;
  if(!img || !img.complete || !img.naturalWidth){
    drawShape("circle",x,y,r,"#555b66"); return;
  }
  ctx2d.save();
  ctx2d.beginPath(); ctx2d.arc(x,y,r,0,Math.PI*2); ctx2d.clip();
  var scale = Math.max((r*2)/img.naturalWidth, (r*2)/img.naturalHeight);
  var dw = img.naturalWidth*scale, dh = img.naturalHeight*scale;
  ctx2d.drawImage(img, x-dw/2, y-dh/2, dw, dh);
  ctx2d.restore();
  ctx2d.beginPath(); ctx2d.arc(x,y,r,0,Math.PI*2);
  ctx2d.lineWidth = 2; ctx2d.strokeStyle = "rgba(255,255,255,.42)"; ctx2d.stroke();
}

// Orb halo as a cached sprite (W15). A live shadowBlur re-blurs the orb
// every frame; the blur only changes with shape, colour, radius and the
// rounded glow, so it is rendered once per key into a small canvas and
// drawn back with drawImage. The sprite holds the shadow alone: the shape
// is drawn off-canvas and shadowOffsetX brings the blur back, so what lands
// under the live body is exactly what the live path composited there (a
// destination-out punch measured 60/255 off inside an inactive orb, where
// globalAlpha 0.45 stacks shadow then body). Keyed on both dpr values
// because shadowBlur is in store pixels; cleared when a resize changes
// either dpr and whenever a slot's look changes (ui.js), prewarmed after.
var haloCache = {};
export function clearHaloCache(){ haloCache = {}; }
function haloSprite(shape, color, r, blur){
  var key = shape + "|" + color + "|" + r + "|" + blur + "|" + view.dpr + "|" + view.realDpr;
  var s = haloCache[key];
  if(s) return s;
  var pad = Math.ceil(blur*2 + 4), size = Math.ceil((r + pad)*2), off = size*2;
  var c = document.createElement("canvas");
  c.width = Math.ceil(size*view.dpr); c.height = c.width;
  var g = c.getContext("2d");
  g.setTransform(view.dpr,0,0,view.dpr,0,0);
  g.shadowColor = color;
  g.shadowBlur = blur * view.dpr / view.realDpr;
  // Offsets ignore the CTM (store pixels), the shape position does not.
  g.shadowOffsetX = off * view.dpr;
  drawShape(shape, size/2 - off, size/2, r, color, g);
  s = { c:c, size:size, store:c.width };
  haloCache[key] = s;
  return s;
}
// Pre-warm the sprites a run can reach (charge adds up to 10 to the glow,
// boost and parallel play cap it at 34) in idle slices, so a build never
// lands on a run frame. Most likely keys first: the resting glow, the boost
// cap, then the charge steps, both slots at each step. The idle timeout is
// short because a loop that never goes idle would otherwise starve the queue.
var warmQueue = [], warmPending = false;
export function prewarmHalos(){
  var lo = Math.max(1, Math.round(state.glow)), hi = Math.min(34, Math.round(state.glow) + 10);
  var blurs = [lo, 34];
  for(var b = lo + 1; b <= hi; b++) blurs.push(b);
  warmQueue.length = 0;
  blurs.forEach(function(blur){
    state.slots.forEach(function(slot){
      if(slot.mode !== "image") warmQueue.push([slot.shape, slot.color, blur]);
    });
  });
  scheduleWarm();
}
function scheduleWarm(){
  if(warmPending || !warmQueue.length) return;
  warmPending = true;
  if(window.requestIdleCallback) window.requestIdleCallback(warmStep, { timeout: 50 });
  else setTimeout(warmStep, 40);
}
function warmStep(deadline){
  warmPending = false;
  var built = 0;
  do {
    var it = warmQueue.shift();
    haloSprite(it[0], it[1], DRAW_R, it[2]);
    built++;
  } while(warmQueue.length && deadline && ((deadline.timeRemaining && deadline.timeRemaining() > 4) || (deadline.didTimeout && built < 3)));
  scheduleWarm();
}

export function draw(){
  var ctx2d = view.ctx2d, W = view.W, H = view.H, low = fx.level === "low";
  ctx2d.clearRect(0,0,W,H);
  ctx2d.save();
  // Shake and camera sway move the whole canvas element (a compositor
  // transform) instead of re-rasterising every frame through a ctx2d
  // rotate. Sway grows with level: slow lateral drift plus a hint of lean,
  // so the track starts to feel like it is curving under you. Draw-space
  // only — collision and input run in unswayed coordinates. The CSS
  // transform-origin is the element centre (W/2,H/2), so this composition
  // equals the old translate(shake) translate(c) rotate(r) translate(-c+sway)
  // exactly; Math.random is still called twice per shaking frame so the
  // spawn RNG order is unchanged.
  var sx = 0, sy = 0, swx = 0, rot = 0;
  if(game.shake > 0 && !reduceMotion){
    sx = (Math.random()-0.5)*game.shake*14; sy = (Math.random()-0.5)*game.shake*14;
  }
  if(game.phase === PHASE_RUN && !reduceMotion){
    var swayAmp = difficulty()*9 + (game.boost > 0 ? 4 : 0);
    swx = Math.sin(world.time*0.85)*swayAmp;
    rot = swx*0.0009;
  }
  var xf = (sx || sy || swx) ? "translate(" + sx.toFixed(2) + "px," + sy.toFixed(2) + "px) rotate(" + rot.toFixed(5) + "rad) translate(" + swx.toFixed(2) + "px,0)" : "";
  if(xf !== camXf){
    camXf = xf;
    view.canvas.style.transform = xf;
    if(seamEl) seamEl.style.transform = xf;
  }

  // lane grid, scrolling
  if(state.grid){
    ctx2d.strokeStyle = "rgba(255,255,255,0.055)";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    // Horizontal only — the scrolling lines read as speed. Each line is a
    // polyline so it can bow around a moving orb like a wake: vertical motion
    // drags it, fast lateral motion bulges it outward.
    var gstep = 22, R = 110, R2 = R*R, nl = lanes();
    for(var y = -42 + game.scrollOffset; y < H; y += 42){
      var y0 = Math.round(y)+.5;
      ctx2d.moveTo(0, y0);
      // A row more than R from every orb gets dy === 0 at every vertex, so
      // one straight segment draws the same pixels as the 19-vertex polyline.
      // The low tier draws every row that way.
      var near = false;
      if(!reduceMotion && !low){
        for(var ci=0; ci<nl; ci++){
          var ddy0 = y0 - cursors[ci].y;
          if(ddy0 < R && ddy0 > -R){ near = true; break; }
        }
      }
      if(!near){ ctx2d.lineTo(W, y0); continue; }
      for(var gx = gstep; gx <= W + gstep; gx += gstep){
        var dy = 0;
        if(!reduceMotion){
          for(var ci=0; ci<nl; ci++){
            var cc = cursors[ci];
            var ddx = gx - cc.x, ddy = y0 - cc.y;
            var d2 = ddx*ddx + ddy*ddy;
            if(d2 < R2){
              var f = 1 - Math.sqrt(d2)/R; f = f*f;
              dy += (cc.vy*0.012 + (ddy < 0 ? -1 : 1)*Math.abs(cc.vx)*0.006) * f;
            }
          }
          if(dy > 9) dy = 9; else if(dy < -9) dy = -9;
        }
        ctx2d.lineTo(Math.min(gx, W), y0 + dy);
      }
    }
    ctx2d.stroke();
  }

  // spectrum bars along the bottom — audio driving visuals. Read only while
  // sound is on (or for 300 ms after muting, so the bars fall instead of
  // vanishing): the analyser smooths per call, so it is read every frame.
  if(state.fft && !low && audio.started && audio.analyser && audio.freqData && (state.soundOn || performance.now() - audio.soundOffAt < 300)){
    audio.analyser.getByteFrequencyData(audio.freqData);
    var bars = 40;
    var bw = W / bars;
    ctx2d.fillStyle = "rgba(125,211,192,0.085)";
    for(var bi=0; bi<bars; bi++){
      // Non-linear bin mapping (audio.binIndex): the drone lives in the
      // first few bins, so a straight 1:1 map piled all the energy into the
      // far-left corner.
      var bin = audio.binIndex[bi];
      var bh = (audio.freqData[bin] / 255) * H * 0.1;
      ctx2d.fillRect(bi*bw, H - bh, bw - 1.5, bh);
    }
  }

  // centre seam, brightened by world warmth (parallel play). It is the DOM
  // band under the canvas: no seam in one-thumb mode (one lane, nothing to
  // divide) and none on the death screen, where it washed out the CTA.
  var seamA = (lanes() === 2 && game.phase !== PHASE_DEAD) ? 0.08 + world.warmth*0.5 : 0;
  if(seamEl && Math.abs(seamA - seamLastA) > 0.003){
    seamLastA = seamA;
    seamEl.style.opacity = seamA.toFixed(3);
  }

  // The seam is the tank's fill column: charge rises up the centre line
  // from the gauge, so filling is visible in peripheral vision instead of
  // only as a number at the bottom. Gold while lit.
  if(game.phase !== PHASE_DEAD && (game.charge > 0.01 || game.boost > 0)){
    var colMax = H * 0.55, colBase = H * 0.86;
    var colH = colMax * Math.max(0, Math.min(1, game.charge));
    var lit = game.boost > 0;
    var cr = lit ? "242,193,78" : "125,211,192";
    var ca = lit ? 0.85 : (0.45 + game.charge*0.4);
    // Halo as a gradient, not shadowBlur. Blurring a tall rect every frame
    // is among the most expensive things mobile canvas can do.
    var hg = ctx2d.createLinearGradient(W/2 - 14, 0, W/2 + 14, 0);
    hg.addColorStop(0, "rgba(" + cr + ",0)");
    hg.addColorStop(0.5, "rgba(" + cr + "," + (ca*0.35).toFixed(2) + ")");
    hg.addColorStop(1, "rgba(" + cr + ",0)");
    ctx2d.fillStyle = hg;
    ctx2d.fillRect(W/2 - 14, colBase - colH, 28, colH);
    ctx2d.fillStyle = "rgba(" + cr + "," + ca.toFixed(2) + ")";
    ctx2d.fillRect(W/2 - 2.5, colBase - colH, 5, colH);
  }
  if(game.boost > 0 && !reduceMotion){
    ctx2d.strokeStyle = "rgba(125,211,192,0.18)";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    for(var sk=0; sk<14; sk++){
      var sx = (sk*97 + world.time*40) % W;
      var sy = ((sk*151 + world.time*game.speed*1.4) % (H+120)) - 60;
      ctx2d.moveTo(sx, sy); ctx2d.lineTo(sx, sy + 46);
    }
    ctx2d.stroke();
  }

  // obstacles
  game.obstacles.forEach(function(o){
    // Solid cold slate. Ripple influence brightens the rim only — tinting the
    // whole body turned every barrier muddy mauve.
    var infl = Math.min(1, world.influenceAt(o.gapC, o.y, 300));
    // While lit, a barrier coming into range turns gold: the cue arrives
    // before the hit.
    var inRange = !o.passed && (o.y + o.h) > cursors[o.side].y - 220;
    var armed = game.boost > 0 && !o.hard && inRange;
    var threat = game.boost > 0 && o.hard && inRange;
    ctx2d.fillStyle = o.hard ? "#3a2026" : "#272d36";
    ctx2d.strokeStyle = o.flash > 0
      ? "rgba(125,211,192," + (0.25 + o.flash*0.75).toFixed(3) + ")"
      : (threat ? "rgba(255,111,111," + (0.7 + 0.3*Math.sin(world.time*14)).toFixed(2) + ")"
        : (o.hard ? "rgba(255,111,111,0.45)"
          : (armed ? "rgba(242,193,78,0.55)" : "rgba(160,175,195," + (0.14 + infl*0.22).toFixed(3) + ")")));
    ctx2d.lineWidth = (o.flash > 0 || armed) ? 2 : (threat ? 2.5 : 1);
    o.rects.forEach(function(rc){
      ctx2d.beginPath();
      ctx2d.roundRect ? ctx2d.roundRect(rc.x, o.y, rc.w, o.h, 4) : ctx2d.rect(rc.x, o.y, rc.w, o.h);
      ctx2d.fill(); ctx2d.stroke();
      if(o.hard){
        // Hatching so steel reads as steel from across the screen.
        ctx2d.save();
        ctx2d.beginPath(); ctx2d.rect(rc.x, o.y, rc.w, o.h); ctx2d.clip();
        ctx2d.strokeStyle = "rgba(255,111,111,0.28)";
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        for(var hx = rc.x - o.h; hx < rc.x + rc.w; hx += 9){
          ctx2d.moveTo(hx, o.y + o.h); ctx2d.lineTo(hx + o.h, o.y);
        }
        ctx2d.stroke();
        ctx2d.restore();
      }
    });
    if(o.flash > 0){
      ctx2d.globalAlpha = o.flash;
      ctx2d.strokeStyle = "rgba(125,211,192,0.85)";
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(o.gapC - o.gapW/2, o.y + o.h/2);
      ctx2d.lineTo(o.gapC + o.gapW/2, o.y + o.h/2);
      ctx2d.stroke();
      ctx2d.globalAlpha = 1;
    }
  });

  game.debris.forEach(function(db){
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, db.life);
    ctx2d.translate(db.x + db.w/2, db.y + db.h/2);
    ctx2d.rotate(db.rot);
    ctx2d.fillStyle = "#2e3540";
    ctx2d.strokeStyle = "rgba(200,210,225,0.35)";
    ctx2d.lineWidth = 1;
    ctx2d.fillRect(-db.w/2, -db.h/2, db.w, db.h);
    ctx2d.strokeRect(-db.w/2, -db.h/2, db.w, db.h);
    ctx2d.restore();
  });

  // pickups
  game.pickups.forEach(function(p){
    var gl = p.glint || 0;
    var tier = p.tier || 0;
    var rgb = tier === 2 ? "176,75,255" : (tier === 1 ? "61,123,255" : "242,193,78");
    var hex = tier === 2 ? "#b04bff" : (tier === 1 ? "#3d7bff" : "#f2c14e");
    var pulse = tier ? 0.5 + 0.5*Math.sin(world.time*5 + p.x) : 0;
    ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.r + 5 + gl*6 + pulse*4, 0, Math.PI*2);
    ctx2d.fillStyle = "rgba(" + rgb + "," + (0.14 + gl*0.3 + pulse*0.12).toFixed(2) + ")"; ctx2d.fill();
    ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.r + gl*3, 0, Math.PI*2);
    ctx2d.fillStyle = hex; ctx2d.fill();
    ctx2d.beginPath(); ctx2d.arc(p.x, p.y, p.r*0.42, 0, Math.PI*2);
    ctx2d.fillStyle = "rgba(11,13,17,.55)"; ctx2d.fill();
    if(tier){
      // Rotating four-point glint: visible from the top of the screen, which
      // is the whole point of a rare coin.
      var gr = p.r + 9 + pulse*3;
      ctx2d.save();
      ctx2d.translate(p.x, p.y); ctx2d.rotate(world.time*1.6);
      ctx2d.strokeStyle = "rgba(255,255,255," + (0.5 + pulse*0.4).toFixed(2) + ")";
      ctx2d.lineWidth = tier === 2 ? 2 : 1.5;
      ctx2d.beginPath();
      ctx2d.moveTo(-gr, 0); ctx2d.lineTo(gr, 0);
      ctx2d.moveTo(0, -gr); ctx2d.lineTo(0, gr);
      ctx2d.stroke();
      ctx2d.restore();
    }
  });

  // cursors + trails
  laneList().forEach(function(side){
    var c = cursors[side];
    var slot = state.slots[side];
    var b = laneBounds(side);

    // Ticks live on the lane walls, where a thumb never covers them.
    ctx2d.strokeStyle = slot.color;
    ctx2d.globalAlpha = 0.34;
    ctx2d.lineWidth = 2.5;
    ctx2d.beginPath();
    ctx2d.moveTo(b.x0, c.y); ctx2d.lineTo(b.x0 + 10, c.y);
    ctx2d.moveTo(b.x1 - 10, c.y); ctx2d.lineTo(b.x1, c.y);
    ctx2d.stroke();
    ctx2d.globalAlpha = 1;

    // The mirror ghost fades in only as the thumbs near symmetry, so it is an
    // aiming aid at the moment it matters instead of permanent clutter.
    if(game.mirrorHint > 0.01){
      ctx2d.globalAlpha = game.mirrorHint * 0.3;
      ctx2d.setLineDash([3,4]);
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath(); ctx2d.arc(W - c.x, c.y, DRAW_R*0.75, 0, Math.PI*2); ctx2d.stroke();
      ctx2d.setLineDash([]);
      ctx2d.globalAlpha = 1;
    }

    if(c.active && c.offset > 0){
      ctx2d.globalAlpha = 0.32;
      ctx2d.strokeStyle = slot.color;
      ctx2d.lineWidth = 1.5;
      ctx2d.setLineDash([2,5]);
      ctx2d.beginPath();
      ctx2d.moveTo(c.rawX, c.rawY); ctx2d.lineTo(c.x, c.y);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
      ctx2d.beginPath(); ctx2d.arc(c.rawX, c.rawY, 3, 0, Math.PI*2);
      ctx2d.fillStyle = slot.color; ctx2d.fill();
      ctx2d.globalAlpha = 1;
    }

    if(c.trail.length > 1){
      for(var i=0;i<c.trail.length;i++){
        var t = c.trail[i];
        var age = i/c.trail.length;
        ctx2d.globalAlpha = age*0.34;
        ctx2d.beginPath();
        ctx2d.arc(t.x, t.y, DRAW_R*0.55*age, 0, Math.PI*2);
        ctx2d.fillStyle = slot.color; ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
    }
    // On the title screen each orb wears a slow-breathing dashed ring: the
    // orb is the instruction, "thumb goes here". Ring drops the moment that
    // side registers a touch.
    if(game.phase === PHASE_READY && !c.active){
      var pr = DRAW_R + 12 + (reduceMotion ? 0 : Math.sin(world.time*2.4 + side)*4);
      ctx2d.globalAlpha = 0.34;
      ctx2d.strokeStyle = slot.color;
      ctx2d.lineWidth = 1.5;
      ctx2d.setLineDash([4,5]);
      ctx2d.beginPath(); ctx2d.arc(c.x, c.y, pr, 0, Math.PI*2); ctx2d.stroke();
      ctx2d.setLineDash([]);
      ctx2d.globalAlpha = 1;
    }

    // Static buzz: short jittering arcs regenerated each frame. It revs with
    // charge, speed and boost, so it also reads the pump state.
    if(!reduceMotion){
      var spd = Math.min(1, Math.hypot(c.vx, c.vy) / 900);
      var buzz = 0.3 + game.charge*0.9 + (game.boost > 0 ? 1.2 : 0) + spd*0.5;
      var nb = Math.round(4 + buzz*5);
      ctx2d.strokeStyle = slot.color;
      ctx2d.lineWidth = 1;
      ctx2d.globalAlpha = Math.min(0.5, 0.16 + buzz*0.12);
      ctx2d.beginPath();
      for(var bz=0; bz<nb; bz++){
        var ba = Math.random()*Math.PI*2;
        var br = DRAW_R + 3 + Math.random()*4;
        var bl = 3 + Math.random()*(4 + buzz*5);
        var bj = (Math.random()-0.5)*0.9;
        ctx2d.moveTo(c.x + Math.cos(ba)*br, c.y + Math.sin(ba)*br);
        ctx2d.lineTo(c.x + Math.cos(ba+bj)*(br+bl), c.y + Math.sin(ba+bj)*(br+bl));
      }
      ctx2d.stroke();
      ctx2d.globalAlpha = 1;
    }

    ctx2d.save();
    var glow = Math.min(34, state.glow + (game.parallelOn ? 16 : 0) + (game.boost > 0 ? 22 : game.charge*10));
    ctx2d.globalAlpha = c.active ? 1 : 0.45;
    if(slot.mode === "image"){
      // shadowBlur is applied in backing-store pixels, so under the DPR cap
      // the CSS-unit glow is scaled by dpr/realDpr to keep its on-screen size.
      if(glow > 0){ ctx2d.shadowColor = slot.color; ctx2d.shadowBlur = glow * view.dpr / view.realDpr; }
      drawImageBlob(c.x, c.y, DRAW_R, ensureImage(slot));
    } else {
      if(glow > 0){
        var hs = haloSprite(slot.shape, slot.color, DRAW_R, Math.round(glow));
        // Snapped to whole store pixels and drawn at its bitmap size: a
        // fractional device offset turns the blit into a bilinear resample
        // of the whole sprite (measured 8x the cost, slower than the blur).
        var hx = Math.round((c.x - hs.size/2) * view.dpr) / view.dpr;
        var hy = Math.round((c.y - hs.size/2) * view.dpr) / view.dpr;
        ctx2d.drawImage(hs.c, hx, hy, hs.store / view.dpr, hs.store / view.dpr);
      }
      drawShape(slot.shape, c.x, c.y, DRAW_R, slot.color);
    }
    ctx2d.restore();
    ctx2d.globalAlpha = 1;
  });

  // sparks
  game.sparks.forEach(function(s){
    ctx2d.globalAlpha = Math.max(0, s.life);
    ctx2d.beginPath(); ctx2d.arc(s.x, s.y, 3, 0, Math.PI*2);
    ctx2d.fillStyle = s.color; ctx2d.fill();
  });
  ctx2d.globalAlpha = 1;

  game.rings.forEach(function(rg){
    ctx2d.globalAlpha = Math.max(0, rg.life)*0.75;
    ctx2d.strokeStyle = rg.special || (rg.surge ? "#f2c14e" : (rg.graze ? "#eef0f4" : (rg.clean ? "#7dd3c0" : "rgba(180,190,205,.9)")));
    ctx2d.lineWidth = (rg.special || rg.surge) ? 3 : ((rg.clean || rg.graze) ? 2.5 : 1.5);
    ctx2d.beginPath(); ctx2d.arc(rg.x, rg.y, rg.r, 0, Math.PI*2); ctx2d.stroke();
  });
  ctx2d.globalAlpha = 1;

  ctx2d.textAlign = "center";
  game.texts.forEach(function(ft){
    ctx2d.globalAlpha = Math.max(0, Math.min(1, ft.life));
    ctx2d.fillStyle = ft.color;
    ctx2d.font = "600 " + ft.size + "px 'IBM Plex Mono', monospace";
    ctx2d.fillText(ft.text, ft.x, ft.y);
  });
  ctx2d.globalAlpha = 1;
  ctx2d.textAlign = "left";

  // Resume countdown, drawn directly: game.texts caps at 5 entries and would
  // evict a frozen 3-2-1 label under a burst of pass labels.
  if(game.countdown > 0){
    var n = Math.min(3, Math.ceil(game.countdown/0.4));
    ctx2d.globalAlpha = 0.9;
    ctx2d.fillStyle = "#7dd3c0";
    ctx2d.font = "600 34px 'IBM Plex Mono', monospace";
    ctx2d.textAlign = "center";
    ctx2d.fillText(String(n), W/2, H*0.45);
    ctx2d.globalAlpha = 1;
    ctx2d.textAlign = "left";
  }

  if(game.flash > 0 && !reduceMotion){
    ctx2d.fillStyle = "rgba(" + game.flashColor + "," + (game.flash*0.3).toFixed(3) + ")";
    ctx2d.fillRect(-40, -40, W + 80, H + 80);
  }

  ctx2d.restore();
}
