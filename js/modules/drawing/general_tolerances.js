// js/modules/drawing/general_tolerances.js
// General tolerances: the tolerance a dimension gets when none is written next
// to it. Two sources: the company's title block (decimal places decide) or
// ISO 2768-1 (a table by size range and class f / m / c / v).
// HTML beside the (hidden) canvas, like the glossary.

import { UI, esc } from './sheet.js';

// ISO 2768-1 linear dimensions (mm). null = not specified for that class.
export const ISO_LINEAR = {
    ranges: [[0.5, 3], [3, 6], [6, 30], [30, 120], [120, 400], [400, 1000], [1000, 2000], [2000, 4000]],
    f: [0.05, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, null],
    m: [0.1, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 2],
    c: [0.2, 0.3, 0.5, 0.8, 1.2, 2, 3, 4],
    v: [null, 0.5, 1, 1.5, 2.5, 4, 6, 8]
};
// Angles, by the length of the SHORTER side of the angle (mm)
export const ISO_ANGULAR = {
    ranges: [[0, 10], [10, 50], [50, 120], [120, 400], [400, Infinity]],
    f: ['±1°', '±0°30\'', '±0°20\'', '±0°10\'', '±0°5\''],
    m: ['±1°', '±0°30\'', '±0°20\'', '±0°10\'', '±0°5\''],
    c: ['±1°30\'', '±1°', '±0°30\'', '±0°15\'', '±0°10\''],
    v: ['±3°', '±2°', '±1°', '±0°30\'', '±0°20\'']
};
// Outside radii and chamfer heights
export const ISO_RADIUS = {
    ranges: [[0.5, 3], [3, 6], [6, Infinity]],
    f: [0.2, 0.5, 1], m: [0.2, 0.5, 1], c: [0.4, 1, 2], v: [0.4, 1, 2]
};
const CLASS_NAME = { f: 'fine', m: 'medium', c: 'coarse', v: 'very coarse' };

const STORE = 'general_tol_v1';
const DEFAULT_BLOCK = { unit: 'mm', rows: ['±0.5', '±0.2', '±0.1', '±0.05'], angle: '±0.5°' };

const state = {
    source: 'block',          // 'block' | 'iso'
    written: '25.0',          // dimension as written on the drawing
    kind: 'linear',           // 'linear' | 'angle' | 'radius'
    size: 25,                 // mm (for ISO)
    cls: 'm',
    block: loadBlock()
};

function loadBlock() {
    try {
        const b = JSON.parse(localStorage.getItem(STORE));
        if (b && Array.isArray(b.rows) && b.rows.length === 4) return b;
    } catch { /* fall back */ }
    return structuredClone(DEFAULT_BLOCK);
}
function saveBlock() {
    try { localStorage.setItem(STORE, JSON.stringify(state.block)); } catch { /* not critical */ }
}

let svgRef = null, overlay = null, controlsRoot = null;

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'general_tolerances';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);
    renderMain();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

export function unload() {
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = svgRef = null;
}

// --- Maths ---------------------------------------------------------------------

/** Parse "±0.2" or "0.2" into a number; null if not a number. */
const plusMinus = s => {
    const v = parseFloat(String(s).replace(/[±+]/g, ''));
    return Number.isFinite(v) ? Math.abs(v) : null;
};
const decimalsOf = s => (String(s).includes('.') ? String(s).split('.')[1].length : 0);

export function isoLookup(table, size, cls) {
    // Each range is "over lo, up to and including hi"; the first also includes lo
    const i = table.ranges.findIndex(([lo, hi], k) => (k === 0 ? size >= lo : size > lo) && size <= hi);
    return i < 0 ? { i: -1, tol: null } : { i, tol: table[cls][i] };
}

function blockResult() {
    const w = state.written.trim();
    const nominal = parseFloat(w);
    if (!Number.isFinite(nominal)) return { error: 'Type a dimension as it is written, for example 25.0' };
    const d = Math.min(decimalsOf(w), 3);
    const tol = plusMinus(state.block.rows[d]);
    if (tol == null) return { error: `The title block row for ${d} decimals is empty or not a number.` };
    return { nominal, d, tol, lo: nominal - tol, hi: nominal + tol, places: Math.max(d, decimalsOf(tol)) };
}

