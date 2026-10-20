# Handoff: Two Sides of the Same Coin

Read this first in a new session, then `SPEC.md` (the brief, with the changes noted below) and `RULES.md` (the exact game rules the engine implements). This file says where the project stands, what was decided along the way and why, and what comes next.

**Preview build (private):** https://claude.ai/artifact/4StN9hkfrULKfhruTZFLXi (all six chapters).

---

## 1. Where we are

| Phase (SPEC §9) | Status |
|---|---|
| 0 Plan: RULES.md, spec fixes, skeleton | Done |
| 1 Engine + solver + greybox | Done |
| 2 Art direction | Done |
| 3 Vertical slice: Chapter 1 fully polished | Done; preview published |
| 4 Chapters 2–6 | Chapter 2 done and approved ("it is logical"). Chapters 3–5 built. **Chapter 6 built (all 31 levels exist), awaiting the user's review.** |
| 5 Story, intro and finale | **Built, awaiting the user's review** (`src/ui/story.ts`) |
| 6 Ship (zip, video, pitch, perf pass) | Not started |

The user reviews at the end of every phase or chapter. Never skip that stop.

**Next step:** get the user's verdict on Chapters 3–6 and the Phase 5 story scenes, then Phase 6 (ship).

---

## 2. The game in one paragraph

A coin tossed into a wishing well splits into two tiny worlds: **Heads** (Sol, warm gold) and **Tails** (Lune, cool silver). One input moves both characters on their own grids; walls in one world but not the other let you desync them. Both must stand on their goals (coin sockets for their half) at the end of the same move. The core law is conservation: whatever one side gains, the other loses. Turn-based and deterministic, with unlimited undo and no game over.

---

## 3. Decisions that differ from or extend SPEC.md

All approved by the user unless marked.

