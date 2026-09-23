// The World is the one shared clock/state vector that audio, visuals, and
// entities all read from. Nothing here is "real" physics — it's a handful of
// slowly-drifting values (Perlin-ish noise walks) that give every subsystem a
// common sense of time and place, so audio and visuals feel like one thing
// instead of two synced-but-separate systems.

export interface WorldState {
  /** seconds since the world started */
  time: number;
  /** 0..1, slow drift — how chaotic/busy the scene is right now */
  entropy: number;
  /** 0..1, slow drift — how "deep"/distant the scene feels (affects reverb, particle depth) */
  depth: number;
  /** 0..1, slow drift — bright/warm vs dark/cold palette + tone */
  warmth: number;
  /** transient ripples injected by events (bird songs, clicks) — decay over time */
  ripples: Ripple[];
}

export interface Ripple {
  id: number;
  x: number;
  y: number;
  bornAt: number;
  strength: number; // 0..1 at birth
  /** how many seconds the ripple takes to fully decay */
  life: number;
}

type Listener = (state: WorldState) => void;

// simple 1D value-noise walk: cheap, deterministic-ish, no dependency
function makeDrifter(seed: number, speed: number) {
  let phase = seed;
  return (dt: number) => {
    phase += dt * speed;
    // sum a couple of sines at incommensurate rates: cheap fake-noise
    const v =
      0.5 +
      0.3 * Math.sin(phase) +
      0.15 * Math.sin(phase * 2.7 + seed) +
      0.05 * Math.sin(phase * 5.3 - seed);
    return Math.min(1, Math.max(0, v));
  };
}

export class World {
  state: WorldState;
  private entropyDrift = makeDrifter(1.234, 0.02);
  private depthDrift = makeDrifter(5.678, 0.012);
  private warmthDrift = makeDrifter(9.101, 0.008);
  private listeners: Listener[] = [];
  private nextRippleId = 0;

  constructor() {
    this.state = { time: 0, entropy: 0.4, depth: 0.5, warmth: 0.5, ripples: [] };
  }

  onUpdate(fn: Listener) {
    this.listeners.push(fn);
  }

  /** A song, a click, an event — anything that should visibly/audibly bend the scene. */
  perturb(x: number, y: number, strength = 1, life = 6) {
    this.state.ripples.push({
      id: this.nextRippleId++,
      x,
      y,
      bornAt: this.state.time,
      strength,
      life,
    });
  }

  tick(dt: number) {
    this.state.time += dt;
    this.state.entropy = this.entropyDrift(dt);
    this.state.depth = this.depthDrift(dt);
    this.state.warmth = this.warmthDrift(dt);
    this.state.ripples = this.state.ripples.filter(
      (r) => this.state.time - r.bornAt < r.life,
    );
    for (const l of this.listeners) l(this.state);
  }

  /** current combined ripple influence at a point, 0..1+ */
  rippleInfluenceAt(x: number, y: number): number {
    let total = 0;
    for (const r of this.state.ripples) {
      const age = this.state.time - r.bornAt;
      const decay = Math.max(0, 1 - age / r.life);
      const dist = Math.hypot(x - r.x, y - r.y);
      const spatial = Math.max(0, 1 - dist / 0.6);
      total += r.strength * decay * spatial;
    }
    return total;
  }
}
