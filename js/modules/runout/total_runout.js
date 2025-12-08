// js/modules/runout/total_runout.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 250,              // 3D Projection Scale
    toleranceTotal: 0.012,   // Total Runout Tolerance
    nominalRadius: 1.0,      // Radius of cylinder
    height: 2.2,             // Height of cylinder
    
    // Deformations (INCHES)
    eccentricity: 0.000,     // Offset Axis
    taper: 0.000,            // Conicity error
    bend: 0.000,             // Banana shape
    
    // Animation State
    angle: 0,                // Rotation angle
    probeY: -1.0,            // Probe height position (-1.1 to 1.1)
    probeDir: 0.01,          // Scan speed/direction
    isScanning: true,
    
    // Scan Data
    scannedPoints: [],       // Stores {x, y, z, val, isPass} for visuals
    minReading: Infinity,
    maxReading: -Infinity,
    
    // 3D View Fixed
    tilt: 0.2,               // Tilt for 3D effect
    
    // UI State
    showGuide: false
};

// --- DOM REFERENCES ---
let svgContainer = null;
let controlsContainer = null;
let animationFrameId = null;

// --- EXPORTED METHODS ---

export function draw(svg) {
    svgContainer = svg;
    setupInteractions(svg);
    resetScan(); // Clear old data
    startAnimation();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// --- MATH HELPERS (3D ENGINE) ---

function project(x, y, z) {
    const { center, scale, tilt } = state;
    
    // Simple 3D projection
    // Rotate around X axis (Tilt)
    const y1 = y * Math.cos(tilt) - z * Math.sin(tilt);
    const z1 = y * Math.sin(tilt) + z * Math.cos(tilt);
    
    // Perspective
    const px = center.x + (x * scale);
    const py = center.y - (y1 * scale);
    
    return { x: px, y: py, z: z1 }; // Z for sorting
}

function getSurfacePoint(h, theta) {
    const { nominalRadius, eccentricity, taper, bend } = state;
    
    // h is from -height/2 to +height/2
    const hNorm = h / state.height; // -0.5 to 0.5
    
    // 1. Nominal Shape
    let r = nominalRadius;
    
    // 2. Taper (Radius changes with height)
    r += taper * hNorm;
    
    // 3. Center Shift (Eccentricity + Bend)
    // Eccentricity is constant offset
    // Bend is parabolic offset
    const shiftX = eccentricity + (bend * 4 * hNorm * hNorm);
    
    const x = shiftX + r * Math.cos(theta);
    const z = r * Math.sin(theta);
    
    return { x, y: h, z, r, shiftX };
}

// --- ANIMATION LOOP ---

function startAnimation() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    function loop() {
        if (!svgContainer) return;
        
        if (state.isScanning) {
            // 1. Rotate Part
            state.angle += 0.05;
            
            // 2. Move Probe (Helical Scan)
            state.probeY += state.probeDir;
            
            // Bounce Probe at ends
            if (state.probeY > state.height/2 || state.probeY < -state.height/2) {
                state.probeDir *= -1;
            }
            
            // 3. Record Measurement at Probe Tip
            // Probe is at fixed visual location ( Front of part? Side? )
            // Let's put probe at angle = -PI/2 (Front-ish) relative to rotating part
            const probeTheta = -Math.PI/2 - state.angle; 
            
            // Calculate actual deviation
            const pt = getSurfacePoint(state.probeY, probeTheta);
            
            // Runout Deviation calculation:
            // Deviation = Distance from Datum Axis Surface (Nominal R)
            // Actual Radius at this height = pt.r
            // Center shift at this height = pt.shiftX
            // The probe measures the surface position relative to the datum axis.
            // Surface X relative to axis = shiftX + r*cos(theta)
            // We simulate the Total Indicator Reading.
            
            // Simplified: The scalar distance from the axis at this specific angle/height
            // Deviation = sqrt(x^2 + z^2) - NominalRadius
            const dist = Math.sqrt(pt.x*pt.x + pt.z*pt.z);
            const dev = dist - state.nominalRadius;
            
            if (dev < state.minReading) state.minReading = dev;
            if (dev > state.maxReading) state.maxReading = dev;
            
            // Store point for visualization (Projected 3D point)
            // We store the point in "World Space" but rotated by current angle so it sticks to surface
            state.scannedPoints.push({
                h: state.probeY,
                theta: probeTheta, // Fixed angle on surface
                val: dev,
                timestamp: Date.now()
            });
            
            // Limit point cloud size
            if (state.scannedPoints.length > 400) state.scannedPoints.shift();
            
            renderScene();
        }
        animationFrameId = requestAnimationFrame(loop);
    }
    loop();
}

