// js/modules/datums/datum_targets.js
// Datum targets (ASME Y14.5 §7.24): on a rough part (casting, forging, sheet
// metal) the datums are set by a few named spots instead of whole surfaces.
// Shows a cast plate with the usual 3-2-1 pattern two ways: as drawn (target
// symbols, point / line / area marks, basic dimensions) and in the fixture
// (the pads and pins that touch the part at exactly those spots).

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText } from '../../theme.js';
import { INK, LINE, line, dimH, dimV, UI, goTo } from '../drawing/sheet.js';

const state = {
    view: 'drawing',        // 'drawing' | 'fixture'
    kind: 'point',          // what A1-A3 are: 'point' | 'line' | 'area'
    selected: 'A1'
};

// Plate 100 × 72 mm (face view) × 8 mm (edge view). Target positions in mm
// from the plate's left edge (datum C side) and top edge (datum B side).
const PLATE = { w: 100, h: 72, t: 8 };
const TARGETS = [
    { id: 'A1', datum: 'A', x: 15, y: 15, face: true },
    { id: 'A2', datum: 'A', x: 85, y: 15, face: true },
    { id: 'A3', datum: 'A', x: 50, y: 57, face: true },
    { id: 'B1', datum: 'B', x: 20, edge: 'top' },
    { id: 'B2', datum: 'B', x: 80, edge: 'top' },
    { id: 'C1', datum: 'C', y: 36, edge: 'left' }
];
const AREA_D = 8;                                   // target area diameter (mm)

let svgRef = null, controlsRoot = null;

