// js/modules/drawing/read_checklist.js
// "How to read a drawing": a complete sample drawing and a step-by-step order
// for reading any drawing. Each step lights up the part of the sheet to look
// at and lists what to check.

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, featureControlFrame } from '../../theme.js';
import { surfaceTexture } from '../decode/symbols.js';
import { takeFocus } from '../../focus.js';
import { INK, LINE, line, titleBlock, dimH, dimV, datumTag, UI, esc, goTo } from './sheet.js';

// --------------------------------------------------------------------------
// Sample sheet layout (canvas units)
// --------------------------------------------------------------------------
const K = 3;                                    // px per mm in the views
const FRONT = { x: 120, y: 290, w: 100 * K, h: 60 * K };
const TOP = { x: 120, y: 190, w: 100 * K, h: 20 * K };
const RIGHT = { x: 470, y: 290, w: 20 * K, h: 60 * K };
const HOLES = [25, 75].map(mx => ({ x: FRONT.x + mx * K, y: FRONT.y + FRONT.h - 35 * K, r: 5 * K }));
const TB = { x: 455, y: 555, k: 1.25 };

// Field boxes of the title block, same layout as sheet.js TITLE_FIELDS at k = 1
const tbBox = (fx, fy, w, h) => ({ x: TB.x + fx * TB.k, y: TB.y + fy * TB.k, w: w * TB.k, h: h * TB.k });

// --------------------------------------------------------------------------
// Steps
// --------------------------------------------------------------------------
export const STEPS = [
    { title: 'Overview', rects: [],
      look: 'This is a complete sample drawing of a small aluminium block with two holes.',
      check: ['Go through the steps in order. The same order works on any drawing, from any company.', 'Use Next, or click a step in the list below.'],
      watch: 'Resist jumping straight to the dimensions. Most costly mistakes come from the title block and notes, not from the views.' },
    { title: 'Part number, name and revision', rects: [tbBox(180, 40, 240, 80)],
      look: 'The title block, bottom right: title, part number and revision (REV).',
      check: ['Part number matches your work order exactly.', 'Revision matches your work order. Here: REV C.'],
      watch: 'Wrong revision is the classic expensive mistake. If they do not match, stop and ask before making anything.',
      link: ['DECODE', 'title_block', 'Title block'] },
    { title: 'Sheets and scale', rects: [tbBox(180, 150, 120, 30)],
      look: 'SCALE and SHEET in the title block.',
      check: ['"1 OF 1" means this is the only sheet. "1 OF 3" means find sheets 2 and 3.', 'Scale 1:1 gives a feel for the size only.'],
      watch: 'Never measure the paper with a ruler. Use only written dimensions.' },
    { title: 'Units and standard', rects: [tbBox(0, 0, 180, 110)],
      look: 'The tolerance box says "DIMENSIONS IN MM", and the standard box says "ASME Y14.5-2018".',
      check: ['Millimetres or inches? Every number depends on it.', 'Which standard (ASME or ISO) and which year.'],
      watch: 'A US company can still send a metric drawing. Do not assume inches.' },
    { title: 'Projection (view layout)', rects: [tbBox(0, 110, 180, 70)],
      look: 'The cone symbol: circles on the left means third angle.',
      check: ['Third angle: the top view sits above the front view and the right view to its right, like on this sheet.'],
      watch: 'A first-angle drawing read as third angle gives a mirror-image part.',
      link: ['DECODE', 'projection', 'First vs third angle'] },
    { title: 'Views: understand the shape', rects: [{ x: 45, y: 140, w: 555, h: 445 }],
      look: 'Front view (middle), top view (above), right view (right).',
      check: ['Find each feature in every view. The holes are circles in the front view and dashed (hidden) lines in the top and right views.', 'The part is a 100 × 60 × 20 block with two Ø10 holes through it.'],
      watch: 'If you cannot picture the part, sketch it in 3D before going further.',
      link: ['DECODE', 'lines_views', 'Lines & views'] },
    { title: 'Default tolerances', rects: [tbBox(0, 0, 180, 70), { x: 115, y: 145, w: 310, h: 32 }, { x: 30, y: 285, w: 28, h: 190 }, { x: 465, y: 485, w: 70, h: 30 }],
      look: 'Dimensions with no tolerance of their own: 100, 60 and 20. They take the tolerance from the title block.',
      check: ['100, 60 and 20 have no decimals, so they are ±0.5 here.', 'So 100 means anything from 99.5 to 100.5.'],
      watch: 'Boxed (basic) dimensions like the 25, 75 and 35 never take this default.',
      link: ['DECODE', 'general_tolerances', 'General tolerance calculator'] },
    { title: 'Notes', rects: [{ x: 30, y: 600, w: 410, h: 172 }],
      look: 'The notes block. These rules apply to the whole part.',
      check: ['Read every note before starting.', 'Here: remove burrs and break edges, default finish Ra 3.2 unless marked (UOS), sizes apply after anodize, and part marking.'],
      watch: 'Note 3 matters: the Ø10 holes must be the right size after anodize, so they are machined slightly bigger.',
      link: ['DECODE', 'drawing_notes', 'Notes & abbreviations'] },
    { title: 'Datums: how the part is held', rects: [{ x: 528, y: 418, w: 58, h: 44 }, { x: 250, y: 462, w: 40, h: 64 }, { x: 64, y: 312, w: 62, h: 36 }],
      look: 'The letters in boxes with a triangle: A on the back face, B on the bottom, C on the left end.',
      check: ['A is primary: the part sits on its back face first.', 'Then it is pushed against B (bottom), then against C (left end).', 'All boxed dimensions are measured from these faces.'],
      watch: 'Datum order comes from the feature control frame (A, then B, then C), not from the alphabet.',
      link: ['DATUMS', 'drf', 'Datum reference frame'] },
    { title: 'Hole callout and GD&T frame', rects: [{ x: 548, y: 180, w: 262, h: 72 }, { x: 115, y: 526, w: 240, h: 52 }, { x: 80, y: 360, w: 30, h: 115 }],
      look: 'The hole callout "2X Ø10 +0.1/0 THRU" with its feature control frame, and the boxed dimensions that locate the holes.',
      check: ['Two holes, each Ø10.0 to Ø10.1, all the way through.', 'Their perfect positions are 25 and 75 from C and 35 from B.', 'Each centre may be off by a Ø0.2 circle, plus bonus as the hole gets bigger (Ⓜ).'],
      watch: 'A boxed dimension has no ± of its own. The allowed error is in the frame.',
      link: ['DECODE', 'composite_frames', 'Feature control frames'] },
    { title: 'Surface finish and other symbols', rects: [{ x: 140, y: 150, w: 100, h: 42 }],
      look: 'The check-mark symbol on the top view with Ra 1.6.',
      check: ['The back face (datum A) must be Ra 1.6 or smoother.', 'All other machined faces follow note 2: Ra 3.2.'],
      watch: 'Unknown symbol? Look it up before guessing.',
      link: ['DECODE', 'symbol_finder', 'Symbol Finder'] },
    { title: 'Revision block', rects: [{ x: 600, y: 20, w: 380, h: 60 }],
      look: 'The revision table, top right: what changed and when.',
      check: ['REV C changed the holes from Ø9 to Ø10.', 'If you have old parts, stock or programs from REV B, they are now wrong.'],
      watch: 'Always check what changed when a new revision arrives, even if the change looks small.' }
];

