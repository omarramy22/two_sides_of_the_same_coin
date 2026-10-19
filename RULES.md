# RULES.md: exact game rules

This file is the contract for `src/engine/`. Every rule here gets a unit test in Phase 1.
Where it differs from SPEC.md, the difference is listed in §11 and needs sign-off.

---

## 1. Board

- A level has two worlds, **Heads** (H) and **Tails** (T), with **identical dimensions** (7×5 to 11×8).
- Coordinates are `(x, y)`, origin top-left. The tile at `(x, y)` in H and the tile at `(x, y)` in T are **twins**.
- Each world has exactly one character: **Sol** in H, **Lune** in T. Characters never interact directly; worlds only talk through links (§5–§9).
- The board edge is an implicit wall.

## 2. Level file format

`src/levels/<chapter>-<n>.json`

```json
{
  "id": "1-1",
  "name": "Two Paths",
  "role": "introduce",
  "designNote": "Aha: ...",
  "heads": ["...rows..."],
  "tails": ["...rows..."],
  "hints": ["nudge", "key idea", null]
}
```

- `role` is one of `introduce | develop | twist | combine | capstone | finale`. It controls the anti-mash threshold (§10).
- `hints[2]` is always `null`: tier 3 is the solver.
- The spec's `links` field is dropped: letters already encode every link (§5), and a parser that reads two sources of truth is a bug farm.
- One glyph per cell, so objects (crates, lanterns) and characters always start on plain floor. *shortcut: no "crate on plate" start; add a glyph if a level needs it.*

### 2.1 Legend

| Glyph | Meaning | Chapter |
|---|---|---|
| `#` | wall | 1 |
| `.` | floor | 1 |
| `S` | Sol start (H only) | 1 |
| `L` | Lune start (T only) | 1 |
| `G` | goal (one per world) | 1 |
| `C` | crate | 1 |
| `^` | pit | 1 |
| `a`…`z` | pressure plate for link *x* | 2 |
| `A`…`Z` | gate for link *X* | 2 |
| `/` | seesaw end, lowered (floor) | 2 |
| `|` | seesaw end, raised (wall) | 2 |
| `*` | lantern | 3 |
| `=` | mirage: solid only while **lit** in its own world | 3 |
| `-` | shadow bridge: solid only while **shadowed** in its own world | 3 |
| `~` | basin tile, flooded | 4 |
| `_` | basin tile, dry | 4 |
| `&` | sluice | 4 |
| `%` | cracked floor | 5 |
| `O` | weight altar (Weight → Weightless) | 5 |
| `Q` | light altar (Shadow → Light-bearer) | 5 |
| `$` | wish altar (finale) | 6 |
| `M` | mirror shrine | 6 |
| `@` | Tarnish, awake (§5a) | 1 |
| `?` | Tarnish, asleep (§5a) | 1 |

**Reserved letters:** `C G L M O Q S` (both cases) are never link letters. Links use the other 19 letters.

### 2.2 Parse-time validation (a level that fails these doesn't load)

