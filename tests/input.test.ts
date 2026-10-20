import { describe, it, expect } from 'vitest';
import { HoldRepeater, DirectionAction, Input } from '../src/input/input';
import { DEFAULT_SETTINGS, Action } from '../src/app/settings';

describe('HoldRepeater (pure hold-to-repeat helper)', () => {
  it('emits at 0 ms immediately on press', () => {
    const emitted: DirectionAction[] = [];
    const repeater = new HoldRepeater((a) => emitted.push(a));

    repeater.press('left');
    expect(emitted).toEqual(['left']);
  });

  it('emits nothing before 220 ms, then emits at 220 ms, then every 120 ms', () => {
    const emitted: DirectionAction[] = [];
    const repeater = new HoldRepeater((a) => emitted.push(a));

    repeater.press('up');
    expect(emitted).toEqual(['up']); // 0 ms emit

    repeater.update(100);
    expect(emitted).toEqual(['up']); // 100 ms: nothing new

    repeater.update(119);
    expect(emitted).toEqual(['up']); // 219 ms: still nothing new

    repeater.update(1);
    expect(emitted).toEqual(['up', 'up']); // 220 ms: 2nd emit

    repeater.update(60);
    expect(emitted).toEqual(['up', 'up']); // 280 ms: nothing new

    repeater.update(59);
    expect(emitted).toEqual(['up', 'up']); // 339 ms: nothing new

    repeater.update(1);
    expect(emitted).toEqual(['up', 'up', 'up']); // 340 ms (220 + 120): 3rd emit

    repeater.update(120);
    expect(emitted).toEqual(['up', 'up', 'up', 'up']); // 460 ms (340 + 120): 4th emit
  });

  it('releasing stops repeating', () => {
    const emitted: DirectionAction[] = [];
    const repeater = new HoldRepeater((a) => emitted.push(a));

    repeater.press('down');
    expect(emitted).toEqual(['down']);

    repeater.update(220);
    expect(emitted).toEqual(['down', 'down']);

    repeater.release('down');

    // Updating after release should emit nothing
    repeater.update(120);
    repeater.update(500);
    expect(emitted).toEqual(['down', 'down']);
  });

  it('switching held direction restarts the cycle', () => {
    const emitted: DirectionAction[] = [];
    const repeater = new HoldRepeater((a) => emitted.push(a));

    repeater.press('left');
    expect(emitted).toEqual(['left']); // 0 ms for left

    repeater.update(150); // 150 ms into left's 220 ms delay
    expect(emitted).toEqual(['left']);

    // Now press right while left is held
    repeater.press('right');
    expect(emitted).toEqual(['left', 'right']); // Emits right immediately at 0 ms

    // Must wait a fresh 220 ms for right to repeat
    repeater.update(219);
    expect(emitted).toEqual(['left', 'right']);

    repeater.update(1);
    expect(emitted).toEqual(['left', 'right', 'right']); // 220 ms for right

    repeater.update(120);
    expect(emitted).toEqual(['left', 'right', 'right', 'right']); // 340 ms for right
  });

  it('handles multiple directions held: most recently pressed wins and fallbacks restart cycle', () => {
    const emitted: DirectionAction[] = [];
    const repeater = new HoldRepeater((a) => emitted.push(a));

    repeater.press('left');
    expect(repeater.getActive()).toBe('left');
    expect(emitted).toEqual(['left']);

    repeater.press('down');
    expect(repeater.getActive()).toBe('down');
    expect(emitted).toEqual(['left', 'down']);

    // Release down while left is still held: falls back to left WITHOUT an extra move,
    // then resumes repeating after the initial delay.
    repeater.release('down');
    expect(repeater.getActive()).toBe('left');
    expect(emitted).toEqual(['left', 'down']);

    repeater.update(219);
    expect(emitted).toEqual(['left', 'down']);

    repeater.update(1);
    expect(emitted).toEqual(['left', 'down', 'left']);

    // Release left: stops
    repeater.release('left');
    expect(repeater.getActive()).toBeNull();

    repeater.update(500);
    expect(emitted).toEqual(['left', 'down', 'left']);
  });

  it('accumulates large dtMs correctly across multiple repeat intervals', () => {
    const emitted: DirectionAction[] = [];
    const repeater = new HoldRepeater((a) => emitted.push(a));

    repeater.press('up'); // 1 emit at 0 ms
    // Step by 460 ms (220 ms initial delay + 2 * 120 ms repeat intervals)
    repeater.update(460);
    expect(emitted).toEqual(['up', 'up', 'up', 'up']);
  });
});

describe('Input class', () => {
  function createMockElement(): HTMLElement {
    const style: Record<string, string> = {};
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();

    return {
      style,
      addEventListener(type: string, fn: (...args: unknown[]) => void) {
        const list = listeners.get(type) ?? [];
        list.push(fn);
        listeners.set(type, list);
      },
      removeEventListener(type: string, fn: (...args: unknown[]) => void) {
        const list = listeners.get(type) ?? [];
        listeners.set(
          type,
          list.filter((f) => f !== fn)
        );
      },
    } as unknown as HTMLElement;
  }

  it('sets touchAction to none on target element', () => {
    const mockEl = createMockElement();
    const input = new Input(mockEl, () => DEFAULT_SETTINGS);

    expect(mockEl.style.touchAction).toBe('none');
    expect(input.lastDevice).toBe('keyboard');
    input.destroy();
  });

  it('subscribes to actions with onAction and unsubscribes properly', () => {
    const mockEl = createMockElement();
    const input = new Input(mockEl, () => DEFAULT_SETTINGS);

    const received: Action[] = [];
    const unsubscribe = input.onAction((action) => {
      received.push(action);
    });

    input.press('confirm');
    input.press('undo');
    expect(received).toEqual(['confirm', 'undo']);

    unsubscribe();
    input.press('restart');
    expect(received).toEqual(['confirm', 'undo']);

    input.destroy();
  });
});
