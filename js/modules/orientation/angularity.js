// js/modules/orientation/angularity.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 200, y: 600 }, // Pivot point (Datum Anchor)
    
    // Engineering Parameters (INCHES)
    scale: 1500,            // Zoom level
    toleranceWidth: 0.020,  // The Tolerance Zone width
    surfaceLength: 0.300,   // Length of the angled face
    
    // Geometry Definition
    basicAngle: 45,         // The "Boxed" Dimension (Degrees)
    
    // Actual Manufacturing Errors
    angleDeviation: 0.0,    // Error in degrees (Tilt)
    offsetDeviation: 0.0,   // Linear shift (thick/thin part)
    
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

    // 2. Datum Plane (The Floor)
    drawDatumA();

    // 3. The Tolerance Zone (Parallel Planes at Basic Angle)
    drawToleranceZone();

    // 4. The Actual Part (Wedge)
    drawPart();

    // 5. Analysis (Basic Angle Dimension)
    drawDimensions();

    // 6. HUD
    drawFuturisticHUD();

    // 7. Guide
    if (state.showGuide) drawGuideOverlay();
}

// --- MATH HELPERS ---

function getVector(angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return { x: Math.cos(rad), y: -Math.sin(rad) }; // Y inverted for SVG
}

function getNormal(angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    // Normal is +90 deg
    return { x: -Math.sin(rad), y: -Math.cos(rad) }; // Correct for SVG coord system
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const group = createSVG('g', { stroke: '#f1f5f9', 'stroke-width': 1 });
    // Radial grid centered on pivot? Or standard? Let's use standard.
    for (let x = 0; x < 1000; x += 50) group.appendChild(createSVG('line', { x1: x, y1: 0, x2: x, y2: 800 }));
    for (let y = 0; y < 800; y += 50) group.appendChild(createSVG('line', { x1: 0, y1: y, x2: 1000, y2: y }));
    svgContainer.appendChild(group);
}

function drawDatumA() {
    const { center } = state;
    const group = createSVG('g', { stroke: '#1e293b', 'stroke-width': 2 });
    
    // The "Floor" Line
    group.appendChild(createSVG('line', { x1: 50, y1: center.y, x2: 950, y2: center.y, 'stroke-width': 4 }));
    
    // Datum Hash Marks
    for(let i=50; i<950; i+=20) {
        group.appendChild(createSVG('line', { x1: i, y1: center.y, x2: i-10, y2: center.y+10, 'stroke-width': 1, stroke: '#94a3b8' }));
    }
    
    // Label
    const textStyle = { fill: '#1e293b', 'font-family': 'JetBrains Mono', 'font-weight': '900', 'font-size': '20' };
    const label = createSVG('text', { x: 60, y: center.y - 15, ...textStyle });
    label.textContent = "DATUM PLANE A";
    group.appendChild(label);
    
    svgContainer.appendChild(group);
}

