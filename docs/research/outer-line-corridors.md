# Outer Line corridors: research and build plan

*2026-10-26. A research workflow (progression studies, runner corridor patterns, a generator audit) then a synthesis. What shipped is summarised in `docs/DECISIONS.md` and `games/outer-line/HANDOFF.md`. This file keeps the reasoning and the sources.*

## Difficulty progression: principles and sources

- **Flow channel: challenge should rise in step with player skill. Too easy is boring and too hard causes anxiety. Clear goals and immediate feedback keep a player in flow (Csikszentmihalyi, via Jenova Chen).** Corridors raise the skill needed (precise steering), so take something else away inside them. Use no random holes beside the strip (it is already the only floor), no jump gaps, and a lower speed while in a corridor (e.g. 0.9x the stop's speed). Raise corridor complexity gradually across stops 3 to 10 instead of making corridors themselves the difficulty spike. This keeps the overall difficulty curve where the current tests already validate it. *Sources:* https://khoury.northeastern.edu/~lieber/courses/csu670/f08/materials/p31-chen-flow-in-games.pdf ; https://en.wikipedia.org/wiki/Flow_(video_game)
- **Prefer predictable, authored or seeded difficulty over hidden dynamic adjustment for short, comparable runs. Dynamic difficulty adjustment (Hunicke) can cut deaths without players noticing, but it makes runs incomparable. Chen's own variant lets the player choose difficulty.** Keep stops and the daily route fully deterministic from the seed so scores and dailies stay comparable. If adaptation is wanted, make it opt-in and visible. Two options: a player-chosen 'calm corridors' toggle that widens corridors by 1 column, or in Forever only, a mild post-death relief that makes the next corridor one variant easier. Never adjust silently in the daily. *Sources:* https://en.wikipedia.org/wiki/Dynamic_game_difficulty_balancing ; https://users.cs.northwestern.edu/~hunicke/research.html
- **Sawtooth (interval) curve: hard stretches are followed by relief, so players get to enjoy the skill they just used. The pattern also repeats at smaller scales (fractal curves).** Build each corridor as an arc. Use 4 or more full-floor rows to enter, then a corridor of about 12–30 rows, then an exit landing that is a full row and a checkpoint, then about 8 or more rows of normal or easier generation. In Forever, alternate 'corridor phases' with 'open phases' on top of the 2400-row ramp. Within a stop, put the hardest corridor about two-thirds of the way through, not at the very end. *Sources:* https://www.gamedeveloper.com/design/doing-difficulty-right-fractal-curves ; https://bugnet.io/blog/difficulty-curves-how-to-get-them-right ; https://arxiv.org/pdf/1905.06379
- **Teach, test, twist (kishōtenketsu, as used by Koichi Hayashida for Super Mario 3D World): show a mechanic in a safe setting, develop it, add a twist, then drop it.** Make the stops a corridor curriculum. Stop 3 or 4: one straight 2-wide corridor with no drift, which teaches that the floor narrows. Stops 5–6: 2-wide with slow drift. Stop 7: 1-wide with drift. Stop 8: a corridor that wraps onto a wall, a twist that uses the roll-onto-wall physics. Stops 9–10: a two-line fork, where one line is shorter and carries coins and the other is safer, and a corridor that ends in a single short gap. Inside one corridor, start straight, then drift, then do one twist near the end. *Sources:* https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps ; https://gamedeveloper.com/design/captain-toad-and-the-core-of-nintendo-game-design ; https://en.wikipedia.org/wiki/Koichi_Hayashida
- **Introduce one new element at a time. A new mechanic should first appear where the player can already handle everything else.** A stop's first corridor should never combine width 1 with a new drift pattern and a gap. Give each corridor variant a difficulty tier, and let a stop or Forever band pick only from tiers it has already unlocked. Ban corridor+gap, and corridor+wall-roll+fork, until the last stops or deep Forever. *Sources:* https://bugnet.io/blog/difficulty-curves-how-to-tune-challenge-over-time ; https://www.tvtropes.org/pmwiki/pmwiki.php/Main/Kishotenketsu
- **Low failure cost and instant retry keep high difficulty from feeling punishing. Super Meat Boy uses near-instant respawn, short levels and a visible goal. Celeste checkpoints every room. The one standing critique of Celeste is long re-traversal after a death.** Put a checkpoint at every corridor entry, on its full-row approach pad, so a fall in a corridor only replays that corridor. Keep corridors short (at most about 30 rows, about 3–4 seconds at top speed). Keep the respawn delay at about 1 second or less. A fall should not cost much more than lost time, coin streak, or score. *Sources:* https://www.gamedeveloper.com/audio/postmortem-team-meat-s-i-super-meat-boy-i- ; https://pixelpoppers.com/2019/10/assist-mode-is-great-id-like-a-forgive-mode-too/ ; https://www.vice.com/en/article/d3w887/celeste-difficulty-assist-mode
- **Invisible forgiveness: coyote time, jump buffering, corner correction and wider timing windows make precise games feel fair without looking easier.** Add corridor-specific grace. Count a 1-wide strip as about 0.15 tiles wider for fall checks (edge forgiveness). Keep the 0.12 s coyote time. Add jump buffering if it is missing. Damp lateral slip slightly in corridors, for example a higher friction toward the strip centre, so slippery steering does not overshoot a 1-column line. Players should never see any of this. *Sources:* https://maddymakesgames.com/articles/celeste_and_forgiveness/
- **Fairness means readability. The threat must be visible early, the rule must behave the same every time, and the player must understand why they failed. Proposed thresholds include a warning window of at least 500 ms before the hazard matters and contrast of at least 3:1.** Signal a corridor at least about 0.5 s ahead (about 7 rows at 14.5 tiles/s) with a lit strip, the stop's spot color, or a stripe on the approach pad. Draw the corridor floor at high contrast against the black holes. Never start a turn just past a crest or hill where it cannot be seen. After a corridor fall, briefly show where the line went. *Sources:* https://gamedeveloper.com/blogs/designing-for-difficulty-readability-in-arpgs ; https://bugnet.io/blog/how-to-design-environmental-hazards-that-are-fair ; https://www.seeles.ai/resources/blogs/how-roblox-games-create-fair-difficulty
- **Generate procedural runners from short pieces built to fit the player's movement limits, and check each piece's difficulty automatically before it is used. Runners usually tune speed and obstacle probability and gate which pieces can appear by difficulty band.** Add a corridorSegment(rng, tier, speed) generator that writes rows plus trail[] and wid[]. Its drift is limited by the existing 'keep' rule: at most 1 column per K rows, with K computed from ACC 46 and the stop's speed so a sideways step is always reachable. Call it from buildStation, from st.extend in Forever (tier = f(t)), and from dailyParams (tiers 2–3 only). Use the existing autopilot and human-like bot as the automatic difficulty check. *Sources:* https://www.sbgames.org/sbgames2013/proceedings/comp/23-full-paper.pdf ; https://gamedeveloper.com/design/keep-running-procedural-level-generation-in-sure-footing ; https://escholarship.org/content/qt0fn558gq/qt0fn558gq.pdf

## Corridor patterns in runners (internal research; never name or copy Run 3 in anything shipped)

- **Stripped rail (single or double strip over the void)** (Easy (w2, straight) to Medium (w1, 20+ rows, gentle drift). First set piece to introduce, around stop 3.): For K=10–24 rows, set holes=1.0 outside the trail so only the safe path exists, width 2 then 1, little or no drift. It looks dramatic ('stripped to hell') but reads clearly, because the only thing to see is the line. Implementation: in the row loop, if inside a piece, row.fill(0) before the hist stamp. Keep the keep-rule stamp. Bookend with 2 rows of width+1 at entry and exit. *Source:* https://sites.google.com/view/onlineslopegame/ ; https://run.fandom.com/wiki/Low-Power_Tunnel,_part_18
- **Funnel / neck** (Easy): Width narrows 3→2→1 over about 6 rows, holds w1 for 4–8 rows, then opens back up. A tutorial for rails, cheap enough to sprinkle on early stops. *Source:* https://claudeskills.info/skills/gamedev-skills/awesome-gamedev-agent-skills/level-design/
- **Corkscrew / spiral** (Medium (quarter or half turn); Medium-Hard (full turn on stops 8–10 or Forever t>0.6)): Lock drift to a constant ±1 for a set number of rows, so the path wraps a fixed fraction of the tunnel (a quarter turn on 18 columns = 4–5 columns over 8–10 rows; a full revolution at 1 col/2 rows = 36 rows). Strip everything else out. The rider keeps steering one way and rolls up the walls and over the ceiling, which shows off the walls-become-floors feature. The keep rule already widens each step into a staircase, so the minimum width is effectively keep columns diagonally. Check the needed lateral speed: tileW / (2D / v) must stay under what ACC 46 can hold. If not, use 1 col/3 rows at high speed. Corkscrews shouldn't be too tight (Trackmania guideline). *Source:* https://docs.google.com/document/d/1hB_dZHk9OYu_GghrEHvVd4eELX-eT5oQ4WZCj2yGbr4/export?format=pdf
- **Slalom** (Medium (amp 2, w2); Medium-Hard (amp 3, w1)): Drift alternates +1 / -1 on a period of 4–6 rows with amplitude 2–3 columns, holes=1 outside the trail. A steer-left, steer-right rhythm; the slippery steering makes it a skill of counter-steering early. Period must be at least 2*keep rows, so the old column overlap always leaves a tile to stand on while you cross. *Source:* https://ojs.aaai.org/index.php/AIIDE/article/download/12903/12751
- **Fork and merge (two rails)** (Easy-Medium (the choice itself adds no difficulty; the coin branch is optional)): The path splits into two width-1 rails 4–6 columns apart (or on opposite walls) for 12–20 rows, then they join. One rail is straight and safe; the other is curvier or has a short jump-gap but carries a coin line (risk vs reward). The autopilot follows trail[] = the safe branch; the other branch is extra tiles only. Join with a 3-row full-width band. *Source:* https://www.gamedeveloper.com/design/keep-running-procedural-level-generation-in-sure-footing
- **Stepping stones / staggered islands** (Medium-Hard. Late stops and Forever t>0.5 only, at most once per stop, with a breather after.): Short islands (2–3 rows long, width 1–2) separated by 1–2-row holes, each island shifted ±1 column from the last. The reference game's later tunnels use rectangular islands with big gaps and small vs large platforms. Here keep the islands within one jump (jumps are capped at 8 rows; keep gaps at most 2 rows so it's a hop rhythm, not long jumps) and never shift more than one column per island. Coin arcs mark the rhythm. *Source:* https://run.fandom.com/wiki/Low-Power_Tunnel,_part_18 ; https://run.fandom.com/wiki/Box_Storage_Area,_part_7
- **Wall-hop bridge (corner crossing)** (Easy-Medium): A stripped strip that deliberately crosses a polygon corner onto the next wall: path shifts C columns (one whole side) over about 2*keep rows. It shows off rolling onto the wall. On N=8 it's gentler (smaller corner angle) than on N=6. *Source:* https://trackmania.exchange/blogs/entry/4/fullspeed-mapping-guide-part-1-understanding-fs-sk
- **Launch-over-the-void (crest into stripped run)** (Medium): Line up an existing hill crest with the start of a stripped rail or a jump-gap. The crest already gets a glide coin line, so the reward is a long airtime over empty tunnel landing on a strip. Must respect the existing GAP_FLAT/GAP_PRE visual hold (a gap is never hidden over a crest), so place the strip and not a gap right after a crest. *Source:* https://run.fandom.com/wiki/Tiles?oldid=8230
- **Breather / station platform** (Easy (relief)): 6–10 full-width (or 10% holes) rows after every piece of cost 2 or more, counted as a checkpoint spot. The 'valley' of the sawtooth. Never let a gapEvery gap land inside the first 3 rows after a piece; shift the gap counter instead (reset sinceGap). *Source:* https://www.abratabia.com/game-design/difficulty-curves.php
- **Sector gate (Forever and daily)** (Medium): Every about 300 Forever rows (or once mid-route on the daily) a signature combo, e.g. funnel → half corkscrew → breather, marks a new sector before foreverAt steps up. It gives the endless mode a sense of place and progress. *Source:* https://www.gamedeveloper.com/design/keep-running-procedural-level-generation-in-sure-footing
- **Avoid list (not recommended now)** (Hard / frustrating): Darkened or flickering tiles (Low-Power style), crumbling or ice tiles, full turnovers in under 8 rows, two hard pieces back to back, pieces overlapping jump-gaps. All of these move toward the punishing difficulty the user ruled out ('no dark souls'). *Source:* https://run.fandom.com/wiki/Level_28?oldid=5917 ; https://docs.google.com/document/d/1hB_dZHk9OYu_GghrEHvVd4eELX-eT5oQ4WZCj2yGbr4/export?format=pdf
- **Suggested schedule across modes** (Easy at the start of a run, Medium-Hard at the end; each spike is followed by relief): Stops 1–2: funnel, wall-hop. Stop 3: first stripped rail (w2). Stops 4–5: fork/merge, slalom (amp 2), quarter corkscrew. Stops 6–7: w1 rails, half corkscrew, launch-over-void. Stops 8–10: full corkscrew, slalom amp 3, stepping stones (once), each followed by a breather. Daily: 2–3 pieces from the stop 4–7 pool, chosen by its seed. Forever: unlock pieces as t passes 0.1/0.25/0.4/0.6, budget per 100 rows = 1 + 3t, plus a sector gate every ~300 rows. Gate the whole schedule on the existing test.mjs autopilot (zero deaths) and on bot falls/min per piece type. *Source:* https://www.gamedeveloper.com/design/keep-running-procedural-level-generation-in-sure-footing ; https://bugnet.io/blog/difficulty-curves-how-to-get-them-right

