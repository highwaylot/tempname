// Techno bed for the creator page, synthesized on the game's own audio
// context (no samples, so nothing to license or get claimed). 128 BPM, A
// minor, four bars A A F G. It follows the round:
//   intro  hats and a muffled bass, no kick: waiting for thumbs
//   build  the 3-2-1: a snare roll and a filter rise; GO lands on the drop
//   live   kick on every beat, offbeat bass that opens as the tank charges,
//          16th hats once the run is fast, claps from bar 3; while boosted
//          open hats and an acid arpeggio on top
//   drop   the crash (or TIME): the whole bed sinks and goes quiet
//   outro  back in, muffled, under the result and "who's next?" cards
// Scheduling is the usual Web Audio lookahead: tick(until) queues every 16th
// that starts before `until`, reading the round's state through getState().
// The same code renders offline (creator/music-demo.mjs).
export var BPM = 128;
export var BEAT = 60 / BPM;
var STEP = BEAT / 4;
export var BUILD_STEPS = 24;                 // 6 beats of 3-2-1
export var BUILD_SECS = BUILD_STEPS * STEP;  // 2.8125 s
var ROOTS = [45, 45, 41, 43];                // A2 A2 F2 G2 (MIDI), one per bar
var ARP = [0, 3, 7, 10, 12, 10, 7, 3, 0, 7, 12, 15, 12, 7, 3, 7];
function hz(m){ return 440 * Math.pow(2, (m - 69) / 12); }

