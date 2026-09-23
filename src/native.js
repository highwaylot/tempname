// Platform bridge. Web only for now: persisted settings come straight from
// localStorage, and a later step routes native builds through Capacitor.
import { STORE_KEY, OLD_KEY, state } from './state.js';

export var isNative = false;
export var platform = "web";

// Resolves the raw persisted string, or null when there is none or storage
// is unavailable. The v3 key is the one-time migration source: read when
// the v4 key is absent, and left in place.
export function loadPersisted(){
  var raw = null;
  try{ raw = localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_KEY); }catch(e){}
  return Promise.resolve(raw);
}

// ===================== entitlement =====================
// The unlock gate: the complete game for the first FREE_RUNS runs, then one
// purchase. Inert until the StoreKit 2 plugin lands: web and native both
// default to unlocked, the plugin will set it from Transaction
// .currentEntitlements, and "unlocked" is never persisted in the settings
// blob. window.__BT_UNLOCKED === false (read in initNative) forces the gate
// so the harness and scratch tests can exercise it. price is the wrapper's
// localised string; the label is never a hardcoded amount.
export var ent = {
  FREE_RUNS: 15,
  unlocked: true,
  price: null,
  onUnlock: null,
  onRestore: null,
  runsLeft: function(){ return this.unlocked ? Infinity : Math.max(0, this.FREE_RUNS - state.life.runs); },
  canRun: function(){ return this.runsLeft() > 0; },
  purchase: function(){ /* web stub: no-op; StoreKit plugin next round */ if(this.onUnlock) this.onUnlock(); },
  restore: function(){ if(this.onRestore) this.onRestore(); }
};
// Called from boot after hydrateState, before initUI renders the gate.
export function initNative(){
  if(window.__BT_UNLOCKED === false) ent.unlocked = false;
}

// ===================== haptics =====================
// One call per game moment, by kind. On the web each kind is a Vibration
// API pattern (ms on/off; a number is one pulse); the native
// lane routes the same kinds through Capacitor Haptics. "smash" scales with
// the hit's power instead of a fixed pattern. "record" is reserved for the
// new-best moment (no caller yet).
var HAPTIC_WEB = {
  tap: 8,
  die: [30,40,60],
  storm: [30,40,60,40,80],
  purple: [20,40,30,40,60],
  blue: [12,30,24],
  combo: 18,
  surge: [10,30,22],
  ignite: [18,40,60],
  empty: 12,
  crunch: [12,20,30],
  record: [20,40,20,40,60]
};
export function haptic(kind, power){
  if(!state.haptics) return;
  if(!isNative){
    if(!("vibrate" in navigator)) return;
    var pattern = kind === "smash" ? 14 + Math.round(power*20) : HAPTIC_WEB[kind];
    if(pattern == null) return;
    try{ navigator.vibrate(pattern); }catch(e){}
    return;
  }
}
