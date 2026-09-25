// js/modules/form/straightness.js

import { createSVG, readTolerance } from '../../drawing_utils.js';
import { COLORS, resultsCard } from '../../theme.js';

const f4 = v => `${v.toFixed(4)}"`;

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    
    // Engineering Parameters (INCHES)
    scale: 2500,            // Zoom level
    toleranceWidth: 0.010,  // Allowable Straightness Tolerance
    
    // Shaft Geometry (Top profile definition)
    // 7 Control points along the length
    // X positions are fixed, Y offsets are deviations from nominal
    numPoints: 7,
    offsets: new Array(7).fill(0.000),
    
    // Visuals
    shaftLength: 800,
    shaftHeight: 200, // Visual height of the bar
    startX: 100,
    baseY: 400, // Nominal Top Surface Y
    
    // UI State
    activeHandleIdx: -1,
};

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

// --- MATH HELPERS (LEAST SQUARES) ---

// Calculates the "Best Fit Line" (y = mx + c) and the Straightness Error
function calculateStraightness() {
    const { startX, shaftLength, numPoints, offsets, scale } = state;
    const step = shaftLength / (numPoints - 1);
    
    // Collect points (x in pixels, y in INCHES relative to zero)
    // We analyze the 'offsets' array directly since that represents the surface profile
    const points = offsets.map((off, i) => ({ x: i * step, y: off }));
    
    // Least Squares Linear Regression
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = points.length;
    
    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumXX += p.x * p.x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate Deviations from this best fit line
    let maxPos = -Infinity; // Highest point above line
    let maxNeg = Infinity;  // Lowest point below line
    
    points.forEach(p => {
        const predictedY = slope * p.x + intercept;
        const diff = p.y - predictedY;
        if (diff > maxPos) maxPos = diff;
        if (diff < maxNeg) maxNeg = diff;
    });
    
    // Straightness Error = Range (Max - Min)
    const error = maxPos - maxNeg;
    
    return { slope, intercept, error, maxPos, maxNeg };
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    // 1. Defs (Gradient)
    drawDefs();

    // 2. Background Grid
    drawGrid();

    // 3. The Physical Part (Shaft)
    drawShaft();

    // 4. Analysis (Tolerance Zone & Reference Line)
    drawAnalysis();

    // 5. Interaction Handles
    drawHandles();

    // 6. Results card
    drawResultsCard();

    // 7. Guide
}

// --- DRAWING HELPERS ---

