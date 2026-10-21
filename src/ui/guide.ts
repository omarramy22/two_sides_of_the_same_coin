// src/ui/guide.ts: Popup at the start of each chapter: every new thing on the board, its icon,
// and how to use it.
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import type { Action } from '../app/settings';
import { CHAPTER_NAMES } from '../levels/index';
import { Button, C, FocusList, text } from './style';

type Entry = [icon: string, name: string, how: string];

const TARNISH = (ch: number): Entry => [`chars/tarnish/ch${ch}.awake`, "This chapter's Tarnish",
  'Same rules, new look: it chases its kid, and lining up Sol and Lune flips it asleep.'];

export const GUIDES: Entry[][] = [
  [],
  [
    ['tiles/goal-heads.heads', 'Coin socket', 'Sol and Lune must both stand on their sockets at the end of the same move.'],
    ['tiles/crate', 'Crate', 'Walk into it to push it one tile.'],
    ['tiles/pit.heads', 'Pit', 'Falling in ends the try. Push a crate in to fill it.'],
    ['chars/tarnish/awake', 'Tarnish', 'Steps toward its own kid after every move. If it catches them, the try ends.'],
    ['chars/tarnish/asleep', 'Sleeping Tarnish', 'Harmless, just a wall. When Sol and Lune stand on the same spot, every Tarnish flips awake or asleep.'],
  ],
  [
    ['tiles/plate-up.heads2', 'Pressure plate', 'Stand on it, or leave a crate, to open its gates on this side and close them on the other.'],
    ['tiles/gate-closed.heads2', 'Gate', 'Opens and closes with its plate. Something standing in a gate stops it closing.'],
    ['tiles/stone-up.heads2', 'Balance stone', 'Walk into a raised stone to push it down. Its twin across the seam rises, unless something stands on it.'],
    TARNISH(2),
  ],
  [
    ['tiles/lantern.heads3', 'Lantern', 'Push it around. It lights its row and column until something blocks the beam. Light freezes a Tarnish.'],
    ['tiles/mirage.heads3', 'Sunglass bridge', 'Solid only while it is lit in its own world.'],
    ['tiles/shadow-bridge.heads3', 'Shadow bridge', 'Solid only while in shadow. Light on one side of the coin is shadow on the other.'],
    TARNISH(3),
  ],
  [
    ['tiles/water.heads4', 'Water', "Can't be walked on. A basin is full on one side of the coin and dry on the other."],
    ['tiles/sluice-closed.heads4', 'Sluice', 'Stand on it, or hold it with a crate, to pour your water across the seam one tile per move.'],
    ['tiles/raft.heads4', 'Raft', 'Push a crate into water and it floats. Walk across on it.'],
    TARNISH(4),
  ],
  [
    ['tiles/cracked.heads5', 'Cracked floor', 'Breaks under anyone with weight.'],
    ['tiles/altar-weight.heads5', 'Weight altar', "Give it your half-coin to become weightless: you cross cracks but can't press plates."],
    ['tiles/altar-light.heads5', 'Light altar', 'Give it your half-coin to carry light yourself. Sunglass bridges stand where you walk.'],
    TARNISH(5),
  ],
  [
    ['tiles/mirror-shrine.heads6', 'Mirror shrine', "Step on it to swap Lune's left and right. Step on it again to swap back."],
    ['tiles/wish-altar-heads.heads6', 'Wish altar', 'The last puzzle: both kids on their wish altars at once, still holding their half-coins.'],
    TARNISH(6),
  ],
];

export function createGuide(ctx: Ctx, chapter: number, onClose: () => void): Scene {
  const root = new Container();
  root.eventMode = 'static';
  const bgDim = new Graphics();
  bgDim.eventMode = 'static'; // swallow clicks so the board underneath can't be used
  const panel = new Graphics();
  const title = text(`Chapter ${chapter} · ${CHAPTER_NAMES[chapter]}`, 30, C.goldLight);
  title.anchor.set(0.5, 0);
  const sub = text("What's new here", 18, C.silverLight);
  sub.anchor.set(0.5, 0);
  root.addChild(bgDim, panel, title, sub);

  const rows = GUIDES[chapter].map(([icon, name, how]) => {
    const row = new Container();
    const s = new Sprite(ctx.art.tex[icon]);
    s.anchor.set(0.5);
    const label = text(name, 20, C.gold);
    const body = text(how, 15, C.silverLight, { wordWrap: true, wordWrapWidth: 300 });
    row.addChild(s, label, body);
    root.addChild(row);
    return { row, s, label, body, actor: icon.startsWith('chars/') };
  });
  const ok = new Button('Got it', onClose, 180, 44, 22);
  root.addChild(ok);
  const focus = new FocusList([ok]);

  function layout(w: number, h: number) {
    bgDim.clear().rect(0, 0, w, h).fill({ color: 0x0e1028, alpha: 0.7 });
    const pw = Math.min(520, w - 32), icon = 52, textW = pw - icon - 56;
    for (const r of rows) {
      r.s.width = r.s.height = r.actor ? icon * 1.7 : icon; // actor art has empty margin around the figure
      r.s.position.set(icon / 2, icon / 2 - (r.actor ? icon * 0.2 : 0));
      r.body.style.wordWrapWidth = textW;
    }
    const rowH = (r: (typeof rows)[number]) => Math.max(icon, r.label.height + 2 + r.body.height) + 12;
    const ph = Math.min(h - 24, 20 + title.height + 4 + sub.height + 16 + rows.reduce((n, r) => n + rowH(r), 0) + ok.h + 24);
    const px = (w - pw) / 2, py = (h - ph) / 2;
    panel.clear()
      .roundRect(px, py, pw, ph, 16).fill(0x141838).stroke({ width: 2.2, color: C.gold })
      .roundRect(px + 6, py + 6, pw - 12, ph - 12, 12).stroke({ width: 1, color: C.goldDark, alpha: 0.7 });
    let y = py + 20;
    title.position.set(w / 2, y); y += title.height + 4;
    sub.position.set(w / 2, y); y += sub.height + 16;
    for (const r of rows) {
      r.row.position.set(px + 22, y);
      r.label.position.set(icon + 14, 0);
      r.body.position.set(icon + 14, r.label.height + 2);
      y += rowH(r);
    }
    ok.position.set(w / 2 - ok.w / 2, y + 4);
  }

  return {
    root,
    enter() { layout(window.innerWidth, window.innerHeight); },
    resize: layout,
    onAction(a: Action) {
      if (a === 'menu') onClose();
      else focus.action(a);
      return true;
    },
  };
}
