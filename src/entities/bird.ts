import type { World } from "../world";
import type { AudioEngine } from "../audio/engine";

export class Bird {
  x: number; // 0..1 normalized
  y: number;
  private vx: number;
  private vy: number;
  private wanderPhase = Math.random() * Math.PI * 2;
  radius = 14; // px hit-target on screen

  constructor(
    private world: World,
    private audio: AudioEngine,
  ) {
    this.x = 0.2 + Math.random() * 0.6;
    this.y = 0.15 + Math.random() * 0.3;
    this.vx = 0.01;
    this.vy = 0;
  }

  update(dt: number) {
    this.wanderPhase += dt * 0.5;
    this.vx = 0.02 * Math.cos(this.wanderPhase);
    this.vy = 0.01 * Math.sin(this.wanderPhase * 1.3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.min(0.95, Math.max(0.05, this.x));
    this.y = Math.min(0.6, Math.max(0.05, this.y));
  }

  /** screen-space hit test, canvas in CSS pixels */
  hitTest(px: number, py: number, w: number, h: number): boolean {
    const bx = this.x * w;
    const by = this.y * h;
    return Math.hypot(px - bx, py - by) <= this.radius * 2;
  }

  /** Click it: it sings, and the song bends the shared world state —
   * this is the "song morphs into its space and time" mechanic. */
  sing() {
    this.audio.playBirdCall();
    this.world.perturb(this.x, this.y, 1, 5 + Math.random() * 4);
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bx = this.x * w;
    const by = this.y * h;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 240, 210, 0.9)";
    ctx.arc(bx, by, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