function drawDefs() {
    const defs = createSVG('defs', {});
    const grad = createSVG('linearGradient', { id: 'shaftGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
    grad.appendChild(createSVG('stop', { offset: '0%', 'stop-color': '#cbd5e1' })); // Top highlight
    grad.appendChild(createSVG('stop', { offset: '50%', 'stop-color': '#64748b' })); // Mid body
    grad.appendChild(createSVG('stop', { offset: '100%', 'stop-color': '#334155' })); // Bottom shadow
    defs.appendChild(grad);
    svgContainer.appendChild(defs);
}

function drawGrid() {
    const group = createSVG('g', { stroke: '#f1f5f9', 'stroke-width': 1 });
    // Vertical lines corresponding to control points
    const { startX, shaftLength, numPoints } = state;
    const step = shaftLength / (numPoints - 1);
    
    for (let i = 0; i < numPoints; i++) {
        const x = startX + (i * step);
        group.appendChild(createSVG('line', { x1: x, y1: 0, x2: x, y2: 800 }));
    }
    // Horizontals
    for (let y = 0; y < 800; y+=50) {
        group.appendChild(createSVG('line', { x1: 0, y1: y, x2: 1000, y2: y }));
    }
    svgContainer.appendChild(group);
}

function drawShaft() {
    const { startX, baseY, shaftLength, shaftHeight, numPoints, offsets, scale } = state;
    const step = shaftLength / (numPoints - 1);
    
    const group = createSVG('g', {});

    // Build the Top Profile Path
    // Note: Y = baseY - (offset * scale) because SVG Y is down
    let d = `M ${startX},${baseY + shaftHeight}`; // Start Bottom-Left
    
    // Top Edge (The Controlled Surface)
    for(let i=0; i<numPoints; i++) {
        const x = startX + (i * step);
        const y = baseY - (offsets[i] * scale);
        d += (i===0 ? " L" : " L") + ` ${x},${y}`;
    }
    
    // Finish loop
    d += ` L ${startX + shaftLength},${baseY + shaftHeight} Z`;

    // Draw Body
    group.appendChild(createSVG('path', {
        d: d,
        fill: 'url(#shaftGrad)',
        stroke: '#475569', 'stroke-width': 2
    }));
    
    // Highlight Top Edge
    let topPath = "";
    for(let i=0; i<numPoints; i++) {
        const x = startX + (i * step);
        const y = baseY - (offsets[i] * scale);
        topPath += (i===0 ? "M" : "L") + ` ${x},${y}`;
    }
    group.appendChild(createSVG('path', {
        d: topPath,
        fill: 'none', stroke: '#0f172a', 'stroke-width': 3
    }));

    svgContainer.appendChild(group);
}

function drawAnalysis() {
    const { slope, intercept, maxPos, maxNeg } = calculateStraightness();
    const { startX, baseY, shaftLength, scale, toleranceWidth } = state;
    
    // The "Best Fit Line" in pixel space:
    // PixelY = baseY - (InchY * scale)
    // InchY = slope * InchX + intercept
    // PixelX = startX + (InchX * step_px / step_inch? No, simpler)
    // Let's iterate X pixels from 0 to shaftLength
    
    const x1_pix = startX;
    const x2_pix = startX + shaftLength;
    
    // Calculate Y in inches at start and end
    const y1_inch = slope * 0 + intercept;
    const y2_inch = slope * shaftLength + intercept; // Assuming x in calc was 0..length
    
    // Convert to Pixels
    // Reference Line
    const y1_ref = baseY - (y1_inch * scale);
    const y2_ref = baseY - (y2_inch * scale);
    
    // Upper Boundary (Max Positive Deviation)
    // We need to encompass the highest point, so boundary is at Ref + MaxPos
    const y1_upper = baseY - ((y1_inch + maxPos) * scale);
    const y2_upper = baseY - ((y2_inch + maxPos) * scale);
    
    // Lower Boundary (Max Negative Deviation)
    const y1_lower = baseY - ((y1_inch + maxNeg) * scale);
    const y2_lower = baseY - ((y2_inch + maxNeg) * scale);
    
    const group = createSVG('g', {});

    // 1. Best Fit Center Line (Ghost)
    group.appendChild(createSVG('line', {
        x1: x1_pix, y1: y1_ref, x2: x2_pix, y2: y2_ref,
        stroke: '#fff', 'stroke-width': 1, 'stroke-dasharray': '5,5', opacity: 0.5
    }));
    
    // 2. The Tolerance Zone (Polygon Fill)
    // Defined by Upper and Lower planes
    const polyPts = `${x1_pix},${y1_upper} ${x2_pix},${y2_upper} ${x2_pix},${y2_lower} ${x1_pix},${y1_lower}`;
    group.appendChild(createSVG('polygon', {
        points: polyPts,
        fill: 'rgba(37, 99, 235, 0.1)', stroke: 'none'
    }));
    
    // 3. Zone Limit Lines
    const style = { stroke: '#2563eb', 'stroke-width': 2, 'stroke-dasharray': '10,5' };
    group.appendChild(createSVG('line', { x1: x1_pix, y1: y1_upper, x2: x2_pix, y2: y2_upper, ...style }));
    group.appendChild(createSVG('line', { x1: x1_pix, y1: y1_lower, x2: x2_pix, y2: y2_lower, ...style }));

    // 4. Dimension Arrow (Showing Straightness Error)
    // Draw at midpoint
    const midX = (x1_pix + x2_pix) / 2;
    const midY_up = (y1_upper + y2_upper) / 2;
    const midY_low = (y1_lower + y2_lower) / 2;
    
    // Push arrow to right side for clarity
    const dimX = x2_pix + 30;
    const dimY1 = y2_upper;
    const dimY2 = y2_lower;

    const arrowGroup = createSVG('g', { stroke: '#2563eb', 'stroke-width': 1 });
    arrowGroup.appendChild(createSVG('line', { 
        x1: dimX, y1: dimY1, x2: dimX, y2: dimY2, 
        'marker-end': 'url(#arrow)', 'marker-start': 'url(#arrow)' 
    }));
    
    // Extension lines
    arrowGroup.appendChild(createSVG('line', { x1: x2_pix, y1: y2_upper, x2: dimX+10, y2: y2_upper, 'stroke-dasharray':'2,2' }));
    arrowGroup.appendChild(createSVG('line', { x1: x2_pix, y1: y2_lower, x2: dimX+10, y2: y2_lower, 'stroke-dasharray':'2,2' }));

    group.appendChild(arrowGroup);

    svgContainer.appendChild(group);
}

function drawHandles() {
    const { startX, shaftLength, numPoints, offsets, scale, baseY } = state;
    const step = shaftLength / (numPoints - 1);
    const group = createSVG('g', {});

    offsets.forEach((off, i) => {
        const x = startX + (i * step);
        const y = baseY - (off * scale);
        
        // Vertical guideline
        group.appendChild(createSVG('line', {
            x1: x, y1: y, x2: x, y2: baseY + 50,
            stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '2,2'
        }));

        const circle = createSVG('circle', {
            cx: x, cy: y, r: 8,
            fill: 'white', stroke: '#0f172a', 'stroke-width': 2,
            class: 'cursor-ns-resize',
            'data-idx': i
        });

        circle.onmouseover = () => circle.setAttribute('fill', '#f59e0b');
        circle.onmouseout = () => circle.setAttribute('fill', 'white');

        group.appendChild(circle);
    });

    svgContainer.appendChild(group);
}

function drawResultsCard() {
    const { error } = calculateStraightness();
    const tol = state.toleranceWidth;
    const pass = error <= tol;
    svgContainer.appendChild(resultsCard({
        title: 'Straightness', pass,
        rows: [['Band needed', f4(error), { strong: true, color: pass ? COLORS.pass : COLORS.fail }], ['Allowed', f4(tol)]],
        measured: error, allowed: tol,
        sentence: pass ? `The line fits between two parallel lines ${f4(tol)} apart: it passes.`
            : `The line needs a band ${f4(error)} wide, more than the ${f4(tol)} allowed: it fails.`,
        note: 'Reference line: best fit to the points'
    }).g);
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
        const target = evt.target;
        if (target.dataset.idx) {
            state.activeHandleIdx = parseInt(target.dataset.idx);
            svg.style.cursor = 'ns-resize'; 
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (state.activeHandleIdx === -1) return;
        
        const m = getMousePos(evt);
        // Calc new offset
        // PixelY = BaseY - (Off * scale)
        // Off = (BaseY - PixelY) / scale
        let newOff = (state.baseY - m.y) / state.scale;
        
        // Limits
        newOff = Math.max(-0.05, Math.min(0.05, newOff));
        
        state.offsets[state.activeHandleIdx] = newOff;
        renderScene();
    });

    svg.addEventListener('mouseup', () => {
        state.activeHandleIdx = -1;
        svg.style.cursor = 'default';
    });
}

// --- CONTROLS UI ---

function renderControls() {
    if (!controlsContainer) return;

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Control Frame</h4>
            <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-max select-none shadow-md">
                <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center bg-slate-50">
                    <span class="text-3xl">—</span>
                </div>
                <div class="px-3 py-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN IN SIMPLE WORDS
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Try a shape</h4>
            
            <div class="grid grid-cols-2 gap-2 mb-4">
                <button id="btn-flat" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">PERFECT</button>
                <button id="btn-bow" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">BOW (CURVED)</button>
                <button id="btn-wave" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">WAVE</button>
                <button id="btn-random" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">NOISE</button>
            </div>
            
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">View Zoom</h4>
            <input type="range" id="ctrl-zoom" min="1000" max="4000" step="100" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputZoom = document.getElementById('ctrl-zoom');
    
    inputTol.oninput = (e) => { state.toleranceWidth = readTolerance(e.target.value); renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };

    const setOffsets = (fn) => {
        state.offsets = state.offsets.map((_, i) => fn(i, state.numPoints));
        renderScene();
    };

    document.getElementById('btn-flat').onclick = () => setOffsets(() => 0);
    document.getElementById('btn-bow').onclick = () => setOffsets((i, n) => {
        // Parabolic arc
        const x = (i / (n-1)) * 2 - 1; // -1 to 1
        return 0.015 * (1 - x*x);
    });
    document.getElementById('btn-wave').onclick = () => setOffsets((i, n) => {
        const x = (i / (n-1)) * 4 * Math.PI; 
        return 0.008 * Math.sin(x);
    });
    document.getElementById('btn-random').onclick = () => setOffsets(() => (Math.random() * 0.02) - 0.01);
}