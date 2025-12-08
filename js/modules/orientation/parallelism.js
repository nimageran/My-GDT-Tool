// js/modules/orientation/parallelism.js
import { createSVG } from '../../drawing_utils.js';

// ==========================================
// 1. THE VISUALIZATION
// ==========================================
export function draw(svg) {
    // A. Setup the Scene (Side View of a Block)
    
    // 1. The Datum (Bottom Surface)
    const floorY = 600;
    svg.appendChild(createSVG('line', {
        x1: 100, y1: floorY, x2: 900, y2: floorY,
        stroke: '#1e293b', 'stroke-width': 4
    }));

    // Datum Symbol (The Triangle and Box)
    // Vertical leg
    svg.appendChild(createSVG('line', {
        x1: 200, y1: floorY, x2: 200, y2: floorY + 40, stroke: '#1e293b', 'stroke-width': 2
    }));
    // The Box
    svg.appendChild(createSVG('rect', {
        x: 185, y: floorY + 40, width: 30, height: 30, fill: 'white', stroke: '#1e293b', 'stroke-width': 2
    }));
    // The Text "A"
    const datumLabel = createSVG('text', { x: 200, y: floorY + 62, 'text-anchor': 'middle', 'font-weight': 'bold', 'font-family': 'sans-serif' });
    datumLabel.textContent = "A";
    svg.appendChild(datumLabel);
    // The Triangle (Filled)
    const tri = createSVG('polygon', {
        points: `200,${floorY} 195,${floorY+10} 205,${floorY+10}`,
        fill: '#1e293b'
    });
    svg.appendChild(tri);


    // 2. The Tolerance Zone (Two Floating Planes)
    // We group them so we can move/scale them easily
    const zoneGroup = createSVG('g', { id: 'tolZoneGroup' });
    
    // Top Plane of Zone
    zoneGroup.appendChild(createSVG('line', {
        id: 'zoneTop', x1: 150, y1: 250, x2: 850, y2: 250,
        stroke: '#3b82f6', 'stroke-width': 2, 'stroke-dasharray': '10,5'
    }));
    // Bottom Plane of Zone
    zoneGroup.appendChild(createSVG('line', {
        id: 'zoneBot', x1: 150, y1: 350, x2: 850, y2: 350,
        stroke: '#3b82f6', 'stroke-width': 2, 'stroke-dasharray': '10,5'
    }));
    // Filled Area (Transparent Blue)
    zoneGroup.appendChild(createSVG('rect', {
        id: 'zoneFill', x: 150, y: 250, width: 700, height: 100,
        fill: 'rgba(59, 130, 246, 0.1)', stroke: 'none'
    }));
    
    svg.appendChild(zoneGroup);


    // 3. The Actual Surface (Dynamic Path)
    const surfacePath = createSVG('path', {
        id: 'actualSurfacePath',
        d: '', // Will be calculated in update()
        fill: 'none', stroke: '#1e293b', 'stroke-width': 6, 'stroke-linecap': 'round'
    });
    svg.appendChild(surfacePath);


    // 4. Result Banner (Floating UI)
    const bannerGroup = createSVG('g', { id: 'resultBanner', transform: 'translate(50, 50)' });
    
    bannerGroup.appendChild(createSVG('rect', {
        width: 320, height: 110, rx: 8, fill: 'rgba(255,255,255,0.95)', stroke: '#cbd5e1', 'stroke-width': 2,
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'
    }));
    
    const title = createSVG('text', { x: 20, y: 30, 'font-size': 11, 'font-weight': 'bold', fill: '#64748b', 'text-transform': 'uppercase' });
    title.textContent = "Total Indicator Reading (TIR)";
    bannerGroup.appendChild(title);

    const val = createSVG('text', { id: 'bannerVal', x: 20, y: 65, 'font-size': 32, 'font-weight': '900', fill: '#1e293b', 'font-family': 'monospace' });
    val.textContent = "0.000";
    bannerGroup.appendChild(val);

    const status = createSVG('text', { id: 'bannerStatus', x: 20, y: 90, 'font-size': 13, 'font-weight': 'bold', fill: '#64748b' });
    status.textContent = "--";
    bannerGroup.appendChild(status);

    svg.appendChild(bannerGroup);
    
    // Trigger update to render default state
    setTimeout(update, 50);
}


// ==========================================
// 2. THE CONTROLS
// ==========================================
export function loadControls(container) {
    container.innerHTML = `
        <div class="col-span-3 border-b border-slate-200 pb-4 mb-2">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Specification</h4>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] font-bold text-slate-500">PARALLELISM TOLERANCE</label>
                    <input type="number" id="tolInput" value="0.50" step="0.01" class="w-full border-2 border-slate-300 rounded p-2 font-mono font-bold text-lg text-center">
                </div>
                <div class="flex items-center text-xs text-slate-500 italic">
                    The surface must lie between two parallel planes 0.50mm apart.
                </div>
            </div>
        </div>

        <div class="col-span-3">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Measurement Simulation (CMM / Indicator)</h4>
            
            <div class="space-y-4">
                <div>
                    <div class="flex justify-between">
                        <label class="text-xs font-bold text-slate-700">Surface Tilt (Slope)</label>
                        <span id="tiltVal" class="text-xs font-mono text-slate-500">0.00</span>
                    </div>
                    <input type="range" min="-2.0" max="2.0" step="0.05" value="0.0" id="tiltSlider" class="w-full accent-blue-600">
                </div>

                <div>
                    <div class="flex justify-between">
                        <label class="text-xs font-bold text-slate-700">Surface Waviness (Form Error)</label>
                        <span id="waveVal" class="text-xs font-mono text-slate-500">0.00</span>
                    </div>
                    <input type="range" min="0" max="1.0" step="0.05" value="0.0" id="waveSlider" class="w-full accent-purple-600">
                </div>
            </div>
        </div>
    `;

    // Attach Listeners
    document.getElementById('tolInput').addEventListener('input', update);
    document.getElementById('tiltSlider').addEventListener('input', update);
    document.getElementById('waveSlider').addEventListener('input', update);
}


