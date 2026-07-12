// modules/decode/symbols.js
// ============================================================================
// SHARED EXACT-GEOMETRY SYMBOL LIBRARY — APPEND-ONLY (see DECODER_SPEC.md §4)
// All shapes are constructed SVG geometry per the cited standard. No Unicode
// characters are ever used as rendered content.
//
// Convention: every symbol function has the signature
//     fn(x, y, h, opts = {})
// where (x, y) is the anchor point ON the reference line, h is the symbol
// height, and opts.flip = true mirrors the symbol to the OTHER side of the
// line (AWS: above the line = other side). Symbols are drawn in local
// coordinates with +y pointing AWAY from the reference line ("below" it);
// flip handles the mirror. NEVER put <text> inside a flipped group.
//
// Welding geometry per AWS A2.4:2020 (symbol shapes, Figs. 1–3 and Annex
// charts). Curved groove shapes (U, J, flare) are drawn to chart proportions;
// verify against the AWS master chart per DECODER_SPEC.md §8.
// ============================================================================

const NS = "http://www.w3.org/2000/svg";

/** Create an SVG element with attributes (self-contained; no shell imports). */
export function el(type, attrs = {}) {
    const e = document.createElementNS(NS, type);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
}

/** Anchored, optionally mirrored group for a symbol at (x,y) on the ref line. */
export function anchor(x, y, flip = false) {
    return el('g', { transform: `translate(${x},${y}) scale(1,${flip ? -1 : 1})` });
}

const STROKE = { stroke: '#0f172a', 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

/** Relative widths (multiplier of h) so callers can place dimension text. */
export const WELD_W = {
    fillet: 1.4, square: 0.45, v: 0.9, bevel: 0.85, u: 0.8, j: 0.8,
    flareV: 0.9, flareBevel: 0.85, plug: 1.2, spot: 0.9, seam: 0.9
};

// ---------------------------------------------------------------------------
// WELD SYMBOLS (AWS A2.4 basic weld symbols)
// ---------------------------------------------------------------------------

/** Fillet weld: right triangle, PERPENDICULAR LEG ALWAYS ON THE LEFT (A2.4). */
export function filletWeld(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 L0 ${h} L${1.4 * h} 0 Z` }));
    return g;
}

/** Square groove: two parallel lines perpendicular to the reference line. */
export function squareGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 V ${h * 0.85} M ${0.45 * h} 0 V ${h * 0.85}` }));
    return g;
}

/** V-groove: open "V", tips on the reference line, vertex away from it. */
export function vGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 L${0.45 * h} ${h} L${0.9 * h} 0` }));
    return g;
}

/** Bevel groove: perpendicular leg (left) + angled leg, both from the line.
 *  Reminder for callers: arrow must point (broken if needed) at the member
 *  to be prepared. */
export function bevelGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 L0 ${h} L${0.85 * h} 0` }));
    return g;
}

/** U-groove: two short perpendicular stubs joined by a semicircular bottom. */
export function uGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', {
        ...STROKE,
        d: `M0 0 V ${0.35 * h} A ${0.4 * h} ${0.55 * h} 0 0 0 ${0.8 * h} ${0.35 * h} V 0`
    }));
    return g;
}

/** J-groove: full perpendicular leg + quarter-arc to a short far side. */
export function jGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', {
        ...STROKE,
        d: `M0 0 V ${0.88 * h} A ${0.42 * h} ${0.42 * h} 0 0 0 ${0.78 * h} ${0.42 * h} V ${0.3 * h}`
    }));
    return g;
}

/** Flare-V groove: two opposed convex arcs, tangent-vertical at the line. */
export function flareVGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 Q ${0.45 * h} ${0.08 * h} ${0.45 * h} ${0.85 * h}` }));
    g.appendChild(el('path', { ...STROKE, d: `M${0.9 * h} 0 Q ${0.45 * h} ${0.08 * h} ${0.45 * h} ${0.85 * h}` }));
    return g;
}

/** Flare-bevel groove: perpendicular leg + single opposed convex arc. */
export function flareBevelGroove(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 V ${0.85 * h}` }));
    g.appendChild(el('path', { ...STROKE, d: `M${0.75 * h} 0 Q ${0.12 * h} ${0.12 * h} ${0.08 * h} ${0.85 * h}` }));
    return g;
}

