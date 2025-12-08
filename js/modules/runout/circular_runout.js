// js/modules/runout/circular_runout.js

import { createSVG } from '../../drawing_utils.js';

// --- STATE MANAGEMENT ---
const state = {
    // Canvas settings
    viewBox: { width: 1000, height: 800 },
    center: { x: 500, y: 400 },
    
    // Engineering Parameters (INCHES)
    scale: 2000,            // Visual Scale for deviations
    toleranceRunout: 0.010, // Total FIM allowed
    nominalRadius: 150,     // Pixel radius of the part
    
    // Defects (INCHES)
    eccentricity: 0.000,    // Offset from Datum Axis (Position error)
    ovality: 0.000,         // Form error (2-lobe)
    
    // Animation State
    angle: 0,               // Current rotation angle (radians)
    isRotating: true,
    speed: 0.02,
    
    // History for the Strip Chart
    history: [],            // Array of recent readings
    maxHistory: 200,
    
    // UI State
    isDragging: false,
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
        if (!svgContainer) return; // Exit if unmounted
        
        if (state.isRotating) {
            state.angle += state.speed;
            if (state.angle > Math.PI * 2) state.angle -= Math.PI * 2;
            
            // Record Data
            updateProbeReading();
            renderScene();
        }
        animationFrameId = requestAnimationFrame(loop);
    }
    loop();
}

function updateProbeReading() {
    // Calculate current surface deviation at the probe tip (Top of part, angle = -PI/2 relative to part)
    // Actually, if part rotates +theta, the probe at fixed position sees angle -theta.
    
    const { eccentricity, ovality } = state;
    
    // 1. Eccentricity Component (Sine wave 1UPR)
    // If the part is offset by 'e', the probe sees e * cos(theta)
    const runoutPos = eccentricity * Math.cos(state.angle);
    
    // 2. Ovality Component (Sine wave 2UPR)
    // 2 lobes
    const runoutForm = ovality * Math.cos(2 * state.angle);
    
    const totalDeviation = runoutPos + runoutForm;
    
    // Add to history
    state.history.push(totalDeviation);
    if (state.history.length > state.maxHistory) state.history.shift();
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = ''; 
    
    // 1. Definitions (Gradients)
    drawDefs();

    // 2. Background Grid
    drawGrid();

    // 3. The Datum V-Blocks (Holding the part)
    drawDatums();

    // 4. The Rotating Part (Cross Section)
    drawRotatingPart();

    // 5. The Dial Indicator
    drawIndicator();

    // 6. The Strip Chart (Graph)
    drawStripChart();

    // 7. HUD
    drawFuturisticHUD();

    // 8. Guide
    if (state.showGuide) drawGuideOverlay();
}

// --- DRAWING HELPERS ---

