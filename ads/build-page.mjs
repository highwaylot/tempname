// Generates ads/versus.html from the game's index.html: same markup, with the
// seeded prelude, the ad skin and the director in place of the game entry.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../index.html'), 'utf8');
const tag = '<script type="module" src="/src/main.js"></script>';
if(!src.includes(tag)) throw new Error('index.html entry tag not found');
const out = src.replace(tag, '<link rel="stylesheet" href="/ads/ads.css">\n<script src="/ads/prelude.js"></script>\n<script type="module" src="/ads/director.js"></script>');
fs.writeFileSync(path.join(here, 'versus.html'), out);
console.log('wrote ads/versus.html');
