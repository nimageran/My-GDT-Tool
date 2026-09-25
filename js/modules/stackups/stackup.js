// js/modules/stackups/stackup.js
// 1D tolerance stack-up: worst case and RSS (statistical) for a gap,
// with GD&T contributors (position, profile) converted to ± values.

import { createSVG } from '../../drawing_utils.js';
import { EPS } from '../../gdt_math.js';
import { COLORS, text, wrapText, addDefs, resultsStrip } from '../../theme.js';
import { syncUnits, step } from '../../units.js';

const UNITS = { native: 'mm', lengths: ['minGap', 'maxGap'],
    custom: (s, conv) => { s.rows = s.rows.map(r => ({ ...r, nominal: conv(r.nominal), plus: conv(r.plus), minus: conv(r.minus) })); } };

const STORAGE_KEY = 'stackup_v1';

// type: 'dim' (nominal +tol/−tol), 'pos' (position Ø zone → ± zone/2), 'profile' (zone → ± zone/2)
const EXAMPLE = [
    { name: 'Housing bore depth', dir: 1, type: 'dim', nominal: 20.00, plus: 0.10, minus: 0.10 },
    { name: 'Spacer width', dir: -1, type: 'dim', nominal: 8.00, plus: 0.05, minus: 0.05 },
    { name: 'Bearing width', dir: -1, type: 'dim', nominal: 10.00, plus: 0.00, minus: 0.12 },
    { name: 'Cover lip height', dir: -1, type: 'dim', nominal: 1.80, plus: 0.05, minus: 0.05 },
    { name: 'Housing face profile', dir: 1, type: 'profile', nominal: 0, plus: 0.10, minus: 0 }
];

const DEFAULTS = {
    units: 'mm',
    method: 'rss',           // which method decides pass/fail
    gapName: 'Axial gap under the cover',
    minGap: 0.05,
    maxGap: 0.45,            // null = no upper limit
    rows: EXAMPLE
};

const state = loadState();

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && Array.isArray(saved.rows)) return { ...structuredClone(DEFAULTS), ...saved };
    } catch (e) { /* storage unavailable or corrupt */ }
    return structuredClone(DEFAULTS);
}
function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// --- LAYOUT ---
const LINE = { x: 40, w: 520 };
const PANEL_X = 600;

let svgContainer = null;
let controlsContainer = null;

export function draw(svg) {
    if (syncUnits(state, UNITS)) saveState();
    svgContainer = svg;
    renderScene();
}

export function loadControls(container) {
    if (syncUnits(state, UNITS)) saveState();
    controlsContainer = container;
    renderControls();
}

// --- MATH ---

const fmt = v => v.toFixed(state.units === 'mm' ? 3 : 4);
const u = () => (state.units === 'mm' ? ' mm' : '"');
const signed = v => (v < 0 ? '−' : '+') + fmt(Math.abs(v));

// Each row as a centered mean ± half tolerance
function contributor(r) {
    if (r.type === 'dim') {
        const upper = r.nominal + r.plus, lower = r.nominal - r.minus;
        return { mean: (upper + lower) / 2, t: (upper - lower) / 2 };
    }
    return { mean: r.nominal, t: r.plus / 2 };        // GD&T zone → equal bilateral ±zone/2
}

function evaluate() {
    const items = state.rows.map(r => ({ row: r, ...contributor(r) }));
    const nominal = state.rows.reduce((s, r) => s + r.dir * r.nominal, 0);
    const mean = items.reduce((s, c) => s + c.row.dir * c.mean, 0);
    const wcT = items.reduce((s, c) => s + c.t, 0);
    const rssT = Math.sqrt(items.reduce((s, c) => s + c.t * c.t, 0));
    const range = t => ({ min: mean - t, max: mean + t });
    const check = ({ min, max }) => min >= state.minGap - EPS && (state.maxGap == null || max <= state.maxGap + EPS);
    const wc = range(wcT), rss = range(rssT);
    return {
        items, nominal, mean, wcT, rssT, wc, rss,
        wcPass: check(wc), rssPass: check(rss),
        pass: state.method === 'wc' ? check(wc) : check(rss)
    };
}

// --- RENDERING ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    addDefs(svgContainer);
    if (state.rows.length === 0) {
        svgContainer.appendChild(text('Add the dimensions around the loop in the sidebar.', 500, 320, { size: 18, fill: COLORS.muted, anchor: 'middle' }));
        return;
    }
    const r = evaluate();
    drawNumberLine(r);
    drawContributors(r);
    drawPanel(r);
    drawResults(r);
}

