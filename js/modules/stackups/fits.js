// js/modules/stackups/fits.js
// ISO fits (ISO 286): turn a callout like Ø20 H7/g6 into real limits, and
// show whether the shaft always slides in (clearance), always has to be
// pressed in (interference), or could be either (transition).

import { createSVG } from '../../drawing_utils.js';
import { COLORS, addDefs, text, wrapText } from '../../theme.js';
import {
    GRADES, SHAFT_LETTERS, HOLE_LETTERS, PREFERRED, computeFit, mainRange, parseClass
} from './iso286.js';
import { takeFocus } from '../../focus.js';

const state = { size: 20, hole: { letter: 'H', grade: 7 }, shaft: { letter: 'g', grade: 6 } };
let svgRef = null, controlsRoot = null;

const TYPE = {
    clearance: { name: 'Clearance fit', color: COLORS.pass, tint: COLORS.passTint,
        says: 'The shaft always slides in: there is always a gap.' },
    transition: { name: 'Transition fit', color: '#b45309', tint: '#fef3c7',
        says: 'Depending on the actual sizes, there may be a small gap or a slight press. Assembly may need light force.' },
    interference: { name: 'Interference fit', color: COLORS.fail, tint: COLORS.failTint,
        says: 'The shaft is always bigger than the hole: it must be pressed in, or the hole heated / the shaft cooled.' }
};

export function draw(svg) {
    svgRef = svg;
    // From the search: { size?, hole?, shaft? }, e.g. typed "25 H7/p6"
    const f = takeFocus('fits');
    if (f) {
        if (f.size) state.size = f.size;
        if (f.hole) state.hole = { ...f.hole };
        if (f.shaft) state.shaft = { ...f.shaft };
    }
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

// --- Formatting ------------------------------------------------------------------

const mm = (size, dev) => (size + dev / 1000).toFixed(3);
const devMM = dev => (dev === 0 ? '0' : `${dev > 0 ? '+' : '−'}${(Math.abs(dev) / 1000).toFixed(3)}`);
const um = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;
const cls = c => `${c.letter}${c.grade}`;
const valid = () => mainRange(state.size) >= 0;

const gapText = v => (v >= 0 ? `${v} µm gap` : `${-v} µm press`);

function describeClear(v) {
    const a = (Math.abs(v) / 1000).toFixed(3);
    return v >= 0 ? `${a} mm gap` : `${a} mm interference`;
}

// --- Canvas ---------------------------------------------------------------------

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    addDefs(svg);

    if (!valid()) {
        svg.appendChild(text('Enter a size above 0 and up to 500 mm.', 500, 380, { size: 20, fill: COLORS.muted, anchor: 'middle' }));
        return;
    }
    const f = computeFit(state.size, state.hole, state.shaft);
    const t = TYPE[f.type];

    // Heading: the callout as it appears on a drawing
    svg.appendChild(text(`Ø${state.size} ${cls(state.hole)}/${cls(state.shaft)}`, 40, 56, { size: 32, weight: 800, fill: COLORS.ink, mono: true }));
    const pillW = t.name.length * 9.5 + 30;
    svg.appendChild(createSVG('rect', { x: 40, y: 72, width: pillW, height: 30, rx: 15, fill: t.tint, stroke: t.color, 'stroke-width': 1.5 }));
    svg.appendChild(text(t.name.toUpperCase(), 40 + pillW / 2, 92, { size: 13, weight: 800, fill: t.color, anchor: 'middle', letterSpacing: '0.05em' }));

    drawZoneChart(svg, f, t);
    drawCards(svg, f, t);
    drawSentence(svg, f, t);
}

