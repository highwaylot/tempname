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
export var view = { canvas:null, ctx2d:null, wrap:null, W:0, H:0, dpr:1, realDpr:1 };
// The centre seam lives in the DOM (#seamEl, under the canvas); its opacity
// is written only when it moves by more than a rounding step.
var seamEl = null, seamLastA = -1;
export function resize(){
  var rect = view.wrap.getBoundingClientRect();
  view.W = rect.width; view.H = rect.height;
  view.realDpr = window.devicePixelRatio || 1;
  view.dpr = Math.max(1, window.devicePixelRatio || 1);
  view.canvas.width = Math.round(view.W*view.dpr);
  view.canvas.height = Math.round(view.H*view.dpr);
  view.ctx2d.setTransform(view.dpr,0,0,view.dpr,0,0);
}
export function initRender(){
  view.canvas = document.getElementById("stage");
  view.ctx2d = view.canvas.getContext("2d");
  view.wrap = view.canvas.parentElement;
  seamEl = document.getElementById("seamEl");
  resize();
  window.addEventListener("resize", resize);
  state.slots.forEach(ensureImage);
}

// ===================== drawing helpers =====================
function drawShape(shape, x, y, r, color){
  var ctx2d = view.ctx2d;
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

export function draw(){
  var ctx2d = view.ctx2d, W = view.W, H = view.H;
  ctx2d.clearRect(0,0,W,H);
  ctx2d.save();
  if(game.shake > 0 && !reduceMotion){
    ctx2d.translate((Math.random()-0.5)*game.shake*14, (Math.random()-0.5)*game.shake*14);
  }
  // Camera sway grows with level: slow lateral drift plus a hint of lean, so
  // the track starts to feel like it is curving under you. Draw-space only —
  // collision runs in unswayed coordinates.
  if(game.phase === PHASE_RUN && !reduceMotion){
    var swayAmp = difficulty()*9 + (game.boost > 0 ? 4 : 0);
    var swayX = Math.sin(world.time*0.85)*swayAmp;
    ctx2d.translate(W/2, H/2);
    ctx2d.rotate(swayX*0.0009);
    ctx2d.translate(-W/2 + swayX, -H/2);
  }

  // lane grid, scrolling
  if(state.grid){
    ctx2d.strokeStyle = "rgba(255,255,255,0.055)";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    // Horizontal only — the scrolling lines read as speed. Each line is a
    // polyline so it can bow around a moving orb like a wake: vertical motion
    // drags it, fast lateral motion bulges it outward.
    var gstep = 22, R = 110, R2 = R*R;
    for(var y = -42 + game.scrollOffset; y < H; y += 42){
      var y0 = Math.round(y)+.5;
      ctx2d.moveTo(0, y0);
      for(var gx = gstep; gx <= W + gstep; gx += gstep){
        var dy = 0;
        if(!reduceMotion){
          for(var ci=0; ci<lanes(); ci++){
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

  // spectrum bars along the bottom — audio driving visuals
  if(state.fft && audio.analyser && audio.freqData){
    audio.analyser.getByteFrequencyData(audio.freqData);
    var bars = 40;
    var bw = W / bars;
    ctx2d.fillStyle = "rgba(125,211,192,0.085)";
    for(var bi=0; bi<bars; bi++){
      // Non-linear bin mapping: the drone lives in the first few bins, so a
      // straight 1:1 map piled all the energy into the far-left corner.
      var bin = 1 + Math.floor(Math.pow(bi/bars, 1.8) * 70);
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
    if(glow > 0){ ctx2d.shadowColor = slot.color; ctx2d.shadowBlur = glow; }
    ctx2d.globalAlpha = c.active ? 1 : 0.45;
    if(slot.mode === "image") drawImageBlob(c.x, c.y, DRAW_R, ensureImage(slot));
    else drawShape(slot.shape, c.x, c.y, DRAW_R, slot.color);
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

  if(game.flash > 0 && !reduceMotion){
    ctx2d.fillStyle = "rgba(" + game.flashColor + "," + (game.flash*0.3).toFixed(3) + ")";
    ctx2d.fillRect(-40, -40, W + 80, H + 80);
  }

  ctx2d.restore();
}
