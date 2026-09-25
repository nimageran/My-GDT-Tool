// js/modules/inspection/cmm_position.js
// CMM Position Calculator: measured X, Y and size per hole → position,
// bonus, allowed tolerance and pass/fail for each hole and the pattern.

import { createSVG, readTolerance } from '../../drawing_utils.js';
import { evaluatePosition, EPS } from '../../gdt_math.js';
import { COLORS, text, addDefs, featureControlFrame, resultsStrip } from '../../theme.js';

// --- STATE ---
const STORAGE_KEY = 'cmm_position_v1';

const EXAMPLE_HOLES = [
    { id: 'H1', bx: 1.000, by: 1.000, mx: 1.0060, my: 1.0110, dia: 0.5060 },
    { id: 'H2', bx: 3.000, by: 1.000, mx: 3.0140, my: 0.9930, dia: 0.5020 },
    { id: 'H3', bx: 3.000, by: 3.000, mx: 3.0190, my: 3.0120, dia: 0.5040 },
    { id: 'H4', bx: 1.000, by: 3.000, mx: 0.9950, my: 2.9910, dia: 0.5010 }
];

const DEFAULTS = {
    units: 'in',
    featureType: 'hole',
    modifier: 'MMC',
    tolerance: 0.030,
    nominal: 0.500, plusTol: 0.010, minusTol: 0.000,
    holes: EXAMPLE_HOLES
};

const state = loadState();

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && Array.isArray(saved.holes)) return { ...structuredClone(DEFAULTS), ...saved };
    } catch (e) { /* storage unavailable or corrupt: use defaults */ }
    return structuredClone(DEFAULTS);
}

function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// --- LAYOUT (px) ---
const PLOT = { x: 30, y: 30, w: 540, h: 560 };
const TABLE_X = 585;
const ZONE_PX = 38;            // Largest allowed zone radius drawn per hole
const MAX_ROWS = 18;

// --- DOM REFERENCES ---
let svgContainer = null;
let controlsContainer = null;
let pasteMessage = '';

// --- EXPORTED METHODS ---

export function draw(svg) {
    svgContainer = svg;
    renderScene();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// --- EVALUATION ---

const f4 = v => v.toFixed(4);
const u = () => state.units === 'mm' ? ' mm' : '"';

function evaluateAll() {
    return state.holes.map(h => ({
        hole: h,
        r: evaluatePosition({
            featureType: state.featureType, modifier: state.modifier, tolerance: state.tolerance,
            nominal: state.nominal, plusTol: state.plusTol, minusTol: state.minusTol,
            actualSize: h.dia, dx: h.mx - h.bx, dy: h.my - h.by
        })
    }));
}

// --- RENDERING ---

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    addDefs(svgContainer);

    const results = evaluateAll();
    if (results.length === 0) {
        svgContainer.appendChild(text('Add holes in the sidebar, or paste them from a CMM report.', 500, 320,
            { size: 18, fill: COLORS.muted, anchor: 'middle' }));
        return;
    }
    drawPlot(results);
    drawTable(results);
    drawResults(results);
}

