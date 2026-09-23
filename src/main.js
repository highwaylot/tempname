// Boot sequence and the frame loop. This is the only module that runs code
// at import time, and the only one that imports the stylesheet, so nothing
// else may import it.
import './styles.css';
import { loadPersisted, initNative, ent } from './native.js';
import { state, hydrateState } from './state.js';
import { audio, initAudio, ensureAudio } from './audio.js';
import { view, initRender, draw } from './render.js';
import { initUI, syncHud, syncGate, isPanelOpen, isRotateShown } from './ui.js';
import { initInput } from './input.js';
import { game, PHASE_RUN, resetCursors, update } from './game.js';
import { loop, resetClock } from './loop.js';

// ===================== loop =====================
// Section timers for the harness JS-budget gate: a 600-entry ring of
// {update, draw, hud} ms per frame, filled only when the page was opened
// with ?prof=1 (window.BellTheory.prof), so the shipped loop pays nothing.
var PROF_N = 600;
var prof = null;
function initProf(){
  if(!/(^|[?&])prof=1(&|$)/.test(location.search)) return;
  prof = { entries: [], head: 0, count: 0 };
  for(var i=0;i<PROF_N;i++) prof.entries.push({ update:0, draw:0, hud:0 });
  window.BellTheory = window.BellTheory || {};
  window.BellTheory.prof = prof;
}
function frame(ts){
  loop.frameNo++;
  var dt = loop.lastTs ? Math.min(0.05, (ts-loop.lastTs)/1000) : 0;
  loop.lastTs = ts;
  var t0 = prof ? performance.now() : 0, t1 = t0, t2 = t0;
  // The rAF re-arm is at the end of this function, so one thrown frame
  // used to freeze the game for good. Contain it and keep going.
  try{ update(dt); if(prof) t1 = performance.now(); draw(); if(prof) t2 = performance.now(); }
  catch(e){
    loop.errCount++; loop.lastErr = String((e && e.message) || e);
    if(loop.errCount < 4) console.error(e);
    // A throw inside draw() leaves its save() levels on the stack, and the
    // next frame would inherit that transform/alpha/dash. Drain it: restore
    // on an empty stack is a no-op, draw() nests at most 3 deep, and unlike
    // ctx.reset() this keeps the frame's pixels.
    for(var ri = 0; ri < 8; ri++) view.ctx2d.restore();
  }
  syncHud(ts);
  if(prof){
    var p = prof.entries[prof.head];
    p.update = t1 - t0; p.draw = t2 - t1; p.hud = performance.now() - t2;
    prof.head = (prof.head + 1) % PROF_N;
    if(prof.count < PROF_N) prof.count++;
  }
  requestAnimationFrame(frame);
}

// Background tab: freeze the run and quiet the audio. On return, the world
// holds still for a beat so you can reposition before it moves again.
function onVisibilityChange(){
  if(document.hidden){
    if(game.phase === PHASE_RUN) game.paused = true;
    if(audio.ctx && audio.ctx.state === "running"){
      var s = audio.ctx.suspend(); if(s && s.catch) s.catch(function(){});
    }
  } else {
    if(game.paused && game.pausedBy !== "user" && !isPanelOpen() && !isRotateShown()){ game.paused = false; game.grace = 0.8; }
    resetClock();
    if(state.soundOn) ensureAudio();
  }
}

// The wrapper's surface: the store plugin sets the entitlement and price
// and takes the unlock/restore taps. Extended, not replaced: initProf may
// already own window.BellTheory.prof.
function initBridge(){
  window.BellTheory = Object.assign(window.BellTheory || {}, {
    setUnlocked: function(on){ ent.unlocked = !!on; syncGate(); },
    setPrice: function(str){ ent.price = str ? String(str) : null; syncGate(); },
    onUnlockRequested: function(cb){ ent.onUnlock = typeof cb === "function" ? cb : null; },
    onRestoreRequested: function(cb){ ent.onRestore = typeof cb === "function" ? cb : null; }
  });
}

// Persisted settings first (raced against a short timeout so a stalled
// bridge never blocks the game), then each module's init in dependency
// order, then the loop.
function boot(){
  var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 1000); });
  return Promise.race([loadPersisted(), timeout]).then(function(json){
    hydrateState(json);
    initNative();
    initRender();
    initAudio();
    initUI();
    initInput();
    resetCursors();
    initProf();
    initBridge();
    document.addEventListener("visibilitychange", onVisibilityChange);
    requestAnimationFrame(frame);
  });
}
boot();
