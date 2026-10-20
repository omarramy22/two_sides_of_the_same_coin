// npm run verify-levels: RULES.md §10. Writes `par` back into each level file.
// `npm run verify-levels -- 1-3` checks one level and prints its solution.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isGate, isPlate, parseLevel } from '../src/engine/parse';
import { isWon, tick } from '../src/engine/tick';
import { DIRS, type Dir, type Level, type LevelFile, type Role } from '../src/engine/types';
import { solve } from '../src/solver/solve';

const DIR = 'src/levels';
const MASH_RATE: Record<Role, number> = { introduce: 1, develop: 0.1, twist: 0.01, combine: 0.01, capstone: 0.01, finale: 0.01 };
const ARROW: Record<Dir, string> = { up: 'U', down: 'D', left: 'L', right: 'R' };

/** One variant per interactive element, with that element replaced by floor (§10.2). */
function ablations(f: LevelFile): { label: string; file: LevelFile }[] {
  const grids = [f.heads.join(''), f.tails.join('')];
  const w = f.heads[0].length;
  const build = (g: string[]): LevelFile => ({
    ...f, heads: g[0].match(new RegExp(`.{${w}}`, 'g'))!, tails: g[1].match(new RegExp(`.{${w}}`, 'g'))!,
  });
  const at = (i: number) => `${i % w},${Math.floor(i / w)}`;
  const out: { label: string; file: LevelFile }[] = [];
  const letters = new Set<string>();
  grids.forEach((g, wi) => [...g].forEach((c, i) => {
    const name = wi ? 'T' : 'H';
    // shortcut: basins aren't ablated (a region would have to go as a pair); add if a level hides a decorative basin.
    if ('C^@?*=-&0%OQM'.includes(c)) {
      const v = [...grids]; v[wi] = g.slice(0, i) + (c === '0' ? '_' : '.') + g.slice(i + 1);
      out.push({ label: `${{ C: 'crate', '^': 'pit', '@': 'tarnish', '?': 'sleeper', '*': 'lantern', '=': 'mirage', '-': 'shadow bridge', '&': 'sluice', '0': 'crate', '%': 'cracked', O: 'weight altar', Q: 'light altar', M: 'mirror shrine' }[c]} ${name}(${at(i)})`, file: build(v) });
    } else if (c === '|') {
      const v = grids.map((x) => x.slice(0, i) + '.' + x.slice(i + 1));
      out.push({ label: `seesaw (${at(i)})`, file: build(v) });
    } else if (isGate(c)) {
      let v = [...grids]; v[wi] = g.slice(0, i) + '.' + g.slice(i + 1);
      if (!v.join('').includes(c)) v = v.map((x) => x.replaceAll(c.toLowerCase(), '.')); // last gate: plates go too
      out.push({ label: `gate ${c} ${name}(${at(i)})`, file: build(v) });
    } else if (isPlate(c)) letters.add(c);
  }));
  for (const l of letters) {
    // No plate means the link is never active: owner-world gates stay shut, the others stay open.
    const owner = grids[0].includes(l) ? 0 : 1;
    const v = grids.map((g, wi) => g.replaceAll(l, '.').replaceAll(l.toUpperCase(), wi === owner ? '#' : '.'));
    out.push({ label: `plates ${l}`, file: build(v) });
  }
  return out;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mashRate(lv: Level, walks = 2000, len = 300): number {
  const rnd = mulberry32([...lv.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  let wins = 0;
  for (let n = 0; n < walks; n++) {
    let s = lv.start;
    for (let m = 0; m < len && !s.fallen[0] && !s.fallen[1]; m++) {
      s = tick(lv, s, DIRS[Math.floor(rnd() * 4)]);
      if (isWon(s)) { wins++; break; }
    }
  }
  return wins / walks;
}

function desyncs(lv: Level, path: Dir[]): number {
  let s = lv.start, n = 0;
  for (const d of path) {
    const t = tick(lv, s, d);
    if ((t.pos[0] !== s.pos[0]) !== (t.pos[1] !== s.pos[1])) n++;
    s = t;
  }
  return n;
}

const only = process.argv[2];
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && (!only || f === `${only}.json`))
  .sort((a, b) => {
    const [ca, na] = a.split(/[-.]/).map(Number), [cb, nb] = b.split(/[-.]/).map(Number);
    return ca - cb || na - nb;
  });

let failed = false;
const rows: string[][] = [['level', 'role', 'par', 'states', 'desync', 'optimal', 'mash%', 'result']];
for (const file of files) {
  const path = `${DIR}/${file}`;
  const raw = readFileSync(path, 'utf8');
  const f = JSON.parse(raw) as LevelFile;
  const problems: string[] = [];
  let lv: Level;
  try { lv = parseLevel(f); } catch (e) {
    console.log(`✗ ${file}: ${(e as Error).message}`);
    failed = true;
    continue;
  }
  const sol = solve(lv);
  if (!sol) {
    console.log(`✗ ${lv.id}: UNSOLVABLE`);
    failed = true;
    continue;
  }
  const par = sol.path.length;
  if (only) console.log(`${lv.id} solution (${par}): ${sol.path.map((d) => ARROW[d]).join('')}`);

  for (const a of ablations(f)) {
    const alt = solve(parseLevel(a.file));
    if (alt && alt.path.length === par) problems.push(`decorative: ${a.label}`);
    else if (only) console.log(`  ${a.label}: ${alt ? `par ${alt.path.length}` : 'unsolvable'}`);
  }
  const mash = mashRate(lv);
  if (mash > MASH_RATE[lv.role]) problems.push(`mashable: ${(mash * 100).toFixed(1)}% random walks solve it`);

  rows.push([lv.id, lv.role, String(par), String(sol.explored), String(desyncs(lv, sol.path)),
    sol.optimalCount >= 1000 ? '1000+' : String(sol.optimalCount), (mash * 100).toFixed(1), problems.length ? 'FAIL' : 'ok']);
  for (const p of problems) console.log(`✗ ${lv.id}: ${p}`);
  failed ||= problems.length > 0;

  if (f.par !== par) {
    const updated = 'par' in f
      ? raw.replace(/"par":\s*\d+/, `"par": ${par}`)
      : raw.replace(/("role":\s*"[a-z]+",)/, `$1\n  "par": ${par},`);
    writeFileSync(path, updated);
  }
}

const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
let chapter = '';
for (const r of rows) {
  const ch = r[0].split('-')[0];
  if (r !== rows[0] && ch !== chapter) console.log(`-- chapter ${ch}`);
  chapter = r === rows[0] ? '' : ch;
  console.log(r.map((v, c) => v.padEnd(widths[c])).join('  '));
}
process.exit(failed ? 1 : 0);
