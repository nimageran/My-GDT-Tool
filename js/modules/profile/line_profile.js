// js/modules/profile/line_profile.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    
    // Engineering Parameters (INCHES)
    scale: 1200,            // Zoom level
    toleranceWidth: 0.030,  // Total width of tolerance zone
    
    // Curve Definition (The "True Profile" - A nice S-Curve)
    startPt: { x: 100, y: 600 },
    cp1:     { x: 300, y: 200 }, // Control Point 1
    cp2:     { x: 700, y: 700 }, // Control Point 2
    endPt:   { x: 900, y: 300 },
    
    // User Deformation (Offsets at t=0.25, t=0.5, t=0.75)
    // These values shift the curve along its normal vector
    deviations: [0.000, 0.000, 0.000], 
    
    // UI State
    activeHandleIdx: -1, // -1 means none
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

    // 2. Tolerance Zone (The Blue Band)
    drawToleranceZone();

    // 3. The True Profile (Dashed Line)
    drawTrueProfile();

    // 4. The Actual Profile (Deformed Curve + Error Combs)
    drawActualProfile();

    // 5. Interactive Handles
    drawHandles();

    // 6. HUD
    drawFuturisticHUD();

    // 7. Guide Overlay
    if (state.showGuide) {
        drawGuideOverlay();
    }
}

// --- MATH HELPERS (Bezier Logic) ---

// Cubic Bezier Formula
function getBezierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
        y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
}

// Derivative of Cubic Bezier (Tangent Vector)
function getBezierTangent(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    // Derivative formula
    return {
        x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
        y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y)
    };
}

// Get Normal Vector (Normalized)
function getNormal(t) {
    const tan = getBezierTangent(t, state.startPt, state.cp1, state.cp2, state.endPt);
    const len = Math.sqrt(tan.x * tan.x + tan.y * tan.y);
    // Rotate 90 degrees: (x, y) -> (-y, x)
    return {
        x: -tan.y / len,
        y: tan.x / len
    };
}

// Calculate Deformation at time t based on the 3 handles
// We use a simple weighting function to blend the handles
function getDeformationAt(t) {
    const { deviations } = state;
    // Handles are at t=0.25, 0.5, 0.75
    // Influence range: 
    const influence = (tVal, center) => Math.max(0, 1 - Math.abs(tVal - center) * 4);
    
    let offset = 0;
    offset += deviations[0] * influence(t, 0.25);
    offset += deviations[1] * influence(t, 0.50);
    offset += deviations[2] * influence(t, 0.75);
    
    return offset;
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const group = createSVG('g', { stroke: '#e2e8f0', 'stroke-width': 1 });
    // Simple 50px grid
    for (let i = 0; i < 1000; i += 50) group.appendChild(createSVG('line', { x1: i, y1: 0, x2: i, y2: 800 }));
    for (let i = 0; i < 800; i += 50) group.appendChild(createSVG('line', { x1: 0, y1: i, x2: 1000, y2: i }));
    svgContainer.appendChild(group);
}

function drawTrueProfile() {
    const { startPt, cp1, cp2, endPt } = state;
    const pathData = `M ${startPt.x},${startPt.y} C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${endPt.x},${endPt.y}`;
    
    const group = createSVG('g', {});
    // The Line
    group.appendChild(createSVG('path', {
        d: pathData,
        fill: 'none', stroke: '#0f172a', 'stroke-width': 2, 'stroke-dasharray': '10,5'
    }));
    
    // Label
    const mid = getBezierPoint(0.5, startPt, cp1, cp2, endPt);
    const label = createSVG('text', {
        x: mid.x, y: mid.y + 20, 
        fill: '#0f172a', 'font-family': 'JetBrains Mono', 'font-size': '14', 'font-weight': 'bold'
    });
    label.textContent = "TRUE PROFILE";
    group.appendChild(label);
    
    svgContainer.appendChild(group);
}

