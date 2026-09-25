// js/modules/manufacturing/process_capability.js
// What each process can realistically hold: enter a tolerance and see which
// processes do it routinely, which only with care, and which cannot; plus the
// surface finish each reaches and a rule-of-thumb cost multiplier.
// Values are typical shop figures for features about 25-100 mm in size, not
// guarantees: machines, materials and part size move them.

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText } from '../../theme.js';
import { UI } from '../drawing/sheet.js';

// lo = tightest with care, hi = routine (both ± mm); ra = typical Ra range (µm)
export const PROCESSES = [
    { name: 'Honing / lapping', lo: 0.001, hi: 0.005, ra: [0.05, 0.4] },
    { name: 'Grinding', lo: 0.002, hi: 0.01, ra: [0.1, 1.6] },
    { name: 'Wire EDM', lo: 0.003, hi: 0.01, ra: [0.4, 3.2] },
    { name: 'Reaming', lo: 0.005, hi: 0.025, ra: [0.4, 3.2] },
    { name: 'Boring', lo: 0.005, hi: 0.025, ra: [0.4, 6.3] },
    { name: 'CNC turning', lo: 0.01, hi: 0.05, ra: [0.4, 6.3] },
    { name: 'CNC milling', lo: 0.01, hi: 0.05, ra: [0.8, 6.3] },
    { name: 'Drilling (hole size)', lo: 0.05, hi: 0.15, ra: [1.6, 6.3] },
    { name: 'Die casting', lo: 0.05, hi: 0.25, ra: [0.8, 3.2] },
    { name: 'Investment casting', lo: 0.1, hi: 0.4, ra: [1.6, 3.2] },
    { name: 'Laser / waterjet cutting', lo: 0.1, hi: 0.25, ra: [1.6, 6.3] },
    { name: 'Sheet metal bending', lo: 0.2, hi: 0.5, ra: null },
    { name: 'Flame / plasma cutting', lo: 0.5, hi: 1.5, ra: [12.5, 25] },
    { name: 'Forging', lo: 0.4, hi: 1.5, ra: [3.2, 12.5] },
    { name: 'Sand casting', lo: 0.8, hi: 2.5, ra: [12.5, 25] }
];

// Rule-of-thumb relative cost vs ± tolerance (mm); ±0.8 = 1×
const COST = [[2.5, 0.9], [0.8, 1], [0.4, 1.2], [0.25, 1.5], [0.1, 2.2], [0.05, 3.2], [0.025, 5], [0.013, 8], [0.005, 15], [0.0025, 25], [0.001, 40]];

export function relativeCost(tolMM) {
    const L = Math.log;
    if (tolMM >= COST[0][0]) return COST[0][1];
    if (tolMM <= COST[COST.length - 1][0]) return COST[COST.length - 1][1];
    for (let i = 0; i < COST.length - 1; i++) {
        const [t1, c1] = COST[i], [t2, c2] = COST[i + 1];
        if (tolMM <= t1 && tolMM >= t2) {
            const f = (L(tolMM) - L(t1)) / (L(t2) - L(t1));
            return Math.exp(L(c1) + f * (L(c2) - L(c1)));
        }
    }
    return 1;
}

/** 'routine' | 'care' | 'no' for a ± tolerance in mm */
export function verdict(p, tolMM) {
    return tolMM >= p.hi - 1e-12 ? 'routine' : tolMM >= p.lo - 1e-12 ? 'care' : 'no';
}

const state = { units: 'mm', tol: 0.05, ra: null };
let svgRef = null, controlsRoot = null;

const toMM = v => (state.units === 'in' ? v * 25.4 : v);
const fmt = mm => (state.units === 'in' ? `±${(mm / 25.4).toFixed(mm / 25.4 < 0.001 ? 5 : 4)}"` : `±${mm < 0.01 ? mm.toFixed(3) : mm < 0.1 ? mm.toFixed(3) : mm.toFixed(2)} mm`);
const V = {
    routine: { label: 'Routine', color: COLORS.pass, tint: COLORS.passTint },
    care: { label: 'With care', color: '#b45309', tint: '#fef3c7' },
    no: { label: "Can't hold", color: COLORS.fail, tint: COLORS.failTint }
};