1. Both worlds have the same width and height; every row in a world has the same length.
2. Exactly one `S` in H, none in T. Exactly one `L` in T, none in H. Exactly one `G` per world (`$` replaces `G` in a `finale` level).
3. Every plate letter *x* has at least one gate `X` (in either world) and all plates *x* are in **one** world (the link's *owner* world). Every gate `X` has at least one plate *x*.
4. Seesaws: a coordinate holding a seesaw holds one in **both** worlds, exactly one `/` and one `|`.
5. Basins: the basin mask is identical in both worlds, and each basin coordinate is `~` in exactly one world and `_` in the other.
6. Each sluice is orthogonally adjacent to exactly one basin region (§8) in its own world.
7. Only reserved glyphs appear.

## 3. State

Everything the solver hashes. Anything not listed is either static (from the level) or **derived** from this.

| Field | Notes |
|---|---|
| `pos[H]`, `pos[T]` | character positions |
| `objects[H]`, `objects[T]` | crate, lantern and Tarnish (awake/asleep) positions |
| `terrain changes` | pits filled, cracked floors broken, rafts created, altars used |
| `seesaw[coord]` | which world's end is raised |
| `water[coord]` | which world each basin coordinate is flooded in |
| `coin[c]`, `weightless[c]`, `lightBearer[c]` | per character |
| `mirror` | Lune's left/right is flipped |
| `fallen[c]` | set when a character falls (§4 step 7) or is caught (§5a); terminal |

Derived, never stored: gate open/closed/jammed (§5), light and shadow (§7), plate pressed.
Turn count is **not** part of the state (it's in the undo history).

## 4. The tick

`tick(state, dir) → state`. `dir ∈ {up, down, left, right}`. Pure and deterministic. A fallen or won state ignores input.

1. **Intent.** Sol's direction is `dir`. Lune's direction is `dir`, with left↔right swapped if `mirror` is set.
2. **Movement**, each world independently, all checks against the **start-of-tick** state (gates, light, water, seesaws as they were before this input):
   - Target is the board edge → bump.
   - Target has an awake Tarnish → the character moves there and is **caught** (§5a).
   - Target has a sleeping Tarnish → bump (it can't be pushed).
   - Target has a crate or lantern → **push** (§4.1). If the push fails, bump.
   - Target is a raised seesaw end → **stomp** if weighted (§6), else bump.
   - Target is wall, closed gate, flooded basin (no raft) → bump.
   - Otherwise the character moves. Entering a pit, a void bridge, or (if weighted) cracked floor is allowed; it leads to a fall in step 7. A fall into a pit is decided on entry: nothing later in the tick (such as a Tarnish filling that pit) saves the character. Entering weighted onto `%` turns it into `^` now.
   - After both worlds have moved, in this order: **mirror shrines** (each character that *entered* an `M` this tick toggles `mirror`; two entries in one tick cancel out); **altars** (§9).
   - Then the **Tarnish** act (§5a): flip on alignment, otherwise the awake ones step; then catches.
3. **Plates.** Plate *x* is pressed if a crate, a lantern, a Tarnish (awake or asleep) or a weighted character is on it. Link *x* is **active** if any plate *x* is pressed.
4. **Links.** Gates are re-derived (§5). Stomps queued in step 2 are applied (§6). Both use **post-movement** occupancy.
5. **Light** is re-derived (§7).
6. **Water** flows one step (§8).
7. **Falls.** A character falls if its tile is a pit `^` or a void bridge. An object on a void bridge falls and is removed.
8. **Win.** Neither character has fallen or been caught, and Sol and Lune are both on their goal (`G`). In a finale level the condition is §9.3 instead.

A bump still uses the turn: both characters always spend the same input. This is how desync works. Water still flows on a turn where both characters bump; bumping is how you wait.

### 4.1 Pushing

A character pushes exactly one object one tile in its move direction. The push fails (character bumps, nothing moves) if the tile beyond is: board edge, wall, closed gate, raised seesaw end, another object, a void bridge, or (for a lantern) a flooded basin.

Where the pushed object lands:
- Pit `^` or cracked `%` → the object falls in and fills it. The tile becomes floor, the object is removed.
- Flooded basin `~` (crates only) → the crate becomes a **raft**: permanent walkable terrain on that coordinate, no longer an object, unaffected by later water changes.
- Anything else (floor, plate, goal, altar, shrine, sluice, open/jammed gate, lowered seesaw end, dry basin, solid bridge) → the object sits there.

A weightless character can still push (pushing isn't weight).

## 5. Plates and gates (inverse links)

For link *x* with owner world W:
- A gate `X` **in W** wants to be **open** iff link *x* is active.
- A gate `X` **in the other world** wants to be **open** iff link *x* is **inactive**.

So one press opens *x*'s gates on one side and closes them on the other. That's the conservation law.

A gate that wants to close but has a character or object on it **stays open and is jammed** (strain animation, sparks). It closes on the first tick its tile is clear. Because of this, gate state is a pure function of (link active, tile occupied) and never needs storing.

Timing examples (plate *a* in Heads, gate `A` in Tails):
- Sol steps **onto** *a* while Lune steps into `A`. Movement (step 2) sees `A` open, so Lune enters. Step 4: `A` wants to close but Lune is on it, so it jams.
- Sol steps **off** *a* while Lune walks at `A`. Movement sees `A` closed, so Lune bumps; `A` opens at step 4. A gate that opens this tick can't be walked through this tick.

## 5a. The Tarnish (enemies)

Rusted wish-coins that hunt the half-coin pendants. Each body lives in one world and is **awake** (`@`) or **asleep** (`?`). Levels pair them across worlds by convention (one awake, its twin asleep), but the engine treats every body independently.

**Alignment flip.** If, after the characters move (step 2), Sol and Lune stand on the same coordinates and did **not** at the start of the tick, every Tarnish in both worlds flips: awake ↔ asleep. On a flip tick **no Tarnish steps**. Staying aligned doesn't flip again; you have to separate and re-align.

**Stepping** (when there's no flip). Each awake Tarnish, in reading order (Heads first, then Tails; top-to-bottom, left-to-right as at the start of the tick), takes one step toward its own world's character:
- Let `dx`, `dy` be the distance to the character. The **primary** axis is the one with the larger `|d|` (a tie means horizontal); the other axis is secondary.
- Try the primary step, then the secondary step (only on an axis with `d ≠ 0`). Take the first one that isn't blocked; if both are blocked, stay.
- **Blocked by:** board edge, wall, closed gate, raised seesaw end (all as at the start of the tick), crates, lanterns, and other Tarnish (at their current positions, so earlier movers have already moved). Tarnish never push or stomp.
- **Pits:** a Tarnish that steps into a pit falls in and **fills it** (the tile becomes floor), exactly like a crate. That's the lure.
- It's greedy on purpose: predictable, and lurable around corners.

**Caught.** A character is caught (`fallen` is set; the game offers a rewind) if it walks into an awake Tarnish (checked right after the characters move, before any flip), or if an awake Tarnish steps onto it.

**Asleep** Tarnish are solid and harmless: characters bump into them, crates can't be pushed into them, other Tarnish are blocked by them. Like any body they still press plates and still jam gates and seesaws.

Why the flip fits the theme: lining the halves up is the closest the coin gets to whole, so its light calms one side's Tarnish and wakes the other side's. Calming a threat for one side is never free.

## 6. Seesaws

A seesaw is a twin pair: one end in H, one in T, same coordinates. Exactly one end is raised (a wall); the other is lowered (floor).

**Stomp:** a weighted character that moves into a raised end doesn't enter it. It pushes the end down instead and stays where it is. The flip is queued and applied in step 4: the stomped end lowers and its twin rises, **unless the twin tile is occupied** after movement (character or object). Then the flip fails (jammed, strain animation) and nothing changes.

Consequences:
- Weight on the lowered end (a crate, either character) holds the seesaw down; that's how you lock one.
- Lune entering the lowered end on the same tick that Sol stomps the raised one blocks the flip.
- A weightless character or a pushed object can't stomp; they treat the raised end as a wall.
- A crate on a lowered end stays put when the flip is blocked; it never gets lifted.

## 7. Light and shadow

**Sources** in a world: every lantern in that world (own tile + beams in the 4 orthogonal directions), and a light-bearer character (own tile + 4 orthogonal neighbours, no beams).

**Beams** stop at (and don't light) walls, closed gates, raised seesaw ends, crates and other lanterns. They pass over everything else, including characters, water, pits and bridge tiles.

For a coordinate `p`, let `LH(p)` = lit by a Heads source and `LT(p)` = lit by a Tails source.
- In H: `p` is **lit** iff `LH ∧ ¬LT`, **shadowed** iff `LT ∧ ¬LH`.
- In T: `p` is **lit** iff `LT ∧ ¬LH`, **shadowed** iff `LH ∧ ¬LT`.
- Both lit → **eclipse**: neither lit nor shadowed on either side. (Light in one world casts shadow in the other; two lights cancel. This keeps the conservation law exact.)

**Bridge tiles:**
- Mirage `=` is solid while lit in its own world, void otherwise.
- Shadow bridge `-` is solid while shadowed in its own world, void otherwise.

Author convention: mirages in H (Sol needs light), shadow bridges in T (Lune walks on shadow). The engine allows either in either world.

A character may walk into a void bridge (it falls in step 7). Objects can't be pushed into a void bridge. If a bridge turns void under something after the light update, a character on it falls and an object on it is lost.

Why a light-bearer "can't use shadow bridges" falls out for free: she lights her own tile, so it can't be shadowed in her world.

## 8. Water (tides)

- The basin mask is the same in both worlds. Each basin coordinate holds **one unit** of water, flooded on exactly one side (`~`) and dry on the other (`_`). So `water(H) + water(T)` is constant for every basin, and for every single tile.
- A **basin region** is a 4-connected set of basin coordinates.
- Flooded tile: blocks characters (bump), blocks lanterns, turns pushed crates into rafts. Dry tile: plain floor. A raft tile is floor whatever the water does.
- **Sluice** `&` in world W is **open** while a crate, lantern or weighted character is on it.
- **Flow (step 6):** for each basin region and each world W with at least one open sluice for that region, move **one** unit from W to the other world: pick the coordinate flooded in W that is nearest to an open sluice (BFS distance through the region; ties broken by row, then column) whose **twin is not occupied by a character**. That tile in W becomes dry and its twin floods. If no such tile exists, no flow from W this tick.
- If both worlds have open sluices for the same region, both moves are computed from the pre-step state and applied together (they always pick different coordinates).
- A crate on a dry tile that floods becomes a raft.
- Water never floods onto a character, so characters never drown (see §11, issue 5).

## 9. Altars and coins

Each character starts with its half-coin, weighted, not a light-bearer.

### 9.1 Sacrifice altars (`O`, `Q`)
Applied at the end of step 2. A character that **enters** an unused altar while holding its coin places the coin there:
- `O` weight altar → `weightless = true`.
- `Q` light altar → `lightBearer = true`.

The altar is now used (holds the coin) and is plain floor from then on. Without a coin, an altar is plain floor. Either character can use either altar. Permanent until undo.

### 9.2 Weightless
Doesn't press plates or open sluices, can't stomp seesaws, and walks on cracked floor without breaking it. Still occupies its tile, so it **still jams gates and seesaws**. Still pushes objects. Still falls into pits and void bridges.

### 9.3 Wish altars (`$`, finale only)
The finale is won when, at the end of a tick, Sol is on H's `$` and Lune is on T's `$`, and both still hold their coins. One character alone on a `$` does nothing. The Rim walk that follows is a scripted scene, not a puzzle (Phase 5).

## 10. Verification (`npm run verify-levels`)

The solver is BFS over `tick` (A* only if a level needs it). Fallen states are pruned.

1. **Solvable**, and the optimal move count is stored as `par`. Fail if not.
2. **Ablation.** For each interactive element (crate, lantern, Tarnish, plate, gate, seesaw pair, sluice, altar, shrine, pit, cracked tile), replace it with floor and re-solve. A plate letter is ablated with all its plates at once. The element **matters** if the level becomes unsolvable **or par changes**. Fail if neither. If par only changes for a different reason than intended, the human reviews the table.
3. **Anti-mash.** Seeded RNG, 2,000 uniform random walks of up to 300 moves (a fall ends the attempt). Allowed solve rate by `role`: `introduce` any; `develop` ≤ 10%; everything else ≤ 1%. Fail above that.
4. **Metrics table per chapter:** par, states explored, desync moves in the optimal solution (a move where exactly one character changes position), number of optimal solutions (counted up to 1,000).
5. Checks 1–3 fail the build.

## 11. Differences from SPEC.md (need your sign-off)

1. **Legend letter clash.** `S L G C O M` are all inside `A–Z`, the gate range. Fix: reserve `C G L M O Q S` and use the other 19 letters for links.
2. **Seesaws can't flip as written.** The raised end is a wall, so weight can never get onto it. Fix: the *stomp* (§6): walking into a raised end presses it down, raising its twin unless something is on the twin. Seesaws become cross-world twins, `/` lowered and `|` raised (not `\`, which would need escaping in level JSON).
3. **Light was underspecified** (which world lanterns live in, beam shape, both worlds lit). Fix: lanterns in either world, cross-shaped beams, eclipse cancels (§7). Separate glyphs `=` mirage and `-` shadow bridge instead of one `=`.
4. **"Raised" in the jam rule** now means a rising seesaw end (§6).
5. **Water: "blocks walking" vs. "falls in deep water".** Fix: water blocks walking and never floods onto a character, so drowning can't happen. Falls are only pits, broken cracked floor and void bridges. Water is modelled as one unit per basin coordinate, so the conservation law holds per tile and the rule fits in one sentence.
6. **"Crates float and become bridges".** Fix: a crate entering water becomes a permanent raft tile. Floating crates that rise and sink with the water would need extra rules for a character standing on one when it drains.
7. **Cracked floor** breaks on entry under weight (you can't cross it, as the spec implies). A crate pushed onto it fills it, like a pit.
8. **Two altar types needed a second glyph**: `O` weight, `Q` light, `$` for the finale's wish altars.
9. **Anti-mash "must not solve" is too strict.** On a 7×5 board, 2,000 × 300 random moves will stumble into many perfectly good 10–15 move solutions. Fix: a solve-rate threshold per level `role` (§10.3).
10. **Ablation "or change the solution" is vague.** Almost any removal changes the move list. Fix: "unsolvable or par changes" (§10.2).
11. **Dropped the `links` field** (letters already encode links). Link glyphs (◆ ● ▲ ✦ ☾ ✚) are assigned per level in order of first appearance.
12. **Restart is undoable** (pushed on the undo stack), so a mis-pressed R costs nothing.
