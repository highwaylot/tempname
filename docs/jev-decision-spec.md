# Bell Theory — launch decision spec (Jev-shaped)

One state, fifteen atomic questions, one pass. Adapt the shapes to the TypeSafe
API; the wording is meant to be pasted as-is. The "mine" column is Claude's
calibrated estimate on 2026-09-23, labeled so it is never mistaken for a Jev
result. Replace it with real probabilities when you run it.

## State

- Product: **Bell Theory**, a mobile endless runner. HTML canvas, single file,
  Web Audio, no native code yet. Live prototype at
  https://claude.ai/artifact/CWf9vb1oyPNrheKD119Fh5 (v18).
- Modes: two-thumb (one orb per lane, screen split), one-thumb (one lane, any
  touch), and mouse (one-thumb, sticky pointer). Both thumb modes rated
  "really really fun" by the sole playtester (the founder).
- Loop: thread gaps or, when boosted, smash through them. Pump (rhythmic
  vertical strokes) fills a boost tank; boost drains and refills on smashes;
  "steel" barriers kill even when boosted and scale with continuous boost time.
  Combo, CLEAN / GRAZE / SURGE thread rewards; wreck chain, CRUNCH, WRECKED
  storm; rare coins (blue 1/50 rows = 25, purple 1/400 = 100) placed off the
  safe line. Reactive generative soundbed (drone + filtered noise) driven by
  gameplay. Adaptive difficulty on rolling clean rate.
- Reward design deliberately excludes: losable wagers, return timers, withheld
  rewards, variable-ratio "sometimes nothing." Uncertainty is about *how much*,
  never *whether*.
- Known gaps: **no native haptics** (iOS has no web vibration API); audio obeys
  the iPhone silent switch in a webview; design polish self-rated "5/10 to
  launch"; zero reviews, press, or marketing; single developer; domain
  `belltheory` owned; App Store name and trademark unchecked.
- Competitors (searched 2026-09-23): 2 Cars / Two Cars and clones (one car per
  thumb, free + ads, commoditized); Split Speed: Two-Car Rush (same); Ambidextro
  (one character per hand, level-based platformer, not a runner); Duet
  (Kumobius 2013, two orbs on ONE input, 20M+ downloads, premium, press-driven);
  Subway Surfers / Temple Run (the one-thumb ocean); fidget apps Tappy, POP IT,
  FidgetBeat, Fidget Lab, Fidgetable (native Taptic Engine is their moat).
- Founder's pricing instinct: $4.99.

## Questions

### Noul — is this statement true? (returns 0–1)

| # | Statement | Mine |
|---|---|---|
| 1 | A wrapped web game with native haptics and offline play passes App Store guideline 4.2 (minimum functionality). | 0.85 |
| 2 | A paid-upfront $4.99 game from an unknown developer with no press converts meaningfully on the App Store. | 0.15 |
| 3 | Free download with a single $4.99 unlock outperforms paid-upfront for this game. | 0.80 |
| 4 | Native haptics are necessary to compete with fidget apps. | 0.85 |
| 5 | Native haptics are necessary to compete with 2 Cars-style runners. | 0.30 |
| 6 | The current web build is launch-ready without a native wrapper. | 0.20 |
| 7 | The name "Bell Theory" has a consumer-facing collision on the App Store or Google Play. | 0.10 (low confidence: web search only; trademark unchecked) |

### Choice — pick one

| # | Question | Options | Mine |
|---|---|---|---|
| 8 | Which monetization fits this game? | paid $4.99 · free + ads · free + single $4.99 unlock · free + subscription | single unlock (0.60) |
| 9 | Which shell to ship in? | Capacitor · Expo / React Native · native rewrite · PWA only | Capacitor (0.70) |
| 10 | Which mode should lead the store listing? | two-thumb · one-thumb · both equal | both equal, one-thumb first in screenshots (0.50) |

### Score — 1 to 5

| # | Rubric | Mine |
|---|---|---|
| 11 | Launch difficulty, engineering (1 trivial – 5 very hard) | 2 |
| 12 | Launch difficulty, discovery / marketing (1 – 5) | 4 |
| 13 | Differentiation vs 2 Cars clones (1 none – 5 total) | 4 |
| 14 | Differentiation vs Duet (1 – 5) | 3 |

### Count — a number

| # | Question | Mine |
|---|---|---|
| 15 | How many free runs before the single unlock? (the gate is live in `src/native.js` as `ent.FREE_RUNS`) | 15 (estimate: enough to reach the first pump and a first rare coin, few enough that a keeper hits the gate in one sitting; not a Jev result) |

## Combination logic (yours to edit)

```
wrapper_required   = (1 - Q6) > 0.6 or Q4 > 0.7          # → true
price_right        = Q3 > 0.6 and Q2 < 0.3                # → keep $4.99, move it behind the first minutes
door               = Q8                                   # → free + single unlock
effort_split       = Q12 / (Q11 + Q12)                    # → ~0.67 of effort on discovery, not code
name_safe_to_spend = Q7 < 0.15 and TRADEMARK_CHECKED      # → false until checked
lead_screenshot    = Q10                                  # → both, one-thumb first
```

## What a real run would change

Replace every "mine" with Jev's probability and confidence. Anything Jev returns
with low confidence — Q7 is the obvious one — is a question for a human or a
lookup, not a vibe. Anything with high confidence that contradicts the estimate
above is where the estimate was wrong.