const state = { step: 0 };
let svgRef = null, controlsRoot = null;

export function draw(svg) {
    svgRef = svg;
    const f = takeFocus('read_checklist');
    if (Number.isInteger(f) && STEPS[f]) state.step = f;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

function go(i) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, i));
    render();
    renderControls();
}

// --------------------------------------------------------------------------
// Sheet drawing
// --------------------------------------------------------------------------

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    svg.appendChild(createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: '#fff' }));
    svg.appendChild(createSVG('rect', { x: 20, y: 20, width: 960, height: 760, fill: 'none', stroke: INK, 'stroke-width': 2.4 }));

    drawRevisionBlock(svg);
    svg.appendChild(titleBlock(TB.x, TB.y, TB.k, { fixed: true, labelSize: 10, valueSize: 12.5, bigSize: 16 }).g);
    drawNotes(svg);
    drawViews(svg);
    drawDimensions(svg);
    drawCallout(svg);
    drawSpotlight(svg);
}

function drawRevisionBlock(svg) {
    const cols = [600, 640, 810, 920, 980];
    const rows = [
        ['REV', 'DESCRIPTION', 'DATE', 'BY'],
        ['B', 'FIRST RELEASE', '2025-11-10', 'J.S.'],
        ['C', 'HOLES Ø10 WAS Ø9', '2026-03-02', 'A.K.']
    ];
    rows.forEach((r, i) => {
        const y = 20 + i * 20;
        r.forEach((c, j) => {
            svg.appendChild(createSVG('rect', { x: cols[j], y, width: cols[j + 1] - cols[j], height: 20, fill: i === 0 ? '#f1f5f9' : '#fff', stroke: INK, 'stroke-width': 1 }));
            svg.appendChild(text(c, cols[j] + 5, y + 14.5, { size: i === 0 ? 8.5 : 10, weight: i === 0 ? 700 : 600, fill: INK, mono: i > 0 }));
        });
    });
}

