# Ad tools: AI vs AI rounds and end cards

Nothing in this folder ships in the app. It drives the real game engine to
make vertical ad clips. One-time setup is `npm install`; everything below
runs from the repo root.

## AI vs AI rounds

```
node ads/render.mjs versus --left br --right ar --seed 7
```

That records one round to `ads/out/br-vs-ar-s7.mp4`: 1080×1920, 30 fps,
H.264, **no sound** (add sound in the edit). Each side is a bot playing one
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

**Check the fail timing** without recording:

```
node ads/render.mjs sim --n 100
```

It prints when and who crashed for 100 seeds, and a summary: how many died
before the safe window (should be 0) and the left/right split (should be
close to even).

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
