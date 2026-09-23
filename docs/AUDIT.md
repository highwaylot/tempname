# Bell Theory — implementation plan (audit synthesis, 2026-09-23)

Source of truth for this round: `prototype/bell-theory.html` (read-only during the audit; line numbers below refer to it). Nine auditors (render, update, audio, dom, mobile, bugs, design, native, balance), each finding checked by two verifiers. This document is the merged, corrected plan. Every item is written so that an implementer who has not read the audit can do it.

## Summary

| # | Pri | Cat | Title | Files | Depends on |
|---|-----|-----|-------|-------|------------|
| W01 | 1 | restructure | Split prototype/bell-theory.html into the Vite project (index.html + src/*.js) with harness parity | index.html, src/styles.css, src/main.js, src/state.js, … | — |
| W02 | 2 | perf | Harness upgrades and the re-based perf gate (dpr flag, pointer ids, floor, JS budget, seed storage) | test/harness.mjs, test/floor.html, src/main.js, docs/AUDIT.md | W01 |
| W03 | 3 | bug | Self-host the two font families; remove the render-blocking Google Fonts stylesheet | index.html, src/styles.css, src/fonts/, test/fonts-check.mjs, … | W01 |
| W04 | 4 | perf | Draw the centre seam as a compositor DOM layer under the canvas; no seam in one-thumb mode | index.html, src/styles.css, src/render.js | W01, W02 |
| W05 | 5 | perf | Shake and camera sway as a CSS transform on the canvas instead of ctx2d.translate/rotate; input stays in unswayed coordinates | src/styles.css, src/render.js, src/input.js | W01, W02, W04 |
| W06 | 6 | perf | Cap the canvas backing store at DPR 2 with glow-size compensation | src/render.js, docs/DECISIONS.md | W01, W02 |
| W07 | 7 | perf | HUD DOM written only on change; CSS-animation restarts without forced reflow; layout containment | src/ui.js, src/game.js, src/main.js, src/styles.css | W01 |
| W08 | 8 | bug | Hidden overlays leave hit-testing, focus and the a11y tree: the invisible title-screen mode picker no longer flips the mode mid-run | src/styles.css, index.html, src/ui.js, src/game.js | W01 |
| W09 | 9 | bug | A mode switch requested mid-run applies when the run ends, never mid-run (ghost-orb death and half-lane rows) | src/game.js, src/ui.js, index.html | W01, W08 |
| W10 | 10 | bug | Swept barrier collision: a barrier cannot jump the orb on a long frame (steel stops paying out on mid-range phones) | src/game.js | W01 |
| W11 | 11 | bug | One pointer can never own both sides (mouse in two-thumb mode started unwinnable runs) | src/input.js | W01 |
| W12 | 12 | bug | Strokes do not register and BOOST cannot fire while paused | src/game.js | W01 |
| W13 | 13 | bug | A caught draw() error no longer leaks the canvas save() stack | src/main.js | W01 |
| W14 | 14 | bug | Arpeggios scheduled on the audio clock; a hidden page can never be re-resumed by a timer | src/audio.js | W01 |
| W15 | 15 | perf | Orb halo as a cached sprite (halo only, body still drawn live) instead of a live shadowBlur every frame | src/render.js, src/ui.js | W01, W02, W06 |
| W16 | 16 | perf | Build the audio graph at load in idle time; the first touch only resumes and starts | src/audio.js, src/main.js, src/render.js | W01, W14 |
| W17 | 17 | perf | Draw/update micro bundle: grid row culling, FFT gating and bin table, driveAudio at 10 Hz, stable entity shapes | src/render.js, src/audio.js, src/game.js, src/ui.js | W01, W16 |
| W18 | 18 | perf | Audio voice hygiene: shared click/crash filters, allocation-free crash noise, exact same-frame coin coalescing | src/audio.js, src/game.js | W01, W16 |
| W19 | 19 | perf | Adaptive quality tier: straight grid rows and no spectrum bars only on devices whose run p95 exceeds 33 ms | src/render.js, src/main.js, src/state.js, src/ui.js, … | W01, W02, W17 |
| W20 | 20 | balance | One-thumb pump multiplier so the tank can fill one-handed (measured 22 -> ~100 in 12 s) | src/game.js, index.html, docs/DECISIONS.md | W01 |
| W21 | 21 | ux | Pump hint fires before the first barrier and is repeated on the crash card until the first stroke | src/game.js, docs/DECISIONS.md | W01 |
| W22 | 22 | feature | Run-end: per-run best combo (bug), seam off on the crash card, and a felt 'new best' moment | src/game.js, src/ui.js, index.html, src/styles.css, … | W01, W04, W07, W29 |
| W23 | 23 | feature | Versioned save schema: key belltheory.v4 with one-time migration, whitelist from defaultState, lifetime runs/blue/purple | src/state.js, src/game.js, src/ui.js, index.html, … | W01 |
| W24 | 24 | balance | Rare-coin odds: blue 1 in 30, purple 1 in 250 | src/game.js, docs/DECISIONS.md | W01 |
| W25 | 25 | feature | Pause menu: pause button, PAUSED overlay with restart/settings/title, thumbs-down resume with a 3-2-1 hold | index.html, src/styles.css, src/game.js, src/input.js, … | W01, W02, W07, W08, W23 |
| W26 | 26 | feature | Unlock gate state machine (free = the complete game for the first 15 runs), inert until StoreKit lands | src/native.js, src/game.js, src/ui.js, index.html, … | W01, W23 |
| W27 | 27 | native | Capacitor project: config, generated iOS/Android trees, portrait lock, usage strings, scripts | package.json, capacitor.config.ts, ios/, android/, … | W01, W03 |
| W28 | 28 | native | Safe-area insets applied once, host-agnostic | index.html, src/styles.css, src/main.js | W01, W27 |
| W29 | 29 | native | Haptics bridge: one haptic(kind, power) in the game, Capacitor Haptics natively, navigator.vibrate patterns on the web | src/native.js, src/game.js, src/input.js, index.html | W01 |
| W30 | 30 | native | Persistence: Capacitor Preferences as the durable copy with localStorage as the synchronous cache, ordered writes, flush on pause | src/native.js, src/state.js, src/main.js | W01, W23 |
| W31 | 31 | native | Lifecycle: suspend/resume as named functions, driven by visibilitychange on the web and appStateChange natively | src/game.js, src/main.js, src/native.js | W01, W25 |
| W32 | 32 | native | Android back: close settings, else pause into settings mid-run, else minimize | src/native.js, src/main.js | W01, W27, W31 |
| W33 | 33 | native | Audio session: release the silent-wav unlock on hide/mute, gate it off natively, AVAudioSession .playback(.mixWithOthers) in the app | src/audio.js, src/game.js, src/ui.js, src/input.js, … | W01, W27, W31 |
| W34 | 34 | restructure | Docs: DECISIONS.md entries, STORE.md copy, TestFlight/device checklist, harness gate definition | docs/DECISIONS.md, docs/STORE.md, docs/AUDIT.md | W01 |

Parallelisable groups once W01 is in: perf (W04-W07, W15-W19) · bugs (W08-W14) · balance/feature (W20-W26) · native (W27-W33). W02 and W03 should land before any perf number is recorded.

## Perf target and what gets us there

BASELINE (test/harness.mjs, 390x844, dpr 2, --throttle 6, two-thumb, 20 s): p50 34-42 ms, p95 55-65, p99 65-78, 26-28 fps. Nine auditors and eighteen verifiers agree on the shape of the frame: JS (update ~1 ms + draw ~2.5 ms + HUD DOM ~0.3 ms) is 3.3-4 ms; ~24-27 ms/frame is CanvasResourceProviderSharedImage::ProduceCanvasResource, i.e. this headless Chromium (2d_canvas=unavailable_software, SwiftShader) rasterising the PaintOps draw() records on the 6x-throttled main thread at canvas flush. The frame is raster-bound by full-screen alpha passes (~2.75 ms each at dpr 2/6x), not draw-call- or JS-bound. Harness floor: bare canvas + clearRect, harness-driven = p50 5.8 / p95 9.7 ms; with update() and the current unconditional HUD DOM writes but no draw = p95 15-17 (the HUD block is 2.5-4 ms/frame at that scale, invisible at 35 ms frames).

WHAT GETS US THERE (measured, same harness, visually equivalent unless noted): W04 seam as a DOM compositor layer p50 -10 / p95 -9 ms (3 runs; also fixes the one-thumb seam bug). W05 shake/sway as a CSS transform instead of ctx2d.rotate: run-phase p95 64.6 -> 48.5 (-15 ms), whole-run p95 -7..-11 (the auditor's -14..-17 was inflated by the harness pointerId-1 collision, fixed in W02). W06 DPR cap 2: 0 ms in the harness (already dpr 2) but dpr-3 emulation p50 71 -> 35 / p95 118 -> 60, i.e. every current iPhone. W07 HUD dirty-check + no forced reflow: 0.5-1 ms/frame main thread, 1.2-2.8 ms off stroke/smash frames; no p95 change now, ~3 ms once draw shrinks. W15 halo sprite instead of live shadowBlur: p50 -1.5..-3 ms. W16 audio graph prebuilt at load: first-touch frame 55-100 ms -> 8-15 ms (once per session). W17/W18 micro bundle: ~0.5-1 ms/frame JS, no p95 change. The auditor's combined visually-equivalent set (dprcap+seamdom+cssxform+hudguard) measured p50 19-20 / p95 33-35 ms, 47-52 fps; corrected for the pointerId contamination expect p50 ~22-27 / p95 ~35-45 after W04-W07, and ~p95 30-40 after W15-W18. W19 adaptive quality (grid bows + fft bars off only on devices whose rolling p95 exceeds 33 ms) is worth a further p50 -6..-7 / p95 -11 where it triggers (measured with grid+fft forced off: p95 62 -> 51).

WHAT DOES NOT: p95 < 16.7 ms at --throttle 6 / dpr 2 is 1.7x the harness floor and leaves ~7 ms for the entire picture (2-3 full-screen-pass equivalents); with draw() reduced to clearRect + one fill the harness is already p95 21.9 ms. No verifier found a visually-equivalent path below ~30 ms p95 in software raster. Therefore (W02): keep p95 < 16.7 ms as the ON-DEVICE shipping target (real iPhone, GPU-backed canvas, Safari Web Inspector timeline; W06 + W05 + W19 are the levers there) and re-base the harness gate to what it can resolve: 3-run median p95 <= 40 ms and frames > 33 ms <= 15% at --throttle 6 --dpr 2 two-thumb with ?fx=full (target 35), reported next to the same-session floor; plus a JS budget gate from in-page timers (update+draw+HUD p95 < 6 ms at 6x; currently 4.2 + 5.7 + 1.5); plus a --dpr 3 run as a trend line (must match the dpr 2 numbers after W06). Round exit: gate passes on dist/index.html (single build) in both modes with 0 page/frame errors.

### The harness gate as implemented (W02)

`node test/harness.mjs --url file://$PWD/dist/index.html --mode two --seconds 20 --throttle 6 --dpr 2 --fx full --floor --prof --reps 3 --gate` is the gate run. It prints one JSON report and then, on separate lines, the floor, the prof sections, each run, the medians and `GATE PASS` or `GATE FAIL: <reasons>`. The gate is evaluated on the median across `--reps` runs: **p95 <= 40 ms** and **frames over 33 ms <= 15%**, plus, with `--prof`, the **JS budget: p95 of (update + draw + hud) per frame < 6 ms** (the three timers are read in `main.js frame()` only when the page was opened with `?prof=1`, into `window.BellTheory.prof`). `--floor` measures `test/floor.html` (a bare full-screen canvas at the same dpr, `clearRect` per rAF, the same synthetic thumbs, 10 s) in the same session so every report carries the floor it was measured against. Exit codes: 1 on any page or in-game frame error (the floor page's errors count too), 2 when the gate fails and `--gate` was passed, 64 on a malformed flag (non-numeric or non-positive `--seconds/--throttle/--dpr`, `--reps` not an integer >= 1, `--mode` outside two|one, `--fx` outside full|auto|low, a flag with no value, an unreadable seed file: usage on stderr, nothing launched), else 0. Console lines of the form `Failed to load resource` (the Google Fonts stylesheet through the sandbox proxy, until W03) are recorded in `resourceErrors[]` and do not set the exit code. The report mirrors the median run's `fps`, `timeline`, `screenshots`, `audio`, `deaths`, `maxDist` and `lastCoins` at the root next to `summary`/`runs`, so readers of the single-run shape keep working. `--seed-storage` must hold a complete `thumbtone.v3` state object with a 2-entry `slots` array: `loadState()` discards anything else and falls back to the defaults, and the seeded best is only visible after the first death (`#deadBest`, reported as `lastBest`). `--prof` resets the ring when the thumbs go down, so only run frames (the last 600 of them) are read. A `--dpr 3` run is the trend line for W06 and is not gated.

**p95 < 16.7 ms (60 fps) is the on-device shipping target, not the harness gate.** This headless Chromium has no GPU canvas (`2d_canvas=unavailable_software`, SwiftShader): every full-screen alpha pass draw() records is rasterised on the 6x-throttled main thread at canvas flush, ~2.75 ms each at dpr 2, and the bare floor is already p50 ~6 / p95 ~10 ms. 16.7 ms leaves ~7 ms for the whole picture, and with draw() cut down to clearRect plus one fill the harness still measures p95 ~22 ms, so no visually-equivalent picture can pass 16.7 here. The harness gate is therefore re-based to what this rasteriser can resolve (40 ms / 15%, reported next to the same-session floor), and 16.7 ms is checked on a real iPhone with a GPU-backed canvas via the Safari Web Inspector timeline (W34 checklist; W06, W05 and W19 are the on-device levers).

### Expected harness trajectory (two-thumb, --throttle 6, dpr 2, 20 s)

| After | p50 ms | p95 ms | Note |
|-------|--------|--------|------|
| baseline | 34-42 | 55-65 | measured, 8+ runs |
| W04 seam layer | 26-29 | 49-51 | 3 runs each, auditor + verifier |
| + W05 CSS camera | ~22-25 | ~38-45 | run-phase p95 -15; whole-run -7..-11 |
| + W06 DPR cap | same | same | dpr 3 run becomes equal to dpr 2 (was p50 71 / p95 118) |
| + W07/W15/W17/W18 | ~20-24 | ~33-40 | auditor combined set measured 19-20 / 33-35 |
| + W19 adaptive (auto) | ~14-18 | ~25-30 | only on devices whose run p95 > 33 ms; gate is measured with ?fx=full |
| harness floor | 5.8 | 9.7 | bare canvas + clearRect, harness-driven |
| device target | — | < 16.7 | DPR-3 iPhone, GPU canvas, Safari timeline (W34 checklist) |

## Results (2026-09-23, after the lane merge)

Measured on the merged tree with `test/harness.mjs` on this 4-CPU sandbox (headless Chromium, software raster, 390×844, dpr 2, `--throttle 6`, two-thumb 20 s, `?fx=full`, medians of 3 runs interleaved base/merged by the perf verifier; base = build of `3bcbbf2`, the split before any work item).

| | base | merged | note |
|---|---|---|---|
| p50 | 39.8 ms | 24.1 ms | |
| p95 | 64.5 ms | 42.4 ms | gate limit 40; misses by ~2 ms on a shared box |
| p99 | 79.6 ms | 50.6 ms | |
| frames > 33 ms | 68.2 % | 11.4 % | gate limit 15 %: pass |
| fps | 24.4 | 41.7 | |
| JS update+draw+hud p95 | 8.7 ms | 6.3 ms | gate limit 6; one run passed at 5.7 |
| one-thumb 12 s p50 / p95 | 23.1 / 42.1 | 16.5 / 34.6 | gate pass |
| dpr 3 p50 / p95 | 76.3 / 120.2 | 24.5 / 44.3 | W06: equal to dpr 2 |
| `?fx=auto` p50 / p95 | — | 22.1 / 34.3 | W19 drops to low at ~4.6 s at 6x; never at 1x |
| harness floor p50 / p95 | 5.8 / 8.1 | 6.0 / 9.2 | bare canvas, same session |
| first-touch startBeds | 55–100 ms | 8–15 ms | W16, instrumented |
| audio automation events | ~581 /s | ~27 /s | W17c, unthrottled |

Per item (verifier measurements; "n/a, device" = only a phone can tell):

| Item | Result |
|---|---|
| W03 fonts | 0 network requests with everything but file:/localhost aborted; `document.fonts.check` true for Sora 400/600/700 and Plex 400/500; sha256 pins pass |
| W04 seam | `#seamEl` opacity 0.29–0.48 in a two-thumb run, 0 one-thumb, 0 on the crash card; band luminance +37 vs flanks (base one-thumb had +21) |
| W05 camera | transform on every run frame (sway up to 10.9 px), 28 distinct shake transforms in the death window; held-thumb `tx` error 0.0000 px on swayed frames |
| W06 DPR cap | `canvas.width` 780 at dpr 2 and 3 (base 1170); halo falloff profile equal to base at 0.5 px steps |
| W07 HUD | DOM written only on change; prof hud p95 1.2 ms |
| W08 overlays | mid-run `elementFromPoint` on the picker returns the canvas; taps there no longer flip the mode |
| W09 mode switch | pending flip applied at run end; note shown; lanes unchanged mid-run |
| W10 sweep | forced d=1 lit: 0 skips (was 9); ordinary frames bit-identical |
| W14 arps | audio-clock gaps 70.00/70.00/70.00 ms at 6x (was 0–150); hidden page stays suspended |
| W15 halo sprite | pixel diff ≤ 2/255 at integer positions, ≤ 6 (dpr 2) / 9 (dpr 3) at fractional ones across the halo band; same-dpr resize rebuilds 0 sprites |
| W16 audio prebuild | `audio.started` false and nothing connected before the first pointerdown; startBeds 8–15 ms |
| W17 micro | grid culling 0 differing channels; bars frozen when muted; setTargetAtTime 27/s |
| W18 voice hygiene | click/crash/coin renders within tolerance; first-hit click gain v·0.6·n (a shadowed local made it ×529 before the fix) |
| W19 adaptive | low at 4.6 s under 6x, never unthrottled; low-vs-full diff confined to R+10 px of the orbs |
| W20 one-thumb pump | tank reaches 100 within ~4 s per life (base max 22 in 12 s) |
| W21 hint | visible ≥ 2.2 s at alpha 1 before every first-barrier death on fresh storage; crash card ends with "pump ↕ to charge" |
| W22 record | `bestCombo` 0 at every run start; "new best" label + gold flash on a record, "crashed" otherwise |
| W23 save v4 | seeded `thumbtone.v3` → `belltheory.v4` with v 4 and the seeded best; reset keeps best and life |
| W24 odds | 6001 rows: blue 3.17 % (nominal 3.33), purple 0.417 % (nominal 0.40) |
| W25 pause | 20-check probe passes (300 ms lockout, 3-2-1 hold, hide/show keeps a user pause, panel round trip) |
| W26 gate | `__BT_UNLOCKED=false`, `FREE_RUNS=2`: third run blocked, gate rows shown, `setUnlocked(true)` re-enables; inert by default |
| W27 Capacitor | `cap:sync` exit 0; 0 Landscape in Info.plist; manifest portrait + predictive back; config parses; usage string present. Compile: n/a, device |
| W28 safe-area | content offsets identical padded and unpadded (first stat top 78 px, gauge gap 46 px); harness env()=0 unchanged |
| W29 haptics | web histogram same shape as the prototype; faked bridge routes 24 calls through Haptics impact/notification, 0 `navigator.vibrate`. Feel: n/a, device |
| W30 Preferences | 61 slider inputs → 61 localStorage writes, 1 `Preferences.set`; flush on hidden; late get no longer clobbered (fixed after the verifier caught it) |
| W31 lifecycle | suspend freezes dist and suspends audio; resume while hidden or with the sheet open stays paused; user pause survives hide/show |
| W32 back | title → minimize; run → panel (paused); back → close (grace); rotate guard → minimize |
| W33 audio session | unlock element paused on hide/mute, playing on show/unmute, never played while hidden; native: 0 audio elements, AVAudioSession set in AppDelegate. Ring switch: n/a, device |

## Device checklist (TestFlight / internal testing)

None of this can be measured in the sandbox. Each line is a pass/fail to record on a real phone before submission.

1. **Frame time on a DPR-3 iPhone.** Safari Web Inspector → Timelines, 60 s of two-thumb play with boost: p95 < 16.7 ms is the real gate (W06, W05, W19 are the levers). Record p50/p95 and whether `fx.level` ever drops to low (`window.BellTheory.fx`).
2. **Silent switch on.** Bed and thump audible in the app (W33 AVAudioSession). If silent: set `NATIVE_MEDIA_UNLOCK = true` in `src/audio.js` and log it.
3. **Background music.** Music keeps playing under the bed (`.mixWithOthers`); no Now Playing entry after backgrounding.
4. **Haptic feel per kind.** tap, combo, blue, surge, smash (light/heavy), empty, crunch, ignite, purple, record, storm, die; note any kind that feels wrong or gets dropped by the rank throttle.
5. **Safe area.** Screenshot on iPhone 15 Pro (notch) and an Android with a hole punch: HUD not under the notch, gauge above the home indicator.
6. **Android back.** Settings open → closes; mid-run → pauses into settings; title → minimizes; predictive-back animation works.
7. **Edge-to-edge (Android 15).** Status/nav bars transparent, no double insets.
8. **Photo picker.** Orb picture from the library; check whether the sheet still offers "Take Photo" (if so, add `NSCameraUsageDescription`).
9. **Persistence.** Force-quit mid-run, relaunch: best and settings intact; kill within 1 s of a settings change: nothing lost.
10. **Pause menu.** Thumbs-down auto pause, 3-2-1 resume, app switcher during a user pause returns paused.
11. **Cold start on a slow device.** Time to first frame; late Preferences read (log) does not reset settings.
12. **StoreKit (next round).** Unlock and restore flows against a sandbox account; price label from the product, never hardcoded.

## Work items

### W01 · Split prototype/bell-theory.html into the Vite project (index.html + src/*.js) with harness parity

**Priority** 1 · **Category** restructure · **Depends on** — · **Findings** native-04, native-03, native-01

**Files:** `index.html`, `src/styles.css`, `src/main.js`, `src/state.js`, `src/world.js`, `src/audio.js`, `src/game.js`, `src/render.js`, `src/input.js`, `src/ui.js`, `src/native.js`, `package.json`

**Change**

Create the module tree described in module_split (index.html, src/styles.css, src/main.js, src/state.js, src/world.js, src/audio.js, src/game.js, src/render.js, src/input.js, src/ui.js, src/native.js). Rules: plain ES modules, no TypeScript, keep the existing var/function style and every comment; no module does DOM or state work at import time (top level = declarations only); every module that needs setup exports init(); src/main.js runs the boot sequence: native.loadPersisted() raced against a 1000 ms timeout -> state.hydrateState(json) -> render.initRender() -> audio.initAudio() -> ui.initUI() -> input.initInput() -> game.resetCursors() -> requestAnimationFrame(frame). Shared mutable values that today are closure vars become fields on exported objects: W/H/dpr/realDpr/canvas/ctx2d/wrap -> render.view; scrollOffset/parallelOn/mirrorHint (lines 1555-1558) -> game.scrollOffset/game.parallelOn/game.mirrorHint; lastTs/errCount/lastErr (1556, 2132) -> main.loop {lastTs, errCount, lastErr} with export function resetClock(){ loop.lastTs = 0; } used by every path that today writes lastTs = 0 (1505, 2178, 2192). Import cycles (game<->ui, render<->game, main<->ui) are fine because all cross-module reads happen inside functions after init. Keep prototype/bell-theory.html and prototype/index.html untouched as the pre-split reference for this round. package.json scripts: "build:single": "vite build --mode single", "smoke:dist": "vite build --mode single && node test/harness.mjs --url file://$PWD/dist/index.html", "smoke:preview" (vite preview + harness over http://localhost:4173 for the multi-asset build; Chromium refuses type=module scripts from file://, measured).

**Verification**

npm run build:single && node test/harness.mjs --url file://$PWD/dist/index.html --mode two --seconds 20 --throttle 6 --out .harness/w01 and --mode one --seconds 12: 0 page errors, 0 in-game frame errors, deaths >= 1 with auto-restart, tank reaches 100 in two-thumb; p50/p95 within +-5 ms of a prototype/index.html run made in the same session (run both back to back, sequentially, nothing else on the box); screenshots two-2-run.png / one-2-run.png visually identical to .harness/mobile-base-2/*. Also vite build (multi-asset) + vite preview + harness over http: 0 errors.

### W02 · Harness upgrades and the re-based perf gate (dpr flag, pointer ids, floor, JS budget, seed storage)

**Priority** 2 · **Category** perf · **Depends on** W01 · **Findings** mobile-harness-floor-target, render-01, update-01, mobile-sway-css-transform

**Files:** `test/harness.mjs`, `test/floor.html`, `src/main.js`, `docs/AUDIT.md`

**Change**

test/harness.mjs: (1) line 30 deviceScaleFactor: Number(opt('--dpr', 2)). (2) synthetic thumb pointerIds 1/2 -> 11/12 (and isPrimary: id === 11): Playwright/Chromium's mouse is pointerId 1, and a moving canvas (W05) emits trusted mouse pointerout with id 1 that the game's pointerout handler treats as the left thumb lifting, leaving runs dead for 54-62% of frames (measured). (3) --floor: before the game run, load test/floor.html (a page with only a full-screen canvas and ctx.clearRect per rAF, same viewport/dpr/throttle, driven by the same thumbs for 10 s) and print its p50/p95 as 'floor' in the JSON. (4) --prof: read window.BellTheory.prof (a 600-entry ring of {update, draw, hud} ms that main.js fills only when location.search contains prof=1) and print p50/p95 per section. (5) --fx full|auto appended as ?fx= to the URL (W19). (6) --seed-storage <file.json>: ctx.addInitScript((j) => localStorage.setItem('thumbtone.v3', j), fs.readFileSync(file,'utf8')) before goto (W23 migration test). (7) Gate summary line: PASS/FAIL against p95 <= 40 ms and over33 <= 15% (3-run median when --reps 3 is given), plus JS budget PASS/FAIL (update+draw+hud p95 < 6 ms). Keep exit code 1 on any page error. Document in docs/AUDIT.md that p95 < 16.7 ms is the on-device target and why the harness cannot reach it (see perf_summary).

**Verification**

node test/harness.mjs --url file://$PWD/dist/index.html --mode two --seconds 20 --throttle 6 --floor --prof --reps 3: floor p95 ~8-10 ms; prof update p95 ~4, draw ~6, hud ~1.5 before the perf items; no ERR_TOO_MANY_RETRIES console lines after W03; --dpr 3 run completes and prints its own stats.

### W03 · Self-host the two font families; remove the render-blocking Google Fonts stylesheet

**Priority** 3 · **Category** bug · **Depends on** W01 · **Findings** mobile-fonts-render-blocking

**Files:** `index.html`, `src/styles.css`, `src/fonts/`, `test/fonts-check.mjs`, `docs/DECISIONS.md`

**Change**

Delete the three <link> tags (source lines 2-4; prototype/index.html 18-20). Fetch once with an iPhone UA the exact latin files Google serves (Sora variable wght 400-800, 25,240 B; IBM Plex Mono 400 10,052 B and 500 10,060 B) and commit them as src/fonts/sora-latin-wght.woff2, src/fonts/ibm-plex-mono-latin-400.woff2, src/fonts/ibm-plex-mono-latin-500.woff2 plus OFL.txt; pin their sha256 in test/fonts-check.mjs. In src/styles.css add three @font-face rules: 'Sora' font-weight:400 700 src:url(./fonts/sora-latin-wght.woff2) format('woff2-variations'); 'IBM Plex Mono' 400 and 500; all font-display:swap and Google's latin unicode-range verbatim (U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD) so the arrows keep falling back exactly as today. No <link rel=preload>. Vite inlines the files in --mode single (measured pixel-identical title screen, 0/1,316,640 px differ) and emits them under dist/assets otherwise. Do NOT change the canvas font string at line 2118 and do not add a 600 face (it changes HUD/floating text rendering). Fallback only if the fetch is impossible: @fontsource/sora + @fontsource/ibm-plex-mono latin-* CSS imports (74 kB; accepted small metric differences on Chromium).

**Verification**

Harness run with page.route aborting everything not file:/localhost (test/scratch-mobile-fonts.mjs pattern): FCP < 100 ms, zero network requests, document.fonts.check true for Sora 400/600/700 and Plex 400/500; harness console errors [] in 5 consecutive runs (no ERR_TOO_MANY_RETRIES).

### W04 · Draw the centre seam as a compositor DOM layer under the canvas; no seam in one-thumb mode

**Priority** 4 · **Category** perf · **Depends on** W01, W02 · **Findings** mobile-seam-dom-layer

**Files:** `index.html`, `src/styles.css`, `src/render.js`

**Change**

HTML (index.html, immediately before <canvas id="stage">, source line 493): <div id="seamClip" aria-hidden="true"><div id="seamEl"></div></div>. CSS: #seamClip{position:absolute;inset:0;overflow:hidden;pointer-events:none} #seamEl{position:absolute;top:0;bottom:0;left:calc(50% - 40px);width:80px;transform-origin:50% 50%;background:linear-gradient(90deg,rgba(255,255,255,0),#fff,rgba(255,255,255,0));opacity:0;will-change:opacity,transform}. src/render.js: var seamEl, seamLastA = -1; delete the per-frame gradient fill (source 1870-1877) and replace with: var seamA = (lanes() === 2 && game.phase !== PHASE_DEAD) ? 0.08 + world.warmth*0.5 : 0; if(seamEl && Math.abs(seamA - seamLastA) > 0.003){ seamLastA = seamA; seamEl.style.opacity = seamA.toFixed(3); } (the PHASE_DEAD gate is design-run-end's legibility fix: the band washed the death CTA in .harness/design/two-death.png). The seam follows the camera by receiving the same transform string as the canvas (W05, seamEl.style.transform = xf when it changes). The tank fill column (1879-1898) stays on the canvas. setOneHand needs nothing: lanes() is read every frame.

**Verification**

Harness two-thumb 20 s 6x, 3 sequential runs: p50 26-29 / p95 49-51 vs base 35-42 / 59-65 (auditor and verifier both measured). one-thumb screenshot shows no centre band (compare .harness/mobile-base-2/one-2-run.png which has it); two-thumb screenshot shows the band under the gold column. 0 errors.

### W05 · Shake and camera sway as a CSS transform on the canvas instead of ctx2d.translate/rotate; input stays in unswayed coordinates

**Priority** 5 · **Category** perf · **Depends on** W01, W02, W04 · **Findings** mobile-sway-css-transform

**Files:** `src/styles.css`, `src/render.js`, `src/input.js`

**Change**

CSS: .stage-wrap{ position:relative; flex:1; min-height:0; overflow:hidden; } (clips the moved canvas where the bitmap edge used to); #stage gets will-change:transform. src/render.js draw(): keep ctx2d.clearRect and save()/restore(); replace source 1809-1821 with: var sx=0, sy=0, swx=0, rot=0; if(game.shake > 0 && !reduceMotion){ sx=(Math.random()-0.5)*game.shake*14; sy=(Math.random()-0.5)*game.shake*14; } if(game.phase === PHASE_RUN && !reduceMotion){ var swayAmp = difficulty()*9 + (game.boost > 0 ? 4 : 0); swx = Math.sin(world.time*0.85)*swayAmp; rot = swx*0.0009; } var xf = (sx || sy || swx) ? "translate(" + sx.toFixed(2) + "px," + sy.toFixed(2) + "px) rotate(" + rot.toFixed(5) + "rad) translate(" + swx.toFixed(2) + "px,0)" : ""; if(xf !== camXf){ camXf = xf; view.canvas.style.transform = xf; if(seamEl) seamEl.style.transform = xf; } (declare var camXf = ""; CSS transform-origin is the element centre = (W/2,H/2), so this composition equals the old translate(shake) translate(c) rotate(r) translate(-c+sway) exactly; Math.random is still called exactly twice per shaking frame so spawn RNG order is unchanged). Keep the flash fillRect (2124-2127). src/input.js: both pointer handlers read var rect = view.wrap.getBoundingClientRect() instead of canvas.getBoundingClientRect() (source 1426, 1465) so the thumb-to-orb mapping never follows the transform (measured error 0.00 px vs up to 8.6 px otherwise); register named onPointerDown/onPointerMove on both canvas and wrap (wrap handler guarded by e.target === wrap) so a press in the <=20 px strip the canvas slid away from still binds; pointerout: if(e.pointerType === "mouse" && !(e.relatedTarget && view.wrap.contains(e.relatedTarget))) release(e). Optional exact flash parity on the exposed strip: cached write of wrap.style.background = "rgba(" + game.flashColor + "," + (game.flash*0.3).toFixed(3) + ")" while game.flash > 0.

**Verification**

Harness (with W02 pointer ids) two-thumb 20 s 6x, 3 runs: run-phase p95 ~48 vs ~64 base; whole-run p95 -7..-11 ms; deaths and restarts continue for the full 20 s (no dead-phase contamination: check phase share in --prof output or screenshots). Add a check to a scratch test: with a synthetic thumb held at fixed clientX/Y on a swayed frame, cursors[0].tx equals the unswayed x within 0.01 px. Screenshots show the lean and shake still present.

### W06 · Cap the canvas backing store at DPR 2 with glow-size compensation

**Priority** 6 · **Category** perf · **Depends on** W01, W02 · **Findings** mobile-dpr-cap, render-01, update-01

**Files:** `src/render.js`, `docs/DECISIONS.md`

**Change**

src/render.js: var DPR_CAP = 2; export var view = { canvas, ctx2d, wrap, W:0, H:0, dpr:1, realDpr:1 }; function resize(){ var rect = view.wrap.getBoundingClientRect(); view.W = rect.width; view.H = rect.height; view.realDpr = Math.max(1, window.devicePixelRatio || 1); view.dpr = Math.min(DPR_CAP, view.realDpr); view.canvas.width = Math.round(view.W*view.dpr); view.canvas.height = Math.round(view.H*view.dpr); view.ctx2d.setTransform(view.dpr,0,0,view.dpr,0,0); clearHaloCache(); } (cap lives inside resize so the window resize handler cannot re-raise it). Because ctx shadowBlur is applied in backing-store pixels (measured: blur 34 spans 25.75 CSS px at dpr 2, 20.8 at dpr 3), every shadowBlur set from a CSS-unit glow value (source 2090 and the halo sprite in W15) becomes glow * view.dpr / view.realDpr so the halo keeps today's on-screen size on 3x phones. No runtime governor and no 1.5 step-down (both verifiers: fractional dpr shimmers 1 px grid lines and pops mid-run). Log the accepted trade (slightly softer 1 px lines/text on DPR-3 phones) in DECISIONS.md.

**Verification**

node test/harness.mjs --url ... --dpr 3 --mode two --seconds 20 --throttle 6: p50/p95 equal to the --dpr 2 run within noise (base dpr3 was p50 65-71 / p95 95-118); --dpr 2 unchanged; canvas.width reads 780 at both dpr 2 and 3 (page.evaluate). Screenshot at --dpr 3 shows orbs/barriers/text without visible softening at 1170 px width.

### W07 · HUD DOM written only on change; CSS-animation restarts without forced reflow; layout containment

**Priority** 7 · **Category** perf · **Depends on** W01 · **Findings** render-06, update-03, dom-2, mobile-harness-floor-target

**Files:** `src/ui.js`, `src/game.js`, `src/main.js`, `src/styles.css`

**Change**

src/ui.js: export function syncHud(ts) replacing source 2143-2157, with caches declared next to GAUGE_C: var hud = { off:null, num:null, hot:null, ready:null, mult:null, gh:null, sh:null, playing:null, label:null, dist:null, coins:null, sOn:null, live:null, aname:null, err:null }; body: var c = Math.max(0, Math.min(1, game.charge)); var off = (GAUGE_C * (1 - c)).toFixed(1); if(off !== hud.off){ hud.off = off; gaugeFill.style.strokeDashoffset = off; } var n = Math.round(game.charge*100); if(n !== hud.num){ hud.num = n; gaugeNum.textContent = n; } var hot = game.boost > 0; if(hot !== hud.hot){ hud.hot = hot; gauge.classList.toggle("hot", hot); } var ready = game.boost === 0 && game.charge >= 0.85; if(ready !== hud.ready){ hud.ready = ready; gauge.classList.toggle("ready", ready); } if(game.parallelOn !== hud.mult){ hud.mult = game.parallelOn; coinMult.hidden = !game.parallelOn; } var gh = game.phase === PHASE_DEAD; if(gh !== hud.gh){ hud.gh = gh; gauge.hidden = gh; } var sh = game.phase === PHASE_READY; if(sh !== hud.sh){ hud.sh = sh; statsEl.hidden = sh; } var pl = game.phase === PHASE_RUN; if(pl !== hud.playing){ hud.playing = pl; appEl.classList.toggle("playing", pl); } var lb = hot ? "LIT" : (game.charge < 0.03 ? "PUMP ↕" : "BOOST"); if(lb !== hud.label){ hud.label = lb; gaugeLabel.textContent = lb; } if(ts - lastHud > 90){ var d = Math.floor(game.dist); if(d !== hud.dist){ hud.dist = d; distVal.textContent = d; } if(game.coins !== hud.coins){ hud.coins = game.coins; coinVal.textContent = game.coins; } syncSoundBtn(); lastHud = ts; } (exact toFixed(1) string as the key: do NOT quantise the ring to 1%). syncSoundBtn (source 2203): after the soundBtn guard add var live = isAudioLive(), an = state.soundOn ? audioStateName() : "muted"; if(hud.sOn === state.soundOn && hud.live === live && hud.aname === an && hud.err === loop.errCount) return; hud.sOn = state.soundOn; hud.live = live; hud.aname = an; hud.err = loop.errCount; (no cache resets needed: frame()/syncSoundBtn are the only writers). Animation restarts: replace the three remove/void offsetWidth/add sequences (source 1182 comboBadge pop, 1308-1310 comboBadge pop, 1326-1327 gauge tick) with restartAnim(el, cls): var frameNo = 0; var animFrame = { tick:-1, pop:-1 }; function restartAnim(el, cls){ if(animFrame[cls] === frameNo) return; animFrame[cls] = frameNo; var alt = cls + "2"; if(el.classList.contains(cls)){ el.classList.remove(cls); el.classList.add(alt); } else { el.classList.remove(alt); el.classList.add(cls); } } and frameNo++ at the top of frame() (idempotent per frame so two same-frame strokes/threads still restart, unlike a bare toggle). CSS: .gauge.tick, .gauge.tick2{ animation:gaugeTick .16s ease-out; } .gauge.tick2{ animation-name:gaugeTick2; } @keyframes gaugeTick2 identical to gaugeTick; same pair for .stat.pop b / .stat.pop2 b with statPop2; add tick2/pop2 to the reduced-motion rules; .gauge, .stats{ contain:layout style paint; } (measured 0 differing pixels in .ready/.hot). Do NOT remove backdrop-filter or the g-fill drop-shadow.

**Verification**

--prof hud p95 0.15-0.2 ms (from 0.3-0.4); CDP trace forced layouts inside JS 0 (was 15 per 12 s); a scratch check that calls restartAnim twice in one frame then reads gauge.getAnimations()[0].currentTime ~0 ms; screenshots of gauge states (empty, PUMP, ready pulse, LIT, hidden on DEAD, stats hidden on READY) identical to baseline; harness 0 errors.

### W08 · Hidden overlays leave hit-testing, focus and the a11y tree: the invisible title-screen mode picker no longer flips the mode mid-run

**Priority** 8 · **Category** bug · **Depends on** W01 · **Findings** bugs-01, dom-6

**Files:** `src/styles.css`, `index.html`, `src/ui.js`, `src/game.js`

**Change**

src/styles.css (source 147-153): .overlay{ position:absolute; inset:0; pointer-events:none; user-select:none; text-align:center; transition:opacity .3s ease, transform .3s ease, visibility 0s linear 0s; } .overlay.gone{ opacity:0; transform:translateY(8px); visibility:hidden; transition:opacity .3s ease, transform .3s ease, visibility 0s linear .3s; } .overlay.gone .mode-seg{ pointer-events:none; } .overlay.gone .cta{ animation-play-state:paused; } @media (prefers-reduced-motion: reduce){ .overlay{ transition:opacity .2s ease, visibility 0s linear 0s; } .overlay.gone{ transform:none; transition:opacity .2s ease, visibility 0s linear .2s; } } (durations match the existing .3s fade so run-start/death cross-fades are unchanged). index.html: <div class="overlay gone" id="overlayDead" inert>. src/ui.js: export function setOverlay(el, shown){ el.classList.toggle("gone", !shown); if(shown) el.removeAttribute("inert"); else el.setAttribute("inert", ""); } and use it at the three toggles (source 1082-1083 in startRun, 1123 in finishDeath). No JS guard in setOneHand here (W09 owns that).

**Verification**

Scratch check (test/scratch-refute-bugs01.mjs pattern): mid-run document.elementFromPoint(195,576) and (300,576) return CANVAS#stage (was BUTTON[data-mode]); a real CDP tap at (230,576) mid-run leaves state.oneHand unchanged; a held touch at (300,576) mid-run binds side 1; on the death screen the same touch restarts; title-screen taps on the picker still switch modes both ways; getComputedStyle(overlayReady).visibility === 'hidden' 350 ms after start. Harness both modes 0 errors, restarts still detected (harness reads overlayDead's gone class).

### W09 · A mode switch requested mid-run applies when the run ends, never mid-run (ghost-orb death and half-lane rows)

**Priority** 9 · **Category** bug · **Depends on** W01, W08 · **Findings** bugs-02

**Files:** `src/game.js`, `src/ui.js`, `index.html`

**Change**

src/game.js (or ui.js, wherever setOneHand lands): var pendingOneHand = null; function setOneHand(on){ if(game.phase === PHASE_RUN){ pendingOneHand = (!!on === state.oneHand) ? null : !!on; syncOneHand(); return; } state.oneHand = !!on; saveState(); sidePointer[1] = null; cursors[1].active = false; resetCursors(); syncOneHand(); } In finishDeath (source 1108-1126), immediately BEFORE showing the dead overlay (phase is already PHASE_DEAD): if(pendingOneHand != null){ var p = pendingOneHand; pendingOneHand = null; setOneHand(p); } (NOT in startRun: the restart gate at 1433/1449/1475 is evaluated with the old lanes() and would recreate the ghost orb; also startRun must not call resetCursors, which teleports the live orb). syncOneHand (source 2421-2435): var chosen = pendingOneHand != null ? pendingOneHand : state.oneHand; render the segment and the checkbox from chosen; modeNote.hidden = pendingOneHand == null; CTA copy still from state.oneHand. index.html: <p class="note" id="modeNote" hidden>applies to your next run</p> before <div id="slotList"> (source 574).

**Verification**

Scratch (test/scratch-preserve-b02.mjs pattern, B02 env pointing at dist): one-thumb run, open panel, flip #oneHandToggle, close: state.oneHand unchanged, toggle shows the chosen value, note visible, lanes()==1, no death at x~212 with the right side untouched over 10 s; at death the CTA reads the new mode and the next run starts in it; flipping back while running clears the note. Harness 0 errors.

### W10 · Swept barrier collision: a barrier cannot jump the orb on a long frame (steel stops paying out on mid-range phones)

**Priority** 10 · **Category** bug · **Depends on** W01 · **Findings** bugs-03

**Files:** `src/game.js`

**Change**

src/game.js update(): track the avatar's per-frame vertical travel: in the cursor loop before px/py are overwritten (source 1593) c.dy = c.y - c.py; c.px = c.x; c.py = c.y; initialise c.dy = 0 in makeCursor (1025) and in the pointerdown reset (1445). Obstacle loop: line 1675 becomes var mv = game.speed*wdt; o.y += mv; and lines 1688-1691 become: var rel = mv - c.dy; /* barrier down + avatar up, this frame */ var ext = Math.max(0, rel - o.h - HIT_R); /* > 0 only when the relative travel exceeds the band, i.e. a tunnel was possible; 0 on every ordinary frame so the test is bit-identical to today */ var inBand = o.y - ext < c.y + HIT_R && o.y + o.h > c.y - HIT_R; ... if(circleRectHit(c.x, c.y, HIT_R, rc.x, o.y - ext, rc.w, o.h + ext)){ ... GRAZE sampling (1698-1701) uses the swept inBand; the pass test o.y > c.y + HIT_R (1704) is unchanged. Rationale (both verifiers): the barrier-only sweep misses avatar-driven tunnels seen at d=0.08-0.24 while pumping (avatar moved 67 px up in a 48 ms frame), and a full sweep changes verdicts on ordinary diagonal slides; the max(0, rel - band) form is exact on ordinary frames and closes both tunnel cases.

**Verification**

test/scratch-refute-bugs03-{build,run}.mjs pattern against dist: forced d=1 + lit, 40 s at 6x: skips 0 (was 9); natural throttled 20 s: skips 0 (was 1/run); unthrottled 20 s: 0 verdict differences vs baseline over ~3600 run frames; manual 50 ms frame at dist 2600 lit with a steel wall 30 px above the orb -> die('steel') fires and dist does not increase.

### W11 · One pointer can never own both sides (mouse in two-thumb mode started unwinnable runs)

**Priority** 11 · **Category** bug · **Depends on** W01 · **Findings** bugs-05

**Files:** `src/input.js`

**Change**

src/input.js onPointerDown, after the if(sidePointer[side] !== null){...return;} block and before setPointerCapture (source 1438): if(sidePointer[1 - side] === e.pointerId) return; Nothing else: do not add a pointerType==='mouse' early return (it would silence the first-touch soundbed unlock that DECISIONS.md requires) and do not disable the TWO THUMBS segment.

**Verification**

Non-touch context (test/scratch-refute-bugs05-fix.mjs): two-thumb mode, click left -> sidePointer [1,null] and beds start; click right -> still [1,null], phase stays READY; leaving the field -> [null,null]. hasTouch context two-finger sequence identical to baseline step for step.

### W12 · Strokes do not register and BOOST cannot fire while paused

**Priority** 12 · **Category** bug · **Depends on** W01 · **Findings** bugs-04

**Files:** `src/game.js`

**Change**

src/game.js: registerStroke first line (source 1314): if(game.dying > 0 || game.paused || game.phase !== PHASE_RUN) return; cursor loop (source 1594): if(game.phase === PHASE_RUN && c.active && !game.paused){ ... } so strokeDir/strokeStart resync on resume instead of counting the pre-pause half stroke. Grace (wdt = 0) remains strokeable by design.

**Verification**

test/scratch-refute-bugs04-rotate.mjs pattern: thumbs held, viewport rotated to 844x390 (paused), 60 real touchMoves +-60 px -> charge unchanged, boost 0; unpaused pumping traces identical to baseline (24-stroke charge trace matches).

### W13 · A caught draw() error no longer leaks the canvas save() stack

**Priority** 13 · **Category** bug · **Depends on** W01 · **Findings** bugs-06

**Files:** `src/main.js`

**Change**

src/main.js frame() catch block (source 2139-2142): after the console.error guard add for(var ri = 0; ri < 8; ri++) view.ctx2d.restore(); (restore on an empty stack is a no-op; draw() nests at most 3 deep; this returns transform/alpha/dash to the base state resize() set without clearing the canvas, whereas ctx.reset() would blank the frame on every error frame).

**Verification**

test/scratch-preserve-catch.mjs pattern: 5 synthetic throws with shake=1 then a clean frame -> ctx2d.getTransform() === [2,2,0,0], globalAlpha 1, lineDash [], 0 leaked levels; error-frame pixel counts equal to the unfixed page (no blanking).

### W14 · Arpeggios scheduled on the audio clock; a hidden page can never be re-resumed by a timer

**Priority** 14 · **Category** bug · **Depends on** W01 · **Findings** audio-3

**Files:** `src/audio.js`

**Change**

src/audio.js: function blipAt(t, freq, dur, type, vol) = blip's body with an explicit start time (keeps dur, vol||0.16, ramps at t+0.012 / t+dur*0.8 / t+dur, osc.stop(t+dur+0.02)); blip(freq,dur,type,vol) = blipAt(ctx.currentTime, ...). arp (source 1214-1219, moved to audio.js): var ctx = ensureAudio(); if(!ctx) return; var t0 = ctx.currentTime; for(var i=0;i<freqs.length;i++) blipAt(t0 + i*gapMs/1000, freqs[i], 0.18, type, vol); (no setTimeout). ensureAudio resume branch (source 833-836): if(audio.ctx.state !== "running" && !document.hidden){ ... resume() }.

**Verification**

test/scratch-refute-audio3-jitter.mjs: purple arp gaps 55/55/55/55 ms at 6x (was 0-150 ms); test/scratch-refute-audio3-hidden.mjs: after a faked hide with an arp pending the context stays 'suspended' and currentTime is frozen for 2 s.

### W15 · Orb halo as a cached sprite (halo only, body still drawn live) instead of a live shadowBlur every frame

**Priority** 15 · **Category** perf · **Depends on** W01, W02, W06 · **Findings** render-02

**Files:** `src/render.js`, `src/ui.js`

**Change**

src/render.js: drawShape(shape, x, y, r, color, g) takes an optional context (g = g || view.ctx2d). Add var haloCache = {}; export function clearHaloCache(){ haloCache = {}; } function haloSprite(shape, color, r, blur){ var key = shape + "|" + color + "|" + r + "|" + blur + "|" + view.dpr + "|" + view.realDpr; var s = haloCache[key]; if(s) return s; var pad = Math.ceil(blur*2 + 4), size = Math.ceil((r + pad)*2); var c = document.createElement("canvas"); c.width = Math.ceil(size*view.dpr); c.height = c.width; var g = c.getContext("2d"); g.setTransform(view.dpr,0,0,view.dpr,0,0); g.shadowColor = color; g.shadowBlur = blur * view.dpr / view.realDpr; drawShape(shape, size/2, size/2, r, color, g); g.shadowBlur = 0; g.shadowColor = "rgba(0,0,0,0)"; g.globalCompositeOperation = "destination-out"; drawShape(shape, size/2, size/2, r, "#000", g); g.globalCompositeOperation = "source-over"; s = { c:c, size:size }; haloCache[key] = s; return s; } Replace source 2088-2095 with: ctx2d.save(); var glow = Math.min(34, state.glow + (game.parallelOn ? 16 : 0) + (game.boost > 0 ? 22 : game.charge*10)); ctx2d.globalAlpha = c.active ? 1 : 0.45; if(slot.mode === "image"){ if(glow > 0){ ctx2d.shadowColor = slot.color; ctx2d.shadowBlur = glow * view.dpr / view.realDpr; } drawImageBlob(c.x, c.y, DRAW_R, ensureImage(slot)); } else { if(glow > 0){ var hs = haloSprite(slot.shape, slot.color, DRAW_R, Math.round(glow)); ctx2d.drawImage(hs.c, c.x - hs.size/2, c.y - hs.size/2, hs.size, hs.size); } drawShape(slot.shape, c.x, c.y, DRAW_R, slot.color); } ctx2d.restore(); ctx2d.globalAlpha = 1; Invalidate: clearHaloCache() in resize() and in the slot colour/shape/mode/image handlers (src/ui.js renderSides). Pre-warm on entering PHASE_READY via requestIdleCallback (fallback setTimeout) for b in [max(1,state.glow), min(34, state.glow+10)] and 34 per non-image slot. If the destination-out punch leaves a 1 px dark seam on some GPU, fall back to a body+halo sprite used only when c.active and the live blur path when inactive.

**Verification**

Pixel diff of the orb region vs the live-blur build at fixed state (charge 0/0.5/1, active true/false, shapes circle/ring/star/diamond): max delta within a 1 px AA ring. Harness 20 s 6x --reps 3: p50 -1.5..-3 ms vs the W07 build, p95 not worse; must be interleaved with base runs because run-to-run spread is ~2 ms. Sprite build never lands on a run frame (no >10 ms JS spike in --prof draw p99 at ignition).

### W16 · Build the audio graph at load in idle time; the first touch only resumes and starts

**Priority** 16 · **Category** perf · **Depends on** W01, W14 · **Findings** audio-1

**Files:** `src/audio.js`, `src/main.js`, `src/render.js`

**Change**

src/audio.js: add drone:null, noisePCM:null to the audio object. function buildDroneVoices(ctx) creates the 4 oscillator/voice/lfo/lfoGain stacks from source 845-859 without calling start() and stores [osc, lfo] in audio.drone. function prepNoise(sr): if(audio.noisePCM && audio.noisePCM.length === 2*sr) return; fill a Float32Array(2*sr) with xorshift noise (s ^= s<<13; s ^= s>>>17; s ^= s<<5; pcm[i] = (s>>>0)/2147483648 - 1) — keep 2 s. startBeds(): var ctx = ensureAudio(); if(!ctx || audio.started) return; audio.started = true; buildDroneVoices(ctx); audio.drone.forEach(n => n.start()); prepNoise(ctx.sampleRate); var buf = ctx.createBuffer(1, audio.noisePCM.length, ctx.sampleRate); buf.copyToChannel(audio.noisePCM, 0); audio.noiseBuf = buf; audio.noisePCM = null; source -> loop -> audio.noiseFilter -> start; blip(660, 0.22, "triangle", 0.3); syncSoundBtn(); initAudio() (called from main after first paint): var idle = window.requestIdleCallback || function(cb){ return setTimeout(function(){ cb(); }, 0); }; idle(function(){ if(state.soundOn && !audio.started){ var c = ensureAudio(); if(c) buildDroneVoices(c); } if(!audio.started) prepNoise((audio.ctx && audio.ctx.sampleRate) || 44100); }); ensureAudio itself is unchanged (its resume() on a suspended pre-created context is the gesture-side unlock; with W14's !document.hidden guard). Keep pointerdown's unlockMediaSession()/startBeds() order. audioStateName(): if(!audio.ctx || !audio.started) return "not started"; draw()'s spectrum block additionally requires audio.started.

**Verification**

Instrumented copy (test/scratch-refute-audio1-run.mjs pattern): first-touch startBeds 8-15 ms at 6x (was 55-100), post-touch rAF gap 39-58 ms (was 102-140); Engine line reads 'not started' before the first touch; no node reaches destination before pointerdown (audio.started false); soundbed audible after first touch in both sound-on and sound-off-then-on paths.

### W17 · Draw/update micro bundle: grid row culling, FFT gating and bin table, driveAudio at 10 Hz, stable entity shapes

**Priority** 17 · **Category** perf · **Depends on** W01, W16 · **Findings** render-04, render-05, audio-5, audio-6, update-02, update-04

**Files:** `src/render.js`, `src/audio.js`, `src/game.js`, `src/ui.js`

**Change**

(a) Grid (source 1831-1851): after var y0 = Math.round(y)+.5; ctx2d.moveTo(0, y0); add var near = false; if(!reduceMotion){ for(var ci=0; ci<nl; ci++){ var ddy0 = y0 - cursors[ci].y; if(ddy0 < R && ddy0 > -R){ near = true; break; } } } if(!near){ ctx2d.lineTo(W, y0); continue; } (nl = lanes() hoisted); pixel-identical (rows beyond R have dy === 0). No offscreen tile (measured 2x slower). (b) FFT (source 1855-1868): in ensureAudio after the analyser is created: audio.binIndex = new Uint8Array(40); for(var i=0;i<40;i++) audio.binIndex[i] = 1 + Math.floor(Math.pow(i/40, 1.8) * 70); connect master->analyser only if(state.fft); the fft toggle handler does try{ if(state.fft) audio.master.connect(audio.analyser); else audio.master.disconnect(audio.analyser); }catch(e){} when audio.master exists. draw(): if(state.fft && audio.started && audio.analyser && audio.freqData && (state.soundOn || performance.now() - soundOffAt < 300)){ getByteFrequencyData every frame (per-call smoothing must see one call per frame); var bin = audio.binIndex[bi]; keep the 40 individual fillRect calls (a single rect() path measured slower). soundOffAt = performance.now() in both mute paths. (c) driveAudio(dt) (source 873-879, call site 1803 passes the unscaled dt): var driveAcc = 1, lastNF = -1, lastNG = -1, lastDG = -1; body: driveAcc += dt; if(driveAcc < 0.1) return; driveAcc = 0; compute nf/ng/dg; write each setTargetAtTime only if it moved by > 1 Hz / > 0.0003; reset the four in startBeds. (d) Entity literals: function makePickup(x,y,r,tier,val){ return { x:x, y:y, r:r, taken:false, tier:tier, val:val, cued:false, glint:0 }; } used at 1399-1408 and 1417 (remove the post-creation p.cued/p.glint writes at 1698-1699); function makeRing(...) with all nine fields used at 1230-1231 and 1276-1277; obstacle literal minGraze:Infinity instead of 99 (only consumer is < 7). (e) Pickup loop 1738: squared-distance compare instead of Math.hypot; 1729 keep the sqrt (needed for normalisation).

**Verification**

test/scratch-bp-r04-pixeldiff.mjs: 0 differing channels in no-sway trials, max alpha delta <= 4/255 under sway. --prof draw p50 -0.3..-0.5 ms; automation events ~18/s (was ~90); bars flat and identical when muted; harness 0 errors both modes.

### W18 · Audio voice hygiene: shared click/crash filters, allocation-free crash noise, exact same-frame coin coalescing

**Priority** 18 · **Category** perf · **Depends on** W01, W16 · **Findings** update-05, audio-2

**Files:** `src/audio.js`, `src/game.js`

**Change**

src/audio.js ensureAudio (after source 831): audio.clickBp = bandpass 900 / Q 1.2 -> master; audio.crashLp = lowpass 900 (no Q assignment) -> master. thump(freq, dur, vol, n): n defaults to 1 and scales every envelope anchor (0.0001*n, v*n, 0.0001*n); oscillator path UNCHANGED (osc -> per-voice lowpass 1400/0.7 -> g: the 4 ms exponential attack does not commute with a shared filter, measured 19% error on the onset); click path: src -> ng (gain v*0.6*n) -> audio.clickBp (exact). blip(freq, dur, type, vol, n): scale the three anchors by n. crashSound noise path (source 946-956): if(audio.noiseBuf){ src.buffer = audio.noiseBuf; ng.gain.setValueAtTime(0.32, t); ng.gain.linearRampToValueAtTime(0, t + 0.35); src -> ng -> audio.crashLp; src.start(t, Math.random() * (audio.noiseBuf.duration - 0.35), 0.35); } else keep the per-death buffer as fallback routed through crashLp (audio.noiseBuf is the 2 s bed buffer kept by W16). src/game.js pickup loop (1740-1756): replace the two calls at 1747-1748 with coinHits++ and after the loop if(coinHits > 0 && state.soundOn){ blip(parallelOn ? 880 : 660, 0.16, "triangle", 0.12, coinHits); thump(220, 0.11, 0.32, coinHits); } (n phase-coherent voices == one voice with all anchors scaled by n, measured -146 dB). No per-frame cap on smash thumps (it would truncate the wreckStorm chord and change pitch selection).

**Verification**

OfflineAudioContext A/B (test/scratch-bp-audio-lti3.mjs pattern): click, crash and coalesced-coin renders within -120 dB of the source; harness 20 s 6x: second and later death frames -4 ms, storm frames unchanged, 0 errors.

### W19 · Adaptive quality tier: straight grid rows and no spectrum bars only on devices whose run p95 exceeds 33 ms

**Priority** 19 · **Category** perf · **Depends on** W01, W02, W17 · **Findings** update-04, render-04

**Files:** `src/render.js`, `src/main.js`, `src/state.js`, `src/ui.js`, `index.html`

**Change**

src/render.js: export var fx = { level:"full", auto:true }; a 120-entry ring of rAF intervals recorded in frame() only while game.phase === PHASE_RUN; every 60 frames, if the run is older than 3 s and the ring's p95 > 33 ms, set fx.level = "low"; step back to "full" only at startRun when the previous run's p95 was < 20 ms for its last 3 s (never mid-run, so the change is never seen as a pop). "low" means: every grid row is drawn as moveTo(0,y0); lineTo(W,y0) (pixel-identical to rows outside R today) and the fft block is skipped; nothing else changes and the saved state.grid/state.fft toggles are untouched. ?fx=full in the URL pins fx.level = "full" (the gate measurement); ?fx=low pins low. Settings sheet: 'Auto quality' switch (state.autoFx, default true, persisted) under Feel; when off, fx stays full. This is the one visible change scheduled on the argument that it only fires on devices that are already dropping frames (verifier: 'nothing lost on devices that hold 60 fps').

**Verification**

Harness 6x --fx auto: fx.level reads 'low' within ~4 s of the first run (page.evaluate) and p50 -6..-7 / p95 -11 vs --fx full; --fx full numbers equal the W18 build; unthrottled run never leaves 'full'. Screenshot at low shows straight rows and no bars, everything else identical.

### W20 · One-thumb pump multiplier so the tank can fill one-handed (measured 22 -> ~100 in 12 s)

**Priority** 20 · **Category** balance · **Depends on** W01 · **Findings** update-08, balance-01

**Files:** `src/game.js`, `index.html`, `docs/DECISIONS.md`

**Change**

src/game.js tuning block (after source line 1019): var ONE_HAND_PUMP = 3.0; // one thumb registers half the strokes and never earns the 1.8x bilateral bonus; 3.0 lands ignition ~1.6 s at a casual 2.9 strokes/s (two-thumb 1.4 s); 3.6 = exact two-thumb parity, 1.8 = the bilateral bonus alone. First guess pending play reports. registerStroke line 1323: var add = STROKE_CHARGE * (0.7 + Math.random()*0.6) * (rhythm ? 1.4 : 0.8) * (bilateral ? 1.8 : 1) * (state.oneHand ? ONE_HAND_PUMP : 1); (multiplicative form is what the balance rig measured; two-thumb is bit-identical). Copy: How-to-play paragraph (source 562) becomes '<b>Pump</b> up and down to fill the tank (both thumbs together fill it fastest).'; lines 1643 and 2426-2431 already mode-neutral. Do NOT halve CHARGE_DECAY in one-hand.

**Verification**

node test/harness.mjs --url ... --mode one --seconds 12 --throttle 6: tank reaches 100 within ~4 s of pumping per life (base max 12-22); --mode two unchanged (tank 100 within ~2 s). Balance rig (test/scratch-balance-run.mjs rebuilt against dist, --mode one --drive pump --seconds 60 --tune '{"ONE_HAND_PUMP":3.0}'): fill median 1.5-1.8 s, boosts >= 9/min; --drive hardpump not faster than two/pump (0.82 s) beyond noise.

### W21 · Pump hint fires before the first barrier and is repeated on the crash card until the first stroke

**Priority** 21 · **Category** ux · **Depends on** W01 · **Findings** balance-04

**Files:** `src/game.js`, `docs/DECISIONS.md`

**Change**

src/game.js update(): source 1643-1645 become if(!state.taughtPump && !game.hinted && game.runTime > 1.2){ game.hinted = true; game.texts.push({ x:W/2, y:H*0.8, text:"pump ↕ to charge", life:4.0, color:"#7dd3c0", size:12 }); ... } (ramp fully finished at 1.2 s; first barrier reaches the orb at ~3.3 s; fade starts at 3.86 s). finishDeath loop line (source 1121-1122): deadLoop.textContent = (gap > 0 ? gap + " short of your best" : "New best") + " · " + (state.taughtPump ? toNext + " more clean to ×" + nextMult : "pump ↕ to charge"); (replace, not append: three clauses wrap to three lines at the 34ch width). taughtPump semantics unchanged (set on the first registered stroke, persisted). Note in DECISIONS.md line 20.

**Verification**

test/scratch-feasb04-probe.mjs pattern (weave-only thumbs, fresh storage): every first-barrier death has the hint visible for >= 2.2 s at alpha 1.0 and the crash card ends with 'pump ↕ to charge'; after any run with a stroke neither appears. (test/harness.mjs cannot see this: its thumbs pump from t=0.)

### W22 · Run-end: per-run best combo (bug), seam off on the crash card, and a felt 'new best' moment

**Priority** 22 · **Category** feature · **Depends on** W01, W04, W07, W29 · **Findings** design-run-end

**Files:** `src/game.js`, `src/ui.js`, `index.html`, `src/styles.css`, `docs/DECISIONS.md`

**Change**

src/game.js startRun (after source 1074 game.wreck = 0;): game.bestCombo = 0; (the crash-card open-loop line currently uses the session best: measured 'N more clean' wrong from run 2 on). Seam hidden while PHASE_DEAD is done by W04. finishDeath: var isRecord = score > state.best && state.best > 0; (first run ever is not a record) before updating state.best; ui.showDeath(...) sets deadLabel.textContent = isRecord ? "new best" : "crashed" and toggles class .record; when isRecord: game.flash = 0.8; game.flashColor = "242,193,78"; if(state.soundOn){ arp([523,659,784,1047], 70, "triangle", 0.16); thump(200, 0.2, 0.4); } haptic("record"); loop line drops the 'New best' text (the label carries it). No ring push (it drew through the score in the measured screenshot), no 1.2 s lockout (keep 0.6), no 2x2 grid or state.rec this round. index.html: <div class="dead-label" id="deadLabel">crashed</div>. CSS: .dead-label.record{ color:var(--coin); animation:statPop2 .3s ease-out; } (reuse the pop keyframes from W07; confirm --coin is the gold token, else rgb(242,193,78)).

**Verification**

Scratch probe over 3 deaths with rising and falling scores: deadLabel 'crashed' on a non-record, 'new best' + gold flash frame on a record (screenshot), bestCombo reads 0 at every run start, loop line resets between runs; harness 0 errors; frame stats unchanged (death-frame code only).

### W23 · Versioned save schema: key belltheory.v4 with one-time migration, whitelist from defaultState, lifetime runs/blue/purple

**Priority** 23 · **Category** feature · **Depends on** W01 · **Findings** design-lifetime-stats, design-run-end

**Files:** `src/state.js`, `src/game.js`, `src/ui.js`, `index.html`, `src/styles.css`, `docs/DECISIONS.md`

**Change**

src/state.js: export var STORE_KEY = "belltheory.v4", OLD_KEY = "thumbtone.v3"; defaultState() adds v:4, life:{ runs:0, blues:0, purples:0 } (and autoFx:true from W19, autoPause:true from W25). hydrateState(json): parse; var d = defaultState(); Object.keys(d).forEach(function(k){ if(k === "v" || k === "slots") return; if(parsed[k] == null) return; if(k === "life") Object.assign(d.life, parsed.life); else d[k] = parsed[k]; }); keep the existing slots validation; write the result into the exported state object in place (Object.keys(d).forEach(k => state[k] = d[k])) so imported bindings never go stale; the first-visit mouse default (source 696-700) tests both keys. loadPersisted (W30) reads STORE_KEY then OLD_KEY from localStorage; saveState writes STORE_KEY only (old key left in place). Counters: state.life.runs++ in startRun (counted on start so a mid-run kill still counts; W26 reads it); collectSpecial: if(purple) state.life.purples++; else state.life.blues++; (no save there, finishDeath saves). resetSettings() keeps best AND life. Crash card: <p class="loop" id="deadLife"></p> after #deadLoop (source 546) set to 'run 37 · blue 12 · purple 1' with the counts in spans coloured #3d7bff / #b04bff, hidden while blues+purples === 0. No Records/Lifetime panel, no state.rec, no ach/seen this round.

**Verification**

node test/harness.mjs --seed-storage seed.json (seed {"best":1234,"oneHand":false,"slots":[...]}) --mode two --seconds 8: after the run localStorage['belltheory.v4'] parses with v 4, best 1234 (or higher), oneHand false, life.runs >= 1; a fresh context starts with runs 0; reset keeps best and life.

### W24 · Rare-coin odds: blue 1 in 30, purple 1 in 250

**Priority** 24 · **Category** balance · **Depends on** W01 · **Findings** balance-06

**Files:** `src/game.js`, `docs/DECISIONS.md`

**Change**

src/game.js spawnRow (source 1371-1372): var BLUE_ODDS = 1/30, PURPLE_ODDS = 1/250 (named tunables next to the other constants); var specialTier = sr < PURPLE_ODDS ? 2 : (sr < BLUE_ODDS ? 1 : 0); Values 25/100 and the 28-42% off-line placement unchanged. No pity counter (a 'whether' guarantee, against the documented reward stance). Update DECISIONS.md line 29 with the new odds and the open question (human run-length distribution from TestFlight).

**Verification**

Balance rig 60 s two/smart: blue ~3.3%/row, purple ~0.4%/row (aggregate over >= 1000 rows), 0 errors.

### W25 · Pause menu: pause button, PAUSED overlay with restart/settings/title, thumbs-down resume with a 3-2-1 hold

**Priority** 25 · **Category** feature · **Depends on** W01, W02, W07, W08, W23 · **Findings** design-pause

**Files:** `index.html`, `src/styles.css`, `src/game.js`, `src/input.js`, `src/ui.js`, `src/audio.js`, `src/render.js`, `src/state.js`, `src/main.js`

**Change**

Apply the verified patch test/scratch-pausefeas-build.mjs (every hunk matched once against the source) with these corrections. CSS: .panel-toggle and .icon-btn 36 -> 44 px (source 227, 472; v17 rule); .pause-actions{pointer-events:auto;display:flex;gap:8px;margin-top:6px} .pause-actions button{ IBM Plex Mono 11px .14em uppercase; background rgba(26,30,38,.72); border 1px var(--panel-border); radius 99px; padding 0 16px; min-height 44px } #overlayPause{ background:rgba(11,13,18,.55) } (the block was unreadable over barriers otherwise). HTML: pause button first in .tools (source 501): <button class="icon-btn pause-btn" id="pauseBtn" aria-label="Pause" hidden><svg ...two bars...></svg></button>; overlay after overlayDead (549): <div class="overlay gone" id="overlayPause" inert><div class="dead-block"><div class="dead-label" style="color:var(--accent)">paused</div><div class="big" id="pauseDist">0</div><div class="row"><span>coins <b id="pauseCoins"></b></span><span>combo <span id="pauseCombo"></span></span></div><div class="pause-actions"><button type="button" id="pauseSettings">settings</button><button type="button" id="pauseRestart">restart</button><button type="button" id="pauseQuit">title</button></div><div class="cta" id="pauseCta">both thumbs down to resume</div></div></div> (pauseCta copy from syncOneHand like the other CTAs). game object: pausedBy:"", pausedAt:0, countdown:0 (reset in startRun). src/game.js: pauseRun(){ if(game.phase !== PHASE_RUN || game.paused || game.dying > 0) return; game.paused = true; game.pausedBy = "user"; game.pausedAt = performance.now(); ui.showPause(dist, coins, combo); audio.duck(true); } resumeRun(){ if(game.pausedBy !== "user") return; ui.hidePause(); game.paused = false; game.pausedBy = ""; game.grace = 1.2; game.countdown = 1.2; resetClock(); audio.duck(false); } tryResume(){ if(game.pausedBy !== "user") return false; if(performance.now() - game.pausedAt < 300) return true; if(lanes() === 1 ? cursors[0].active : (cursors[0].active && cursors[1].active)) resumeRun(); return true; } quitToTitle(){ hide overlay; paused=false; phase=PHASE_READY; zero boost/charge/wreck/slowmo/dying; clear obstacles/pickups/debris/texts/sparks/rings; resetComboStat(); resetCursors(); setOverlay(overlayReady, true); audio.duck(false); } audio.duck(on): master gain setTargetAtTime(on ? state.volume*0.25 : (state.soundOn ? state.volume : 0.0001), 0.1). src/input.js onPointerDown: if(tryResume()) return; as the first statement of the already-bound branch (before the PHASE_DEAD check, source 1432) AND immediately before var ready = ... (source 1450, after c.active = true). The three existing auto-resume paths must skip a user pause: visibility return (source 1504) if(game.paused && game.pausedBy !== "user" && ...), closePanel (2178) if(game.paused && game.pausedBy !== "user" && !document.hidden), checkOrientation (2192) likewise. Countdown: after if(game.grace > 0) game.grace -= dt; add if(game.countdown > 0) game.countdown -= dt; draw() renders it directly (not via game.texts, whose 5-entry cap evicts the frozen labels): if(game.countdown > 0){ var n = Math.min(3, Math.ceil(game.countdown/0.4)); ctx2d.globalAlpha = 0.9; ctx2d.fillStyle = "#7dd3c0"; ctx2d.font = "600 34px 'IBM Plex Mono', monospace"; ctx2d.textAlign = "center"; ctx2d.fillText(String(n), W/2, H*0.45); ctx2d.globalAlpha = 1; ctx2d.textAlign = "left"; }. syncHud: var showPause = game.phase === PHASE_RUN && !game.paused && game.dying === 0; write pauseBtn.hidden only on change. Buttons: pauseBtn -> pauseRun; pauseRestart -> hide overlay, paused=false, resetClock(), duck(false), startRun(); pauseQuit -> quitToTitle; pauseSettings -> openPanel() (closePanel returns to the pause overlay because pausedBy === "user"). Auto-pause, TWO-THUMB TOUCH ONLY, behind state.autoPause (default true, switch in Feel): in release() after cursors[side].active = false: if(state.autoPause && e.pointerType !== "mouse" && lanes() === 2 && game.phase === PHASE_RUN && !cursors[0].active && !cursors[1].active){ clearTimeout(liftTimer); liftTimer = setTimeout(function(){ if(game.phase === PHASE_RUN && !game.paused && !cursors[0].active && !cursors[1].active) pauseRun(); }, 1000); }. Tests that click DOM buttons must use synthetic pointer ids >= 11 (W02).

**Verification**

test/scratch-pausefeas-run.mjs pattern against dist (20 checks): button hidden at title, 44x44 during a run; pause freezes world.time/dist for 500 ms; a press < 300 ms after pausing does not resume, one after 400 ms does with grace 1.2 and '3' drawn 60 ms later; dist unchanged at +1.0 s, moving at +1.6 s; restart -> phase RUN dist 0; settings from pause returns to the pause overlay; faked hide/show keeps a user pause; quit -> title overlay; both thumbs lifted -> not paused at 0.6 s, paused at 1.3 s; sticky mouse can pause via the button and resume with a click. Harness: p50/p95 unchanged (measured 39.5 vs 39.5), 0 errors.

### W26 · Unlock gate state machine (free = the complete game for the first 15 runs), inert until StoreKit lands

**Priority** 26 · **Category** feature · **Depends on** W01, W23 · **Findings** design-unlock-gate

**Files:** `src/native.js`, `src/game.js`, `src/ui.js`, `index.html`, `src/styles.css`, `docs/STORE.md`, `docs/jev-decision-spec.md`

**Change**

src/native.js: export var ent = { FREE_RUNS:15, unlocked:true, price:null, runsLeft:function(){ return this.unlocked ? Infinity : Math.max(0, this.FREE_RUNS - state.life.runs); }, canRun:function(){ return this.runsLeft() > 0; }, purchase:function(){ /* web stub: no-op; StoreKit plugin next round */ }, restore:function(){} }; at init: if(window.__BT_UNLOCKED === false) ent.unlocked = false; (harness/scratch tests force the gate; web and native default unlocked until the StoreKit 2 plugin sets it from Transaction.currentEntitlements; "unlocked" is never persisted in the settings blob). src/game.js startRun first lines: if(!ent.canRun()){ ui.showGate(); return; } state.life.runs++; saveState(); (covers all three restart paths at source 1434/1451/1476 and the title start). src/ui.js: #deadGate and #readyGate rows after the CTAs (source 547 and 533): two .mode-seg-styled buttons 'unlock' (label from ent.price when set, never a hardcoded $4.99) and 'restore', pointer-events:auto, shown via a .gated class that hides the CTA; records stay visible; syncOneHand does not overwrite a gated CTA; the last 3 free runs append ' · N free runs left' to deadLoop (neutral wording, not from run 10); one line under the title on a fresh install: '15 runs free, then one purchase'; a permanent 'Restore purchase' button in the panel's About/World section. window.BellTheory = { setUnlocked(bool), setPrice(str), onUnlockRequested(cb), onRestoreRequested(cb) } for the wrapper. docs/STORE.md lines 69/210: 'The first 15 runs are free and complete. One purchase unlocks unlimited runs.'; jev-decision-spec.md: Q15 'How many free runs?' with 15 labelled as Claude's estimate.

**Verification**

Scratch test with addInitScript window.__BT_UNLOCKED = false and ent.FREE_RUNS = 2: the third startRun leaves game.phase unchanged, #deadGate visible, #deadCta hidden, deadBest still shown; window.BellTheory.setUnlocked(true) re-enables restart; harness default run shows zero behaviour change (gate inert).

### W27 · Capacitor project: config, generated iOS/Android trees, portrait lock, usage strings, scripts

**Priority** 27 · **Category** native · **Depends on** W01, W03 · **Findings** native-04

**Files:** `package.json`, `capacitor.config.ts`, `ios/`, `android/`, `store-assets/`, `test/render-icons.mjs`, `docs/DECISIONS.md`

**Change**

npm i -D @capacitor/android@8 @capacitor/ios@8 typescript@5 (platforms resolve from node_modules; typescript only because the config is .ts). capacitor.config.ts exactly as native-04 proposes (appId com.belltheory.game, appName Bell Theory, webDir dist, backgroundColor #0b0d11, loggingBehavior production, zoomEnabled false, ios{contentInset never, scrollEnabled false, allowsLinkPreview false, preferredContentMode mobile}, android{allowMixedContent false, captureInput true, webContentsDebuggingEnabled false}, plugins{StatusBar{style DARK, overlaysWebView true}, SystemBars{style DARK, insetsHandling css, initialViewportFitValueHint cover}, App{disableBackButtonHandler false}}; no server.url) with a header comment that orientation lock and usage strings are native-project edits that survive cap sync but not cap add. npx cap add android && npx cap add ios (both run on Linux in ~0.9 s, SPM-based iOS, no CocoaPods); commit both trees. Edits: ios/App/App/Info.plist UISupportedInterfaceOrientations = [Portrait], ~ipad = [Portrait, PortraitUpsideDown], UIRequiresFullScreen true, NSPhotoLibraryUsageDescription 'Bell Theory uses a photo you choose as the face of an orb. The photo stays on this device.'; copy docs/PrivacyInfo.xcprivacy into ios/App/App/; restrict the orb photo <input> accept to image/*. android/app/src/main/AndroidManifest.xml: android:screenOrientation="portrait" on the activity, android:enableOnBackInvokedCallback="true" on <application>. Move public/icon-*.png, splash-*.png, *.svg to store-assets/ (Vite copies public/ into every bundle: ~750 kB of store art) and point test/render-icons.mjs at the new path; keep only the files the web bundle needs in public/. Scripts: "cap:sync": "vite build && cap sync", "cap:android": "npm run cap:sync && cap open android", "cap:ios": "npm run cap:sync && cap open ios". Keep the in-game rotate guard (source 2185-2196) as the large-screen fallback.

**Verification**

npm run cap:sync exits 0; dist/index.html copied to android/app/src/main/assets/public and ios/App/App/public; grep -c Landscape ios/App/App/Info.plist == 0; manifest contains screenOrientation="portrait"; npx cap config --json parses. Native compile/run is out of scope in this container (no JDK/SDK/Xcode) and goes on the TestFlight checklist (W34).

### W28 · Safe-area insets applied once, host-agnostic

**Priority** 28 · **Category** native · **Depends on** W01, W27 · **Findings** mobile-safe-area-double-inset

**Files:** `index.html`, `src/styles.css`, `src/main.js`

**Change**

index.html: do not carry the :root padding from prototype/_head.html line 9; :root{ color-scheme:dark; background:#0b0d11; }; keep viewport-fit=cover. src/styles.css :root block: --sat:env(safe-area-inset-top, 0px); --sab:env(safe-area-inset-bottom, 0px); and :root.host-inset{ --sat:0px; --sab:0px; }; source 73 -> padding-top:calc(10px + var(--sat)); 104 -> bottom:calc(12px + var(--sab)); 453 -> padding-bottom:var(--sab). src/main.js first statement: (function(){ var cs = getComputedStyle(document.documentElement); if(parseFloat(cs.paddingTop) > 0 || parseFloat(cs.paddingBottom) > 0) document.documentElement.classList.add("host-inset"); })(); so a host that pads the root (the artifact iframe) still gets a single inset. capacitor.config.ts ios.contentInset 'never' (W27); Android edge-to-edge via the SystemBars plugin config.

**Verification**

test/scratch-feassafe-{build,measure}.mjs pattern with env() substituted by 59/34 px: unpadded root -> #stage 844 px tall, stats content top 69 px, gauge bottom gap 46 px; padded root + probe -> same 69/46 with #stage 751 px; harness (env()=0) unchanged. Manual checklist item: iPhone 15 Pro simulator screenshot after cap sync.

### W29 · Haptics bridge: one haptic(kind, power) in the game, Capacitor Haptics natively, navigator.vibrate patterns on the web

**Priority** 29 · **Category** native · **Depends on** W01 · **Findings** native-01

**Files:** `src/native.js`, `src/game.js`, `src/input.js`, `index.html`

**Change**

src/native.js (haptics part): import { Capacitor } from '@capacitor/core'; import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'; export var isNative = Capacitor.isNativePlatform(); export var platform = isNative ? Capacitor.getPlatform() : 'web'; (never test window.Capacitor truthiness: importing core defines it on the web too, measured). var HAPTIC_WEB = { tap:8, die:[30,40,60], storm:[30,40,60,40,80], purple:[20,40,30,40,60], blue:[12,30,24], combo:18, surge:[10,30,22], ignite:[18,40,60], empty:12, crunch:[12,20,30], record:[20,40,20,40,60] }; MAP with [rank, fn]: tap[0,Light], combo[1,Light], blue[2,Medium], surge[3,Medium], smash[3, power >= 0.5 ? Heavy : Medium], empty[3,Warning], crunch[4, Heavy then Light after 60 ms], ignite[5,Success], purple[5, Success then Heavy after 90 ms], record[5, same as purple], storm[6, Heavy then Success after 90 ms], die[9,Error]; export function haptic(kind, power){ if(!state.haptics) return; if(!isNative){ if(!navigator.vibrate) return; try{ navigator.vibrate(kind === "smash" ? 14 + Math.round(power*20) : HAPTIC_WEB[kind]); }catch(e){} return; } var e = MAP[kind]; if(!e) return; var now = performance.now(); if(now - lastAt < 40 && e[0] <= lastRank) return; lastAt = now; lastRank = e[0]; try{ var p = e[1](power); if(p && p.catch) p.catch(function(){}); }catch(err){} } (never Haptics.vibrate(): iOS allocates a CHHapticEngine per call). Game sites -> haptic(kind): 1106 "die"; 1178-1179 crunch ? "crunch" : ("smash", power); 1210 "storm"; 1245-1246 purple ? "purple" : "blue"; 1350 "ignite"; 1446 "tap"; 1655 "empty"; threaded(): 1290 if(!surge) haptic("combo") and 1304 if(surge) haptic("surge") so the stronger, rarer beat is never de-duped by the combo beat. Panel: Impact slider note 'sound only; native haptics use system strength'.

**Verification**

Harness on dist with a counting navigator.vibrate shim (test/scratch-native-run.mjs pattern): same kinds and patterns as the baseline histogram ({8:2, 17-27:12, [18,40,60]:4, [12,20,30]:2, [30,40,60]:3, [30,40,60,40,80]:2} shape), 0 errors; with window.androidBridge faked via addInitScript, isNativePlatform() true and haptic() routes through the plugin proxy without errors. Feel on device stays 'untested until TestFlight' (DECISIONS.md line).

### W30 · Persistence: Capacitor Preferences as the durable copy with localStorage as the synchronous cache, ordered writes, flush on pause

**Priority** 30 · **Category** native · **Depends on** W01, W23 · **Findings** native-03

**Files:** `src/native.js`, `src/state.js`, `src/main.js`

**Change**

src/native.js: import { Preferences } from '@capacitor/preferences'; import { App } from '@capacitor/app'; import { STORE_KEY, OLD_KEY } from './state.js'; var loaded = Promise.resolve(); export function loadPersisted(){ var local = null; try{ local = localStorage.getItem(STORE_KEY) || localStorage.getItem(OLD_KEY); }catch(e){} if(!isNative) return Promise.resolve(local); loaded = Preferences.get({ key: STORE_KEY }).then(function(r){ if(r.value != null) return r.value; if(local != null) return Preferences.set({ key: STORE_KEY, value: local }).then(function(){ return local; }); return null; }).catch(function(){ return local; }); return loaded; } var pending = null, pendingValue = null; function flush(){ if(pendingValue == null) return; var value = pendingValue; pendingValue = null; if(pending){ clearTimeout(pending); pending = null; } loaded.then(function(){ return Preferences.set({ key: STORE_KEY, value: value }); }).catch(function(){}); } export function save(value){ if(!isNative) return; pendingValue = value; if(!pending) pending = setTimeout(flush, 250); } if(isNative){ document.addEventListener("visibilitychange", function(){ if(document.hidden) flush(); }); App.addListener('pause', flush); } (writes are chained on the load promise so a slow get can never be clobbered by a defaults write; 61 slider ticks -> 1 bridge write; the best score written on death survives an immediate home press). src/state.js saveState(): var json = JSON.stringify(state); try{ localStorage.setItem(STORE_KEY, json); }catch(e){} native.save(json); src/main.js boot: Promise.race([native.loadPersisted(), new Promise(r => setTimeout(() => r(undefined), 1000))]).then(function(json){ hydrateState(json == null ? null : json); ...init...; if(json === undefined) load.then(function(late){ /* recover a late best */ try{ var p = late && JSON.parse(late); if(p && typeof p.best === "number" && p.best > state.best){ state.best = p.best; saveState(); } }catch(e){} }); }); Do not call Preferences.migrate()/removeOld().

**Verification**

Scratch Playwright: with a stubbed window.Capacitor (isNativePlatform true) and a counting Preferences shim injected by addInitScript, 61 synthetic input events on #volumeRange -> 61 localStorage writes (cache unchanged) and exactly 1 Preferences.set, plus 1 on faked visibilitychange hidden; a get that resolves after 1500 ms followed by an early save does not overwrite the durable copy with defaults. Harness on the web build: 0 errors, no Preferences calls.

### W31 · Lifecycle: suspend/resume as named functions, driven by visibilitychange on the web and appStateChange natively

**Priority** 31 · **Category** native · **Depends on** W01, W25 · **Findings** native-06

**Files:** `src/game.js`, `src/main.js`, `src/native.js`

**Change**

src/game.js (source 1497-1508 refactor): export function suspendRun(){ if(game.phase === PHASE_RUN) game.paused = true; if(audio.ctx && audio.ctx.state === "running"){ var s = audio.ctx.suspend(); if(s && s.catch) s.catch(function(){}); } } export function resumeAfterHidden(){ if(document.hidden) return; if(game.paused && game.pausedBy !== "user" && !ui.isPanelOpen() && !ui.isRotateShown()){ game.paused = false; game.grace = 0.8; } resetClock(); if(state.soundOn) ensureAudio(); } src/main.js: document.addEventListener("visibilitychange", function(){ document.hidden ? suspendRun() : resumeAfterHidden(); }); src/native.js: export function wireLifecycle(){ if(!isNative) return; App.addListener('appStateChange', function(s){ s.isActive ? resumeAfterHidden() : suspendRun(); }); } (single listener; 'pause'/'resume' are redundant with visibilitychange; both functions idempotent so double delivery is harmless). Also exported on window.BellTheory as suspend/resume for the back-button and tests.

**Verification**

Scratch (test/scratch-feaslife-probe.mjs pattern): mid-run BellTheory.suspend() -> paused true, dist frozen 800 ms, audio 'suspended'; resume() with document.hidden stubbed true stays paused; with hidden false -> paused false, grace 0.8, audio 'running', dist moving at +1.2 s; resume() with the settings sheet open leaves paused true; spurious resume mid-run grants no extra grace. Harness 0 errors.

### W32 · Android back: close settings, else pause into settings mid-run, else minimize

**Priority** 32 · **Category** native · **Depends on** W01, W27, W31 · **Findings** native-05

**Files:** `src/native.js`, `src/main.js`

**Change**

src/main.js exposes window.BellTheory = Object.assign(window.BellTheory || {}, { isPanelOpen: ui.isPanelOpen, openPanel: ui.openPanel, closePanel: ui.closePanel, phase: function(){ return game.phase; }, rotateShown: ui.isRotateShown, PHASE_RUN: PHASE_RUN, suspend: suspendRun, resume: resumeAfterHidden, prof: ... }). src/native.js: export function wireBackButton(){ if(Capacitor.getPlatform() !== 'android') return; App.addListener('backButton', function(){ var g = window.BellTheory; if(!g){ App.minimizeApp(); return; } if(g.isPanelOpen()){ g.closePanel(); return; } if(g.phase() === g.PHASE_RUN && !g.rotateShown()){ g.openPanel(); return; } App.minimizeApp(); }); } (minimizeApp, not exitApp; the manifest flag from W27 enables predictive back).

**Verification**

test/scratch-feasback-run.mjs pattern with App mocked: title -> minimize; run -> openPanel (paused); back -> closePanel (grace 0.8, dist moving 100 ms later); rotate overlay shown -> minimize. Unit test of the decision tree in Node with a mocked App.

### W33 · Audio session: release the silent-wav unlock on hide/mute, gate it off natively, AVAudioSession .playback(.mixWithOthers) in the app

**Priority** 33 · **Category** native · **Depends on** W01, W27, W31 · **Findings** audio-4, native-02

**Files:** `src/audio.js`, `src/game.js`, `src/ui.js`, `src/input.js`, `index.html`, `ios/App/App/AppDelegate.swift`, `docs/DECISIONS.md`

**Change**

src/audio.js (source 778-788): export var NATIVE_MEDIA_UNLOCK = false; // flip to true if the first TestFlight build is silent with the ring switch on. function unlockMediaSession(){ if((isNative && !NATIVE_MEDIA_UNLOCK) || !state.soundOn) return; try{ if(!unlockEl){ unlockEl = new Audio(silentWavUrl()); unlockEl.loop = true; unlockEl.playsInline = true; /* iOS ignores HTMLMediaElement.volume; the wav is digital silence */ } else if(!unlockEl.paused) return; var p = unlockEl.play(); if(p && p.catch) p.catch(function(){}); }catch(e){} } export function releaseMediaSession(){ if(unlockEl){ try{ unlockEl.pause(); }catch(e){} } } suspendRun() (W31) calls releaseMediaSession(); resumeAfterHidden() calls unlockMediaSession() when state.soundOn && !game.paused; both mute paths (soundBtn click, soundToggle change) call releaseMediaSession() when turning sound off and unlockMediaSession() + startBeds() when turning it on; pointerup on the canvas: if(state.soundOn && audio.ctx && audio.ctx.state !== "running") ensureAudio(). The settings note at source 595 gets data-web-only and is hidden when isNative. ios/App/App/AppDelegate.swift (after W27): import AVFoundation; private func configureAudioSession(){ let session = AVAudioSession.sharedInstance(); do { try session.setCategory(.playback, mode: .default, options: [.mixWithOthers]); try session.setActive(true, options: []) } catch { NSLog("AVAudioSession configure failed: \(error)") } } called from application(_:didFinishLaunchingWithOptions:) and from NotificationCenter observers for UIApplication.didBecomeActiveNotification and AVAudioSession.interruptionNotification (.ended) — the template uses scene lifecycle, so applicationDidBecomeActive on the AppDelegate is never called. No UIBackgroundModes.

**Verification**

Scratch (test/scratch-audio-hidden.mjs extended): unlockEl.paused true after a faked hide, false after show, true after muting; harness 0 errors, p95 unchanged. Device (TestFlight checklist): silent switch on -> bed + thump audible; background music keeps playing under the bed; no Now Playing entry after backgrounding; if silent, set NATIVE_MEDIA_UNLOCK = true and log it.

### W34 · Docs: DECISIONS.md entries, STORE.md copy, TestFlight/device checklist, harness gate definition

**Priority** 34 · **Category** restructure · **Depends on** W01 · **Findings** mobile-harness-floor-target, design-unlock-gate, mobile-fonts-render-blocking

**Files:** `docs/DECISIONS.md`, `docs/STORE.md`, `docs/AUDIT.md`

**Change**

docs/DECISIONS.md: one entry per shipped behaviour change (DPR cap trade, CSS camera, seam layer + one-thumb seam, one-thumb pump 3.0, hint at 1.2 s, rare-coin odds, record moment, pause menu, save schema v4/key rename, unlock boundary 15 runs, fonts pinned by hash, audio session strategy, haptic map 'untested until TestFlight'). docs/STORE.md: unlock copy (W26), pre-ship item 3 marked done (W30), fonts item done (W03). docs/AUDIT.md: this plan plus a results table filled in as items land (harness numbers per item). Add a 'Device checklist' section: DPR-3 iPhone frame time (Safari Web Inspector timeline p95, the real 16.7 ms gate), silent switch, background music, Now Playing, haptic feel per kind, safe-area screenshot on iPhone 15 Pro, Android back, predictive back, edge-to-edge insets.

**Verification**

Every W-item that changes player-visible behaviour has a DECISIONS.md line; the AUDIT.md results table has a measured row (or 'n/a, device') for every perf item.

## Module split (prototype/bell-theory.html → Vite project at the repo root)

Plain ES modules, no TypeScript, existing code style. No module touches the DOM or `state` at import time; each exports `init()` where setup is needed and `src/main.js` calls them in order after `hydrateState`. Import cycles are allowed because all cross-module reads happen inside functions. Closure variables shared across modules become fields on exported objects: `render.view` (W, H, dpr, realDpr, canvas, ctx2d, wrap), `game.scrollOffset/parallelOn/mirrorHint`, `main.loop` (lastTs, errCount, lastErr) with `resetClock()`.

| File | Source lines | Responsibilities | Exports |
|------|--------------|------------------|---------|
| `index.html` | prototype/_head.html 1-6, 10-16; bell-theory.html 1 (title), 491-645 (markup) | Vite entry and the app markup. Head from prototype/_head.html minus the :root safe-area padding (lines 7-9), viewport-fit=cover kept, <title> from source line 1, no font <link>s (W03), <script type="module" src="/src/main.js"></script>. Body = source markup with the new elements: #seamClip/#seamEl before the canvas (W04), pause button in .tools and #overlayPause after #overlayDead (W25), inert on #overlayDead (W08), #deadLabel id, #deadLife line, #modeNote, #howPump id on the How-to-play pump line, #deadGate/#readyGate rows (W26), data-web-only on the ring-switch note, 'Auto quality' and 'Auto pause' switches under Feel. | none (HTML) |
| `src/styles.css` | bell-theory.html 6-488 | All CSS, imported once from src/main.js (import './styles.css'). Adds: three @font-face rules (W03), #seamClip/#seamEl (W04), .stage-wrap overflow:hidden and #stage will-change:transform (W05), tick2/pop2 keyframes and contain rules (W07), overlay visibility/inert rules (W08), .dead-label.record (W22), pause overlay and .pause-actions (W25), 44 px icon buttons, --sat/--sab custom properties (W28). | none (CSS) |
| `src/main.js` | bell-theory.html 646-649 (IIFE header -> module), 1495-1509 (visibilitychange listener, body moved to game.js), 2132-2161 (errCount/lastErr, frame, first rAF), 2452-2453 (IIFE close, dropped) | Boot sequence and the frame loop. loadPersisted race -> hydrateState -> initRender -> initAudio -> initUI -> initInput -> resetCursors -> requestAnimationFrame(frame). frame(ts): dt clamp, frameNo++ (W07), try{ update(dt); draw(); }catch{ errCount++; drain restore x8 (W13) }, syncHud(ts), optional prof ring when location.search has prof=1, rAF re-arm. visibilitychange listener -> suspendRun/resumeAfterHidden (W31). host-inset probe as the first statement (W28). window.BellTheory API object (W26/W32). Native wiring calls: installHaptics is a side effect of importing native.js; wireLifecycle(); wireBackButton(). | loop { lastTs, errCount, lastErr }, resetClock(), frame (not exported), prof ring (via window.BellTheory.prof) |
| `src/state.js` | bell-theory.html 650-700; 2409-2413 (reset core, UI part stays in ui.js) | Settings + persistence. STORE_KEY/OLD_KEY, reduceMotion, isMouseDevice, defaultState (with v:4, life, autoFx, autoPause), the exported state object hydrated IN PLACE by hydrateState(json) (whitelist = Object.keys(defaultState()) minus v/slots, nested merge for life, slots validation kept), saveState (localStorage cache + native.save(json)), resetSettings() (keeps best and life, clears in place, caller re-renders), the first-visit mouse default (source 696-700, tests both keys). | STORE_KEY, OLD_KEY, state, defaultState, hydrateState, saveState, resetSettings, reduceMotion, isMouseDevice |
| `src/world.js` | bell-theory.html 714-757 | The ported loom world vector: makeDrifter, world {time, entropy, depth, warmth, ripples, perturb, influenceAt, tick}. Unchanged. | world, makeDrifter |
| `src/audio.js` | bell-theory.html 759-958; 1214-1219 (arp) | Web Audio engine: audio object, silentWavUrl/unlockMediaSession/releaseMediaSession + NATIVE_MEDIA_UNLOCK (W33), audioStateName, isAudioLive, ensureAudio (+ binIndex, clickBp/crashLp, analyser connect gated on state.fft), buildDroneVoices/prepNoise/initAudio idle prebuild (W16), startBeds, driveAudio(dt) throttled (W17), blip/blipAt/thump/crashSound with the n parameter (W18), arp on the audio clock (W14, moved from the game section), duck(on) for the pause menu (W25), soundOffAt. Imports state (soundOn, volume, impact, fft), world (warmth/entropy), native (isNative), ui.syncSoundBtn (called at the end of startBeds). | audio, ensureAudio, initAudio, startBeds, driveAudio, blip, blipAt, thump, crashSound, arp, unlockMediaSession, releaseMediaSession, audioStateName, isAudioLive, duck, setAnalyserConnected, NATIVE_MEDIA_UNLOCK, soundOffAt (getter) |
| `src/game.js` | bell-theory.html 976-1212, 1221-1419, 1497-1508 (bodies of the visibility handler), 1547-1552, 1555-1558 (as game fields), 1579-1804, 2436-2443 (setOneHand) | Simulation and run lifecycle: PHASE_* constants, game object (+ scrollOffset/parallelOn/mirrorHint fields, pausedBy/pausedAt/countdown), tuning constants (STROKE_*, CHARGE_DECAY, BOOST_*, MAGNET_R, TOUCH_OFFSET, HIT_R, DRAW_R, ONE_HAND_PUMP, BLUE_ODDS, PURPLE_ODDS), makeCursor/cursors/lanes/laneList/laneBounds/resetCursors, startRun (bestCombo reset, life.runs++, unlock gate, pending mode apply is in finishDeath), die, finishDeath (DOM via ui.showDeath, applies pendingOneHand), spawnDebris, shatter, wreckStorm, collectSpecial, threaded, registerStroke (pause guard, ONE_HAND_PUMP), fireBoost, difficulty, spawnRow (makePickup/makeRing factories), circleRectHit, update (swept collision, c.dy, coin coalescing, hint at 1.2 s, countdown), pauseRun/resumeRun/tryResume/quitToTitle (W25), suspendRun/resumeAfterHidden (W31), setOneHand + pendingOneHand (W09; syncOneHand stays in ui.js). Imports state, world, audio, render.view (W/H), ui (overlays, combo stat, showDeath, showPause), input.sidePointer, native (haptic, ent), main (resetClock). | PHASE_READY, PHASE_RUN, PHASE_DEAD, game, cursors, lanes, laneList, laneBounds, resetCursors, startRun, die, finishDeath, update, difficulty, registerStroke, fireBoost, setOneHand, pendingOneHand (getter), pauseRun, resumeRun, tryResume, quitToTitle, suspendRun, resumeAfterHidden, HIT_R, DRAW_R, TOUCH_OFFSET, the tuning constants |
| `src/render.js` | bell-theory.html 702-712, 960-974, 1511-1546, 1806-2130 | Canvas and drawing: view {canvas, ctx2d, wrap, W, H, dpr, realDpr}, DPR_CAP + resize (W06), imgCache/ensureImage/clearImageCache, drawShape(…, g)/drawImageBlob, haloSprite/clearHaloCache (W15), seamEl/camXf camera string (W04/W05), fx adaptive tier + ring (W19), draw() (grid culling W17, fft gating W17, countdown text W25). Imports game, cursors, world, state, audio, reduceMotion. | view, resize, initRender, draw, ensureImage, clearImageCache, clearHaloCache, fx |
| `src/input.js` | bell-theory.html 1421-1493 | Pointer handling: sidePointer, onPointerDown/onPointerMove (rect from view.wrap, registered on canvas and wrap, double-bind guard W11, tryResume hooks W25, haptic('tap')), release/releaseUnlessMouse (auto-pause timer W25), pointerout with the relatedTarget guard (W05), pointerup audio resume (W33), initInput() attaches everything. Imports game (cursors, lanes, startRun, tryResume, PHASE_*, TOUCH_OFFSET), world, state, audio (unlockMediaSession, startBeds, ensureAudio), render.view, native (haptic). | sidePointer, initInput, release |
| `src/ui.js` | bell-theory.html 1559-1577, 2143-2157 (-> syncHud), 2163-2232, 2234-2323, 2325-2392, 2394-2415, 2417-2435, 2444-2451 | All DOM outside the canvas: HUD element refs + GAUGE_C + syncHud(ts) dirty-checked (W07) + resetComboStat + restartAnim (W07), overlays (overlayReady/overlayDead/overlayPause refs, setOverlay with inert W08, showDeath/showPause/hidePause/showGate), panel open/close + isPanelOpen (pausedBy-aware W25), orientation guard + isRotateShown, sound button + syncSoundBtn early-out, slots (fileToDataUrl, renderSides -> clearHaloCache/clearImageCache on change), controls + syncControls (new switches: autoFx, autoPause), reset UI (calls state.resetSettings then re-renders), mode picker syncOneHand (renders pendingOneHand, modeNote, CTAs, gate rows), stats/dead lines (deadLabel, deadLife), initUI() attaches listeners and does the initial renderSides/syncControls/syncOneHand. | initUI, syncHud, resetComboStat, restartAnim, setOverlay, showDeath, showPause, hidePause, showGate, openPanel, closePanel, isPanelOpen, isRotateShown, syncSoundBtn, syncControls, syncOneHand, renderSides, element refs needed by game.js (overlayReady, overlayDead, comboBadge, gauge) |
| `src/native.js` | none (new); replaces the 11 inline navigator.vibrate sites at 1106, 1178-1179, 1210, 1245-1246, 1290, 1304, 1350, 1446, 1655 and the localStorage calls at 676/689 | Capacitor bridge with web fallback (new file): isNative/platform via Capacitor.isNativePlatform(); haptic(kind, power) map + web navigator.vibrate patterns (W29, installed as an import side effect); loadPersisted/save/flush with ordered writes (W30); wireLifecycle (appStateChange -> game.suspendRun/resumeAfterHidden, W31); wireBackButton (W32); ent unlock state + window.BellTheory hooks (W26). Imports @capacitor/core, @capacitor/haptics, @capacitor/preferences, @capacitor/app, state (STORE_KEY, state.haptics, state.life), game (suspendRun, resumeAfterHidden). | isNative, platform, haptic, loadPersisted, save, flush, wireLifecycle, wireBackButton, ent |

Boot order in `src/main.js`: host-inset probe → `import "./styles.css"` → `native.loadPersisted()` raced with a 1000 ms timeout → `hydrateState(json)` → `initRender()` (resize, seam element) → `initAudio()` (idle prebuild) → `initUI()` → `initInput()` → `resetCursors()` → `requestAnimationFrame(frame)` → `wireLifecycle()`, `wireBackButton()`.

## Dropped (not scheduled this round)

- render-01 dpr governor / 1.5 step-down: fractional backing dpr shimmers 1 px grid lines and pops mid-run; dpr 1 still misses the target in software raster; kept only the static cap (W06) and the re-based gate (W02).
- render-03 per-fillText ctx.font: both verifiers dropped it (cost misread; both fixes measured null).
- update-01 draw-op audit as a separate item: subsumed by W04/W05/W15/W17/W19 which are the measured op reductions.
- update-02 (b) prototype/audio warm-up and (c) hidden load-time simulation: one-time invalidations in the first 2 s; the simulation would spawn barriers, kill the idle orbs, write a fake best and start the beds without a gesture; forced tiering showed deopt loops. Only (a) shapes and the hypot rewrite ship (W17).
- update-04 single-path fft fill and every-other-frame analyser read: the path is measured slower than 40 fillRects; per-call smoothing makes a slower read visibly change bar decay.
- audio-2 Step B persistent voice bank: ~0.1 ms/frame for 12 always-on oscillators and 24 more nodes on the first-touch frame; spikes were pauses, not node creation. Step A ships in W18.
- audio-5 20 Hz analyser read: same smoothing-cadence problem; gating on soundOn ships in W17.
- dom-1 canvas-drawn gauge, dom-4, dom-5: dropped by verifiers (no gain, visible regressions); the reflow removal they overlap with ships in W07.
- dom-3 backdrop-filter flatten during play: 0.1-0.15 ms/frame on the software Viz thread, visible top-bar change, device cost unmeasured; goes on the device checklist (Safari GPU timeline) rather than this round.
- mobile-dpr-cap adaptive 1.5 step-down: unmeasured, non-integer upsample of 1 px strokes; needs device screenshots first.
- design-zen-mode, design-achievements: contradict the documented reward stance / not asked for in DECISIONS.md; post-first-play candidates (a zen mode also needs a per-barrier one-shot hit flag, measured 1138 re-fires).
- balance-02 boost is permanent for continuous pumpers: measures designed behaviour the founder called fun; synthetic drivers no human matches.
- balance-03 adaptive difficulty is inert: correct diagnosis but the fix is a new design feature; keep as a Jev question.
- balance-05 slow-pump ramp + decay 0.2: verdicts split (drop 0.62 / modify 0.82); it changes the boost economy in the same round as the one-thumb multiplier and the 0.8 Hz driver is below a plausible thumb cadence. Carry forward with the measured recipe (STROKE_WINDOW 0.65 + STROKE_FADE 0.45 ramp, CHARGE_DECAY 0.2: synced 1.5 strokes/s ignites in 3.6 s, fast pumps unchanged) for the first play report that says the tank feels stuck.
- balance-06 pity counter: a 'whether' guarantee bolted onto a stance of 'never whether'; constants-only change ships (W24).
- design-run-end 2x2 record grid, state.rec, run duration, 1.2 s record lockout: reverses the v12 death-screen decision and adds a schema nobody asked for; the record moment, bestCombo fix and seam gate ship (W22).
- design-lifetime-stats full 16-counter object, ach/seen, Records/Lifetime panel: 15 fields for features that do not exist; runs/blues/purples + schema versioning ship (W23).
- design-unlock-gate part B (StoreKit 2 Swift plugin, Product.displayPrice, sandbox test): needs ios/ on a Mac and App Store Connect; the JS state machine ships inert (W26). Also: @capacitor-community/in-app-purchases does not exist (404); RevenueCat is ruled out by STORE.md's privacy answers.
- design-pause auto-pause in one-thumb mode: 'the only thumb lifted' is a much larger change to the lifted-thumb rule; two-thumb touch only (W25).
- design-settings About section: not among the surviving findings; only the 'Restore purchase' control it would host ships (W26).
- native-03 boot(persistedJson) wrapper form: superseded by the module split (state.hydrateState + main boot) which achieves the same ordering.

## Risks and how the harness catches them

1. Restructure regressions (silent behaviour drift from hoisting/order changes). Catch: W01 parity run in both modes against prototype/index.html in the same session (p50/p95 within 5 ms, same death/tank behaviour, screenshots), plus the existing scratch probes re-pointed at dist (bugs, pause, lifecycle, balance rig); run the balance rig's two/pump and two/smart drivers and compare fill median (1.38 s) and cleanFrac (1.0) to the auditor's numbers.

2. Perf numbers that do not reproduce. Harness noise is +-3 ms p50 / +-5 ms p95 run to run and 5-10 ms when another Chromium is running. Catch: every perf claim is a 3-run sequential median (--reps 3), interleaved with a base run, nothing else on the box; W02 prints the floor so a regression in the harness itself is visible.

3. CSS camera transform breaking input or leaving runs dead in the harness. Catch: W02's pointer ids >= 11; the phase-share check (deaths and restarts across the whole 20 s); the fixed-thumb mapping check (tx error 0.00 px on a swayed frame).

4. Seam/halo/adaptive changes altering the picture. Catch: pixel-diff scripts (test/scratch-bp-r04-pixeldiff.mjs, halo region diff) and side-by-side screenshots in .harness; W19 must never leave 'full' unthrottled and must be pinned with ?fx=full for the gate.

5. Save-data loss on the key rename or the Preferences race. Catch: --seed-storage run asserting best survives; the shimmed-Capacitor test asserting a late get is never clobbered; reset keeps best+life.

6. Pause menu resuming on the press that paused, or a background/rotate auto-resume bypassing a user pause. Catch: the 20-check pause probe (300 ms lockout, faked hide/show keeps the user pause, panel round trip).

7. Audio prebuild changing the first-touch experience (no sound, or sound before a gesture). Catch: audio.started false and no node connected to destination before pointerdown; 'not started' Engine line; startBeds timing 8-15 ms at 6x; W14's !document.hidden guard tested by the hidden-tab script.

8. Native items cannot be compiled here (no JDK/SDK/Xcode). Catch: cap sync exit 0, plist/manifest greps, the config parse, and the shimmed-bridge tests for haptics/preferences/back/lifecycle; everything device-only is a named line on the W34 checklist and stays 'untested until TestFlight' in DECISIONS.md.

9. Fonts: a fetch that returns different bytes later. Catch: sha256 pins in test/fonts-check.mjs; pixel-identical title screenshot vs the Google-served baseline.

10. Two levers tuned at once (one-thumb multiplier + anything else touching the tank). Catch: only W20 changes the pump economy this round; two-thumb numbers must be bit-identical (rig two/pump fill 1.38 s, uptime 0.72).

## Results (fill in as items land)

| Item | p50 | p95 | >33 ms | JS budget | Notes |
|------|-----|-----|--------|-----------|-------|
| baseline (prototype/index.html) | 34-42 | 55-65 | 309/580 | update 4.2 / draw 5.7 / hud 1.5 (p95) | 2026-09-23 |