function drawDefs() {
    const defs = createSVG('defs', {});
    
    // Metallic Gradient for Part
    const grad = createSVG('linearGradient', { id: 'partGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
    grad.appendChild(createSVG('stop', { offset: '0%', 'stop-color': '#e2e8f0' }));
    grad.appendChild(createSVG('stop', { offset: '50%', 'stop-color': '#94a3b8' }));
    grad.appendChild(createSVG('stop', { offset: '100%', 'stop-color': '#64748b' }));
    
    defs.appendChild(grad);
    svgContainer.appendChild(defs);
}

function drawGrid() {
    const group = createSVG('g', { stroke: '#f1f5f9', 'stroke-width': 1 });
    // Simple background lines
    for(let i=0; i<1000; i+=50) group.appendChild(createSVG('line', { x1: i, y1: 0, x2: i, y2: 800 }));
    for(let i=0; i<800; i+=50) group.appendChild(createSVG('line', { x1: 0, y1: i, x2: 1000, y2: i }));
    svgContainer.appendChild(group);
}

function drawDatums() {
    const { center, nominalRadius } = state;
    const group = createSVG('g', {});
    
    // Draw V-Block shape below the part
    const vY = center.y + nominalRadius + 20;
    const vW = 100;
    
    const path = `M ${center.x - vW},${vY+100} L ${center.x - vW},${vY} L ${center.x},${vY + 60} L ${center.x + vW},${vY} L ${center.x + vW},${vY+100}`;
    
    group.appendChild(createSVG('path', {
        d: path,
        fill: '#1e293b', stroke: 'none'
    }));
    
    // Datum Axis Marker
    group.appendChild(createSVG('line', {
        x1: center.x, y1: center.y - 10, x2: center.x, y2: center.y + 10,
        stroke: '#f59e0b', 'stroke-width': 2
    }));
    group.appendChild(createSVG('line', {
        x1: center.x - 10, y1: center.y, x2: center.x + 10, y2: center.y,
        stroke: '#f59e0b', 'stroke-width': 2
    }));

    svgContainer.appendChild(group);
}

function drawRotatingPart() {
    const { center, nominalRadius, scale, eccentricity, ovality, angle } = state;
    
    // Calculate visualization offset
    // The Visual Eccentricity needs to be exaggerated 
    // We exaggerate rotation visuals but the chart is accurate
    const visScale = 1000; // Extra zoom for visual wobble
    
    const dx = eccentricity * visScale * Math.cos(angle);
    const dy = eccentricity * visScale * Math.sin(angle);
    
    const group = createSVG('g', { 
        transform: `translate(${center.x + dx}, ${center.y + dy}) rotate(${angle * 180 / Math.PI})` 
    });

    // Main Circle body
    // We draw an ellipse if there is ovality
    const rBase = nominalRadius;
    const rDeform = ovality * visScale; // Visual deformation
    
    // Create a path that looks like a circle but has the lobe error
    let d = "";
    const steps = 60;
    for(let i=0; i<=steps; i++) {
        const t = (i/steps) * Math.PI * 2;
        // Ovality adds radius at 0 and 180
        const r = rBase + (rDeform * Math.cos(2 * t));
        const x = r * Math.cos(t);
        const y = r * Math.sin(t);
        d += (i===0 ? "M" : "L") + ` ${x.toFixed(1)},${y.toFixed(1)}`;
    }
    
    group.appendChild(createSVG('path', {
        d: d,
        fill: 'url(#partGrad)', stroke: '#475569', 'stroke-width': 2
    }));
    
    // Visual features to show rotation (holes/spokes)
    group.appendChild(createSVG('circle', { cx: 80, cy: 0, r: 10, fill: '#334155' }));
    group.appendChild(createSVG('circle', { cx: -40, cy: 60, r: 10, fill: '#334155' }));
    group.appendChild(createSVG('circle', { cx: -40, cy: -60, r: 10, fill: '#334155' }));

    // Center Cross of the Part itself (Moving Axis)
    group.appendChild(createSVG('line', { x1: -10, y1: 0, x2: 10, y2: 0, stroke: '#475569' }));
    group.appendChild(createSVG('line', { x1: 0, y1: -10, x2: 0, y2: 10, stroke: '#475569' }));

    svgContainer.appendChild(group);
}

function drawIndicator() {
    const { center, nominalRadius, history, scale } = state;
    const currentDev = history[history.length - 1] || 0;
    
    // Probe Position (Top of circle)
    // The probe moves up/down based on deviation
    const probeY = center.y - nominalRadius - (currentDev * scale); // Scale for visual movement
    
    const group = createSVG('g', {});

    // 1. The Contact Point (Ball)
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: probeY, r: 4, fill: '#ef4444'
    }));
    
    // 2. The Stem
    const dialY = center.y - nominalRadius - 60;
    group.appendChild(createSVG('line', {
        x1: center.x, y1: probeY, x2: center.x, y2: dialY + 25,
        stroke: '#94a3b8', 'stroke-width': 4
    }));
    
    // 3. The Dial Face
    const dialR = 30;
    group.appendChild(createSVG('circle', {
        cx: center.x, cy: dialY, r: dialR,
        fill: 'white', stroke: '#1e293b', 'stroke-width': 2,
        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.2))'
    }));
    
    // 4. Dial Ticks
    for(let i=0; i<12; i++) {
        const rad = (i/12) * Math.PI * 2;
        const x1 = center.x + (dialR-5) * Math.cos(rad);
        const y1 = dialY + (dialR-5) * Math.sin(rad);
        const x2 = center.x + (dialR-2) * Math.cos(rad);
        const y2 = dialY + (dialR-2) * Math.sin(rad);
        group.appendChild(createSVG('line', { x1, y1, x2, y2, stroke: '#64748b' }));
    }
    
    // 5. The Needle
    // Map deviation to angle. 0.005 inch = 180 degrees?
    const needleAngle = (currentDev / 0.010) * Math.PI * 2 - (Math.PI/2); 
    const nx = center.x + (dialR-4) * Math.cos(needleAngle);
    const ny = dialY + (dialR-4) * Math.sin(needleAngle);
    
    group.appendChild(createSVG('line', {
        x1: center.x, y1: dialY, x2: nx, y2: ny,
        stroke: '#ef4444', 'stroke-width': 2
    }));

    svgContainer.appendChild(group);
}

