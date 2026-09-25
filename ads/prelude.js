// Ad director prelude. Runs as a classic script BEFORE the game's modules so
// that everything the game does is reproducible from one seed:
//   * Math.random is replaced by a seeded generator (spawns, jitter, crits).
//   * requestAnimationFrame is captured, so the renderer steps the game one
//     fixed frame at a time instead of the game running on wall-clock time.
//   * The saved settings are written up front: two thumbs, sound and haptics
//     off, no auto-pause (the bots never lift a thumb), hint already taught.
(function(){
  var q = new URLSearchParams(location.search);
  function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var seed = parseInt(q.get("seed") || "1", 10) >>> 0;
  Math.random = mulberry32(seed * 2654435761 >>> 0);
  window.__adBotRng = mulberry32((seed ^ 0x9E3779B9) >>> 0);

  var queue = [];
  window.__adClock = 0;
  window.requestAnimationFrame = function(cb){ queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = function(){};
  window.__adStepFrame = function(ms){
    window.__adClock += ms;
    var run = queue; queue = [];
    for(var i=0;i<run.length;i++){ try{ run[i](window.__adClock); }catch(e){ console.error(e); } }
  };
  window.__adQueued = function(){ return queue.length; };

  try{
    localStorage.clear();
    localStorage.setItem("belltheory.v4", JSON.stringify({
      v:4, oneHand:false, soundOn:false, haptics:false, autoPause:false, autoFx:false,
      taughtPump:true, fft:false, grid:true, trailLength:18, glow:20, follow:30, impact:1.2, volume:0.75,
      best:0, life:{ runs:0, blues:0, purples:0 },
      slots:[
        { id:"left",  mode:"color", color:"#ffb454", shape:"circle", image:null },
        { id:"right", mode:"color", color:"#5ec8ff", shape:"circle", image:null }
      ]
    }));
  }catch(e){}
})();
