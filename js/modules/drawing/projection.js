// js/modules/drawing/projection.js
// First angle vs third angle: the same L-shaped block, its three views laid
// out both ways, and the symbol that tells you which one a drawing uses.

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText } from '../../theme.js';
import { INK, LINE, line, projectionSymbol, UI, esc } from './sheet.js';

const state = { angle: 'third' };
let svgRef = null, controlsRoot = null;

// The part (mm): L-block 80 wide (x), 60 tall (y), 40 deep (z, 0 = back, 40 = front).
// Upright 20 wide on the left, base 20 tall, a Ø14 hole down through the base.
const W = 80, H = 60, D = 40, T = 20, HOLE = { x: 55, z: 20, r: 7 };

export function draw(svg) {
    svgRef = svg;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

function setAngle(a) {
    state.angle = a;
    render();
    renderControls();
}

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    svg.appendChild(createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: '#f8fafc' }));

    drawPictorial(svg);
    drawViews(svg);
    drawSymbolCard(svg);
    drawSentence(svg);
}

// --- 3D sketch of the part with viewing arrows ---------------------------------

function iso(x, y, z) {
    const s = 2.2, ox = 150, oy = 240;
    return [ox + (x - z) * 0.866 * s, oy + (x + z) * 0.5 * s - y * s];
}
const pts = arr => arr.map(p => iso(...p).join(',')).join(' ');

