// js/modules/location/composite_position.js
// Composite position (two rows sharing one ⌖ symbol), 4-hole pattern.
//   Upper row (pattern-locating, PLTZF): each hole within a big zone at its
//   true position from datums A, B, C. This locates the PATTERN.
//   Lower row (feature-relating, FRTZF): each hole within a small zone, but
//   the pattern of small zones may slide as a group (and turn, when the lower
//   row only references A). It controls the holes TO EACH OTHER.
// Drag the hole centres (magnified) and watch both rows pass or fail.

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, addDefs, text, wrapText, featureControlFrame, resultsStrip, halo } from '../../theme.js';
import { getUnits, step, unitName, decimals } from '../../units.js';
import { shareable } from '../../share.js';

// Basic geometry per unit (not converted: each unit has its own clean example)
const GEO = {
    in: { sx: 3.000, sy: 2.000, ox: 1.000, oy: 0.750 },
    mm: { sx: 75, sy: 50, ox: 25, oy: 20 }
};
const START = {
    in: { t1: 0.030, t2: 0.010, mmc: 0.500, lmc: 0.510, actual: 0.500 },
    mm: { t1: 0.8, t2: 0.25, mmc: 12.0, lmc: 12.25, actual: 12.0 }
};

const state = {
    lowerRef: 'A',            // 'A' (pattern may shift and turn) | 'AB' (may shift, not turn)
    mmcMod: true,
    sel: 0,
    ...START.in,
    dev: [[0, 0], [0, 0], [0, 0], [0, 0]]   // hole centre offsets from true position (x, y)
};
let units = null;

// Each unit has its own clean example, so a unit change loads that example
function followUnits() {
    const u = getUnits();
    if (units === u) return;
    units = u;
    Object.assign(state, START[u]);
    presetDev('shift');
}

let svgRef = null, controlsRoot = null, drag = null;
const f = v => v.toFixed(decimals());

