// js/modules/orientation/perpendicularity.js

import { createSVG, readTolerance } from '../../drawing_utils.js';
import {
    COLORS, text, wrapText, addDefs, zoneBand, zoneEdge, nominalLine, datumGround,
    datumFeatureSymbol, dimension, featureControlFrame, legend, resultsStrip
} from '../../theme.js';

// --- STATE MANAGEMENT ---
const state = {
    // Engineering Parameters (INCHES)
    scale: 5000,           // Sideways px per inch (the exaggeration control)
    toleranceWidth: 0.015, // Total width of tolerance zone
    featureHeight: 0.300,  // Height of the surface being checked
    topDeviation: 0.005,   // Linear offset at the top (The Tilt)

    // UI State
    isDragging: false,
    dragScale: null,       // Scale frozen at drag start so the handle tracks the mouse
};

// --- DRAWING GEOMETRY (px) ---
// The part is always drawn VIEW_H tall; sideways deviations use drawScale(),
// so the lean is exaggerated by scale * featureHeight / VIEW_H.
const VIEW_H = 340;
const BASE_Y = 540;        // Datum A surface
const BASE_X = 560;        // Bottom of the controlled (right) face
const BLOCK_W = 180;
const MAX_DEV = 0.03;      // Matches the tilt slider range
const MAX_LEAN_PX = 170;   // Keep the leaning top clear of the legend and frame
const MAX_ZONE_PX = 300;
const FCF_X = 760;
const LEADER_Y = 390;      // The frame's leader meets the surface at this height

// --- DOM REFERENCES ---
let svgContainer = null;
let controlsContainer = null;

// --- EXPORTED METHODS ---