function drawPictorial(svg) {
    svg.appendChild(text('THE PART', 40, 44, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: 1 }));
    const face = (arr, fill) => svg.appendChild(createSVG('polygon', { points: pts(arr), fill, stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
    face([[0, H, 0], [T, H, 0], [T, H, D], [0, H, D]], '#f1f5f9');                   // top of upright
    face([[T, T, 0], [W, T, 0], [W, T, D], [T, T, D]], '#f1f5f9');                   // top of base
    face([[T, T, 0], [T, H, 0], [T, H, D], [T, T, D]], '#cbd5e1');                   // right face of upright
    face([[W, 0, 0], [W, T, 0], [W, T, D], [W, 0, D]], '#cbd5e1');                   // right face of base
    face([[0, 0, D], [W, 0, D], [W, T, D], [T, T, D], [T, H, D], [0, H, D]], '#e2e8f0'); // front
    // hole on the base top
    const ring = [];
    for (let a = 0; a < 360; a += 10) {
        const r = a * Math.PI / 180;
        ring.push(iso(HOLE.x + HOLE.r * Math.cos(r), T, HOLE.z + HOLE.r * Math.sin(r)).join(','));
    }
    svg.appendChild(createSVG('polygon', { points: ring.join(' '), fill: '#64748b', stroke: INK, 'stroke-width': 1.5 }));

    const arrow = (from, to, label, dx, dy) => {
        const [x1, y1] = iso(...from), [x2, y2] = iso(...to);
        svg.appendChild(createSVG('line', { x1, y1, x2, y2, stroke: '#2563eb', 'stroke-width': 2.5, 'marker-end': 'url(#thm-arrow-zone)' }));
        svg.appendChild(text(label, x1 + dx, y1 + dy, { size: 13, weight: 800, fill: '#1d4ed8', anchor: 'middle' }));
    };
    arrow([40, 10, 95], [40, 10, 46], 'FRONT', -4, 18);
    arrow([130, 10, 20], [86, 10, 20], 'RIGHT', 22, 10);
    arrow([50, 95, 20], [50, 26, 20], 'TOP', 0, -8);
}

// --- The three views -------------------------------------------------------

const S = 2;                                    // px per mm in the views

function frontView(x0, y0) {                    // (x0, y0) = top-left, looking at z = D
    const g = createSVG('g', {});
    const X = x => x0 + x * S, Y = y => y0 + (H - y) * S;
    g.appendChild(createSVG('polygon', {
        points: [[0, 0], [W, 0], [W, T], [T, T], [T, H], [0, H]].map(([x, y]) => `${X(x)},${Y(y)}`).join(' '),
        fill: '#fff', ...LINE.visible
    }));
    g.appendChild(line(X(HOLE.x - HOLE.r), Y(0), X(HOLE.x - HOLE.r), Y(T), LINE.hidden));
    g.appendChild(line(X(HOLE.x + HOLE.r), Y(0), X(HOLE.x + HOLE.r), Y(T), LINE.hidden));
    g.appendChild(line(X(HOLE.x), Y(0) + 8, X(HOLE.x), Y(T) - 8, LINE.center));
    return g;
}

function topView(x0, y0, frontAtBottom) {      // looking down; front edge nearest the front view
    const g = createSVG('g', {});
    const X = x => x0 + x * S;
    const Z = z => frontAtBottom ? y0 + z * S : y0 + (D - z) * S;
    g.appendChild(createSVG('rect', { x: X(0), y: y0, width: W * S, height: D * S, fill: '#fff', ...LINE.visible }));
    g.appendChild(line(X(T), y0, X(T), y0 + D * S, LINE.visible));                  // step edge
    g.appendChild(createSVG('circle', { cx: X(HOLE.x), cy: Z(HOLE.z), r: HOLE.r * S, ...LINE.visible }));
    g.appendChild(line(X(HOLE.x) - HOLE.r * S - 8, Z(HOLE.z), X(HOLE.x) + HOLE.r * S + 8, Z(HOLE.z), LINE.center));
    g.appendChild(line(X(HOLE.x), Z(HOLE.z) - HOLE.r * S - 8, X(HOLE.x), Z(HOLE.z) + HOLE.r * S + 8, LINE.center));
    return g;
}

function rightView(x0, y0, frontOnLeft) {      // looking from the right at x = W
    const g = createSVG('g', {});
    const Zx = z => frontOnLeft ? x0 + (D - z) * S : x0 + z * S;
    const Y = y => y0 + (H - y) * S;
    g.appendChild(createSVG('rect', { x: x0, y: y0, width: D * S, height: H * S, fill: '#fff', ...LINE.visible }));
    g.appendChild(line(x0, Y(T), x0 + D * S, Y(T), LINE.visible));                  // top of base, seen from the right
    g.appendChild(line(Zx(HOLE.z - HOLE.r), Y(0), Zx(HOLE.z - HOLE.r), Y(T), LINE.hidden));
    g.appendChild(line(Zx(HOLE.z + HOLE.r), Y(0), Zx(HOLE.z + HOLE.r), Y(T), LINE.hidden));
    g.appendChild(line(Zx(HOLE.z), Y(0) + 8, Zx(HOLE.z), Y(T) - 8, LINE.center));
    return g;
}

function drawViews(svg) {
    const third = state.angle === 'third';
    svg.appendChild(text(third ? 'THIRD ANGLE LAYOUT' : 'FIRST ANGLE LAYOUT', 420, 44, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: 1 }));

    const fx = 600, fw = W * S, fh = H * S, dw = D * S;
    const frontY = third ? 200 : 90;
    const topY = third ? frontY - 40 - dw : frontY + fh + 40;
    const rightX = third ? fx + fw + 40 : fx - 40 - dw;

    const label = (s, x, y) => svg.appendChild(text(s, x, y, { size: 12, weight: 800, fill: '#1d4ed8', anchor: 'middle', letterSpacing: 1 }));
    svg.appendChild(frontView(fx, frontY));
    label('FRONT', fx + fw / 2, frontY + fh + 22);
    svg.appendChild(topView(fx, topY, third));
    label('TOP', fx + fw / 2, third ? topY - 10 : topY + dw + 22);
    svg.appendChild(rightView(rightX, frontY, third));
    label('RIGHT SIDE', rightX + dw / 2, frontY + fh + 22);

    // Faint alignment lines: views line up with each other
    const faint = { stroke: '#93c5fd', 'stroke-width': 1, 'stroke-dasharray': '2 4' };
    [0, T, W].forEach(x => svg.appendChild(line(fx + x * S, third ? topY + dw : frontY + fh, fx + x * S, third ? frontY : topY, faint)));
    [0, T, H].forEach(y => {
        const yy = frontY + (H - y) * S;
        svg.appendChild(line(third ? fx + fw : rightX + dw, yy, third ? rightX : fx, yy, faint));
    });
}

// --- Symbol card and sentence --------------------------------------------------

function drawSymbolCard(svg) {
    const y = 470;
    svg.appendChild(text('THE SYMBOL IN THE TITLE BLOCK', 40, y - 14, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: 1 }));
    [['third', 'THIRD ANGLE', 'US, Canada', 40], ['first', 'FIRST ANGLE', 'Europe, Asia, ISO', 330]].forEach(([a, name, where, x]) => {
        const on = state.angle === a;
        svg.appendChild(createSVG('rect', { x, y, width: 270, height: 130, rx: 8, fill: on ? '#dbeafe' : '#fff', stroke: on ? '#2563eb' : COLORS.cardBorder, 'stroke-width': on ? 2.5 : 1.5 }));
        svg.appendChild(projectionSymbol(x + 70, y + 22, 42, a));
        svg.appendChild(text(name, x + 135, y + 100, { size: 15, weight: 800, fill: COLORS.ink, anchor: 'middle' }));
        svg.appendChild(text(where, x + 135, y + 118, { size: 12, fill: COLORS.muted, anchor: 'middle' }));
    });
    svg.appendChild(wrapText('Memory trick: in the third-angle symbol the circles are on the LEFT, and the view you see is placed on the same side you look from.', 630, y + 30, 44, 20, { size: 14, fill: COLORS.text }));
}

