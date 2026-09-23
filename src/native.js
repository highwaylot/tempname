// Platform bridge. Web only for now: persisted settings come straight from
// localStorage, and a later step routes native builds through Capacitor.
import { STORE_KEY, state } from './state.js';

export var isNative = false;
export var platform = "web";

// Resolves the raw persisted string, or null when there is none or storage
// is unavailable.
export function loadPersisted(){
  var raw = null;
  try{ raw = localStorage.getItem(STORE_KEY); }catch(e){}
  return Promise.resolve(raw);
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
