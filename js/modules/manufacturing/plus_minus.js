// js/modules/manufacturing/plus_minus.js
// ± to position: a hole located with ±X / ±Y has a square (or rectangular)
// zone; the round position zone through its corners allows the same worst
// case but 57% more area, so parts that fail ± can be perfectly good.
// Drag the hole centre to compare the two checks.

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText, featureControlFrame } from '../../theme.js';
import { UI } from '../drawing/sheet.js';

const state = { tx: 0.1, ty: 0.1, dx: 0.12, dy: 0.02, units: 'mm' };
let svgRef = null, controlsRoot = null, dragging = false;

export function draw(svg) {
    svgRef = svg;
    svg.addEventListener('pointerdown', e => { if (e.target.closest('[data-drag]')) { dragging = true; svg.setPointerCapture(e.pointerId); } });
    svg.addEventListener('pointermove', e => { if (dragging) moveTo(e); });
    svg.addEventListener('pointerup', () => { dragging = false; });
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

/** Round zone through the corners of the ± rectangle: same worst case. */
export const equivalentPosition = (tx, ty) => 2 * Math.hypot(tx, ty);
/** Largest ± square that fits inside a position zone of diameter d. */
export const squareInside = d => d / (2 * Math.SQRT2);

export function evaluate(s) {
    const pos = equivalentPosition(s.tx, s.ty);
    const actual = 2 * Math.hypot(s.dx, s.dy);
    const plusMinusOK = Math.abs(s.dx) <= s.tx + 1e-12 && Math.abs(s.dy) <= s.ty + 1e-12;
    const positionOK = actual <= pos + 1e-12;
    const gain = (Math.PI * (s.tx ** 2 + s.ty ** 2)) / (4 * s.tx * s.ty) - 1;   // extra area of the round zone
    return { pos, actual, plusMinusOK, positionOK, gain };
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const C = { x: 290, y: 330 };
let K = 1;                                        // px per unit, set in render
const u = () => (state.units === 'in' ? '"' : '');
const f = v => (state.units === 'in' ? v.toFixed(4) : v.toFixed(3)) + u();

function moveTo(e) {
    const p = svgRef.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svgRef.getScreenCTM().inverse());
    const lim = equivalentPosition(state.tx, state.ty) * 0.9;
    state.dx = Math.max(-lim, Math.min(lim, (q.x - C.x) / K));
    state.dy = Math.max(-lim, Math.min(lim, (C.y - q.y) / K));
    render();
    syncInputs();
}

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const r = evaluate(state);
    const R = r.pos / 2;
    K = 210 / Math.max(R, 1e-9);

    // hatch for the extra area of the round zone
    const defs = svg.querySelector('defs');
    const pat = createSVG('pattern', { id: 'pm-hatch', patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' });
    pat.appendChild(createSVG('rect', { width: 8, height: 8, fill: 'rgba(22,163,74,0.10)' }));
    pat.appendChild(createSVG('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: COLORS.pass, 'stroke-width': 1.3, opacity: 0.5 }));
    defs.appendChild(pat);

    svg.appendChild(text('TOP VIEW OF THE HOLE CENTRE (MAGNIFIED)', 30, 40, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));

    // round zone (hatched), then the ± rectangle on top
    svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: R * K, fill: 'url(#pm-hatch)', stroke: COLORS.pass, 'stroke-width': 2, 'stroke-dasharray': '10 6' }));
    svg.appendChild(createSVG('rect', { x: C.x - state.tx * K, y: C.y - state.ty * K, width: 2 * state.tx * K, height: 2 * state.ty * K, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 2 }));
    svg.appendChild(createSVG('line', { x1: C.x - R * K - 20, y1: C.y, x2: C.x + R * K + 20, y2: C.y, stroke: COLORS.nominal, 'stroke-width': 1, 'stroke-dasharray': '14 4 3 4' }));
    svg.appendChild(createSVG('line', { x1: C.x, y1: C.y - R * K - 20, x2: C.x, y2: C.y + R * K + 20, stroke: COLORS.nominal, 'stroke-width': 1, 'stroke-dasharray': '14 4 3 4' }));
    // corner to show the circle passes through it
    svg.appendChild(createSVG('line', { x1: C.x, y1: C.y, x2: C.x + state.tx * K, y2: C.y - state.ty * K, stroke: COLORS.muted, 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
    svg.appendChild(text(`±${f(state.tx)} × ±${f(state.ty)}`, C.x, C.y + state.ty * K - 8, { size: 12.5, weight: 700, fill: COLORS.zoneText, anchor: 'middle' }));
    svg.appendChild(text(`Ø${f(r.pos)} position zone`, C.x, C.y - R * K - 28, { size: 13, weight: 700, fill: COLORS.pass, anchor: 'middle' }));

    // measured centre (draggable)
    const px = C.x + state.dx * K, py = C.y - state.dy * K;
    const good = r.positionOK;
    svg.appendChild(createSVG('line', { x1: C.x, y1: C.y, x2: px, y2: py, stroke: COLORS.actual, 'stroke-width': 1.5 }));
    const dot = createSVG('circle', { cx: px, cy: py, r: 11, fill: good ? COLORS.actual : COLORS.fail, stroke: '#fff', 'stroke-width': 3, style: 'cursor: grab', 'data-drag': '' });
    svg.appendChild(dot);
    svg.appendChild(text('drag me', px + 16, py - 12, { size: 12, italic: true, fill: COLORS.muted }));

    drawPanel(svg, r);
    drawVerdict(svg, r);
}

function drawPanel(svg, r) {
    const x = 600;
    svg.appendChild(text('THE SAME HOLE, TWO WAYS', x, 40, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    svg.appendChild(text('With ± coordinates:', x, 78, { size: 14, weight: 700, fill: COLORS.ink }));
    svg.appendChild(text(`X ±${f(state.tx)}   Y ±${f(state.ty)}  → a ${state.tx === state.ty ? 'square' : 'rectangle'}`, x, 100, { size: 13.5, fill: COLORS.text, mono: true }));
    svg.appendChild(text('With position (same worst case):', x, 140, { size: 14, weight: 700, fill: COLORS.ink }));
    svg.appendChild(featureControlFrame(x, 152, { symbol: 'position', tolerance: r.pos.toFixed(state.units === 'in' ? 4 : 3), diameter: true, datums: ['A', 'B', 'C'], h: 30 }).g);
    svg.appendChild(text(`Ø = 2 × √(${f(state.tx)}² + ${f(state.ty)}²) = ${f(r.pos)}`, x, 206, { size: 13, fill: COLORS.muted, mono: true }));

    svg.appendChild(text(`+${Math.round(r.gain * 100)}% more usable area`, x, 250, { size: 22, weight: 800, fill: COLORS.pass }));
    svg.appendChild(wrapText('The round zone reaches the same corners, so nothing worse is allowed, but it also accepts the good parts just outside the flat sides of the square (hatched).', x, 274, 52, 18, { size: 13.5, fill: COLORS.text }));

    svg.appendChild(text('Going back the other way', x, 372, { size: 14, weight: 700, fill: COLORS.ink }));
    svg.appendChild(wrapText(`A Ø${f(r.pos)} position turned into ± would only be ±${f(squareInside(r.pos))} each way: the square inside the circle. That throws away half the zone, so avoid it.`, x, 394, 52, 18, { size: 13.5, fill: COLORS.text }));

    svg.appendChild(text('Measured centre', x, 470, { size: 14, weight: 700, fill: COLORS.ink }));
    svg.appendChild(text(`X ${state.dx >= 0 ? '+' : ''}${f(state.dx)}   Y ${state.dy >= 0 ? '+' : ''}${f(state.dy)}`, x, 492, { size: 13.5, fill: COLORS.text, mono: true }));
    svg.appendChild(text(`Position = 2 × √(X² + Y²) = Ø${f(r.actual)}`, x, 514, { size: 13.5, fill: COLORS.text, mono: true }));
}

function drawVerdict(svg, r) {
    svg.appendChild(createSVG('rect', { x: 20, y: 640, width: 960, height: 145, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    const pill = (x, label, ok) => {
        svg.appendChild(createSVG('rect', { x, y: 662, width: 205, height: 42, rx: 21, fill: ok ? COLORS.passTint : COLORS.failTint, stroke: ok ? COLORS.pass : COLORS.fail, 'stroke-width': 2 }));
        svg.appendChild(text(`${label}: ${ok ? 'PASS' : 'FAIL'}`, x + 102, 689, { size: 15, weight: 800, fill: ok ? COLORS.pass : COLORS.fail, anchor: 'middle' }));
    };
    pill(44, '± check', r.plusMinusOK);
    pill(264, 'Position check', r.positionOK);
    let s;
    if (r.plusMinusOK && r.positionOK) s = 'Inside both zones: good either way.';
    else if (!r.plusMinusOK && r.positionOK) s = `Rejected by ± but inside the round zone: a good part thrown away. It sits in the extra area position gives you, and still assembles just as well.`;
    else s = `Outside both zones: bad either way (position Ø${f(r.actual)} is more than Ø${f(r.pos)}).`;
    svg.appendChild(wrapText(s, 490, 680, 64, 20, { size: 14.5, fill: COLORS.text }));
    svg.appendChild(text('Tip: with Ⓜ in the position frame, the zone grows further as the hole departs from MMC (bonus); ± can never do that.', 44, 750, { size: 13, italic: true, fill: COLORS.muted }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

function renderControls() {
    if (!controlsRoot) return;
    const seg = (v, label) => `<button data-units="${v}" class="${UI.segBtn} ${state.units === v ? UI.segOn : UI.segOff}">${label}</button>`;
    const step = state.units === 'in' ? 0.001 : 0.01;
    controlsRoot.innerHTML = `
        <div class="${UI.card} space-y-3">
            <div class="flex gap-2">${seg('mm', 'mm')}${seg('in', 'inch')}</div>
            <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">± IN X</label><input id="pm-tx" type="number" step="${step}" min="0" value="${state.tx}" class="${UI.input}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">± IN Y</label><input id="pm-ty" type="number" step="${step}" min="0" value="${state.ty}" class="${UI.input}"></div>
            </div>
        </div>
        <div class="${UI.card} space-y-2">
            <h4 class="${UI.h4}">Measured hole centre (or drag it)</h4>
            <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">X OFFSET</label><input id="pm-dx" type="number" step="${step}" value="${+state.dx.toFixed(4)}" class="${UI.input}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Y OFFSET</label><input id="pm-dy" type="number" step="${step}" value="${+state.dy.toFixed(4)}" class="${UI.input}"></div>
            </div>
            <div class="flex flex-col gap-1.5 pt-1">
                <button data-p="corner" class="${UI.smallBtn} text-left">In the corner of the square</button>
                <button data-p="side" class="${UI.smallBtn} text-left">Just past a side: fails ±, passes position</button>
                <button data-p="out" class="${UI.smallBtn} text-left">Outside both</button>
            </div>
        </div>
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Why engineers prefer position</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>57% more zone for the same fit (square ± to round position).</li>
                <li>Bonus with Ⓜ, and a datum reference frame that says how to hold the part.</li>
                <li>± stacks from edge to edge and hole to hole; basic dimensions with position do not.</li>
            </ul>
        </div>`;
    controlsRoot.querySelectorAll('[data-units]').forEach(b => b.onclick = () => {
        if (state.units === b.dataset.units) return;
        const k = b.dataset.units === 'in' ? 1 / 25.4 : 25.4;
        for (const key of ['tx', 'ty', 'dx', 'dy']) state[key] = +(state[key] * k).toFixed(b.dataset.units === 'in' ? 4 : 3);
        state.units = b.dataset.units;
        render(); renderControls();
    });
    const num = (id, key, positive) => controlsRoot.querySelector(id).oninput = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && (!positive || v > 0)) { state[key] = v; render(); } };
    num('#pm-tx', 'tx', true); num('#pm-ty', 'ty', true); num('#pm-dx', 'dx'); num('#pm-dy', 'dy');
    controlsRoot.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
        const { tx, ty } = state;
        if (b.dataset.p === 'corner') Object.assign(state, { dx: tx * 0.95, dy: ty * 0.95 });
        if (b.dataset.p === 'side') Object.assign(state, { dx: tx * 1.3, dy: 0 });
        if (b.dataset.p === 'out') Object.assign(state, { dx: tx * 1.3, dy: ty * 1.2 });
        render(); renderControls();
    });
}

function syncInputs() {
    const dx = controlsRoot?.querySelector('#pm-dx'), dy = controlsRoot?.querySelector('#pm-dy');
    if (dx) dx.value = +state.dx.toFixed(4);
    if (dy) dy.value = +state.dy.toFixed(4);
}
