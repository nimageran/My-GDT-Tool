// js/modules/form/cylindricity.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 300,             // Pixel scale
    toleranceRadial: 0.020, // Total radial width of zone (0.020 means +/- 0.010 from nominal)
    nominalRadius: 0.8,     // Base size
    height: 1.8,            // Cylinder height
    
    // Deformations (Unitless factors)
    deformTaper: 0.0,   // Change radius vs Height
    deformBend: 0.0,    // Shift Center vs Height
    deformBarrel: 0.0,  // Quadratic radius change
    deformOval: 0.0,    // 2-lobe deviations
    
    // 3D View Settings
    rotationY: 0.5, // Rotation angle (radians)
    tiltX: 0.3,     // Tilt angle
    
    // UI State
    isDragging: false,
    lastMouseX: 0,
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

// --- MATH HELPERS (3D ENGINE) ---

// Project 3D (x,y,z) to 2D (screenX, screenY)
function project(x, y, z) {
    const { center, scale, rotationY, tiltX } = state;
    
    // 1. Rotate around Y-axis (Spinning)
    const x1 = x * Math.cos(rotationY) - z * Math.sin(rotationY);
    const z1 = x * Math.sin(rotationY) + z * Math.cos(rotationY);
    
    // 2. Tilt around X-axis
    const y2 = y * Math.cos(tiltX) - z1 * Math.sin(tiltX);
    const z2 = y * Math.sin(tiltX) + z1 * Math.cos(tiltX);
    
    // 3. Perspective / Ortho Scale
    const px = center.x + (x1 * scale);
    const py = center.y - (y2 * scale); // Invert Y for screen coords
    
    return { x: px, y: py, z: z2 }; // Return Z for depth sorting if needed
}

// Calculate radius at specific height and angle (Applying deformations)
function getActualRadius(yNorm, angle) {
    const { nominalRadius, deformTaper, deformBarrel, deformOval } = state;
    
    // yNorm is -0.5 (bottom) to 0.5 (top)
    
    let r = nominalRadius;
    
    // 1. Taper: Linear change
    r += deformTaper * yNorm;
    
    // 2. Barrel/Hourglass: Quadratic (0 at ends, max at center)
    // Formula: (0.25 - y^2) peaks at 0.
    r += deformBarrel * (0.25 - (yNorm * yNorm));
    
    // 3. Ovality: 2-lobe shape
    r += deformOval * Math.cos(2 * angle) * 0.1;
    
    return r;
}

