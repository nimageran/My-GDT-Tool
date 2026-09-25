// js/modules/material/rule1.js
// Rule #1 (the envelope rule, ASME Y14.5 §5.8): a feature of size must have
// perfect form at MMC. A pin made at its largest size must be perfectly
// straight; as it gets smaller, it may bend by the difference. A caliper
// (two-point size) cannot see the bend, only a gauge at MMC can.

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, addDefs, text, wrapText, legend, resultsStrip } from '../../theme.js';
import { syncUnits, fromMm, step, decimals } from '../../units.js';

const UNITS = { native: 'mm', lengths: ['nominal', 'plus', 'minus', 'size', 'bend'],
    nice: { in: { nominal: 0.375, plus: 0.004, minus: 0.004, size: 0.373, bend: 0.002 } } };
const fine = () => (state.units === 'in' ? 0.0001 : 0.001);   // slider step

const state = {
    feature: 'pin',          // 'pin' | 'hole'
    principle: 'envelope',   // 'envelope' (Rule #1, ASME default) | 'independency' (ISO 8015 default, or Ⓘ)
    nominal: 10, plus: 0.1, minus: 0.1,
    size: 9.95,              // local size (two-point), same along the length
    bend: 0.05               // axis bend = straightness error of the axis
};

let svgRef = null, controlsRoot = null;
const f3 = v => v.toFixed(decimals());

export function draw(svg) {
    syncUnits(state, UNITS);
    svgRef = svg;
    render();
}

