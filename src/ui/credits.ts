// src/ui/credits.ts: Credits overlay screen showing project attributions and acknowledgments.
import { Container, Graphics } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { audio } from '../audio/audio';
import { Button, C, text } from './style';

export function createCredits(ctx: Ctx, onClose: () => void): Scene {
  const root = new Container();
  root.eventMode = 'static';
  root.cursor = 'pointer';

  const bgDim = new Graphics();
  const panelGfx = new Graphics();
  const content = new Container();
  root.addChild(bgDim, panelGfx, content);

  const titleText = text('CREDITS', 34, C.gold);
  titleText.anchor.set(0.5, 0);

  const lines = [
    'Design, code, art & music: made with Claude Code (Anthropic)',
    'Typeface: IM Fell English, by Igino Marini (SIL Open Font License)',
    'Engine: PixiJS · Audio: Tone.js',
    'Thank you for playing',
  ];

  const lineTexts = lines.map((l, i) => {
    const isSpecial = i === lines.length - 1;
    const t = text(l, isSpecial ? 22 : 18, isSpecial ? C.goldLight : C.silverLight, {
      wordWrap: true,
      wordWrapWidth: 480,
      align: 'center',
    });
    t.anchor.set(0.5, 0);
    return t;
  });

  const closeBtn = new Button('Close', () => {
    audio.sfx('uiClick');
    onClose();
  }, 160, 46, 20);

  content.addChild(titleText, ...lineTexts, closeBtn);

  // Any pointertap closes
  root.on('pointertap', () => {
    audio.sfx('uiClick');
    onClose();
  });

  function layout(w: number, h: number) {
    bgDim.clear().rect(0, 0, w, h).fill({ color: 0x0e1028, alpha: 0.6 });

    const panelW = Math.min(540, w - 32);
    lineTexts.forEach((t) => (t.style.wordWrapWidth = panelW - 48));

    let innerH = titleText.height + 28;
    lineTexts.forEach((t) => {
      innerH += t.height + 18;
    });
    innerH += closeBtn.h + 24;

    const panelH = Math.min(h - 32, innerH + 32);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    panelGfx.clear();
    panelGfx.roundRect(panelX, panelY, panelW, panelH, 16).fill(0x141838).stroke({ width: 2.2, color: C.gold });

    panelGfx.roundRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 12).stroke({ width: 1, color: C.goldDark, alpha: 0.7 });

    let curY = panelY + 24;
    titleText.position.set(w / 2, curY);
    curY += titleText.height + 24;

    lineTexts.forEach((t, i) => {
      t.position.set(w / 2, curY);
      curY += t.height + (i === lineTexts.length - 2 ? 24 : 16);
    });

    closeBtn.position.set(w / 2 - closeBtn.w / 2, curY + 6);
  }

  return {
    root,
    enter() {
      layout(window.innerWidth, window.innerHeight);
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
    onAction(_a: Action) {
      audio.sfx('uiClick');
      onClose();
      return true;
    },
  };
}
