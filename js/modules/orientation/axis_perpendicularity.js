// js/modules/orientation/axis_perpendicularity.js
// Perpendicularity of an AXIS (a hole or a pin) to datum A, with a material
// condition modifier. The zone is a cylinder square to A; at MMC it grows by
// the bonus as the feature departs from MMC. The cylinder only has to stay
// square to A, so it may slide sideways: what counts is how far the axis
// leans over the feature's length, not where it is.

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, text, wrapText, addDefs, datumGround, datumFeatureSymbol, featureControlFrame, legend, resultsStrip, halo } from '../../theme.js';
import { syncUnits, fromIn, step, suffix, unitName, decimals } from '../../units.js';
import { shareable } from '../../share.js';

const SIZES = {
    in: { hole: { nominal: 0.500, plus: 0.010, minus: 0, actual: 0.506 }, pin: { nominal: 0.490, plus: 0, minus: 0.010, actual: 0.484 } },
    mm: { hole: { nominal: 12.00, plus: 0.25, minus: 0, actual: 12.15 }, pin: { nominal: 11.75, plus: 0, minus: 0.25, actual: 11.60 } }
};
const UNITS = { native: 'in', lengths: ['tol', 'nominal', 'plus', 'minus', 'actual', 'lean', 'length'],
    nice: { mm: { tol: 0.25, ...SIZES.mm.hole, lean: 0.3, length: 25 } } };

const state = {
    feature: 'hole',          // 'hole' | 'pin'
    modifier: 'MMC',          // 'MMC' | 'RFS' | 'LMC'
    tol: 0.010,               // perpendicularity tolerance (diameter)
    ...SIZES.in.hole,
    lean: 0.012,              // how far the axis top is offset from its bottom, sideways
    length: 1.000             // length of the feature (hole depth / pin height)
};

// --- LAYOUT (px) ---
const BASE_Y = 560, TOP_Y = 260;         // datum A and the top of the feature (length always drawn 300 px)
const CX = 300;                           // axis at the bottom
const HALF_W = 55;                        // half the drawn width of the hole / pin (not to scale)
const MAX_SIDE_PX = 120;                  // largest sideways lean or zone drawn
const PANEL_X = 600, PANEL_W = 370;

let svgRef = null, controlsRoot = null, dragging = false, dragK = null;
const f = v => v.toFixed(decimals());

export function draw(svg) {
    syncUnits(state, UNITS);
    svgRef = svg;
    svg.addEventListener('pointerdown', e => { if (e.target.closest('[data-drag]')) { dragging = true; dragK = sideScale(evaluate()); svg.setPointerCapture(e.pointerId); } });
    svg.addEventListener('pointermove', e => { if (dragging) dragTo(e); });
    svg.addEventListener('pointerup', () => { dragging = false; dragK = null; render(); });
    render();
}

