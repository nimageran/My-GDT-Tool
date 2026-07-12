// modules/decode/composite_frames.js
// ============================================================================
// FEATURE CONTROL FRAME DECODER — per DECODER_SPEC.md (roadmap #4, expanded)
// Goal: decode ANY frame found on a drawing. Covers:
//   - all 14 characteristics (incl. legacy concentricity/symmetry)
//   - zone shapes (planes / cylindrical / spherical), tolerance value
//   - material condition modifiers M, L (RFS default), per-unit basis
//   - extra modifiers: P projected (+height), F free state, T tangent plane,
//     U unequally disposed (+value)
//   - up to 3 datums, each with material boundary modifiers, compound (A-B)
//   - frame structures: single / multi-single-segment / COMPOSITE
//   - context: nX prefix, ALL OVER, ALL AROUND, between (A to B), SIM/SEP REQT
// Standard: ASME Y14.5-2018. Exports: draw(canvas), loadControls(container)
// ============================================================================

import { el, gdtChar, circledMod, diaSymbol } from './symbols.js';

// --------------------------------------------------------------------------
// CHARACTERISTIC METADATA
// --------------------------------------------------------------------------
const CHARS = {
    straightness:   { name: 'Straightness',    cat: 'form' },
    flatness:       { name: 'Flatness',        cat: 'form' },
    circularity:    { name: 'Circularity',     cat: 'form' },
    cylindricity:   { name: 'Cylindricity',    cat: 'form' },
    profileLine:    { name: 'Profile of a Line',    cat: 'profile' },
    profileSurface: { name: 'Profile of a Surface', cat: 'profile' },
    angularity:     { name: 'Angularity',      cat: 'orientation' },
    perpendicularity:{ name: 'Perpendicularity', cat: 'orientation' },
    parallelism:    { name: 'Parallelism',     cat: 'orientation' },
    position:       { name: 'Position',        cat: 'location' },
    concentricity:  { name: 'Concentricity (legacy)', cat: 'location' },
    symmetry:       { name: 'Symmetry (legacy)',      cat: 'location' },
    circularRunout: { name: 'Circular Runout', cat: 'runout' },
    totalRunout:    { name: 'Total Runout',    cat: 'runout' }
};
const FORM = ['straightness', 'flatness', 'circularity', 'cylindricity'];
const RUNOUT = ['circularRunout', 'totalRunout'];
const LEGACY = ['concentricity', 'symmetry'];

// --------------------------------------------------------------------------
// STATE
// --------------------------------------------------------------------------
const blankDatum = () => ({ r: '', m: 'none' });
const state = {
    structure: 'single',           // 'single' | 'multi' | 'composite'
    char: 'position',
    char2: 'position',             // second row char, multi mode only
    rows: [
        { zone: 'dia', value: 0.25, mod: 'M', pHeight: null, F: false, T: false, U: false, uVal: null, perUnit: '',
          d: [{ r: 'A', m: 'none' }, { r: 'B', m: 'none' }, { r: 'C', m: 'none' }] },
        { zone: 'dia', value: 0.1, mod: 'none', pHeight: null, F: false, T: false, U: false, uVal: null, perUnit: '',
          d: [{ r: 'A', m: 'none' }, blankDatum(), blankDatum()] }
    ],
    prefix: '',                    // e.g. '4X'
    allOver: false, allAround: false,
    between: '',                   // e.g. 'G-H'
    sim: 'none'                    // 'none' | 'SIM' | 'SEP'
};

