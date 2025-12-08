// js/modules/orientation/perpendicularity.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 600 }, // Datum A anchor point
    
    // Engineering Parameters (INCHES)
    scale: 2000,           // Zoom level
    toleranceWidth: 0.015, // Total width of tolerance zone
    featureHeight: 0.300,  // Height of the surface being checked
    topDeviation: 0.005,   // Linear offset at the top (The Tilt)
    
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

    // 2. Datum A (The Ground)
    drawDatumPlane();

    // 3. The Tolerance Zone (Vertical Parallel Planes)
    drawToleranceZone();

    // 4. The Part (The Tilted Block)
    drawPartFeature();

    // 5. Analysis Lines (Tangent planes)
    drawAnalysisVisuals();

    // 6. HUD
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
    
    // Draw grid relative to center
    for (let x = center.x % gridSize; x < 1000; x += gridSize) {
        group.appendChild(createSVG('line', { x1: x, y1: 0, x2: x, y2: 800 }));
    }
    for (let y = center.y % gridSize; y < 800; y += gridSize) {
        group.appendChild(createSVG('line', { x1: 0, y1: y, x2: 1000, y2: y }));
    }
    svgContainer.appendChild(group);
}

function drawDatumPlane() {
    const { center } = state;
    const group = createSVG('g', { stroke: '#1e293b', 'stroke-width': 2 }); 

    // Datum Line (The Floor)
    const floorY = center.y;
    group.appendChild(createSVG('line', { 
        x1: 0, y1: floorY, x2: 1000, y2: floorY, 'stroke-width': 4
    }));
    
    // Hash marks for "Ground" symbol
    for(let i=0; i<1000; i+=20) {
        group.appendChild(createSVG('line', { 
            x1: i, y1: floorY, x2: i-10, y2: floorY+10, 'stroke-width': 1, stroke: '#94a3b8' 
        }));
    }

    // Datum Label
    const textStyle = { 
        fill: '#1e293b', 'font-family': 'JetBrains Mono', 'font-weight': '900', 'font-size': '20' 
    };
    const label = createSVG('text', { x: 50, y: floorY - 15, ...textStyle });
    label.textContent = "DATUM PLANE A";

    // Symbol box
    const symX = center.x;
    const symY = floorY + 60;
    group.appendChild(createSVG('line', { x1: symX, y1: floorY, x2: symX, y2: symY, stroke: '#1e293b' }));
    group.appendChild(createSVG('rect', { x: symX-15, y: symY, width: 30, height: 25, fill: 'white', stroke: '#1e293b' }));
    const symText = createSVG('text', { x: symX, y: symY+18, 'text-anchor': 'middle', ...textStyle, 'font-size': '18' });
    symText.textContent = "A";

    group.appendChild(label);
    group.appendChild(symText);
    svgContainer.appendChild(group);
}

function drawToleranceZone() {
    const { center, scale, toleranceWidth, featureHeight } = state;
    const halfTol = (toleranceWidth / 2) * scale;
    const h = featureHeight * scale;

    const group = createSVG('g', {});

    // Zone Boundaries (Two vertical lines)
    const x1 = center.x - halfTol;
    const x2 = center.x + halfTol;
    const topY = center.y - h - 50; // Extend slightly above part

    // Left Limit
    group.appendChild(createSVG('line', {
        x1: x1, y1: center.y, x2: x1, y2: topY,
        stroke: '#2563eb', 'stroke-width': 3, 'stroke-dasharray': '15, 5'
    }));

    // Right Limit
    group.appendChild(createSVG('line', {
        x1: x2, y1: center.y, x2: x2, y2: topY,
        stroke: '#2563eb', 'stroke-width': 3, 'stroke-dasharray': '15, 5'
    }));

    // Zone Fill
    group.appendChild(createSVG('rect', {
        x: x1, y: topY, width: x2 - x1, height: (center.y - topY),
        fill: 'rgba(37, 99, 235, 0.05)', stroke: 'none'
    }));

    // Dimension Arrow
    const dimY = topY - 20;
    const arrowGroup = createSVG('g', { stroke: '#2563eb', 'stroke-width': 1 });
    arrowGroup.appendChild(createSVG('line', { x1: x1, y1: dimY, x2: x2, y2: dimY, 'marker-end': 'url(#arrow)', 'marker-start': 'url(#arrow)' }));
    
    const label = createSVG('text', {
        x: center.x, y: dimY - 10,
        fill: '#2563eb', 'font-family': 'JetBrains Mono', 'font-size': '16', 'font-weight': 'bold', 'text-anchor': 'middle'
    });
    label.textContent = `Tol Zone: ${toleranceWidth.toFixed(3)}"`;

    group.appendChild(arrowGroup);
    group.appendChild(label);
    svgContainer.appendChild(group);
}