export function loadControls(container) {
    syncUnits(state, UNITS);
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------
// Maths
// --------------------------------------------------------------------------

export function evaluateRule1(s) {
    const pin = s.feature === 'pin';
    const lower = s.nominal - s.minus, upper = s.nominal + s.plus;
    const mmc = pin ? upper : lower, lmc = pin ? lower : upper;
    const sizeOK = s.size >= lower - EPS && s.size <= upper + EPS;
    // Envelope = perfect form boundary at MMC. A pin with a bent axis needs a
    // ring of (size + bend); a bent hole only accepts a pin of (size − bend).
    const needs = pin ? s.size + s.bend : s.size - s.bend;
    const envelopeOK = pin ? needs <= mmc + EPS : needs >= mmc - EPS;
    const bendAllowed = Math.max(0, pin ? mmc - s.size : s.size - mmc);
    const checked = s.principle === 'envelope';
    return { pin, lower, upper, mmc, lmc, sizeOK, needs, envelopeOK, bendAllowed, pass: sizeOK && (!checked || envelopeOK) };
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const X0 = 90, X1 = 580, YC = 345;      // side view: part length and centre line
const D0 = 150;                          // drawn diameter at nominal size (px)

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const r = evaluateRule1(state);

    // Deviations are magnified so 0.1 mm is visible
    const devRange = Math.max(state.plus + state.minus, state.bend, fromMm(0.02));
    const K = 70 / devRange;                                   // px per mm of deviation
    const D = s => D0 + (s - state.nominal) * K;

    svg.appendChild(legend(24, 24, [
        { kind: 'zoneOutline', label: 'Envelope: perfect form at MMC' },
        { kind: 'actual', label: `The ${state.feature} as made (bend exaggerated)` },
        { kind: 'fail', label: 'Breaks through the envelope' }
    ], { note: 'Side view. Size and bend errors magnified.' }));

    drawCallout(svg, r);
    drawSideView(svg, r, D, K);
    drawChecks(svg, r);
    drawFormChart(svg, r);
    drawResults(svg, r);
}

function drawCallout(svg, r) {
    const x = 380, y = 42;
    const tol = state.plus === state.minus ? `±${state.plus}` : `+${state.plus}/−${state.minus}`;
    svg.appendChild(text(`${r.pin ? 'PIN' : 'HOLE'} Ø${state.nominal} ${tol}`, x, y, { size: 22, weight: 800, fill: COLORS.ink, mono: true }));
    svg.appendChild(text(`MMC Ø${f3(r.mmc)} (${r.pin ? 'largest' : 'smallest'})   ·   LMC Ø${f3(r.lmc)}`, x, y + 24, { size: 13.5, fill: COLORS.muted, mono: true }));
    const rule = state.principle === 'envelope'
        ? 'Rule #1 applies: perfect form is required at MMC.'
        : 'Independency: size is checked point by point only; form is not limited by size.';
    svg.appendChild(text(rule, x, y + 48, { size: 13.5, weight: 600, fill: state.principle === 'envelope' ? COLORS.zoneText : '#b45309' }));
}

function drawSideView(svg, r, D, K) {
    const bendPx = state.bend * K;
    const dPart = D(state.size), dEnv = D(r.mmc);
    const axisY = t => YC - bendPx * (1 - (2 * t - 1) ** 2);       // bowed up in the middle
    const envC = YC - bendPx / 2;                                  // envelope sits at the best-fit middle

    // Hole: the part is a block with a bent bore through it
    if (!r.pin) {
        svg.appendChild(createSVG('rect', { x: X0 - 30, y: YC - D0 / 2 - 80, width: X1 - X0 + 60, height: D0 + 160, fill: '#e2e8f0', stroke: COLORS.partStroke, 'stroke-width': 1.5 }));
    }

    const N = 60;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
        const t = i / N, x = X0 + t * (X1 - X0), ay = axisY(t);
        top.push([x, ay - dPart / 2]);
        bot.push([x, ay + dPart / 2]);
    }
    const outline = [...top, ...bot.reverse()].map(p => p.join(',')).join(' ');
    svg.appendChild(createSVG('polygon', { points: outline, fill: r.pin ? '#cbd5e1' : '#ffffff', stroke: COLORS.actual, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    bot.reverse();

    // Envelope
    svg.appendChild(createSVG('rect', {
        x: X0 - 12, y: envC - dEnv / 2, width: X1 - X0 + 24, height: dEnv,
        fill: r.pin ? COLORS.zoneFill : 'rgba(59,130,246,0.10)', stroke: COLORS.zoneStroke, 'stroke-width': 2, 'stroke-dasharray': '10 6'
    }));

    // Where the part breaks through the envelope (only when Rule #1 is checked)
    if (state.principle === 'envelope' && !r.envelopeOK) {
        const outside = (y, edge) => r.pin
            ? (edge === 'top' ? y < envC - dEnv / 2 - 0.5 : y > envC + dEnv / 2 + 0.5)
            : (edge === 'top' ? y > envC - dEnv / 2 + 0.5 : y < envC + dEnv / 2 - 0.5);
        for (const [edge, pts] of [['top', top], ['bot', bot]]) {
            for (let i = 0; i < pts.length - 1; i++) {
                if (outside(pts[i][1], edge) && outside(pts[i + 1][1], edge)) {
                    svg.appendChild(createSVG('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1], stroke: COLORS.fail, 'stroke-width': 5, 'stroke-linecap': 'round' }));
                }
            }
        }
    }

    // Axis
    svg.appendChild(createSVG('polyline', { points: top.map((p, i) => `${p[0]},${axisY(i / N)}`).join(' '), fill: 'none', stroke: COLORS.muted, 'stroke-width': 1, 'stroke-dasharray': '14 4 3 4' }));

    // Caliper at the left end: a two-point size, blind to the bend
    const cx = X0 + 70, ay = axisY(70 / (X1 - X0));
    const jaw = (y, dir) => svg.appendChild(createSVG('path', { d: `M${cx - 16},${y + dir * 22} L${cx - 16},${y} L${cx + 16},${y} L${cx + 16},${y + dir * 22}`, fill: 'none', stroke: '#b45309', 'stroke-width': 3 }));
    jaw(ay - dPart / 2 - 3, -1);
    jaw(ay + dPart / 2 + 3, 1);
    svg.appendChild(text(`Caliper: Ø${f3(state.size)}`, cx - 16, YC + D0 / 2 + (r.pin ? 72 : 100), { size: 13, weight: 700, fill: '#b45309' }));

    const labelY = r.pin ? envC - dEnv / 2 - 12 : YC - D0 / 2 - 90;
    svg.appendChild(text(`${r.pin ? 'Ring gauge' : 'Plug gauge'} Ø${f3(r.mmc)} (the envelope)`, X0 - 12, labelY, { size: 13, weight: 700, fill: COLORS.zoneText }));
    svg.appendChild(text(`axis bend ${f3(state.bend)}`, X1 + 12, labelY, { size: 13, fill: COLORS.muted, mono: true, anchor: 'end' }));
}

function drawChecks(svg, r) {
    const x = 640, w = 330;
    const card = (y, title, ok, lines, active = true) => {
        const color = !active ? COLORS.muted : ok ? COLORS.pass : COLORS.fail;
        svg.appendChild(createSVG('rect', { x, y, width: w, height: 104, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
        svg.appendChild(createSVG('rect', { x, y, width: 5, height: 104, rx: 2, fill: color }));
        svg.appendChild(text(title, x + 18, y + 26, { size: 13, weight: 800, fill: COLORS.ink, letterSpacing: '0.04em' }));
        svg.appendChild(text(!active ? 'NOT CHECKED' : ok ? 'PASS' : 'FAIL', x + w - 16, y + 26, { size: 13, weight: 800, fill: color, anchor: 'end' }));
        lines.forEach((l, i) => svg.appendChild(text(l, x + 18, y + 52 + i * 21, { size: 13.5, fill: COLORS.text, mono: i === 0 })));
    };
    card(150, '1. SIZE (CALIPER)', r.sizeOK, [
        `${f3(r.lower)} ≤ ${f3(state.size)} ≤ ${f3(r.upper)}`,
        'Two-point size at every section.'
    ]);
    const env = r.pin ? `${f3(state.size)} + ${f3(state.bend)} = ${f3(r.needs)} ≤ ${f3(r.mmc)}` : `${f3(state.size)} − ${f3(state.bend)} = ${f3(r.needs)} ≥ ${f3(r.mmc)}`;
    card(270, '2. GAUGE AT MMC', r.envelopeOK, [
        env,
        state.principle === 'envelope' ? `Size ${r.pin ? '+' : '−'} bend must fit the gauge.` : 'Not required under independency.'
    ], state.principle === 'envelope');
}

// How much bend is allowed at each size: 0 at MMC, the whole size tolerance at LMC
function drawFormChart(svg, r) {
    const x0 = 640, x1 = 960, y0 = 400, y1 = 610;
    svg.appendChild(text('BEND ALLOWED AT EACH SIZE', x0, y0, { size: 12, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const tolRange = r.upper - r.lower;
    const maxB = Math.max(tolRange, state.bend) * 1.15 || fromMm(0.1);
    const X = s => x0 + 20 + (s - r.lower) / (tolRange || 1) * (x1 - x0 - 40);
    const Y = b => y1 - 20 - b / maxB * (y1 - y0 - 50);
    svg.appendChild(createSVG('line', { x1: X(r.lower), y1: Y(0), x2: X(r.upper), y2: Y(0), stroke: COLORS.ink, 'stroke-width': 1.5 }));
    svg.appendChild(createSVG('line', { x1: X(r.lower), y1: Y(0), x2: X(r.lower), y2: Y(maxB), stroke: COLORS.ink, 'stroke-width': 1.5 }));
    if (state.principle === 'envelope') {
        const tri = [[X(r.mmc), Y(0)], [X(r.lmc), Y(0)], [X(r.lmc), Y(tolRange)]];
        svg.appendChild(createSVG('polygon', { points: tri.map(p => p.join(',')).join(' '), fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1.5 }));
    } else {
        svg.appendChild(createSVG('rect', { x: X(r.lower), y: Y(maxB), width: X(r.upper) - X(r.lower), height: Y(0) - Y(maxB), fill: 'rgba(245,158,11,0.12)' }));
        svg.appendChild(text('any bend (size only)', (X(r.lower) + X(r.upper)) / 2, Y(maxB * 0.55), { size: 12, fill: '#b45309', anchor: 'middle' }));
    }
    svg.appendChild(text('bend', X(r.lower) - 6, Y(maxB) + 4, { size: 11.5, fill: COLORS.muted, anchor: 'end' }));
    svg.appendChild(text(`MMC ${f3(r.mmc)}`, X(r.mmc), Y(0) + 17, { size: 11.5, fill: COLORS.muted, anchor: 'middle', mono: true }));
    svg.appendChild(text(`LMC ${f3(r.lmc)}`, X(r.lmc), Y(0) + 17, { size: 11.5, fill: COLORS.muted, anchor: 'middle', mono: true }));
    const px = X(Math.min(Math.max(state.size, r.lower), r.upper)), py = Y(Math.min(state.bend, maxB));
    svg.appendChild(createSVG('circle', { cx: px, cy: py, r: 6, fill: r.pass ? COLORS.pass : COLORS.fail, stroke: '#fff', 'stroke-width': 2 }));
}

function drawResults(svg, r) {
    const f = state.feature;
    let sentence;
    if (!r.sizeOK) sentence = `The ${f} measures Ø${f3(state.size)}, outside Ø${f3(r.lower)} to Ø${f3(r.upper)}: it fails on size.`;
    else if (state.principle === 'independency') sentence = `The caliper size Ø${f3(state.size)} is in tolerance, and under independency that is all the size tolerance checks. The bend of ${f3(state.bend)} would need its own straightness tolerance to be limited.`;
    else if (r.envelopeOK) sentence = `At Ø${f3(state.size)} the ${f} is ${f3(r.bendAllowed)} away from MMC, so it may bend up to ${f3(r.bendAllowed)}. It bends ${f3(state.bend)}, so it still fits the Ø${f3(r.mmc)} gauge.`;
    else sentence = `Every caliper reading is fine (Ø${f3(state.size)}), but the ${f} bends ${f3(state.bend)} and only ${f3(r.bendAllowed)} is allowed at this size. It will not fit the Ø${f3(r.mmc)} ${r.pin ? 'ring' : 'plug'} gauge: it fails Rule #1.`;
    const envelope = state.principle === 'envelope';
    svg.appendChild(resultsStrip({
        pass: r.pass, compact: true,
        measured: { label: envelope ? (r.pin ? 'Size + bend' : 'Size − bend') : 'Size (caliper)', value: envelope ? r.needs : state.size },
        allowed: { label: envelope ? `MMC (${r.pin ? 'max' : 'min'})` : 'Limits', value: r.mmc, text: envelope ? undefined : `${f3(r.lower)}…${f3(r.upper)}` },
        gauge: false,
        sentence
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const input = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold text-left';

const PRESETS = [
    { label: 'Perfect pin at MMC', set: { feature: 'pin', size: null, at: 'mmc', bend: 0 } },
    { label: 'Bent pin at MMC: caliper OK, gauge fails', set: { feature: 'pin', at: 'mmc', bend: 0.25 } },
    { label: 'Same bend, pin at LMC: passes', set: { feature: 'pin', at: 'lmc', bend: 0.25 } },
    { label: 'Bent hole near MMC: fails', set: { feature: 'hole', at: 'mid-mmc', bend: 0.4 } }
];

function applyPreset(p) {
    state.feature = p.set.feature;
    state.principle = 'envelope';
    const r = evaluateRule1(state);
    state.size = p.set.at === 'mmc' ? r.mmc : p.set.at === 'lmc' ? r.lmc : (r.mmc * 3 + r.lmc) / 4;
    state.bend = +(p.set.bend * (state.plus + state.minus)).toFixed(5);   // bend as a share of the size tolerance
}

function renderControls() {
    if (!controlsRoot) return;
    const r = evaluateRule1(state);
    const seg = (key, value, label) => `<button data-${key}="${value}" class="${segBtn} ${state[key] === value ? segOn : segOff}">${label}</button>`;
    const lo = (r.lower - state.minus * 0.5).toFixed(decimals()), hi = (r.upper + state.plus * 0.5).toFixed(decimals());
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-3">
            <div class="flex gap-2">${seg('feature', 'pin', 'Pin (shaft)')}${seg('feature', 'hole', 'Hole')}</div>
            <div>
                <h4 class="font-bold text-xs text-slate-500 uppercase mb-1">Which rule</h4>
                <div class="flex gap-2">${seg('principle', 'envelope', 'Rule #1 (ASME)')}${seg('principle', 'independency', 'Independency (ISO / Ⓘ)')}</div>
            </div>
            <div class="grid grid-cols-3 gap-2">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">NOMINAL Ø</label><input id="r1-nom" type="number" step="${state.units === 'in' ? 0.01 : 0.1}" value="${state.nominal}" class="${input}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">+ TOL</label><input id="r1-plus" type="number" step="${step()}" min="0" value="${state.plus}" class="${input}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">− TOL</label><input id="r1-minus" type="number" step="${step()}" min="0" value="${state.minus}" class="${input}"></div>
            </div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-3">
            <div>
                <div class="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>SIZE (CALIPER) Ø</span><span id="r1-size-v" class="font-mono">${f3(state.size)}</span></div>
                <input id="r1-size" type="range" min="${lo}" max="${hi}" step="${fine()}" value="${state.size}" class="w-full">
            </div>
            <div>
                <div class="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>BEND OF THE AXIS</span><span id="r1-bend-v" class="font-mono">${f3(state.bend)}</span></div>
                <input id="r1-bend" type="range" min="0" max="${(Math.max(state.plus + state.minus, fromMm(0.02)) * 1.5).toFixed(decimals())}" step="${fine()}" value="${state.bend}" class="w-full">
            </div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Try these</h4>
            <div class="flex flex-col gap-1.5">${PRESETS.map((p, i) => `<button data-preset="${i}" class="${smallBtn}">${p.label}</button>`).join('')}</div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> When Rule #1 does not apply</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>ISO drawings (ISO 8015): independency is the default. Look for Ⓔ after the size to ask for the envelope.</li>
                <li>ASME drawings with Ⓘ after the size, or a note saying perfect form at MMC is not required.</li>
                <li>Stock material (bar, tube, sheet) used as bought, and parts checked in the free state (Ⓕ).</li>
                <li>It controls the form of one feature only. It does not control orientation or location between features.</li>
            </ul>
        </div>`;

    const q = s => controlsRoot.querySelector(s);
    controlsRoot.querySelectorAll('[data-feature]').forEach(b => b.onclick = () => {
        state.feature = b.dataset.feature;
        const rr = evaluateRule1(state);
        state.size = Math.min(Math.max(state.size, rr.lower), rr.upper);
        update();
    });
    controlsRoot.querySelectorAll('[data-principle]').forEach(b => b.onclick = () => { state.principle = b.dataset.principle; update(); });
    controlsRoot.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { applyPreset(PRESETS[+b.dataset.preset]); update(); });
    const num = (id, key) => { q(id).onchange = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= 0) { state[key] = v; update(); } }; };
    num('#r1-nom', 'nominal'); num('#r1-plus', 'plus'); num('#r1-minus', 'minus');
    q('#r1-size').oninput = e => { state.size = +e.target.value; q('#r1-size-v').textContent = f3(state.size); render(); };
    q('#r1-bend').oninput = e => { state.bend = +e.target.value; q('#r1-bend-v').textContent = f3(state.bend); render(); };
}

function update() {
    render();
    renderControls();
}
