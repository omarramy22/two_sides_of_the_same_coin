// src/ui/settings.ts: Overlay panel for volumes, accessibility, judge mode, and key rebindings.
import { Container, Graphics, Rectangle } from 'pixi.js';
import type { Ctx } from '../app/context';
import type { Scene } from '../app/scenes';
import { DEFAULT_SETTINGS, type Action } from '../app/settings';
import { audio } from '../audio/audio';
import { C, milled, text } from './style';

interface SettingRow {
  id: string;
  render(container: Container, focused: boolean, w: number): void;
  adjust?(dir: number): void;
  confirm?(): void;
  /** Pointer tap at local x in a row of width w (sliders). */
  click?(x: number, w: number): void;
}

const ACTION_DEFS: { action: Action; label: string }[] = [
  { action: 'up', label: 'Up' },
  { action: 'down', label: 'Down' },
  { action: 'left', label: 'Left' },
  { action: 'right', label: 'Right' },
  { action: 'confirm', label: 'Confirm' },
  { action: 'undo', label: 'Undo' },
  { action: 'restart', label: 'Restart' },
  { action: 'hint', label: 'Hint' },
  { action: 'menu', label: 'Menu' },
];

const KEY_NAMES: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space', Escape: 'Esc', Backspace: 'Backspace', Enter: 'Enter',
};
/** Friendly label for a KeyboardEvent.key value. */
const keyName = (k: string) => KEY_NAMES[k] ?? (k.length === 1 ? k.toUpperCase() : k);