function drawStripChart() {
    const { history, toleranceRunout } = state;
    const group = createSVG('g', {});
    
    // Chart Box Position
    const chartX = 650;
    const chartY = 100;
    const chartW = 300;
    const chartH = 150;
    
    // Background
    group.appendChild(createSVG('rect', {
        x: chartX, y: chartY, width: chartW, height: chartH,
        fill: 'rgba(255, 255, 255, 0.8)', stroke: '#cbd5e1', rx: 4
    }));
    
    // Tolerance Lines
    const midY = chartY + chartH/2;
    const scaleY = chartH / (toleranceRunout * 2); // Scale fit
    
    const limitTop = midY - (toleranceRunout/2 * scaleY);
    const limitBot = midY + (toleranceRunout/2 * scaleY);
    
    // Draw Limits
    group.appendChild(createSVG('line', { x1: chartX, y1: limitTop, x2: chartX+chartW, y2: limitTop, stroke: '#ef4444', 'stroke-dasharray': '4,2' }));
    group.appendChild(createSVG('line', { x1: chartX, y1: limitBot, x2: chartX+chartW, y2: limitBot, stroke: '#ef4444', 'stroke-dasharray': '4,2' }));
    
    // Plot Line
    let pathD = "";
    const stepX = chartW / state.maxHistory;
    
    history.forEach((val, i) => {
        const x = chartX + (i * stepX);
        const y = midY - (val * scaleY);
        // Clamp Y to box
        const yClamped = Math.max(chartY, Math.min(chartY + chartH, y));
        pathD += (i===0 ? "M" : "L") + ` ${x.toFixed(1)},${yClamped.toFixed(1)}`;
    });
    
    group.appendChild(createSVG('path', {
        d: pathD,
        fill: 'none', stroke: '#3b82f6', 'stroke-width': 1.5
    }));
    
    // Label
    const text = createSVG('text', { x: chartX+5, y: chartY+15, 'font-family': 'sans-serif', 'font-size': '10', fill: '#64748b' });
    text.textContent = "PROBE READINGS (TIR)";
    group.appendChild(text);

    svgContainer.appendChild(group);
}