function drawToleranceZone() {
    const { startPt, cp1, cp2, endPt, scale, toleranceWidth } = state;
    const halfWidth = (toleranceWidth / 2) * scale;
    
    // We construct the offset paths by sampling
    const steps = 100;
    let upperPts = [];
    let lowerPts = [];

    for(let i=0; i<=steps; i++) {
        const t = i / steps;
        const pt = getBezierPoint(t, startPt, cp1, cp2, endPt);
        const norm = getNormal(t);
        
        upperPts.push({ x: pt.x + norm.x * halfWidth, y: pt.y + norm.y * halfWidth });
        lowerPts.push({ x: pt.x - norm.x * halfWidth, y: pt.y - norm.y * halfWidth });
    }

    // Convert points to Path Data
    const ptsToPath = (pts) => {
        return pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    };

    const upperD = ptsToPath(upperPts);
    const lowerD = ptsToPath(lowerPts.reverse()); // Reverse lower to close loop nicely if needed

    const group = createSVG('g', {});

    // Zone Fill (Polygon)
    // Connect Upper end to Lower start
    const fillD = upperD + ` L ${lowerPts[0].x},${lowerPts[0].y} ` + ptsToPath(lowerPts) + ' Z';
    
    group.appendChild(createSVG('path', {
        d: fillD,
        fill: 'rgba(37, 99, 235, 0.05)', stroke: 'none'
    }));

    // Zone Borders
    group.appendChild(createSVG('path', { d: upperD, fill: 'none', stroke: '#2563eb', 'stroke-width': 2 }));
    group.appendChild(createSVG('path', { d: ptsToPath(lowerPts.reverse()), fill: 'none', stroke: '#2563eb', 'stroke-width': 2 }));

    svgContainer.appendChild(group);
}

function drawActualProfile() {
    const { startPt, cp1, cp2, endPt, scale, toleranceWidth } = state;
    const steps = 100;
    
    // We need to determine overall Pass/Fail to color the main line
    let maxError = 0;
    let pathPts = [];
    let combLines = []; // The "whiskers"

    const halfTol = toleranceWidth / 2;

    for(let i=0; i<=steps; i++) {
        const t = i / steps;
        const truePt = getBezierPoint(t, startPt, cp1, cp2, endPt);
        const norm = getNormal(t);
        
        // Calculate Deformation
        const devInches = getDeformationAt(t);
        maxError = Math.max(maxError, Math.abs(devInches));
        
        const offsetPx = devInches * scale;
        const actualPt = { 
            x: truePt.x + norm.x * offsetPx, 
            y: truePt.y + norm.y * offsetPx 
        };
        
        pathPts.push(actualPt);

        // Draw "Comb" / "Whisker" every 5 steps
        if (i % 2 === 0) {
            const isPointPass = Math.abs(devInches) <= halfTol;
            const color = isPointPass ? '#10b981' : '#ef4444';
            
            // Draw line from True to Actual
            combLines.push(createSVG('line', {
                x1: truePt.x, y1: truePt.y, x2: actualPt.x, y2: actualPt.y,
                stroke: color, 'stroke-width': 1, opacity: 0.6
            }));
        }
    }

    const d = pathPts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    
    // Global Status
    const isPass = maxError <= halfTol;
    const mainColor = isPass ? '#10b981' : '#ef4444'; // Green or Red

    const group = createSVG('g', {});

    // 1. Add Combs
    combLines.forEach(l => group.appendChild(l));

    // 2. Main Curve
    group.appendChild(createSVG('path', {
        d: d,
        fill: 'none', stroke: mainColor, 'stroke-width': 4
    }));

    svgContainer.appendChild(group);
}

