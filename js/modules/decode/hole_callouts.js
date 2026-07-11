// modules/decode/hole_callouts.js
// ============================================================================
// HOLES & PATTERNS DECODER — per DECODER_SPEC.md (roadmap #2)
// Callout stacks: nX, diameter, THRU/blind depth, counterbore / spotface /
// countersink, EQ SP, bolt circles, thread callouts (metric + unified),
// decoded field by field. One state object, three renderers.
// Standard: ASME Y14.5-2018 dimensioning symbols; ISO 261/724 metric threads.
// Exports: draw(canvas), loadControls(container)   [shell contract §1]
// ============================================================================

import { el, diaSymbol, cboreSymbol, csinkSymbol, depthSymbol, HOLE_W } from './symbols.js';

// --------------------------------------------------------------------------
// STATE
// --------------------------------------------------------------------------
const state = {
    count: 8,               // nX multiplier (1 = single hole)
    threaded: false,
    system: 'metric',       // 'metric' | 'unified'
    mSize: 12, mPitch: 1.75, mClass: '6H',
    uSize: '3/8', uTpi: 16, uSeries: 'UNC', uClass: '2B',
    diameter: 10.5,         // mm — plain hole diameter
    thru: true,
    holeDepth: null,        // mm — blind depth (full-diameter portion)
    feature: 'none',        // 'none' | 'cbore' | 'csink' | 'spotface'
    cboreDia: 18, cboreDepth: 11,
    csinkDia: 20, csinkAngle: 90,
    sfDia: 20, sfDepth: null,   // spotface: null depth = clean-up
    pattern: 'none',        // 'none' | 'bc'
    bcDia: 120,
    eqsp: true
};

// Coarse pitch table (ISO 261) — powers the "pitch omitted = coarse" gotcha.
const COARSE = { 3: 0.5, 4: 0.7, 5: 0.8, 6: 1, 8: 1.25, 10: 1.5, 12: 1.75, 14: 2, 16: 2, 20: 2.5, 24: 3, 30: 3.5 };

// --------------------------------------------------------------------------
// GOTCHAS (spec §5)
// --------------------------------------------------------------------------
const GOTCHAS = [
    { when: s => s.count > 1 && s.feature !== 'none',
      text: s => `Scope rule: ${s.count}X applies to the ENTIRE stack below it — all ${s.count} holes get the ${s.feature === 'cbore' ? 'counterbore' : s.feature === 'csink' ? 'countersink' : 'spotface'} too.` },
    { when: s => s.feature === 'csink',
      text: s => `${s.csinkAngle} degrees is the INCLUDED angle (full cone), not the angle per side.` },
    { when: s => s.feature === 'spotface' && s.sfDepth == null,
      text: () => `Spotface with no depth = machine only enough to clean up the surface for seating (a legal, common omission).` },
    { when: s => s.threaded && s.system === 'metric' && COARSE[s.mSize] === s.mPitch,
      text: s => `M${s.mSize} x ${s.mPitch} is the COARSE pitch — drawings may legally write just "M${s.mSize}" with the pitch omitted. Omitted pitch ALWAYS means coarse.` },
    { when: s => s.threaded,
      text: s => s.system === 'metric'
          ? `Thread class case matters: "${s.mClass}" with a CAPITAL letter = internal (hole); lowercase (e.g. 6g) = external (shaft).`
          : `Unified class letters: B = internal (hole), A = external (shaft) — ${s.uClass} here is ${s.uClass.endsWith('B') ? 'internal' : 'external'}.` },
    { when: s => s.pattern === 'bc',
      text: s => `The ${s.bcDia} mm B.C. passes through the hole CENTERS, not their edges.` },
    { when: s => !s.thru && s.holeDepth == null && !s.threaded,
      text: () => `No THRU and no depth = an ambiguous callout — flag it, don't guess.` },
    { when: s => !s.thru && s.holeDepth != null,
      text: () => `The depth symbol measures the FULL-DIAMETER depth; the 118-degree drill point extends beyond it.` }
];

// --------------------------------------------------------------------------
let canvasRef = null, zones = null, controlsRoot = null;

