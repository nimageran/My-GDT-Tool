// js/modules/material/datum_shift.js
// Datum shift (ASME Y14.5 §7.11.6): when a datum feature of size is
// referenced at MMB (B Ⓜ in the frame), the part may slide on the gauge by
// however much looser the datum feature is than its MMB. The whole pattern of
// tolerance zones moves together with it, so the shift helps holes that are
// all off the same way, not holes that are off in opposite directions.

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, addDefs, text, wrapText, legend, resultsStrip, featureControlFrame } from '../../theme.js';
import { getUnits, step, unitName, decimals } from '../../units.js';

// The example part in each unit: datum hole B (MMB and largest size), hole
// pitch from B, and g, the size of the deviations compared with the mm example.
const GEO = { mm: { mmb: 10.0, bMax: 10.1, pitch: 20, g: 1, label: 'Ø10 +0.1/0' },
              in: { mmb: 0.375, bMax: 0.379, pitch: 0.75, g: 0.04, label: 'Ø.375 +.004/0' } };
const G = () => GEO[state.units];
const scaleDev = dev => dev.map(d => d.map(v => +(v * G().g).toFixed(5)));
// The two example parts differ, so a unit change loads that unit's example (no conversion)
const START = { mm: { tol: 0.2, bSize: 10.08 }, in: { tol: 0.008, bSize: 0.3782 } };
function followUnits() {
    if (state.units === getUnits()) return;
    state.units = getUnits();
    Object.assign(state, START[state.units], { dev: scaleDev(PRESETS[0].dev) });
}


const PRESETS = [
    { label: 'Pattern off to one side: shift saves it', dev: [[0.12, 0.02], [0.13, -0.01], [0.11, 0.03], [0.12, 0]] },
    { label: 'Holes off in opposite directions: shift cannot help', dev: [[0.12, 0], [-0.12, 0], [0.12, 0], [-0.12, 0]] },
    { label: 'All holes good without shift', dev: [[0.05, 0.03], [-0.04, 0.06], [0.02, -0.07], [-0.06, -0.02]] }
];

const state = {
    units: 'mm',
    tol: 0.2,                           // position Ø of the 4 holes (made at MMC, so no bonus)
    bRef: 'MMB',                        // 'MMB' (B Ⓜ) | 'RMB' (B, no modifier)
    bSize: 10.08,                       // actual size of datum hole B
    dev: PRESETS[0].dev.map(d => [...d]) // measured offset of each hole from true position, relative to B's axis
};

let svgRef = null, controlsRoot = null;
const f3 = v => v.toFixed(decimals());
const trueXY = () => { const p = G().pitch; return [[-p, p], [p, p], [p, -p], [-p, -p]]; };   // holes at (±pitch, ±pitch) from B

export function draw(svg) {
    followUnits();
    svgRef = svg;
    render();
}

export function loadControls(container) {
    followUnits();
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

const worstPos = (dev, s) => Math.max(...dev.map(([dx, dy]) => 2 * Math.hypot(dx - s[0], dy - s[1])));

/** Best shift within a circle of radius smax: the one that makes the worst hole best. */
export function bestShift(dev, smax) {
    if (smax <= EPS) return [0, 0];
    let best = [0, 0], bestV = worstPos(dev, best);
    const tryAt = p => { const v = worstPos(dev, p); if (v < bestV - 1e-12) { bestV = v; best = p; } };
    for (let i = 1; i <= 24; i++) {
        for (let k = 0; k < 72; k++) {
            const r = smax * i / 24, a = k / 72 * 2 * Math.PI;
            tryAt([r * Math.cos(a), r * Math.sin(a)]);
        }
    }
    // Refine around the best point, staying inside the circle
    let step = smax / 24;
    for (let it = 0; it < 40; it++) {
        const c = best;
        for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
            const p = [c[0] + ux * step, c[1] + uy * step];
            if (Math.hypot(...p) <= smax + 1e-12) tryAt(p);
        }
        step /= 1.5;
    }
    return best;
}

