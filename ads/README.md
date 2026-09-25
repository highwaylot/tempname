# Ad tools: AI vs AI rounds and end cards

Nothing in this folder ships in the app. It drives the real game engine to
make vertical ad clips. One-time setup is `npm install`; everything below
runs from the repo root.

## AI vs AI rounds

```
node ads/render.mjs versus --left br --right ar --seed 7
```

That records one round to `ads/out/br-vs-ar-s7.mp4`: 1080×1920, 30 fps,
H.264, with **the game's own sound** (coin dings, pump ticks, boosts,
smashes, the crash), captured frame-exact and levelled to -14 LUFS. Lay
music under it in the edit if you want. Each side is a bot playing one
lane of the real game with its country's flag on the orb. The side that hits
a wall first loses, and the clip ends on a "<country> wins" card about 1.9 s
after the crash.

| Option | Default | What it does |
|---|---|---|
| `--left`, `--right` | `br`, `ar` | Two-letter country codes (ISO 3166, lowercase: `us`, `mx`, `gb-eng`, `jp`…). Flags come from the MIT-licensed `flag-icons` set. |
| `--leftName`, `--rightName` | from the code | Override the name shown, e.g. `--leftName "Brasil"`. |
| `--seed` | `1` | Every run is reproducible from its seed. Same seed and settings gives the same video. |
| `--count` | `1` | Render this many rounds, seeds `seed`, `seed+1`, … |
| `--safe` | `6` | No scheduled crash before this many seconds. |
| `--mean` | `5` | Average extra seconds after the safe window before a bot starts to slip. Higher means longer rounds. |
| `--hook` | `Who hits the wall first?` | The line under the matchup for the first 3 seconds. |
| `--fps` | `30` | Use `60` for smoother clips; renders take twice as long. |

**How the randomness works.** Each seed draws, for each side, the moment
that bot starts to slip: the safe window plus a random amount (averaging
`--mean`). The earlier slip loses, so either side can win and you can't
predict which. Before the safe window a crash needs a one-in-100-million
roll (`--early 1e-8`). Bots boost, smash slate and graze walls on the way,
all real engine behaviour.

**How the bots play.** Ads use the "hype" style, a good player showing off.
The round opens mid-run (difficulty 0.36, climbing 0.02/s;
the real game reaches 0.36 around distance 940) instead of on the slow
opening seconds. Bots pump in quick 3.4–4.6 Hz strokes almost nonstop, in
the free half of their reach when a wall blocks the other, so the first
boost lands around 2 s; about 4 in 10 boosts are chained by pumping through
them. Coins come first: any coin the thumb can reach and still get back into
the gap from, kept until taken. They skim a wall for GRAZE on ~4 in 10
barriers and smash most slate while lit. Movement is flicks between resting
spots through a damped spring (stiff near walls), not a sway. Long-form
uses "calm": the same brain at half the energy. `sim` prints per-round
coins, coins/s, missed coins, boosts, time lit, speed, grazes, smashes and
two smoothness numbers.

**Every rivalry at once:**

```
node ads/render.mjs batch --jobs 2 --seed 101
```

renders one round per pair in `ads/matchups.json` (34 rivalries: sport,
food and neighbour beef). The same file lists the pairs held back and why:
live wars, territorial disputes, recent violence. Change `--seed` for a
fresh set of rounds with different winners.

**Check the fail timing** without recording:

```
node ads/render.mjs sim --n 100
```

It prints when and who crashed for 100 seeds, and a summary: how many died
before the safe window (should be 0) and the left/right split (should be
close to even).

Last check (100 seeds, 2026-09-25): 0 crashes before 6 s; earliest 7.1 s,
median 11.4 s, 80% between 8.6 and 15.4 s, longest 20.5 s; left lost 41,
right 59 (within coin-flip noise); the side scheduled to slip lost 86 times,
and in the other 14 the other bot crashed by accident after the safe window.

`ads/sample-br-vs-ar-s1.mp4` is seed 1: Brazil crashes at 12.0 s.

## End cards

```
node ads/render.mjs endcards            # all variants
node ads/render.mjs endcards --only rematch
```

