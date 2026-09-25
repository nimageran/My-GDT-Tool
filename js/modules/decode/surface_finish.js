// modules/decode/surface_finish.js
// ============================================================================
// SURFACE FINISH DECODER: per DECODER_SPEC.md (roadmap #3)
// ISO 1302 complete graphical symbol: removal required / prohibited / any,
// requirement a (and b): U/L limit, parameter (Ra, Rz, Rq, Rt, Rz1max),
// cut-off λc, evaluation length, 16% or max rule; c: process; d: lay;
// e: machining allowance; all around. Plus the US legacy style
// (ASME Y14.36M-1996: Ra value only, µin or µm).
// Standards: ISO 1302:2002, ISO 4288 (default cut-offs), ASME Y14.36.
// Exports: draw(canvas), loadControls(container)   [shell contract §1]
// ============================================================================

import { el, surfaceTexture, laySymbol } from './symbols.js';

// --------------------------------------------------------------------------
// STATE
// --------------------------------------------------------------------------
const state = {
    style: 'iso',            // 'iso' | 'asme' (US legacy)
    removal: 'required',     // 'any' | 'required' | 'prohibited'
    allAround: false,
    // Requirement a (ISO)
    limit: 'U',              // 'U' upper | 'L' lower
    param: 'Ra',             // 'Ra' | 'Rz' | 'Rq' | 'Rt' | 'Rz1max'
    value: 1.6,              // µm; null = no value
    rule: '16%',             // '16%' (default) | 'max'
    cutoff: 'default',       // 'default' | '0.08' | '0.25' | '0.8' | '2.5' | '8'
    evalLengths: 5,          // number of sampling lengths (5 = default, not written)
    // Requirement b (ISO, optional)
    second: false,
    limitB: 'L', paramB: 'Ra', valueB: 0.4,
    // US legacy
    usMax: 63, usMin: null, usUnits: 'µin',
    // c, d, e
    process: '',
    lay: 'none',             // 'none' | '=' | 'perp' | 'X' | 'M' | 'C' | 'R' | 'P'
    allowance: null          // mm
};

const PARAMS = {
    Ra: 'arithmetic mean roughness',
    Rz: 'mean peak-to-valley height',
    Rq: 'root-mean-square roughness',
    Rt: 'total peak-to-valley height',
    Rz1max: 'largest single peak-to-valley height'
};
const LAY_NAME = { '=': 'parallel', perp: 'perpendicular', X: 'crossed', M: 'multidirectional', C: 'circular', R: 'radial', P: 'particulate' };
const LAY_TEXT = {
    '=': 'parallel to the edge of the view where the symbol sits',
    perp: 'perpendicular to the edge of the view where the symbol sits',
    X: 'crossed in two oblique directions',
    M: 'multidirectional',
    C: 'roughly circular about the center',
    R: 'roughly radial from the center',
    P: 'particulate, non-directional (e.g. blasted or EDM)'
};

// ISO 4288 default cut-off λc (mm) for periodic/non-periodic profiles
function defaultCutoff(param, v) {
    if (v == null) return null;
    if (param === 'Ra' || param === 'Rq') {
        if (v <= 0.02) return 0.08;
        if (v <= 0.1) return 0.25;
        if (v <= 2) return 0.8;
        if (v <= 10) return 2.5;
        return 8;
    }
    if (v <= 0.1) return 0.08;
    if (v <= 0.5) return 0.25;
    if (v <= 10) return 0.8;
    if (v <= 50) return 2.5;
    return 8;
}

// Typical processes for an Ra value in µm (rule of thumb)
function typicalProcess(raUm) {
    if (raUm <= 0.1) return 'lapping, polishing or superfinishing';
    if (raUm <= 0.4) return 'grinding or honing';
    if (raUm <= 0.8) return 'fine grinding, fine turning or reaming';
    if (raUm <= 1.6) return 'finish turning, milling or reaming';
    if (raUm <= 3.2) return 'general turning or milling';
    if (raUm <= 6.3) return 'rough turning, milling or drilling';
    if (raUm <= 12.5) return 'rough machining or sawing';
    return 'casting, forging or flame cutting';
}