function drawPlot(results) {
    const g = createSVG('g', {});

    // Layout scale: basic locations to scale, with the datum origin in view
    const xs = results.map(o => o.hole.bx).concat(0);
    const ys = results.map(o => o.hole.by).concat(0);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = ZONE_PX + 30;
    const spanX = Math.max(maxX - minX, 1e-6), spanY = Math.max(maxY - minY, 1e-6);
    const L = Math.min((PLOT.w - 2 * pad) / spanX, (PLOT.h - 2 * pad) / spanY);
    const ox = PLOT.x + pad + ((PLOT.w - 2 * pad) - spanX * L) / 2;
    const oy = PLOT.y + PLOT.h - pad - ((PLOT.h - 2 * pad) - spanY * L) / 2;
    const X = v => ox + (v - minX) * L;
    const Y = v => oy - (v - minY) * L;

    // Error magnification: largest allowed zone drawn ZONE_PX in radius
    const maxAllowed = Math.max(...results.map(o => o.r.allowed));
    const M = ZONE_PX / (maxAllowed / 2);

    // Datum lines through the origin
    const datum = { stroke: COLORS.ink, 'stroke-width': 1.5, 'stroke-dasharray': '14 4 3 4' };
    g.appendChild(createSVG('line', { x1: PLOT.x, y1: Y(0), x2: PLOT.x + PLOT.w, y2: Y(0), ...datum }));
    g.appendChild(createSVG('line', { x1: X(0), y1: PLOT.y, x2: X(0), y2: PLOT.y + PLOT.h, ...datum }));
    g.appendChild(text('datum C  (basic X = 0)', X(0) + 8, PLOT.y + 14, { size: 12, weight: 600, fill: COLORS.ink }));
    g.appendChild(text('datum B  (basic Y = 0)', PLOT.x + PLOT.w - 4, Y(0) - 8, { size: 12, weight: 600, fill: COLORS.ink, anchor: 'end' }));

    for (const { hole, r } of results) {
        const cx = X(hole.bx), cy = Y(hole.by);
        const Rs = (state.tolerance / 2) * M;
        const Ra = (r.allowed / 2) * M;

        // Allowed zone (bonus ring hatched) and stated zone
        if (Ra - Rs > 0.5) {
            g.appendChild(createSVG('circle', { cx, cy, r: Ra, fill: 'url(#thm-hatch-zone)', stroke: COLORS.zoneStroke, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }));
        }
        g.appendChild(createSVG('circle', { cx, cy, r: Rs, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }));

        // True position crosshair
        const ch = { stroke: COLORS.nominal, 'stroke-width': 1 };
        g.appendChild(createSVG('line', { x1: cx - Ra - 6, y1: cy, x2: cx + Ra + 6, y2: cy, ...ch }));
        g.appendChild(createSVG('line', { x1: cx, y1: cy - Ra - 6, x2: cx, y2: cy + Ra + 6, ...ch }));

        // Error vector (magnified), capped so a wild point stays on screen
        const color = r.pass ? COLORS.actual : COLORS.fail;
        let vx = (hole.mx - hole.bx) * M, vy = -(hole.my - hole.by) * M;
        const len = Math.hypot(vx, vy), cap = ZONE_PX * 2.2;
        const capped = len > cap;
        if (capped) { vx *= cap / len; vy *= cap / len; }
        g.appendChild(createSVG('line', { x1: cx, y1: cy, x2: cx + vx, y2: cy + vy, stroke: color, 'stroke-width': 2 }));
        g.appendChild(createSVG('circle', { cx: cx + vx, cy: cy + vy, r: 4.5, fill: color }));
        if (capped) g.appendChild(text('off scale', cx + vx + 6, cy + vy + 4, { size: 10.5, italic: true, fill: COLORS.fail }));

        // Labels
        g.appendChild(text(hole.id, cx - Ra - 8, cy - Ra - 4, { size: 13, weight: 700, fill: COLORS.ink, anchor: 'end' }));
        g.appendChild(text(`Ø${f4(r.position)}`, cx, cy + Ra + 20, { size: 11.5, weight: 600, mono: true, fill: color, anchor: 'middle' }));
    }

    g.appendChild(text('Inner dashed circle: stated zone · hatched ring: bonus · dot: measured axis',
        PLOT.x + PLOT.w / 2, PLOT.y + PLOT.h + 22, { size: 11.5, fill: COLORS.muted, anchor: 'middle' }));
    g.appendChild(text(`Hole locations to scale; errors and zones magnified ×${Math.round(M / L)} relative to the layout.`,
        PLOT.x + PLOT.w / 2, PLOT.y + PLOT.h + 40, { size: 11.5, italic: true, fill: COLORS.muted, anchor: 'middle' }));
    svgContainer.appendChild(g);
}

