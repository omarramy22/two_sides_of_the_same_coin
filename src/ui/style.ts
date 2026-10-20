// UI style kit: every screen uses these, so the UI reads as one engraved-coin family (SPEC.md §5, §7).
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { audio } from '../audio/audio';

export const FONT = "'IM Fell English', Georgia, serif";

export const C = {
  night: 0x1c2046,
  ink: 0x2a1e14,
  inkNight: 0x0e1028,
  gold: 0xe8b66a,
  goldLight: 0xfff4d6,
  goldDark: 0xa8742a,
  silver: 0xc9d3e6,
  silverLight: 0xe8f0ff,
  silverDark: 0x7f8bb0,
  coral: 0xe07a6b,
  teal: 0x2e8c8a,
};

export function text(s: string, size: number, fill = C.goldLight, extra: TextStyleOptions = {}): Text {
  const t = new Text({ text: s, style: { fontFamily: FONT, fontSize: size, fill, letterSpacing: size * 0.04, ...extra } });
  t.resolution = Math.max(2, window.devicePixelRatio || 1);
  return t;
}

/** A milled ring (coin edge): dashes around a circle. */
export function milled(g: Graphics, cx: number, cy: number, r: number, color: number, teeth = 72, len = 3) {
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      .lineTo(cx + Math.cos(a) * (r - len), cy + Math.sin(a) * (r - len));
  }
  g.stroke({ width: 1.2, color, alpha: 0.9 });
}

/**
 * An engraved gold plaque button. Keyboard/gamepad focus is drawn by `focused`;
 * pointer hover and click play the UI sounds.
 */
export class Button extends Container {
  private bg = new Graphics();
  private caption: Text;
  private _focused = false;

  constructor(caption: string, readonly onPress: () => void, readonly w = 220, readonly h = 56, size = 28) {
    super();
    this.caption = text(caption, size, C.ink);
    this.caption.anchor.set(0.5);
    this.caption.position.set(w / 2, h / 2);
    this.addChild(this.bg, this.caption);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => { this.focused = true; audio.sfx('uiHover'); });
    this.on('pointerout', () => (this.focused = false));
    this.on('pointertap', () => this.press());
    this.draw();
  }

  get focused() { return this._focused; }
  set focused(v: boolean) { this._focused = v; this.draw(); }

  press() { audio.sfx('uiClick'); this.onPress(); }

  setCaption(s: string) { this.caption.text = s; }

  private draw() {
    const { w, h } = this, g = this.bg.clear();
    if (this._focused) g.roundRect(-5, -5, w + 10, h + 10, 16).fill({ color: C.goldLight, alpha: 0.35 });
    g.roundRect(0, 0, w, h, 12).fill(this._focused ? 0xf2c983 : C.gold).stroke({ width: 2.2, color: C.ink });
    g.roundRect(5, 5, w - 10, h - 10, 8).stroke({ width: 1, color: C.goldDark, alpha: 0.8 });
    for (const x of [12, w - 12]) g.circle(x, h / 2, 2.6).fill(C.goldDark);
  }
}

/** Arrow-key / gamepad focus over a list of buttons (vertical by default). */
export class FocusList {
  i = 0;
  constructor(public items: Button[], private horizontal = false) { this.set(0); }
  set(i: number) {
    this.i = (i + this.items.length) % this.items.length;
    this.items.forEach((b, k) => (b.focused = k === this.i));
  }
  /** Handles up/down (or left/right) and confirm; returns true if used. */
  action(a: string): boolean {
    const prev = this.horizontal ? 'left' : 'up', next = this.horizontal ? 'right' : 'down';
    if (a === prev) { this.set(this.i - 1); audio.sfx('uiHover'); return true; }
    if (a === next) { this.set(this.i + 1); audio.sfx('uiHover'); return true; }
    if (a === 'confirm') { this.items[this.i].press(); return true; }
    return false;
  }
}
