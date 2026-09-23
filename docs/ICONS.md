# Bell Theory — store identity assets

Everything in `public/` that is an icon or a splash is **generated**. The source
of truth is `test/render-icons.mjs`; the SVGs and PNGs are its output. Edit the
script, not the files.

## Regenerate

```
npm run icons
```

(= `node test/render-icons.mjs`; needs the pinned Playwright + Chromium that are
already in `node_modules`. No ImageMagick, rsvg or sharp.) It rewrites every
file below in about two seconds. The buzz ticks are seeded, so the output is
byte-identical run to run.

## The mark

A full-height seam of teal light — the boost tank, one stroke from lit, with a
hot white tip and the gauge foot at the bottom safe edge — with the two thumbs'
orbs cut into its edges as notches: amber (#ffb454) bites the left edge, sky
(#5ec8ff) the right. The bar keeps running between the discs. Read as the name:
two separated systems, one channel.

Palette is the live game's, nothing new: stage #0b0d11, panel #1a1e26 (only as
a very faint vignette so the tile keeps an edge on a black wallpaper), ink
#eef0f4, teal #7dd3c0, amber, sky. Orbs are flat discs, as the player drags
them; their glow is a tight radial gradient standing in for the canvas
`shadowBlur`. No text, no fonts, no external references, no alpha.

Geometry (1024 space): safe area is the centre 820 (10 % margin), orbs r=160 at
cx=338/686, seam core 60 wide from y=136 to the foot at y=904. At 60 px the core
is 3.5 px and the sliver between the discs is about 2 px, which is what keeps
the silhouette "one bar, two notches" on a home screen.

## Files

| File | Size | Alpha | For |
|---|---|---|---|
| `public/icon.svg` | 1024 viewBox | – | Master. Also fine as the web favicon (`<link rel="icon" type="image/svg+xml">`). |
| `public/icon-1024.png` | 1024 | **none** (RGB) | App Store marketing icon and the single-size `AppIcon` Xcode 14+ uses. App Store Connect rejects any alpha channel here (ITMS-90717), so the script encodes RGB PNGs itself rather than screenshotting. |
| `public/icon-512.png` | 512 | none | Google Play listing icon (Play Console → Store listing). |
| `public/icon-180.png` | 180 | none | iOS @3x home screen for older asset catalogs; also `apple-touch-icon` for the web build. |
| `public/icon-120.png` | 120 | none | iOS @2x home screen. |
| `public/icon-android-fg-432.png` | 432 | yes | Android adaptive icon **foreground** layer at xxxhdpi (108 dp × 4). |
| `public/icon-android-bg-432.png` | 432 | none | Android adaptive icon **background** layer at xxxhdpi. |
| `public/splash.svg` | 2732 viewBox | – | Master splash. Mark at 30 % of the width, centred, stage background. |
| `public/splash-2732.png` | 2732 | none | Capacitor splash. |

## iOS

- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`: drop `icon-1024.png` in as
  the single "iOS 1024" slot (Xcode 14+ derives every size). Keep the
  `Contents.json` that `npx cap add ios` generated. If the catalog still lists
  individual sizes, `icon-180.png` and `icon-120.png` fill the @3x/@2x app
  slots; the rest can be generated from the 1024.
- iOS masks the tile with its own squircle and forbids alpha, which is why the
  master is opaque and square-cornered with a 10 % safe margin: nothing hard sits
  in the corners.
- Splash: `ios/App/App/Assets.xcassets/Splash.imageset/` in the Capacitor
  template takes three copies of a 2732 square (@1x/@2x/@3x, same file) and the
  launch storyboard scales it *aspect-fill* and centres it. The mark sits in the
  centre 30 % so every aspect ratio, including 9:21 portrait (which keeps only
  the centre 1171 px), shows the whole mark with room to spare. Set the
  storyboard / `SplashScreen` background to #0b0d11 so the crop edges match.

## Android

- **Play listing icon:** `icon-512.png`, uploaded in the Play Console. Play
  rounds the corners itself; the safe margin already accounts for it.
- **Launcher icon is adaptive** (API 26+): two layers on a 108 dp canvas, and the
  launcher masks the result to a circle, squircle, rounded square, etc. Only the
  centre **66 dp** (61 %) is guaranteed visible.
  - `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` (and
    `ic_launcher_round.xml`) reference the two layers:
    ```xml
    <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
      <background android:drawable="@mipmap/ic_launcher_background"/>
      <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    </adaptive-icon>
    ```
  - Foreground = `icon-android-fg-432.png` → `res/mipmap-xxxhdpi/ic_launcher_foreground.png`.
    Background = `icon-android-bg-432.png` → `res/mipmap-xxxhdpi/ic_launcher_background.png`.
    Other densities are the same images at 324 (xxhdpi), 216 (xhdpi), 162 (hdpi),
    108 (mdpi); add them to the `jobs` table in the script if you want them
    emitted rather than scaled by a tool.
  - Legacy `ic_launcher.png` (pre-26 launchers, and what some OEM launchers
    fall back to): `icon-1024.png` scaled to 192/144/96/72/48.
- **How the layers derive from `icon.svg`.** The script builds the tile as
  `stage()` + `mark()`:
  - *Background layer* = `stage()` alone: the #0b0d11 rect, the faint panel
    vignette and the horizontal field lines, scaled 1024 → 432. It must be
    opaque and edge-to-edge; the launcher will crop it.
  - *Foreground layer* = `mark()` alone on a transparent canvas, scaled so the
    mark's *hard* content (the orbs' outer edges, 654 wide, and the seam from
    tip to foot, 776 tall) fits inside the 66 dp safe circle: scale =
    264 / hypot(654, 776) ≈ 0.26, centred on the 216 px midpoint. The soft glows
    are allowed past the safe circle and get cropped by the mask.
  - Doing it by hand from `icon.svg`: delete the first three elements after
    `<defs>` (stage rect, vignette rect, field-lines path) for the foreground;
    keep only those three for the background; then apply the scale above to the
    foreground group.
- **Android 12+ system splash** ignores the splash image: it shows the launcher
  icon on `windowSplashScreenBackground`. Set that colour to #0b0d11 in
  `res/values/styles.xml` (and `android:windowSplashScreenAnimatedIcon` to the
  adaptive foreground if you want it larger). The 2732 image is used by the
  `@capacitor/splash-screen` plugin and older Android; it goes in
  `res/drawable/splash.png` (and per-density `drawable-*` variants if you want
  crisper scaling).

Optional: `@capacitor/assets` (not installed, needs a network install) can fan
these masters out into every density and catalog slot. It reads sources from an
`assets/` folder (`icon-only.png`, `icon-foreground.png`, `icon-background.png`,
`splash.png`, `splash-dark.png` — check its README for the current names) and
writes straight into `ios/` and `android/`. `icon-1024.png`, the two 432 layers
and `splash-2732.png` are exactly those sources.

## Changing the mark

All geometry and colour live at the top of `test/render-icons.mjs` as named
constants (`R`, `LX`, `CORE_W`, `FILL_TOP`, the palette). Every output — tile,
splash, both adaptive layers — is rendered from the same `mark()` function, so
one edit moves all of them. Check the result at 60 px on a light, a dark and a
pastel wallpaper before shipping; that is the size the icon actually lives at.