function title(str, x, y) {
    return text(str, x, y, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' });
}

function drawNumberLine(r) {
    const g = createSVG('g', {});
    g.appendChild(title(`PREDICTED ${state.gapName.toUpperCase()}`, LINE.x, 36));

    // Scale covering both ranges and the requirement
    const vals = [r.wc.min, r.wc.max, state.minGap, state.maxGap ?? r.wc.max];
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || 0.1;
    const X = v => LINE.x + ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * LINE.w;

    const axisY = 262;
    // Allowed window (requirement)
    const winL = X(state.minGap), winR = state.maxGap == null ? LINE.x + LINE.w : X(state.maxGap);
    g.appendChild(createSVG('rect', { x: winL, y: 60, width: winR - winL, height: axisY - 60, fill: COLORS.zoneFill }));
    for (const [v, label] of [[state.minGap, 'min'], [state.maxGap, 'max']]) {
        if (v == null) continue;
        g.appendChild(createSVG('line', { x1: X(v), y1: 56, x2: X(v), y2: axisY + 6, stroke: COLORS.zoneStroke, 'stroke-width': 2, 'stroke-dasharray': '8 5' }));
        g.appendChild(text(`${label} ${fmt(v)}`, X(v), 52, { size: 12, weight: 700, mono: true, fill: COLORS.zoneText, anchor: 'middle' }));
    }
    g.appendChild(text('required', (winL + winR) / 2, 74, { size: 11, italic: true, fill: COLORS.zoneText, anchor: 'middle' }));

    // Axis with ticks
    g.appendChild(createSVG('line', { x1: LINE.x, y1: axisY, x2: LINE.x + LINE.w, y2: axisY, stroke: COLORS.ink, 'stroke-width': 1.5 }));
    const step = niceStep((hi + pad) - (lo - pad));
    for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) {
        g.appendChild(createSVG('line', { x1: X(v), y1: axisY, x2: X(v), y2: axisY + 6, stroke: COLORS.ink }));
        g.appendChild(text(fmt(Math.abs(v) < step / 1e6 ? 0 : v), X(v), axisY + 20, { size: 11, mono: true, fill: COLORS.muted, anchor: 'middle' }));
    }
    if (lo - pad < 0 && hi + pad > 0) {
        g.appendChild(createSVG('line', { x1: X(0), y1: 90, x2: X(0), y2: axisY, stroke: COLORS.fail, 'stroke-width': 1, 'stroke-dasharray': '2 3' }));
        g.appendChild(text('0 = parts touch', X(0) + 4, 100, { size: 10.5, fill: COLORS.fail }));
    }

    // RSS bell curve (±3σ = RSS range)
    const sigma = r.rssT / 3;
    if (sigma > 0) {
        let d = '';
        for (let i = 0; i <= 80; i++) {
            const v = r.mean - 4 * sigma + (8 * sigma * i) / 80;
            const y = 180 - 80 * Math.exp(-0.5 * ((v - r.mean) / sigma) ** 2);
            d += `${i ? 'L' : 'M'} ${X(v)},${y} `;
        }
        g.appendChild(createSVG('path', { d, fill: 'none', stroke: r.rssPass ? COLORS.pass : COLORS.fail, 'stroke-width': 2, opacity: 0.7 }));
    }

    // Range bars
    const bar = (range, y, label, pass, emphasis) => {
        const color = pass ? COLORS.pass : COLORS.fail;
        g.appendChild(createSVG('line', { x1: X(range.min), y1: y, x2: X(range.max), y2: y, stroke: color, 'stroke-width': emphasis ? 8 : 5, 'stroke-linecap': 'round', opacity: emphasis ? 1 : 0.55 }));
        g.appendChild(text(`${label}  ${fmt(range.min)} … ${fmt(range.max)}`, Math.max(X(range.min), LINE.x), y - 9,
            { size: 11.5, weight: 700, mono: true, fill: color }));
    };
    bar(r.rss, 208, 'RSS', r.rssPass, state.method === 'rss');
    bar(r.wc, 242, 'WORST CASE', r.wcPass, state.method === 'wc');

    // Nominal gap
    g.appendChild(createSVG('path', { d: `M ${X(r.nominal)},${axisY + 26} l -6,10 l 12,0 Z`, fill: COLORS.ink }));
    g.appendChild(text(`nominal ${fmt(r.nominal)}`, X(r.nominal), axisY + 50, { size: 11.5, weight: 600, fill: COLORS.ink, anchor: 'middle' }));
    svgContainer.appendChild(g);
}

