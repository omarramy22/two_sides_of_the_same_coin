export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'undo'
  | 'restart'
  | 'hint'
  | 'menu'
  | 'confirm';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean; // volumes 0..1
  reducedMotion: boolean;
  highContrast: boolean;
  judgeMode: boolean;
  keys: Record<Action, string[]>; // KeyboardEvent.key values, case-insensitive for letters
}

export const ACTIONS: readonly Action[] = [
  'up',
  'down',
  'left',
  'right',
  'undo',
  'restart',
  'hint',
  'menu',
  'confirm',
];

function getPrefersReducedMotion(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
  return false;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.7,
  sfx: 0.8,
  muted: false,
  reducedMotion: getPrefersReducedMotion(),
  highContrast: false,
  judgeMode: false,
  keys: {
    up: ['ArrowUp', 'w'],
    down: ['ArrowDown', 's'],
    left: ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
    undo: ['z', 'Backspace'],
    restart: ['r'],
    hint: ['h'],
    menu: ['Escape'],
    confirm: ['Enter', ' '],
  },
};