function drawTable(results) {
    const g = createSVG('g', {});
    const n = results.length;

    // The callout being checked
    const size = `${n}X Ø${state.nominal.toFixed(3)} +${state.plusTol.toFixed(3)}/−${state.minusTol.toFixed(3)}`;
    g.appendChild(text(size, TABLE_X, 36, { size: 14, weight: 600, mono: true, fill: COLORS.ink }));
    const fcf = featureControlFrame(TABLE_X, 46, {
        symbol: 'position', tolerance: state.tolerance.toFixed(3), diameter: true,
        modifier: { MMC: 'M', LMC: 'L', RFS: null }[state.modifier], datums: ['A', 'B', 'C']
    });
    g.appendChild(fcf.g);

    const passed = results.filter(o => o.r.pass).length;
    g.appendChild(text(`${n} holes · ${passed} pass · ${n - passed} fail`, TABLE_X, 112,
        { size: 14, weight: 700, fill: passed === n ? COLORS.pass : COLORS.fail }));

    // Header
    const cols = [
        { key: 'id', label: 'HOLE', x: TABLE_X, anchor: 'start' },
        { key: 'size', label: 'SIZE Ø', x: TABLE_X + 112, anchor: 'end' },
        { key: 'pos', label: 'POS Ø', x: TABLE_X + 184, anchor: 'end' },
        { key: 'bonus', label: 'BONUS', x: TABLE_X + 256, anchor: 'end' },
        { key: 'allowed', label: 'ALLOWED', x: TABLE_X + 338, anchor: 'end' },
        { key: 'result', label: '', x: TABLE_X + 382, anchor: 'middle' }
    ];
    const hy = 142;
    for (const c of cols) {
        g.appendChild(text(c.label, c.x, hy, { size: 10.5, weight: 700, fill: COLORS.muted, anchor: c.anchor, letterSpacing: '0.05em' }));
    }
    g.appendChild(createSVG('line', { x1: TABLE_X, y1: hy + 8, x2: TABLE_X + 395, y2: hy + 8, stroke: COLORS.cardBorder }));

    results.slice(0, MAX_ROWS).forEach(({ hole, r }, i) => {
        const y = hy + 30 + i * 25;
        if (i % 2 === 1) g.appendChild(createSVG('rect', { x: TABLE_X - 6, y: y - 17, width: 407, height: 25, fill: '#f8fafc' }));
        const cell = (str, col, opts = {}) =>
            g.appendChild(text(str, col.x, y, { size: 12.5, mono: col.key !== 'id', anchor: col.anchor, fill: COLORS.text, ...opts }));
        cell(hole.id, cols[0], { weight: 700 });
        cell(f4(hole.dia), cols[1], r.sizeOK ? {} : { fill: COLORS.fail, weight: 700 });
        cell(f4(r.position), cols[2], r.posOK ? {} : { fill: COLORS.fail, weight: 700 });
        cell(r.bonus > EPS ? f4(r.bonus) : '—', cols[3], { fill: r.bonus > EPS ? COLORS.zoneText : COLORS.muted });
        cell(f4(r.allowed), cols[4]);
        const pc = r.pass ? COLORS.pass : COLORS.fail;
        g.appendChild(createSVG('rect', { x: cols[5].x - 22, y: y - 13, width: 44, height: 17, rx: 8.5, fill: r.pass ? COLORS.passTint : COLORS.failTint }));
        g.appendChild(text(r.pass ? 'PASS' : 'FAIL', cols[5].x, y, { size: 10.5, weight: 800, fill: pc, anchor: 'middle' }));
    });
    if (n > MAX_ROWS) {
        g.appendChild(text(`+ ${n - MAX_ROWS} more: use "Copy results" for the full table`, TABLE_X, hy + 30 + MAX_ROWS * 25,
            { size: 12, italic: true, fill: COLORS.muted }));
    }
    svgContainer.appendChild(g);
}

