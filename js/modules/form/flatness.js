// js/modules/form/flatness.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 200,             // Grid spacing (XY)
    zScale: 5000,           // Exaggeration for Z-errors
    toleranceWidth: 0.010,  // The allowable zone width
    
    // Surface Definition (5x5 Grid = 25 points)
    gridSize: 5,
    // Flattened array of Z deviations
    zValues: new Array(25).fill(0.000),
    
    // 3D View Settings (Isometric)
    isoTilt: 0.6,
    isoRot: 0.785, // 45 degrees
    
    // Analysis Data
    stats: { peak: 0, valley: 0, error: 0, isPass: true },
    
    // UI State
    activeHandleIdx: -1,
    dragStartY: 0,
    dragStartZ: 0,
    showGuide: false
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

// --- MATH HELPERS (3D & BEST FIT) ---

// Project 3D world coord to 2D screen coord
function project(x, y, z) {
    const { center, scale, zScale, isoTilt, isoRot } = state;
    
    // Rotate around Z (Spin)
    const x1 = x * Math.cos(isoRot) - y * Math.sin(isoRot);
    const y1 = x * Math.sin(isoRot) + y * Math.cos(isoRot);
    
    // Rotate around X (Tilt)
    const y2 = y1 * Math.cos(isoTilt) - z * 0; // Standard iso flattening
    // Actually, simpler isometric:
    // ScreenX = (x - y) * cos(30)
    // ScreenY = (x + y) * sin(30) - z
    
    // Let's use a custom projection for good visibility
    const px = center.x + (x - y) * scale * 0.8;
    const py = center.y + (x + y) * scale * 0.4 - (z * zScale);
    
    return { x: px, y: py, depth: (x+y) }; // Depth for sorting if needed
}