function isoResult() {
    const size = state.size;
    if (!(size > 0)) return { error: 'Enter a size above 0.' };
    if (state.kind === 'angle') {
        const { i, tol } = isoLookup(ISO_ANGULAR, size, state.cls);
        return { i, text: tol, note: `shorter side ${size} mm` };
    }
    const table = state.kind === 'radius' ? ISO_RADIUS : ISO_LINEAR;
    if (size < 0.5) return { error: 'Below 0.5 mm, ISO 2768 gives no general tolerance: the drawing must state one.' };
    const { i, tol } = isoLookup(table, size, state.cls);
    if (i < 0) return { error: 'Above 4000 mm, ISO 2768 gives no general tolerance.' };
    if (tol == null) return { i, error: `Class ${state.cls} (${CLASS_NAME[state.cls]}) has no value for this size. The drawing must state a tolerance.` };
    const p = Math.max(decimalsOf(tol), 1);
    return { i, tol, text: `±${tol}`, lo: (size - tol).toFixed(p), hi: (size + tol).toFixed(p) };
}

// --- Rendering -------------------------------------------------------------------

function resultCard() {
    if (state.source === 'block') {
        const r = blockResult();
        if (r.error) return `<div class="p-5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">${esc(r.error)}</div>`;
        return `
          <div class="p-5 rounded-lg bg-white border-2 border-blue-500">
            <div class="text-xs font-bold tracking-widest text-slate-400 uppercase">Result</div>
            <div class="text-3xl font-extrabold text-slate-900 font-mono mt-1">${esc(state.written)} ${esc('±' + r.tol)} ${esc(state.block.unit)}</div>
            <div class="text-lg text-slate-700 mt-1">Good part: <b class="font-mono">${r.lo.toFixed(r.places)}</b> to <b class="font-mono">${r.hi.toFixed(r.places)}</b></div>
            <p class="text-sm text-slate-500 mt-2">It has <b>${r.d}</b> decimal place${r.d === 1 ? '' : 's'}, so it takes the "${['X', 'X.X', 'X.XX', 'X.XXX'][r.d]}" line of the title block.</p>
          </div>`;
    }
    const r = isoResult();
    if (r.error) return `<div class="p-5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">${esc(r.error)}</div>`;
    const what = { linear: 'length', angle: 'angle', radius: 'radius or chamfer' }[state.kind];
    return `
      <div class="p-5 rounded-lg bg-white border-2 border-blue-500">
        <div class="text-xs font-bold tracking-widest text-slate-400 uppercase">Result: ISO 2768-${state.cls}</div>
        <div class="text-3xl font-extrabold text-slate-900 font-mono mt-1">${esc(r.text)}${state.kind === 'angle' ? '' : ' mm'}</div>
        ${state.kind === 'angle'
            ? `<div class="text-lg text-slate-700 mt-1">for an angle whose shorter side is ${state.size} mm</div>`
            : `<div class="text-lg text-slate-700 mt-1">Good part: <b class="font-mono">${r.lo}</b> to <b class="font-mono">${r.hi}</b> mm (${what} ${state.size})</div>`}
      </div>`;
}

