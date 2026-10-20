// npm run trace -- 3-1: prints the optimal solution as boards, one per move (level design aid).
import { readFileSync } from 'node:fs';
import { parseLevel } from '../src/engine/parse';
import { light, tick } from '../src/engine/tick';
import type { LevelFile, State, W } from '../src/engine/types';
import { solve } from '../src/solver/solve';

const lv = parseLevel(JSON.parse(readFileSync(`src/levels/${process.argv[2]}.json`, 'utf8')) as LevelFile);
const draw = (s: State) => {
  const lit = light(lv, s), rows: string[] = [];
  for (let y = 0; y < lv.h; y++) {
    rows.push(([0, 1] as W[]).map((w) => [...Array(lv.w)].map((_, x) => {
      const i = y * lv.w + x;
      if (s.pos[w] === i) return w ? 'L' : 'S';
      if (s.objs[w][i] !== ' ') return s.objs[w][i];
      const c = s.tiles[w][i];
      return c === '.' && lit[w][i] ? (lit[w][i] > 0 ? "'" : ':') : c;
    }).join('')).join('   '));
  }
  return rows.join('\n');
};
const sol = solve(lv);
if (!sol) { console.log('UNSOLVABLE'); process.exit(1); }
let s = lv.start;
console.log(`start  (par ${sol.path.length})\n${draw(s)}`);
sol.path.forEach((d, n) => { s = tick(lv, s, d); console.log(`\n${n + 1} ${d}\n${draw(s)}`); });