/** Plug / slot weld: open rectangle. */
export function plugWeld(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('rect', { ...STROKE, x: 0, y: 0.15 * h, width: 1.2 * h, height: 0.6 * h }));
    return g;
}

/** Spot / projection weld: circle. Centered on the line when no side matters;
 *  callers place it below/above for arrow/other side significance. */
export function spotWeld(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('circle', { ...STROKE, cx: 0.45 * h, cy: 0.5 * h, r: 0.38 * h }));
    return g;
}

/** Seam weld: spot circle crossed by two horizontal lines. */
export function seamWeld(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('circle', { ...STROKE, cx: 0.45 * h, cy: 0.5 * h, r: 0.38 * h }));
    g.appendChild(el('path', {
        ...STROKE, 'stroke-width': 1.5,
        d: `M ${-0.15 * h} ${0.38 * h} H ${1.05 * h} M ${-0.15 * h} ${0.62 * h} H ${1.05 * h}`
    }));
    return g;
}

// ---------------------------------------------------------------------------
// SUPPLEMENTARY SYMBOLS (AWS A2.4)
// ---------------------------------------------------------------------------

/** Back / backing weld: OPEN half-circle on the side of the reference line
 *  OPPOSITE the groove symbol. Drawn bulging away from the line. */
export function backWeld(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', { ...STROKE, d: `M0 0 A ${0.45 * h} ${0.45 * h} 0 0 0 ${0.9 * h} 0` }));
    return g;
}

/** Melt-through: FILLED half-circle, opposite side of the line from the weld. */
export function meltThrough(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('path', {
        d: `M0 0 A ${0.45 * h} ${0.45 * h} 0 0 0 ${0.9 * h} 0 Z`,
        fill: '#0f172a', stroke: 'none'
    }));
    return g;
}

/** Backing bar: open rectangle on the opposite side of the line. */
export function backingBar(x, y, h, opts = {}) {
    const g = anchor(x, y, opts.flip);
    g.appendChild(el('rect', { ...STROKE, x: 0, y: 0.1 * h, width: 1.1 * h, height: 0.5 * h }));
    return g;
}

/** Weld-all-around: circle at the junction of leader and reference line. */
export function weldAllAround(x, y, r = 9) {
    return el('circle', { ...STROKE, cx: x, cy: y, r });
}

/** Field weld flag: pole up from the junction, solid triangular flag. */
export function fieldFlag(x, y, len = 40) {
    const g = el('g');
    g.appendChild(el('line', { ...STROKE, x1: x, y1: y, x2: x, y2: y - len }));
    g.appendChild(el('path', { d: `M${x} ${y - len} L${x + 26} ${y - len + 8} L${x} ${y - len + 16} Z`, fill: '#0f172a' }));
    return g;
}

/** Tail: two angled lines at the arrow-opposite end of the reference line. */
export function tailMark(x, y, h = 14) {
    const g = el('g');
    g.appendChild(el('line', { ...STROKE, x1: x, y1: y, x2: x - h, y2: y - h * 0.75 }));
    g.appendChild(el('line', { ...STROKE, x1: x, y1: y, x2: x - h, y2: y + h * 0.75 }));
    return g;
}

/** Contour mark over the FACE (outward edge) of a weld symbol.
 *  type: 'flush' | 'convex' | 'concave'. flip mirrors for the other side. */
export function contourMark(x, y, w, type, opts = {}) {
    const g = anchor(x, y, opts.flip);
    if (type === 'flush') {
        g.appendChild(el('line', { ...STROKE, x1: 0, y1: 6, x2: w, y2: 6 }));
    } else if (type === 'convex') {
        // bulges away from the reference line
        g.appendChild(el('path', { ...STROKE, d: `M0 4 Q ${w / 2} ${16} ${w} 4` }));
    } else if (type === 'concave') {
        // dished toward the reference line
        g.appendChild(el('path', { ...STROKE, d: `M0 14 Q ${w / 2} ${2} ${w} 14` }));
    }
    return g;
}

