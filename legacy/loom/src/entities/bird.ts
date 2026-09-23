import type { World } from "../world";
import type { AudioEngine } from "../audio/engine";

export class Bird {
  x: number; // 0..1 normalized, horizontal
  y: number; // 0..0.7 normalized, kept within the sky band
  private vx: number;
  private vy: number;
  private wanderPhase = Math.random() * Math.PI * 2;
  private wingPhase = Math.random() * Math.PI * 2;
  private singPulse = 0; // 0..1, brief glow after singing
  radius = 26; // generous click target — the point is to find it easily

  constructor(
    private world: World,
    private audio: AudioEngine,
  ) {
    this.x = 0.2 + Math.random() * 0.6;
    this.y = 0.15 + Math.random() * 0.35;
    this.vx = 0.006;
    this.vy = 0;
  }

  update(dt: number) {
    this.wanderPhase += dt * 0.15; // slow, unhurried drift
    this.wingPhase += dt * 3;
    this.vx = 0.01 * Math.cos(this.wanderPhase);
    this.vy = 0.005 * Math.sin(this.wanderPhase * 1.3);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.min(0.95, Math.max(0.05, this.x));
    this.y = Math.min(0.65, Math.max(0.05, this.y));
    this.singPulse = Math.max(0, this.singPulse - dt * 0.4);
  }

  /** screen-space hit test, canvas in CSS pixels */
  hitTest(px: number, py: number, w: number, h: number): boolean {
    const bx = this.x * w;
    const by = this.y * (h * 0.78);
    return Math.hypot(px - bx, py - by) <= this.radius;
  }

  /** Click it: it sings, and the song bends the shared world state —
   * this is the "song morphs into its space and time" mechanic. */
  sing() {
    this.audio.playBirdCall();
    this.world.perturb(this.x, this.y, 1, 5 + Math.random() * 4);
    this.singPulse = 1;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bx = this.x * w;
    const by = this.y * (h * 0.78); // matches ParticleField's horizon band
    const flap = Math.sin(this.wingPhase) * 0.5 + 0.5;
    const bodySize = 6;

    ctx.save();
    ctx.translate(bx, by);

    // soft glow halo — brighter right after it sings, so the "song bending
    // the scene" moment is legible on the bird itself, not just the particles
    const glowR = 24 + this.singPulse * 30;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, `rgba(255, 235, 200, ${0.35 + this.singPulse * 0.4})`);
    glow.addColorStop(1, "rgba(255, 235, 200, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // a simple two-wing silhouette reads as "bird" at a glance, better than a dot
    ctx.fillStyle = "rgba(30, 24, 20, 0.9)";
    ctx.beginPath();
    ctx.ellipse(0, 0, bodySize, bodySize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 244, 224, 0.95)";
    const wingSpan = bodySize * (1.6 + flap * 0.8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-wingSpan * 0.6, -bodySize * (0.4 + flap), -wingSpan, 0);
    ctx.quadraticCurveTo(-wingSpan * 0.6, bodySize * 0.2, 0, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wingSpan * 0.6, -bodySize * (0.4 + flap), wingSpan, 0);
    ctx.quadraticCurveTo(wingSpan * 0.6, bodySize * 0.2, 0, 0);
    ctx.fill();

    ctx.restore();
  }
}