export function evaluateShift(s) {
    const smax = s.bRef === 'MMB' ? Math.max(0, (s.bSize - G().mmb) / 2) : 0;
    const shift = bestShift(s.dev, smax);
    const before = s.dev.map(([dx, dy]) => 2 * Math.hypot(dx, dy));
    const after = s.dev.map(([dx, dy]) => 2 * Math.hypot(dx - shift[0], dy - shift[1]));
    const bOK = s.bSize >= G().mmb - EPS && s.bSize <= G().bMax + EPS;
    const passBefore = before.every(p => p <= s.tol + EPS);
    const pass = bOK && after.every(p => p <= s.tol + EPS);
    return { smax, shift, before, after, bOK, passBefore, pass, worst: Math.max(...after) };
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const C = { x: 250, y: 385 };            // datum B centre in the view
const layoutPx = () => 110 / G().pitch;     // px per unit for the layout (the pitch is always 110 px)
const devPx = () => 260 / G().g;          // px per unit for deviations (magnified)

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const r = evaluateShift(state);

    svg.appendChild(legend(24, 24, [
        { kind: 'zoneOutline', label: 'Position zones, moved by the shift' },
        { kind: 'nominal', label: 'Zones with no shift' },
        { kind: 'point', label: 'Measured hole centre' },
        { kind: 'actual', label: `Gauge pin for B at MMB (Ø${f3(G().mmb)})` }
    ], { note: 'Top view. Errors magnified.' }));

    drawPart(svg, r);
    drawPanel(svg, r);
    drawResults(svg, r);
}

function drawPart(svg, r) {
    const P = layoutPx(), M = devPx();
    const half = 1.8 * G().pitch * P;
    svg.appendChild(createSVG('rect', { x: C.x - half, y: C.y - half, width: 2 * half, height: 2 * half, rx: 14, fill: '#e2e8f0', stroke: COLORS.partStroke, 'stroke-width': 2 }));
    const s = r.shift;
    const sx = s[0] * M, sy = -s[1] * M;

    // Datum hole B (as made) and the gauge pin at MMB, shifted inside it
    const rB = 30 + (state.bSize - G().mmb) / 2 * M, rPin = 30;
    svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: rB, fill: '#fff', stroke: COLORS.actual, 'stroke-width': 2 }));
    svg.appendChild(createSVG('circle', { cx: C.x + sx, cy: C.y + sy, r: rPin, fill: 'rgba(15,23,42,0.75)' }));
    svg.appendChild(text('B', C.x + sx, C.y + sy + 5, { size: 15, weight: 800, fill: '#fff', anchor: 'middle' }));
    if (r.smax > EPS) {
        svg.appendChild(createSVG('circle', { cx: C.x, cy: C.y, r: r.smax * M, fill: 'none', stroke: '#b45309', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }));
    }

    trueXY().forEach(([tx, ty], i) => {
        const x = C.x + tx * P, y = C.y - ty * P;
        const zr = state.tol / 2 * M;
        const ok = r.after[i] <= state.tol + EPS;
        // zone with no shift (ghost) and the zone moved with the gauge
        svg.appendChild(createSVG('circle', { cx: x, cy: y, r: zr, fill: 'none', stroke: COLORS.nominal, 'stroke-width': 1.5, 'stroke-dasharray': '5 5' }));
        svg.appendChild(createSVG('circle', { cx: x + sx, cy: y + sy, r: zr, fill: ok ? COLORS.zoneFill : COLORS.failTint, stroke: ok ? COLORS.zoneStroke : COLORS.fail, 'stroke-width': 2, 'stroke-dasharray': '8 5' }));
        const [dx, dy] = state.dev[i];
        const px = x + dx * M, py = y - dy * M;
        svg.appendChild(createSVG('line', { x1: x + sx, y1: y + sy, x2: px, y2: py, stroke: ok ? COLORS.actual : COLORS.fail, 'stroke-width': 1.5 }));
        svg.appendChild(createSVG('circle', { cx: px, cy: py, r: 5, fill: ok ? COLORS.actual : COLORS.fail }));
        svg.appendChild(text(`H${i + 1}`, x + (tx < 0 ? -zr - 10 : zr + 10), y - zr - 4, { size: 13, weight: 800, fill: COLORS.ink, anchor: tx < 0 ? 'end' : 'start' }));
    });

    if (r.smax > EPS) {
        svg.appendChild(text(`B can slide up to ${f3(r.smax)} on the pin`, C.x, C.y + half + 26, { size: 13, weight: 700, fill: '#b45309', anchor: 'middle' }));
    } else {
        svg.appendChild(text(state.bRef === 'RMB' ? 'B at RMB: the part is held on B\'s own axis, no shift' : 'B is at MMB: it fits the pin exactly, no shift', C.x, C.y + half + 26, { size: 13, weight: 700, fill: COLORS.muted, anchor: 'middle' }));
    }
}