// ---------------------------------------------------------------------------
// FUTURE SECTIONS (append below; never modify above without explicit request)
//   - GD&T characteristics & modifiers (ASME Y14.5-2018)
//   - Hole callout symbols: counterbore, spotface, countersink, depth (Y14.5)
//   - Surface texture marks (ISO 1302)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HOLE CALLOUT SYMBOLS (ASME Y14.5-2018 dimensioning symbols)
// Appended for hole_callouts.js. Glyphs are TEXT-LIKE: anchored at the left
// end of their baseline (x, y), drawn UPWARD (negative local y), so they can
// be composed inline with dimension text. No flip option needed.
// ---------------------------------------------------------------------------

/** Relative advance widths (multiplier of h) for inline composition. */
export const HOLE_W = { dia: 1.1, cbore: 1.2, csink: 1.15, depth: 0.85 };

/** Diameter: circle with a 60-degree slash through it. */
export function diaSymbol(x, y, h) {
    const g = el('g', { transform: `translate(${x},${y})` });
    g.appendChild(el('circle', { ...HSTROKE, cx: 0.5 * h, cy: -0.38 * h, r: 0.36 * h }));
    g.appendChild(el('line', { ...HSTROKE, x1: 0.16 * h, y1: -0.02 * h, x2: 0.84 * h, y2: -0.74 * h }));
    return g;
}

/** Counterbore / spotface: open-TOP rectangle. */
export function cboreSymbol(x, y, h) {
    const g = el('g', { transform: `translate(${x},${y})` });
    g.appendChild(el('path', { ...HSTROKE, d: `M0 ${-0.72 * h} L0 0 L${1.05 * h} 0 L${1.05 * h} ${-0.72 * h}` }));
    return g;
}

/** Countersink: open-top "V" (90-degree included as drawn). */
export function csinkSymbol(x, y, h) {
    const g = el('g', { transform: `translate(${x},${y})` });
    g.appendChild(el('path', { ...HSTROKE, d: `M0 ${-0.72 * h} L${0.5 * h} 0 L${1.0 * h} ${-0.72 * h}` }));
    return g;
}

/** Depth: downward arrow with a horizontal bar at the bottom. */
export function depthSymbol(x, y, h) {
    const g = el('g', { transform: `translate(${x},${y})` });
    g.appendChild(el('line', { ...HSTROKE, x1: 0.38 * h, y1: -0.85 * h, x2: 0.38 * h, y2: -0.14 * h }));
    g.appendChild(el('path', { ...HSTROKE, d: `M${0.2 * h} ${-0.36 * h} L${0.38 * h} ${-0.12 * h} L${0.56 * h} ${-0.36 * h}` }));
    g.appendChild(el('line', { ...HSTROKE, x1: 0, y1: 0, x2: 0.76 * h, y2: 0 }));
    return g;
}

