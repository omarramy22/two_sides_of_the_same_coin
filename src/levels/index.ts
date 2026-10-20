import { parseLevel } from '../engine/parse';
import type { Level, LevelFile } from '../engine/types';

const files = import.meta.glob<LevelFile>('./*.json', { eager: true, import: 'default' });
const order = (id: string) => id.split('-').map(Number);

/** Every level, in play order ("1-2" < "1-10" < "2-1"). */
export const levels: Level[] = Object.values(files).map(parseLevel)
  .sort((a, b) => order(a.id)[0] - order(b.id)[0] || order(a.id)[1] - order(b.id)[1]);

export const chapterOf = (lv: Level) => order(lv.id)[0];

export const CHAPTER_NAMES = ['', 'The Surface', 'The Roots', 'The Stone', 'The Waters', 'The Dark', 'The Rim'];