function drawNotes(svg) {
    const notes = [
        'NOTES:',
        '1. REMOVE BURRS. BREAK SHARP EDGES 0.2-0.5.',
        '2. SURFACE FINISH Ra 3.2 UOS.',
        '3. DIMENSIONS APPLY AFTER ANODIZE.',
        '4. MARK P/N AND REV ON BACK FACE, INK.'
    ];
    notes.forEach((n, i) => svg.appendChild(text(n, 40, 628 + i * 24, { size: i ? 12.5 : 13, weight: i ? 500 : 800, fill: INK, mono: true })));
}

function drawViews(svg) {
    // Front view: 100 × 60 face with two holes
    svg.appendChild(createSVG('rect', { x: FRONT.x, y: FRONT.y, width: FRONT.w, height: FRONT.h, fill: '#fff', ...LINE.visible }));
    HOLES.forEach(h => {
        svg.appendChild(createSVG('circle', { cx: h.x, cy: h.y, r: h.r, fill: '#fff', ...LINE.visible }));
        svg.appendChild(line(h.x - h.r - 10, h.y, h.x + h.r + 10, h.y, LINE.center));
        svg.appendChild(line(h.x, h.y - h.r - 10, h.x, h.y + h.r + 10, LINE.center));
    });
    // Top view: 100 × 20, holes seen as hidden lines
    svg.appendChild(createSVG('rect', { x: TOP.x, y: TOP.y, width: TOP.w, height: TOP.h, fill: '#fff', ...LINE.visible }));
    HOLES.forEach(h => {
        svg.appendChild(line(h.x - h.r, TOP.y, h.x - h.r, TOP.y + TOP.h, LINE.hidden));
        svg.appendChild(line(h.x + h.r, TOP.y, h.x + h.r, TOP.y + TOP.h, LINE.hidden));
        svg.appendChild(line(h.x, TOP.y - 8, h.x, TOP.y + TOP.h + 8, LINE.center));
    });
    // Right view: 20 × 60, holes seen as hidden lines
    svg.appendChild(createSVG('rect', { x: RIGHT.x, y: RIGHT.y, width: RIGHT.w, height: RIGHT.h, fill: '#fff', ...LINE.visible }));
    const hy = HOLES[0];
    svg.appendChild(line(RIGHT.x, hy.y - hy.r, RIGHT.x + RIGHT.w, hy.y - hy.r, LINE.hidden));
    svg.appendChild(line(RIGHT.x, hy.y + hy.r, RIGHT.x + RIGHT.w, hy.y + hy.r, LINE.hidden));
    svg.appendChild(line(RIGHT.x - 8, hy.y, RIGHT.x + RIGHT.w + 8, hy.y, LINE.center));

    // Datum features: A = back face (right edge of the right view), B = bottom, C = left end
    svg.appendChild(datumTag(RIGHT.x + RIGHT.w, 440, 'A', 'right'));
    svg.appendChild(datumTag(270, FRONT.y + FRONT.h, 'B', 'down'));
    svg.appendChild(datumTag(FRONT.x, 330, 'C', 'left'));

    // Surface finish on the back face (top edge of the top view)
    svg.appendChild(surfaceTexture(160, TOP.y, 22, { removal: 'required' }));
    svg.appendChild(text('Ra 1.6', 176, TOP.y - 12, { size: 12, weight: 700, fill: INK, mono: true }));
}

function drawDimensions(svg) {
    const bottom = FRONT.y + FRONT.h;
    svg.appendChild(dimH(TOP.x, TOP.x + TOP.w, 160, '100', { fromY: TOP.y }));
    svg.appendChild(dimV(FRONT.y, bottom, 44, '60', { fromX: FRONT.x }));
    svg.appendChild(dimV(HOLES[0].y, bottom, 95, '35', { fromX: FRONT.x, basic: true }));
    svg.appendChild(dimH(FRONT.x, HOLES[0].x, 535, '25', { fromY: bottom, basic: true }));
    svg.appendChild(dimH(FRONT.x, HOLES[1].x, 565, '75', { fromY: bottom, basic: true }));
    svg.appendChild(dimH(RIGHT.x, RIGHT.x + RIGHT.w, 500, '20', { fromY: bottom }));
}

