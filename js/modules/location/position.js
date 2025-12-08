// js/modules/location/position.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas dimensions
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 2000,        // Zoom level
    toleranceDiam: 0.030, 
    holeDiam: 0.200,      
    deviationX: 0.008,    
    deviationY: 0.006,    
    
    // UI State
    isDragging: false,
    showGuide: false // New Toggle for Help Screen
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

    // 1. Engineering Grid (Background)
    drawGrid();

    // 2. Coordinate System (Datums)
    drawDatums();

    // 3. The Tolerance Zone (Boundary)
    drawToleranceZone();

    // 4. The Deviation Visuals (Triangulation & Dimensions)
    drawDeviationDetails();

    // 5. The Physical Feature (Hole)
    drawActualHole();

    // 6. The Futuristic HUD (Results)
    drawFuturisticHUD();

    // 7. The Guide Overlay (If active)
    if (state.showGuide) {
        drawGuideOverlay();
    }

    // 8. Sync Inputs
    updateReadouts();
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const { center, scale } = state;
    const gridSize = 0.010 * scale; 
    
    const group = createSVG('g', { stroke: '#e2e8f0', 'stroke-width': 1 });
    
    // Dynamic Grid generation based on viewport
    for (let x = center.x % gridSize; x < 1000; x += gridSize) {
        group.appendChild(createSVG('line', { x1: x, y1: 0, x2: x, y2: 800 }));
    }
    for (let y = center.y % gridSize; y < 800; y += gridSize) {
        group.appendChild(createSVG('line', { x1: 0, y1: y, x2: 1000, y2: y }));
    }
    
    // Quadrant Markers
    const quadStyle = { fill: '#cbd5e1', 'font-family': 'Impact, sans-serif', 'font-size': '60', 'opacity': '0.3' };
    const q1 = createSVG('text', { x: 900, y: 100, ...quadStyle }); q1.textContent = "+X, +Y";
    const q2 = createSVG('text', { x: 100, y: 100, ...quadStyle }); q2.textContent = "-X, +Y";
    group.appendChild(q1);
    group.appendChild(q2);

    svgContainer.appendChild(group);
}

function drawDatums() {
    const { center } = state;
    const group = createSVG('g', { stroke: '#334155', 'stroke-width': 2 }); 

    // Datum Lines
    group.appendChild(createSVG('line', { 
        x1: 0, y1: center.y, x2: 1000, y2: center.y, 'stroke-dasharray': '40, 10, 10, 10' 
    }));
    group.appendChild(createSVG('line', { 
        x1: center.x, y1: 0, x2: center.x, y2: 800, 'stroke-dasharray': '40, 10, 10, 10' 
    }));

    // Origin "Target"
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: center.y, r: 10, fill: 'none', stroke: '#334155', 'stroke-width': 2
    }));
    group.appendChild(createSVG('line', { x1: center.x-15, y1: center.y, x2: center.x+15, y2: center.y }));
    group.appendChild(createSVG('line', { x1: center.x, y1: center.y-15, x2: center.x, y2: center.y+15 }));

    // Axis Labels
    const textStyle = { 
        fill: '#1e293b', 'font-family': 'JetBrains Mono', 'font-weight': '900', 'font-size': '24' 
    };
    const labelX = createSVG('text', { x: 920, y: center.y - 15, ...textStyle });
    labelX.textContent = "DATUM B (X)";
    const labelY = createSVG('text', { x: center.x + 15, y: 40, ...textStyle });
    labelY.textContent = "DATUM C (Y)";

    group.appendChild(labelX);
    group.appendChild(labelY);
    svgContainer.appendChild(group);
}

function drawToleranceZone() {
    const { center, scale, toleranceDiam } = state;
    const r = (toleranceDiam / 2) * scale; 

    const group = createSVG('g', {});

    // Zone Circle
    const zone = createSVG('circle', {
        cx: center.x, cy: center.y, r: r,
        fill: 'rgba(37, 99, 235, 0.05)', 
        stroke: '#2563eb', 'stroke-width': 4, 'stroke-dasharray': '15, 10'
    });

    // Leader Line & Label
    const line = createSVG('line', {
        x1: center.x + (r * 0.7), y1: center.y - (r * 0.7),
        x2: center.x + r + 50, y2: center.y - r - 50,
        stroke: '#2563eb', 'stroke-width': 2
    });
    const label = createSVG('text', {
        x: center.x + r + 55, y: center.y - r - 55,
        fill: '#2563eb', 'font-family': 'JetBrains Mono', 'font-size': '20', 'font-weight': 'bold'
    });
    label.textContent = `Ø${toleranceDiam.toFixed(3)}" Tol Zone`;

    group.appendChild(zone);
    group.appendChild(line);
    group.appendChild(label);
    svgContainer.appendChild(group);
}

