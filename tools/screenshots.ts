import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { parseLevel } from '../src/engine/parse';
import type { Dir, Level, LevelFile } from '../src/engine/types';
import { solve } from '../src/solver/solve';

const DIR = 'src/levels';
const SHOTS_DIR = 'shots';

const KEY_MAP: Record<Dir, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const VIEWPORTS = [
  { name: 'landscape', width: 1280, height: 720 },
  { name: 'portrait', width: 720, height: 1280 },
] as const;

interface GameApi {
  loadLevel: (index: number) => void;
  state: () => { pos: [number, number] };
  press: (key: string) => boolean;
  idle: () => boolean;
}

// 1. Read and parse all levels, sorted numerically by id (chapter, then number).
const order = (id: string) => id.split('-').map(Number);
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const levels: Level[] = files
  .map((f) => parseLevel(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as LevelFile))
  .sort((a, b) => order(a.id)[0] - order(b.id)[0] || order(a.id)[1] - order(b.id)[1]);

// 2. Precompute solutions.
const solutions = levels.map((lv) => {
  const sol = solve(lv);
  if (!sol) console.log(`Level ${lv.id} has no solution, will skip solved screenshot.`);
  return sol;
});

// 3. Ensure output directory exists.
mkdirSync(SHOTS_DIR, { recursive: true });

// 4. Start Vite dev server and Playwright browser.
const server = await createServer({
  server: { port: 5199, strictPort: true },
  logLevel: 'error',
});
await server.listen();

let count = 0;
try {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto('http://localhost:5199/');
      await page.waitForFunction(() => !!(window as unknown as { __game?: GameApi }).__game);

      for (let i = 0; i < levels.length; i++) {
        const lv = levels[i];
        const sol = solutions[i];

        // Load level and verify start position.
        const state = await page.evaluate((idx) => {
          const g = (window as unknown as { __game: GameApi }).__game;
          g.loadLevel(idx);
          return g.state();
        }, i);

        if (JSON.stringify(state.pos) !== JSON.stringify(lv.start.pos)) {
          console.warn(`Warning: Level ${lv.id} pos mismatch. Expected ${JSON.stringify(lv.start.pos)}, got ${JSON.stringify(state.pos)}`);
        }

        // Wait two animation frames for the canvas to render.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const startPath = `${SHOTS_DIR}/${lv.id}-start-${vp.name}.png`;
        await page.screenshot({ path: startPath });
        console.log(`Wrote ${startPath}`);
        count++;

        // Press solution moves if solved.
        if (sol) {
          const keys = sol.path.map((d) => KEY_MAP[d]);
          await page.evaluate((ks) => {
            const g = (window as unknown as { __game: GameApi }).__game;
            for (const k of ks) g.press(k);
          }, keys);

          await page.waitForFunction(() => (window as unknown as { __game: GameApi }).__game.idle());
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          const solvedPath = `${SHOTS_DIR}/${lv.id}-solved-${vp.name}.png`;
          await page.screenshot({ path: solvedPath });
          console.log(`Wrote ${solvedPath}`);
          count++;
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}

console.log(`Finished: ${count} screenshots written.`);