function drawPartFeature() {
    const { center, scale, topDeviation, featureHeight, toleranceWidth } = state;
    
    const h = featureHeight * scale;
    // Calculate the pivot
    // The part pivots at the bottom center (center.x, center.y)
    // Top coordinate
    const topX = center.x + (topDeviation * scale);
    const topY = center.y - h;

    // Check Pass/Fail based on if the 'surface' stays in the zone
    // For a straight line pivoted at center, we check the Top X and Bottom X.
    // However, usually we center the zone on the feature. 
    // Simplified model: Zone is fixed, Feature tilts.
    const isPass = Math.abs(topDeviation) <= (toleranceWidth / 2);
    
    const color = isPass ? '#475569' : '#dc2626'; // Slate or Red
    const fillColor = isPass ? '#cbd5e1' : '#fecaca';

    const group = createSVG('g', { class: 'cursor-move', id: 'draggable-part' });

    // Draw a Block that tilts
    // We construct a path for the polygon
    const width = 150; // visual width of block
    
    // Bottom coordinates (Fixed)
    const bR = { x: center.x, y: center.y }; // Bottom Right (The Controlled Surface Base)
    const bL = { x: center.x - width, y: center.y }; // Bottom Left
    
    // Top coordinates (Shifted by deviation)
    const tR = { x: topX, y: topY }; // Top Right (Controlled Surface Top)
    const tL = { x: topX - width, y: topY }; // Top Left

    const pathData = `M ${bL.x},${bL.y} L ${bR.x},${bR.y} L ${tR.x},${tR.y} L ${tL.x},${tL.y} Z`;

    group.appendChild(createSVG('path', {
        d: pathData,
        fill: fillColor, stroke: color, 'stroke-width': 3
    }));

    // Highlight the "Controlled Surface" (The Right Face)
    group.appendChild(createSVG('line', {
        x1: bR.x, y1: bR.y, x2: tR.x, y2: tR.y,
        stroke: isPass ? '#10b981' : '#ef4444', 'stroke-width': 6
    }));

    // Drag Handle (Top Right Corner)
    group.appendChild(createSVG('circle', {
        cx: tR.x, cy: tR.y, r: 8, fill: 'white', stroke: '#0f172a', 'stroke-width': 2
    }));

    // Angle indicator arc
    if (Math.abs(topDeviation) > 0.001) {
        const angleRad = Math.atan2(topDeviation, featureHeight);
        const angleDeg = angleRad * (180/Math.PI);
        
        const label = createSVG('text', {
            x: center.x - 40, y: center.y - 40,
            fill: '#64748b', 'font-family': 'sans-serif', 'font-size': '12', 'font-weight': 'bold'
        });
        label.textContent = `${angleDeg.toFixed(1)}°`;
        group.appendChild(label);
    }

    svgContainer.appendChild(group);
}

