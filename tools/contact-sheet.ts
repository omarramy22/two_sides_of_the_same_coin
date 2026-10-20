// tools/contact-sheet.ts: generates a contact sheet PNG of all rendered art assets
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

interface ManifestEntry {
  src: string;
  src2x: string;
  w: number;
  h: number;
}

const MANIFEST_PATH = 'assets/manifest.json';
const HEADS_BG = '#F6D58E';
const TAILS_BG = '#2E3570';

function getImgDataUri(relPath: string): string {
  const full = path.resolve('assets', relPath);
  if (!existsSync(full)) return '';
  const buf = readFileSync(full);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`Error: ${MANIFEST_PATH} not found. Run "npm run art" first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, ManifestEntry>;
  const filter = process.argv[2]?.trim() || '';
  const keys = Object.keys(manifest)
    .filter((k) => !filter || k.startsWith(filter))
    .sort();

  if (keys.length === 0) {
    console.log(`No assets matched filter: "${filter}"`);
  }

  const sections = new Map<string, string[]>();
  for (const k of keys) {
    const group = k.includes('/') ? k.split('/')[0] : 'general';
    if (!sections.has(group)) sections.set(group, []);
    sections.get(group)!.push(k);
  }

  const renderCard = (key: string, bg: string, textColor: string, w: number, h: number, label?: string) => {
    const entry = manifest[key];
    const uri = getImgDataUri(entry.src2x);
    return `<div class="card" style="background:${bg}">
      <div class="preview">
        <img src="${uri}" width="${w}" height="${h}" alt="${key}" style="display:block">
      </div>
      <div class="name" style="color:${textColor};max-width:${Math.max(w, 100)}px">
        ${key}${label ? `<span class="badge"> (${label})</span>` : ''}
      </div>
    </div>`;
  };

  const renderPair = (key: string, w: number, h: number, label?: string) => `
    <div class="card-pair">
      ${renderCard(key, HEADS_BG, '#2A1E14', w, h, label)}
      ${renderCard(key, TAILS_BG, '#E8F0FF', w, h, label)}
    </div>`;

  let sectionsHtml = '';
  for (const [group, groupKeys] of sections) {
    const row1x = groupKeys.map((k) => renderPair(k, manifest[k].w, manifest[k].h)).join('');
    const row64 = groupKeys.map((k) => {
      const e = manifest[k];
      const w = 64;
      const h = Math.round(e.h * (64 / (e.w || 64)));
      return renderPair(k, w, h, '64px');
    }).join('');
    const row40 = groupKeys.map((k) => {
      const e = manifest[k];
      const w = 40;
      const h = Math.round(e.h * (40 / (e.w || 64)));
      return renderPair(k, w, h, '40px');
    }).join('');

    sectionsHtml += `
    <section class="group">
      <h2 class="group-title">${group}</h2>
      <div class="row-block">
        <div class="row-label">1x Scale (crisp 2x source · Heads &amp; Tails side by side)</div>
        <div class="cards-flow">${row1x}</div>
      </div>
      <div class="row-block">
        <div class="row-label">Game Size (64px · Heads &amp; Tails)</div>
        <div class="cards-flow">${row64}</div>
      </div>
      <div class="row-block">
        <div class="row-label">Phone Size (40px · Heads &amp; Tails)</div>
        <div class="cards-flow">${row40}</div>
      </div>
    </section>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Art Contact Sheet</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      background: #181926;
      color: #cad3f5;
      font-family: system-ui, -apple-system, sans-serif;
    }
    h1 { margin: 0 0 6px 0; font-size: 24px; color: #fff; }
    .meta { font-family: monospace; font-size: 13px; color: #8087a2; margin-bottom: 32px; }
    .group {
      margin-bottom: 40px;
      padding-bottom: 32px;
      border-bottom: 1px solid #363a4f;
    }
    .group-title {
      font-family: monospace;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #eed49f;
      margin: 0 0 16px 0;
    }
    .row-block { margin-bottom: 24px; }
    .row-label {
      font-family: monospace;
      font-size: 12px;
      font-weight: 600;
      color: #939ab7;
      margin-bottom: 10px;
    }
    .cards-flow {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
    }
    .card-pair {
      display: inline-flex;
      gap: 6px;
      padding: 6px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    .preview {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
    }
    .name {
      font-family: monospace;
      font-size: 10px;
      margin-top: 6px;
      text-align: center;
      word-break: break-all;
      line-height: 1.2;
    }
    .badge { opacity: 0.75; font-size: 9px; }
  </style>
</head>
<body>
  <h1>Art Contact Sheet</h1>
  <div class="meta">Filter: "${filter || '*'}" · Total assets: ${keys.length}</div>
  ${sectionsHtml}
</body>
</html>`;

  const outFileName = filter
    ? `contact-sheet-${filter.replace(/\//g, '-')}.png`
    : 'contact-sheet.png';
  const outPath = path.join('art', outFileName);
  mkdirSync('art', { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Saved contact sheet to ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
