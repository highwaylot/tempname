# Bird sample library (drop-in)

Put licensed/royalty-free bird recordings here (e.g. from Xeno-canto —
check each recording's individual license, many are CC-BY/CC-BY-NC — or
CC0 clips from Freesound). Suggested naming: `species-name-01.wav`.

Load and decode a file, then pass the resulting `AudioBuffer` into
`AudioEngine.playBirdCall(buffer)` so it plays as the realistic base layer
under the procedural variation synth in `src/audio/birdSynth.ts`.

Until samples are added, `playBirdCall()` still works using only the
procedural synth.
