import { Action, ACTIONS, DEFAULT_SETTINGS, Settings } from './settings';

export const SAVE_KEY = 'tsotsc.v1';

export interface SaveData {
  best: Record<string, number>;
  settings: Settings;
  seenIntro: boolean;
}

export function cloneSettings(s: Settings): Settings {
  const clonedKeys: Record<Action, string[]> = {
    up: [...s.keys.up],
    down: [...s.keys.down],
    left: [...s.keys.left],
    right: [...s.keys.right],
    undo: [...s.keys.undo],
    restart: [...s.keys.restart],
    hint: [...s.keys.hint],
    menu: [...s.keys.menu],
    confirm: [...s.keys.confirm],
  };

  return {
    ...s,
    keys: clonedKeys,
  };
}

export function mergeSettings(loaded: unknown, defaults: Settings = DEFAULT_SETTINGS): Settings {
  if (!loaded || typeof loaded !== 'object') {
    return cloneSettings(defaults);
  }

  const raw = loaded as Record<string, unknown>;

  const master =
    typeof raw.master === 'number' && Number.isFinite(raw.master) ? raw.master : defaults.master;
  const music =
    typeof raw.music === 'number' && Number.isFinite(raw.music) ? raw.music : defaults.music;
  const sfx = typeof raw.sfx === 'number' && Number.isFinite(raw.sfx) ? raw.sfx : defaults.sfx;
  const muted = typeof raw.muted === 'boolean' ? raw.muted : defaults.muted;
  const reducedMotion =
    typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : defaults.reducedMotion;
  const highContrast =
    typeof raw.highContrast === 'boolean' ? raw.highContrast : defaults.highContrast;
  const judgeMode = typeof raw.judgeMode === 'boolean' ? raw.judgeMode : defaults.judgeMode;

  const rawKeys =
    raw.keys && typeof raw.keys === 'object' ? (raw.keys as Record<string, unknown>) : {};
  const keys: Record<Action, string[]> = {
    up: [...defaults.keys.up],
    down: [...defaults.keys.down],
    left: [...defaults.keys.left],
    right: [...defaults.keys.right],
    undo: [...defaults.keys.undo],
    restart: [...defaults.keys.restart],
    hint: [...defaults.keys.hint],
    menu: [...defaults.keys.menu],
    confirm: [...defaults.keys.confirm],
  };

  for (const action of ACTIONS) {
    const actionKeys = rawKeys[action];
    if (Array.isArray(actionKeys)) {
      keys[action] = actionKeys.filter((k): k is string => typeof k === 'string');
    }
  }

  return {
    master,
    music,
    sfx,
    muted,
    reducedMotion,
    highContrast,
    judgeMode,
    keys,
  };
}

export function getDefaultSave(): SaveData {
  return {
    best: {},
    settings: cloneSettings(DEFAULT_SETTINGS),
    seenIntro: false,
  };
}

export function loadSave(): SaveData {
  try {
    if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
      return getDefaultSave();
    }
    const raw = globalThis.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return getDefaultSave();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return getDefaultSave();
    }

    const best: Record<string, number> = {};
    if (parsed.best && typeof parsed.best === 'object' && !Array.isArray(parsed.best)) {
      for (const [k, v] of Object.entries(parsed.best as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          best[k] = v;
        }
      }
    }

    const settings = mergeSettings(parsed.settings, DEFAULT_SETTINGS);
    const seenIntro = typeof parsed.seenIntro === 'boolean' ? parsed.seenIntro : false;

    return {
      best,
      settings,
      seenIntro,
    };
  } catch {
    return getDefaultSave();
  }
}

export function writeSave(d: SaveData): void {
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage !== null) {
      globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    }
  } catch {
    // writing silently does nothing
  }
}

export function recordSolve(d: SaveData, levelId: string, moves: number): SaveData {
  const currentBest = d.best[levelId];
  const newBest = currentBest !== undefined ? Math.min(currentBest, moves) : moves;
  return {
    ...d,
    best: {
      ...d.best,
      [levelId]: newBest,
    },
  };
}

export function stars(par: number | undefined, best: number | undefined): 0 | 1 | 2 | 3 {
  if (best === undefined || best === null) {
    return 0;
  }
  if (par === undefined || par === null) {
    return 1;
  }
  if (best <= par) {
    return 3;
  }
  if (best <= Math.ceil(par * 1.3)) {
    return 2;
  }
  return 1;
}