export function loadControls(container) {
    syncUnits(state, UNITS);
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

/**
 * Perpendicularity of a hole / pin axis with a material condition modifier.
 * The smallest cylinder square to A that holds a straight leaning axis has a
 * diameter equal to the sideways lean over the length.
 */
export function evaluateAxis(s) {
    const hole = s.feature === 'hole';
    const lower = s.nominal - s.minus, upper = s.nominal + s.plus;
    const mmc = hole ? lower : upper, lmc = hole ? upper : lower;
    const sizeOK = s.actual >= lower - EPS && s.actual <= upper + EPS;
    const sizeTol = upper - lower;
    let bonus = 0;
    if (s.modifier === 'MMC') bonus = Math.max(0, hole ? s.actual - mmc : mmc - s.actual);
    if (s.modifier === 'LMC') bonus = Math.max(0, hole ? lmc - s.actual : s.actual - lmc);
    bonus = Math.min(bonus, sizeTol);
    const allowed = s.tol + bonus;
    const needed = Math.abs(s.lean);
    const orientOK = needed <= allowed + EPS;
    // Virtual condition: the fixed boundary a functional gauge uses (MMC) / the material side (LMC)
    const vc = s.modifier === 'MMC' ? (hole ? mmc - s.tol : mmc + s.tol)
        : s.modifier === 'LMC' ? (hole ? lmc + s.tol : lmc - s.tol) : null;
    const angle = Math.atan2(needed, s.length) * 180 / Math.PI;
    return { hole, lower, upper, mmc, lmc, sizeOK, sizeTol, bonus, maxBonus: s.modifier === 'RFS' ? 0 : sizeTol, allowed, needed, orientOK, vc, angle, pass: sizeOK && orientOK };
}
const evaluate = () => evaluateAxis(state);

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

/** Sideways px per unit: fits the biggest zone (with full bonus) and the lean. */
function sideScale(r) {
    if (dragK) return dragK;
    return MAX_SIDE_PX / Math.max((state.tol + r.maxBonus), r.needed * 1.15, fromIn(0.001));
}

function dragTo(e) {
    const m = svgRef.getScreenCTM();
    const x = (e.clientX - m.e) / m.a;
    const lim = fromIn(0.05);
    state.lean = Math.max(-lim, Math.min(lim, +((x - CX) / dragK).toFixed(decimals() + 1)));
    render();
    const n = controlsRoot?.querySelector('#ap-lean');
    if (n) n.value = state.lean;
}

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const r = evaluate();
    const k = sideScale(r);
    const topX = CX + state.lean * k;
    const axisAt = t => CX + (topX - CX) * t;          // t = 0 at A, 1 at the top

    // Datum A
    svg.appendChild(datumGround(40, 580, BASE_Y));

    // The part (section): plate with a hole, or a pin standing on a plate
    if (r.hole) {
        svg.appendChild(createSVG('path', { d: `M 60,${TOP_Y} L ${topX - HALF_W},${TOP_Y} L ${CX - HALF_W},${BASE_Y} L 60,${BASE_Y} Z`, fill: COLORS.partFill, stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
        svg.appendChild(createSVG('path', { d: `M ${topX + HALF_W},${TOP_Y} L 560,${TOP_Y} L 560,${BASE_Y} L ${CX + HALF_W},${BASE_Y} Z`, fill: COLORS.partFill, stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
        svg.appendChild(text('hole (section view)', 64, TOP_Y - 10, { size: 12.5, italic: true, fill: COLORS.muted }));
    } else {
        svg.appendChild(createSVG('rect', { x: 60, y: BASE_Y, width: 500, height: 40, fill: COLORS.partFill, stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
        svg.appendChild(createSVG('path', { d: `M ${CX - HALF_W},${BASE_Y} L ${topX - HALF_W},${TOP_Y} L ${topX + HALF_W},${TOP_Y} L ${CX + HALF_W},${BASE_Y} Z`, fill: '#cbd5e1', stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
        svg.appendChild(text('pin (section view)', 140, BASE_Y - 10, { size: 12.5, italic: true, fill: COLORS.muted }));
    }

    // Datum A: the face the part sits on (hole: the plate's bottom face, symbol below it; pin: the plate's top face)
    if (r.hole) {
        const x = 110, g = createSVG('g', {});
        g.appendChild(createSVG('path', { d: `M ${x - 11},${BASE_Y} L ${x + 11},${BASE_Y} L ${x},${BASE_Y + 14} Z`, fill: COLORS.ink }));
        g.appendChild(createSVG('line', { x1: x, y1: BASE_Y + 14, x2: x, y2: BASE_Y + 34, stroke: COLORS.ink, 'stroke-width': 1.5 }));
        g.appendChild(createSVG('rect', { x: x - 15, y: BASE_Y + 34, width: 30, height: 30, fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 1.5 }));
        g.appendChild(text('A', x, BASE_Y + 55, { size: 17, weight: 700, fill: COLORS.ink, anchor: 'middle' }));
        svg.appendChild(g);
    } else {
        svg.appendChild(datumFeatureSymbol(110, BASE_Y, 'A'));
    }

    // Zone: a cylinder square to A, sliding sideways to sit around the axis (centred on its mid-point)
    const zc = (CX + topX) / 2;
    const half = state.tol / 2 * k, halfAll = r.allowed / 2 * k;
    const zTop = TOP_Y - 30, zBot = BASE_Y;
    if (r.bonus > EPS) {
        svg.appendChild(createSVG('rect', { x: zc - halfAll, y: zTop, width: 2 * halfAll, height: zBot - zTop, fill: 'url(#thm-hatch-zone)' }));
    }
    svg.appendChild(createSVG('rect', { x: zc - half, y: zTop, width: 2 * half, height: zBot - zTop, fill: COLORS.zoneFill }));
    for (const x of [zc - halfAll, zc + halfAll]) svg.appendChild(createSVG('line', { x1: x, y1: zTop, x2: x, y2: zBot, stroke: COLORS.zoneStroke, 'stroke-width': 2, 'stroke-dasharray': '10 6' }));
    svg.appendChild(halo(text(`Ø${f(r.allowed)} zone`, zc, zTop - 8, { size: 13, weight: 700, fill: COLORS.zoneText, anchor: 'middle' })));

    // Perfect 90° reference through the bottom of the axis
    svg.appendChild(createSVG('line', { x1: CX, y1: BASE_Y, x2: CX, y2: zTop + 6, stroke: COLORS.nominal, 'stroke-width': 1.5, 'stroke-dasharray': '6 6' }));

    // Axis (red where it leaves the zone)
    svg.appendChild(createSVG('line', { x1: CX, y1: BASE_Y, x2: topX, y2: TOP_Y, stroke: r.orientOK ? COLORS.actual : COLORS.fail, 'stroke-width': 3, 'stroke-dasharray': '16 5 3 5' }));
    svg.appendChild(createSVG('circle', { cx: topX, cy: TOP_Y, r: 10, fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 2, style: 'cursor: ew-resize', 'data-drag': '' }));
    svg.appendChild(halo(text('drag the axis', topX + (state.lean >= 0 ? 16 : -16), TOP_Y + 5, { size: 12, italic: true, fill: COLORS.muted, anchor: state.lean >= 0 ? 'start' : 'end' })));

    // Lean dimension at the top
    if (r.needed > EPS) {
        const y = TOP_Y + 46;
        svg.appendChild(createSVG('line', { x1: CX, y1: y, x2: topX, y2: y, stroke: r.orientOK ? COLORS.muted : COLORS.fail, 'stroke-width': 1.5, 'marker-start': 'url(#thm-arrow-muted)', 'marker-end': 'url(#thm-arrow-muted)' }));
        svg.appendChild(halo(text(`lean ${f(r.needed)}`, Math.max(CX, topX) + 8, y + 4, { size: 12, weight: 600, mono: true, fill: r.orientOK ? COLORS.muted : COLORS.fail })));
    }
    svg.appendChild(halo(text(`length ${f(state.length)}${suffix()}`, 575, (TOP_Y + BASE_Y) / 2, { size: 12, fill: COLORS.muted, anchor: 'end' })));

    svg.appendChild(legend(24, 24, [
        { kind: 'zone', label: 'Stated zone (square to A, slides sideways)' },
        { kind: 'bonus', label: 'Bonus from the size' },
        { kind: 'nominal', label: 'Perfect 90° to A' },
        { kind: 'fail', label: 'Axis outside the zone' }
    ], { note: `Sideways lean exaggerated about ×${Math.max(1, Math.round(k * state.length / (BASE_Y - TOP_Y)))}` }));

    drawPanel(r);
    drawResults(r);
}

function drawPanel(r) {
    const x = PANEL_X, feat = state.feature;
    const tolStr = state.plus === state.minus ? `±${f(state.plus)}` : `+${f(state.plus)}/−${f(state.minus)}`;
    svgRef.appendChild(text(`Ø${f(state.nominal)} ${tolStr}`, x, 40, { size: 15, weight: 700, fill: COLORS.ink, mono: true }));
    svgRef.appendChild(featureControlFrame(x, 52, { symbol: 'perpendicularity', tolerance: state.tol.toFixed(decimals() - 1), diameter: true,
        modifier: { MMC: 'M', LMC: 'L', RFS: null }[state.modifier], datums: ['A'], h: 30 }).g);
    svgRef.appendChild(wrapText(`The ${feat}'s axis must lie in a cylinder Ø${f(state.tol)} square to datum A${state.modifier === 'RFS' ? ', whatever its size.' : `, which grows as the ${feat} departs from ${state.modifier}.`}`,
        x, 104, 50, 17, { size: 12.5, fill: COLORS.muted }));

    const title = (s, y) => svgRef.appendChild(text(s, x, y, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const row = (label, value, y, color = COLORS.ink) => {
        svgRef.appendChild(text(label, x, y, { size: 13.5, fill: COLORS.text }));
        svgRef.appendChild(text(value, x + PANEL_W, y, { size: 14, weight: 700, mono: true, anchor: 'end', fill: color }));
    };

    title('1. MEASURED SIZE → BONUS', 180);
    row(`MMC / LMC`, `Ø${f(r.mmc)} / Ø${f(r.lmc)}`, 204);
    row('Measured size', `Ø${f(state.actual)}${r.sizeOK ? '' : ' ✗'}`, 228, r.sizeOK ? COLORS.ink : COLORS.fail);
    row(state.modifier === 'RFS' ? 'Bonus (none at RFS)' : `Bonus (away from ${state.modifier})`, f(r.bonus), 252, COLORS.zoneText);

    title('2. ALLOWED TILT', 296);
    row('Stated + bonus', `${f(state.tol)} + ${f(r.bonus)} = Ø${f(r.allowed)}`, 320, COLORS.zoneText);
    row('Axis lean (zone needed)', `Ø${f(r.needed)}`, 344, r.orientOK ? COLORS.pass : COLORS.fail);
    row('Angle off square', `${r.angle.toFixed(3)}°`, 368, COLORS.muted);

    title('3. VIRTUAL CONDITION (THE GAUGE)', 412);
    if (r.vc === null) {
        svgRef.appendChild(wrapText('At RFS there is no fixed boundary: the zone does not change with size. Measure the axis (CMM, or a snug pin and an indicator).', x, 438, 50, 18, { size: 13, fill: COLORS.text }));
    } else if (state.modifier === 'MMC') {
        svgRef.appendChild(text(r.hole ? `Ø${f(r.vc)} = MMC ${f(r.mmc)} − ${f(state.tol)}` : `Ø${f(r.vc)} = MMC ${f(r.mmc)} + ${f(state.tol)}`, x, 438, { size: 15, weight: 700, mono: true, fill: COLORS.ink }));
        svgRef.appendChild(wrapText(r.hole
            ? `A gauge pin Ø${f(r.vc)}, standing square on a plate (datum A), must go all the way into every good hole. Bonus and size are checked in one go.`
            : `A gauge hole Ø${f(r.vc)}, square to a plate (datum A), must slide over every good pin. Bonus and size are checked in one go.`,
            x, 464, 50, 18, { size: 13, fill: COLORS.text }));
    } else {
        svgRef.appendChild(text(r.hole ? `Ø${f(r.vc)} = LMC ${f(r.lmc)} + ${f(state.tol)}` : `Ø${f(r.vc)} = LMC ${f(r.lmc)} − ${f(state.tol)}`, x, 438, { size: 15, weight: 700, mono: true, fill: COLORS.ink }));
        svgRef.appendChild(wrapText('The worst case on the material side: it protects wall thickness. It cannot be checked with a fixed gauge.', x, 464, 50, 18, { size: 13, fill: COLORS.text }));
    }
    if (state.modifier === 'MMC' && state.tol <= EPS) {
        svgRef.appendChild(wrapText('Zero tolerance at MMC: no tilt is allowed at MMC, but every bit the size moves away from MMC becomes tilt allowance.', x, 540, 50, 18, { size: 13, weight: 600, fill: COLORS.zoneText }));
    }
}

function drawResults(r) {
    const feat = state.feature;
    let s;
    if (!r.sizeOK) s = `The ${feat} is Ø${f(state.actual)}, outside its size limits Ø${f(r.lower)}–Ø${f(r.upper)}: it fails on size, whatever the tilt.`;
    else if (r.orientOK && r.needed > state.tol + EPS) s = `The axis leans ${f(r.needed)}, more than the stated ${f(state.tol)}, but the ${feat} is ${f(r.bonus)} away from ${state.modifier}. That bonus makes the zone Ø${f(r.allowed)}, so it passes.`;
    else if (r.orientOK) s = `The axis leans ${f(r.needed)} over ${f(state.length)}${suffix()} of length, inside the Ø${f(r.allowed)} zone square to A: it passes.`;
    else s = `The axis leans ${f(r.needed)}, but only Ø${f(r.allowed)} is allowed${r.bonus > EPS ? ` (stated ${f(state.tol)} + bonus ${f(r.bonus)})` : ''}: it fails.${state.modifier === 'MMC' && r.bonus < r.sizeTol - EPS ? ` A ${r.hole ? 'bigger hole' : 'smaller pin'} would earn more bonus.` : ''}`;
    svgRef.appendChild(resultsStrip({
        pass: r.pass,
        measured: { label: 'Axis lean (Ø)', value: r.needed },
        allowed: { label: r.bonus > EPS ? 'Stated + bonus' : 'Allowed', value: r.allowed },
        sentence: s, compact: s.length > 150
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600', segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const input = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold text-left';

function renderControls() {
    if (!controlsRoot) return;
    const seg = (key, v, label) => `<button data-${key}="${v}" class="${segBtn} ${state[key] === v ? segOn : segOff}">${label}</button>`;
    const num = (id, label, v, extra = '') => `<div><label class="block text-xs font-bold text-slate-500 mb-1">${label}</label><input id="${id}" type="number" step="${step()}" value="${+(+v).toFixed(5)}" ${extra} class="${input}"></div>`;
    const r = evaluate();
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-3">
            <div class="flex gap-2">${seg('feature', 'hole', 'Hole')}${seg('feature', 'pin', 'Pin')}</div>
            <div>
                <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Perpendicularity Ø to A</h4>
                <div class="grid grid-cols-2 gap-2 items-end">${num('ap-tol', 'TOLERANCE Ø', state.tol, 'min="0"')}
                    <div class="flex gap-1">${seg('modifier', 'MMC', 'Ⓜ')}${seg('modifier', 'RFS', 'RFS')}${seg('modifier', 'LMC', 'Ⓛ')}</div></div>
            </div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-2">
            <h4 class="font-bold text-xs text-slate-500 uppercase">${state.feature === 'hole' ? 'Hole' : 'Pin'} size (${unitName()})</h4>
            <div class="grid grid-cols-3 gap-2">${num('ap-nom', 'NOMINAL Ø', state.nominal)}${num('ap-plus', '+ TOL', state.plus, 'min="0"')}${num('ap-minus', '− TOL', state.minus, 'min="0"')}</div>
            ${num('ap-act', 'MEASURED SIZE Ø', state.actual)}
            <div class="flex gap-1.5"><button data-at="mmc" class="${smallBtn} flex-1 text-center">Set to MMC</button><button data-at="lmc" class="${smallBtn} flex-1 text-center">Set to LMC</button></div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-2">
            <h4 class="font-bold text-xs text-slate-500 uppercase">Axis as made (${unitName()})</h4>
            <div class="grid grid-cols-2 gap-2">${num('ap-lean', 'LEAN OVER LENGTH', state.lean)}${num('ap-len', 'LENGTH', state.length, 'min="0"')}</div>
            <p class="text-xs text-slate-500">Lean: how far the top of the axis is from its bottom, sideways. Or drag the axis.</p>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Try these</h4>
            <div class="flex flex-col gap-1.5">
                <button data-p="ok" class="${smallBtn}">At MMC, small tilt: passes</button>
                <button data-p="bonus" class="${smallBtn}">Tilt over the stated value, bonus saves it</button>
                <button data-p="fail" class="${smallBtn}">Same tilt at MMC: fails</button>
                <button data-p="zero" class="${smallBtn}">Zero tolerance at MMC</button>
            </div>
        </div>
        <div data-tip class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Surface or axis?</div>
            <div class="text-xs leading-relaxed">If the frame points at a <b>surface</b> (or its extension line), it controls that face: two planes. If it sits under the <b>size</b> (Ø), it controls the <b>axis</b>: a cylinder, and Ⓜ / Ⓛ may add bonus. Parallelism and angularity of an axis work the same way.</div>
        </div>`;

    const q = s => controlsRoot.querySelector(s);
    controlsRoot.querySelectorAll('[data-feature]').forEach(b => b.onclick = () => {
        if (state.feature === b.dataset.feature) return;
        state.feature = b.dataset.feature;
        Object.assign(state, SIZES[state.units][state.feature]);
        update();
    });
    controlsRoot.querySelectorAll('[data-modifier]').forEach(b => b.onclick = () => { state.modifier = b.dataset.modifier; update(); });
    const bind = (id, key, min = -Infinity) => q(id).oninput = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= min) { state[key] = v; render(); } };
    bind('#ap-tol', 'tol', 0); bind('#ap-nom', 'nominal', 0); bind('#ap-plus', 'plus', 0); bind('#ap-minus', 'minus', 0);
    bind('#ap-act', 'actual', 0); bind('#ap-lean', 'lean'); bind('#ap-len', 'length', fromIn(0.01));
    controlsRoot.querySelectorAll('[data-at]').forEach(b => b.onclick = () => { state.actual = b.dataset.at === 'mmc' ? r.mmc : r.lmc; update(); });
    controlsRoot.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { preset(b.dataset.p); update(); });
}

function preset(p) {
    const d = SIZES[state.units][state.feature];
    Object.assign(state, { ...d, modifier: 'MMC', tol: state.units === 'in' ? 0.010 : 0.25 });
    const r = evaluateAxis(state);
    const t = state.tol, sizeTol = r.sizeTol, round = v => +v.toFixed(decimals() + 1);
    if (p === 'ok') Object.assign(state, { actual: r.mmc, lean: round(t * 0.6) });
    if (p === 'bonus') Object.assign(state, { actual: r.hole ? r.mmc + sizeTol * 0.8 : r.mmc - sizeTol * 0.8, lean: round(t + sizeTol * 0.6) });
    if (p === 'fail') Object.assign(state, { actual: r.mmc, lean: round(t + sizeTol * 0.6) });
    if (p === 'zero') Object.assign(state, { tol: 0, actual: r.hole ? r.mmc + sizeTol * 0.5 : r.mmc - sizeTol * 0.5, lean: round(sizeTol * 0.4) });
    state.actual = round(state.actual);
}

function update() {
    render();
    renderControls();
}

// What a shared link carries (see js/share.js)
export const share = shareable(state, ['units', 'feature', 'modifier', 'tol', 'nominal', 'plus', 'minus', 'actual', 'lean', 'length']);
