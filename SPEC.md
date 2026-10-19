# Two Sides of the Same Coin: Game Spec & Build Brief for Claude Code

> **How to use this file:** Put it in an empty repo as `SPEC.md`. Tell Claude Code:
> *"Read SPEC.md fully. Then execute Phase 0 and stop for my review."*
> Run one phase at a time. Each phase ends with a hard **STOP** for human review.

---

## 0. Competition constraints (FILL IN BEFORE STARTING)

- Deadline: `____`
- Required platform: none (no advantage for any engine). **Decision: web build (TypeScript + PixiJS), played by link.** Don't propose switching engines.
- Asset rules (are AI-generated or third-party CC0 assets allowed? must all assets be original?): `____`
- Theme/judging criteria, if any: `____`

If a constraint conflicts with this spec, the constraint wins. Flag the conflict to me; don't silently work around it.

---

## 1. Your role and the quality bar

You are the lead developer, technical artist and level designer for a competition puzzle game. The goal is **not** "a game that works". It's a game that judges remember: hand-crafted illustrated art, real puzzles with genuine "aha" moments, character, music, and polish in every interaction.

Ground rules:
- **The first 5 minutes decide the competition.** Judges play briefly. The title screen, first level and first chapter must be the most polished part of the game.
- **No programmer art ships.** Greybox shapes are only for Phase 1. Every visible asset in the final build follows the art spec in §5.
- **Every level is machine-verified** solvable, with a computed optimal solution (par) and checks that every object in it matters (§4.4).
- **Look at your own work.** You can read PNGs. After any visual change, take screenshots with Playwright, open them, critique them against the checklists here and iterate. Never mark visual work done without viewing it.
- Don't add features outside this spec without asking. Do push back if something in this spec is a bad idea; explain why and propose an alternative.
- Track work with a task list. Commit at the end of every phase.

---

## 2. The concept (decided)

### 2.1 Fiction (wordless storytelling)
Someone tosses a coin into an old wishing well. On the way down the coin splits into its two faces, each a tiny world with one inhabitant:

- **Sol**, keeper of the **Heads** side: a warm, golden, sunlit world.
- **Lune**, keeper of the **Tails** side: a cool, silver, moonlit world.

The coin is falling. Each chapter is a deeper layer of the well. The two must reach each other before the coin hits the bottom; only a whole coin grants the wish. The story is told **without text**, through environment art, character animation and short illustrated vignettes (3 panels) between chapters. The final vignette shows who made the wish: two people at the well, previously turned away from each other, now side by side. It's left ambiguous (siblings? friends?) and mirrors the game's theme.

### 2.1.1 The Tarnish (enemies; added after Phase 0 review)
The well is full of old coins from wishes that were never granted. Over the years they rusted into **the Tarnish**: small, hungry coin-creatures that want a whole wish. A split coin is easy prey, so they hunt the **half-coin pendants**. Each Tarnish has a twin in the other world, and they obey the coin's law: **when the two halves line up (Sol and Lune on the same coordinates), the coin's light flips every Tarnish: the awake ones fall asleep and the sleeping ones wake.** Calming a threat for one side wakes one for the other.
- Turn-based: each awake Tarnish takes one step toward its world's character after every input. Being caught triggers the gentle rewind, never a game over.
- You can't fight them. You outsmart them: lure them into pits (they fill the pit), block them with crates, shut gates on them, or align the halves to put them to sleep.
- Introduced in Chapter 1 and given a new twist by each later chapter's mechanic (shut in by gates, frozen by light, swimming in basins, drawn to whoever still carries a coin).
- Finale payoff: when the coin is whole again on the Rim, the Tarnish shine back into ordinary coins. That is the wish being granted.
- Exact rules live in `RULES.md` §5a.

### 2.2 The one rule everything comes from
> **The coin is balanced. Whatever one side gains, the other side loses.**

Every mechanic is a version of this conservation law. That is the game's identity and the answer to the pitch's question. Sacrifice turns out to be an exchange, not a loss.

