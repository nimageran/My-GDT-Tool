// modules/form.js
import { createSVG, drawToleranceZoneBox } from '../drawing_utils.js';

// ==========================================
// VISUALIZATION FUNCTIONS (The SVG Drawing)
// ==========================================

export function drawFlatness(svg) {
    const cx = 500, cy = 400;
    const width = 600;
    // Default initial state
    drawToleranceZoneBox(svg, cx, cy, width, 100); // Initial 100px tolerance height

    // Draw the "Perfect" theoretical surface
    svg.appendChild(createSVG('line', {
        x1: cx - width/2, y1: cy, x2: cx + width/2, y2: cy,
        stroke: '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '4,4'
    }));

    // Placeholder for the "Actual" surface wavy line (updated by controls)
    const actualSurface = createSVG('path', {
        id: 'actualFeaturePath', // ID to find it later for updates
        d: `M ${cx - width/2} ${cy} L ${cx + width/2} ${cy}`, // Start flat
        stroke: '#3b82f6', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round'
    });
    svg.appendChild(actualSurface);
}

export function drawStraightness(svg) {
    // Similar logic but for a 2D line element...
    const text = createSVG('text', {x:500, y:400, 'text-anchor':'middle', fill:'gray'});
    text.textContent = "Straightness Visualization Placeholder";
    svg.appendChild(text);
}

export function drawCircularity(svg) {
     // Logic for two concentric circles...
     const text = createSVG('text', {x:500, y:400, 'text-anchor':'middle', fill:'gray'});
     text.textContent = "Circularity Visualization Placeholder";
     svg.appendChild(text);
}


// ==========================================
// CONTROL LOGIC (The Engineer's Inputs)
// ==========================================

// This function is called by main.js to inject sliders specific to this module
export function loadControls(container, activeSymKey) {
    container.innerHTML = ''; // Clear existing

    if (activeSymKey === 'flatness') {
        // 1. Tolerance Slider
        container.innerHTML += `
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-1">Tolerance Zone Width</label>
                <input type="range" min="50" max="200" value="100" class="w-full accent-red-500" id="tolSlider">
            </div>
        `;
        // 2. Actual Error Slider
        container.innerHTML += `
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-1">Actual Surface Error</label>
                <input type="range" min="0" max="250" value="0" class="w-full accent-blue-500" id="actSlider">
            </div>
        `;

        // Add event listeners for real-time updates
        document.getElementById('tolSlider').addEventListener('input', updateFlatness);
        document.getElementById('actSlider').addEventListener('input', updateFlatness);
    }
    // Add 'else if' blocks for straightness/circularity controls
}

// Internal function to handle updates based on slider movement
function updateFlatness() {
    const tolH = parseFloat(document.getElementById('tolSlider').value);
    const actH = parseFloat(document.getElementById('actSlider').value);
    const svg = document.getElementById('mainCanvas');
    
    // 1. Redraw Tolerance Zone
    // Find existing zone and remove it to redraw (simple approach)
    const existingZone = svg.querySelector('rect[stroke-dasharray="8,8"]');
    if(existingZone) existingZone.remove();
    drawToleranceZoneBox(svg, 500, 400, 600, tolH);

    // 2. Update Actual Surface Wave
    const pathEl = document.getElementById('actualFeaturePath');
    const cx = 500, cy = 400, width = 600;
    let d = `M ${cx - width/2} ${cy}`;
    // Create a sine wave based on actual error height
    for(let x = 0; x <= width; x += 20) {
        const yOffset = Math.sin(x * 0.05) * (actH / 2);
        d += ` L ${cx - width/2 + x} ${cy + yOffset}`;
    }
    pathEl.setAttribute('d', d);

    // Pass/Fail Color
    pathEl.setAttribute('stroke', actH <= tolH ? '#22c55e' : '#ef4444'); // Green / Red
}