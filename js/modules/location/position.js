// js/modules/location/position.js
// Position with material condition modifiers (RFS / MMC / LMC):
// size limits, bonus tolerance, allowed zone and virtual condition.

import { createSVG, readTolerance } from '../../drawing_utils.js';
import {
    COLORS, text, wrapText, addDefs, nominalLine, callout,
    featureControlFrame, legend, resultsStrip
} from '../../theme.js';

// --- STATE MANAGEMENT ---
// Engineering Parameters (INCHES)
const DEFAULT_SIZES = {
    hole: { nominal: 0.500, plusTol: 0.010, minusTol: 0.000, actualSize: 0.506 },
    pin:  { nominal: 0.490, plusTol: 0.000, minusTol: 0.010, actualSize: 0.484 }
};

const state = {
    featureType: 'hole',     // 'hole' | 'pin'
    modifier: 'MMC',         // 'RFS' | 'MMC' | 'LMC'
    toleranceDiam: 0.030,    // Stated position tolerance (diameter)
    ...DEFAULT_SIZES.hole,
    deviationX: 0.012,       // Measured axis offset from true position
    deviationY: 0.012,

    // UI State
    isDragging: false,
    dragScale: null,         // Scale frozen at drag start so the point tracks the mouse
    showGuide: false
};

// --- DRAWING GEOMETRY (px) ---
const ZC = { x: 320, y: 410 };   // True position in the zone view
const R_MAX = 180;               // Largest zone radius drawn
const PANEL_X = 620;             // Right-hand size / bonus panel
const PANEL_W = 330;
const EPS = 1e-9;

// --- DOM REFERENCES ---
let svgContainer = null;
let controlsContainer = null;

// --- EXPORTED METHODS ---

export function draw(svg) {
    svgContainer = svg;
    setupInteractions(svg);
    renderScene();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// --- EVALUATION ---

const f4 = v => v.toFixed(4);

function evaluate() {
    const { featureType, modifier, toleranceDiam, nominal, plusTol, minusTol, actualSize, deviationX, deviationY } = state;
    const isHole = featureType === 'hole';
    const lower = nominal - minusTol;
    const upper = nominal + plusTol;
    const mmc = isHole ? lower : upper;          // Most material: smallest hole, largest pin
    const lmc = isHole ? upper : lower;
    const sizeRange = upper - lower;
    const sizeOK = actualSize >= lower - EPS && actualSize <= upper + EPS;

    // Bonus = how far the actual size has departed from the modifier's condition
    let bonusRaw = 0;
    if (modifier === 'MMC') bonusRaw = isHole ? actualSize - mmc : mmc - actualSize;
    if (modifier === 'LMC') bonusRaw = isHole ? lmc - actualSize : actualSize - lmc;
    const bonus = Math.min(Math.max(bonusRaw, 0), sizeRange);
    const maxBonus = modifier === 'RFS' ? 0 : sizeRange;

    const allowed = toleranceDiam + bonus;
    const radial = Math.hypot(deviationX, deviationY);
    const position = 2 * radial;
    const posOK = position <= allowed + EPS;

    // Virtual condition: the constant worst-case boundary (not defined for RFS)
    let vc = null;
    if (modifier === 'MMC') vc = isHole ? mmc - toleranceDiam : mmc + toleranceDiam;
    if (modifier === 'LMC') vc = isHole ? lmc + toleranceDiam : lmc - toleranceDiam;

    return {
        isHole, lower, upper, mmc, lmc, sizeRange, sizeOK,
        bonus, maxBonus, allowed, radial, position, posOK, vc,
        pass: sizeOK && posOK
    };
}

// px per inch in the zone view: fits the largest zone the size range can
// produce (so the zone visibly grows with bonus) and the measured point.
function drawScale(r = evaluate()) {
    if (state.dragScale) return state.dragScale;
    const maxZoneR = (state.toleranceDiam + r.maxBonus) / 2;
    return R_MAX / Math.max(maxZoneR, r.radial * 1.1);
}

// --- RENDERING ORCHESTRATION ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    addDefs(svgContainer);

    const r = evaluate();
    const s = drawScale(r);

    drawZoneView(r, s);
    drawActualAxis(r, s);
    drawLegendAndFrame();
    drawSizePanel(r);
    drawToleranceSum(r);
    drawVirtualCondition(r);
    drawResults(r);

    if (state.showGuide) drawGuideOverlay();

    updateReadouts();
}

