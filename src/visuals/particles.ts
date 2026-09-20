import type { World } from "../world";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hueOffset: number;
}

export class ParticleField {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private freqData: Uint8Array<ArrayBuffer>;
  private world: World;
  private analyser: AnalyserNode;

  constructor(canvas: HTMLCanvasElement, world: World, analyser: AnalyserNode, count = 260) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.world = world;
    this.analyser = analyser;
    this.freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        size: 1 + Math.random() * 2.5,
        hueOffset: Math.random() * 40 - 20,
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
    const bass = this.bandEnergy(0, 16);
    const mid = this.bandEnergy(16, 96);
    const treble = this.bandEnergy(96, 256);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = this.world.state;

    // background wash, hue steered by warmth, darkness by depth
    const hue = 200 - s.warmth * 160; // warm = amber/red, cold = blue
    const bgLightness = 6 + (1 - s.depth) * 6;
    this.ctx.fillStyle = `hsla(${hue}, 40%, ${bgLightness}%, ${0.25 + bass * 0.2})`;
    this.ctx.fillRect(0, 0, w, h);

    for (const p of this.particles) {
      // drift + gentle pull from ripples (bird songs, clicks)
      const ripple = this.world.rippleInfluenceAt(p.x, p.y);
      p.x += p.vx * (1 + mid * 2) * dt * 60 + ripple * (0.5 - p.x) * 0.02;
      p.y += p.vy * (1 + mid * 2) * dt * 60 + ripple * (0.5 - p.y) * 0.02;

      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1;
      if (p.y > 1) p.y = 0;

      const px = p.x * w;
      const py = p.y * h;
      const radius = p.size * (1 + treble * 3 + ripple * 2) * (0.6 + s.depth * 0.8);
      const lightness = 55 + treble * 30 + ripple * 15;

      this.ctx.beginPath();
      this.ctx.fillStyle = `hsla(${hue + p.hueOffset}, 70%, ${lightness}%, ${0.5 + bass * 0.4})`;
      this.ctx.arc(px, py, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