// The requirement's value expressed as an equivalent Ra in µm
function raEquivalentUm(s) {
    if (s.style === 'asme') {
        if (s.usMax == null) return null;
        return s.usUnits === 'µin' ? s.usMax * 0.0254 : s.usMax;
    }
    if (s.value == null) return null;
    if (s.param === 'Ra') return s.value;
    if (s.param === 'Rq') return s.value / 1.25;          // Rq ≈ 1.25 Ra (Gaussian)
    return s.value / 5;                                     // Rz/Rt ≈ 4–7 × Ra: use 5
}

const fmtNum = v => String(+v.toFixed(4));

// ISO text for requirement a / b, e.g. "U -0.8/Rz3 max 6.3"
function isoText(limit, param, value, { rule = '16%', cutoff = 'default', evalLengths = 5, showLimit = false } = {}) {
    if (value == null) return '';
    const parts = [];
    if (showLimit) parts.push(limit);
    const band = cutoff !== 'default' ? `-${cutoff}/` : '';
    const n = evalLengths !== 5 ? String(evalLengths) : '';
    parts.push(`${band}${param}${n}`);
    if (rule === 'max') parts.push('max');
    parts.push(fmtNum(value));
    return parts.join(' ');
}

// --------------------------------------------------------------------------
// GOTCHAS (spec §5)
// --------------------------------------------------------------------------
const GOTCHAS = [
    { when: s => s.removal === 'prohibited' && (s.style === 'iso' ? s.value != null : s.usMax != null),
      text: () => 'Removal prohibited: the as-cast / as-forged surface must meet the value by itself. Nobody may machine it to make it comply.' },
    { when: s => s.style === 'asme' && s.usUnits === 'µin',
      text: s => `US drawings: the number is Ra in microinches. ${s.usMax} µin ≈ ${(s.usMax * 0.0254).toFixed(2)} µm (1 µin = 0.0254 µm).` },
    { when: s => s.style === 'iso' && s.rule === 'max',
      text: () => '"max" rule: no single measured value may exceed the limit. Stricter than the default 16% rule; inspect the whole surface.' },
    { when: s => s.style === 'iso' && ['Rz', 'Rt', 'Rz1max'].includes(s.param),
      text: s => `${s.param} is not Ra: peak-to-valley values are roughly 4 to 7 times Ra for machined surfaces. Don't compare ${s.param} ${s.value ?? ''} with an Ra reading.` },
    { when: s => s.style === 'iso' && s.second,
      text: () => 'Two limits: the value must stay between L and U. Too smooth also fails (e.g. for oil retention or paint and coating adhesion).' },
    { when: s => s.lay !== 'none',
      text: () => 'Lay is relative to the view: it refers to the edge of the view the symbol is attached to, not to the part in general.' },
    { when: s => s.allowance != null,
      text: s => `Machining allowance ${s.allowance} mm: stock left on for this machining step (typical on castings and forgings), not a roughness value.` },
    { when: s => s.allAround,
      text: () => 'All around applies to the outline in this view only, not to the front and back faces.' },
    { when: s => s.removal === 'any' && (s.style === 'iso' ? s.value == null : s.usMax == null),
      text: () => 'A bare basic symbol with no value means nothing by itself; it is used only with a note or as a reference.' },
    { when: s => s.style === 'iso' && s.value != null && s.rule === '16%',
      text: () => 'ISO default 16% rule: up to 16% of the measured values may exceed the limit and the surface still passes. Write "max" to forbid any.' },
    { when: s => s.style === 'iso' && s.value != null && s.cutoff === 'default',
      text: s => `No cut-off written: use the ISO 4288 default for this value, λc = ${defaultCutoff(s.param, s.value)} mm. A different instrument setting gives a different reading.` },
];

// --------------------------------------------------------------------------
let canvasRef = null, zones = null, controlsRoot = null;