function drawFuturisticHUD() {
    const { history, toleranceRunout } = state;
    
    // Calculate FIM (Full Indicator Movement) = Max - Min
    let min = Infinity, max = -Infinity;
    if (history.length === 0) { min=0; max=0; }
    else {
        history.forEach(v => {
            if(v < min) min = v;
            if(v > max) max = v;
        });
    }
    const fim = max - min;
    const isPass = fim <= toleranceRunout;
    
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

    group.appendChild(addText('CIRCULAR RUNOUT', bx+20, by+35, 18, '#94a3b8'));
    group.appendChild(createSVG('line', { x1: bx+20, y1: by+45, x2: bx+bw-20, y2: by+45, stroke: '#334155' }));

    const col1 = bx+20;
    const col2 = bx+240;
    
    group.appendChild(addText('FIM (TOTAL RUNOUT):', col1, by+80, 14, '#cbd5e1'));
    group.appendChild(addText(fim.toFixed(4)+'"', col2, by+80, 16, accent));
    
    group.appendChild(addText('ALLOWED LIMIT:', col1, by+105, 14, '#cbd5e1'));
    group.appendChild(addText(toleranceRunout.toFixed(4)+'"', col2, by+105, 14, 'white'));
    
    const statusText = isPass ? "PASS" : "FAIL";
    const status = addText(statusText, bx+bw-90, by+35, 24, accent, '900');
    status.setAttribute('style', `text-shadow: 0 0 10px ${accent}`);
    group.appendChild(status);

    // Live Bar
    const barY = by + 150;
    const barW = 340;
    const maxScale = toleranceRunout * 1.5;
    
    group.appendChild(createSVG('rect', { x: bx+20, y: barY, width: barW, height: 12, fill: '#1e293b', rx: 6 }));
    
    const limitPix = (toleranceRunout / maxScale) * barW;
    group.appendChild(createSVG('line', { x1: bx+20+limitPix, y1: barY-5, x2: bx+20+limitPix, y2: barY+17, stroke: 'white', 'stroke-width': 2 }));
    
    const fillPix = Math.min(barW, (fim / maxScale) * barW);
    group.appendChild(createSVG('rect', { x: bx+20, y: barY+2, width: fillPix, height: 8, fill: accent, rx: 4 }));

    // Component breakdown hint
    group.appendChild(addText(`Eccentricity: ${state.eccentricity.toFixed(4)}"`, bx+20, by+180, 12, '#64748b'));
    group.appendChild(addText(`Ovality: ${state.ovality.toFixed(4)}"`, bx+200, by+180, 12, '#64748b'));

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

    write("TOOL GUIDE: CIRCULAR RUNOUT", 40, '#f59e0b', 'bold');
    yPos += 20;
    
    write("1. WHAT IS IT?", 24, '#6366f1', 'bold');
    write("Controls surface variation relative to a DATUM AXIS.", 18, '#cbd5e1');
    write("Combines Circularity (Form) + Concentricity (Location).", 18, '#cbd5e1');
    yPos += 20;
    
    write("2. FIM (Full Indicator Movement)", 24, '#6366f1', 'bold');
    write("The deviation is measured by a Dial Indicator as the part rotates.", 18, '#cbd5e1');
    write("Runout = Max Reading - Min Reading (Total Sweep).", 18, '#f59e0b');
    yPos += 20;
    
    write("3. INTERACTION", 24, '#6366f1', 'bold');
    write("Adjust Eccentricity (Off-center) and Ovality (Shape error).", 18, '#cbd5e1');
    write("Watch the Strip Chart to see if you stay within the red dashed lines.", 18, '#cbd5e1');
    
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
    // Simple click to pause
    svg.addEventListener('mousedown', () => {
        state.isRotating = !state.isRotating;
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
                    <span class="text-3xl">↗</span>
                </div>
                <div class="px-3 py-2 border-r-2 border-black flex items-center gap-1 min-w-[100px]">
                    <input type="number" id="ctrl-tol" value="${state.toleranceRunout}" step="0.001" 
                        class="w-full font-bold bg-yellow-50 border-b-2 border-slate-300 focus:border-blue-500 outline-none text-center text-blue-800">
                </div>
                <div class="px-3 py-2 border-black bg-slate-100 text-slate-400">A</div>
            </div>
            
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN SYMBOL
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Manufacturing Errors</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Eccentricity (Offset Axis)</span>
                        <span id="val-ecc">0.000</span>
                    </div>
                    <input type="range" id="slide-ecc" min="0" max="0.010" step="0.0001" value="${state.eccentricity}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
                
                <div>
                    <div class="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Ovality (Form Error)</span>
                        <span id="val-oval">0.000</span>
                    </div>
                    <input type="range" id="slide-oval" min="0" max="0.010" step="0.0001" value="${state.ovality}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
            
            <button id="btn-reset" class="mt-4 w-full text-xs bg-slate-200 hover:bg-slate-300 px-2 py-2 rounded text-slate-700 font-bold">RESET PART</button>
        </div>
        
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
             <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-500">ROTATION SPEED</span>
            </div>
            <input type="range" id="ctrl-speed" min="0" max="0.1" step="0.001" value="${state.speed}" class="w-full h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const inputTol = document.getElementById('ctrl-tol');
    const inputSpeed = document.getElementById('ctrl-speed');
    const btnGuide = document.getElementById('btn-guide');
    const btnReset = document.getElementById('btn-reset');
    
    // Sliders
    const sEcc = document.getElementById('slide-ecc');
    const sOval = document.getElementById('slide-oval');

    // Values
    const vEcc = document.getElementById('val-ecc');
    const vOval = document.getElementById('val-oval');

    inputTol.oninput = (e) => { state.toleranceRunout = parseFloat(e.target.value) || 0; };
    inputSpeed.oninput = (e) => { state.speed = parseFloat(e.target.value); };
    btnGuide.onclick = () => { state.showGuide = !state.showGuide; renderScene(); }

    const updateDeforms = () => {
        state.eccentricity = parseFloat(sEcc.value);
        state.ovality = parseFloat(sOval.value);
        
        vEcc.innerText = state.eccentricity.toFixed(4);
        vOval.innerText = state.ovality.toFixed(4);
    };

    sEcc.oninput = updateDeforms;
    sOval.oninput = updateDeforms;

    btnReset.onclick = () => {
        sEcc.value = 0; sOval.value = 0;
        updateDeforms();
        state.history = [];
    };
}