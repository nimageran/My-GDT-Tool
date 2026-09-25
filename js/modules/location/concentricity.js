// js/modules/location/concentricity.js

import { createSVG, readTolerance } from '../../drawing_utils.js';
import { COLORS, resultsCard } from '../../theme.js';

const f4 = v => `${v.toFixed(4)}"`;

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

// Called by main.js before another module takes over the canvas
export function unload() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    svgContainer = null;
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
    drawResultsCard();
    
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
        fill: '#ffffff', stroke: '#94a3b8', 'stroke-width': 3
    }));
    
    // 2. Tolerance Zone (Scaled)
    // Tolerance is Diameter, so radius = diam/2
    const zoneR = (toleranceDiam / 2) * errorScale;
    
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: center.y, r: zoneR,
        fill: 'rgba(59, 130, 246, 0.14)', // tolerance zone, blue as in the other tools
        stroke: '#2563eb', 'stroke-width': 2, 'stroke-dasharray': '8,5'
    }));
    
    // Label Zone
    group.appendChild(createSVG('text', {
        x: center.x, y: center.y - zoneR - 10,
        fill: '#1d4ed8', 'text-anchor': 'middle', 'font-size': '13', 'font-weight': 'bold'
    })).textContent = `Tolerance zone Ø${toleranceDiam}"`;
    
    // 3. Plot the Median Points Cloud
    let maxDev = 0;
    
    midpoints.forEach(pt => {
        // PT is calculated in inches offset from 0,0. Scale it up.
        const px = center.x + pt.x * errorScale;
        const py = center.y - pt.y * errorScale; // Y flip
        
        // Pass/Fail color
        // pt.dev is the positional diameter deviation (2 * radius)
        const isPass = pt.dev <= toleranceDiam;
        const color = isPass ? '#16a34a' : '#dc2626';
        
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
        group.appendChild(createSVG('line', { x1: lx-10, y1: ly, x2: lx+10, y2: ly, stroke: '#0f172a' }));
        group.appendChild(createSVG('line', { x1: lx, y1: ly-10, x2: lx, y2: ly+10, stroke: '#0f172a' }));
        
        // Label Value
        const lbl = createSVG('text', {
            x: lx + 12, y: ly, fill: '#0f172a', 'font-family': '"JetBrains Mono", ui-monospace, monospace', 'font-size': '12'
        });
        lbl.textContent = `off by Ø${last.dev.toFixed(5)}"`;
        group.appendChild(lbl);
    }
    
    // 5. Title
    const title = createSVG('text', {
        x: center.x, y: center.y + magR - 20, 
        fill: '#64748b', 'text-anchor': 'middle', 'font-family': 'sans-serif', 'font-size': '12'
    });
    title.textContent = "Midpoints, magnified 3000×";
    group.appendChild(title);

    svgContainer.appendChild(group);
}

function drawResultsCard() {
    const { midpoints, toleranceDiam } = state;
    let maxDev = 0;
    midpoints.forEach(p => maxDev = Math.max(maxDev, p.dev));
    const pass = maxDev <= toleranceDiam;
    svgContainer.appendChild(resultsCard({
        title: 'Concentricity', pass,
        rows: [['Midpoints off the axis (Ø)', `${maxDev.toFixed(5)}"`, { strong: true, color: pass ? COLORS.pass : COLORS.fail }], ['Allowed zone (Ø)', f4(toleranceDiam)]],
        measured: maxDev, allowed: toleranceDiam,
        sentence: pass ? `Every midpoint of opposite points lies inside the Ø${toleranceDiam.toFixed(4)}" zone: it passes.`
            : `Some midpoints of opposite points fall outside the Ø${toleranceDiam.toFixed(4)}" zone: it fails.`,
        note: 'Midpoint: halfway between opposite points'
    }).g);
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
            
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Add errors (in)</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Off-centre (eccentricity)</span>
                        <span id="val-ecc">0.000</span>
                    </div>
                    <input type="range" id="slide-ecc" min="0" max="0.005" step="0.0001" value="${state.eccentricity}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>3-lobe (triangle-like)</span>
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
             <i class="fa-solid fa-info-circle"></i> <strong>Try it:</strong> increase the 3-lobe error. A caliper reads the same diameter everywhere, but the midpoints move off the axis, so concentricity fails.
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const btnReset = document.getElementById('btn-reset');
    
    const sEcc = document.getElementById('slide-ecc');
    const sLobe = document.getElementById('slide-lobe');
    const sAsym = document.getElementById('slide-asym');
    
    const vEcc = document.getElementById('val-ecc');
    const vLobe = document.getElementById('val-lobe');
    const vAsym = document.getElementById('val-asym');

    inputTol.oninput = (e) => { state.toleranceDiam = readTolerance(e.target.value); };

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