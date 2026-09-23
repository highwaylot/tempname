// Platform bridge. On the web the persisted settings come straight from
// localStorage; in a Capacitor shell Preferences holds the durable copy and
// localStorage is the synchronous cache (a WebView can evict it).
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { STORE_KEY, OLD_KEY, state } from './state.js';

export var isNative = Capacitor.isNativePlatform();
export var platform = Capacitor.getPlatform();

// ===================== persistence =====================
// Every Preferences write is chained on this, so a slow get can never be
// overtaken by a write of the defaults.
var loaded = Promise.resolve();
// Resolves the raw persisted string, or null when there is none or storage
// is unavailable. The v3 key is the one-time migration source: read when
// the v4 key is absent, and left in place. Native: Preferences first; a
// local copy with nothing durable yet is migrated up. No Preferences
// .migrate()/removeOld(): the schema key does the versioning.
export function loadPersisted(){
  var local = null;
  try{ local = localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_KEY); }catch(e){}
  if(!isNative) return Promise.resolve(local);
  loaded = Preferences.get({ key: STORE_KEY }).then(function(r){
    if(r.value != null) return r.value;
    if(local != null) return Preferences.set({ key: STORE_KEY, value: local }).then(function(){ return local; });
    return null;
  }).catch(function(){ return local; });
  return loaded;
}
// Debounced bridge write: 61 slider ticks are one Preferences.set. flush()
// runs on the timer, on the page going hidden and on the App pause event,
// so the best score written on death survives an immediate home press.
var pending = null, pendingValue = null;
function flush(){
  if(pendingValue == null) return;
  var value = pendingValue;
  pendingValue = null;
  if(pending){ clearTimeout(pending); pending = null; }
  loaded.then(function(){ return Preferences.set({ key: STORE_KEY, value: value }); }).catch(function(){});
}
export function save(value){
  if(!isNative) return;
  pendingValue = value;
  if(!pending) pending = setTimeout(flush, 250);
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
  if(isNative){
    document.addEventListener("visibilitychange", function(){ if(document.hidden) flush(); });
    App.addListener("pause", flush);
  }
}

// ===================== android back =====================
// Hardware/gesture back, in order: close the settings sheet; mid-run (and
// not behind the rotate guard) open it, which pauses; otherwise send the
// app to the background. minimizeApp, never exitApp: the manifest's
// enableOnBackInvokedCallback (W27) gives the predictive-back animation.
// Reads window.BellTheory (main.js initBridge), so it must run after it.
export function wireBackButton(){
  if(Capacitor.getPlatform() !== 'android') return;
  App.addListener('backButton', function(){
    var g = window.BellTheory;
    if(!g){ App.minimizeApp(); return; }
    if(g.isPanelOpen()){ g.closePanel(); return; }
    if(g.phase() === g.PHASE_RUN && !g.rotateShown()){ g.openPanel(); return; }
    App.minimizeApp();
  });
}

// ===================== haptics =====================
// One call per game moment, by kind. On the web each kind is a Vibration
// API pattern (ms on/off; a number is one pulse); natively the same kinds
// go through Capacitor Haptics (system impact/notification generators,
// never Haptics.vibrate(): iOS allocates a CHHapticEngine per call).
// "smash" scales with the hit's power instead of a fixed pattern. "record"
// is the new-best moment.
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
// Native map: [rank, fn]. Kinds inside 40 ms of each other are de-duped by
// rank (a lower or equal rank yields to the one just played), so a coin
// taken on the frame of a smash never swallows the smash. Two-beat kinds
// schedule their second generator with a timer; the first promise is the
// one returned.
function impact(style){ return function(){ return Haptics.impact({ style: style }); }; }
function notify(type){ return function(){ return Haptics.notification({ type: type }); }; }
function twoBeat(first, second, ms){
  return function(){
    var p = first();
    setTimeout(function(){ try{ var q = second(); if(q && q.catch) q.catch(function(){}); }catch(e){} }, ms);
    return p;
  };
}
var MAP = {
  tap: [0, impact(ImpactStyle.Light)],
  combo: [1, impact(ImpactStyle.Light)],
  blue: [2, impact(ImpactStyle.Medium)],
  surge: [3, impact(ImpactStyle.Medium)],
  smash: [3, function(power){ return Haptics.impact({ style: power >= 0.5 ? ImpactStyle.Heavy : ImpactStyle.Medium }); }],
  empty: [3, notify(NotificationType.Warning)],
  crunch: [4, twoBeat(impact(ImpactStyle.Heavy), impact(ImpactStyle.Light), 60)],
  ignite: [5, notify(NotificationType.Success)],
  purple: [5, twoBeat(notify(NotificationType.Success), impact(ImpactStyle.Heavy), 90)],
  record: [5, twoBeat(notify(NotificationType.Success), impact(ImpactStyle.Heavy), 90)],
  storm: [6, twoBeat(impact(ImpactStyle.Heavy), notify(NotificationType.Success), 90)],
  die: [9, notify(NotificationType.Error)]
};
var lastAt = -1e9, lastRank = -1;
export function haptic(kind, power){
  if(!state.haptics) return;
  if(!isNative){
    if(!("vibrate" in navigator)) return;
    var pattern = kind === "smash" ? 14 + Math.round(power*20) : HAPTIC_WEB[kind];
    if(pattern == null) return;
    try{ navigator.vibrate(pattern); }catch(e){}
    return;
  }
  var e = MAP[kind];
  if(!e) return;
  var now = performance.now();
  if(now - lastAt < 40 && e[0] <= lastRank) return;
  lastAt = now; lastRank = e[0];
  try{ var p = e[1](power); if(p && p.catch) p.catch(function(){}); }catch(err){}
}