1. **Legend letter clash fixed:** `C G L M O Q S` are reserved; the other 19 letters are plate/gate links. The raised balance-stone glyph is `|` (not `\`, which needs JSON escaping). See RULES.md §2.1 and §11.
2. **Seesaws as "balance stones":** walk into a raised stone to shove it down; its twin across the seam rises unless someone or something is on it (jam). Presented as two stones on one rope over a seam pulley.
3. **Light (§7), water (§8), cracked floor and sacrifice altars (§9.1–9.2) are implemented.** Mirror shrines (`State.mirror`) and wish altars `$` (finale win: both on `$`, both coins held) are implemented too: every rule in RULES.md is now in the engine.
   - `State.traded[c]`: '' still holds the coin, 'O' weightless, 'Q' light-bearer. Spent altars are engine glyphs `(` `)`. A Tarnish onto a character is always a catch (fixed in Ch5: it used to fill a cracked tile under a weightless character).
   - Water clarifications (not yet confirmed by the user): anything that presses a plate opens a sluice (Tarnish too); water won't flood onto a character, lantern or Tarnish; a raft `+` takes its cell out of the tides; the Tarnish can't enter flooded cells. New level glyph `0` = a crate on a dry basin cell.
   - Changed in Chapter 3 (not yet confirmed by the user): a crate or lantern *catches* a beam (its own tile is lit, nothing beyond), so a crate on a mirage doesn't darken itself; objects can't be pushed onto a void bridge; anything left on a bridge that goes void drops, and step 7 repeats because a lost lantern changes the light.
   - **Frozen by light** (new rule, from SPEC §2.1.1's "frozen by light"; not yet confirmed by the user): an awake Tarnish on a tile lit in its own world, judged after this tick's pushes, doesn't step. RULES.md §5a.
4. **Anti-mash and ablation checks** are thresholds, not absolutes (RULES.md §10): mash ≤10% for `develop`, ≤1% for `twist`/`combine`/`capstone`, `introduce` exempt. An element is decorative if removing it leaves par unchanged.
5. **Enemies (the Tarnish)** were added at the user's request (SPEC §2.1.1, RULES.md §5a). They are rusted wish-coins that hunt the half-coin pendants. Turn-based: after the characters move, each awake Tarnish steps one tile toward its own world's character, taking the larger axis first (ties horizontal), and tries the other axis if that's blocked. Asleep ones are harmless walls. Caught means the rewind prompt. A Tarnish stepping into a pit fills it (shown as a sunken rusty coin). A Tarnish weighs down plates and jams doors and stones.
   - **The flip:** when Sol and Lune *newly* stand on the same coordinates, every Tarnish in both worlds flips awake ↔ asleep, wherever it stands (enemies do NOT need to line up), and none steps that turn. The game shows a light flash across the seam and the caption "The halves line up: the Tarnish flip!".
6. **No enemy intent arrows:** the user wants movement readable from motion, not arrows. Removed.
7. **Chapter 1 has 6 levels** (the spec said 5): 1-5 exists only to teach the flip, because playtesting showed it was undiscoverable.
8. **Characters are human kids** (user request). Sol wears a coin-shaped cap; Lune has a crescent-moon hood and a trailing scarf. Each wears one half of the coin.
9. **Opening intro** (wordless 20–30 s storybook panels) was added to SPEC §7 and Phase 5.
10. **Play goes straight to the first unsolved level** (first five minutes matter). The album is one keypress away.
11. **The pause menu does not show `designNote`**, because those notes spell out the solution. It shows chapter, name, par and best. Not explicitly confirmed by the user.
12. **Chapter 3 has 5 levels** too: mirage, shadow bridge, develop, freeze, capstone. 3-4 is labelled `introduce` (it teaches the freeze rule) because it mashes at 1.5%, above the 1% twist limit.
13. **Chapter 2 has 5 levels** (the spec allows 5–6): two introduce levels (one per mechanic), develop, twist, capstone.

### User's design feedback (apply to every new level and mechanic)
- Mechanics must feel **physically logical and fun, with visible cause → effect**. Chapter 2 fixed "strange" plates and seesaws with a physical metaphor: ropes over pulleys in the seam, a glint running from cause to effect, and character reactions.
- **Crates (pushables) must not start right next to their target**; leave a few tiles so the push is a small plan.
- **Teach every new rule in its own easy level before combining it.**
- Prefer clean, readable boards with one clear idea over clutter. The random level generator produced hard but cluttered levels, and those were rejected.

---

## 4. Levels (all pass `npm run verify-levels`)

| Level | Name | Role | Par | Mash | Idea |
|---|---|---|---|---|---|
| 1-1 | Two Paths | introduce | 7 | 96% | Both move together |
| 1-2 | Wait for Me | develop | 12 | 0% | Walk into a wall to wait |
| 1-3 | Stepping Stone | develop | 12 | 0% | Lune's crate fills her pit; up/down only moves Sol |
| 1-4 | Rust to Rust | twist | 13 | 0.2% | Lure the Tarnish into the pit; the filled pit is the way down |
| 1-5 | Line Up | develop | 10 | 0.3% | Teaches the flip |
| 1-6 | Two Sides | capstone | 19 | 0% | Flip just as the Tarnish reaches Sol; his sleeper becomes a wall |
| 2-1 | Counterweight | introduce | 16 | 0% | A crate on Sol's plate hoists his door and drops Lune's; Lune goes first |
| 2-2 | Balance Stones | introduce | 9 | 74% | Ping-pong shoves; a stone can't rise under someone |
| 2-3 | Doorstop | develop | 12 | 8.8% | The door that shut behind Sol is his backstop |
| 2-4 | Follow Me | twist | 17 | 0% | The chasing Tarnish holds Sol's plate while he walks through |
| 2-5 | Two Ropes | capstone | 26 | 0% | Everything: pen stone, flips, Tarnish as counterweight |
| 3-1 | Lantern Light | introduce | 15 | 0.5% | Push the lantern so its beam reaches the sunglass bridge |
| 3-2 | Cast Shadow | introduce | 9 | 4.5% | Sol's light is Lune's shadow bridge |
| 3-3 | One Lantern | develop | 15 | 0.1% | Lune crosses first; moving the light for Sol melts her bridge |
| 3-4 | Hold Still | introduce | 15 | 1.5% | Light freezes the Tarnish: lure it in, catch it in the beam |
| 3-5 | Two Jobs | capstone | 22 | 0% | The lantern's column freezes the Tarnish, its row lays Lune's bridge |
| 4-1 | Low Tide | introduce | 13 | 88% | Wait on the sluice: Sol's water pours into Lune's basin |
| 4-2 | Raft | introduce | 7 | 32% | Push a crate into water; it floats |
| 4-3 | Mind the Flood | develop | 17 | 1.7% | Lune hides in her gap before Sol's water reaches her crossing |
| 4-4 | Open Water | twist | 20 | 0% | Tarnish can't swim; the cells Sol drains become his own Tarnish's path |
| 4-5 | Riding the Tide | capstone | 15 | 0.9% | A crate holds the sluice open; Lune's crate floats into a raft |
| 5-1 | Featherweight | introduce | 10 | 54% | Trade weight to cross the crack |
| 5-2 | Lamplighter | introduce | 10 | 50% | Trade for light; carry it across the sunglass bridge |
| 5-3 | Light Footed | develop | 19 | 0.2% | Weightless Sol crosses; the chasing Tarnish breaks through |
| 5-4 | Walk Beside Me | twist | 17 | 0.1% | Lune's light is Sol's shadow bridge: she walks beside him |
| 5-5 | Two Gifts | capstone | 19 | 0% | Line up to calm her Tarnish; Sol takes weightlessness, Lune light |
| 6-1 | Looking Glass | introduce | 7 | 76% | The shrine swaps Lune's left and right |
| 6-2 | Backwards | introduce | 8 | 65% | Mirrored, Lune pushes her crate the other way |
| 6-3 | Opposite Ways | combine | 13 | 0.1% | Lure her Tarnish into the pit, then mirror to split up |
| 6-4 | Parked Light | capstone | 25 | 0.2% | Park the lantern over her bridge, walk back together, then mirror |
| 6-5 | The Wish | finale | 9 | 0.1% | Mirror to meet above the twin wish altars; step down together with both coins |

`designNote` in each level JSON has the precise aha. When the solver's real solution differs from the intended one, trust the trace and rewrite the note (that happened with 2-4).

---

## 5. Architecture

```
src/engine/    pure TS rules: types.ts, parse.ts (validation), tick.ts (the tick, Tarnish, events), history.ts (undo)
src/solver/    BFS solve(level, fromState); also runs in the hint Web Worker
src/levels/    *.json levels + index.ts (sorted list, chapterOf, CHAPTER_NAMES)
src/app/       scenes.ts (scene stack), context.ts (Ctx), settings.ts, save.ts (localStorage, stars())
src/input/     input.ts: keyboard (remappable, hold-to-repeat 220/120 ms), gamepad, touch swipe
src/audio/     audio.ts (public API), mixer.ts (gain staging), sfx.ts, themes/ch1.ts + ch2.ts
src/render/    board.ts (persistent sprites; animates state diffs; juice), mechanisms.ts (plates, doors,
               stones, ropes, pulleys), rig.ts (layered puppets + procedural animation), sprites.ts
               (tiles, palettes per chapter, backgrounds), tween.ts, demo.ts (?demo)
src/game/      play.ts: the play scene (input queue, sounds per event, hints, undo shimmer,
               restart coin wipe, level-complete sequence)
src/hints/     worker.ts + hints.ts: tier 3 solves from the current state; rewinds if unsolvable
src/ui/        style.ts (FONT, colours, Button, FocusList: use for all UI), title, album, hud,
               settings, pause, credits
art/src/       hand-written SVG (STYLE.md is the art bible); _palettes.css, _defs.svg shared
assets/        generated PNG/JPG + manifest.json (served as the site root by Vite: publicDir)
tools/         verify-levels, render-art, contact-sheet, gen-walls, screenshots
```

**Hard rule:** the engine is pure; the renderer only animates the difference between two States plus `GameEvent`s (which carry `from` cells for sliding things). No game rules in render or UI code.

Useful URL params: `?level=2-3` (jump to a level), `?demo` (character idle/walk demo), `?shots` (used by the screenshot tool: no auto-advance after a win), `?intro` (play the intro again).

**Story scenes** (`src/ui/story.ts`, Phase 5): built in code on a 960×540 stage from the game's own art (puppets, chapter backgrounds, Tarnish) plus drawn paper-cut figures, so they add no image files. Intro plays once on first launch (`save.seenIntro`) and from the title's "Watch intro"; a 3-panel vignette plays after each of Chapters 1–5 (the two people at the well turn a sixth of the way toward each other each time); the ending (Rim walk, Tarnish turn back into coins, the coin rises, the two side by side at dawn) plays after 6-5, then credits. Any key or tap skips. `npm run story-shots` captures frames to `shots/story/`.

Automation hooks on `window.__game`: `loadLevel(i)`, `press(key)`, `state()`, `idle()`, `levelCount()`, `levelIndex()`, `story({kind})`.

---

## 6. Commands

```bash
npm run dev            # http://localhost:5173
npm test               # 65 Vitest tests (engine rules, save, input)
npm run verify-levels  # solve / ablation / anti-mash / metrics table; writes par into level JSON
npm run verify-levels -- 2-3   # one level: prints the solution and each ablation result
npm run art            # render art/src SVG -> assets/ (1x and 2x, per palette) + manifest.json
npm run art:sheet -- tiles     # contact sheet (art/contact-sheet-*.png); open it and critique
npm run shots          # screenshots of every level, start + mid + solved, landscape + portrait -> shots/
npm run shots -- 3-    # only levels whose id starts with 3-
npm run trace -- 3-4   # the optimal solution printed as boards, one per move (' lit, : shadowed)
npm run build          # dist/ (relative paths, runs from any subfolder; ~6 MB)
```

**Art pipeline notes:** `data-palettes="heads,tails,heads2,tails2"` on a tile renders it once per world per chapter. `data-format="jpeg"` is for opaque full-screen art (grain noise bloats PNGs). Files and folders starting with `_` are not assets. Walls are generated by `tools/gen-walls.ts` (16-tile bitmask). A new chapter needs: a palette block in `_palettes.css` (`.theme-heads3`/`.theme-tails3`), the new palette names added to every tile's `data-palettes`, the `palette()`/`BG` logic in `sprites.ts`, and a background set `bg/<name>-far|mid|near`.

**Audio levels** (measured in the browser with a Tone.Meter on the destination): music peaks about −20 dBFS, SFX −21 to −26. The trims live in `mixer.ts`.

**Level design workflow:** draft the boards, save each as a temporary `src/levels/9-N.json`, run `npm run verify-levels -- 9-N`, then delete the file. Always read the actual solution (step through it) before trusting the intended aha. Watch for the flip short-circuiting Tarnish puzzles: any level with a Tarnish has to account for Sol and Lune lining up.

**Publishing the preview:** the game only loads `@2x` images (`texture()` in rig.ts uses `src2x`), so the preview holds only `@2x` art: never upload 1x images. A publish keeps the files it doesn't resend, so send **every file in `dist/assets/`** (each build renames all the JS chunks, not just `index-*.js`; missing chunks mean the page won't open), `manifest.json`, and the assets `git status assets` lists as changed. Map the previous build's chunk names to `null` to delete them: an artifact version holds at most 512 files. Build, then publish a small shell HTML (title + the built `index-*.css/js` tags; no doctype) with `root: dist` and the file list. More than 255 files must go in two publishes to the same artifact URL (the Chapter 2 palette tiles went in the second).

---

## 7. Per-chapter loop (Phase 4)

1. Implement the mechanic in the engine from RULES.md, with unit tests for every rule.
2. Find the physical metaphor and show it (like the ropes and pulleys).
3. Levels: introduce (one per mechanic) → develop → twist → combine → capstone; 5–6 per chapter, each verified, each with a clear aha in `designNote` and two hand-written hints.
4. Art: palette, mechanism sprites, background. Render, contact-sheet, critique twice.
5. Music theme (copy `ch2.ts`'s structure: Heads melody + diatonic inversion for Tails, snapped to shared chords, unison layer) and any new SFX. Measure levels.
6. `npm run shots`, look at the images, fix, commit, republish the preview, then **stop for the user's review**.

Remaining chapters: 3 The Stone (light/shadow, lanterns, mirage `=` and shadow bridges `-`), 4 The Waters (tides, sluices, rafts), 5 The Dark (cracked floor, altars: weightless / light-bearer), 6 The Rim (mirror shrine + finale with wish altars `$`, then the Rim walk). Phase 5 adds the opening intro, chapter vignettes and the ending.

---

## 8. Working with agy

The user lets you delegate big, well-specified, file-only jobs to the `agy` CLI (`agy -p "<brief>" --mode accept-edits`). Its headless mode cannot run shell commands, so you run the builds and tests yourself and review every diff. **Both of the user's agy accounts hit their quota on 2026-10-20 (about a 7-day reset).** Check with `agy -p "Reply AGY_OK"` before planning around it.

Lessons:
- Write the API contract into the brief.
- agy guessed field names (`masterVolume`).
- It ignored a "don't show designNote" instruction.
- Its tests encoded a key-release bug.
- Always typecheck and read the code.

---

## 9. Known gaps and risks

- The built-in browser pane throttles animation frames, so input stalls there (even on 1-1). Use `npm run shots` (headless Playwright) to see levels mid-play.
- Chapter 3–6 music (`themes/ch3.ts` takes a `Score`; `ch4.ts`–`ch6.ts` are subclasses with their own scores) has not been level-measured or listened to.
- The preview holds 484 files of the 511 an artifact version allows. Adding many more assets (Phase 5 vignettes) will need texture atlases or a second artifact.
- 6-2 is labelled `introduce` (one-row mirror levels mash high); 6-5 is short (par 9) by design, a symbolic finale before the scripted Rim walk.
- 4-4's solution is a chase more than a clean moat; if the user finds it messy, redesign it around "water walls off the Tarnish".
- Not verified: real gamepad, a real phone (touch), Firefox/Safari, and the preview inside the claude.ai viewer.
- Audio is measured for level only; nobody has listened critically.
- Characters lack a distinct push pose and the finale "reunite" state.
- The title screen's well rim is flat; good enough for now, polish in Phase 6.
- The board redraws terrain on fills, which is fine at this scale. Profile in Phase 6 (target 60 fps on a mid-range phone).
- SPEC §0 competition constraints (deadline, asset rules, judging criteria) are still blank. Ask the user.
