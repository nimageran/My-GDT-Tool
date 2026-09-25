// js/modules/inspection/functional_gauge.js
// Functional Gauge Designer: a 4-hole pattern with position at MMC. Pins are
// sized at virtual condition (MMC − tolerance) and placed at true position;
// datums are simulated by a plate (A) and stops (B, C) or a datum pin at MMB.
// Then "try a part": does it drop onto the gauge? With a datum feature of size
// at MMB the part may shift and turn as a whole (datum shift).

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText, featureControlFrame, resultsStrip } from '../../theme.js';
import { UI } from '../drawing/sheet.js';

// Basic geometry per unit: plate W × H, holes at xs × ys from the lower-left corner.
const GEOM = {
    mm: { W: 120, H: 80, xs: [20, 100], ys: [15, 65], bore: 20 },
    in: { W: 4.75, H: 3.25, xs: [0.75, 4.00], ys: [0.60, 2.65], bore: 0.75 }
};
const DEFAULTS = {
    mm: { mmc: 8.2, lmc: 8.4, tol: 0.2, bMmc: 20.0, bLmc: 20.1, bAct: 20.0, h: 8.3 },
    in: { mmc: 0.328, lmc: 0.338, tol: 0.010, bMmc: 0.750, bLmc: 0.755, bAct: 0.750, h: 0.333 }
};

const fresh = u => ({
    units: u, scheme: 'faces', mmcMod: true, gaugePct: 10, sel: 0,
    ...DEFAULTS[u],
    holes: [0, 1, 2, 3].map(() => ({ h: DEFAULTS[u].h, dx: 0, dy: 0 }))
});
const state = fresh('mm');
let svgRef = null, controlsRoot = null;