function drawPanel(svg, r) {
    const x = 520;
    const fcf = featureControlFrame(x, 30, { symbol: 'position', tolerance: state.tol.toFixed(2), diameter: true, modifier: 'M',
        datums: ['A', state.bRef === 'MMB' ? { letter: 'B', mod: 'M' } : 'B'] });
    svg.appendChild(fcf.g);
    svg.appendChild(text(`4X holes at MMC · datum hole B Ø${f3(state.bSize)} (MMB Ø${f3(G().mmb)})`, x, 90, { size: 13, fill: COLORS.muted }));

    // Table: each hole before and after the shift
    const y0 = 128;
    const cols = [x, x + 90, x + 210, x + 330];
    ['HOLE', 'NO SHIFT', 'WITH SHIFT', ''].forEach((h, i) => svg.appendChild(text(h, cols[i] + (i ? 80 : 0), y0, { size: 12, weight: 800, fill: COLORS.muted, anchor: i ? 'end' : 'start', letterSpacing: '0.05em' })));
    r.before.forEach((b, i) => {
        const y = y0 + 28 + i * 26;
        const okB = b <= state.tol + EPS, okA = r.after[i] <= state.tol + EPS;
        svg.appendChild(text(`H${i + 1}`, cols[0], y, { size: 14, weight: 700, fill: COLORS.ink }));
        svg.appendChild(text(`Ø${f3(b)}`, cols[1] + 80, y, { size: 14, mono: true, fill: okB ? COLORS.ink : COLORS.fail, anchor: 'end' }));
        svg.appendChild(text(`Ø${f3(r.after[i])}`, cols[2] + 80, y, { size: 14, mono: true, weight: 700, fill: okA ? COLORS.pass : COLORS.fail, anchor: 'end' }));
        svg.appendChild(text(okA ? 'PASS' : 'FAIL', cols[3] + 80, y, { size: 12.5, weight: 800, fill: okA ? COLORS.pass : COLORS.fail, anchor: 'end' }));
    });
    svg.appendChild(text(`allowed Ø${f3(state.tol)} each`, x, y0 + 28 + 4 * 26 + 4, { size: 12.5, fill: COLORS.muted, italic: true }));

    const shiftLen = Math.hypot(...r.shift);
    const lines = [
        `Shift available: ${f3(r.smax)} in any direction${state.bRef === 'MMB' ? ` (half of ${f3(state.bSize)} − ${f3(G().mmb)})` : ' (B at RMB)'}.`,
        shiftLen > EPS ? `Best shift used: ${f3(shiftLen)} toward the pattern's offset.` : 'No shift used.',
        'The whole pattern of zones moves together, like one gauge.'
    ];
    let y = 330;
    lines.forEach(l => { const w = wrapText(l, x, y, 56, 18, { size: 13.5, fill: COLORS.text }); svg.appendChild(w); y += w.childNodes.length * 18 + 8; });
}