// --- DRAWING HELPERS ---

function circlePath(cx, cy, rad) {
    return `M ${cx - rad},${cy} a ${rad},${rad} 0 1,0 ${rad * 2},0 a ${rad},${rad} 0 1,0 ${-rad * 2},0 Z`;
}

function drawZoneView(r, s) {
    const g = createSVG('g', {});
    const Rs = (state.toleranceDiam / 2) * s;
    const Ra = (r.allowed / 2) * s;
    const Rmax = ((state.toleranceDiam + r.maxBonus) / 2) * s;

    // True position center lines
    g.appendChild(nominalLine(ZC.x - 200, ZC.y, ZC.x + 200, ZC.y));
    g.appendChild(nominalLine(ZC.x, ZC.y - R_MAX - 10, ZC.x, ZC.y + R_MAX + 10));
    g.appendChild(text('true position (basic dims from B and C)', ZC.x + 8, ZC.y - R_MAX - 12, { size: 12, fill: COLORS.muted }));

    // Ceiling: the largest zone possible at the far size limit
    if (r.maxBonus > 0 && Rmax - Ra > 2) {
        g.appendChild(createSVG('circle', {
            cx: ZC.x, cy: ZC.y, r: Rmax, fill: 'none',
            stroke: COLORS.nominal, 'stroke-width': 1, 'stroke-dasharray': '2 4'
        }));
        const at = { x: ZC.x + Rmax * Math.cos(-2 * Math.PI / 3), y: ZC.y + Rmax * Math.sin(-2 * Math.PI / 3) };
        const farLimit = state.modifier === 'MMC' ? 'LMC' : 'MMC';
        g.appendChild(callout(`max Ø${f4(state.toleranceDiam + r.maxBonus)} at ${farLimit}`, at.x - 30, at.y + 4, at.x, at.y,
            { anchor: 'end', size: 11.5, fill: COLORS.muted, weight: 400 }));
    }

    // Bonus ring (hatched) and stated zone
    if (Ra - Rs > 0.5) {
        g.appendChild(createSVG('path', {
            d: circlePath(ZC.x, ZC.y, Ra) + ' ' + circlePath(ZC.x, ZC.y, Rs),
            fill: 'url(#thm-hatch-zone)', 'fill-rule': 'evenodd'
        }));
        g.appendChild(createSVG('circle', {
            cx: ZC.x, cy: ZC.y, r: Ra, fill: 'none',
            stroke: COLORS.zoneStroke, 'stroke-width': 2, 'stroke-dasharray': '10 6'
        }));
    }
    g.appendChild(createSVG('circle', {
        cx: ZC.x, cy: ZC.y, r: Rs, fill: COLORS.zoneFill,
        stroke: COLORS.zoneStroke, 'stroke-width': 1.5, 'stroke-dasharray': '5 4'
    }));

    // Zone labels, bottom-left
    const onCircle = (rad, deg) => ({ x: ZC.x + rad * Math.cos(deg * Math.PI / 180), y: ZC.y + rad * Math.sin(deg * Math.PI / 180) });
    if (Ra - Rs > 0.5) {
        const pa = onCircle(Ra, 165);
        g.appendChild(callout(`Ø${f4(r.allowed)} with bonus`, 36, 568, pa.x, pa.y,
            { anchor: 'start', size: 12.5, fill: COLORS.zoneText, weight: 600 }));
        const ps = onCircle(Rs, 125);
        g.appendChild(callout(`Ø${f4(state.toleranceDiam)} stated`, 36, 594, ps.x, ps.y,
            { anchor: 'start', size: 12.5, fill: COLORS.zoneText, weight: 600 }));
    } else {
        const ps = onCircle(Rs, 150);
        const why = state.modifier === 'RFS' ? 'RFS, no bonus' : `at ${state.modifier}, no bonus`;
        g.appendChild(callout(`Ø${f4(state.toleranceDiam)} allowed (${why})`, 36, 580, ps.x, ps.y,
            { anchor: 'start', size: 12.5, fill: COLORS.zoneText, weight: 600 }));
    }

    g.appendChild(text('Axis location, top view. Zone magnified; the hole itself is not to scale.', ZC.x, 628,
        { size: 11.5, fill: COLORS.muted, anchor: 'middle', italic: true }));
    svgContainer.appendChild(g);
}

