import "./style.css";
import { World } from "./world";
import { AudioEngine } from "./audio/engine";
import { ParticleField } from "./visuals/particles";
import { Bird } from "./entities/bird";
import { RollingRecorder } from "./recorder";
import { buildMixer } from "./ui/mixer";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const ctx2d = canvas.getContext("2d")!;
const uiRoot = document.querySelector<HTMLElement>("#ui-root")!;

const world = new World();
const audio = new AudioEngine(world);
const field = new ParticleField(canvas, world, audio.analyser);
const birds = [new Bird(world, audio), new Bird(world, audio), new Bird(world, audio)];
const recorder = new RollingRecorder(canvas, audio.destinationForRecording.stream, 10);

buildMixer(uiRoot, audio, recorder);

function resize() {
  field.resize();
}
window.addEventListener("resize", resize);
resize();

canvas.addEventListener("click", (e) => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const bird of birds) {
    if (bird.hitTest(e.clientX, e.clientY, w, h)) {
      bird.sing();
      return;
    }
  }
  // clicking empty space still perturbs the world, just gently
  world.perturb(e.clientX / w, e.clientY / h, 0.4, 3);
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  world.tick(dt);
  for (const bird of birds) bird.update(dt);

  field.render(dt);
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const bird of birds) bird.render(ctx2d, w, h);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