function resetScan() {
    state.scannedPoints = [];
    state.minReading = Infinity;
    state.maxReading = -Infinity;
}

// --- RENDERING ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    drawGrid();
    drawDatumAxis();
    drawToleranceShells();
    drawPartWireframe();
    drawScannedPoints();
    drawProbe();
    drawFuturisticHUD();
    
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const group = createSVG('g', { stroke: '#f1f5f9', 'stroke-width': 1 });
    // Floor
    for(let x=-2; x<=2; x+=0.5) {
        const p1 = project(x, -1.5, -2);
        const p2 = project(x, -1.5, 2);
        group.appendChild(createSVG('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
    }
    svgContainer.appendChild(group);
}

function drawDatumAxis() {
    const p1 = project(0, -1.5, 0);
    const p2 = project(0, 1.5, 0);
    
    const group = createSVG('g', {});
    group.appendChild(createSVG('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: '#f59e0b', 'stroke-width': 2, 'stroke-dasharray': '10,5'
    }));
    
    // Label
    const txt = createSVG('text', { x: p2.x, y: p2.y-10, fill: '#f59e0b', 'font-size': '12', 'font-family': 'monospace' });
    txt.textContent = "DATUM AXIS A-B";
    group.appendChild(txt);
    
    svgContainer.appendChild(group);
}