function niceStep(span) {
    const raw = span / 6;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw);
}

function drawContributors(r) {
    const g = createSVG('g', {});
    const top = 350;
    g.appendChild(title('CONTRIBUTORS (WHICH TOLERANCE DRIVES THE RESULT)', LINE.x, top));

    const wcSum = r.wcT || 1, rssSum = r.rssT ** 2 || 1;
    const maxShare = Math.max(...r.items.map(c => (state.method === 'wc' ? c.t / wcSum : c.t * c.t / rssSum)));
    const rowH = Math.min(30, 250 / r.items.length);
    const barX = LINE.x + 300, barW = 170;

    r.items.forEach((c, i) => {
        const y = top + 30 + i * rowH;
        const share = state.method === 'wc' ? c.t / wcSum : (c.t * c.t) / rssSum;
        const top1 = share >= maxShare - EPS;
        // Direction pill
        g.appendChild(createSVG('rect', { x: LINE.x, y: y - 13, width: 20, height: 17, rx: 4, fill: c.row.dir > 0 ? '#dbeafe' : '#f1f5f9' }));
        g.appendChild(text(c.row.dir > 0 ? '+' : '−', LINE.x + 10, y, { size: 13, weight: 800, anchor: 'middle', fill: COLORS.ink }));
        const name = c.row.name.length > 18 ? c.row.name.slice(0, 17) + '…' : c.row.name;
        g.appendChild(text(name, LINE.x + 28, y, { size: 12.5, weight: top1 ? 700 : 400, fill: COLORS.text }));
        const tag = c.row.type === 'dim' ? '' : c.row.type === 'pos' ? ' Ø pos' : ' profile';
        g.appendChild(text(`±${fmt(c.t)}${tag}`, barX - 10, y, { size: 11.5, mono: true, fill: COLORS.muted, anchor: 'end' }));
        g.appendChild(createSVG('rect', { x: barX, y: y - 11, width: barW, height: 12, rx: 3, fill: '#f1f5f9' }));
        g.appendChild(createSVG('rect', { x: barX, y: y - 11, width: Math.max(barW * share, 1), height: 12, rx: 3, fill: top1 ? COLORS.zoneStroke : '#93c5fd' }));
        g.appendChild(text(`${Math.round(share * 100)}%`, barX + barW + 8, y, { size: 11.5, weight: 700, mono: true, fill: top1 ? COLORS.zoneText : COLORS.muted }));
    });
    g.appendChild(text(state.method === 'wc' ? 'Share of the worst-case tolerance (t / Σt)' : 'Share of the RSS variance (t² / Σt²)',
        LINE.x, top + 30 + r.items.length * rowH + 8, { size: 11, italic: true, fill: COLORS.muted }));
    svgContainer.appendChild(g);
}

function drawPanel(r) {
    const g = createSVG('g', {});
    let y = 36;
    g.appendChild(title('1. NOMINAL GAP (WALK THE LOOP)', PANEL_X, y));
    const terms = state.rows.map((row, i) => `${i === 0 && row.dir > 0 ? '' : row.dir > 0 ? '+ ' : '− '}${fmt(row.nominal)}`).join(' ');
    const sum = `${terms} = ${fmt(r.nominal)}`;
    const block = wrapText(sum, PANEL_X, y + 24, 38, 18, { size: 13, mono: true, fill: COLORS.ink });
    g.appendChild(block);
    y += 24 + 18 * block.childNodes.length;
    if (Math.abs(r.mean - r.nominal) > EPS) {
        g.appendChild(text(`mean with unequal tolerances: ${fmt(r.mean)}`, PANEL_X, y, { size: 12, fill: COLORS.muted }));
        y += 20;
    }

    y += 10;
    g.appendChild(title('2. WORST CASE: ± Σ t', PANEL_X, y));
    g.appendChild(text(`±${fmt(r.wcT)}  →  ${fmt(r.wc.min)} … ${fmt(r.wc.max)}`, PANEL_X, y + 24, { size: 14, weight: 700, mono: true, fill: r.wcPass ? COLORS.pass : COLORS.fail }));
    g.appendChild(wrapText('Every part at its worst limit at once. Guaranteed, but pessimistic.', PANEL_X, y + 46, 50, 17, { size: 12.5, fill: COLORS.text }));

    y += 86;
    g.appendChild(title('3. RSS (STATISTICAL): ± √Σ t²', PANEL_X, y));
    g.appendChild(text(`±${fmt(r.rssT)}  →  ${fmt(r.rss.min)} … ${fmt(r.rss.max)}`, PANEL_X, y + 24, { size: 14, weight: 700, mono: true, fill: r.rssPass ? COLORS.pass : COLORS.fail }));
    g.appendChild(wrapText('About 99.73% of assemblies if each process is centered, normal and independent (±3σ = the tolerance). Fewer parts per stack makes it less reliable.',
        PANEL_X, y + 46, 50, 17, { size: 12.5, fill: COLORS.text }));

    y += 122;
    g.appendChild(title('4. BIGGEST LEVER', PANEL_X, y));
    const pick = state.method === 'wc' ? (c => c.t) : (c => c.t * c.t);
    const top = r.items.reduce((a, b) => (pick(b) > pick(a) ? b : a));
    g.appendChild(wrapText(`${top.row.name} (±${fmt(top.t)}). Tightening it moves the result most; tightening the small contributors barely helps.`,
        PANEL_X, y + 24, 50, 17, { size: 12.5, fill: COLORS.text }));
    svgContainer.appendChild(g);
}

