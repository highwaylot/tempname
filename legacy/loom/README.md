# loom

A live, interactive, generative ambient world — the kind of thing that
usually shows up on YouTube as a static "10 hour background noise" video,
except this one runs, reacts, and is a little alive.

- **World clock** (`src/world.ts`) — one shared, slowly-drifting state
  vector (`entropy`, `depth`, `warmth`, plus transient "ripples") that
  audio, visuals, and entities all read from, so everything feels like one
  space instead of separately-synced layers.
- **Audio** (`src/audio/`) — a hybrid engine: procedural drone pad +
  filtered noise for rain/wind, plus a bird-call layer that's procedural
  now and takes real recordings as a drop-in upgrade
  (`public/samples/birds/README.md`). Also includes a general-purpose
  binaural/isochronic tone generator with presets (delta/theta/alpha/beta)
  and manual carrier/beat control.
- **Visuals** (`src/visuals/particles.ts`) — an abstract, audio-reactive
  particle field: FFT bands drive size/brightness/motion, and the World
  state steers palette and depth.
- **Entities** (`src/entities/bird.ts`) — clickable birds that wander the
  scene; clicking one makes it sing and injects a "ripple" into the shared
  World state, visibly and audibly bending the scene around that point in
  space and time.
- **Recording** (`src/recorder.ts`) — a rolling buffer (`MediaRecorder` +
  chunking) that keeps only the last N minutes, so "export last 5/10 min"
  doesn't require recording continuously to disk.

## Dev

```
npm install
npm run dev
```

Click **start** to begin the drone/rain beds, then click any bird to hear
it sing. Use the tone-layer controls for binaural/isochronic tones, and
**record** / **export last clip** to grab a rolling window of what just
played.

## Status

Framework-first v1: the World/audio/visual/entity/recorder architecture is
in place with a few rough scenes (one abstract visual style, one bird
entity type, drone+rain+bird audio beds). Next candidates: more entity
types, scene/preset packs (palette + sample pack swaps), semi-representational
visual mode, and a proper licensed bird-sample library.
