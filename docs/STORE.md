# Bell Theory — store listing copy and submission facts

Source of truth for what the game is: `docs/DECISIONS.md`. This file is the
copy that goes into App Store Connect and Google Play Console, with every
character-limited field counted (counts verified by `test/store-counts.mjs`,
which reads this file; run `node test/store-counts.mjs`). Tone rules used
throughout: plain, specific, no hype adjectives, no exclamation marks.

Facts the copy relies on and must not contradict: no accounts, no ads, no
analytics, no third-party SDKs, no network calls during play; settings and
scores live on the device; free download with one $4.99 unlock and no
consumables; bundle id `com.belltheory.game`; website `https://belltheory.TLD`
(the founder owns the `belltheory` domain; the TLD is not known to the author
of this file and is written as `TLD` wherever it appears — replace it once,
everywhere, before anything ships).

Three things in the current prototype are not yet consistent with those facts
and must be fixed in the wrapped build before the copy and the privacy policy
are true. They are listed under **Pre-ship prerequisites** at the end.

---

## 1. App Store Connect

### 1.1 Name (30 max) — 11 chars

```
name: Bell Theory
```

### 1.2 Subtitle (30 max) — 22 chars

```
subtitle: Thread it, or wreck it
```

### 1.3 Promotional text (170 max, editable without a new build) — 142 chars

```
promo: One lane per thumb. Thread the gaps, or pump the tank and smash through. Plays one-handed too. No ads, no accounts, nothing leaves your phone.
```

### 1.4 Description (4000 max) — 2799 chars

```
description-begin
Two lanes scroll toward you. Your left thumb drives the left one, your right thumb the right. Barriers come down with a gap in each lane, and the gaps do not line up for long. You hold both, watch both, and steer both at once. The difficulty is not in the hitboxes. It is in your own hands, which do not want to do two different things at the same time.

Thread a gap cleanly and the pass pays. Thread it dead center and it pays more. Clear a wall by a hair and you get a graze bonus. Passes chain into a combo that raises the multiplier as long as you keep it alive.

Or wreck it. Pump both thumbs up and down and a tank on the seam between the lanes fills. At 100 it ignites: you go faster, coins pull toward you, and barriers break on you instead of the other way around. Every smash refills part of the tank, so a good run of smashing keeps you lit. Wrecks chain too, and a chain can end in a storm that clears the whole screen.

Boost has a catch. Some barriers are steel. They look different, they warn you as they come into range, and they still kill you when you are lit. The longer you stay lit, the more of them appear, so a boosted run still asks you to thread.

Coins are gold. Now and then one is blue, worth 25, and sits just off the safe line. Rarely one is purple, worth 100, and sits a little further off. You hear them before you see them.

The sound is not a track. It is a bed of tones and filtered noise that responds to the run: it tightens as the difficulty rises and warms as the tank fills and the boost lands. Coins, passes, grazes and smashes each have their own sound, and on a phone the impacts are tuned so you feel them through the case.

Two ways to play, chosen on the title screen:

Two thumbs. One orb per lane, the screen split down the middle. This is the game as designed.

One thumb. One wide lane, one orb, any touch drives it. Same pump, same boost, same steel, same coins, tighter gaps. It works with one hand on a phone, and it is the mode a mouse plays.

Settings you can change: sound and volume, the impact level of hits, trail length and glow, orb follow speed, the lane grid, spectrum bars, haptic buzz, and the colour or picture on each orb. Your best distance is kept. Everything is stored on the device.

No ads. No accounts. No tracking. The game makes no network requests while you play, contains no analytics and no third-party code, and does not ask who you are.

The first 15 runs are free and complete. One purchase of $4.99 unlocks unlimited runs. There is nothing else to buy, no currency, no consumables, no timers, and no way to spend more.

The name is from Bell's theorem: two separated systems whose outcomes are correlated beyond what either side produces alone. The two thumbs are the pair. The seam between the lanes is the channel.
description-end
```

### 1.5 Keywords (100 max; comma-separated, no spaces after commas, no word that appears in the name) — 98 chars

