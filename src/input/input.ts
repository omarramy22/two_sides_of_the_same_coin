import { Action, Settings } from '../app/settings';

export type DirectionAction = 'up' | 'down' | 'left' | 'right';

export function isDirectionAction(action: Action): action is DirectionAction {
  return action === 'up' || action === 'down' || action === 'left' || action === 'right';
}

export class HoldRepeater {
  private heldStack: DirectionAction[] = [];
  private activeDirection: DirectionAction | null = null;
  private elapsedMs = 0;
  private hasRepeated = false;
  private readonly onEmit?: (action: DirectionAction) => void;
  public readonly initialDelayMs: number;
  public readonly repeatIntervalMs: number;

  constructor(
    onEmit?: (action: DirectionAction) => void,
    initialDelayMs = 220,
    repeatIntervalMs = 120
  ) {
    this.onEmit = onEmit;
    this.initialDelayMs = initialDelayMs;
    this.repeatIntervalMs = repeatIntervalMs;
  }

  press(dir: DirectionAction): DirectionAction[] {
    const idx = this.heldStack.indexOf(dir);
    if (idx !== -1) {
      this.heldStack.splice(idx, 1);
    }
    this.heldStack.push(dir);

    this.activeDirection = dir;
    this.elapsedMs = 0;
    this.hasRepeated = false;

    if (this.onEmit) {
      this.onEmit(dir);
    }
    return [dir];
  }

  release(dir: DirectionAction): void {
    const idx = this.heldStack.indexOf(dir);
    if (idx !== -1) {
      this.heldStack.splice(idx, 1);
    }

    if (this.activeDirection === dir) {
      if (this.heldStack.length > 0) {
        // Fall back to the still-held direction, but don't move now: releasing a key must never
        // cost a turn. It resumes repeating after the usual initial delay.
        this.activeDirection = this.heldStack[this.heldStack.length - 1];
        this.elapsedMs = 0;
        this.hasRepeated = false;
      } else {
        this.activeDirection = null;
        this.elapsedMs = 0;
        this.hasRepeated = false;
      }
    }
  }

  update(dtMs: number): DirectionAction[] {
    if (!this.activeDirection || dtMs <= 0) {
      return [];
    }

    const emitted: DirectionAction[] = [];
    this.elapsedMs += dtMs;

    if (!this.hasRepeated) {
      if (this.elapsedMs >= this.initialDelayMs) {
        this.elapsedMs -= this.initialDelayMs;
        this.hasRepeated = true;
        emitted.push(this.activeDirection);
        if (this.onEmit) {
          this.onEmit(this.activeDirection);
        }
        while (this.elapsedMs >= this.repeatIntervalMs) {
          this.elapsedMs -= this.repeatIntervalMs;
          emitted.push(this.activeDirection);
          if (this.onEmit) {
            this.onEmit(this.activeDirection);
          }
        }
      }
    } else {
      while (this.elapsedMs >= this.repeatIntervalMs) {
        this.elapsedMs -= this.repeatIntervalMs;
        emitted.push(this.activeDirection);
        if (this.onEmit) {
          this.onEmit(this.activeDirection);
        }
      }
    }

    return emitted;
  }

  step(dtMs: number): DirectionAction[] {
    return this.update(dtMs);
  }

  getActive(): DirectionAction | null {
    return this.activeDirection;
  }

  clear(): void {
    this.heldStack = [];
    this.activeDirection = null;
    this.elapsedMs = 0;
    this.hasRepeated = false;
  }
}

export class Input {
  public lastDevice: 'keyboard' | 'gamepad' | 'touch' = 'keyboard';

  private readonly listeners = new Set<(a: Action) => void>();
  private readonly repeater: HoldRepeater;
  private readonly heldKeys = new Set<string>();

  private rebindCapture: {
    action: Action;
    resolve: (key: string) => void;
    reject: (err: Error) => void;
  } | null = null;

  private prevGamepadButtons: boolean[] = [];
  private prevGamepadDirection: DirectionAction | null = null;

  private touchState: {
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
  } | null = null;

  constructor(
    private readonly target: HTMLElement,
    private readonly getSettings: () => Settings
  ) {
    if (this.target && this.target.style) {
      this.target.style.touchAction = 'none';
    }

    this.repeater = new HoldRepeater((action) => {
      this.emit(action);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('blur', this.handleBlur);
    }

    if (this.target && typeof this.target.addEventListener === 'function') {
      this.target.addEventListener('pointerdown', this.handlePointerDown);
      this.target.addEventListener('pointerup', this.handlePointerUp);
      this.target.addEventListener('pointercancel', this.handlePointerCancel);
    }
  }

  onAction(fn: (a: Action) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  press(a: Action): void {
    this.emit(a);
  }

  rebind(a: Action): Promise<string> {
    if (this.rebindCapture) {
      this.rebindCapture.reject(new Error('Replaced by new rebind request'));
      this.rebindCapture = null;
    }
    return new Promise<string>((resolve, reject) => {
      this.rebindCapture = { action: a, resolve, reject };
    });
  }

  update(dtSec: number): void {
    this.pollGamepad();
    this.repeater.update(dtSec * 1000);
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleBlur);
    }

    if (this.target && typeof this.target.removeEventListener === 'function') {
      this.target.removeEventListener('pointerdown', this.handlePointerDown);
      this.target.removeEventListener('pointerup', this.handlePointerUp);
      this.target.removeEventListener('pointercancel', this.handlePointerCancel);
    }

    if (this.rebindCapture) {
      this.rebindCapture.reject(new Error('Input destroyed'));
      this.rebindCapture = null;
    }

    this.repeater.clear();
    this.heldKeys.clear();
    this.listeners.clear();
  }