function drawToleranceShells() {
    // Shows the cylindrical boundaries
    // Inner and Outer Cylinder
    const { nominalRadius, height, toleranceTotal } = state;
    const halfTol = toleranceTotal / 2;
    
    const drawCyl = (r, color) => {
        const top = [];
        const bot = [];
        for(let i=0; i<=30; i++) {
            const t = (i/30)*Math.PI*2;
            const x = r * Math.cos(t);
            const z = r * Math.sin(t);
            // Rotate these by state.angle? No, tolerance zone is static.
            // But we view it from static camera.
            top.push(project(x, height/2, z));
            bot.push(project(x, -height/2, z));
        }
        
        let d = `M ${top[0].x},${top[0].y}`;
        top.forEach(p => d += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        
        d += ` M ${bot[0].x},${bot[0].y}`;
        bot.forEach(p => d += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        
        // Connect sides
        d += ` M ${top[0].x},${top[0].y} L ${bot[0].x},${bot[0].y}`;
        d += ` M ${top[15].x},${top[15].y} L ${bot[15].x},${bot[15].y}`;
        
        return createSVG('path', { d, fill: 'none', stroke: color, 'stroke-width': 1, 'stroke-dasharray': '5,5', opacity: 0.3 });
    };
    
    const group = createSVG('g', {});
    group.appendChild(drawCyl(nominalRadius + halfTol, '#3b82f6'));
    group.appendChild(drawCyl(nominalRadius - halfTol, '#3b82f6'));
    svgContainer.appendChild(group);
}

function drawPartWireframe() {
    const { height, angle } = state;
    const group = createSVG('g', {});
    
    // Draw longitudinal lines (Generators) that rotate
    const numGens = 8;
    for(let i=0; i<numGens; i++) {
        const thetaLocal = (i/numGens)*Math.PI*2;
        const thetaWorld = thetaLocal + angle;
        
        const path = [];
        // Sample height steps
        for(let h=-height/2; h<=height/2; h+=0.1) {
            const pt = getSurfacePoint(h, thetaWorld);
            path.push(project(pt.x, pt.y, pt.z));
        }
        
        let d = `M ${path[0].x},${path[0].y}`;
        path.forEach(p => d += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        
        group.appendChild(createSVG('path', {
            d, fill: 'none', stroke: '#64748b', 'stroke-width': 1
        }));
    }
    
    // Draw Top/Bottom Rings
    [ -height/2, height/2 ].forEach(h => {
        const path = [];
        for(let i=0; i<=30; i++) {
            const t = (i/30)*Math.PI*2 + angle;
            const pt = getSurfacePoint(h, t);
            path.push(project(pt.x, pt.y, pt.z));
        }
        let d = `M ${path[0].x},${path[0].y}`;
        path.forEach(p => d += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        group.appendChild(createSVG('path', { d, fill: 'none', stroke: '#475569', 'stroke-width': 2 }));
    });
    
    svgContainer.appendChild(group);
}

function drawScannedPoints() {
    // These dots stick to the surface as it rotates
    const { angle, toleranceTotal } = state;
    const limit = toleranceTotal / 2;
    const group = createSVG('g', {});
    
    state.scannedPoints.forEach(pt => {
        // Current World Angle = pt.theta + angle
        const currentTheta = pt.theta + angle;
        
        // Re-calculate position in 3D space
        const surfPt = getSurfacePoint(pt.h, currentTheta);
        const proj = project(surfPt.x, surfPt.y, surfPt.z);
        
        // Color
        const isPass = Math.abs(pt.val) <= limit;
        const color = isPass ? '#10b981' : '#ef4444';
        
        // Size
        // Simple Z-sorting visibility check?
        // If z > 0 (front), draw bigger/brighter
        const opacity = surfPt.z > 0 ? 1 : 0.3;
        
        group.appendChild(createSVG('circle', {
            cx: proj.x, cy: proj.y, r: 2,
            fill: color, opacity: opacity
        }));
    });
    
    svgContainer.appendChild(group);
}

function drawProbe() {
    // Probe is at fixed screen position, tracking the current scan height
    // Position: Front of cylinder (z max), Angle -PI/2 relative to rotation
    const { probeY } = state;
    
    // We visualize the probe at the "Front" of the cylinder
    // x=0, z=currentRadius
    const dummyPt = getSurfacePoint(probeY, -Math.PI/2); // Just to get radius
    // Visual position: Slightly offset from surface
    const pSurf = project(dummyPt.x, dummyPt.y, dummyPt.z);
    const pBody = project(dummyPt.x, dummyPt.y, dummyPt.z + 0.5); // Pull towards camera
    
    const group = createSVG('g', {});
    
    // Stylus
    group.appendChild(createSVG('line', {
        x1: pBody.x, y1: pBody.y, x2: pSurf.x, y2: pSurf.y,
        stroke: '#ef4444', 'stroke-width': 2
    }));
    
    // Probe Body
    group.appendChild(createSVG('rect', {
        x: pBody.x - 10, y: pBody.y - 10, width: 20, height: 40,
        fill: '#cbd5e1', stroke: '#1e293b'
    }));
    
    // Tip
    group.appendChild(createSVG('circle', {
        cx: pSurf.x, cy: pSurf.y, r: 4, fill: '#ef4444'
    }));
    
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { minReading, maxReading, toleranceTotal } = state;
    
    // Total FIM = Max - Min
    // If no readings yet, 0
    let fim = 0;
    if (minReading !== Infinity) {
        fim = maxReading - minReading;
    }
    
    const isPass = fim <= toleranceTotal;
    
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

    group.appendChild(addText('TOTAL RUNOUT SCAN', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('GLOBAL FIM:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(fim.toFixed(4)+'"', col2, by+80, 16, accent));
    
    group.appendChild(addText('TOLERANCE:', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceTotal.toFixed(4)+'"', col2, by+105, 14, 'white'));
    
    // Min/Max Readings
    group.appendChild(addText(`MIN: ${minReading === Infinity ? '---' : minReading.toFixed(4)}`, col1, by+135, 12, '#64748b'));
    group.appendChild(addText(`MAX: ${maxReading === -Infinity ? '---' : maxReading.toFixed(4)}`, col1+120, by+135, 12, '#64748b'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Visual Bar (FIM)
    const barY = by + 160;
    const barW = 340;
    const maxScale = toleranceTotal * 1.5;
    
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 12, fill: '#1e293b', rx: 6 }));
    
    const limitPix = (toleranceTotal / maxScale) * barW;
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+17, stroke: 'white', 'stroke-width': 2 }));
    
    const fillPix = Math.min(barW, (fim / maxScale) * barW);
    group.appendChild(createSVG('rect', { x: bx+20, y: barY+2, width: fillPix, height: 8, fill: accent, rx: 4 }));
    
    // Error Breakdown
    const subY = by + 190;
    const labelStyle = { 'font-size': '10', fill: '#64748b' };
    const errs = [
        { l: 'Eccentricity', v: state.eccentricity },
        { l: 'Taper', v: state.taper },
        { l: 'Bend', v: state.bend }
    ];
    errs.forEach((e, i) => {
        const x = bx + 20 + (i*110);
        group.appendChild(addText(e.l, x, subY, 10, '#64748b'));
        const valCol = Math.abs(e.v) > 0.0001 ? '#f59e0b' : '#334155';
        group.appendChild(addText(e.v.toFixed(4), x, subY+15, 12, valCol));
    });

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

    write("TOOL GUIDE: TOTAL RUNOUT", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. TOTAL SURFACE CONTROL", 24, '#6366f1', 'bold');
    write("Checks the ENTIRE surface simultaneously, not just slices.", 18, '#cbd5e1');
    write("Controls Circularity, Straightness, Angularity, Taper, and Concentricity.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. HELICAL SCAN", 24, '#6366f1', 'bold');
    write("The probe (Red dot) travels up and down while the part spins.", 18, '#cbd5e1');
    write("FIM is calculated from the worst points found ANYWHERE on the part.", 18, '#f59e0b');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Add Taper or Bend errors to see how they cause Total Runout failure.", 18, '#cbd5e1');
    write("(Circular Runout might pass Taper, but Total Runout will Fail).", 18, '#cbd5e1');
    
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
    svg.addEventListener('mousedown', () => {
        state.isScanning = !state.isScanning;
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
                    <span class="text-3xl">⌰</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceTotal}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400">A-B</div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Total Form Errors</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Eccentricity (Offset)</span>
                        <span id="val-ecc">0.000</span>
                    </div>
                    <input type="range" id="slide-ecc" min="0" max="0.010" step="0.0001" value="${state.eccentricity}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Taper (Conicity)</span>
                        <span id="val-taper">0.000</span>
                    </div>
                    <input type="range" id="slide-taper" min="0" max="0.010" step="0.0001" value="${state.taper}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Bend (Banana)</span>
                        <span id="val-bend">0.000</span>
                    </div>
                    <input type="range" id="slide-bend" min="0" max="0.010" step="0.0001" value="${state.bend}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
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
    
    // Sliders
    const sEcc = document.getElementById('slide-ecc');
    const sTaper = document.getElementById('slide-taper');
    const sBend = document.getElementById('slide-bend');

    // Values
    const vEcc = document.getElementById('val-ecc');
    const vTaper = document.getElementById('val-taper');
    const vBend = document.getElementById('val-bend');

    inputTol.oninput = (e) => { state.toleranceTotal = parseFloat(e.target.value) || 0; };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateDeforms = () => {
        state.eccentricity = parseFloat(sEcc.value);
        state.taper = parseFloat(sTaper.value);
        state.bend = parseFloat(sBend.value);
        
        vEcc.innerText = state.eccentricity.toFixed(4);
        vTaper.innerText = state.taper.toFixed(4);
        vBend.innerText = state.bend.toFixed(4);
        
        resetScan();
    };

    sEcc.oninput = updateDeforms;
    sTaper.oninput = updateDeforms;
    sBend.oninput = updateDeforms;

    btnReset.onclick = () => {
        sEcc.value = 0; sTaper.value = 0; sBend.value = 0;
        updateDeforms();
    };
}