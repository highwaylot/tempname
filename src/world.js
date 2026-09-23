// ===================== world (ported from loom) =====================
export function makeDrifter(seed, speed){
  var phase = seed;
  return function(dt){
    phase += dt * speed;
    var v = 0.5 + 0.3*Math.sin(phase) + 0.15*Math.sin(phase*2.7+seed) + 0.05*Math.sin(phase*5.3-seed);
    return Math.min(1, Math.max(0, v));
  };
}
export var world = {
  time: 0,
  entropy: 0.35,
  depth: 0.5,
  warmth: 0.5,
  ripples: [],
  _depthDrift: makeDrifter(5.678, 0.012),
  nextId: 0,
  perturb: function(x, y, strength, life){
    this.ripples.push({ id:this.nextId++, x:x, y:y, bornAt:this.time, strength:strength, life:life||1.6 });
    if(this.ripples.length > 40) this.ripples.shift();
  },
  influenceAt: function(x, y, radius){
    var total = 0;
    for(var i=0;i<this.ripples.length;i++){
      var r = this.ripples[i];
      var age = this.time - r.bornAt;
      var decay = Math.max(0, 1 - age/r.life);
      if(decay <= 0) continue;
      var d = Math.hypot(x-r.x, y-r.y);
      var spatial = Math.max(0, 1 - d/(radius||260));
      total += r.strength * decay * spatial;
    }
    return total;
  },
  tick: function(dt, targetEntropy, targetWarmth){
    this.time += dt;
    this.depth = this._depthDrift(dt);
    // gameplay drives entropy/warmth instead of pure drift
    this.entropy += (targetEntropy - this.entropy) * Math.min(1, dt*1.2);
    this.warmth  += (targetWarmth  - this.warmth)  * Math.min(1, dt*1.6);
    var t = this.time;
    this.ripples = this.ripples.filter(function(r){ return t - r.bornAt < r.life; });
  }
};
