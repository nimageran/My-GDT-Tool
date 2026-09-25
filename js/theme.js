// js/theme.js
// ============================================================================
// SHARED VISUAL LANGUAGE for the GD&T modules.
// One set of colours, fonts and building blocks so every module reads the
// same way:
//   - Tolerance zone ....... soft blue band with dashed edges
//   - Actual feature ....... dark slate
//   - Datum ................ black, with ground hatching
//   - Perfect geometry ..... light grey dashed line
//   - Green / red .......... PASS / FAIL only
//
// Canvas layout (viewBox 0 0 1000 800):
//   STAGE  y   0–640  the drawing (legend top-left, frame top-right)
//   STRIP  y 650–800  results: status, measured vs allowed, plain English
// ============================================================================

import { createSVG } from './drawing_utils.js';
import { gdtChar, circledMod, diaSymbol } from './modules/decode/symbols.js';
import { suffix, decimals } from './units.js';

export const COLORS = {
    ink: '#0f172a',
    text: '#1e293b',
    muted: '#64748b',
    faint: '#cbd5e1',
    partFill: '#e2e8f0',
    partStroke: '#475569',
    actual: '#1e293b',
    zoneFill: 'rgba(59, 130, 246, 0.14)',
    zoneStroke: '#2563eb',
    zoneText: '#1d4ed8',
    nominal: '#94a3b8',
    pass: '#16a34a',
    passTint: '#dcfce7',
    fail: '#dc2626',
    failTint: '#fee2e2',
    card: '#ffffff',
    cardBorder: '#e2e8f0'
};

export const FONTS = {
    sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
};

export const LAYOUT = {
    width: 1000,
    stage: { top: 0, bottom: 640 },
    strip: { top: 650, bottom: 800 }
};

const DASH = { zone: '10 6', nominal: '6 6' };

// --------------------------------------------------------------------------
// Text
// --------------------------------------------------------------------------

/** One line of text. opts: size, weight, fill, anchor, mono, italic, baseline */
export function text(str, x, y, opts = {}) {
    const t = createSVG('text', {
        x, y,
        'font-family': opts.mono ? FONTS.mono : FONTS.sans,
        'font-size': opts.size ?? 14,
        'font-weight': opts.weight ?? 400,
        fill: opts.fill ?? COLORS.text,
        'text-anchor': opts.anchor ?? 'start'
    });
    if (opts.italic) t.setAttribute('font-style', 'italic');
    if (opts.baseline) t.setAttribute('dominant-baseline', opts.baseline);
    if (opts.letterSpacing) t.setAttribute('letter-spacing', opts.letterSpacing);
    t.textContent = str;
    return t;
}

/** Outline text in the canvas colour so lines passing under it do not cut through the letters. */
export function halo(t, color = '#f8fafc') {
    t.setAttribute('stroke', color);
    t.setAttribute('stroke-width', 5);
    t.setAttribute('stroke-linejoin', 'round');
    t.setAttribute('paint-order', 'stroke');
    return t;
}

/** Solid box in the canvas colour behind text that is already in the page (lines under it are hidden). */
export function backdrop(t, color = '#f8fafc', pad = 4) {
    const b = t.getBBox();
    const r = createSVG('rect', { x: b.x - pad, y: b.y - pad / 2, width: b.width + 2 * pad, height: b.height + pad, fill: color });
    t.parentNode.insertBefore(r, t);
    return t;
}

/** Word-wrapped text block (approximate: wraps on character count). */
export function wrapText(str, x, y, maxChars, lineHeight, opts = {}) {
    const g = createSVG('g', {});
    const words = str.split(' ');
    let line = '';
    let row = 0;
    for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length > maxChars && line) {
            g.appendChild(text(line, x, y + row * lineHeight, opts));
            line = w;
            row++;
        } else {
            line = next;
        }
    }
    if (line) g.appendChild(text(line, x, y + row * lineHeight, opts));
    return g;
}

// --------------------------------------------------------------------------
// Defs (arrowheads). Call once per render, after clearing the canvas.
// --------------------------------------------------------------------------

