// js/modules/location/concentricity.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    visualScale: 200,        // Scale for the main part view
    errorScale: 3000,        // EXAGGERATED scale for the center "Microscope" view
    toleranceDiam: 0.005,    // The allowable zone
    partRadius: 1.5,         // Nominal size
    
    // Manufacturing Defects
    eccentricity: 0.000,     // Linear offset of the form
    asymmetry: 0.000,        // One side bulging more than the other
    lobing: 0.000,           // 3-Lobe form error (common concentricity killer)
    
    // Animation
    scanAngle: 0,            // Current angle of the caliper probes
    isScanning: true,
    scanSpeed: 0.02,
    
    // Data Accumulation
    midpoints: [],           // History of derived median points
    
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
    state.midpoints = []; // Reset history
    startAnimation();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// --- ANIMATION LOOP ---

function startAnimation() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    function loop() {
        if (!svgContainer) return;
        
        if (state.isScanning) {
            state.scanAngle += state.scanSpeed;
            if (state.scanAngle > Math.PI) {
                state.scanAngle = 0; // Reset after 180 (symmetry covers 360)
                // Optional: clear points to loop cleaner? 
                // state.midpoints = []; 
            }
            
            // Calculate and Store Data for this frame
            calculateInstantaneousMidpoint();
            
            renderScene();
        }
        animationFrameId = requestAnimationFrame(loop);
    }
    loop();
}

// --- MATHEMATICS (The Core Logic) ---

// Returns the radius of the part at a specific angle theta
function getPartRadiusAt(theta) {
    const { partRadius, eccentricity, asymmetry, lobing } = state;
    
    // Base Circle
    let r = partRadius;
    
    // 1. Eccentricity (Offset center)
    // Modeled as a 1-lobe cosine wave roughly
    r += eccentricity * Math.cos(theta);
    
    // 2. Lobing (Triangulation/3-lobe)
    r += lobing * Math.cos(3 * theta);
    
    // 3. Asymmetry (Localized bulge at 0 degrees)
    // Gaussian bump
    const bulge = Math.exp(-5 * Math.pow(theta, 2));
    r += asymmetry * bulge;
    
    return r;
}

function calculateInstantaneousMidpoint() {
    const theta1 = state.scanAngle;
    const theta2 = state.scanAngle + Math.PI; // Directly opposite
    
    // Get actual radius at both probe tips
    const r1 = getPartRadiusAt(theta1);
    const r2 = getPartRadiusAt(theta2);
    
    // Convert to Cartesian (World Coordinates relative to Datum 0,0)
    const p1 = { x: r1 * Math.cos(theta1), y: r1 * Math.sin(theta1) };
    const p2 = { x: r2 * Math.cos(theta2), y: r2 * Math.sin(theta2) };
    
    // CALCULATE DERIVED MEDIAN POINT
    // Midpoint = (P1 + P2) / 2
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    
    // Distance from Datum (0,0)
    const deviation = Math.sqrt(midX*midX + midY*midY) * 2; // *2 because GD&T is Diameter
    
    state.midpoints.push({
        x: midX,
        y: midY,
        dev: deviation,
        angle: state.scanAngle
    });
    
    // Limit history length
    if (state.midpoints.length > 360) state.midpoints.shift();
}

// --- RENDERING ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    drawGrid();
    drawDatumSystem();
    drawPartShape();
    drawScanningProbes(); // The "Lasers"
    drawMicroscopeView(); // The Zoomed tolerance check
    drawFuturisticHUD();
    
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawGrid() {
    const { center } = state;
    const group = createSVG('g', { stroke: '#f1f5f9', 'stroke-width': 1 });
    // Radar grid
    for(let r=100; r<=400; r+=100) {
        group.appendChild(createSVG('circle', { cx: center.x, cy: center.y, r: r, fill: 'none' }));
    }
    group.appendChild(createSVG('line', { x1: center.x-400, y1: center.y, x2: center.x+400, y2: center.y }));
    group.appendChild(createSVG('line', { x1: center.x, y1: center.y-400, x2: center.x, y2: center.y+400 }));
    svgContainer.appendChild(group);
}