function drawResults(r) {
    const range = state.method === 'wc' ? r.wc : r.rss;
    const req = state.maxGap == null ? `≥ ${fmt(state.minGap)}` : `${fmt(state.minGap)}…${fmt(state.maxGap)}`;
    const method = state.method === 'wc' ? 'worst case' : 'RSS';
    let sentence;
    if (r.pass) {
        sentence = `By ${method}, the gap stays between ${fmt(range.min)} and ${fmt(range.max)}, inside the required ${req}.`;
    } else {
        const low = range.min < state.minGap - EPS, high = state.maxGap != null && range.max > state.maxGap + EPS;
        sentence = `By ${method}, the gap can reach ${low ? fmt(range.min) : fmt(range.max)}, ${low ? 'below the minimum' : 'above the maximum'} of ${fmt(low ? state.minGap : state.maxGap)}${low && high ? ', and it breaks the maximum too' : ''}.`;
    }
    if (r.wcPass !== r.rssPass) {
        sentence += r.rssPass
            ? ' Worst case fails while RSS passes: acceptable only if the processes are capable and centered.'
            : ' RSS fails even though worst case passes: check your inputs.';
    }
    svgContainer.appendChild(resultsStrip({
        pass: r.pass,
        measured: { label: `Predicted (${state.method === 'wc' ? 'WC' : 'RSS'})`, value: range.min, text: `${fmt(range.min)}…${fmt(range.max)}` },
        allowed: { label: 'Required', value: state.minGap, text: req },
        gauge: false,
        sentence,
        compact: true
    }));
}

// --- CONTROLS ---

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const numInput = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const cell = 'w-full px-1 py-1 border border-slate-200 rounded font-mono text-[11px] text-right focus:ring-1 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold';