function drawToleranceZone() {
    const { center, scale, toleranceWidth, surfaceLength, basicAngle } = state;
    
    // Calculate geometry
    const lenPx = surfaceLength * scale * 1.5; // Draw zone longer than part
    const halfTolPx = (toleranceWidth / 2) * scale;
    
    // Vectors
    const v = getVector(basicAngle); // Direction of the surface
    const n = getNormal(basicAngle); // Direction of the tolerance width
    
    // We draw the zone relative to the "Perfect" geometry anchored at center
    // Upper Boundary Point
    const u1 = { x: center.x + n.x * halfTolPx, y: center.y + n.y * halfTolPx };
    const u2 = { x: u1.x + v.x * lenPx, y: u1.y + v.y * lenPx };
    
    // Lower Boundary Point
    const l1 = { x: center.x - n.x * halfTolPx, y: center.y - n.y * halfTolPx };
    const l2 = { x: l1.x + v.x * lenPx, y: l1.y + v.y * lenPx };
    
    const group = createSVG('g', {});
    
    // Zone Fill
    const poly = `${u1.x},${u1.y} ${u2.x},${u2.y} ${l2.x},${l2.y} ${l1.x},${l1.y}`;
    group.appendChild(createSVG('polygon', {
        points: poly,
        fill: 'rgba(37, 99, 235, 0.1)', stroke: 'none'
    }));
    
    // Boundary Lines
    const style = { stroke: '#3b82f6', 'stroke-width': 2, 'stroke-dasharray': '10,5' };
    group.appendChild(createSVG('line', { x1: u1.x, y1: u1.y, x2: u2.x, y2: u2.y, ...style }));
    group.appendChild(createSVG('line', { x1: l1.x, y1: l1.y, x2: l2.x, y2: l2.y, ...style }));
    
    // Width Dimension Arrow (Perpendicular to surface)
    // Draw at end of zone
    const arrStart = { x: u2.x, y: u2.y };
    const arrEnd = { x: l2.x, y: l2.y };
    
    group.appendChild(createSVG('line', { 
        x1: arrStart.x, y1: arrStart.y, x2: arrEnd.x, y2: arrEnd.y,
        stroke: '#2563eb', 'stroke-width': 1, 'marker-end': 'url(#arrow)', 'marker-start': 'url(#arrow)'
    }));
    
    // Label for Tolerance
    const midX = (arrStart.x + arrEnd.x) / 2 + 10;
    const midY = (arrStart.y + arrEnd.y) / 2 - 10;
    const txt = createSVG('text', { x: midX, y: midY, fill: '#2563eb', 'font-size': '14', 'font-weight': 'bold' });
    txt.textContent = `${toleranceWidth}"`;
    group.appendChild(txt);

    svgContainer.appendChild(group);
}

