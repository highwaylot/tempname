# [GAME] → Trip and Route: marketing handoff (example, "daily run" scheme)

*Template example, 2026-10-24. Same structure as Bell Theory's handoff (`docs/HANDOFF-TRIPANDROUTE.md`), but for a different marketing scheme: one seeded run a day that everyone plays, ending on a share card. Everything in [brackets] is a placeholder to fill from the real game. The recipe for the page and folder is `docs/GAME-PAGE-PLAYBOOK.md`.*

**Before any of this applies, check that the game can do it.** This scheme needs:
- a seeded run (same seed → same level for everyone), plus a date → seed rule
- a result the game can state in one line ([time / score / distance])
- a share card the game draws itself

If the game can't do those yet, they are product work first. Marketing a daily run the game doesn't have breaks the same rule Bell Theory follows: the ad must match the game.

## 0. Links

| What | Where |
|---|---|
| Game page preview (live) | [artifact link once published] |
| Drop-in folder | `site-preview/[slug]/` (generated: `node site-preview/make.mjs`) |
| The game alone | [artifact or `play.html`] |
| Brand kit | [path: logo, icon, trailer source] |
| Decision log | [the game's `DECISIONS.md`] |

## 1. The game in one breath

**[GAME]**, a Trip and Route game. [One sentence: what you do, on what device, what ends a run.]

- **Tagline:** [≤ 6 words]
- **Daily line:** "One run a day. Same for everyone." (the scheme's promise; keep it literally true)
- **Short (≤ 80 chars):** [ ]
- **Medium:** [2–3 sentences]
- **Tags:** [genre, input, mood]
- **Status:** browser preview; [platforms] [status]
- **Rating notes:** [no chat / no accounts / what the preview stores, all on the device]

## 2. Why the daily scheme fits

1. **A reason to come back tomorrow without a streak.**
   - The run changes at midnight [local / UTC: decide], so there's always a new one.
   - No streak counter, no penalty for missing a day: missing it costs nothing, and coming back is the only pull.
   - Same stance as MOSTMATH: nothing ever goes down.
2. **Everyone plays the same thing.** Comparing with a friend needs no accounts and no leaderboard: the share card says it.
3. **One post a day writes itself.** Yesterday's hardest moment and today's teaser, cut from the real seeded runs.

## 3. The page (what changes from Bell Theory's)

The skeleton is the same (playbook §4). The differences:
- **Hero secondary button:** "Today's run" (jumps to the daily section) instead of "Country vs country".
- **Scheme section, "Today's run":**
  - the clip: a full daily run ending on the share card
  - a live line "Run #[N] · resets in [hh:mm]", computed in the page from the same date → seed rule as the game
  - copy: "One run a day, the same for everyone. Play it, then send your card."
  - honesty note if the clip is bot-played: "Played by a bot on [date]'s seed."
- **Play:** opens `play.html?daily=1`, today's seed.
  - Below the frame: "Practice run" opens a random seed so people can learn without spending the daily.
  - Decide whether the daily allows one attempt or best-of-many. One attempt is the Wordle model and makes the card mean something.
- **Share card:**
  - drawn by the game: the date, the run number, the result, and a tiny run map or emoji grid
  - no spoilers of the level
  - copied as text and saved as an image, through a button in the game, not the page
- **`game.json`:** `"scheme": "daily"`, plus `"daily": { "resetsAt": "00:00 [UTC]", "epoch": "[YYYY-MM-DD]", "attempts": 1 }` so the portal can show "Run #N" on the card.

**Checks:**
- everything in playbook §6
- the page's "Run #N" and the game's agree on the same date
- the seed for a fixed test date gives the same level twice
- the share text fits a single X/TikTok caption line

## 4. Content engine

| When | What | Length |
|---|---|---|
| Daily, after reset | "Run #N is up": 6–8 s teaser of today's first obstacle, no solution | 6–8 s |
| Daily, evening | Yesterday's hardest moment: the spot most runs fail, a bot or the founder clearing it | 12–20 s |
| Weekly | "The week in cards": the founder's five share cards side by side | 10 s |

- **Captions:** "Run #[N]. [The moment in five words]. What did you get?" plus the caption formula from Bell Theory's `docs/marketing/CAPTIONS.md` (hook, payoff, one question, 3–5 tags).
- **CTA everywhere:** "Play today's run, post your card." Never "beat my score" (that's the challenge-link scheme) and never a streak.
- **Rules carried over:** real footage only, bot play labelled, no paid ads until the game shown exists.
- **New rule:** never show the solution to today's run before the next reset; teasers only.

## 5. Decisions the founder owns

1. **Reset time and zone:**
   - UTC midnight is one global "today", but it lands mid-afternoon in the US.
   - Local midnight feels natural, but "Run #N" then differs by zone.
2. **Attempts per day:** one (the card means something), or best-of-many (friendlier).
3. **Archive:** whether past dailies are replayable. Fun, but it weakens "today".
4. **Practice mode:** in the preview, or app-only.
5. **What the card shows:** score only, or a spoiler-free picture of the run.
6. **Measurement:** with no analytics, daily return is invisible.
   - A cookieless counter of `daily=1` loads per date would answer "do people come back" without tracking anyone.
   - Decide before the first post.

## 6. Go-live checklist

- [ ] The game supports `?daily=1`, the date → seed rule, the share card (product work, before marketing)
- [ ] `node site-preview/make.mjs` with the daily clip as the scheme clip
- [ ] Page shows the right "Run #N" and reset countdown; matches the game
- [ ] Copy the folder to `/games/[slug]/`; make `og:image` absolute; add to the sitemap
- [ ] Phone test: the daily plays, the card copies and saves, Back returns to the page
- [ ] First post goes up right after the first reset, with the run number in the caption
