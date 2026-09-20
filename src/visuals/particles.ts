import type { World } from "../world";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  layer: 0 | 1; // 0 = distant/dim, 1 = near/bright — gives the scene depth
}

// One-pole low-pass so raw per-frame FFT noise never reaches the screen as
// flicker. Comfortable ambient visuals track the music's *shape*, not its
// sample-to-sample jitter.
class Smoothed {
  value: number;
  constructor(
    initial: number,
    private rate: number,
  ) {
    this.value = initial;
  }
  update(target: number, dt: number) {
    const k = 1 - Math.exp(-this.rate * dt);
    this.value += (target - this.value) * k;
    return this.value;
  }
}

export class ParticleField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private freqData: Uint8Array<ArrayBuffer>;
  private world: World;
  private analyser: AnalyserNode;

  private bass = new Smoothed(0, 1.2);
  private mid = new Smoothed(0, 1.5);
  private treble = new Smoothed(0, 2);
  private hue = new Smoothed(210, 0.15);

  constructor(canvas: HTMLCanvasElement, world: World, analyser: AnalyserNode, count = 140) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.world = world;
    this.analyser = analyser;
    this.freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    for (let i = 0; i < count; i++) {
      const layer: 0 | 1 = Math.random() < 0.55 ? 0 : 1;
      this.particles.push({
        x: Math.random(),
        y: Math.random() * 0.75, // keep the "sky" band clear of the ground silhouette
        vx: (Math.random() - 0.5) * (layer === 0 ? 0.004 : 0.009),
        vy: (Math.random() - 0.5) * (layer === 0 ? 0.002 : 0.004),
        size: layer === 0 ? 0.6 + Math.random() * 1 : 1.6 + Math.random() * 2,
        layer,
      });
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private bandEnergy(from: number, to: number): number {
    let sum = 0;
    let n = 0;
    for (let i = from; i < to && i < this.freqData.length; i++) {
      sum += this.freqData[i];
      n++;
    }
    return n ? sum / n / 255 : 0;
  }

  render(dt: number) {
    this.analyser.getByteFrequencyData(this.freqData);
    const bass = this.bass.update(this.bandEnergy(0, 16), dt);
    const mid = this.mid.update(this.bandEnergy(16, 96), dt);
    const treble = this.treble.update(this.bandEnergy(96, 256), dt);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = this.world.state;
    const horizonY = h * 0.78;

    // hue drifts very slowly and is shared by the whole scene — one coherent
    // palette rather than every particle picking its own color
    const hue = this.hue.update(210 - s.warmth * 130, dt);

    // sky: a fixed vertical gradient, redrawn fully each frame (no alpha
    // trailing) so brightness never pulses/flickers frame to frame
    const sky = this.ctx.createLinearGradient(0, 0, 0, horizonY);
    const topL = 4 + bass * 3;
    const botL = 10 + s.depth * 6 + bass * 3;
    sky.addColorStop(0, `hsl(${hue}, 45%, ${topL}%)`);
    sky.addColorStop(1, `hsl(${hue + 15}, 40%, ${botL}%)`);
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, w, horizonY);

    // soft horizon glow — a sense of a light source, i.e. a sense of place
    const glow = this.ctx.createRadialGradient(
      w / 2,
      horizonY,
      0,
      w / 2,
      horizonY,
      w * 0.6,
    );
    glow.addColorStop(0, `hsla(${hue + 25}, 60%, ${28 + mid * 10}%, 0.5)`);
    glow.addColorStop(1, "hsla(0, 0%, 0%, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, w, horizonY);

    // particles: slow, layered drift; ripples nudge them gently, never sharply
    for (const p of this.particles) {
      const ripple = this.world.rippleInfluenceAt(p.x, p.y);
      p.x += p.vx * dt * 60 + ripple * (0.5 - p.x) * 0.006;
      p.y += p.vy * dt * 60 + ripple * (0.5 - p.y) * 0.006;

      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 0.75;
      if (p.y > 0.75) p.y = 0;

      const px = p.x * w;
      const py = p.y * horizonY;
      const twinkle = p.layer === 1 ? treble * 1.5 : treble * 0.5;
      const radius = p.size * (1 + twinkle + ripple);
      const alpha = (p.layer === 0 ? 0.25 : 0.55) + ripple * 0.3;
      const lightness = p.layer === 0 ? 50 : 75;

      this.ctx.beginPath();
      this.ctx.fillStyle = `hsla(${hue + 20}, 50%, ${lightness}%, ${Math.min(0.9, alpha)})`;
      this.ctx.arc(px, py, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ground: a simple, calm silhouette so the scene reads as a place, not a void
    this.ctx.fillStyle = `hsl(${hue}, 30%, 3%)`;
    this.ctx.fillRect(0, horizonY, w, h - horizonY);
    this.ctx.fillStyle = `hsla(${hue + 25}, 40%, 10%, 0.6)`;
    this.ctx.fillRect(0, horizonY, w, 2);
  }

  /** exposed so entities (birds) can share the same horizon band */
  get horizonRatio() {
    return 0.78;
  }
}