function drawActualAxis(r, s) {
    const g = createSVG('g', {});
    const px = ZC.x + state.deviationX * s;
    const py = ZC.y - state.deviationY * s;
    const color = r.posOK ? COLORS.actual : COLORS.fail;

    // X and Y legs of the offset
    const leg = { stroke: COLORS.muted, 'stroke-width': 1, 'stroke-dasharray': '3 3' };
    g.appendChild(createSVG('line', { x1: ZC.x, y1: py, x2: px, y2: py, ...leg }));
    g.appendChild(createSVG('line', { x1: px, y1: ZC.y, x2: px, y2: py, ...leg }));
    if (Math.abs(px - ZC.x) > 30) {
        g.appendChild(text(`x ${f4(state.deviationX)}`, (ZC.x + px) / 2, py + (py < ZC.y ? -8 : 16),
            { size: 11, mono: true, fill: COLORS.muted, anchor: 'middle' }));
    }
    if (Math.abs(py - ZC.y) > 20) {
        g.appendChild(text(`y ${f4(state.deviationY)}`, px + (px >= ZC.x ? 8 : -8), (ZC.y + py) / 2 + 4,
            { size: 11, mono: true, fill: COLORS.muted, anchor: px >= ZC.x ? 'start' : 'end' }));
    }

    // Radial offset
    g.appendChild(createSVG('line', { x1: ZC.x, y1: ZC.y, x2: px, y2: py, stroke: color, 'stroke-width': 2 }));

    // The measured axis (drag handle)
    g.appendChild(createSVG('circle', {
        cx: px, cy: py, r: 10, fill: COLORS.card, stroke: color, 'stroke-width': 2.5, style: 'cursor: grab'
    }));
    g.appendChild(createSVG('circle', { cx: px, cy: py, r: 4, fill: color }));

    const right = px >= ZC.x;
    g.appendChild(text(`axis: position Ø${f4(r.position)}`, px + (right ? 16 : -16), py - 14,
        { size: 12.5, weight: 700, fill: color, anchor: right ? 'start' : 'end' }));
    if (!state.isDragging) {
        g.appendChild(text('drag', px + (right ? 16 : -16), py + 22,
            { size: 11, italic: true, fill: COLORS.muted, anchor: right ? 'start' : 'end' }));
    }
    svgContainer.appendChild(g);
}

function drawLegendAndFrame() {
    svgContainer.appendChild(legend(24, 24, [
        { kind: 'zoneOutline', label: 'Stated position zone' },
        { kind: 'bonus', label: 'Bonus tolerance from size' },
        { kind: 'point', label: `Measured ${state.featureType} axis` },
        { kind: 'nominal', label: 'True position (perfect location)' },
        { kind: 'fail', label: 'Outside the allowed zone' }
    ], { note: 'Position = 2 × distance from true position' }));

    const modLetter = { MMC: 'M', LMC: 'L', RFS: null }[state.modifier];
    const fcf = featureControlFrame(PANEL_X, 40, {
        symbol: 'position', tolerance: state.toleranceDiam.toFixed(3),
        diameter: true, modifier: modLetter, datums: ['A', 'B', 'C']
    });
    svgContainer.appendChild(fcf.g);

    const feature = state.featureType;
    const note = state.modifier === 'RFS'
        ? `The ${feature} axis must lie in a Ø${state.toleranceDiam.toFixed(3)} zone at true position, whatever its size.`
        : `The ${feature} axis must lie in a Ø${state.toleranceDiam.toFixed(3)} zone at ${state.modifier}. The zone grows as the ${feature} departs from ${state.modifier}.`;
    svgContainer.appendChild(wrapText(note, PANEL_X, 98, 50, 17, { size: 12.5, fill: COLORS.muted }));
}