function isoTable(title, table, fmt, activeRow) {
    const head = table.ranges.map(([lo, hi]) => hi === Infinity ? `over ${lo}` : `${lo === 0 ? 'up to' : `${lo} to`} ${hi}`);
    return `
      <div class="mt-6">
        <h3 class="text-sm font-extrabold text-slate-800 mb-2">${esc(title)}</h3>
        <div class="overflow-x-auto">
        <table class="text-sm border border-slate-200 bg-white w-full">
          <thead><tr class="bg-slate-100"><th class="px-2 py-1.5 text-left">Class</th>${head.map((h, i) =>
              `<th class="px-2 py-1.5 font-mono text-xs ${i === activeRow ? 'bg-blue-100 text-blue-900' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${['f', 'm', 'c', 'v'].map(c => `<tr class="border-t border-slate-200">
            <td class="px-2 py-1.5 font-bold">${c} <span class="font-normal text-slate-500">${CLASS_NAME[c]}</span></td>
            ${table[c].map((v, i) => {
                const on = i === activeRow && c === state.cls;
                return `<td class="px-2 py-1.5 text-center font-mono ${on ? 'bg-blue-600 text-white font-bold' : i === activeRow || c === state.cls ? 'bg-blue-50' : ''}">${v == null ? '—' : esc(fmt(v))}</td>`;
            }).join('')}</tr>`).join('')}</tbody>
        </table></div>
      </div>`;
}

function renderMain() {
    if (!overlay) return;
    const iso = state.source === 'iso';
    const r = iso ? isoResult() : null;
    const row = r && r.i >= 0 ? r.i : -1;
    overlay.innerHTML = `
      <div class="max-w-3xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Drawing basics</div>
        <h2 class="text-3xl font-extrabold text-slate-900 mb-1">General tolerances</h2>
        <p class="text-slate-600 mb-6 leading-relaxed">A dimension with no tolerance next to it still has one. It comes from the <b>title block</b> (by the number of decimal places) or from a note like <b>"ISO 2768-m"</b>. Nothing on a drawing is exact unless it is a basic dimension.</p>
        ${resultCard()}
        ${iso ? `
          ${isoTable('Lengths (mm): ISO 2768-1 table 1', ISO_LINEAR, v => '±' + v, state.kind === 'linear' ? row : -1)}
          ${isoTable('Outside radii and chamfer heights (mm): table 2', ISO_RADIUS, v => '±' + v, state.kind === 'radius' ? row : -1)}
          ${isoTable('Angles, by the shorter side (mm): table 3', ISO_ANGULAR, v => v, state.kind === 'angle' ? row : -1)}
          <p class="text-sm text-slate-500 mt-4 leading-relaxed">A note like <b>"ISO 2768-mK"</b> has a second letter. It picks a class from <b>ISO 2768-2</b> (H, K or L) for straightness, flatness, perpendicularity, symmetry and runout of features that have no GD&T of their own.</p>`
        : `
          <div class="mt-6 bg-white border border-slate-200 rounded-lg p-4">
            <h3 class="text-sm font-extrabold text-slate-800 mb-2">How the title block works</h3>
            <table class="text-sm w-full">
              ${['X', 'X.X', 'X.XX', 'X.XXX'].map((p, i) => `<tr class="border-t border-slate-100">
                  <td class="py-1.5 font-mono w-24">${p}</td><td class="py-1.5 font-mono">${esc(state.block.rows[i] || '—')}</td>
                  <td class="py-1.5 text-slate-500">e.g. ${['25', '25.0', '25.00', '25.000'][i]}</td></tr>`).join('')}
              <tr class="border-t border-slate-100"><td class="py-1.5 font-mono">ANGLES</td><td class="py-1.5 font-mono">${esc(state.block.angle)}</td><td></td></tr>
            </table>
            <p class="text-sm text-slate-500 mt-3">Edit these in the sidebar to match your drawing. They are saved in this browser.</p>
          </div>`}
      </div>`;
}