export function draw(canvas) {
    canvasRef = canvas;
    [[260, 'WHAT IT COMMANDS'], [640, 'IN PLAIN ENGLISH']].forEach(([y, label]) => {
        canvas.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#e2e8f0', 'stroke-width': 1 }));
        canvas.appendChild(txt(label, 40, y + 20, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    });
    canvas.appendChild(txt('SYMBOL', 40, 24, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    zones = { symbol: el('g'), preview: el('g'), sentence: el('g') };
    Object.values(zones).forEach(z => canvas.appendChild(z));
    update();
}

function update() {
    if (!zones) return;
    Object.values(zones).forEach(z => { while (z.firstChild) z.removeChild(z.firstChild); });
    renderSymbol(zones.symbol, state);
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
    if (o.italic) t.setAttribute('font-style', 'italic');
    if (o.spacing) t.setAttribute('letter-spacing', o.spacing);
    t.textContent = str;
    return t;
}
const S = { stroke: '#0f172a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function label(g, str, tx, ty, lx, ly, anchor = 'start') {
    g.appendChild(el('line', { x1: tx + (anchor === 'end' ? 4 : -4), y1: ty - 4, x2: lx, y2: ly, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
    g.appendChild(txt(str, tx, ty, { size: 12, fill: '#475569', mono: true, anchor }));
}

// ==========================================================================
// RENDERER 1: THE SYMBOL (ISO 1302 positions a, b, c, d, e)
// ==========================================================================
function renderSymbol(g, s) {
    const h = 110;
    const vx = 330, vy = 215;                          // vertex on the surface
    const c = Math.cos(Math.PI / 3), sn = Math.sin(Math.PI / 3);
    const L1 = h * 0.55, L2 = h * 1.1;                  // matches surfaceTexture()
    const top = { x: vx + L2 * c, y: vy - L2 * sn };

    // The part surface the symbol sits on
    g.appendChild(el('line', { x1: vx - 160, y1: vy, x2: vx + 260, y2: vy, stroke: '#64748b', 'stroke-width': 3 }));
    g.appendChild(txt('surface (edge in this view)', vx - 160, vy + 18, { size: 11, fill: '#94a3b8', italic: true }));

    g.appendChild(surfaceTexture(vx, vy, h, { removal: s.removal, allAround: s.allAround }));

    const iso = s.style === 'iso';
    const aText = iso ? isoText(s.limit, s.param, s.value, { rule: s.rule, cutoff: s.cutoff, evalLengths: s.evalLengths, showLimit: s.second || s.limit === 'L' }) : '';
    const bText = iso && s.second ? isoText(s.limitB, s.paramB, s.valueB, { showLimit: true }) : '';
    const needsExtension = (iso && (aText || bText)) || s.process;
    const textLen = Math.max(aText.length, bText.length, s.process.length);
    const extLen = Math.max(L1 * 1.2, textLen * 10 + 28);
    if (needsExtension) {
        g.appendChild(el('line', { ...S, x1: top.x, y1: top.y, x2: top.x + extLen, y2: top.y }));
    }

    // a / b under the extension line, c above it
    if (aText) {
        g.appendChild(txt(aText, top.x + 8, top.y + 22, { size: 17, mono: true, bold: true }));
        label(g, 'a · requirement', 720, top.y + 18, top.x + 12 + aText.length * 10.2, top.y + 14);
    }
    if (bText) {
        g.appendChild(txt(bText, top.x + 8, top.y + 46, { size: 17, mono: true, bold: true }));
        label(g, 'b · second requirement', 720, top.y + 46, top.x + 12 + bText.length * 10.2, top.y + 40);
    }
    if (s.process) {
        g.appendChild(txt(s.process, top.x + 20, top.y - 9, { size: 16, italic: true }));
        label(g, 'c · manufacturing method', 720, top.y - 24, top.x + 24 + s.process.length * 8.4, top.y - 14);
    }

    // US legacy: Ra value(s) to the left of the long leg, above the V
    if (!iso && s.usMax != null) {
        const unit = s.usUnits;
        if (s.usMin != null) {
            g.appendChild(txt(fmtNum(s.usMax), vx + 12, vy - 72, { size: 17, mono: true, bold: true, anchor: 'end' }));
            g.appendChild(txt(fmtNum(s.usMin), vx + 12, vy - 52, { size: 17, mono: true, bold: true, anchor: 'end' }));
            label(g, `max / min Ra (${unit})`, 110, vy - 78, vx - 40, vy - 70, 'start');
        } else {
            g.appendChild(txt(fmtNum(s.usMax), vx + 12, vy - 62, { size: 17, mono: true, bold: true, anchor: 'end' }));
            label(g, `max Ra (${unit})`, 110, vy - 78, vx - 36, vy - 68, 'start');
        }
    }

    // d: lay, to the right of the V near the bottom
    if (s.lay !== 'none') {
        g.appendChild(laySymbol(s.lay, vx + 34, vy - 16, 22));
        label(g, 'd · lay', 720, vy - 6, vx + 50, vy - 16);
    }
    // e: machining allowance, left of the V
    if (s.allowance != null) {
        g.appendChild(txt(fmtNum(s.allowance), vx - L1 * c - 10, vy - 8, { size: 17, mono: true, bold: true, anchor: 'end' }));
        label(g, 'e · machining allowance', 110, vy - 30, vx - L1 * c - 36, vy - 16, 'start');
    }
    if (s.allAround) {
        label(g, 'all around (this outline)', 720, top.y - 50, top.x + 6, top.y - 6);
    }
    const kind = { any: 'any process allowed', required: 'material removal required', prohibited: 'material removal prohibited' }[s.removal];
    label(g, kind, 110, vy - 120, vx - 6, vy - 50, 'start');
}

// ==========================================================================
// RENDERER 2: THE PREVIEW (surface patch with lay + magnified profile)
// ==========================================================================
function renderPreview(g, s) {
    drawSurfacePatch(g, s);
    drawProfile(g, s);
}

// Deterministic pseudo-random numbers so the drawing doesn't flicker
function rng(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function drawSurfacePatch(g, s) {
    // Isometric block: top face A-B-C-D, front A-B-B'-A', side B-C-C'-B'
    const A = { x: 70, y: 470 }, B = { x: 330, y: 470 }, C = { x: 420, y: 400 }, D = { x: 160, y: 400 };
    const depth = 90;
    const down = p => ({ x: p.x, y: p.y + depth });
    const poly = pts => pts.map(p => `${p.x},${p.y}`).join(' ');
    const prohibited = s.removal === 'prohibited';

    const topFill = prohibited ? '#a8a29e' : s.removal === 'required' ? '#dde3ea' : '#cbd5e1';
    g.appendChild(el('polygon', { points: poly([A, B, down(B), down(A)]), fill: '#b8b6ad', stroke: '#475569', 'stroke-width': 1.5 }));
    g.appendChild(el('polygon', { points: poly([B, C, down(C), down(B)]), fill: '#9f9d95', stroke: '#475569', 'stroke-width': 1.5 }));
    g.appendChild(el('polygon', { points: poly([A, B, C, D]), fill: topFill, stroke: '#475569', 'stroke-width': 1.5 }));

    // Texture is clipped to the top face
    const defs = el('defs');
    const clip = el('clipPath', { id: 'sfin-top' });
    clip.appendChild(el('polygon', { points: poly([A, B, C, D]) }));
    defs.appendChild(clip);
    g.appendChild(defs);
    const tex = el('g', { 'clip-path': 'url(#sfin-top)' });

    const P = (u, v) => ({ x: A.x + u * (B.x - A.x) + v * (D.x - A.x), y: A.y + u * (B.y - A.y) + v * (D.y - A.y) });
    const mark = { stroke: prohibited ? '#78716c' : '#64748b', 'stroke-width': 1, opacity: 0.75 };
    const line = (u1, v1, u2, v2) => { const p = P(u1, v1), q = P(u2, v2); tex.appendChild(el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, ...mark })); };
    const rand = rng(7);

    if (prohibited) {
        // As-cast / as-forged: grainy, no tool marks
        for (let i = 0; i < 420; i++) {
            const p = P(rand(), rand());
            tex.appendChild(el('circle', { cx: p.x, cy: p.y, r: 0.6 + rand() * 1.1, fill: rand() > 0.5 ? '#57534e' : '#d6d3d1', opacity: 0.7 }));
        }
    } else {
        const lay = s.lay === 'none' ? (s.removal === 'required' ? '=' : 'M') : s.lay;
        const n = 22;
        if (lay === '=') for (let i = 1; i < n; i++) line(0, i / n, 1, i / n);
        if (lay === 'perp') for (let i = 1; i < n; i++) line(i / n, 0, i / n, 1);
        if (lay === 'X') for (let i = -n; i < 2 * n; i += 2) { line(i / n, 0, (i + n) / n, 1); line((i + n) / n, 0, i / n, 1); }
        if (lay === 'M') for (let i = 0; i < 160; i++) { const u = rand(), v = rand(), a = rand() * Math.PI, l = 0.04 + rand() * 0.05; line(u, v, u + Math.cos(a) * l, v + Math.sin(a) * l); }
        if (lay === 'C') for (let r = 0.05; r < 0.5; r += 0.035) {
            let d = '';
            for (let k = 0; k <= 48; k++) { const t = (k / 48) * 2 * Math.PI, p = P(0.5 + r * Math.cos(t), 0.5 + r * Math.sin(t)); d += `${k ? 'L' : 'M'}${p.x},${p.y} `; }
            tex.appendChild(el('path', { d, fill: 'none', ...mark }));
        }
        if (lay === 'R') for (let k = 0; k < 36; k++) { const t = (k / 36) * 2 * Math.PI; line(0.5, 0.5, 0.5 + 0.48 * Math.cos(t), 0.5 + 0.48 * Math.sin(t)); }
        if (lay === 'P') for (let i = 0; i < 260; i++) { const p = P(rand(), rand()); tex.appendChild(el('circle', { cx: p.x, cy: p.y, r: 1 + rand(), fill: '#64748b', opacity: 0.6 })); }
    }
    g.appendChild(tex);

    // Machining allowance: translucent stock layer above the finished face
    if (s.allowance != null) {
        const up = p => ({ x: p.x, y: p.y - 20 });
        g.appendChild(el('polygon', { points: poly([up(A), up(B), up(C), up(D)]), fill: 'rgba(239,159,39,0.25)', stroke: '#854F0B', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }));
        g.appendChild(el('polygon', { points: poly([A, B, up(B), up(A)]), fill: 'rgba(239,159,39,0.35)', stroke: '#854F0B', 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }));
        g.appendChild(txt(`${fmtNum(s.allowance)} mm stock to remove`, C.x + 12, C.y - 10, { size: 12, fill: '#854F0B', bold: true }));
    }

    // The view edge the lay refers to
    g.appendChild(el('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#2563eb', 'stroke-width': 3 }));
    g.appendChild(txt('edge seen in the view (symbol attached here)', A.x, A.y + depth + 22, { size: 11.5, fill: '#2563eb' }));
    const caption = prohibited ? 'As produced: no machining allowed'
        : s.removal === 'required' ? `Machined surface${s.lay !== 'none' ? `, lay ${LAY_NAME[s.lay]}` : ''}`
            : 'Any process';
    g.appendChild(txt(caption.toUpperCase(), A.x, 300, { size: 11, fill: '#64748b', bold: true, spacing: 1 }));
}

function drawProfile(g, s) {
    const X0 = 500, W = 450, Y0 = 440, AMP = 62;
    const iso = s.style === 'iso';
    const param = iso ? s.param : 'Ra';
    const value = iso ? s.value : s.usMax;
    const unit = iso ? 'µm' : s.usUnits;
    const nSeg = iso ? s.evalLengths : 5;

    g.appendChild(txt('ROUGHNESS PROFILE (VERTICAL GREATLY MAGNIFIED)', X0, 300, { size: 11, fill: '#64748b', bold: true, spacing: 1 }));

    // Synthetic machined profile: a few harmonics + noise, seeded
    const rand = rng(11);
    const comps = Array.from({ length: 6 }, (_, k) => ({ f: 4 + k * 5 + rand() * 3, a: 1 / (1 + k * 0.7), p: rand() * 6.28 }));
    const N = 400;
    const z = Array.from({ length: N + 1 }, (_, i) => {
        const x = i / N;
        return comps.reduce((sum, c) => sum + c.a * Math.sin(2 * Math.PI * c.f * x + c.p), 0) + (rand() - 0.5) * 0.35;
    });
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const zc = z.map(v => v - mean);
    const peak = Math.max(...zc.map(Math.abs));
    const k = AMP / peak;                                   // px per profile unit
    const X = i => X0 + (i / N) * W;
    const Y = v => Y0 - v * k;

    // Mean line and profile
    g.appendChild(el('line', { x1: X0, y1: Y0, x2: X0 + W, y2: Y0, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '6 4' }));
    g.appendChild(txt('mean line', X0 + W + 4, Y0 + 4, { size: 10.5, fill: '#94a3b8' }));
    let d = '';
    zc.forEach((v, i) => { d += `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)} `; });
    g.appendChild(el('path', { d, fill: 'none', stroke: '#0f172a', 'stroke-width': 1.6 }));

    // Sampling lengths (λc each)
    for (let sgm = 1; sgm < nSeg; sgm++) {
        const x = X0 + (sgm / nSeg) * W;
        g.appendChild(el('line', { x1: x, y1: Y0 - AMP - 14, x2: x, y2: Y0 + AMP + 8, stroke: '#cbd5e1', 'stroke-width': 1 }));
    }
    const cutoff = iso ? (s.cutoff === 'default' ? defaultCutoff(s.param, s.value) : +s.cutoff) : null;
    const lenLabel = cutoff ? `${nSeg} × λc ${cutoff} mm = ${fmtNum(nSeg * cutoff)} mm evaluation length` : `${nSeg} sampling lengths (evaluation length)`;
    g.appendChild(txt(lenLabel, X0, Y0 + AMP + 30, { size: 11.5, fill: '#475569' }));

    // What the parameter measures
    const band = (h, color, labelStr) => {
        g.appendChild(el('rect', { x: X0, y: Y0 - h, width: W, height: 2 * h, fill: color, opacity: 0.12 }));
        g.appendChild(el('line', { x1: X0, y1: Y0 - h, x2: X0 + W, y2: Y0 - h, stroke: color, 'stroke-width': 1.4 }));
        g.appendChild(el('line', { x1: X0, y1: Y0 + h, x2: X0 + W, y2: Y0 + h, stroke: color, 'stroke-width': 1.4 }));
        g.appendChild(txt(labelStr, X0, Y0 - AMP - 22, { size: 12.5, fill: color, bold: true }));
    };
    const vtxt = value != null ? `${param} ${fmtNum(value)} ${unit}` : param;
    if (param === 'Ra') {
        const ra = zc.reduce((a, v) => a + Math.abs(v), 0) / zc.length;
        band(ra * k, '#2563eb', `${vtxt} = average distance from the mean line`);
    } else if (param === 'Rq') {
        const rq = Math.sqrt(zc.reduce((a, v) => a + v * v, 0) / zc.length);
        band(rq * k, '#2563eb', `${vtxt} = RMS distance from the mean line`);
    } else {
        // Peak-to-valley per sampling length (Rz, Rz1max) or over all (Rt)
        const seg = Math.floor(N / nSeg);
        const heights = [];
        for (let sgm = 0; sgm < nSeg; sgm++) {
            const part = zc.slice(sgm * seg, (sgm + 1) * seg + 1);
            const hi = Math.max(...part), lo = Math.min(...part);
            heights.push(hi - lo);
            if (param !== 'Rt') {
                const xm = X0 + ((sgm + 0.5) / nSeg) * W;
                g.appendChild(el('line', { x1: xm, y1: Y(hi), x2: xm, y2: Y(lo), stroke: '#2563eb', 'stroke-width': 2 }));
                g.appendChild(el('line', { x1: xm - 8, y1: Y(hi), x2: xm + 8, y2: Y(hi), stroke: '#2563eb', 'stroke-width': 2 }));
                g.appendChild(el('line', { x1: xm - 8, y1: Y(lo), x2: xm + 8, y2: Y(lo), stroke: '#2563eb', 'stroke-width': 2 }));
            }
        }
        if (param === 'Rt') {
            const hi = Math.max(...zc), lo = Math.min(...zc);
            g.appendChild(el('line', { x1: X0 + W - 20, y1: Y(hi), x2: X0 + W - 20, y2: Y(lo), stroke: '#2563eb', 'stroke-width': 2 }));
            g.appendChild(txt(`${vtxt} = highest peak to lowest valley, whole length`, X0, Y0 - AMP - 22, { size: 12.5, fill: '#2563eb', bold: true }));
        } else {
            const what = param === 'Rz' ? `average of the ${nSeg} blue peak-to-valley bars` : `largest of the ${nSeg} blue peak-to-valley bars`;
            g.appendChild(txt(`${vtxt} = ${what}`, X0, Y0 - AMP - 22, { size: 12.5, fill: '#2563eb', bold: true }));
        }
    }
}

// ==========================================================================
// RENDERER 3: THE SENTENCE + GOTCHAS
// ==========================================================================
function renderSentence(g, s) {
    const parts = [];
    const iso = s.style === 'iso';
    const hasValue = iso ? s.value != null : s.usMax != null;

    if (s.removal === 'required') parts.push('Machine this surface (material removal required)');
    else if (s.removal === 'prohibited') parts.push('Leave this surface as produced, do not machine it');
    else parts.push('Any process may make this surface');

    if (hasValue) {
        if (iso) {
            const word = s.limit === 'L' && !s.second ? 'at least' : 'at most';
            let req = `${s.param} ${word} ${fmtNum(s.value)} µm (${PARAMS[s.param]})`;
            if (s.second) {
                const [lo, hi] = s.limit === 'U' ? [[s.paramB, s.valueB], [s.param, s.value]] : [[s.param, s.value], [s.paramB, s.valueB]];
                req = `${hi[0]} at most ${fmtNum(hi[1])} µm and ${lo[0]} at least ${fmtNum(lo[1])} µm`;
            }
            parts.push(req);
            const lc = s.cutoff === 'default' ? `${defaultCutoff(s.param, s.value)} mm (ISO 4288 default)` : `${s.cutoff} mm`;
            parts.push(`${s.rule === 'max' ? 'no single reading may exceed it' : '16% rule'}, cut-off λc ${lc}${s.evalLengths !== 5 ? `, over ${s.evalLengths} sampling lengths` : ''}`);
        } else {
            const range = s.usMin != null ? `between ${fmtNum(s.usMin)} and ${fmtNum(s.usMax)}` : `at most ${fmtNum(s.usMax)}`;
            parts.push(`roughness Ra ${range} ${s.usUnits}`);
        }
        const raUm = raEquivalentUm(s);
        if (raUm != null && s.removal !== 'prohibited') parts.push(`typically achieved by ${typicalProcess(raUm)}`);
    }
    if (s.process) parts.push(`made by ${s.process}`);
    if (s.lay !== 'none') parts.push(`lay ${LAY_TEXT[s.lay]}`);
    if (s.allowance != null) parts.push(`leave ${fmtNum(s.allowance)} mm machining allowance`);
    if (s.allAround) parts.push('all around the outline in this view');

    const sentence = parts.join('; ') + '.';
    const long = sentence.length > 220;
    const lastY = wrapText(g, sentence, 40, 680, 900, long ? 15 : 17, '#0f172a', long ? 20 : 23);

    let gy = lastY + 24;
    const fired = GOTCHAS.filter(x => x.when(s)).slice(0, 3);
    for (const gotcha of fired) {
        if (gy > 780) break;
        g.appendChild(el('path', { d: `M40 ${gy - 4} l7 -12 l7 12 Z`, fill: '#f59e0b' }));
        gy = wrapText(g, gotcha.text(s), 62, gy, 880, 13, '#b45309', 17) + 23;
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
    return ly;
}

// ==========================================================================
// loadControls(container)
// ==========================================================================
export function loadControls(container) {
    controlsRoot = container;
    const paramOpts = Object.keys(PARAMS).map(p => [p, p]);
    container.innerHTML = `
    <div class="space-y-5">
      ${section('Drawing style', `
        ${sel('style', 'Standard', [['iso', 'ISO 1302 (and ASME Y14.36-2018)'], ['asme', 'US legacy (ASME Y14.36M-1996)']])}`)}
      ${section('Symbol', `
        ${sel('removal', 'Mark', [['required', 'Material removal required (bar)'], ['any', 'Any process (basic)'], ['prohibited', 'Removal prohibited (circle)']])}
        <label class="flex items-center gap-2 text-sm mt-2"><input type="checkbox" id="sfin-allAround"> All around (circle at the corner)</label>`)}
      <div data-when="iso">${section('Requirement a', `
        <div class="grid grid-cols-3 gap-2">
          ${sel('limit', 'Limit', [['U', 'U (upper)'], ['L', 'L (lower)']])}
          ${sel('param', 'Parameter', paramOpts)}
          ${num('value', 'Value (µm)', state.value)}
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2">
          ${sel('rule', 'Rule', [['16%', '16% (default)'], ['max', 'max']])}
          ${sel('cutoff', 'Cut-off λc (mm)', [['default', 'default'], ['0.08', '0.08'], ['0.25', '0.25'], ['0.8', '0.8'], ['2.5', '2.5'], ['8', '8']])}
          ${num('evalLengths', 'Sampling lengths', 5)}
        </div>
        <label class="flex items-center gap-2 text-sm mt-3"><input type="checkbox" id="sfin-second"> Second requirement b (two limits)</label>
        <div data-when="second" class="grid grid-cols-3 gap-2 mt-2">
          ${sel('limitB', 'Limit', [['L', 'L (lower)'], ['U', 'U (upper)']])}
          ${sel('paramB', 'Parameter', paramOpts)}
          ${num('valueB', 'Value (µm)', state.valueB)}
        </div>`)}</div>
      <div data-when="asme">${section('Roughness (US legacy)', `
        <div class="grid grid-cols-3 gap-2">
          ${num('usMax', 'Max Ra', state.usMax)}
          ${num('usMin', 'Min Ra (optional)', '')}
          ${sel('usUnits', 'Units', [['µin', 'µin'], ['µm', 'µm']])}
        </div>`)}</div>
      ${section('Process, lay, allowance', `
        ${textIn('process', 'Manufacturing method (c)', '')}
        <div class="grid grid-cols-2 gap-2 mt-2">
          ${sel('lay', 'Lay (d)', [['none', 'None'], ['=', '= parallel'], ['perp', '⊥ perpendicular'], ['X', 'X crossed'], ['M', 'M multidirectional'], ['C', 'C circular'], ['R', 'R radial'], ['P', 'P particulate']])}
          ${num('allowance', 'Machining allowance (e), mm', '')}
        </div>`)}
      ${section('Local Notes (MTM)', `
        <textarea id="sfin-notes" rows="3" placeholder="Shop-specific interpretations…" class="${INPUT}"></textarea>
        <p class="text-[10px] text-slate-400 mt-1">Saved on this machine automatically.</p>`)}
    </div>`;

    ['style', 'removal', 'limit', 'param', 'rule', 'cutoff', 'limitB', 'paramB', 'usUnits', 'lay'].forEach(bindSel);
    [['value', null], ['valueB', null], ['usMax', null], ['usMin', null], ['allowance', null]].forEach(([k, d]) => bindNum(k, d));
    bindNum('evalLengths', 5, v => Math.min(5, Math.max(1, Math.round(v))));
    bindText('process');
    ['allAround', 'second'].forEach(bindChk);

    const notes = container.querySelector('#sfin-notes');
    try {
        notes.value = localStorage.getItem('decoder_notes_surface_finish') || '';
        notes.oninput = () => { try { localStorage.setItem('decoder_notes_surface_finish', notes.value); } catch (e) { /* ignore */ } };
    } catch (e) { /* storage unavailable */ }

    update();

    function bindSel(key) {
        const e = container.querySelector(`#sfin-${key}`);
        e.value = state[key];
        e.onchange = () => { state[key] = e.value; update(); };
    }
    function bindNum(key, dflt, clean = v => v) {
        const e = container.querySelector(`#sfin-${key}`);
        e.oninput = () => {
            const v = parseFloat(e.value);
            state[key] = e.value === '' ? dflt : (Number.isFinite(v) && v >= 0 ? clean(v) : state[key]);
            update();
        };
    }
    function bindText(key) {
        const e = container.querySelector(`#sfin-${key}`);
        e.value = state[key];
        e.oninput = () => { state[key] = e.value.trim(); update(); };
    }
    function bindChk(key) {
        const e = container.querySelector(`#sfin-${key}`);
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
      <select id="sfin-${key}" class="${INPUT}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`;
}
function num(key, label, val) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="sfin-${key}" type="number" step="any" min="0" value="${val ?? ''}" class="${INPUT}"></div>`;
}
function textIn(key, label, val) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="sfin-${key}" type="text" value="${val}" placeholder="e.g. ground, turned" class="${INPUT}"></div>`;
}

function syncControlVisibility() {
    if (!controlsRoot) return;
    const conds = { iso: state.style === 'iso', asme: state.style === 'asme', second: state.second };
    controlsRoot.querySelectorAll('[data-when]').forEach(e => e.classList.toggle('hidden', !conds[e.dataset.when]));
}