## Synthesised plan (as proposed; see DECISIONS.md for what was built and what was changed)

# Outer Line corridors: build plan

The "stripped corridors" are a set-piece layer. Inside a corridor, the random-hole recipe stops and the row is all void except a 1–2 column line. Every piece still writes `trail[]`, `wid[]` and a new fractional `mid[]`, so the autopilot, coins and checkpoints keep working. Code goes in `/home/user/tempname/games/outer-line/game.html` (buildStation l.253, the STOPS table l.207–216, buildForever/st.extend l.373, dailyParams l.421, addHills, makeCoins). Tests go in `/home/user/tempname/games/outer-line/test.mjs`.

I checked one thing in test.mjs: there is no human-like bot. Only the autopilot exists, so the bot below is new work.

## 1. Shared rules (one helper, used by every piece)

**Per-stop constants**, all from the vTop the keep rule already uses:
- `keep` stays as it is.
- `Kd = ceil(vTop/D * tileW / (0.7*6.5))` is the rows per column on a diagonal.
- `E = ceil(0.25 s * vTop/D)` is the number of "elbow" rows after each bend.
- Values range from keep 9 / Kd 5 / E 5 at Dockyard to 12 / 7 / 7 at Terminus, and 13 / 7 / 8 at the end of Forever.

**Line rule:**
- A straight run is 1 column. A diagonal (slope ±1/Kd) is always 2 columns.
- For E rows after any slope change, also floor the column the line would have kept to before the bend. A rider who reacts 250 ms late still has floor.
- Sideways demand stays at or below 58% of the flow-0 top lateral speed, with no flow needed.