export function draw(svg) {
    svgRef = svg;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

// --------------------------------------------------------------------------

const AX = { x0: 250, x1: 845, min: 0.001, max: 3 };
const LX = mm => AX.x0 + (Math.log10(mm) - Math.log10(AX.min)) / (Math.log10(AX.max) - Math.log10(AX.min)) * (AX.x1 - AX.x0);

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);
    const tol = toMM(state.tol);
    const valid = tol > 0;

    svg.appendChild(text(`Which processes can hold ${valid ? fmt(tol) : '…'}?`, 30, 42, { size: 20, weight: 800, fill: COLORS.ink }));
    svg.appendChild(text('Each bar runs from the tightest a good shop holds with care (left end) to what it holds routinely (right end).', 30, 66, { size: 12.5, fill: COLORS.muted }));

    const top = 110, rowH = 30;
    // axis ticks (log scale)
    const ticks = state.units === 'in'
        ? [0.0001, 0.0005, 0.002, 0.01, 0.05].map(v => [v * 25.4, `±${v}"`])
        : [0.001, 0.005, 0.02, 0.1, 0.5, 2].map(v => [v, `±${v}`]);
    const bottom = top + PROCESSES.length * rowH;
    for (const [mm, label] of ticks) {
        if (mm < AX.min || mm > AX.max) continue;
        const x = LX(mm);
        svg.appendChild(createSVG('line', { x1: x, y1: top - 6, x2: x, y2: bottom, stroke: '#e2e8f0', 'stroke-width': 1 }));
        svg.appendChild(text(label, x, bottom + 18, { size: 11.5, fill: COLORS.muted, anchor: 'middle', mono: true }));
    }
    svg.appendChild(text(state.units === 'in' ? 'tolerance, inch (log scale) →  looser' : 'tolerance, mm (log scale) →  looser', AX.x1, bottom + 38, { size: 11.5, fill: COLORS.muted, anchor: 'end' }));

    PROCESSES.forEach((p, i) => {
        const y = top + i * rowH;
        const v = valid ? verdict(p, tol) : 'no';
        const raBad = state.ra != null && p.ra && p.ra[0] > state.ra;
        const g = createSVG('g', {});
        const tip = createSVG('title', {});
        tip.textContent = `${p.name}: ${fmt(p.lo)} with care, ${fmt(p.hi)} routine${p.ra ? `; Ra ${p.ra[0]}–${p.ra[1]} µm` : ''}`;
        g.appendChild(tip);
        g.appendChild(createSVG('rect', { x: 20, y: y - 2, width: 950, height: rowH - 4, fill: i % 2 ? '#f8fafc' : 'transparent', rx: 4 }));
        g.appendChild(text(p.name, AX.x0 - 12, y + 17, { size: 13.5, fill: COLORS.ink, anchor: 'end', weight: 600 }));
        g.appendChild(createSVG('rect', { x: LX(p.lo), y: y + 6, width: Math.max(4, LX(p.hi) - LX(p.lo)), height: 14, rx: 4, fill: V[v].color, opacity: 0.85 }));
        g.appendChild(createSVG('line', { x1: LX(p.hi), y1: y + 13, x2: AX.x1, y2: y + 13, stroke: V[v].color, 'stroke-width': 1.5, 'stroke-dasharray': '2 4', opacity: 0.5 }));
        // verdict tag, with a word so it is never colour alone
        g.appendChild(text(V[v].label + (raBad ? ' · finish' : ''), AX.x1 + 12, y + 17, { size: 12, weight: 700, fill: raBad ? COLORS.fail : V[v].color }));
        svg.appendChild(g);
    });

    if (valid) {
        const x = LX(Math.min(Math.max(tol, AX.min), AX.max));
        svg.appendChild(createSVG('line', { x1: x, y1: top - 14, x2: x, y2: bottom + 2, stroke: COLORS.ink, 'stroke-width': 2.5 }));
        svg.appendChild(text('your tolerance', x, top - 18, { size: 12, weight: 700, fill: COLORS.ink, anchor: 'middle' }));
    }
    drawSummary(svg, tol, valid);
}

