# Bell Theory → MOSTMATH: reference handoff

*2026-10-07. For a session working in `highwaylot/MOSTMATH` that is considering blending Bell Theory into mostmath.com. Written from the Bell Theory repo (`highwaylot/tempname`, branch `claude/bold-thompson-c3s6i5`) after reading MOSTMATH's README, STRATEGY.md and DECISIONS.md at `caa3f87`.*

## 1. What Bell Theory is

A two-thumb endless runner for phones. The screen splits into two lanes; each thumb drives one orb. Rows of barriers scroll down, each lane has a gap, and you thread it. Pumping a thumb up and down fills a tank; at full it ignites a boost (1.85× speed, coins pulled in, slate barriers smash instead of killing you). One hit on a wall ends the run. It ships as a Capacitor 8 app (iOS/Android) and as a single-file web page.

Feel, in the game's own terms: thread it, or wreck it. Short runs, constant feedback (coin dings, pass labels, combo, smash chains, the WRECKED storm), adaptive difficulty that tracks recent clean passes.

## 2. Mechanics and numbers (src/game.js)

| Thing | Value |
|---|---|
| Lanes | 2 (one-thumb mode: 1, pump ×3.0) |
| Orb | hit radius `HIT_R` 12 px, drawn `DRAW_R` 17 px, follows the thumb by lerp (`state.follow`, default 26) |
| Difficulty `d` | `dist / 2600 + diffAdj`, clamped 0–1; `diffAdj` nudges ±0.1 from the last 10 passes (>70 % clean harder, <30 % easier) |
| Speed | `(200 + d·420) px/s × boostMult`, eased in over the first 1.2 s |
| Row spawn | every `max(0.42, 1.05 − 0.5d)` s, ±15 % |
| Gap width | `laneW × (0.52 − 0.26d)`, min 56 px |
| Row patterns | mirror / parallel / independent gap positions across the two lanes |
| Pump | a stroke counts at ≥ 34 px turn-to-turn; charge +0.085 × jitter × rhythm 1.4 × both-thumbs 1.8; decays 0.32/s |
| Boost | drains 0.4/s, 1.85× speed, magnet radius 120 px, slate smashes (+0.08 charge each), steel kills; 4–6 smashes trigger a storm that clears slate |
| Coins | plain 1, blue 25 (1 in 30 rows), purple 100 (1 in 250); `game.coinsBy[lane]` per side |
| Pass scoring | clean / surge (12 % of clean, random) / graze (< 7 px) / close; combo multiplier every 5 |

## 3. What is reusable, and how cleanly

| Piece | Where | Portability |
|---|---|---|
| Runner engine (spawn, scroll, collide, score) | `src/game.js` (830 lines), `src/render.js`, `src/world.js` | Plain ES modules, but stateful globals, DOM-coupled HUD, and imports of audio/haptics/native. Port the ideas, not the files. |
| Sound recipes | `src/audio.js` (`blip`, `thump`, `arp`, `crashSound`) | A few lines each, Web Audio only, easy to copy. |
| Techno bed that follows play | `creator/music-core.js` | Self-contained, no imports: `createMusic(ctx, dest, getState)`; 128 BPM, intro/build/live/drop/outro scenes, scheduler pattern. Drop-in. |
| Two-sided bracket, per-side counters, 3-2-1 hold | `creator/creator.js` | Readable reference for a versus or tournament mode. |
| Seeded deterministic rendering to video | `ads/prelude.js`, `ads/render.mjs` | Captures any canvas game frame by frame with its real audio (OfflineAudioContext on a stepped clock). Useful for MOSTMATH reels. |
| Fonts | Sora, IBM Plex Mono (OFL), in `src/fonts/` | Licence-clean. |
| Palette | ink `#eef0f4`, stage `#0b0d11`, accent teal `#7dd3c0`, coin gold `#f2c14e`, danger `#ff6f6f` | Does not match MOSTMATH (orange over blue equals mark). |

