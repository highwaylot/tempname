// Summarises harness report JSON files (stdout captures) side by side:
// per-file frame p50/p95/over33 and prof draw p50/p95, plus the median across
// the files of each group. usage: node test/harness-summary.mjs label=a.txt,b.txt label2=c.txt
import fs from 'node:fs';
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const r2 = (x) => Math.round(x * 100) / 100;
for (const arg of process.argv.slice(2)) {
  const [label, list] = arg.split('=');
  const rows = [];
  for (const f of list.split(',')) {
    const t = fs.readFileSync(f, 'utf8');
    const end = t.lastIndexOf('\n}');
    const j = JSON.parse(t.slice(t.indexOf('{'), end + 2));
    const runs = j.runs && j.runs.length ? j.runs : [j];
    for (const r of runs) rows.push({ f, p50: r.fps.p50ms, p95: r.fps.p95ms, over33: r.fps.over33pct, draw50: r.prof ? r.prof.draw.p50ms : null, draw95: r.prof ? r.prof.draw.p95ms : null, total95: r.prof ? r.prof.total.p95ms : null, errors: j.errors.length, deaths: r.deaths, maxDist: r.maxDist });
  }
  for (const r of rows) console.log(label, JSON.stringify(r));
  const k = (key) => r2(med(rows.map((r) => r[key]).filter((v) => v != null)));
  console.log(label, 'MEDIAN of', rows.length, 'runs: frame p50', k('p50'), 'p95', k('p95'), 'over33%', k('over33'), '| draw p50', k('draw50'), 'draw p95', k('draw95'), 'total p95', k('total95'), '| errors', rows.reduce((s, r) => s + r.errors, 0));
}