function drawPart() {
    const { center, scale, surfaceLength, basicAngle, angleDeviation, offsetDeviation } = state;
    
    const actualAngle = basicAngle + angleDeviation;
    const lenPx = surfaceLength * scale;
    
    // Vectors
    const v = getVector(actualAngle);
    
    // The part pivots at the center, but can shift (offsetDeviation) perpendicular to the Basic Angle
    // This simulates the "Zone is fixed, Part moves" visualization.
    // Offset Direction is the Normal of the BASIC angle
    const nBasic = getNormal(basicAngle);
    const shiftX = nBasic.x * (offsetDeviation * scale);
    const shiftY = nBasic.y * (offsetDeviation * scale);
    
    const startPt = { x: center.x + shiftX, y: center.y + shiftY };
    const endPt = { x: startPt.x + v.x * lenPx, y: startPt.y + v.y * lenPx };
    
    // Determine Pass/Fail
    // We check if startPt and endPt are within the tolerance zone planes.
    // Distance from Center Plane = Dot Product of (Point - Center) and NormalBasic
    // Center Plane is defined by Center(200,600) and NormalBasic.
    
    const distStart = Math.abs((startPt.x - center.x)*nBasic.x + (startPt.y - center.y)*nBasic.y);
    const distEnd = Math.abs((endPt.x - center.x)*nBasic.x + (endPt.y - center.y)*nBasic.y);
    
    const limit = (state.toleranceWidth / 2) * scale;
    const isPass = (distStart <= limit) && (distEnd <= limit);
    
    const color = isPass ? '#475569' : '#dc2626'; // Slate or Red
    const fillColor = isPass ? '#cbd5e1' : '#fecaca';
    
    const group = createSVG('g', { class: 'cursor-move', id: 'draggable-part' });
    
    // Draw the Wedge Block
    // Base point on floor? Complex because it lifts off. 
    // Let's just draw a "floating" block representing the verified feature.
    const thickness = 100;
    const p3 = { x: endPt.x, y: endPt.y + thickness }; // Just dropping down
    const p4 = { x: startPt.x, y: startPt.y + thickness };
    
    const poly = `${startPt.x},${startPt.y} ${endPt.x},${endPt.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
    
    group.appendChild(createSVG('polygon', {
        points: poly,
        fill: fillColor, stroke: color, 'stroke-width': 2, opacity: 0.8
    }));
    
    // The Controlled Surface Line (Thick)
    group.appendChild(createSVG('line', {
        x1: startPt.x, y1: startPt.y, x2: endPt.x, y2: endPt.y,
        stroke: isPass ? '#10b981' : '#ef4444', 'stroke-width': 5
    }));
    
    // Drag Handle at tip
    group.appendChild(createSVG('circle', {
        cx: endPt.x, cy: endPt.y, r: 8,
        fill: 'white', stroke: '#0f172a', 'stroke-width': 2
    }));

    svgContainer.appendChild(group);
}

function drawDimensions() {
    const { center, basicAngle } = state;
    const group = createSVG('g', {});
    
    // Draw Arc for Basic Angle
    const r = 80;
    const startAngle = 0; // Floor (0 deg, which is vector 1,0)
    const endAngle = -basicAngle; // SVG Y is down, so negative angle
    
    // Arc Path
    const x1 = center.x + r;
    const y1 = center.y;
    const rad = basicAngle * Math.PI / 180;
    const x2 = center.x + r * Math.cos(rad);
    const y2 = center.y - r * Math.sin(rad);
    
    const d = `M ${x1},${y1} A ${r},${r} 0 0,0 ${x2},${y2}`;
    
    group.appendChild(createSVG('path', {
        d: d, fill: 'none', stroke: '#0f172a', 'stroke-width': 1
    }));
    
    // Boxed Dimension Text
    const midRad = (basicAngle / 2) * Math.PI / 180;
    const tx = center.x + (r + 40) * Math.cos(midRad);
    const ty = center.y - (r + 40) * Math.sin(midRad);
    
    // The Box
    const bw = 50, bh = 25;
    group.appendChild(createSVG('rect', {
        x: tx - bw/2, y: ty - bh/2, width: bw, height: bh,
        fill: 'white', stroke: '#0f172a', 'stroke-width': 1
    }));
    
    const txt = createSVG('text', {
        x: tx, y: ty + 5, 'text-anchor': 'middle',
        fill: '#0f172a', 'font-family': 'sans-serif', 'font-weight': 'bold', 'font-size': '14'
    });
    txt.textContent = `${basicAngle}°`;
    group.appendChild(txt);
    
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { angleDeviation, toleranceWidth, surfaceLength } = state;
    
    // Calculate "Actual Angularity" (Linear)
    // Angularity error is the width of the zone needed to contain the surface.
    // If the surface is flat but tilted by theta_error, the width W = L * sin(theta_error)
    const errorRad = Math.abs(angleDeviation * Math.PI / 180);
    const actualLinear = surfaceLength * Math.sin(errorRad);
    
    // Include offset deviation? 
    // In this simulation, we check if it fits in the FIXED zone.
    // But standard reporting often "floats" the zone to find the minimum value.
    // If we assume the zone floats, the error is just due to the angle tilt: L * sin(a).
    // If we assume the zone is fixed (Position + Angularity), offset counts.
    // Let's report the "Floating Zone" value (Angle only) vs "Current Zone Fit".
    
    const isPass = actualLinear <= toleranceWidth;
    
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

    group.appendChild(addText('ANGULARITY ANALYSIS', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('ANGLE ERROR:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(angleDeviation.toFixed(2)+'°', col2, by+80, 16, accent));
    
    group.appendChild(addText('CALC. WIDTH (H):', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(actualLinear.toFixed(4)+'"', col2, by+105, 14, 'white'));
    
    group.appendChild(addText('TOLERANCE:', col1, by+130, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceWidth.toFixed(4)+'"', col2, by+130, 14, 'white'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Sine Bar Viz
    const barY = by + 160;
    const barW = 340;
    const maxScale = toleranceWidth * 2;
    
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 12, fill: '#1e293b', rx: 6 }));
    
    const limitPix = (toleranceWidth / maxScale) * barW;
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+17, stroke: 'white', 'stroke-width': 2 }));
    
    const fillPix = Math.min(barW, (actualLinear / maxScale) * barW);
    group.appendChild(createSVG('rect', { x: bx+20, y: barY+2, width: fillPix, height: 8, fill: accent, rx: 4 }));
    
    // Formula
    group.appendChild(addText('Formula: Length × sin(AngleError)', bx+20, by+190, 10, '#64748b', 'normal'));

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

    write("TOOL GUIDE: ANGULARITY", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. DEFINITION", 24, '#6366f1', 'bold');
    write("Controls orientation at a specific Basic Angle.", 18, '#cbd5e1');
    write("The Tolerance Zone is a WIDTH (Linear), not degrees.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. BASIC DIMENSION", 24, '#6366f1', 'bold');
    write("The boxed angle (e.g. 45°) is exact.", 18, '#cbd5e1');
    write("It defines the rotation of the Blue Tolerance Zone.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Drag the tip of the wedge to Tilt it.", 18, '#cbd5e1');
    write("Change the Basic Angle in controls to rotate the Zone.", 18, '#cbd5e1');
    
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
        // Calculate where the tip is
        const { center, scale, surfaceLength, basicAngle, angleDeviation, offsetDeviation } = state;
        const actualAngle = basicAngle + angleDeviation;
        const v = getVector(actualAngle);
        const n = getNormal(basicAngle);
        const shiftX = n.x * (offsetDeviation * scale);
        const shiftY = n.y * (offsetDeviation * scale);
        const startX = center.x + shiftX;
        const startY = center.y + shiftY;
        const tipX = startX + v.x * surfaceLength * scale;
        const tipY = startY + v.y * surfaceLength * scale;
        
        const dist = Math.sqrt((m.x - tipX)**2 + (m.y - tipY)**2);
        if (dist < 60) {
            state.isDragging = true;
            svg.style.cursor = 'crosshair';
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        
        const m = getMousePos(evt);
        const { center, scale, surfaceLength } = state;
        
        // Calculate angle from center to mouse
        const dx = m.x - center.x;
        const dy = -(m.y - center.y); // Invert Y for calculation
        
        let newAngle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (newAngle < 0) newAngle += 360;
        
        // Update deviation
        state.angleDeviation = newAngle - state.basicAngle;
        
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
            <div class="flex items-center font-mono text-xl bg-white border-2 border-black w-max select-none shadow-md">
                <div class="px-3 py-2 border-r-2 border-black flex items-center justify-center bg-slate-50">
                    <span class="text-3xl">∠</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceWidth}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400">A</div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Geometry Settings</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Basic Angle (Design)</span>
                        <span id="val-basic" class="font-bold border border-black px-1">${state.basicAngle}°</span>
                    </div>
                    <input type="range" id="slide-basic" min="15" max="75" step="5" value="${state.basicAngle}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Angle Deviation (Error)</span>
                        <span id="val-dev">0.00°</span>
                    </div>
                    <input type="range" id="slide-dev" min="-5" max="5" step="0.1" value="${state.angleDeviation}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <button id="btn-reset" class="mt-4 w-full text-xs bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded text-slate-700 font-bold">RESET PART</button>
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const btnGuide = document.getElementById('btn-guide');
    const btnReset = document.getElementById('btn-reset');
    
    const sBasic = document.getElementById('slide-basic');
    const sDev = document.getElementById('slide-dev');
    
    const vBasic = document.getElementById('val-basic');
    const vDev = document.getElementById('val-dev');

    inputTol.oninput = (e) => { state.toleranceWidth = parseFloat(e.target.value) || 0; renderScene(); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateParams = () => {
        state.basicAngle = parseFloat(sBasic.value);
        state.angleDeviation = parseFloat(sDev.value);
        
        vBasic.innerText = state.basicAngle + "°";
        vDev.innerText = state.angleDeviation.toFixed(2) + "°";
        
        renderScene();
    };

    sBasic.oninput = updateParams;
    sDev.oninput = updateParams;

    btnReset.onclick = () => {
        sDev.value = 0;
        updateParams();
    };
}