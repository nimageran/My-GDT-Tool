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

Tabs are grouped by what you're trying to do. Tools marked *planned* appear greyed with a "soon" badge and a description of their scope.

| Tab | What it covers | Built | Planned |
|---|---|---|---|
| **Characteristics** | The 14 geometric characteristics as interactive tolerance zones, grouped Form / Profile / Orientation / Location / Runout | All 14 (concentricity and symmetry flagged as removed in 2018) | |
| **Material Condition** | Modifiers and the boundaries they create | Bonus tolerance (MMC / LMC / RFS) | Virtual & resultant condition, Rule #1 envelope, datum shift (MMB) |
| **Datums** | How parts are held and measured from | | Datum reference frame (degrees of freedom), datum precedence, datum targets |
| **Decode Drawings** | Reading hard callouts | Feature control frames, holes/threads/patterns, welding symbols | Surface finish, frame legality checker |
| **Inspection** | What quality does with the drawing | | CMM position calculator, measurement methods, functional gauge designer |
| **Stack-ups & Fits** | Assembly math | | Tolerance stack-up, fastener formulas, ISO fits |
| **Manufacturing** | Can the shop make it, and at what cost | | Process capability guide, Cp/Cpk, ± to position |
| **Learn** | Standards and practice | | Practice scenarios, Y14.5-2009 vs 2018, ASME vs ISO GPS |

## Structure

```
index.html, styles.css     Shell page
js/main.js                 Navigation and module loading
js/config.js               Tabs and tools (the only place tools are registered)
js/theme.js                Shared visual language: colours, fonts, legend, frame, results strip
js/drawing_utils.js        createSVG(), readTolerance()
js/modules/<area>/*.js     One file per tool
js/modules/decode/         Decoders, symbols.js geometry library, DECODER_SPEC.md
```

## Adding a tool

1. Write `js/modules/<area>/<tool>.js` exporting:
   - `draw(svg)`: render into the `<svg>` (viewBox `0 0 1000 800`). The shell gives each tool a fresh `<svg>`, so listeners never leak.
   - `loadControls(container)`: build the sidebar controls.
   - `unload()` (optional): stop animation loops or timers.
2. In `js/config.js`, add `filePath` to its entry and remove `planned` / `summary`. If it isn't listed yet, add a new entry.
3. For GD&T tools, use `theme.js` so the tool matches the others: blue zone, slate feature, black datum, grey dashed nominal, green/red for pass/fail only, results strip at the bottom.

Decoder tools follow `js/modules/decode/DECODER_SPEC.md`.
