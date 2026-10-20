// src/ui/album.ts: Coin collector's album screen for level selection.
import { Container, Graphics } from 'pixi.js';
import type { Ctx } from '../app/context';
import { stars } from '../app/save';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { audio } from '../audio/audio';
import { chapterOf, CHAPTER_NAMES } from '../levels/index';
import { Button, C, milled, text } from './style';

export function createAlbum(ctx: Ctx, initialChapter = 1): Scene {
  const root = new Container();
  root.eventMode = 'static';

  let currentChapter = initialChapter;
  let curW = window.innerWidth;
  let curH = window.innerHeight;

  const bgGraphics = new Graphics();
  const pageContainer = new Container();
  const uiContainer = new Container();
  root.addChild(bgGraphics, pageContainer, uiContainer);

  const availableChapters = Array.from(new Set(ctx.levels.map(chapterOf))).sort((a, b) => a - b);
  if (!availableChapters.includes(currentChapter)) {
    currentChapter = availableChapters[0] ?? 1;
  }

  // Page navigation arrows & back button
  const prevArrow = text('◄', 36, C.gold);
  prevArrow.eventMode = 'static';
  prevArrow.cursor = 'pointer';
  prevArrow.on('pointerover', () => {
    prevArrow.style.fill = C.goldLight;
    audio.sfx('uiHover');
  });
  prevArrow.on('pointerout', () => {
    prevArrow.style.fill = C.gold;
  });
  prevArrow.on('pointertap', () => {
    switchChapter(-1);
  });

  const nextArrow = text('►', 36, C.gold);
  nextArrow.eventMode = 'static';
  nextArrow.cursor = 'pointer';
  nextArrow.on('pointerover', () => {
    nextArrow.style.fill = C.goldLight;
    audio.sfx('uiHover');
  });
  nextArrow.on('pointerout', () => {
    nextArrow.style.fill = C.gold;
  });
  nextArrow.on('pointertap', () => {
    switchChapter(1);
  });

  const backBtn = new Button('Title', () => ctx.go.title(), 140, 44, 20);
  uiContainer.addChild(prevArrow, nextArrow, backBtn);

  let focusIndex = 0;
  let selectableItems: { globalIndex: number; focusGfx: Graphics }[] = [];

  function switchChapter(delta: number) {
    const curIdx = availableChapters.indexOf(currentChapter);
    const newIdx = curIdx + delta;
    if (newIdx >= 0 && newIdx < availableChapters.length) {
      currentChapter = availableChapters[newIdx];
      focusIndex = 0;
      audio.sfx('uiClick');
      drawPage();
    }
  }

  function drawPage() {
    pageContainer.removeChildren();
    selectableItems = [];

    const w = curW;
    const h = curH;
    const landscape = w >= h;

    // 1. Velvet background & guilloche frame
    const margin = Math.max(16, Math.min(32, w * 0.04));
    const padW = w - margin * 2;
    const padH = h - margin * 2;

    bgGraphics.clear();
    // Night background
    bgGraphics.rect(0, 0, w, h).fill(0x0e1028);

    // Dark velvet panel (#141838)
    bgGraphics.roundRect(margin, margin, padW, padH, 20).fill(0x141838);

    // Subtle diagonal hatch lines at 8% alpha
    // 45-degree lines y = (u - x), clipped to the panel.
    for (let x = -padH; x < padW; x += 16) {
      const [x0, y0] = x < 0 ? [0, -x] : [x, 0];
      const [x1, y1] = x + padH > padW ? [padW, padW - x] : [x + padH, padH];
      bgGraphics.moveTo(margin + x0, margin + y0).lineTo(margin + x1, margin + y1);
    }
    bgGraphics.stroke({ width: 1, color: 0xffffff, alpha: 0.08 });

    // Gold guilloche border: two interleaved rounded-rectangle wave lines
    const b1 = margin + 8;
    const b1w = padW - 16;
    const b1h = padH - 16;
    bgGraphics.roundRect(b1, b1, b1w, b1h, 14).stroke({ width: 2, color: C.goldDark, alpha: 0.85 });

    const b2 = margin + 14;
    const b2w = padW - 28;
    const b2h = padH - 28;
    bgGraphics.roundRect(b2, b2, b2w, b2h, 10).stroke({ width: 1.2, color: C.gold, alpha: 0.7 });

    // Corner decorative rosettes
    for (const [cx, cy] of [
      [b1 + 6, b1 + 6],
      [b1 + b1w - 6, b1 + 6],
      [b1 + 6, b1 + b1h - 6],
      [b1 + b1w - 6, b1 + b1h - 6],
    ]) {
      bgGraphics.circle(cx, cy, 4).fill(C.gold);
    }

    // 2. Heading: "Chapter N · <CHAPTER_NAMES[N]>"
    const chapterName = CHAPTER_NAMES[currentChapter] ?? '';
    const heading = text(`Chapter ${currentChapter} · ${chapterName}`, Math.min(32, w * 0.06), C.gold);
    heading.anchor.set(0.5, 0);
    const narrow = w < 700;
    heading.position.set(w / 2, margin + (narrow ? 78 : 22));
    pageContainer.addChild(heading);

    // Chapter levels
    const chapterLevels = ctx.levels.filter((lv) => chapterOf(lv) === currentChapter);

    // Total stars in this chapter
    const totalChapterStars = chapterLevels.reduce((acc, lv) => acc + stars(lv.par, ctx.save.best[lv.id]), 0);
    const maxPossibleStars = chapterLevels.length * 3;
    const starsLabel = text(`Stars: ${totalChapterStars} / ${maxPossibleStars}`, 18, C.goldLight);
    starsLabel.anchor.set(1, 0);
    starsLabel.position.set(margin + padW - 24, margin + (narrow ? 30 : 26));
    pageContainer.addChild(starsLabel);

    // Page arrows position
    const curIdx = availableChapters.indexOf(currentChapter);
    prevArrow.visible = curIdx > 0;
    nextArrow.visible = curIdx < availableChapters.length - 1;

    prevArrow.position.set(margin + 20, h / 2 - 20);
    nextArrow.position.set(margin + padW - 36, h / 2 - 20);

    // Back to title button
    backBtn.position.set(margin + 24, margin + 18);

    // 3. Medallions Grid
    const cols = landscape ? 3 : 2;
    const rows = Math.ceil(chapterLevels.length / cols);

    const gridTop = heading.y + heading.height + 20;
    const gridBottom = margin + padH - 24;
    const gridH = gridBottom - gridTop;
    const gridW = padW - (landscape ? 140 : 80);
    const gridLeft = w / 2 - gridW / 2;

    const cellW = gridW / cols;
    const cellH = gridH / Math.max(1, rows);

    const radius = Math.max(28, Math.min(54, cellW * 0.28, cellH * 0.32));

    chapterLevels.forEach((lv, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cellCx = gridLeft + col * cellW + cellW / 2;
      const cellCy = gridTop + row * cellH + cellH * 0.42;

      const globalIndex = ctx.levels.findIndex((l) => l.id === lv.id);
      const prevLevel = globalIndex > 0 ? ctx.levels[globalIndex - 1] : null;
      const isLocked = globalIndex > 0 && ctx.save.best[prevLevel!.id] === undefined && !ctx.settings().judgeMode;
      const isSolved = ctx.save.best[lv.id] !== undefined;

      const medContainer = new Container();
      const medGfx = new Graphics();
      const focusGfx = new Graphics();
      medContainer.addChild(medGfx, focusGfx);

      // Focus ring graphics
      focusGfx.circle(cellCx, cellCy, radius + 8).stroke({ width: 3, color: C.goldLight, alpha: 0.9 });
      focusGfx.visible = false;

      if (isLocked) {
        // Locked: dark silhouette coin (#0E1028 fill, #2E3570 rim), no number, not selectable
        medGfx.circle(cellCx, cellCy, radius).fill(0x0e1028);
        milled(medGfx, cellCx, cellCy, radius, 0x2e3570, 48, 2.5);
        medGfx.circle(cellCx, cellCy, radius).stroke({ width: 1.8, color: 0x2e3570 });

        // Small engraved lock / keyhole silhouette
        medGfx.circle(cellCx, cellCy - 4, 6).stroke({ width: 2, color: 0x2e3570 });
        medGfx.roundRect(cellCx - 7, cellCy, 14, 10, 2).fill(0x2e3570);
      } else if (!isSolved) {
        // Unlocked but unsolved: silhouette coin with number in silver, selectable
        medGfx.circle(cellCx, cellCy, radius).fill(0x1c2046);
        milled(medGfx, cellCx, cellCy, radius, C.silverDark, 54, 2.8);
        medGfx.circle(cellCx, cellCy, radius).stroke({ width: 2, color: C.silverDark });

        // Guilloche rosette (8-12 overlapping thin circles)
        for (let k = 0; k < 10; k++) {
          const theta = (k / 10) * Math.PI * 2;
          const ox = Math.cos(theta) * (radius * 0.28);
          const oy = Math.sin(theta) * (radius * 0.28);
          medGfx.circle(cellCx + ox, cellCy + oy, radius * 0.42).stroke({ width: 0.8, color: C.silverDark, alpha: 0.45 });
        }

        // Level number in silver
        const numText = text(lv.id, Math.round(radius * 0.45), C.silverLight);
        numText.anchor.set(0.5);
        numText.position.set(cellCx, cellCy);
        medContainer.addChild(numText);

        // Level name below medallion
        const nameText = text(lv.name, Math.min(18, Math.max(14, radius * 0.35)), C.silverDark);
        nameText.anchor.set(0.5, 0);
        nameText.position.set(cellCx, cellCy + radius + 8);
        medContainer.addChild(nameText);

        // Selectable interactions
        const currentSelIndex = selectableItems.length;
        selectableItems.push({ globalIndex, focusGfx });

        medContainer.eventMode = 'static';
        medContainer.cursor = 'pointer';
        medContainer.on('pointerover', () => {
          focusIndex = currentSelIndex;
          updateFocus();
          audio.sfx('uiHover');
        });
        medContainer.on('pointertap', () => {
          audio.sfx('uiClick');
          ctx.go.play(globalIndex);
        });
      } else {
        // Solved: gold face (left half gold #E8B66A, right half silver #C9D3E6)
        // Left half gold
        medGfx.arc(cellCx, cellCy, radius, Math.PI / 2, (3 * Math.PI) / 2).fill(0xe8b66a);
        // Right half silver
        medGfx.arc(cellCx, cellCy, radius, (3 * Math.PI) / 2, Math.PI / 2).fill(0xc9d3e6);

        // Milled rim
        milled(medGfx, cellCx, cellCy, radius, C.ink, 64, 3);
        medGfx.circle(cellCx, cellCy, radius).stroke({ width: 2.2, color: C.ink });

        // Seam line
        medGfx
          .moveTo(cellCx, cellCy - radius)
          .lineTo(cellCx, cellCy + radius)
          .stroke({ width: 1.8, color: C.ink });

        // Guilloche rosette
        for (let k = 0; k < 10; k++) {
          const theta = (k / 10) * Math.PI * 2;
          const ox = Math.cos(theta) * (radius * 0.28);
          const oy = Math.sin(theta) * (radius * 0.28);
          medGfx.circle(cellCx + ox, cellCy + oy, radius * 0.42).stroke({ width: 0.8, color: C.ink, alpha: 0.35 });
        }

        // Level number in ink
        const numText = text(lv.id, Math.round(radius * 0.45), C.ink);
        numText.anchor.set(0.5);
        numText.position.set(cellCx, cellCy);
        medContainer.addChild(numText);

        // Level name below medallion
        const nameText = text(lv.name, Math.min(18, Math.max(14, radius * 0.35)), C.goldLight);
        nameText.anchor.set(0.5, 0);
        nameText.position.set(cellCx, cellCy + radius + 8);
        medContainer.addChild(nameText);

        // Stars: 3 tiny coins under the name
        const starCount = stars(lv.par, ctx.save.best[lv.id]);
        const starY = cellCy + radius + 8 + nameText.height + 4;
        const starR = 5;

        for (let sIdx = 0; sIdx < 3; sIdx++) {
          const starX = cellCx + (sIdx - 1) * 16;
          const starEarned = sIdx < starCount;
          if (starEarned) {
            medGfx.circle(starX, starY, starR).fill(C.gold).stroke({ width: 1.2, color: C.ink });
            medGfx.circle(starX, starY, starR * 0.5).stroke({ width: 0.8, color: C.goldDark });
          } else {
            medGfx.circle(starX, starY, starR).stroke({ width: 1.2, color: C.silverDark });
          }
        }

        // 3 stars shows "Perfect Coin" label
        if (starCount === 3) {
          const perfectText = text('Perfect Coin', 12, C.gold);
          perfectText.anchor.set(0.5, 0);
          perfectText.position.set(cellCx, starY + starR + 4);
          medContainer.addChild(perfectText);
        }

        // Selectable interactions
        const currentSelIndex = selectableItems.length;
        selectableItems.push({ globalIndex, focusGfx });

        medContainer.eventMode = 'static';
        medContainer.cursor = 'pointer';
        medContainer.on('pointerover', () => {
          focusIndex = currentSelIndex;
          updateFocus();
          audio.sfx('uiHover');
        });
        medContainer.on('pointertap', () => {
          audio.sfx('uiClick');
          ctx.go.play(globalIndex);
        });
      }

      pageContainer.addChild(medContainer);
    });

    updateFocus();
  }

  function updateFocus() {
    if (selectableItems.length === 0) return;
    if (focusIndex < 0) focusIndex = 0;
    if (focusIndex >= selectableItems.length) focusIndex = selectableItems.length - 1;

    selectableItems.forEach((item, idx) => {
      item.focusGfx.visible = idx === focusIndex;
    });
  }

  function layout(w: number, h: number) {
    curW = w;
    curH = h;
    drawPage();
  }

  return {
    root,
    enter() {
      layout(window.innerWidth, window.innerHeight);
    },
    exit() {
      pageContainer.removeChildren();
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
    onAction(a: Action) {
      if (a === 'menu') {
        audio.sfx('uiClick');
        ctx.go.title();
        return true;
      }

      const landscape = curW >= curH;
      const cols = landscape ? 3 : 2;

      if (a === 'left') {
        if (focusIndex % cols === 0) {
          switchChapter(-1);
        } else if (focusIndex > 0) {
          focusIndex--;
          audio.sfx('uiHover');
          updateFocus();
        }
        return true;
      }
      if (a === 'right') {
        if (focusIndex % cols === cols - 1 || focusIndex === selectableItems.length - 1) {
          switchChapter(1);
        } else if (focusIndex < selectableItems.length - 1) {
          focusIndex++;
          audio.sfx('uiHover');
          updateFocus();
        }
        return true;
      }
      if (a === 'up') {
        if (focusIndex >= cols) {
          focusIndex -= cols;
          audio.sfx('uiHover');
          updateFocus();
          return true;
        }
      }
      if (a === 'down') {
        if (focusIndex + cols < selectableItems.length) {
          focusIndex += cols;
          audio.sfx('uiHover');
          updateFocus();
          return true;
        }
      }
      if (a === 'confirm') {
        if (selectableItems[focusIndex]) {
          audio.sfx('uiClick');
          ctx.go.play(selectableItems[focusIndex].globalIndex);
          return true;
        }
      }
      return false;
    },
  };
}
