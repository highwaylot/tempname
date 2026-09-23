// Boot sequence and the frame loop. This is the only module that runs code
// at import time, and the only one that imports the stylesheet, so nothing
// else may import it.
import './styles.css';
import { loadPersisted, initNative, ent, wireBackButton, wireLifecycle } from './native.js';
import { state, hydrateState, hydrateLate, saveState } from './state.js';
import { initAudio } from './audio.js';
import { view, fx, fxFrame, initRender, draw } from './render.js';
import { initUI, syncHud, syncGate, applyState, isPanelOpen, isRotateShown, openPanel, closePanel } from './ui.js';
import { initInput } from './input.js';
import { game, PHASE_RUN, resetCursors, update, suspendRun, resumeAfterHidden } from './game.js';
import { loop } from './loop.js';

// Safe-area insets are applied once (W28): the stylesheet reads env() into
// --sat/--sab, and a host that already pads the root by the insets (the
// artifact iframe) gets them zeroed so the HUD is never inset twice.
(function(){ var cs = getComputedStyle(document.documentElement); if(parseFloat(cs.paddingTop) > 0 || parseFloat(cs.paddingBottom) > 0) document.documentElement.classList.add("host-inset"); })();

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
  fxFrame(loop.lastTs ? ts - loop.lastTs : 0);
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

// Background tab: the suspend/resume bodies live in game.js (the native
// shell drives the same two from appStateChange).
function onVisibilityChange(){ document.hidden ? suspendRun() : resumeAfterHidden(); }

// The wrapper's surface: the store plugin sets the entitlement and price
// and takes the unlock/restore taps; the Android back handler (native.js
// wireBackButton) reads the panel, phase and rotate state; the tests read
// fx and drive suspend/resume. Extended, not replaced: initProf may already
// own window.BellTheory.prof.
function initBridge(){
  window.BellTheory = Object.assign(window.BellTheory || {}, {
    isPanelOpen: isPanelOpen,
    openPanel: openPanel,
    closePanel: closePanel,
    phase: function(){ return game.phase; },
    rotateShown: isRotateShown,
    PHASE_RUN: PHASE_RUN,
    fx: fx,
    suspend: suspendRun,
    resume: resumeAfterHidden,
    setUnlocked: function(on){ ent.unlocked = !!on; syncGate(); },
    setPrice: function(str){ ent.price = str ? String(str) : null; syncGate(); },
    onUnlockRequested: function(cb){ ent.onUnlock = typeof cb === "function" ? cb : null; },
    onRestoreRequested: function(cb){ ent.onRestore = typeof cb === "function" ? cb : null; }
  });
}

// Persisted settings first (raced against a short timeout so a stalled
// bridge never blocks the game), then each module's init in dependency
// order, then the loop. A load that loses the race (json undefined, as
// against null for "nothing stored") still lands: the game runs on the
// defaults meanwhile, and when the durable copy arrives it is hydrated with
// the keys touched since boot replayed on top, best and the lifetime
// counters merged (state.hydrateLate), the sheet re-rendered and the result
// saved. Saves queued before it arrived carry the defaults and native.flush
// drops them, so a slow bridge never costs a setting or the high score.
function boot(){
  var load = loadPersisted();
  var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve(undefined); }, 1000); });
  return Promise.race([load, timeout]).then(function(json){
    hydrateState(json == null ? null : json);
    initNative();
    initRender();
    initAudio();
    initUI();
    initInput();
    resetCursors();
    initProf();
    initBridge();
    wireLifecycle();
    wireBackButton();
    document.addEventListener("visibilitychange", onVisibilityChange);
    requestAnimationFrame(frame);
    if(json === undefined){
      var base = JSON.parse(JSON.stringify(state));
      load.then(function(late){
        if(late == null) return;
        try{ hydrateLate(late, base); applyState(); saveState(); }catch(e){}
      });
    }
  });
}
boot();