const HSTROKE = { stroke: '#0f172a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

// ---------------------------------------------------------------------------
// GD&T CHARACTERISTIC GLYPHS & MODIFIERS (ASME Y14.5-2018, Table 3-1 shapes)
// Appended for composite_frames.js. gdtChar() draws any of the 14
// characteristics CENTERED at (x, y) with overall size h. circledMod()
// draws the circled modifier letters (M, L, P, F, T, U, S...).
// Note: concentricity & symmetry were REMOVED in Y14.5-2018 but appear on
// legacy drawings, so they remain decodable here.
// ---------------------------------------------------------------------------

function arrowTip(x1, y1, x2, y2) {
    // small manual arrowhead at (x2,y2), pointing along (x1,y1)->(x2,y2)
    const a = Math.atan2(y2 - y1, x2 - x1), L = 7, W = 0.45;
    const p1 = [x2 - L * Math.cos(a - W), y2 - L * Math.sin(a - W)];
    const p2 = [x2 - L * Math.cos(a + W), y2 - L * Math.sin(a + W)];
    return el('path', { d: `M${p1[0]} ${p1[1]} L${x2} ${y2} L${p2[0]} ${p2[1]}`, ...GSTROKE });
}

const GSTROKE = { stroke: '#0f172a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

export function gdtChar(key, x, y, h) {
    const g = el('g', { transform: `translate(${x},${y})` });
    const p = d => g.appendChild(el('path', { d, ...GSTROKE }));
    const ln = (x1, y1, x2, y2) => g.appendChild(el('line', { x1: x1 * h, y1: y1 * h, x2: x2 * h, y2: y2 * h, ...GSTROKE }));
    const circ = r => g.appendChild(el('circle', { cx: 0, cy: 0, r: r * h, ...GSTROKE }));

    switch (key) {
        case 'straightness': ln(-0.42, 0, 0.42, 0); break;
        case 'flatness':
            p(`M${-0.42 * h} ${0.26 * h} L${-0.12 * h} ${-0.26 * h} L${0.42 * h} ${-0.26 * h} L${0.12 * h} ${0.26 * h} Z`); break;
        case 'circularity': circ(0.34); break;
        case 'cylindricity':
            circ(0.28);
            ln(-0.46, 0.42, -0.16, -0.42); ln(0.16, 0.42, 0.46, -0.42); break;
        case 'profileLine':
            p(`M${-0.38 * h} ${0.16 * h} A ${0.38 * h} ${0.38 * h} 0 0 1 ${0.38 * h} ${0.16 * h}`); break;
        case 'profileSurface':
            p(`M${-0.38 * h} ${0.16 * h} A ${0.38 * h} ${0.38 * h} 0 0 1 ${0.38 * h} ${0.16 * h} Z`); break;
        case 'angularity':
            ln(-0.42, 0.3, 0.44, 0.3); ln(-0.42, 0.3, 0.34, -0.36); break;
        case 'perpendicularity':
            ln(-0.38, 0.32, 0.38, 0.32); ln(0, 0.32, 0, -0.38); break;
        case 'parallelism':
            ln(-0.3, 0.4, 0.1, -0.4); ln(-0.1, 0.4, 0.3, -0.4); break;
        case 'position':
            circ(0.28); ln(-0.46, 0, 0.46, 0); ln(0, -0.46, 0, 0.46); break;
        case 'concentricity': circ(0.18); circ(0.36); break;
        case 'symmetry':
            ln(-0.42, 0, 0.42, 0); ln(-0.26, -0.2, 0.26, -0.2); ln(-0.26, 0.2, 0.26, 0.2); break;
        case 'circularRunout':
            ln(-0.24, 0.36, 0.22, -0.32);
            g.appendChild(arrowTip(-0.24 * h, 0.36 * h, 0.24 * h, -0.36 * h)); break;
        case 'totalRunout':
            ln(-0.4, 0.36, 0.44, 0.36);
            ln(-0.4, 0.36, 0.02, -0.32); g.appendChild(arrowTip(-0.4 * h, 0.36 * h, 0.04 * h, -0.36 * h));
            ln(0.02, 0.36, 0.44, -0.32); g.appendChild(arrowTip(0.02 * h, 0.36 * h, 0.46 * h, -0.36 * h)); break;
    }
    return g;
}

/** Circled modifier letter (M, L, P, F, T, U, ...) centered at (x, y). */
export function circledMod(x, y, r, letter) {
    const g = el('g');
    g.appendChild(el('circle', { cx: x, cy: y, r, ...GSTROKE, 'stroke-width': 1.8 }));
    const t = el('text', {
        x, y: y + 0.5, 'font-size': r * 1.25, fill: '#0f172a', 'font-weight': '700',
        'font-family': 'ui-sans-serif, system-ui, sans-serif',
        'text-anchor': 'middle', 'dominant-baseline': 'central'
    });
    t.textContent = letter;
    g.appendChild(t);
    return g;
}
