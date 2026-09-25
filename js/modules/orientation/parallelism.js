// js/modules/orientation/parallelism.js
// Parallelism of a top face to datum A (the face the part sits on). The zone
// is two planes parallel to A, the tolerance apart; it may float up or down,
// so tilt and waviness count, the height itself does not (size checks that).
// Like a dial indicator swept across the top: reading = highest − lowest.

import { createSVG, readTolerance } from '../../drawing_utils.js';
import {
    COLORS, text, wrapText, addDefs, zoneBand, zoneEdge, nominalLine, datumGround,
    datumFeatureSymbol, featureControlFrame, legend, resultsStrip
} from '../../theme.js';
import { syncUnits, fmt, fromIn, perFromIn, step, suffix, unitName } from '../../units.js';

const UNITS = { native: 'in', lengths: ['tolerance', 'tilt', 'wave'], perLength: ['scale'],
    nice: { mm: { tolerance: 0.25, tilt: 0.1, wave: 0.08, scale: 240 } } };

// --- STATE (inches) ---
const state = {
    tolerance: 0.010,
    tilt: 0.004,           // rise from the left end to the right end
    wave: 0.003,           // peak-to-valley of the waviness
    scale: 6000            // requested vertical exaggeration, px per inch
};

// --- DRAWING GEOMETRY (px) ---
const BASE_Y = 540;        // datum A
const TOP_Y = 330;         // nominal top face
const X1 = 170, X2 = 690;  // part left / right
const MAX_DEV_PX = 70;     // keep the exaggerated surface on the stage
const MAX_ZONE_PX = 150;
const FCF_X = 740, LEADER_Y = 200;
const maxTilt = () => fromIn(0.03), maxWave = () => fromIn(0.03);
const N = 104;             // measured points across the face

let svgContainer = null;
let controlsContainer = null;
let drag = null;           // 'left' | 'right' while dragging an end

export function draw(svg) {
    syncUnits(state, UNITS);
    svgContainer = svg;
    setupInteractions(svg);
    renderScene();
}

export function loadControls(container) {
    syncUnits(state, UNITS);
    controlsContainer = container;
    renderControls();
}

const fmtTol = v => v.toFixed(v >= 0.001 ? 3 : 4);

// --- EVALUATION ---

/** Height of the top face at u (0 = left end, 1 = right end), relative to nominal. */
export function surfaceAt(u, { tilt, wave }) {
    return tilt * (u - 0.5) + (wave / 2) * Math.sin(u * Math.PI * 4);
}

/** Dial sweep: the zone floats, so the error is highest − lowest point. */
export function evaluate(s = state) {
    const pts = Array.from({ length: N + 1 }, (_, i) => surfaceAt(i / N, s));
    const hi = Math.max(...pts), lo = Math.min(...pts);
    const error = hi - lo;
    return { pts, hi, lo, error, mid: (hi + lo) / 2, pass: error <= s.tolerance + 1e-12 };
}

function drawScale(r) {
    const dev = Math.max(Math.abs(r.hi), Math.abs(r.lo));
    return Math.min(state.scale, dev > 0 ? MAX_DEV_PX / dev : Infinity, MAX_ZONE_PX / state.tolerance);
}

