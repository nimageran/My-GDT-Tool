// js/modules/material/virtual_condition.js
// Virtual and resultant condition (ASME Y14.5): the two worst-case
// boundaries a feature of size creates when its size and its position
// tolerance act together. Shown as the question engineers actually ask:
// will this pin always go into this hole?

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, addDefs, text, wrapText, legend, resultsStrip, featureControlFrame } from '../../theme.js';

const state = {
    hole: { nominal: 10, plus: 0.1, minus: 0, tol: 0.2, mod: 'MMC' },
    pin: { nominal: 9.6, plus: 0, minus: 0.1, tol: 0.1, mod: 'MMC' }
};

let svgRef = null, controlsRoot = null;
const f3 = v => v.toFixed(3);

export function draw(svg) {
    svgRef = svg;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

/**
 * Boundaries of one feature of size with a position tolerance.
 * inner / outer: the smallest and largest boundary the feature can create.
 * vc / rc: which of them is the virtual / resultant condition for the modifier.
 */
export function boundaries(kind, f) {
    const lower = f.nominal - f.minus, upper = f.nominal + f.plus;
    const hole = kind === 'hole';
    const mmc = hole ? lower : upper, lmc = hole ? upper : lower;
    const sizeTol = upper - lower, t = f.tol;
    let inner, outer, vcSide;
    if (hole) {
        if (f.mod === 'MMC') { inner = mmc - t; outer = lmc + t + sizeTol; vcSide = 'inner'; }
        else if (f.mod === 'LMC') { inner = mmc - t - sizeTol; outer = lmc + t; vcSide = 'outer'; }
        else { inner = mmc - t; outer = lmc + t; vcSide = null; }
    } else {
        if (f.mod === 'MMC') { outer = mmc + t; inner = lmc - t - sizeTol; vcSide = 'outer'; }
        else if (f.mod === 'LMC') { outer = mmc + t + sizeTol; inner = lmc - t; vcSide = 'inner'; }
        else { outer = mmc + t; inner = lmc - t; vcSide = null; }
    }
    return { lower, upper, mmc, lmc, sizeTol, inner, outer, vcSide };
}

function evaluate() {
    const H = boundaries('hole', state.hole), P = boundaries('pin', state.pin);
    // Worst case for assembly: the smallest space the hole leaves vs the most space the pin takes
    const clearance = H.inner - P.outer;
    return { H, P, clearance, pass: clearance >= -EPS };
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const C = { x: 250, y: 380 };             // true position in the circle view

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const r = evaluate();

    svg.appendChild(legend(24, 24, [
        { kind: 'zoneOutline', label: 'Hole: smallest space it leaves' },
        { kind: 'nominal', label: 'Pin: most space it takes' },
        { kind: 'actual', label: 'Worst case: both at MMC, shifted' }
    ], { note: 'Top view at true position. Sizes magnified.' }));

    drawCircles(svg, r);
    drawTables(svg, r);
    drawResults(svg, r);
}

function drawCircles(svg, r) {
    const { H, P } = r;
    // Magnify around the hole's inner boundary so small differences show
    const vals = [H.inner, P.outer, H.mmc, P.mmc];
    const span = Math.max(...vals) - Math.min(...vals) || 0.1;
    const K = 100 / span;                                   // px per mm (diameter)
    const R = d => Math.max(8, 105 + (d - H.inner) * K / 2);

    // Gap between the two boundaries
    const rh = R(H.inner), rp = R(P.outer);
    const ok = rh >= rp - 0.01;
    svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: Math.max(rh, rp), fill: ok ? COLORS.passTint : COLORS.failTint }));
    svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: Math.min(rh, rp), fill: '#f8fafc' }));

    // Worst-case example: each part at MMC, pushed to the edge of its position zone, opposite ways
    const sh = state.hole.tol / 2 * K, sp = state.pin.tol / 2 * K;          // a radial shift of t/2
    svg.appendChild(createSVG('circle', { cx: C.x - sh, cy: C.y, r: R(H.mmc), fill: 'none', stroke: COLORS.actual, 'stroke-width': 2 }));
    svg.appendChild(createSVG('circle', { cx: C.x + sp, cy: C.y, r: R(P.mmc), fill: 'rgba(100,116,139,0.18)', stroke: COLORS.actual, 'stroke-width': 2 }));

    // Boundaries
    svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: rh, fill: 'none', stroke: COLORS.zoneStroke, 'stroke-width': 2.5, 'stroke-dasharray': '10 6' }));
    svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: rp, fill: 'none', stroke: COLORS.nominal, 'stroke-width': 2.5, 'stroke-dasharray': '6 6' }));
    svg.appendChild(createSVG('line', { x1: C.x - 170, y1: C.y, x2: C.x + 170, y2: C.y, stroke: COLORS.muted, 'stroke-width': 1, 'stroke-dasharray': '14 4 3 4' }));
    svg.appendChild(createSVG('line', { x1: C.x, y1: C.y - 170, x2: C.x, y2: C.y + 170, stroke: COLORS.muted, 'stroke-width': 1, 'stroke-dasharray': '14 4 3 4' }));

    const ext = Math.max(rh, rp, R(H.mmc), R(P.mmc));
    svg.appendChild(text(`Hole boundary Ø${f3(H.inner)}`, C.x, C.y - ext - 16, { size: 13.5, weight: 700, fill: COLORS.zoneText, anchor: 'middle' }));
    svg.appendChild(text(`Pin boundary Ø${f3(P.outer)}`, C.x, C.y + ext + 26, { size: 13.5, weight: 700, fill: COLORS.text, anchor: 'middle' }));
    const gapText = ok ? `gap ${f3(r.clearance)}` : `clash ${f3(-r.clearance)}`;
    svg.appendChild(text(gapText, C.x, C.y + ext + 46, { size: 13.5, weight: 800, fill: ok ? COLORS.pass : COLORS.fail, anchor: 'middle' }));
}