function drawSentence(svg) {
    const third = state.angle === 'third';
    svg.appendChild(createSVG('rect', { x: 20, y: 640, width: 960, height: 140, rx: 10, fill: '#fff', stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    const lines = third ? [
        'Third angle: each view is placed on the SAME side you look from.',
        'Looking from the top gives the top view, placed ABOVE the front view. Looking from the right gives the right view, placed to the RIGHT.',
        'Like unfolding a glass box around the part.'
    ] : [
        'First angle: each view is placed on the OPPOSITE side from where you look.',
        'Looking from the top gives the top view, placed BELOW the front view. Looking from the right gives the right view, placed to the LEFT.',
        'Like the part casting a shadow onto the wall behind it.'
    ];
    svg.appendChild(text(lines[0], 44, 676, { size: 18, weight: 800, fill: COLORS.ink }));
    const w = wrapText(lines[1], 44, 704, 118, 21, { size: 15, fill: COLORS.text });
    svg.appendChild(w);
    svg.appendChild(text(lines[2], 44, 704 + w.childNodes.length * 21 + 4, { size: 14, fill: COLORS.muted, italic: true }));
}

function renderControls() {
    if (!controlsRoot) return;
    const seg = (a, label) => `<button data-angle="${a}" class="${UI.segBtn} ${state.angle === a ? UI.segOn : UI.segOff}">${label}</button>`;
    controlsRoot.innerHTML = `
        <div class="${UI.card}">
            <h4 class="${UI.h4}">Layout</h4>
            <div class="flex gap-2">${seg('third', 'Third angle')}${seg('first', 'First angle')}</div>
            <p class="text-xs text-slate-500 mt-2">Switch back and forth and watch the top and right views jump to the other side of the front view.</p>
        </div>
        <div class="${UI.card}">
            <h4 class="${UI.h4}">How to tell which one</h4>
            <ol class="text-sm text-slate-700 list-decimal pl-4 space-y-1.5">
                <li>Find the cone symbol in the title block.</li>
                <li>Circles on the left, cone on the right: <b>third angle</b>.</li>
                <li>Cone on the left, circles on the right: <b>first angle</b>.</li>
                <li>No symbol? A US drawing is almost always third angle; a European one is usually first angle. Ask if unsure.</li>
            </ol>
        </div>
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Why it matters</div>
            <div class="text-xs leading-relaxed">If you read a first-angle drawing as third angle, the "right" view is really the left view. You would make a mirror image of the part: holes and steps end up on the wrong side.</div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">${esc('Tip: views always line up. A feature in the front view sits directly in line with the same feature in the top and side views, so you can trace it across with a straight edge.')}</p>`;
    controlsRoot.querySelectorAll('[data-angle]').forEach(b => b.onclick = () => setAngle(b.dataset.angle));
}
