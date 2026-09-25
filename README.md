# GD&T Professional Analyst

An interactive ASME Y14.5 tool for manufacturing engineers: see each tolerance zone, work out bonus tolerance and datums, decode hard drawing callouts, and (on the roadmap) inspect, stack up and judge manufacturability.

Live site: https://nimageran.github.io/My-GDT-Tool/

## Running it locally

The tool uses ES modules, so it must be served over HTTP (opening `index.html` as a file won't work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tabs

Tabs are grouped by what you're trying to do. **Search** (header, or press `/`) finds any tool, symbol, term, note, line type, fit (`25 H7/g6`) or thread (`M8x1`) and opens it. Tools marked *planned* appear greyed with a "soon" badge and a description of their scope.

| Tab | What it covers | Built | Planned |
|---|---|---|---|
| **Characteristics** | The 14 geometric characteristics as interactive tolerance zones, grouped Form / Profile / Orientation / Location / Runout | All 14 (concentricity and symmetry flagged as removed in 2018) | |
| **Material Condition** | Modifiers and the boundaries they create | Bonus tolerance (MMC / LMC / RFS) | Virtual & resultant condition, Rule #1 envelope, datum shift (MMB) |
| **Datums** | How parts are held and measured from | Datum reference frame and datum precedence (3D) | Datum targets |
| **Read Drawings** | Reading a drawing, from the sheet itself to hard callouts | *Drawing basics:* how to read a drawing (step-by-step on a sample sheet), title block, first vs third angle projection, lines & views, general tolerances (title block and ISO 2768), notes & abbreviations. *Decode callouts:* Symbol Finder (visual index of ~80 drawing symbols), feature control frames, frame legality checker, holes/threads/patterns, welding symbols, surface finish (ISO 1302 and US legacy) | |
| **Inspection** | What quality does with the drawing | CMM position calculator | Measurement methods, functional gauge designer |
| **Stack-ups & Fits** | Assembly math | Tolerance stack-up (worst case and RSS), fastener formulas, ISO fits (ISO 286: H7/g6 → limits, clearance or interference, preferred fits) | |
| **Manufacturing** | Can the shop make it, and at what cost | | Process capability guide, Cp/Cpk, ± to position |
| **Learn** | Standards and practice | Glossary (99 terms, searchable) | Practice scenarios, Y14.5-2009 vs 2018, ASME vs ISO GPS |

## Structure

```
index.html, styles.css     Shell page
js/main.js                 Navigation and module loading
js/config.js               Tabs and tools (the only place tools are registered)
js/theme.js                Shared visual language: colours, fonts, legend, frame, results strip
js/drawing_utils.js        createSVG(), readTolerance()
js/gdt_math.js             Shared calculations (position, bonus, virtual condition)
js/explain.js              Plain-language Explain panel content for every tool
js/glossary.js             Glossary terms + dotted-underline hover definitions
js/search.js               Search everything (header button, / or Ctrl+K); results open a tool on the right item
js/focus.js                Hand-off of that item to the tool (setFocus / takeFocus)
js/legibility.js           Keeps canvas text readable when the canvas is scaled down
js/modules/<area>/*.js     One file per tool
js/modules/decode/         Decoders, symbols.js geometry library, DECODER_SPEC.md
js/modules/drawing/        Drawing basics; sheet.js (line styles, title block, dims) and dictionary.js (searchable card pages)
```

## Adding a tool

1. Write `js/modules/<area>/<tool>.js` exporting:
   - `draw(svg)`: render into the `<svg>` (viewBox `0 0 1000 800`). The shell gives each tool a fresh `<svg>`, so listeners never leak.
   - `loadControls(container)`: build the sidebar controls.
   - `unload()` (optional): stop animation loops or timers.
2. In `js/config.js`, add `filePath` to its entry and remove `planned` / `summary`. If it isn't listed yet, add a new entry.
3. For GD&T tools, use `theme.js` so the tool matches the others: blue zone, slate feature, black datum, grey dashed nominal, green/red for pass/fail only, results strip at the bottom.

Decoder tools follow `js/modules/decode/DECODER_SPEC.md`.

### 3D tools

3D tools use three.js, loaded from jsDelivr through the import map in `index.html` (`import * as THREE from 'three'`). It is only downloaded when a 3D tool is opened. A 3D tool hides the `<svg>`, mounts its own element marked `data-module-overlay` beside it, and must export `unload()` to stop its render loop and dispose of the renderer (see `js/modules/datums/drf.js`). Use 3D where depth helps understanding (datums, cylindrical zones, runout); keep calculators and flat zones in SVG.