function drawDeviationDetails() {
    const { center, scale, deviationX, deviationY } = state;
    if (deviationX === 0 && deviationY === 0) return;

    const pixX = center.x + (deviationX * scale);
    const pixY = center.y - (deviationY * scale);

    const group = createSVG('g', {});

    // 1. Hypotenuse (True Deviation)
    group.appendChild(createSVG('line', {
        x1: center.x, y1: center.y, x2: pixX, y2: pixY,
        stroke: '#f59e0b', 'stroke-width': 5
    }));

    // 2. X-Dimension Arrow
    // We draw a line below the deviation to show X distance
    const dimYLevel = center.y + 40; // Push down
    group.appendChild(createSVG('line', {
        x1: center.x, y1: dimYLevel, x2: pixX, y2: dimYLevel,
        stroke: '#64748b', 'stroke-width': 2, 'marker-end': 'url(#arrow)'
    }));
    // Connecting leaders
    group.appendChild(createSVG('line', { x1: pixX, y1: center.y, x2: pixX, y2: dimYLevel + 10, stroke: '#cbd5e1', 'stroke-width': 1, 'stroke-dasharray': '4,4'}));

    // 3. Y-Dimension Arrow
    const dimXLevel = center.x - 40; // Push left
    group.appendChild(createSVG('line', {
        x1: dimXLevel, y1: center.y, x2: dimXLevel, y2: pixY,
        stroke: '#64748b', 'stroke-width': 2
    }));
    // Connecting leaders
    group.appendChild(createSVG('line', { x1: center.x, y1: pixY, x2: dimXLevel - 10, y2: pixY, stroke: '#cbd5e1', 'stroke-width': 1, 'stroke-dasharray': '4,4'}));

    // Labels
    const txtStyle = { fill: '#64748b', 'font-family': 'monospace', 'font-size': '16', 'font-weight': 'bold' };
    
    const xLbl = createSVG('text', { x: center.x + (deviationX*scale)/2, y: dimYLevel + 20, ...txtStyle, 'text-anchor': 'middle' });
    xLbl.textContent = `x: ${Math.abs(deviationX).toFixed(3)}`;
    
    const yLbl = createSVG('text', { x: dimXLevel - 50, y: center.y - (deviationY*scale)/2, ...txtStyle, 'alignment-baseline': 'middle' });
    yLbl.textContent = `y: ${Math.abs(deviationY).toFixed(3)}`;

    group.appendChild(xLbl);
    group.appendChild(yLbl);
    svgContainer.appendChild(group);
}