function drawHandles() {
    const { startPt, cp1, cp2, endPt, scale, deviations } = state;
    const tValues = [0.25, 0.50, 0.75];

    const group = createSVG('g', {});

    tValues.forEach((t, idx) => {
        const truePt = getBezierPoint(t, startPt, cp1, cp2, endPt);
        const norm = getNormal(t);
        const offsetPx = deviations[idx] * scale;
        
        const handlePt = {
            x: truePt.x + norm.x * offsetPx,
            y: truePt.y + norm.y * offsetPx
        };

        // Line connecting handle to surface (visual aid)
        group.appendChild(createSVG('line', {
            x1: truePt.x, y1: truePt.y, x2: handlePt.x, y2: handlePt.y,
            stroke: '#94a3b8', 'stroke-dasharray': '2,2'
        }));

        // The Handle Circle
        const circle = createSVG('circle', {
            cx: handlePt.x, cy: handlePt.y, r: 8,
            fill: 'white', stroke: '#0f172a', 'stroke-width': 2,
            class: 'cursor-pointer',
            'data-handle': idx
        });

        // Hover effect helper
        circle.onmouseover = () => circle.setAttribute('fill', '#f59e0b');
        circle.onmouseout = () => circle.setAttribute('fill', 'white');

        group.appendChild(circle);
    });

    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    // Determine Max Deviation
    let maxDev = 0;
    // Sample a few points
    for(let t=0; t<=1; t+=0.05) maxDev = Math.max(maxDev, Math.abs(getDeformationAt(t)));

    const { toleranceWidth } = state;
    const isPass = maxDev <= (toleranceWidth/2);
    
    const panelBg = '#0f172a'; 
    const accent = isPass ? '#22c55e' : '#ef4444'; 
    
    const group = createSVG('g', {});
    
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

    group.appendChild(addText('PROFILE SCAN', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('MAX DEVIATION:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(maxDev.toFixed(4)+'"', col2, by+80, 14, accent));
    
    group.appendChild(addText('TOLERANCE (TOTAL):', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceWidth.toFixed(4)+'"', col2, by+105, 14, 'white'));

    group.appendChild(addText('HALF-ZONE LIMIT:', col1, by+130, 14, '#cbd5e1'));
    group.appendChild(addText((toleranceWidth/2).toFixed(4)+'"', col2, by+130, 14, 'white'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Profile Bar
    const barY = by + 170;
    const barW = 340;
    const maxScale = toleranceWidth;
    
    // Bar Background
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 10, fill: '#1e293b', rx: 5 }));
    
    // Limit Lines on Bar
    const limitPix = ((toleranceWidth/2) / maxScale) * barW;
    // Center is 0
    const centerX = bx + 20 + barW/2;
    
    // Draw Limits
    group.appendChild(createSVG('line', { x1: centerX - limitPix, y1: barY-5, x2: centerX - limitPix, y2: barY+15, stroke: '#6366f1', 'stroke-width': 2 }));
    group.appendChild(createSVG('line', { x1: centerX + limitPix, y1: barY-5, x2: centerX + limitPix, y2: barY+15, stroke: '#6366f1', 'stroke-width': 2 }));

    // Actual Indicator (Dot)
    // We show the max deviation relative to center
    const dotX = centerX + (maxDev / maxScale) * barW; // Just visualizing magnitude on right side
    
    group.appendChild(createSVG('circle', { cx: dotX, cy: barY+5, r: 6, fill: accent, stroke: 'white' }));
    
    // Fill region
    group.appendChild(createSVG('rect', { x: centerX, y: barY+3, width: dotX-centerX, height: 4, fill: accent }));

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

    write("TOOL GUIDE: PROFILE OF A LINE", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. THE GEOMETRY", 24, '#6366f1', 'bold');
    write("Controls a 2D cross-section of a surface.", 18, '#cbd5e1');
    write("The dashed line is the True Profile (Target).", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. TOLERANCE ZONE", 24, '#6366f1', 'bold');
    write("The Blue Band is the Tolerance Zone.", 18, '#cbd5e1');
    write("It is defined by boundaries offset from the True Profile.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Drag the 3 White Handles on the curve to warp the surface.", 18, '#cbd5e1');
    write("The 'Combs' (whiskers) show the error magnitude.", 18, '#cbd5e1');
    
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
        
        // Check if clicking a handle
        const target = evt.target;
        if (target.dataset.handle) {
            state.activeHandleIdx = parseInt(target.dataset.handle);
            svg.style.cursor = 'ns-resize'; // Up/Down indicator
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (state.activeHandleIdx === -1) return;
        
        const m = getMousePos(evt);
        const { startPt, cp1, cp2, endPt, scale } = state;
        const tVals = [0.25, 0.50, 0.75];
        const t = tVals[state.activeHandleIdx];
        
        // Calculate the True Point and Normal at this handle
        const truePt = getBezierPoint(t, startPt, cp1, cp2, endPt);
        const norm = getNormal(t);
        
        // Project the mouse position onto the normal vector to find the offset
        // Vector from truePt to Mouse
        const v = { x: m.x - truePt.x, y: m.y - truePt.y };
        
        // Dot Product to find distance along normal
        // dist = v . norm
        const distPx = v.x * norm.x + v.y * norm.y;
        
        // Convert to inches
        const distIn = distPx / scale;
        
        state.deviations[state.activeHandleIdx] = distIn;
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
            <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-full max-w-full overflow-x-auto select-none shadow-md">
                <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center bg-slate-50">
                    <span class="text-3xl">⌓</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-r-2 border-black bg-slate-100 text-slate-400">A</div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400">B</div>
            </div>
            
             <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Surface Error Control</h4>
            
            <div class="flex items-center justify-between mb-2">
                <button id="btn-reset" class="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-slate-700">Reset Surface</button>
                <button id="btn-random" class="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded text-slate-700">Randomize</button>
            </div>

            <div class="space-y-4 mt-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Point 1 (Left)</span>
                        <span id="val-d1">0.000</span>
                    </div>
                    <input type="range" id="slide-d1" min="-0.03" max="0.03" step="0.001" value="${state.deviations[0]}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Point 2 (Mid)</span>
                        <span id="val-d2">0.000</span>
                    </div>
                    <input type="range" id="slide-d2" min="-0.03" max="0.03" step="0.001" value="${state.deviations[1]}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Point 3 (Right)</span>
                        <span id="val-d3">0.000</span>
                    </div>
                    <input type="range" id="slide-d3" min="-0.03" max="0.03" step="0.001" value="${state.deviations[2]}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">View Settings</h4>
            
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-500">ZOOM LEVEL</span>
            </div>
            <input type="range" id="ctrl-zoom" min="800" max="2000" step="100" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">

            <div class="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-wave-square"></i> Note</div>
                <div class="text-xs opacity-90 leading-relaxed">
                    Line Profile is a 2D control. The tolerance zone follows the true profile curve. The "Whiskers" indicate the magnitude of surface error.
                </div>
            </div>
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputZoom = document.getElementById('ctrl-zoom');
    const btnGuide = document.getElementById('btn-guide');
    const btnReset = document.getElementById('btn-reset');
    const btnRandom = document.getElementById('btn-random');
    
    // Sliders
    const s1 = document.getElementById('slide-d1');
    const s2 = document.getElementById('slide-d2');
    const s3 = document.getElementById('slide-d3');
    
    // Labels
    const v1 = document.getElementById('val-d1');
    const v2 = document.getElementById('val-d2');
    const v3 = document.getElementById('val-d3');

    inputTol.oninput = (e) => { state.toleranceWidth = parseFloat(e.target.value) || 0; renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); renderScene(); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateDevs = () => {
        state.deviations[0] = parseFloat(s1.value);
        state.deviations[1] = parseFloat(s2.value);
        state.deviations[2] = parseFloat(s3.value);
        
        v1.innerText = state.deviations[0].toFixed(3);
        v2.innerText = state.deviations[1].toFixed(3);
        v3.innerText = state.deviations[2].toFixed(3);
        
        renderScene();
    };

    s1.oninput = updateDevs;
    s2.oninput = updateDevs;
    s3.oninput = updateDevs;

    btnReset.onclick = () => {
        state.deviations = [0,0,0];
        s1.value = 0; s2.value = 0; s3.value = 0;
        updateDevs();
    };

    btnRandom.onclick = () => {
        const r = () => (Math.random() * 0.04) - 0.02;
        state.deviations = [r(), r(), r()];
        s1.value = state.deviations[0]; 
        s2.value = state.deviations[1]; 
        s3.value = state.deviations[2];
        updateDevs();
    };
}