### 2.3 Core loop
- Grid-based, **turn-based**, fully deterministic puzzle. No reflexes needed, no randomness.
- **One input moves both characters at once** (same direction by default). Each lives on its own grid. Walls in one world but not the other are how you *desync* them, and desyncing is the basic skill.
- **Win:** at the end of a turn, Sol and Lune both stand on their goal tiles.
- **Never a game-over screen.** Falling or getting stuck triggers a gentle rewind prompt. Unlimited **undo** (with a visual rewind effect) and instant **restart**.

### 2.4 Screen layout
- Landscape (desktop): worlds **side by side**, Heads left, Tails right.
- Portrait (phone): worlds **stacked**, Heads top, Tails bottom.
- Between them is the **seam**: the coin's milled rim (reeded edge), drawn as an engraved metal band. When Sol and Lune stand on the same coordinates, their half-coin pendants glow and a thread of light crosses the seam to connect them. This is pure feedback, and it also helps players read alignment.

---

## 3. Mechanics, one per chapter

Each chapter introduces **one** new mechanic and then combines it with earlier ones. You'll formalize the exact rules in `RULES.md` (Phase 0). The concepts below are fixed; the details may be tuned for good puzzles, as long as the conservation theme holds.

| # | Chapter (well depth) | Mechanic | Conservation idea |
|---|---|---|---|
| 1 | **The Surface** | Linked steps, walls, pushable crates | One input, two outcomes. Progress for one can be a step backward for the other. |
| 2 | **The Roots** | Inverse plates & gates; seesaw tiles | A plate that **opens** gate *a* in its own world **closes** gate *a* in the other. Seesaw pairs: one tile is raised (wall) and its twin is lowered (floor). Weight flips them. |
| 3 | **The Stone** | Light & shadow | Lanterns cast light in beams. A lit tile in Heads is a **shadow** tile in Tails at the same coordinates. Lune can walk on shadow bridges; Sol needs light to cross mirage tiles. Moving a lantern (it's pushable) rewrites both worlds. |
| 4 | **The Waters** | Tides | Each linked basin pair holds a fixed amount of water: `levelHeads + levelTails = constant`. Sluices move water across the seam. Water blocks walking; crates float and become bridges. |
| 5 | **The Dark** | Sacrifice altars | Each character carries a half-coin. Placing it on an altar **trades away** an ability for a new one. **Weight → Weightless** (can't press plates, can cross cracked floor). **Shadow → Light-bearer** (becomes a lantern, but can't use shadow bridges). Permanent until undo. Sacrifice is never pure loss. |
| 6 | **The Rim** | Mirror shrines + everything | A mirror shrine flips Lune's controls horizontally (left↔right) until stepped on again. Final levels combine everything. |

**Finale:** the last level can't be won with one character "winning". Both must place their half-coins on twin altars on the **same turn**. The worlds then fold together onto the Rim (a third shared space shown for the first time), where Sol and Lune finally stand on the same grid. A short final walk to each other ends the game.

### 3.1 Tick order (must be exact and deterministic)
For each input:
1. Compute each character's intended move in its own world (applying mirror if active).
2. Resolve movement and pushes (Sokoban rules: a character pushes one crate; it can't push into a wall or another crate).
3. Evaluate pressure plates (character or crate = weight; weightless characters don't count).
4. Apply cross-world links: gates and seesaws. **A gate or raised tile can't close onto an occupied tile.** It stays "jammed" open until the tile is clear, with a visual strain animation.
5. Recompute light/shadow.
6. Resolve water (one step of flow per tick).
7. Resolve falls (pit, deep water without float). A fall triggers a rewind prompt, not a loss.
8. Check win.

If a character can't move, it plays a "bump" animation and stays put. **The input still counts as a turn** for both. That's how desync works.

---

## 4. Level design

### 4.1 Format
Levels live in `src/levels/<chapter>-<n>.json`. The ASCII layers are easy to read in diffs and easy to edit.

```json
{
  "id": "1-1",
  "name": "Two Paths",
  "designNote": "Teaches that both move together; no desync yet.",
  "heads": ["########",
            "#S....G#",
            "#......#",
            "########"],
  "tails": ["########",
            "#L.#..G#",
            "#......#",
            "########"],
  "links": [],
  "hints": ["Watch Lune, not Sol.", "Lune can't go through that wall. Take Lune around it.", null]
}
```
(This is a format example only. Solver says: D, R×5, U = 7 moves.)

Legend (extend as needed, documented in `RULES.md`): `#` wall · `.` floor · `S` Sol start · `L` Lune start · `G` goal · `C` crate · `a–z` plate · `A–Z` gate linked to the same-letter plate · `^` pit · `%` cracked floor · `/` seesaw tile · `*` lantern · `=` shadow/mirage tile · `~` basin · `&` sluice · `O` altar · `M` mirror shrine.

### 4.2 Size and readability
- Grids from **7×5 to 11×8 per world**. A good puzzle fits on one screen with no scrolling.
- A player should understand the whole board in 5 seconds. Avoid clutter.

### 4.3 Chapter structure (about 30 levels total; quality over count)
Every chapter follows: **Introduce** (can't fail) → **Develop** ×2 → **Twist** (the mechanic used in an unexpected way) → **Combine** (with an earlier mechanic) → **Capstone** (hardest; a real "aha").
Target: 6 levels for Chapter 1 (one extra to teach the Tarnish flip before the capstone; playtest showed it was undiscoverable otherwise), 5–6 for Chapters 2–5, 4 + finale for Chapter 6. **Cut any level that isn't good.** 24 great levels beat 36 okay ones.

Every level must have one clearly stated "aha" in its `designNote`. Where possible, the aha should be a **sacrifice moment**: one character must give up progress, go backwards, or wait so the other can advance.

### 4.4 Automated verification (`npm run verify-levels`)
Write a BFS/A* solver over the pure engine (state hash = both positions, crates, toggles, water, abilities, mirror flag). For every level it must report and enforce:
1. **Solvable**, with the optimal move count stored as **par**.
2. **Ablation check:** removing each interactive object (crate, plate, lantern, etc.) one at a time must make the level unsolvable or change the solution. Report any object that does neither. It's decoration and must be removed or used.
3. **Anti-mash check:** 2,000 random-walk attempts of up to 300 moves each must **not** solve the level, except in "Introduce" levels.
4. **Difficulty metrics:** par length, number of states explored, number of required desync moves. Print a table per chapter. The curve should rise, with a small dip at the start of each chapter.
5. **Uniqueness of the aha (soft):** report how many distinct optimal solutions exist. Many unrelated solutions often means the intended idea isn't forced.

The build fails if checks 1–3 fail.

### 4.5 Hints (a feature judges will notice)
Three tiers per level, unlocked progressively:
1. A nudge in a few words (hand-written).
2. The key idea (hand-written).
3. "Show me": the solver runs **from the player's current state** in a Web Worker and animates the next 3 moves as ghost footprints. If the current state is unsolvable, say so kindly and offer to undo to the last solvable state (the solver finds it).

---

## 5. Art direction (decided)

### 5.1 Style: "Living Engraved Coin"
The whole game looks like a coin's engraving that came to life and got painted. The key ingredients:
- **Ink linework** with a slight hand-drawn wobble (never perfectly straight vector lines).
- **Engraving-style hatching** for shading (parallel and cross-hatch lines, like the shading on a coin or banknote) over flat color fields.
- **Guilloché patterns** (the spirograph-like rosettes on banknotes) in UI frames, the seam and level-select medallions.
- **Paper/metal grain** texture overlay, subtle.
- Rich, warm, saturated color. *Vibrant, not muddy.*

References for **mood** (don't copy): engraved currency, Monument Valley's clarity, Gris's color storytelling, storybook paper-cut illustration.

### 5.2 Palettes
**Heads (Sol, day):** sky `#F6D58E` · sunstone `#E8B66A` · terracotta `#C8643B` · ochre `#8A4B22` · leaf `#6F9E4C` · teal accent `#2E8C8A` · highlight `#FFF4D6` · ink `#2A1E14`
**Tails (Lune, night):** night `#1C2046` · indigo `#2E3570` · slate `#4A5A8C` · silver `#C9D3E6` · lavender `#9C8CD4` · moonglow `#E8F0FF` · coral accent `#E07A6B` · ink `#0E1028`
**Cross-world links:** gold↔silver gradient. Each link pair **also** gets a unique engraved glyph (◆ ● ▲ ✦ ☾ ✚ …) on both linked objects, so links never depend on color alone (colorblind-safe).

Each chapter shifts both palettes with depth (Surface: bright; Roots: greener/earthy; Stone: grey-warm; Waters: teal; Dark: deep with glowing accents; Rim: polished gold and silver converging).

### 5.3 Characters
- **Sol:** small and round, a sun-disc hat embossed like a coin face, a warm short cloak, a stubby confident walk.
- **Lune:** slimmer, a crescent-moon hood, a long silver scarf that trails with motion, a lighter floating gait.
- Both wear a **half-coin pendant**; together the pendants make one coin.
- Built as **separate SVG parts** (head, body, eyes, lids, arms, feet, accessory) assembled in Pixi containers and animated **procedurally**: squash & stretch, follow-through on scarf and cloak, anticipation before moves.
- Required states: idle (breathing; blink every 3–6 s at random; occasionally glances toward the seam/partner), walk, push, bump (squash + small head shake), fall, rewind (played backwards with a chromatic shimmer), wait/sad (when the other is far ahead), celebrate, and **reunite** (finale).
- **Personality through reactions:** when one character bumps a wall, the other briefly looks toward the seam. When both are on goals, they wave to each other across the seam.

### 5.4 Environments
- One **tileset per chapter**: floor, wall (with top-face and front-face variants), plus every mechanic object. Walls use **auto-tiling** (bitmask, 47-tile or simplified 16-tile) so edges and corners join cleanly. A blocky grid look is not acceptable.
- Floors get 3–4 random variants (cracks, moss, engraving motifs), seeded per level so they look the same every time.
- **Parallax background** per chapter: 3–4 layers, with the well's stone walls framing the scene and getting darker with depth.
- **Ambient particles** per chapter: pollen (Surface), drifting spores (Roots), dust motes in light beams (Stone), bubbles (Waters), embers/fireflies (Dark), gold-silver glints (Rim).
- **Lighting:** the light mechanic is drawn as soft additive beams with dust. Shadow tiles in Tails are shown as inky, slightly animated pools.

### 5.5 Art pipeline (how you, Claude Code, make "real drawings")
1. Author every asset as **hand-written layered SVG** in `art/src/`, using palette tokens, hatching `<pattern>`s, and ink strokes with wobble (perturb path points, or bake `feTurbulence` + `feDisplacementMap`).
2. `npm run art` rasterizes the SVGs to PNG atlases with Playwright/Chromium at 1× and 2×. Bake the filters at build time; **don't** run SVG filters at runtime.
3. `npm run art:sheet` renders a **contact sheet** of all assets on both palettes. **Open it and critique it** against this checklist:
   - Does it read at actual game size (tile ≈ 64–96 px)?
   - Is the silhouette clear? Is there enough contrast against the floor?
   - Is the line weight consistent across assets?
   - Is the hatching consistent in direction (light from top-left in Heads, cool rim-light from top-right in Tails)?
   - Does it look hand-made and charming, or generic? If generic, redo it.
4. Iterate at least twice on characters and the Chapter 1 tileset before showing me.
5. **Swap-in support:** all art loads through `assets/manifest.json`. Any PNG can be replaced by a human- or AI-painted version with the same name and size, with no code changes. Also write `art/PROMPTS.md`: a detailed image-generation prompt for each key asset (characters, backgrounds, vignettes) in this art style, in case we decide to commission or generate painted versions.

### 5.6 Juice checklist (every item required)
- All movement tweened (≈120 ms, ease-out-back for steps, ease-in for falls). Input buffering, so fast typing never drops moves.
- Dust puffs on steps, a crate scrape trail, sparks when a gate jams.
- Gates/seesaws animate **in both worlds at once**, with a glyph pulse crossing the seam to show cause and effect. This is the most important feedback in the game.
- Subtle screen shake only on heavy events (crate drops into a pit). It respects reduced motion.
- **Level complete:** both characters celebrate, the two halves of the board slide toward the seam, and the coin snaps shut with a metallic *ting*, then flips (3D-ish scale-X flip) into the next level.
- Undo plays a quick reverse-motion shimmer. Restart is a fast coin-spin wipe.

---

## 6. Audio (decided)

### 6.1 Adaptive music: melodic inversion
Each chapter has one theme written **two ways**:
- **Heads layer:** the melody as written, warm timbres (kalimba, marimba, nylon guitar, soft brass), major mode.
- **Tails layer:** the same melody **inverted** (intervals flipped) and in the relative minor, on glass/celesta/pads/soft choir.

Both layers play together all the time and are composed to harmonize. The mix responds to play: when the characters stand on aligned coordinates, a third "unison" layer fades in. On level complete, both layers resolve onto a single shared chord. This is how the theme gets into the music; mention it in the pitch.

Implementation: Tone.js, with all music composed in code (`src/audio/themes/`). Architecture: stems with a mixer, so **recorded stems can replace** the generated ones through the manifest. Music should be atmospheric and loop seamlessly (8–16 bar phrases with variations so it doesn't feel repetitive).

### 6.2 SFX
Synthesized (Tone.js or ZzFX) and layered so they don't sound "8-bit". Every action has a **Heads variant and a Tails variant** (warmer vs. glassier) so the player can hear which world reacted. Required: step (per surface type), push, bump, plate down/up, gate open/close/jam, seesaw, lantern, water flow, fall, undo, restart, altar, mirror, hint, level complete, chapter complete, UI hover/click. Keep them subtle; the music carries the mood.

Settings: master/music/SFX volume and mute. Audio starts only after the first user gesture (browser autoplay rules).

---

## 7. UX & UI

- **Opening intro (added after Phase 0 review):** a wordless 20–30 s animated sequence of storybook panels in the game's art style. A hand tosses a coin into the well, it splits as it falls, Sol and Lune wake in their halves, and Tarnish eyes glint in the dark below. Plays once on first launch, skippable (any key/tap), replayable from the menu. Doubles as the opening of the submission trailer. Built in Phase 5.
- **Title screen:** the well seen from above with a coin glinting at the bottom; the logo is engraved on a coin that slowly spins. One button: *Play*. Settings and Credits are small.
- **Level select:** a **coin collector's album**. Each chapter is a page and each level is a coin medallion (guilloché border). It shows stars: 1 = solved, 2 = within par+30%, 3 = par ("Perfect Coin"). Unsolved levels show a silhouette.
- **In-game HUD:** minimal. Move counter, par, and icons for undo, restart, hint and menu. Nothing covers the board.
- **Teaching without text:** Chapter 1's first levels use animated ghost-arrow demos and environmental cues, not tutorial text. A key/swipe prompt appears only if the player is idle for 5 s.
- **Controls:** arrows/WASD, Z/Backspace = undo, R = restart, H = hint, Esc = menu. Hold a direction to repeat. **Gamepad** (Gamepad API). **Touch:** swipe to move, plus on-screen undo/restart buttons. Keys can be remapped.
- **Accessibility:** colorblind-safe glyphs on all links, a reduced-motion toggle, a high-contrast outline toggle, and readable font sizes. Everything works by keyboard alone.
- **Save:** progress, stars and settings go to localStorage (wrapped in try/catch; the game must still run without it).
- **Judge Mode:** a settings toggle that unlocks every level. Also show "Press H for a hint" during the first idle 20 s of any level. Judges must never be stuck.
- **Pause menu** shows the level name and its hand-written design-note flavor line.

---

## 8. Tech stack & architecture (decided)

- **TypeScript + Vite + PixiJS v8** (WebGL rendering, filters, particles). **Tone.js** for audio. **Vitest** for tests. **Playwright** (Chromium is available) for screenshots and art rasterization.
- Ships as a **static web build**: playable in a browser by link, uploadable to itch.io as an HTML5 zip, also deployable to GitHub Pages. Works offline after load.
- Targets: 60 fps on a mid-range laptop and a 3-year-old phone; initial load < 3 s; build < 20 MB.

```
src/
  engine/      # PURE TS: no DOM, no Pixi. types, parseLevel, tick(), hashState, undo stack
  solver/      # BFS/A*; runs in Node (verify) and in a Web Worker (hints)
  levels/      # *.json
  render/      # Pixi scenes, sprite assembly, tweens, particles, auto-tiling
  audio/       # Tone.js themes, mixer, sfx
  ui/          # title, album, HUD, settings, vignettes
art/src/       # hand-authored SVG
assets/        # generated PNG atlases + manifest.json
tools/         # verify-levels.ts, render-art.ts, contact-sheet.ts, screenshots.ts
tests/
RULES.md       # exact mechanic rules (Phase 0)
```

**Hard rule:** the engine is pure and deterministic, so `tick(state, input) → newState` drives the game, the solver, undo and tests alike. The renderer only **animates the difference** between two states. It never contains game rules.

Scripts: `dev`, `build`, `test`, `verify-levels`, `art`, `art:sheet`, `shots` (screenshots every level, start and solved state, in both layouts), `zip` (itch.io package).

---

## 9. Phases (STOP after each one for review)

**Phase 0: Plan.** Read this spec. Write `RULES.md` with exact rules for every mechanic and edge case (simultaneous moves, jammed gates, crates on seesaws, water + crates, weightless + plates, mirror + pushes). List any spec problems and your proposed fixes. Set up the repo skeleton. **STOP.**

**Phase 1: Engine + solver + greybox.** Pure engine with unit tests for every rule in RULES.md. Solver plus `verify-levels`. Greybox renderer with colored squares, a playable Chapter 1 (5 levels) and 2 Chapter 2 levels with undo/restart. Print the verification table. **STOP.**

**Phase 2: Art direction.** Sol and Lune (all parts, with idle/walk demo), the Chapter 1 tileset with auto-tiling, the seam, one background, and the title screen mock. Contact sheets plus in-game screenshots, self-critiqued and iterated at least twice. Show me the images. **STOP.**

**Phase 3: Vertical slice: Chapter 1 fully polished.** Final art, every animation state, juice checklist, Chapter 1 music theme (both layers), all Chapter 1 SFX, title screen, album, HUD, hints (all three tiers), settings, save, touch/gamepad. *If we could only submit this, it should still be competitive.* Deploy a preview build. **STOP.**

**Phase 4: Chapters 2–6.** Repeat per chapter: mechanic in engine with tests → greybox levels → `verify-levels` passes, with the metrics table reviewed for curve → art → music theme → SFX → screenshots self-review. **STOP after each chapter.**

**Phase 5: Story & finale.** Opening intro (§7), chapter vignettes (3 illustrated panels each, same art pipeline), the Rim finale sequence, ending, credits. **STOP.**

**Phase 6: Ship.** Full verification, a performance pass (profile on throttled CPU), a cross-browser check (Chromium; Firefox/Safari if available), mobile layout screenshots, and a final `shots` review of every level. Produce the **submission kit**: itch.io zip, a 30–45 s gameplay GIF/video captured with Playwright, 6 hero screenshots, and a 150-word pitch plus a short "design story" paragraph (the conservation law, melodic inversion, solver-verified levels) for the judges. **STOP.**

---

## 10. Definition of "outstanding" (final acceptance checklist)

- [ ] A stranger understands the core rule within the first 60 seconds, with no text.
- [ ] Every level passes solvable / ablation / anti-mash checks; the difficulty table rises sensibly.
- [ ] At least 5 levels whose solution makes a playtester say "oh!" (note which ones in the designNote).
- [ ] No placeholder art, no default fonts, no unstyled UI anywhere.
- [ ] Every cross-world cause → effect is visible **and** audible in both worlds.
- [ ] Characters feel alive when idle for 10 seconds.
- [ ] Music changes with play (alignment layer, resolving chord on win).
- [ ] Undo, restart and hints are instant and never frustrating; there are no dead-end states without a way out.
- [ ] 60 fps; works with keyboard, gamepad and touch; works in portrait and landscape.
- [ ] The ending answers the pitch's question: neither side has to lose. Both give something, and both arrive.