function drawActualHole() {
    const { center, scale, deviationX, deviationY, holeDiam, toleranceDiam } = state;
    
    const pixX = center.x + (deviationX * scale);
    const pixY = center.y - (deviationY * scale);
    const radius = (holeDiam / 2) * scale;

    const actualPos = 2 * Math.sqrt(deviationX**2 + deviationY**2);
    const isPass = actualPos <= toleranceDiam;
    const color = isPass ? '#10b981' : '#ef4444'; // Bright Green / Bright Red

    const group = createSVG('g', { class: 'cursor-move', id: 'draggable-hole' });

    // The Hole Body
    group.appendChild(createSVG('circle', {
        cx: pixX, cy: pixY, r: radius,
        fill: isPass ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        stroke: color, 'stroke-width': 4
    }));

    // Center Target
    group.appendChild(createSVG('line', { x1: pixX-10, y1: pixY, x2: pixX+10, y2: pixY, stroke: color, 'stroke-width': 3 }));
    group.appendChild(createSVG('line', { x1: pixX, y1: pixY-10, x2: pixX, y2: pixY+10, stroke: color, 'stroke-width': 3 }));

    // Coordinate Tag (The floating label)
    const rectWidth = 160;
    const tagGroup = createSVG('g', {});
    
    tagGroup.appendChild(createSVG('rect', {
        x: pixX + 20, y: pixY - 45, width: rectWidth, height: 35,
        fill: '#0f172a', rx: 4, opacity: 0.8
    }));
    
    const text = createSVG('text', {
        x: pixX + 30, y: pixY - 22,
        fill: '#f8fafc', 'font-family': 'JetBrains Mono', 'font-size': '16'
    });
    text.textContent = `ACT: (${deviationX.toFixed(3)}, ${deviationY.toFixed(3)})`;
    
    tagGroup.appendChild(text);
    group.appendChild(tagGroup);
    
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { deviationX, deviationY, toleranceDiam } = state;
    
    // Calculations
    const radialError = Math.sqrt(deviationX**2 + deviationY**2);
    const actualPos = 2 * radialError; 
    const isPass = actualPos <= toleranceDiam;
    
    // Theme Colors
    const panelBg = '#0f172a'; // Slate 900
    const panelBorder = '#334155'; // Slate 700
    const accent = isPass ? '#22c55e' : '#ef4444'; // Green or Red
    
    const group = createSVG('g', {});
    
    // 1. Panel Background
    const bx = 20, by = 20, bw = 400, bh = 240;
    group.appendChild(createSVG('rect', {
        x: bx, y: by, width: bw, height: bh,
        fill: panelBg, stroke: accent, 'stroke-width': 2, rx: 0
    }));

    // 2. Corner Decals (Tech Look)
    const decalSize = 20;
    // Top Left
    group.appendChild(createSVG('polyline', { points: `${bx},${by+decalSize} ${bx},${by} ${bx+decalSize},${by}`, fill: 'none', stroke: 'white', 'stroke-width': 3 }));
    // Bottom Right
    group.appendChild(createSVG('polyline', { points: `${bx+bw},${by+bh-decalSize} ${bx+bw},${by+bh} ${bx+bw-decalSize},${by+bh}`, fill: 'none', stroke: 'white', 'stroke-width': 3 }));

    // 3. Header Text
    const textBase = 60;
    const col1 = 50;
    const col2 = 250;
    
    const addText = (txt, x, y, size, color, weight='bold') => {
        const t = createSVG('text', { x, y, fill: color, 'font-family': 'JetBrains Mono', 'font-size': size, 'font-weight': weight });
        t.textContent = txt;
        return t;
    };

    group.appendChild(addText('INSPECTION STATUS', bx+20, by+35, 20, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    // 4. Data Rows
    group.appendChild(addText('X-DEV:', col1, by+80, 16, '#cbd5e1'));
    group.appendChild(addText(deviationX.toFixed(4)+'"', col2, by+80, 16, accent));
    
    group.appendChild(addText('Y-DEV:', col1, by+105, 16, '#cbd5e1'));
    group.appendChild(addText(deviationY.toFixed(4)+'"', col2, by+105, 16, accent));

    group.appendChild(addText('RESULTANT:', col1, by+130, 16, '#cbd5e1'));
    group.appendChild(addText(actualPos.toFixed(4)+'"', col2, by+130, 16, 'white'));

    // 5. The Formula Reminder
    group.appendChild(addText('Formula: 2 * SQRT(x^2 + y^2)', bx+20, by+160, 12, '#64748b', 'normal'));

    // 6. Tolerance Bar (Segmented)
    const barY = by + 190;
    const barW = 360;
    const maxVal = toleranceDiam * 1.5; // Scale bar to 150% of tolerance
    const segments = 20;
    const filledSegments = Math.min(segments, Math.floor((actualPos / maxVal) * segments));
    const limitSegment = Math.floor((toleranceDiam / maxVal) * segments);

    // Draw Segments
    for(let i=0; i<segments; i++) {
        const segX = bx + 20 + (i * (barW/segments));
        let segColor = '#334155'; // Empty
        
        if (i < filledSegments) {
            // Gradient effect
            if (i < limitSegment) segColor = '#22c55e'; // Green zone
            else segColor = '#ef4444'; // Red zone
        }

        group.appendChild(createSVG('rect', {
            x: segX, y: barY, width: (barW/segments)-2, height: 15,
            fill: segColor
        }));
    }
    
    // Tolerance Marker on Bar
    const markX = bx + 20 + (limitSegment * (barW/segments));
    group.appendChild(createSVG('line', { x1: markX, y1: barY-5, x2: markX, y2: barY+20, stroke: 'white', 'stroke-width': 2 }));

    // 7. BIG PASS/FAIL
    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`); // Glowing effect
    group.appendChild(status);

    svgContainer.appendChild(group);
}

function drawGuideOverlay() {
    // Semi-transparent backdrop
    const bg = createSVG('rect', {
        x: 0, y: 0, width: 1000, height: 800,
        fill: 'rgba(15, 23, 42, 0.9)'
    });
    svgContainer.appendChild(bg);

    const group = createSVG('g', {});
    
    // Helper to write lines of text
    let yPos = 150;
    const write = (text, size=20, color='white', weight='normal') => {
        const t = createSVG('text', { x: 500, y: yPos, fill: color, 'font-family': 'sans-serif', 'font-size': size, 'font-weight': weight, 'text-anchor': 'middle' });
        t.textContent = text;
        group.appendChild(t);
        yPos += (size * 1.5);
    };

    write("TOOL GUIDE: POSITION TOLERANCE", 40, '#f59e0b', 'bold');
    yPos += 20;
    write("1. DRAG THE HOLE", 24, '#38bdf8', 'bold');
    write("Click and drag the solid circle to simulate manufacturing error.", 18, '#cbd5e1');
    yPos += 20;
    write("2. OBSERVE THE MATH", 24, '#38bdf8', 'bold');
    write("As you move, the X and Y deviations are calculated instantly.", 18, '#cbd5e1');
    write("Position = 2 × √(x² + y²)", 20, '#yellow');
    yPos += 20;
    write("3. CHECK THE ZONE", 24, '#38bdf8', 'bold');
    write("The dashed circle is the Tolerance Zone.", 18, '#cbd5e1');
    write("If the hole center stays inside, you PASS.", 18, '#cbd5e1');
    yPos += 40;
    write("[ CLICK ANYWHERE TO CLOSE ]", 16, '#94a3b8');

    // Click to dismiss
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
        if(state.showGuide) return; // Disable drag if guide is open

        const m = getMousePos(evt);
        const { center, scale, deviationX, deviationY } = state;
        const holeX = center.x + (deviationX * scale);
        const holeY = center.y - (deviationY * scale);
        
        const dist = Math.sqrt((m.x - holeX)**2 + (m.y - holeY)**2);
        
        if (dist < 60) {
            state.isDragging = true;
            svg.style.cursor = 'grabbing';
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        
        const m = getMousePos(evt);
        const { center, scale } = state;

        let newDevX = (m.x - center.x) / scale;
        let newDevY = -(m.y - center.y) / scale; 

        state.deviationX = newDevX;
        state.deviationY = newDevY;

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
        <div class="col-span-1 bg-white p-4 rounded shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
                <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Control Frame</h4>
                <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-max select-none shadow-lg">
                    <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center">
                        <span class="text-3xl">⌖</span>
                    </div>
                    <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1">
                        <span class="text-2xl">Ø</span>
                        <input type="number" id="ctrl-tol" value="${state.toleranceDiam}" step="0.001" 
                            class="w-24 font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                    </div>
                    <div class="px-3 py-2 border-r-2 border-black bg-slate-100 text-slate-400">A</div>
                    <div class="px-3 py-2 border-r-2 border-black bg-slate-100 text-slate-400">B</div>
                    <div class="px-3 py-2 bg-slate-100 text-slate-400">C</div>
                </div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> HOW TO USE / GUIDE
            </button>
        </div>

        <div class="col-span-1 bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Manual Coordinates (in)</h4>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">X OFFSET</label>
                    <input type="number" id="ctrl-x" step="0.001" value="${state.deviationX.toFixed(4)}"
                        class="w-full px-3 py-2 border border-slate-300 rounded font-mono text-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Y OFFSET</label>
                    <input type="number" id="ctrl-y" step="0.001" value="${state.deviationY.toFixed(4)}"
                        class="w-full px-3 py-2 border border-slate-300 rounded font-mono text-lg focus:ring-2 focus:ring-blue-500">
                </div>
            </div>
            <div class="mt-4 flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                <span class="text-xs font-bold text-slate-500">ZOOM</span>
                <input type="range" id="ctrl-zoom" min="500" max="4000" step="100" value="${state.scale}" class="w-2/3 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
            </div>
        </div>

        <div class="col-span-1 bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Configuration</h4>
            <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-semibold text-slate-700">Hole Diameter (in)</label>
                <input type="number" id="ctrl-hole" value="${state.holeDiam}" step="0.010"
                    class="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono">
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-calculator"></i> Logic</div>
                <div class="text-xs opacity-80 leading-relaxed">
                    Tolerance Zone is fixed at True Position.<br>
                    Actual Position is calculated radially.<br>
                    <strong>Pass = Actual Pos ≤ Tolerance</strong>
                </div>
            </div>
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputX = document.getElementById('ctrl-x');
    const inputY = document.getElementById('ctrl-y');
    const inputHole = document.getElementById('ctrl-hole');
    const inputZoom = document.getElementById('ctrl-zoom');
    const btnGuide = document.getElementById('btn-guide');

    inputTol.oninput = (e) => { state.toleranceDiam = parseFloat(e.target.value) || 0; renderScene(); };
    
    const updateDev = () => {
        state.deviationX = parseFloat(inputX.value) || 0;
        state.deviationY = parseFloat(inputY.value) || 0;
        renderScene();
    };
    inputX.oninput = updateDev;
    inputY.oninput = updateDev;
    inputHole.oninput = (e) => { state.holeDiam = parseFloat(e.target.value) || 0.1; renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };
    
    // Toggle Guide
    btnGuide.onclick = () => {
        state.showGuide = !state.showGuide;
        renderScene();
    }
}

function updateReadouts() {
    if (state.isDragging) {
        const inputX = document.getElementById('ctrl-x');
        const inputY = document.getElementById('ctrl-y');
        if(inputX) inputX.value = state.deviationX.toFixed(4);
        if(inputY) inputY.value = state.deviationY.toFixed(4);
    }
}