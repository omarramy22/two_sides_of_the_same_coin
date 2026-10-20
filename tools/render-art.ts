// tools/render-art.ts: renders SVGs from art/src to PNGs in assets/
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

interface ManifestEntry {
  src: string;
  src2x: string;
  w: number;
  h: number;
}

const SRC_DIR = 'art/src';
const ASSETS_DIR = 'assets';

function collectFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function parseSvg(svg: string, filePath: string) {
  const match = svg.match(/<svg\b([^>]*)>/i);
  if (!match) throw new Error(`Missing <svg> tag in ${filePath}`);
  const attrs = match[1];

  const wMatch = attrs.match(/\bwidth=["']?([0-9.]+)(?:px)?["']?/i);
  const hMatch = attrs.match(/\bheight=["']?([0-9.]+)(?:px)?["']?/i);
  let w = wMatch ? parseFloat(wMatch[1]) : 0;
  let h = hMatch ? parseFloat(hMatch[1]) : 0;

  if (!w || !h) {
    const vb = attrs.match(/\bviewBox=["']?\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)["']?/i);
    if (vb) {
      w = w || parseFloat(vb[1]);
      h = h || parseFloat(vb[2]);
    }
  }

  if (!w || !h || isNaN(w) || isNaN(h)) {
    throw new Error(`Missing explicit width/height in ${filePath}`);
  }

  const pMatch = attrs.match(/\bdata-palettes=["']([^"']+)["']/i);
  const hasPalettes = !!pMatch;
  const palettes = pMatch
    ? pMatch[1].split(',').map((p) => p.trim()).filter(Boolean)
    : ['heads'];

  return { w, h, hasPalettes, palettes };
}

async function main() {
  const defsPath = path.join(SRC_DIR, '_defs.svg');
  let defsContent = '';
  if (existsSync(defsPath)) {
    const rawDefs = readFileSync(defsPath, 'utf8');
    const defsMatches = [...rawDefs.matchAll(/<defs[^>]*>([\s\S]*?)<\/defs>/gi)];
    defsContent = defsMatches.length > 0
      ? defsMatches.map((m) => m[1]).join('\n')
      : rawDefs.replace(/<\/?svg\b[^>]*>/gi, '');
  }

  const palettesPath = path.join(SRC_DIR, '_palettes.css');
  const paletteCss = existsSync(palettesPath) ? readFileSync(palettesPath, 'utf8') : '';

  const svgFiles = collectFiles(SRC_DIR, '.svg').sort();
  const manifest: Record<string, ManifestEntry> = {};

  mkdirSync(ASSETS_DIR, { recursive: true });

  const browser = await chromium.launch();
  let renderedCount = 0;

  try {
    const ctx1 = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 2560, height: 2560 } });
    const ctx2 = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 2560, height: 2560 } });
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    for (const file of svgFiles) {
      const relPath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
      const relNoExt = relPath.replace(/\.svg$/, '');
      const svgMarkup = readFileSync(file, 'utf8');
      const { w, h, hasPalettes, palettes } = parseSvg(svgMarkup, file);

      for (const palette of palettes) {
        const palSuffix = hasPalettes ? `.${palette}` : '';
        const assetKey = `${relNoExt}${palSuffix}`;
        const rel1x = `${relNoExt}${palSuffix}.png`;
        const rel2x = `${relNoExt}${palSuffix}@2x.png`;
        const out1x = path.join(ASSETS_DIR, rel1x);
        const out2x = path.join(ASSETS_DIR, rel2x);

        mkdirSync(path.dirname(out1x), { recursive: true });
        mkdirSync(path.dirname(out2x), { recursive: true });

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${paletteCss}
    html,body{margin:0;background:transparent}
  </style>
</head>
<body>
  <svg width="0" height="0" style="position:absolute"><defs>${defsContent}</defs></svg>
  <div id="a" class="theme-${palette}" style="display:inline-block;line-height:0">${svgMarkup}</div>
</body>
</html>`;

        await page1.setContent(html, { waitUntil: 'load' });
        await page1.locator('#a').screenshot({ path: out1x, omitBackground: true });

        await page2.setContent(html, { waitUntil: 'load' });
        await page2.locator('#a').screenshot({ path: out2x, omitBackground: true });

        manifest[assetKey] = {
          src: rel1x.replace(/\\/g, '/'),
          src2x: rel2x.replace(/\\/g, '/'),
          w,
          h,
        };

        console.log(`Rendered ${assetKey} (${w}x${h}) -> ${rel1x}`);
        renderedCount++;
      }
    }
  } finally {
    await browser.close();
  }

  // Copy art/src/**/*.json files (excluding _*)
  const jsonFiles = collectFiles(SRC_DIR, '.json').sort();
  for (const file of jsonFiles) {
    const rel = path.relative(SRC_DIR, file);
    const dest = path.join(ASSETS_DIR, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }

  // Write sorted manifest.json
  const sortedManifest: Record<string, ManifestEntry> = {};
  for (const k of Object.keys(manifest).sort()) {
    sortedManifest[k] = manifest[k];
  }
  writeFileSync(
    path.join(ASSETS_DIR, 'manifest.json'),
    JSON.stringify(sortedManifest, null, 2) + '\n',
    'utf8'
  );

  console.log(`Done. Rendered ${renderedCount} asset variants across ${svgFiles.length} SVGs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
