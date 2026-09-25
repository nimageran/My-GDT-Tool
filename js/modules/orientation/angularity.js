// js/modules/orientation/angularity.js

import { createSVG, readTolerance } from '../../drawing_utils.js';
import { COLORS, resultsCard } from '../../theme.js';

const f4 = v => `${v.toFixed(4)}"`;

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

    // 6. Results card
    drawResultsCard();

    // 7. Guide
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
    const label = createSVG('text', { x: 60, y: center.y + 34, fill: COLORS.muted, stroke: 'none', 'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif', 'font-size': '13' });
    label.textContent = 'Datum plane A';
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
    
    // Angularity only controls orientation, so the zone floats: center it on
    // the actual surface (midway between its two ends, measured along n).
    const { dStart, dEnd } = getSurfaceOffsets();
    const shiftPx = (dStart + dEnd) / 2;

    // Upper Boundary Point
    const u1 = { x: center.x + n.x * (shiftPx + halfTolPx), y: center.y + n.y * (shiftPx + halfTolPx) };
    const u2 = { x: u1.x + v.x * lenPx, y: u1.y + v.y * lenPx };
    
    // Lower Boundary Point
    const l1 = { x: center.x + n.x * (shiftPx - halfTolPx), y: center.y + n.y * (shiftPx - halfTolPx) };
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

// Signed offsets (px) of the actual surface's two ends from the basic-angle
// line through the datum anchor, measured along the zone normal.
function getSurfaceOffsets() {
    const { center, scale, surfaceLength, basicAngle, angleDeviation, offsetDeviation } = state;
    const v = getVector(basicAngle + angleDeviation);
    const nBasic = getNormal(basicAngle);
    const lenPx = surfaceLength * scale;
    const start = { x: center.x + nBasic.x * offsetDeviation * scale, y: center.y + nBasic.y * offsetDeviation * scale };
    const end = { x: start.x + v.x * lenPx, y: start.y + v.y * lenPx };
    const along = (p) => (p.x - center.x) * nBasic.x + (p.y - center.y) * nBasic.y;
    return { dStart: along(start), dEnd: along(end) };
}

function drawPart() {
    const { center, scale, surfaceLength, basicAngle, angleDeviation, offsetDeviation } = state;
    
    const actualAngle = basicAngle + angleDeviation;
    const lenPx = surfaceLength * scale;
    
    // Vectors
    const v = getVector(actualAngle);
    
    // The part pivots at the center, but can shift (offsetDeviation) perpendicular to the Basic Angle
    // The zone floats with it (see drawToleranceZone), so offset alone never fails.
    // Offset Direction is the Normal of the BASIC angle
    const nBasic = getNormal(basicAngle);
    const shiftX = nBasic.x * (offsetDeviation * scale);
    const shiftY = nBasic.y * (offsetDeviation * scale);
    
    const startPt = { x: center.x + shiftX, y: center.y + shiftY };
    const endPt = { x: startPt.x + v.x * lenPx, y: startPt.y + v.y * lenPx };
    
    // Pass/Fail: the floating zone must contain both ends of the surface,
    // i.e. their spread across the zone must not exceed the tolerance width.
    // Same rule as the results card (L * sin(angle error)).
    const { dStart, dEnd } = getSurfaceOffsets();
    const isPass = Math.abs(dEnd - dStart) <= state.toleranceWidth * scale;
    
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

function drawResultsCard() {
    const { angleDeviation, toleranceWidth, surfaceLength } = state;
    // Zone needed = width that holds the tilted surface: L × sin(angle error).
    // The zone floats (orientation only), so offset does not count.
    const needed = surfaceLength * Math.sin(Math.abs(angleDeviation * Math.PI / 180));
    const pass = needed <= toleranceWidth;
    svgContainer.appendChild(resultsCard({
        title: 'Angularity', pass,
        rows: [['Angle error', `${angleDeviation.toFixed(2)}°`], ['Zone needed', f4(needed), { strong: true, color: pass ? COLORS.pass : COLORS.fail }], ['Allowed', f4(toleranceWidth)]],
        measured: needed, allowed: toleranceWidth,
        sentence: pass ? `Tilted ${Math.abs(angleDeviation).toFixed(2)}°, the surface still fits in the ${f4(toleranceWidth)} zone: it passes.`
            : `Tilted ${Math.abs(angleDeviation).toFixed(2)}°, the surface needs ${f4(needed)}, more than the ${f4(toleranceWidth)} allowed: it fails.`,
        note: 'Zone needed = length × sin(angle error)'
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
            
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Geometry Settings</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Basic angle (on the drawing)</span>
                        <span id="val-basic" class="font-bold border border-black px-1">${state.basicAngle}°</span>
                    </div>
                    <input type="range" id="slide-basic" min="15" max="75" step="5" value="${state.basicAngle}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Angle error (as made)</span>
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
    const btnReset = document.getElementById('btn-reset');
    
    const sBasic = document.getElementById('slide-basic');
    const sDev = document.getElementById('slide-dev');
    
    const vBasic = document.getElementById('val-basic');
    const vDev = document.getElementById('val-dev');

    inputTol.oninput = (e) => { state.toleranceWidth = readTolerance(e.target.value); renderScene(); };

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