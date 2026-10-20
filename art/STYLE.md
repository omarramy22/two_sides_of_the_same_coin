# Art style guide: "Living Engraved Coin"

Read with SPEC.md §5. Reference implementations to match: `art/src/chars/sol/*.svg`, `art/src/chars/lune/*.svg`, `art/src/chars/tarnish/*.svg`.

## Files and pipeline
- One asset = one SVG under `art/src/`. Names starting with `_` are not assets.
- Root element: `<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H">`, sizes in 1x px. Tile = **64×64**. Actors (characters, Tarnish) = **96×96** with feet on (48, 88).
- `data-palettes="heads,tails"` on the root renders the asset once per world with that world's theme tokens (tiles). Leave it off for fixed-colour art (characters).
- `npm run art` bakes everything to PNG at 1x and 2x (`assets/`, `assets/manifest.json`); `npm run art:sheet` makes the contact sheet.
- Shared pieces come from `_defs.svg` (`url(#wobble)`, `url(#wobble-soft)`, `url(#grain)`, `url(#hatch)`, `url(#hatch-fine)`, `url(#hatch-cross)`, `url(#hatch-r)`, `url(#shine)`) and `_palettes.css` (colour tokens).

## Colour
- Only palette tokens: `var(--ink)`, `var(--floor)`, `var(--floor-light)`, `var(--floor-dark)`, `var(--wall-top)`, `var(--wall-face)`, `var(--wall-shade)`, `var(--accent)`, `var(--accent-dark)`, `var(--accent2)`, `var(--highlight)`, `var(--pit)` for tiles (they swap per world), plus the global tokens (`--gold*`, `--silver*`, `--rust*`, `--verdigris*`…). No raw hex in tiles except `#000`/`#fff` with an opacity for shadows and highlights.
- Vibrant, not muddy: flat colour fields, shading only by hatching and a darker token, never by greying colours down.

## Line
- Ink outline on every object: `stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"` (1.2–1.4 for interior details, 0.8–1 for engraving), inside a `<g filter="url(#wobble)">` (big shapes) or `url(#wobble-soft)` (small shapes). Never a perfectly straight unfiltered line on an object.
- Floors are quieter than objects: thinner (1–1.2), lower-contrast lines, so characters and objects pop.

## Shading and light
- Heads: light from the **top-left**, so shade the bottom-right with `url(#hatch)` (or `#hatch-cross` for deep shade). Tails: cool rim light from the **top-right**, so shade the bottom-left with `url(#hatch-r)`. A tile authored once for both palettes may use `#hatch` everywhere; the world difference comes from the palette.
- Highlights: short `var(--highlight)` strokes on lit edges, or `url(#shine)`.
- Engraving detail (guilloché arcs, milled/reeded edges via `stroke-dasharray`, small stamped stars and suns) is the signature. Use it sparingly on floors, generously on metal (coins, seam, frames).

## Readability rules (checked on the contact sheet)
- It must read at 64 px and still at 40 px (phone).
- Silhouette first: an object must be recognisable as a flat fill shape.
- Floors are low-contrast; walls are clearly "solid and raised"; pits are clearly "a hole you fall into"; goals are clearly special.
