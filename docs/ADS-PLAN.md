# Ads plan (bookmarked 2026-09-24, not built)

The monetization model changes from "free + one $4.99 unlock" to a hybrid of
rewarded ads, occasional interstitials, and a "remove ads" purchase. Nothing
in this file is implemented yet. It lists what to build and what to rewrite
when the founder says go.

## The model

1. **Rewarded video, opt-in.** One offer on the crash card per death, for
   example "watch to double this run's coins" or "start the next run with a
   full tank". The player chooses it; nothing is withheld if they skip it.
2. **Interstitial, capped.** At most one full-screen ad every 3–4 crashes,
   none in the first few runs of a session and none in the first session.
   Never mid-run, never on the title screen.
3. **Remove ads, $2.99.** One non-consumable purchase. It removes
   interstitials; rewarded offers stay available because they are opt-in.

**No banners.** Nothing is on screen during play. The founder's rule is
"no ads on display 24/7", and a banner would also sit where the HUD and the
gauge are.

## Open decision (founder)

**Personalized or non-personalized ads.** Everything under "Privacy" below
depends on it.

- **Personalized:** higher pay per ad. iPhone players see Apple's "Allow
  this app to track you?" popup. The privacy label says the app tracks.
- **Non-personalized only:** no tracking popup, and the label does not say
  "used to track you". Pay per ad is lower. The label still lists the data
  the ad SDK collects to serve and measure ads.

## Code to change

- `src/native.js`: the unlock gate (`ent`, `FREE_RUNS 15`) stops limiting
  runs. `unlocked` becomes the "ads removed" flag; `purchase()`/`restore()`
  keep their shape. The run counter stays for the interstitial cap.
- New ad module wrapping `@capacitor-community/admob` (AdMob to start;
  AppLovin MAX or Unity LevelPlay mediation later, once traffic is real).
  Web build and the artifact get a no-op stub: no ads on the web.
- Crash card: the gate rows (`#deadGate`, `#readyGate`) become the rewarded
  offer and a "remove ads" button.
- Consent: Google's User Messaging Platform (UMP) consent form for EEA/UK
  players before the first ad request; the ATT prompt on iOS only if
  personalized ads are chosen.
- Audio: pause the game's soundbed while an ad plays and resume it after.
- Harness: stub the ad plugin so the perf gate is unchanged.

## Documents to rewrite

Every one of these currently promises no ads, no tracking, no third-party
code, or no network requests.

- `docs/privacy.html`: sections 1–4 (summary, "no ads / no third-party
  SDKs", "no network requests"). Add what Google's SDK collects, the
  consent choice, and links to Google's policy.
- `docs/STORE.md`: intro (lines ~10–11), description (lines ~67–69, and
  the Play copy ~205–210), App Privacy answers (1.9, currently "Data Not
  Collected"), Play Data safety form (2.5), privacy manifest table (3),
  in-app purchase line in the age rating (1.8).
- `docs/PrivacyInfo.xcprivacy`: our own manifest can stay "no tracking" for
  our code; Google's SDK ships its own manifest, and the App Store label is
  the union of both.
- `docs/jev-decision-spec.md`: question 8 now has an answer (free + ads +
  remove-ads). Questions 3 and 15 are superseded.
- `ios/App/App/Info.plist`: `GADApplicationIdentifier`,
  `SKAdNetworkItems`, and `NSUserTrackingUsageDescription` if personalized.
- Android manifest: the AdMob app ID meta-data.

## What does not change

- Scores and settings still live only on the device. No accounts.
- The game itself makes no network requests. The ad SDK does, and only in
  the store builds.
- The reward stance in DECISIONS.md: no losable wagers, no return timers,
  and no reward taken away for skipping an ad.