function drawResults(svg, r) {
    const moved = r.before.some((b, i) => Math.abs(b - r.after[i]) > 1e-6);
    let sentence;
    if (!r.bOK) sentence = `Datum hole B measures Ø${f3(state.bSize)}, outside Ø${f3(G().mmb)} to Ø${f3(G().bMax)}: the part fails on B's size.`;
    else if (r.passBefore) sentence = `All holes pass even measured straight from B's axis (worst Ø${f3(Math.max(...r.before))}). No datum shift needed.`;
    else if (r.pass) sentence = `Measured from B's axis, the worst hole is Ø${f3(Math.max(...r.before))}: it would fail. But B is ${f3(state.bSize - G().mmb)} bigger than its MMB, so the part can slide ${f3(r.smax)} on the gauge pin. Sliding it brings every hole within Ø${f3(state.tol)}: it passes, thanks to datum shift.`;
    else if (state.bRef === 'RMB') sentence = `B is referenced at RMB, so the part is held on B's own axis with no shift. The worst hole is Ø${f3(r.worst)} against Ø${f3(state.tol)}: it fails.`;
    else if (moved) sentence = `Datum shift helps (worst hole from Ø${f3(Math.max(...r.before))} to Ø${f3(r.worst)}), but not enough: moving the pattern toward one hole moves it away from another. It fails.`;
    else if (r.smax > EPS) sentence = `B could slide up to ${f3(r.smax)} on the pin, but the holes are off in opposite directions: moving the pattern toward one hole moves it away from another, so the shift cannot help. The worst hole is Ø${f3(r.worst)} against Ø${f3(state.tol)}: it fails.`;
    else sentence = `B fits the pin exactly (at MMB), so there is no room to shift. The worst hole is Ø${f3(r.worst)} against Ø${f3(state.tol)}: it fails.`;
    svg.appendChild(resultsStrip({
        pass: r.pass, compact: true,
        measured: { label: 'Worst hole (Ø)', value: r.worst },
        allowed: { label: 'Allowed (Ø)', value: state.tol },
        sentence
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const input = 'w-full px-2 py-1 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold text-left';

function renderControls() {
    if (!controlsRoot) return;
    const seg = (v, label) => `<button data-bref="${v}" class="${segBtn} ${state.bRef === v ? segOn : segOff}">${label}</button>`;
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-3">
            <div>
                <h4 class="font-bold text-xs text-slate-500 uppercase mb-1">Datum B in the frame</h4>
                <div class="flex gap-2">${seg('MMB', 'B Ⓜ (at MMB)')}${seg('RMB', 'B (RMB)')}</div>
            </div>
            <div>
                <div class="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>DATUM HOLE B SIZE (${G().label})</span><span id="ds-b-v" class="font-mono">${f3(state.bSize)}</span></div>
                <input id="ds-b" type="range" min="${G().mmb}" max="${G().bMax}" step="${state.units === 'in' ? 0.0002 : 0.005}" value="${state.bSize}" class="w-full">
            </div>
            <div class="grid grid-cols-2 gap-2 items-end">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">POSITION Ø (4X)</label><input id="ds-tol" type="number" step="${step()}" min="${step()}" value="${state.tol}" class="${input}"></div>
                <p class="text-xs text-slate-500">Holes made at MMC, so they get no bonus here.</p>
            </div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Measured offsets from true position (${unitName()})</h4>
            <div class="grid grid-cols-[2rem_1fr_1fr] gap-1.5 items-center text-xs font-bold text-slate-500">
                <span></span><span>X</span><span>Y</span>
                ${state.dev.map(([dx, dy], i) => `<span>H${i + 1}</span>
                    <input data-dev="${i}:0" type="number" step="${step()}" value="${dx}" class="${input}">
                    <input data-dev="${i}:1" type="number" step="${step()}" value="${dy}" class="${input}">`).join('')}
            </div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Try these</h4>
            <div class="flex flex-col gap-1.5">${PRESETS.map((p, i) => `<button data-preset="${i}" class="${smallBtn}">${p.label}</button>`).join('')}</div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Watch out</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>Datum shift is not extra tolerance for each hole. It moves the whole pattern at once.</li>
                <li>A functional gauge allows it automatically. Many CMM reports measure from B's own axis and ignore it, so a good part can be rejected. Ask for the report to "simulate B at MMB".</li>
                <li>MMB is not always the MMC size: if B has its own geometric tolerance to A, MMB includes it (like a virtual condition).</li>
            </ul>
        </div>`;
    controlsRoot.querySelectorAll('[data-bref]').forEach(b => b.onclick = () => { state.bRef = b.dataset.bref; update(); });
    const q = s => controlsRoot.querySelector(s);
    q('#ds-b').oninput = e => { state.bSize = +e.target.value; q('#ds-b-v').textContent = f3(state.bSize); render(); };
    q('#ds-tol').oninput = e => { const v = parseFloat(e.target.value); if (v > 0) { state.tol = v; render(); } };
    controlsRoot.querySelectorAll('[data-dev]').forEach(e => e.oninput = () => {
        const [i, k] = e.dataset.dev.split(':').map(Number);
        const v = parseFloat(e.value);
        if (Number.isFinite(v)) { state.dev[i][k] = v; render(); }
    });
    controlsRoot.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
        state.dev = scaleDev(PRESETS[+b.dataset.preset].dev);
        update();
    });
}

function update() {
    render();
    renderControls();
}