export function draw(canvas) {
    canvasRef = canvas;
    const defs = el('defs');
    const mk = el('marker', { id: 'hc-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    mk.appendChild(el('path', { d: 'M1 1 L9 5 L1 9 Z', fill: '#0f172a' }));
    defs.appendChild(mk);
    // section hatching
    const pat = el('pattern', { id: 'hc-hatch', width: 9, height: 9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.appendChild(el('rect', { width: 9, height: 9, fill: '#C9C7BE' }));
    pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 9, stroke: '#8F8D85', 'stroke-width': 1.4 }));
    defs.appendChild(pat);
    canvas.appendChild(defs);

    [[260, 'WHAT IT COMMANDS'], [640, 'IN PLAIN ENGLISH']].forEach(([y, label]) => {
        canvas.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#e2e8f0', 'stroke-width': 1 }));
        canvas.appendChild(txt(label, 40, y + 20, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    });
    canvas.appendChild(txt('CALLOUT', 40, 24, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));

    zones = { symbol: el('g'), preview: el('g'), sentence: el('g') };
    Object.values(zones).forEach(z => canvas.appendChild(z));
    update();
}

function update() {
    if (!zones) return;
    Object.values(zones).forEach(z => { while (z.firstChild) z.removeChild(z.firstChild); });
    renderCallout(zones.symbol, state);
    renderPreview(zones.preview, state);
    renderSentence(zones.sentence, state);
    syncControlVisibility();
}

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------
function txt(str, x, y, o = {}) {
    const t = el('text', {
        x, y, 'font-size': o.size || 16, fill: o.fill || '#0f172a',
        'font-family': o.mono ? "'JetBrains Mono', monospace" : 'ui-sans-serif, system-ui, sans-serif',
        'text-anchor': o.anchor || 'start', 'dominant-baseline': o.baseline || 'auto'
    });
    if (o.bold) t.setAttribute('font-weight', '700');
    if (o.spacing) t.setAttribute('letter-spacing', o.spacing);
    t.textContent = str;
    return t;
}
const S = { stroke: '#0f172a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ==========================================================================
// RENDERER 1 — THE CALLOUT STACK (constructed glyphs + dimension text)
// Composed line by line, exactly as it appears on a drawing.
// ==========================================================================
function renderCallout(g, s) {
    const H = 26;                    // glyph height
    const x0 = 190, lineH = 46;
    let y = 96;

    const GLYPHS = { dia: diaSymbol, cbore: cboreSymbol, csink: csinkSymbol, depth: depthSymbol };

    /** items: strings render as text, {g:'dia'} renders a constructed glyph */
    function line(items) {
        let x = x0;
        for (const it of items) {
            if (typeof it === 'string') {
                const t = txt(it, x, y, { size: 24, mono: true, bold: true });
                g.appendChild(t);
                x += it.length * 14.6 + 4;
            } else {
                g.appendChild(GLYPHS[it.g](x, y, H));
                x += HOLE_W[it.g] * H + 8;
            }
        }
        y += lineH;
        return x;
    }

    const nX = s.count > 1 ? `${s.count}X ` : '';

    // line 1 — the hole itself
    if (s.threaded) {
        const desig = s.system === 'metric'
            ? `${nX}M${s.mSize} x ${s.mPitch} - ${s.mClass}`
            : `${nX}${s.uSize} - ${s.uTpi} ${s.uSeries} - ${s.uClass}`;
        const items = [desig];
        if (s.thru) items.push(' THRU');
        else if (s.holeDepth != null) items.push('  ', { g: 'depth' }, ` ${s.holeDepth}`);
        line(items);
    } else {
        const items = [nX, { g: 'dia' }, ` ${s.diameter}`];
        if (s.thru) items.push(' THRU');
        else if (s.holeDepth != null) items.push('  ', { g: 'depth' }, ` ${s.holeDepth}`);
        line(items);
    }

    // feature lines
    if (s.feature === 'cbore') {
        line([{ g: 'cbore' }, ' ', { g: 'dia' }, ` ${s.cboreDia}`]);
        line([{ g: 'depth' }, ` ${s.cboreDepth}`]);
    } else if (s.feature === 'csink') {
        line([{ g: 'csink' }, ' ', { g: 'dia' }, ` ${s.csinkDia} X ${s.csinkAngle}`, '\u00B0']);
    } else if (s.feature === 'spotface') {
        const items = [{ g: 'cbore' }, ' SF ', { g: 'dia' }, ` ${s.sfDia}`];
        if (s.sfDepth != null) items.push('  ', { g: 'depth' }, ` ${s.sfDepth}`);
        line(items);
    }

    // pattern line
    if (s.pattern === 'bc') {
        line([s.eqsp ? 'EQ SP ON ' : 'ON ', { g: 'dia' }, ` ${s.bcDia} B.C.`]);
    }

    // leader from the stack to a hole in the preview
    const target = s.pattern === 'bc' ? [300, 375] : [252, 432];
    g.appendChild(el('polyline', {
        ...S, points: `${x0 - 24},${96 - 8} ${x0 - 60},${96 - 8} ${target[0]},${target[1]}`,
        'marker-end': 'url(#hc-arrow)', 'stroke-width': 1.5
    }));
}

// ==========================================================================
// RENDERER 2 — THE PREVIEW: pattern front view (left) + sectioned stack (right)
// ==========================================================================
function renderPreview(g, s) {
    frontView(g, s);
    sectionView(g, s);
}

function frontView(g, s) {
    const cx = 300, cy = 460;
    const n = clamp(s.count, 1, 24);
    const rHole = clamp(s.diameter * 1.1, 5, 16);
    const featDia = s.feature === 'cbore' ? s.cboreDia : s.feature === 'csink' ? s.csinkDia : s.feature === 'spotface' ? s.sfDia : null;
    const rFeat = featDia ? clamp(rHole * (featDia / s.diameter), rHole + 4, 26) : null;

    if (s.pattern === 'bc') {
        const R = 92;
        g.appendChild(el('circle', { cx, cy, r: 138, fill: '#C9C7BE', stroke: '#5F5E5A', 'stroke-width': 1 }));
        g.appendChild(el('circle', { cx, cy, r: 10, fill: 'none', stroke: '#5F5E5A', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
        g.appendChild(el('circle', { cx, cy, r: R, fill: 'none', stroke: '#3b82f6', 'stroke-width': 1.2, 'stroke-dasharray': '8 5' }));
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
            const hx = cx + R * Math.cos(a), hy = cy + R * Math.sin(a);
            if (rFeat) g.appendChild(el('circle', { cx: hx, cy: hy, r: rFeat, fill: '#B4B2A9', stroke: '#5F5E5A', 'stroke-width': 1 }));
            g.appendChild(el('circle', { cx: hx, cy: hy, r: rHole, fill: '#f8fafc', stroke: '#0f172a', 'stroke-width': 1.4 }));
        }
        g.appendChild(txt(`B.C. ${s.bcDia}`, cx + R * 0.72, cy - R * 0.82, { size: 12, fill: '#3b82f6', mono: true }));
    } else {
        // linear row on a plate
        g.appendChild(el('rect', { x: 150, y: 400, width: 320, height: 120, fill: '#C9C7BE', stroke: '#5F5E5A', 'stroke-width': 1 }));
        const gap = 320 / (n + 1);
        for (let i = 1; i <= n; i++) {
            const hx = 150 + gap * i;
            if (rFeat) g.appendChild(el('circle', { cx: hx, cy: 460, r: Math.min(rFeat, gap * 0.42), fill: '#B4B2A9', stroke: '#5F5E5A', 'stroke-width': 1 }));
            g.appendChild(el('circle', { cx: hx, cy: 460, r: Math.min(rHole, gap * 0.3), fill: '#f8fafc', stroke: '#0f172a', 'stroke-width': 1.4 }));
        }
    }
    g.appendChild(txt('FRONT VIEW', 250, 632, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
}

function sectionView(g, s) {
    const top = 380, bot = 530, cxh = 720;
    // section slab
    g.appendChild(el('rect', { x: 560, y: top, width: 330, height: bot - top, fill: 'url(#hc-hatch)', stroke: '#5F5E5A', 'stroke-width': 1 }));

    const w1 = clamp(s.diameter * 3.2, 26, 64);
    let profile;

    const blindBottom = () => {
        const d = clamp((s.holeDepth || 20) * 2.4, 45, 118);
        const yb = top + d, tip = yb + w1 * 0.42;
        return { yb, tip };
    };

    if (s.feature === 'cbore' || s.feature === 'spotface') {
        const fd = s.feature === 'cbore' ? s.cboreDia : s.sfDia;
        const w2 = clamp(fd * 3.2, w1 + 18, 110);
        const d2 = s.feature === 'cbore' ? clamp(s.cboreDepth * 3.2, 16, 80) : clamp((s.sfDepth || 2) * 3.2, 7, 24);
        if (s.thru) {
            profile = `M${cxh - w2 / 2} ${top} L${cxh + w2 / 2} ${top} L${cxh + w2 / 2} ${top + d2} L${cxh + w1 / 2} ${top + d2} L${cxh + w1 / 2} ${bot} L${cxh - w1 / 2} ${bot} L${cxh - w1 / 2} ${top + d2} L${cxh - w2 / 2} ${top + d2} Z`;
        } else {
            const { yb, tip } = blindBottom();
            profile = `M${cxh - w2 / 2} ${top} L${cxh + w2 / 2} ${top} L${cxh + w2 / 2} ${top + d2} L${cxh + w1 / 2} ${top + d2} L${cxh + w1 / 2} ${yb} L${cxh} ${tip} L${cxh - w1 / 2} ${yb} L${cxh - w1 / 2} ${top + d2} L${cxh - w2 / 2} ${top + d2} Z`;
        }
        label(g, `${s.feature === 'cbore' ? 'counterbore' : 'spotface'} step`, cxh + w2 / 2 + 8, top + d2 + 4, cxh + w2 / 2 - 4, top + d2 - 4);
    } else if (s.feature === 'csink') {
        const w2 = clamp(s.csinkDia * 3.2, w1 + 14, 110);
        const half = (s.csinkAngle / 2) * Math.PI / 180;
        const d2 = clamp(((w2 - w1) / 2) / Math.tan(half), 8, 90);
        if (s.thru) {
            profile = `M${cxh - w2 / 2} ${top} L${cxh + w2 / 2} ${top} L${cxh + w1 / 2} ${top + d2} L${cxh + w1 / 2} ${bot} L${cxh - w1 / 2} ${bot} L${cxh - w1 / 2} ${top + d2} Z`;
        } else {
            const { yb, tip } = blindBottom();
            profile = `M${cxh - w2 / 2} ${top} L${cxh + w2 / 2} ${top} L${cxh + w1 / 2} ${top + d2} L${cxh + w1 / 2} ${yb} L${cxh} ${tip} L${cxh - w1 / 2} ${yb} L${cxh - w1 / 2} ${top + d2} Z`;
        }
        label(g, `${s.csinkAngle}\u00B0 included`, cxh + w2 / 2 + 8, top + 16, cxh + w2 / 2 - 6, top + 8);
    } else {
        if (s.thru) {
            profile = `M${cxh - w1 / 2} ${top} L${cxh + w1 / 2} ${top} L${cxh + w1 / 2} ${bot} L${cxh - w1 / 2} ${bot} Z`;
        } else {
            const { yb, tip } = blindBottom();
            profile = `M${cxh - w1 / 2} ${top} L${cxh + w1 / 2} ${top} L${cxh + w1 / 2} ${yb} L${cxh} ${tip} L${cxh - w1 / 2} ${yb} Z`;
        }
    }

    g.appendChild(el('path', { d: profile, fill: '#f8fafc', stroke: '#0f172a', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));

    // thread ticks on the walls
    if (s.threaded) {
        const yEnd = s.thru ? bot : top + clamp((s.holeDepth || 20) * 2.4, 45, 118);
        for (let yy = top + 10; yy < yEnd - 4; yy += 9) {
            g.appendChild(el('line', { x1: cxh - w1 / 2, y1: yy, x2: cxh - w1 / 2 + 7, y2: yy + 4, stroke: '#64748b', 'stroke-width': 1 }));
            g.appendChild(el('line', { x1: cxh + w1 / 2, y1: yy, x2: cxh + w1 / 2 - 7, y2: yy + 4, stroke: '#64748b', 'stroke-width': 1 }));
        }
    }

    // main diameter label
    const mainName = s.threaded
        ? (s.system === 'metric' ? `M${s.mSize}` : `${s.uSize} ${s.uSeries}`)
        : `dia ${s.diameter}`;
    label(g, mainName, cxh - w1 / 2 - 8, top - 14, cxh, top + 3, 'end');
    if (!s.thru && s.holeDepth != null) label(g, `depth ${s.holeDepth}`, cxh + w1 / 2 + 46, bot - 26, cxh + w1 / 2 + 2, top + clamp(s.holeDepth * 2.4, 45, 118) - 4);

    g.appendChild(txt('SECTION', 690, 632, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
}

function label(g, str, tx, ty, lx, ly, anchor = 'start') {
    g.appendChild(el('line', { x1: tx + (anchor === 'end' ? 4 : -4), y1: ty - 4, x2: lx, y2: ly, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
    g.appendChild(txt(str, tx, ty, { size: 12, fill: '#475569', mono: true, anchor }));
}

// ==========================================================================
// RENDERER 3 — THE SENTENCE + GOTCHAS
// ==========================================================================
function renderSentence(g, s) {
    const parts = [];
    const n = s.count > 1 ? s.count : 1;

    if (s.threaded) {
        if (s.system === 'metric') {
            const coarse = COARSE[s.mSize] === s.mPitch ? ' (coarse)' : ' (fine)';
            parts.push(`${n} threaded hole${n > 1 ? 's' : ''}: M${s.mSize} metric thread, ${s.mPitch} mm pitch${coarse}, tolerance class ${s.mClass} (internal)`);
        } else {
            parts.push(`${n} threaded hole${n > 1 ? 's' : ''}: ${s.uSize} in nominal, ${s.uTpi} threads per inch, ${s.uSeries === 'UNC' ? 'coarse' : 'fine'} series, class ${s.uClass}`);
        }
    } else {
        parts.push(`${n} hole${n > 1 ? 's' : ''}, ${s.diameter} mm diameter`);
    }

    parts.push(s.thru ? 'through the part' : s.holeDepth != null ? `${s.holeDepth} mm deep (blind)` : 'depth not specified');

    if (s.feature === 'cbore') parts.push(`each counterbored to ${s.cboreDia} mm diameter, ${s.cboreDepth} mm deep`);
    if (s.feature === 'csink') parts.push(`each countersunk to ${s.csinkDia} mm diameter at ${s.csinkAngle} degrees included angle`);
    if (s.feature === 'spotface') parts.push(`each spotfaced to ${s.sfDia} mm diameter${s.sfDepth != null ? `, ${s.sfDepth} mm deep` : ' (depth: clean-up only)'}`);

    if (s.pattern === 'bc') parts.push(`${s.eqsp ? 'equally spaced ' : ''}on a ${s.bcDia} mm bolt circle`);

    const sentence = parts.join(', ') + '.';
    wrapText(g, sentence.charAt(0).toUpperCase() + sentence.slice(1), 40, 680, 900, 19, '#0f172a', 26);

    let gy = 680 + 26 * Math.ceil(sentence.length / 88) + 14;
    const fired = GOTCHAS.filter(x => x.when(s)).slice(0, 4);
    for (const gotcha of fired) {
        g.appendChild(el('path', { d: `M40 ${gy - 4} l7 -12 l7 12 Z`, fill: '#f59e0b' }));
        wrapText(g, gotcha.text(state), 62, gy, 880, 13, '#b45309', 17);
        gy += 17 * Math.ceil(gotcha.text(state).length / 130) + 6;
    }
}

function wrapText(g, str, x, y, maxW, size, fill, lineH) {
    const perLine = Math.floor(maxW / (size * 0.52));
    const words = str.split(' ');
    let line = '', ly = y;
    for (const w of words) {
        if ((line + ' ' + w).trim().length > perLine) {
            g.appendChild(txt(line.trim(), x, ly, { size, fill }));
            line = w; ly += lineH;
        } else line = (line + ' ' + w).trim();
    }
    if (line) g.appendChild(txt(line, x, ly, { size, fill }));
}

// ==========================================================================
// loadControls(container)
// ==========================================================================
export function loadControls(container) {
    controlsRoot = container;
    container.innerHTML = `
    <div class="space-y-5">
      ${section('Hole', `
        <div class="grid grid-cols-2 gap-2">
          ${num('count', 'Count (nX)', 8)}
          <div data-when="plain">${num('diameter', 'Diameter (mm)', 10.5)}</div>
        </div>
        <label class="flex items-center gap-2 text-sm mt-2"><input type="checkbox" id="hc-threaded"> Threaded hole</label>
        <div data-when="threaded" class="mt-2 space-y-2">
          ${sel('system', 'Thread system', [['metric', 'Metric (M)'], ['unified', 'Unified (UNC/UNF)']])}
          <div data-when="metric" class="grid grid-cols-3 gap-2">
            ${num('mSize', 'M size', 12)}${num('mPitch', 'Pitch', 1.75)}${text('mClass', 'Class', '6H')}
          </div>
          <div data-when="unified" class="grid grid-cols-2 gap-2">
            ${text('uSize', 'Size (in)', '3/8')}${num('uTpi', 'TPI', 16)}
            ${sel('uSeries', 'Series', [['UNC', 'UNC — coarse'], ['UNF', 'UNF — fine']])}${text('uClass', 'Class', '2B')}
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm mt-2"><input type="checkbox" id="hc-thru" checked> THRU</label>
        <div data-when="blind" class="mt-2">${num('holeDepth', 'Depth (mm)', '')}</div>`)}
      ${section('Feature', `
        ${sel('feature', 'Feature', [['none', 'None'], ['cbore', 'Counterbore'], ['csink', 'Countersink'], ['spotface', 'Spotface']])}
        <div data-when="cbore" class="grid grid-cols-2 gap-2 mt-2">${num('cboreDia', 'C-bore dia', 18)}${num('cboreDepth', 'C-bore depth', 11)}</div>
        <div data-when="csink" class="grid grid-cols-2 gap-2 mt-2">${num('csinkDia', 'C-sink dia', 20)}${num('csinkAngle', 'Included angle', 90)}</div>
        <div data-when="spotface" class="grid grid-cols-2 gap-2 mt-2">${num('sfDia', 'SF dia', 20)}${num('sfDepth', 'SF depth (blank = clean-up)', '')}</div>`)}
      ${section('Pattern', `
        ${sel('pattern', 'Pattern', [['none', 'None / linear'], ['bc', 'Bolt circle']])}
        <div data-when="bc" class="mt-2">
          ${num('bcDia', 'B.C. diameter (mm)', 120)}
          <label class="flex items-center gap-2 text-sm mt-2"><input type="checkbox" id="hc-eqsp" checked> EQ SP (equally spaced)</label>
        </div>`)}
      ${section('Local Notes (MTM)', `
        <textarea id="hc-notes" rows="3" placeholder="Shop-specific interpretations\u2026" class="${INPUT}"></textarea>
        <p class="text-[10px] text-slate-400 mt-1">Saved on this machine automatically.</p>`)}
    </div>`;

    ['system', 'feature', 'pattern', 'uSeries'].forEach(bindSel);
    [['count', 8], ['diameter', 10.5], ['holeDepth', null], ['cboreDia', 18], ['cboreDepth', 11],
     ['csinkDia', 20], ['csinkAngle', 90], ['sfDia', 20], ['sfDepth', null],
     ['bcDia', 120], ['mSize', 12], ['mPitch', 1.75], ['uTpi', 16]].forEach(([k, d]) => bindNum(k, d));
    ['mClass', 'uSize', 'uClass'].forEach(bindText);
    ['threaded', 'thru', 'eqsp'].forEach(bindChk);

    const notes = container.querySelector('#hc-notes');
    notes.value = localStorage.getItem('decoder_notes_hole_callouts') || '';
    notes.oninput = () => localStorage.setItem('decoder_notes_hole_callouts', notes.value);

    update();

    function bindSel(key) {
        const e = container.querySelector(`#hc-${key}`);
        e.value = state[key];
        e.onchange = () => { state[key] = e.value; update(); };
    }
    function bindNum(key, dflt) {
        const e = container.querySelector(`#hc-${key}`);
        e.oninput = () => {
            const v = parseFloat(e.value);
            state[key] = e.value === '' ? dflt : (Number.isFinite(v) ? v : state[key]);
            update();
        };
    }
    function bindText(key) {
        const e = container.querySelector(`#hc-${key}`);
        e.oninput = () => { state[key] = e.value; update(); };
    }
    function bindChk(key) {
        const e = container.querySelector(`#hc-${key}`);
        e.checked = !!state[key];
        e.onchange = () => { state[key] = e.checked; update(); };
    }
}

const INPUT = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white';
function section(title, body) {
    return `<div><p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">${title}</p>${body}</div>`;
}
function sel(key, label, opts) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <select id="hc-${key}" class="${INPUT}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`;
}
function num(key, label, val) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="hc-${key}" type="number" step="any" value="${val}" class="${INPUT}"></div>`;
}
function text(key, label, val) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="hc-${key}" type="text" value="${val}" class="${INPUT}"></div>`;
}

function syncControlVisibility() {
    if (!controlsRoot) return;
    const conds = {
        plain: !state.threaded,
        threaded: state.threaded,
        metric: state.threaded && state.system === 'metric',
        unified: state.threaded && state.system === 'unified',
        blind: !state.thru,
        cbore: state.feature === 'cbore',
        csink: state.feature === 'csink',
        spotface: state.feature === 'spotface',
        bc: state.pattern === 'bc'
    };
    controlsRoot.querySelectorAll('[data-when]').forEach(e => {
        e.classList.toggle('hidden', !conds[e.dataset.when]);
    });
}
