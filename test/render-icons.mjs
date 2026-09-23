// Store identity for Bell Theory: builds store-assets/icon.svg and store-assets/splash.svg
// from one mark, then rasterizes them with Playwright's Chromium.
//
//   npm run icons        (= node test/render-icons.mjs)
//
// Outputs (all in store-assets/; kept out of public/ because Vite copies
// public/ into every bundle and this is ~750 kB of store art):
//   icon.svg                 the mark on its tile, 1024 viewBox, opaque, no fonts
//   splash.svg               2732x2732, mark centred at 30% width, stage background
//   icon-1024.png            App Store marketing icon — RGB, NO alpha channel
//   icon-512.png             Google Play listing icon
//   icon-180.png             iOS @3x home screen
//   icon-120.png             iOS @2x home screen
//   icon-android-fg-432.png  Android adaptive icon foreground layer (RGBA, transparent)
//   icon-android-bg-432.png  Android adaptive icon background layer (opaque)
//   splash-2732.png          Capacitor splash (portrait/landscape safe)
//
// PNGs are encoded here, not screenshotted: Chromium screenshots are always RGBA
// and App Store Connect rejects a 1024 icon that carries an alpha channel
// (ITMS-90717), even a fully opaque one. Pixels come from a <canvas> in the page;
// the file is written by the small encoder at the bottom of this module.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = (p) => resolve(root, "store-assets", p);

// ---- palette (live game; do not invent) ----
export const STAGE = "#0b0d11", PANEL = "#1a1e26", INK = "#eef0f4", TEAL = "#7dd3c0";
export const AMBER = "#ffb454", SKY = "#5ec8ff";

// ---- geometry, in the 1024 icon space ----
// The safe area is the centre 820 (10% margin) so iOS's squircle and Android's
// masks never clip a hard edge.
export const S = 1024, MARGIN = 102;
export const CY = 512, R = 160;            // orb radius (was 128: fills the safe area)
export const LX = 338, RX = S - LX;        // orb centres bite ~16 units into the seam's edges,
                                           // leaving a 28-unit sliver of core between them (≈2px at 60px)
export const SEAM_X = 512;
export const CORE_W = 60;                  // seam core: ~6% of the tile, 3.5px at 60px
export const FILL_TOP = 136;               // hot tip near the top safe edge
export const FILL_BASE = S - MARGIN - 18;  // gauge foot on the bottom safe edge