function analyzeSurface() {
    // Flatness is independent of location and orientation (Tilt).
    // We must find the "Best Fit Plane" and calculate deviations from IT.
    // Simplified: We calculate the Mean Plane and subtract it.
    
    // 1. Calculate Centroid
    let sumZ = 0;
    state.zValues.forEach(z => sumZ += z);
    const meanZ = sumZ / state.zValues.length;
    
    // 2. Simple Tilt Removal (Planar Regression: z = ax + by + c)
    // For a symmetrical grid centered at 0, this is simplified.
    // Calculate slopes in X and Y roughly.
    // (This is a simplified visual approximation of Least Squares)
    
    // We will visually just show the Peak-Valley range of the raw data 
    // assuming the operator "Levels" the part physically (Resets tilt).
    // For this simulation, we assume the user inputs are deviations from the mean plane.
    
    let peak = -Infinity;
    let valley = Infinity;
    
    state.zValues.forEach(z => {
        if(z > peak) peak = z;
        if(z < valley) valley = z;
    });
    
    const error = peak - valley;
    
    state.stats = {
        peak,
        valley,
        error,
        isPass: error <= state.toleranceWidth
    };
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    analyzeSurface();
    
    drawDefs();
    drawGridBase();
    drawToleranceSandwich();
    drawSurfaceMesh();
    drawErrorVectors();
    drawHandles();
    drawFuturisticHUD();
    
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawDefs() {
    const defs = createSVG('defs', {});
    
    // Plane Gradient
    const grad = createSVG('linearGradient', { id: 'planeGrad', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
    grad.appendChild(createSVG('stop', { offset: '0%', 'stop-color': '#3b82f6', 'stop-opacity': '0.1' }));
    grad.appendChild(createSVG('stop', { offset: '100%', 'stop-color': '#2563eb', 'stop-opacity': '0.3' }));
    
    defs.appendChild(grad);
    svgContainer.appendChild(defs);
}

function drawGridBase() {
    // A faint reference floor
    const group = createSVG('g', { opacity: 0.3 });
    const sz = 2; // Grid extends -2 to 2
    
    // Draw boundary
    const p1 = project(-sz, -sz, 0);
    const p2 = project(sz, -sz, 0);
    const p3 = project(sz, sz, 0);
    const p4 = project(-sz, sz, 0);
    
    const d = `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`;
    
    group.appendChild(createSVG('path', {
        d: d, fill: 'none', stroke: '#94a3b8', 'stroke-dasharray': '5,5'
    }));
    
    svgContainer.appendChild(group);
}

function drawToleranceSandwich() {
    // Draws the two parallel planes that define the zone.
    // Positioned at (MaxZ + MinZ)/2 +/- Tolerance/2 ?
    // No, Flatness tolerance is the separation. 
    // We visually center the tolerance zone around the Midrange of the error.
    
    const { toleranceWidth, gridSize } = state;
    const { peak, valley } = state.stats;
    const midZ = (peak + valley) / 2;
    
    const halfTol = toleranceWidth / 2;
    const topZ = midZ + halfTol;
    const botZ = midZ - halfTol;
    
    const group = createSVG('g', {});
    
    const drawPlane = (z, color) => {
        const offset = (gridSize-1)/2 * 0.5; // Grid spacing is 0.5 visual units
        // Corners: (-1, -1) to (1, 1) roughly
        // We map grid indices 0..4 to -1..1
        const map = (i) => (i / (gridSize-1)) * 2 - 1;
        
        const c1 = project(map(0), map(0), z);
        const c2 = project(map(4), map(0), z);
        const c3 = project(map(4), map(4), z);
        const c4 = project(map(0), map(4), z);
        
        const d = `M ${c1.x},${c1.y} L ${c2.x},${c2.y} L ${c3.x},${c3.y} L ${c4.x},${c4.y} Z`;
        
        group.appendChild(createSVG('path', {
            d: d, fill: 'url(#planeGrad)', stroke: color, 'stroke-width': 1, 'stroke-dasharray': '5,5'
        }));
    };
    
    drawPlane(topZ, '#3b82f6');
    drawPlane(botZ, '#3b82f6');
    
    svgContainer.appendChild(group);
}

function drawSurfaceMesh() {
    const { gridSize, zValues } = state;
    const group = createSVG('g', {});
    
    // Map grid index 0..4 to world coords -1..1
    const map = (i) => (i / (gridSize-1)) * 2 - 1;
    
    // Draw Wires (Rows)
    for(let r=0; r<gridSize; r++) {
        let d = "";
        for(let c=0; c<gridSize; c++) {
            const idx = r*gridSize + c;
            const pt = project(map(c), map(r), zValues[idx]);
            d += (c===0 ? "M" : "L") + ` ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        }
        group.appendChild(createSVG('path', { d, fill: 'none', stroke: '#64748b', 'stroke-width': 2 }));
    }
    
    // Draw Wires (Cols)
    for(let c=0; c<gridSize; c++) {
        let d = "";
        for(let r=0; r<gridSize; r++) {
            const idx = r*gridSize + c;
            const pt = project(map(c), map(r), zValues[idx]);
            d += (r===0 ? "M" : "L") + ` ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        }
        group.appendChild(createSVG('path', { d, fill: 'none', stroke: '#64748b', 'stroke-width': 2 }));
    }

    svgContainer.appendChild(group);
}

function drawErrorVectors() {
    const { gridSize, zValues, stats, toleranceWidth } = state;
    const { peak, valley } = stats;
    const midZ = (peak + valley) / 2;
    const limitTop = midZ + (toleranceWidth/2);
    const limitBot = midZ - (toleranceWidth/2);
    
    const group = createSVG('g', {});
    const map = (i) => (i / (gridSize-1)) * 2 - 1;

    for(let i=0; i<zValues.length; i++) {
        const r = Math.floor(i / gridSize);
        const c = i % gridSize;
        const z = zValues[i];
        
        // Check if out of bounds
        let isFail = false;
        if (z > limitTop + 0.00001) isFail = true; // epsilon
        if (z < limitBot - 0.00001) isFail = true;
        
        if (isFail) {
            const ptSurf = project(map(c), map(r), z);
            // Draw line to the nearest limit
            const targetZ = (z > limitTop) ? limitTop : limitBot;
            const ptLim = project(map(c), map(r), targetZ);
            
            group.appendChild(createSVG('line', {
                x1: ptSurf.x, y1: ptSurf.y, x2: ptLim.x, y2: ptLim.y,
                stroke: '#ef4444', 'stroke-width': 2
            }));
            
            group.appendChild(createSVG('circle', {
                cx: ptSurf.x, cy: ptSurf.y, r: 3, fill: '#ef4444'
            }));
        }
    }
    
    svgContainer.appendChild(group);
}

function drawHandles() {
    const { gridSize, zValues } = state;
    const group = createSVG('g', {});
    const map = (i) => (i / (gridSize-1)) * 2 - 1;

    for(let i=0; i<zValues.length; i++) {
        const r = Math.floor(i / gridSize);
        const c = i % gridSize;
        const z = zValues[i];
        
        const pt = project(map(c), map(r), z);
        
        // Heatmap color
        // Map Z relative to tolerance
        // Green = 0 deviation from mean, Red = high deviation
        // Simple scale:
        const color = '#ffffff'; // Handles are white for interaction
        const stroke = '#0f172a';
        
        const circle = createSVG('circle', {
            cx: pt.x, cy: pt.y, r: 5,
            fill: color, stroke: stroke, 'stroke-width': 1,
            class: 'cursor-ns-resize',
            'data-idx': i
        });
        
        circle.onmouseover = () => circle.setAttribute('fill', '#f59e0b');
        circle.onmouseout = () => circle.setAttribute('fill', 'white');
        
        group.appendChild(circle);
    }
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { peak, valley, error, isPass } = state.stats;
    const { toleranceWidth } = state;
    
    const panelBg = '#0f172a'; 
    const accent = isPass ? '#22c55e' : '#ef4444'; 
    
    const group = createSVG('g', {});
    const bx = 20, by = 20, bw = 380, bh = 240;
    
    group.appendChild(createSVG('rect', {
        x: bx, y: by, width: bw, height: bh,
        fill: panelBg, stroke: accent, 'stroke-width': 2
    }));

    const addText = (txt, x, y, size, color, weight='bold') => {
        const t = createSVG('text', { x, y, fill: color, 'font-family': 'JetBrains Mono', 'font-size': size, 'font-weight': weight });
        t.textContent = txt;
        return t;
    };

    group.appendChild(addText('FLATNESS TOPOGRAPHY', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    // Stats
    group.appendChild(addText('HIGHEST PEAK:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(peak.toFixed(4)+'"', col2, by+80, 14, '#ef4444'));
    
    group.appendChild(addText('LOWEST VALLEY:', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(valley.toFixed(4)+'"', col2, by+105, 14, '#3b82f6'));

    group.appendChild(createSVG('line', { x1: col1, y1: by+115, x2: col2+60, y2: by+115, stroke: '#334155', 'stroke-dasharray': '2,2' }));

    group.appendChild(addText('TOTAL FLATNESS:', col1, by+135, 14, '#cbd5e1'));
    group.appendChild(addText(error.toFixed(4)+'"', col2, by+135, 16, accent));
    
    group.appendChild(addText('TOLERANCE:', col1, by+155, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceWidth.toFixed(4)+'"', col2, by+155, 14, 'white'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Visual Bar
    const barY = by + 190;
    const barW = 340;
    const maxScale = toleranceWidth * 1.5;
    
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 12, fill: '#1e293b', rx: 6 }));
    
    const limitPix = (toleranceWidth / maxScale) * barW;
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+17, stroke: 'white', 'stroke-width': 2 }));
    
    const fillPix = Math.min(barW, (error / maxScale) * barW);
    group.appendChild(createSVG('rect', { x: bx+20, y: barY+2, width: fillPix, height: 8, fill: accent, rx: 4 }));

    svgContainer.appendChild(group);
}

function drawGuideOverlay() {
    const bg = createSVG('rect', {
        x: 0, y: 0, width: 1000, height: 800,
        fill: 'rgba(15, 23, 42, 0.95)'
    });
    svgContainer.appendChild(bg);

    const group = createSVG('g', {});
    let yPos = 180;
    const write = (text, size=20, color='white', weight='normal') => {
        const t = createSVG('text', { x: 500, y: yPos, fill: color, 'font-family': 'sans-serif', 'font-size': size, 'font-weight': weight, 'text-anchor': 'middle' });
        t.textContent = text;
        group.appendChild(t);
        yPos += (size * 1.6);
    };

    write("TOOL GUIDE: FLATNESS", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. 3D VISUALIZATION", 24, '#6366f1', 'bold');
    write("Flatness is a surface control, viewed here as a 3D Mesh.", 18, '#cbd5e1');
    write("The 'Sandwich' consists of two parallel blue planes.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. PEAK TO VALLEY", 24, '#6366f1', 'bold');
    write("Flatness Error = Height difference between highest and lowest point.", 18, '#cbd5e1');
    write("Datums do not apply. The zone floats to fit the surface.", 18, '#f59e0b');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Drag the white points up/down to create 'Bow' or 'Twist'.", 18, '#cbd5e1');
    write("Red lines appear if points poke through the blue planes.", 18, '#cbd5e1');
    
    yPos += 40;
    write("[ CLICK TO CLOSE ]", 16, '#94a3b8');

    const overlay = createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: 'transparent', class: 'cursor-pointer' });
    overlay.addEventListener('click', () => {
        state.showGuide = false;
        renderScene();
    });

    svgContainer.appendChild(group);
    svgContainer.appendChild(overlay);
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
        if(state.showGuide) return; 
        const target = evt.target;
        if (target.dataset.idx) {
            state.activeHandleIdx = parseInt(target.dataset.idx);
            state.dragStartY = getMousePos(evt).y;
            state.dragStartZ = state.zValues[state.activeHandleIdx];
            svg.style.cursor = 'ns-resize'; 
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (state.activeHandleIdx === -1) return;
        
        const m = getMousePos(evt);
        // Dragging Y pixels affects Z inches
        const dy = m.y - state.dragStartY;
        // Sensitivity
        const sensitivity = 0.0002; 
        // Move mouse down (+Y) -> Surface goes down (-Z)
        const newZ = state.dragStartZ - (dy * sensitivity);
        
        state.zValues[state.activeHandleIdx] = newZ;
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
                    <span class="text-3xl" style="transform: skew(-15deg);">⏥</span>
                </div>
                <div class="px-3 py-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
            </div>
            <p class="text-xs text-slate-400 mt-2 italic">*No Datum References</p>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Surface Presets</h4>
            
            <div class="grid grid-cols-2 gap-2 mb-4">
                <button id="btn-flat" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">PERFECT</button>
                <button id="btn-bowl" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">BOWL (CONCAVE)</button>
                <button id="btn-hill" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">HILL (CONVEX)</button>
                <button id="btn-twist" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">TWIST (SADDLE)</button>
                <button id="btn-random" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">RANDOM</button>
            </div>
            
            <div class="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 leading-relaxed">
                 <i class="fa-solid fa-mouse-pointer"></i> <strong>Interactive:</strong> Drag points on the 3D mesh to deform the plate.
            </div>
        </div>
        
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">View Zoom</h4>
            <input type="range" id="ctrl-zoom" min="2000" max="8000" step="100" value="${state.zScale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputZoom = document.getElementById('ctrl-zoom');
    const btnGuide = document.getElementById('btn-guide');
    
    inputTol.oninput = (e) => { state.toleranceWidth = parseFloat(e.target.value) || 0; renderScene(); };
    inputZoom.oninput = (e) => { state.zScale = parseFloat(e.target.value); renderScene(); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const setGrid = (fn) => {
        for(let i=0; i<25; i++) {
            const r = Math.floor(i/5);
            const c = i%5;
            state.zValues[i] = fn(r,c);
        }
        renderScene();
    };

    document.getElementById('btn-flat').onclick = () => setGrid(() => 0);
    document.getElementById('btn-bowl').onclick = () => setGrid((r,c) => {
        // Distance from center (2,2)
        const d = Math.sqrt((r-2)**2 + (c-2)**2);
        return 0.003 * d;
    });
    document.getElementById('btn-hill').onclick = () => setGrid((r,c) => {
        const d = Math.sqrt((r-2)**2 + (c-2)**2);
        return 0.003 * (2 - d);
    });
    document.getElementById('btn-twist').onclick = () => setGrid((r,c) => {
        return 0.002 * (r-2) * (c-2);
    });
    document.getElementById('btn-random').onclick = () => setGrid(() => (Math.random() * 0.01) - 0.005);
}