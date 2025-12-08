// js/modules/orientation.js
import { createSVG, drawToleranceZoneBox } from '../drawing_utils.js';

// ==========================================
// VISUALIZATION FUNCTIONS
// ==========================================

export function drawPerpendicularity(svg) {
    // 1. Draw the Datum (The Ground)
    svg.appendChild(createSVG('line', {
        x1: 200, y1: 500, x2: 800, y2: 500,
        stroke: 'black', 'stroke-width': 4
    }));
    // Label the Datum
    const text = createSVG('text', {x: 210, y: 530, 'font-weight': 'bold', fill: 'black'});
    text.textContent = "DATUM A";
    svg.appendChild(text);

    // 2. Draw the Tolerance Zone (Two vertical dashed lines)
    // We reuse the box helper, but make it tall and thin
    drawToleranceZoneBox(svg, 500, 300, 100, 400); // 100px wide tolerance

    // 3. Draw the Perfect Theoretical Feature (Center line)
    svg.appendChild(createSVG('line', {
        x1: 500, y1: 500, x2: 500, y2: 100,
        stroke: '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '4,4'
    }));

    // 4. Draw the Actual Feature (The Pin/Wall)
    // This will be updated by the slider
    const actualFeature = createSVG('line', {
        id: 'actualFeatureLine',
        x1: 500, y1: 500, x2: 500, y2: 100, // Starts perfect
        stroke: '#3b82f6', 'stroke-width': 6, 'stroke-linecap': 'round'
    });
    svg.appendChild(actualFeature);
}

export function drawParallelism(svg) {
    // 1. Datum (Bottom)
    svg.appendChild(createSVG('line', {
        x1: 200, y1: 600, x2: 800, y2: 600, stroke: 'black', 'stroke-width': 4
    }));
    
    // 2. Tolerance Zone (Floating above)
    drawToleranceZoneBox(svg, 500, 300, 600, 100);

    // 3. Actual Feature (The top surface)
    const actualFeature = createSVG('line', {
        id: 'actualFeatureLine',
        x1: 200, y1: 300, x2: 800, y2: 300,
        stroke: '#3b82f6', 'stroke-width': 6
    });
    svg.appendChild(actualFeature);
}

export function drawAngularity(svg) {
    // 1. Datum
    svg.appendChild(createSVG('line', {
        x1: 200, y1: 600, x2: 800, y2: 600, stroke: 'black', 'stroke-width': 4
    }));

    // 2. Perfect 45 degree line center
    // Math: Start at 300,600. Go up and right.
    svg.appendChild(createSVG('line', {
        x1: 300, y1: 600, x2: 700, y2: 200,
        stroke: '#94a3b8', 'stroke-width': 2, 'stroke-dasharray': '4,4'
    }));

    // 3. Tolerance Zone (Angled Box)
    // Note: SVG rotation is easiest here
    const zone = createSVG('rect', {
        x: 300, y: 350, width: 565, height: 100, // length approx sqrt(400^2+400^2)
        fill: 'rgba(239, 68, 68, 0.1)', stroke: '#ef4444', 'stroke-width': 2, 'stroke-dasharray': '8,8',
        transform: 'rotate(-45 500 400)' // Rotate around center roughly
    });
    // Positioning angled boxes in SVG manually is hard, simpler visual for now:
    // Just drawing the Actual Line
    const actualFeature = createSVG('line', {
        id: 'actualFeatureLine',
        x1: 300, y1: 600, x2: 700, y2: 200,
        stroke: '#3b82f6', 'stroke-width': 6
    });
    svg.appendChild(actualFeature);
}


// ==========================================
// CONTROL LOGIC
// ==========================================

export function loadControls(container, activeSymKey) {
    container.innerHTML = ''; 

    // Common Slider for Tilt/Angle
    container.innerHTML += `
        <div>
            <label class="block text-sm font-bold text-slate-700 mb-1">Tilt Error (Degrees)</label>
            <input type="range" min="-15" max="15" value="0" class="w-full accent-blue-500" id="tiltSlider">
            <div class="flex justify-between text-xs text-slate-400">
                <span>-15°</span><span>0°</span><span>+15°</span>
            </div>
        </div>
    `;

    document.getElementById('tiltSlider').addEventListener('input', (e) => {
        updateOrientation(activeSymKey, e.target.value);
    });
}

function updateOrientation(symKey, tiltVal) {
    const line = document.getElementById('actualFeatureLine');
    if (!line) return;

    if (symKey === 'perpendicularity') {
        // Pivot the line at the bottom (x=500, y=500)
        // Simple SVG transform rotation
        line.setAttribute('transform', `rotate(${tiltVal} 500 500)`);
        
        // Color Logic: If tilt > 10, turn red
        line.setAttribute('stroke', Math.abs(tiltVal) > 10 ? '#ef4444' : '#3b82f6');
    }
    else if (symKey === 'parallelism') {
        // Pivot around center
        line.setAttribute('transform', `rotate(${tiltVal} 500 300)`);
    }
    else if (symKey === 'angularity') {
        // Pivot around base
        line.setAttribute('transform', `rotate(${tiltVal} 300 600)`);
    }
}