// js/modules/form/circularity.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 2000,            // Deviation Magnification (For visuals only)
    nominalRadiusPx: 250,   // Visual size of the base circle on screen
    toleranceRadial: 0.005, // Total radial width (0.005 means Gap between concentric circles)
    
    // Deformations (Amplitudes in INCHES)
    ampOval: 0.000,    // 2-Lobe
    ampTri: 0.000,     // 3-Lobe
    ampNoise: 0.000,   // Random
    phaseOffset: 0,    // Rotation of the part
    
    // Data Cache
    points: [],        // {x, y, r, angle}
    stats: { maxR: 0, minR: 0, error: 0 },
    
    // UI State
    isDragging: false,
    lastAngle: 0,
    showGuide: false
};

// --- DOM REFERENCES ---
let svgContainer = null;
let controlsContainer = null;

// --- EXPORTED METHODS ---

export function draw(svg) {
    svgContainer = svg;
    setupInteractions(svg);
    recalculateProfile(); // Generate initial data
    renderScene();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// --- MATH & DATA GENERATION ---

function recalculateProfile() {
    const { nominalRadiusPx, scale, ampOval, ampTri, ampNoise, phaseOffset } = state;
    const numPoints = 360;
    
    state.points = [];
    
    // Generate raw polar coordinates
    // We assume the Nominal Radius in Inches is, say, 1.0"
    // The screen radius 'nominalRadiusPx' represents 1.0".
    // Deviations are added to this.
    
    let sumX = 0, sumY = 0;
    
    // 1. Generate Shape (Centered at 0,0 locally)
    const rawPoints = [];
    for(let i=0; i<numPoints; i++) {
        const theta = (i * Math.PI / 180);
        const thetaRot = theta - phaseOffset;
        
        // Math: Deviation = A*cos(2t) + B*cos(3t) + Noise
        // Note: We use Cosine for lobes.
        let deviation = 
            (ampOval * Math.cos(2 * thetaRot)) + 
            (ampTri * Math.cos(3 * thetaRot)) + 
            (Math.random() * ampNoise - (ampNoise/2));
            
        // Convert deviation to pixels
        const rPx = nominalRadiusPx + (deviation * scale);
        
        const x = rPx * Math.cos(theta);
        const y = rPx * Math.sin(theta);
        
        rawPoints.push({ x, y, rPx, deviation });
        
        sumX += x;
        sumY += y;
    }
    
    // 2. Least Squares Centering (LSC)
    // Find centroid to simulate "floating" the part to best center
    const avgX = sumX / numPoints;
    const avgY = sumY / numPoints;
    
    // 3. Re-calculate Radii relative to Centroid
    // Circularity is independent of location, so we measure from the LSC.
    let maxR = -Infinity;
    let minR = Infinity;
    
    state.points = rawPoints.map(p => {
        // Shift point so centroid is at (0,0)
        const centeredX = p.x - avgX;
        const centeredY = p.y - avgY;
        
        // New Radius from centroid
        const rNew = Math.sqrt(centeredX*centeredX + centeredY*centeredY);
        
        if (rNew > maxR) maxR = rNew;
        if (rNew < minR) minR = rNew;
        
        return {
            x: centeredX,
            y: centeredY,
            r: rNew
        };
    });
    
    // Convert back to inches for stats
    // Error in Pixels / Scale
    const errorPx = maxR - minR;
    state.stats.maxR = maxR;
    state.stats.minR = minR;
    state.stats.error = errorPx / scale;
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    // 1. Background Polar Grid
    drawPolarGrid();

    // 2. Tolerance Zone (The two concentric circles)
    drawToleranceZone();

    // 3. The Profile Line
    drawProfile();

    // 4. Center Marker
    drawCenterMarker();

    // 5. HUD
    drawFuturisticHUD();

    // 6. Guide
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawPolarGrid() {
    const { center, nominalRadiusPx } = state;
    const group = createSVG('g', { stroke: '#e2e8f0', 'stroke-width': 1, fill: 'none' });
    
    // Concentric rings
    // Draw 4 rings inside/outside nominal
    for (let r = 50; r <= 450; r += 50) {
        const opacity = (r === nominalRadiusPx) ? 1.0 : 0.3;
        const color = (r === nominalRadiusPx) ? '#94a3b8' : '#e2e8f0';
        const dash = (r === nominalRadiusPx) ? '5,5' : 'none';
        
        group.appendChild(createSVG('circle', {
            cx: center.x, cy: center.y, r: r,
            stroke: color, opacity: opacity, 'stroke-dasharray': dash
        }));
    }
    
    // Radial spokes (every 30 deg)
    for (let i = 0; i < 360; i += 30) {
        const rad = i * Math.PI / 180;
        const x2 = center.x + 450 * Math.cos(rad);
        const y2 = center.y + 450 * Math.sin(rad);
        group.appendChild(createSVG('line', {
            x1: center.x, y1: center.y, x2: x2, y2: y2
        }));
    }

    svgContainer.appendChild(group);
}

function drawToleranceZone() {
    const { center, stats } = state;
    const { maxR, minR } = stats; // These are in pixels
    
    const group = createSVG('g', {});
    
    // Outer Circle (Minimum Circumscribed-ish)
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: center.y, r: maxR,
        fill: 'none', stroke: '#3b82f6', 'stroke-width': 1, 'stroke-dasharray': '10,5'
    }));
    
    // Inner Circle (Maximum Inscribed-ish)
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: center.y, r: minR,
        fill: 'none', stroke: '#3b82f6', 'stroke-width': 1, 'stroke-dasharray': '10,5'
    }));

    // Fill between (Donut)
    // SVG fill rule 'evenodd' handles donuts if path is M.. outer .. M .. inner
    // But circles are easier to just layer.
    // Largest circle with low opacity
    // Smallest circle white (to mask center)? No, grid is behind.
    // Use path with hole.
    const path = `M ${center.x},${center.y-maxR} A ${maxR},${maxR} 0 1,0 ${center.x},${center.y+maxR} A ${maxR},${maxR} 0 1,0 ${center.x},${center.y-maxR} Z ` +
                 `M ${center.x},${center.y-minR} A ${minR},${minR} 0 1,1 ${center.x},${center.y+minR} A ${minR},${minR} 0 1,1 ${center.x},${center.y-minR} Z`;
    
    group.appendChild(createSVG('path', {
        d: path,
        fill: 'rgba(59, 130, 246, 0.1)', 'fill-rule': 'evenodd'
    }));

    svgContainer.appendChild(group);
}

