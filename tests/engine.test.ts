import { describe, expect, it } from 'vitest';
import { History } from '../src/engine/history';
import { parseLevel } from '../src/engine/parse';
import { gateJammed, gateOpen, isWon, tick } from '../src/engine/tick';
import type { Dir, GameEvent, Level, State } from '../src/engine/types';

const lvl = (heads: string[], tails: string[]): Level =>
  parseLevel({ id: 't', name: 't', role: 'develop', designNote: '', heads, tails, hints: [] });
const run = (lv: Level, moves: Dir[], s: State = lv.start) => moves.reduce((st, d) => tick(lv, st, d), s);
const xy = (lv: Level, i: number) => [i % lv.w, Math.floor(i / lv.w)];
const at = (lv: Level, x: number, y: number) => y * lv.w + x;

describe('parse (§2.2)', () => {
  const bad = (h: string[], t: string[]) => () => lvl(h, t);
  it('rejects mismatched sizes', () => expect(bad(['S.G'], ['L.G.'])).toThrow(/same size/));
  it('rejects missing or misplaced starts', () => {
    expect(bad(['..G'], ['L.G'])).toThrow(/one S/);
    expect(bad(['SLG'], ['..G'])).toThrow(/one S|one L/);
  });
  it('rejects two goals', () => expect(bad(['SGG'], ['L.G'])).toThrow(/one G/));
  it('rejects reserved letters as plates/gates', () => expect(bad(['SOG'], ['L.G'])).toThrow(/unknown glyph/));
  it('rejects plates split across worlds', () => expect(bad(['SaG', '..A'], ['LaG', '...'])).toThrow(/one world/));
  it('rejects orphan plates and gates', () => {
    expect(bad(['SaG'], ['L.G'])).toThrow(/no gate/);
    expect(bad(['SAG'], ['L.G'])).toThrow(/no plate/);
  });
  it('rejects unpaired seesaws', () => {
    expect(bad(['S/G'], ['L.G'])).toThrow(/seesaw/);
    expect(bad(['S/G'], ['L/G'])).toThrow(/seesaw/);
  });
  it('moves crates and starts out of the terrain', () => {
    const lv = lvl(['SC.G'], ['L..G']);
    expect(lv.start.tiles[0]).toBe('...G');
    expect(lv.start.objs[0]).toBe(' C  ');
  });
});

describe('movement (§4)', () => {
  it('one input moves both characters the same way', () => {
    const lv = lvl(['S...G'], ['L...G']);
    const s = run(lv, ['right']);
    expect([xy(lv, s.pos[0]), xy(lv, s.pos[1])]).toEqual([[1, 0], [1, 0]]);
  });
  it('a bump still uses the turn: walls desync the pair', () => {
    const lv = lvl(['S...G'], ['L#..G']);
    const ev: GameEvent[] = [];
    const s = tick(lv, lv.start, 'right', ev);
    expect(xy(lv, s.pos[0])).toEqual([1, 0]);
    expect(s.pos[1]).toBe(lv.start.pos[1]);
    expect(ev.map((e) => e.type)).toEqual(['move', 'bump']);
  });
  it('the board edge is a wall', () => {
    const lv = lvl(['S.G'], ['L.G']);
    expect(run(lv, ['left']).pos).toEqual(lv.start.pos);
  });
  it('a double bump is still a new state (counts as a turn in History)', () => {
    const lv = lvl(['S.G'], ['L.G']);
    const h = new History(lv.start);
    h.push(tick(lv, h.state, 'up'));
    expect(h.moves).toBe(1);
  });
  it('win needs both on goal at the end of the same turn', () => {
    const lv = lvl(['S.G'], ['.LG']);
    expect(isWon(run(lv, ['right']))).toBe(false);
    expect(isWon(run(lv, ['right', 'right']))).toBe(true);
  });
  it('a won state ignores input', () => {
    const lv = lvl(['SG.'], ['LG.']);
    const s = run(lv, ['right']);
    expect(tick(lv, s, 'right')).toBe(s);
  });
});