**The arc of a corridor** (this is the sawtooth):
1. **Approach pad.** `keep` rows of full floor with drift frozen at 0, so the rider arrives centred. It carries a checkpoint flag `cp[r]`, which needs a small hook where `S.check` is set. It also carries a spot-colour stripe as a warning at least 7 rows (about 0.5 s) ahead.
2. **Entry.** The piece opens at least 3 wide (funnel or lead-in).
3. **Piece.** No random holes and no gapEvery gaps. The only gaps are ones the piece places itself, and those sit only on straight rows.
4. **Breather.** At least 8 rows after exit: 4 rows of full floor, then 4 rows at `holes - .2` and `width + 1`. Push `nextGap` to `exit + max(6, gapEvery/2)`.

**Hard bans:**
- No gap or break on a sloped row. Air steering is too weak (0.39 s to step 1 tile in the air vs 0.34–0.49 s of airtime).
- No crest from `CREST_ROWS + 2` before a piece to its end: `flat[r]` is forced to grade 0 on `[start-2, end+2]`.
- No two pieces of cost 3 or more back to back.
- Partial (single-rail) breaks only on an optional or reward branch, never on the only route.
- No dark, crumbling or ice tiles.
- At most 40% of a stop's rows can be stripped.
- Each stop introduces one new element.

