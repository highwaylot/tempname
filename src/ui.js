// All DOM outside the canvas: HUD, overlays, panel, orientation guard, sound
// button, slot editor, controls, reset and mode picker. Element refs are
// filled in initUI(); nothing here runs at import time.
import { state, saveState, resetSettings, isMouseDevice } from './state.js';
import { audio, unlockMediaSession, startBeds, blip, thump, isAudioLive, audioStateName, duck } from './audio.js';
import { game, PHASE_READY, PHASE_RUN, PHASE_DEAD, setOneHand, getPendingOneHand, startRun, pauseRun, quitToTitle } from './game.js';
import { imgCache, ensureImage, clearImageCache } from './render.js';
import { loop, resetClock } from './loop.js';

// ===================== hud =====================
export var overlayReady = null;
export var overlayDead = null;
export var comboBadge = null;
export var comboNum = null;
export var comboMult = null;
var distVal = null;
var coinVal = null;
export var gauge = null;
var gaugeFill = null;
var gaugeNum = null;
var gaugeLabel = null;
var coinMult = null;
var statsEl = null;
var appEl = null;
export var GAUGE_C = 2 * Math.PI * 27;
// Last value written to each HUD field: the DOM is touched only on change,
// so a steady frame costs comparisons, not style invalidations. frame() and
// syncSoundBtn() are the only writers, so nothing ever resets these.
var hud = { off:null, num:null, hot:null, ready:null, mult:null, gh:null, sh:null, playing:null, label:null, dist:null, coins:null, sOn:null, live:null, aname:null, err:null, pb:null };
// CSS animation restarts without the remove / void offsetWidth / add reflow:
// alternate between two identical keyframe sets (cls and cls + "2").
// Idempotent per frame, so two same-frame strokes or threads still restart
// where a bare toggle would flip the class back to where it started.
var animFrame = { tick:-1, pop:-1 };
export function restartAnim(el, cls){
  if(animFrame[cls] === loop.frameNo) return;
  animFrame[cls] = loop.frameNo;
  var alt = cls + "2";
  if(el.classList.contains(cls)){ el.classList.remove(cls); el.classList.add(alt); }
  else { el.classList.remove(alt); el.classList.add(cls); }
}
export function resetComboStat(){ comboNum.textContent = "0"; comboMult.textContent = "×1"; }
var deadLabel = null;
var deadDist = null;
var deadCoins = null;
var deadBest = null;
var deadLoop = null;
var deadLife = null;
var deadLifeRun = null;
var deadLifeBlue = null;
var deadLifePurple = null;
var overlayPause = null;
var pauseBtn = null;
var pauseDist = null;
var pauseCoins = null;
var pauseCombo = null;
var lastHud = 0;

// Runs once per frame after update/draw.
export function syncHud(ts){
  // The exact toFixed(1) string is the key: the ring is not quantised to 1%.
  var c = Math.max(0, Math.min(1, game.charge));
  var off = (GAUGE_C * (1 - c)).toFixed(1);
  if(off !== hud.off){ hud.off = off; gaugeFill.style.strokeDashoffset = off; }
  var n = Math.round(game.charge*100);
  if(n !== hud.num){ hud.num = n; gaugeNum.textContent = n; }
  var hot = game.boost > 0;
  if(hot !== hud.hot){ hud.hot = hot; gauge.classList.toggle("hot", hot); }
  var ready = game.boost === 0 && game.charge >= 0.85;
  if(ready !== hud.ready){ hud.ready = ready; gauge.classList.toggle("ready", ready); }
  if(game.parallelOn !== hud.mult){ hud.mult = game.parallelOn; coinMult.hidden = !game.parallelOn; }
  var gh = game.phase === PHASE_DEAD;
  if(gh !== hud.gh){ hud.gh = gh; gauge.hidden = gh; }
  var sh = game.phase === PHASE_READY;
  if(sh !== hud.sh){ hud.sh = sh; statsEl.hidden = sh; }
  var pl = game.phase === PHASE_RUN;
  if(pl !== hud.playing){ hud.playing = pl; appEl.classList.toggle("playing", pl); }
  var showPauseBtn = game.phase === PHASE_RUN && !game.paused && game.dying === 0;
  if(showPauseBtn !== hud.pb){ hud.pb = showPauseBtn; pauseBtn.hidden = !showPauseBtn; }
  var lb = hot ? "LIT" : (game.charge < 0.03 ? "PUMP ↕" : "BOOST");
  if(lb !== hud.label){ hud.label = lb; gaugeLabel.textContent = lb; }
  if(ts - lastHud > 90){
    var d = Math.floor(game.dist);
    if(d !== hud.dist){ hud.dist = d; distVal.textContent = d; }
    if(game.coins !== hud.coins){ hud.coins = game.coins; coinVal.textContent = game.coins; }
    syncSoundBtn();
    lastHud = ts;
  }
}