describe('pushing (§4.1)', () => {
  it('pushes one crate', () => {
    const lv = lvl(['SC..G'], ['L...G']);
    const s = run(lv, ['right']);
    expect(s.objs[0]).toBe('  C  ');
    expect(xy(lv, s.pos[0])).toEqual([1, 0]);
  });
  it('cannot push into a wall, another crate, or the edge', () => {
    for (const row of ['SC#.G', 'SCC.G', 'G.#SC']) {
      const lv = lvl([row], ['L...G']);
      expect(run(lv, ['right']).pos[0]).toBe(lv.start.pos[0]);
    }
  });
  it('a crate pushed into a pit fills it', () => {
    const lv = lvl(['SC^.G'], ['L...G']);
    const s = run(lv, ['right']);
    expect(s.tiles[0]).toBe('..,.G'); // ',' = crate sunk in the pit: floor, but stays visible
    expect(s.objs[0].trim()).toBe('');
    expect(s.fallen[0]).toBe(false);
  });
  it('cannot push into a closed gate or a raised seesaw end', () => {
    const lv = lvl(['SCA.G', 'a....'], ['L...G', '.....']);
    expect(run(lv, ['right']).pos[0]).toBe(lv.start.pos[0]);
    const lv2 = lvl(['SC|.G'], ['L./.G']);
    expect(run(lv2, ['right']).pos[0]).toBe(lv2.start.pos[0]);
  });
});

describe('falls (§4 step 7)', () => {
  it('walking into a pit falls, and a fallen state ignores input', () => {
    const lv = lvl(['S^.G'], ['L..G']);
    const s = run(lv, ['right']);
    expect(s.fallen).toEqual([true, false]);
    expect(tick(lv, s, 'left')).toBe(s);
    expect(isWon(s)).toBe(false);
  });
});

describe('plates and gates (§5)', () => {
  // Plate a in Heads. Gate A in Heads opens when pressed; gate A in Tails closes.
  const lv = lvl(['Sa.A.G'], ['L..A.G']);
  const gH = at(lv, 3, 0), gT = at(lv, 3, 0);
  it('unpressed: own-world gate closed, other-world gate open', () => {
    expect(gateOpen(lv, lv.start, 0, gH)).toBe(false);
    expect(gateOpen(lv, lv.start, 1, gT)).toBe(true);
  });
  it('pressed: own-world gate opens, other-world gate closes', () => {
    const s = run(lv, ['right']);
    expect(gateOpen(lv, s, 0, gH)).toBe(true);
    expect(gateOpen(lv, s, 1, gT)).toBe(false);
  });
  it('a crate on the plate counts as weight', () => {
    const lv2 = lvl(['SCa.A.G'], ['L...A.G']);
    const s = run(lv2, ['right', 'right']);
    expect(gateOpen(lv2, s, 0, at(lv2, 4, 0))).toBe(true);
  });
  it('closed gates block walking, judged at the start of the tick', () => {
    // Sol on the plate closes the Tails gate. Next tick Sol steps off (gate reopens),
    // but Lune's move into it is judged against the closed gate, so she bumps.
    const lv2 = lvl(['Sa..G'], ['L.A.G']);
    const s = run(lv2, ['right']);
    expect(gateOpen(lv2, s, 1, at(lv2, 2, 0))).toBe(false);
    const s2 = tick(lv2, s, 'right');
    expect(xy(lv2, s2.pos[1])).toEqual([1, 0]);
    expect(gateOpen(lv2, s2, 1, at(lv2, 2, 0))).toBe(true);
  });
  it('a gate cannot close onto an occupant: it jams, then closes once clear', () => {
    // Lune stands in gate A (open). Sol steps onto the plate: A in Tails wants to close but jams.
    const lv2 = lvl(['.Sa.G'], ['.LA.G']);
    const s = run(lv2, ['right']);
    expect(s.pos[1]).toBe(at(lv2, 2, 0)); // Lune walked into the open gate
    expect(gateJammed(lv2, s, 1, at(lv2, 2, 0))).toBe(true);
    const s2 = tick(lv2, s, 'right'); // Lune leaves, Sol leaves the plate too, so A reopens anyway
    expect(gateOpen(lv2, s2, 1, at(lv2, 2, 0))).toBe(true);
    // Hold the plate: Sol bumps (wall right of plate), Lune leaves, gate closes behind her.
    const lv3 = lvl(['.Sa#G'], ['.LA.G']);
    const t = run(lv3, ['right', 'right']);
    expect(xy(lv3, t.pos[1])).toEqual([3, 0]);
    expect(gateOpen(lv3, t, 1, at(lv3, 2, 0))).toBe(false);
  });
});