export function createMusic(ctx, dest, getState){
  var bus = ctx.createGain(); bus.gain.value = 0;
  var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.7;
  bus.connect(lp); lp.connect(dest);
  var len = ctx.sampleRate, nb = ctx.createBuffer(1, len, ctx.sampleRate), nd = nb.getChannelData(0), x = 0x2545F491;
  for(var i = 0; i < len; i++){ x ^= x << 13; x ^= x >>> 17; x ^= x << 5; nd[i] = (x >>> 0) / 2147483648 - 1; }

  var scene = "off", step = 0, nextT = 0, wasLit = false, sceneAt = 0;
  function env(g, t, a, v, d){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(t, dur){ var s = ctx.createBufferSource(); s.buffer = nb; s.start(t, Math.random() * 0.5, dur + 0.05); return s; }
  function kick(t, v){
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    env(g, t, 0.003, v, 0.34); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4);
  }
  function hat(t, v, open){
    var s = noise(t, open ? 0.22 : 0.05), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "highpass"; f.frequency.value = open ? 6500 : 8000;
    env(g, t, 0.002, v, open ? 0.2 : 0.035); s.connect(f); f.connect(g); g.connect(bus);
  }
  function clap(t, v){
    var s = noise(t, 0.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach(function(d){ g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(v * 0.3, t + d + 0.009); });
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    s.connect(f); f.connect(g); g.connect(bus);
  }
  function bass(t, m, cut, v, dur){
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = hz(m);
    f.type = "lowpass"; f.Q.value = 4; f.frequency.setValueAtTime(cut * 2.2, t); f.frequency.exponentialRampToValueAtTime(cut, t + 0.09);
    env(g, t, 0.004, v, dur); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function lead(t, m, cut, v){
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "square"; o.frequency.value = hz(m);
    f.type = "lowpass"; f.Q.value = 9; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(300, cut * 0.35), t + 0.1);
    env(g, t, 0.003, v, 0.11); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.16);
  }
  function sweep(t, dur, from, to, v){
    var s = noise(t, dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "bandpass"; f.Q.value = 1.4; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
  }
  function cymbal(t, v){
    var s = noise(t, 1.3), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "highpass"; f.frequency.value = 4200;
    env(g, t, 0.004, v, 1.2); s.connect(f); f.connect(g); g.connect(bus);
  }

  function play(k, t){
    var st = getState(t), s = ((k % 16) + 16) % 16, bar = Math.floor(k / 16), root = ROOTS[((bar % 4) + 4) % 4];
    if(scene === "intro" || scene === "outro"){
      var out = scene === "outro";
      if(out && s % 4 === 0) kick(t, 0.6);
      if(s % 2 === 0) hat(t, s % 4 === 2 ? 0.16 : 0.07, false);
      if(s % 4 === 2) bass(t, root, out ? 520 : 760, 0.3, 0.16);
      if(!out && (s === 0 || s === 8)) kick(t, 0.4);
      if(s === 0 && bar % 4 === 0) sweep(t, BEAT * 2, 400, 2400, 0.06);
      return;
    }
    if(scene === "build"){
      // k runs -24 … -1: rolls tighten on the last beats, then one 16th of silence.
      if(k === -1) return;
      var left = -k, roll = left > 12 ? 4 : (left > 4 ? 2 : 1);
      var up = 1 - left / BUILD_STEPS;
      if(left % roll === 0) clap(t, 0.25 + 0.4 * up);
      if(s % 2 === 0) hat(t, 0.08 + 0.1 * up, false);
      if(s % 4 === 0) bass(t, 45, 300 + 1500 * up, 0.2, 0.2);
      if(k === -BUILD_STEPS) sweep(t, BUILD_SECS - STEP, 300, 8000, 0.16);
      return;
    }
    if(scene !== "live") return;
    var lit = st.lit, fast = st.speed > 420;
    if(lit !== wasLit){
      // Boost lifts the whole bed a notch; it settles back when the tank runs dry.
      bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(lit ? 0.6 : 0.78, t); bus.gain.linearRampToValueAtTime(lit ? 0.78 : 0.6, t + (lit ? 0.08 : 0.6));
      if(lit){ cymbal(t, 0.2); sweep(t, BEAT, 800, 9000, 0.08); }
    }
    wasLit = lit;
    if(s % 4 === 0) kick(t, 0.95);
    if(k % 128 === 0) cymbal(t, 0.12);
    var cut = 260 + st.charge * 1400 + (lit ? 2400 : 0);
    if(s % 4 === 2) bass(t, root, cut, 0.26, 0.17);
    else if(s % 4 === 3 && (st.charge > 0.5 || lit)) bass(t, root + 12, cut, 0.12, 0.09);
    if(fast || lit || s % 2 === 0) hat(t, s % 4 === 2 ? 0.14 : 0.07, lit && s % 4 === 2);
    if((bar >= 2 || lit) && (s === 4 || s === 12)) clap(t, 0.24);
    if(lit) lead(t, root + 24 + ARP[s], 1800 + st.charge * 3500, 0.11);
  }

  function setScene(name, t){
    t = t == null ? ctx.currentTime : t;
    var prev = scene;
    scene = name; sceneAt = t;
    var g = bus.gain, f = lp.frequency;
    g.cancelScheduledValues(t); f.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t); f.setValueAtTime(Math.max(60, f.value), t);
    if(name === "off"){ g.linearRampToValueAtTime(0, t + 0.4); return; }
    if(name === "intro"){ step = 0; nextT = t + 0.05; wasLit = false; g.linearRampToValueAtTime(0.62, t + 0.6); f.exponentialRampToValueAtTime(3600, t + 0.3); }
    if(name === "build"){
      // Re-phase so step 0 (the drop) lands exactly BUILD_SECS from now.
      step = -BUILD_STEPS; nextT = t + 0.02;
      g.linearRampToValueAtTime(0.7, t + 0.2);
      f.exponentialRampToValueAtTime(2200, t + 0.02); f.exponentialRampToValueAtTime(16000, t + 0.02 + BUILD_SECS);
    }
    if(name === "live"){ g.linearRampToValueAtTime(0.6, t + 0.05); f.exponentialRampToValueAtTime(16000, t + 0.05); }
    if(name === "drop"){ g.linearRampToValueAtTime(0, t + 0.9); f.exponentialRampToValueAtTime(160, t + 0.7); }
    if(name === "outro"){ if(prev !== "outro"){ nextT = Math.max(nextT, t); } wasLit = false; g.linearRampToValueAtTime(0.5, t + 0.8); f.exponentialRampToValueAtTime(2000, t + 0.4); }
  }
  // Queue every 16th that starts before `until`. The build hands over to
  // live on its own at step 0, so the drop is sample-exact.
  function tick(until){
    if(scene === "off" || scene === "drop") { nextT = Math.max(nextT, ctx.currentTime); return; }
    while(nextT < until){
      if(scene === "build" && step >= 0) setScene("live", nextT);
      play(step, nextT);
      nextT += STEP; step++;
    }
  }
  return { scene: setScene, tick: tick, now: function(){ return scene; }, output: bus };
}
