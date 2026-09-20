// General-purpose binaural-beat / isochronic-tone generator. Not a
// reproduction of any trademarked technique — just the underlying,
// widely-published method: two slightly-detuned tones panned hard L/R
// (binaural) or one tone pulsed at a target frequency (isochronic), which
// needs no headphones.

export type ToneMode = "binaural" | "isochronic";

export interface TonePreset {
  id: string;
  label: string;
  carrier: number; // Hz, the audible tone
  beat: number; // Hz, the difference/pulse frequency
  band: "delta" | "theta" | "alpha" | "beta";
}

export const TONE_PRESETS: TonePreset[] = [
  { id: "deep-sleep", label: "Deep Sleep (delta)", carrier: 110, beat: 2, band: "delta" },
  { id: "deep-focus", label: "Deep Focus (theta)", carrier: 180, beat: 6, band: "theta" },
  { id: "relaxed-alert", label: "Relaxed Alertness (alpha)", carrier: 220, beat: 10, band: "alpha" },
  { id: "wide-awake", label: "Wide Awake (beta)", carrier: 260, beat: 18, band: "beta" },
];

export class BinauralLayer {
  private ctx: AudioContext;
  private out: GainNode;
  private mode: ToneMode = "binaural";

  private left: OscillatorNode | null = null;
  private right: OscillatorNode | null = null;
  private leftPan: StereoPannerNode | null = null;
  private rightPan: StereoPannerNode | null = null;

  private isoOsc: OscillatorNode | null = null;
  private isoLfo: OscillatorNode | null = null;
  private isoLfoGain: GainNode | null = null;
  private isoDcOffset: ConstantSourceNode | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0; // starts silent until user picks a preset/level
    this.out.connect(destination);
  }

  setGain(v: number) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  setMode(mode: ToneMode) {
    if (mode === this.mode) return;
    this.stop();
    this.mode = mode;
  }

  play(carrier: number, beat: number) {
    this.stop();
    if (this.mode === "binaural") {
      this.left = this.ctx.createOscillator();
      this.right = this.ctx.createOscillator();
      this.left.frequency.value = carrier - beat / 2;
      this.right.frequency.value = carrier + beat / 2;
      this.leftPan = this.ctx.createStereoPanner();
      this.rightPan = this.ctx.createStereoPanner();
      this.leftPan.pan.value = -1;
      this.rightPan.pan.value = 1;
      this.left.connect(this.leftPan).connect(this.out);
      this.right.connect(this.rightPan).connect(this.out);
      this.left.start();
      this.right.start();
    } else {
      this.isoOsc = this.ctx.createOscillator();
      this.isoOsc.frequency.value = carrier;
      this.isoLfo = this.ctx.createOscillator();
      this.isoLfo.frequency.value = beat;
      this.isoLfoGain = this.ctx.createGain();
      this.isoLfoGain.gain.value = 0.5;
      this.isoDcOffset = this.ctx.createConstantSource();
      this.isoDcOffset.offset.value = 0.5;

      const modGain = this.ctx.createGain();
      modGain.gain.value = 0; // driven by LFO + offset below

      this.isoLfo.connect(this.isoLfoGain).connect(modGain.gain);
      this.isoDcOffset.connect(modGain.gain);
      this.isoOsc.connect(modGain).connect(this.out);

      this.isoOsc.start();
      this.isoLfo.start();
      this.isoDcOffset.start();
    }
  }

  stop() {
    for (const node of [this.left, this.right, this.isoOsc, this.isoLfo]) {
      try {
        node?.stop();
      } catch {
        /* already stopped */
      }
    }
    try {
      this.isoDcOffset?.stop();
    } catch {
      /* already stopped */
    }
    this.left = this.right = this.isoOsc = this.isoLfo = null;
    this.isoDcOffset = null;
  }
}