  private emit(a: Action): void {
    for (const fn of this.listeners) {
      try {
        fn(a);
      } catch {
        // Prevent listener errors from halting the loop
      }
    }
  }

  private getActionForKey(key: string): Action | undefined {
    const settings = this.getSettings();
    const lower = key.toLowerCase();
    for (const [action, keys] of Object.entries(settings.keys) as [Action, string[]][]) {
      for (const k of keys) {
        if (k.toLowerCase() === lower) {
          return action;
        }
      }
    }
    return undefined;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.rebindCapture) {
      event.preventDefault();
      const capture = this.rebindCapture;
      this.rebindCapture = null;
      if (event.key === 'Escape') {
        capture.reject(new Error('Rebind cancelled'));
      } else {
        this.lastDevice = 'keyboard';
        capture.resolve(event.key);
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const action = this.getActionForKey(event.key);
    if (!action) {
      return;
    }

    event.preventDefault();
    this.lastDevice = 'keyboard';

    if (event.repeat) {
      return;
    }

    const keyLower = event.key.toLowerCase();
    if (this.heldKeys.has(keyLower)) {
      return;
    }
    this.heldKeys.add(keyLower);

    if (isDirectionAction(action)) {
      this.repeater.press(action);
    } else {
      this.emit(action);
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const keyLower = event.key.toLowerCase();
    this.heldKeys.delete(keyLower);

    const action = this.getActionForKey(event.key);
    if (!action) {
      return;
    }

    if (isDirectionAction(action)) {
      const stillHeld = Array.from(this.heldKeys).some(
        (k) => this.getActionForKey(k) === action
      );
      if (!stillHeld) {
        this.repeater.release(action);
      }
    }
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.repeater.clear();
  };

  private pollGamepad(): void {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }

    let gamepads: (Gamepad | null)[] = [];
    try {
      gamepads = navigator.getGamepads() ?? [];
    } catch {
      return;
    }

    let pad: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        pad = gp;
        break;
      }
    }

    if (!pad) {
      if (this.prevGamepadDirection) {
        this.repeater.release(this.prevGamepadDirection);
        this.prevGamepadDirection = null;
      }
      this.prevGamepadButtons = [];
      return;
    }

    const isBtnDown = (btn?: GamepadButton): boolean => {
      if (!btn) return false;
      return btn.pressed || btn.value > 0.5;
    };

    const buttonActions: Record<number, Action> = {
      0: 'confirm',
      1: 'undo',
      2: 'hint',
      3: 'restart',
      9: 'menu',
    };

    for (const [btnIdxStr, action] of Object.entries(buttonActions)) {
      const btnIdx = Number(btnIdxStr);
      const down = isBtnDown(pad.buttons[btnIdx]);
      const wasDown = this.prevGamepadButtons[btnIdx] ?? false;
      if (down && !wasDown) {
        this.lastDevice = 'gamepad';
        this.emit(action);
      }
      this.prevGamepadButtons[btnIdx] = down;
    }

    let stickDir: DirectionAction | null = null;
    if (pad.axes && pad.axes.length >= 2) {
      const x = pad.axes[0];
      const y = pad.axes[1];
      const absX = Math.abs(x);
      const absY = Math.abs(y);
      if (absX >= 0.5 || absY >= 0.5) {
        if (absX >= absY) {
          stickDir = x < 0 ? 'left' : 'right';
        } else {
          stickDir = y < 0 ? 'up' : 'down';
        }
      }
    }

    let dpadDir: DirectionAction | null = null;
    if (isBtnDown(pad.buttons[12])) dpadDir = 'up';
    else if (isBtnDown(pad.buttons[13])) dpadDir = 'down';
    else if (isBtnDown(pad.buttons[14])) dpadDir = 'left';
    else if (isBtnDown(pad.buttons[15])) dpadDir = 'right';

    const currentDir = dpadDir ?? stickDir;

    if (currentDir !== this.prevGamepadDirection) {
      if (this.prevGamepadDirection) {
        this.repeater.release(this.prevGamepadDirection);
      }
      if (currentDir) {
        this.lastDevice = 'gamepad';
        this.repeater.press(currentDir);
      }
      this.prevGamepadDirection = currentDir;
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      return;
    }

    try {
      if (typeof this.target.setPointerCapture === 'function') {
        this.target.setPointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    this.touchState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: now,
    };
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !this.touchState) {
      return;
    }
    if (this.touchState.pointerId !== event.pointerId) {
      return;
    }

    try {
      if (typeof this.target.releasePointerCapture === 'function') {
        this.target.releasePointerCapture(event.pointerId);
      }
    } catch {
      // ignore
    }

    const dx = event.clientX - this.touchState.startX;
    const dy = event.clientY - this.touchState.startY;
    const dist = Math.hypot(dx, dy);
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const duration = now - this.touchState.startTime;

    this.touchState = null;

    if (dist < 10 && duration < 250) {
      return;
    }

    if (dist >= 30) {
      let dir: DirectionAction;
      if (Math.abs(dx) >= Math.abs(dy)) {
        dir = dx > 0 ? 'right' : 'left';
      } else {
        dir = dy > 0 ? 'down' : 'up';
      }
      this.lastDevice = 'touch';
      this.emit(dir);
    }
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    if (this.touchState && this.touchState.pointerId === event.pointerId) {
      this.touchState = null;
    }
  };
}