```
keywords: runner,endless,arcade,reflex,dodge,thumbs,coordination,ambidextrous,offline,minimal,boost,one,hand
```

Words deliberately not used: "bell", "theory" (in the name, Apple already
indexes them); "game", "app", "free" (Apple advises against); competitor
names (rejected under 2.3.7).

### 1.6 What's New in This Version (1.0)

```
whatsnew-begin
First release.

Two-thumb and one-thumb modes. Pump to fill the boost tank, smash through slate, thread past steel. Rare blue and purple coins. A soundbed that follows the run. Haptics on iPhone. No ads, no accounts, no tracking.
whatsnew-end
```

### 1.7 Category

- Primary: **Games**, subcategories **Arcade** and **Action** (App Store Connect
  asks for two game subcategories when Games is primary).
- Secondary: none. A secondary category buys little for a game and
  Entertainment is the only honest candidate. Leave it empty.

### 1.8 Age rating questionnaire

Expected result: **4+**. Answers, in the order App Store Connect asks them
(Apple reworded this questionnaire in 2025; the wording below follows the
current labels, and any question not listed is answered "None" / "No"):

| Question | Answer | Why |
|---|---|---|
| Cartoon or Fantasy Violence | None | Abstract orbs and rectangles. Barriers break into pieces; nothing is a creature or a person. |
| Realistic Violence | None | |
| Prolonged Graphic or Sadistic Realistic Violence | None | |
| Profanity or Crude Humor | None | On-screen text is CLEAN, GRAZE, SURGE, SMASH, CRUNCH, WRECKED, STEEL, crashed. |
| Mature/Suggestive Themes | None | |
| Horror/Fear Themes | None | |
| Medical/Treatment Information | None | |
| Alcohol, Tobacco, or Drug Use or References | None | |
| Sexual Content or Nudity | None | |
| Graphic Sexual Content and Nudity | None | |
| Simulated Gambling | None | Rewards vary in magnitude, never in whether they arrive; there are no wagers, no chance-based purchases, no loot boxes. |
| Contests | No | |
| Gambling (real money) | No | |
| Unrestricted Web Access | No | No web view to external content; the app is the game. |
| Messaging and Chat / User-Generated Content | No | The orb picture a player can choose is local to their device and shown to no one else. |
| Advertising | No | |
| Loot boxes / random purchases | No | |
| Parental controls | No | |
| In-app purchases | Yes | One non-consumable unlock. Does not affect the rating. |
| Made for Kids | No | Do not enrol in the Kids category; it adds review obligations and the game is for anyone. |

### 1.9 App Privacy ("nutrition label")

Answer: **Data Not Collected.**

How to answer the questionnaire: to "Do you or your third-party partners
collect any data from this app?" answer **No**. Apple's definition of
"collect" is data transmitted off the device. Bell Theory transmits nothing:

- Settings, the taught-pump flag and best distance are written with Capacitor
  Preferences (UserDefaults on iOS) and stay on the device.
- An optional orb picture chosen from the photo library is downscaled to a
  160 px JPEG on the device and stored with the settings. It is never uploaded.
- There is no analytics SDK, crash reporter, ad SDK or attribution SDK.
- The $4.99 unlock is processed by StoreKit. Apple handles the transaction
  under Apple's own privacy policy; the app receives a purchase state, not a
  person. This does not count as collection by the developer.
- The privacy manifest (`PrivacyInfo.xcprivacy`, section 3) declares the same
  thing in machine-readable form and must agree with this answer.

Privacy policy URL (required field): `https://belltheory.TLD/privacy.html`
(publish `docs/privacy.html` there after filling its placeholders).

### 1.10 Screenshot plan

Capture at native resolution from a real device or the simulator with the
status bar hidden (the app hides it via `@capacitor/status-bar`). One image per
moment, the game frame full-bleed, a single caption line set in IBM Plex Mono
on the `#0b0d11` field above the top bar, tracked wide like the title. No
device frames, no marketing panels; the game already has the palette.

Sizes: 6.7" (1290 × 2796) and 6.1" (1179 × 2556), portrait. App Store Connect
has shifted its required set between 6.5", 6.7" and 6.9" in successive years;
check the required sizes on the day of upload and capture the 6.9" set
(1320 × 2868) as well if it is listed, since it can then be scaled for the
smaller slots.

