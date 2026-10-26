# Trip and Route → Outer Line: forever mode and readable gaps

*2026-10-26. From the studio session (repo `highwaylot/tripandroute`) to the Outer Line session (`games/outer-line/` in `highwaylot/tempname`). The site copy of the game now has both changes. They need to land in `game.html` and `page.html`, or the next `make.mjs` drop-in takes them back out.*

## What the founder asked for

- "outer line should have a forever mode"
- "the gaps should be more identifiable"

## The patch

`2026-10-26-outer-line-forever-and-gaps.patch` (next to this file) is a unified diff against v4's `game.html`. The site's `play.html` was byte-for-byte that file before the change, so it applies cleanly:

```
cd games/outer-line && patch game.html < 2026-10-26-outer-line-forever-and-gaps.patch
```

## Readable gaps

A hole used to be drawn as nothing on a near-black tunnel, so you couldn't see a drop coming. Hazard red is used for danger, a colour the tunnel doesn't otherwise use. Lime is the landing.

- **Before every jump-gap:** the last row is tinted red with a thick red lip along its far edge, all the way round the tunnel.
- **After the gap:** the landing row is tinted lime.
- **Single holes:** outlined in faint red, so they read as pits, not as nothing.
- **Edges next to a hole:** lit red. They're loudest on the floor you're riding and quieter up the walls, so hole-heavy spots don't turn into a wall of red.

`buildStation` now returns `gap[r]` (1 where a row is fully empty), from a new `markGaps(rows)`.

## Forever mode

- **Start:** a third button, **Forever** (cyan, `.btn.cyan`), on the spot screen.
- **The track:** endless, built 300 rows ahead whenever fewer than 180 are left (`buildForever(seed)`, `st.extend(n)`). The seed is random per run.
- **The ramp:** everything ramps with distance over `RAMP = 2400` rows (`foreverAt(r)`). It starts about as easy as Dockyard and ends meaner than Terminus.

  | | Start | End |
  |---|---|---|
  | Holes | 10% | 72% |
  | Safe path width | 3 | 1 |
  | Rows between gaps | 30 | 13 |
  | Gap length | 1 | 3 |
  | Base speed | 10 | 15.5 |

  The old-column `keep` rule uses the speed at each row, so stepping across is always possible.
- **The end:** one fall ends the run on a new end card, `foreverScreen`. It shows distance in metres, style, top speed, best combo and your best, with "new best" on the label. The best is saved as `outerline.forever = { m, style }`.
- **The HUD:** the progress bar races your best distance, and the label reads `FOREVER · BEST n M`.
- **Unlocks:** beanies still unlock in forever (`checkProgress` runs on the end card).
- **Starting from a link:** `?forever=1`, or `window.__OL_START = "forever"` from an embedding page.
- **Test hook:** it also exposes `playForever`, `buildForever` and `foreverAt`.

## The page

The site page has a **Forever** button next to Today's route. It starts the game with `play('forever')`, falling back to `play.html?forever=1`. It also needs `.btn.cyan` in the page CSS. Please add the same to `page.html`.

## Checked

- **The existing suite still passes:** `test.mjs` gives "all passed" against the patched file.
- **Forever is always survivable:** the same autopilot as `test.mjs`, which follows the guaranteed path and jumps at gaps, rode 20 random runs 4,000 rows deep each. That's past the end of the ramp and about 4.5 minutes of riding, through 194 jump-gaps per run up to 3 rows long. There were zero falls and no errors. A check like this belongs in `test.mjs`.
- **The site page:** Forever starts a forever ride inside the frame on a laptop and full screen on a phone, with no sideways scroll and no errors.
- **Not checked:** feel by hand. Is the ramp too slow or too fast? Is the red too loud on Glass Bridge and Comet Yard?