function getCenterShift(yNorm) {
    const { deformBend } = state;
    // Parabolic bend
    const shift = deformBend * (yNorm * yNorm * 4); 
    // Shift in X direction for visual simplicity
    return { x: shift, z: 0 };
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    // 1. Background Grid
    drawGrid();

    // 2. Tolerance Shells (Transparent Ghosts)
    drawToleranceGhosts();

    // 3. The Actual Cylinder Mesh
    drawCylinderMesh();

    // 4. Axis Line
    drawAxis();

    // 5. HUD
    drawFuturisticHUD();

    // 6. Guide
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawGrid() {
    // Simple perspective floor grid
    const group = createSVG('g', { stroke: '#e2e8f0', 'stroke-width': 1 });
    const floorY = -1.2;
    const size = 1.5;
    const step = 0.5;

    for(let i = -size; i <= size; i+=step) {
        // Z lines
        const p1 = project(i, floorY, -size);
        const p2 = project(i, floorY, size);
        group.appendChild(createSVG('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
        
        // X lines
        const p3 = project(-size, floorY, i);
        const p4 = project(size, floorY, i);
        group.appendChild(createSVG('line', { x1: p3.x, y1: p3.y, x2: p4.x, y2: p4.y }));
    }
    svgContainer.appendChild(group);
}

function drawToleranceGhosts() {
    // Draws two perfect cylinders representing the tolerance zone
    const { nominalRadius, height, toleranceRadial } = state;
    const halfTol = toleranceRadial / 2; // Radial distance
    
    // Inner Limit
    drawWireCylinder(nominalRadius - halfTol, height, '#3b82f6', 0.1, true);
    // Outer Limit
    drawWireCylinder(nominalRadius + halfTol, height, '#3b82f6', 0.1, true);
}

// Helper to draw a generic perfect cylinder (for ghosts)
function drawWireCylinder(rad, h, color, opacity, isDashed) {
    const group = createSVG('g', { stroke: color, opacity: opacity, fill: 'none', 'stroke-width': 1 });
    if (isDashed) group.setAttribute('stroke-dasharray', '5,5');

    const rings = 2; // Top and Bottom
    const segments = 24;
    
    // Draw Rings
    [-h/2, h/2].forEach(y => {
        let path = "";
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const x = rad * Math.cos(theta);
            const z = rad * Math.sin(theta);
            const p = project(x, y, z);
            path += (i===0 ? "M" : "L") + ` ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }
        group.appendChild(createSVG('path', { d: path }));
    });

    // Draw connecting lines (4 quadrants)
    for(let i=0; i<4; i++) {
        const theta = (i/4) * Math.PI * 2;
        const x = rad * Math.cos(theta);
        const z = rad * Math.sin(theta);
        const p1 = project(x, -h/2, z);
        const p2 = project(x, h/2, z);
        group.appendChild(createSVG('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
    }

    svgContainer.appendChild(group);
}

function drawCylinderMesh() {
    const { height, toleranceRadial } = state;
    const rings = 12;      // Vertical resolution
    const segments = 32;   // Radial resolution
    
    const group = createSVG('g', {});
    const halfTol = toleranceRadial / 2;

    // We build horizontal rings
    for (let r = 0; r <= rings; r++) {
        const yNorm = (r / rings) - 0.5; // -0.5 to 0.5
        const y = yNorm * height;
        const shift = getCenterShift(yNorm);
        
        let pathD = "";
        let isRingFail = false; // To color stroke if part of ring fails

        // Points cache to determine color segment by segment
        const points = [];

        for (let s = 0; s <= segments; s++) {
            const angle = (s / segments) * Math.PI * 2;
            const rad = getActualRadius(yNorm, angle);
            
            const x = shift.x + rad * Math.cos(angle);
            const z = shift.z + rad * Math.sin(angle);
            
            const p = project(x, y, z);
            
            // Validation
            const error = Math.abs(rad - state.nominalRadius);
            const isPass = error <= halfTol;
            if (!isPass) isRingFail = true;

            points.push({ p, isPass });
        }

        // Draw segments with specific colors
        for(let i=0; i<points.length-1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            // If either point fails, segment is red
            const color = (p1.isPass && p2.isPass) ? '#10b981' : '#ef4444';
            const strokeW = (p1.isPass && p2.isPass) ? 2 : 3;

            group.appendChild(createSVG('line', {
                x1: p1.p.x, y1: p1.p.y, x2: p2.p.x, y2: p2.p.y,
                stroke: color, 'stroke-width': strokeW
            }));
        }
    }

    // Draw Vertical Generators (Longitudinal lines)
    // We draw fewer of these to avoid clutter
    const generators = 8;
    for (let g = 0; g < generators; g++) {
        const angle = (g / generators) * Math.PI * 2;
        let prevP = null;
        let prevPass = true;

        for (let r = 0; r <= rings; r++) {
            const yNorm = (r / rings) - 0.5;
            const y = yNorm * height;
            const shift = getCenterShift(yNorm);
            const rad = getActualRadius(yNorm, angle);
            
            const x = shift.x + rad * Math.cos(angle);
            const z = shift.z + rad * Math.sin(angle);
            const p = project(x, y, z);
            
            const error = Math.abs(rad - state.nominalRadius);
            const isPass = error <= halfTol;

            if (prevP) {
                const color = (isPass && prevPass) ? '#10b981' : '#ef4444';
                const opacity = (isPass && prevPass) ? 0.5 : 0.8;
                
                group.appendChild(createSVG('line', {
                    x1: prevP.x, y1: prevP.y, x2: p.x, y2: p.y,
                    stroke: color, 'stroke-width': 1, opacity: opacity
                }));
            }
            prevP = p;
            prevPass = isPass;
        }
    }

    svgContainer.appendChild(group);
}

function drawAxis() {
    const { height } = state;
    // Drawn based on center shift
    const rings = 10;
    let path = "";
    
    for(let r=0; r<=rings; r++) {
        const yNorm = (r/rings) - 0.5;
        const y = yNorm * height;
        const shift = getCenterShift(yNorm);
        const p = project(shift.x, y, shift.z);
        path += (r===0 ? "M" : "L") + ` ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }

    const group = createSVG('g', {});
    group.appendChild(createSVG('path', {
        d: path,
        fill: 'none', stroke: '#f59e0b', 'stroke-width': 2, 'stroke-dasharray': '10,5'
    }));
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    // Calculate Error Magnitude
    // Standard Cylindricity = (Max Radius - Min Radius) relative to best fit.
    // Here we simplify: Max Deviation from Nominal.
    let maxR = 0;
    let minR = Infinity;
    
    // Sample points
    for(let r=0; r<=10; r++) {
        const yNorm = (r/10)-0.5;
        for(let a=0; a<16; a++) {
            const ang = (a/16)*Math.PI*2;
            const rad = getActualRadius(yNorm, ang);
            // Also need to account for center shift for true cylindricity (Minimum Zone)
            // But visual tolerance zone is fixed to nominal axis here for clarity.
            // Error = Deviation from Nominal Axis.
            
            // Adjust for Bend? 
            // The Tolerance Zone implies coaxial cylinders. 
            // If the axis bends, the surface moves out of the coaxial zone.
            // So deviation is (Shift + Radius) - Nominal? 
            // Approx:
            const shift = getCenterShift(yNorm).x; // Simplification
            const effRad = rad + Math.abs(shift); 
            
            if(effRad > maxR) maxR = effRad;
            if(effRad < minR) minR = effRad;
        }
    }
    
    const maxDev = Math.max(Math.abs(maxR - state.nominalRadius), Math.abs(minR - state.nominalRadius));
    // Actually, check against tolerance limits
    // Tolerance is Total Radial Width. So +/- (Tol/2).
    
    const limit = state.toleranceRadial / 2;
    const isPass = maxDev <= limit;
    
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

    group.appendChild(addText('CYLINDRICITY SCAN', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('MAX RADIAL DEV:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(maxDev.toFixed(4)+'"', col2, by+80, 14, accent));
    
    group.appendChild(addText('ALLOWED RADIUS (+/-):', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(limit.toFixed(4)+'"', col2, by+105, 14, 'white'));
    
    group.appendChild(addText('TOTAL TOLERANCE:', col1, by+130, 14, '#cbd5e1'));
    group.appendChild(addText(state.toleranceRadial.toFixed(4)+'"', col2, by+130, 14, 'white'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Error Component Breakdown (Mini bars)
    const subY = by + 160;
    const labels = ['Taper', 'Bend', 'Oval', 'Barrl'];
    const vals = [state.deformTaper, state.deformBend, state.deformOval, state.deformBarrel];
    
    vals.forEach((v, i) => {
        const lx = col1 + (i * 90);
        const barH = Math.min(40, Math.abs(v) * 2000); // Scale factor for visuals
        const color = Math.abs(v) > 0.005 ? '#f59e0b' : '#334155';
        
        group.appendChild(addText(labels[i], lx, subY, 10, '#64748b'));
        group.appendChild(createSVG('rect', {
            x: lx, y: subY + 10 + (40-barH), width: 15, height: barH,
            fill: color
        }));
        group.appendChild(createSVG('rect', {
            x: lx, y: subY + 10, width: 15, height: 40,
            fill: 'none', stroke: '#334155'
        }));
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

    write("TOOL GUIDE: CYLINDRICITY", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. TOTAL FORM CONTROL", 24, '#6366f1', 'bold');
    write("It controls Circularity, Straightness, and Parallelism simultaneously.", 18, '#cbd5e1');
    write("The surface must lie between two concentric cylinders.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. VISUALIZATION", 24, '#6366f1', 'bold');
    write("The faint blue rings are the Tolerance Zone boundaries.", 18, '#cbd5e1');
    write("Green lines = Pass. Red lines = Fail.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Click and drag left/right to ROTATE the view.", 18, '#cbd5e1');
    write("Use the sliders to introduce specific manufacturing errors.", 18, '#cbd5e1');
    
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
    svg.addEventListener('mousedown', (evt) => {
        if(state.showGuide) return; 
        state.isDragging = true;
        state.lastMouseX = evt.clientX;
        svg.style.cursor = 'grabbing';
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        
        const dx = evt.clientX - state.lastMouseX;
        state.lastMouseX = evt.clientX;
        
        // Rotate view
        state.rotationY += dx * 0.01;
        
        renderScene();
    });

    svg.addEventListener('mouseup', () => {
        state.isDragging = false;
        svg.style.cursor = 'default';
    });
    
    svg.addEventListener('mouseleave', () => {
        state.isDragging = false;
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
                <div class="px-3 py-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceRadial}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
            </div>
            <p class="text-xs text-slate-400 mt-2 italic">*No Datum References</p>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Form Errors</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Taper (Conicity)</span>
                        <span id="val-taper">0.000</span>
                    </div>
                    <input type="range" id="slide-taper" min="-0.03" max="0.03" step="0.001" value="${state.deformTaper}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Barrel / Hourglass</span>
                        <span id="val-barrel">0.000</span>
                    </div>
                    <input type="range" id="slide-barrel" min="-0.03" max="0.03" step="0.001" value="${state.deformBarrel}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Bend (Banana)</span>
                        <span id="val-bend">0.000</span>
                    </div>
                    <input type="range" id="slide-bend" min="-0.03" max="0.03" step="0.001" value="${state.deformBend}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Ovality (Lobing)</span>
                        <span id="val-oval">0.000</span>
                    </div>
                    <input type="range" id="slide-oval" min="0" max="0.03" step="0.001" value="${state.deformOval}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <button id="btn-reset" class="mt-4 w-full text-xs bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded text-slate-700 font-bold">RESET SHAPE</button>
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const btnGuide = document.getElementById('btn-guide');
    const btnReset = document.getElementById('btn-reset');
    
    // Sliders
    const sTaper = document.getElementById('slide-taper');
    const sBarrel = document.getElementById('slide-barrel');
    const sBend = document.getElementById('slide-bend');
    const sOval = document.getElementById('slide-oval');

    // Values
    const vTaper = document.getElementById('val-taper');
    const vBarrel = document.getElementById('val-barrel');
    const vBend = document.getElementById('val-bend');
    const vOval = document.getElementById('val-oval');

    inputTol.oninput = (e) => { state.toleranceRadial = parseFloat(e.target.value) || 0; renderScene(); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateDeforms = () => {
        state.deformTaper = parseFloat(sTaper.value);
        state.deformBarrel = parseFloat(sBarrel.value);
        state.deformBend = parseFloat(sBend.value);
        state.deformOval = parseFloat(sOval.value);
        
        vTaper.innerText = state.deformTaper.toFixed(3);
        vBarrel.innerText = state.deformBarrel.toFixed(3);
        vBend.innerText = state.deformBend.toFixed(3);
        vOval.innerText = state.deformOval.toFixed(3);
        
        renderScene();
    };

    sTaper.oninput = updateDeforms;
    sBarrel.oninput = updateDeforms;
    sBend.oninput = updateDeforms;
    sOval.oninput = updateDeforms;

    btnReset.onclick = () => {
        sTaper.value = 0; sBarrel.value = 0; sBend.value = 0; sOval.value = 0;
        updateDeforms();
    };
}