function drawResults(results) {
    const n = results.length;
    const failed = results.filter(o => !o.r.pass);
    // Worst hole: highest share of its own allowance used
    const worst = results.reduce((a, b) => (b.r.position / b.r.allowed > a.r.position / a.r.allowed ? b : a));
    const needBonus = results.filter(o => o.r.pass && o.r.position > state.tolerance + EPS).length;
    const sizeFails = results.filter(o => !o.r.sizeOK).length;

    let sentence;
    if (failed.length === 0) {
        sentence = `All ${n} holes pass. Closest to its limit is ${worst.hole.id}: Ø${f4(worst.r.position)} of Ø${f4(worst.r.allowed)} allowed.`;
        if (needBonus) sentence += ` ${needBonus} ${needBonus === 1 ? 'hole passes' : 'holes pass'} only thanks to bonus.`;
    } else {
        const list = failed.slice(0, 3).map(o => o.hole.id).join(', ') + (failed.length > 3 ? '…' : '');
        sentence = `${failed.length} of ${n} holes fail (${list}). Worst is ${worst.hole.id}: Ø${f4(worst.r.position)} against Ø${f4(worst.r.allowed)} allowed.`;
        if (sizeFails) sentence += ` ${sizeFails} out of size.`;
        sentence += ' The zones are locked to datums B and C, so every hole must pass on its own.';
    }

    svgContainer.appendChild(resultsStrip({
        pass: failed.length === 0,
        measured: { label: `Worst: ${worst.hole.id}`, value: worst.r.position },
        allowed: { label: 'Its allowed', value: worst.r.allowed },
        unit: u(),
        sentence,
        compact: true
    }));
}

// --- DATA IMPORT / EXPORT ---

// Accepts lines of: [id] basicX basicY measX measY dia
// separated by commas, tabs, semicolons or spaces. Header lines are skipped.
function parsePasted(raw) {
    const holes = [];
    let skipped = 0;
    for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        const parts = t.split(/[,\t;]+|\s{1,}/).filter(Boolean);
        let id = null, nums = parts;
        if (parts.length >= 6 && !Number.isFinite(Number(parts[0]))) { id = parts[0]; nums = parts.slice(1); }
        const v = nums.slice(0, 5).map(Number);
        if (v.length < 5 || v.some(x => !Number.isFinite(x))) { skipped++; continue; }
        holes.push({ id: id ?? `H${holes.length + 1}`, bx: v[0], by: v[1], mx: v[2], my: v[3], dia: v[4] });
    }
    return { holes, skipped };
}

function resultsCSV() {
    const rows = [['hole', 'basic_x', 'basic_y', 'meas_x', 'meas_y', 'size', 'position', 'bonus', 'allowed', 'size_ok', 'result']];
    for (const { hole, r } of evaluateAll()) {
        rows.push([hole.id, hole.bx, hole.by, hole.mx, hole.my, hole.dia,
            f4(r.position), f4(r.bonus), f4(r.allowed), r.sizeOK ? 'yes' : 'no', r.pass ? 'PASS' : 'FAIL']);
    }
    return rows.map(r => r.join(',')).join('\n');
}

// --- CONTROLS UI ---

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';
const numInput = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';
const cellInput = 'w-full px-1 py-1 border border-slate-200 rounded font-mono text-[11px] text-right focus:ring-1 focus:ring-blue-500';
const smallBtn = 'text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold';