// --- RENDERING ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    addDefs(svgContainer);
    const r = evaluate();
    const k = drawScale(r);
    const X = u => X1 + (X2 - X1) * u;
    const Y = h => TOP_Y - h * k;

    // datum A
    svgContainer.appendChild(datumGround(40, 960, BASE_Y));
    svgContainer.appendChild(datumFeatureSymbol(250, BASE_Y, 'A'));
    svgContainer.appendChild(text('Datum plane A (the face the part sits on)', 40, BASE_Y + 40, { size: 13, fill: COLORS.muted }));

    // zone: two planes parallel to A, centred on the surface's spread (it floats)
    const zTop = Y(r.mid + state.tolerance / 2), zBot = Y(r.mid - state.tolerance / 2);
    svgContainer.appendChild(zoneBand([{ x: X1 - 30, y: zTop }, { x: X2 + 30, y: zTop }, { x: X2 + 30, y: zBot }, { x: X1 - 30, y: zBot }]));
    svgContainer.appendChild(zoneEdge(X1 - 30, zTop, X2 + 30, zTop));
    svgContainer.appendChild(zoneEdge(X1 - 30, zBot, X2 + 30, zBot));
    // zone width marker at the left
    const zx = X1 - 48;
    svgContainer.appendChild(createSVG('line', { x1: zx, y1: zTop, x2: zx, y2: zBot, stroke: COLORS.zoneText, 'stroke-width': 1.5, 'marker-start': 'url(#thm-arrow-zone)', 'marker-end': 'url(#thm-arrow-zone)' }));
    svgContainer.appendChild(text(`${fmtTol(state.tolerance)}${suffix()}`, zx - 8, (zTop + zBot) / 2 + 4, { size: 13, weight: 600, mono: true, fill: COLORS.zoneText, anchor: 'end' }));

    // the part: body up to the measured top face
    const top = r.pts.map((h, i) => `${X(i / N).toFixed(1)},${Y(h).toFixed(1)}`);
    svgContainer.appendChild(createSVG('path', {
        d: `M ${X1},${BASE_Y} L ${top.join(' L ')} L ${X2},${BASE_Y} Z`,
        fill: COLORS.partFill, stroke: COLORS.partStroke, 'stroke-width': 1.5, 'stroke-linejoin': 'round'
    }));
    svgContainer.appendChild(nominalLine(X1, TOP_Y, X2, TOP_Y));
    svgContainer.appendChild(createSVG('polyline', { points: top.join(' '), fill: 'none', stroke: COLORS.actual, 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    // red where outside the zone (only when it fails)
    if (!r.pass) {
        const lim = state.tolerance / 2;
        let seg = [];
        const flush = () => { if (seg.length > 1) svgContainer.appendChild(createSVG('polyline', { points: seg.join(' '), fill: 'none', stroke: COLORS.fail, 'stroke-width': 6, 'stroke-linecap': 'round' })); seg = []; };
        r.pts.forEach((h, i) => { if (Math.abs(h - r.mid) > lim) seg.push(`${X(i / N)},${Y(h)}`); else flush(); });
        flush();
    }

    // dial readings: highest and lowest point
    const iHi = r.pts.indexOf(r.hi), iLo = r.pts.indexOf(r.lo);
    const mark = (i, label, ly) => {
        const x = X(i / N), y = Y(r.pts[i]);
        svgContainer.appendChild(createSVG('circle', { cx: x, cy: y, r: 5, fill: COLORS.ink }));
        svgContainer.appendChild(text(label, x, ly, { size: 12.5, weight: 600, fill: COLORS.text, anchor: 'middle' }));
    };
    if (r.error > 1e-9) {
        mark(iHi, `highest ${r.hi >= 0 ? '+' : ''}${r.hi.toFixed(4)}${suffix()}`, Math.min(zTop, Y(r.hi)) - 10);
        mark(iLo, `lowest ${r.lo >= 0 ? '+' : ''}${r.lo.toFixed(4)}${suffix()}`, Math.max(zBot, Y(r.lo)) + 22);
    }

    // drag handles at the two ends
    for (const [u, side] of [[0, 'left'], [1, 'right']]) {
        svgContainer.appendChild(createSVG('circle', { cx: X(u), cy: Y(r.pts[u * N]), r: 9, fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 2, style: 'cursor: ns-resize', 'data-end': side }));
    }
    svgContainer.appendChild(text('drag an end to tilt', X2 - 14, Math.max(zBot, Y(r.pts[N])) + 44, { size: 12, italic: true, fill: COLORS.muted, anchor: 'end' }));

    // legend
    const ex = k / perFromIn(100);   // vertical px per unit vs about 100 px per inch along the part
    svgContainer.appendChild(legend(24, 24, [
        { kind: 'zone', label: 'Zone (parallel to A, floats up/down)' },
        { kind: 'actual', label: 'Top face as made' },
        { kind: 'nominal', label: 'Perfect top face' },
        { kind: 'fail', label: 'Outside the zone' }
    ], { note: `Heights exaggerated about ×${Math.round(ex)}` }));

    // callout with leader to the top face
    const fcf = featureControlFrame(FCF_X, LEADER_Y - 17, { symbol: 'parallelism', tolerance: fmtTol(state.tolerance), datums: ['A'] });
    const tx = X(0.85), ty = Y(surfaceAt(0.85, state));
    svgContainer.appendChild(createSVG('path', { d: `M ${FCF_X},${LEADER_Y} L ${tx + 30},${LEADER_Y} L ${tx},${ty - 4}`, fill: 'none', stroke: COLORS.ink, 'stroke-width': 1.5, 'marker-end': 'url(#thm-arrow-ink)' }));
    svgContainer.appendChild(fcf.g);
    svgContainer.appendChild(wrapText(`Every point of the top face must lie between two planes ${fmtTol(state.tolerance)}${suffix()} apart, parallel to datum A. The planes may sit at any height.`,
        FCF_X, LEADER_Y + 44, 30, 17, { size: 12.5, fill: COLORS.muted }));

    drawResults(r);
}

function drawResults(r) {
    const e = r.error.toFixed(4), t = fmtTol(state.tolerance);
    let sentence;
    if (r.error <= 1e-9) sentence = `The top face is perfectly parallel to datum A: the dial does not move. It passes with the full ${t}${suffix()} to spare.`;
    else if (r.pass) sentence = `Swept across the top, the dial moves ${e}${suffix()} (highest − lowest). That fits between two planes ${t}${suffix()} apart, parallel to A, so it passes.`;
    else sentence = `The dial moves ${e}${suffix()} across the top, but the planes are only ${t}${suffix()} apart. ${(r.error - state.tolerance).toFixed(4)}${suffix()} sticks out, so it fails.`;
    svgContainer.appendChild(resultsStrip({
        pass: r.pass,
        measured: { label: 'Dial high − low', value: r.error },
        allowed: { label: 'Zone width', value: state.tolerance },
        sentence
    }));
}

// --- INTERACTION ---

function setupInteractions(svg) {
    const pos = e => { const m = svg.getScreenCTM(); return { x: (e.clientX - m.e) / m.a, y: (e.clientY - m.f) / m.d }; };
    let k0 = 1;
    svg.addEventListener('pointerdown', e => {
        const end = e.target.closest?.('[data-end]');
        if (!end) return;
        drag = end.dataset.end;
        k0 = drawScale(evaluate());
        svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
        if (!drag) return;
        // the end's height = ±tilt/2 + wave term (zero at the ends), so tilt = ±2 × height
        const h = (TOP_Y - pos(e).y) / k0;
        const tilt = drag === 'right' ? 2 * h : -2 * h;
        state.tilt = Math.max(-maxTilt(), Math.min(maxTilt(), +tilt.toFixed(4)));
        renderScene();
        syncInputs();
    });
    const end = () => { drag = null; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
}

// --- CONTROLS ---

function renderControls() {
    if (!controlsContainer) return;
    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Control Frame</h4>
            <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-full max-w-full overflow-x-auto select-none shadow-md">
                <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center bg-slate-50">
                    <span class="text-3xl">∥</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.tolerance}" step="${step()}" min="${step()}"
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400 flex-1 text-center">A</div>
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Top face as made (${unitName()})</h4>
            <div class="flex items-center gap-2 mb-2">
                <label class="w-20 text-xs font-bold text-slate-500">TILT</label>
                <input type="number" id="ctrl-tilt" step="${step()}" value="${state.tilt}" class="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <input type="range" id="slide-tilt" min="-${maxTilt()}" max="${maxTilt()}" step="${fromIn(0.0005)}" value="${state.tilt}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-4">
            <div class="flex items-center gap-2 mb-2">
                <label class="w-20 text-xs font-bold text-slate-500">WAVINESS</label>
                <input type="number" id="ctrl-wave" step="${step()}" min="0" value="${state.wave}" class="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <input type="range" id="slide-wave" min="0" max="${maxWave()}" step="${fromIn(0.0005)}" value="${state.wave}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
            <div class="grid grid-cols-2 gap-2 mt-4">
                <button data-p="perfect" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold">Perfect</button>
                <button data-p="tilt" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold">Tilted only</button>
                <button data-p="wave" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold">Wavy only</button>
                <button data-p="fail" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold">Both: fails</button>
            </div>
        </div>

        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-ruler-horizontal"></i> Engineering Note</div>
            <div class="text-xs opacity-90 leading-relaxed">
                Parallelism limits tilt and waviness, so it also limits the flatness of that face. It does not control the height: the zone may sit anywhere, and the size dimension checks the height. Check it by resting datum A on a surface plate and sweeping a dial across the top.
            </div>
        </div>`;

    const tol = document.getElementById('ctrl-tol');
    tol.oninput = e => { state.tolerance = readTolerance(e.target.value); renderScene(); };
    const bind = (key, max, min) => {
        const set = v => { const x = parseFloat(v); if (!Number.isFinite(x)) return; state[key] = Math.max(min, Math.min(max, x)); renderScene(); syncInputs(); };
        document.getElementById(`ctrl-${key}`).onchange = e => set(e.target.value);
        document.getElementById(`slide-${key}`).oninput = e => set(e.target.value);
    };
    bind('tilt', maxTilt(), -maxTilt());
    bind('wave', maxWave(), 0);
    controlsContainer.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
        const t = state.tolerance;
        const p = { perfect: [0, 0], tilt: [t * 0.8, 0], wave: [0, t * 0.8], fail: [t * 0.8, t * 1.0] }[b.dataset.p];
        state.tilt = +p[0].toFixed(4); state.wave = +p[1].toFixed(4);
        renderScene(); syncInputs();
    });
}

function syncInputs() {
    for (const key of ['tilt', 'wave']) {
        const n = document.getElementById(`ctrl-${key}`), s = document.getElementById(`slide-${key}`);
        if (n && document.activeElement !== n) n.value = state[key];
        if (s) s.value = state[key];
    }
}
