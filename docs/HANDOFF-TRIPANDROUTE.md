# Bell Theory → Trip and Route: marketing handoff

*2026-10-23. For the Trip and Route studio session that runs the games site and its marketing. Written from the Bell Theory repo (`highwaylot/tempname`, branch `claude/bold-thompson-c3s6i5`). Everything named here is in that repo or in the founder's artifacts.*

## 0. Links

| What | Where |
|---|---|
| **Game page preview (live)** | https://claude.ai/artifact/QG8iaVpwvcgSEApEcL4JPC |
| Drop-in folder for the site | `site-preview/bell-theory/` (generated: `node site-preview/make.mjs`; template `site-preview/page.html`) |
| The game alone | https://claude.ai/artifact/CWf9vb1oyPNrheKD119Fh5 (same build as `play.html`) |
| Creator page (hand-played country rounds for video) | https://claude.ai/artifact/VDEreKKB5QuBCD8XMCNmxE, guide in `creator/README.md` |
| Marketing plan, draft | `docs/MARKETING.md`; tracker https://claude.ai/artifact/TxC51nh2rMTsHaJyvJXa5r |
| Caption formula | `docs/marketing/CAPTIONS.md` |
| Brand kit | `ads/brand/` (logos, launch post, story, reel, logo reveal, long-form thumbnails) |
| AI vs AI rivalry rounds and end cards | `ads/out/*.mp4` (regenerate with `node ads/render.mjs batch`), `ads/endcards/` |
| Decision log | `docs/DECISIONS.md` |

The artifacts are private to the founder's account; a session signed in as the founder can read them with the Artifact tool. Artifact links can't be shared publicly as the site, so the folder is what goes live.

## 1. The game in one breath

**Bell Theory**, a Trip and Route game. A two-thumb runner: each thumb drives its own orb down its own lane. Thread the gaps, take the coins, pump to charge the tank, then light up and smash through. One wall ends the run.

- **Tagline:** Thread it, or wreck it.
- **Hook lines (from the launch reel):** "Can your brain split in two?" · "Thread it. Or wreck it." · "Now it's country vs country."
- **Short (≤ 80 chars):** A two-thumb runner: one orb per thumb, one wall ends it.
- **Medium:** Two lanes, two orbs, one thumb on each. Slip through the gaps, grab the coins, pump to charge the tank, then light up and smash straight through. One wall ends the run.
- **Genre tags:** arcade, runner, reflex, two-thumb, rhythm.
- **Status:** browser preview now; iOS and Android in development (Capacitor 8 builds exist, not yet on the stores).
- **Rating notes:** no violence beyond walls shattering, no chat, no accounts, no ads or tracking in the preview. Progress stays on the device.

## 2. What makes it marketable

1. **Split attention is the hook.** Two thumbs, two lanes, two problems at once. It reads in one second and is hard in a way people want to prove they can handle.
2. **Every run is a match.** Put a flag on each orb and whichever side touches a wall loses. Country vs country, comment the next matchup. The audience writes the content calendar (`docs/MARKETING.md` §1).
3. **Constant payoff.** Coin dings, CLEAN/GRAZE/SURGE labels, smash chains, the WRECKED storm, and a techno bed on the creator page that drops on GO. Short clips have something happening every second.

## 3. The preview page (what's live)

Sections, top to bottom:
1. **Hero:** studio credit, logo, the tagline, a 3-line pitch, "Play the preview", and chips (free in your browser, no account, iOS and Android soon). Beside it, a phone frame loops the muted trailer with a Play button.
2. **How it plays:** Thread, Pump, Wreck, each with one real number from the game (combo +1× every 5 clean passes; both thumbs charge 1.8× faster; boost 1.85× speed, 4–6 smashes set off WRECKED).
3. **Country vs country:** the Brazil v Argentina round with game audio, labelled "AI vs AI round, played on the real game engine."
4. **Controls:** phone (two thumbs) and computer (one lane, mouse).
5. **Footer:** © Trip and Route, "No ads, no tracking. Progress stays on this device."