function drawTables(svg, r) {
    const x = 480, w = 490;
    const table = (y, title, kind, f, B, color) => {
        svg.appendChild(createSVG('rect', { x, y, width: w, height: 196, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
        svg.appendChild(createSVG('rect', { x, y, width: 5, height: 196, rx: 2, fill: color }));
        svg.appendChild(text(title, x + 18, y + 28, { size: 14, weight: 800, fill: color }));
        const tolStr = f.plus === f.minus ? `±${f.plus}` : `+${f.plus}/−${f.minus}`;
        svg.appendChild(text(`Ø${f.nominal} ${tolStr}`, x + 18, y + 56, { size: 15, weight: 700, fill: COLORS.ink, mono: true }));
        const fcf = featureControlFrame(x + 200, y + 38, { symbol: 'position', tolerance: f.tol.toFixed(2), diameter: true, modifier: { MMC: 'M', LMC: 'L', RFS: null }[f.mod], datums: ['A', 'B'], h: 28 });
        svg.appendChild(fcf.g);
        const hole = kind === 'hole';
        const rows = [
            ['MMC (most material)', B.mmc, hole ? 'smallest hole' : 'largest pin'],
            ['LMC (least material)', B.lmc, hole ? 'largest hole' : 'smallest pin'],
            [label(B, 'inner', hole), B.inner, hole ? 'smallest space it ever leaves' : 'least material it ever has'],
            [label(B, 'outer', hole), B.outer, hole ? 'most space it can take up' : 'most space it ever takes']
        ];
        rows.forEach(([name, v, hint], i) => {
            const yy = y + 96 + i * 25;
            const key = (hole && i === 2) || (!hole && i === 3);        // the boundary that decides assembly
            svg.appendChild(text(name, x + 18, yy, { size: 13.5, weight: key ? 800 : 500, fill: key ? COLORS.ink : COLORS.text }));
            svg.appendChild(text(`Ø${f3(v)}`, x + 290, yy, { size: 14, weight: 700, fill: key ? color : COLORS.ink, mono: true, anchor: 'end' }));
            svg.appendChild(text(hint, x + 305, yy, { size: 12, fill: COLORS.muted }));
        });
    };
    table(30, 'HOLE (PART 1)', 'hole', state.hole, r.H, '#1d4ed8');
    table(240, 'PIN (PART 2)', 'pin', state.pin, r.P, '#334155');

    const how = r.H.vcSide === 'inner' && r.P.vcSide === 'outer'
        ? 'Both at MMC: the two virtual conditions decide assembly. A fixed gauge pin of the hole\'s virtual condition checks the hole.'
        : 'At RFS or LMC the assembly boundaries are not both virtual conditions; the worst case still uses the inner boundary of the hole and the outer boundary of the pin.';
    svg.appendChild(wrapText(how, x + 4, 466, 66, 18, { size: 13, fill: COLORS.muted, italic: true }));
}

function label(B, side, hole) {
    const base = side === 'inner' ? 'Inner boundary' : 'Outer boundary';
    if (B.vcSide === side) return `${base} = VC`;
    if (B.vcSide) return `${base} = RC`;
    return base;
}

function drawResults(svg, r) {
    const { H, P } = r;
    const sentence = r.pass
        ? `The hole never leaves less than Ø${f3(H.inner)} of space, and the pin never takes more than Ø${f3(P.outer)}. That leaves at least ${f3(r.clearance)} mm, so the parts always assemble, whatever sizes and positions they are made at within tolerance.`
        : `The hole can leave as little as Ø${f3(H.inner)}, but the pin can take up to Ø${f3(P.outer)}. In the worst case they clash by ${f3(-r.clearance)} mm. Make the pin smaller, the hole bigger, or tighten a position tolerance.`;
    svg.appendChild(resultsStrip({
        pass: r.pass, unit: ' mm', decimals: 3, compact: true,
        measured: { label: 'Pin takes (max)', value: P.outer },
        allowed: { label: 'Hole leaves (min)', value: H.inner },
        gauge: false, sentence
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const input = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold text-left';

const PRESETS = [
    { label: 'Always assembles (gap 0.100)', hole: { nominal: 10, plus: 0.1, minus: 0, tol: 0.2, mod: 'MMC' }, pin: { nominal: 9.6, plus: 0, minus: 0.1, tol: 0.1, mod: 'MMC' } },
    { label: 'Zero clearance: boundaries equal', hole: { nominal: 10, plus: 0.1, minus: 0, tol: 0.2, mod: 'MMC' }, pin: { nominal: 9.7, plus: 0, minus: 0.1, tol: 0.1, mod: 'MMC' } },
    { label: 'Can clash in the worst case', hole: { nominal: 10, plus: 0.1, minus: 0, tol: 0.3, mod: 'MMC' }, pin: { nominal: 9.8, plus: 0, minus: 0.1, tol: 0.1, mod: 'MMC' } }
];

function partCard(kind) {
    const f = state[kind];
    const seg = v => `<button data-mod="${kind}:${v}" class="${segBtn} ${f.mod === v ? segOn : segOff}">${{ MMC: 'Ⓜ MMC', RFS: 'RFS', LMC: 'Ⓛ LMC' }[v]}</button>`;
    const num = (key, label, step) => `<div><label class="block text-[11px] font-bold text-slate-500 mb-1">${label}</label>
        <input data-num="${kind}:${key}" type="number" step="${step}" min="0" value="${f[key]}" class="${input}"></div>`;
    return `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-2">
            <h4 class="font-bold text-xs text-slate-500 uppercase">${kind === 'hole' ? 'Hole (part 1)' : 'Pin (part 2)'}</h4>
            <div class="grid grid-cols-4 gap-2">${num('nominal', 'Ø', 0.1)}${num('plus', '+ TOL', 0.01)}${num('minus', '− TOL', 0.01)}${num('tol', 'POS Ø', 0.01)}</div>
            <div class="flex gap-1.5">${seg('MMC')}${seg('RFS')}${seg('LMC')}</div>
        </div>`;
}

function renderControls() {
    if (!controlsRoot) return;
    controlsRoot.innerHTML = `
        ${partCard('hole')}
        ${partCard('pin')}
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Try these</h4>
            <div class="flex flex-col gap-1.5">${PRESETS.map((p, i) => `<button data-preset="${i}" class="${smallBtn}">${p.label}</button>`).join('')}</div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> How to use the numbers</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li><b>Virtual condition</b> (VC) at MMC: hole = MMC − tolerance, pin = MMC + tolerance. Use it for assembly and for the size of a fixed gauge pin.</li>
                <li><b>Resultant condition</b> (RC): the other extreme, when the feature is at LMC with all its bonus used. Use it for the thinnest wall or the least material.</li>
                <li>Parts always assemble when the pin's outer boundary is not bigger than the hole's inner boundary.</li>
            </ul>
        </div>`;
    controlsRoot.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => {
        const [k, v] = b.dataset.mod.split(':');
        state[k].mod = v;
        update();
    });
    controlsRoot.querySelectorAll('[data-num]').forEach(e => e.oninput = () => {
        const [k, key] = e.dataset.num.split(':');
        const v = parseFloat(e.value);
        if (Number.isFinite(v) && v >= 0) { state[k][key] = v; render(); }
    });
    controlsRoot.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
        const p = PRESETS[+b.dataset.preset];
        state.hole = { ...p.hole };
        state.pin = { ...p.pin };
        update();
    });
}

function update() {
    render();
    renderControls();
}
