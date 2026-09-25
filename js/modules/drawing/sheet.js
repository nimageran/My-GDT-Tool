// js/modules/drawing/sheet.js
// Shared pieces for the "Drawing basics" tools: line styles, the projection
// symbol, and a title block whose fields can be clicked and highlighted.

import { createSVG } from '../../drawing_utils.js';
import { text } from '../../theme.js';

export const INK = '#0f172a';

// Line types as drawn on engineering drawings
export const LINE = {
    visible: { stroke: INK, 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round' },
    thin: { stroke: INK, 'stroke-width': 1, fill: 'none' },
    hidden: { stroke: INK, 'stroke-width': 1.1, fill: 'none', 'stroke-dasharray': '6 3' },
    center: { stroke: INK, 'stroke-width': 0.9, fill: 'none', 'stroke-dasharray': '16 3 3 3' },
    phantom: { stroke: INK, 'stroke-width': 0.9, fill: 'none', 'stroke-dasharray': '16 3 3 3 3 3' }
};

export const line = (x1, y1, x2, y2, style) => createSVG('line', { x1, y1, x2, y2, ...style });

/**
 * Projection symbol (truncated cone). (x, y) = top-left, s = size unit.
 * angle: 'third' → end view (circles) on the left, cone on the right;
 *        'first' → cone on the left, end view on the right.
 */
export function projectionSymbol(x, y, s, angle) {
    const g = createSVG('g', {});
    const D = 1.4 * s, d = 0.7 * s, L = 1.5 * s;       // big / small diameter, length
    const cy = y + D / 2;
    const conePart = (cx0) => {
        // small end on the left, big end on the right
        g.appendChild(createSVG('path', {
            d: `M ${cx0},${cy - d / 2} L ${cx0 + L},${cy - D / 2} L ${cx0 + L},${cy + D / 2} L ${cx0},${cy + d / 2} Z`,
            fill: 'none', stroke: INK, 'stroke-width': 1.6
        }));
        g.appendChild(line(cx0 - 0.2 * s, cy, cx0 + L + 0.2 * s, cy, LINE.center));
    };
    const circlesPart = (ccx) => {
        g.appendChild(createSVG('circle', { cx: ccx, cy, r: D / 2, fill: 'none', stroke: INK, 'stroke-width': 1.6 }));
        g.appendChild(createSVG('circle', { cx: ccx, cy, r: d / 2, fill: 'none', stroke: INK, 'stroke-width': 1.6 }));
        g.appendChild(line(ccx - D / 2 - 0.2 * s, cy, ccx + D / 2 + 0.2 * s, cy, LINE.center));
        g.appendChild(line(ccx, cy - D / 2 - 0.2 * s, ccx, cy + D / 2 + 0.2 * s, LINE.center));
    };
    const gap = 0.6 * s;
    if (angle === 'third') {
        circlesPart(x + D / 2);
        conePart(x + D + gap);
    } else {
        conePart(x);
        circlesPart(x + L + gap + D / 2);
    }
    return g;
}

// --------------------------------------------------------------------------
// Title block
// --------------------------------------------------------------------------

// Field layout in units of a 420 × 180 block
export const TITLE_FIELDS = [
    { id: 'tolerances', label: 'UNLESS OTHERWISE SPECIFIED', x: 0, y: 0, w: 180, h: 70,
      lines: ['DIMENSIONS IN MM', 'X ±0.5   X.X ±0.2', 'X.XX ±0.1   ANGLES ±0.5°'] },
    { id: 'standard', label: 'STANDARD', x: 0, y: 70, w: 180, h: 40, lines: ['ASME Y14.5-2018'] },
    { id: 'projection', label: 'PROJECTION', x: 0, y: 110, w: 180, h: 70, lines: [] },
    { id: 'company', label: 'COMPANY', x: 180, y: 0, w: 240, h: 40, lines: ['YOUR COMPANY INC.'] },
    { id: 'title', label: 'TITLE', x: 180, y: 40, w: 240, h: 40, lines: ['BRACKET, MOUNTING'] },
    { id: 'number', label: 'PART / DRAWING NO.', x: 180, y: 80, w: 160, h: 40, lines: ['10-4217'] },
    { id: 'revision', label: 'REV', x: 340, y: 80, w: 80, h: 40, lines: ['C'] },
    { id: 'material', label: 'MATERIAL', x: 180, y: 120, w: 120, h: 30, lines: ['AL 6061-T6'] },
    { id: 'finish', label: 'FINISH', x: 300, y: 120, w: 120, h: 30, lines: ['CLEAR ANODIZE'] },
    { id: 'scale', label: 'SCALE', x: 180, y: 150, w: 60, h: 30, lines: ['1:1'] },
    { id: 'sheet', label: 'SHEET', x: 240, y: 150, w: 60, h: 30, lines: ['1 OF 1'] },
    { id: 'drawn', label: 'DRAWN', x: 300, y: 150, w: 60, h: 30, lines: ['J. SMITH'] },
    { id: 'checked', label: 'CHECKED', x: 360, y: 150, w: 60, h: 30, lines: ['A. KIM'] }
];

/**
 * Draw the title block with its top-left at (x, y), scaled by k.
 * opts.highlight: field id to highlight; opts.onClick(id): makes fields clickable.
 * opts.labelSize / valueSize / bigSize: text sizes (default: scaled with k).
 * opts.fixed: sizes are already chosen to be readable; skip the automatic
 * enlargement (js/legibility.js), which would overflow the small cells.
 * Returns { g, rect(id) } where rect gives a field's box in canvas units.
 */
export function titleBlock(x, y, k = 1, opts = {}) {
    const g = createSVG('g', opts.fixed ? { 'data-fixed-size': '' } : {});
    const LS = opts.labelSize ?? 6.5 * k, VS = opts.valueSize ?? 8.5 * k, BS = opts.bigSize ?? 13 * k;
    const rect = id => {
        const f = TITLE_FIELDS.find(t => t.id === id);
        return { x: x + f.x * k, y: y + f.y * k, w: f.w * k, h: f.h * k };
    };
    for (const f of TITLE_FIELDS) {
        const r = rect(f.id);
        const on = opts.highlight === f.id;
        const cell = createSVG('g', opts.onClick ? { style: 'cursor: pointer' } : {});
        cell.appendChild(createSVG('rect', {
            x: r.x, y: r.y, width: r.w, height: r.h,
            fill: on ? '#dbeafe' : '#ffffff', stroke: INK, 'stroke-width': on ? 2.5 : 1.2
        }));
        cell.appendChild(text(f.label, r.x + 4 * k, r.y + LS + 1.5, { size: LS, fill: '#64748b', weight: 600 }));
        if (f.id === 'projection') {
            cell.appendChild(projectionSymbol(r.x + 34 * k, r.y + LS + 6, 22 * k, 'third'));
            cell.appendChild(text('THIRD ANGLE', r.x + 90 * k, r.y + r.h - 5, { size: LS, fill: INK, weight: 700, anchor: 'middle' }));
        }
        f.lines.forEach((ln, i) => {
            const big = ['title', 'number', 'revision', 'company'].includes(f.id);
            const ty = big ? r.y + r.h - (r.h - LS - BS) / 2 - 2 : r.y + LS + 5 + VS + i * VS * 1.3;
            const t = text(ln, r.x + (f.id === 'revision' ? r.w / 2 : 5 * k), ty,
                { size: big ? BS : VS, fill: INK, weight: 700, anchor: f.id === 'revision' ? 'middle' : 'start', mono: f.id !== 'company' && f.id !== 'title' });
            t.style.whiteSpace = 'pre';               // keep the gaps in "X ±0.5   X.X ±0.2"
            cell.appendChild(t);
        });
        if (opts.onClick) cell.addEventListener('click', () => opts.onClick(f.id));
        g.appendChild(cell);
    }
    g.appendChild(createSVG('rect', { x, y, width: 420 * k, height: 180 * k, fill: 'none', stroke: INK, 'stroke-width': 2.4 }));
    return { g, rect };
}

// --------------------------------------------------------------------------
// Dimensions and datum tags in drawing style (thin ink lines)
// Call theme addDefs(svg) first: these use the 'thm-arrow-ink' marker.
// --------------------------------------------------------------------------

const ARROW = 'url(#thm-arrow-ink)';

/** Dimension label, boxed when basic. Centred on (x, y). */
export function dimLabel(str, x, y, { basic = false, size = 13, rotate = false } = {}) {
    const g = createSVG('g', rotate ? { transform: `rotate(-90 ${x} ${y})` } : {});
    if (basic) {
        const w = str.length * size * 0.62 + 10;
        g.appendChild(createSVG('rect', { x: x - w / 2, y: y - size * 0.8, width: w, height: size * 1.6, fill: '#fff', stroke: INK, 'stroke-width': 1.2 }));
    } else {
        const w = str.length * size * 0.62 + 6;
        g.appendChild(createSVG('rect', { x: x - w / 2, y: y - size * 0.7, width: w, height: size * 1.4, fill: '#fff' }));
    }
    g.appendChild(text(str, x, y, { size, weight: 600, fill: INK, anchor: 'middle', baseline: 'central', mono: true }));
    return g;
}

/** Horizontal dimension from x1 to x2 at height y; extension lines start at fromY. */
export function dimH(x1, x2, y, label, { fromY = null, basic = false } = {}) {
    const g = createSVG('g', {});
    if (fromY != null) {
        const dir = y > fromY ? 1 : -1;
        g.appendChild(line(x1, fromY + 4 * dir, x1, y + 6 * dir, LINE.thin));
        g.appendChild(line(x2, fromY + 4 * dir, x2, y + 6 * dir, LINE.thin));
    }
    g.appendChild(createSVG('line', { x1, y1: y, x2, y2: y, ...LINE.thin, 'marker-start': ARROW, 'marker-end': ARROW }));
    g.appendChild(dimLabel(label, (x1 + x2) / 2, y, { basic }));
    return g;
}

/** Vertical dimension from y1 to y2 at x; extension lines start at fromX. */
export function dimV(y1, y2, x, label, { fromX = null, basic = false } = {}) {
    const g = createSVG('g', {});
    if (fromX != null) {
        const dir = x > fromX ? 1 : -1;
        g.appendChild(line(fromX + 4 * dir, y1, x + 6 * dir, y1, LINE.thin));
        g.appendChild(line(fromX + 4 * dir, y2, x + 6 * dir, y2, LINE.thin));
    }
    g.appendChild(createSVG('line', { x1: x, y1, x2: x, y2, ...LINE.thin, 'marker-start': ARROW, 'marker-end': ARROW }));
    g.appendChild(dimLabel(label, x, (y1 + y2) / 2, { basic }));
    return g;
}

/**
 * Datum feature symbol standing on an edge at (x, y), pointing away from the
 * part in direction dir: 'up' | 'down' | 'left' | 'right'.
 */
export function datumTag(x, y, letter, dir = 'up', { size = 24, rise = 26 } = {}) {
    const g = createSVG('g', {});
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    const p = [-v[1], v[0]];                           // perpendicular
    const t = 8;
    g.appendChild(createSVG('path', {
        d: `M${x + p[0] * t},${y + p[1] * t} L${x - p[0] * t},${y - p[1] * t} L${x + v[0] * t * 1.3},${y + v[1] * t * 1.3} Z`, fill: INK
    }));
    const bx = x + v[0] * (rise + size / 2), by = y + v[1] * (rise + size / 2);
    g.appendChild(line(x + v[0] * t * 1.3, y + v[1] * t * 1.3, x + v[0] * rise, y + v[1] * rise, { stroke: INK, 'stroke-width': 1.3 }));
    g.appendChild(createSVG('rect', { x: bx - size / 2, y: by - size / 2, width: size, height: size, fill: '#fff', stroke: INK, 'stroke-width': 1.8 }));
    g.appendChild(text(letter, bx, by, { size: size * 0.62, weight: 700, fill: INK, anchor: 'middle', baseline: 'central' }));
    return g;
}

/** Fire a navigation request to another tool. */
export const goTo = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));

// Shared sidebar class strings
export const UI = {
    card: 'bg-white p-4 rounded shadow-sm border border-slate-200',
    h4: 'font-bold text-xs text-slate-500 uppercase mb-2',
    segBtn: 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors',
    segOn: 'bg-blue-600 text-white border-blue-600',
    segOff: 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
    input: 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500',
    smallBtn: 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold',
    link: 'text-xs font-bold text-blue-700 hover:underline',
    warn: 'p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900'
};

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
