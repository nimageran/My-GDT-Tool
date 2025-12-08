// js/modules/profile/surface_profile.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    
    // 3D Projection Settings (Isometric-ish)
    isoCenter: { x: 500, y: 300 },
    isoScaleX: 200, // Width of grid cells
    isoScaleY: 100, // Height/Depth of grid cells
    zScale: 5000,   // Vertical amplification for deviations
    
    // Engineering Parameters (INCHES)
    toleranceWidth: 0.030, // Total zone width
    
    // Surface Data: 4x4 Grid (16 points)
    // Flattened array of Z-offsets (deviations)
    // Grid Indices: 
    // 0  1  2  3
    // 4  5  6  7 ...
    gridSize: 4, // 4 points per side (3 cells)
    zValues: new Array(16).fill(0.000),
    
    // UI State
    activeHandleIdx: -1,
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

// --- MATH HELPERS (3D PROJECTION) ---

// Convert Grid (row, col) and Z-deviation to Screen (x, y)
function project(row, col, zDev) {
    const { isoCenter, isoScaleX, isoScaleY, zScale, gridSize } = state;
    
    // Center the grid around (0,0) in world space
    const offset = (gridSize - 1) / 2;
    const x = col - offset;
    const y = row - offset;
    
    // Isometric projection math
    // Screen X = worldX - worldY
    // Screen Y = worldX + worldY - worldZ
    
    const screenX = isoCenter.x + (x - y) * isoScaleX * 0.5;
    const screenY = isoCenter.y + (x + y) * isoScaleY * 0.5 - (zDev * zScale);
    
    return { x: screenX, y: screenY };
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    // 1. Defs (Gradients/Filters)
    drawDefs();

    // 2. Tolerance Boundaries (Transparent Planes)
    drawTolerancePlanes();

    // 3. The Surface Mesh (Wireframe)
    drawSurfaceMesh();

    // 4. Deviation Vectors (Whiskers)
    drawWhiskers();

    // 5. Interactive Handles
    drawHandles();

    // 6. HUD
    drawFuturisticHUD();

    // 7. Guide
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawDefs() {
    const defs = createSVG('defs', {});
    
    // Gradient for the Tolerance Planes
    const grad = createSVG('linearGradient', { id: 'zoneGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    grad.appendChild(createSVG('stop', { offset: '0%', 'stop-color': '#3b82f6', 'stop-opacity': '0.1' }));
    grad.appendChild(createSVG('stop', { offset: '100%', 'stop-color': '#2563eb', 'stop-opacity': '0.3' }));
    
    defs.appendChild(grad);
    svgContainer.appendChild(defs);
}

function drawTolerancePlanes() {
    const { gridSize, toleranceWidth } = state;
    const halfTol = toleranceWidth / 2;
    
    const group = createSVG('g', {});

    const drawPlane = (zVal, colorStr, isDashed) => {
        // 4 Corners
        const c1 = project(0, 0, zVal);
        const c2 = project(0, gridSize-1, zVal);
        const c3 = project(gridSize-1, gridSize-1, zVal);
        const c4 = project(gridSize-1, 0, zVal);
        
        const d = `M ${c1.x},${c1.y} L ${c2.x},${c2.y} L ${c3.x},${c3.y} L ${c4.x},${c4.y} Z`;
        
        group.appendChild(createSVG('path', {
            d: d,
            fill: 'url(#zoneGrad)',
            stroke: colorStr,
            'stroke-width': 1,
            'stroke-dasharray': isDashed ? '5,5' : 'none'
        }));
    };

    // Lower Boundary
    drawPlane(-halfTol, '#3b82f6', true);
    // Upper Boundary
    drawPlane(halfTol, '#3b82f6', true);
    
    // Neutral Plane (Zero) - Reference grid
    const n1 = project(0, 0, 0);
    const n3 = project(gridSize-1, gridSize-1, 0);
    // Just draw a faint cross through center
    group.appendChild(createSVG('line', { x1: n1.x, y1: n1.y, x2: n3.x, y2: n3.y, stroke: '#cbd5e1', 'stroke-width': 1 }));

    svgContainer.appendChild(group);
}

function drawSurfaceMesh() {
    const { gridSize, zValues, toleranceWidth } = state;
    const limit = toleranceWidth / 2;
    const group = createSVG('g', {});

    // We draw lines connecting rows and cols
    // Horizontal lines (along cols)
    for (let r = 0; r < gridSize; r++) {
        let pathD = "";
        for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            const pt = project(r, c, zValues[idx]);
            pathD += (c === 0 ? "M" : "L") + ` ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        }
        
        // Color logic: If whole row is good, green, else red? 
        // Better: Segment by segment coloring requires splitting paths.
        // Simplification: Entire row stroke based on worst point in row.
        const rowVals = zValues.slice(r*gridSize, r*gridSize + gridSize);
        const maxRowErr = Math.max(...rowVals.map(Math.abs));
        const color = maxRowErr <= limit ? '#10b981' : '#ef4444';
        
        group.appendChild(createSVG('path', {
            d: pathD, fill: 'none', stroke: color, 'stroke-width': 3
        }));
    }

    // Vertical lines (along rows)
    for (let c = 0; c < gridSize; c++) {
        let pathD = "";
        let colErr = 0;
        for (let r = 0; r < gridSize; r++) {
            const idx = r * gridSize + c;
            const pt = project(r, c, zValues[idx]);
            pathD += (r === 0 ? "M" : "L") + ` ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
            colErr = Math.max(colErr, Math.abs(zValues[idx]));
        }
        
        const color = colErr <= limit ? '#10b981' : '#ef4444';
        group.appendChild(createSVG('path', {
            d: pathD, fill: 'none', stroke: color, 'stroke-width': 3
        }));
    }

    svgContainer.appendChild(group);
}

function drawWhiskers() {
    const { gridSize, zValues } = state;
    const group = createSVG('g', {});

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            const z = zValues[idx];
            
            if (Math.abs(z) > 0.001) {
                // Point on Surface
                const surfPt = project(r, c, z);
                // Point on Neutral Plane
                const flatPt = project(r, c, 0);
                
                group.appendChild(createSVG('line', {
                    x1: surfPt.x, y1: surfPt.y, 
                    x2: flatPt.x, y2: flatPt.y,
                    stroke: '#64748b', 'stroke-width': 1, 'stroke-dasharray': '2,2'
                }));
            }
        }
    }
    svgContainer.appendChild(group);
}

