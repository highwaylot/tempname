// Verifies the character-limited fields in docs/STORE.md against the store
// limits. Run: node test/store-counts.mjs   (exit 1 on any violation)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, "..", "docs", "STORE.md"), "utf8");

const line = (key) => {
  const m = md.match(new RegExp(`^${key}: (.*)$`, "m"));
  if (!m) throw new Error(`field not found: ${key}`);
  return m[1];
};
const block = (key) => {
  const m = md.match(new RegExp(`${key}-begin\\n([\\s\\S]*?)\\n${key}-end`));
  if (!m) throw new Error(`block not found: ${key}`);
  return m[1];
};

const description = block("description");
const fields = [
  ["App Store name", line("name"), 30],
  ["App Store subtitle", line("subtitle"), 30],
  ["App Store promotional text", line("promo"), 170],
  ["App Store description", description, 4000],
  ["App Store keywords", line("keywords"), 100],
  ["App Store what's new", block("whatsnew"), 4000],
  ["Play title", line("play-title"), 30],
  ["Play short description", line("play-short"), 80],
  ["Play full description", description.replace(
      /The download is free[^\n]*/,
      block("play-full-substitute")), 4000],
];

let ok = true;
for (const [label, text, limit] of fields) {
  const n = [...text].length;
  const pass = n <= limit;
  ok &&= pass;
  console.log(`${pass ? "ok  " : "FAIL"} ${label.padEnd(28)} ${String(n).padStart(4)} / ${limit}`);
}

// Tone: no exclamation marks anywhere in copy fields.
for (const [label, text] of fields) {
  if (text.includes("!")) { ok = false; console.log(`FAIL ${label}: exclamation mark`); }
}

// Keywords: no spaces after commas, no repeats, no word from the name.
const kw = line("keywords");
const nameWords = new Set(line("name").toLowerCase().split(/\s+/));
if (/,\s/.test(kw)) { ok = false; console.log("FAIL keywords: space after comma"); }
const parts = kw.split(",");
const seen = new Set();
for (const p of parts) {
  if (seen.has(p)) { ok = false; console.log(`FAIL keywords: repeat "${p}"`); }
  seen.add(p);
  if (nameWords.has(p.toLowerCase())) { ok = false; console.log(`FAIL keywords: "${p}" is in the name`); }
}

// Screenshot captions: 5–8 words.
const rows = md.match(/^\| [1-6] \|.*\|$/gm) || [];
for (const r of rows) {
  const cap = r.split("|").map((s) => s.trim()).filter(Boolean).at(-1);
  const w = cap.split(/\s+/).length;
  const pass = w >= 5 && w <= 8;
  ok &&= pass;
  console.log(`${pass ? "ok  " : "FAIL"} caption ${w} words: ${cap}`);
}

process.exit(ok ? 0 : 1);