**Play behaviour:**
- **Wide screens:** the game runs inside the phone frame, with a "Stop and show the trailer" link under it.
- **Phones:** it opens full screen over the page, with a Back bar.
- **Default lanes:** a touch screen defaults to two thumbs and a mouse to one lane.
- **Loading:** the game is one 152 kB file (`play.html`). The page loads it into a frame by reading it and inlining it, and falls back to `src` if the host refuses.

**Checked (Playwright, 1280×860 and 390×844 touch):**
- images load and nothing scrolls sideways
- the game boots inside the frame in both layouts, and the phone overlay opens
- both clips play from their WebM copies

Not checked here:
- H.264 playback (this test Chromium has no H.264; real Chrome, Safari and Firefox do)
- Google Fonts (blocked by this environment's proxy)
- a real phone

**Putting it on the site:**
- Copy the whole folder to `/games/bell-theory/`. Every path in it is relative.
- The portal's grid card reads `game.json`: title, copy, tags, controls, status and asset names.
- The card image is `card-16x9.jpg` (1280×720) and the link preview is `og.jpg` (1200×630). `og:image` is relative: make it absolute once the domain is known.
- To embed the game elsewhere: `<iframe src="/games/bell-theory/play.html" title="Bell Theory" allow="autoplay; fullscreen" style="aspect-ratio:9/16;width:360px;border:0"></iframe>`.

## 4. Content engine and rules

- **Daily posts:** one country-vs-country round a day on TikTok, Reels and Shorts, 8–15 s, hook in the first second, end card "comment the next matchup" (`docs/MARKETING.md` §4–6, `docs/marketing/CAPTIONS.md`).
- **Two ways to make rounds:**
  - Bot rounds, rendered with sound: `node ads/render.mjs versus --left br --right ar --seed N`, or `batch` for all 34 rivalries in `ads/matchups.json`. Label them AI vs AI.
  - Hand-played rounds on the creator page, iPhone screen recording. These need no AI label.
- **Rules that stay:**
  - Sports rivalries only, never countries in an active conflict.
  - No team logos in anything paid; team names and colours are fine organically.
  - Never edit a result the game didn't produce.
  - Paid ads wait until the app shown in them exists.
- **Long-form:** 10, 20 and 30-minute ambient "zen" videos with an original soundtrack exist for YouTube (`node ads/render.mjs longform`). They still use the older bot motion; re-render them before posting.

## 5. Decisions the studio and founder still own

1. **Preview vs app.** The preview is the full game, free. That's right before launch. Once the app ships with ads and a $2.99 remove-ads purchase (`docs/ADS-PLAN.md`), the free web copy competes with it: cap it (e.g. 15 runs, the `ent` gate already supports a run limit), or keep it full as the funnel.
2. **Ads on the site.** The preview page promises no ads and no tracking. Keep that if the site leans school-friendly; a site aimed at kids under 13 also brings COPPA limits on ads and data.
3. **Portals.** Poki asks for web exclusivity on games it publishes ([Poki docs](https://sdk.poki.com/index.html)), which conflicts with self-hosting Bell Theory. CrazyGames is the non-exclusive test ([CrazyGames docs](https://docs.crazygames.com/faq/)).
4. **Measurement.** The preview has no analytics, so plays, completions and shares are invisible. Decide whether the site gets privacy-respecting counts (server logs, or a cookieless counter) before any marketing push needs numbers.
5. **Handles and domain.** "belltheory" is secured on at least one platform (the founder confirmed it was available). Check the rest, and decide whether social accounts are per game or one Trip and Route account.
6. **Name collision.** Tripandroute is also the name of one of the founder's game design documents. Decide whether that game becomes the studio's namesake flagship or gets its own name.

## 6. Go-live checklist

- [ ] Regenerate the folder from the current game: `node site-preview/make.mjs`
- [ ] Copy `site-preview/bell-theory/` to the site at `/games/bell-theory/`
- [ ] Make `og:image` absolute; add the page to the sitemap
- [ ] Open it on an iPhone and an Android phone: trailer autoplays muted, Play opens full screen, sound starts on first touch (iPhone ring switch off)
- [ ] Add the grid card from `game.json`
- [ ] Post the launch post/story/reel from `ads/brand/` with the caption formula; the bio links to the game page