Writes `ads/endcards/<id>.mp4` (3.2 s, fades up from black, then a live
hold you can trim anywhere after 1.6 s) and `<id>-overlay.png` (the final
frame with a transparent background, for laying over your own footage).
Paste the MP4 after the round in your editor; the fade from black makes the
cut clean every time.

| id | Headline | Call to action | Why it might work |
|---|---|---|---|
| `who-next` | WHO'S NEXT? | COMMENT YOUR MATCHUP | Open question. The answer is a comment. |
| `your-country` | YOUR COUNTRY NEXT? | DROP YOUR FLAG BELOW | Identity: every viewer has a country. |
| `pick-two` | PICK THE NEXT MATCH | COMMENT TWO COUNTRIES | Control: the viewer books the next video. |
| `rematch` | REMATCH? | COMMENT "REMATCH" FOR ROUND 2 | For the losing side's fans; a one-word reply. |
| `survive` | CAN YOUR COUNTRY SURVIVE? | COMMENT YOUR FLAG | Challenge: pride plus doubt. |
| `you-pick` | YOU PICK. WE PLAY. | COMMENT THE NEXT MATCHUP | Promise: comments visibly become videos. |
| `settle-it` | SETTLE IT. | WHO SHOULD'VE WON? | Argument bait: every loser's fan has a reply. |
| `got-beef` | GOT BEEF? | COMMENT YOUR RIVAL | Names the feeling; the rival is one word. |
| `tag-rival` | TAG YOUR RIVAL | TAG A FRIEND FROM THERE | Tags pull in new viewers: reach, not just comments. |
| `best-of-3` | BEST OF THREE? | COMMENT "ROUND 2" | Series hook: promises a follow-up. |
| `rigged` | RIGGED? | COMMENT YOUR EXCUSE | Playful rage bait for the losing side. |
| `defend-flag` | DEFEND YOUR FLAG | COMMENT YOUR COUNTRY | Pride as a call to arms. |

Design rules the cards follow: one action only, stated as a verb; the
action is a comment, the cheapest thing a viewer can do; the text sits in
the platforms' safe zone (below the top bars, above the caption area, clear
of the right-hand button rail); the gold word carries the hook.

**Improving them over time.** The copy is a guess until the numbers say
otherwise. In the tracker's Matchups tab, log which end card each post used
along with its views and comments; the tab averages comments per 1,000
views per end card. Every two weeks: drop the worst card, keep the best, and
add one new line of copy to test against it. To add a variant, add an entry
to `VARIANTS` in `ads/endcard.html` and run `endcards --only <id>`.

## Honesty rule

These rounds are real gameplay played by bots, so label them as AI vs AI
(the hook line or the post caption). A paid ad must also show what the app
can do: ship Versus mode before running these as paid ads (see
`docs/MARKETING.md`, section 3).

## Long-form ambient videos

```
node ads/render.mjs longform --minutes 30 --seed 31
```

Writes `ads/out/zen-30min-s31.mp4`: 1920×1080, 30 fps, AAC stereo at
-18 LUFS. The game plays in a centre column over a looping space background
(`bg-loop.mp4`, rendered once and reused). Rendering takes about 1.3 minutes
per minute of video on this machine; run several with different `--port`
values in parallel.

**Zen mode** (what the long videos use): no scheduled crashes; difficulty
drifts between calm and a little busier over 5-minute swells; the bots pump
for a boost every 45–95 s so there's the occasional smash; if a bot slips
by accident the run restarts quietly after 1.6 s. No HUD.

**Soundtrack** (`ads/ambient.mjs`, original, generated, safe from copyright
claims): a slow pad cycling Dmaj9, Bm11, Gmaj9, A6add9 (20 s each with long
crossfades), a soft sub on the root, "space wind" (band-passed brown noise),
far-off bells every 5–13 s, and quiet sounds tied to what happens on screen:
a glassy tink per coin, a swell on boost, a muffled thump per smash. The mix
step normalises to -18 LUFS with peaks under -2 dBFS. It was checked by
loudness and spectrum, not by ear: listen to the first minute before
uploading.
