# Outer Line → Trip and Route: marketing handoff ("daily route" scheme)

*2026-10-25, v2 (skater and momentum rework). Built from `docs/HANDOFF-EXAMPLE-DAILY.md` and `docs/GAME-PAGE-PLAYBOOK.md`. Source: `games/outer-line/` in `highwaylot/tempname`, branch `claude/bold-thompson-c3s6i5` (it should move to its own repo or the studio repo once the name is settled).*

## 0. Links

| What | Where |
|---|---|
| **Game page preview (live, v2)** | https://claude.ai/artifact/EGSPkuAwmMB4guW77o788u |
| Drop-in folder | `games/outer-line/dist/` (generated: `node games/outer-line/make.mjs`; about 750 kB) |
| The game | `games/outer-line/game.html`: one 41 kB file, no build step, no libraries |
| Page template | `games/outer-line/page.html` |
| Checks | `node games/outer-line/test.mjs` |

## 1. The game in one breath

**Outer Line** (working title), a Trip and Route game. Skate the space metro after hours. Carve the tunnel, step onto a wall when the floor runs out, and chain wall rides, gaps and hops into a line that keeps getting faster.

- **Tagline:** Walls are floors. Tricks are speed.
- **Daily line:** One route a day. Same for everyone.
- **Short (≤ 80):** Skate the space metro: walls are floors, tricks are speed.
- **Medium:** Skate the space metro after hours. Carve the tunnel, step onto a wall when the floor runs out, and chain wall rides, gaps and hops into a line that keeps getting faster. One route a day, the same for everyone.
- **Tags:** skate, runner, tunnel, momentum, daily.
- **Status:** browser prototype. 10 spots plus the daily route. Keyboard and touch.
- **Rating notes:** no chat, no accounts, no ads, nothing leaves the device (progress and the day's result sit in localStorage).

## 2. What changed in v2, and why

Founder on v1: "very boring", wanted the vibe of a skater ("fast, slippery, and fun"), parkour momentum as the core reward, and a UI that doesn't look like MOSTMATH.

| | v1 | v2 |
|---|---|---|
| Rider | glowing orb | a skater drawn from behind: board, beanie, magenta hoodie; leans into carves, crouches on tuck, arms up in the air |
| Steering | instant lane moves | slippery: lateral speed builds (accel 46/s², air 26), slides out (friction 1.5, air 0.25), countersteer bites 1.7× harder |
| Speed | fixed per stop | **flow** 0–1: speed = base × (1 + 0.8 × flow). Tricks fill it, it drains slowly (0.045/s, 70 % slower mid-combo), a fall empties it |
| Reward | arrival | tricks with callouts, combo ×N (2.4 s window, score multiplier capped ×8), style score, tiers ROLLING → FLOWING → FULL SEND, combo sounds that climb a scale |
| Feel | flat | FOV widens with flow, speed lines, streaming stars, landing shake, tuck (↓) for +15 % speed at the cost of grip |
| Look | night transit, line colours, map | skate zine: lime / cyan / magenta on black, heavy italic type, tape labels, skewed bars, offset shadows |

**Tricks** (flow gained, base points):

| Trick | How | Flow | Pts |
|---|---|---|---|
| Wall ride | roll onto another side while grounded (0.5 s cooldown) | .07 | 100 |
| Gap | clear a gap row | .10 | 200 |
| Big gap | clear 5+ rows in one jump | .16 | 400 |
| Transfer | change sides in the air | .10 | 250 |
| Hop | jump again within 0.16 s of landing after real air | .05 | 80 |
| Edge | ride along a hole's edge for 0.18 s+ | .05 | 150 |

## 3. Positioning against Run 3

Run 3 (Joseph Cloutier, 2014) is the title Coolmath's 2025 top-10 ranks first: a space tunnel runner where walls become floors. Outer Line competes on what it doesn't do:

| | Run 3 | Outer Line |
|---|---|---|
| Core reward | survive, reach the end | momentum: tricks make you faster, a clean line is the high |
| Phone play | keyboard-first | built for both: hold-to-carve, tap or swipe-up jump |
| Session | long level map | short spot-to-spot rides (20–40 s each) |
| Coming back | unlock levels | one shared route a day, a share card with style score, no streak |
| Look | grey space, alien runner | a skater, a zine, loud colour |
| Weight | large game | one 41 kB file, instant on a school Chromebook |

**Rule:** never name, show or imitate Run 3 in anything we publish. No "like Run 3", no lookalike runner or art, no use of its levels or name. The genre (a tunnel runner with gravity on the walls) is open; the specific game isn't. Organic posts can let players make the comparison themselves.

## 4. What's built and checked

**Built:**
- **Ten spots** from Dockyard to Terminus: speed 10 → 14.5, holes 12 % → 72 %, paths 3 tiles wide → 1, gaps every 30 rows → every 12, up to 3 rows long. Spots unlock in order.
- **Today's route:** UTC midnight reset; route #1 is 2026-10-25; the first ride goes on the card, practice is unlimited. The card is text: `OUTER LINE · ROUTE #N`, a 🟩/⬛ progress bar and the style score.
- **Sound:** short pitched effects only (jump, land, wall step, tricks climbing a scale, fall, arrival), no background bed, with a mute button.

**Checked** (`test.mjs`, headless Chromium, all passing):
- **Every spot and 60 days of routes can be finished.** An autopilot that follows only the guaranteed path (steering through the same slippery physics a player has) finishes all 10 spots and daily routes #1–60 with zero deaths.
- **Momentum builds on every spot:** the bot's top speed reaches 1.67–1.8× the spot's base speed; tricks score on every spot (Terminus: combo ×50, style 176,198 for a perfect bot).
- **Play:** keyboard moves and jumps; stepping onto the next wall rolls the tunnel; arriving shows style, top speed and best combo and unlocks the next spot; the daily ride ends on its card; on touch, holding a side carves and a quick tap jumps.
- **Errors:** no page errors and no sideways scroll at 1280×800 or 390×844.

**Page** checked at desktop and 390×844: images load, nothing scrolls sideways, the route number and countdown fill in, "Today's route" starts the daily ride inside the frame, it plays inline on desktop with "Bail out" and full screen over the page on phones, no errors.

**Not checked:**
- feel by human hands: how slippery is fun versus annoying is the open question
- a real phone or Chromebook
- tuning: a perfect bot maxes flow easily and the combo window is generous (×50 combos); a human will tell us whether FULL SEND is too easy to hold

## 5. The page

- **Hero:** studio tape label, OUTER LINE in heavy italic, "Walls are floors. Tricks are speed.", two buttons (Drop in, Today's route). A tilted screen frame with a magenta offset shadow holds a real still (the skater airborne at FULL SEND with callouts on screen) and a "▶ Ride" button that turns it into the game.
- **Momentum:** the trick cards and a flow meter that explains the loop in one look.
- **Today's route:** a card with the live route number, the reset countdown and a sample share card; no streaks, no accounts, the card never spoils the route.
- **Spots:** a still of the in-game spot select.
- **Controls:** keys and touch. **Footer:** no ads, no tracking.
- **No video:** per the founder's standing request; stills from real play and the live game. A trailer is one command away when wanted (the Bell Theory capture pipeline).

**Drop it in:** copy `dist/` to `/games/outer-line/` and make `og:image` absolute. The grid card is `card-16x9.jpg` (real play with a lime/cyan/magenta stripe). `game.json` carries `scheme: "daily"` and the reset rule.

## 6. Content engine (when videos are back on)

| When | What |
|---|---|
| Daily, after reset | "Route #N is open": the first 6 s of today's route, no solution |
| Daily, evening | the day's best line: highest style, top speed on screen |
| Weekly | the week's cards side by side |

- **Caption:** "Route #N. [the moment in five words]. What did you score?"
- **CTA:** "Ride today's route, post your card."
- **Rules:** never post today's solution before the reset; bot footage is labelled; nothing names Run 3.

## 7. Decisions for the founder

1. **Name.** "Outer Line" is a working title. Check the domain and handles, and run a quick trademark search before using it publicly.
2. **Feel by hand.** Play spots 1–10. Is the slide fun or annoying? Is FULL SEND too easy to keep? Those two answers set the next tuning pass.
3. **The skater.** Drawn in code for now. A designed character (outfit, board colours, unlockable boards) is the biggest visual upgrade.
4. **Daily attempts.** First ride counts now. Keep that, or best-of-three?
5. **Where it lives.** Move `games/outer-line/` into the studio repo or a new one, so Bell Theory's repo stays Bell Theory's.
6. **Measurement.** Nothing is counted. A cookieless count of daily plays per date would show whether people come back.

## 8. Go-live checklist

- [ ] Founder plays all ten spots and the daily on a phone and a laptop
- [ ] Name cleared; title and copy updated if it changes
- [ ] `node games/outer-line/test.mjs` passes, then `node games/outer-line/make.mjs`
- [ ] Copy `dist/` to `/games/outer-line/`; absolute `og:image`; sitemap
- [ ] First post right after a reset, with the route number in the caption
