// npm run story-shots: frames of the intro, one vignette and the ending -> shots/story/ (for review).
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
  await page.goto('http://localhost:5198/?shots');
  await page.waitForFunction(() => !!(window as unknown as { __game?: unknown }).__game);
  const runs: [string, object, number[]][] = [
    ['intro', { kind: 'intro' }, [3, 6.5, 8, 9, 12, 16, 22, 30, 33, 35, 37, 39]],
    ['vignette3', { kind: 'vignette', chapter: 3 }, [2, 5.5, 10]],
    ['ending', { kind: 'ending' }, [3, 7, 9.5, 11, 14, 17, 20, 23, 27, 31, 35, 38]],
  ];
  const only = process.argv[2]; // e.g. `npm run story-shots -- ending`
  for (const [name, story, times] of runs.filter(([n]) => !only || n.startsWith(only))) {
    await page.evaluate((s) => (window as unknown as { __game: { story(s: object): void } }).__game.story(s), story);
    // The intro waits for a key (the one that unlocks sound) once puppets have loaded.
    await page.waitForTimeout(800);
    if (name === 'intro') await page.evaluate(() => (window as unknown as { __game: { press(k: string): void } }).__game.press('Enter'));
    let t0 = 0;
    for (const t of times) {
      await page.waitForTimeout((t - t0) * 1000);
      t0 = t;
      await page.screenshot({ path: `shots/story/${name}-${t}.png` });
    }
  }
} finally {
  await browser.close();
  await server.close();
}
