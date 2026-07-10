// modules/decode/welding.js
// ============================================================================
// WELDING SYMBOL DECODER — per DECODER_SPEC.md
// One state object, three renderers (symbol / preview / sentence).
// Standard: AWS A2.4:2020, with ISO 2553 toggle (dashed identification line,
// z-leg size prefix, length (gap) intermittent notation).
// Exports: draw(canvas), loadControls(container)   [shell contract §1]
// ============================================================================

import {
    el, filletWeld, squareGroove, vGroove, bevelGroove, uGroove, jGroove,
    flareVGroove, flareBevelGroove, plugWeld, spotWeld, seamWeld,
    backWeld, meltThrough, backingBar, weldAllAround, fieldFlag, tailMark,
    contourMark, WELD_W
} from './symbols.js';

// --------------------------------------------------------------------------
// STATE — every parameter of the callout (spec §2)
// --------------------------------------------------------------------------
const state = {
    standard: 'AWS',        // 'AWS' | 'ISO'
    weldType: 'fillet',     // fillet|square|v|bevel|u|j|flareV|flareBevel|plug|spot|seam
    compound: false,        // reinforcing fillet stacked on a groove
    sides: 'arrow',         // 'arrow' | 'other' | 'both'
    stagger: 'chain',       // 'chain' | 'staggered'  (both sides + intermittent)
    mirror: true,           // both sides share one dimension set
    size: 6,                // mm — fillet leg / weld size
    depth: null,            // mm — groove depth; null = CJP (silent rule)
    length: null,           // mm — segment length; null = continuous
    pitch: null,            // mm — center-to-center spacing
    size2: 6, length2: null, pitch2: null,   // other-side set when mirror=false
    count: null,            // (n) number of plug/spot/seam welds
    allAround: false,
    field: false,
    meltThrough: false,
    backing: 'none',        // 'none' | 'back' | 'bar'
    contour: 'none',        // 'none' | 'flush' | 'convex' | 'concave'
    finish: 'none',         // 'none' | G | M | C | H
    tail: '',               // process / WPS / spec reference
    nde: 'none'             // 'none' | RT | UT | MT | PT
};

const GROOVES = ['square', 'v', 'bevel', 'u', 'j', 'flareV', 'flareBevel'];
const ROUNDISH = ['plug', 'spot', 'seam'];
const WELD_FNS = {
    fillet: filletWeld, square: squareGroove, v: vGroove, bevel: bevelGroove,
    u: uGroove, j: jGroove, flareV: flareVGroove, flareBevel: flareBevelGroove,
    plug: plugWeld, spot: spotWeld, seam: seamWeld
};
const WELD_NAMES = {
    fillet: 'fillet weld', square: 'square-groove weld', v: 'single-V-groove weld',
    bevel: 'single-bevel-groove weld', u: 'U-groove weld', j: 'J-groove weld',
    flareV: 'flare-V-groove weld', flareBevel: 'flare-bevel-groove weld',
    plug: 'plug/slot weld', spot: 'spot weld', seam: 'seam weld'
};
const FINISH_WORDS = { G: 'grind', M: 'machine', C: 'chip', H: 'hammer' };

// --------------------------------------------------------------------------
// GOTCHAS — fire on exact state conditions (spec §5)
// --------------------------------------------------------------------------
const GOTCHAS = [
    { when: s => s.pitch && s.length && s.pitch > s.length,
      text: s => `Pitch is CENTER-TO-CENTER, not the gap: ${s.length}-${s.pitch} means ${s.pitch - s.length} mm gaps between segments.` },
    { when: s => s.pitch && s.length && s.pitch <= s.length,
      text: () => `Invalid callout: pitch must be greater than segment length (pitch is center-to-center).` },
    { when: s => GROOVES.includes(s.weldType) && s.depth == null,
      text: () => `Silent rule: NO depth dimension on a groove symbol = CJP (complete joint penetration).` },
    { when: s => ['bevel', 'j', 'flareBevel'].includes(s.weldType),
      text: () => `Bevel/J grooves prepare only ONE member — the (broken) arrow points at the member to be beveled.` },
    { when: s => s.standard === 'ISO' && s.weldType === 'fillet',
      text: () => `ISO sizes: z = leg, a = throat (a is the ISO default; a is only about 0.7 of z — misreading undersizes the weld).` },
    { when: s => s.standard === 'ISO' && s.pitch && s.length,
      text: s => `ISO intermittent writes length (gap): ${s.length} (${s.pitch - s.length}) — the parenthesis is the GAP, not the AWS pitch.` },
    { when: s => s.sides === 'both' && s.pitch && s.stagger === 'staggered',
      text: () => `Staggered: far-side segments fall in the near side's gaps — read it from the symbols being OFFSET along the reference line.` },
    { when: s => s.sides === 'other',
      text: s => s.standard === 'AWS'
          ? `Symbol ABOVE the reference line = weld the side OPPOSITE the arrow.`
          : `Symbol on the DASHED identification line = weld the side opposite the arrow (ISO 2553).` }
];

