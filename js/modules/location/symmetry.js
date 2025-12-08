// js/modules/location/symmetry.js

import { createSVG } from '../../drawing_utils.js';

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

    // 6. The HUD
    drawFuturisticHUD();

    // 7. Guide Overlay
    if (state.showGuide) {
        drawGuideOverlay();
    }

    // 8. Sync UI
    updateReadouts();
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const { center, scale } = state;
    const gridSize = 0.010 * scale; 
    
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
        fill: '#1e293b', 'font-family': 'JetBrains Mono', 'font-weight': '900', 'font-size': '20' 
    };
    
    // Top Label
    const labelTop = createSVG('text', { x: center.x + 15, y: 40, ...textStyle });
    labelTop.textContent = "DATUM CENTER PLANE A";

    // Bottom Anchor Symbol
    const bottomY = 750;
    group.appendChild(createSVG('line', { x1: center.x - 20, y1: bottomY, x2: center.x + 20, y2: bottomY }));
    group.appendChild(createSVG('line', { x1: center.x, y1: bottomY, x2: center.x, y2: bottomY - 20 }));
    const labelBot = createSVG('text', { x: center.x - 5, y: bottomY - 25, ...textStyle });
    labelBot.textContent = "A";

    group.appendChild(labelTop);
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
        x: center.x, y: dimY - 10,
        fill: '#2563eb', 'font-family': 'JetBrains Mono', 'font-size': '14', 'font-weight': 'bold', 'text-anchor': 'middle'
    });
    label.textContent = `Tol Zone: ${toleranceWidth.toFixed(3)}"`;

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
        x: centerX, y: dimY - 10,
        fill: '#1e293b', 'font-family': 'sans-serif', 'font-size': '16', 'font-weight': 'bold', 'text-anchor': 'middle'
    });
    widthText.textContent = `${slotWidth.toFixed(3)}"`;
    
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
        x: centerX, y: 170,
        fill: planeColor, 'font-family': 'JetBrains Mono', 'font-size': '14', 'font-weight': 'bold', 'text-anchor': 'middle'
    });
    label.textContent = "DERIVED MEDIAN PLANE";
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