describe('seesaws (§6)', () => {
  // Lune walks on row 1, so she never touches the twin unless a test says so.
  const lv = lvl(['S|.G', '....'], ['./.G', 'L...']);
  it('stomping the raised end flips the pair; the stomper stays put', () => {
    const ev: GameEvent[] = [];
    const s = tick(lv, lv.start, 'right', ev);
    expect(s.pos[0]).toBe(lv.start.pos[0]);
    expect([s.tiles[0][1], s.tiles[1][1]]).toEqual(['/', '|']);
    expect(ev.some((e) => e.type === 'stomp')).toBe(true);
    expect(run(lv, ['right', 'right']).pos[0]).toBe(1); // Sol can now walk on
  });
  it('a character entering the lowered twin the same tick jams the flip', () => {
    const lv2 = lvl(['S|.G'], ['L/.G']);
    const ev: GameEvent[] = [];
    const s = tick(lv2, lv2.start, 'right', ev);
    expect(s.pos[1]).toBe(1);
    expect(s.tiles[0][1]).toBe('|');
    expect(ev.some((e) => e.type === 'stompJam')).toBe(true);
  });
  it('a crate on the lowered end locks the seesaw', () => {
    const s0: State = { ...lv.start, objs: [lv.start.objs[0], ' C      '] };
    const s = tick(lv, s0, 'right');
    expect(s.tiles[0][1]).toBe('|');
    expect(s.objs[1][1]).toBe('C');
  });
  it('a pushed crate cannot stomp', () => {
    const lv = lvl(['SC|.G'], ['L./.G']);
    const s = run(lv, ['right']);
    expect(s.tiles[0][2]).toBe('|');
  });
});