Order matters: the first two are what most people see. One-thumb leads
(DECISIONS.md: both modes are first-class, one-thumb first in screenshots).

| # | In-game moment to capture | Caption (5–8 words) |
|---|---|---|
| 1 | One-thumb mode, mid-run, the orb just clearing a gap with the CLEAN +3 label and teal ring visible, combo ×2 in the top bar. | Thread the gap. Keep the combo. |
| 2 | Two-thumb mode, mid-run, both orbs in different lane positions with independent gaps above them; mirror ghost faintly visible. | Left thumb, right thumb, both lanes. |
| 3 | Boost lit: gold-rimmed barrier breaking into debris, SMASH ×3 label, seam column bright, gauge reading LIT. | Pump the tank. Smash through. |
| 4 | Steel barrier in range while lit: crimson hatched body with the red pulsing rim, gauge still LIT, orb steering for the gap. | Steel does not break. Thread it. |
| 5 | A purple coin on screen with its glint, just off the gap line, the orb angling toward it; a blue coin lower on the other side if possible. | Rare coins sit off the safe line. |
| 6 | Title screen: BELL THEORY, tagline, breathing dashed rings on both orbs, the TWO THUMBS / ONE THUMB picker. | Two modes. No ads. No accounts. |

Optional seventh for the 6.7" set only: the death screen with a big distance
number and the open-loop line under it, captioned "One hit. Instant restart."

App preview video: skip for 1.0. Reviewers do not require it, and a 15–30 s
capture of shot 3 can be added later without a new build.

---

## 2. Google Play

### 2.1 Title (30 max) — 11 chars

```
play-title: Bell Theory
```

### 2.2 Short description (80 max) — 76 chars

```
play-short: A two-thumb endless runner. Thread the gap or wreck it. No ads, no accounts.
```

### 2.3 Full description (4000 max) — 2799 chars after substitution

Use the App Store description (1.4) verbatim, with one substitution: replace
the paragraph beginning "The download is free" with the version below, because
Play requires the price to be stated in the store's currency and "$4.99" may
be localised by Play's pricing template.

```
play-full-substitute-begin
The first 15 runs are free and complete. One purchase unlocks unlimited runs. There is nothing else to buy, no currency, no consumables, no timers, and no way to spend more.
play-full-substitute-end
```

Play also permits a small amount of formatting; do not use it. Plain
paragraphs match the tone and survive every client.

### 2.4 Content rating (IARC questionnaire)

Expected result: **Everyone** (ESRB), **PEGI 3**, **USK 0**, and the
equivalent lowest tier elsewhere. Answers:

- Category: Game.
- Violence: none. No depiction of people, animals or creatures being harmed.
  Abstract shapes break apart.
- Fear, horror: none.
- Sexual content, nudity: none.
- Language: none.
- Controlled substances: none.
- Gambling: none. No simulated gambling, no chance-based items.
- Crude humour: none.
- Digital purchases: **Yes**, one in-app product (non-consumable). This is
  disclosed but does not raise the rating.
- User interaction: **No**. Users cannot interact with each other or share
  content, and there is no user location sharing.
- Personal information: the app does not share personal information.
- Advertising: none.

### 2.5 Data safety form

- Does your app collect or share any of the required user data types? **No.**
- Is all of the user data collected by your app encrypted in transit? Not
  applicable (nothing is transmitted).
- Do you provide a way for users to request that their data is deleted?
  Uninstalling deletes everything; state this in the "data deletion" free text
  if the form offers one.
- Privacy policy URL: `https://belltheory.TLD/privacy.html`.

### 2.6 Other Play Console fields

- App category: Game → **Arcade**. Tags: Arcade, Action, Casual, Offline.
- Target audience: 13+ or "Everyone but not designed for children". Do not
  opt into the Designed for Families programme.
- Ads declaration: "No, my app does not contain ads."
- Government apps, financial features, health: No.
- Feature graphic (1024 × 500): the entangled icon's two orbs and seam on the
  `#0b0d11` field with BELL THEORY set in IBM Plex Mono rendered to paths;
  build it from `public/icon-entangled.svg` geometry rather than a new design.