export function draw(svg) {
    svgRef = svg;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

/** Hole pattern positions (basic), relative to the lower-left corner. */
export function holeCentres(g) {
    return [[g.xs[0], g.ys[0]], [g.xs[1], g.ys[0]], [g.xs[1], g.ys[1]], [g.xs[0], g.ys[1]]];
}

/**
 * The gauge for a hole pattern: pins at virtual condition, made with the
 * gauge tolerance on the part's side (absolute tolerancing: a gauge may
 * reject a borderline good part but never accepts a bad one).
 */
export function gaugeSpec({ mmc, tol, bMmc, bLmc, gaugePct }) {
    const vc = mmc - tol;
    const gt = tol * gaugePct / 100;
    const gtB = Math.max(bLmc - bMmc, 0) * gaugePct / 100;
    return { vc, pinMin: vc, pinMax: vc + gt, pinPos: gt, mmb: bMmc, datumMin: bMmc, datumMax: bMmc + gtB };
}

/**
 * Does the part drop onto an ideal gauge (pins exactly at VC and MMB)?
 * holes: [{ h, dx, dy }] with deviations from true position.
 * shift: datum B at MMB, so the part may move by (bAct − MMB)/2 and turn
 * about the bore. Returns { fits, margin, s: [sx, sy], theta, residual: [[x,y]] }.
 */
export function fitOnGauge(holes, centres, vc, { shift = false, rB = 0, pivot = [0, 0] } = {}) {
    const r = holes.map(h => (h.h - vc) / 2);
    const P = centres.map(([x, y]) => [x - pivot[0], y - pivot[1]]);
    const resid = (sx, sy, t) => holes.map((h, i) => {
        const [px, py] = P[i];
        const ax = px + h.dx, ay = py + h.dy;
        const c = Math.cos(t), s = Math.sin(t);
        return [c * ax - s * ay + sx - px, s * ax + c * ay + sy - py];
    });
    const cost = (sx, sy, t) => Math.max(...resid(sx, sy, t).map(([x, y], i) => Math.hypot(x, y) - r[i]));

    if (!shift) {
        const c = cost(0, 0, 0);
        return { fits: c <= 1e-9, margin: -c, s: [0, 0], theta: 0, residual: resid(0, 0, 0) };
    }
    // shift and turn: coarse grid, then shrink around the best point
    const reach = Math.max(...P.map(([x, y]) => Math.hypot(x, y)));
    const dMax = Math.max(...holes.map(h => Math.hypot(h.dx, h.dy)), ...r.map(Math.abs), rB, 1e-9);
    let span = [rB, rB, 2 * dMax / reach], best = [0, 0, 0], bestC = cost(0, 0, 0);
    for (let pass = 0; pass < 7; pass++) {
        const [c0x, c0y, c0t] = best;
        for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (let k = -6; k <= 6; k++) {
            const sx = c0x + span[0] * i / 6, sy = c0y + span[1] * j / 6, t = c0t + span[2] * k / 6;
            if (Math.hypot(sx, sy) > rB + 1e-12) continue;
            const c = cost(sx, sy, t);
            if (c < bestC) { bestC = c; best = [sx, sy, t]; }
        }
        span = span.map(v => v / 3);
    }
    return { fits: bestC <= 1e-9, margin: -bestC, s: [best[0], best[1]], theta: best[2], residual: resid(...best) };
}

/** Full evaluation of the current part against the gauge. */
export function evaluate(s) {
    const g = GEOM[s.units];
    const spec = gaugeSpec(s);
    const centres = holeCentres(g);
    const shift = s.scheme === 'bore';
    const rB = shift ? Math.max(0, (s.bAct - spec.mmb) / 2) : 0;
    const fit = fitOnGauge(s.holes, centres, spec.vc, { shift, rB, pivot: [g.W / 2, g.H / 2] });
    const perHole = s.holes.map(h => {
        const pos = 2 * Math.hypot(h.dx, h.dy);
        const bonus = s.mmcMod ? Math.max(0, h.h - s.mmc) : 0;
        return { pos, allowed: s.tol + bonus, bonus, sizeOK: h.h >= s.mmc - 1e-12 && h.h <= s.lmc + 1e-12 };
    });
    const bOK = !shift || (s.bAct >= s.bMmc - 1e-12 && s.bAct <= s.bLmc + 1e-12);
    const worst = perHole.reduce((w, h, i) => (h.pos - h.allowed > perHole[w].pos - perHole[w].allowed ? i : w), 0);
    const posOK = perHole.every(h => h.pos <= h.allowed + 1e-12);
    return { spec, centres, fit, perHole, worst, rB, posOK, sizeOK: perHole.every(h => h.sizeOK) && bOK, valid: spec.vc > 0 };
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const X0 = 100, Y0 = 130, PW = 440;          // plate on screen: left, top, width
const dec = () => (state.units === 'in' ? 4 : 3);
const f = v => v.toFixed(dec()) + (state.units === 'in' ? '"' : '');
const fb = v => String(+v.toFixed(3));        // basic dimensions

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const g = GEOM[state.units];
    const K = PW / g.W;
    const PH = g.H * K;
    const sx = x => X0 + x * K, sy = y => Y0 + PH - y * K;
    const r = evaluate(state);
    const gaugeable = state.mmcMod && r.valid;

    svg.appendChild(text('THE GAUGE, TOP VIEW (PART SHOWN DASHED)', 30, 40, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));

    // gauge base plate = datum A
    svg.appendChild(createSVG('rect', { x: X0 - 26, y: Y0 - 26, width: PW + 52, height: PH + 52, rx: 6, fill: '#f1f5f9', stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
    svg.appendChild(text('Base plate = datum A (part sits flat on it)', X0 - 26, Y0 - 34, { size: 12.5, fill: COLORS.muted }));
    // part outline
    svg.appendChild(createSVG('rect', { x: X0, y: Y0, width: PW, height: PH, fill: 'rgba(255,255,255,0.7)', stroke: COLORS.actual, 'stroke-width': 1.5, 'stroke-dasharray': '8 5' }));

    // datum simulators
    const stop = (cx, cy, label, lx, ly, anchor) => {
        svg.appendChild(createSVG('circle', { cx, cy, r: 9, fill: COLORS.ink }));
        if (label) svg.appendChild(text(label, lx, ly, { size: 12.5, weight: 700, fill: COLORS.ink, anchor }));
    };
    if (state.scheme === 'faces') {
        stop(sx(g.W * 0.2), Y0 + PH + 9, '', 0, 0);
        stop(sx(g.W * 0.8), Y0 + PH + 9, 'Stops = datum B', sx(g.W * 0.8), Y0 + PH + 46, 'middle');
        stop(X0 - 9, sy(g.H / 2), 'Stop =', X0 - 32, sy(g.H / 2) - 4, 'end');
        svg.appendChild(text('datum C', X0 - 32, sy(g.H / 2) + 14, { size: 12.5, weight: 700, fill: COLORS.ink, anchor: 'end' }));
    } else {
        const R = g.bore / 2 * K;
        svg.appendChild(createSVG('circle', { cx: sx(g.W / 2), cy: sy(g.H / 2), r: R, fill: COLORS.ink }));
        svg.appendChild(text('B', sx(g.W / 2), sy(g.H / 2) + 6, { size: 16, weight: 800, fill: '#fff', anchor: 'middle' }));
        svg.appendChild(text('Datum pin B', sx(g.W / 2) + R + 10, sy(g.H / 2) - 4, { size: 12.5, weight: 700, fill: COLORS.ink }));
        svg.appendChild(text(`Ø${f(r.spec.mmb)} (MMB)`, sx(g.W / 2) + R + 10, sy(g.H / 2) + 14, { size: 12.5, weight: 700, fill: COLORS.ink }));
    }

    // basic dimensions
    const box = (label, x, y) => {
        const w = label.length * 8.4 + 12;
        svg.appendChild(createSVG('rect', { x: x - w / 2, y: y - 14, width: w, height: 20, fill: '#fff', stroke: COLORS.ink, 'stroke-width': 1.2 }));
        svg.appendChild(text(label, x, y + 1, { size: 13, weight: 600, fill: COLORS.ink, anchor: 'middle', mono: true }));
    };
    const [ha, hb] = [sx(g.xs[0]), sx(g.xs[1])];
    const [va, vb] = [sy(g.ys[0]), sy(g.ys[1])];
    const dimLine = (x1, y1, x2, y2) => svg.appendChild(createSVG('line', { x1, y1, x2, y2, stroke: COLORS.muted, 'stroke-width': 1.2, 'marker-start': 'url(#thm-arrow-muted)', 'marker-end': 'url(#thm-arrow-muted)' }));
    dimLine(ha, Y0 - 60, hb, Y0 - 60); box(fb(g.xs[1] - g.xs[0]), (ha + hb) / 2, Y0 - 58);
    dimLine(X0 + PW + 60, vb, X0 + PW + 60, va); box(fb(g.ys[1] - g.ys[0]), X0 + PW + 60, (va + vb) / 2 + 4);
    if (state.scheme === 'faces') {
        dimLine(X0, Y0 + PH + 58, ha, Y0 + PH + 58); box(fb(g.xs[0]), (X0 + ha) / 2, Y0 + PH + 60);
        dimLine(X0 + PW + 60, Y0 + PH, X0 + PW + 60, va); box(fb(g.ys[0]), X0 + PW + 60, (Y0 + PH + va) / 2 + 4);
        svg.appendChild(text('from B and C', X0, Y0 + PH + 90, { size: 12, italic: true, fill: COLORS.muted }));
    } else {
        svg.appendChild(text('Pattern centred on datum B (the bore)', X0, Y0 + PH + 64, { size: 12.5, italic: true, fill: COLORS.muted }));
    }

    // pins at true position + magnified bubble per hole
    const fit = r.fit;
    const clear = Math.max((state.lmc - r.spec.vc) / 2, 1e-9);
    const M = 20 / clear;                                   // bubble: px per unit of clearance
    r.centres.forEach(([cx, cy], i) => {
        const px = sx(cx), py = sy(cy);
        const hole = state.holes[i];
        svg.appendChild(createSVG('circle', { cx: px, cy: py, r: r.spec.vc / 2 * K, fill: gaugeable ? COLORS.ink : COLORS.nominal }));
        const left = cx < g.W / 2, low = cy < g.H / 2;
        svg.appendChild(text(`${i + 1}`, px + (left ? -26 : 26), py + (low ? 26 : -18), { size: 14, weight: 800, fill: i === state.sel ? COLORS.zoneText : COLORS.muted, anchor: 'middle' }));

        if (!gaugeable) return;
        // bubble: pin (fixed) and hole (after any shift), magnified
        const bx = px + (left ? 66 : -66), by = py, BR = 36;
        const ok = Math.hypot(...fit.residual[i]) <= (hole.h - r.spec.vc) / 2 + 1e-9;
        svg.appendChild(createSVG('line', { x1: px + (left ? 12 : -12), y1: py, x2: bx + (left ? -BR : BR), y2: by, stroke: COLORS.faint, 'stroke-width': 1 }));
        svg.appendChild(createSVG('circle', { cx: bx, cy: by, r: BR, fill: '#fff', stroke: i === state.sel ? COLORS.zoneStroke : COLORS.cardBorder, 'stroke-width': i === state.sel ? 2.5 : 1.5 }));
        const pinR = 11;
        const hr = pinR + Math.max(0, (hole.h - r.spec.vc) / 2) * M;
        const [ox, oy] = fit.residual[i].map(v => v * M);
        const hx = bx + Math.max(-BR + 4, Math.min(BR - 4, ox)), hy = by - Math.max(-BR + 4, Math.min(BR - 4, oy));
        svg.appendChild(createSVG('circle', { cx: bx, cy: by, r: pinR, fill: gaugeable ? COLORS.ink : COLORS.nominal }));
        svg.appendChild(createSVG('circle', { cx: hx, cy: hy, r: Math.min(hr, BR - 2), fill: 'none', stroke: ok ? COLORS.pass : COLORS.fail, 'stroke-width': 2.5 }));
    });
    if (gaugeable) {
        const ky = Y0 + PH + 112;
        svg.appendChild(createSVG('circle', { cx: X0 + 6, cy: ky - 4, r: 7, fill: COLORS.ink }));
        svg.appendChild(text('gauge pin', X0 + 20, ky, { size: 12.5, fill: COLORS.text }));
        svg.appendChild(createSVG('circle', { cx: X0 + 104, cy: ky - 4, r: 8, fill: 'none', stroke: COLORS.pass, 'stroke-width': 2.5 }));
        svg.appendChild(text('hole clears', X0 + 118, ky, { size: 12.5, fill: COLORS.text }));
        svg.appendChild(createSVG('circle', { cx: X0 + 212, cy: ky - 4, r: 8, fill: 'none', stroke: COLORS.fail, 'stroke-width': 2.5 }));
        svg.appendChild(text('hole hits the pin', X0 + 226, ky, { size: 12.5, fill: COLORS.text }));
        svg.appendChild(text('Round callouts: each hole on its pin, gap magnified', X0, ky + 22, { size: 12.5, italic: true, fill: COLORS.muted }));
    }

    drawPanel(svg, r, gaugeable);
    drawStrip(svg, r, gaugeable);
}

function drawPanel(svg, r, gaugeable) {
    const x = 690;
    svg.appendChild(text('PART CALLOUT', x, 40, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    svg.appendChild(text(`4X Ø${f(state.mmc)} – ${f(state.lmc)}`, x, 72, { size: 15, weight: 700, fill: COLORS.ink, mono: true }));
    const datums = state.scheme === 'faces' ? ['A', 'B', 'C'] : ['A', { letter: 'B', mod: 'M' }];
    svg.appendChild(featureControlFrame(x, 84, { symbol: 'position', tolerance: state.tol.toFixed(dec()), diameter: true, modifier: state.mmcMod ? 'M' : null, datums, h: 30 }).g);

    svg.appendChild(text('GAUGE SPEC', x, 160, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    if (!r.valid) {
        svg.appendChild(wrapText('The position tolerance is larger than the hole at MMC: no pin can be made. Check the inputs.', x, 188, 38, 19, { size: 13.5, fill: COLORS.fail }));
        return;
    }
    if (!state.mmcMod) {
        svg.appendChild(wrapText('No Ⓜ in the frame (RFS): the zone does not grow with hole size, so a fixed pin cannot check it. Use a CMM, or ask for Ⓜ if the holes are for clearance.', x, 188, 38, 19, { size: 13.5, fill: COLORS.fail }));
        return;
    }
    const s = r.spec;
    const rows = [
        ['Pin size = virtual condition', `Ø${f(s.vc)}`, `MMC ${f(state.mmc)} − tol ${f(state.tol)}`],
        ['Make pins', `Ø${f(s.pinMin)}–${f(s.pinMax)}`, `gauge tol ${state.gaugePct}% of part tol, on the plus side`],
        ['Pin locations', 'basic', `within Ø${f(s.pinPos)} of true position`],
        state.scheme === 'faces'
            ? ['Datum B, C', 'fixed stops', 'planar datums: no shift']
            : ['Datum pin B', `Ø${f(s.datumMin)}–${f(s.datumMax)}`, 'at MMB: the part may shift on it']
    ];
    let y = 190;
    for (const [label, value, note] of rows) {
        svg.appendChild(text(label, x, y, { size: 13.5, fill: COLORS.muted }));
        svg.appendChild(text(value, 985, y, { size: 14, weight: 700, fill: COLORS.ink, anchor: 'end', mono: true }));
        svg.appendChild(text(note, x, y + 19, { size: 12, italic: true, fill: COLORS.muted }));
        y += 52;
    }
    svg.appendChild(text('The gauge does NOT check', x, y + 8, { size: 13.5, weight: 700, fill: COLORS.ink }));
    svg.appendChild(wrapText(`Hole size. Check each hole with a plug gauge too (GO Ø${f(state.mmc)}, NO-GO Ø${f(state.lmc)}); a hole that is too big still drops on the pin.`, x, y + 30, 38, 18, { size: 13, fill: COLORS.text }));
    if (state.scheme === 'bore') svg.appendChild(wrapText('Nothing clocks the pattern, so the part may turn on pin B: the holes themselves set the rotation.', x, y + 104, 38, 18, { size: 13, fill: COLORS.text }));
}

function drawStrip(svg, r, gaugeable) {
    const w = r.perHole[r.worst];
    const shifted = Math.hypot(...r.fit.s) > 1e-9 || Math.abs(r.fit.theta) > 1e-9;
    let pass, sentence;
    if (!r.valid) {
        pass = false; sentence = 'No gauge possible with these numbers.';
    } else if (!gaugeable) {
        pass = r.posOK;
        sentence = `No gauge for RFS. Checked hole by hole like a CMM (no datum shift): the worst hole ${w.pos <= w.allowed + 1e-12 ? 'is inside' : 'is outside'} its Ø${f(w.allowed)} zone.`;
    } else {
        pass = r.fit.fits;
        if (pass && !r.posOK) sentence = `The part drops on: hole ${r.worst + 1} is outside its own zone, but the part can move ${f(r.rB)} on the datum pin (datum shift), and that is allowed.`;
        else if (pass) sentence = `The part drops onto the gauge: every hole clears its pin${shifted && state.scheme === 'bore' ? ' (using some datum shift)' : ''}. Now check the hole sizes with a plug gauge.`;
        else sentence = `The part does not go on: hole ${r.worst + 1} hits its pin. It is off by Ø${f(w.pos)} but only Ø${f(w.allowed)} is allowed (tol + bonus${state.scheme === 'bore' ? ' + datum shift' : ''}).`;
        if (pass && !r.sizeOK) sentence += ' A size is out of limits, so the part still fails.';
    }
    svg.appendChild(resultsStrip({
        pass: pass && (gaugeable ? r.sizeOK : true),
        measured: { label: `Hole ${r.worst + 1} position`, value: w.pos, text: `Ø${f(w.pos)}` },
        allowed: { label: 'Tol + bonus', value: w.allowed, text: `Ø${f(w.allowed)}` },
        sentence, compact: sentence.length > 150
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

function renderControls() {
    if (!controlsRoot) return;
    const seg = (key, v, label) => `<button data-${key}="${v}" class="${UI.segBtn} ${state[key] === v ? UI.segOn : UI.segOff}">${label}</button>`;
    const step = state.units === 'in' ? 0.001 : 0.01;
    const inp = (id, label, v, extra = '') => `<div><label class="block text-xs font-bold text-slate-500 mb-1">${label}</label><input id="${id}" type="number" step="${step}" value="${+(+v).toFixed(4)}" ${extra} class="${UI.input}"></div>`;
    const h = state.holes[state.sel];
    controlsRoot.innerHTML = `
        <div class="${UI.card} space-y-3">
            <div class="flex gap-2">${seg('units', 'mm', 'mm')}${seg('units', 'in', 'inch')}</div>
            <div><h4 class="${UI.h4}">Datums</h4>
            <div class="flex gap-2">${seg('scheme', 'faces', 'A | B | C faces')}${seg('scheme', 'bore', 'A | B Ⓜ bore')}</div></div>
        </div>
        <div class="${UI.card} space-y-2">
            <h4 class="${UI.h4}">Part callout (4 holes)</h4>
            <div class="grid grid-cols-2 gap-2">
                ${inp('fg-mmc', 'HOLE MIN Ø (MMC)', state.mmc)}${inp('fg-lmc', 'HOLE MAX Ø (LMC)', state.lmc)}
                ${inp('fg-tol', 'POSITION TOL Ø', state.tol, 'min="0"')}
                <label class="flex items-end gap-2 pb-2 text-sm font-bold text-slate-700"><input id="fg-mod" type="checkbox" ${state.mmcMod ? 'checked' : ''}> Ⓜ in frame</label>
            </div>
            ${state.scheme === 'bore' ? `<div class="grid grid-cols-2 gap-2">${inp('fg-bmmc', 'BORE B MIN Ø', state.bMmc)}${inp('fg-blmc', 'BORE B MAX Ø', state.bLmc)}</div>` : ''}
            <div><label class="block text-xs font-bold text-slate-500 mb-1">GAUGE-MAKER TOLERANCE: ${state.gaugePct}% OF PART TOL</label>
            <input id="fg-pct" type="range" min="5" max="20" step="1" value="${state.gaugePct}" class="w-full"></div>
        </div>
        <div class="${UI.card} space-y-2">
            <h4 class="${UI.h4}">Try a part</h4>
            <div class="flex gap-1.5">${state.holes.map((_, i) => `<button data-sel="${i}" class="${UI.segBtn} ${state.sel === i ? UI.segOn : UI.segOff}">Hole ${i + 1}</button>`).join('')}</div>
            <div class="grid grid-cols-3 gap-2">${inp('fg-h', 'SIZE Ø', h.h)}${inp('fg-dx', 'X OFF', h.dx)}${inp('fg-dy', 'Y OFF', h.dy)}</div>
            ${state.scheme === 'bore' ? `<div class="grid grid-cols-2 gap-2">${inp('fg-bact', 'BORE B ACTUAL Ø', state.bAct)}</div>` : ''}
            <div class="flex flex-col gap-1.5 pt-1">
                <button data-p="perfect" class="${UI.smallBtn} text-left">Perfect part, holes at MMC</button>
                <button data-p="bonus" class="${UI.smallBtn} text-left">Hole off, but bonus saves it</button>
                <button data-p="bad" class="${UI.smallBtn} text-left">Hole too far off: rejected</button>
                ${state.scheme === 'bore' ? `<button data-p="shift" class="${UI.smallBtn} text-left">Whole pattern off, datum shift saves it</button>` : ''}
            </div>
        </div>
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> How a functional gauge works</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>Pins are the worst mating part: virtual condition, at true position.</li>
                <li>If the part drops on, it will assemble. No numbers, just go / no-go.</li>
                <li>Only for Ⓜ (or MMB). Sizes are checked separately.</li>
            </ul>
        </div>`;

    const on = (sel, ev, fn) => { const el = controlsRoot.querySelector(sel); if (el) el[ev] = fn; };
    const num = (sel, fn) => on(sel, 'oninput', e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { fn(v); render(); } });
    controlsRoot.querySelectorAll('[data-units]').forEach(b => b.onclick = () => {
        if (state.units === b.dataset.units) return;
        Object.assign(state, fresh(b.dataset.units), { scheme: state.scheme, mmcMod: state.mmcMod, gaugePct: state.gaugePct });
        render(); renderControls();
    });
    controlsRoot.querySelectorAll('[data-scheme]').forEach(b => b.onclick = () => { state.scheme = b.dataset.scheme; render(); renderControls(); });
    controlsRoot.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { state.sel = +b.dataset.sel; render(); renderControls(); });
    num('#fg-mmc', v => { if (v > 0) state.mmc = v; });
    num('#fg-lmc', v => { if (v > 0) state.lmc = v; });
    num('#fg-tol', v => { if (v >= 0) state.tol = v; });
    num('#fg-bmmc', v => { if (v > 0) state.bMmc = v; });
    num('#fg-blmc', v => { if (v > 0) state.bLmc = v; });
    num('#fg-bact', v => { if (v > 0) state.bAct = v; });
    num('#fg-h', v => { if (v > 0) state.holes[state.sel].h = v; });
    num('#fg-dx', v => { state.holes[state.sel].dx = v; });
    num('#fg-dy', v => { state.holes[state.sel].dy = v; });
    on('#fg-mod', 'onchange', e => { state.mmcMod = e.target.checked; render(); });
    on('#fg-pct', 'oninput', e => { state.gaugePct = +e.target.value; render(); renderControls(); });
    controlsRoot.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { preset(b.dataset.p); render(); renderControls(); });
}

function preset(p) {
    const { mmc, lmc, tol } = state;
    const d = state.units === 'in' ? 4 : 3;
    const round = v => +v.toFixed(d);
    state.holes = state.holes.map(() => ({ h: mmc, dx: 0, dy: 0 }));
    state.bAct = state.bMmc;
    state.sel = 0;
    if (p === 'bonus') {
        // hole at LMC, off by more than the plain tolerance but within tol + bonus
        state.holes[0] = { h: lmc, dx: round((tol + (lmc - mmc)) * 0.4), dy: round((tol + (lmc - mmc)) * 0.2) };
    }
    if (p === 'bad') state.holes[0] = { h: lmc, dx: round((tol + (lmc - mmc)) * 0.6), dy: round((tol + (lmc - mmc)) * 0.3) };
    if (p === 'shift') {
        // every hole off the same way by more than the tolerance; bore at LMC lets the part slide back
        const off = round(tol * 0.5 + (state.bLmc - state.bMmc) * 0.4);
        state.holes = state.holes.map(() => ({ h: mmc, dx: off, dy: 0 }));
        state.bAct = state.bLmc;
    }
}