// ==========================================
// 3. THE LOGIC ENGINE
// ==========================================
function update() {
    // 1. Get Inputs
    const tol = parseFloat(document.getElementById('tolInput').value) || 0.1;
    const tilt = parseFloat(document.getElementById('tiltSlider').value);
    const wave = parseFloat(document.getElementById('waveSlider').value);

    // Update Text Labels
    document.getElementById('tiltVal').textContent = tilt.toFixed(2);
    document.getElementById('waveVal').textContent = wave.toFixed(2);

    // 2. Calculate Geometry for SVG (Scaling)
    // We choose a scale factor to make the visualization look good.
    // Let's say 1 unit of tolerance = 200 pixels on screen (if tol is small).
    // Or we fix the Tolerance Zone visually to be 100px high, and scale the Error relative to it.
    
    // VISUAL CONSTANTS
    const screenCenterY = 300;
    const screenZoneHeight = 150; // The visual height of the blue box
    const scaleFactor = screenZoneHeight / tol; // Pixels per mm
    
    // 3. Update Tolerance Zone Visuals
    const zoneTopY = screenCenterY - (screenZoneHeight / 2);
    const zoneBotY = screenCenterY + (screenZoneHeight / 2);
    
    document.getElementById('zoneTop').setAttribute('y1', zoneTopY);
    document.getElementById('zoneTop').setAttribute('y2', zoneTopY);
    document.getElementById('zoneBot').setAttribute('y1', zoneBotY);
    document.getElementById('zoneBot').setAttribute('y2', zoneBotY);
    document.getElementById('zoneFill').setAttribute('y', zoneTopY);
    document.getElementById('zoneFill').setAttribute('height', screenZoneHeight);


    // 4. Generate the "Actual Surface" Path
    // We simulate measuring points across the width (x=150 to x=850)
    // Length = 700px.
    const startX = 150;
    const endX = 850;
    const width = 700;
    let pathD = `M ${startX} `;
    
    let minHeight = Infinity;
    let maxHeight = -Infinity;

    // Loop to build path and calculate min/max simultaneously
    for (let x = 0; x <= width; x += 10) {
        // Normalized X (0 to 1)
        const xNorm = (x / width) - 0.5; // -0.5 to 0.5 (center origin)
        
        // Tilt Effect: Linear slope
        // If tilt is 1.0, it means 1mm rise over run.
        const tiltY = xNorm * tilt; 

        // Waviness Effect: Sine wave
        const waveY = Math.sin(xNorm * Math.PI * 4) * (wave / 2); 

        // Total Deviation at this point
        const totalDev = tiltY + waveY;

        // Track Min/Max for TIR calculation
        if (totalDev > maxHeight) maxHeight = totalDev;
        if (totalDev < minHeight) minHeight = totalDev;

        // Convert to Screen Coordinates
        // NOTE: Screen Y is inverted. Positive deviation goes UP (smaller Y).
        const screenY = screenCenterY - (totalDev * scaleFactor);
        
        if (x === 0) pathD += `${screenY}`;
        else pathD += ` L ${startX + x} ${screenY}`;
    }

    document.getElementById('actualSurfacePath').setAttribute('d', pathD);


    // 5. Calculate Engineering Result (TIR)
    // TIR = Distance between the highest peak and lowest valley relative to the slope? 
    // NO. Parallelism is relative to the Datum. 
    // The Datum is the reference. We already simulated the surface relative to the datum (zero line).
    // The Parallelism Error is the separation between two planes that enclose the surface.
    // Error = Max Height - Min Height.
    
    const parallelismError = maxHeight - minHeight;


    // 6. Pass/Fail Logic
    const isPass = parallelismError <= tol;
    
    // 7. Update Banner & Colors
    const bannerVal = document.getElementById('bannerVal');
    const bannerStatus = document.getElementById('bannerStatus');
    const bannerBox = document.querySelector('#resultBanner rect');
    const surfaceLine = document.getElementById('actualSurfacePath');
    const zoneFill = document.getElementById('zoneFill');
    const zoneLines = [document.getElementById('zoneTop'), document.getElementById('zoneBot')];

    bannerVal.textContent = parallelismError.toFixed(3);

    if (isPass) {
        bannerStatus.textContent = "PASS - WITHIN SPEC";
        bannerStatus.setAttribute('fill', '#16a34a'); // Green
        bannerVal.setAttribute('fill', '#16a34a');
        bannerBox.setAttribute('stroke', '#16a34a');
        
        surfaceLine.setAttribute('stroke', '#1e293b'); // Dark Grey (Standard)
        zoneFill.setAttribute('fill', 'rgba(59, 130, 246, 0.1)'); // Blue
        zoneLines.forEach(l => l.setAttribute('stroke', '#3b82f6'));
    } else {
        bannerStatus.textContent = "FAIL - EXCEEDS TOLERANCE";
        bannerStatus.setAttribute('fill', '#dc2626'); // Red
        bannerVal.setAttribute('fill', '#dc2626');
        bannerBox.setAttribute('stroke', '#dc2626');
        
        surfaceLine.setAttribute('stroke', '#dc2626'); // Turn line Red
        zoneFill.setAttribute('fill', 'rgba(220, 38, 38, 0.1)'); // Red tint
        zoneLines.forEach(l => l.setAttribute('stroke', '#dc2626'));
    }
}