// --------------------------------------------------------------------------
// GOTCHAS (spec §5) — the ones that separate juniors from seniors
// --------------------------------------------------------------------------
const activeDatums = row => row.d.filter(d => d.r.trim());
const GOTCHAS = [
    { when: s => s.structure === 'composite',
      text: () => `COMPOSITE frame (one shared symbol, two rows): the TOP row locates the pattern to the datums (PLTZF); the BOTTOM row only controls feature-to-feature spacing and ORIENTATION to its datums — it does NOT locate. Repeated datums in the lower row constrain rotation only.` },
    { when: s => s.structure === 'multi',
      text: () => `Two SEPARATE symbols stacked = multi-single-segment: two fully INDEPENDENT requirements. Unlike a composite, the lower row's datums locate AND orient. Same-looking frame, different meaning — check whether the symbol is shared.` },
    { when: s => s.rows[0].mod === 'M' || (s.structure !== 'single' && s.rows[1].mod === 'M'),
      text: () => `The M after the tolerance = BONUS tolerance: as the feature departs from MMC toward LMC, the zone grows by exactly that departure. A 0.25 zone on a hole 0.2 over its MMC size becomes 0.45.` },
    { when: s => s.rows.some((r, i) => (i === 0 || s.structure !== 'single') && activeDatums(r).some(d => d.m === 'M')),
      text: () => `M on a DATUM letter is not bonus — it is DATUM SHIFT: the whole zone framework may float as the datum feature departs from its boundary. Different mechanism, different math.` },
    { when: s => FORM.includes(s.char) && activeDatums(s.rows[0]).length > 0,
      text: () => `Form tolerances (straightness, flatness, circularity, cylindricity) NEVER take a datum — a form control with datums is an illegal callout. Flag the drawing.` },
    { when: s => activeDatums(s.rows[0]).length >= 2,
      text: s => `Datum ORDER = fixturing order: ${activeDatums(s.rows[0]).map(d => d.r).join(' then ')} means seat on ${activeDatums(s.rows[0])[0].r} first. Reordering the same letters is a DIFFERENT requirement.` },
    { when: s => s.char === 'position' && s.rows[0].zone === 'none',
      text: () => `Position with NO diameter symbol = the zone is two parallel planes, controlling one direction only. For a hole this is almost always a drawing error — expect a diameter symbol.` },
    { when: s => LEGACY.includes(s.char),
      text: () => `Concentricity and symmetry were REMOVED from Y14.5 in 2018 (they required expensive median-point measurement). On new drawings expect position or runout instead; decode legacy prints as drawn.` },
    { when: s => s.rows[0].pHeight != null,
      text: s => `P = projected tolerance zone: the ${s.rows[0].value} zone applies ${s.rows[0].pHeight} mm ABOVE the surface, where the mating fastener actually lives — standard for threaded and press-fit holes.` },
    { when: s => s.rows[0].U && s.rows[0].uVal != null,
      text: s => `U modifier: of the total ${s.rows[0].value} profile band, ${s.rows[0].uVal} lies OUTSIDE the material (in the direction adding material); the rest lies inside.` },
    { when: s => RUNOUT.includes(s.char) && activeDatums(s.rows[0]).length === 0,
      text: () => `Runout is meaningless without a datum AXIS — expect a single datum or a compound axis like A-B (part spun between centers).` },
    { when: s => (s.rows[0].mod !== 'none' || true) && s.rows[0].mod === 'none' && s.char === 'position',
      text: () => `No modifier after the tolerance = RFS (regardless of feature size) BY DEFAULT since 1994 — the zone stays fixed no matter the produced size. No S symbol is needed or drawn.` },
    { when: s => s.sim !== 'none',
      text: s => s.sim === 'SIM'
          ? `SIM REQT: this frame and its partners act as ONE pattern — gauged together in a single setup.`
          : `SEP REQT: explicitly breaks the default simultaneity — each requirement is gauged independently.` }
];

// --------------------------------------------------------------------------
let zones = null, controlsRoot = null;