function drawSummary(svg, tol, valid) {
    svg.appendChild(createSVG('rect', { x: 20, y: 640, width: 960, height: 145, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    svg.appendChild(text('IN PLAIN ENGLISH', 44, 668, { size: 12, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    if (!valid) { svg.appendChild(text('Enter a tolerance above zero.', 44, 695, { size: 15, fill: COLORS.text })); return; }
    const ok = PROCESSES.filter(p => verdict(p, tol) === 'routine' && !(state.ra != null && p.ra && p.ra[0] > state.ra)).map(p => p.name);
    const care = PROCESSES.filter(p => verdict(p, tol) === 'care').map(p => p.name);
    const cost = relativeCost(tol);
    let s = ok.length ? `${fmt(tol)} is routine for ${list(ok)}.` : `No process holds ${fmt(tol)} routinely.`;
    if (care.length) s += ` ${list(care)} can hold it with care (good machine, stable setup, in-process checks).`;
    if (state.ra != null) s += ` Finish Ra ${state.ra} µm or better rules out processes marked "finish".`;
    svg.appendChild(wrapText(s, 44, 694, 124, 20, { size: 14.5, fill: COLORS.text }));
    svg.appendChild(text(`Cost: about ${cost.toFixed(cost < 3 ? 1 : 0)}× a loose ${state.units === 'in' ? '±0.03"' : '±0.8 mm'} tolerance (rule of thumb).`, 44, 770, { size: 13.5, weight: 700, fill: cost > 5 ? COLORS.fail : cost > 2 ? '#b45309' : COLORS.pass }));
}

const list = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// --------------------------------------------------------------------------

function renderControls() {
    if (!controlsRoot) return;
    const seg = (v, label) => `<button data-units="${v}" class="${UI.segBtn} ${state.units === v ? UI.segOn : UI.segOff}">${label}</button>`;
    const presets = state.units === 'in' ? [0.03, 0.005, 0.001, 0.0002] : [0.5, 0.1, 0.025, 0.005];
    controlsRoot.innerHTML = `
        <div class="${UI.card} space-y-3">
            <div class="flex gap-2">${seg('mm', 'mm')}${seg('in', 'inch')}</div>
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">TOLERANCE (± EACH SIDE)</label>
                <input id="pc-tol" type="number" step="${state.units === 'in' ? 0.0001 : 0.001}" min="0" value="${state.tol}" class="${UI.input}">
                <div class="flex flex-wrap gap-1.5 mt-2">${presets.map(v => `<button data-preset="${v}" class="${UI.smallBtn}">±${v}</button>`).join('')}</div>
                <p class="text-xs text-slate-500 mt-1">For a total band (e.g. 25.00–25.05), enter half of it.</p>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">SURFACE FINISH NEEDED, Ra µm (OPTIONAL)</label>
                <input id="pc-ra" type="number" step="0.1" min="0" value="${state.ra ?? ''}" placeholder="e.g. 1.6" class="${UI.input}">
            </div>
        </div>
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Read these as a guide</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>Typical figures for features about 25–100 mm. Bigger parts, thin walls, hard or soft materials and heat all widen them.</li>
                <li>"With care" means the process can do it, but needs a good machine, a stable setup and checking. Expect more scrap and cost.</li>
                <li>Before accepting a tight tolerance, ask the shop for their Cpk on similar features.</li>
            </ul>
        </div>`;
    controlsRoot.querySelectorAll('[data-units]').forEach(b => b.onclick = () => {
        if (state.units === b.dataset.units) return;
        state.tol = b.dataset.units === 'in' ? +(state.tol / 25.4).toFixed(4) : +(state.tol * 25.4).toFixed(3);
        state.units = b.dataset.units;
        render(); renderControls();
    });
    controlsRoot.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { state.tol = +b.dataset.preset; render(); renderControls(); });
    controlsRoot.querySelector('#pc-tol').oninput = e => { state.tol = parseFloat(e.target.value) || 0; render(); };
    controlsRoot.querySelector('#pc-ra').oninput = e => { const v = parseFloat(e.target.value); state.ra = v > 0 ? v : null; render(); };
}
