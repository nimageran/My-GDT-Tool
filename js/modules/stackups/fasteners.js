// js/modules/stackups/fasteners.js
// Fastener formulas (ASME Y14.5 floating and fixed fastener cases):
//   floating: T = H − F         (both parts have clearance holes)
//   fixed:    T1 + T2 = H − F   (one part holds the fastener: thread or press fit)
// H = MMC (smallest) clearance hole, F = MMC (largest) fastener.

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, text, wrapText, addDefs, dimension, nominalLine, featureControlFrame, legend, resultsStrip } from '../../theme.js';
import { syncUnits, fromMm } from '../../units.js';

const UNITS = { native: 'mm', lengths: ['F', 'H', 'holeTol', 'T', 'T1', 'T2', 'projected'],
    nice: { in: { screw: 'custom', F: 0.3125, H: 0.344, holeTol: 0.008, T: 0.031, T1: 0.015, T2: 0.015, projected: 0.375 } } };

// ISO 273 clearance holes (mm): fine / medium / coarse
const ISO273 = {
    M3: [3.2, 3.4, 3.6], M4: [4.3, 4.5, 4.8], M5: [5.3, 5.5, 5.8], M6: [6.4, 6.6, 7.0],
    M8: [8.4, 9.0, 10.0], M10: [10.5, 11.0, 12.0], M12: [13.0, 13.5, 14.5], M16: [17.0, 17.5, 18.5],
    M20: [21.0, 22.0, 24.0], M24: [25.0, 26.0, 28.0]
};
const CLASS_NAMES = ['fine', 'medium', 'coarse'];

// --- STATE ---
const state = {
    mode: 'floating',        // 'floating' | 'fixed'
    screw: 'M8',             // preset or 'custom'
    fit: 1,                  // ISO 273 class index
    F: 8.0,                  // Max fastener diameter (MMC)
    H: 9.0,                  // Min clearance hole diameter (MMC)
    holeTol: 0.2,            // Size tolerance on the clearance hole (+)
    T: 1.0,                  // Floating: position tolerance on both parts
    T1: 0.5,                 // Fixed: threaded / press-fit part
    T2: 0.5,                 // Fixed: clearance part
    projected: 10            // Fixed: projected zone height (≥ clearance part thickness)
};

// --- LAYOUT (px) ---
const X0 = 270;              // True position (common centerline) in the section
const TOP = { y: 290, h: 95 };
const BOT = { y: 385, h: 95 };
const PLATE_X = [40, 500];
const HOLE_PX = 190;         // Clearance hole drawn this wide (diameters to scale)
const PANEL_X = 590;

// --- DOM ---
let svgContainer = null;
let controlsContainer = null;

export function draw(svg) {
    syncUnits(state, UNITS);
    svgContainer = svg;
    renderScene();
}

export function loadControls(container) {
    syncUnits(state, UNITS);
    controlsContainer = container;
    renderControls();
}

// --- EVALUATION ---

const fmt = v => v.toFixed(state.units === 'mm' ? 3 : 4);
const u = () => (state.units === 'mm' ? ' mm' : '"');

function evaluate() {
    const clearance = state.H - state.F;                   // Total position tolerance available
    const used = state.mode === 'floating' ? state.T : state.T1 + state.T2;
    const fits = clearance > 0 && used <= clearance + EPS;
    return { clearance, used, fits, spare: clearance - used };
}

// --- RENDERING ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    addDefs(svgContainer);
    addSectionHatch();
    const r = evaluate();

    svgContainer.appendChild(legend(24, 24, [
        { kind: 'zone', label: 'Position zone of each hole' },
        { kind: 'nominal', label: 'True position (shared centerline)' },
        { kind: 'actual', label: 'Fastener at its largest (F)' },
        { kind: 'fail', label: 'Interference: will not assemble' }
    ], { note: 'Worst case: holes at MMC, shifted opposite ways' }));

    drawSection();
    drawPanel(r);
    drawResults(r);
}

