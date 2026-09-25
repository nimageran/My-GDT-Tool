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

The tool opens on a **Home** page ("What do you need to do?" start points and a map of every tool). The menu bar works like a desktop application: each tab opens a drop-down of its tools, in columns by group, with a one-line description; a path bar below shows where you are, with previous / next buttons. Tabs are in the order a drawing reader needs them. **Search** (header, or press `/`) finds any tool, symbol, term, note, line type, fit (`25 H7/g6`) or thread (`M8x1`) and opens it. Tools marked *planned* appear greyed with a "soon" badge and a description of their scope.

| Tab | What it covers | Built | Planned |
|---|---|---|---|
| **Home** | Start page | Common jobs as start points, search, map of all tools | |
| **Read Drawings** | Reading a drawing, from the sheet itself to hard callouts | *Drawing basics:* how to read a drawing (step-by-step on a sample sheet), title block, first vs third angle projection, lines & views, general tolerances (title block and ISO 2768), notes & abbreviations. *Decode callouts:* Symbol Finder (visual index of ~80 drawing symbols), feature control frames, frame legality checker, holes/threads/patterns, welding symbols, surface finish (ISO 1302 and US legacy) | |
| **Characteristics** | The 14 geometric characteristics as interactive tolerance zones, grouped Form / Profile / Orientation / Location / Runout | All 14 (concentricity and symmetry flagged as removed in 2018) | |
| **Material Condition** | Modifiers and the boundaries they create | Bonus tolerance (MMC / LMC / RFS), Rule #1 envelope (and independency), virtual & resultant condition (will the pin always fit the hole?), datum shift (MMB) | |
| **Datums** | How parts are held and measured from | Datum reference frame and datum precedence (3D), datum targets (points, lines, areas; drawing and fixture views) | |
| **Stack-ups & Fits** | Assembly math | Tolerance stack-up (worst case and RSS), fastener formulas, ISO fits (ISO 286: H7/g6 → limits, clearance or interference, preferred fits) | |
| **Inspection** | What quality does with the drawing | CMM position calculator, measurement methods, functional gauge designer | |
| **Learn** | Standards, practice and your own notes | My Notebook (your notes: company rules, decoded callouts, lessons learned; "+ Note" from any tool, tags, pins, found by search, backup export / import), learning path (6 lessons, 30 quiz questions from real callouts, progress saved; shown on Home), glossary (searchable), ASME vs ISO GPS, Y14.5-2009 vs 2018 (which edition, what changed and what did not) | |
| **Manufacturing** | Can the shop make it, and at what cost | Process capability guide (which process holds a tolerance and finish, cost rule of thumb), Cp / Cpk calculator (paste measurements, histogram, advice), ± to position (57% more zone, drag the hole) | |

## Structure

```
index.html, styles.css     Shell page
js/main.js                 Module loading
js/menu.js                 Menu bar, drop-down menus and path bar
js/config.js               Tabs and tools (the only place tools are registered)
js/theme.js                Shared visual language: colours, fonts, legend, frame, results strip
js/drawing_utils.js        createSVG(), readTolerance()
js/gdt_math.js             Shared calculations (position, bonus, virtual condition)
js/explain.js              Plain-language Explain panel content for every tool
js/glossary.js             Glossary terms + dotted-underline hover definitions
js/search.js               Search everything (header button, / or Ctrl+K); results open a tool on the right item
js/notes.js                My Notebook storage, note editor, backup export / import
js/focus.js                Hand-off of that item to the tool (setFocus / takeFocus)
js/legibility.js           Keeps canvas text readable when the canvas is scaled down
js/modules/<area>/*.js     One file per tool
js/modules/manufacturing/  Process capability, Cp / Cpk, ± to position
js/modules/material/       Rule #1, virtual condition, datum shift
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