- Screenshots: reuse the six from 1.10 at 1080 × 2340 (or any 9:19.5 export
  of the same captures; Play accepts 16:9 to 9:16 and above with a 320–3840 px
  bound, and phone screenshots must be at least 1080 px on the short side).

---

## 3. Privacy manifest (iOS)

File: `docs/PrivacyInfo.xcprivacy`. After `npx cap add ios`, copy it to
**`ios/App/App/PrivacyInfo.xcprivacy`** and, in Xcode, add it to the **App**
target's membership (Build Phases → Copy Bundle Resources must list it; drag it
into the `App` group with "Add to targets: App" checked and Xcode does this).
Xcode 15+ validates it on archive; an App Store upload without it is rejected
once the app links any API in Apple's "required reason" list, and Capacitor
Preferences uses UserDefaults, which is on that list.

Contents and why:

| Key | Value | Reason |
|---|---|---|
| `NSPrivacyTracking` | `false` | No tracking as defined by ATT. |
| `NSPrivacyTrackingDomains` | `[]` | No tracking, so no domains. |
| `NSPrivacyCollectedDataTypes` | `[]` | Matches "Data Not Collected" in 1.9. |
| `NSPrivacyAccessedAPITypes` | one entry: `NSPrivacyAccessedAPICategoryUserDefaults`, reason **`CA92.1`** | Capacitor Preferences reads and writes UserDefaults. CA92.1 is "access info from same app, per documentation" — the app reads only what it wrote. |

If a Capacitor plugin added later ships its own manifest (most official
`@capacitor/*` plugins do), Xcode merges them; the App-level manifest still
has to declare UserDefaults because the app's own preferences use is not
covered by a plugin's declaration.

If the StoreKit integration uses a plugin that talks to a third-party server
(RevenueCat, for example), the "Data Not Collected" answer, the tracking-domain
list and the privacy policy all change. See the open questions.

---

## 4. Pre-ship prerequisites (the copy is only true once these are done)

1. **Bundle the fonts.** *Done (W03): Sora and IBM Plex Mono ship as woff2 files
   under `src/fonts/` with `@font-face`, pinned by sha256 in `test/fonts-check.mjs`;
   the harness with every non-local request aborted shows 0 network requests.*
   `prototype/bell-theory.html` lines 2–4 load Sora and
   IBM Plex Mono from `fonts.googleapis.com` and `fonts.gstatic.com` at page
   load. In a wrapped app that is a network request (and Google receives the
   device IP) before the first frame, which contradicts "no network requests"
   in the description, the Data safety form and the privacy policy. Ship the
   `.woff2` files inside the bundle with `@font-face` (both fonts are OFL) or
   fall back to system fonts, and remove the three `<link>` tags. Then run the
   harness with network disabled to prove it.
2. **Photo picker usage string.** *Done in part (W27): `NSPhotoLibraryUsageDescription`
   is in `ios/App/App/Info.plist` and the input carries `accept="image/*"`;
   the camera string is not added — check on a device whether the sheet still
   offers "Take Photo" and add `NSCameraUsageDescription` if it does.* The orb picture chooser is
   `<input type="file">`, which on iOS opens the system photo picker from the
   WebView. Add `NSPhotoLibraryUsageDescription` (and
   `NSCameraUsageDescription`, since the sheet offers "Take Photo") to
   `ios/App/App/Info.plist` with text such as "Choose a picture for your orb.
   It stays on this phone." Without the strings the picker can crash the app
   at review. Alternatively remove the camera option by restricting the
   accept attribute; the library string is still needed.
3. **Persistence swap.** *Done (W30): `@capacitor/preferences` holds the durable
   copy, localStorage is the synchronous cache.* `localStorage` → Capacitor Preferences, per
   DECISIONS.md, so that the WebView's storage is not purged by the OS under
   pressure and the best score survives. The privacy answers already assume
   Preferences.
4. **Bundle id and version.** `com.belltheory.game`, version `1.0.0`, build
   `1`, in `capacitor.config` and both native projects.