function renderControls() {
    if (!controlsRoot) return;
    const seg = (key, value, label) => `<button data-${key}="${value}" class="${UI.segBtn} ${state[key] === value ? UI.segOn : UI.segOff}">${label}</button>`;
    const iso = state.source === 'iso';
    controlsRoot.innerHTML = `
        <div class="${UI.card}">
            <h4 class="${UI.h4}">Where the tolerance comes from</h4>
            <div class="flex gap-2">${seg('source', 'block', 'Title block')}${seg('source', 'iso', 'ISO 2768 note')}</div>
        </div>
        ${iso ? `
        <div class="${UI.card} space-y-3">
            <div>
                <h4 class="${UI.h4}">What is dimensioned</h4>
                <div class="flex gap-1.5">${seg('kind', 'linear', 'Length')}${seg('kind', 'radius', 'Radius / chamfer')}${seg('kind', 'angle', 'Angle')}</div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">${state.kind === 'angle' ? 'SHORTER SIDE OF THE ANGLE (MM)' : 'SIZE (MM)'}</label>
                <input id="gt-size" type="number" min="0" step="0.1" value="${state.size}" class="${UI.input}">
            </div>
            <div>
                <h4 class="${UI.h4}">Class (letter after 2768-)</h4>
                <div class="flex gap-1.5">${['f', 'm', 'c', 'v'].map(c => seg('cls', c, c)).join('')}</div>
                <p class="text-xs text-slate-500 mt-1">${esc(CLASS_NAME[state.cls])}. "m" (medium) is by far the most common.</p>
            </div>
        </div>` : `
        <div class="${UI.card} space-y-3">
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">DIMENSION AS WRITTEN</label>
                <input id="gt-written" type="text" value="${esc(state.written)}" class="${UI.input}" placeholder="25.0">
                <p class="text-xs text-slate-500 mt-1">Type it exactly as on the drawing: 25, 25.0 and 25.00 are different.</p>
            </div>
            <div>
                <h4 class="${UI.h4}">Your title block</h4>
                <div class="grid grid-cols-2 gap-2">
                    ${['X', 'X.X', 'X.XX', 'X.XXX'].map((p, i) => `<div><label class="block text-[11px] font-bold text-slate-500 mb-0.5 font-mono">${p}</label>
                        <input data-row="${i}" type="text" value="${esc(state.block.rows[i])}" class="${UI.input}"></div>`).join('')}
                    <div><label class="block text-[11px] font-bold text-slate-500 mb-0.5">ANGLES</label>
                        <input id="gt-angle" type="text" value="${esc(state.block.angle)}" class="${UI.input}"></div>
                    <div><label class="block text-[11px] font-bold text-slate-500 mb-0.5">UNITS</label>
                        <select id="gt-unit" class="${UI.input}">${['mm', 'in'].map(u => `<option ${state.block.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
                </div>
                <button id="gt-reset" class="${UI.smallBtn} w-full mt-2">RESET TO EXAMPLE VALUES</button>
            </div>
        </div>`}
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Watch out</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>A tolerance written next to a dimension always wins over the general one.</li>
                <li>Basic (boxed) dimensions never take the general tolerance.</li>
                <li>Inch drawings often write .500 instead of 0.500: count the digits after the point.</li>
                <li>ISO 2768-2 (the H / K / L part) has been replaced by ISO 22081, but it is still printed on many drawings.</li>
            </ul>
        </div>`;

    controlsRoot.querySelectorAll('[data-source]').forEach(b => b.onclick = () => { state.source = b.dataset.source; update(); });
    controlsRoot.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { state.kind = b.dataset.kind; update(); });
    controlsRoot.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { state.cls = b.dataset.cls; update(); });
    const on = (id, fn) => { const e = controlsRoot.querySelector(id); if (e) e.oninput = () => { fn(e.value); renderMain(); }; };
    on('#gt-size', v => { state.size = parseFloat(v); });
    on('#gt-written', v => { state.written = v; });
    on('#gt-angle', v => { state.block.angle = v; saveBlock(); });
    const unit = controlsRoot.querySelector('#gt-unit');
    if (unit) unit.onchange = () => { state.block.unit = unit.value; saveBlock(); renderMain(); };
    controlsRoot.querySelectorAll('[data-row]').forEach(e => e.oninput = () => { state.block.rows[+e.dataset.row] = e.value; saveBlock(); renderMain(); });
    const reset = controlsRoot.querySelector('#gt-reset');
    if (reset) reset.onclick = () => { state.block = structuredClone(DEFAULT_BLOCK); saveBlock(); update(); };
}

function update() {
    renderMain();
    renderControls();
}
