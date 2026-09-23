// Procedural bird-call variation layer. Drop licensed/CC recordings into
// public/samples/birds/*.wav and pass a decoded AudioBuffer into
// AudioEngine.playBirdCall() for the realistic base layer — this synth adds
// pitch-swept "grains" on top so no two calls sound identical, and can stand
// in on its own before you've wired up a sample library.

export function synthBirdCall(
  ctx: AudioContext,
  destination: AudioNode,
  warmth: number,
) {
  const t0 = ctx.currentTime;
  const grains = 3 + Math.floor(Math.random() * 4);
  const baseFreq = 2200 + warmth * 1500 + Math.random() * 800;

  for (let i = 0; i < grains; i++) {
    const start = t0 + i * (0.08 + Math.random() * 0.06);
    const dur = 0.05 + Math.random() * 0.08;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const freqStart = baseFreq * (0.9 + Math.random() * 0.3);
    const freqEnd = freqStart * (0.6 + Math.random() * 0.8);
    osc.frequency.setValueAtTime(freqStart, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freqEnd), start + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.5, start + dur * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    osc.connect(gain).connect(destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }
}
