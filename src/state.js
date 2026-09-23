// Settings + persistence. Nothing here touches the DOM or storage at import
// time: main.js calls hydrateState(json) with whatever native.loadPersisted()
// resolved, and this module fills the exported state object in place.

// v4: the key carries the schema version. A v3 blob under the old key is
// read once (native.loadPersisted) and written back under the new key on the
// first save; the old key is left in place, never deleted.
export var STORE_KEY = "belltheory.v4";
export var OLD_KEY = "thumbtone.v3";
export var reduceMotion = false;

// ===================== settings =====================
export function defaultState(){
  return {
    v: 4,
    slots: [
      { id:"left",  mode:"color", color:"#ffb454", shape:"circle", image:null },
      { id:"right", mode:"color", color:"#5ec8ff", shape:"circle", image:null }
    ],
    soundOn: true,
    volume: 0.75,
    trailLength: 18,
    glow: 20,
    follow: 26,
    grid: true,
    fft: true,
    haptics: true,
    best: 0,
    taughtPump: false,
    impact: 1.2,
    oneHand: false,
    autoPause: true,
    autoFx: true,
    // Lifetime counters: runs is counted at startRun (a mid-run kill still
    // counts, and the unlock gate reads it), the coins in collectSpecial.
    life: { runs:0, blues:0, purples:0 }
  };
}
function loadState(raw){
  try{
    if(!raw) return defaultState();
    var parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.slots) || parsed.slots.length !== 2) return defaultState();
    var merged = defaultState();
    // The whitelist is defaultState() itself: a key the defaults do not
    // carry is dropped, a missing one keeps its default, v is never copied.
    Object.keys(merged).forEach(function(k){
      if(k === "v" || k === "slots") return;
      if(parsed[k] == null) return;
      if(k === "life") Object.assign(merged.life, parsed.life);
      else merged[k] = parsed[k];
    });
    merged.slots = parsed.slots;
    return merged;
  }catch(e){ return defaultState(); }
}
// STORE_KEY only: the v3 key is never rewritten.
export function saveState(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }catch(e){}
}
// The one settings object every module shares. It is filled in place, so a
// reference taken by any module stays valid across hydrate and reset.
export var state = {};
function replaceState(next){
  Object.keys(state).forEach(function(k){ delete state[k]; });
  Object.keys(next).forEach(function(k){ state[k] = next[k]; });
}

// A mouse is one pointer; two-thumb mode cannot start with it. First visit
// on a mouse device defaults to one thumb. A saved choice is never overridden.
export var isMouseDevice = false;

// json is the raw persisted string (or null). Media queries are read here
// rather than at import so the module loads anywhere.
export function hydrateState(json){
  reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  isMouseDevice = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) && !("ontouchstart" in window);
  replaceState(loadState(json));
  var fresh = !json;
  if(fresh && isMouseDevice){ state.oneHand = true; saveState(); }
}

// The high score and the lifetime counters are earned so they survive a
// reset. The caller re-renders.
export function resetSettings(){
  var keepBest = state.best, keepLife = state.life;
  replaceState(defaultState());
  state.best = keepBest;
  state.life = keepLife;
  saveState();
}
