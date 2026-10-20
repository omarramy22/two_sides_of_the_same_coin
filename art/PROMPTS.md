# Painted-asset prompts

Every PNG in `assets/` loads through `assets/manifest.json`, so a painted replacement only has to keep the **same file name and pixel size** (1x and `@2x`). These prompts describe each key asset in the game's style so a commissioned artist or an image model can produce matching versions. Check the competition's asset rules (SPEC.md §0) before using generated art.

**Shared style line** (append to every prompt):
> Style: "living engraved coin". Hand-inked outlines with a slight wobble, engraving-style hatching (parallel and cross-hatch lines like banknote shading) over flat, vibrant colour fields, subtle paper grain, guilloché and milled-coin details. Warm gold palette for the Heads world (#F6D58E, #E8B66A, #C8643B, #8A4B22, #6F9E4C, #2E8C8A, ink #2A1E14), cool silver palette for the Tails world (#1C2046, #2E3570, #4A5A8C, #C9D3E6, #9C8CD4, #E8F0FF, ink #0E1028). Storybook charm, Monument Valley clarity. Transparent background unless stated. No text, no watermark.

## Characters (96×96 per frame, feet at x=48, y=88; also needed as separate layers: shadow, feet, body, arms, head, eyes, closed eyelids, hat/hood, scarf, pendant)

**Sol, keeper of Heads.** A small, round, cheerful child seen from the front in a slight top-down 3/4 view. Short brown bob haircut, big dark eyes, rosy cheeks, small smile. Wears a flat round cap shaped exactly like a gold coin (reeded edge, an engraved sun on top), a short terracotta-orange cloak with a gold milled hem, a teal tunic underneath, small brown boots. On the chest hangs the LEFT half of a gold coin on a cord. Light from the top-left; hatching on the lower right.

**Lune, keeper of Tails.** A slimmer, calm child, same view. Pale skin, dark navy side-swept hair, half-lidded thoughtful eyes. Wears a silver hood whose tip sweeps up and hooks over like a crescent moon (a small crescent engraved on its side), a long silver scarf trailing behind one shoulder with a fringed end, a slate-blue tunic with a lavender belt line and a silver hem, dark boots. On the chest hangs the RIGHT half of a silver coin. Cool rim light from the top-right; hatching on the lower left.

**A Tarnish, awake.** A small creature made from an old rusted coin standing on its edge: round coin face in rust red (#B5543A) with a visible coin-edge thickness on its right, a chipped serrated top rim, a worn dotted rim ring, a tiny stamped star, green verdigris patina blooms, two stubby legs, angry brows over glowing yellow eyes (#FFE08A), a jagged little grin. Menacing but cute.

**A Tarnish, asleep.** The same creature, desaturated to dull grey-brown (#7D6B55), eyes peacefully closed, mouth slack, patina darker.

## Tiles (64×64, seamless where noted; two versions each: Heads palette and Tails palette)

- **Floor ×4 (seamless):** worn flagstones at the top of an old wishing well, low contrast; variants: plain, hairline crack, a tuft of moss, a faint engraved rosette.
- **Wall (16 auto-tile variants):** raised stone blocks seen top-down with a visible front face when open floor is below; outlines only on open edges so neighbouring walls merge.
- **Pit:** a broken hole in the flagstones going down into darkness, receding hatched rings.
- **Pit filled by a crate / by a Tarnish:** the same hole plugged flush by a wooden crate top / by a flattened rusted coin.
- **Crate:** a sturdy wooden crate in 3/4 view, dark iron corner brackets, a small coin stamp.
- **Goal (Heads / Tails):** a round coin socket engraved into the floor with the LEFT (gold) / RIGHT (silver) half glowing softly: "your half goes here".
- **Seam (24×64 vertical, 64×24 horizontal, tileable):** a coin's milled rim, densely reeded metal fading from gold (Heads side) to silver (Tails side).

## Backgrounds (1280×720, three parallax layers per chapter)

**Chapter 1, The Surface.** Far: looking down an old stone wishing well, concentric masonry courses fading into darkness, one tiny coin glint at the bottom, the left half faintly warm gold and the right half faintly cool silver. Mid: the well's stone wall courses framing the left, right and bottom edges (warm sunlit stone on the left, moonlit blue stone on the right), centre left clear. Near: ivy hanging from the top corners, the frayed end of the well rope near the top-left, floating pollen. Later chapters go deeper: Roots (greener, earthy), Stone (grey-warm), Waters (teal), Dark (deep, with glowing accents), Rim (polished gold and silver converging).

## Title screen (1280×720)

The well seen from directly above: a ring of stone, the shaft dropping into darkness, a coin glinting at the bottom. Centred over it, a large coin engraved with the title "Two Sides of the Same Coin" arched around its rim, the coin split vertically into a gold left half with an engraved sun and a silver right half with an engraved crescent moon. Tiny Sol and Lune stand on opposite sides of the rim, looking toward each other.

## Story panels (Phase 5; 3 per chapter, 1280×720)

Wordless storybook panels in the same style, e.g. opening: (1) a hand tossing a coin into a wishing well at dusk; (2) the coin splitting into a gold and a silver half as it falls; (3) Sol and Lune waking in their halves while rusty eyes glint in the dark below. Final: two people at the well, previously turned away from each other, now standing side by side.