export function draw(svg) {
    svgRef = svg;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

function select(id) {
    state.selected = id;
    render();
    renderControls();
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const K = 5;                                        // px per mm
const FACE = { x: 70, y: 120 };                     // top-left of the face view
const EDGE = { x: 70, y: FACE.y + PLATE.h * K + 70 }; // edge view, below
const X = mm => FACE.x + mm * K;
const Y = mm => FACE.y + mm * K;

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const fixture = state.view === 'fixture';

    svg.appendChild(text(fixture ? 'IN THE FIXTURE' : 'ON THE DRAWING', 40, 40, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    svg.appendChild(text(fixture ? 'Edge view: 1. the part sits on pads A1, A2, A3' : 'Edge view', EDGE.x, EDGE.y - 12,
        fixture ? { size: 12.5, weight: 700, fill: '#b45309' } : { size: 12.5, fill: COLORS.muted }));

    drawPart(svg);
    svg.appendChild(text('face that rests on datum A', FACE.x + 8, FACE.y + PLATE.h * K - 10, { size: 12, italic: true, fill: COLORS.muted }));
    if (fixture) drawFixture(svg); else drawDrawing(svg);
    drawInfo(svg);
    drawSentence(svg);
}

// Rough cast plate: slightly wavy outline to say "not machined"
function wavy(x1, y1, x2, y2, amp = 1.6, n = 14) {
    let d = `M${x1},${y1}`;
    for (let i = 1; i <= n; i++) {
        const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        const nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny);
        const o = (i === n ? 0 : Math.sin(i * 2.1) * amp);
        d += ` L${x + nx / L * o},${y + ny / L * o}`;
    }
    return d;
}

function drawPart(svg) {
    const x0 = FACE.x, y0 = FACE.y, x1 = X(PLATE.w), y1 = Y(PLATE.h);
    const d = wavy(x0, y0, x1, y0) + wavy(x1, y0, x1, y1).replace('M', ' L') + wavy(x1, y1, x0, y1).replace('M', ' L') + wavy(x0, y1, x0, y0).replace('M', ' L') + ' Z';
    svg.appendChild(createSVG('path', { d, fill: '#e7e5e4', stroke: INK, 'stroke-width': 2.2 }));
    // edge view
    const e1 = EDGE.y, e2 = EDGE.y + PLATE.t * K;
    const de = wavy(x0, e1, x1, e1, 1.2) + wavy(x1, e1, x1, e2, 0.5, 3).replace('M', ' L') + wavy(x1, e2, x0, e2, 1.2).replace('M', ' L') + ' Z';
    svg.appendChild(createSVG('path', { d: de, fill: '#e7e5e4', stroke: INK, 'stroke-width': 2.2 }));
    svg.appendChild(text('rough casting', x1 - 6, y1 - 10, { size: 12, italic: true, fill: COLORS.muted, anchor: 'end' }));
}

// Where a target sits in the face view (px)
function facePos(t) {
    if (t.face) return [X(t.x), Y(t.y)];
    if (t.edge === 'top') return [X(t.x), Y(0)];
    return [X(0), Y(t.y)];
}

/** Datum target symbol: circle split in two; size on top (areas), label below. */
function targetSymbol(cx, cy, label, size, on) {
    const g = createSVG('g', { style: 'cursor: pointer' });
    const r = 21;
    g.appendChild(createSVG('circle', { cx, cy, r, fill: on ? '#dbeafe' : '#fff', stroke: on ? '#2563eb' : INK, 'stroke-width': on ? 2.5 : 1.6 }));
    g.appendChild(line(cx - r, cy, cx + r, cy, { stroke: on ? '#2563eb' : INK, 'stroke-width': 1.4 }));
    if (size) g.appendChild(text(size, cx, cy - 6, { size: 11, weight: 700, fill: INK, anchor: 'middle', mono: true }));
    g.appendChild(text(label, cx, cy + 14, { size: 13, weight: 800, fill: INK, anchor: 'middle' }));
    return g;
}

function mark(svg, t, x, y, on) {
    const color = on ? '#2563eb' : INK;
    const kind = t.face ? state.kind : 'point';
    if (kind === 'area') {
        svg.appendChild(createSVG('circle', { cx: x, cy: y, r: AREA_D / 2 * K, fill: 'url(#dt-hatch)', stroke: color, 'stroke-width': 1.2, 'stroke-dasharray': LINE.phantom['stroke-dasharray'] }));
    } else if (kind === 'line') {
        svg.appendChild(line(x - 26, y, x + 26, y, { stroke: color, 'stroke-width': 2.2, 'stroke-dasharray': '12 3 3 3 3 3' }));
    } else {
        svg.appendChild(line(x - 6, y - 6, x + 6, y + 6, { stroke: color, 'stroke-width': 2.2 }));
        svg.appendChild(line(x - 6, y + 6, x + 6, y - 6, { stroke: color, 'stroke-width': 2.2 }));
    }
}

function drawDrawing(svg) {
    // hatch for target areas
    const defs = svg.querySelector('defs');
    const pat = createSVG('pattern', { id: 'dt-hatch', patternUnits: 'userSpaceOnUse', width: 5, height: 5, patternTransform: 'rotate(45)' });
    pat.appendChild(createSVG('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: INK, 'stroke-width': 0.9 }));
    defs.appendChild(pat);

    for (const t of TARGETS) {
        const on = t.id === state.selected;
        const [x, y] = facePos(t);
        mark(svg, t, x, y, on);
        // symbol placement: face targets beside the mark, edge targets outside the part
        let sx, sy;
        if (t.face) { sx = x + (t.x > 60 ? -48 : 48); sy = y + (t.y > 40 ? 30 : -32); }
        else if (t.edge === 'top') { sx = x + 30; sy = y - 38; }
        else { sx = x - 44; sy = y - 34; }
        svg.appendChild(line(x, y, sx + (sx > x ? -21 : 21) * 0.7, sy + (sy > y ? -21 : 21) * 0.7, { stroke: on ? '#2563eb' : INK, 'stroke-width': 1.1 }));
        const size = t.face && state.kind === 'area' ? `Ø${AREA_D}` : '';
        const sym = targetSymbol(sx, sy, t.id, size, on);
        sym.addEventListener('click', () => select(t.id));
        svg.appendChild(sym);

        // edge view: A targets show as marks on the bottom edge
        if (t.face) {
            const ex = X(t.x), ey = EDGE.y + PLATE.t * K;
            if (state.kind === 'area') svg.appendChild(line(ex - AREA_D / 2 * K, ey + 3, ex + AREA_D / 2 * K, ey + 3, { stroke: on ? '#2563eb' : INK, 'stroke-width': 2.2 }));
            else { svg.appendChild(line(ex - 5, ey - 5, ex + 5, ey + 5, { stroke: on ? '#2563eb' : INK, 'stroke-width': 2 })); svg.appendChild(line(ex - 5, ey + 5, ex + 5, ey - 5, { stroke: on ? '#2563eb' : INK, 'stroke-width': 2 })); }
        }
    }

    // Basic dimensions locating the selected target (from datums C and B)
    const t = TARGETS.find(x => x.id === state.selected);
    const [x, y] = facePos(t);
    if (t.x != null) svg.appendChild(dimH(X(0), x, FACE.y + PLATE.h * K + 26, String(t.x), { fromY: t.face ? y : FACE.y, basic: true }));
    if (t.y != null) svg.appendChild(dimV(Y(0), y, FACE.x + PLATE.w * K + 26, String(t.y), { fromX: t.face ? x : FACE.x, basic: true }));
}

function drawFixture(svg) {
    const pad = (x, y, label, on) => {
        const r = state.kind === 'area' ? AREA_D / 2 * K : 7;
        svg.appendChild(createSVG('circle', { cx: x, cy: y, r, fill: on ? '#2563eb' : '#475569', opacity: 0.9 }));
        svg.appendChild(text(label, x, y - r - 6, { size: 12.5, weight: 800, fill: on ? '#1d4ed8' : INK, anchor: 'middle' }));
    };
    for (const t of TARGETS) {
        const on = t.id === state.selected;
        const [x, y] = facePos(t);
        if (t.face) {
            pad(x, y, t.id, on);
            // pads under the part in the edge view
            const ex = X(t.x), ey = EDGE.y + PLATE.t * K;
            const w = state.kind === 'area' ? AREA_D * K : state.kind === 'line' ? 28 : 12;
            svg.appendChild(createSVG('path', { d: state.kind === 'point'
                ? `M${ex - 10},${ey + 26} L${ex - 10},${ey + 8} Q${ex},${ey - 4} ${ex + 10},${ey + 8} L${ex + 10},${ey + 26} Z`
                : `M${ex - w / 2},${ey + 26} L${ex - w / 2},${ey + 1} L${ex + w / 2},${ey + 1} L${ex + w / 2},${ey + 26} Z`,
                fill: on ? '#2563eb' : '#475569' }));
        } else {
            // locating pins just outside the edge
            const px = t.edge === 'left' ? x - 9 : x, py = t.edge === 'top' ? y - 9 : y;
            svg.appendChild(createSVG('circle', { cx: px, cy: py, r: 9, fill: on ? '#2563eb' : '#475569' }));
            svg.appendChild(text(t.id, t.edge === 'left' ? px - 16 : px, t.edge === 'top' ? py - 16 : py + 5, { size: 12.5, weight: 800, fill: on ? '#1d4ed8' : INK, anchor: t.edge === 'left' ? 'end' : 'middle' }));
        }
    }
    svg.appendChild(createSVG('line', { x1: FACE.x + 70, y1: EDGE.y + PLATE.t * K + 34, x2: FACE.x + PLATE.w * K - 70, y2: EDGE.y + PLATE.t * K + 34, stroke: COLORS.muted, 'stroke-width': 1 }));
    svg.appendChild(text('fixture base', FACE.x + PLATE.w * K / 2, EDGE.y + PLATE.t * K + 50, { size: 12, fill: COLORS.muted, anchor: 'middle' }));
    // push order: onto A, then against B, then against C
    const arrow = (x1, y1, x2, y2, label, lx, ly, anchor = 'middle') => {
        svg.appendChild(createSVG('line', { x1, y1, x2, y2, stroke: '#b45309', 'stroke-width': 2.5, 'marker-end': 'url(#thm-arrow-ink)' }));
        svg.appendChild(text(label, lx, ly, { size: 12.5, weight: 700, fill: '#b45309', anchor }));
    };
    arrow(X(50), Y(PLATE.h) + 44, X(50), Y(PLATE.h) + 8, '2. push up against B1, B2', X(50) + 14, Y(PLATE.h) + 32, 'start');
    arrow(X(PLATE.w) + 44, Y(36), X(PLATE.w) + 10, Y(36), '3. push left against C1', X(PLATE.w) - 20, Y(36) - 40);
}

const INFO = {
    A: { role: 'Primary datum A', count: 3, fixture: 'One of three rest pads the part sits on', stops: 'stops tipping and moving up / down' },
    B: { role: 'Secondary datum B', count: 2, fixture: 'One of two pins the edge is pushed against', stops: 'stops turning on the pads and moving front / back' },
    C: { role: 'Tertiary datum C', count: 1, fixture: 'The single stop pin for the end', stops: 'stops the last slide, side to side' }
};

function drawInfo(svg) {
    const t = TARGETS.find(x => x.id === state.selected);
    const i = INFO[t.datum];
    const x = 640, w = 330, y = 60;
    svg.appendChild(createSVG('rect', { x, y, width: w, height: 420, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    svg.appendChild(targetSymbol(x + 40, y + 42, t.id, t.face && state.kind === 'area' ? `Ø${AREA_D}` : '', true));
    svg.appendChild(text(`Target ${t.id}`, x + 76, y + 36, { size: 18, weight: 800, fill: COLORS.ink }));
    svg.appendChild(text(`${i.role}: ${i.count} target${i.count > 1 ? 's' : ''}`, x + 76, y + 56, { size: 13, fill: COLORS.muted }));

    const kind = t.face ? state.kind : 'point';
    const what = {
        point: 'A target point, drawn as an X. The part touches the fixture at one spot, usually a pin with a rounded tip.',
        line: 'A target line, drawn as a phantom line (an X in the edge view). The part touches along a line, e.g. the side of a pin or a knife edge.',
        area: `A target area, drawn hatched inside a phantom outline, with its size (Ø${AREA_D}) in the top half of the symbol. The part sits on a flat pad of that size.`
    }[kind];
    const where = t.face ? `${t.x} from the C side and ${t.y} from the B side` : t.edge === 'top' ? `${t.x} from the C side` : `${t.y} from the B side`;
    const rows = [
        ['What it is', what],
        ['Where', `Basic dimensions: ${where}. Boxed, so the spot is exact; the fixture holds its own tight tolerance.`],
        ['In the fixture', `${i.fixture}. It ${i.stops}.`]
    ];
    let yy = y + 96;
    for (const [h, b] of rows) {
        svg.appendChild(text(h.toUpperCase(), x + 18, yy, { size: 11.5, weight: 800, fill: '#1d4ed8', letterSpacing: '0.05em' }));
        const wt = wrapText(b, x + 18, yy + 20, 44, 18, { size: 13.5, fill: COLORS.text });
        svg.appendChild(wt);
        yy += 20 + wt.childNodes.length * 18 + 16;
    }
}

function drawSentence(svg) {
    svg.appendChild(createSVG('rect', { x: 20, y: 650, width: 960, height: 130, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    svg.appendChild(text('IN PLAIN ENGLISH', 44, 680, { size: 12, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const s = state.view === 'fixture'
        ? 'The part sits on three pads (A1, A2, A3), is pushed against two pins (B1, B2), then against one pin (C1). It touches only those six spots, so every casting sits the same way in machining and in inspection, however rough its surfaces are.'
        : 'A rough surface is never flat, so resting it on a whole surface would rock and give a different result each time. Datum targets name the exact spots to touch instead: three for the primary datum, two for the secondary and one for the tertiary (3-2-1).';
    svg.appendChild(wrapText(s, 44, 706, 118, 21, { size: 15, fill: COLORS.text }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

function renderControls() {
    if (!controlsRoot) return;
    const seg = (key, v, label) => `<button data-${key}="${v}" class="${UI.segBtn} ${state[key] === v ? UI.segOn : UI.segOff}">${label}</button>`;
    controlsRoot.innerHTML = `
        <div class="${UI.card} space-y-3">
            <div>
                <h4 class="${UI.h4}">Show</h4>
                <div class="flex gap-2">${seg('view', 'drawing', 'On the drawing')}${seg('view', 'fixture', 'In the fixture')}</div>
            </div>
            <div>
                <h4 class="${UI.h4}">Datum A targets are</h4>
                <div class="flex gap-2">${seg('kind', 'point', 'Points')}${seg('kind', 'line', 'Lines')}${seg('kind', 'area', 'Areas')}</div>
            </div>
            <div>
                <h4 class="${UI.h4}">Target</h4>
                <div class="grid grid-cols-3 gap-1.5">${TARGETS.map(t => `<button data-sel="${t.id}" class="${UI.segBtn} ${state.selected === t.id ? UI.segOn : UI.segOff}">${t.id}</button>`).join('')}</div>
                <p class="text-xs text-slate-500 mt-1">Or click a target symbol on the drawing.</p>
            </div>
        </div>
        <div class="${UI.card}">
            <h4 class="${UI.h4}">How to read datum targets</h4>
            <ol class="text-sm text-slate-700 list-decimal pl-4 space-y-1.5">
                <li>Find the circles split in two. The bottom half is the datum letter and target number (A1, A2…).</li>
                <li>The top half gives the size of a target area; it is empty for a point or a line.</li>
                <li>X is a point, a phantom line is a line, a hatched patch is an area.</li>
                <li>Boxed (basic) dimensions place each target exactly.</li>
                <li>A frame referencing "A" means: set the part on all the A targets together.</li>
            </ol>
        </div>
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Watch out</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>Measure and machine from the same targets. Using a different face moves every result.</li>
                <li>Keep targets away from parting lines, gates and draft, where the casting is least predictable.</li>
                <li>A target symbol with a small triangle is a movable target: its pin slides in to meet the part (for example a V-block that centres a round casting).</li>
            </ul>
        </div>
        <button id="dt-drf" class="${UI.smallBtn} w-full py-2">Datum reference frame (3D) ▶</button>`;
    controlsRoot.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; render(); renderControls(); });
    controlsRoot.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { state.kind = b.dataset.kind; render(); renderControls(); });
    controlsRoot.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => select(b.dataset.sel));
    controlsRoot.querySelector('#dt-drf').onclick = () => goTo('DATUMS', 'drf');
}
