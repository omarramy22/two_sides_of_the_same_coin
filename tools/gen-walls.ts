// tools/gen-walls.ts: generates wall-0.svg .. wall-15.svg with autotiling
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT_DIR = 'art/src/tiles';

function generateWallSvg(mask: number): string {
  const hasN = Boolean(mask & 1);
  const hasE = Boolean(mask & 2);
  const hasS = Boolean(mask & 4);
  const hasW = Boolean(mask & 8);

  const openN = !hasN;
  const openE = !hasE;
  const openS = !hasS;
  const openW = !hasW;

  const topH = openS ? 44 : 64;

  const nwRound = openN && openW;
  const neRound = openN && openE;
  const seRound = openS && openE;
  const swRound = openS && openW;

  // Top face path
  let topD = '';
  if (nwRound) {
    topD += 'M 0 6 A 6 6 0 0 1 6 0 ';
  } else {
    topD += 'M 0 0 ';
  }
  if (neRound) {
    topD += 'L 58 0 A 6 6 0 0 1 64 6 ';
  } else {
    topD += 'L 64 0 ';
  }
  topD += `L 64 ${topH} L 0 ${topH} `;
  if (nwRound) {
    topD += 'L 0 6 Z';
  } else {
    topD += 'L 0 0 Z';
  }

  // Front face path (only if openS)
  let frontD = '';
  if (openS) {
    frontD = 'M 0 44 L 64 44 ';
    if (seRound) {
      frontD += 'L 64 58 A 6 6 0 0 1 58 64 ';
    } else {
      frontD += 'L 64 64 ';
    }
    if (swRound) {
      frontD += 'L 6 64 A 6 6 0 0 1 0 58 ';
    } else {
      frontD += 'L 0 64 ';
    }
    frontD += 'Z';
  }

  // Top face stone-block seams (2-3 blocks)
  const s1x = 22 + ((mask * 5) % 18);
  const s1 = `M ${s1x} 0 Q ${s1x + 2} ${Math.round(topH * 0.5)} ${s1x - 1} ${topH}`;
  const s2y = Math.round(topH * 0.46);
  const s2 = s1x > 31
    ? `M ${s1x + 1} ${s2y} Q ${Math.round((s1x + 64) / 2)} ${s2y + 1} 64 ${s2y}`
    : `M ${s1x - 1} ${s2y} Q ${Math.round(s1x / 2)} ${s2y - 1} 0 ${s2y}`;

  // Front face vertical mortar lines (if openS)
  const m1 = 20 + ((mask * 7) % 8);
  const m2 = 42 + ((mask * 11) % 8);

  // Outlines along open edges
  const outlinePaths: string[] = [];
  if (openN) {
    outlinePaths.push(`M ${nwRound ? 6 : 0} 0 L ${neRound ? 58 : 64} 0`);
  }
  if (openE) {
    outlinePaths.push(`M 64 ${neRound ? 6 : 0} L 64 ${openS ? (seRound ? 58 : 64) : 64}`);
  }
  if (openS) {
    outlinePaths.push(`M ${seRound ? 58 : 64} 64 L ${swRound ? 6 : 0} 64`);
  }
  if (openW) {
    outlinePaths.push(`M 0 ${openS ? (swRound ? 58 : 64) : 64} L 0 ${nwRound ? 6 : 0}`);
  }
  if (nwRound) {
    outlinePaths.push('M 0 6 A 6 6 0 0 1 6 0');
  }
  if (neRound) {
    outlinePaths.push('M 58 0 A 6 6 0 0 1 64 6');
  }
  if (seRound) {
    outlinePaths.push('M 64 58 A 6 6 0 0 1 58 64');
  }
  if (swRound) {
    outlinePaths.push('M 6 64 A 6 6 0 0 1 0 58');
  }

  // Highlights along top and left open edges
  const highlights: string[] = [];
  if (openN && openW) {
    highlights.push(
      `<path d="M 2 40 L 2 6 Q 2 2 6 2 L ${openE ? 58 : 63} 2" fill="none" stroke="var(--highlight)" stroke-width="1.5" stroke-opacity="0.5" stroke-linecap="round"/>`
    );
  } else {
    if (openN) {
      highlights.push(
        `<line x1="${openW ? 6 : 1}" y1="2" x2="${openE ? 58 : 63}" y2="2" stroke="var(--highlight)" stroke-width="1.5" stroke-opacity="0.5" stroke-linecap="round"/>`
      );
    }
    if (openW) {
      highlights.push(
        `<line x1="2" y1="${openN ? 6 : 1}" x2="2" y2="${openS ? 42 : 63}" stroke="var(--highlight)" stroke-width="1.5" stroke-opacity="0.5" stroke-linecap="round"/>`
      );
    }
  }

  let frontFaceMarkup = '';
  if (openS) {
    frontFaceMarkup = `
    <!-- Front face -->
    <path d="${frontD}" fill="var(--wall-face)"/>
    <path d="${frontD}" fill="url(#hatch)" stroke="none"/>
    <line x1="${m1}" y1="44" x2="${m1}" y2="61" stroke="var(--wall-shade)" stroke-width="1.2" stroke-opacity="0.85"/>
    <line x1="${m2}" y1="44" x2="${m2}" y2="61" stroke="var(--wall-shade)" stroke-width="1.2" stroke-opacity="0.85"/>
    <!-- Bottom shade band (3px) -->
    <path d="M ${swRound ? 6 : 0} 61 L ${seRound ? 58 : 64} 61 L ${seRound ? 58 : 64} 64 L ${swRound ? 6 : 0} 64 Z" fill="var(--wall-shade)" stroke="none"/>
    <!-- Ink line between top and front face -->
    <line x1="0" y1="44" x2="64" y2="44" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" data-palettes="heads,tails">
  <!-- Top face -->
  <path d="${topD}" fill="var(--wall-top)"/>
  <!-- Internal stone block seams -->
  <g filter="url(#wobble-soft)" stroke="var(--wall-shade)" stroke-width="1.2" stroke-opacity="0.75" stroke-linecap="round" fill="none">
    <path d="${s1}"/>
    <path d="${s2}"/>
  </g>
  ${frontFaceMarkup}
  <!-- Open edge highlights -->
  ${highlights.join('\n  ')}
  <!-- Ink outlines along open edges -->
  <g filter="url(#wobble)" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" fill="none">
    ${outlinePaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
</svg>
`;
}

export function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (let mask = 0; mask < 16; mask++) {
    const filename = `wall-${mask}.svg`;
    const svg = generateWallSvg(mask);
    writeFileSync(`${OUT_DIR}/${filename}`, svg, 'utf8');
    console.log(`Generated ${OUT_DIR}/${filename}`);
  }
}

main();