function drawDatumSystem() {
    const { center } = state;
    const group = createSVG('g', {});
    
    // Datum Symbol at Center
    const size = 15;
    group.appendChild(createSVG('line', { x1: center.x-size, y1: center.y, x2: center.x+size, y2: center.y, stroke: '#f59e0b', 'stroke-width': 2 }));
    group.appendChild(createSVG('line', { x1: center.x, y1: center.y-size, x2: center.x, y2: center.y+size, stroke: '#f59e0b', 'stroke-width': 2 }));
    
    // Label
    const txt = createSVG('text', { x: center.x+5, y: center.y-5, fill: '#f59e0b', 'font-weight': 'bold', 'font-size': '12' });
    txt.textContent = "DATUM A";
    group.appendChild(txt);
    
    svgContainer.appendChild(group);
}

function drawPartShape() {
    const { center, visualScale } = state;
    const group = createSVG('g', {});
    
    // Draw the full perimeter shape
    let d = "";
    const res = 120;
    for(let i=0; i<=res; i++) {
        const theta = (i/res) * Math.PI * 2;
        const r = getPartRadiusAt(theta) * visualScale;
        const x = center.x + r * Math.cos(theta);
        const y = center.y - r * Math.sin(theta); // SVG Y flip
        d += (i===0 ? "M" : "L") + ` ${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += " Z";
    
    // Fill with slight opacity
    group.appendChild(createSVG('path', {
        d: d,
        fill: 'rgba(100, 116, 139, 0.1)',
        stroke: '#475569', 'stroke-width': 2
    }));
    
    svgContainer.appendChild(group);
}

function drawScanningProbes() {
    const { center, scanAngle, visualScale } = state;
    
    const theta1 = scanAngle;
    const theta2 = scanAngle + Math.PI;
    
    const r1 = getPartRadiusAt(theta1) * visualScale;
    const r2 = getPartRadiusAt(theta2) * visualScale;
    
    const x1 = center.x + r1 * Math.cos(theta1);
    const y1 = center.y - r1 * Math.sin(theta1);
    const x2 = center.x + r2 * Math.cos(theta2);
    const y2 = center.y - r2 * Math.sin(theta2);
    
    const group = createSVG('g', {});
    
    // 1. Probe Line (Connecting the points)
    group.appendChild(createSVG('line', {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: '#3b82f6', 'stroke-width': 1, 'stroke-dasharray': '5,5'
    }));
    
    // 2. Probe Tips (Arrows)
    const drawProbeTip = (x, y, theta) => {
        // Draw a little arrow pointing inward
        const len = 40;
        const ox = x + len * Math.cos(theta);
        const oy = y - len * Math.sin(theta);
        
        group.appendChild(createSVG('line', {
            x1: ox, y1: oy, x2: x, y2: y,
            stroke: '#ef4444', 'stroke-width': 3
        }));
        group.appendChild(createSVG('circle', {
            cx: x, cy: y, r: 4, fill: '#ef4444'
        }));
    };
    
    drawProbeTip(x1, y1, theta1);
    drawProbeTip(x2, y2, theta2);
    
    // 3. Label "Opposed Elements"
    const txt = createSVG('text', {
        x: x1 + 10, y: y1 - 10, 
        fill: '#ef4444', 'font-size': '12', 'font-family': 'monospace'
    });
    txt.textContent = "SCANNING...";
    group.appendChild(txt);

    svgContainer.appendChild(group);
}

function drawMicroscopeView() {
    // This is the CRITICAL visualization.
    // It takes the microscopic errors and blows them up 1000x at the center of the screen.
    const { center, midpoints, errorScale, toleranceDiam } = state;
    
    const group = createSVG('g', {});
    
    // 1. Magnifying Glass Circle Background
    const magR = 150;
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: center.y, r: magR,
        fill: '#0f172a', stroke: '#cbd5e1', 'stroke-width': 4
    }));
    
    // 2. Tolerance Zone (Scaled)
    // Tolerance is Diameter, so radius = diam/2
    const zoneR = (toleranceDiam / 2) * errorScale;
    
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: center.y, r: zoneR,
        fill: 'rgba(34, 197, 94, 0.1)', // Green tint
        stroke: '#22c55e', 'stroke-width': 2, 'stroke-dasharray': '4,2'
    }));
    
    // Label Zone
    group.appendChild(createSVG('text', {
        x: center.x, y: center.y - zoneR - 10,
        fill: '#22c55e', 'text-anchor': 'middle', 'font-size': '12', 'font-weight': 'bold'
    })).textContent = `TOLERANCE Ø${toleranceDiam}"`;
    
    // 3. Plot the Median Points Cloud
    let maxDev = 0;
    
    midpoints.forEach(pt => {
        // PT is calculated in inches offset from 0,0. Scale it up.
        const px = center.x + pt.x * errorScale;
        const py = center.y - pt.y * errorScale; // Y flip
        
        // Pass/Fail color
        // pt.dev is the positional diameter deviation (2 * radius)
        const isPass = pt.dev <= toleranceDiam;
        const color = isPass ? '#22c55e' : '#ef4444';
        
        // Trail effect
        group.appendChild(createSVG('circle', {
            cx: px, cy: py, r: 2,
            fill: color, opacity: 0.6
        }));
        
        // Connect lines for trace effect
        // (Skipped for performance, dots are fine for "Cloud" effect)
        
        if (pt.dev > maxDev) maxDev = pt.dev;
    });
    
    // 4. Current Midpoint Target
    if (midpoints.length > 0) {
        const last = midpoints[midpoints.length-1];
        const lx = center.x + last.x * errorScale;
        const ly = center.y - last.y * errorScale;
        
        // Crosshair on the current spot
        group.appendChild(createSVG('line', { x1: lx-10, y1: ly, x2: lx+10, y2: ly, stroke: 'white' }));
        group.appendChild(createSVG('line', { x1: lx, y1: ly-10, x2: lx, y2: ly+10, stroke: 'white' }));
        
        // Label Value
        const lbl = createSVG('text', {
            x: lx + 12, y: ly, fill: 'white', 'font-family': 'monospace', 'font-size': '12'
        });
        lbl.textContent = `DEV: ${last.dev.toFixed(5)}"`;
        group.appendChild(lbl);
    }
    
    // 5. Title
    const title = createSVG('text', {
        x: center.x, y: center.y + magR - 20, 
        fill: '#94a3b8', 'text-anchor': 'middle', 'font-family': 'sans-serif', 'font-size': '10', 'letter-spacing': '2px'
    });
    title.textContent = "MEDIAN POINT MICROSCOPE (3000x)";
    group.appendChild(title);

    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { midpoints, toleranceDiam } = state;
    
    // Find worst deviation in current buffer
    let maxDev = 0;
    midpoints.forEach(p => maxDev = Math.max(maxDev, p.dev));
    
    const isPass = maxDev <= toleranceDiam;
    const accent = isPass ? '#22c55e' : '#ef4444'; 
    
    const group = createSVG('g', {});
    const bx = 20, by = 20, bw = 380, bh = 240;
    
    group.appendChild(createSVG('rect', {
        x: bx, y: by, width: bw, height: bh,
        fill: '#0f172a', stroke: accent, 'stroke-width': 2
    }));

    const addText = (txt, x, y, size, color, weight='bold') => {
        const t = createSVG('text', { x, y, fill: color, 'font-family': 'JetBrains Mono', 'font-size': size, 'font-weight': weight });
        t.textContent = txt;
        return t;
    };

    group.appendChild(addText('CONCENTRICITY SCAN', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('MEDIAN DEVIATION:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(maxDev.toFixed(5)+'"', col2, by+80, 16, accent));
    
    group.appendChild(addText('ALLOWED ZONE (Ø):', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceDiam.toFixed(4)+'"', col2, by+105, 14, 'white'));

    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Bar Graph
    const barY = by + 150;
    const barW = 340;
    const maxScale = toleranceDiam * 2.0;
    
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 12, fill: '#1e293b', rx: 6 }));
    
    const limitPix = (toleranceDiam / maxScale) * barW;
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+17, stroke: 'white', 'stroke-width': 2 }));
    
    const fillPix = Math.min(barW, (maxDev / maxScale) * barW);
    group.appendChild(createSVG('rect', { x: bx+20, y: barY+2, width: fillPix, height: 8, fill: accent, rx: 4 }));
    
    // Explanation
    const noteX = bx+20;
    const noteY = by+190;
    group.appendChild(addText("Calculation Logic:", noteX, noteY, 10, '#64748b'));
    group.appendChild(addText("1. Measure opposed points (P1, P2)", noteX, noteY+15, 10, '#64748b', 'normal'));
    group.appendChild(addText("2. Compute Midpoint M = (P1+P2)/2", noteX, noteY+30, 10, '#64748b', 'normal'));

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

    write("TOOL GUIDE: CONCENTRICITY", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. THE DEFINITION", 24, '#6366f1', 'bold');
    write("Concentricity controls the Derived Median Points.", 18, '#cbd5e1');
    write("It is NOT just about the surface circle.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. THE SCAN", 24, '#6366f1', 'bold');
    write("The red probes act as calipers measuring diameter.", 18, '#cbd5e1');
    write("We plot the CENTER of that caliper measurement.", 18, '#cbd5e1');
    yPos += 20;
    
    write("3. THE MICROSCOPE", 24, '#6366f1', 'bold');
    write("The center view magnifies errors 3000x.", 18, '#cbd5e1');
    write("Even if the part looks round, the center might wobble.", 18, '#cbd5e1');
    
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
    // Click to toggle pause
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
                    <span class="text-3xl">◎</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceDiam}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400">A</div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Geometric Errors (in)</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Eccentricity (Offset)</span>
                        <span id="val-ecc">0.000</span>
                    </div>
                    <input type="range" id="slide-ecc" min="0" max="0.005" step="0.0001" value="${state.eccentricity}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>3-Lobe (Form Error)</span>
                        <span id="val-lobe">0.000</span>
                    </div>
                    <input type="range" id="slide-lobe" min="0" max="0.005" step="0.0001" value="${state.lobing}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Asymmetry (Bulge)</span>
                        <span id="val-asym">0.000</span>
                    </div>
                    <input type="range" id="slide-asym" min="0" max="0.005" step="0.0001" value="${state.asymmetry}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <button id="btn-reset" class="mt-4 w-full text-xs bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded text-slate-700 font-bold">RESET SHAPE</button>
        </div>
        
        <div class="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 leading-relaxed mt-4">
             <i class="fa-solid fa-info-circle"></i> <strong>Pro Tip:</strong> Increase 3-Lobe error. The part stays "round" (constant diameter), but the center point creates a triangle path, causing concentricity failure!
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const btnGuide = document.getElementById('btn-guide');
    const btnReset = document.getElementById('btn-reset');
    
    const sEcc = document.getElementById('slide-ecc');
    const sLobe = document.getElementById('slide-lobe');
    const sAsym = document.getElementById('slide-asym');
    
    const vEcc = document.getElementById('val-ecc');
    const vLobe = document.getElementById('val-lobe');
    const vAsym = document.getElementById('val-asym');

    inputTol.oninput = (e) => { state.toleranceDiam = parseFloat(e.target.value) || 0; };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateParams = () => {
        state.eccentricity = parseFloat(sEcc.value);
        state.lobing = parseFloat(sLobe.value);
        state.asymmetry = parseFloat(sAsym.value);
        
        vEcc.innerText = state.eccentricity.toFixed(4);
        vLobe.innerText = state.lobing.toFixed(4);
        vAsym.innerText = state.asymmetry.toFixed(4);
        
        state.midpoints = []; // Clear history on change
    };

    sEcc.oninput = updateParams;
    sLobe.oninput = updateParams;
    sAsym.oninput = updateParams;

    btnReset.onclick = () => {
        sEcc.value = 0; sLobe.value = 0; sAsym.value = 0;
        updateParams();
    };
}