**Stations:** replace the `(r-START) % gapEvery` modulus with a `nextGap` counter, the same way Forever already works.

## 2. Set pieces (exact tile rules), by tier

| Tier | Piece | Tiles |
|---|---|---|
| T1 | **Rail** (funnel into needle) | Centre c. Half-width `h(j) = max(hEnd, 2 - floor(j/keep))`, floor `c-h..c+h` (5→3→1), then a needle `{c}` for Ln rows. The teaser version uses hEnd = 1, so it never narrows below 3. |
| T1/T2 | **Slalom** | A line-rule trapezoid wave, amplitude A, holding Sh = 4 rows at each extreme, with elbows. A = 1 is T1, A = 2 is T2, A = C (crosses a corner) is T4. |
| T2 | **Fork** | A 2-row 1-wide stem, then two line-rule branches out to ±d columns, straight for `keep` rows, then they rejoin. `trail` follows one branch; the other carries a coin every 2 rows. d = 1 (N8) is T2, d = 2 (N6) is T3. |
| T2/T4 | **Stepping stones** | 2-wide stones, each shifted 1 column (`{c+s*k, c+s*k+1}`), so neighbouring stones share a column. Gaps are G full-empty rows; stone length is `L = max(12-G, keep)`. Each gap gets the existing lip, landing and checkpoint. G = 2 with 3 stones is T2; G = 3 with 4 stones is T4. |
| T3 | **Corkscrew** | One line with `x = c + .5 + dir*j/Kd`. It rolls the rider onto walls and the ceiling. Lead-in is 3 wide. If it runs over 40 rows, add a straight pause: 2 rows, then a G-row gap, then 10 straight rows. |
| T3 | **Twin rails** | Two 1-wide rails exactly one side apart (they look like the same line on neighbouring walls). Line-rule crossover ribbons switch `trail` between them. The version with breaks is T4: a 3-row hole on the rail just left, which can be hopped. |
| (v2) | Braid | Forever only, t ≥ .7. Leave it out of v1. |

