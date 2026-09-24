# Bell Theory marketing plan: DRAFT

Status: draft, opened 2026-09-24. The plan is "done" when every section below
is marked **locked** in the tracker and the open decisions are answered. The
tracker (claude.ai artifact) is the live copy; this file is the repo copy.

## 1. The idea: country vs country

The two orbs already take any colour or image. Dress one as a flag, the other
as a rival flag, and every run becomes a match: **whichever side hits a wall
first loses.** The game already knows which side crashed; the ad only has to
say it.

- Left lane 🇧🇷, right lane 🇦🇷. Caption on frame one: "Brazil vs Argentina. Who hits the wall first?"
- 8–15 seconds of real play. The crash is the punchline.
- End card: "🇦🇷 wins. Comment the next matchup."
- The comments pick the next video. That is the content engine: the audience
  writes the calendar, and national pride makes people comment.

## 2. Why it fits

- **It's the game's real mechanic.** Two lanes, two orbs, one crash decides
  it. Nothing is faked for the ad.
- **The hook is readable with the sound off in one second.** Two flags and a
  "vs" need no explanation. Short-form ads live or die in the first 1–3 seconds.
- **It turns viewers into participants.** "Comment your country" is a reason
  to comment, and comments push organic reach.
- **It's cheap to make.** The game can be driven by a script and screen-recorded,
  so one matchup is minutes of work, not a shoot.

## 3. Rules and risks

- **The ad must match the app.** TikTok bans ads that mislead about the
  product. If the ad shows "🇦🇷 WINS", the app needs flag skins and a
  winner card. Plan: build a real Versus mode before any paid ad runs
  (section 5).
- **Rivalries yes, conflicts no.** Sports rivalries (Brazil–Argentina,
  USA–Mexico, England–Germany) are the goldmine. Never pair countries in an
  active war or territorial dispute. Meta rejects ads that exploit crises or
  controversial events, and it would be a bad look anyway. Keep a banned
  list in the tracker.
- **Flag artwork.** Use a permissively licensed SVG flag set, not emoji
  (emoji flags render differently on every phone and not at all on Windows).
- **Real footage.** Script-driven runs are real engine footage. Never edit a
  result the game didn't produce.

## 4. Ad spec

- 9:16 vertical, 1080×1920, captions burned in, readable muted.
- Hook in the first second: both flags and "vs" on screen before anything moves.
- Length: 8–15 s for prospecting. Test one 6–8 s cut and one 15–20 s cut against it.
- Variants per matchup: the clean-thread finish, the boost-wreck finish,
  the near miss, the purple-coin moment.
- End card 1.5 s: winner, the game name, "comment the next matchup".

## 5. Product work the plan needs

Bookmarked, not built:

- **Versus mode.** Pick two flags, play, and the side that crashes loses; a
  result card names the winner.
- **Two players, one phone.** Each person takes one lane. The two-thumb mode
  already reads two separate touches, so this is mostly a mode switch and a
  result card. It makes "who hits the wall first" literally true between friends.
- **Flag pack.** ~50 flags to start: the most-played markets plus the big
  sports rivals.
- **Clip capture.** A script that plays a matchup and records a vertical clip,
  so each video is minutes of work.
- **Analytics.** Needed to measure D1 at all (see the soft-launch plan);
  rewrite the privacy docs together with the ads change.

## 6. Phases

| Phase | What | Cost | Done when |
|---|---|---|---|
| 0. Build | Versus mode, flag pack, clip capture, analytics, Android build | $25 Play account | A matchup clip can be produced from the real app |
| 1. Organic | Post 1 matchup a day on TikTok, Reels and Shorts for 3–4 weeks | $0 | 20+ posts; the top 3 by watch time and comments are known |
| 2. Paid test | Soft launch in 1–2 countries; run the top organic clips as ads | $200–500 | 500+ installs; CPI, CTR and D1 measured |
| 3. Decide | Pitch publishers, keep and scale, or fix the first session and retest | — | A decision logged in DECISIONS.md |

## 7. What we measure

| Stage | Metric | Target |
|---|---|---|
| Organic | Average watch time, comments per 1,000 views, follows | Set after the first 10 posts; no reliable benchmark for this format |
| Paid | Click-through rate, installs per 1,000 impressions, cost per install | CPI under $0.40 (publisher bar, US Android) |
| Product | Day-1 retention | 35%+ (publisher bar) |
| Product | Day-7 retention | ~10%+ |

## 8. Open decisions

1. Versus as a real in-game mode, or flag skins only?
2. Ship two-players-one-phone at launch or after?
3. Mode name.
4. First soft-launch country.
5. First 10 matchups and the banned list.
6. Who posts, and is there a face and voice (creator style) or pure gameplay?
7. Paid test budget cap.
8. Analytics tool.
9. Personalized or non-personalized ads (carried from the ads plan).

## 9. Jev

`docs/marketing/jev-questions.json` is the Questions box and
`docs/marketing/jev-state.json` the State box for the Playground;
`docs/marketing/jev-request.json` is the full API request. Paste the answer
into the tracker's Jev tab. Choice and Score answers with confidence under
0.5 count as inconclusive.
