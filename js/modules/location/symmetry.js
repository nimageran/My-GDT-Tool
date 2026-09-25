// js/modules/location/symmetry.js

import { createSVG, readTolerance } from '../../drawing_utils.js';
import { COLORS, resultsCard, halo } from '../../theme.js';
import { syncUnits, fmt, fromIn, perFromIn, step, suffix, unitName } from '../../units.js';

const UNITS = { native: 'in', lengths: ['toleranceWidth', 'slotWidth', 'deviation'], perLength: ['scale'],
    nice: { mm: { toleranceWidth: 0.5, slotWidth: 12, deviation: 0.12, scale: 71 } } };

const f4 = v => fmt(v);

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 1800,           // Zoom level
    toleranceWidth: 0.020, // Total width of tolerance zone
    slotWidth: 0.500,      // Physical width of the slot/gap
    deviation: 0.005,      // Offset of the slot center from Datum
    
    // UI State
    isDragging: false,
};

// --- DOM REFERENCES ---
let svgContainer = null;
let controlsContainer = null;

// --- EXPORTED METHODS ---

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

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 

    // 1. Background Grid
    drawGrid();

    // 2. The Datum Plane (Center)
    drawDatumPlane();

    // 3. The Tolerance Zone (Two parallel planes)
    drawToleranceZone();

    // 4. The Physical Part (Two blocks forming a slot)
    drawSlotFeature();

    // 5. The Median Plane Visuals (The "Virtual" geometry)
    drawMedianAnalysis();

    // 6. Results card
    drawResultsCard();


    // 8. Sync UI
    updateReadouts();
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const { center, scale } = state;
    const gridSize = fromIn(0.010) * scale; 
    
    const group = createSVG('g', { stroke: '#e2e8f0', 'stroke-width': 1 });
    
    // Vertical lines only are most relevant for symmetry, but we draw a grid
    for (let x = center.x % gridSize; x < 1000; x += gridSize) {
        group.appendChild(createSVG('line', { x1: x, y1: 0, x2: x, y2: 800 }));
    }
    // Horizontal lines
    for (let y = center.y % gridSize; y < 800; y += gridSize) {
        group.appendChild(createSVG('line', { x1: 0, y1: y, x2: 1000, y2: y }));
    }
    
    svgContainer.appendChild(group);
}

function drawDatumPlane() {
    const { center } = state;
    const group = createSVG('g', { stroke: '#1e293b', 'stroke-width': 2 }); 

    // Datum Center Line (Infinite Plane)
    group.appendChild(createSVG('line', { 
        x1: center.x, y1: 0, x2: center.x, y2: 800, 'stroke-dasharray': '60, 10, 10, 10' 
    }));

    // Datum Identifier
    const textStyle = {
        fill: '#1e293b', stroke: 'none', 'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif', 'font-weight': '700', 'font-size': '14'
    };

    // Label, beside the plane
    const labelTop = createSVG('text', { x: center.x + 40, y: 660, ...textStyle });
    labelTop.textContent = "Datum centre plane A";

    // Boxed datum letter on the plane
    const bottomY = 700;
    group.appendChild(createSVG('rect', { x: center.x - 15, y: bottomY, width: 30, height: 30, fill: '#fff', 'stroke-width': 2 }));
    const labelBot = createSVG('text', { x: center.x, y: bottomY + 21, 'text-anchor': 'middle', ...textStyle, 'font-size': '17' });
    labelBot.textContent = "A";

    group.appendChild(halo(labelTop));
    group.appendChild(labelBot);
    svgContainer.appendChild(group);
}

function drawToleranceZone() {
    const { center, scale, toleranceWidth } = state;
    const halfTol = (toleranceWidth / 2) * scale;

    const group = createSVG('g', {});

    // Left Limit
    const x1 = center.x - halfTol;
    group.appendChild(createSVG('line', {
        x1: x1, y1: 0, x2: x1, y2: 800,
        stroke: '#2563eb', 'stroke-width': 2, 'stroke-dasharray': '15, 5'
    }));

    // Right Limit
    const x2 = center.x + halfTol;
    group.appendChild(createSVG('line', {
        x1: x2, y1: 0, x2: x2, y2: 800,
        stroke: '#2563eb', 'stroke-width': 2, 'stroke-dasharray': '15, 5'
    }));

    // Fill Zone (Rect between lines)
    group.appendChild(createSVG('rect', {
        x: x1, y: 0, width: x2 - x1, height: 800,
        fill: 'rgba(37, 99, 235, 0.05)', stroke: 'none'
    }));

    // Dimension Arrow for Tolerance Zone
    const dimY = 150;
    const arrowGroup = createSVG('g', { stroke: '#2563eb', 'stroke-width': 1 });
    arrowGroup.appendChild(createSVG('line', { x1: x1, y1: dimY, x2: x2, y2: dimY, 'marker-end': 'url(#arrow)', 'marker-start': 'url(#arrow)' }));
    
    const label = createSVG('text', {
        x: x2 + 10, y: dimY + 5,
        fill: '#2563eb', 'font-family': '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', 'font-size': '14', 'font-weight': 'bold', 'text-anchor': 'start'
    });
    label.textContent = `${toleranceWidth.toFixed(3)}${suffix()} zone`;
    halo(label);

    group.appendChild(arrowGroup);
    group.appendChild(label);
    svgContainer.appendChild(group);
}

