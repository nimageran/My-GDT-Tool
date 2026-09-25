// js/modules/manufacturing/cpk.js
// Cp / Cpk: can the process hold the callout? Paste measurements, enter the
// limits, and see the spread against the limits as a histogram, Cp (could it
// fit if centred?), Cpk (does it fit where it actually is?), the expected
// share out of spec, and what to fix.

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText, resultsStrip } from '../../theme.js';
import { UI, esc } from '../drawing/sheet.js';

// Example: a Ø10.00 ±0.05 bore, running a little high (deterministic sample)
function sampleData() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = [];
    for (let i = 0; i < 40; i++) {
        const z = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
        out.push((10.018 + z * 0.012).toFixed(3));
    }
    return out.join(' ');
}

const state = { oneSided: false, lsl: 9.95, usl: 10.05, target: 1.33, raw: sampleData() };
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

export function parseValues(raw) {
    const parts = String(raw).split(/[\s,;]+/).filter(Boolean);
    const values = [];
    let skipped = 0;
    for (const p of parts) { const v = Number(p); if (Number.isFinite(v)) values.push(v); else skipped++; }
    return { values, skipped };
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7)
export function phi(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function capability(values, lsl, usl, oneSided) {
    const n = values.length;
    if (n < 2) return null;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));   // sample standard deviation
    const cpu = sd > 0 ? (usl - mean) / (3 * sd) : Infinity;
    const cpl = oneSided ? Infinity : sd > 0 ? (mean - lsl) / (3 * sd) : Infinity;
    const cp = oneSided ? null : sd > 0 ? (usl - lsl) / (6 * sd) : Infinity;
    const cpk = Math.min(cpu, cpl);
    const pOut = sd > 0 ? (1 - phi((usl - mean) / sd)) + (oneSided ? 0 : phi((lsl - mean) / sd)) : 0;
    const outCount = values.filter(v => v > usl || (!oneSided && v < lsl)).length;
    return { n, mean, sd, cp, cpk, cpu, cpl, pOut, outCount, min: Math.min(...values), max: Math.max(...values) };
}

// --------------------------------------------------------------------------
// Canvas
// --------------------------------------------------------------------------

