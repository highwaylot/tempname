import type { AudioEngine } from "../audio/engine";
import { TONE_PRESETS, type ToneMode } from "../audio/binaural";
import type { RollingRecorder } from "../recorder";

export function buildMixer(root: HTMLElement, audio: AudioEngine, recorder: RollingRecorder) {
  root.innerHTML = `
    <div class="panel">
      <h1>loom</h1>
      <p class="hint">click a bird to hear it sing. its song bends the world.</p>

      <div class="group">
        <label>drone <input type="range" id="lvl-drone" min="0" max="1" step="0.01" value="0.4" /></label>
        <label>rain <input type="range" id="lvl-rain" min="0" max="1" step="0.01" value="0.3" /></label>
        <label>birds <input type="range" id="lvl-birds" min="0" max="1" step="0.01" value="0.8" /></label>
      </div>

      <div class="group">
        <h2>tone layer</h2>
        <select id="tone-mode">
          <option value="binaural">binaural (headphones)</option>
          <option value="isochronic">isochronic (speakers ok)</option>
        </select>
        <select id="tone-preset">
          <option value="">off</option>
          ${TONE_PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}
          <option value="custom">custom…</option>
        </select>
        <div id="tone-custom" class="hidden">
          <label>carrier hz <input type="number" id="tone-carrier" value="200" min="20" max="1000" /></label>
          <label>beat hz <input type="number" id="tone-beat" value="8" min="0.5" max="40" step="0.5" /></label>
        </div>
        <label>level <input type="range" id="lvl-binaural" min="0" max="1" step="0.01" value="0" /></label>
      </div>

      <div class="group">
        <button id="start">start</button>
        <button id="record">● record</button>
        <button id="export">export last clip</button>
        <span id="buffer-status" class="hint"></span>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;

  $("start").addEventListener("click", async () => {
    await audio.resume();
    audio.startDrone();
    audio.startRain();
  });

  $<HTMLInputElement>("lvl-drone").addEventListener("input", (e) =>
    audio.setLevel("drone", Number((e.target as HTMLInputElement).value)),
  );
  $<HTMLInputElement>("lvl-rain").addEventListener("input", (e) =>
    audio.setLevel("rain", Number((e.target as HTMLInputElement).value)),
  );
  $<HTMLInputElement>("lvl-birds").addEventListener("input", (e) =>
    audio.setLevel("birds", Number((e.target as HTMLInputElement).value)),
  );
  $<HTMLInputElement>("lvl-binaural").addEventListener("input", (e) =>
    audio.setLevel("binaural", Number((e.target as HTMLInputElement).value)),
  );

  const modeSelect = $<HTMLSelectElement>("tone-mode");
  const presetSelect = $<HTMLSelectElement>("tone-preset");
  const customBox = $("tone-custom");
  const carrierInput = $<HTMLInputElement>("tone-carrier");
  const beatInput = $<HTMLInputElement>("tone-beat");

  function applyTone() {
    audio.binaural.setMode(modeSelect.value as ToneMode);
    const presetId = presetSelect.value;
    if (!presetId) {
      audio.binaural.stop();
      return;
    }
    if (presetId === "custom") {
      customBox.classList.remove("hidden");
      audio.binaural.play(Number(carrierInput.value), Number(beatInput.value));
      return;
    }
    customBox.classList.add("hidden");
    const preset = TONE_PRESETS.find((p) => p.id === presetId)!;
    audio.binaural.play(preset.carrier, preset.beat);
  }

  modeSelect.addEventListener("change", applyTone);
  presetSelect.addEventListener("change", applyTone);
  carrierInput.addEventListener("input", applyTone);
  beatInput.addEventListener("input", applyTone);

  let recording = false;
  const recordBtn = $("record");
  recordBtn.addEventListener("click", () => {
    recording = !recording;
    if (recording) {
      recorder.start();
      recordBtn.textContent = "■ stop";
    } else {
      recorder.stop();
      recordBtn.textContent = "● record";
    }
  });

  $("export").addEventListener("click", () => recorder.exportBuffer());

  setInterval(() => {
    $("buffer-status").textContent = `buffer: ${recorder.bufferedSeconds().toFixed(0)}s`;
  }, 1000);
}
