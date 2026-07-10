# DECODER_SPEC.md — Drawing Decoder Modules
**Project:** Decode tab inside the existing GD&T Professional Analyst tool (ASME Y14.5 shell).
**Owner:** Nima. **Purpose:** Reverse-engineering tool for reading hard 2D drawing callouts — user reconstructs what they see on a drawing, tool renders the exact symbol + a visual preview + a plain-English interpretation.
**How to use this file:** Upload it to any new Claude conversation together with (a) the current `modules/decode/symbols.js` and (b) one existing decode module as a style reference. Then request ONE new module per conversation.

---

## 1. Host shell contract (DO NOT CHANGE THE SHELL)

The shell (`main.js`) dynamically imports modules and calls exactly two exported functions:

```js
export function draw(canvas)            // canvas = the <svg id="mainCanvas"> element, viewBox "0 0 1000 800"
export function loadControls(container) // container = the controls sidebar <div id="controlsContent">
```

- Modules are registered in `config.js` under the `DECODE` category:

```js
DECODE: {
    label: "Decode",
    icon: "fa-magnifying-glass",
    symbols: {
        welding: { name: "Welding Symbol", iconChar: "▷", filePath: './modules/decode/welding.js' },
        // future modules appended here
    }
}
```

- The shell clears the canvas and controls before each module load. Modules must be self-contained: no globals leaked, no shell edits required.
- Modules may import the shared helper `createSVG(type, attrs)` from `drawing_utils.js` and MUST import symbol geometry from `modules/decode/symbols.js`.
- Tool is served over HTTP (ES modules); Tailwind CDN + Font Awesome are available for controls markup. JetBrains Mono available via class `mono`.

## 2. Core architecture: one state object, three renderers

Every decode module follows this exact pattern:

```js
let state = { /* every parameter of the callout, with sensible defaults */ };

function renderSymbol(svg, state)    // draws the exact 2D standard symbol (constructed geometry)
function renderPreview(svg, state)   // draws the physical meaning (isometric joint, hole cross-section, etc.)
function renderSentence(svg, state)  // returns/draws the plain-English interpretation

function update() { /* clear zones, call all three renderers from current state */ }
```

- Any control input mutates `state` then calls `update()`. All three views must always agree with the state — never render from the DOM.
- `loadControls()` builds the inputs (dropdowns, numbers, toggles) that map 1:1 to state fields.

## 3. Canvas layout zones (viewBox 0 0 1000 800)

| Zone | Area | Content |
|---|---|---|
| SYMBOL | x 0–1000, y 0–260 | The constructed standard symbol, centered, with small labeled leaders |
| PREVIEW | x 0–1000, y 260–640 | Isometric / cross-section visual of what the callout physically commands |
| SENTENCE | x 0–1000, y 640–800 | Plain-English interpretation, wrapped text, plus gotcha warnings |

- Keep 40px margins. Symbol strokes: currentColor or `#0f172a`, width 1.5–2. Preview uses physical colors (steel grays `#B8B6AD`/`#C9C7BE`, weld amber `#EF9F27` stroke `#854F0B`). Highlights/zones: red `#ef4444`, blue `#3b82f6`.

## 4. symbols.js — shared exact-geometry library (APPEND-ONLY)

- One exported function per standard symbol. Signature convention:

```js
export function filletWeld(x, y, h, opts = {})   // returns an SVG <g> element, positioned at (x,y), height h
```

- Geometry MUST follow the standard's published construction (ASME Y14.5-2018 for GD&T; AWS A2.4 for welding; ISO 1302 for surface texture; ISO 2553 noted where it differs from AWS). No Unicode characters as content — navigation labels only.
- Never modify existing functions' signatures or geometry without explicit request; new symbols are appended. Each function gets a one-line comment citing the standard clause/figure it was built from.
- Known conventions baked in: fillet/bevel/J/flare-bevel perpendicular leg drawn on the LEFT; symbol below reference line = arrow side, above = other side (AWS); ISO uses solid vs dashed identification line instead — modules with ISO relevance must expose an AWS/ISO toggle.

## 5. Sentence + gotcha requirements

- The sentence is the product. Style: one flowing sentence or two, concrete units, reading exactly like a senior engineer explaining: *"6 mm fillet welds, both sides, chain intermittent: 50 mm segments on 150 mm centers (100 mm gaps), grind flush, weld in field."*
- Every module carries a GOTCHAS list: known misreadings tied to state conditions (e.g., pitch is center-to-center not gap; omitted groove depth = CJP; 8X applies to the entire callout stack; form tolerances take no datum). When a state condition triggers a gotcha, render it as a highlighted warning line under the sentence.
- LOCAL NOTES: each module includes a free-text notes field persisted to `localStorage` under key `decoder_notes_<moduleName>` — for shop-specific interpretations (MTM conventions). Load on init, save on input.

## 6. Roadmap (one module per conversation, in this order)

1. **welding.js** — full grammar: all weld types incl. compound (fillet-on-groove), sides (arrow/other/both), intermittent chain vs staggered, CJP/PJP depth logic, contour + finish letters, weld-all-around, field weld, tail (process/WPS/spec refs), melt-through, back/backing, backing bar, basic NDE symbols on shared reference line. AWS/ISO toggle. Preview: parametric isometric T-joint / butt joint with bead segments (both-sides beads ghosted-dashed when hidden).
2. **hole_callouts.js** — ⌀, ⌴ counterbore, spotface, ⌵ countersink (dia × angle), ↧ depth, THRU, multiplicity (nX scope rule), EQ SP, bolt circles (B.C.), thread callouts (metric M__×pitch-class and UNC/UNF decoded field-by-field). Preview: bolt-circle pattern + sectioned hole stack.
3. **surface_finish.js** — full ISO 1302 grammar: basic/removal-required/removal-prohibited marks, Ra/Rz values, sampling length, lay direction symbols, machining allowance, all-around. Preview: surface patch with lay texture.
4. **composite_frames.js** — composite vs multi-single-segment position frames, pattern-locating vs feature-relating, datum feature modifiers, Ⓤ Ⓕ Ⓟ, 2X / SIM / ALL OVER / between symbol. Preview: pattern with two tolerance zone sets.
5. **fits.js** — ISO 286 fit decoder: input nominal + fit (e.g., H7/g6), output limit dimensions, clearance/interference range, fit character. Preview: shaft-in-hole zone diagram.

## 7. Session workflow (for the human)

1. New conversation → upload: `DECODER_SPEC.md`, current `symbols.js`, one finished decode module (style reference).
2. Ask: "Build `<module>.js` per the spec, next on the roadmap."
3. Save the delivered module into `modules/decode/`, save the updated `symbols.js` (append-only), add the one config entry if new.
4. Test against a real drawing callout; anything wrong or missing → next conversation fixes/extends that module before moving down the roadmap.
5. Real hard callouts encountered at work become test cases: reconstruct in the tool, verify, and record in LOCAL NOTES.

## 8. Quality bar

- Symbol geometry verifiable against the cited standard figure.
- No Unicode in rendered content; all constructed SVG paths.
- Module runs standalone with only `symbols.js` + `drawing_utils.js` imports; zero shell edits.
- Every state field reachable from controls; every control change re-renders all three zones.
- Sentence always grammatically complete and unit-explicit; gotchas fire on the exact conditions listed in the module's GOTCHAS array.