// Seeded PRNG so the buzz arcs are identical on every build.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Static buzz: the game's per-frame jittering radial ticks, frozen. Kept out of
// the seam so the bar's silhouette stays clean. They are identity at 1024 and
// vanish harmlessly below ~120px.
function buzz(cx, cy, color, seed) {
  const rnd = mulberry32(seed);
  let d = "";
  for (let i = 0; i < 18; i++) {
    // evenly spaced around the orb with jitter, so the ticks never clump
    const a = (i / 18) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
    const r0 = R + 16 + rnd() * 16;
    const len = 12 + rnd() * 36;
    const ex = cx + Math.cos(a) * (r0 + len);
    if (Math.abs(ex - SEAM_X) < CORE_W / 2 + 40) continue;
    const j = (rnd() - 0.5) * 0.35;
    const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
    const x2 = cx + Math.cos(a + j) * (r0 + len), y2 = cy + Math.sin(a + j) * (r0 + len);
    d += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity="0.55" fill="none"/>`;
}

// Faint horizontal field lines: the dark stage motif, near-invisible.
function fieldLines(w, h, step = 64) {
  let d = "";
  for (let y = step; y < h; y += step) d += `M0 ${y}H${w}`;
  return `<path d="${d}" stroke="${INK}" stroke-width="2" opacity="0.06"/>`;
}

// Gradient defs shared by every output. `p` prefixes ids so two marks can share
// one document (the splash embeds the icon's defs once).
export function markDefs(p = "") {
  return `
    <!-- seam: faint channel (unfilled), teal halo, bright core with a hot tip -->
    <linearGradient id="${p}chan" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${INK}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${INK}" stop-opacity="0.10"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${p}halo" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${TEAL}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${TEAL}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${TEAL}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${p}core" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${INK}"/>
      <stop offset="0.09" stop-color="${TEAL}"/>
      <stop offset="1" stop-color="${TEAL}"/>
    </linearGradient>
    <radialGradient id="${p}tip" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${INK}" stop-opacity="0.95"/>
      <stop offset="0.3" stop-color="${TEAL}" stop-opacity="0.6"/>
      <stop offset="1" stop-color="${TEAL}" stop-opacity="0"/>
    </radialGradient>
    <!-- orb glows: the game's shadowBlur as radial gradients, kept tight so the
         discs stay hard-edged at 60px -->
    <radialGradient id="${p}glowL" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${AMBER}" stop-opacity="0.35"/>
      <stop offset="0.55" stop-color="${AMBER}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${AMBER}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${p}glowR" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${SKY}" stop-opacity="0.35"/>
      <stop offset="0.55" stop-color="${SKY}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${SKY}" stop-opacity="0"/>
    </radialGradient>`;
}

// The mark itself, in 1024 space, with no background: a full-height seam of
// light (the boost tank, nearly lit) with the two thumbs' orbs cut into its
// edges as notches. Flat discs, as the player drags them in the game.
export function mark(p = "") {
  const fillH = FILL_BASE - FILL_TOP;
  return `
  <!-- orb glows sit under the seam so the channel reads as in front of the light -->
  <circle cx="${LX}" cy="${CY}" r="190" fill="url(#${p}glowL)"/>
  <circle cx="${RX}" cy="${CY}" r="190" fill="url(#${p}glowR)"/>

  <!-- the seam: full-height channel, halo, core, hot tip, gauge foot -->
  <rect x="${SEAM_X - 60}" y="0" width="120" height="${S}" fill="url(#${p}chan)"/>
  <rect x="${SEAM_X - 90}" y="${FILL_TOP}" width="180" height="${fillH}" fill="url(#${p}halo)"/>
  <rect x="${SEAM_X - CORE_W / 2}" y="${FILL_TOP}" width="${CORE_W}" height="${fillH}" rx="${CORE_W / 2}" fill="url(#${p}core)"/>
  <ellipse cx="${SEAM_X}" cy="${FILL_TOP + 8}" rx="170" ry="120" fill="url(#${p}tip)"/>
  <rect x="${SEAM_X - 64}" y="${FILL_BASE - 8}" width="128" height="16" rx="8" fill="${TEAL}"/>
  <rect x="${SEAM_X - 120}" y="${FILL_BASE - 3}" width="240" height="6" rx="3" fill="${TEAL}" opacity="0.28"/>

  <!-- the entangled pair: buzz, then flat discs over the bar's edges -->
  ${buzz(LX, CY, AMBER, 7)}
  ${buzz(RX, CY, SKY, 11)}
  <circle cx="${LX}" cy="${CY}" r="${R}" fill="${AMBER}"/>
  <circle cx="${RX}" cy="${CY}" r="${R}" fill="${SKY}"/>`;
}

// The stage under the mark: opaque (iOS forbids alpha), a very subtle
// panel→stage vignette so the tile keeps an edge on a black wallpaper, and the
// field lines.
export function stage() {
  return `
  <rect width="${S}" height="${S}" fill="${STAGE}"/>
  <rect width="${S}" height="${S}" fill="url(#vig)"/>
  ${fieldLines(S, S)}`;
}
const vigDef = `
    <radialGradient id="vig" cx="0.5" cy="0.46" r="0.62">
      <stop offset="0" stop-color="${PANEL}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${PANEL}" stop-opacity="0"/>
    </radialGradient>`;

export function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>${vigDef}${markDefs()}
  </defs>
${stage()}
${mark()}
</svg>
`;
}

// Splash: 2732 square so Capacitor can centre-crop it to any aspect ratio.
// The mark is 30% of the width, so it survives a 9:21 portrait crop (which
// keeps only the centre 1171px) with room to spare.
export const SPLASH = 2732;
export function splashSvg() {
  const k = (SPLASH * 0.30) / S;
  const t = (SPLASH - S * k) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPLASH} ${SPLASH}" width="${SPLASH}" height="${SPLASH}">
  <defs>${markDefs()}
  </defs>
  <rect width="${SPLASH}" height="${SPLASH}" fill="${STAGE}"/>
  ${fieldLines(SPLASH, SPLASH, 64)}
  <g transform="translate(${t.toFixed(2)} ${t.toFixed(2)}) scale(${k.toFixed(5)})">
${mark()}
  </g>
</svg>
`;
}

// Android adaptive icon layers (108dp canvas, drawn at xxxhdpi = 432px).
// The launcher masks the outer ring, so the mark's hard content is fitted to
// the 66dp safe circle (264px); the glows may spill past it and get cropped.
export const ADAPTIVE = 432;
export function adaptiveForegroundSvg() {
  // hard content extents in 1024 space: orbs 185..839 wide, seam 136..912 tall
  const w = RX + R - (LX - R), h = FILL_BASE + 6 - FILL_TOP;
  const k = 264 / Math.hypot(w, h);
  const c = ADAPTIVE / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ADAPTIVE} ${ADAPTIVE}" width="${ADAPTIVE}" height="${ADAPTIVE}">
  <defs>${markDefs()}
  </defs>
  <g transform="translate(${c} ${c}) scale(${k.toFixed(5)}) translate(-${SEAM_X} -${CY})">
${mark()}
  </g>
</svg>
`;
}
export function adaptiveBackgroundSvg() {
  const k = ADAPTIVE / S;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ADAPTIVE} ${ADAPTIVE}" width="${ADAPTIVE}" height="${ADAPTIVE}">
  <defs>${vigDef}
  </defs>
  <g transform="scale(${k.toFixed(5)})">