const H = { x0: 70, x1: 610, y0: 110, y1: 520 };
const dp = v => (Math.abs(v) >= 100 ? 2 : 4);

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const { values } = parseValues(state.raw);
    const lsl = state.oneSided ? null : state.lsl, usl = state.usl;
    const limitsOK = Number.isFinite(usl) && (state.oneSided || (Number.isFinite(lsl) && lsl < usl));
    const r = limitsOK ? capability(values, lsl, usl, state.oneSided) : null;

    svg.appendChild(text('MEASUREMENTS AGAINST THE LIMITS', 30, 40, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    if (!r) {
        svg.appendChild(text(!limitsOK ? 'Enter limits with the lower one below the upper one.' : 'Paste at least 2 measurements.', 500, 380, { size: 18, fill: COLORS.muted, anchor: 'middle' }));
        return;
    }
    drawHistogram(svg, values, r, lsl, usl);
    drawStats(svg, r);
    drawResult(svg, r);
}

function drawHistogram(svg, values, r, lsl, usl) {
    const sd = r.sd || 1e-9;
    let lo = Math.min(r.min, r.mean - 4 * sd, lsl ?? r.min), hi = Math.max(r.max, r.mean + 4 * sd, usl);
    if (state.oneSided) lo = Math.min(r.min, Math.max(0, r.mean - 4 * sd));
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const X = v => H.x0 + (v - lo) / (hi - lo) * (H.x1 - H.x0);

    const bins = Math.min(20, Math.max(6, Math.round(Math.sqrt(values.length))));
    const bw = (r.max - r.min) / bins || sd / 2;
    const counts = new Array(bins).fill(0);
    values.forEach(v => { counts[Math.min(bins - 1, Math.floor((v - r.min) / bw))]++; });
    const peakPdf = values.length * bw / (sd * Math.sqrt(2 * Math.PI));
    const maxC = Math.max(...counts, peakPdf);
    const Y = c => H.y1 - c / maxC * (H.y1 - H.y0 - 20);

    // baseline and spec band
    const bandL = state.oneSided ? H.x0 : X(lsl);
    svg.appendChild(createSVG('rect', { x: bandL, y: H.y0, width: X(usl) - bandL, height: H.y1 - H.y0, fill: 'rgba(22,163,74,0.06)' }));
    svg.appendChild(createSVG('line', { x1: H.x0, y1: H.y1, x2: H.x1, y2: H.y1, stroke: COLORS.ink, 'stroke-width': 1.5 }));

    // bars (2 px gap between them); outside the limits in red
    counts.forEach((c, i) => {
        if (!c) return;
        const a = r.min + i * bw, b = a + bw, mid = (a + b) / 2;
        const out = mid > usl || (!state.oneSided && mid < lsl);
        const x = X(a) + 1, w = Math.max(2, X(b) - X(a) - 2);
        const bar = createSVG('rect', { x, y: Y(c), width: w, height: H.y1 - Y(c), rx: 2, fill: out ? COLORS.fail : '#3b82f6', opacity: 0.85 });
        const tip = createSVG('title', {});
        tip.textContent = `${a.toFixed(dp(a))} to ${b.toFixed(dp(b))}: ${c} part${c > 1 ? 's' : ''}`;
        bar.appendChild(tip);
        svg.appendChild(bar);
    });

    // fitted normal curve
    const pts = [];
    for (let i = 0; i <= 120; i++) {
        const v = lo + (hi - lo) * i / 120;
        const pdf = values.length * bw / (sd * Math.sqrt(2 * Math.PI)) * Math.exp(-((v - r.mean) ** 2) / (2 * sd * sd));
        pts.push(`${X(v)},${Y(pdf)}`);
    }
    svg.appendChild(createSVG('polyline', { points: pts.join(' '), fill: 'none', stroke: COLORS.ink, 'stroke-width': 2 }));

    // limits and mean
    const vline = (v, label, color, dash) => {
        svg.appendChild(createSVG('line', { x1: X(v), y1: H.y0 - 6, x2: X(v), y2: H.y1 + 6, stroke: color, 'stroke-width': 2, ...(dash ? { 'stroke-dasharray': dash } : {}) }));
        svg.appendChild(text(label, X(v), H.y0 - 12, { size: 12.5, weight: 700, fill: color, anchor: 'middle' }));
        svg.appendChild(text(v.toFixed(dp(v)), X(v), H.y1 + 22, { size: 12, fill: COLORS.muted, anchor: 'middle', mono: true }));
    };
    if (!state.oneSided) vline(lsl, 'LSL', COLORS.ink);
    vline(usl, 'USL', COLORS.ink);
    vline(r.mean, 'mean', '#1d4ed8', '6 4');
    // ±3σ span of the process
    const y3 = H.y1 + 42;
    svg.appendChild(createSVG('line', { x1: X(r.mean - 3 * sd), y1: y3, x2: X(r.mean + 3 * sd), y2: y3, stroke: '#1d4ed8', 'stroke-width': 2, 'marker-start': 'url(#thm-arrow-zone)', 'marker-end': 'url(#thm-arrow-zone)' }));
    svg.appendChild(text('process spread (±3σ, 99.7% of parts)', X(r.mean), y3 + 18, { size: 12, fill: '#1d4ed8', anchor: 'middle' }));
}

const f2 = v => (v === null ? 'n/a' : Number.isFinite(v) ? v.toFixed(2) : '∞');

function drawStats(svg, r) {
    const x = 650, w = 330;
    const grade = cpkGrade(r.cpk);
    svg.appendChild(createSVG('rect', { x, y: 90, width: w, height: 440, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    svg.appendChild(text('Cpk', x + 20, 126, { size: 14, weight: 700, fill: COLORS.muted }));
    svg.appendChild(text(f2(r.cpk), x + 20, 172, { size: 44, weight: 800, fill: grade.color, mono: true }));
    svg.appendChild(text(grade.label, x + 150, 164, { size: 15, weight: 800, fill: grade.color }));
    const rows = [
        ['Cp (if centred)', f2(r.cp)],
        ['Mean', r.mean.toFixed(dp(r.mean) + 1)],
        ['Std deviation (σ)', r.sd.toFixed(dp(r.sd) + 1)],
        ['Measurements (n)', String(r.n)],
        ['Out of spec in the data', `${r.outCount} of ${r.n}`],
        ['Expected out of spec', ppm(r.pOut)]
    ];
    rows.forEach(([l, v], i) => {
        const y = 214 + i * 30;
        svg.appendChild(text(l, x + 20, y, { size: 13.5, fill: COLORS.muted }));
        svg.appendChild(text(v, x + w - 20, y, { size: 14, weight: 700, fill: COLORS.ink, anchor: 'end', mono: true }));
    });
    const scale = [['< 1.00', 'not capable', COLORS.fail], ['1.00–1.33', 'marginal', '#b45309'], ['≥ 1.33', 'capable', COLORS.pass], ['≥ 1.67', 'critical parts', COLORS.pass]];
    svg.appendChild(text('USUAL TARGETS', x + 20, 396, { size: 11.5, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    scale.forEach(([v, l, c], i) => {
        svg.appendChild(text(v, x + 20, 418 + i * 20, { size: 13, weight: 700, fill: c, mono: true }));
        svg.appendChild(text(l, x + 120, 418 + i * 20, { size: 13, fill: COLORS.text }));
    });
    if (r.n < 30) svg.appendChild(wrapText(`Only ${r.n} values: treat as a rough estimate (30 or more is better).`, x + 20, 510, 44, 15, { size: 11.5, italic: true, fill: '#b45309' }));
}

function cpkGrade(c) {
    if (c >= 1.67) return { label: 'excellent', color: COLORS.pass };
    if (c >= 1.33) return { label: 'capable', color: COLORS.pass };
    if (c >= 1.0) return { label: 'marginal', color: '#b45309' };
    return { label: 'not capable', color: COLORS.fail };
}

function ppm(p) {
    if (p < 1e-6) return '< 1 ppm';
    if (p < 0.001) return `${Math.round(p * 1e6)} ppm`;
    return `${(p * 100).toFixed(p < 0.01 ? 2 : 1)}% (${Math.round(p * 1e6).toLocaleString()} ppm)`;
}

function drawResult(svg, r) {
    const pass = r.cpk >= state.target - 1e-9;
    let advice;
    if (pass) advice = `The process fits inside the limits with room to spare: Cpk ${f2(r.cpk)} meets the ${state.target} target.`;
    else if (!state.oneSided && r.cp >= state.target) advice = `The spread is small enough (Cp ${f2(r.cp)}), but the process is off-centre: the mean is ${Math.abs(r.mean - (state.lsl + state.usl) / 2).toFixed(dp(r.mean))} from the middle. Re-centre it (tool offset) and Cpk rises towards Cp.`;
    else advice = `The spread itself is too wide for the tolerance${state.oneSided ? '' : ` (Cp ${f2(r.cp)})`}. Reduce variation (setup, tooling, fixture, temperature), use a more precise process, or ask whether the tolerance can open up.`;
    svg.appendChild(resultsStrip({
        pass, gauge: false, compact: true,
        measured: { label: 'Cpk', value: r.cpk, text: f2(r.cpk) },
        allowed: { label: 'Target', value: state.target, text: `≥ ${state.target}` },
        sentence: advice
    }));
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------

function renderControls() {
    if (!controlsRoot) return;
    const { values, skipped } = parseValues(state.raw);
    const seg = (key, v, label) => `<button data-${key}="${v}" class="${UI.segBtn} ${String(state[key]) === String(v) ? UI.segOn : UI.segOff}">${label}</button>`;
    controlsRoot.innerHTML = `
        <div class="${UI.card} space-y-3">
            <div>
                <h4 class="${UI.h4}">Limits</h4>
                <div class="flex gap-2 mb-2">${seg('oneSided', false, 'Two limits (size)')}${seg('oneSided', true, 'Upper only (position, flatness…)')}</div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="block text-xs font-bold text-slate-500 mb-1">LOWER LIMIT (LSL)</label>
                        <input id="ck-lsl" type="number" step="any" value="${state.lsl}" class="${UI.input}" ${state.oneSided ? 'disabled' : ''}></div>
                    <div><label class="block text-xs font-bold text-slate-500 mb-1">UPPER LIMIT (USL)</label>
                        <input id="ck-usl" type="number" step="any" value="${state.usl}" class="${UI.input}"></div>
                </div>
            </div>
            <div>
                <h4 class="${UI.h4}">Target Cpk</h4>
                <div class="flex gap-2">${seg('target', 1, '1.00')}${seg('target', 1.33, '1.33')}${seg('target', 1.67, '1.67')}</div>
            </div>
        </div>
        <div class="${UI.card}">
            <h4 class="${UI.h4}">Measurements</h4>
            <textarea id="ck-data" rows="7" class="${UI.input}" placeholder="Paste values: one per line, or separated by spaces, commas or tabs (e.g. a column copied from Excel)">${esc(state.raw)}</textarea>
            <p class="text-xs text-slate-500 mt-1">${values.length} values read${skipped ? `, ${skipped} ignored (not numbers)` : ''}.</p>
            <div class="flex gap-2 mt-2">
                <button id="ck-example" class="${UI.smallBtn}">LOAD EXAMPLE</button>
                <button id="ck-clear" class="${UI.smallBtn}">CLEAR</button>
            </div>
        </div>
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Before you trust the number</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>Use parts made in a row from a stable process: same machine, setup and material.</li>
                <li>Cp and Cpk assume a bell-shaped spread. Position, flatness and runout values bunch up near zero; treat their Cpk as a guide.</li>
                <li>The gauge must be good enough: its error should be small compared with the tolerance (check with a Gauge R&amp;R).</li>
            </ul>
        </div>`;
    const q = s => controlsRoot.querySelector(s);
    controlsRoot.querySelectorAll('[data-oneSided], [data-onesided]').forEach(b => b.onclick = () => { state.oneSided = b.dataset.onesided === 'true'; render(); renderControls(); });
    controlsRoot.querySelectorAll('[data-target]').forEach(b => b.onclick = () => { state.target = +b.dataset.target; render(); renderControls(); });
    q('#ck-lsl').oninput = e => { state.lsl = parseFloat(e.target.value); render(); };
    q('#ck-usl').oninput = e => { state.usl = parseFloat(e.target.value); render(); };
    const data = q('#ck-data');
    data.oninput = () => {
        state.raw = data.value;
        render();
        const { values: v, skipped: s } = parseValues(state.raw);
        data.nextElementSibling.textContent = `${v.length} values read${s ? `, ${s} ignored (not numbers)` : ''}.`;
    };
    q('#ck-example').onclick = () => { Object.assign(state, { raw: sampleData(), lsl: 9.95, usl: 10.05, oneSided: false }); render(); renderControls(); };
    q('#ck-clear').onclick = () => { state.raw = ''; render(); renderControls(); };
}
