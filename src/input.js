// Pointer handling on the canvas. initInput() attaches everything.
import { state } from './state.js';
import { world } from './world.js';
import { audio, ensureAudio, unlockMediaSession, startBeds } from './audio.js';
import { haptic } from './native.js';
import { view } from './render.js';
import { game, cursors, lanes, startRun, PHASE_READY, PHASE_RUN, PHASE_DEAD, TOUCH_OFFSET } from './game.js';

// ===================== input =====================
export var sidePointer = [null, null];

// Pointer positions are read against the wrap, not the canvas: the camera
// shake/sway is a CSS transform on the canvas (W05), and a thumb must map to
// the unswayed field it is actually over.
function onPointerDown(e){
  var canvas = view.canvas;
  var rect = view.wrap.getBoundingClientRect();
  var x = e.clientX - rect.left, y = e.clientY - rect.top;
  var side = lanes() === 1 ? 0 : (x < view.W/2 ? 0 : 1);
  if(sidePointer[side] !== null){
    // Already bound — a sticky mouse, or a second finger on a held side. The
    // only thing a fresh press can mean here is "run again".
    if(game.phase === PHASE_DEAD && world.time - game.deadAt > 0.6){
      var readyNow = lanes() === 1 ? cursors[0].active : (cursors[0].active && cursors[1].active);
      if(readyNow) startRun();
    }
    return;
  }
  // One pointer never owns both sides: a mouse that already holds the left
  // orb and clicks the right half would otherwise start an unwinnable run.
  if(sidePointer[1 - side] === e.pointerId) return;
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  sidePointer[side] = e.pointerId;
  var c = cursors[side];
  c.active = true;
  c.offset = e.pointerType === "touch" ? TOUCH_OFFSET : 0;
  c.rawX = x; c.rawY = y;
  c.tx = x; c.ty = y - c.offset;
  if(game.phase !== PHASE_RUN){ c.x = x; c.y = c.ty; c.px = c.x; c.py = c.y; c.trail.length = 0; }
  haptic("tap");
  unlockMediaSession();
  startBeds();
  var ready = lanes() === 1 ? cursors[0].active : (cursors[0].active && cursors[1].active);
  if(ready){
    if(game.phase === PHASE_READY) startRun();
    else if(game.phase === PHASE_DEAD && world.time - game.deadAt > 0.6){ startRun(); }
  }
}

function onPointerMove(e){
  var side = sidePointer[0] === e.pointerId ? 0 : (sidePointer[1] === e.pointerId ? 1 : -1);
  if(side < 0){
    // A mouse re-entering the field mid-run picks the orb back up, no click.
    if(e.pointerType === "mouse" && lanes() === 1 && game.phase === PHASE_RUN && sidePointer[0] === null){
      side = 0; sidePointer[0] = e.pointerId;
      cursors[0].active = true; cursors[0].offset = 0;
    } else return;
  }
  var rect = view.wrap.getBoundingClientRect();
  var c = cursors[side];
  var nx = e.clientX - rect.left, ny = e.clientY - rect.top;
  var moved = Math.abs(nx - c.rawX) + Math.abs(ny - c.rawY);
  c.rawX = nx; c.rawY = ny;
  c.tx = c.rawX;
  c.ty = c.rawY - (c.offset || 0);
  // A thumb that never lifted after a crash never fires a new pointerdown,
  // so moving a held thumb also restarts once the lockout has passed.
  if(e.pointerType !== "mouse" && game.phase === PHASE_DEAD && moved > 3 && world.time - game.deadAt > 0.6){
    var readyNow = lanes() === 1 ? cursors[0].active : (cursors[0].active && cursors[1].active);
    if(readyNow) startRun();
  }
}

export function release(e){
  var side = sidePointer[0] === e.pointerId ? 0 : (sidePointer[1] === e.pointerId ? 1 : -1);
  if(side < 0) return;
  sidePointer[side] = null;
  cursors[side].active = false;
}
// A mouse is sticky: one click starts, then the orb follows the pointer with
// no button held. Only leaving the field lets go.
function releaseUnlessMouse(e){ if(e.pointerType !== "mouse") release(e); }
// A lifted thumb is also the gesture that re-arms a context the platform
// suspended behind our back (an interruption, a route change).
function onPointerUp(e){
  releaseUnlessMouse(e);
  if(state.soundOn && audio.ctx && audio.ctx.state !== "running") ensureAudio();
}
// A mouse crossing from the canvas onto the strip the camera slid it away
// from is still in the field; only leaving the wrap lets go.
function onPointerOut(e){
  if(e.pointerType === "mouse" && !(e.relatedTarget && view.wrap.contains(e.relatedTarget))) release(e);
}
// The same handlers on the wrap, for a press or move in the <=20 px strip
// the canvas slid away from; canvas events bubble here too, hence the guard.
function onWrapPointerDown(e){ if(e.target === view.wrap) onPointerDown(e); }
function onWrapPointerMove(e){ if(e.target === view.wrap) onPointerMove(e); }

export function initInput(){
  var canvas = view.canvas, wrap = view.wrap;
  canvas.addEventListener("pointerdown", onPointerDown, { passive:true });
  canvas.addEventListener("pointermove", onPointerMove, { passive:true });
  canvas.addEventListener("pointerup", onPointerUp, { passive:true });
  canvas.addEventListener("pointercancel", releaseUnlessMouse, { passive:true });
  canvas.addEventListener("pointerout", onPointerOut, { passive:true });
  wrap.addEventListener("pointerdown", onWrapPointerDown, { passive:true });
  wrap.addEventListener("pointermove", onWrapPointerMove, { passive:true });
}