// --------------------------------------------------------------------------
// MODULE-LEVEL REFS
// --------------------------------------------------------------------------
let canvasRef = null;
let zones = null;          // { symbol, preview, sentence }
let controlsRoot = null;

// ==========================================================================
// draw(canvas) — shell contract
// ==========================================================================
export function draw(canvas) {
    canvasRef = canvas;

    // arrowhead marker
    const defs = el('defs');
    const mk = el('marker', { id: 'wd-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    mk.appendChild(el('path', { d: 'M1 1 L9 5 L1 9 Z', fill: '#0f172a' }));
    defs.appendChild(mk);
    canvas.appendChild(defs);

    // zone scaffolding (spec §3)
    [[260, 'WHAT IT COMMANDS'], [640, 'IN PLAIN ENGLISH']].forEach(([y, label]) => {
        canvas.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#e2e8f0', 'stroke-width': 1 }));
        canvas.appendChild(txt(label, 40, y + 20, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    });
    canvas.appendChild(txt('SYMBOL', 40, 24, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));

    zones = { symbol: el('g'), preview: el('g'), sentence: el('g') };
    Object.values(zones).forEach(z => canvas.appendChild(z));
    update();
}

// ==========================================================================
// UPDATE — clear zones, re-render everything from state (spec §2)
// ==========================================================================
function update() {
    if (!zones) return;
    Object.values(zones).forEach(z => { while (z.firstChild) z.removeChild(z.firstChild); });
    renderSymbol(zones.symbol, state);
    renderPreview(zones.preview, state);
    renderSentence(zones.sentence, state);
    syncControlVisibility();
}

// --------------------------------------------------------------------------
// small helpers
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

/** Intermittent segments as [t0,t1] fractions of the shown joint (300 mm). */
function segments(length, pitch, offsetFrac = 0) {
    const SHOWN = 300;
    if (!length || !pitch || pitch <= length) return [[0.03, 0.97]];
    const l = length / SHOWN, p = pitch / SHOWN;
    const segs = [];
    for (let t = 0.03 + offsetFrac; t + l <= 0.97; t += p) segs.push([t, t + l]);
    return segs.length ? segs : [[0.03, 0.03 + l]];
}

// ==========================================================================
// RENDERER 1 — THE SYMBOL (constructed geometry, zone y 0–260)
// ==========================================================================
function renderSymbol(g, s) {
    const yRef = 150, x0 = 120, x1 = 540, symX = 290, h = 30;
    const fn = WELD_FNS[s.weldType];
    const w = WELD_W[s.weldType] * h;
    const iso = s.standard === 'ISO';
    const yDash = yRef + 14; // ISO identification line

    // reference line
    g.appendChild(el('line', { ...S, x1: x0, y1: yRef, x2: x1, y2: yRef }));
    if (iso && s.sides !== 'both') {
        g.appendChild(el('line', { ...S, 'stroke-dasharray': '7 5', x1: x0, y1: yDash, x2: x1, y2: yDash }));
    }

    // tail (only when it carries information — per A2.4 omit otherwise)
    const tailBits = [s.tail.trim(), s.nde !== 'none' ? s.nde : ''].filter(Boolean);
    if (tailBits.length) {
        g.appendChild(tailMark(x0, yRef));
        g.appendChild(txt(tailBits.join(' \u00B7 '), x0 - 20, yRef, { anchor: 'end', baseline: 'central', size: 14, mono: true }));
    }

    // ---- where do the weld symbols sit?
    // AWS: below solid = arrow side, above solid = other side.
    // ISO: on solid = arrow side, hanging below dashed = other side.
    const placements = [];
    const stagOff = (s.sides === 'both' && s.pitch && s.stagger === 'staggered') ? 42 : 0;
    if (s.sides === 'arrow' || s.sides === 'both') {
        placements.push({ x: symX, y: yRef, flip: false, dims: primaryDims(s), dimY: yRef + h + 20, side: 'arrow' });
    }
    if (s.sides === 'other' || s.sides === 'both') {
        const dims = (s.sides === 'both' && !s.mirror)
            ? { size: s.size2, length: s.length2, pitch: s.pitch2 } : primaryDims(s);
        if (iso) {
            placements.push({ x: symX + stagOff, y: yDash, flip: false, dims, dimY: yDash + h + 20, side: 'other' });
        } else {
            placements.push({ x: symX + stagOff, y: yRef, flip: true, dims, dimY: yRef - h - 12, side: 'other' });
        }
    }

    for (const p of placements) {
        // main weld symbol
        g.appendChild(fn(p.x, p.y, h, { flip: p.flip }));

        // compound reinforcing fillet: stacked OUTSIDE the groove symbol
        if (s.compound && GROOVES.includes(s.weldType)) {
            const fy = p.flip ? p.y : p.y; // anchor stays; offset via translate below
            const fill = filletWeld(p.x, p.flip ? p.y - h : p.y + h, h * 0.8, { flip: p.flip });
            g.appendChild(fill);
        }

        // contour + finish letter over the face
        if (s.contour !== 'none') {
            const totalH = (s.compound && GROOVES.includes(s.weldType)) ? h * 1.9 : h;
            const cy = p.flip ? p.y - totalH - 4 : p.y + totalH + 4;
            g.appendChild(contourMark(p.x, cy, w, s.contour, { flip: p.flip }));
            if (s.finish !== 'none') {
                const fy = p.flip ? cy - 12 : cy + 26;
                g.appendChild(txt(s.finish, p.x + w / 2, fy, { anchor: 'middle', size: 14, mono: true, bold: true }));
            }
        }

        // dimensions: size LEFT of symbol, length-pitch RIGHT (A2.4 rule)
        const dimY = p.flip ? p.y - 14 : p.y + 22;
        const { size, length, pitch } = p.dims;
        if (size != null && !ROUNDISH.includes(s.weldType)) {
            const sizeStr = GROOVES.includes(s.weldType)
                ? (s.depth != null ? String(s.depth) : '')
                : (iso ? `z${size}` : String(size));
            if (sizeStr) g.appendChild(txt(sizeStr, p.x - 10, dimY, { anchor: 'end', size: 17, mono: true, bold: true }));
        }
        if (length && pitch && pitch > length) {
            const lp = iso ? `${length} (${pitch - length})` : `${length} - ${pitch}`;
            g.appendChild(txt(lp, p.x + w + 12, dimY, { size: 17, mono: true, bold: true }));
        } else if (length) {
            g.appendChild(txt(String(length), p.x + w + 12, dimY, { size: 17, mono: true, bold: true }));
        }
        // (n) count for plug/spot/seam
        if (ROUNDISH.includes(s.weldType) && s.count) {
            const cyy = p.flip ? p.y - h - 16 : p.y + h + 24;
            g.appendChild(txt(`(${s.count})`, p.x + w / 2, cyy, { anchor: 'middle', size: 15, mono: true }));
        }
    }

    // back/backing weld & melt-through & backing bar: OPPOSITE side of the line
    // from the (arrow-side) groove symbol.
    if (GROOVES.includes(s.weldType)) {
        const oppFlip = s.sides !== 'other'; // groove below => supplement above
        const oy = yRef;
        if (s.backing === 'back') g.appendChild(backWeld(symX, oy, h * 0.8, { flip: oppFlip }));
        if (s.backing === 'bar') g.appendChild(backingBar(symX, oy, h * 0.8, { flip: oppFlip }));
        if (s.meltThrough) g.appendChild(meltThrough(symX + (s.backing !== 'none' ? 46 : 0), oy, h * 0.7, { flip: oppFlip }));
    }

    // junction supplements
    if (s.allAround) g.appendChild(weldAllAround(x1, yRef, 9));
    if (s.field) g.appendChild(fieldFlag(x1, yRef, 42));

    // leader arrow into the preview joint. BROKEN arrow for bevel/J types.
    const target = GROOVES.includes(s.weldType) ? [418, 560] : [456, 518];
    const broken = ['bevel', 'j', 'flareBevel'].includes(s.weldType);
    const pts = broken
        ? [[x1, yRef], [x1 + 62, yRef + 42], [x1 + 40, yRef + 86], target]
        : [[x1, yRef], target];
    g.appendChild(el('polyline', {
        ...S, points: pts.map(p => p.join(',')).join(' '), 'marker-end': 'url(#wd-arrow)'
    }));
}

function primaryDims(s) { return { size: s.size, length: s.length, pitch: s.pitch }; }

// ==========================================================================
// RENDERER 2 — THE PREVIEW (isometric joint, zone y 260–640)
// Fillet / plug / spot / seam -> tee joint. Grooves -> butt joint.
// Schematic isometric; physical colors per spec §3.
// ==========================================================================
const PLATE = { stroke: '#5F5E5A', 'stroke-width': 0.8, 'stroke-linejoin': 'round' };
const BEAD  = { stroke: '#854F0B', 'stroke-width': 0.8, 'stroke-linejoin': 'round' };

function poly(points, fill, extra = {}) {
    return el('polygon', { points: points.map(p => p.join(',')).join(' '), fill, ...extra });
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const add = (p, d) => [p[0] + d[0], p[1] + d[1]];

function renderPreview(g, s) {
    const P = s.pitch, L = s.length;
    const near = segments(L, P);
    const halfPitch = (L && P && P > L) ? (P / 300) / 2 : 0;
    const far = segments(L, P, s.stagger === 'staggered' ? halfPitch : 0);

    if (GROOVES.includes(s.weldType)) buttJoint(g, s, near, far);
    else teeJoint(g, s, near, far);
}

function teeJoint(g, s, near, far) {
    // base plate
    const A = [380, 560], B = [700, 455], C = [800, 490], D = [480, 595];
    g.appendChild(poly([A, B, C, D], '#C9C7BE', PLATE));
    g.appendChild(poly([D, C, [800, 510], [480, 615]], '#A9A79E', PLATE));
    g.appendChild(poly([A, D, [480, 615], [380, 580]], '#8F8D85', PLATE));

    // vertical plate
    const F1 = [450, 525], F2 = [660, 455], F1t = [450, 395], F2t = [660, 325];
    const B1 = [426, 517], B2 = [636, 447], B1t = [426, 387], B2t = [636, 317];
    g.appendChild(poly([F1, B1, B1t, F1t], '#9B9992', PLATE));
    g.appendChild(poly([F1, F2, F2t, F1t], '#B8B6AD', PLATE));
    g.appendChild(poly([F1t, F2t, B2t, B1t], '#D6D4CB', PLATE));

    if (ROUNDISH.includes(s.weldType)) {
        // schematic: spots along the front face mid-height
        const n = s.count || 4;
        for (let i = 0; i < n; i++) {
            const t = 0.12 + (0.76 * i) / Math.max(1, n - 1);
            const M = lerp([450, 460], [660, 390], t);
            g.appendChild(el('circle', { cx: M[0], cy: M[1], r: 10, fill: '#EF9F27', ...BEAD }));
        }
        return;
    }

    // far-side beads (ghosted through the plate) — drawn first
    if (s.sides === 'other' || s.sides === 'both') {
        for (const [t0, t1] of far) {
            const P0 = lerp(B1, B2, t0), P1 = lerp(B1, B2, t1);
            const U0 = add(P0, [0, -30]), U1 = add(P1, [0, -30]);
            const O0 = add(P0, [-22, -8]), O1 = add(P1, [-22, -8]);
            const ghost = { ...BEAD, 'stroke-dasharray': '4 3', opacity: 0.4 };
            g.appendChild(poly([P0, U0, O0], '#EF9F27', ghost));
            g.appendChild(poly([U0, U1, O1, O0], '#EF9F27', ghost));
        }
    }
    // near-side beads
    if (s.sides === 'arrow' || s.sides === 'both') {
        for (const [t0, t1] of near) {
            const P0 = lerp([450, 525], [660, 455], t0), P1 = lerp([450, 525], [660, 455], t1);
            const U0 = add(P0, [0, -30]), U1 = add(P1, [0, -30]);
            const O0 = add(P0, [26, 10]), O1 = add(P1, [26, 10]);
            g.appendChild(poly([P0, U0, O0], '#BA7517', BEAD));
            g.appendChild(poly([U0, U1, O1, O0], '#EF9F27', BEAD));
        }
    }
}

function buttJoint(g, s, near, far) {
    // single slab drawn as two plates meeting at a seam
    const A = [360, 555], B = [680, 450], C = [770, 482], D = [450, 587];
    g.appendChild(poly([A, B, C, D], '#C9C7BE', PLATE));
    g.appendChild(poly([D, C, [770, 502], [450, 607]], '#A9A79E', PLATE));
    g.appendChild(poly([A, D, [450, 607], [360, 575]], '#8F8D85', PLATE));

    const S0 = [405, 571], S1 = [725, 466]; // seam midline
    g.appendChild(el('line', { x1: S0[0], y1: S0[1], x2: S1[0], y2: S1[1], stroke: '#5F5E5A', 'stroke-width': 1.2 }));

    // underside weld ghost (both sides / back weld / melt-through)
    if (s.sides === 'both' || s.sides === 'other' || s.backing === 'back' || s.meltThrough) {
        for (const [t0, t1] of far) {
            const P0 = add(lerp(S0, S1, t0), [8, 32]), P1 = add(lerp(S0, S1, t1), [8, 32]);
            g.appendChild(poly([add(P0, [-12, -4]), add(P1, [-12, -4]), add(P1, [12, 4]), add(P0, [12, 4])],
                '#EF9F27', { ...BEAD, 'stroke-dasharray': '4 3', opacity: 0.35 }));
        }
    }
    // top bead band
    if (s.sides === 'arrow' || s.sides === 'both') {
        for (const [t0, t1] of near) {
            const P0 = lerp(S0, S1, t0), P1 = lerp(S0, S1, t1);
            g.appendChild(poly([add(P0, [-15, -5]), add(P1, [-15, -5]), add(P1, [15, 5]), add(P0, [15, 5])],
                '#EF9F27', BEAD));
            g.appendChild(el('line', {
                x1: P0[0], y1: P0[1] - 3, x2: P1[0], y2: P1[1] - 3,
                stroke: '#F8C471', 'stroke-width': 2, 'stroke-linecap': 'round'
            }));
        }
    }
}

// ==========================================================================
// RENDERER 3 — THE SENTENCE + GOTCHAS (zone y 640–800)
// ==========================================================================
function renderSentence(g, s) {
    const parts = [];
    const iso = s.standard === 'ISO';

    // size / penetration
    if (s.weldType === 'fillet') parts.push(`${s.size} mm leg fillet welds`);
    else if (GROOVES.includes(s.weldType)) {
        const pen = s.depth != null
            ? `${s.depth} mm deep (partial joint penetration)`
            : `complete joint penetration (depth omitted)`;
        parts.push(`${WELD_NAMES[s.weldType]}, ${pen}`);
        if (s.compound) parts.push(`with reinforcing fillet`);
    } else {
        parts.push(`${s.count ? s.count + ' ' : ''}${WELD_NAMES[s.weldType]}${s.count ? 's' : ''}`);
    }

    // sides
    parts.push(s.sides === 'both' ? 'both sides' : s.sides === 'other' ? 'other side (opposite the arrow)' : 'arrow side');

    // intermittent
    if (s.length && s.pitch && s.pitch > s.length) {
        const kind = (s.sides === 'both') ? (s.stagger === 'staggered' ? 'staggered intermittent' : 'chain intermittent') : 'intermittent';
        parts.push(`${kind}: ${s.length} mm segments on ${s.pitch} mm centers (${s.pitch - s.length} mm gaps)`);
    } else if (s.length) parts.push(`${s.length} mm long`);

    if (s.sides === 'both' && !s.mirror) parts.push(`other side: ${s.size2} mm${s.length2 && s.pitch2 ? `, ${s.length2}-${s.pitch2}` : ''}`);

    // contour / finish
    if (s.contour !== 'none') {
        const f = FINISH_WORDS[s.finish];
        parts.push(f ? `${f} ${s.contour === 'flush' ? 'flush' : s.contour}` : `${s.contour} contour`);
    }
    if (s.meltThrough) parts.push('melt-through (visible root reinforcement) required');
    if (s.backing === 'back') parts.push('back/backing weld on the opposite side');
    if (s.backing === 'bar') parts.push('with backing bar');
    if (s.allAround) parts.push('weld all around');
    if (s.field) parts.push('weld in field');
    if (s.tail.trim()) parts.push(`ref: ${s.tail.trim()}`);
    if (s.nde !== 'none') parts.push(`${s.nde} examination required`);

    const sentence = parts.join(', ') + '.';
    wrapText(g, sentence.charAt(0).toUpperCase() + sentence.slice(1), 40, 680, 900, 19, '#0f172a', 26);

    // gotchas (max 4)
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
// loadControls(container) — shell contract. Built once; visibility synced.
// ==========================================================================
export function loadControls(container) {
    controlsRoot = container;
    container.innerHTML = `
    <div class="space-y-5">
      ${section('Standard', `
        <div class="flex rounded overflow-hidden border border-slate-200" id="wd-std">
          <button data-std="AWS" class="flex-1 py-1.5 text-sm font-bold">AWS A2.4</button>
          <button data-std="ISO" class="flex-1 py-1.5 text-sm font-bold">ISO 2553</button>
        </div>`)}
      ${section('Weld', `
        ${sel('weldType', 'Type', [
            ['fillet','Fillet'],['square','Square groove'],['v','V-groove'],['bevel','Bevel groove'],
            ['u','U-groove'],['j','J-groove'],['flareV','Flare-V'],['flareBevel','Flare-bevel'],
            ['plug','Plug / slot'],['spot','Spot'],['seam','Seam']])}
        <label class="flex items-center gap-2 text-sm mt-2" data-when="groove">
          <input type="checkbox" id="wd-compound"> Reinforcing fillet (compound)
        </label>`)}
      ${section('Sides', `
        ${sel('sides', 'Weld on', [['arrow','Arrow side'],['other','Other side'],['both','Both sides']])}
        <div data-when="bothPitch" class="mt-2">${sel('stagger', 'Intermittent pattern', [['chain','Chain (aligned)'],['staggered','Staggered']])}</div>
        <label class="flex items-center gap-2 text-sm mt-2" data-when="both">
          <input type="checkbox" id="wd-mirror" checked> Same dimensions both sides
        </label>`)}
      ${section('Dimensions (mm)', `
        <div class="grid grid-cols-2 gap-2">
          ${num('size', 'Size / leg', 6)}
          <div data-when="groove">${num('depth', 'Depth (blank = CJP)', '')}</div>
          ${num('length', 'Length (blank = cont.)', '')}
          ${num('pitch', 'Pitch (c-to-c)', '')}
          <div data-when="roundish">${num('count', 'Count (n)', '')}</div>
        </div>
        <div data-when="mirrorOff" class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100">
          ${num('size2', 'Other size', 6)}${num('length2', 'Other len', '')}${num('pitch2', 'Other pitch', '')}
        </div>`)}
      ${section('Supplementary', `
        <div class="space-y-1.5 text-sm">
          <label class="flex items-center gap-2"><input type="checkbox" id="wd-allAround"> Weld all around</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="wd-field"> Field weld</label>
          <label class="flex items-center gap-2" data-when="groove"><input type="checkbox" id="wd-meltThrough"> Melt-through</label>
        </div>
        <div class="mt-2" data-when="groove">${sel('backing', 'Backing', [['none','None'],['back','Back / backing weld'],['bar','Backing bar']])}</div>`)}
      ${section('Contour & Finish', `
        <div class="grid grid-cols-2 gap-2">
          ${sel('contour', 'Contour', [['none','None'],['flush','Flush'],['convex','Convex'],['concave','Concave']])}
          ${sel('finish', 'Finish', [['none','—'],['G','G — grind'],['M','M — machine'],['C','C — chip'],['H','H — hammer']])}
        </div>`)}
      ${section('Tail & Examination', `
        <label class="block text-xs text-slate-500 mb-1">Tail note (process / WPS / spec)</label>
        <input id="wd-tail" type="text" placeholder="e.g. GMAW · WPS-114" class="${INPUT}">
        <div class="mt-2">${sel('nde', 'NDE', [['none','None'],['RT','RT — radiographic'],['UT','UT — ultrasonic'],['MT','MT — magnetic particle'],['PT','PT — dye penetrant']])}</div>`)}
      ${section('Local Notes (MTM)', `
        <textarea id="wd-notes" rows="3" placeholder="Shop-specific interpretations…" class="${INPUT}"></textarea>
        <p class="text-[10px] text-slate-400 mt-1">Saved on this machine automatically.</p>`)}
    </div>`;

    // ---- bindings
    container.querySelectorAll('#wd-std button').forEach(b => b.onclick = () => { state.standard = b.dataset.std; styleStd(); update(); });
    styleStd();

    bindSel('weldType'); bindSel('sides'); bindSel('stagger'); bindSel('backing');
    bindSel('contour'); bindSel('finish'); bindSel('nde');
    bindNum('size', 6); bindNum('depth', null); bindNum('length', null); bindNum('pitch', null);
    bindNum('size2', 6); bindNum('length2', null); bindNum('pitch2', null); bindNum('count', null);
    bindChk('compound'); bindChk('allAround'); bindChk('field'); bindChk('meltThrough'); bindChk('mirror');

    const tail = container.querySelector('#wd-tail');
    tail.oninput = () => { state.tail = tail.value; update(); };

    // local notes — localStorage (spec §5)
    const notes = container.querySelector('#wd-notes');
    notes.value = localStorage.getItem('decoder_notes_welding') || '';
    notes.oninput = () => localStorage.setItem('decoder_notes_welding', notes.value);

    update();

    function styleStd() {
        container.querySelectorAll('#wd-std button').forEach(b => {
            b.className = 'flex-1 py-1.5 text-sm font-bold ' + (b.dataset.std === state.standard
                ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50');
        });
    }
    function bindSel(key) {
        const e = container.querySelector(`#wd-${key}`);
        e.value = state[key];
        e.onchange = () => { state[key] = e.value; update(); };
    }
    function bindNum(key, dflt) {
        const e = container.querySelector(`#wd-${key}`);
        e.oninput = () => {
            const v = parseFloat(e.value);
            state[key] = Number.isFinite(v) ? v : (e.value === '' ? (dflt === null ? null : dflt) : state[key]);
            if (e.value === '') state[key] = dflt;
            update();
        };
    }
    function bindChk(key) {
        const e = container.querySelector(`#wd-${key}`);
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
      <select id="wd-${key}" class="${INPUT}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>`;
}
function num(key, label, val) {
    return `<div><label class="block text-xs text-slate-500 mb-1">${label}</label>
      <input id="wd-${key}" type="number" step="any" value="${val}" class="${INPUT}"></div>`;
}

/** Show/hide controls whose relevance depends on state (spec §2 — controls map 1:1 to state). */
function syncControlVisibility() {
    if (!controlsRoot) return;
    const isGroove = GROOVES.includes(state.weldType);
    const conds = {
        groove: isGroove,
        roundish: ROUNDISH.includes(state.weldType),
        both: state.sides === 'both',
        bothPitch: state.sides === 'both' && !!state.pitch && !!state.length,
        mirrorOff: state.sides === 'both' && !state.mirror
    };
    controlsRoot.querySelectorAll('[data-when]').forEach(e => {
        e.classList.toggle('hidden', !conds[e.dataset.when]);
    });
}