## 3. Stop schedule (teach, test, twist)

Lengths are approximate and use the audit's formulas. I raise the length of the last three stops so the 40% cap holds without squeezing out normal play.

| # | Stop | New element (teach) | Pieces (in order, hardest at about 2/3 of the stop) | Stripped share |
|---|---|---|---|---|
| 1 | Dockyard | none | none (a clean onboarding run) | 0% |
| 2 | Lumen Avenue | "the floor narrows" | Rail teaser 5→3 (24 rows) | ~16% |
| 3 | Halo Junction | single line | Rail, needle Ln 8 (~26) | ~15% |
| 4 | Quarry Steps | bends | Rail Ln 8, then Slalom A1, 2 cycles (~28 + 36) | ~35% |
| 5 | Lantern Market | choice | Slalom A2, 1 cycle (test), then Fork d1 (~32 + 25) | ~30% |
| 6 | Orbit Park | wall ride (twist) | Corkscrew half turn, 1 pause (~78) | ~39% |
| 7 | Glass Bridge | switching lines | Twin rails, no breaks, 2 phases, split at a landing (~70) | ~33% |
| 8 | Deep Siding (len 220→250) | line + hop | Stones G2×3 (first time a strip meets a jump), then Fork d2, no break (~39 + 37) | ~30% |
| 9 | Comet Yard (len 230→270) | corner-crossing swing, optional hop | Fork d1 with a break on the reward branch only, then Slalom A=C, 2 cycles split (~28 + 72) | ~37% |
| 10 | Terminus (len 260→300) | nothing new (remix) | Stones G3×4 at ~35%, Corkscrew one side + 1 at ~65%, easy run-out to the end (~60 + 49) | ~36% |

## 4. Daily route

- `p.pieces` comes from a separate rng seeded by n, so the rest of the route's own rng stream is unchanged.
- Pool: T1–T2 only, plus a corkscrew of at most one side on N8 days. That means Rail Ln 10–16, Slalom A ≤ 2, Fork d1, Stones G = gapLen ×3, and Twin rails with no breaks.
- 1 piece, or 2 on about half the days. At most 70 stripped rows. First piece at row 60 or later. No breaks.
- Reason it stays mid-tier: a fall on the first daily ride ends the run.
- Ship it as a route-version bump so dailies before and after the change aren't compared on the board.
- Fully deterministic. No silent adaptation.

## 5. Forever

**Unlocks by t:**
| t | Unlocks |
|---|---|
| .12 | Rail (Ln 8 + 12t) |
| .20 | Slalom A1 |
| .30 | Stones |
| .40 | Fork |
| .45 | Slalom A2 |
| .50 | Corkscrew (one side; half turn after t .8) |
| .60 | Twin rails, and breaks on fork reward branches |
| .75 | Slalom A=C |
| .80 | Twin-rail breaks |

**Spacing:**
- First piece at row 360. After that, one every `260 - 140t` rows.
- Pick from the 2 highest unlocked tiers, weighted toward newly unlocked ones.
- About every 300 rows, a "sector gate": funnel, then a short corkscrew, then a breather.