function drawFuturisticHUD() {
    const { deviation, toleranceWidth } = state;
    
    const limit = toleranceWidth / 2;
    const isPass = Math.abs(deviation) <= limit;
    
    const panelBg = '#0f172a'; 
    const accent = isPass ? '#22c55e' : '#ef4444'; 
    
    const group = createSVG('g', {});
    
    // Background Box
    const bx = 20, by = 20, bw = 400, bh = 220;
    group.appendChild(createSVG('rect', {
        x: bx, y: by, width: bw, height: bh,
        fill: panelBg, stroke: accent, 'stroke-width': 2
    }));

    const addText = (txt, x, y, size, color, weight='bold') => {
        const t = createSVG('text', { x, y, fill: color, 'font-family': 'JetBrains Mono', 'font-size': size, 'font-weight': weight });
        t.textContent = txt;
        return t;
    };

    // Header
    group.appendChild(addText('SYMMETRY ANALYSIS', bx+20, by+35, 20, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    // Data
    const col1 = bx+20;
    const col2 = bx+260;
    
    group.appendChild(addText('DATUM CENTER:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText('0.0000"', col2, by+80, 14, '#cbd5e1'));
    
    group.appendChild(addText('MEDIAN OFFSET:', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(Math.abs(deviation).toFixed(4)+'"', col2, by+105, 14, accent));

    group.appendChild(addText('ALLOWABLE OFFSET:', col1, by+130, 14, '#cbd5e1'));
    group.appendChild(addText((toleranceWidth/2).toFixed(4)+'"', col2, by+130, 14, '#white'));

    // Status
    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Visual Bar
    const barY = by + 170;
    const barW = 360;
    const maxVal = limit * 2; // Scale bar range
    const centerBar = bx + 20 + (barW/2);
    
    // Draw Center Line of Bar
    group.appendChild(createSVG('line', { x1: centerBar, y1: barY-10, x2: centerBar, y2: barY+25, stroke: '#64748b' }));

    // Draw Deviation Indicator
    const pixOffset = (deviation / maxVal) * barW;
    const markerX = centerBar + pixOffset;
    
    // Marker
    group.appendChild(createSVG('polygon', {
        points: `${markerX},${barY} ${markerX-6},${barY-10} ${markerX+6},${barY-10}`,
        fill: accent
    }));
    
    // Bar Track
    group.appendChild(createSVG('rect', {
        x: bx+20, y: barY, width: barW, height: 8, fill: '#1e293b', rx: 4
    }));
    // Tolerance Range on Bar (The "Green Zone")
    const tolPix = (toleranceWidth / maxVal) * barW;
    group.appendChild(createSVG('rect', {
        x: centerBar - (tolPix/2), y: barY+2, width: tolPix, height: 4, fill: '#22c55e', opacity: 0.5
    }));
    
    // Actual Dot
    group.appendChild(createSVG('circle', { cx: markerX, cy: barY+4, r: 6, fill: accent, stroke: 'white' }));

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

    write("TOOL GUIDE: SYMMETRY", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. THE GEOMETRY", 24, '#6366f1', 'bold');
    write("Symmetry applies to 'Opposed Elements' (like this slot).", 18, '#cbd5e1');
    write("It does not check the walls directly; it checks their MIDPOINTS.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. THE MEDIAN PLANE", 24, '#6366f1', 'bold');
    write("The dashed line is the Derived Median Plane.", 18, '#cbd5e1');
    write("It is calculated by averaging the Left and Right wall positions.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. PASS / FAIL", 24, '#6366f1', 'bold');
    write("The Median Plane must stay within the Blue Tolerance Zone.", 18, '#cbd5e1');
    write("Drag the slot left/right to see the Median Plane shift.", 18, '#cbd5e1');
    
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
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400 flex-1 text-center">A</div>
            </div>
            
             <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Median Plane Offset (in)</h4>
            <div class="flex items-center gap-2 mb-2">
                <label class="w-16 text-xs font-bold text-slate-500">SHIFT</label>
                <input type="number" id="ctrl-dev" step="0.001" value="${state.deviation.toFixed(4)}"
                    class="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <input type="range" id="slide-dev" min="-0.03" max="0.03" step="0.001" value="${state.deviation}" 
                class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
            
            <div class="mt-4 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-slate-500">ZOOM LEVEL</span>
                </div>
                <input type="range" id="ctrl-zoom" min="1000" max="3000" step="100" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Settings</h4>
            <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-semibold text-slate-700">Slot Width (in)</label>
                <input type="number" id="ctrl-width" value="${state.slotWidth}" step="0.010"
                    class="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono">
            </div>

            <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-scale-balanced"></i> Application</div>
                <div class="text-xs opacity-90 leading-relaxed">
                    Symmetry is used to center features (like slots, tabs, or keys) relative to a Datum Plane. It is sensitive to form errors and center deviation.
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
    const btnGuide = document.getElementById('btn-guide');

    inputTol.oninput = (e) => { state.toleranceWidth = parseFloat(e.target.value) || 0; renderScene(); };
    
    const updateDev = (val) => {
        state.deviation = parseFloat(val) || 0;
        if(inputDev) inputDev.value = state.deviation.toFixed(4);
        if(slideDev) slideDev.value = state.deviation;
        renderScene();
    };

    inputDev.oninput = (e) => updateDev(e.target.value);
    slideDev.oninput = (e) => updateDev(e.target.value);

    inputWidth.oninput = (e) => { state.slotWidth = parseFloat(e.target.value) || 0.1; renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };
    
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }
}

function updateReadouts() {
    if (state.isDragging) {
        const inputDev = document.getElementById('ctrl-dev');
        const slideDev = document.getElementById('slide-dev');
        if(inputDev) inputDev.value = state.deviation.toFixed(4);
        if(slideDev) slideDev.value = state.deviation;
    }
}