function drawProfile() {
    const { center, points, stats, toleranceRadial, scale } = state;
    const { error } = stats;
    
    const isPass = error <= toleranceRadial;
    const color = isPass ? '#10b981' : '#ef4444'; // Green / Red
    
    const group = createSVG('g', {});
    
    // Build Path
    let d = "";
    points.forEach((p, i) => {
        const cx = center.x + p.x;
        const cy = center.y + p.y;
        d += (i === 0 ? "M" : "L") + ` ${cx.toFixed(1)},${cy.toFixed(1)}`;
    });
    d += " Z"; // Close loop

    group.appendChild(createSVG('path', {
        d: d,
        fill: 'none', stroke: color, 'stroke-width': 3
    }));

    svgContainer.appendChild(group);
}

function drawCenterMarker() {
    const { center } = state;
    const group = createSVG('g', {});
    
    // Crosshair at geometric center
    group.appendChild(createSVG('line', { x1: center.x-10, y1: center.y, x2: center.x+10, y2: center.y, stroke: '#3b82f6', 'stroke-width': 2 }));
    group.appendChild(createSVG('line', { x1: center.x, y1: center.y-10, x2: center.x, y2: center.y+10, stroke: '#3b82f6', 'stroke-width': 2 }));
    
    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { stats, toleranceRadial } = state;
    const { error } = stats;
    const isPass = error <= toleranceRadial;
    
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

    group.appendChild(addText('CIRCULARITY PLOT', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    // Stats
    group.appendChild(addText('RADIAL SEPARATION:', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(error.toFixed(5)+'"', col2, by+80, 16, accent));
    
    group.appendChild(addText('TOLERANCE WIDTH:', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceRadial.toFixed(4)+'"', col2, by+105, 14, 'white'));
    
    // MIC/MCC (Inner/Outer radii relative to nominal isn't strictly needed for GD&T check, just the gap)
    
    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Bar Graph
    const barY = by + 150;
    const barW = 340;
    const maxScale = toleranceRadial * 1.5;
    
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 12, fill: '#1e293b', rx: 6 }));
    
    const limitPix = (toleranceRadial / maxScale) * barW;
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+17, stroke: 'white', 'stroke-width': 2 }));
    
    const fillPix = Math.min(barW, (error / maxScale) * barW);
    group.appendChild(createSVG('rect', { x: bx+20, y: barY+2, width: fillPix, height: 8, fill: accent, rx: 4 }));
    
    // Visual Aids for Deformation
    const subY = by + 190;
    // Simple indicators if Oval or Tri is active
    const drawInd = (lbl, val, x) => {
        const c = Math.abs(val) > 0.0001 ? '#f59e0b' : '#334155';
        group.appendChild(addText(lbl, x, subY, 10, '#64748b'));
        group.appendChild(createSVG('circle', { cx: x+10, cy: subY+15, r: 6, fill: c }));
    };
    
    drawInd('OVAL', state.ampOval, bx+20);
    drawInd('LOBING', state.ampTri, bx+100);
    drawInd('NOISE', state.ampNoise, bx+180);

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

    write("TOOL GUIDE: CIRCULARITY (ROUNDNESS)", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. DEFINITION", 24, '#6366f1', 'bold');
    write("Controls the roundness of a cross-section.", 18, '#cbd5e1');
    write("The profile must lie between two concentric circles.", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. TOLERANCE ZONE", 24, '#6366f1', 'bold');
    write("The Zone (Blue Band) floats to best fit the shape.", 18, '#cbd5e1');
    write("It is not fixed to a center point; it finds its own center.", 18, '#cbd5e1');
    write("Error = Radial Separation between Inner and Outer circles.", 18, '#f59e0b');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Use sliders to add Ovality (2-lobe) or Triangulation (3-lobe).", 18, '#cbd5e1');
    write("Rotate the part to see the inspection update.", 18, '#cbd5e1');
    
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
    // Rotation Logic
    svg.addEventListener('mousedown', (evt) => {
        if(state.showGuide) return; 
        state.isDragging = true;
        svg.style.cursor = 'grabbing';
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        state.phaseOffset += 0.05; // Spin speed
        recalculateProfile();
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
                    <span class="text-3xl">○</span>
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
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Profile Errors</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Ovality (2-Lobe)</span>
                        <span id="val-oval">0.000</span>
                    </div>
                    <input type="range" id="slide-oval" min="0" max="0.005" step="0.0001" value="${state.ampOval}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Triangulation (3-Lobe)</span>
                        <span id="val-tri">0.000</span>
                    </div>
                    <input type="range" id="slide-tri" min="0" max="0.005" step="0.0001" value="${state.ampTri}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>

                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Random Noise (Chatter)</span>
                        <span id="val-noise">0.000</span>
                    </div>
                    <input type="range" id="slide-noise" min="0" max="0.003" step="0.0001" value="${state.ampNoise}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <button id="btn-reset" class="mt-4 w-full text-xs bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded text-slate-700 font-bold">RESET SHAPE</button>
        </div>
        
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
             <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-500">VISUAL MAGNIFICATION</span>
            </div>
            <input type="range" id="ctrl-zoom" min="500" max="5000" step="100" value="${state.scale}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputZoom = document.getElementById('ctrl-zoom');
    const btnGuide = document.getElementById('btn-guide');
    const btnReset = document.getElementById('btn-reset');
    
    // Sliders
    const sOval = document.getElementById('slide-oval');
    const sTri = document.getElementById('slide-tri');
    const sNoise = document.getElementById('slide-noise');

    // Values
    const vOval = document.getElementById('val-oval');
    const vTri = document.getElementById('val-tri');
    const vNoise = document.getElementById('val-noise');

    inputTol.oninput = (e) => { state.toleranceRadial = parseFloat(e.target.value) || 0; recalculateProfile(); renderScene(); };
    inputZoom.oninput = (e) => { state.scale = parseFloat(e.target.value); recalculateProfile(); renderScene(); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateDeforms = () => {
        state.ampOval = parseFloat(sOval.value);
        state.ampTri = parseFloat(sTri.value);
        state.ampNoise = parseFloat(sNoise.value);
        
        vOval.innerText = state.ampOval.toFixed(4);
        vTri.innerText = state.ampTri.toFixed(4);
        vNoise.innerText = state.ampNoise.toFixed(4);
        
        recalculateProfile();
        renderScene();
    };

    sOval.oninput = updateDeforms;
    sTri.oninput = updateDeforms;
    sNoise.oninput = updateDeforms;

    btnReset.onclick = () => {
        sOval.value = 0; sTri.value = 0; sNoise.value = 0;
        updateDeforms();
    };
}