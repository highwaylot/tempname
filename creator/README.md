# Creator page

The real game, played by hand, dressed for short videos. Live copy:
https://claude.ai/artifact/VDEreKKB5QuBCD8XMCNmxE (private until you share it).

```
npm run creator:dev     # dev server on :5174, open /creator/
npm run creator:build   # one self-contained file: dist-creator/creator/index.html
npm run creator:test    # phone-sized Playwright checks with two simulated thumbs
```

Republish the artifact from `dist-creator/creator/index.html` after a build.

**What it does**
- **Match**: any two of 271 flags (MIT `flag-icons`, inlined) or your own teams.
  Round types: *first crash loses* (the lane that hits a wall loses) and *coin
  race* (15/20/30 s, most coins wins, a crash loses on the spot, a tie at the
  buzzer goes to sudden death: next coin wins).
- **On screen**: flags and names, a coin counter per side that pops on every
  coin, a lead bar that swings to whoever has more coins, the clock, a hook
  line for the first 2 s, an optional tag ("Day 3 · Part 5"), then the result
  card, a "who's next?" card and the buttons. Everything sits below TikTok's
  top tabs and above its caption block.
- **Start**: both thumbs down starts the run with the world held for 3-2-1, so
  you can start the screen recording first and trim it later.
- **Cup**: 8 or 16 entrants (pick them, or fill randomly from 58 football
  nations), pairs in picked order, single elimination with either round type.
  Tags read "Day N · Part N · Quarterfinal"; Part moves on after each match,
  a new day starts at Part 1. "Show bracket" is a clean screen to record.
- **Teams**: name, two colours and an optional image (cropped to a 256 px
  square). Uploaded logos are the user's call; keep them out of paid ads.

Saved on the phone (localStorage, key `bt.creator.v1`): teams, the last
match setup, the cup. Nothing here ships in the app. The only engine change
is `game.coinsBy`, a per-lane coin count.

**Full screen on iPhone.** Inside the Claude app the page sits under the
app's header, and iPhone Safari can't make a page full screen. Host the one
file at a normal web address instead (e.g. Netlify Drop: drag a folder that
holds `index.html`; claim the site with a free account within an hour or it
is deleted), open that address in Safari, Share → Add to Home Screen, and
open it from the icon: no browser bars, the page reads the
`apple-mobile-web-app-capable` tag. Anyone with that address can open the
page.

On iPhone: turn on Do Not Disturb before recording. If a clip comes out
silent, flip the ring/silent switch.