export function draw(canvas) {
    const defs = el('defs');
    const mk = el('marker', { id: 'cf-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    mk.appendChild(el('path', { d: 'M1 1 L9 5 L1 9 Z', fill: '#0f172a' }));
    defs.appendChild(mk);
    canvas.appendChild(defs);

    [[260, 'WHAT IT MEANS SPATIALLY'], [620, 'IN PLAIN ENGLISH']].forEach(([y, label]) => {
        canvas.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#e2e8f0', 'stroke-width': 1 }));
        canvas.appendChild(txt(label, 40, y + 20, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    });
    canvas.appendChild(txt('FRAME', 40, 24, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));

    zones = { symbol: el('g'), preview: el('g'), sentence: el('g') };
    Object.values(zones).forEach(z => canvas.appendChild(z));
    update();
}

function update() {
    if (!zones) return;
    Object.values(zones).forEach(z => { while (z.firstChild) z.removeChild(z.firstChild); });
    renderFrame(zones.symbol, state);
    renderPreview(zones.preview, state);
    renderSentence(zones.sentence, state);
    syncControlVisibility();
}

function txt(str, x, y, o = {}) {
    const t = el('text', {
        x, y, 'font-size': o.size || 16, fill: o.fill || '#0f172a',
        'font-family': o.mono ? "'JetBrains Mono', monospace" : 'ui-sans-serif, system-ui, sans-serif',
        'text-anchor': o.anchor || 'start', 'dominant-baseline': o.baseline || 'auto'
    });
    if (o.bold) t.setAttribute('font-weight', '700');
    if (o.spacing) t.setAttribute('letter-spacing', o.spacing);
    t.textContent = str;
    return t;
}
const S = { stroke: '#0f172a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

// ==========================================================================
// RENDERER 1 — THE FRAME (exact constructed geometry, dynamic compartments)
// ==========================================================================
const ROW_H = 46, CHAR_W = 50, MOD_R = 12;

/** Layout a tolerance-compartment content list: [{t:'glyph-dia'|'text'|'mod', ...}] */
function tolContent(row) {
    const items = [];
    if (row.zone === 'dia') items.push({ t: 'dia' });
    if (row.zone === 'sdia') { items.push({ t: 'text', s: 'S' }); items.push({ t: 'dia' }); }
    items.push({ t: 'text', s: String(row.value) + (row.perUnit.trim() ? ' / ' + row.perUnit.trim() : '') });
    if (row.mod !== 'none') items.push({ t: 'mod', s: row.mod });
    if (row.U) { items.push({ t: 'mod', s: 'U' }); if (row.uVal != null) items.push({ t: 'text', s: String(row.uVal) }); }
    if (row.pHeight != null) { items.push({ t: 'mod', s: 'P' }); items.push({ t: 'text', s: String(row.pHeight) }); }
    if (row.F) items.push({ t: 'mod', s: 'F' });
    if (row.T) items.push({ t: 'mod', s: 'T' });
    return items;
}
const itemW = it => it.t === 'dia' ? 30 : it.t === 'mod' ? MOD_R * 2 + 6 : it.s.length * 12.5 + 10;

function drawRowCells(g, x, y, row) {
    // returns total width drawn from x. y = row TOP.
    const cy = y + ROW_H / 2;
    // tolerance cell
    const items = tolContent(row);
    const tolW = Math.max(80, items.reduce((a, it) => a + itemW(it), 0) + 16);
    g.appendChild(el('rect', { x, y, width: tolW, height: ROW_H, ...S, 'stroke-width': 1.6 }));
    let cx = x + 10;
    for (const it of items) {
        if (it.t === 'dia') g.appendChild(withScale(diaSymbol(cx, cy + 11, 24)));
        else if (it.t === 'mod') g.appendChild(circledMod(cx + MOD_R, cy, MOD_R, it.s));
        else g.appendChild(txt(it.s, cx, cy, { size: 20, mono: true, bold: true, baseline: 'central' }));
        cx += itemW(it);
    }
    let xx = x + tolW;
    // datum cells
    for (const d of row.d) {
        if (!d.r.trim()) continue;
        const w = d.r.trim().length * 13 + (d.m !== 'none' ? MOD_R * 2 + 8 : 0) + 22;
        g.appendChild(el('rect', { x: xx, y, width: w, height: ROW_H, ...S, 'stroke-width': 1.6 }));
        g.appendChild(txt(d.r.trim().toUpperCase(), xx + 11, cy, { size: 20, mono: true, bold: true, baseline: 'central' }));
        if (d.m !== 'none') g.appendChild(circledMod(xx + d.r.trim().length * 13 + 11 + MOD_R, cy, MOD_R, d.m));
        xx += w;
    }
    return xx - x;
}
function withScale(g) { return g; } // dia glyph is already sized by h

function renderFrame(g, s) {
    const twoRows = s.structure !== 'single';
    const x0 = 170;
    const yTop = twoRows ? 92 : 116;

    let maxW = 0;
    if (s.structure === 'composite') {
        // one char cell spanning both rows
        g.appendChild(el('rect', { x: x0, y: yTop, width: CHAR_W, height: ROW_H * 2, ...S, 'stroke-width': 1.6 }));
        g.appendChild(gdtChar(s.char, x0 + CHAR_W / 2, yTop + ROW_H, 30));
        maxW = Math.max(drawRowCells(g, x0 + CHAR_W, yTop, s.rows[0]),
                        drawRowCells(g, x0 + CHAR_W, yTop + ROW_H, s.rows[1]));
    } else {
        g.appendChild(el('rect', { x: x0, y: yTop, width: CHAR_W, height: ROW_H, ...S, 'stroke-width': 1.6 }));
        g.appendChild(gdtChar(s.char, x0 + CHAR_W / 2, yTop + ROW_H / 2, 30));
        maxW = drawRowCells(g, x0 + CHAR_W, yTop, s.rows[0]);
        if (s.structure === 'multi') {
            g.appendChild(el('rect', { x: x0, y: yTop + ROW_H, width: CHAR_W, height: ROW_H, ...S, 'stroke-width': 1.6 }));
            g.appendChild(gdtChar(s.char2, x0 + CHAR_W / 2, yTop + ROW_H * 1.5, 30));
            maxW = Math.max(maxW, drawRowCells(g, x0 + CHAR_W, yTop + ROW_H, s.rows[1]));
        }
    }

    // context around the frame
    if (s.prefix.trim()) g.appendChild(txt(s.prefix.trim().toUpperCase(), x0, yTop - 12, { size: 18, mono: true, bold: true }));
    const below = [];
    if (s.between.trim()) below.push({ between: s.between.trim().toUpperCase() });
    if (s.sim !== 'none') below.push({ text: s.sim + ' REQT' });
    let by = yTop + ROW_H * (twoRows ? 2 : 1) + 26;
    for (const b of below) {
        if (b.between) {
            const [p1, p2] = b.between.split(/[-\s]+/);
            g.appendChild(txt(p1 || 'A', x0, by, { size: 16, mono: true, bold: true }));
            const lx = x0 + (p1 || 'A').length * 11 + 8;
            g.appendChild(el('line', { x1: lx, y1: by - 5, x2: lx + 44, y2: by - 5, ...S, 'stroke-width': 1.6,
                'marker-start': 'url(#cf-arrow)', 'marker-end': 'url(#cf-arrow)' }));
            g.appendChild(txt(p2 || 'B', lx + 52, by, { size: 16, mono: true, bold: true }));
        } else {
            g.appendChild(txt(b.text, x0, by, { size: 14, mono: true }));
        }
        by += 24;
    }

    // leader to the previewed feature; ALL AROUND circle / ALL OVER double circle at elbow
    const fx = x0 + CHAR_W + maxW, fy = yTop + ROW_H * (twoRows ? 1 : 0.5);
    const elbow = [fx + 60, fy], target = [560, 380];
    g.appendChild(el('polyline', { ...S, 'stroke-width': 1.5, points: `${fx},${fy} ${elbow[0]},${elbow[1]} ${target[0]},${target[1]}`, 'marker-end': 'url(#cf-arrow)' }));
    if (s.allAround) g.appendChild(el('circle', { cx: elbow[0], cy: elbow[1], r: 7, ...S, 'stroke-width': 1.6 }));
    if (s.allOver) { g.appendChild(el('circle', { cx: elbow[0], cy: elbow[1], r: 7, ...S, 'stroke-width': 1.6 }));
                     g.appendChild(el('circle', { cx: elbow[0], cy: elbow[1], r: 11, ...S, 'stroke-width': 1.6 })); }
}

// ==========================================================================
// RENDERER 2 — THE PREVIEW (tolerance zone schematic per category)
// ==========================================================================
const ZONE = { stroke: '#ef4444', 'stroke-width': 1.8, fill: 'rgba(239,68,68,0.08)', 'stroke-dasharray': '7 5' };
const ZONE2 = { stroke: '#3b82f6', 'stroke-width': 1.8, fill: 'rgba(59,130,246,0.07)', 'stroke-dasharray': '7 5' };
const DATUM = { stroke: '#334155', 'stroke-width': 2.5, fill: 'none' };

function renderPreview(g, s) {
    const cat = CHARS[s.char].cat;
    if (s.structure === 'composite' && s.char === 'position') return compositePreview(g, s);
    if (cat === 'form') formPreview(g, s);
    else if (cat === 'orientation') orientationPreview(g, s);
    else if (cat === 'profile') profilePreview(g, s);
    else if (cat === 'runout') runoutPreview(g, s);
    else locationPreview(g, s);
}

function formPreview(g, s) {
    // wavy surface between two parallel zone lines
    g.appendChild(el('path', { d: 'M300 460 q 60 -26 120 0 t 120 0 t 120 0', stroke: '#0f172a', 'stroke-width': 2.5, fill: 'none' }));
    g.appendChild(el('rect', { x: 290, y: 424, width: 480, height: 54, ...ZONE }));
    zlabel(g, `zone: ${s.rows[0].value} wide`, 790, 452);
    g.appendChild(txt('no datums — form is measured against the feature itself', 300, 540, { size: 13, fill: '#64748b' }));
}

function orientationPreview(g, s) {
    // datum plane + oriented zone band
    g.appendChild(el('line', { x1: 280, y1: 540, x2: 760, y2: 540, ...DATUM }));
    for (let x = 290; x < 760; x += 22) g.appendChild(el('line', { x1: x, y1: 540, x2: x - 12, y2: 554, stroke: '#334155', 'stroke-width': 1 }));
    dframe(g, activeDatums(state.rows[0])[0]?.r || 'A', 510, 572);
    const ang = s.char === 'perpendicularity' ? -90 : s.char === 'parallelism' ? 0 : -55;
    const grp = el('g', { transform: `rotate(${ang} 520 540)` });
    grp.appendChild(el('rect', { x: 540, y: 522, width: 190, height: 36, ...ZONE }));
    grp.appendChild(el('line', { x1: 548, y1: 540, x2: 722, y2: 540, stroke: '#0f172a', 'stroke-width': 2.5 }));
    g.appendChild(grp);
    zlabel(g, `zone: ${zoneWord(s.rows[0], true)} held at ${s.char === 'perpendicularity' ? '90\u00B0' : s.char === 'parallelism' ? '0\u00B0' : 'the BASIC angle'} to the datum`, 300, 330);
}

function profilePreview(g, s) {
    const d = 'M300 520 C 380 420, 520 420, 600 480 S 740 540, 780 470';
    g.appendChild(el('path', { d, stroke: '#0f172a', 'stroke-width': 2.5, fill: 'none' }));
    const off = s.rows[0].U ? 30 : 16;
    g.appendChild(el('path', { d, stroke: '#ef4444', 'stroke-width': 1.6, fill: 'none', 'stroke-dasharray': '7 5', transform: `translate(0,${-off})` }));
    g.appendChild(el('path', { d, stroke: '#ef4444', 'stroke-width': 1.6, fill: 'none', 'stroke-dasharray': '7 5', transform: `translate(0,${32 - off})` }));
    zlabel(g, s.rows[0].U ? `band ${s.rows[0].value}: ${s.rows[0].uVal ?? '?'} outside material (U)` : `band ${s.rows[0].value} centered on true profile`, 300, 330);
}

function runoutPreview(g, s) {
    g.appendChild(el('line', { x1: 300, y1: 450, x2: 780, y2: 450, stroke: '#334155', 'stroke-width': 1, 'stroke-dasharray': '10 4 2 4' }));
    g.appendChild(el('ellipse', { cx: 540, cy: 450, rx: 150, ry: 62, stroke: '#0f172a', 'stroke-width': 2.5, fill: '#C9C7BE' }));
    g.appendChild(el('ellipse', { cx: 540, cy: 450, rx: 165, ry: 74, ...ZONE }));
    // indicator
    g.appendChild(el('line', { x1: 540, y1: 340, x2: 540, y2: 380, stroke: '#0f172a', 'stroke-width': 2.5 }));
    g.appendChild(el('path', { d: 'M532 380 L548 380 L540 392 Z', fill: '#0f172a' }));
    dframe(g, activeDatums(state.rows[0])[0]?.r || 'A', 300, 480);
    zlabel(g, `${s.char === 'totalRunout' ? 'FIM over the WHOLE surface at once' : 'FIM at each cross-section'} \u2264 ${s.rows[0].value}, spun on the datum axis`, 320, 330);
}

function locationPreview(g, s) {
    // datum corner A (bottom) + B (left), feature at basic position, zone
    g.appendChild(el('line', { x1: 300, y1: 560, x2: 800, y2: 560, ...DATUM }));
    g.appendChild(el('line', { x1: 320, y1: 320, x2: 320, y2: 560, ...DATUM }));
    const ds = activeDatums(state.rows[0]);
    dframe(g, ds[0]?.r || 'A', 540, 592);
    if (ds[1]) dframe(g, ds[1].r, 262, 430);
    // basic dims
    g.appendChild(el('line', { x1: 320, y1: 460, x2: 560, y2: 460, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
    g.appendChild(txt('basic', 420, 452, { size: 11, fill: '#94a3b8', mono: true }));
    // feature + zone
    g.appendChild(el('circle', { cx: 560, cy: 460, r: 34, stroke: '#0f172a', 'stroke-width': 2.5, fill: '#f8fafc' }));
    if (s.rows[0].zone === 'none') g.appendChild(el('rect', { x: 536, y: 380, width: 48, height: 160, ...ZONE }));
    else g.appendChild(el('circle', { cx: 560, cy: 460, r: 48, ...ZONE }));
    g.appendChild(el('circle', { cx: 560, cy: 460, r: 2.5, fill: '#ef4444' }));
    if (s.rows[0].pHeight != null) {
        g.appendChild(el('rect', { x: 512, y: 344, width: 96, height: 40, ...ZONE2 }));
        zlabel(g, `projected ${s.rows[0].pHeight} above surface (P)`, 630, 358);
    }
    zlabel(g, `${zoneWord(s.rows[0], true)} at TRUE position${s.rows[0].mod === 'M' ? ' — grows with bonus at MMC' : ''}`, 330, 330);
}

function compositePreview(g, s) {
    // 4-hole pattern: big blue zones located to datums, small red zones tied together
    g.appendChild(el('line', { x1: 280, y1: 570, x2: 820, y2: 570, ...DATUM }));
    dframe(g, activeDatums(s.rows[0])[0]?.r || 'A', 540, 598);
    const pts = [[430, 420], [670, 420], [430, 520], [670, 520]];
    // pattern tie lines
    g.appendChild(el('path', { d: `M430 420 H670 V520 H430 Z`, stroke: '#94a3b8', 'stroke-width': 1, fill: 'none', 'stroke-dasharray': '4 4' }));
    for (const [x, y] of pts) {
        g.appendChild(el('circle', { cx: x, cy: y, r: 44, ...ZONE2 }));
        g.appendChild(el('circle', { cx: x, cy: y, r: 22, ...ZONE }));
        g.appendChild(el('circle', { cx: x, cy: y, r: 15, stroke: '#0f172a', 'stroke-width': 2, fill: '#f8fafc' }));
    }
    zlabel(g, `blue = top row ${s.rows[0].value}: locates the PATTERN to the datums`, 300, 320, '#1d4ed8');
    zlabel(g, `red = bottom row ${s.rows[1].value}: holds the holes to EACH OTHER (and orientation only)`, 300, 344, '#b91c1c');
}

function dframe(g, letter, x, y) {
    g.appendChild(el('rect', { x: x - 15, y: y - 14, width: 30, height: 28, stroke: '#334155', 'stroke-width': 1.8, fill: '#fff' }));
    g.appendChild(txt(letter.toUpperCase(), x, y, { size: 16, bold: true, mono: true, anchor: 'middle', baseline: 'central' }));
    g.appendChild(el('path', { d: `M${x - 6} ${y - 14} L${x} ${y - 26} L${x + 6} ${y - 14} Z`, fill: '#334155' }));
}
function zlabel(g, str, x, y, fill = '#475569') { g.appendChild(txt(str, x, y, { size: 13, fill, mono: true })); }

// ==========================================================================
// RENDERER 3 — THE SENTENCE + GOTCHAS
// ==========================================================================
function zoneWord(row, short = false) {
    if (row.zone === 'dia') return short ? `a ${row.value} dia cylindrical zone` : `a cylindrical tolerance zone ${row.value} mm in diameter`;
    if (row.zone === 'sdia') return `a spherical tolerance zone ${row.value} mm in diameter`;
    return short ? `two planes ${row.value} apart` : `two parallel planes ${row.value} mm apart`;
}
function datumPhrase(row) {
    const names = ['primary', 'secondary', 'tertiary'];
    const ds = activeDatums(row);
    if (!ds.length) return '';
    return 'relative to ' + ds.map((d, i) =>
        `datum ${d.r.toUpperCase()} (${names[i]}${d.m !== 'none' ? `, at ${d.m === 'M' ? 'MMB — datum shift allowed' : 'LMB'}` : ''})`
    ).join(', ');
}

function rowSentence(charKey, row, s) {
    const v = row.value, dp = datumPhrase(row);
    const mod = row.mod === 'M' ? ' at MMC (bonus tolerance as the feature departs from MMC)'
             : row.mod === 'L' ? ' at LMC' : '';
    const per = row.perUnit.trim() ? ` per each ${row.perUnit.trim()} of length` : '';
    switch (charKey) {
        case 'straightness': return `each line element (or the axis, if applied to a size) must lie within ${zoneWord(row)}${per}${mod}`;
        case 'flatness': return `the entire surface must lie between two parallel planes ${v} mm apart${per}`;
        case 'circularity': return `every circular cross-section must lie between two concentric circles ${v} mm apart radially`;
        case 'cylindricity': return `the whole cylindrical surface must lie between two coaxial cylinders ${v} mm apart radially`;
        case 'profileLine': return `each line element of the profile must stay within a band ${v} mm wide about the true (basic) profile ${dp}`;
        case 'profileSurface': return `the entire surface must stay within a three-dimensional band ${v} mm wide about the true (basic) profile ${dp}`;
        case 'angularity': return `the feature must lie within ${zoneWord(row)} held at its BASIC angle ${dp}${mod}`;
        case 'perpendicularity': return `the feature must lie within ${zoneWord(row)} held exactly 90 degrees ${dp}${mod}`;
        case 'parallelism': return `the feature must lie within ${zoneWord(row)} held parallel ${dp}${mod}`;
        case 'position': return `the feature's axis or center must lie within ${zoneWord(row)} located at true (basic) position ${dp}${mod}${row.pHeight != null ? `, the zone projected ${row.pHeight} mm above the surface` : ''}`;
        case 'concentricity': return `(legacy) all median points must lie within a ${v} mm diameter zone coaxial with ${dp.replace('relative to ', '')}`;
        case 'symmetry': return `(legacy) all median points must lie within a zone ${v} mm wide, symmetric about the datum center plane ${dp}`;
        case 'circularRunout': return `at every cross-section, the full indicator movement must not exceed ${v} mm when the part is rotated about the datum axis ${dp}`;
        case 'totalRunout': return `the full indicator movement over the ENTIRE surface, checked simultaneously, must not exceed ${v} mm about the datum axis ${dp}`;
        default: return '';
    }
}

function renderSentence(g, s) {
    const bits = [];
    if (s.prefix.trim()) bits.push(`Applies to ${s.prefix.trim().toUpperCase().replace('X', '')} features (${s.prefix.trim().toUpperCase()})`);
    if (s.allOver) bits.push('applies ALL OVER the part');
    if (s.allAround) bits.push('applies all around the outline');
    if (s.between.trim()) bits.push(`applies only between points ${s.between.trim().toUpperCase()}`);

    let main;
    if (s.structure === 'composite') {
        main = `Composite ${CHARS[s.char].name.toLowerCase()}: TOP row — ${rowSentence(s.char, s.rows[0], s)}. BOTTOM row — the features must additionally hold ${zoneWord(s.rows[1])} to EACH OTHER${activeDatums(s.rows[1]).length ? `, oriented (not located) to ${activeDatums(s.rows[1]).map(d => d.r.toUpperCase()).join(', ')}` : ''}${s.rows[1].mod === 'M' ? ', at MMC' : ''}`;
    } else if (s.structure === 'multi') {
        main = `Two independent requirements. First: ${rowSentence(s.char, s.rows[0], s)}. Second: ${rowSentence(s.char2, s.rows[1], s)}`;
    } else {
        main = rowSentence(s.char, s.rows[0], s).replace(/^./, c => c.toUpperCase());
    }

    const sentence = (bits.length ? bits.join('; ') + '. ' : '') + main + '.';
    wrapText(g, sentence, 40, 658, 900, 17, '#0f172a', 24);

    let gy = 658 + 24 * Math.ceil(sentence.length / 96) + 12;
    const fired = GOTCHAS.filter(x => x.when(s)).slice(0, 4);
    for (const gotcha of fired) {
        g.appendChild(el('path', { d: `M40 ${gy - 4} l7 -12 l7 12 Z`, fill: '#f59e0b' }));
        wrapText(g, gotcha.text(state), 62, gy, 880, 12.5, '#b45309', 16);
        gy += 16 * Math.ceil(gotcha.text(state).length / 135) + 6;
    }
}

function wrapText(g, str, x, y, maxW, size, fill, lineH) {
    const perLine = Math.floor(maxW / (size * 0.52));
    const words = str.split(' ');
    let line = '', ly = y;
    for (const w of words) {
        if ((line + ' ' + w).trim().length > perLine) {
            g.appendChild(txt(line.trim(), x, ly, { size, fill }));
            line = w; ly += lineH;
        } else line = (line + ' ' + w).trim();
    }
    if (line) g.appendChild(txt(line, x, ly, { size, fill }));
}

// ==========================================================================
// loadControls(container)
// ==========================================================================
export function loadControls(container) {
    controlsRoot = container;
    const charOpts = Object.entries(CHARS).map(([k, c]) => [k, c.name]);
    container.innerHTML = `
    <div class="space-y-5">
      ${section('Frame Structure', `
        ${sel('structure', 'Structure', [['single', 'Single frame'], ['composite', 'Composite (shared symbol, 2 rows)'], ['multi', 'Multi-single-segment (2 stacked frames)']])}
        <div class="mt-2">${sel('char', 'Characteristic', charOpts)}</div>
        <div data-when="multi" class="mt-2">${sel('char2', 'Row 2 characteristic', charOpts)}</div>`)}
      ${rowEditor(0, 'Tolerance Row 1')}
      <div data-when="tworows">${rowEditor(1, 'Row 2 (lower segment)')}</div>
      ${section('Around the Frame', `
        <div class="grid grid-cols-2 gap-2">
          ${text('prefix', 'Prefix (e.g. 4X)', '')}
          ${text('between', 'Between (e.g. G-H)', '')}
        </div>
        <div class="space-y-1.5 text-sm mt-2">
          <label class="flex items-center gap-2"><input type="checkbox" id="cf-allAround"> All around</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="cf-allOver"> All over</label>
        </div>
        <div class="mt-2">${sel('sim', 'Requirement grouping', [['none', 'Default'], ['SIM', 'SIM REQT'], ['SEP', 'SEP REQT']])}</div>`)}
      ${section('Local Notes (MTM)', `
        <textarea id="cf-notes" rows="3" placeholder="Shop-specific interpretations\u2026" class="${INPUT}"></textarea>
        <p class="text-[10px] text-slate-400 mt-1">Saved on this machine automatically.</p>`)}
    </div>`;

    ['structure', 'char', 'char2', 'sim'].forEach(k => bindTop(k, 'sel'));
    ['prefix', 'between'].forEach(k => bindTop(k, 'text'));
    ['allAround', 'allOver'].forEach(k => bindTop(k, 'chk'));

    for (const i of [0, 1]) {
        bindRow(i, 'zone', 'sel'); bindRow(i, 'mod', 'sel');
        bindRow(i, 'value', 'num', 0.25); bindRow(i, 'pHeight', 'num', null); bindRow(i, 'uVal', 'num', null);
        bindRow(i, 'perUnit', 'text'); bindRow(i, 'F', 'chk'); bindRow(i, 'T', 'chk'); bindRow(i, 'U', 'chk');
        for (const j of [0, 1, 2]) {
            const rEl = container.querySelector(`#cf-r${i}d${j}r`), mEl = container.querySelector(`#cf-r${i}d${j}m`);
            rEl.value = state.rows[i].d[j].r; mEl.value = state.rows[i].d[j].m;
            rEl.oninput = () => { state.rows[i].d[j].r = rEl.value; update(); };
            mEl.onchange = () => { state.rows[i].d[j].m = mEl.value; update(); };
        }
    }

    const notes = container.querySelector('#cf-notes');
    notes.value = localStorage.getItem('decoder_notes_composite_frames') || '';
    notes.oninput = () => localStorage.setItem('decoder_notes_composite_frames', notes.value);

    update();

    function bindTop(key, kind) {
        const e = container.querySelector(`#cf-${key}`);
        if (kind === 'chk') { e.checked = !!state[key]; e.onchange = () => { state[key] = e.checked; update(); }; }
        else { e.value = state[key]; e[kind === 'sel' ? 'onchange' : 'oninput'] = () => { state[key] = e.value; update(); }; }
    }
    function bindRow(i, key, kind, dflt) {
        const e = container.querySelector(`#cf-r${i}-${key}`);
        if (!e) return;
        if (kind === 'chk') { e.checked = !!state.rows[i][key]; e.onchange = () => { state.rows[i][key] = e.checked; update(); }; }
        else if (kind === 'num') {
            e.value = state.rows[i][key] ?? '';
            e.oninput = () => {
                const v = parseFloat(e.value);
                state.rows[i][key] = e.value === '' ? dflt : (Number.isFinite(v) ? v : state.rows[i][key]);
                update();
            };
        } else { e.value = state.rows[i][key]; e[kind === 'sel' ? 'onchange' : 'oninput'] = () => { state.rows[i][key] = e.value; update(); }; }
    }
}

const INPUT = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white';
function section(title, body) {
    return `<div><p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">${title}</p>${body}</div>`;
}
function sel(key, label, opts) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <select id="cf-${key}" class="${INPUT}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`;
}
function text(key, label, val) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="cf-${key}" type="text" value="${val}" class="${INPUT}"></div>`;
}
function rowEditor(i, title) {
    const rsel = (key, label, opts) => `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <select id="cf-r${i}-${key}" class="${INPUT}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`;
    const rnum = (key, label) => `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="cf-r${i}-${key}" type="number" step="any" class="${INPUT}"></div>`;
    const rtxt = (key, label, ph) => `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="cf-r${i}-${key}" type="text" placeholder="${ph}" class="${INPUT}"></div>`;
    const datum = j => `
      <div class="flex gap-1">
        <input id="cf-r${i}d${j}r" type="text" placeholder="${['A', 'B', 'C'][j]}" class="${INPUT} text-center uppercase">
        <select id="cf-r${i}d${j}m" class="${INPUT} w-20"><option value="none">\u2014</option><option value="M">M</option><option value="L">L</option></select>
      </div>`;
    return section(title, `
      <div class="grid grid-cols-2 gap-2">
        ${rsel('zone', 'Zone shape', [['none', 'Width (no symbol)'], ['dia', 'Diameter (cylindrical)'], ['sdia', 'S-dia (spherical)']])}
        ${rnum('value', 'Tolerance value')}
        ${rsel('mod', 'Material condition', [['none', 'None (RFS default)'], ['M', 'M \u2014 MMC'], ['L', 'L \u2014 LMC']])}
        ${rnum('pHeight', 'P height (blank = off)')}
        ${rnum('uVal', 'U value (with U)')}
        ${rtxt('perUnit', 'Per unit (e.g. 25)', 'unit length')}
      </div>
      <div class="flex gap-3 text-sm mt-2">
        <label class="flex items-center gap-1.5"><input type="checkbox" id="cf-r${i}-U"> U</label>
        <label class="flex items-center gap-1.5"><input type="checkbox" id="cf-r${i}-F"> F (free state)</label>
        <label class="flex items-center gap-1.5"><input type="checkbox" id="cf-r${i}-T"> T (tangent)</label>
      </div>
      <label class="block text-xs text-slate-500 mt-2 mb-1">Datums (primary / secondary / tertiary \u2014 blank = unused; compound like A-B allowed)</label>
      <div class="grid grid-cols-3 gap-1">${datum(0)}${datum(1)}${datum(2)}</div>`);
}

function syncControlVisibility() {
    if (!controlsRoot) return;
    const conds = {
        tworows: state.structure !== 'single',
        multi: state.structure === 'multi'
    };
    controlsRoot.querySelectorAll('[data-when]').forEach(e => {
        e.classList.toggle('hidden', !conds[e.dataset.when]);
    });
}