**Engineering:**
- Decide each piece at least 40 rows ahead, because hills are only computed to len-20 and crest suppression reaches back 15 rows.
- Keep `st.piece` across `extend()` calls, since a piece can straddle a 300-row chunk.
- Compute keep/Kd/E from `foreverAt(start+len).speed`, the highest speed inside the piece.

**Optional v2:** an opt-in, visible "calm corridors" toggle that adds 1 column of width. Never adjust difficulty silently.

## 6. Reward and feel

- On single-line pieces, coins along `mid` every 3 rows; on reward branches, every 2.
- New LINE callout and score bonus for clearing a piece with no fall. This replaces EDGE spamming on 1-wide lines.
- After a fall in a piece, show the line's path for about 0.5 s on respawn.
- Respawn at about 1 s or less, at the piece's approach pad.

## 7. What to measure (gates in test.mjs)

1. **Autopilot, zero deaths.** All 10 stops, 60 dailies, 20 Forever seeds × 4000 rows. The autopilot must aim at `mid[]` with a 1-row look-ahead plus feed-forward `(mid[r+1]-mid[r])*speed/D*tileW`. Without this it lags about 0.43 of the 0.5-tile slack.
2. **Slack proof.** The autopilot with a 150 ms input delay must still die zero times on stops 1–7 and all dailies.
3. **Human-like bot (new).**
   - Behaviour: 200 ms reaction delay, steering noise σ ≈ 0.15 tile, ±60 ms jump jitter, 30 seeds per stop and per daily, 10 Forever seeds.
   - Cap: falls/min inside pieces ≤ that stop's no-piece baseline + 0.5.
   - Absolute caps: in-piece ≤ 1.5 falls/min on stops 3–7 and dailies; ≤ 2.5 on stops 8–10 and Forever at t > .6.
   - Per-attempt fall rate: ≤ 10% at a piece's introduction stop, ≤ 25% anywhere.
   - No piece type over 2× the average piece.
   - Stop medians must trend upward, with sawtooth dips allowed.
4. **Geometry invariants** (checked per built row):
   - Lateral demand ≤ 0.6 × 6.5.
   - Each row's floor overlaps the next row's by at least 1 column, except at gaps.
   - No gap on a sloped row.
   - Every in-piece gap lands on at least 8 straight rows.
   - No crest in the suppression window.
   - No gapEvery gap within 6 rows of a piece exit.
   - A breather after every piece; stripped share ≤ 40%.
   - Entry is at least 3 wide.
5. **Readability.**
   - Approach signal visible at least 7 rows ahead and never hidden behind a crest.
   - Extend the existing gap-visible-on-phone test to stone and pause gaps.
   - Strip-vs-void contrast at least 3:1, computed from each palette.
6. **Retry cost.** Rows replayed after any piece fall ≤ about 45 (about 2 s).
7. **Determinism.** Same seed gives identical rows. Forever built with one `extend(4000)` must equal the same build done in 300-row chunks.

## 8. Build order

1. Line-rule helper, `mid[]`, the `nextGap` counter in stations, `cp[]` checkpoints, and moving the autopilot onto `mid[]`. Then confirm the existing tests are green.
2. Piece framework plus Rail, the hill flat mask, and the human-like bot.
3. Add one piece at a time, each behind the gates in section 7.
4. Stop schedule.
5. Daily.
6. Forever.
7. Visuals: approach stripe, LINE callout, path flash after a fall.

## 9. Main risks

- **Every station layout changes.** Switching to `nextGap` and adding pieces reshuffles the seeded maps, which may break tests that assume specific rows. The longer last stops also change their tests.
- **Stale `st.width` in tests.** The station autopilot uses `trail + st.width/2` at about test.mjs lines 42, 130, 296, 358 and 438. It has to move to `mid[]`, or it will fail on diagonals.
- **Crests** at the edge of the flat mask would launch the rider off a 1-wide line. This needs the forced-zero grade and the crest-clear window.
- **Forever chunk boundaries and rising speed** inside a piece can desync layout or hills (covered by the determinism test).
- **No red lip on single-rail breaks.** Keep them optional and from Comet Yard on, or draw a lip for them.
- **Over-stacking:** the budget, one-new-element rule and breathers are the only things holding back "Dark Souls" spikes. The bot caps in section 7 are the gate that enforces them.
- **Calibration:** the human-like bot's noise model is a guess and needs a real play pass to set its numbers. Most of the sawtooth and fairness advice comes from practitioner writing, not controlled studies.
- **No Run 3 names, tunnels or levels.** Use the patterns only.