function panelTitle(str, y) {
    return text(str, PANEL_X, y, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' });
}

function drawSizePanel(r) {
    const g = createSVG('g', {});
    g.appendChild(panelTitle(`1. MEASURED SIZE ${state.modifier === 'RFS' ? '(IGNORED AT RFS)' : '→ BONUS'}`, 190));

    // Size scale: covers both limits and the measured size, with padding
    const pad = 0.3 * Math.max(r.sizeRange, 0.002);
    const vmin = Math.min(r.lower, state.actualSize) - pad;
    const vmax = Math.max(r.upper, state.actualSize) + pad;
    const X = v => PANEL_X + ((v - vmin) / (vmax - vmin)) * PANEL_W;
    const y = 250;

    g.appendChild(createSVG('line', { x1: PANEL_X, y1: y, x2: PANEL_X + PANEL_W, y2: y, stroke: COLORS.faint, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    g.appendChild(createSVG('line', { x1: X(r.lower), y1: y, x2: X(r.upper), y2: y, stroke: COLORS.partStroke, 'stroke-width': 6 }));

    // Limit ticks: MMC and LMC (stagger labels when close)
    const close = Math.abs(X(r.mmc) - X(r.lmc)) < 110;
    const limits = [['MMC', r.mmc, 222], ['LMC', r.lmc, close ? 204 : 222]];
    for (const [name, v, ly] of limits) {
        g.appendChild(createSVG('line', { x1: X(v), y1: y - 12, x2: X(v), y2: y + 12, stroke: COLORS.ink, 'stroke-width': 2 }));
        g.appendChild(text(`${name} Ø${f4(v)}`, X(v), ly, { size: 12, weight: 600, mono: true, anchor: 'middle', fill: COLORS.ink }));
    }

    // Measured size marker
    const ax = X(state.actualSize);
    const mColor = r.sizeOK ? COLORS.actual : COLORS.fail;
    g.appendChild(createSVG('path', { d: `M ${ax},${y + 8} L ${ax - 8},${y + 22} L ${ax + 8},${y + 22} Z`, fill: mColor }));
    const mAnchor = ax > PANEL_X + PANEL_W - 110 ? 'end' : ax < PANEL_X + 110 ? 'start' : 'middle';
    const mx = mAnchor === 'end' ? ax + 10 : mAnchor === 'start' ? ax - 10 : ax;
    g.appendChild(text(`measured Ø${f4(state.actualSize)}${r.sizeOK ? '' : ' (out of size)'}`, mx, y + 40,
        { size: 12.5, weight: 700, anchor: mAnchor, fill: mColor }));

    // Bonus bracket from the modifier's limit to the measured size
    if (state.modifier !== 'RFS') {
        const ref = state.modifier === 'MMC' ? r.mmc : r.lmc;
        const by = y + 64;
        if (r.bonus > EPS) {
            // Bonus runs from the modifier's limit toward the other limit (capped there)
            const towardOther = (state.modifier === 'MMC') === r.isHole ? 1 : -1;
            const x1 = X(ref), x2 = X(ref + towardOther * r.bonus);
            g.appendChild(createSVG('path', {
                d: `M ${x1},${by - 8} L ${x1},${by} L ${x2},${by} L ${x2},${by - 8}`,
                fill: 'none', stroke: COLORS.zoneStroke, 'stroke-width': 2
            }));
            g.appendChild(text(`bonus ${f4(r.bonus)}`, (x1 + x2) / 2, by + 18,
                { size: 13, weight: 700, mono: true, anchor: 'middle', fill: COLORS.zoneText }));
        } else {
            g.appendChild(text(`No bonus: the ${state.featureType} is at (or beyond) ${state.modifier}.`, PANEL_X, by + 10,
                { size: 12.5, fill: COLORS.zoneText }));
        }
    } else {
        g.appendChild(text('RFS: size does not change the zone.', PANEL_X, y + 74, { size: 12.5, fill: COLORS.muted }));
    }
    svgContainer.appendChild(g);
}

function drawToleranceSum(r) {
    const g = createSVG('g', {});
    g.appendChild(panelTitle('2. ALLOWED POSITION TOLERANCE', 370));

    const tol = state.toleranceDiam;
    const scaleMax = Math.max(tol + r.maxBonus, r.position) * 1.08;
    const W = v => (v / scaleMax) * PANEL_W;
    const y = 400;

    g.appendChild(createSVG('rect', { x: PANEL_X, y, width: PANEL_W, height: 16, rx: 3, fill: '#f1f5f9' }));
    g.appendChild(createSVG('rect', { x: PANEL_X, y, width: W(tol), height: 16, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1.5 }));
    if (r.bonus > EPS) {
        g.appendChild(createSVG('rect', { x: PANEL_X + W(tol), y, width: W(r.bonus), height: 16, fill: 'url(#thm-hatch-zone)', stroke: COLORS.zoneStroke, 'stroke-width': 1.5 }));
    }

    // Measured position against the allowance
    const mx = PANEL_X + Math.min(W(r.position), PANEL_W);
    const color = r.posOK ? COLORS.pass : COLORS.fail;
    g.appendChild(createSVG('line', { x1: mx, y1: y - 8, x2: mx, y2: y + 24, stroke: color, 'stroke-width': 3 }));
    g.appendChild(text(`measured Ø${f4(r.position)}`, mx, y - 12,
        { size: 11.5, weight: 700, anchor: mx > PANEL_X + PANEL_W - 60 ? 'end' : 'middle', fill: color }));

    const sum = r.bonus > EPS
        ? `stated ${f4(tol)} + bonus ${f4(r.bonus)} = Ø${f4(r.allowed)}`
        : `stated ${f4(tol)} + no bonus = Ø${f4(r.allowed)}`;
    g.appendChild(text(sum, PANEL_X, y + 42, { size: 13, weight: 600, mono: true, fill: COLORS.zoneText }));
    svgContainer.appendChild(g);
}

function drawVirtualCondition(r) {
    const g = createSVG('g', {});
    g.appendChild(panelTitle('3. VIRTUAL CONDITION (WORST-CASE BOUNDARY)', 492));
    const tol = f4(state.toleranceDiam);
    const feature = state.featureType;

    if (r.vc === null) {
        g.appendChild(wrapText('At RFS the boundary changes with the actual size, so there is no single gauge size. Inspect with a CMM or an adjustable gauge.',
            PANEL_X, 520, 50, 18, { size: 13, fill: COLORS.text }));
    } else {
        let formula, meaning;
        if (state.modifier === 'MMC') {
            formula = r.isHole ? `Ø${f4(r.vc)} = MMC ${f4(r.mmc)} − ${tol}` : `Ø${f4(r.vc)} = MMC ${f4(r.mmc)} + ${tol}`;
            meaning = r.isHole
                ? `A fixed gauge pin of Ø${f4(r.vc)} at true position must always enter the hole. This is the size of the mating part's worst case.`
                : `A fixed gauge hole of Ø${f4(r.vc)} at true position must always accept the pin. Size the mating hole at least this big.`;
        } else {
            formula = r.isHole ? `Ø${f4(r.vc)} = LMC ${f4(r.lmc)} + ${tol}` : `Ø${f4(r.vc)} = LMC ${f4(r.lmc)} − ${tol}`;
            meaning = `The worst-case boundary on the material side, which protects minimum wall thickness around the ${feature}. It cannot be checked with a fixed gauge.`;
        }
        g.appendChild(text(formula, PANEL_X, 522, { size: 15, weight: 700, mono: true, fill: COLORS.ink }));
        g.appendChild(wrapText(meaning, PANEL_X, 548, 50, 18, { size: 13, fill: COLORS.text }));
    }
    svgContainer.appendChild(g);
}

function drawResults(r) {
    const feature = state.featureType;
    const tol = f4(state.toleranceDiam);
    let sentence;
    if (!r.sizeOK) {
        sentence = `The ${feature} measures Ø${f4(state.actualSize)}, outside its size limits Ø${f4(r.lower)} to Ø${f4(r.upper)}. It fails on size, whatever its position.`;
    } else {
        const where = `The axis is ${f4(r.radial)}" from true position, a position of Ø${f4(r.position)}.`;
        let why;
        if (state.modifier === 'RFS') {
            why = ` RFS gives no bonus, so it must fit the stated Ø${tol}.`;
        } else if (r.bonus > EPS) {
            why = ` At Ø${f4(state.actualSize)} the ${feature} is ${f4(r.bonus)}" from ${state.modifier}, earning that as bonus: allowed Ø${f4(r.allowed)}.`;
        } else {
            why = ` The ${feature} is at ${state.modifier}, so there is no bonus: allowed Ø${tol}.`;
        }
        const verdict = !r.posOK ? ' It fails.'
            : (r.position > state.toleranceDiam + EPS ? ' It passes, but only thanks to the bonus.' : ' It passes.');
        sentence = where + why + verdict;
    }
    svgContainer.appendChild(resultsStrip({
        pass: r.pass,
        measured: { label: 'Position (Ø)', value: r.position },
        allowed: { label: 'Allowed (Ø)', value: r.allowed },
        sentence,
        compact: true
    }));
}

function drawGuideOverlay() {
    svgContainer.appendChild(createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: 'rgba(15, 23, 42, 0.95)' }));

    const group = createSVG('g', {});
    let yPos = 130;
    const write = (str, size = 17, color = '#cbd5e1', weight = 400) => {
        group.appendChild(text(str, 500, yPos, { size, fill: color, weight, anchor: 'middle' }));
        yPos += size * 1.6;
    };

    write('HOW POSITION AND BONUS TOLERANCE WORK', 30, '#ffffff', 800);
    yPos += 16;
    write('1. POSITION', 20, '#93c5fd', 700);
    write('The axis must lie in a round zone centered on true position.');
    write('Position = 2 × the distance from true position (the zone is a diameter).');
    yPos += 16;
    write('2. MMC AND BONUS', 20, '#93c5fd', 700);
    write('MMC = most material: the smallest hole or the largest pin.');
    write('As the part moves away from MMC it gets more clearance, so the zone grows by that amount.');
    write('LMC works the other way. RFS means no bonus at all.');
    yPos += 16;
    write('3. VIRTUAL CONDITION', 20, '#93c5fd', 700);
    write('Hole at MMC: MMC − tolerance. This is the fixed gauge pin that must always fit.');
    yPos += 16;
    write('TRY IT', 20, '#93c5fd', 700);
    write('Drag the axis point, change the measured size, and switch RFS / MMC / LMC.');
    yPos += 30;
    write('[ CLICK TO CLOSE ]', 14, '#94a3b8');

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
    const getMousePos = (evt) => {
        const CTM = svg.getScreenCTM();
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    };

    svg.addEventListener('mousedown', (evt) => {
        if (state.showGuide) return;
        const m = getMousePos(evt);
        const s = drawScale();
        const px = ZC.x + state.deviationX * s;
        const py = ZC.y - state.deviationY * s;
        if (Math.hypot(m.x - px, m.y - py) < 30) {
            state.dragScale = s;
            state.isDragging = true;
            svg.style.cursor = 'grabbing';
        }
    });

    svg.addEventListener('mousemove', (evt) => {
        if (!state.isDragging) return;
        const m = getMousePos(evt);
        // Keep the point inside the drawn view
        let dx = (m.x - ZC.x) / state.dragScale;
        let dy = -(m.y - ZC.y) / state.dragScale;
        const limit = (R_MAX + 15) / state.dragScale;
        const d = Math.hypot(dx, dy);
        if (d > limit) { dx *= limit / d; dy *= limit / d; }
        state.deviationX = dx;
        state.deviationY = dy;
        renderScene();
    });

    const endDrag = () => {
        if (!state.isDragging) return;
        state.isDragging = false;
        state.dragScale = null;
        svg.style.cursor = 'default';
        renderScene();
    };
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);
}

// --- CONTROLS UI ---

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const numInput = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';

function renderControls() {
    if (!controlsContainer) return;
    const r = evaluate();
    const pad = Math.max(r.sizeRange * 0.5, 0.002);
    const sMin = (r.lower - pad).toFixed(4);
    const sMax = (r.upper + pad).toFixed(4);
    const seg = (group, value, label) =>
        `<button data-${group}="${value}" class="${segBtn} ${state[group === 'mod' ? 'modifier' : 'featureType'] === value ? segOn : segOff}">${label}</button>`;

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Control Frame</h4>
            <div class="flex items-center gap-2 mb-3">
                <label class="text-sm font-semibold text-slate-700 w-32 shrink-0">Tolerance Ø</label>
                <input type="number" id="ctrl-tol" value="${state.toleranceDiam}" step="0.001" min="0.001" class="${numInput} bg-yellow-50">
            </div>
            <div class="text-xs font-bold text-slate-500 mb-1">MATERIAL CONDITION</div>
            <div class="flex gap-2">
                ${seg('mod', 'RFS', 'RFS')}${seg('mod', 'MMC', 'MMC Ⓜ')}${seg('mod', 'LMC', 'LMC Ⓛ')}
            </div>
            <button id="btn-guide" class="mt-4 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 transition-colors font-bold text-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-circle-question"></i> EXPLAIN BONUS TOLERANCE
            </button>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Feature Size (in)</h4>
            <div class="flex gap-2 mb-3">
                ${seg('type', 'hole', 'Hole (internal)')}${seg('type', 'pin', 'Pin (external)')}
            </div>
            <div class="grid grid-cols-3 gap-2 mb-1">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">NOMINAL Ø</label>
                    <input type="number" id="ctrl-nom" step="0.001" value="${state.nominal.toFixed(4)}" class="${numInput}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">+ TOL</label>
                    <input type="number" id="ctrl-plus" step="0.001" min="0" value="${state.plusTol.toFixed(4)}" class="${numInput}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">− TOL</label>
                    <input type="number" id="ctrl-minus" step="0.001" min="0" value="${state.minusTol.toFixed(4)}" class="${numInput}"></div>
            </div>
            <div class="text-xs text-slate-500 font-mono mb-4">MMC Ø${f4(r.mmc)} · LMC Ø${f4(r.lmc)}</div>

            <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-bold text-slate-500">MEASURED SIZE Ø</label>
                <input type="number" id="ctrl-size" step="0.0005" value="${state.actualSize.toFixed(4)}" class="w-28 px-2 py-1 border border-slate-300 rounded font-mono text-sm text-right">
            </div>
            <input type="range" id="slide-size" min="${sMin}" max="${sMax}" step="0.0001" value="${state.actualSize}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer">
            <div class="flex gap-2 mt-2">
                <button id="btn-at-mmc" class="flex-1 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold">SET TO MMC</button>
                <button id="btn-at-lmc" class="flex-1 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold">SET TO LMC</button>
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Measured Axis Location (in)</h4>
            <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">X OFFSET</label>
                    <input type="number" id="ctrl-x" step="0.001" value="${state.deviationX.toFixed(4)}" class="${numInput}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">Y OFFSET</label>
                    <input type="number" id="ctrl-y" step="0.001" value="${state.deviationY.toFixed(4)}" class="${numInput}"></div>
            </div>
            <p class="text-xs text-slate-400 mt-2">Or drag the axis point on the drawing.</p>
        </div>

        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Why bonus exists</div>
            <div class="text-xs opacity-90 leading-relaxed">
                At MMC a hole has the least clearance around its mating bolt. A bigger hole has more room to be off location and still assemble, so the zone grows by exactly the size departure. That is why MMC is the default choice for clearance holes and bolt patterns.
            </div>
        </div>
    `;

    bindControlEvents();
}

function bindControlEvents() {
    const $ = id => document.getElementById(id);

    $('ctrl-tol').oninput = (e) => { state.toleranceDiam = readTolerance(e.target.value); renderScene(); };

    controlsContainer.querySelectorAll('[data-mod]').forEach(b => {
        b.onclick = () => { state.modifier = b.dataset.mod; renderControls(); renderScene(); };
    });
    controlsContainer.querySelectorAll('[data-type]').forEach(b => {
        b.onclick = () => {
            if (state.featureType === b.dataset.type) return;
            state.featureType = b.dataset.type;
            Object.assign(state, DEFAULT_SIZES[state.featureType]);
            renderControls();
            renderScene();
        };
    });

    // Size limits change the slider range, so rebuild the controls
    const readLimit = (id, key, allowZero) => {
        $(id).onchange = (e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && (allowZero ? v >= 0 : v > 0)) state[key] = v;
            renderControls();
            renderScene();
        };
    };
    readLimit('ctrl-nom', 'nominal', false);
    readLimit('ctrl-plus', 'plusTol', true);
    readLimit('ctrl-minus', 'minusTol', true);

    const setSize = (v) => {
        if (!Number.isFinite(v) || v <= 0) return;
        state.actualSize = v;
        $('ctrl-size').value = v.toFixed(4);
        $('slide-size').value = v;
        renderScene();
    };
    $('slide-size').oninput = (e) => setSize(parseFloat(e.target.value));
    $('ctrl-size').onchange = (e) => setSize(parseFloat(e.target.value));
    $('btn-at-mmc').onclick = () => setSize(evaluate().mmc);
    $('btn-at-lmc').onclick = () => setSize(evaluate().lmc);

    const setXY = () => {
        state.deviationX = parseFloat($('ctrl-x').value) || 0;
        state.deviationY = parseFloat($('ctrl-y').value) || 0;
        renderScene();
    };
    $('ctrl-x').onchange = setXY;
    $('ctrl-y').onchange = setXY;

    $('btn-guide').onclick = () => { state.showGuide = !state.showGuide; renderScene(); };
}

function updateReadouts() {
    if (state.isDragging) {
        const inputX = document.getElementById('ctrl-x');
        const inputY = document.getElementById('ctrl-y');
        if (inputX) inputX.value = state.deviationX.toFixed(4);
        if (inputY) inputY.value = state.deviationY.toFixed(4);
    }
}