function drawCallout(svg) {
    const h = HOLES[1];
    const tx = h.x + h.r * Math.SQRT1_2, ty = h.y - h.r * Math.SQRT1_2;
    svg.appendChild(createSVG('line', { x1: 556, y1: 200, x2: tx, y2: ty, stroke: INK, 'stroke-width': 1, 'marker-end': 'url(#thm-arrow-ink)' }));
    svg.appendChild(text('2X Ø10 +0.1/0 THRU', 560, 204, { size: 14, weight: 700, fill: INK, mono: true }));
    svg.appendChild(featureControlFrame(560, 214, { symbol: 'position', tolerance: '0.2', diameter: true, modifier: 'M', datums: ['A', 'B', 'C'], h: 30 }).g);
}

// Dim everything except the current step's boxes
function drawSpotlight(svg) {
    const s = STEPS[state.step];
    if (!s.rects.length) return;
    const pad = 6;
    const mask = createSVG('mask', { id: 'rc-mask' });
    mask.appendChild(createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: '#fff' }));
    s.rects.forEach(r => mask.appendChild(createSVG('rect', { x: r.x - pad, y: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad, rx: 6, fill: '#000' })));
    svg.querySelector('defs').appendChild(mask);
    svg.appendChild(createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: 'rgba(15, 23, 42, 0.5)', mask: 'url(#rc-mask)' }));
    s.rects.forEach(r => svg.appendChild(createSVG('rect', {
        x: r.x - pad, y: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad, rx: 6,
        fill: 'none', stroke: '#2563eb', 'stroke-width': 3
    })));
    // Step badge at the first box
    const r = s.rects[0];
    const bx = Math.max(24, Math.min(r.x - pad, 1000 - 60)), by = r.y - pad - 30 < 4 ? r.y + r.h + pad + 4 : r.y - pad - 30;
    const label = `STEP ${state.step}`;
    svg.appendChild(createSVG('rect', { x: bx, y: by, width: label.length * 9 + 16, height: 24, rx: 12, fill: '#2563eb' }));
    svg.appendChild(text(label, bx + 8, by + 16.5, { size: 13, weight: 800, fill: '#fff' }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

function renderControls() {
    if (!controlsRoot) return;
    const s = STEPS[state.step];
    const last = STEPS.length - 1;
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border-2 border-blue-500">
            <div class="text-[11px] font-bold tracking-widest text-blue-700 uppercase">${state.step === 0 ? 'Start here' : `Step ${state.step} of ${last}`}</div>
            <h3 class="text-lg font-extrabold text-slate-900 leading-tight mb-2">${esc(s.title)}</h3>
            <p class="text-sm text-slate-700 leading-relaxed mb-2"><span class="font-bold text-slate-900">Look at:</span> ${esc(s.look)}</p>
            <ul class="text-sm text-slate-700 space-y-1 mb-2">
                ${s.check.map(c => `<li class="flex gap-2"><i class="fa-solid fa-check text-green-600 mt-1 text-xs"></i><span>${esc(c)}</span></li>`).join('')}
            </ul>
            <p class="text-sm text-amber-900 bg-amber-50 rounded px-2 py-1.5"><span class="font-bold">Watch out:</span> ${esc(s.watch)}</p>
            ${s.link ? `<button id="rc-link" class="${UI.link} mt-2">${esc(s.link[2])} ▶</button>` : ''}
        </div>
        <div class="flex gap-2">
            <button id="rc-prev" class="${UI.segBtn} ${UI.segOff}" ${state.step === 0 ? 'disabled' : ''}>◀ Back</button>
            <button id="rc-next" class="${UI.segBtn} ${state.step === last ? UI.segOff : UI.segOn}" ${state.step === last ? 'disabled' : ''}>Next ▶</button>
        </div>
        <div class="${UI.card}">
            <h4 class="${UI.h4}">The reading order</h4>
            <ol class="space-y-0.5">
                ${STEPS.map((st, i) => `<li><button data-step="${i}" class="w-full text-left text-sm px-2 py-1 rounded ${i === state.step ? 'bg-blue-100 text-blue-900 font-bold' : 'text-slate-600 hover:bg-slate-100'}">
                    <span class="inline-block w-5 font-mono text-xs text-slate-400">${i || '•'}</span>${esc(st.title)}</button></li>`).join('')}
            </ol>
        </div>`;
    controlsRoot.querySelector('#rc-prev').onclick = () => go(state.step - 1);
    controlsRoot.querySelector('#rc-next').onclick = () => go(state.step + 1);
    controlsRoot.querySelectorAll('[data-step]').forEach(b => b.onclick = () => go(+b.dataset.step));
    controlsRoot.firstElementChild.scrollIntoView({ block: 'nearest' });
    const l = controlsRoot.querySelector('#rc-link');
    if (l) l.onclick = () => goTo(s.link[0], s.link[1]);
}
