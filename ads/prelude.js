// Ad director prelude. Runs as a classic script BEFORE the game's modules so
// that everything the game does is reproducible from one seed:
//   * Math.random is replaced by a seeded generator (spawns, jitter, crits).
//   * requestAnimationFrame is captured, so the renderer steps the game one
//     fixed frame at a time instead of the game running on wall-clock time.
//   * requestIdleCallback runs on the stepped clock too (queued, flushed at
//     the next frame), so idle work never lands at a wall-clock moment.
//   * The Web Audio context is an OfflineAudioContext whose clock is the
//     stepped clock: every sound the game makes is scheduled at the exact
//     frame it happened and rendered once at the end (window.__adAudio).
//   * The saved settings are written up front: two thumbs, sound on (off in
//     zen and with sound=0), haptics off, no auto-pause (the bots never lift
//     a thumb), hint already taught.
(function(){
  var q = new URLSearchParams(location.search);
  function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var seed = parseInt(q.get("seed") || "1", 10) >>> 0;
  Math.random = mulberry32(seed * 2654435761 >>> 0);
  window.__adBotRng = mulberry32((seed ^ 0x9E3779B9) >>> 0);

  var queue = [], idle = [];
  window.__adClock = 0;
  window.requestAnimationFrame = function(cb){ queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = function(){};
  window.requestIdleCallback = function(cb){ idle.push(cb); return idle.length; };
  window.cancelIdleCallback = function(){};
  window.__adStepFrame = function(ms){
    window.__adClock += ms;
    var ide = idle; idle = [];
    for(var j=0;j<ide.length;j++){ try{ ide[j]({ didTimeout: false, timeRemaining: function(){ return 16; } }); }catch(e){ console.error(e); } }
    var run = queue; queue = [];
    for(var i=0;i<run.length;i++){ try{ run[i](window.__adClock); }catch(e){ console.error(e); } }
  };
  window.__adQueued = function(){ return queue.length; };

  var sound = q.get("zen") !== "1" && q.get("sound") !== "0";
  if(sound){
    var SR = 48000, secs = +(q.get("maxLen") || 24) + 8, offline = null;
    window.AudioContext = function(){
      offline = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
      return new Proxy(offline, { get: function(tg, k){
        if(k === "currentTime") return window.__adClock / 1000;
        if(k === "state") return "running";
        if(k === "resume" || k === "suspend") return function(){ return Promise.resolve(); };
        var v = Reflect.get(tg, k, tg);
        return typeof v === "function" ? v.bind(tg) : v;
      }});
    };
    window.webkitAudioContext = window.AudioContext;
    // Render everything scheduled so far; returns 16-bit stereo WAV bytes
    // (base64) starting at `fromMs` on the stepped clock.
    window.__adAudio = async function(fromMs, toMs){
      if(!offline) return null;
      var buf = await offline.startRendering();
      var a = Math.floor(fromMs / 1000 * SR), b = Math.min(buf.length, Math.ceil(toMs / 1000 * SR)), n = Math.max(0, b - a);
      var L = buf.getChannelData(0), R = buf.getChannelData(1);
      var out = new DataView(new ArrayBuffer(44 + n * 4));
      function str(o, t){ for(var i=0;i<t.length;i++) out.setUint8(o + i, t.charCodeAt(i)); }
      str(0, "RIFF"); out.setUint32(4, 36 + n * 4, true); str(8, "WAVE"); str(12, "fmt ");
      out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
      out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
      str(36, "data"); out.setUint32(40, n * 4, true);
      for(var i=0;i<n;i++){
        out.setInt16(44 + i*4, Math.max(-1, Math.min(1, L[a+i])) * 32767, true);
        out.setInt16(46 + i*4, Math.max(-1, Math.min(1, R[a+i])) * 32767, true);
      }
      var bytes = new Uint8Array(out.buffer), bin = "";
      for(var k=0;k<bytes.length;k+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
      return btoa(bin);
    };
  }
  try{
    localStorage.clear();
    localStorage.setItem("belltheory.v4", JSON.stringify({
      v:4, oneHand:false, soundOn:sound, haptics:false, autoPause:false, autoFx:false,
      taughtPump:true, fft:false, grid:true, trailLength:18, glow:20, follow:30, impact:1.2, volume:0.75,
      best:0, life:{ runs:0, blues:0, purples:0 },
      slots:[
        { id:"left",  mode:"color", color:"#ffb454", shape:"circle", image:null },
        { id:"right", mode:"color", color:"#5ec8ff", shape:"circle", image:null }
      ]
    }));
  }catch(e){}
})();