// Tolerance zones around the zero line (the nominal size), in µm
function drawZoneChart(svg, f, t) {
    const top = 150, bottom = 590, left = 110, right = 560;
    const vals = [0, f.hole.upper, f.hole.lower, f.shaft.upper, f.shaft.lower];
    let hi = Math.max(...vals), lo = Math.min(...vals);
    const pad = (hi - lo) * 0.15 || 10;
    hi += pad; lo -= pad;
    const Y = v => top + (hi - v) / (hi - lo) * (bottom - top);

    svg.appendChild(text('TOLERANCE ZONES (µm)', 40, 136, { size: 13, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));

    // Grid ticks
    const span = hi - lo;
    const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find(s => span / s <= 8) ?? 1000;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
        svg.appendChild(createSVG('line', { x1: left, y1: Y(v), x2: right, y2: Y(v), stroke: '#e2e8f0', 'stroke-width': 1 }));
        svg.appendChild(text(um(v), left - 10, Y(v) + 4, { size: 12, fill: COLORS.muted, anchor: 'end', mono: true }));
    }

    // Zero line = nominal size
    svg.appendChild(createSVG('line', { x1: left - 4, y1: Y(0), x2: right + 10, y2: Y(0), stroke: COLORS.ink, 'stroke-width': 2 }));
    svg.appendChild(text(`0 = Ø${state.size}`, right + 14, Y(0) + 5, { size: 13, weight: 700, fill: COLORS.ink }));

    const band = (x, w, d, fill, stroke, label, sub) => {
        const y1 = Y(d.upper), y2 = Y(d.lower);
        svg.appendChild(createSVG('rect', { x, y: y1, width: w, height: Math.max(2, y2 - y1), fill, stroke, 'stroke-width': 2 }));
        svg.appendChild(text(label, x + w / 2, y1 - 30, { size: 15, weight: 800, fill: stroke, anchor: 'middle' }));
        svg.appendChild(text(sub, x + w / 2, y1 - 12, { size: 12.5, fill: stroke, anchor: 'middle', mono: true }));
        // (a deviation of 0 sits on the zero line, which is already labelled)
        if (d.upper !== 0) svg.appendChild(text(um(d.upper), x + w + 8, y1 + 5, { size: 12.5, weight: 700, fill: stroke, mono: true }));
        if (d.lower !== 0) svg.appendChild(text(um(d.lower), x + w + 8, y2 + 5, { size: 12.5, weight: 700, fill: stroke, mono: true }));
    };
    band(130, 110, f.hole, 'rgba(59,130,246,0.18)', '#1d4ed8', `HOLE ${cls(state.hole)}`, `IT${state.hole.grade} = ${f.hole.upper - f.hole.lower} µm`);
    band(340, 110, f.shaft, 'rgba(100,116,139,0.22)', '#334155', `SHAFT ${cls(state.shaft)}`, `IT${state.shaft.grade} = ${f.shaft.upper - f.shaft.lower} µm`);

    // Tightest and loosest case, as arrows between the zones
    const arrow = (x, from, to, label, color, key, value) => {
        if (Math.abs(Y(from) - Y(to)) > 6) {
            svg.appendChild(createSVG('line', { x1: x, y1: Y(from), x2: x, y2: Y(to), stroke: color, 'stroke-width': 2,
                'marker-start': `url(#thm-arrow-${key})`, 'marker-end': `url(#thm-arrow-${key})` }));
        }
        svg.appendChild(createSVG('line', { x1: x - 14, y1: Y(from), x2: x + 14, y2: Y(from), stroke: color, 'stroke-width': 1, 'stroke-dasharray': '3 2' }));
        svg.appendChild(createSVG('line', { x1: x - 14, y1: Y(to), x2: x + 14, y2: Y(to), stroke: color, 'stroke-width': 1, 'stroke-dasharray': '3 2' }));
        svg.appendChild(text(label, x, bottom + 22, { size: 12.5, weight: 800, fill: color, anchor: 'middle', letterSpacing: '0.05em' }));
        svg.appendChild(text(value, x, bottom + 40, { size: 12.5, fill: color, anchor: 'middle', mono: true }));
    };
    const cMin = f.minClear >= 0 ? COLORS.pass : COLORS.fail;
    const cMax = f.maxClear >= 0 ? COLORS.pass : COLORS.fail;
    arrow(305, f.hole.lower, f.shaft.upper, 'TIGHTEST', cMin, f.minClear >= 0 ? 'ink' : 'fail', gapText(f.minClear));
    arrow(528, f.hole.upper, f.shaft.lower, 'LOOSEST', cMax, f.maxClear >= 0 ? 'ink' : 'fail', gapText(f.maxClear));
}