function drawHandles() {
    const { gridSize, zValues } = state;
    const group = createSVG('g', {});

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const idx = r * gridSize + c;
            const pt = project(r, c, zValues[idx]);
            
            const circle = createSVG('circle', {
                cx: pt.x, cy: pt.y, r: 6,
                fill: 'white', stroke: '#0f172a', 'stroke-width': 2,
                class: 'cursor-ns-resize',
                'data-idx': idx
            });

            // Hover
            circle.onmouseover = () => circle.setAttribute('fill', '#f59e0b');
            circle.onmouseout = () => circle.setAttribute('fill', 'white');
            
            group.appendChild(circle);
        }
    }
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const maxDev = Math.max(...state.zValues.map(Math.abs));
    const { toleranceWidth } = state;
    const limit = toleranceWidth / 2;
    const isPass = maxDev <= limit;
    
    const panelBg = '#0f172a'; 
    const accent = isPass ? '#22c55e' : '#ef4444'; 
    
    const group = createSVG('g', {});
    
    // Panel Box
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

    group.appendChild(addText('SURFACE PROFILE SCAN', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('PEAK DEVIATION:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(maxDev.toFixed(4)+'"', col2, by+80, 14, accent));
    
    group.appendChild(addText('HALF-ZONE LIMIT:', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(limit.toFixed(4)+'"', col2, by+105, 14, 'white'));

    group.appendChild(addText('TOTAL TOLERANCE:', col1, by+130, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceWidth.toFixed(4)+'"', col2, by+130, 14, 'white'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // 3D Visualizer Bar
    const barY = by + 180;
    const barW = 340;
    
    // Grid representation in HUD
    const hudGridSize = 20;
    const startX = bx + 20;
    
    // Draw a mini grid representing the 16 points status
    state.zValues.forEach((z, i) => {
        const r = Math.floor(i / state.gridSize);
        const c = i % state.gridSize;
        
        const ptPass = Math.abs(z) <= limit;
        const color = ptPass ? '#22c55e' : '#ef4444';
        
        group.appendChild(createSVG('rect', {
            x: startX + (c * 30), 
            y: barY + (r * 10), 
            width: 25, height: 8,
            fill: color, rx: 2
        }));
    });
    
    group.appendChild(addText('POINT MAPPING', startX + 130, barY + 20, 12, '#64748b'));

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

    write("TOOL GUIDE: SURFACE PROFILE", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. 3D TOLERANCE", 24, '#6366f1', 'bold');
    write("Surface Profile controls the entire skin of the part.", 18, '#cbd5e1');
    write("The tolerance zone is a volumetric 'blanket' over the shape.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. VISUALIZATION", 24, '#6366f1', 'bold');
    write("The Transparent Blue Planes represent the Upper & Lower limits.", 18, '#cbd5e1');
    write("The Wireframe Mesh is the actual surface.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Drag the white points to deform the surface topography.", 18, '#cbd5e1');
    write("Red lines indicate the surface has broken out of the zone.", 18, '#cbd5e1');
    
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
        // Calculate Delta Y
        const dy = m.y - state.dragStartY;
        
        // Map pixel movement to Z-inch movement
        // Moving Mouse DOWN (positive Y) means Negative Z (down into screen)
        // Sensitivity: 100px = 0.020 inch
        const sensitivity = 0.020 / 100;
        
        let newZ = state.dragStartZ - (dy * sensitivity);
        
        // Clamp for sanity
        newZ = Math.max(-0.040, Math.min(0.040, newZ));
        
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
                    <span class="text-3xl">⌭</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-r-2 border-black bg-slate-100 text-slate-400">A</div>
                <div class="px-3 py-2 border-r-2 border-black bg-slate-100 text-slate-400">B</div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400">C</div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Surface Topography Presets</h4>
            
            <div class="grid grid-cols-2 gap-2 mb-4">
                <button id="btn-flat" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">FLAT</button>
                <button id="btn-bowl" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">BOWL</button>
                <button id="btn-dome" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">DOME</button>
                <button id="btn-saddle" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">SADDLE</button>
                <button id="btn-twist" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">TWIST</button>
                <button id="btn-random" class="preset-btn px-3 py-2 bg-slate-100 hover:bg-blue-50 text-xs font-bold rounded border">CHAOS</button>
            </div>
            
            <div class="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 leading-relaxed">
                <i class="fa-solid fa-mouse-pointer"></i> <strong>Interactive:</strong> Click and drag any white point on the grid to adjust the local Z-height manually.
            </div>
        </div>
        
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">View Distortion</h4>
             <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-500">Z-AMPLIFICATION</span>
            </div>
            <input type="range" id="ctrl-zscale" min="1000" max="8000" step="100" value="${state.zScale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputZ = document.getElementById('ctrl-zscale');
    const btnGuide = document.getElementById('btn-guide');
    
    inputTol.oninput = (e) => { state.toleranceWidth = parseFloat(e.target.value) || 0; renderScene(); };
    inputZ.oninput = (e) => { state.zScale = parseFloat(e.target.value); renderScene(); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const setGrid = (fn) => {
        for(let r=0; r<4; r++) {
            for(let c=0; c<4; c++) {
                state.zValues[r*4 + c] = fn(r, c);
            }
        }
        renderScene();
    };

    document.getElementById('btn-flat').onclick = () => setGrid(() => 0);
    document.getElementById('btn-bowl').onclick = () => setGrid((r,c) => {
        // Distance from center
        const dx = c - 1.5; const dy = r - 1.5;
        return -0.005 * (dx*dx + dy*dy);
    });
    document.getElementById('btn-dome').onclick = () => setGrid((r,c) => {
        const dx = c - 1.5; const dy = r - 1.5;
        return 0.005 * (dx*dx + dy*dy);
    });
    document.getElementById('btn-saddle').onclick = () => setGrid((r,c) => {
         const dx = c - 1.5; const dy = r - 1.5;
         return 0.005 * (dx*dx - dy*dy);
    });
    document.getElementById('btn-twist').onclick = () => setGrid((r,c) => {
         const dx = c - 1.5; const dy = r - 1.5;
         return 0.005 * (dx * dy);
    });
    document.getElementById('btn-random').onclick = () => setGrid(() => (Math.random() * 0.04) - 0.02);
}