${stage()}
  </g>
</svg>
`;
}

// ---- rasterizing ----
// Draw an SVG string into a canvas of the target size inside Chromium and
// return the raw pixels. Every gradient in the mark is rendered by Skia, the
// same engine that draws the game's canvas.
export async function rasterize(page, svg, size, { alpha }) {
  const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  const b64 = await page.evaluate(async ({ dataUrl, size, alpha }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d", { alpha: true });
    ctx.drawImage(img, 0, 0, size, size);
    const src = ctx.getImageData(0, 0, size, size).data;
    const bpp = alpha ? 4 : 3;
    const bytes = new Uint8Array(size * size * bpp);
    for (let i = 0, j = 0; i < src.length; i += 4, j += bpp) {
      bytes[j] = src[i]; bytes[j + 1] = src[i + 1]; bytes[j + 2] = src[i + 2];
      if (alpha) bytes[j + 3] = src[i + 3];
    }
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(s);
  }, { dataUrl, size, alpha });
  return encodePng(Buffer.from(b64, "base64"), size, size, alpha);
}

// Minimal PNG writer: 8-bit RGB (colour type 2) or RGBA (6), filter 0, no interlace.
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(pixels, w, h, alpha) {
  const bpp = alpha ? 4 : 3, stride = w * bpp;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function main() {
  mkdirSync(out(""), { recursive: true });
  const icon = iconSvg(), splash = splashSvg();
  const fg = adaptiveForegroundSvg(), bg = adaptiveBackgroundSvg();
  writeFileSync(out("icon.svg"), icon);
  writeFileSync(out("splash.svg"), splash);
  console.log("wrote icon.svg, splash.svg");

  const jobs = [
    ["icon-1024.png", icon, 1024, false],
    ["icon-512.png", icon, 512, false],
    ["icon-180.png", icon, 180, false],
    ["icon-120.png", icon, 120, false],
    ["icon-android-fg-432.png", fg, ADAPTIVE, true],
    ["icon-android-bg-432.png", bg, ADAPTIVE, false],
    ["splash-2732.png", splash, SPLASH, false],
  ];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:${STAGE}"></body></html>`);
  for (const [name, svg, size, alpha] of jobs) {
    const png = await rasterize(page, svg, size, { alpha });
    writeFileSync(out(name), png);
    console.log(`wrote ${name}  ${size}x${size} ${alpha ? "RGBA" : "RGB"}  ${png.length} bytes`);
  }
  await browser.close();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