// Show or hide an overlay: the class drives the fade and visibility, inert
// takes it out of focus and the accessibility tree at once.
export function setOverlay(el, shown){
  el.classList.toggle("gone", !shown);
  if(shown) el.removeAttribute("inert"); else el.setAttribute("inert", "");
}

// The DOM half of finishDeath().
export function showDeath(score, isRecord){
  deadLabel.textContent = isRecord ? "new best" : "crashed";
  deadLabel.classList.toggle("record", !!isRecord);
  deadDist.textContent = score;
  deadCoins.textContent = game.coins;
  deadBest.textContent = state.best;
  // Leave a concrete, nearly-finished goal on the table.
  var toNext = 5 - (game.bestCombo % 5);
  var nextMult = 2 + Math.floor(game.bestCombo/5);
  var gap = state.best - score;
  // Replace, not append: three clauses wrap to three lines at the 34ch width.
  // A record is carried by the label above, not repeated here.
  deadLoop.textContent = (gap > 0 ? gap + " short of your best · " : "")
    + (state.taughtPump ? toNext + " more clean to ×" + nextMult : "pump ↕ to charge");
  // Lifetime line, only once a rare coin has ever been taken.
  var life = state.life;
  deadLife.hidden = life.blues + life.purples === 0;
  deadLifeRun.textContent = life.runs;
  deadLifeBlue.textContent = life.blues;
  deadLifePurple.textContent = life.purples;
  setOverlay(overlayDead, true);
}
// The DOM half of pauseRun() / resumeRun().
export function showPause(dist, coins, combo){
  pauseDist.textContent = dist;
  pauseCoins.textContent = coins;
  pauseCombo.textContent = combo;
  setOverlay(overlayPause, true);
}
export function hidePause(){ setOverlay(overlayPause, false); }

// ===================== panel =====================
var panel = null;
var panelToggle = null;
var scrim = null;
var panelOpen = false;
// Opening settings mid-run pauses the run; closing gives a beat of grace.
export function openPanel(){
  panelOpen = true;
  panel.hidden = false; scrim.hidden = false;
  panelToggle.setAttribute("aria-expanded","true");
  if(game.phase === PHASE_RUN) game.paused = true;
}
export function closePanel(){
  panelOpen = false;
  panel.hidden = true; scrim.hidden = true;
  panelToggle.setAttribute("aria-expanded","false");
  // A user pause stays: closing the sheet returns to the pause card.
  if(game.paused && game.pausedBy !== "user" && !document.hidden){ game.paused = false; game.grace = 0.8; resetClock(); }
}
export function isPanelOpen(){ return panelOpen; }

// Portrait only on phones. Desktop windows are landscape by nature, so the
// guard needs a touch screen and a short viewport, not just orientation.
var rotateOverlay = null;
var landscapeMq = null;
function checkOrientation(){
  var bad = landscapeMq.matches && ("ontouchstart" in window);
  rotateOverlay.hidden = !bad;
  if(bad && game.phase === PHASE_RUN) game.paused = true;
  else if(!bad && game.paused && game.pausedBy !== "user" && !panelOpen && !document.hidden){ game.paused = false; game.grace = 0.8; resetClock(); }
}
export function isRotateShown(){ return !rotateOverlay.hidden; }

var soundBtn = null;
var waveOn = null;
var waveOff = null;
var audioStatus = null;
var errStatus = null;
export function syncSoundBtn(){
  if(!soundBtn) return;
  var live = isAudioLive(), an = state.soundOn ? audioStateName() : "muted";
  if(hud.sOn === state.soundOn && hud.live === live && hud.aname === an && hud.err === loop.errCount) return;
  hud.sOn = state.soundOn; hud.live = live; hud.aname = an; hud.err = loop.errCount;
  waveOn.style.display = state.soundOn ? "" : "none";
  waveOff.style.display = state.soundOn ? "none" : "";
  soundBtn.classList.toggle("muted", !state.soundOn);
  soundBtn.classList.toggle("live", live);
  soundBtn.setAttribute("aria-label", state.soundOn ? "Mute sound" : "Unmute sound");
  if(audioStatus){
    audioStatus.textContent = an;
  }
  if(errStatus){
    errStatus.textContent = loop.errCount
      ? "· " + loop.errCount + " frame error" + (loop.errCount > 1 ? "s" : "") + ": " + loop.lastErr
      : "";
  }
}

