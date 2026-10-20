// npm run story-shots: frames of the intro, one vignette and the ending -> shots/story/ (for review).
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5198/?shots');
  await page.waitForFunction(() => !!(window as unknown as { __game?: unknown }).__game);
  const runs: [string, object, number[]][] = [
    ['intro', { kind: 'intro' }, [2, 4.5, 8, 10.5, 13.5, 16, 19.5]],
    ['vignette3', { kind: 'vignette', chapter: 3 }, [2, 5.5, 9.5]],
    ['ending', { kind: 'ending' }, [2, 6.8, 10, 14, 19]],
  ];
  for (const [name, story, times] of runs) {
    await page.evaluate((s) => (window as unknown as { __game: { story(s: object): void } }).__game.story(s), story);
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