export function draw(svg) {
    svgContainer = svg;
    setupInteractions(svg);
    renderScene();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// Tolerances display with 3 decimals, or 4 when smaller than 0.001"
const fmtTol = v => v.toFixed(v >= 0.001 ? 3 : 4);

// --- EVALUATION ---

// The perpendicularity zone floats sideways (it only has to stay at 90° to
// datum A), so the surface passes when its total lean fits the zone width.
function evaluate() {
    const { topDeviation, toleranceWidth, featureHeight } = state;
    const lean = Math.abs(topDeviation);
    const angleDeg = Math.atan2(lean, featureHeight) * 180 / Math.PI;
    return { lean, angleDeg, pass: lean <= toleranceWidth };
}

// Sideways px per inch actually drawn: the requested exaggeration, reduced
// when needed so a big lean or a wide zone still fits the stage.
function drawScale() {
    if (state.dragScale) return state.dragScale;
    const lean = Math.abs(state.topDeviation);
    return Math.min(
        state.scale,
        lean > 0 ? MAX_LEAN_PX / lean : Infinity,
        MAX_ZONE_PX / state.toleranceWidth
    );
}

function geometry() {
    const { topDeviation, toleranceWidth } = state;
    const scale = drawScale();
    const topY = BASE_Y - VIEW_H;
    const topX = BASE_X + topDeviation * scale;
    // Zone centered on the surface's sideways extent (best fit for a straight face)
    const zoneCenter = (BASE_X + topX) / 2;
    const halfZone = (toleranceWidth / 2) * scale;
    return { topX, topY, zoneCenter, halfZone };
}

// Labels beside the part sit right of the face, the zone and the handle
function labelColumnX() {
    const { topX, zoneCenter, halfZone } = geometry();
    return Math.max(BASE_X, topX, zoneCenter + halfZone) + 16;
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    addDefs(svgContainer);

    const result = evaluate();

    drawDatum();
    drawToleranceZone();
    drawPart(result);
    drawAnnotations(result);
    drawLegendAndFrame();
    drawResults(result);


    updateReadouts();
}

// --- DRAWING HELPERS ---

function drawDatum() {
    const g = createSVG('g', {});
    g.appendChild(datumGround(40, 960, BASE_Y));
    g.appendChild(datumFeatureSymbol(250, BASE_Y, 'A'));
    g.appendChild(text('Datum plane A (the mounting face)', 40, BASE_Y + 40, { size: 13, fill: COLORS.muted }));
    svgContainer.appendChild(g);
}

function drawToleranceZone() {
    const { topY, zoneCenter, halfZone } = geometry();
    const x1 = zoneCenter - halfZone;
    const x2 = zoneCenter + halfZone;
    const zoneTop = topY - 40;

    const g = createSVG('g', {});
    g.appendChild(zoneBand([
        { x: x1, y: BASE_Y }, { x: x2, y: BASE_Y }, { x: x2, y: zoneTop }, { x: x1, y: zoneTop }
    ]));
    g.appendChild(zoneEdge(x1, BASE_Y, x1, zoneTop));
    g.appendChild(zoneEdge(x2, BASE_Y, x2, zoneTop));
    g.appendChild(dimension(x1, zoneTop - 14, x2, zoneTop - 14, `${fmtTol(state.toleranceWidth)}" zone`, { color: 'zone' }));
    svgContainer.appendChild(g);
}

function drawPart(result) {
    const { topX, topY, halfZone } = geometry();
    const g = createSVG('g', {});

    // The block (right face is the controlled surface)
    g.appendChild(createSVG('path', {
        d: `M ${BASE_X - BLOCK_W},${BASE_Y} L ${BASE_X},${BASE_Y} L ${topX},${topY} L ${topX - BLOCK_W},${topY} Z`,
        fill: COLORS.partFill, stroke: COLORS.partStroke, 'stroke-width': 1.5, 'stroke-linejoin': 'round'
    }));

    // Controlled surface
    g.appendChild(createSVG('line', {
        x1: BASE_X, y1: BASE_Y, x2: topX, y2: topY,
        stroke: COLORS.actual, 'stroke-width': 5, 'stroke-linecap': 'round'
    }));

    // Red where the surface leaves the zone. Along the face (t = 0 bottom,
    // 1 top) x runs linearly, so it is outside where |t - 0.5| > k.
    const spanPx = Math.abs(topX - BASE_X);
    if (!result.pass && spanPx > 0) {
        const k = halfZone / spanPx;
        const at = t => ({ x: BASE_X + (topX - BASE_X) * t, y: BASE_Y - VIEW_H * t });
        for (const [t0, t1] of [[0, 0.5 - k], [0.5 + k, 1]]) {
            const a = at(t0), b = at(t1);
            g.appendChild(createSVG('line', {
                x1: a.x, y1: a.y, x2: b.x, y2: b.y,
                stroke: COLORS.fail, 'stroke-width': 6, 'stroke-linecap': 'round'
            }));
        }
    }

    // Drag handle
    g.appendChild(createSVG('circle', {
        cx: topX, cy: topY, r: 9, fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 2,
        style: 'cursor: ew-resize'
    }));
    g.appendChild(text('drag to tilt', labelColumnX() , topY + 5, { size: 12, fill: COLORS.muted, italic: true }));

    svgContainer.appendChild(g);
}

function drawAnnotations(result) {
    const { topX, topY } = geometry();
    const g = createSVG('g', {});

    // Perfect 90° reference and its square corner mark
    g.appendChild(nominalLine(BASE_X, BASE_Y, BASE_X, topY - 20));
    g.appendChild(createSVG('polyline', {
        points: `${BASE_X},${BASE_Y - 18} ${BASE_X + 18},${BASE_Y - 18} ${BASE_X + 18},${BASE_Y}`,
        fill: 'none', stroke: COLORS.nominal, 'stroke-width': 1.5
    }));
    g.appendChild(text('perfect 90°', BASE_X, topY - 26, { size: 12, fill: COLORS.muted, anchor: 'middle' }));

    // How far the top leans away from square
    if (result.lean > 0) {
        const y = topY + 34;
        g.appendChild(dimension(BASE_X, y, topX, y, '', { color: result.pass ? 'muted' : 'fail' }));
        g.appendChild(text(`lean ${result.lean.toFixed(4)}"`, labelColumnX(), y + 4, {
            size: 12, weight: 600, mono: true, fill: result.pass ? COLORS.muted : COLORS.fail
        }));
    }
    svgContainer.appendChild(g);
}

function drawLegendAndFrame() {
    const ex = drawScale() * state.featureHeight / VIEW_H;
    const note = ex > 1.05 ? `Sideways lean exaggerated ×${ex.toFixed(1)}` : 'Drawn to scale';
    svgContainer.appendChild(legend(24, 24, [
        { kind: 'zone', label: 'Tolerance zone (floats, stays 90° to A)' },
        { kind: 'actual', label: 'Controlled surface' },
        { kind: 'nominal', label: 'Perfect 90° reference' },
        { kind: 'fail', label: 'Part of surface outside the zone' }
    ], { note }));

    // The callout as it appears on the drawing, with a leader to the surface
    const { topX, topY } = geometry();
    const fcf = featureControlFrame(FCF_X, LEADER_Y - 17, {
        symbol: 'perpendicularity', tolerance: fmtTol(state.toleranceWidth), datums: ['A']
    });
    const t = (LEADER_Y - topY) / VIEW_H;
    const target = { x: topX + (BASE_X - topX) * t, y: LEADER_Y };
    svgContainer.appendChild(createSVG('path', {
        d: `M ${FCF_X},${LEADER_Y} L ${target.x + 4},${LEADER_Y}`,
        fill: 'none', stroke: COLORS.ink, 'stroke-width': 1.5, 'marker-end': 'url(#thm-arrow-ink)'
    }));
    svgContainer.appendChild(fcf.g);
    svgContainer.appendChild(wrapText(
        `Every point of this surface must lie between two parallel planes ${fmtTol(state.toleranceWidth)}" apart, held square to datum A.`,
        FCF_X, LEADER_Y + 44, 32, 17, { size: 12.5, fill: COLORS.muted }
    ));
}

function drawResults(result) {
    const { featureHeight, toleranceWidth } = state;
    const lean = result.lean.toFixed(4);
    const angle = result.angleDeg.toFixed(2);
    let sentence;
    if (result.lean === 0) {
        sentence = `The surface is perfectly square to datum A, so it passes with the full ${fmtTol(toleranceWidth)}" to spare.`;
    } else if (result.pass) {
        sentence = `The surface leans ${lean}" over its ${featureHeight.toFixed(3)}" height (${angle}° off square). That fits inside a ${fmtTol(toleranceWidth)}" zone held square to datum A, so it passes.`;
    } else {
        const over = (result.lean - toleranceWidth).toFixed(4);
        sentence = `The surface leans ${lean}" over its ${featureHeight.toFixed(3)}" height (${angle}° off square). The zone is only ${fmtTol(toleranceWidth)}" wide, so ${over}" of lean sticks out. It fails.`;
    }
    svgContainer.appendChild(resultsStrip({
        pass: result.pass,
        measured: { label: 'Measured lean', value: result.lean },
        allowed: { label: 'Zone width', value: toleranceWidth },
        sentence
    }));
}

// --- INTERACTION LOGIC ---

function setupInteractions(svg) {
    const getMousePos = (evt) => {
        const CTM = svg.getScreenCTM();
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    };

    svg.addEventListener('mousedown', (evt) => {

        const m = getMousePos(evt);
        const { topX, topY } = geometry();

        // Hit box around the top corner handle
        if (Math.hypot(m.x - topX, m.y - topY) < 40) {
            state.dragScale = drawScale();
            state.isDragging = true;
            svg.style.cursor = 'ew-resize';
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;

        const m = getMousePos(evt);
        const dev = (m.x - BASE_X) / state.dragScale;
        state.topDeviation = Math.max(-MAX_DEV, Math.min(MAX_DEV, dev));
        renderScene();
    });

    const endDrag = () => {
        if (!state.isDragging) return;
        state.isDragging = false;
        state.dragScale = null;
        renderScene();
        svg.style.cursor = 'default';
    };
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);
}

// --- CONTROLS UI ---

function renderControls() {
    if (!controlsContainer) return;

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Control Frame</h4>
            <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-full max-w-full overflow-x-auto select-none shadow-md">
                <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center bg-slate-50">
                    <span class="text-3xl">⊥</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" min="0.001"
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400 flex-1 text-center">A</div>
            </div>

             <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN IN SIMPLE WORDS
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Tilt Deviation (in)</h4>
            <div class="flex items-center gap-2 mb-2">
                <label class="w-16 text-xs font-bold text-slate-500">LEAN</label>
                <input type="number" id="ctrl-dev" step="0.001" value="${state.topDeviation.toFixed(4)}"
                    class="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <input type="range" id="slide-dev" min="-${MAX_DEV}" max="${MAX_DEV}" step="0.001" value="${state.topDeviation}"
                class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">

            <div class="mt-4 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-slate-500">SIDEWAYS EXAGGERATION</span>
                </div>
                <input type="range" id="ctrl-zoom" min="2000" max="10000" step="500" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Part Geometry</h4>
            <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-semibold text-slate-700">Surface Height (in)</label>
                <input type="number" id="ctrl-height" value="${state.featureHeight}" step="0.010" min="0.010"
                    class="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono">
            </div>

            <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-ruler-vertical"></i> Engineering Note</div>
                <div class="text-xs opacity-90 leading-relaxed">
                    Perpendicularity is angularity at exactly 90°. The zone may slide sideways to fit the surface, but it always stays at 90° to the datum.
                </div>
            </div>
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputDev = document.getElementById('ctrl-dev');
    const slideDev = document.getElementById('slide-dev');
    const inputHeight = document.getElementById('ctrl-height');
    const inputZoom = document.getElementById('ctrl-zoom');

    inputTol.oninput = (e) => { state.toleranceWidth = readTolerance(e.target.value); renderScene(); };

    const updateDev = (val) => {
        const v = parseFloat(val) || 0;
        state.topDeviation = Math.max(-MAX_DEV, Math.min(MAX_DEV, v));
        if(inputDev) inputDev.value = state.topDeviation.toFixed(4);
        if(slideDev) slideDev.value = state.topDeviation;
        renderScene();
    };

    inputDev.onchange = (e) => updateDev(e.target.value);
    slideDev.oninput = (e) => updateDev(e.target.value);

    inputHeight.oninput = (e) => {
        const h = parseFloat(e.target.value);
        state.featureHeight = h > 0 ? h : 0.1;
        renderScene();
    };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };

}

function updateReadouts() {
    if (state.isDragging) {
        const inputDev = document.getElementById('ctrl-dev');
        const slideDev = document.getElementById('slide-dev');
        if(inputDev) inputDev.value = state.topDeviation.toFixed(4);
        if(slideDev) slideDev.value = state.topDeviation;
    }
}
