import { describe, it, expect, afterEach } from 'vitest';
import {
  stars,
  recordSolve,
  loadSave,
  writeSave,
  mergeSettings,
  getDefaultSave,
  SAVE_KEY,
  SaveData,
} from '../src/app/save';
import { DEFAULT_SETTINGS } from '../src/app/settings';

describe('stars() calculation', () => {
  it('returns 0 when unsolved (best is undefined)', () => {
    expect(stars(10, undefined)).toBe(0);
    expect(stars(undefined, undefined)).toBe(0);
  });

  it('returns 1 when par is undefined but level is solved', () => {
    expect(stars(undefined, 10)).toBe(1);
    expect(stars(undefined, 1)).toBe(1);
  });

  it('returns 3 when best is below par', () => {
    expect(stars(10, 8)).toBe(3);
    expect(stars(10, 1)).toBe(3);
  });

  it('returns 3 when best equals par ("Perfect Coin")', () => {
    expect(stars(10, 10)).toBe(3);
    expect(stars(5, 5)).toBe(3);
  });

  it('handles par + 30% boundary correctly (best <= ceil(par * 1.3))', () => {
    // par = 10, 10 * 1.3 = 13 (ceil = 13)
    expect(stars(10, 11)).toBe(2);
    expect(stars(10, 12)).toBe(2);
    expect(stars(10, 13)).toBe(2);
    expect(stars(10, 14)).toBe(1);

    // par = 7, 7 * 1.3 = 9.1 (ceil = 10)
    expect(stars(7, 8)).toBe(2);
    expect(stars(7, 9)).toBe(2);
    expect(stars(7, 10)).toBe(2);
    expect(stars(7, 11)).toBe(1);

    // par = 1, 1 * 1.3 = 1.3 (ceil = 2)
    expect(stars(1, 1)).toBe(3);
    expect(stars(1, 2)).toBe(2);
    expect(stars(1, 3)).toBe(1);
  });
});

describe('recordSolve()', () => {
  it('records initial solve for a level', () => {
    const initial = getDefaultSave();
    const updated = recordSolve(initial, '1-1', 12);

    expect(updated.best['1-1']).toBe(12);
    expect(initial.best['1-1']).toBeUndefined(); // immutability
  });

  it('keeps the minimum move count', () => {
    const s1 = getDefaultSave();
    const s2 = recordSolve(s1, '1-1', 15);
    expect(s2.best['1-1']).toBe(15);

    // Better score replaces best
    const s3 = recordSolve(s2, '1-1', 10);
    expect(s3.best['1-1']).toBe(10);

    // Worse score keeps minimum
    const s4 = recordSolve(s3, '1-1', 14);
    expect(s4.best['1-1']).toBe(10);
  });

  it('preserves other levels and settings', () => {
    let s: SaveData = getDefaultSave();
    s = recordSolve(s, '1-1', 5);
    s = recordSolve(s, '1-2', 8);

    expect(s.best['1-1']).toBe(5);
    expect(s.best['1-2']).toBe(8);
  });
});

