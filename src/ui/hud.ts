// src/ui/hud.ts: In-game minimal HUD with move counter in an engraved coin, par, and touch buttons.
import { Container, Graphics, Text } from 'pixi.js';
import type { Ctx } from '../app/context';
import { audio } from '../audio/audio';
import { C, milled, text } from './style';

export interface HudCallbacks {
  undo(): void;
  restart(): void;
  hint(): void;
  menu(): void;
}

export interface HudInfo {
  id: string;
  name: string;
  moves: number;
  par?: number;
}

class CoinButton extends Container {
  private bg = new Graphics();
  private glyph: Text;
  private _hovered = false;

  constructor(glyphChar: string, readonly onPress: () => void, readonly size = 44) {
    super();
    this.glyph = text(glyphChar, Math.round(size * 0.52), C.ink);
    this.glyph.anchor.set(0.5);
    this.glyph.position.set(size / 2, size / 2);

    this.addChild(this.bg, this.glyph);
    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.on('pointerover', () => {
      this._hovered = true;
      audio.sfx('uiHover');
      this.draw();
    });
    this.on('pointerout', () => {
      this._hovered = false;
      this.draw();
    });
    this.on('pointertap', () => {
      audio.sfx('uiClick');
      this.onPress();
    });

    this.draw();
  }

  private draw() {
    const r = this.size / 2;
    const g = this.bg.clear();

    if (this._hovered) {
      g.circle(r, r, r + 3).fill({ color: C.goldLight, alpha: 0.35 });
    }

    // Outer coin disc
    g.circle(r, r, r - 2)
      .fill(this._hovered ? 0xf2c983 : C.gold)
      .stroke({ width: 1.8, color: C.ink });

    // Inner milled rim
    milled(g, r, r, r - 2, C.goldDark, 24, 2);

    // Inner concentric line
    g.circle(r, r, r - 6).stroke({ width: 0.8, color: C.goldDark, alpha: 0.7 });
  }
}

export class Hud extends Container {
  static readonly HEIGHT = 64;
  /** Phones get two rows: texts on top, buttons underneath. */
  static heightFor(w: number) { return w < 560 ? 108 : Hud.HEIGHT; }

  private bgGfx = new Graphics();

  // Left info: "1-3  Stepping Stone"
  private idText = text('', 18, C.gold);
  private nameText = text('', 22, C.goldLight);

  // Right info: "Moves [Coin 4] / Par 12"
  private movesLabel = text('Moves', 18, C.silverLight);
  private coinGfx = new Graphics();
  private coinMovesText = text('0', 16, C.ink);
  private parLabel = text('/ Par —', 18, C.silverDark);

  // Action buttons
  private btnUndo: CoinButton;
  private btnRestart: CoinButton;
  private btnHint: CoinButton;
  private btnMenu: CoinButton;
  private buttonsContainer = new Container();

  // Prompt caption
  private promptContainer = new Container();
  private promptBg = new Graphics();
  private promptText = text('', 16, C.goldLight);
  private promptTargetAlpha = 0;

  private tickerFn: () => void;

  constructor(
    private ctx: Ctx,
    cb: HudCallbacks,
  ) {
    super();

    this.addChild(this.bgGfx);

    // Left info
    this.idText.anchor.set(0, 0.5);
    this.nameText.anchor.set(0, 0.5);
    this.addChild(this.idText, this.nameText);

    // Right moves & par
    this.movesLabel.anchor.set(0, 0.5);
    this.coinMovesText.anchor.set(0.5, 0.5);
    this.parLabel.anchor.set(0, 0.5);
    this.addChild(this.movesLabel, this.coinGfx, this.coinMovesText, this.parLabel);

    // Four round coin icon buttons: undo ↶, restart ⟳, hint ?, menu ≡
    this.btnUndo = new CoinButton('↶', () => cb.undo());
    this.btnRestart = new CoinButton('⟳', () => cb.restart());
    this.btnHint = new CoinButton('?', () => cb.hint());
    this.btnMenu = new CoinButton('≡', () => cb.menu());

    this.buttonsContainer.addChild(this.btnUndo, this.btnRestart, this.btnHint, this.btnMenu);
    this.addChild(this.buttonsContainer);

    // Prompt caption
    this.promptText.anchor.set(0.5, 0.5);
    this.promptContainer.addChild(this.promptBg, this.promptText);
    this.promptContainer.alpha = 0;
    this.addChild(this.promptContainer);

    this.tickerFn = () => {
      if (Math.abs(this.promptContainer.alpha - this.promptTargetAlpha) > 0.01) {
        this.promptContainer.alpha += (this.promptTargetAlpha - this.promptContainer.alpha) * 0.12;
      } else {
        this.promptContainer.alpha = this.promptTargetAlpha;
      }
    };
    ctx.app.ticker.add(this.tickerFn);
  }