export function createSettings(ctx: Ctx, onClose: () => void): Scene {
  const root = new Container();
  root.eventMode = 'static';

  let curW = window.innerWidth;
  let curH = window.innerHeight;

  const bgDim = new Graphics();
  const panelGfx = new Graphics();
  const rowsContainer = new Container();
  const maskGfx = new Graphics();
  rowsContainer.mask = maskGfx;

  const headerContainer = new Container();
  root.addChild(bgDim, panelGfx, rowsContainer, maskGfx, headerContainer);

  let focusedIndex = 0;
  let rebindingAction: Action | null = null;
  let rows: SettingRow[] = [];
  const rowContainers: Container[] = [];

  const ROW_H = 46;

  function buildRows(): SettingRow[] {
    const list: SettingRow[] = [];
    // Rows read ctx.settings() when used, never a snapshot: a snapshot goes stale after the first change.
    const s = ctx.settings;

    // 1-3. Volume sliders: arrows step by 10%, a click sets the value under the pointer
    const sliders: { key: 'master' | 'music' | 'sfx'; label: string }[] = [
      { key: 'master', label: 'Master Volume' },
      { key: 'music', label: 'Music Volume' },
      { key: 'sfx', label: 'SFX Volume' },
    ];
    for (const { key, label } of sliders) {
      const set = (v: number) => {
        ctx.setSettings({ ...s(), [key]: Math.max(0, Math.min(1, Math.round(v * 10) / 10)) });
        audio.sfx('uiHover');
        renderRows();
      };
      list.push({
        id: `vol-${key}`,
        render(c, focused, w) {
          drawSliderRow(c, label, s()[key], focused, w);
        },
        adjust(dir) {
          set(s()[key] + dir * 0.1);
        },
        click(x, w) {
          const { x: sx, w: sw } = sliderGeom(w);
          set((x - sx) / sw);
        },
      });
    }
    // 4. Mute all toggle
    list.push({
      id: 'toggle-mute',
      render(c, focused, w) {
        drawToggleRow(c, 'Mute All', !!s().muted, focused, w);
      },
      confirm() {
        ctx.setSettings({ ...ctx.settings(), muted: !s().muted });
        audio.sfx('uiClick');
        renderRows();
      },
      adjust() {
        this.confirm?.();
      },
    });

    // 5. Reduced motion toggle
    list.push({
      id: 'toggle-motion',
      render(c, focused, w) {
        drawToggleRow(c, 'Reduced Motion', !!s().reducedMotion, focused, w);
      },
      confirm() {
        ctx.setSettings({ ...ctx.settings(), reducedMotion: !s().reducedMotion });
        audio.sfx('uiClick');
        renderRows();
      },
      adjust() {
        this.confirm?.();
      },
    });

    // 6. High-contrast outlines toggle
    list.push({
      id: 'toggle-contrast',
      render(c, focused, w) {
        drawToggleRow(c, 'High-contrast Outlines', !!s().highContrast, focused, w);
      },
      confirm() {
        ctx.setSettings({ ...ctx.settings(), highContrast: !s().highContrast });
        audio.sfx('uiClick');
        renderRows();
      },
      adjust() {
        this.confirm?.();
      },
    });

    // 7. Judge mode (unlock every level) toggle
    list.push({
      id: 'toggle-judge',
      render(c, focused, w) {
        drawToggleRow(c, 'Judge Mode (Unlock All)', !!s().judgeMode, focused, w);
      },
      confirm() {
        ctx.setSettings({ ...ctx.settings(), judgeMode: !s().judgeMode });
        audio.sfx('uiClick');
        renderRows();
      },
      adjust() {
        this.confirm?.();
      },
    });

    // 8. Key rebind rows (one per action)
    const keyMap = s().keys ?? DEFAULT_SETTINGS.keys;
    for (const def of ACTION_DEFS) {
      const isRebinding = rebindingAction === def.action;
      const keyList = keyMap[def.action] ?? [];
      const valStr = isRebinding ? 'Press a key… (Esc to cancel)' : keyList.map(keyName).join(', ') || '—';

      list.push({
        id: `key-${def.action}`,
        render(c, focused, w) {
          drawActionRow(c, def.label, valStr, isRebinding, focused, w);
        },
        confirm() {
          if (rebindingAction) return;
          rebindingAction = def.action;
          renderRows();

          ctx.input
            .rebind(def.action)
            .then((newKey) => {
              rebindingAction = null;
              if (newKey && newKey.toLowerCase() !== 'escape') {
                const curKeys = ctx.settings().keys?.[def.action] ?? DEFAULT_SETTINGS.keys[def.action] ?? [];
                const deduped = [newKey, ...curKeys.filter((k) => k.toLowerCase() !== newKey.toLowerCase())];
                ctx.setSettings({
                  ...ctx.settings(),
                  keys: {
                    ...(ctx.settings().keys ?? DEFAULT_SETTINGS.keys),
                    [def.action]: deduped,
                  },
                });
                audio.sfx('uiClick');
              }
              initRows();
            })
            .catch(() => {
              rebindingAction = null;
              initRows();
            });
        },
      });
    }

    // 9. Reset keys row
    list.push({
      id: 'reset-keys',
      render(c, focused, w) {
        drawButtonRow(c, 'Reset Keys to Default', focused, w, C.coral);
      },
      confirm() {
        ctx.setSettings({
          ...ctx.settings(),
          keys: { ...DEFAULT_SETTINGS.keys },
        });
        audio.sfx('uiClick');
        initRows();
      },
    });

    // 10. Back row
    list.push({
      id: 'back',
      render(c, focused, w) {
        drawButtonRow(c, 'Back', focused, w, C.gold);
      },
      confirm() {
        audio.sfx('uiClick');
        onClose();
      },
    });

    return list;
  }

  // Row Drawing Helpers
  const sliderGeom = (w: number) => {
    const sw = Math.min(160, w * 0.35);
    return { x: w - sw - 70, w: sw };
  };

  function drawSliderRow(c: Container, label: string, val: number, focused: boolean, w: number) {
    c.removeChildren();
    const g = new Graphics();
    c.addChild(g);

    if (focused) {
      g.roundRect(0, 2, w, ROW_H - 4, 8).fill({ color: C.goldLight, alpha: 0.15 });
    }

    const t = text(label, 18, focused ? C.goldLight : C.gold);
    t.anchor.set(0, 0.5);
    t.position.set(16, ROW_H / 2);
    c.addChild(t);

    const { x: sliderX, w: sliderW } = sliderGeom(w);
    const sliderY = ROW_H / 2;

    // Groove
    g.roundRect(sliderX, sliderY - 4, sliderW, 8, 4).fill(0x0e1028).stroke({ width: 1.2, color: C.silverDark });

    // Filled groove
    if (val > 0) {
      g.roundRect(sliderX, sliderY - 4, sliderW * val, 8, 4).fill(C.goldDark);
    }

    // Coin knob
    const knobX = sliderX + sliderW * val;
    g.circle(knobX, sliderY, 10).fill(C.gold).stroke({ width: 1.6, color: C.ink });
    milled(g, knobX, sliderY, 10, C.goldDark, 20, 2);

    // Value text
    const pct = `${Math.round(val * 100)}%`;
    const vText = text(pct, 16, C.silverLight);
    vText.anchor.set(1, 0.5);
    vText.position.set(w - 16, ROW_H / 2);
    c.addChild(vText);
  }

  function drawToggleRow(c: Container, label: string, val: boolean, focused: boolean, w: number) {
    c.removeChildren();
    const g = new Graphics();
    c.addChild(g);

    if (focused) {
      g.roundRect(0, 2, w, ROW_H - 4, 8).fill({ color: C.goldLight, alpha: 0.15 });
    }

    const t = text(label, 18, focused ? C.goldLight : C.gold);
    t.anchor.set(0, 0.5);
    t.position.set(16, ROW_H / 2);
    c.addChild(t);

    const stateText = text(val ? 'ON' : 'OFF', 18, val ? C.goldLight : C.silverDark);
    stateText.anchor.set(1, 0.5);
    stateText.position.set(w - 16, ROW_H / 2);
    c.addChild(stateText);

    // Coin toggle icon
    const iconX = w - 110; // left of the right-aligned ON/OFF label
    const iconY = ROW_H / 2;
    g.roundRect(iconX, iconY - 10, 36, 20, 10).fill(val ? C.teal : 0x0e1028).stroke({ width: 1.4, color: C.ink });
    const knobX = val ? iconX + 26 : iconX + 10;
    g.circle(knobX, iconY, 8).fill(val ? C.gold : C.silverDark).stroke({ width: 1.2, color: C.ink });
  }

  function drawActionRow(c: Container, label: string, val: string, isRebinding: boolean, focused: boolean, w: number) {
    c.removeChildren();
    const g = new Graphics();
    c.addChild(g);

    if (focused) {
      g.roundRect(0, 2, w, ROW_H - 4, 8).fill({ color: C.goldLight, alpha: 0.15 });
    }

    const t = text(label, 18, focused ? C.goldLight : C.gold);
    t.anchor.set(0, 0.5);
    t.position.set(16, ROW_H / 2);
    c.addChild(t);

    const valColor = isRebinding ? C.coral : focused ? C.goldLight : C.silverLight;
    const vText = text(val, 16, valColor);
    vText.anchor.set(1, 0.5);
    vText.position.set(w - 16, ROW_H / 2);
    c.addChild(vText);
  }

  function drawButtonRow(c: Container, label: string, focused: boolean, w: number, color: number) {
    c.removeChildren();
    const g = new Graphics();
    c.addChild(g);

    if (focused) {
      g.roundRect(0, 2, w, ROW_H - 4, 8).fill({ color, alpha: 0.2 });
      g.roundRect(4, 4, w - 8, ROW_H - 8, 6).stroke({ width: 1.6, color });
    }

    const t = text(label, 18, focused ? C.goldLight : color);
    t.anchor.set(0.5);
    t.position.set(w / 2, ROW_H / 2);
    c.addChild(t);
  }

  function initRows() {
    rows = buildRows();
    rowsContainer.removeChildren();
    rowContainers.length = 0;


    rows.forEach((r, idx) => {
      const c = new Container();
      c.position.set(0, idx * ROW_H);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      // Rows redraw their children on hover; hit-testing the row itself keeps a tap from losing its target.
      c.interactiveChildren = false;
      c.on('pointerover', () => {
        if (!rebindingAction) {
          focusedIndex = idx;
          renderRows();
          audio.sfx('uiHover');
        }
      });
      c.on('pointertap', (e) => {
        if (!rebindingAction) {
          focusedIndex = idx;
          if (r.click) r.click(e.getLocalPosition(c).x, Math.min(560, curW - 32));
          else r.confirm?.();
        }
      });
      rowContainers.push(c);
      rowsContainer.addChild(c);
    });

    renderRows();
  }

  function renderRows() {
    const panelW = Math.min(560, curW - 32);
    rows.forEach((r, idx) => {
      const c = rowContainers[idx];
      if (c) {
        c.hitArea = new Rectangle(0, 0, panelW, ROW_H);
        r.render(c, idx === focusedIndex, panelW);
      }
    });

    updateScroll();
  }

  function updateScroll() {
    const panelH = Math.min(curH - 64, 620);
    const viewportH = panelH - 80;
    const totalH = rows.length * ROW_H;

    if (totalH <= viewportH) {
      rowsContainer.y = headerHeight;
      return;
    }

    const focusedY = focusedIndex * ROW_H;
    let targetY = headerHeight - (focusedY - viewportH / 2 + ROW_H / 2);
    const minY = headerHeight - (totalH - viewportH);
    const maxY = headerHeight;

    if (targetY < minY) targetY = minY;
    if (targetY > maxY) targetY = maxY;

    rowsContainer.y = targetY;
  }

  let headerHeight = 70;

  function layout(w: number, h: number) {
    curW = w;
    curH = h;

    // 1. Dim background
    bgDim.clear().rect(0, 0, w, h).fill({ color: 0x0e1028, alpha: 0.6 });

    // 2. Central plaque panel
    const panelW = Math.min(560, w - 32);
    const panelH = Math.min(h - 48, 640);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    panelGfx.clear();
    // Night velvet fill
    panelGfx.roundRect(panelX, panelY, panelW, panelH, 16).fill(0x141838).stroke({ width: 2.2, color: C.gold });

    // Guilloche inner border
    panelGfx.roundRect(panelX + 6, panelY + 6, panelW - 12, panelH - 12, 12).stroke({ width: 1, color: C.goldDark, alpha: 0.7 });

    // Header: "SETTINGS"
    headerContainer.removeChildren();
    const titleText = text('SETTINGS', 28, C.gold);
    titleText.anchor.set(0.5, 0);
    titleText.position.set(w / 2, panelY + 18);
    headerContainer.addChild(titleText);

    // Decorative separator under header
    const sepGfx = new Graphics();
    sepGfx
      .moveTo(panelX + 24, panelY + 56)
      .lineTo(panelX + panelW - 24, panelY + 56)
      .stroke({ width: 1, color: C.goldDark, alpha: 0.6 });
    headerContainer.addChild(sepGfx);

    // Mask for scrolling rows
    headerHeight = panelY + 64;
    const viewH = panelH - 74;
    maskGfx.clear().rect(panelX, headerHeight, panelW, viewH).fill(0xffffff);

    rowsContainer.x = panelX;
    renderRows();
  }

  initRows();

  return {
    root,
    enter() {
      layout(window.innerWidth, window.innerHeight);
    },
    exit() {
      rebindingAction = null;
    },
    resize(w: number, h: number) {
      layout(w, h);
    },
    onAction(a: Action) {
      if (rebindingAction) {
        return true;
      }

      if (a === 'menu') {
        audio.sfx('uiClick');
        onClose();
        return true;
      }
      if (a === 'up') {
        if (focusedIndex > 0) {
          focusedIndex--;
          audio.sfx('uiHover');
          renderRows();
        }
        return true;
      }
      if (a === 'down') {
        if (focusedIndex < rows.length - 1) {
          focusedIndex++;
          audio.sfx('uiHover');
          renderRows();
        }
        return true;
      }
      if (a === 'left') {
        rows[focusedIndex]?.adjust?.(-1);
        return true;
      }
      if (a === 'right') {
        rows[focusedIndex]?.adjust?.(1);
        return true;
      }
      if (a === 'confirm') {
        rows[focusedIndex]?.confirm?.();
        return true;
      }

      return false;
    },
  };
}
