import { state } from './state.js';
import { world } from './world.js';
import { syncSoundBtn } from './ui.js';

// ===================== audio (ported + trimmed) =====================
export var audio = {
  ctx:null, master:null, comp:null, click:null, analyser:null, freqData:null, binIndex:null,
  droneGain:null, noiseGain:null, noiseFilter:null, started:false, soundOffAt:0,
  drone:null, noisePCM:null, noiseBuf:null
};
// The graph is built at load in idle time so the first touch only resumes
// the context and starts the sources: the context + static graph, the four
// drone voices (created, not started) and the noise PCM. Nothing sounds
// before the gesture: the context is suspended until a resume() from one,
// and no source node is started here. On a muted start only the PCM is
// prepared (no context without the user asking for sound).
export function initAudio(){
  var idle = window.requestIdleCallback || function(cb){ return setTimeout(function(){ cb(); }, 0); };
  idle(function(){
    if(state.soundOn && !audio.started){
      var c = ensureAudio();
      if(c) buildDroneVoices(c);
    }
    if(!audio.started) prepNoise((audio.ctx && audio.ctx.sampleRate) || 44100);
  });
}
// The four drone stacks (osc -> voice -> droneGain, lfo -> lfoGain -> detune),
// created but not started; startBeds starts them. Idempotent.
function buildDroneVoices(ctx){
  if(audio.drone) return;
  audio.drone = [];
  // Weighted an octave above loom's original 110/165/220 stack: phone speakers
  // roll off below ~200Hz, so the loudest voice there was inaudible on mobile.
  [[110,0.3],[220,1.0],[330,0.7],[440,0.45]].forEach(function(pair){
    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = pair[0];
    var voice = ctx.createGain();
    voice.gain.value = pair[1];
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random()*0.05;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain); lfoGain.connect(osc.detune);
    osc.connect(voice); voice.connect(audio.droneGain);
    audio.drone.push([osc, lfo]);
  });
}
// 2 s of white noise as a Float32Array (xorshift: no Math.random call per
// sample, and copyToChannel into the AudioBuffer later is one memcpy).
function prepNoise(sr){
  if(audio.noisePCM && audio.noisePCM.length === 2*sr) return;
  var n = 2*sr, pcm = new Float32Array(n), s = 0x9e3779b9|0;
  for(var i=0;i<n;i++){ s ^= s<<13; s ^= s>>>17; s ^= s<<5; pcm[i] = (s>>>0)/2147483648 - 1; }
  audio.noisePCM = pcm;
}

// iOS routes raw Web Audio through a session category that the hardware
// silent switch mutes. An actually-playing HTMLAudioElement flips the
// webview into media playback, which ignores the switch. Best-effort.
var unlockEl = null;
function silentWavUrl(){
  var sr = 8000, n = sr/2;
  var buf = new ArrayBuffer(44 + n*2);
  var v = new DataView(buf);
  function str(o,s){ for(var i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); }
  str(0,"RIFF"); v.setUint32(4, 36+n*2, true); str(8,"WAVE");
  str(12,"fmt "); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  str(36,"data"); v.setUint32(40, n*2, true);
  return URL.createObjectURL(new Blob([buf], { type:"audio/wav" }));
}
export function unlockMediaSession(){
  if(unlockEl) return;
  try{
    unlockEl = new Audio(silentWavUrl());
    unlockEl.loop = true;
    unlockEl.playsInline = true;
    unlockEl.volume = 0.01;
    var p = unlockEl.play();
    if(p && p.catch) p.catch(function(){});
  }catch(e){}
}
export function audioStateName(){
  if(!audio.ctx || !audio.started) return "not started";
  return audio.ctx.state;
}
export function isAudioLive(){
  return !!(audio.ctx && audio.ctx.state === "running" && audio.started && state.soundOn);
}