function drawCards(svg, f, t) {
    const x = 640, w = 320;
    const card = (y, h, title, color) => {
        svg.appendChild(createSVG('rect', { x, y, width: w, height: h, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
        svg.appendChild(createSVG('rect', { x, y, width: 5, height: h, rx: 2, fill: color }));
        svg.appendChild(text(title, x + 20, y + 26, { size: 13, weight: 800, fill: color, letterSpacing: '0.05em' }));
    };
    const row = (y, label, value, opts = {}) => {
        svg.appendChild(text(label, x + 20, y, { size: 14, fill: COLORS.muted }));
        svg.appendChild(text(value, x + w - 20, y, { size: opts.size ?? 16, weight: 700, fill: opts.fill ?? COLORS.ink, anchor: 'end', mono: true }));
    };

    card(40, 124, `HOLE Ø${state.size} ${cls(state.hole)}`, '#1d4ed8');
    row(94, 'Largest', mm(state.size, f.hole.upper));
    row(118, 'Smallest', mm(state.size, f.hole.lower));
    svg.appendChild(text(`On a drawing: Ø${state.size} ${devMM(f.hole.upper)} / ${devMM(f.hole.lower)}`, x + 20, 150, { size: 12.5, fill: COLORS.muted, mono: true }));

    card(180, 124, `SHAFT Ø${state.size} ${cls(state.shaft)}`, '#334155');
    row(234, 'Largest', mm(state.size, f.shaft.upper));
    row(258, 'Smallest', mm(state.size, f.shaft.lower));
    svg.appendChild(text(`On a drawing: Ø${state.size} ${devMM(f.shaft.upper)} / ${devMM(f.shaft.lower)}`, x + 20, 290, { size: 12.5, fill: COLORS.muted, mono: true }));

    card(320, 200, 'THE FIT', t.color);
    row(374, 'Loosest', describeClear(f.maxClear), { size: 15, fill: f.maxClear >= 0 ? COLORS.pass : COLORS.fail });
    svg.appendChild(text('smallest shaft in biggest hole', x + 20, 394, { size: 12, fill: COLORS.muted, italic: true }));
    row(426, 'Tightest', describeClear(f.minClear), { size: 15, fill: f.minClear >= 0 ? COLORS.pass : COLORS.fail });
    svg.appendChild(text('biggest shaft in smallest hole', x + 20, 446, { size: 12, fill: COLORS.muted, italic: true }));
    svg.appendChild(wrapText(t.says, x + 20, 476, 37, 18, { size: 13.5, fill: COLORS.text }));
}

function drawSentence(svg, f, t) {
    const pref = PREFERRED.find(p => p.hole === cls(state.hole) && p.shaft === cls(state.shaft));
    svg.appendChild(createSVG('rect', { x: 20, y: 650, width: 960, height: 135, rx: 10, fill: COLORS.card, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));
    svg.appendChild(text('IN PLAIN ENGLISH', 44, 680, { size: 12, weight: 800, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const s = `The hole may be ${mm(state.size, f.hole.lower)} to ${mm(state.size, f.hole.upper)} and the shaft ${mm(state.size, f.shaft.lower)} to ${mm(state.size, f.shaft.upper)}. ` +
        (f.type === 'clearance' ? `There is always a gap, from ${(f.minClear / 1000).toFixed(3)} to ${(f.maxClear / 1000).toFixed(3)} mm.`
            : f.type === 'interference' ? `The shaft is always ${(-f.maxClear / 1000).toFixed(3)} to ${(-f.minClear / 1000).toFixed(3)} mm bigger than the hole.`
                : `Anything from a ${(f.maxClear / 1000).toFixed(3)} mm gap to ${(-f.minClear / 1000).toFixed(3)} mm of interference.`) +
        (pref ? ` A preferred "${pref.name.toLowerCase()}" fit: ${pref.use.split('. ')[0].toLowerCase()}.` : '');
    svg.appendChild(wrapText(s, 44, 706, 118, 21, { size: 15, fill: COLORS.text }));
}

// --- Sidebar --------------------------------------------------------------------

const segBtn = 'px-2 py-1.5 text-xs font-bold rounded border transition-colors text-left';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50';
const input = 'w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500';

function renderControls() {
    if (!controlsRoot) return;
    const opt = (list, cur) => list.map(v => `<option ${String(v) === String(cur) ? 'selected' : ''}>${v}</option>`).join('');
    const isOn = p => p.hole === cls(state.hole) && p.shaft === cls(state.shaft);
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200 space-y-3">
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">NOMINAL SIZE (MM)</label>
                <input id="fit-size" type="number" min="0.1" max="500" step="1" value="${state.size}" class="${input}">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">HOLE (CAPITAL)</label>
                    <div class="flex gap-1">
                        <select id="fit-hl" class="${input}">${opt(HOLE_LETTERS, state.hole.letter)}</select>
                        <select id="fit-hg" class="${input}">${opt(GRADES, state.hole.grade)}</select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">SHAFT (SMALL)</label>
                    <div class="flex gap-1">
                        <select id="fit-sl" class="${input}">${opt(SHAFT_LETTERS, state.shaft.letter)}</select>
                        <select id="fit-sg" class="${input}">${opt(GRADES, state.shaft.grade)}</select>
                    </div>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1">OR TYPE THE CALLOUT</label>
                <input id="fit-callout" type="text" placeholder="e.g. 25 H7/p6" class="${input}">
                <p id="fit-callout-msg" class="text-xs text-red-600 mt-1 hidden">Could not read that. Try: 25 H7/p6</p>
            </div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Preferred fits (loosest to tightest)</h4>
            <div class="flex flex-col gap-1.5">
                ${PREFERRED.map((p, i) => `<button data-pref="${i}" class="${segBtn} ${isOn(p) ? segOn : segOff}">
                    <span class="font-mono">${p.hole}/${p.shaft}</span> · ${p.name}</button>`).join('')}
            </div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Watch out</div>
            <ul class="text-xs list-disc pl-4 space-y-1">
                <li>Capital letters are holes, small letters are shafts. H7 and h7 are different things.</li>
                <li>Most fits use an H hole ("hole basis"), because holes are made with fixed-size drills and reamers. The shaft letter then sets the fit.</li>
                <li>Inch drawings use different classes (RC, LC, LT, LN, FN from ANSI B4.1), not these letters.</li>
                <li>A press fit also depends on material, length and surface finish. Check the force before production.</li>
            </ul>
        </div>`;

    const q = id => controlsRoot.querySelector(id);
    q('#fit-size').oninput = e => { state.size = parseFloat(e.target.value); render(); };
    q('#fit-hl').onchange = e => { state.hole.letter = e.target.value; update(); };
    q('#fit-hg').onchange = e => { state.hole.grade = +e.target.value; update(); };
    q('#fit-sl').onchange = e => { state.shaft.letter = e.target.value; update(); };
    q('#fit-sg').onchange = e => { state.shaft.grade = +e.target.value; update(); };
    q('#fit-callout').onchange = e => {
        const ok = applyCallout(e.target.value);
        q('#fit-callout-msg').classList.toggle('hidden', ok);
        if (ok) update();
    };
    controlsRoot.querySelectorAll('[data-pref]').forEach(b => b.onclick = () => {
        const p = PREFERRED[+b.dataset.pref];
        state.hole = parseClass(p.hole);
        state.shaft = parseClass(p.shaft);
        update();
    });
}

/** Read "Ø25 H7/p6", "25H7/p6" or "25 H7 p6". */
function applyCallout(str) {
    const m = /^\s*[Øø]?\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{1,2})\s*(\d{1,2})\s*[/ ]\s*([a-z]{1,2})\s*(\d{1,2})\s*$/.exec(str);
    if (!m) return false;
    const size = +m[1], hole = { letter: m[2].toUpperCase(), grade: +m[3] }, shaft = { letter: m[4].toLowerCase(), grade: +m[5] };
    if (!(size > 0 && size <= 500) || !HOLE_LETTERS.includes(hole.letter) || !SHAFT_LETTERS.includes(shaft.letter)
        || !GRADES.includes(hole.grade) || !GRADES.includes(shaft.grade)) return false;
    Object.assign(state, { size, hole, shaft });
    return true;
}

function update() {
    render();
    renderControls();
}