describe('the Tarnish (§5a)', () => {
  it('an awake Tarnish steps toward its own character after the characters move', () => {
    const lv = lvl(['S...@G'], ['L....G']);
    const s = tick(lv, lv.start, 'up'); // both bump; Tarnish steps left
    expect(s.objs[0]).toBe('   @  ');
  });
  it('greedy: larger axis first, tie means horizontal, falls back to the other axis', () => {
    const lv = lvl(['S....', '.....', '...@G'], ['L....', '.....', '....G']);
    expect(tick(lv, lv.start, 'up').objs[0].indexOf('@')).toBe(at(lv, 2, 2)); // |dx|=3 > |dy|=2
    const lv2 = lvl(['S....', '..#..', '..@.G'], ['L....', '.....', '....G']);
    // dx=-2, dy=-2: tie, horizontal first -> (1,2)
    expect(tick(lv2, lv2.start, 'up').objs[0].indexOf('@')).toBe(at(lv2, 1, 2));
    const lv3 = lvl(['S....', '.....', '.#@.G'], ['L....', '.....', '....G']);
    // horizontal blocked by wall, so vertical
    expect(tick(lv3, lv3.start, 'up').objs[0].indexOf('@')).toBe(at(lv3, 2, 1));
  });
  it('blocked by crates and other Tarnish; both stuck means it stays', () => {
    const lv = lvl(['SC@.G'], ['L...G']);
    expect(tick(lv, lv.start, 'up').objs[0]).toBe(' C@  ');
  });
  it('a Tarnish stepping onto the character catches it', () => {
    const lv = lvl(['S.@.G'], ['L...G']);
    const ev: GameEvent[] = [];
    const s = tick(lv, lv.start, 'right', ev);
    expect(s.fallen).toEqual([true, false]);
    expect(ev.some((e) => e.type === 'caught')).toBe(true);
    expect(isWon(s)).toBe(false);
  });
  it('walking into an awake Tarnish catches you', () => {
    const lv = lvl(['S@..G', '.....'], ['L#..G', '.....']);
    expect(tick(lv, lv.start, 'right').fallen[0]).toBe(true);
  });
  it('a sleeping Tarnish is a harmless wall that never moves', () => {
    const lv = lvl(['S?..G'], ['L...G']);
    const s = tick(lv, lv.start, 'right');
    expect(s.pos[0]).toBe(lv.start.pos[0]);
    expect(s.objs[0]).toBe(' ?   ');
    expect(s.fallen).toEqual([false, false]);
  });
  it('a Tarnish stepping into a pit fills it', () => {
    const lv = lvl(['S.^@G'], ['L...G']);
    const s = tick(lv, lv.start, 'up');
    expect(s.tiles[0]).toBe('..;.G'); // ';' = Tarnish sunk in the pit
    expect(s.objs[0].trim()).toBe('');
  });
  it('a Tarnish filling a pit cannot save a character who stepped into it', () => {
    const lv = lvl(['S^@.G'], ['L...G']);
    expect(tick(lv, lv.start, 'right').fallen[0]).toBe(true);
  });
  it('a Tarnish weighs down plates', () => {
    const lv = lvl(['S.a@G', '..A..'], ['L....', '....G']);
    const s = tick(lv, lv.start, 'up');
    expect(gateOpen(lv, s, 0, at(lv, 2, 1))).toBe(true);
  });
  it('aligning the halves flips every Tarnish, and none steps that tick', () => {
    const lv = lvl(['.S..@G', '......'], ['L....?', '.....G']);
    const ev: GameEvent[] = [];
    const s = tick(lv, lv.start, 'left', ev); // Sol to x=0, Lune bumps at x=0: now aligned
    expect(s.pos[0]).toBe(s.pos[1]);
    expect(s.objs[0]).toBe('    ?       ');
    expect(s.objs[1]).toBe('     @      ');
    // Staying aligned doesn't flip again; the newly awake one now steps.
    const s2 = tick(lv, s, 'left');
    expect(s2.objs[0]).toBe(s.objs[0]);
    expect(s2.objs[1].indexOf('@')).toBe(at(lv, 4, 0));
  });
  it('a filled pit is walkable floor', () => {
    const lv = lvl(['SC^.G'], ['L...G']);
    expect(run(lv, ['right', 'right']).fallen[0]).toBe(false);
  });
  it('crates cannot be pushed into a Tarnish', () => {
    const lv = lvl(['SC?.G'], ['L...G']);
    expect(tick(lv, lv.start, 'right').pos[0]).toBe(lv.start.pos[0]);
  });
});

describe('history', () => {
  it('undo and an undoable restart', () => {
    const lv = lvl(['S..G'], ['L..G']);
    const h = new History(lv.start);
    h.push(tick(lv, h.state, 'right'));
    h.push(tick(lv, h.state, 'right'));
    h.restart();
    expect(h.state).toBe(lv.start);
    expect(h.moves).toBe(0);
    h.undo();
    expect(h.moves).toBe(2);
    h.undo(); h.undo();
    expect(h.undo()).toBe(false);
    expect(h.state).toBe(lv.start);
  });
});