export function addDefs(svg) {
    const defs = createSVG('defs', {});
    const arrows = { ink: COLORS.ink, zone: COLORS.zoneStroke, muted: COLORS.muted, fail: COLORS.fail };
    for (const [name, color] of Object.entries(arrows)) {
        const m = createSVG('marker', {
            id: `thm-arrow-${name}`, viewBox: '0 0 10 10', refX: 9, refY: 5,
            markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
        });
        m.appendChild(createSVG('path', { d: 'M0,0 L10,5 L0,10 Z', fill: color }));
        defs.appendChild(m);
    }
    // Hatched zone fill, used for bonus tolerance
    const hatch = createSVG('pattern', {
        id: 'thm-hatch-zone', patternUnits: 'userSpaceOnUse', width: 8, height: 8,
        patternTransform: 'rotate(45)'
    });
    hatch.appendChild(createSVG('rect', { x: 0, y: 0, width: 8, height: 8, fill: COLORS.zoneFill }));
    hatch.appendChild(createSVG('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: COLORS.zoneStroke, 'stroke-width': 1.5, opacity: 0.45 }));
    defs.appendChild(hatch);
    svg.appendChild(defs);
}

// --------------------------------------------------------------------------
// Drawing primitives
// --------------------------------------------------------------------------

/** A tolerance zone band from a polygon's points: soft fill, dashed edges drawn separately. */
export function zoneBand(points) {
    return createSVG('polygon', {
        points: points.map(p => `${p.x},${p.y}`).join(' '),
        fill: COLORS.zoneFill, stroke: 'none'
    });
}

/** Dashed zone boundary line. */
export function zoneEdge(x1, y1, x2, y2) {
    return createSVG('line', {
        x1, y1, x2, y2,
        stroke: COLORS.zoneStroke, 'stroke-width': 2, 'stroke-dasharray': DASH.zone
    });
}

/** Light grey dashed "perfect geometry" line. */
export function nominalLine(x1, y1, x2, y2) {
    return createSVG('line', {
        x1, y1, x2, y2,
        stroke: COLORS.nominal, 'stroke-width': 1.5, 'stroke-dasharray': DASH.nominal
    });
}

/** Datum surface: heavy line with ground hatching underneath. */
export function datumGround(x1, x2, y) {
    const g = createSVG('g', {});
    for (let x = x1 + 6; x <= x2; x += 16) {
        g.appendChild(createSVG('line', {
            x1: x, y1: y + 2, x2: x - 12, y2: y + 14,
            stroke: COLORS.nominal, 'stroke-width': 1
        }));
    }
    g.appendChild(createSVG('line', { x1, y1: y, x2, y2: y, stroke: COLORS.ink, 'stroke-width': 3 }));
    return g;
}

/**
 * ASME datum feature symbol: letter in a square frame, joined by a leader to
 * a filled triangle standing on the datum surface at (x, y). Drawn above y.
 */
export function datumFeatureSymbol(x, y, letter, { size = 30, rise = 46 } = {}) {
    const g = createSVG('g', {});
    const tri = 11;
    g.appendChild(createSVG('path', {
        d: `M${x - tri},${y} L${x + tri},${y} L${x},${y - tri * 1.3} Z`, fill: COLORS.ink
    }));
    const boxBottom = y - rise;
    g.appendChild(createSVG('line', { x1: x, y1: y - tri * 1.3, x2: x, y2: boxBottom, stroke: COLORS.ink, 'stroke-width': 1.5 }));
    g.appendChild(createSVG('rect', {
        x: x - size / 2, y: boxBottom - size, width: size, height: size,
        fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 2
    }));
    g.appendChild(text(letter, x, boxBottom - size / 2, { size: 18, weight: 700, anchor: 'middle', baseline: 'central', fill: COLORS.ink }));
    return g;
}

/**
 * Dimension between two points with arrowheads at both ends and a label.
 * opts: color ('zone' | 'ink' | 'muted' | 'fail'), labelSide ('above' | 'below'), size
 */
export function dimension(x1, y1, x2, y2, label, opts = {}) {
    const key = opts.color ?? 'ink';
    const color = { ink: COLORS.ink, zone: COLORS.zoneText, muted: COLORS.muted, fail: COLORS.fail }[key];
    const g = createSVG('g', {});
    const marker = `url(#thm-arrow-${key})`;
    if (Math.hypot(x2 - x1, y2 - y1) > 4) {
        g.appendChild(createSVG('line', {
            x1, y1, x2, y2, stroke: color, 'stroke-width': 1.5,
            'marker-start': marker, 'marker-end': marker
        }));
    }
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 + (opts.labelSide === 'below' ? 20 : -9);
    g.appendChild(text(label, mx, my, { size: opts.size ?? 13, weight: 600, fill: color, anchor: 'middle', mono: true }));
    return g;
}

/** Leader from a label to a target point, ending in a small dot. */
export function callout(label, labelX, labelY, targetX, targetY, opts = {}) {
    const color = opts.fill ?? COLORS.text;
    const g = createSVG('g', {});
    const anchor = opts.anchor ?? (targetX < labelX ? 'start' : 'end');
    const lineStartX = anchor === 'start' ? labelX - 6 : labelX + 6;
    g.appendChild(createSVG('line', {
        x1: lineStartX, y1: labelY - 5, x2: targetX, y2: targetY,
        stroke: COLORS.muted, 'stroke-width': 1
    }));
    g.appendChild(createSVG('circle', { cx: targetX, cy: targetY, r: 3, fill: COLORS.muted }));
    g.appendChild(text(label, labelX, labelY, { size: opts.size ?? 13, weight: opts.weight ?? 500, fill: color, anchor }));
    return g;
}

// --------------------------------------------------------------------------
// Feature control frame (drawn geometry, no Unicode)
// --------------------------------------------------------------------------

/**
 * Feature control frame with its top-left corner at (x, y).
 * symbol: a gdtChar() key, e.g. 'perpendicularity'
 * diameter: prefix the tolerance with the diameter symbol
 * modifier: 'M' | 'L' | ['M', 'P'] | null, circled letters after the tolerance
 * projected: projected zone height shown after a P modifier, e.g. '10'
 * datums: letters, or { letter, mod: 'M' | 'L' } for a datum referenced at MMB / LMB
 * Returns { g, width, height }.
 */
export function featureControlFrame(x, y, { symbol, tolerance, datums = [], diameter = false, modifier = null, projected = null, h = 34 }) {
    const g = createSVG('g', {});
    const mods = [].concat(modifier ?? []);
    const textW = tolerance.length * 9.8;          // 16px monospace advance
    const diaW = diameter ? 20 : 0;
    const modW = mods.length * 24 + (mods.length ? 2 : 0);
    const projW = projected ? projected.length * 9.8 + 6 : 0;
    const tolContentW = diaW + textW + modW + projW;
    const cells = [
        { w: h, draw: (cx, cy) => g.appendChild(gdtChar(symbol, cx, cy, h * 0.62)) },
        { w: Math.max(h * 2.2, tolContentW + 22), draw: (cx, cy) => {
            let left = cx - tolContentW / 2;
            if (diameter) g.appendChild(diaSymbol(left - 1, cy + 6, 16));
            left += diaW;
            g.appendChild(text(tolerance, left, cy, { size: 16, weight: 600, mono: true, baseline: 'central', fill: COLORS.ink }));
            left += textW + 2;
            for (const m of mods) {
                g.appendChild(circledMod(left + 12, cy, 9.5, m));
                left += 24;
            }
            if (projected) g.appendChild(text(projected, left + 6, cy, { size: 16, weight: 600, mono: true, baseline: 'central', fill: COLORS.ink }));
        } },
        ...datums.map(d => typeof d === 'string'
            ? { w: h, draw: (cx, cy) => g.appendChild(text(d, cx, cy, { size: 17, weight: 700, anchor: 'middle', baseline: 'central', fill: COLORS.ink })) }
            : { w: h * 1.7, draw: (cx, cy) => {
                g.appendChild(text(d.letter, cx - h * 0.33, cy, { size: 17, weight: 700, anchor: 'middle', baseline: 'central', fill: COLORS.ink }));
                g.appendChild(circledMod(cx + h * 0.3, cy, 9.5, d.mod));
            } })
    ];
    const width = cells.reduce((s, c) => s + c.w, 0);
    g.appendChild(createSVG('rect', { x, y, width, height: h, fill: COLORS.card, stroke: COLORS.ink, 'stroke-width': 2 }));
    let cx = x;
    cells.forEach((c, i) => {
        if (i > 0) g.appendChild(createSVG('line', { x1: cx, y1: y, x2: cx, y2: y + h, stroke: COLORS.ink, 'stroke-width': 2 }));
        c.draw(cx + c.w / 2, y + h / 2);
        cx += c.w;
    });
    return { g, width, height: h };
}

// --------------------------------------------------------------------------
// Legend
// --------------------------------------------------------------------------

/**
 * Legend card at (x, y). items: [{ kind, label }], kind one of
 * 'zone' | 'zoneOutline' | 'bonus' | 'actual' | 'point' | 'nominal' | 'datum' | 'fail'
 */
export function legend(x, y, items, { title = 'KEY', note } = {}) {
    const g = createSVG('g', {});
    const rowH = 24;
    const w = 320;
    const h = 38 + items.length * rowH + (note ? 22 : 0);
    g.appendChild(createSVG('rect', {
        x, y, width: w, height: h, rx: 8,
        fill: 'rgba(255,255,255,0.92)', stroke: COLORS.cardBorder
    }));
    g.appendChild(text(title, x + 14, y + 22, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.08em' }));

    items.forEach((item, i) => {
        const sy = y + 44 + i * rowH;
        const sx = x + 14;
        switch (item.kind) {
            case 'zone':
                g.appendChild(createSVG('rect', { x: sx, y: sy - 9, width: 28, height: 12, fill: COLORS.zoneFill }));
                g.appendChild(zoneEdge(sx, sy - 9, sx + 28, sy - 9));
                g.appendChild(zoneEdge(sx, sy + 3, sx + 28, sy + 3));
                break;
            case 'actual':
                g.appendChild(createSVG('line', { x1: sx, y1: sy - 3, x2: sx + 28, y2: sy - 3, stroke: COLORS.actual, 'stroke-width': 4, 'stroke-linecap': 'round' }));
                break;
            case 'nominal':
                g.appendChild(nominalLine(sx, sy - 3, sx + 28, sy - 3));
                break;
            case 'datum':
                g.appendChild(datumGround(sx, sx + 28, sy - 3));
                break;
            case 'bonus':
                g.appendChild(createSVG('rect', { x: sx, y: sy - 9, width: 28, height: 12, fill: 'url(#thm-hatch-zone)' }));
                break;
            case 'zoneOutline':
                g.appendChild(createSVG('rect', { x: sx + 1, y: sy - 9, width: 26, height: 12, fill: COLORS.zoneFill, stroke: COLORS.zoneStroke, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
                break;
            case 'point':
                g.appendChild(createSVG('circle', { cx: sx + 14, cy: sy - 3, r: 5, fill: COLORS.actual }));
                break;
            case 'fail':
                g.appendChild(createSVG('line', { x1: sx, y1: sy - 3, x2: sx + 28, y2: sy - 3, stroke: COLORS.fail, 'stroke-width': 4, 'stroke-linecap': 'round' }));
                break;
        }
        g.appendChild(text(item.label, sx + 40, sy + 1, { size: 13, fill: COLORS.text }));
    });

    if (note) {
        g.appendChild(text(note, x + 14, y + h - 12, { size: 11.5, italic: true, fill: COLORS.muted }));
    }
    return g;
}

// --------------------------------------------------------------------------
// Results strip (bottom of the canvas)
// --------------------------------------------------------------------------

/**
 * results: {
 *   pass: boolean,
 *   measured: { label, value }, allowed: { label, value },   // numbers
 *   unit: '"' | ' mm', decimals (default: the global mm / inch setting),
 *   sentence: string,
 *   compact: boolean,  // smaller type for sentences over ~200 characters
 *   gauge: false       // hide the gauge (e.g. when values are ranges)
 * }
 * measured / allowed may carry `text` to show instead of the formatted value.
 */
export function resultsStrip(results) {
    const { pass, measured, allowed, sentence } = results;
    const unit = results.unit ?? suffix();        // the global mm / inch setting
    const dec = results.decimals ?? decimals();
    const top = LAYOUT.strip.top;
    const g = createSVG('g', {});

    g.appendChild(createSVG('rect', {
        x: 0, y: top, width: LAYOUT.width, height: LAYOUT.strip.bottom - top,
        fill: COLORS.card
    }));
    g.appendChild(createSVG('line', { x1: 0, y1: top, x2: LAYOUT.width, y2: top, stroke: COLORS.cardBorder, 'stroke-width': 1.5 }));

    // 1. Status pill
    const accent = pass ? COLORS.pass : COLORS.fail;
    g.appendChild(createSVG('rect', {
        x: 30, y: top + 42, width: 130, height: 66, rx: 12,
        fill: pass ? COLORS.passTint : COLORS.failTint, stroke: accent, 'stroke-width': 2
    }));
    g.appendChild(text(pass ? 'PASS' : 'FAIL', 95, top + 76, {
        size: 28, weight: 800, fill: accent, anchor: 'middle', baseline: 'central', letterSpacing: '0.04em'
    }));

    // 2. Measured vs allowed, with a gauge
    const nx = 195;
    g.appendChild(text(measured.label.toUpperCase(), nx, top + 36, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const show = m => m.text ?? (m.value.toFixed(dec) + unit);
    const valueSize = (measured.text || allowed.text) ? 20 : 26;
    g.appendChild(text(show(measured), nx, top + 66, { size: valueSize, weight: 700, fill: accent, mono: true }));
    g.appendChild(text(allowed.label.toUpperCase(), nx + 170, top + 36, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));
    g.appendChild(text(show(allowed), nx + 170, top + 66, { size: valueSize, weight: 700, fill: COLORS.text, mono: true }));
    if (results.gauge !== false) g.appendChild(gauge(nx, top + 92, 320, measured.value, allowed.value, accent));

    // 3. Plain English
    const sx = 560;
    g.appendChild(createSVG('line', { x1: sx - 20, y1: top + 24, x2: sx - 20, y2: top + 126, stroke: COLORS.cardBorder }));
    g.appendChild(text('IN PLAIN ENGLISH', sx, top + 36, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const compact = results.compact;   // for longer sentences
    g.appendChild(wrapText(sentence, sx, top + (compact ? 58 : 60), compact ? 58 : 50, compact ? 19 : 21,
        { size: compact ? 13.5 : 15, fill: COLORS.text }));

    return g;
}

/**
 * Light results card, for tools whose drawing fills the canvas (the card
 * sits in a corner instead of the strip at the bottom).
 * opts: {
 *   x, y, w, title, pass,
 *   rows: [[label, value, { color, strong }]],
 *   measured, allowed: numbers for the gauge (omit both to hide it),
 *   sentence: plain-English result, note: small italic line
 * }
 * Returns { g, height }.
 */
export function resultsCard({ x = 20, y = 20, w = 340, title, pass, rows = [], measured = null, allowed = null, sentence = '', note = '' }) {
    const g = createSVG('g', {});
    const accent = pass ? COLORS.pass : COLORS.fail;
    const bg = createSVG('rect', { x, y, width: w, height: 10, rx: 10, fill: 'rgba(255,255,255,0.96)', stroke: COLORS.cardBorder, 'stroke-width': 1.5 });
    const bar = createSVG('rect', { x, y, width: 5, height: 10, rx: 2, fill: accent });
    g.appendChild(bg);
    g.appendChild(bar);

    g.appendChild(text(title, x + 18, y + 29, { size: 15, weight: 800, fill: COLORS.ink }));
    g.appendChild(createSVG('rect', { x: x + w - 82, y: y + 12, width: 64, height: 24, rx: 12, fill: pass ? COLORS.passTint : COLORS.failTint, stroke: accent, 'stroke-width': 1.5 }));
    g.appendChild(text(pass ? 'PASS' : 'FAIL', x + w - 50, y + 28.5, { size: 12.5, weight: 800, fill: accent, anchor: 'middle', letterSpacing: '0.05em' }));

    let cy = y + 60;
    for (const [label, value, opt = {}] of rows) {
        g.appendChild(text(label, x + 18, cy, { size: 13.5, fill: opt.strong ? COLORS.ink : COLORS.muted, weight: opt.strong ? 700 : 400 }));
        g.appendChild(text(value, x + w - 18, cy, { size: 14, weight: 700, fill: opt.color ?? COLORS.ink, anchor: 'end', mono: true }));
        cy += 22;
    }
    if (measured != null && allowed != null) {
        g.appendChild(gauge(x + 18, cy - 4, w - 36, measured, allowed, accent));
        cy += 42;
    }
    if (sentence) {
        const wt = wrapText(sentence, x + 18, cy + 6, Math.floor((w - 36) / 7), 17, { size: 13, fill: COLORS.text });
        g.appendChild(wt);
        cy += wt.childNodes.length * 17 + 2;
    }
    if (note) {
        g.appendChild(text(note, x + 18, cy + 6, { size: 12, italic: true, fill: COLORS.muted }));
        cy += 20;
    }
    const height = cy - y + 6;
    bg.setAttribute('height', height);
    bar.setAttribute('height', height);
    return { g, height };
}

/** Horizontal gauge: bar fills to value; tick marks the limit (scale 0–1.5×limit). */
export function gauge(x, y, w, value, limit, accent) {
    const g = createSVG('g', {});
    const max = limit * 1.5;
    const limitX = x + (limit / max) * w;
    const valW = Math.min(w, (Math.max(0, value) / max) * w);
    g.appendChild(createSVG('rect', { x, y, width: w, height: 10, rx: 5, fill: '#f1f5f9' }));
    g.appendChild(createSVG('rect', { x, y, width: limitX - x, height: 10, rx: 5, fill: COLORS.zoneFill }));
    if (valW > 0) g.appendChild(createSVG('rect', { x, y, width: valW, height: 10, rx: 5, fill: accent }));
    g.appendChild(createSVG('line', { x1: limitX, y1: y - 5, x2: limitX, y2: y + 15, stroke: COLORS.ink, 'stroke-width': 2 }));
    g.appendChild(text('limit', limitX, y + 30, { size: 11, fill: COLORS.muted, anchor: 'middle' }));
    return g;
}
