// modules/decode/symbol_finder.js
// ============================================================================
// SYMBOL FINDER: a visual index of the symbols found on engineering drawings.
// Pick the shape you see → name, meaning, the common misreading, and a link
// to the tool that decodes it in full. Glyphs come from symbols.js
// (constructed geometry, no Unicode as rendered content: DECODER_SPEC §4).
// ============================================================================

import {
    el, gdtChar, circledMod, diaSymbol, cboreSymbol, csinkSymbol, depthSymbol,
    filletWeld, squareGroove, vGroove, bevelGroove, uGroove, jGroove, flareVGroove, flareBevelGroove,
    plugWeld, spotWeld, seamWeld, backWeld, meltThrough, backingBar, weldAllAround, fieldFlag, tailMark,
    WELD_W, surfaceTexture, laySymbol, squareSymbol, arcLengthSymbol, slopeSymbol, conicalTaperSymbol,
    dimensionOriginSymbol, datumTargetSymbol, datumTargetPoint, betweenSymbol, statisticalSymbol
} from './symbols.js';
import { COLORS, text, wrapText } from '../../theme.js';

// --- DRAWING HELPERS (each returns fn(x, y, h) → SVG node centered on x, y) ---

const INK = '#0f172a';
const STROKE = { stroke: INK, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

const char = key => (x, y, h) => gdtChar(key, x, y, h);
const mod = letter => (x, y, h) => circledMod(x, y, h * 0.42, letter);
const word = (str, scale = 0.62) => (x, y, h) => text(str, x, y, { size: h * scale, weight: 700, fill: INK, anchor: 'middle', baseline: 'central' });
const hole = fn => (x, y, h) => fn(x - h * 0.52, y + h * 0.36, h);

// Weld symbol hanging under a short reference line (arrow side)
const weld = (fn, key) => (x, y, h) => {
    const g = el('g');
    const s = h * 0.62, refY = y - s * 0.45;
    g.appendChild(el('line', { ...STROKE, x1: x - h * 0.95, y1: refY, x2: x + h * 0.95, y2: refY }));
    g.appendChild(fn(x - (WELD_W[key] ?? 0.9) * s / 2, refY, s));
    return g;
};

// Supplementary weld mark: groove below the line, the mark above (other side)
const weldOther = fn => (x, y, h) => {
    const g = el('g');
    const s = h * 0.55, refY = y;
    g.appendChild(el('line', { ...STROKE, x1: x - h * 0.95, y1: refY, x2: x + h * 0.95, y2: refY }));
    g.appendChild(vGroove(x - 0.45 * s, refY, s));
    g.appendChild(fn(x - 0.45 * s, refY, s, { flip: true }));
    return g;
};

// Leader elbow with a mark at the junction (all around, field weld, ...)
const elbow = draw => (x, y, h) => {
    const g = el('g');
    const jx = x - h * 0.2, jy = y + h * 0.1;
    g.appendChild(el('line', { ...STROKE, x1: jx, y1: jy, x2: x + h * 0.95, y2: jy }));
    g.appendChild(el('line', { ...STROKE, x1: jx, y1: jy, x2: jx - h * 0.6, y2: jy + h * 0.55 }));
    draw(g, jx, jy, h);
    return g;
};

// Basic dimension (number in a box)
const basicDim = (x, y, h) => {
    const g = el('g');
    g.appendChild(el('rect', { ...STROKE, x: x - h * 0.75, y: y - h * 0.33, width: h * 1.5, height: h * 0.66 }));
    g.appendChild(text('25', x, y, { size: h * 0.42, weight: 700, fill: INK, anchor: 'middle', baseline: 'central' }));
    return g;
};

const sphericalDia = (x, y, h) => {
    const g = el('g');
    g.appendChild(text('S', x - h * 0.32, y, { size: h * 0.6, weight: 700, fill: INK, anchor: 'middle', baseline: 'central' }));
    g.appendChild(diaSymbol(x - h * 0.12, y + h * 0.34, h * 0.9));
    return g;
};

const datumFeature = (x, y, h) => {
    const g = el('g');
    const b = h * 0.46, top = y - h * 0.62;
    g.appendChild(el('rect', { ...STROKE, x: x - b / 2, y: top, width: b, height: b }));
    g.appendChild(text('A', x, top + b / 2, { size: b * 0.62, weight: 700, fill: INK, anchor: 'middle', baseline: 'central' }));
    g.appendChild(el('line', { ...STROKE, x1: x, y1: top + b, x2: x, y2: y + h * 0.25 }));
    g.appendChild(el('path', { d: `M${x - h * 0.2} ${y + h * 0.5} L${x + h * 0.2} ${y + h * 0.5} L${x} ${y + h * 0.22} Z`, fill: INK }));
    g.appendChild(el('line', { ...STROKE, x1: x - h * 0.7, y1: y + h * 0.5, x2: x + h * 0.7, y2: y + h * 0.5 }));
    return g;
};

const targetArea = (x, y, h) => {
    const g = el('g');
    const r = h * 0.4;
    for (let i = -3; i <= 3; i++) {
        const o = i * r * 0.33;
        const half = Math.sqrt(Math.max(r * r - o * o, 0));
        g.appendChild(el('line', { stroke: INK, 'stroke-width': 1, x1: x + o - half * 0.7, y1: y + half * 0.7, x2: x + o + half * 0.7, y2: y - half * 0.7 }));
    }
    g.appendChild(el('circle', { ...STROKE, cx: x, cy: y, r, 'stroke-dasharray': '10 3 2 3' }));
    return g;
};

const targetLine = (x, y, h) => {
    const g = el('g');
    g.appendChild(el('line', { ...STROKE, x1: x - h * 0.8, y1: y, x2: x + h * 0.8, y2: y, 'stroke-dasharray': '10 3 2 3' }));
    g.appendChild(datumTargetPoint(x, y, h * 0.7));
    return g;
};

const allOver = (x, y, h) => elbow((g, jx, jy) => {
    g.appendChild(el('circle', { ...STROKE, cx: jx, cy: jy, r: h * 0.13, fill: '#fff' }));
    g.appendChild(el('circle', { ...STROKE, cx: jx, cy: jy, r: h * 0.2 }));
})(x, y, h);

const allAround = (x, y, h) => elbow((g, jx, jy) => {
    g.appendChild(el('circle', { ...STROKE, cx: jx, cy: jy, r: h * 0.16, fill: '#fff' }));
})(x, y, h);

const surf = opts => (x, y, h) => surfaceTexture(x - h * 0.15, y + h * 0.45, h * 0.95, opts);
const lay = kind => (x, y, h) => laySymbol(kind, x, y, h * 0.8);

// --- CATALOGUE ---

const CHAR = 'CHARACTERISTICS', DEC = 'DECODE';
const FRAME_LINK = { label: 'Decode a full frame', cat: DEC, sym: 'composite_frames' };
const toolLink = (sym, name) => ({ label: `Open the ${name} tool`, cat: CHAR, sym });
const WELD_LINK = { label: 'Decode a welding symbol', cat: DEC, sym: 'welding' };
const HOLE_LINK = { label: 'Decode a hole callout', cat: DEC, sym: 'hole_callouts' };
const SURF_LINK = { label: 'Decode a surface finish callout', cat: DEC, sym: 'surface_finish' };

const FAMILIES = [
    { key: 'characteristics', label: 'Geometric characteristics', std: 'ASME Y14.5-2018' },
    { key: 'modifiers', label: 'Modifiers in a frame', std: 'ASME Y14.5-2018' },
    { key: 'datums', label: 'Datums and targets', std: 'ASME Y14.5-2018' },
    { key: 'dimensioning', label: 'Dimensioning symbols', std: 'ASME Y14.5-2018' },
    { key: 'welding', label: 'Welding symbols', std: 'AWS A2.4' },
    { key: 'surface', label: 'Surface texture', std: 'ISO 1302 / ASME Y14.36' },
    { key: 'iso', label: 'ISO-only symbols', std: 'ISO 1101 / ISO 8015' }
];

const SYMBOLS = [
    // Geometric characteristics
    { family: 'characteristics', name: 'Straightness', draw: char('straightness'), aliases: 'form line axis',
      meaning: 'Each line element of the surface must lie between two parallel lines t apart. With Ø before the value it controls the axis instead, within a cylinder of diameter t.',
      misread: 'Never has a datum: it is a form control. With Ø it applies to the axis and may exceed the size envelope (Rule #1 no longer limits it).',
      links: [toolLink('straightness', 'Straightness'), FRAME_LINK] },
    { family: 'characteristics', name: 'Flatness', draw: char('flatness'), aliases: 'form plane',
      meaning: 'Every point of the surface must lie between two parallel planes t apart.',
      misread: 'Not measured from a datum: a flat surface can still be tilted. It only limits the surface itself.',
      links: [toolLink('flatness', 'Flatness'), FRAME_LINK] },
    { family: 'characteristics', name: 'Circularity (roundness)', draw: char('circularity'), aliases: 'form roundness',
      meaning: 'Each circular cross-section must lie between two concentric circles t apart (a radial band).',
      misread: 'Checked one section at a time, not along the length. Not the same as the diameter tolerance or runout.',
      links: [toolLink('circularity', 'Circularity'), FRAME_LINK] },
    { family: 'characteristics', name: 'Cylindricity', draw: char('cylindricity'), aliases: 'form cylinder',
      meaning: 'The whole surface must lie between two coaxial cylinders t apart (radial).',
      misread: 'Combines roundness, straightness and taper in one control. No datum.',
      links: [toolLink('cylindricity', 'Cylindricity'), FRAME_LINK] },
    { family: 'characteristics', name: 'Profile of a line', draw: char('profileLine'), aliases: 'profile arc 2d',
      meaning: 'Each line element (a 2D slice) of the surface must lie within a band around the true profile, defined by basic dimensions.',
      misread: 'Without datums it controls shape only; with datums it also controls orientation and location.',
      links: [toolLink('line_profile', 'Line Profile'), FRAME_LINK] },
    { family: 'characteristics', name: 'Profile of a surface', draw: char('profileSurface'), aliases: 'profile 3d',
      meaning: 'The whole surface must lie within a 3D band around the true profile, defined by basic dimensions.',
      misread: 'The zone is split equally (±t/2) about the true profile unless a Ⓤ modifier says otherwise.',
      links: [toolLink('surface_profile', 'Surface Profile'), FRAME_LINK] },
    { family: 'characteristics', name: 'Angularity', draw: char('angularity'), aliases: 'orientation angle',
      meaning: 'A surface or axis must lie within a zone held at a basic angle to the datum.',
      misread: 'The tolerance is a width (mm or inch), not degrees. The angle itself is a basic (boxed) dimension.',
      links: [toolLink('angularity', 'Angularity'), FRAME_LINK] },
    { family: 'characteristics', name: 'Perpendicularity', draw: char('perpendicularity'), aliases: 'orientation square 90',
      meaning: 'A surface or axis must lie within a zone held at exactly 90° to the datum.',
      misread: 'A width, not an angle. It controls orientation only, not location.',
      links: [toolLink('perpendicularity', 'Perpendicularity'), FRAME_LINK] },
    { family: 'characteristics', name: 'Parallelism', draw: char('parallelism'), aliases: 'orientation',
      meaning: 'A surface or axis must lie within a zone parallel to the datum.',
      misread: 'Does not control the distance to the datum; that comes from the size or location tolerance.',
      links: [toolLink('parallelism', 'Parallelism'), FRAME_LINK] },
    { family: 'characteristics', name: 'Position', draw: char('position'), aliases: 'location true position tp',
      meaning: 'Locates a feature of size (its axis or center plane) within a zone at true position, set by basic dimensions from the datums.',
      misread: 'The value is a diameter: position = 2 × the offset. With Ⓜ the zone grows as the hole grows (bonus).',
      links: [toolLink('position', 'Position'), { label: 'Check CMM results', cat: 'INSPECTION', sym: 'cmm_position' }, FRAME_LINK] },
    { family: 'characteristics', name: 'Concentricity', draw: char('concentricity'), aliases: 'location coaxial legacy',
      meaning: 'Median points of the feature must lie within a cylinder around the datum axis. Removed in Y14.5-2018; still found on older drawings.',
      misread: 'Hard to inspect (median points, not the surface). Today use position, runout or profile instead.',
      links: [toolLink('concentricity', 'Concentricity'), FRAME_LINK] },
    { family: 'characteristics', name: 'Symmetry', draw: char('symmetry'), aliases: 'location center plane legacy',
      meaning: 'Median points of opposed elements must lie between two planes about the datum center plane. Removed in Y14.5-2018.',
      misread: 'Often misused where position of a slot or tab was meant; position is easier to inspect.',
      links: [toolLink('symmetry', 'Symmetry'), FRAME_LINK] },
    { family: 'characteristics', name: 'Circular runout', draw: char('circularRunout'), aliases: 'runout fim wobble',
      meaning: 'Each circular element, rotated 360° about the datum axis, must not vary more than t on an indicator (FIM).',
      misread: 'Checked one section at a time; it catches both out-of-round and off-center, but not taper along the length.',
      links: [toolLink('circular_runout', 'Circular Runout'), FRAME_LINK] },
    { family: 'characteristics', name: 'Total runout', draw: char('totalRunout'), aliases: 'runout fim',
      meaning: 'The whole surface, rotated about the datum axis with the indicator sweeping its full length, must not vary more than t.',
      misread: 'Stricter than circular runout: also catches taper and bend along the length.',
      links: [toolLink('total_runout', 'Total Runout'), FRAME_LINK] },

    // Modifiers
    { family: 'modifiers', name: 'MMC / MMB (M in a circle)', draw: mod('M'), aliases: 'maximum material condition bonus',
      meaning: 'Maximum material condition: the tolerance applies when the feature has the most material (smallest hole, largest pin), and grows by the bonus as it departs. After a datum letter it means MMB.',
      misread: 'Only valid on features of size (holes, pins, slots, tabs), never on a plane surface.',
      links: [{ label: 'See bonus tolerance', cat: 'MATERIAL', sym: 'bonus' }] },
    { family: 'modifiers', name: 'LMC / LMB (L in a circle)', draw: mod('L'), aliases: 'least material condition',
      meaning: 'Least material condition: the tolerance applies at the least material (largest hole, smallest pin) and grows as the feature gains material. After a datum letter it means LMB.',
      misread: 'Used to protect minimum wall thickness, not assembly. Bonus runs the opposite way to MMC.',
      links: [{ label: 'See bonus tolerance', cat: 'MATERIAL', sym: 'bonus' }] },
    { family: 'modifiers', name: 'RFS (S in a circle, legacy)', draw: mod('S'), aliases: 'regardless of feature size',
      meaning: 'Regardless of feature size: no bonus. Pre-1994 drawings show it; today RFS is the default and no symbol is shown.',
      misread: 'On a modern drawing, no modifier already means RFS.' },
    { family: 'modifiers', name: 'Projected tolerance zone', draw: mod('P'), aliases: 'projected thread stud',
      meaning: 'The tolerance zone extends above the part by the height shown after the symbol, where the mating part sits.',
      misread: 'Typical on tapped holes and press-fit pins: a tilted thread can push the bolt into the mating part even when the hole itself is in tolerance.',
      links: [{ label: 'See fastener formulas', cat: 'STACKUPS', sym: 'fasteners' }] },
    { family: 'modifiers', name: 'Free state', draw: mod('F'), aliases: 'non rigid',
      meaning: 'The tolerance applies with the part unrestrained, as it sits free (thin or non-rigid parts).',
      misread: 'Usually paired with a restraint note for the other requirements, which are checked clamped.' },
    { family: 'modifiers', name: 'Tangent plane', draw: mod('T'), aliases: 'high points',
      meaning: 'The control applies to the plane touching the high points of the surface, not to every point.',
      misread: 'Surface waviness between the high points is not controlled by it.' },
    { family: 'modifiers', name: 'Unequally disposed profile', draw: mod('U'), aliases: 'unilateral profile',
      meaning: 'Profile zone not split equally. The value after the symbol is how much of the zone lies on the side that adds material.',
      misread: 'The second value is not a second tolerance: it only says where the zone sits.' },
    { family: 'modifiers', name: 'Independency (I in a circle)', draw: mod('I'), aliases: 'rule 1 envelope',
      meaning: 'Rule #1 (perfect form at MMC) does not apply to this size: size and form are checked separately.',
      misread: 'Without it, an ASME size tolerance also limits form (the envelope).' },
    { family: 'modifiers', name: 'Statistical tolerance', draw: (x, y, h) => statisticalSymbol(x, y, h * 0.9), aliases: 'st spc',
      meaning: 'The tolerance was calculated statistically (RSS) and assumes the process is under statistical control.',
      misread: 'Usually needs a note giving the capability required (e.g. Cpk ≥ 1.33).',
      links: [{ label: 'See tolerance stack-up', cat: 'STACKUPS', sym: 'stackup' }] },
    { family: 'modifiers', name: 'Continuous feature', draw: word('CF', 0.5), aliases: 'interrupted',
      meaning: 'Several interrupted surfaces or features of size are treated as one continuous feature.',
      misread: 'Without CF, each interrupted segment would be controlled separately.' },
    { family: 'modifiers', name: 'Between', draw: (x, y, h) => betweenSymbol(x, y, h), aliases: 'from to',
      meaning: 'The control applies only between the two points named (e.g. from A to B), usually on a profile.',
      misread: 'The letters at each end are points on the outline, not datums.' },
    { family: 'modifiers', name: 'All around', draw: allAround, aliases: 'profile outline',
      meaning: 'A circle at the leader elbow: the profile applies all the way around the outline shown in that view.',
      misread: 'Only around that view\'s outline, not every surface of the part (that is all over).' },
    { family: 'modifiers', name: 'All over', draw: allOver, aliases: 'every surface',
      meaning: 'Two concentric circles at the leader elbow: the profile applies to every surface of the part.',
      misread: 'Easy to confuse with all around, which is one circle.' },
    { family: 'modifiers', name: 'Translation (datum)', draw: (x, y, h) => conicalTaperSymbol(x, y, h * 0.8), aliases: 'movable simulator',
      meaning: 'After a datum letter in a frame: the datum simulator may move (translate) to engage the datum feature.',
      misread: 'Same triangle shape as conical taper; inside a frame after a datum it means translation.' },

    // Datums
    { family: 'datums', name: 'Datum feature symbol', draw: datumFeature, aliases: 'datum triangle',
      meaning: 'Identifies the real feature that establishes datum A: a surface, or (when aligned with a size dimension) an axis or center plane.',
      misread: 'On a surface it means the surface; lined up with a dimension line it means the axis or center plane of that size.',
      links: [{ label: 'See the datum reference frame', cat: 'DATUMS', sym: 'drf' }] },
    { family: 'datums', name: 'Datum target symbol', draw: (x, y, h) => datumTargetSymbol(x, y, h * 0.48, 'Ø6', 'A1'), aliases: 'target a1',
      meaning: 'A circle split in two: the target size on top (if an area), the datum letter and target number below (A1 = first target on datum A).',
      misread: 'Datum A is then established by the targets only, not the whole surface.',
      links: [{ label: 'See the datum reference frame', cat: 'DATUMS', sym: 'drf' }] },
    { family: 'datums', name: 'Datum target point', draw: (x, y, h) => datumTargetPoint(x, y, h), aliases: 'point x',
      meaning: 'An X on the surface: the part is located at one point here (a pin or spherical locator).',
      misread: 'It is a contact point for the fixture, not a hole or a reference mark.' },
    { family: 'datums', name: 'Datum target line', draw: targetLine, aliases: 'line phantom',
      meaning: 'A phantom line with an X: the part is located along a line (the edge of a locator).',
      misread: 'Shown as an X in edge view and as a phantom line in the other view.' },
    { family: 'datums', name: 'Datum target area', draw: targetArea, aliases: 'area hatched',
      meaning: 'A hatched area bounded by a phantom line: the locator contacts the part over that area.',
      misread: 'Its size is given in the top half of the target symbol.' },

    // Dimensioning
    { family: 'dimensioning', name: 'Diameter', draw: hole(diaSymbol), aliases: 'dia o slash',
      meaning: 'The dimension is a diameter.',
      misread: 'In a feature control frame, Ø before the tolerance means a cylindrical zone.' },
    { family: 'dimensioning', name: 'Spherical diameter', draw: sphericalDia, aliases: 'sphere',
      meaning: 'SØ: diameter of a sphere. In a frame, SØ before the tolerance means a spherical zone (e.g. for a ball center).',
      misread: 'Read S and Ø together as one symbol.' },
    { family: 'dimensioning', name: 'Radius / controlled radius', draw: word('R  CR', 0.45), aliases: 'radius cr sr',
      meaning: 'R: radius, the arc may have flats or reversals within the tolerance. CR: controlled radius, a fair curve with no flats or reversals. SR: spherical radius.',
      misread: 'CR is stricter than R: it forbids flats and reversals.' },
    { family: 'dimensioning', name: 'Square', draw: (x, y, h) => squareSymbol(x, y, h), aliases: 'square section',
      meaning: 'The feature is square; one dimension gives both sides.',
      misread: 'Not a basic dimension box: the square is small and sits before the number.' },
    { family: 'dimensioning', name: 'Basic dimension', draw: basicDim, aliases: 'box theoretically exact',
      meaning: 'A boxed number is theoretically exact. Its tolerance comes from a feature control frame (position, profile...), not ± on the dimension.',
      misread: 'Measure it, but don\'t reject a part on it alone: judge it with the frame it serves.' },
    { family: 'dimensioning', name: 'Reference dimension', draw: word('(12.5)', 0.42), aliases: 'reference parentheses',
      meaning: 'A dimension in parentheses is for information only; it is not inspected or toleranced.',
      misread: 'Don\'t use it to make or inspect the part.' },
    { family: 'dimensioning', name: 'Arc length', draw: (x, y, h) => { const g = el('g'); g.appendChild(arcLengthSymbol(x, y - h * 0.3, h)); g.appendChild(text('25', x, y + h * 0.12, { size: h * 0.42, weight: 700, fill: INK, anchor: 'middle', baseline: 'central' })); return g; }, aliases: 'arc curved',
      meaning: 'An arc over the number: the dimension is measured along the curve, not straight across.',
      misread: 'Not a chord length.' },
    { family: 'dimensioning', name: 'Slope', draw: (x, y, h) => slopeSymbol(x, y, h), aliases: 'incline flat taper',
      meaning: 'Slope of a flat surface, given as a ratio (e.g. 1:20). The triangle follows the direction of the slope.',
      misread: 'For flat surfaces; round tapers use the conical taper symbol.' },
    { family: 'dimensioning', name: 'Conical taper', draw: (x, y, h) => conicalTaperSymbol(x, y, h), aliases: 'taper cone',
      meaning: 'Taper of a cone, given as a ratio of diameter change to length (e.g. 0.3:1).',
      misread: 'Same triangle as the translation modifier; outside a frame, next to a ratio, it means taper.' },
    { family: 'dimensioning', name: 'Dimension origin', draw: (x, y, h) => dimensionOriginSymbol(x, y, h), aliases: 'origin start',
      meaning: 'The small circle marks the end to measure from; the tolerance applies at the other end.',
      misread: 'Matters when the two features aren\'t parallel: measure from the circle side.' },
    { family: 'dimensioning', name: 'Counterbore / spotface', draw: hole(cboreSymbol), aliases: 'cbore sf',
      meaning: 'A counterbore: flat-bottomed larger diameter at the top of a hole. With SF inside, a spotface: just deep enough to clean up a seat.',
      misread: 'A spotface with no depth means machine only enough to clean up.', links: [HOLE_LINK] },
    { family: 'dimensioning', name: 'Countersink', draw: hole(csinkSymbol), aliases: 'csink cone',
      meaning: 'A cone at the top of a hole, given as diameter × included angle (e.g. Ø12 × 90°).',
      misread: 'The angle is the included (full) angle, not the angle per side.', links: [HOLE_LINK] },
    { family: 'dimensioning', name: 'Depth', draw: hole(depthSymbol), aliases: 'deep blind',
      meaning: 'Depth of a hole or feature, to the end of the full diameter.',
      misread: 'The drill point extends beyond this depth.', links: [HOLE_LINK] },
    { family: 'dimensioning', name: 'Number of places', draw: word('4X', 0.5), aliases: 'places times',
      meaning: '4X: the callout applies to 4 identical features.',
      misread: 'It applies to everything in the stack under it (counterbore, depth, frame...).', links: [HOLE_LINK] },

    // Welding
    { family: 'welding', name: 'Fillet weld', draw: weld(filletWeld, 'fillet'), aliases: 'triangle',
      meaning: 'A triangular weld in a corner (T, lap, corner joints). The leg size is written to its left.',
      misread: 'Below the reference line = arrow side, above = other side (AWS). The vertical leg is always drawn on the left.', links: [WELD_LINK] },
    { family: 'welding', name: 'Square groove', draw: weld(squareGroove, 'square'), aliases: 'butt',
      meaning: 'Butt weld with no edge preparation.', misread: 'Two parallel lines, not an "equals" sign.', links: [WELD_LINK] },
    { family: 'welding', name: 'V-groove', draw: weld(vGroove, 'v'), aliases: 'vee',
      meaning: 'Butt weld with both edges bevelled into a V.', misread: 'No depth shown means complete joint penetration.', links: [WELD_LINK] },
    { family: 'welding', name: 'Bevel groove', draw: weld(bevelGroove, 'bevel'), aliases: 'single bevel',
      meaning: 'Only one member is bevelled; the arrow points at that member.', misread: 'A broken arrow shows which member to prepare.', links: [WELD_LINK] },
    { family: 'welding', name: 'U-groove', draw: weld(uGroove, 'u'), aliases: '',
      meaning: 'Both edges prepared with a rounded (U) bottom, for thick sections.', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'J-groove', draw: weld(jGroove, 'j'), aliases: '',
      meaning: 'One member prepared with a rounded (J) edge; the arrow points at it.', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Flare-V groove', draw: weld(flareVGroove, 'flareV'), aliases: 'flare',
      meaning: 'Weld between two curved surfaces (e.g. two tubes or bent edges).', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Flare-bevel groove', draw: weld(flareBevelGroove, 'flareBevel'), aliases: 'flare',
      meaning: 'Weld between a curved surface and a flat one (e.g. tube to plate).', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Plug / slot weld', draw: weld(plugWeld, 'plug'), aliases: 'plug slot',
      meaning: 'Fills a hole or slot in one member to join it to the other.', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Spot weld', draw: weld(spotWeld, 'spot'), aliases: 'resistance',
      meaning: 'Spot (resistance or other) weld between overlapping members.', misread: 'Centered on the line when side has no meaning (resistance welding).', links: [WELD_LINK] },
    { family: 'welding', name: 'Seam weld', draw: weld(seamWeld, 'seam'), aliases: '',
      meaning: 'A continuous row of overlapping spot welds.', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Back / backing weld', draw: weldOther(backWeld), aliases: 'back backing',
      meaning: 'Open half-circle opposite the groove: a weld on the back of the joint.', misread: 'Back weld (after) and backing weld (before) share the symbol; the tail or a note says which.', links: [WELD_LINK] },
    { family: 'welding', name: 'Melt-through', draw: weldOther(meltThrough), aliases: 'penetration',
      meaning: 'Filled half-circle: complete penetration with visible reinforcement on the back side.', misread: 'Filled = melt-through; open = back weld.', links: [WELD_LINK] },
    { family: 'welding', name: 'Backing (strip)', draw: weldOther(backingBar), aliases: 'backing bar',
      meaning: 'Rectangle opposite the groove: a backing strip behind the joint. An R inside means remove it after welding.', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Weld all around', draw: elbow((g, jx, jy) => g.appendChild(weldAllAround(jx, jy, 7))), aliases: 'around',
      meaning: 'Circle at the leader elbow: weld all the way around the joint.', misread: 'Different from the profile "all around", same shape.', links: [WELD_LINK] },
    { family: 'welding', name: 'Field weld', draw: elbow((g, jx, jy, h) => g.appendChild(fieldFlag(jx, jy, h * 0.55))), aliases: 'flag site',
      meaning: 'Flag at the elbow: the weld is made in the field (on site), not in the shop.', misread: '', links: [WELD_LINK] },
    { family: 'welding', name: 'Tail', draw: (x, y, h) => { const g = el('g'); g.appendChild(el('line', { ...STROKE, x1: x - h * 0.5, y1: y, x2: x + h * 0.9, y2: y })); g.appendChild(tailMark(x - h * 0.5, y, h * 0.35)); return g; }, aliases: 'process spec',
      meaning: 'The fork at the end of the reference line holds the process, specification or WPS reference.', misread: 'Left off when no reference is needed.', links: [WELD_LINK] },

    // Surface texture
    { family: 'surface', name: 'Surface texture (any process)', draw: surf({}), aliases: 'finish roughness ra check',
      meaning: 'Basic surface texture symbol: any manufacturing process is allowed. Values such as Ra 1.6 are written on it.',
      misread: 'The roughness value is a maximum unless stated otherwise.' , links: [SURF_LINK] },
    { family: 'surface', name: 'Material removal required', draw: surf({ removal: 'required' }), aliases: 'machined finish',
      meaning: 'The bar closes the V: the surface must be machined (material removed).',
      misread: 'Most common symbol on machined parts.' , links: [SURF_LINK] },
    { family: 'surface', name: 'Material removal prohibited', draw: surf({ removal: 'prohibited' }), aliases: 'as cast as forged',
      meaning: 'The circle in the V: leave the surface as produced (cast, forged, rolled). Do not machine.',
      misread: 'It does not mean "no requirement": the surface must stay as-produced.' , links: [SURF_LINK] },
    { family: 'surface', name: 'All around (surface texture)', draw: surf({ removal: 'required', allAround: true }), aliases: 'finish around',
      meaning: 'Circle where the long leg meets the extension line: applies to all surfaces around the outline in that view.',
      misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay parallel', draw: lay('='), aliases: 'lay direction',
      meaning: 'Machining marks run parallel to the view plane edge the symbol is attached to.', misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay perpendicular', draw: lay('perp'), aliases: 'lay direction',
      meaning: 'Machining marks run perpendicular to that edge.', misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay crossed', draw: lay('X'), aliases: 'lay direction',
      meaning: 'Marks cross in two oblique directions (e.g. honing).', misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay multidirectional', draw: lay('M'), aliases: 'lay',
      meaning: 'Marks run in many directions (e.g. lapping, grinding with a cup wheel).', misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay circular', draw: lay('C'), aliases: 'lay facing',
      meaning: 'Marks roughly circular about the center (e.g. facing on a lathe).', misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay radial', draw: lay('R'), aliases: 'lay',
      meaning: 'Marks roughly radial from the center.', misread: '' , links: [SURF_LINK] },
    { family: 'surface', name: 'Lay particulate', draw: lay('P'), aliases: 'lay',
      meaning: 'Non-directional or pitted (e.g. shot blast, EDM).', misread: '' , links: [SURF_LINK] },

    // ISO-only
    { family: 'iso', name: 'Envelope requirement (E in a circle)', draw: mod('E'), aliases: 'envelope rule 1 iso 8015',
      meaning: 'ISO: the feature must not exceed perfect form at maximum material, like ASME Rule #1.',
      misread: 'ISO drawings are independent by default (ISO 8015): without Ⓔ, size does not limit form. The opposite of ASME.' },
    { family: 'iso', name: 'Common zone', draw: word('CZ', 0.5), aliases: 'combined zone',
      meaning: 'ISO: several features share one tolerance zone (e.g. two separate faces flat and in line).',
      misread: 'Without CZ, each feature gets its own separate zone.' },
    { family: 'iso', name: 'Any cross-section', draw: word('ACS', 0.45), aliases: 'section',
      meaning: 'ISO: the requirement applies in each cross-section separately.',
      misread: '' },
    { family: 'iso', name: 'United feature', draw: word('UF', 0.5), aliases: 'continuous',
      meaning: 'ISO: several features are treated as one, similar to the ASME continuous feature (CF).',
      misread: '' }
];

// --- STATE ---
const state = { family: 'characteristics', search: '', selected: 'Position' };

let svgContainer = null;
let controlsContainer = null;

export function draw(svg) {
    svgContainer = svg;
    renderScene();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

// --- RENDERING ---

const GRID = { x: 20, y: 64, cols: 5, w: 112, h: 104, gap: 8 };
const PANEL_X = 640;

function visible() {
    const q = state.search.trim().toLowerCase();
    if (!q) return SYMBOLS.filter(s => s.family === state.family);
    return SYMBOLS.filter(s => `${s.name} ${s.aliases ?? ''} ${s.meaning}`.toLowerCase().includes(q));
}

function renderScene() {
    if (!svgContainer) return;
    svgContainer.innerHTML = '';
    const list = visible();
    const fam = FAMILIES.find(f => f.key === state.family);
    const heading = state.search.trim() ? `SEARCH: "${state.search.trim().toUpperCase()}" · ${list.length} FOUND` : `${fam.label.toUpperCase()} · ${fam.std}`;
    svgContainer.appendChild(text(heading, GRID.x, 40, { size: 12, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));
    svgContainer.appendChild(text('Click the symbol that matches your drawing.', GRID.x, 56, { size: 11.5, italic: true, fill: COLORS.muted }));

    if (list.length === 0) {
        svgContainer.appendChild(text('Nothing found. Try another word, or browse the families in the sidebar.', GRID.x, 110, { size: 14, fill: COLORS.muted }));
    }

    const maxCards = GRID.cols * 5;
    list.slice(0, maxCards).forEach((s, i) => drawCard(s, i));
    if (list.length > maxCards) {
        svgContainer.appendChild(text(`+ ${list.length - maxCards} more: narrow the search`, GRID.x, 640, { size: 12, italic: true, fill: COLORS.muted }));
    }

    const sel = SYMBOLS.find(s => s.name === state.selected) ?? list[0];
    if (sel) drawDetail(sel);
}

function drawCard(s, i) {
    const col = i % GRID.cols, row = Math.floor(i / GRID.cols);
    const x = GRID.x + col * (GRID.w + GRID.gap), y = GRID.y + row * (GRID.h + GRID.gap);
    const active = s.name === state.selected;
    const g = el('g', { style: 'cursor: pointer' });
    g.appendChild(el('rect', {
        x, y, width: GRID.w, height: GRID.h, rx: 10,
        fill: active ? '#eff6ff' : COLORS.card, stroke: active ? COLORS.zoneStroke : COLORS.cardBorder, 'stroke-width': active ? 2 : 1.2
    }));
    g.appendChild(s.draw(x + GRID.w / 2, y + 40, 40));
    const label = wrapText(s.name, x + GRID.w / 2, y + GRID.h - 28, 16, 12.5, { size: 10.5, weight: 600, fill: COLORS.text, anchor: 'middle' });
    if (label.childNodes.length > 2) label.setAttribute('transform', `translate(0,-6)`);
    g.appendChild(label);
    g.addEventListener('click', () => { state.selected = s.name; renderScene(); renderLinks(); });
    svgContainer.appendChild(g);
}

function drawDetail(s) {
    const g = el('g');
    const fam = FAMILIES.find(f => f.key === s.family);
    g.appendChild(el('rect', { x: PANEL_X, y: 24, width: 340, height: 610, rx: 12, fill: COLORS.card, stroke: COLORS.cardBorder }));
    g.appendChild(el('rect', { x: PANEL_X + 20, y: 44, width: 300, height: 150, rx: 8, fill: '#f8fafc', stroke: COLORS.cardBorder }));
    g.appendChild(s.draw(PANEL_X + 170, 116, 88));

    let y = 228;
    g.appendChild(wrapText(s.name, PANEL_X + 20, y, 28, 24, { size: 20, weight: 800, fill: COLORS.ink }));
    y += 24 * Math.ceil(s.name.length / 28) + 2;
    g.appendChild(text(`${fam.label} · ${fam.std}`, PANEL_X + 20, y, { size: 11.5, fill: COLORS.muted }));

    y += 32;
    g.appendChild(text('WHAT IT MEANS', PANEL_X + 20, y, { size: 11, weight: 700, fill: COLORS.muted, letterSpacing: '0.06em' }));
    const meaning = wrapText(s.meaning, PANEL_X + 20, y + 22, 44, 19, { size: 13.5, fill: COLORS.text });
    g.appendChild(meaning);
    y += 22 + 19 * meaning.childNodes.length + 16;

    if (s.misread) {
        const lines = wrapText(s.misread, PANEL_X + 32, y + 42, 42, 18, { size: 13, fill: '#92400e' });
        const boxH = 44 + 18 * lines.childNodes.length;
        g.appendChild(el('rect', { x: PANEL_X + 20, y, width: 300, height: boxH, rx: 8, fill: '#fffbeb', stroke: '#fde68a' }));
        g.appendChild(text('WATCH OUT', PANEL_X + 32, y + 22, { size: 11, weight: 700, fill: '#b45309', letterSpacing: '0.06em' }));
        g.appendChild(lines);
        y += boxH + 16;
    }
    if (s.links?.length) {
        g.appendChild(text('Go deeper: use the buttons in the sidebar.', PANEL_X + 20, Math.min(y + 8, 620), { size: 12, italic: true, fill: COLORS.zoneText }));
    }
    svgContainer.appendChild(g);
}

// --- CONTROLS ---

function renderControls() {
    if (!controlsContainer) return;
    const counts = Object.fromEntries(FAMILIES.map(f => [f.key, SYMBOLS.filter(s => s.family === f.key).length]));
    const searching = !!state.search.trim();

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Search</h4>
            <input id="sf-search" type="search" value="${state.search.replace(/"/g, '&quot;')}" placeholder="e.g. runout, bonus, countersink, finish"
                class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Browse by family</h4>
            <div class="space-y-1">
                ${FAMILIES.map(f => `
                    <button data-family="${f.key}" class="w-full flex justify-between items-center px-3 py-2 rounded text-sm ${!searching && state.family === f.key ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}">
                        <span>${f.label}</span><span class="text-xs text-slate-400">${counts[f.key]}</span>
                    </button>`).join('')}
            </div>
        </div>

        <div id="sf-links"></div>

        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Reading a drawing</div>
            <div class="text-xs opacity-90 leading-relaxed">
                Check the title block for the standard (ASME Y14.5 or ISO) first: some symbols mean different things in each. A frame is read left to right: characteristic, tolerance and modifiers, then datums in order of precedence.
            </div>
        </div>`;

    const search = document.getElementById('sf-search');
    search.oninput = () => {
        state.search = search.value;
        const first = visible()[0];
        if (first) state.selected = first.name;
        renderScene();
        renderLinks();
        // Keep typing focus: only restyle the family list, don't rebuild the input
        controlsContainer.querySelectorAll('[data-family]').forEach(b => {
            const on = !state.search.trim() && state.family === b.dataset.family;
            b.className = `w-full flex justify-between items-center px-3 py-2 rounded text-sm ${on ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`;
        });
    };
    controlsContainer.querySelectorAll('[data-family]').forEach(b => b.onclick = () => {
        state.family = b.dataset.family;
        state.search = '';
        state.selected = SYMBOLS.find(s => s.family === state.family).name;
        renderScene();
        renderControls();
    });
    renderLinks();
}

// The "go deeper" buttons for the selected symbol
function renderLinks() {
    const box = controlsContainer?.querySelector('#sf-links');
    if (!box) return;
    const sel = SYMBOLS.find(s => s.name === state.selected);
    if (!sel?.links?.length) { box.innerHTML = ''; return; }
    box.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">${sel.name}: go deeper</h4>
            <div class="space-y-2">
                ${sel.links.map((l, i) => `<button data-link="${i}" class="w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-700 font-bold text-sm">${l.label} ▶</button>`).join('')}
            </div>
        </div>`;
    box.querySelectorAll('[data-link]').forEach(b => b.onclick = () => {
        const l = sel.links[+b.dataset.link];
        window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat: l.cat, sym: l.sym } }));
    });
}
