# Trip and Route game-page playbook

*2026-10-24. How the Bell Theory preview was made, written so any Trip and Route game can get the same treatment with its own marketing scheme. Reference build: `site-preview/` in `highwaylot/tempname` (branch `claude/bold-thompson-c3s6i5`). Worked example of a different scheme: `docs/HANDOFF-EXAMPLE-DAILY.md`.*

## 1. What every game ships to the site

One self-contained folder, dropped at `/games/<slug>/` with every path relative:

| File | What | Bell Theory's |
|---|---|---|
| `index.html` | the game page | `site-preview/page.html` |
| `play.html` | the game as ONE file (JS, CSS, fonts inlined) | `npm run build:single` → `dist/index.html`, 152 kB |
| `game.json` | the card data the portal grid reads (schema in §3) | written by `make.mjs` |
| `card-16x9.jpg` | grid card, 1280×720: a dimmed, blurred frame of real play behind the logo | ffmpeg from the hero clip |
| `og.jpg` | link preview, 1200×630, same recipe | ffmpeg |
| `icon-512.png`, `logo.png` | icon and wordmark | from the brand kit |
| `trailer.mp4` + `.webm` + `.jpg` | hero loop: 720×1280, muted, H.264 with a VP9 fallback and a poster | the launch reel |
| `<scheme>.mp4` + `.webm` + `.jpg` | the clip that sells the marketing scheme, with sound | Brazil v Argentina round |

Budget: under ~8 MB per game (Bell Theory: about 6 MB). Video is most of it; 720×1280 at CRF 25 is plenty for a phone frame.

## 2. The generator (`make.mjs`), step by step

Copy `site-preview/make.mjs` and change the source paths. It does, in order:
1. Build the game as one file and copy it to `play.html`.
2. Encode every clip twice: H.264 (`-crf 25 -preset slow -movflags +faststart`, audio AAC 128k or none) and VP9 (`-crf 36 -b:v 0`, Opus 96k). The WebM is a fallback for browsers and test builds without H.264.
3. Pull poster frames at a moment that reads without motion (mid-action, not a title card).
4. Make the card and link image: `scale → crop → gblur=6 → eq=brightness=-0.22` on a play frame, the logo overlaid at 72 % width.
5. Copy the page template; write `game.json`.
6. Print sizes, so a bloated asset is obvious.

The output folder is gitignored; the generator and template are committed. Re-run it whenever the game changes. That is how the audio fix reached the site.

## 3. `game.json` schema (what the portal grid reads)

```json
{
  "slug": "bell-theory", "title": "Bell Theory", "studio": "Trip and Route",
  "tagline": "Thread it, or wreck it.",
  "short": "≤ 80 chars, for the grid card",
  "description": "2–3 sentences, for the page and stores",
  "status": "preview | live | coming-soon",
  "platforms": { "web": "play.html", "ios": "coming soon", "android": "coming soon" },
  "controls": { "touch": "...", "mouse": "...", "keys": "..." },
  "orientation": "portrait | landscape", "aspect": "9:16",
  "tags": ["arcade", "runner"],
  "ageNote": "what the preview does and doesn't collect",
  "scheme": "rivalry | daily | challenge-link | ...",
  "assets": { "card": "card-16x9.jpg", "og": "og.jpg", "icon": "icon-512.png", "logo": "logo.png",
              "trailer": "trailer.mp4", "trailerWebm": "trailer.webm", "trailerPoster": "trailer.jpg",
              "clip": "match.mp4", "clipWebm": "match.webm", "clipPoster": "match.jpg" }
}
```

`scheme` is new since Bell Theory; add it so the portal can group games by how they're marketed.

## 4. The page, section by section

Keep the skeleton and swap the middle section for the scheme:
1. **Hero:**
   - studio credit and "Preview", logo, tagline as the H1, a 2–3 line pitch
   - primary "Play" button, then a secondary button that jumps to the scheme section
   - chips: free in browser, no account, platforms soon
   - beside it, a device frame looping the muted trailer with a Play button over it
2. **How it plays:** three cards, one verb each, one real number from the game's code under each (never invented).
3. **The scheme section:** the clip with sound and two short paragraphs, plus a one-line honesty note if the footage is bot-played or scripted.
4. **Controls:** one card per input (touch, mouse, keys) and what each actually does.
5. **Footer:** © studio and the data promise in plain words.

**Play behaviour** (keep it):
- **Wide screens:** the game runs inside the device frame, with a "Stop" link back to the trailer.
- **Phones:** the game opens over the page full screen with a Back bar.
- **Loading:** fetch `play.html` and inline it with `srcdoc`, falling back to `src`. Some hosts refuse to frame a URL but allow inline content.

Respect `prefers-reduced-motion`: no autoplay, controls shown.

Design: use the game's own palette and faces, one dark theme if the game is dark. Phone and desktop layouts must both be checked (§6).

## 5. Pick the scheme first; it changes four things

| Scheme | Fits a game that… | Scheme clip | Secondary button | Page CTA | Content engine |
|---|---|---|---|---|---|
| **Rivalry** (Bell Theory) | has two sides that can lose | country v country round | "Country vs country" | "Comment the next matchup" | daily matchup, comments pick next |
| **Daily** (example handoff) | can be seeded so everyone plays the same run | today's run, ending on the share card | "Today's run" | "Play today's, compare with friends" | one post a day: yesterday's hardest moment + today's teaser |
| **Challenge link** | has a score or time worth beating | a near-miss then a beaten target | "Beat this" | "Send this run to a friend" | duets/stitches of attempts on the same link |
| **Satisfying loop** | looks great with no context | 10–20 s of pure flow, no UI | "Watch" | "Play it yourself" | faceless loops, long-form ambient |
| **Devlog** | is still changing week to week | before/after of one change | "What's new" | "Follow the build" | weekly 30 s devlog, polls on the next feature |

What stays the same in every scheme:
- the hero, the Play behaviour, How it plays, Controls, the assets list, the checks and the honesty rules
- no faked footage
- no rivalries between countries in conflict
- no team logos in paid ads
- label bot play

## 6. Checks before handing it over

Serve the folder over HTTP (`python3 -m http.server`) and run Playwright at 1280×860 and 390×844 (touch):

| Check | How |
|---|---|
| Images load | every `img.complete && naturalWidth > 0` |
| No sideways scroll | `scrollWidth <= innerWidth` |
| The game boots inside the frame | the child frame has its own boot marker (Bell Theory: `window.BellTheory.phase`) |
| Desktop plays inline, phone opens the overlay | the frame or overlay is visible after Play |
| Clips play | `readyState 4`, `currentTime` advancing |
| No page errors | none in the console |

Note honestly what this environment can't check:
- H.264 playback (this test Chromium has none, so it reads the WebM)
- Google Fonts (proxy)
- a real phone

Look at one screenshot per layout before publishing. The Bell Theory pass caught a collapsed device frame (a percentage width in an `auto` grid column; give the frame an explicit width).

## 7. Handing it over

1. Publish the page as an artifact with its files so the founder can see it live.
2. Zip the folder for the studio session; it replaces `/games/<slug>/` wholesale.
3. Write the handoff (template: `docs/HANDOFF-TRIPANDROUTE.md`, scheme example: `docs/HANDOFF-EXAMPLE-DAILY.md`):
   - links, copy at three lengths, why it's marketable
   - the page spec, how to drop it in, the content engine and its rules
   - decisions still open, a go-live checklist
4. Log it in the game's `DECISIONS.md`.