function drawAnalysisVisuals() {
    const { center, scale, featureHeight } = state;
    const h = featureHeight * scale;
    
    const group = createSVG('g', { opacity: 0.5 });

    // "Perfect 90" Reference Line (Ghost)
    group.appendChild(createSVG('line', {
        x1: center.x, y1: center.y, x2: center.x, y2: center.y - h,
        stroke: '#0f172a', 'stroke-width': 1, 'stroke-dasharray': '2,2'
    }));

    // Square Symbol at bottom
    group.appendChild(createSVG('polyline', {
        points: `${center.x},${center.y-20} ${center.x-20},${center.y-20} ${center.x-20},${center.y}`,
        fill: 'none', stroke: '#0f172a', 'stroke-width': 1
    }));

    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { topDeviation, toleranceWidth, featureHeight } = state;
    
    // Logic: The deviation is defined by the distance between two parallel planes.
    // If pivoted at bottom, the deviation is simply the absolute x-offset of the top.
    const actualDev = Math.abs(topDeviation); 
    // In GD&T, the tolerance zone is width. So actual deviation is the width containing the surface.
    // Since our surface is a line from 0 to deviation, the width is |deviation|.
    // However, GD&T value is the full width of the zone used. 
    // Actual Value = topDeviation (if bottom is at 0).
    
    const limit = toleranceWidth; // The surface must lie within a zone of this width.
    // If the part is centered in the zone, we allow deviation +/- width/2.
    // But the Resultant Value reported in inspection is typically the minimum zone width that contains the feature.
    // If feature tilts by X, it fits in a zone of width X.
    
    const isPass = actualDev <= limit; // Wait, actually standard interpretation:
    // If tolerance is 0.010, the zone is 0.010 wide.
    // If the part tilts 0.006 relative to vertical, does it fit? 
    // If we can shift the zone, yes.
    // But in this visualization, we fixed the zone center. 
    // For simplicity: Pass if (Abs(Dev) * 2) <= Tolerance? NO.
    // Correct: The feature must fit between two planes t apart.
    // Since the feature is a straight line, it fits in a zone of width = (TopX - BottomX).
    // So Actual Value = Abs(topDeviation).
    // Limit = toleranceWidth.

    const passCheck = actualDev <= toleranceWidth;

    const panelBg = '#0f172a'; 
    const accent = passCheck ? '#22c55e' : '#ef4444'; 
    
    const group = createSVG('g', {});
    
    // HUD Box
    const bx = 20, by = 20, bw = 380, bh = 220;
    group.appendChild(createSVG('rect', {
        x: bx, y: by, width: bw, height: bh,
        fill: panelBg, stroke: accent, 'stroke-width': 2
    }));

    const addText = (txt, x, y, size, color, weight='bold') => {
        const t = createSVG('text', { x, y, fill: color, 'font-family': 'JetBrains Mono', 'font-size': size, 'font-weight': weight });
        t.textContent = txt;
        return t;
    };

    group.appendChild(addText('PERPENDICULARITY CHECK', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    // Calculate Angle
    const angleRad = Math.atan2(actualDev, featureHeight);
    const angleDeg = angleRad * (180/Math.PI);

    group.appendChild(addText('TILT ANGLE:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(angleDeg.toFixed(3)+'°', col2, by+80, 14, '#cbd5e1'));
    
    group.appendChild(addText('LINEAR DEV (H):', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(actualDev.toFixed(4)+'"', col2, by+105, 14, accent));

    group.appendChild(addText('MAX TOLERANCE:', col1, by+130, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceWidth.toFixed(4)+'"', col2, by+130, 14, 'white'));

    // Status
    const statusText = passCheck ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Graphic Bar
    const barY = by + 170;
    const barW = 340;
    const maxScale = toleranceWidth * 1.5;
    
    // Bar Background
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 10, fill: '#1e293b', rx: 5 }));
    
    // Tolerance Zone Marker on Bar
    const limitPix = (toleranceWidth / maxScale) * barW;
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: limitPix, height: 10, fill: '#334155', rx: 5 }));
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+15, stroke: 'white' }));
    
    // Actual Value Bar
    const valPix = Math.min(barW, (actualDev / maxScale) * barW);
    group.appendChild(createSVG('rect', { 
        x: bx+20, y: barY+3, width: valPix, height: 4, 
        fill: accent 
    }));

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

    write("TOOL GUIDE: PERPENDICULARITY", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. DEFINITION", 24, '#6366f1', 'bold');
    write("Controls how close a surface is to 90° relative to a Datum.", 18, '#cbd5e1');
    write("The tolerance is a WIDTH (in inches/mm), not an angle (degrees).", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. TOLERANCE ZONE", 24, '#6366f1', 'bold');
    write("The two vertical blue dashed lines form the Zone.", 18, '#cbd5e1');
    write("The ENTIRE controlled surface (the right edge) must fit inside.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. HOW TO USE", 24, '#6366f1', 'bold');
    write("Drag the top of the block left/right to tilt it.", 18, '#cbd5e1');
    write("Watch the Linear Deviation value. If it exceeds Tolerance, you Fail.", 18, '#cbd5e1');
    
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
        const { center, scale, topDeviation, featureHeight } = state;
        const topX = center.x + (topDeviation * scale);
        const topY = center.y - (featureHeight * scale);
        
        // Hit box around the top corner handle
        const dist = Math.sqrt((m.x - topX)**2 + (m.y - topY)**2);
        
        if (dist < 60) {
            state.isDragging = true;
            svg.style.cursor = 'ew-resize'; 
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        
        const m = getMousePos(evt);
        const { center, scale } = state;

        // Calculate new deviation based on horizontal mouse movement relative to base
        state.topDeviation = (m.x - center.x) / scale;
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
                    <span class="text-3xl">⊥</span>
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
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Tilt Deviation (in)</h4>
            <div class="flex items-center gap-2 mb-2">
                <label class="w-16 text-xs font-bold text-slate-500">OFFSET</label>
                <input type="number" id="ctrl-dev" step="0.001" value="${state.topDeviation.toFixed(4)}"
                    class="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <input type="range" id="slide-dev" min="-0.03" max="0.03" step="0.001" value="${state.topDeviation}" 
                class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
            
            <div class="mt-4 pt-4 border-t border-slate-100">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-slate-500">ZOOM LEVEL</span>
                </div>
                <input type="range" id="ctrl-zoom" min="1000" max="3000" step="100" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Part Geometry</h4>
            <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-semibold text-slate-700">Surface Height (in)</label>
                <input type="number" id="ctrl-height" value="${state.featureHeight}" step="0.010"
                    class="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono">
            </div>

            <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-ruler-vertical"></i> Engineering Note</div>
                <div class="text-xs opacity-90 leading-relaxed">
                    Perpendicularity is a specific form of Angularity (at 90°). The tolerance zone floats to contain the feature, but is always oriented 90° to the datum.
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
    const btnGuide = document.getElementById('btn-guide');

    inputTol.oninput = (e) => { state.toleranceWidth = parseFloat(e.target.value) || 0; renderScene(); };
    
    const updateDev = (val) => {
        state.topDeviation = parseFloat(val) || 0;
        if(inputDev) inputDev.value = state.topDeviation.toFixed(4);
        if(slideDev) slideDev.value = state.topDeviation;
        renderScene();
    };

    inputDev.oninput = (e) => updateDev(e.target.value);
    slideDev.oninput = (e) => updateDev(e.target.value);

    inputHeight.oninput = (e) => { state.featureHeight = parseFloat(e.target.value) || 0.1; renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };
    
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }
}

function updateReadouts() {
    if (state.isDragging) {
        const inputDev = document.getElementById('ctrl-dev');
        const slideDev = document.getElementById('slide-dev');
        if(inputDev) inputDev.value = state.topDeviation.toFixed(4);
        if(slideDev) slideDev.value = state.topDeviation;
    }
}