function renderControls() {
    if (!controlsContainer) return;
    const seg = (attr, key, value, label) =>
        `<button data-${attr}="${value}" class="${segBtn} ${state[key] === value ? segOn : segOff}">${label}</button>`;

    const rows = state.rows.map((r, i) => {
        const gdt = r.type !== 'dim';
        return `
        <div class="border border-slate-200 rounded p-2 space-y-1.5">
            <div class="flex gap-1.5 items-center">
                <button data-flip="${i}" class="w-7 h-7 shrink-0 rounded font-extrabold ${r.dir > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}" title="Direction around the loop">${r.dir > 0 ? '+' : '−'}</button>
                <input data-row="${i}" data-field="name" type="text" value="${r.name.replace(/"/g, '&quot;')}" class="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded text-xs">
                <select data-row="${i}" data-field="type" class="px-1 py-1 border border-slate-200 rounded text-[11px]">
                    <option value="dim" ${r.type === 'dim' ? 'selected' : ''}>± dim</option>
                    <option value="pos" ${r.type === 'pos' ? 'selected' : ''}>Ø position</option>
                    <option value="profile" ${r.type === 'profile' ? 'selected' : ''}>profile</option>
                </select>
                <button data-del="${i}" class="text-slate-400 hover:text-red-600 px-1" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-[10px] font-bold text-slate-500">
                <label>NOMINAL<input data-row="${i}" data-field="nominal" type="text" inputmode="decimal" value="${r.nominal}" class="${cell}"></label>
                <label>${gdt ? 'ZONE' : '+ TOL'}<input data-row="${i}" data-field="plus" type="text" inputmode="decimal" value="${r.plus}" class="${cell}"></label>
                <label class="${gdt ? 'opacity-30' : ''}">− TOL<input data-row="${i}" data-field="minus" type="text" inputmode="decimal" value="${r.minus}" class="${cell}" ${gdt ? 'disabled' : ''}></label>
            </div>
        </div>`;
    }).join('');

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Requirement</h4>
            <label class="block text-xs font-bold text-slate-500 mb-1">WHAT IS BEING STACKED</label>
            <input id="su-name" type="text" value="${state.gapName.replace(/"/g, '&quot;')}" class="${numInput} font-sans mb-3">
            <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">MIN GAP</label>
                    <input id="su-min" type="number" step="${step()}" value="${state.minGap}" class="${numInput}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">MAX GAP (blank = none)</label>
                    <input id="su-max" type="number" step="${step()}" value="${state.maxGap ?? ''}" class="${numInput}"></div>
            </div>
            <div class="text-xs font-bold text-slate-500 mt-3 mb-1">PASS / FAIL DECIDED BY</div>
            <div class="flex gap-2">${seg('method', 'method', 'wc', 'Worst case')}${seg('method', 'method', 'rss', 'RSS (statistical)')}</div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-1">The loop</h4>
            <p class="text-xs text-slate-400 mb-2">Start at one side of the gap and walk through each part to the other side. <b>+</b> = moving the same way as the gap, <b>−</b> = back. GD&T zones count as ± half the zone.</p>
            <div class="space-y-2">${rows}</div>
            <div class="flex gap-2 mt-3">
                <button id="su-add" class="flex-1 ${smallBtn}"><i class="fa-solid fa-plus"></i> ADD</button>
                <button id="su-example" class="flex-1 ${smallBtn}">LOAD EXAMPLE</button>
                <button id="su-clear" class="flex-1 ${smallBtn}">CLEAR</button>
            </div>
        </div>

        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Common mistakes</div>
            <ul class="text-xs leading-relaxed list-disc pl-4 space-y-1">
                <li>Leaving out GD&T: position, profile or flatness on a mating face adds to the stack.</li>
                <li>Counting a dimension twice, or using one that isn't in the loop.</li>
                <li>Using RSS with only 2–3 contributors, or with parts from an off-center process.</li>
                <li>Unequal tolerances (e.g. +0/−0.12) shift the mean; the tool centers them for you.</li>
            </ul>
        </div>`;
    bind();
}

function changed(controls = false) {
    saveState();
    if (controls) renderControls();
    renderScene();
}

function bind() {
    const $ = id => document.getElementById(id);
    const c = controlsContainer;
    c.querySelectorAll('[data-method]').forEach(b => b.onclick = () => { state.method = b.dataset.method; changed(true); });
    $('su-name').onchange = e => { state.gapName = e.target.value.trim() || 'Gap'; changed(); };
    $('su-min').onchange = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) state.minGap = v; changed(true); };
    $('su-max').onchange = e => { const v = parseFloat(e.target.value); state.maxGap = Number.isFinite(v) ? v : null; changed(true); };

    c.querySelectorAll('[data-row]').forEach(inp => {
        inp.onchange = () => {
            const row = state.rows[+inp.dataset.row];
            const f = inp.dataset.field;
            if (f === 'name') row.name = inp.value.trim() || row.name;
            else if (f === 'type') { row.type = inp.value; if (row.type !== 'dim') row.minus = 0; changed(true); return; }
            else {
                const v = parseFloat(inp.value);
                if (Number.isFinite(v) && (f === 'nominal' || v >= 0)) row[f] = v; else inp.value = row[f];
            }
            changed();
        };
    });
    c.querySelectorAll('[data-flip]').forEach(b => b.onclick = () => { const r = state.rows[+b.dataset.flip]; r.dir = -r.dir; changed(true); });
    c.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { state.rows.splice(+b.dataset.del, 1); changed(true); });
    $('su-add').onclick = () => { state.rows.push({ name: `Part ${state.rows.length + 1}`, dir: -1, type: 'dim', nominal: 1, plus: 0.05, minus: 0.05 }); changed(true); };
    $('su-example').onclick = () => { Object.assign(state, structuredClone(DEFAULTS)); changed(true); };
    $('su-clear').onclick = () => { state.rows = []; changed(true); };
}