function drawSlotFeature() {
    const { center, scale, deviation, slotWidth, toleranceWidth } = state;
    
    // Calculate Pixels
    const halfSlot = (slotWidth / 2) * scale;
    const centerX = center.x + (deviation * scale);
    
    const leftWallX = centerX - halfSlot;
    const rightWallX = centerX + halfSlot;

    // Logic for coloring
    // Pass if the MEDIAN PLANE (centerX) is within the tolerance zone bounds
    const limit = (toleranceWidth / 2) * scale;
    const dist = Math.abs(centerX - center.x);
    const isPass = dist <= limit;
    
    const color = isPass ? '#475569' : '#dc2626'; // Slate vs Red for the part itself
    const fillColor = isPass ? '#cbd5e1' : '#fecaca';

    const group = createSVG('g', { class: 'cursor-move', id: 'draggable-slot' });

    // Draw Left Block (Material)
    group.appendChild(createSVG('rect', {
        x: leftWallX - 300, y: 200, width: 300, height: 400,
        fill: fillColor, stroke: color, 'stroke-width': 3
    }));
    // Hatching simulation (lines on block)
    group.appendChild(createSVG('line', { x1: leftWallX-20, y1: 200, x2: leftWallX-20, y2: 600, stroke: color, opacity: 0.3 }));

    // Draw Right Block (Material)
    group.appendChild(createSVG('rect', {
        x: rightWallX, y: 200, width: 300, height: 400,
        fill: fillColor, stroke: color, 'stroke-width': 3
    }));
    group.appendChild(createSVG('line', { x1: rightWallX+20, y1: 200, x2: rightWallX+20, y2: 600, stroke: color, opacity: 0.3 }));

    // Dimensions for the Slot Width
    const dimY = 500; // Center height
    group.appendChild(createSVG('line', { 
        x1: leftWallX, y1: dimY, x2: rightWallX, y2: dimY, 
        stroke: '#1e293b', 'stroke-width': 2, 'marker-end': 'url(#arrow)', 'marker-start': 'url(#arrow)' 
    }));
    const widthText = createSVG('text', {
        x: centerX + halfSlot / 2, y: dimY - 10,
        fill: '#1e293b', 'font-family': 'sans-serif', 'font-size': '16', 'font-weight': 'bold', 'text-anchor': 'middle'
    });
    halo(widthText);
    widthText.textContent = `${slotWidth.toFixed(3)}${suffix()}`;
    
    group.appendChild(widthText);
    svgContainer.appendChild(group);
}

function drawMedianAnalysis() {
    const { center, scale, deviation, toleranceWidth } = state;
    const centerX = center.x + (deviation * scale);
    
    const group = createSVG('g', {});

    // 1. Draw the "Median Plane" (The derived geometry)
    // This is the centerline of the slot
    const isPass = Math.abs(deviation) <= (toleranceWidth / 2);
    const planeColor = isPass ? '#10b981' : '#ef4444'; // Green / Red

    group.appendChild(createSVG('line', {
        x1: centerX, y1: 180, x2: centerX, y2: 620,
        stroke: planeColor, 'stroke-width': 4, 'stroke-dasharray': '10,5'
    }));

    // Label for Median Plane
    const label = createSVG('text', {
        x: centerX + 14, y: 640,
        fill: planeColor, 'font-family': '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', 'font-size': '14', 'font-weight': 'bold', 'text-anchor': 'start'
    });
    label.textContent = "DERIVED MEDIAN PLANE";
    halo(label);
    group.appendChild(label);

    // 2. Visualizing "Opposed Points" averaging
    // Draw connecting lines between walls to show how the center is found
    const yLevels = [300, 400, 500];
    const { slotWidth } = state;
    const half = (slotWidth/2) * scale;

    yLevels.forEach(y => {
        // Line between walls
        group.appendChild(createSVG('line', {
            x1: centerX - half, y1: y, x2: centerX + half, y2: y,
            stroke: planeColor, 'stroke-width': 1, opacity: 0.5
        }));
        // Center Dot
        group.appendChild(createSVG('circle', {
            cx: centerX, cy: y, r: 4, fill: planeColor
        }));
    });

    svgContainer.appendChild(group);
}

