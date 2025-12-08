// drawing_utils.js

// Helper to create SVG elements in the correct namespace
export function createSVG(type, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", type);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    return el;
}

// Helper to draw a standard tolerance zone box
export function drawToleranceZoneBox(svg, cx, cy, width, height) {
    const rect = createSVG('rect', {
        x: cx - width / 2,
        y: cy - height / 2,
        width: width,
        height: height,
        fill: 'rgba(239, 68, 68, 0.1)', // Light red fill
        stroke: '#ef4444', // Red stroke
        'stroke-width': 2,
        'stroke-dasharray': '8,8' // Dashed line
    });
    svg.appendChild(rect);
}

// Helper to draw datums, centerlines, etc. can go here.