var slotList = null;
function fileToDataUrl(file, cb){
  var reader = new FileReader();
  reader.onload = function(){
    var img = new Image();
    img.onload = function(){
      var size = 160;
      var c = document.createElement("canvas");
      c.width = size; c.height = size;
      var cc = c.getContext("2d");
      var scale = Math.max(size/img.naturalWidth, size/img.naturalHeight);
      var dw = img.naturalWidth*scale, dh = img.naturalHeight*scale;
      cc.drawImage(img, (size-dw)/2, (size-dh)/2, dw, dh);
      cb(c.toDataURL("image/jpeg", 0.86));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
export function renderSides(){
  slotList.innerHTML = "";
  state.slots.forEach(function(slot, idx){
    if(state.oneHand && idx === 1) return;
    var row = document.createElement("div"); row.className = "slot-row";
    var top = document.createElement("div"); top.className = "slot-row-top";
    var dot = document.createElement("div"); dot.className = "slot-dot";
    dot.style.setProperty("--dot-color", slot.color);
    dot.style.background = slot.mode === "image" ? "linear-gradient(135deg,#666,#333)" : slot.color;
    var label = document.createElement("div"); label.className = "slot-label";
    label.textContent = state.oneHand ? "THUMB" : ((idx === 0 ? "LEFT" : "RIGHT") + " THUMB");
    top.appendChild(dot); top.appendChild(label);
    row.appendChild(top);

    var seg = document.createElement("div"); seg.className = "seg";
    ["color","image"].forEach(function(mode){
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = mode === "color" ? "Color" : "Image";
      if(slot.mode === mode) b.classList.add("active");
      b.addEventListener("click", function(){ slot.mode = mode; saveState(); renderSides(); });
      seg.appendChild(b);
    });
    row.appendChild(seg);

    var line = document.createElement("div"); line.className = "row-line";
    if(slot.mode === "color"){
      var ci = document.createElement("input");
      ci.type = "color"; ci.value = slot.color;
      ci.addEventListener("input", function(){
        slot.color = ci.value;
        dot.style.setProperty("--dot-color", slot.color);
        dot.style.background = slot.color;
        saveState();
      });
      var ss = document.createElement("select");
      [["circle","Circle"],["ring","Ring"],["star","Star"],["diamond","Diamond"]].forEach(function(o){
        var opt = document.createElement("option");
        opt.value = o[0]; opt.textContent = o[1];
        if(slot.shape === o[0]) opt.selected = true;
        ss.appendChild(opt);
      });
      ss.addEventListener("change", function(){ slot.shape = ss.value; saveState(); });
      line.appendChild(ci); line.appendChild(ss);
    } else {
      var fw = document.createElement("div"); fw.className = "file-btn";
      var fid = "file-" + slot.id;
      var fl = document.createElement("label");
      fl.setAttribute("for", fid);
      fl.textContent = slot.image ? "Change image" : "Upload image";
      var fi = document.createElement("input");
      fi.type = "file"; fi.accept = "image/*"; fi.id = fid;
      fi.addEventListener("change", function(){
        if(!fi.files || !fi.files[0]) return;
        fileToDataUrl(fi.files[0], function(url){
          slot.image = url; imgCache[slot.id] = null; ensureImage(slot);
          saveState(); renderSides();
        });
      });
      fw.appendChild(fl); fw.appendChild(fi);
      line.appendChild(fw);
      if(slot.image){
        var th = document.createElement("img");
        th.className = "thumb"; th.src = slot.image; th.alt = "";
        line.appendChild(th);
      }
    }
    row.appendChild(line);
    slotList.appendChild(row);
  });
}

var soundToggle = null;
var volumeRange = null;
var volumeVal = null;
var impactRange = null;
var impactVal = null;
var trailRange = null;
var trailVal = null;
var glowRange = null;
var glowVal = null;
var followRange = null;
var followVal = null;
var gridToggle = null;
var fftToggle = null;
var hapticToggle = null;
var autoPauseToggle = null;

export function syncControls(){
  soundToggle.checked = state.soundOn;
  volumeRange.value = Math.round(state.volume*100);
  volumeVal.textContent = Math.round(state.volume*100) + "%";
  impactRange.value = Math.round(state.impact*100);
  impactVal.textContent = Math.round(state.impact*100) + "%";
  trailRange.value = state.trailLength; trailVal.textContent = state.trailLength;
  glowRange.value = state.glow; glowVal.textContent = state.glow;
  followRange.value = state.follow; followVal.textContent = state.follow;
  gridToggle.checked = state.grid;
  fftToggle.checked = state.fft;
  hapticToggle.checked = state.haptics;
  autoPauseToggle.checked = state.autoPause;
  syncSoundBtn();
}

// Two taps to reset, and the high score is earned so it survives.
var resetBtn = null;
var resetArmed = 0;
function disarmReset(){
  if(resetArmed){ clearTimeout(resetArmed); resetArmed = 0; }
  resetBtn.classList.remove("armed");
  resetBtn.textContent = "reset settings";
}

var modeSeg = null;
var oneHandToggle = null;
var modeNote = null;
var readyCta = null;
var deadCta = null;
var pauseCta = null;
export function syncOneHand(){
  // The picker shows the choice, live or queued for the next run; the CTAs
  // describe the mode the next start is actually gated on.
  var pending = getPendingOneHand();
  var chosen = pending != null ? pending : state.oneHand;
  modeSeg.querySelectorAll("button").forEach(function(b){
    b.classList.toggle("active", (b.dataset.mode === "one") === chosen);
  });
  oneHandToggle.checked = chosen;
  modeNote.hidden = pending == null;
  readyCta.textContent = state.oneHand
    ? (isMouseDevice ? "click to start" : "thumb down")
    : "both thumbs down";
  deadCta.textContent = state.oneHand
    ? (isMouseDevice ? "click to run again" : "thumb down to run again")
    : "both thumbs to run again";
  pauseCta.textContent = state.oneHand
    ? (isMouseDevice ? "click to resume" : "thumb down to resume")
    : "both thumbs down to resume";
  var twoBtn = modeSeg.querySelector('[data-mode="two"]');
  if(twoBtn) twoBtn.title = isMouseDevice ? "needs a touchscreen" : "";
  renderSides();
}

export function initUI(){
  overlayReady = document.getElementById("overlayReady");
  overlayDead = document.getElementById("overlayDead");
  comboBadge = document.getElementById("comboStat");
  comboNum = document.getElementById("comboNum");
  comboMult = document.getElementById("comboMult");
  distVal = document.getElementById("distVal");
  coinVal = document.getElementById("coinVal");
  gauge = document.getElementById("gauge");
  gaugeFill = document.getElementById("gaugeFill");
  gaugeNum = document.getElementById("gaugeNum");
  gaugeLabel = document.getElementById("gaugeLabel");
  coinMult = document.getElementById("coinMult");
  statsEl = document.querySelector(".stats");
  appEl = document.querySelector(".app");
  deadLabel = document.getElementById("deadLabel");
  deadDist = document.getElementById("deadDist");
  deadCoins = document.getElementById("deadCoins");
  deadBest = document.getElementById("deadBest");
  deadLoop = document.getElementById("deadLoop");
  deadLife = document.getElementById("deadLife");
  deadLifeRun = document.getElementById("deadLifeRun");
  deadLifeBlue = document.getElementById("deadLifeBlue");
  deadLifePurple = document.getElementById("deadLifePurple");
  overlayPause = document.getElementById("overlayPause");
  pauseBtn = document.getElementById("pauseBtn");
  pauseDist = document.getElementById("pauseDist");
  pauseCoins = document.getElementById("pauseCoins");
  pauseCombo = document.getElementById("pauseCombo");
  pauseBtn.addEventListener("click", pauseRun);
  document.getElementById("pauseRestart").addEventListener("click", function(){
    hidePause(); game.paused = false; resetClock(); duck(false);
    startRun();
  });
  document.getElementById("pauseQuit").addEventListener("click", quitToTitle);
  // closePanel leaves a user pause alone, so this returns to the pause card.
  document.getElementById("pauseSettings").addEventListener("click", function(){ openPanel(); });

  panel = document.getElementById("panel");
  panelToggle = document.getElementById("panelToggle");
  scrim = document.getElementById("scrim");
  document.getElementById("panelClose").addEventListener("click", closePanel);
  scrim.addEventListener("click", closePanel);
  panelToggle.addEventListener("click", function(){ panelOpen ? closePanel() : openPanel(); });

  rotateOverlay = document.getElementById("rotateOverlay");
  landscapeMq = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
  if(landscapeMq.addEventListener) landscapeMq.addEventListener("change", checkOrientation);
  else if(landscapeMq.addListener) landscapeMq.addListener(checkOrientation);
  checkOrientation();

  soundBtn = document.getElementById("soundBtn");
  waveOn = document.getElementById("waveOn");
  waveOff = document.getElementById("waveOff");
  audioStatus = document.getElementById("audioStatus");
  errStatus = document.getElementById("errStatus");
  soundBtn.addEventListener("click", function(){
    state.soundOn = !state.soundOn;
    if(state.soundOn){
      unlockMediaSession();
      startBeds();
      blip(660, 0.22, "triangle", 0.3);
    }
    if(audio.master && audio.ctx){
      audio.master.gain.setTargetAtTime(state.soundOn ? state.volume : 0.0001, audio.ctx.currentTime, 0.05);
    }
    soundToggle.checked = state.soundOn;
    syncSoundBtn();
    saveState();
  });

  slotList = document.getElementById("slotList");

  soundToggle = document.getElementById("soundToggle");
  volumeRange = document.getElementById("volumeRange");
  volumeVal = document.getElementById("volumeVal");
  impactRange = document.getElementById("impactRange");
  impactVal = document.getElementById("impactVal");
  trailRange = document.getElementById("trailRange");
  trailVal = document.getElementById("trailVal");
  glowRange = document.getElementById("glowRange");
  glowVal = document.getElementById("glowVal");
  followRange = document.getElementById("followRange");
  followVal = document.getElementById("followVal");
  gridToggle = document.getElementById("gridToggle");
  fftToggle = document.getElementById("fftToggle");
  hapticToggle = document.getElementById("hapticToggle");
  autoPauseToggle = document.getElementById("autoPauseToggle");
  soundToggle.addEventListener("change", function(){
    state.soundOn = soundToggle.checked;
    if(state.soundOn) startBeds();
    if(audio.master && audio.ctx){
      audio.master.gain.setTargetAtTime(state.soundOn ? state.volume : 0.0001, audio.ctx.currentTime, 0.05);
    }
    syncSoundBtn();
    saveState();
  });
  volumeRange.addEventListener("input", function(){
    state.volume = parseInt(volumeRange.value,10)/100;
    volumeVal.textContent = Math.round(state.volume*100) + "%";
    if(audio.master && audio.ctx && state.soundOn){
      audio.master.gain.setTargetAtTime(state.volume, audio.ctx.currentTime, 0.05);
    }
    saveState();
  });
  impactRange.addEventListener("input", function(){
    state.impact = parseInt(impactRange.value,10)/100;
    impactVal.textContent = Math.round(state.impact*100) + "%";
    saveState();
  });
  impactRange.addEventListener("change", function(){ thump(220, 0.11, 0.32); });
  trailRange.addEventListener("input", function(){
    state.trailLength = parseInt(trailRange.value,10);
    trailVal.textContent = state.trailLength; saveState();
  });
  glowRange.addEventListener("input", function(){
    state.glow = parseInt(glowRange.value,10);
    glowVal.textContent = state.glow; saveState();
  });
  followRange.addEventListener("input", function(){
    state.follow = parseInt(followRange.value,10);
    followVal.textContent = state.follow; saveState();
  });
  gridToggle.addEventListener("change", function(){ state.grid = gridToggle.checked; saveState(); });
  fftToggle.addEventListener("change", function(){ state.fft = fftToggle.checked; saveState(); });
  hapticToggle.addEventListener("change", function(){ state.haptics = hapticToggle.checked; saveState(); });
  autoPauseToggle.addEventListener("change", function(){ state.autoPause = autoPauseToggle.checked; saveState(); });

  resetBtn = document.getElementById("resetBtn");
  resetBtn.addEventListener("click", function(){
    if(!resetArmed){
      resetBtn.classList.add("armed");
      resetBtn.textContent = "tap again to reset";
      resetArmed = setTimeout(disarmReset, 3000);
      return;
    }
    disarmReset();
    resetSettings();
    clearImageCache();
    renderSides(); syncControls(); syncOneHand();
  });

  modeSeg = document.getElementById("modeSeg");
  oneHandToggle = document.getElementById("oneHandToggle");
  modeNote = document.getElementById("modeNote");
  readyCta = document.getElementById("readyCta");
  deadCta = document.getElementById("deadCta");
  pauseCta = document.getElementById("pauseCta");
  modeSeg.querySelectorAll("button").forEach(function(b){
    b.addEventListener("click", function(){ setOneHand(b.dataset.mode === "one"); });
  });
  oneHandToggle.addEventListener("change", function(){ setOneHand(oneHandToggle.checked); });

  renderSides();
  syncControls();
  syncOneHand();
}