export function draw(svg) {
    followUnits();
    svgRef = svg;
    svg.addEventListener('pointerdown', e => {
        const h = e.target.closest('[data-hole]');
        if (!h) return;
        drag = +h.dataset.hole;
        state.sel = drag;
        svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => { if (drag !== null) dragTo(e); });
    svg.addEventListener('pointerup', () => { if (drag !== null) { drag = null; renderControls(); } });
    render();
}

export function loadControls(container) {
    followUnits();
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

/** True positions of the 4 holes, from the pattern centre. */
export function patternPoints(g) {
    const hx = g.sx / 2, hy = g.sy / 2;
    return [[-hx, hy], [hx, hy], [hx, -hy], [-hx, -hy]];
}

/**
 * Lower row: the smallest worst-hole distance after moving the pattern of
 * zones as a group: shift (sx, sy), plus rotation θ about the pattern centre
 * when allowed. Returns { shift, theta, resid: [[x, y]...], worst }.
 */
export function bestFit(dev, pts, rotate) {
    const resid = (sx, sy, t) => dev.map(([dx, dy], i) => {
        const [px, py] = pts[i];
        const c = Math.cos(t), s = Math.sin(t);
        const zx = c * px - s * py + sx, zy = s * px + c * py + sy;        // moved zone centre
        return [px + dx - zx, py + dy - zy];
    });
    const cost = (sx, sy, t) => Math.max(...resid(sx, sy, t).map(([x, y]) => Math.hypot(x, y)));
    const dMax = Math.max(...dev.map(d => Math.hypot(...d)), 1e-9);
    const reach = Math.max(...pts.map(p => Math.hypot(...p)));
    let span = [dMax, dMax, rotate ? 2 * dMax / reach : 0];
    let best = [0, 0, 0], bestC = cost(0, 0, 0);
    for (let pass = 0; pass < 8; pass++) {
        const [cx, cy, ct] = best;
        const K = rotate ? 6 : 10;
        for (let i = -K; i <= K; i++) for (let j = -K; j <= K; j++) for (let k = rotate ? -6 : 0; k <= (rotate ? 6 : 0); k++) {
            const sx = cx + span[0] * i / K, sy = cy + span[1] * j / K, t = ct + (rotate ? span[2] * k / 6 : 0);
            const c = cost(sx, sy, t);
            if (c < bestC) { bestC = c; best = [sx, sy, t]; }
        }
        span = span.map(v => v / 2.5);
    }
    return { shift: [best[0], best[1]], theta: best[2], resid: resid(...best), worst: bestC };
}

export function evaluateComposite(s, g) {
    const pts = patternPoints(g);
    const bonus = s.mmcMod ? Math.max(0, Math.min(s.actual, s.lmc) - s.mmc) : 0;
    const a1 = s.t1 + bonus, a2 = s.t2 + bonus;
    const upper = s.dev.map(d => 2 * Math.hypot(...d));                    // Ø position from the datums
    const fit = bestFit(s.dev, pts, s.lowerRef === 'A');
    const lower = fit.resid.map(r => 2 * Math.hypot(...r));                // Ø position within the shifted pattern
    const upOK = upper.map(v => v <= a1 + EPS), lowOK = lower.map(v => v <= a2 + EPS);
    const sizeOK = s.actual >= s.mmc - EPS && s.actual <= s.lmc + EPS;
    return { pts, bonus, a1, a2, upper, lower, upOK, lowOK, fit, sizeOK,
        upperPass: upOK.every(Boolean), lowerPass: lowOK.every(Boolean),
        pass: sizeOK && upOK.every(Boolean) && lowOK.every(Boolean) };
}
const evaluate = () => evaluateComposite(state, GEO[units]);

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const P0 = { x: 300, y: 235 };          // pattern centre on screen
const SPAN = { x: 320, y: 200 };        // hole spacing on screen
const BR = 66;                          // bubble radius (magnified view around each hole)
let M = 1;                              // px per unit inside the bubbles

const holeXY = i => {
    const [px, py] = patternPoints(GEO[units])[i];
    return { x: P0.x + px / (GEO[units].sx / 2) * SPAN.x / 2, y: P0.y - py / (GEO[units].sy / 2) * SPAN.y / 2 };
};

function dragTo(e) {
    const m = svgRef.getScreenCTM();
    const x = (e.clientX - m.e) / m.a, y = (e.clientY - m.f) / m.d;
    const c = holeXY(drag);
    let dx = (x - c.x) / M, dy = (c.y - y) / M;
    const lim = (BR - 6) / M, d = Math.hypot(dx, dy);
    if (d > lim) { dx *= lim / d; dy *= lim / d; }
    const r = v => +v.toFixed(decimals() + 1);
    state.dev[drag] = [r(dx), r(dy)];
    render();
}

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const g = GEO[units], r = evaluate();
    const maxA1 = state.t1 + (state.mmcMod ? state.lmc - state.mmc : 0);
    M = (BR - 8) / Math.max(maxA1 / 2, ...state.dev.map(d => Math.hypot(...d)), g.sx * 1e-4);   // floor: zero tolerances and perfect holes

    // Plate, datums B (bottom edge) and C (left edge), basic dimensions
    const L = 70, T = 70, R = 530, B = 400;
    svg.appendChild(createSVG('rect', { x: L, y: T, width: R - L, height: B - T, fill: COLORS.partFill, stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
    svg.appendChild(text(`TOP VIEW · hole centres magnified ×${Math.round(M / (SPAN.x / g.sx))}`, 30, 36, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.05em' }));
    const tag = (x, y, l) => {
        svg.appendChild(createSVG('rect', { x: x - 13, y: y - 13, width: 26, height: 26, fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 1.5 }));
        svg.appendChild(text(l, x, y + 6, { size: 15, weight: 700, fill: COLORS.ink, anchor: 'middle' }));
    };
    tag(R - 40, B + 30, 'B'); svg.appendChild(createSVG('line', { x1: R - 40, y1: B, x2: R - 40, y2: B + 17, stroke: COLORS.ink, 'stroke-width': 1.5 }));
    tag(L - 32, T + 40, 'C'); svg.appendChild(createSVG('line', { x1: L, y1: T + 40, x2: L - 19, y2: T + 40, stroke: COLORS.ink, 'stroke-width': 1.5 }));
    const box = (label, x, y) => {
        const w = label.length * 8.4 + 12;
        svg.appendChild(createSVG('rect', { x: x - w / 2, y: y - 14, width: w, height: 20, fill: '#fff', stroke: COLORS.ink, 'stroke-width': 1.2 }));
        svg.appendChild(text(label, x, y + 1, { size: 13, weight: 600, fill: COLORS.ink, anchor: 'middle', mono: true }));
    };
    const h0 = holeXY(0), h1 = holeXY(1), h3 = holeXY(3);
    svg.appendChild(createSVG('line', { x1: h0.x, y1: B + 22, x2: h1.x, y2: B + 22, stroke: COLORS.muted, 'stroke-width': 1.2, 'marker-start': 'url(#thm-arrow-muted)', 'marker-end': 'url(#thm-arrow-muted)' }));
    box(String(+g.sx.toFixed(3)), (h0.x + h1.x) / 2, B + 24);
    svg.appendChild(createSVG('line', { x1: R + 26, y1: h1.y, x2: R + 26, y2: h3.y, stroke: COLORS.muted, 'stroke-width': 1.2, 'marker-start': 'url(#thm-arrow-muted)', 'marker-end': 'url(#thm-arrow-muted)' }));
    box(String(+g.sy.toFixed(3)), R + 26, (h1.y + h3.y) / 2 + 4);
    svg.appendChild(text(`4X holes, true positions basic from B and C · datum A is the face you are looking at`, L, B + 62, { size: 12.5, italic: true, fill: COLORS.muted }));

    // Lower-row pattern (green), drawn through the moved zone centres
    const zc = r.pts.map((_, i) => {
        const c = holeXY(i), [dx, dy] = state.dev[i], [rx, ry] = r.fit.resid[i];
        return { x: c.x + (dx - rx) * M, y: c.y - (dy - ry) * M };      // zone centre = hole − residual
    });
    svg.appendChild(createSVG('polygon', { points: zc.map(p => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: COLORS.pass, 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.7 }));

    // Bubbles: upper zone (blue, at true position), lower zone (green, moved), hole centre (drag)
    r.pts.forEach((_, i) => {
        const c = holeXY(i), sel = i === state.sel;
        svg.appendChild(createSVG('circle', { cx: c.x, cy: c.y, r: BR, fill: 'rgba(255,255,255,0.93)', stroke: sel ? COLORS.zoneStroke : COLORS.cardBorder, 'stroke-width': sel ? 2.5 : 1.5 }));
        svg.appendChild(createSVG('circle', { cx: c.x, cy: c.y, r: r.a1 / 2 * M, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1.8, 'stroke-dasharray': '7 4' }));
        svg.appendChild(createSVG('line', { x1: c.x - 7, y1: c.y, x2: c.x + 7, y2: c.y, stroke: COLORS.zoneStroke, 'stroke-width': 1 }));
        svg.appendChild(createSVG('line', { x1: c.x, y1: c.y - 7, x2: c.x, y2: c.y + 7, stroke: COLORS.zoneStroke, 'stroke-width': 1 }));
        svg.appendChild(createSVG('circle', { cx: zc[i].x, cy: zc[i].y, r: Math.max(2, r.a2 / 2 * M), fill: 'rgba(22,163,74,0.14)', stroke: COLORS.pass, 'stroke-width': 2 }));
        const [dx, dy] = state.dev[i];
        const ok = r.upOK[i] && r.lowOK[i];
        svg.appendChild(createSVG('circle', { cx: c.x + dx * M, cy: c.y - dy * M, r: 7, fill: ok ? COLORS.ink : COLORS.fail, stroke: '#fff', 'stroke-width': 2, style: 'cursor: grab', 'data-hole': i }));
        const lx = i === 0 || i === 3 ? c.x - BR - 6 : c.x + BR + 6;
        svg.appendChild(halo(text(String(i + 1), lx, c.y + 5, { size: 15, weight: 800, fill: sel ? COLORS.zoneText : COLORS.muted, anchor: i === 0 || i === 3 ? 'end' : 'start' })));
    });

    // Key
    const ky = 510;
    svg.appendChild(createSVG('circle', { cx: 46, cy: ky - 5, r: 9, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1.8, 'stroke-dasharray': '4 3' }));
    svg.appendChild(text(`Upper row zone Ø${f(r.a1)}: fixed at true position from A, B, C`, 64, ky, { size: 13, fill: COLORS.text }));
    svg.appendChild(createSVG('circle', { cx: 46, cy: ky + 21, r: 7, fill: 'rgba(22,163,74,0.14)', stroke: COLORS.pass, 'stroke-width': 2 }));
    svg.appendChild(text(`Lower row zone Ø${f(r.a2)}: the pattern of zones may ${state.lowerRef === 'A' ? 'shift and turn' : 'shift (not turn)'} as a group`, 64, ky + 26, { size: 13, fill: COLORS.text }));
    svg.appendChild(createSVG('circle', { cx: 46, cy: ky + 47, r: 6, fill: COLORS.ink, stroke: '#fff', 'stroke-width': 2 }));
    svg.appendChild(text('Hole centre as made: drag it', 64, ky + 52, { size: 13, fill: COLORS.text }));
    const sh = r.fit.shift, th = r.fit.theta * 180 / Math.PI;
    svg.appendChild(text(`Lower-row pattern moved by X ${f(sh[0])}, Y ${f(sh[1])}${state.lowerRef === 'A' ? `, turned ${th.toFixed(3)}°` : ''} to fit best`, 30, ky + 82, { size: 12.5, italic: true, fill: COLORS.muted }));

    drawPanel(r);
    drawStrip(r);
}

function drawFrame(x, y) {
    const h = 30, dia = true, mod = state.mmcMod ? 'M' : null;
    const lower = state.lowerRef === 'A' ? ['A'] : ['A', 'B'];
    const r1 = featureControlFrame(x, y, { symbol: 'position', tolerance: state.t1.toFixed(decimals() - 1), diameter: dia, modifier: mod, datums: ['A', 'B', 'C'], h });
    const r2 = featureControlFrame(x, y + h, { symbol: 'position', tolerance: state.t2.toFixed(decimals() - 1), diameter: dia, modifier: mod, datums: lower, h });
    svgRef.appendChild(r1.g);
    svgRef.appendChild(r2.g);
    // One shared symbol cell over both rows (that is what makes it composite)
    svgRef.appendChild(createSVG('rect', { x: x + 1.5, y: y + 1.5, width: h - 3, height: 2 * h - 3, fill: COLORS.card }));
    svgRef.appendChild(text('⌖', x + h / 2, y + h + 8, { size: 26, fill: COLORS.ink, anchor: 'middle' }));
    svgRef.appendChild(text('4X', x - 8, y + h - 6, { size: 14, weight: 700, fill: COLORS.ink, anchor: 'end', mono: true }));
}

function drawPanel(r) {
    const x = 610, W = 360;
    svgRef.appendChild(text(`Ø${f(state.mmc)}–${f(state.lmc)}`, x + 30, 30, { size: 14, weight: 700, fill: COLORS.ink, mono: true }));
    drawFrame(x + 30, 40);
    svgRef.appendChild(text('Upper row: where the PATTERN is (to A, B, C).', x, 128, { size: 13, weight: 700, fill: COLORS.zoneText }));
    svgRef.appendChild(text('Lower row: holes to EACH OTHER (and square to A).', x, 148, { size: 13, weight: 700, fill: COLORS.pass }));

    // Table
    const cols = [x, x + 70, x + 200, x + 330];
    const hy = 190;
    [['HOLE', 'start'], ['TO DATUMS', 'end'], ['TO EACH OTHER', 'end']].forEach(([t, a], i) =>
        svgRef.appendChild(text(t, i ? cols[i + 1] - 4 : cols[0], hy, { size: 11.5, weight: 800, fill: COLORS.muted, anchor: a, letterSpacing: '0.04em' })));
    r.upper.forEach((u, i) => {
        const y = hy + 28 + i * 26;
        if (i === state.sel) svgRef.appendChild(createSVG('rect', { x: x - 6, y: y - 17, width: W, height: 24, rx: 4, fill: '#eff6ff' }));
        svgRef.appendChild(text(`Hole ${i + 1}`, cols[0], y, { size: 13.5, weight: 600, fill: COLORS.ink }));
        svgRef.appendChild(text(`Ø${f(u)}`, cols[2] - 4, y, { size: 13.5, weight: 700, mono: true, anchor: 'end', fill: r.upOK[i] ? COLORS.pass : COLORS.fail }));
        svgRef.appendChild(text(`Ø${f(r.lower[i])}`, cols[3] - 4, y, { size: 13.5, weight: 700, mono: true, anchor: 'end', fill: r.lowOK[i] ? COLORS.pass : COLORS.fail }));
    });
    const ay = hy + 28 + 4 * 26 + 4;
    svgRef.appendChild(createSVG('line', { x1: x - 6, y1: ay - 16, x2: x + W - 6, y2: ay - 16, stroke: COLORS.cardBorder }));
    svgRef.appendChild(text('Allowed', cols[0], ay, { size: 13, fill: COLORS.muted }));
    svgRef.appendChild(text(`Ø${f(r.a1)}`, cols[2] - 4, ay, { size: 13, weight: 700, mono: true, anchor: 'end', fill: COLORS.zoneText }));
    svgRef.appendChild(text(`Ø${f(r.a2)}`, cols[3] - 4, ay, { size: 13, weight: 700, mono: true, anchor: 'end', fill: COLORS.pass }));
    if (r.bonus > EPS) svgRef.appendChild(text(`(both include bonus ${f(r.bonus)} from the hole size)`, cols[0], ay + 20, { size: 12, italic: true, fill: COLORS.muted }));

    svgRef.appendChild(wrapText(state.lowerRef === 'A'
        ? 'Lower row references A only: its pattern of zones may slide in any direction and turn. It only keeps the holes accurate to each other and square to A.'
        : 'Lower row references A and B: its pattern may still slide, but must stay square to A and parallel to B (it cannot turn).',
        x, 400, 50, 18, { size: 13, fill: COLORS.text }));
    svgRef.appendChild(wrapText('Datums in the lower row never locate it; only the upper row ties the pattern to B and C.', x, 480, 50, 18, { size: 13, fill: COLORS.muted, italic: true }));
}

function drawStrip(r) {
    const iu = r.upper.indexOf(Math.max(...r.upper)), il = r.lower.indexOf(Math.max(...r.lower));
    // The odd one out: the hole furthest from the average of the other three
    // (the best fit spreads the error, so the lower-row numbers alone can tie)
    const odd = state.dev.map((d, i) => {
        const o = state.dev.filter((_, j) => j !== i);
        return Math.hypot(d[0] - o.reduce((a, v) => a + v[0], 0) / 3, d[1] - o.reduce((a, v) => a + v[1], 0) / 3);
    });
    const ilOdd = odd.indexOf(Math.max(...odd));
    const tie = r.lower.every(v => Math.abs(v - r.lower[0]) < 1e-6);
    const ratioU = r.upper[iu] / r.a1, ratioL = r.lower[il] / r.a2;
    const lowerWorse = ratioL >= ratioU;
    let s;
    if (!r.sizeOK) s = `The hole size Ø${f(state.actual)} is outside Ø${f(state.mmc)}–${f(state.lmc)}: the part fails on size.`;
    else if (r.pass) s = `Both rows pass. Every hole is inside its Ø${f(r.a1)} zone from A, B, C, and the holes are within Ø${f(r.a2)} of each other once the lower-row pattern is moved to fit.`;
    else if (!r.upperPass && r.lowerPass) s = `The holes are accurate to each other (lower row passes), but the pattern is too far from B and C: hole ${iu + 1} is Ø${f(r.upper[iu])} from true position, only Ø${f(r.a1)} allowed. Upper row fails.`;
    else if (r.upperPass && !r.lowerPass) s = `The pattern is close enough to B and C (upper row passes), but the holes are not accurate to each other (${tie ? `hole ${ilOdd + 1} is the odd one out` : `worst: hole ${il + 1}`}): Ø${f(r.lower[il])} against Ø${f(r.a2)}, even with the pattern moved to fit. Lower row fails.`;
    else s = `Both rows fail: the pattern is too far from B and C, and the holes are not accurate to each other.`;
    svgRef.appendChild(resultsStrip({
        pass: r.pass,
        measured: { label: lowerWorse ? `Hole ${(tie ? ilOdd : il) + 1} to others` : `Hole ${iu + 1} to datums`, value: lowerWorse ? r.lower[il] : r.upper[iu] },
        allowed: { label: lowerWorse ? 'Lower row' : 'Upper row', value: lowerWorse ? r.a2 : r.a1 },
        sentence: s, compact: s.length > 150
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600', segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const input = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold text-left';

function renderControls() {
    if (!controlsRoot) return;
    const num = (id, label, v, extra = '') => `<div><label class="block text-xs font-bold text-slate-500 mb-1">${label}</label><input id="${id}" type="number" step="${step()}" value="${+(+v).toFixed(5)}" ${extra} class="${input}"></div>`;
    const seg = (attr, v, label, on) => `<button data-${attr}="${v}" class="${segBtn} ${on ? segOn : segOff}">${label}</button>`;
    const [dx, dy] = state.dev[state.sel];
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-3">
            <h4 class="font-bold text-xs text-slate-500 uppercase">Composite frame (4X holes)</h4>
            <div class="grid grid-cols-2 gap-2">${num('cp-t1', 'UPPER ROW Ø (to A B C)', state.t1, 'min="0"')}${num('cp-t2', 'LOWER ROW Ø', state.t2, 'min="0"')}</div>
            <div><div class="text-xs font-bold text-slate-500 mb-1">LOWER ROW DATUMS</div>
                <div class="flex gap-2">${seg('ref', 'A', 'A only', state.lowerRef === 'A')}${seg('ref', 'AB', 'A and B', state.lowerRef === 'AB')}</div></div>
            <label class="flex items-center gap-2 text-sm font-bold text-slate-700"><input id="cp-mod" type="checkbox" ${state.mmcMod ? 'checked' : ''}> Ⓜ on both rows (bonus)</label>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-2">
            <h4 class="font-bold text-xs text-slate-500 uppercase">Holes as made (${unitName()})</h4>
            <div class="grid grid-cols-3 gap-2">${num('cp-mmc', 'MIN Ø (MMC)', state.mmc)}${num('cp-lmc', 'MAX Ø (LMC)', state.lmc)}${num('cp-act', 'ACTUAL Ø', state.actual)}</div>
            <div class="flex gap-1.5 pt-1">${[0, 1, 2, 3].map(i => seg('sel', i, `Hole ${i + 1}`, state.sel === i)).join('')}</div>
            <div class="grid grid-cols-2 gap-2">${num('cp-dx', 'X OFFSET', dx)}${num('cp-dy', 'Y OFFSET', dy)}</div>
            <p class="text-xs text-slate-500">Offsets from true position. Or drag the dots on the drawing.</p>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Try these</h4>
            <div class="flex flex-col gap-1.5">
                <button data-p="shift" class="${smallBtn}">Whole pattern shifted: both rows pass</button>
                <button data-p="turn" class="${smallBtn}">Pattern turned: passes with A only, fails with A and B</button>
                <button data-p="one" class="${smallBtn}">One hole off from the others: lower row fails</button>
                <button data-p="far" class="${smallBtn}">Pattern too far from B and C: upper row fails</button>
                <button data-p="zero" class="${smallBtn}">All holes perfect</button>
            </div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Composite or two frames?</div>
            <div class="text-xs leading-relaxed">Composite: ONE ⌖ symbol shared by both rows. The lower row's datums only orient. Two separate frames (each with its own ⌖) are two independent requirements, and the lower frame's datums also locate. Check the symbol box.</div>
        </div>`;

    const q = s => controlsRoot.querySelector(s);
    const bind = (id, fn) => q(id).oninput = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { fn(v); render(); } };
    bind('#cp-t1', v => { if (v >= 0) state.t1 = v; });
    bind('#cp-t2', v => { if (v >= 0) state.t2 = v; });
    bind('#cp-mmc', v => { if (v > 0) state.mmc = v; });
    bind('#cp-lmc', v => { if (v > 0) state.lmc = v; });
    bind('#cp-act', v => { if (v > 0) state.actual = v; });
    bind('#cp-dx', v => { state.dev[state.sel] = [v, state.dev[state.sel][1]]; });
    bind('#cp-dy', v => { state.dev[state.sel] = [state.dev[state.sel][0], v]; });
    q('#cp-mod').onchange = e => { state.mmcMod = e.target.checked; render(); };
    controlsRoot.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => { state.lowerRef = b.dataset.ref; update(); });
    controlsRoot.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { state.sel = +b.dataset.sel; update(); });
    controlsRoot.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
        presetDev(b.dataset.p);
        if (b.dataset.p === 'turn') state.lowerRef = 'A';
        update();
    });
}

/** Hole offsets for the presets, scaled to the current tolerances. */
function presetDev(p) {
    const a1 = state.t1 / 2, a2 = state.t2 / 2, round = v => +v.toFixed(decimals() + 1);
    const pts = patternPoints(GEO[units]);
    const reach = Math.hypot(...pts[0]);
    let dev = [[0, 0], [0, 0], [0, 0], [0, 0]];
    if (p === 'shift') dev = [[0.55, 0.3], [0.62, 0.22], [0.5, 0.35], [0.58, 0.28]].map(([x, y]) => [x * a1, y * a1]);
    if (p === 'turn') {
        const t = 0.8 * a1 / reach;   // turn so the corner holes move about 0.8 × the upper radius
        dev = pts.map(([px, py]) => [-py * t, px * t]);
    }
    if (p === 'one') dev = [[0.1 * a1, 0.1 * a1], [0.1 * a1, 0.1 * a1], [0.1 * a1 + 2.4 * a2, 0.1 * a1 - 1.0 * a2], [0.1 * a1, 0.1 * a1]];
    if (p === 'far') dev = [[1.05 * a1, 0.45 * a1], [1.1 * a1, 0.4 * a1], [1.05 * a1, 0.5 * a1], [1.1 * a1, 0.45 * a1]];
    state.dev = dev.map(d => d.map(round));
    state.actual = state.mmc;
}

function update() {
    render();
    renderControls();
}

// What a shared link carries (see js/share.js). The link sets the units first,
// so mark them as followed: the shared numbers must not be replaced by the example.
const base = shareable(state, ['lowerRef', 'mmcMod', 'sel', 't1', 't2', 'mmc', 'lmc', 'actual', 'dev']);
export const share = { get: base.get, set(o) { units = getUnits(); base.set(o); } };
