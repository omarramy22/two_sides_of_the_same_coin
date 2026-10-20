import type { Mixer } from '../mixer';
import { C, Chapter3Theme, mk, type Score } from './ch3';

/**
 * Chapter 6, The Rim: the brightest tune, a fourth up (B-flat major / G minor). The melody keeps
 * circling its first note, the pivot the Tails inversion turns around, so the two halves keep
 * landing on the same pitches: they are close to whole.
 */
const F = C('F', [5, 9, 0], 'F1', ['F3', 'A3', 'C4']);
const Cmaj = C('C', [0, 4, 7], 'C2', ['E3', 'G3', 'C4']);
const Dm = C('Dm', [2, 5, 9], 'D1', ['D3', 'F3', 'A3']);
const Bb = C('Bb', [10, 2, 5], 'Bb1', ['D3', 'F3', 'Bb3']);
const Am = C('Am', [9, 0, 4], 'A1', ['E3', 'A3', 'C4']);

// Pivot A4 (degree 3, octave 4): the more the tune sits on it, the more the halves agree.
const PHRASE_A = mk([
  [0, 0, 0, 3, 4, '4n'], [0, 1, 0, 2, 4, '8n'], [0, 1, 0.5, 3, 4, '8n'], [0, 2, 0, 4, 4, '4n'], [0, 3, 0, 3, 4, '4n'],
  [1, 0, 0, 5, 5, '2n'], [1, 2, 0, 3, 4, '2n'],
  [2, 0, 0, 4, 4, '4n'], [2, 1, 0, 3, 4, '4n'], [2, 2, 0, 2, 4, '2n'],
  [3, 0, 0, 3, 4, '1m'],
  [4, 0, 0, 1, 4, '4n'], [4, 1, 0, 3, 4, '4n'], [4, 2, 0, 5, 5, '4n'], [4, 3, 0, 3, 4, '4n'],
  [5, 0, 0, 3, 4, '2n'], [5, 2, 0, 2, 4, '2n'],
  [6, 0, 0, 4, 4, '4n'], [6, 1, 0, 6, 5, '4n'], [6, 2, 0, 4, 4, '2n'],
  [7, 0, 0, 3, 4, '1m'],
  [8, 0, 0, 3, 4, '8n'], [8, 0, 0.5, 4, 4, '8n'], [8, 1, 0, 5, 5, '4n'], [8, 2, 0, 3, 4, '2n'],
  [9, 0, 0, 2, 4, '2n'], [9, 2, 0, 3, 4, '2n'],
  [10, 0, 0, 4, 4, '4n'], [10, 1, 0, 3, 4, '4n'], [10, 2, 0, 2, 4, '4n'], [10, 3, 0, 4, 4, '4n'],
  [11, 0, 0, 3, 4, '1m'],
  [12, 0, 0, 4, 4, '2n'], [12, 2, 0, 3, 4, '2n'],
  [13, 0, 0, 2, 4, '2n'], [13, 2, 0, 3, 4, '2n'],
  [14, 0, 0, 2, 4, '2n'], [14, 2, 0, 3, 4, '2n'],
  [15, 0, 0, 3, 4, '1m'],
]);
const PHRASE_B = mk([
  [0, 0, 0, 5, 5, '2n'], [0, 2, 0, 3, 4, '2n'],
  [1, 0, 0, 1, 5, '4n'], [1, 1, 0, 6, 5, '4n'], [1, 2, 0, 5, 5, '2n'],
  [2, 0, 0, 4, 4, '2n.'], [2, 3, 0, 3, 4, '4n'],
  [3, 0, 0, 2, 4, '1m'],
  [4, 0, 0, 3, 4, '4n'], [4, 1, 0, 5, 5, '4n'], [4, 2, 0, 1, 5, '2n'],
  [5, 0, 0, 7, 5, '2n'], [5, 2, 0, 5, 5, '2n'],
  [6, 0, 0, 6, 5, '4n'], [6, 1, 0, 4, 4, '4n'], [6, 2, 0, 3, 4, '2n'],
  [7, 0, 0, 2, 4, '1m'],
  [8, 0, 0, 3, 4, '2n'], [8, 2, 0, 4, 4, '2n'],
  [9, 0, 0, 5, 5, '2n'], [9, 2, 0, 3, 4, '2n'],
  [10, 0, 0, 4, 4, '2n'], [10, 2, 0, 2, 4, '2n'],
  [11, 0, 0, 3, 4, '1m'],
  [12, 0, 0, 3, 4, '4n'], [12, 1, 0, 3, 4, '4n'], [12, 2, 0, 3, 4, '2n'],
  [13, 0, 0, 3, 4, '2n'], [13, 2, 0, 3, 4, '2n'],
  [14, 0, 0, 2, 4, '2n'], [14, 2, 0, 4, 4, '2n'],
  [15, 0, 0, 3, 4, '1m'],
]);

const RIM: Score = {
  transpose: 5,
  bpm: 80,
  progression: [F, Am, Bb, F, F, Am, Bb, Cmaj, F, Dm, Bb, F, Bb, Cmaj, Bb, F],
  phrases: [PHRASE_A, PHRASE_B],
  drips: [[3, 2.5, 'C7'], [7, 2.5, 'A6'], [11, 2.5, 'F6'], [15, 2.5, 'C7']],
};

export class Chapter6Theme extends Chapter3Theme {
  constructor(mixer: Mixer) { super(mixer, RIM); }
}