  set(info: HudInfo) {
    this.idText.text = info.id;
    this.nameText.text = info.name;
    this.coinMovesText.text = `${info.moves}`;

    const parStr = info.par !== undefined ? `${info.par}` : '—';
    this.parLabel.text = `/ Par ${parStr}`;

    this.layout(window.innerWidth, window.innerHeight);
  }

  /** Shows/hides a small fading caption centred under the HUD. */
  prompt(msg: string | null) {
    if (msg) {
      this.promptText.text = msg;
      const padX = 20;
      const padY = 8;
      const bw = this.promptText.width + padX * 2;
      const bh = this.promptText.height + padY * 2;

      this.promptBg
        .clear()
        .roundRect(-bw / 2, -bh / 2, bw, bh, 10)
        .fill({ color: 0x0e1028, alpha: 0.85 })
        .stroke({ width: 1.2, color: C.goldDark, alpha: 0.7 });

      this.promptTargetAlpha = 1;
    } else {
      this.promptTargetAlpha = 0;
    }
  }

  layout(w: number, h: number) {
    const margin = 16;
    const isPortrait = w < 540 || w < h;
    const H = Hud.heightFor(w), twoRows = H !== Hud.HEIGHT;

    this.bgGfx
      .clear()
      .rect(0, 0, w, H)
      .fill({ color: 0x0e1028, alpha: 0.75 })
      .moveTo(0, H)
      .lineTo(w, H)
      .stroke({ width: 1.2, color: C.goldDark, alpha: 0.5 });

    // Buttons layout on the right
    const btnSize = 44;
    const btnGap = 8;
    const btnBlockW = 4 * btnSize + 3 * btnGap;
    const btnY = twoRows ? 56 : (Hud.HEIGHT - btnSize) / 2;

    this.btnUndo.position.set(0, 0);
    this.btnRestart.position.set(btnSize + btnGap, 0);
    this.btnHint.position.set((btnSize + btnGap) * 2, 0);
    this.btnMenu.position.set((btnSize + btnGap) * 3, 0);

    const btnX = twoRows ? (w - btnBlockW) / 2 : w - margin - btnBlockW;
    this.buttonsContainer.position.set(btnX, btnY);

    // Left info layout
    const midY = twoRows ? 28 : Hud.HEIGHT / 2;
    this.idText.position.set(margin, midY);
    this.nameText.position.set(margin + this.idText.width + 12, midY);

    // Moves and par counter layout
    const coinR = 14;
    const rightMargin = twoRows ? w - margin : btnX - 16;

    this.parLabel.position.set(rightMargin - this.parLabel.width, midY);

    const coinCx = this.parLabel.x - coinR - 10;
    const coinCy = midY;

    this.coinGfx.clear();
    this.coinGfx.circle(coinCx, coinCy, coinR).fill(C.gold).stroke({ width: 1.6, color: C.ink });
    milled(this.coinGfx, coinCx, coinCy, coinR, C.goldDark, 18, 2);
    this.coinMovesText.position.set(coinCx, coinCy);

    this.movesLabel.position.set(coinCx - coinR - 10 - this.movesLabel.width, midY);

    // In very narrow portrait, adjust left name so it does not collide with moves counter
    if (isPortrait) {
      const maxLeftW = Math.max(80, this.movesLabel.x - margin - 20);
      if (this.nameText.x + this.nameText.width > this.movesLabel.x - 10) {
        this.nameText.style.fontSize = 16;
        if (this.nameText.width > maxLeftW) {
          // Truncate name with ellipsis
          let n = this.nameText.text;
          while (n.length > 4 && this.nameText.width > maxLeftW) {
            n = n.slice(0, -2);
            this.nameText.text = `${n}…`;
          }
        }
      }
    }

    // Prompt caption centered under HUD
    this.promptContainer.position.set(w / 2, H + 24);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]) {
    this.ctx.app.ticker.remove(this.tickerFn);
    super.destroy(options);
  }
}
