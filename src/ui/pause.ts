// src/ui/pause.ts: In-game pause menu overlay with level info, par/best stats, and navigation.
import { Container, Graphics } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { audio } from '../audio/audio';
import { chapterOf, CHAPTER_NAMES } from '../levels/index';
import { Button, C, FocusList, text } from './style';

export function createPause(
  ctx: Ctx,
  levelIndex: number,
  h: { resume(): void; restart(): void; hint(): void },
): Scene {
  const root = new Container();
  root.eventMode = 'static';

  const lv = ctx.levels[levelIndex] ?? ctx.levels[0];
  const chapter = chapterOf(lv);
  const chapterName = CHAPTER_NAMES[chapter] ?? '';
  const best = ctx.save.best[lv.id];
  const parStr = lv.par !== undefined ? `${lv.par}` : '—';
  const bestStr = best !== undefined ? `${best}` : '—';

  const bgDim = new Graphics();
  const panelGfx = new Graphics();
  const contentContainer = new Container();
  root.addChild(bgDim, panelGfx, contentContainer);

  // Header & Info Texts
  const chapterText = text(`Chapter ${chapter} · ${chapterName}`, 20, C.gold);
  chapterText.anchor.set(0.5, 0);

  const levelNameText = text(lv.name, 34, C.goldLight);
  levelNameText.anchor.set(0.5, 0);

  const statsText = text(`Par ${parStr}   ·   Best ${bestStr}`, 20, C.silverLight);
  statsText.anchor.set(0.5, 0);


  contentContainer.addChild(chapterText, levelNameText, statsText);

  // Buttons in a FocusList
  const btnResume = new Button('Resume', () => h.resume(), 210, 46, 22);
  const btnHint = new Button('Hint', () => h.hint(), 210, 46, 22);
  const btnRestart = new Button('Restart', () => h.restart(), 210, 46, 22);
  const btnAlbum = new Button('Level album', () => ctx.go.album(chapter), 210, 46, 22);
  const btnSettings = new Button('Settings', () => ctx.go.settings(), 210, 46, 22);
  const btnTitle = new Button('Title', () => ctx.go.title(), 210, 46, 22);

  const buttons = [btnResume, btnHint, btnRestart, btnAlbum, btnSettings, btnTitle];
  buttons.forEach((b) => contentContainer.addChild(b));

  const focus = new FocusList(buttons);

  function layout(w: number, h: number) {
    // 1. Dim background
    bgDim.clear().rect(0, 0, w, h).fill({ color: 0x0e1028, alpha: 0.6 });

    // 2. Central plaque panel
    const panelW = Math.min(480, w - 32);
    const btnSpacing = 8;
    const btnBlockH = buttons.length * 46 + (buttons.length - 1) * btnSpacing;
    const noteH = 0;
    const infoH = chapterText.height + levelNameText.height + statsText.height + noteH + 40;
    const panelH = Math.min(h - 32, infoH + btnBlockH + 48);

    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    panelGfx.clear();
    panelGfx.roundRect(panelX, panelY, panelW, panelH, 16).fill(0x141838).stroke({ width: 2.2, color: C.gold });

    panelGfx.roundRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 12).stroke({ width: 1, color: C.goldDark, alpha: 0.7 });

    // Position Header Info
    let curY = panelY + 20;
    chapterText.position.set(w / 2, curY);
    curY += chapterText.height + 4;

    levelNameText.position.set(w / 2, curY);
    curY += levelNameText.height + 6;

    statsText.position.set(w / 2, curY);
    curY += statsText.height + 8;

    curY += 8;

    // Position Buttons
    buttons.forEach((b) => {
      b.position.set(w / 2 - b.w / 2, curY);
      curY += b.h + btnSpacing;
    });
  }

  return {
    root,
    enter() {
      layout(window.innerWidth, window.innerHeight);
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
    onAction(a: Action) {
      if (a === 'menu') {
        audio.sfx('uiClick');
        h.resume();
        return true;
      }
      return focus.action(a);
    },
  };
}