function drawResultsCard() {
    const { deviation, toleranceWidth } = state;
    const limit = toleranceWidth / 2, off = Math.abs(deviation);
    const pass = off <= limit;
    svgContainer.appendChild(resultsCard({
        title: 'Symmetry', pass,
        rows: [['Midpoint off centre', f4(off), { strong: true, color: pass ? COLORS.pass : COLORS.fail }],
            ['Allowed each side', f4(limit)], ['Tolerance in the frame', f4(toleranceWidth)]],
        measured: off, allowed: limit,
        sentence: pass ? `The midpoints stay within ${f4(limit)} of the datum centre plane: it passes.`
            : `The midpoints are ${f4(off)} off the datum centre plane; only ${f4(limit)} is allowed: it fails.`
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

        const m = getMousePos(evt);
        const { center, scale, deviation } = state;
        const centerX = center.x + (deviation * scale);
        
        // Hit box is the center area of the slot
        if (m.x > centerX - 100 && m.x < centerX + 100) {
            state.isDragging = true;
            svg.style.cursor = 'ew-resize'; // East-West resize cursor
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        
        const m = getMousePos(evt);
        const { center, scale } = state;

        // Calculate new deviation
        state.deviation = (m.x - center.x) / scale;
        renderScene();
    });

    svg.addEventListener('mouseup', () => {
        state.isDragging = false;
        svg.style.cursor = 'default';
    });
}

// --- CONTROLS UI ---

function renderControls() {
    if (!controlsContainer) return;

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Control Frame</h4>
            <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-full max-w-full overflow-x-auto select-none shadow-md">
                <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center bg-slate-50">
                    <span class="text-3xl">⌯</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="${step()}" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400 flex-1 text-center">A</div>
            </div>
            
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Slot offset from centre (${unitName()})</h4>
            <div class="flex items-center gap-2 mb-2">
                <label class="w-16 text-xs font-bold text-slate-500">SHIFT</label>
                <input type="number" id="ctrl-dev" step="${step()}" value="${state.deviation.toFixed(4)}"
                    class="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <input type="range" id="slide-dev" min="${-fromIn(0.03)}" max="${fromIn(0.03)}" step="${fromIn(0.001)}" value="${state.deviation}" 
                class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
            
            <div class="mt-4 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-slate-500">ZOOM LEVEL</span>
                </div>
                <input type="range" id="ctrl-zoom" min="${perFromIn(1000)}" max="${perFromIn(3000)}" step="${perFromIn(100)}" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Settings</h4>
            <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-semibold text-slate-700">Slot Width (${unitName()})</label>
                <input type="number" id="ctrl-width" value="${state.slotWidth}" step="${fromIn(0.010)}"
                    class="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono">
            </div>

            <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-scale-balanced"></i> Where it is used</div>
                <div class="text-xs opacity-90 leading-relaxed">
                    Symmetry keeps a slot, tab or keyway centred on a datum centre plane. Removed in 2018: on new drawings, position does this job.
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
    const inputWidth = document.getElementById('ctrl-width');
    const inputZoom = document.getElementById('ctrl-zoom');

    inputTol.oninput = (e) => { state.toleranceWidth = readTolerance(e.target.value); renderScene(); };
    
    const updateDev = (val) => {
        state.deviation = parseFloat(val) || 0;
        if(inputDev) inputDev.value = state.deviation.toFixed(4);
        if(slideDev) slideDev.value = state.deviation;
        renderScene();
    };

    inputDev.oninput = (e) => updateDev(e.target.value);
    slideDev.oninput = (e) => updateDev(e.target.value);

    inputWidth.oninput = (e) => { state.slotWidth = parseFloat(e.target.value) || fromIn(0.1); renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };
    
}

function updateReadouts() {
    if (state.isDragging) {
        const inputDev = document.getElementById('ctrl-dev');
        const slideDev = document.getElementById('slide-dev');
        if(inputDev) inputDev.value = state.deviation.toFixed(4);
        if(slideDev) slideDev.value = state.deviation;
    }
}