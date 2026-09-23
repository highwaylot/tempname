import type { World } from "../world";
import { BinauralLayer } from "./binaural";
import { synthBirdCall } from "./birdSynth";

export interface Levels {
  drone: number;
  rain: number;
  birds: number;
  binaural: number;
}

export class AudioEngine {
  ctx: AudioContext;
  analyser: AnalyserNode;
  destinationForRecording: MediaStreamAudioDestinationNode;
  binaural: BinauralLayer;

  private master: GainNode;
  private droneGain: GainNode;
  private rainGain: GainNode;
  private birdGain: GainNode;
  private droneOscs: OscillatorNode[] = [];
  private rainNoise: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode;
  private world: World;

  constructor(world: World) {
    this.world = world;
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.4;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.3;
    this.birdGain = this.ctx.createGain();
    this.birdGain.gain.value = 0.8;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = "bandpass";
    this.rainFilter.frequency.value = 4000;
    this.rainFilter.Q.value = 0.6;

    this.droneGain.connect(this.master);
    this.rainGain.connect(this.master);
    this.birdGain.connect(this.master);

    this.destinationForRecording = this.ctx.createMediaStreamDestination();
    this.master.connect(this.analyser);
    this.master.connect(this.ctx.destination);
    this.master.connect(this.destinationForRecording);

    this.binaural = new BinauralLayer(this.ctx, this.master);

    world.onUpdate((s) => {
      // world.warmth steers the drone's filter brightness; entropy steers rain intensity
      this.rainFilter.frequency.setTargetAtTime(
        2000 + s.warmth * 4000,
        this.ctx.currentTime,
        0.5,
      );
      this.rainGain.gain.setTargetAtTime(
        this.baseLevels.rain * (0.4 + 0.6 * s.entropy),
        this.ctx.currentTime,
        0.5,
      );
    });
  }

  private baseLevels: Levels = { drone: 0.4, rain: 0.3, birds: 0.8, binaural: 0 };

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }

  setLevel(key: keyof Levels, value: number) {
    this.baseLevels[key] = value;
    const t = this.ctx.currentTime;
    if (key === "drone") this.droneGain.gain.setTargetAtTime(value, t, 0.1);
    if (key === "birds") this.birdGain.gain.setTargetAtTime(value, t, 0.1);
    if (key === "binaural") this.binaural.setGain(value);
    // "rain" is scaled live by world.entropy in the onUpdate handler above
  }

  startDrone() {
    if (this.droneOscs.length) return;
    const freqs = [110, 165, 220]; // a fifth + octave stack, detuned slightly below
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const detuneLfo = this.ctx.createOscillator();
      detuneLfo.frequency.value = 0.05 + Math.random() * 0.05;
      const detuneGain = this.ctx.createGain();
      detuneGain.gain.value = 4;
      detuneLfo.connect(detuneGain).connect(osc.detune);
      detuneLfo.start();
      osc.connect(this.droneGain);
      osc.start();
      this.droneOscs.push(osc);
    }
  }

  startRain() {
    if (this.rainNoise) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.rainFilter).connect(this.rainGain);
    src.start();
    this.rainNoise = src;
  }

  /** Trigger a bird call. If a sample buffer is provided (real recording), layer
   * it under a procedural variation so repeated calls don't sound identical. */
  playBirdCall(sampleBuffer?: AudioBuffer) {
    const t = this.ctx.currentTime;
    if (sampleBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = sampleBuffer;
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      src.connect(this.birdGain);
      src.start(t);
    }
    synthBirdCall(this.ctx, this.birdGain, this.world.state.warmth);
  }
}