function renderControls() {
    if (!controlsContainer) return;
    const seg = (attr, key, value, label) =>
        `<button data-${attr}="${value}" class="${segBtn} ${state[key] === value ? segOn : segOff}">${label}</button>`;

    const rows = state.holes.map((h, i) => `
        <tr>
            <td class="pr-0.5 w-10"><input data-row="${i}" data-field="id" type="text" value="${h.id}" class="${cellInput} !text-left font-bold"></td>
            ${['bx', 'by', 'mx', 'my', 'dia'].map(f =>
                `<td class="px-0.5"><input data-row="${i}" data-field="${f}" type="text" inputmode="decimal" value="${h[f]}" class="${cellInput}"></td>`).join('')}
            <td class="pl-1"><button data-del="${i}" class="text-slate-400 hover:text-red-600" title="Remove"><i class="fa-solid fa-xmark"></i></button></td>
        </tr>`).join('');

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Callout on the drawing</h4>
            <div class="flex items-center gap-2 mb-3">
                <label class="text-sm font-semibold text-slate-700 w-32 shrink-0">Position Ø</label>
                <input type="number" id="cmm-tol" value="${state.tolerance}" step="0.001" min="0.001" class="${numInput} bg-yellow-50">
            </div>
            <div class="flex gap-2 mb-3">${seg('mod', 'modifier', 'RFS', 'RFS')}${seg('mod', 'modifier', 'MMC', 'MMC Ⓜ')}${seg('mod', 'modifier', 'LMC', 'LMC Ⓛ')}</div>
            <div class="flex gap-2 mb-3">${seg('type', 'featureType', 'hole', 'Holes')}${seg('type', 'featureType', 'pin', 'Pins / bosses')}</div>
            <div class="grid grid-cols-3 gap-2">
                <div><label class="block text-xs font-bold text-slate-500 mb-1">SIZE Ø</label>
                    <input type="number" id="cmm-nom" step="0.001" value="${state.nominal}" class="${numInput}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">+ TOL</label>
                    <input type="number" id="cmm-plus" step="0.001" min="0" value="${state.plusTol}" class="${numInput}"></div>
                <div><label class="block text-xs font-bold text-slate-500 mb-1">− TOL</label>
                    <input type="number" id="cmm-minus" step="0.001" min="0" value="${state.minusTol}" class="${numInput}"></div>
            </div>
            <div class="flex items-center justify-between mt-3">
                <span class="text-xs font-bold text-slate-500">UNITS</span>
                <div class="flex gap-2 w-40">${seg('units', 'units', 'in', 'inch')}${seg('units', 'units', 'mm', 'mm')}</div>
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-1">Measured holes</h4>
            <p class="text-xs text-slate-400 mb-2">Basic X from datum C, basic Y from datum B.</p>
            <table class="w-full">
                <thead><tr class="text-[10px] font-bold text-slate-500">
                    <th class="text-left">ID</th><th>BASIC X</th><th>BASIC Y</th><th>MEAS X</th><th>MEAS Y</th><th>SIZE Ø</th><th></th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="flex gap-2 mt-3">
                <button id="cmm-add" class="flex-1 ${smallBtn}"><i class="fa-solid fa-plus"></i> ADD HOLE</button>
                <button id="cmm-example" class="flex-1 ${smallBtn}">LOAD EXAMPLE</button>
                <button id="cmm-clear" class="flex-1 ${smallBtn}">CLEAR</button>
            </div>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-1">Paste from a CMM report or Excel</h4>
            <p class="text-xs text-slate-400 mb-2">One hole per line: <span class="font-mono">ID, basic X, basic Y, meas X, meas Y, size</span>. The ID is optional; header lines are skipped.</p>
            <textarea id="cmm-paste" rows="4" class="w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-xs" placeholder="H1  1.000  1.000  1.0060  1.0110  0.5060"></textarea>
            <button id="cmm-import" class="mt-2 w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 font-bold text-sm">REPLACE TABLE WITH PASTED DATA</button>
            ${pasteMessage ? `<p class="text-xs mt-2 ${pasteMessage.startsWith('Loaded') ? 'text-green-700' : 'text-red-600'}">${pasteMessage}</p>` : ''}
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <button id="cmm-copy" class="w-full ${smallBtn} py-2"><i class="fa-solid fa-copy"></i> COPY RESULTS (CSV)</button>
            <p id="cmm-copy-msg" class="text-xs text-slate-400 mt-2 hidden">Copied. Paste into Excel or a report.</p>
        </div>

        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Reading CMM reports</div>
            <ul class="text-xs leading-relaxed list-disc pl-4 space-y-1">
                <li>Position is the <b>diameter</b>: 2 × the radial offset. Some reports print the radial value; double it before comparing.</li>
                <li>Use the actual mating size for bonus, not a single two-point diameter.</li>
                <li>Check the report's alignment matches the frame: A primary, then B, then C.</li>
                <li>Datum shift (datums at MMB) is not included here.</li>
            </ul>
        </div>
    `;
    bindControlEvents();
}

function changed({ controls = false } = {}) {
    saveState();
    if (controls) renderControls();
    renderScene();
}

function bindControlEvents() {
    const $ = id => document.getElementById(id);
    const c = controlsContainer;

    $('cmm-tol').onchange = e => { state.tolerance = readTolerance(e.target.value); changed(); };
    c.querySelectorAll('[data-mod]').forEach(b => { b.onclick = () => { state.modifier = b.dataset.mod; changed({ controls: true }); }; });
    c.querySelectorAll('[data-type]').forEach(b => { b.onclick = () => { state.featureType = b.dataset.type; changed({ controls: true }); }; });
    c.querySelectorAll('[data-units]').forEach(b => { b.onclick = () => { state.units = b.dataset.units; changed({ controls: true }); }; });

    const limit = (id, key, allowZero) => {
        $(id).onchange = e => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && (allowZero ? v >= 0 : v > 0)) state[key] = v;
            changed({ controls: true });
        };
    };
    limit('cmm-nom', 'nominal', false);
    limit('cmm-plus', 'plusTol', true);
    limit('cmm-minus', 'minusTol', true);

    c.querySelectorAll('[data-row]').forEach(inp => {
        inp.onchange = () => {
            const h = state.holes[+inp.dataset.row];
            const f = inp.dataset.field;
            if (f === 'id') h.id = inp.value.trim() || h.id;
            else {
                const v = parseFloat(inp.value);
                if (Number.isFinite(v)) h[f] = v; else inp.value = h[f];
            }
            changed();
        };
    });
    c.querySelectorAll('[data-del]').forEach(b => {
        b.onclick = () => { state.holes.splice(+b.dataset.del, 1); changed({ controls: true }); };
    });

    $('cmm-add').onclick = () => {
        const last = state.holes[state.holes.length - 1];
        const next = last ? { ...last, id: `H${state.holes.length + 1}`, bx: last.bx + 1, mx: last.bx + 1 } :
            { id: 'H1', bx: 1, by: 1, mx: 1, my: 1, dia: state.nominal };
        state.holes.push(next);
        changed({ controls: true });
    };
    $('cmm-example').onclick = () => { Object.assign(state, structuredClone(DEFAULTS)); pasteMessage = ''; changed({ controls: true }); };
    $('cmm-clear').onclick = () => { state.holes = []; changed({ controls: true }); };

    $('cmm-import').onclick = () => {
        const { holes, skipped } = parsePasted($('cmm-paste').value);
        if (holes.length === 0) {
            pasteMessage = 'No rows recognised. Each line needs basic X, basic Y, meas X, meas Y and size.';
        } else {
            state.holes = holes;
            pasteMessage = `Loaded ${holes.length} holes${skipped ? `, skipped ${skipped} line(s)` : ''}.`;
        }
        changed({ controls: true });
    };

    $('cmm-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(resultsCSV());
            $('cmm-copy-msg').classList.remove('hidden');
        } catch (e) {
            $('cmm-copy-msg').textContent = 'Copy failed: your browser blocked clipboard access.';
            $('cmm-copy-msg').classList.remove('hidden');
        }
    };
}