export function ensureAudio(){
  if(!state.soundOn) return null;
  if(!audio.ctx){
    try{ audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return null; }
    var ctx = audio.ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = state.volume;
    audio.analyser = ctx.createAnalyser();
    audio.analyser.fftSize = 512;
    audio.freqData = new Uint8Array(audio.analyser.frequencyBinCount);
    // Bar -> bin table for the spectrum, computed once instead of a pow per
    // bar per frame.
    audio.binIndex = new Uint8Array(40);
    for(var i=0;i<40;i++) audio.binIndex[i] = 1 + Math.floor(Math.pow(i/40, 1.8) * 70);
    // Compressor lets impact hits run hot without hard clipping, and ducks
    // the bed under each hit, which itself reads as more impact.
    audio.comp = ctx.createDynamicsCompressor();
    audio.comp.threshold.value = -14;
    audio.comp.knee.value = 8;
    audio.comp.ratio.value = 5;
    audio.comp.attack.value = 0.003;
    audio.comp.release.value = 0.12;
    // The analyser taps the master only while the bars are on (the fft
    // toggle connects and disconnects it).
    if(state.fft) audio.master.connect(audio.analyser);
    audio.master.connect(audio.comp);
    audio.comp.connect(ctx.destination);

    audio.droneGain = ctx.createGain();
    audio.droneGain.gain.value = 0.22;
    audio.droneGain.connect(audio.master);

    audio.noiseFilter = ctx.createBiquadFilter();
    audio.noiseFilter.type = "bandpass";
    audio.noiseFilter.frequency.value = 3000;
    audio.noiseFilter.Q.value = 0.6;
    audio.noiseGain = ctx.createGain();
    audio.noiseGain.gain.value = 0.0;
    audio.noiseFilter.connect(audio.noiseGain);
    audio.noiseGain.connect(audio.master);
  }
  // A hidden page must stay suspended: visibilitychange suspends the context,
  // and a resume() from a queued sound would otherwise bring it back while
  // the tab is in the background.
  if(audio.ctx.state !== "running" && !document.hidden){
    var r = audio.ctx.resume();
    if(r && r.catch) r.catch(function(){});
  }
  return audio.ctx;
}
export function startBeds(){
  var ctx = ensureAudio();
  if(!ctx || audio.started) return;
  audio.started = true;
  driveAcc = 1; lastNF = -1; lastNG = -1; lastDG = -1;
  // Both builders are no-ops when the idle prebuild already ran; they are
  // the fallback for a touch that lands before it, and for the sound-off-
  // then-on path.
  buildDroneVoices(ctx);
  audio.drone.forEach(function(pair){ pair[1].start(); pair[0].start(); });
  prepNoise(ctx.sampleRate);
  var buf = ctx.createBuffer(1, audio.noisePCM.length, ctx.sampleRate);
  buf.copyToChannel(audio.noisePCM, 0);
  audio.noiseBuf = buf;
  audio.noisePCM = null;
  var src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  src.connect(audio.noiseFilter);
  src.start();
  // Mid-range confirmation chirp: far easier to hear on a phone speaker than
  // the drone, so it separates "no audio at all" from "bed is too quiet".
  blip(660, 0.22, "triangle", 0.3);
  syncSoundBtn();
}
// The beds follow the world at 10 Hz: the targets move on a ~1 s time
// constant, so three setTargetAtTime calls per frame (128 automation
// events/s at 42 fps) bought nothing. Accumulates the unscaled dt; a param is written only when its
// target moved (> 1 Hz / > 0.0003). startBeds resets the four.
var driveAcc = 1, lastNF = -1, lastNG = -1, lastDG = -1;
export function driveAudio(dt){
  if(!audio.ctx || !audio.started) return;
  driveAcc += dt;
  if(driveAcc < 0.1) return;
  driveAcc = 0;
  var t = audio.ctx.currentTime;
  var nf = 1400 + world.warmth*4200;
  var ng = 0.04 + world.entropy*0.24;
  var dg = 0.12 + world.warmth*0.12;
  if(Math.abs(nf - lastNF) > 1){ lastNF = nf; audio.noiseFilter.frequency.setTargetAtTime(nf, t, 0.35); }
  if(Math.abs(ng - lastNG) > 0.0003){ lastNG = ng; audio.noiseGain.gain.setTargetAtTime(ng, t, 0.4); }
  if(Math.abs(dg - lastDG) > 0.0003){ lastDG = dg; audio.droneGain.gain.setTargetAtTime(dg, t, 0.6); }
}
export function blip(freq, dur, type, vol){
  var ctx = ensureAudio();
  if(!ctx) return;
  blipAt(ctx.currentTime, freq, dur, type, vol);
}
// blip with an explicit start time on the audio clock, so a sequence of
// notes keeps its spacing whatever the main thread is doing.
export function blipAt(t, freq, dur, type, vol){
  var ctx = ensureAudio();
  if(!ctx) return;
  var osc = ctx.createOscillator();
  var g = ctx.createGain();
  osc.type = type || "triangle";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq*1.6, t + dur*0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(audio.master);
  osc.start(t); osc.stop(t + dur + 0.02);
}
// Impact hit, tuned for speaker-to-chassis coupling: a lowpassed square
// gives a strong fundamental plus odd harmonics in the band a phone driver
// can actually push, and at high volume that buzzes the frame. Pitch stays
// in that band instead of sweeping below it. Scaled by the Impact setting.
export function thump(freq, dur, vol){
  var ctx = ensureAudio();
  if(!ctx) return;
  var t = ctx.currentTime;
  var v = vol * (state.impact || 1);
  var osc = ctx.createOscillator();
  var lp = ctx.createBiquadFilter();
  var g = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(120, freq*0.7), t + dur);
  lp.type = "lowpass"; lp.frequency.value = 1400; lp.Q.value = 0.7;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp); lp.connect(g); g.connect(audio.master);
  osc.start(t); osc.stop(t + dur + 0.02);

  if(!audio.click){
    var n = Math.floor(ctx.sampleRate * 0.012);
    audio.click = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = audio.click.getChannelData(0);
    for(var i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
  }
  var src = ctx.createBufferSource();
  src.buffer = audio.click;
  var bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.2;
  var ng = ctx.createGain(); ng.gain.value = v*0.6;
  src.connect(bp); bp.connect(ng); ng.connect(audio.master);
  src.start(t);
}
export function crashSound(){
  var ctx = ensureAudio();
  if(!ctx) return;
  var t = ctx.currentTime;
  var osc = ctx.createOscillator();
  var g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(g); g.connect(audio.master);
  osc.start(t); osc.stop(t + 0.65);

  var size = Math.floor(ctx.sampleRate * 0.35);
  var buf = ctx.createBuffer(1, size, ctx.sampleRate);
  var d = buf.getChannelData(0);
  for(var i=0;i<size;i++) d[i] = (Math.random()*2-1) * (1 - i/size);
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 900;
  var ng = ctx.createGain(); ng.gain.value = 0.32;
  src.connect(lp); lp.connect(ng); ng.connect(audio.master);
  src.start(t);
}

// Staggered notes. A chord reads as a hit; an arpeggio reads as a reward.
// Every note is scheduled on the audio clock up front: a setTimeout per note
// jittered with the frame loop (0-150 ms gaps at 6x) and could resume a
// context the hidden page had just suspended.
export function arp(freqs, gapMs, type, vol){
  var ctx = ensureAudio();
  if(!ctx) return;
  var t0 = ctx.currentTime;
  for(var i=0;i<freqs.length;i++) blipAt(t0 + i*gapMs/1000, freqs[i], 0.18, type, vol);
}
