import type { Dir, State } from '../engine/types';
import type { HintReply, HintRequest } from './worker';

/** `back` = how many undos to the newest solvable state (0 = solvable now, -1 = none found). */
export class Hinter {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private n = 0;
  ask(level: string, newestFirst: State[]): Promise<{ back: number; path: Dir[] }> {
    const id = ++this.n;
    return new Promise((done) => {
      const on = (e: MessageEvent<HintReply>) => {
        if (e.data.id !== id) return;
        this.worker.removeEventListener('message', on);
        done(e.data);
      };
      this.worker.addEventListener('message', on);
      this.worker.postMessage({ id, level, states: newestFirst } satisfies HintRequest);
    });
  }
  destroy() { this.worker.terminate(); }
}