## 4. Where the two charters collide (decide before building)

1. **Monetization.** Bell Theory's plan (`docs/ADS-PLAN.md`) is rewarded video, a capped interstitial and a $2.99 remove-ads purchase. MOSTMATH's terms promise no ads and no monetization in the learning loop. Anything blended into mostmath.com carries none of that.
2. **Reward design.** Bell Theory is built on variable rewards (surge payouts at random, crunch, storms, flashes, shake). MOSTMATH's 2026-10-04 research pass rejected amplified celebration (confetti reduced motivation in an n=1,699 study) and keeps "surprise in content, not presence". A math version should keep the action-bound feedback (instant ding on a correct thread) and drop the random jackpots.
3. **Loss.** "One hit ends the run" is a loss mechanic. MOSTMATH already accepts it inside the Games hub (The Gauntlet: one miss ends the run) with your own best as the only score. Keep it there, never in practice mode.
4. **Speed vs. thinking.** Bell Theory is a reflex game; MOSTMATH is retrieval practice. If the scroll outruns the time to solve, it becomes guessing, which Photomath-style answer-before-effort critiques apply to. Difficulty must come from the math, with speed capped low.
5. **Two thumbs.** Bell Theory needs two hands on a phone. MOSTMATH users are on phones and laptops; a mouse can only drive one orb.
6. **Brand.** Different marks, palettes and voice. A blended game should wear MOSTMATH's skin.
7. **Privacy.** Compatible: neither sends data anywhere. Bell Theory's native build stores settings with Capacitor Preferences; the web build uses localStorage only.

## 5. Blend options, ranked

**A. Recommended: "Thread it", a fifth game in MOSTMATH's Games hub.** One lane, one orb (thumb, mouse or arrow keys). A problem from a live skill generator sits at the top, e.g. `3/4 + 1/6`. Each barrier row has two or three gaps, each labelled with a candidate: the answer and that skill's named distractors (MOSTMATH generators already produce them, and its checker verifies no distractor equals the answer). Thread the right gap: ding, next problem. Hit a wrong gap's wall or the wall itself: the run ends and the reveal names the slip, with "Practice this" like The Common Mistake. Speed rises with solves, capped so a row always gives at least ~4 s to read. Own best per device, nothing else. Port only scroll, gap, collide and orb-follow from `src/game.js` (roughly 150 lines of logic); skip pump, boost, smash and coins.

**B. Versus mode built from the creator page.** Two lanes, same problem, two players on one phone, first to thread the right gap scores. Fits MOSTMATH's "creators solving a problem on camera" brief and the reels. Two-thumb only, so it is a second step after A.

**C. Cross-promotion only.** Keep the products apart, share reel tooling (`ads/render.mjs`) and the music bed. No product risk.

**Not recommended: math inside Bell Theory.** It turns a reflex game into a quiz and confuses both audiences.

## 6. Open questions for the founder

1. Option A as a Games-hub entry, or something else from section 5?
2. Keep "one wrong gap ends the run", or let a wrong gap bounce the orb back with the reveal and continue? (The second fits "nothing ever goes down" better.)
3. Bell Theory's name and orbs inside MOSTMATH, or MOSTMATH's skin only? Cross-branding ties a free, no-ads site to an app planning ads.
4. One lane only, or offer the two-lane versus for phones?

## 7. Pointers

- Bell Theory: `src/game.js` (`spawnRow`, `update`, `laneBounds`, `difficulty`), `src/render.js` (`draw`), `src/audio.js`, `creator/music-core.js`, `creator/creator.js`, `docs/DECISIONS.md`, `docs/ADS-PLAN.md`.
- MOSTMATH: `src/skills/*.ts` (generators with distractors), `src/math/` (checker), `src/app/games/*.ts` (game pattern, `shared.ts`), `src/app/sound.ts`, `STRATEGY.md` §3.4 (what it never does).
