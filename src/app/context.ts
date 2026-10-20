// What every screen gets. Built once in main.ts.
import type { Application } from 'pixi.js';
import type { Level } from '../engine/types';
import type { Input } from '../input/input';
import type { Art } from '../render/sprites';
import type { SaveData } from './save';
import type { Scenes } from './scenes';
import type { Settings } from './settings';
import type { Story } from '../ui/story';

export interface Ctx {
  app: Application;
  scenes: Scenes;
  art: Art;
  levels: Level[];
  input: Input;
  save: SaveData;
  settings(): Settings;
  /** Replace settings (and apply volumes etc.), then write the save. */
  setSettings(s: Settings): void;
  /** Write `save` to storage (never throws). */
  persist(): void;
  go: {
    title(): void;
    album(chapter?: number): void;
    play(levelIndex: number): void;
    /** Push the settings overlay on top of whatever is showing. */
    settings(): void;
    /** Play a wordless story scene (intro, chapter vignette, ending), then `then()`. */
    story(s: Story, then: () => void): void;
  };
}
