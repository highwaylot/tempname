# Outer Line → Trip and Route: marketing handoff ("daily route" scheme)

*2026-10-25. Built from `docs/HANDOFF-EXAMPLE-DAILY.md` and `docs/GAME-PAGE-PLAYBOOK.md`. Source: `games/outer-line/` in `highwaylot/tempname`, branch `claude/bold-thompson-c3s6i5` (it should move to its own repo or the studio repo once the name is settled).*

## 0. Links

| What | Where |
|---|---|
| **Game page preview (live)** | https://claude.ai/artifact/EGSPkuAwmMB4guW77o788u |
| Drop-in folder | `games/outer-line/dist/` (generated: `node games/outer-line/make.mjs`; about 535 kB) |
| The game | `games/outer-line/game.html`: one 30 kB file, no build step, no libraries |
| Page template | `games/outer-line/page.html` |
| Checks | `node games/outer-line/test.mjs` |

## 1. The game in one breath

**Outer Line** (working title), a Trip and Route game. A tunnel runner on a space metro: run the line stop to stop, jump the gaps, and step onto a wall when the floor runs out. The tunnel turns and the wall becomes the floor.

- **Tagline:** Walls are floors.
- **Daily line:** One route a day. Same for everyone.
- **Short (≤ 80):** A space-metro tunnel runner. Step onto a wall and it becomes the floor.
- **Medium:** Run the line stop to stop, jump the gaps, and step onto a wall when the floor runs out: the tunnel turns and the wall becomes the floor. One route a day, the same for everyone.
- **Tags:** runner, tunnel, platformer, daily, keyboard.
- **Status:** browser prototype. 10 stops plus the daily route. Keyboard and touch.
- **Rating notes:** no chat, no accounts, no ads, nothing leaves the device (progress and the day's result sit in localStorage).

## 2. Positioning against Run 3

Run 3 (Joseph Cloutier, 2014) is the title Coolmath's 2025 top-10 ranks first. It's a space tunnel runner where walls become floors, and it lives on school laptops. Outer Line competes on what Run 3 doesn't do:

| | Run 3 | Outer Line |
|---|---|---|
| Phone play | Keyboard-first | Built for both: hold-to-steer, tap or swipe-up jump |
| Session | Long level map | Short stop-to-stop rides (20–30 s each) |
| Coming back | Unlock more levels | One shared route a day, a share card, no streak |
| Look | Grey space, alien runner | Night transit: line colours, stations, a subway map |
| Weight | Large game | One 30 kB file, instant on any school Chromebook |

**Rule:** never name, show or imitate Run 3 in anything we publish. That means no "like Run 3", no lookalike runner or art, and no use of its levels or name. The genre (a tunnel runner with gravity on the walls) is open. The specific game isn't. Organic posts can let players make the comparison themselves.

## 3. What's built and checked

**Built:**
- **Ten stops** from Dockyard to Terminus in three line sections:
  - orange: 6-sided tunnels, speed 8–9.5
  - blue: 8-sided, 10–11
  - violet: 11.5–12.5, one-tile paths, three-tile gaps
- **A transit-map menu.** Each stop unlocks the next.
- **Today's route:**
  - UTC midnight reset; route #1 is 2026-10-25
  - the first ride goes on the card, practice is unlimited
  - the card is text: `Outer Line · Route #N`, a 10-square bar, the percentage
- **Sound:** short pitched effects only (jump, land, wall step, fall, arrival chime), no background bed, with a mute button.

**Checked** (`test.mjs`, headless Chromium, all passing):
- **Every stop and 60 days of routes can be finished.**
  - An autopilot that only follows the guaranteed path and jumps at gaps finishes all 10 stops and daily routes #1–60, with zero deaths.
  - Writing that check found a real design bug: one-tile paths shifted diagonally, which made some steps impossible. The fix keeps the old column for as many rows as a sideways step needs at that stop's speed.
  - Fairness margin: the bot also passes steering a third of a row early. Steering almost a full row early fails on 5 of 60 routes, the same mistake a player makes by moving over a hole too soon.
- **Play:**
  - real-time keyboard play moves you forward, and Space jumps
  - stepping onto the next wall rolls the tunnel to it
  - arriving unlocks the next stop
  - the daily ride ends on its card
  - on touch, holding the right half steers right and a quick tap jumps
- **Errors:** no page errors and no sideways scroll at 1280×800 or 390×844.

**Page:** checked at 1280×860 and 390×844:
- hero images load and nothing scrolls sideways
- the route number and reset countdown fill in
- "Today's route" starts the daily ride inside the frame
- it plays inline on desktop with "Get off", and full screen over the page on phones
- no errors

**Not checked:**
- a real phone or Chromebook
- feel and difficulty with human hands
- Google Fonts (blocked by this environment's proxy)

## 4. The page

- **Hero:** studio credit and "Preview", OUTER LINE, "Walls are floors.", the pitch, two buttons (Ride the line, Today's route) and chips (free in your browser, keyboard or touch, no account). Below it, a 16:9 window onto the tunnel: a still from real play with a Ride button, which becomes the game.
- **How it rides:** Ride, Turn, Jump, each with a real number from the code.
- **Today's route:**
  - a departure-board panel with the live route number, the reset countdown and a sample card
  - the rules: no streaks, no accounts, the card never spoils the route
- **The line map:** a still of the in-game map.
- **Controls:** keys and touch.
- **Footer:** no ads, no tracking.
- **No video:** the founder said no new videos, so the page uses stills from real play and the live game itself. A trailer is one command away when wanted (the same capture pipeline as Bell Theory's).

**Drop it in:**
- Copy `dist/` to `/games/outer-line/` and make `og:image` absolute.
- The grid card is `card-16x9.jpg`, a frame of real play with the three line colours along the bottom.
- `game.json` carries `scheme: "daily"` and the reset rule.

## 5. Content engine (when videos are back on)

| When | What |
|---|---|
| Daily, after reset | "Route #N is open": the first 6 s of today's route, no solution |
| Daily, evening | Yesterday's hardest stretch, cleared |
| Weekly | The week's cards side by side |

- **Caption:** "Route #N. [the moment in five words]. What did you get?"
- **CTA:** "Ride today's route, post your card."
- **Rules:**
  - never post today's solution before the reset
  - bot footage is labelled
  - nothing names Run 3

## 6. Decisions for the founder

1. **Name.** "Outer Line" is a working title. Check the domain and handles, and run a quick trademark search before using it publicly.
2. **Difficulty by hand.** The bot proves every stop can be finished, not that it's fun. Play stops 1–10 and tell me which feel unfair or boring.
3. **Rider.** It's a glowing orb for now. A proper character (a commuter? a ticket?) is the biggest visual upgrade.
4. **Daily attempts.** It's first-ride-counts now. Keep that, or best-of-three?
5. **Where it lives.** Move `games/outer-line/` into the studio repo or a new one, so Bell Theory's repo stays Bell Theory's.
6. **Measurement.** As with Bell Theory, nothing is counted. A cookieless count of `daily=1` plays per date would show whether people come back.

## 7. Go-live checklist

- [ ] Founder plays all ten stops and the daily on a phone and a laptop
- [ ] Name cleared; title and copy updated if it changes
- [ ] `node games/outer-line/test.mjs` passes, then `node games/outer-line/make.mjs`
- [ ] Copy `dist/` to `/games/outer-line/`; absolute `og:image`; sitemap
- [ ] First post right after a reset, with the route number in the caption
