// Pins the self-hosted font files (src/fonts/, W03) to the sha256 of the
// exact latin woff2 files fonts.gstatic.com served for the Google Fonts
// request the page used to make (Sora:wght@400;600;700 -> one variable
// file; IBM+Plex+Mono:wght@400;500), fetched with an iPhone Safari UA on
// 2026-09-23. A swapped or re-subsetted file changes text metrics, so this
// fails loudly instead of letting the title screen drift.
//
//   npm run fonts:check      exit 0 when every file matches, 1 otherwise
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/fonts');
const PINNED = {
  'sora-latin-wght.woff2': { bytes: 25240, sha256: '3902474d3ece89c8580d5ef3325cf58753e6e45a86f9957b4dacc4fce2e7fde1' },
  'ibm-plex-mono-latin-400.woff2': { bytes: 10052, sha256: 'c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac' },
  'ibm-plex-mono-latin-500.woff2': { bytes: 10060, sha256: 'a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0' },
};

let bad = 0;
for (const [name, want] of Object.entries(PINNED)) {
  const file = path.join(dir, name);
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) { console.log(`FAIL ${name}: ${e.message}`); bad++; continue; }
  const sha = createHash('sha256').update(buf).digest('hex');
  const ok = sha === want.sha256 && buf.length === want.bytes;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${buf.length} B ${sha}${ok ? '' : ` (want ${want.bytes} B ${want.sha256})`}`);
  if (!ok) bad++;
}
if (!fs.existsSync(path.join(dir, 'OFL.txt'))) { console.log('FAIL OFL.txt missing'); bad++; }
console.log(bad ? `fonts-check: ${bad} problem(s)` : 'fonts-check: all pinned files match');
process.exit(bad ? 1 : 0);