function addSectionHatch() {
    const defs = svgContainer.querySelector('defs');
    const pat = createSVG('pattern', { id: 'fx-hatch', patternUnits: 'userSpaceOnUse', width: 9, height: 9, patternTransform: 'rotate(45)' });
    pat.appendChild(createSVG('rect', { x: 0, y: 0, width: 9, height: 9, fill: COLORS.partFill }));
    pat.appendChild(createSVG('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: COLORS.nominal, 'stroke-width': 1.2 }));
    defs.appendChild(pat);
}

// A plate in section with a hole of width w centered at cx (px)
function plate(g, y, h, cx, w, { threaded = false } = {}) {
    const [x1, x2] = PLATE_X;
    const style = { fill: 'url(#fx-hatch)', stroke: COLORS.partStroke, 'stroke-width': 1.5 };
    g.appendChild(createSVG('rect', { x: x1, y, width: cx - w / 2 - x1, height: h, ...style }));
    g.appendChild(createSVG('rect', { x: cx + w / 2, y, width: x2 - cx - w / 2, height: h, ...style }));
    if (threaded) {
        // Thread flanks along both walls
        for (let ty = y + 6; ty < y + h - 4; ty += 9) {
            for (const side of [-1, 1]) {
                const wx = cx + side * w / 2;
                g.appendChild(createSVG('path', {
                    d: `M ${wx},${ty} L ${wx - side * 5},${ty + 4.5} L ${wx},${ty + 9}`,
                    fill: 'none', stroke: COLORS.partStroke, 'stroke-width': 1
                }));
            }
        }
    }
}

function drawSection() {
    const g = createSVG('g', {});
    const s = HOLE_PX / state.H;                             // px per unit, diameters to scale
    const floating = state.mode === 'floating';

    // Hole axes at the edge of their zones, shifted opposite ways
    const tTop = floating ? state.T : state.T2;
    const tBot = floating ? state.T : state.T1;
    const topAxis = X0 + (tTop / 2) * s;
    const botAxis = X0 - (tBot / 2) * s;
    const boltAxis = floating ? X0 : botAxis;              // Fixed: the thread locates the fastener
    const Hpx = state.H * s, Fpx = state.F * s;

    g.appendChild(text(floating ? 'SECTION THROUGH THE JOINT · FLOATING FASTENER' : 'SECTION THROUGH THE JOINT · FIXED FASTENER',
        40, 212, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));

    // Position zones (bands through each plate)
    const band = (y, h, t) => g.appendChild(createSVG('rect', {
        x: X0 - (t / 2) * s, y, width: Math.max(t * s, 1), height: h, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1, 'stroke-dasharray': '4 3'
    }));

    plate(g, TOP.y, TOP.h, topAxis, Hpx);
    plate(g, BOT.y, BOT.h, floating ? botAxis : boltAxis, floating ? Hpx : Fpx, { threaded: !floating });
    band(TOP.y, TOP.h, tTop);
    band(BOT.y, BOT.h, tBot);

    // Fastener (shank), extends past both plates
    const by1 = TOP.y - 28, by2 = BOT.y + BOT.h + (floating ? 28 : -10);
    g.appendChild(createSVG('rect', { x: boltAxis - Fpx / 2, y: by1, width: Fpx, height: by2 - by1, fill: '#cbd5e1', stroke: COLORS.actual, 'stroke-width': 2, opacity: 0.92 }));
    g.appendChild(text(floating ? 'bolt' : 'screw', boltAxis, by1 - 6, { size: 11.5, fill: COLORS.muted, anchor: 'middle', italic: true }));

    // Interference: bolt overlapping plate material in the clearance hole(s)
    const boltL = boltAxis - Fpx / 2, boltR = boltAxis + Fpx / 2;
    const clash = (y, h, holeAxis) => {
        const wallL = holeAxis - Hpx / 2, wallR = holeAxis + Hpx / 2;
        const hit = (x, w, labelX, anchor) => {
            g.appendChild(createSVG('rect', { x, y, width: w, height: h, fill: COLORS.fail, opacity: 0.8 }));
            g.appendChild(text(`blocks by ${fmt(w / s)}`, labelX, y + h / 2 + 4, { size: 12, weight: 700, fill: COLORS.fail, anchor }));
        };
        if (wallL > boltL + 0.3) hit(boltL, wallL - boltL, boltL - 8, 'end');
        if (wallR < boltR - 0.3) hit(wallR, boltR - wallR, boltR + 8, 'start');
    };
    clash(TOP.y, TOP.h, topAxis);
    if (floating) clash(BOT.y, BOT.h, botAxis);

    // Centerlines: true position, hole axes
    g.appendChild(nominalLine(X0, TOP.y - 70, X0, BOT.y + BOT.h + 70));
    const axisStyle = { stroke: COLORS.zoneStroke, 'stroke-width': 1.2, 'stroke-dasharray': '12 3 2 3' };
    g.appendChild(createSVG('line', { x1: topAxis, y1: TOP.y, x2: topAxis, y2: TOP.y + TOP.h, ...axisStyle }));
    g.appendChild(createSVG('line', { x1: botAxis, y1: BOT.y, x2: botAxis, y2: BOT.y + BOT.h, ...axisStyle }));

    // Dimensions: H on the clearance hole, F on the fastener, offsets
    const dimY = BOT.y + BOT.h + 50;
    g.appendChild(dimension(boltL, dimY, boltR, dimY, `F ${fmt(state.F)}`, { color: 'ink', labelSide: 'below', size: 12 }));
    g.appendChild(dimension(topAxis - Hpx / 2, TOP.y - 44, topAxis + Hpx / 2, TOP.y - 44, `H ${fmt(state.H)}`, { color: 'ink', size: 12 }));
    g.appendChild(text(floating ? 'part 1' : 'clearance part', PLATE_X[0] + 6, TOP.y + 18, { size: 12, weight: 700, fill: COLORS.text }));
    g.appendChild(text(floating ? 'part 2' : 'threaded part', PLATE_X[0] + 6, BOT.y + 18, { size: 12, weight: 700, fill: COLORS.text }));

    // Where each axis sits (the worst case)
    const top = `${floating ? 'Part 1 hole' : 'Clearance hole'} axis: ${fmt(tTop / 2)} right of true position`;
    const bot = `${floating ? 'Part 2 hole' : 'Thread'} axis: ${fmt(tBot / 2)} left of true position`;
    g.appendChild(text(top, PLATE_X[0], 580, { size: 12, fill: COLORS.zoneText }));
    g.appendChild(text(bot, PLATE_X[0], 598, { size: 12, fill: COLORS.zoneText }));
    g.appendChild(text('Diameters and offsets to scale; plate thickness is not.', PLATE_X[0], 624,
        { size: 11.5, italic: true, fill: COLORS.muted }));
    svgContainer.appendChild(g);
}

function panelTitle(str, y) {
    return text(str, PANEL_X, y, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' });
}

function drawPanel(r) {
    const g = createSVG('g', {});
    const floating = state.mode === 'floating';

    g.appendChild(panelTitle('1. THE FORMULA', 40));
    g.appendChild(text(floating ? 'T = H − F' : 'T₁ + T₂ = H − F', PANEL_X, 74, { size: 24, weight: 700, mono: true, fill: COLORS.ink }));
    g.appendChild(text(`= ${fmt(state.H)} − ${fmt(state.F)} = ${fmt(r.clearance)}${u()}`, PANEL_X, 104, { size: 16, weight: 600, mono: true, fill: COLORS.zoneText }));
    if (!floating) {
        g.appendChild(text(`Split equally: Ø${fmt(r.clearance / 2)} on each part`, PANEL_X, 128, { size: 13, fill: COLORS.muted }));
    }

    g.appendChild(panelTitle('2. WHY IT WORKS', 168));
    const why = floating
        ? 'Each hole may sit up to T/2 off true position. In the worst case the two holes shift opposite ways, leaving an opening of H − T. The largest fastener, F, must still pass: H − T ≥ F.'
        : 'The thread locates the fastener, so it carries its own part\'s error (T₁/2) into the clearance hole, which may be off by T₂/2 the other way. The clearance hole must absorb both: H − T₂ ≥ F + T₁.';
    g.appendChild(wrapText(why, PANEL_X, 192, 50, 18, { size: 13, fill: COLORS.text }));

    // Virtual condition check
    g.appendChild(panelTitle('3. VIRTUAL CONDITION CHECK', 282));
    const vcHole = state.H - (floating ? state.T : state.T2);
    const vcFast = floating ? state.F : state.F + state.T1;
    g.appendChild(text(`hole VC   H − ${floating ? 'T' : 'T₂'} = ${fmt(vcHole)}`, PANEL_X, 308, { size: 13.5, mono: true, fill: COLORS.ink }));
    g.appendChild(text(`fastener  ${floating ? 'F' : 'F + T₁'} = ${fmt(vcFast)}`, PANEL_X, 330, { size: 13.5, mono: true, fill: COLORS.ink }));
    const ok = vcHole >= vcFast - EPS;
    g.appendChild(text(ok ? 'Hole boundary ≥ fastener boundary: always assembles' : 'Hole boundary < fastener boundary: may not assemble',
        PANEL_X, 354, { size: 13, weight: 600, fill: ok ? COLORS.pass : COLORS.fail }));

    // Callouts for the drawing
    g.appendChild(panelTitle('4. ON THE DRAWING', 398));
    const hole = `Ø${fmt(state.H)} +${fmt(state.holeTol)}/−0`;
    const datums = ['A', 'B', 'C'];
    if (floating) {
        g.appendChild(text(`Both parts: ${hole}`, PANEL_X, 424, { size: 13, weight: 600, mono: true, fill: COLORS.ink }));
        g.appendChild(featureControlFrame(PANEL_X, 434, { symbol: 'position', tolerance: fmt(state.T), diameter: true, modifier: 'M', datums }).g);
    } else {
        g.appendChild(text(`Clearance part: ${hole}`, PANEL_X, 424, { size: 13, weight: 600, mono: true, fill: COLORS.ink }));
        g.appendChild(featureControlFrame(PANEL_X, 434, { symbol: 'position', tolerance: fmt(state.T2), diameter: true, modifier: 'M', datums }).g);
        const thread = state.screw !== 'custom' ? `${state.screw} tapped` : 'Tapped hole';
        g.appendChild(text(`Threaded part: ${thread}`, PANEL_X, 498, { size: 13, weight: 600, mono: true, fill: COLORS.ink }));
        g.appendChild(featureControlFrame(PANEL_X, 508, {
            symbol: 'position', tolerance: fmt(state.T1), diameter: true, modifier: ['M', 'P'], projected: String(state.projected), datums
        }).g);
        g.appendChild(wrapText(`Projected zone ${state.projected}: at least as tall as the clearance part, so a tilted thread cannot lean into the bolt's path.`,
            PANEL_X, 566, 52, 16, { size: 12, fill: COLORS.muted }));
    }
    svgContainer.appendChild(g);
}

function drawResults(r) {
    const floating = state.mode === 'floating';
    let sentence;
    if (r.clearance <= 0) {
        sentence = `The hole (Ø${fmt(state.H)}) is not bigger than the fastener (Ø${fmt(state.F)}), so there is no room for any position tolerance.`;
    } else if (floating) {
        sentence = r.fits
            ? `With Ø${fmt(state.H)} holes and a Ø${fmt(state.F)} fastener, each part can have up to Ø${fmt(r.clearance)} position at MMC. Ø${fmt(state.T)} leaves ${fmt(r.spare)} spare, so it always assembles.`
            : `Ø${fmt(state.T)} on each part is ${fmt(-r.spare)} more than H − F = ${fmt(r.clearance)}. In the worst case each hole wall overlaps the fastener by ${fmt(-r.spare / 2)}, so it won't assemble.`;
    } else {
        sentence = r.fits
            ? `T₁ + T₂ = ${fmt(r.used)} is within H − F = ${fmt(r.clearance)}, so the fastener always passes the clearance hole${r.spare > EPS ? ` with ${fmt(r.spare)} spare` : ''}. Half the budget of the floating case: the thread uses its share.`
            : `T₁ + T₂ = ${fmt(r.used)} is ${fmt(-r.spare)} more than H − F = ${fmt(r.clearance)}. In the worst case the fastener overlaps the clearance hole wall by ${fmt(-r.spare / 2)}, so it won't assemble.`;
    }
    svgContainer.appendChild(resultsStrip({
        pass: r.fits,
        measured: { label: floating ? 'Your tolerance' : 'Your T₁ + T₂', value: r.used },
        allowed: { label: 'Max: H − F', value: Math.max(r.clearance, 0) },
        unit: u(),
        decimals: state.units === 'mm' ? 3 : 4,
        sentence,
        compact: true
    }));
}

// --- CONTROLS ---

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const numInput = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold';

function renderControls() {
    if (!controlsContainer) return;
    const floating = state.mode === 'floating';
    const seg = (attr, key, value, label) =>
        `<button data-${attr}="${value}" class="${segBtn} ${state[key] === value ? segOn : segOff}">${label}</button>`;
    const num = (id, label, value, stepMm = 0.01) => `
        <div><label class="block text-xs font-bold text-slate-500 mb-1">${label}</label>
        <input type="number" id="${id}" step="${state.units === 'in' ? stepMm / 10 : stepMm}" min="0" value="${value}" class="${numInput}"></div>`;

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Joint type</h4>
            <div class="flex gap-2">${seg('mode', 'mode', 'floating', 'Floating (bolt + nut)')}${seg('mode', 'mode', 'fixed', 'Fixed (tapped / pin)')}</div>
            <p class="text-xs text-slate-400 mt-2">${floating
                ? 'Both parts have clearance holes; the fastener floats in both.'
                : 'One part holds the fastener (threaded hole or press-fit pin); the other has a clearance hole.'}</p>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Fastener and hole</h4>
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">METRIC SCREW</label>
                    <select id="fx-screw" class="${numInput}">
                        ${Object.keys(ISO273).map(k => `<option ${state.screw === k ? 'selected' : ''}>${k}</option>`).join('')}
                        <option value="custom" ${state.screw === 'custom' ? 'selected' : ''}>Custom</option>
                    </select></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">ISO 273 HOLE</label>
                    <select id="fx-fit" class="${numInput}" ${state.screw === 'custom' ? 'disabled' : ''}>
                        ${CLASS_NAMES.map((n, i) => `<option value="${i}" ${state.fit === i ? 'selected' : ''}>${n}${state.screw !== 'custom' ? ` (Ø${ISO273[state.screw][i]} mm)` : ''}</option>`).join('')}
                    </select></div>
            </div>
            <div class="grid grid-cols-3 gap-2">
                ${num('fx-F', 'F: MAX FASTENER Ø', state.F)}
                ${num('fx-H', 'H: MIN HOLE Ø', state.H)}
                ${num('fx-htol', 'HOLE + TOL', state.holeTol)}
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Position tolerance to check</h4>
            ${floating ? `
                <div class="grid grid-cols-2 gap-2 items-end">
                    ${num('fx-T', 'T: EACH PART (Ø)', state.T, 0.01)}
                    <button id="fx-max" class="${smallBtn} py-2">USE MAXIMUM</button>
                </div>` : `
                <div class="grid grid-cols-2 gap-2">
                    ${num('fx-T1', 'T₁: THREADED PART (Ø)', state.T1, 0.01)}
                    ${num('fx-T2', 'T₂: CLEARANCE PART (Ø)', state.T2, 0.01)}
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2 items-end">
                    ${num('fx-P', 'Ⓟ PROJECTED HEIGHT', state.projected, 1)}
                    <button id="fx-split" class="${smallBtn} py-2">SPLIT MAXIMUM EQUALLY</button>
                </div>`}
        </div>

        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Common mistakes</div>
            <ul class="text-xs leading-relaxed list-disc pl-4 space-y-1">
                <li>Use the <b>smallest</b> hole (MMC) for H and the <b>largest</b> fastener for F, not nominal sizes.</li>
                <li>Fixed fasteners get about half the tolerance of floating ones: the thread uses its share.</li>
                <li>A tapped hole's tilt carries into the mating part. Add a projected zone Ⓟ at least as tall as the clearance part.</li>
                <li>These formulas assume Ⓜ on the holes; at RFS there's no bonus as holes grow.</li>
            </ul>
        </div>`;
    bindControls();
}

function bindControls() {
    const $ = id => document.getElementById(id);
    const c = controlsContainer;
    const rerender = (controls = false) => { if (controls) renderControls(); renderScene(); };

    c.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; rerender(true); });

    const applyPreset = () => {
        if (state.screw === 'custom') return;
        state.F = +fromMm(parseFloat(state.screw.slice(1))).toFixed(5);   // metric sizes, shown in the current unit
        state.H = +fromMm(ISO273[state.screw][state.fit]).toFixed(5);
    };
    $('fx-screw').onchange = e => { state.screw = e.target.value; applyPreset(); rerender(true); };
    $('fx-fit').onchange = e => { state.fit = +e.target.value; applyPreset(); rerender(true); };

    const numField = (id, key, { markCustom = false, min = 0 } = {}) => {
        const el = $(id);
        if (!el) return;
        el.onchange = () => {
            const v = parseFloat(el.value);
            if (Number.isFinite(v) && v >= min) {
                state[key] = v;
                if (markCustom) state.screw = 'custom';
            }
            rerender(true);
        };
    };
    numField('fx-F', 'F', { markCustom: true, min: 0.001 });
    numField('fx-H', 'H', { markCustom: true, min: 0.001 });
    numField('fx-htol', 'holeTol');
    numField('fx-T', 'T');
    numField('fx-T1', 'T1');
    numField('fx-T2', 'T2');
    numField('fx-P', 'projected', { min: 0 });

    const max = () => Math.max(state.H - state.F, 0);
    if ($('fx-max')) $('fx-max').onclick = () => { state.T = +max().toFixed(4); rerender(true); };
    if ($('fx-split')) $('fx-split').onclick = () => { state.T1 = state.T2 = +(max() / 2).toFixed(4); rerender(true); };
}