describe('mergeSettings()', () => {
  it('fills missing fields with default values', () => {
    const partial = {
      master: 0.5,
      // music missing
      // sfx missing
      // muted missing
      // reducedMotion missing
    };

    const merged = mergeSettings(partial, DEFAULT_SETTINGS);
    expect(merged.master).toBe(0.5);
    expect(merged.music).toBe(DEFAULT_SETTINGS.music);
    expect(merged.sfx).toBe(DEFAULT_SETTINGS.sfx);
    expect(merged.muted).toBe(DEFAULT_SETTINGS.muted);
    expect(merged.reducedMotion).toBe(DEFAULT_SETTINGS.reducedMotion);
    expect(merged.highContrast).toBe(DEFAULT_SETTINGS.highContrast);
    expect(merged.judgeMode).toBe(DEFAULT_SETTINGS.judgeMode);
  });

  it('fills missing actions in keys with default keys', () => {
    const partial = {
      keys: {
        up: ['k'],
      },
    };

    const merged = mergeSettings(partial, DEFAULT_SETTINGS);
    expect(merged.keys.up).toEqual(['k']);
    expect(merged.keys.down).toEqual(DEFAULT_SETTINGS.keys.down);
    expect(merged.keys.left).toEqual(DEFAULT_SETTINGS.keys.left);
    expect(merged.keys.right).toEqual(DEFAULT_SETTINGS.keys.right);
    expect(merged.keys.undo).toEqual(DEFAULT_SETTINGS.keys.undo);
    expect(merged.keys.restart).toEqual(DEFAULT_SETTINGS.keys.restart);
    expect(merged.keys.hint).toEqual(DEFAULT_SETTINGS.keys.hint);
    expect(merged.keys.menu).toEqual(DEFAULT_SETTINGS.keys.menu);
    expect(merged.keys.confirm).toEqual(DEFAULT_SETTINGS.keys.confirm);
  });

  it('returns cloned defaults when input is invalid', () => {
    const merged = mergeSettings(null, DEFAULT_SETTINGS);
    expect(merged).toEqual(DEFAULT_SETTINGS);
    expect(merged.keys).not.toBe(DEFAULT_SETTINGS.keys);
  });
});

describe('loadSave() and writeSave()', () => {
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('returns defaults when globalThis.localStorage is undefined', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const data = loadSave();
    expect(data.best).toEqual({});
    expect(data.seenIntro).toBe(false);
    expect(data.settings.master).toBe(DEFAULT_SETTINGS.master);
  });

  it('returns defaults when getItem throws an exception', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('Access denied');
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: throwingStorage,
      writable: true,
      configurable: true,
    });

    const data = loadSave();
    expect(data.best).toEqual({});
    expect(data.seenIntro).toBe(false);
    expect(data.settings.keys.up).toEqual(DEFAULT_SETTINGS.keys.up);
  });

  it('returns defaults when stored JSON is garbage', () => {
    let storedValue: string | null = '{not-valid-json';
    const mockStorage = {
      getItem: () => storedValue,
      setItem: (_k: string, v: string) => {
        storedValue = v;
      },
      removeItem: () => {
        storedValue = null;
      },
      clear: () => {
        storedValue = null;
      },
      length: 1,
      key: () => SAVE_KEY,
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    expect(loadSave()).toEqual(getDefaultSave());

    // Non-object JSON
    storedValue = '123';
    expect(loadSave()).toEqual(getDefaultSave());

    // Array JSON
    storedValue = '[1, 2, 3]';
    expect(loadSave()).toEqual(getDefaultSave());
  });

  it('saves and reloads valid SaveData, merging partial settings', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    // Write partial JSON to simulate older save version
    const partialSave = {
      best: { '1-1': 7 },
      seenIntro: true,
      settings: {
        master: 0.2,
        keys: {
          up: ['i'],
        },
      },
    };
    store.set(SAVE_KEY, JSON.stringify(partialSave));

    const loaded = loadSave();
    expect(loaded.best['1-1']).toBe(7);
    expect(loaded.seenIntro).toBe(true);
    expect(loaded.seenGuides).toEqual([]);
    expect(loaded.settings.master).toBe(0.2);
    // Missing fields get defaults
    expect(loaded.settings.music).toBe(DEFAULT_SETTINGS.music);
    expect(loaded.settings.keys.up).toEqual(['i']);
    expect(loaded.settings.keys.down).toEqual(DEFAULT_SETTINGS.keys.down);

    // writeSave writes the full data
    writeSave(loaded);
    const reloaded = loadSave();
    expect(reloaded.best['1-1']).toBe(7);
    expect(reloaded.settings.master).toBe(0.2);
  });

  it('writeSave silently handles throwing storage without throwing', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('Quota exceeded');
      },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: throwingStorage,
      writable: true,
      configurable: true,
    });

    expect(() => writeSave(getDefaultSave())).not.toThrow();
  });
});
