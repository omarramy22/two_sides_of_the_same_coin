// src/ui/gameover.ts: Overlay shown when Sol or Lune is caught or falls. Offers a retry from the
// spot just before the fatal move while retries last, otherwise only a fresh start.
import { Container, Graphics } from 'pixi.js';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { Button, C, FocusList, text } from './style';

export function createGameOver(
  caught: boolean,
  retriesLeft: number,
  h: { retry(): void; startOver(): void },
): Scene {
  const root = new Container();
  root.eventMode = 'static';

  const bgDim = new Graphics();
  bgDim.eventMode = 'static'; // swallow clicks so the HUD underneath can't be used
  const panelGfx = new Graphics();
  const title = text(caught ? 'Caught!' : 'A long way down…', 34, C.goldLight);
  title.anchor.set(0.5, 0);
  const sub = text(
    retriesLeft > 0
      ? `${retriesLeft} ${retriesLeft === 1 ? 'retry' : 'retries'} left`
      : 'No retries left. Back to the start.',
    20, retriesLeft > 0 ? C.silverLight : C.coral,
  );
  sub.anchor.set(0.5, 0);

  const buttons = [
    ...(retriesLeft > 0 ? [new Button('Try again', () => h.retry(), 210, 46, 22)] : []),
    new Button('Start over', () => h.startOver(), 210, 46, 22),
  ];
  root.addChild(bgDim, panelGfx, title, sub, ...buttons);
  const focus = new FocusList(buttons);

  function layout(w: number, hh: number) {
    bgDim.clear().rect(0, 0, w, hh).fill({ color: 0x0e1028, alpha: 0.6 });
    const panelW = Math.min(420, w - 32);
    const panelH = 20 + title.height + 6 + sub.height + 18 + buttons.length * 54 + 12;
    const panelX = (w - panelW) / 2, panelY = (hh - panelH) / 2;
    panelGfx.clear()
      .roundRect(panelX, panelY, panelW, panelH, 16).fill(0x141838).stroke({ width: 2.2, color: C.gold })
      .roundRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 12).stroke({ width: 1, color: C.goldDark, alpha: 0.7 });
    let y = panelY + 20;
    title.position.set(w / 2, y); y += title.height + 6;
    sub.position.set(w / 2, y); y += sub.height + 18;
    for (const b of buttons) { b.position.set(w / 2 - b.w / 2, y); y += b.h + 8; }
  }

  return {
    root,
    enter() { layout(window.innerWidth, window.innerHeight); },
    resize: layout,
    onAction(a: Action) {
      // Undo is the retry here; everything else (menu, restart, hint, moves) waits for a choice.
      if (a === 'undo' && retriesLeft > 0) h.retry();
      else if (a === 'restart') h.startOver();
      else focus.action(a);
      return true;
    },
  };
}
