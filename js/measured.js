// js/measured.js
// "Measured points" box for the form / profile tools: type or paste real
// readings (a CMM report, a dial sweep, a column copied from Excel) instead of
// dragging. Numbers may be separated by spaces, commas, semicolons, tabs or
// new lines; anything else on a line (point names, units) is ignored.

import { decimals, unitName } from './units.js';

/** Every whole number entry in the text, in order ("P1", "Pt-3" and words are skipped; 0.002" and 0.05mm count). */
export function parseNumbers(text) {
    return String(text).split(/[\s,;]+/)
        .map(t => t.replace(/(mm|in|"|″)$/i, ''))
        .filter(t => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(t))
        .map(Number);
}

/** The values as text, `cols` per line. */
export function formatValues(values, cols) {
    const d = decimals() + 1;
    const lines = [];
    for (let i = 0; i < values.length; i += cols) lines.push(values.slice(i, i + cols).map(v => (Math.abs(v) < 1e-12 ? 0 : v).toFixed(d)).join('  '));
    return lines.join('\n');
}

/**
 * The box (HTML). opts: { id, count, cols, values, order, sign }
 *   order: how the points are numbered, e.g. 'row by row, from the back-left corner'
 *   sign:  what + means, e.g. '+ = above the reference'
 */
export function measuredCard({ id, count, cols, values, order, sign }) {
    return `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200" data-measured="${id}">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-1">Measured points (${unitName()})</h4>
            <p class="text-xs text-slate-500 mb-2">${count} readings, ${order}. ${sign}. Paste from a CMM report or Excel: spaces, commas, tabs or new lines all work.</p>
            <textarea id="${id}-text" rows="${Math.min(7, Math.ceil(count / cols) + 1)}" spellcheck="false"
                class="w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-xs leading-relaxed focus:ring-2 focus:ring-blue-500">${formatValues(values, cols)}</textarea>
            <div class="flex items-center gap-2 mt-2">
                <button id="${id}-apply" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-bold">Use these readings</button>
                <button id="${id}-zero" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-bold">All zero</button>
                <span id="${id}-msg" class="text-xs ml-auto"></span>
            </div>
        </div>`;
}

/**
 * Wire the box. onApply(values) gets exactly `count` numbers.
 * Returns refresh(values) to show new values (after a drag or a preset).
 */
export function bindMeasured(root, { id, count, cols, onApply }) {
    const box = root.querySelector(`#${id}-text`), msg = root.querySelector(`#${id}-msg`);
    if (!box) return () => {};
    const say = (t, ok) => { msg.textContent = t; msg.className = `text-xs ml-auto font-semibold ${ok ? 'text-green-700' : 'text-red-600'}`; };
    const apply = () => {
        const v = parseNumbers(box.value);
        if (v.length !== count) { say(`Found ${v.length} numbers; need ${count}.`, false); return; }
        onApply(v);
        say('Applied.', true);
    };
    root.querySelector(`#${id}-apply`).onclick = apply;
    box.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); } };
    root.querySelector(`#${id}-zero`).onclick = () => { box.value = formatValues(new Array(count).fill(0), cols); apply(); };
    return values => { if (document.activeElement !== box) box.value = formatValues(values, cols); msg.textContent = ''; };
}
