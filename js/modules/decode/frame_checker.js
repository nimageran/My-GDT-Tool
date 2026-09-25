// modules/decode/frame_checker.js
// ============================================================================
// FRAME LEGALITY CHECKER: build a feature control frame and check it against
// the rules of ASME Y14.5-2018. Each finding is ILLEGAL (the frame is not
// valid), CHECK (legal but often a mistake) or NOTE (what it implies).
// Zones: frame (y 0–260), findings (260–640), plain reading (640–800).
// Exports: draw(canvas), loadControls(container)   [shell contract §1]
// ============================================================================

import { el, gdtChar, circledMod, diaSymbol } from './symbols.js';

// --------------------------------------------------------------------------
// VOCABULARY
// --------------------------------------------------------------------------
const CHARS = {
    straightness: { name: 'Straightness', cat: 'form' },
    flatness: { name: 'Flatness', cat: 'form' },
    circularity: { name: 'Circularity', cat: 'form' },
    cylindricity: { name: 'Cylindricity', cat: 'form' },
    profileLine: { name: 'Profile of a line', cat: 'profile' },
    profileSurface: { name: 'Profile of a surface', cat: 'profile' },
    angularity: { name: 'Angularity', cat: 'orientation' },
    perpendicularity: { name: 'Perpendicularity', cat: 'orientation' },
    parallelism: { name: 'Parallelism', cat: 'orientation' },
    position: { name: 'Position', cat: 'location' },
    concentricity: { name: 'Concentricity', cat: 'location' },
    symmetry: { name: 'Symmetry', cat: 'location' },
    circularRunout: { name: 'Circular runout', cat: 'runout' },
    totalRunout: { name: 'Total runout', cat: 'runout' }
};

const TARGETS = {
    plane: 'a flat surface',
    curved: 'a curved surface or outline',
    cyl: 'a hole or pin (cylindrical feature of size)',
    width: 'a slot or tab (width feature of size)'
};
const isFOS = t => t === 'cyl' || t === 'width';
const ROLE = ['primary', 'secondary', 'tertiary'];

// --------------------------------------------------------------------------
// STATE + EXAMPLES
// --------------------------------------------------------------------------
const blankDatums = () => [
    { letter: 'A', mod: 'none', fos: false },
    { letter: 'B', mod: 'none', fos: false },
    { letter: 'C', mod: 'none', fos: false }
];

const EXAMPLES = {
    holes: { label: 'Holes: position at MMC to A|B|C', s: { char: 'position', target: 'cyl', dia: true, value: 0.2, mod: 'M', datums: blankDatums() } },
    flatDatum: { label: 'Mistake: flatness with a datum', s: { char: 'flatness', target: 'plane', dia: false, value: 0.05, mod: 'none', datums: [{ letter: 'A', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }] } },
    mmcPlane: { label: 'Mistake: MMC on a flat surface', s: { char: 'perpendicularity', target: 'plane', dia: false, value: 0.1, mod: 'M', datums: [{ letter: 'A', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }] } },
    noDia: { label: 'Suspicious: position of a pin without Ø', s: { char: 'position', target: 'cyl', dia: false, value: 0.3, mod: 'none', datums: [{ letter: 'A', mod: 'none', fos: false }, { letter: 'B', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }] } },
    runoutMmc: { label: 'Mistake: runout at MMC', s: { char: 'circularRunout', target: 'cyl', dia: false, value: 0.05, mod: 'M', datums: [{ letter: 'A', mod: 'none', fos: true }, { letter: '', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }] } },
    zeroMmc: { label: 'Legal: zero tolerance at MMC', s: { char: 'position', target: 'cyl', dia: true, value: 0, mod: 'M', datums: blankDatums() } },
    mmbPlane: { label: 'Mistake: MMB on a flat datum', s: { char: 'position', target: 'cyl', dia: true, value: 0.2, mod: 'M', datums: [{ letter: 'A', mod: 'none', fos: false }, { letter: 'B', mod: 'M', fos: false }, { letter: '', mod: 'none', fos: false }] } },
    profileU: { label: 'Legal: unequal profile (Ⓤ)', s: { char: 'profileSurface', target: 'curved', dia: false, value: 0.4, mod: 'none', uValue: 0.1, datums: [{ letter: 'A', mod: 'none', fos: false }, { letter: 'B', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }] } },
    legacy: { label: 'Legacy: concentricity', s: { char: 'concentricity', target: 'cyl', dia: true, value: 0.05, mod: 'none', datums: [{ letter: 'A', mod: 'none', fos: true }, { letter: '', mod: 'none', fos: false }, { letter: '', mod: 'none', fos: false }] } }
};

const DEFAULT = { char: 'position', target: 'cyl', dia: true, value: 0.2, mod: 'M', projected: null, free: false, tangent: false, uValue: null, datums: blankDatums() };
const state = structuredClone(DEFAULT);

function loadExample(key) {
    Object.assign(state, structuredClone(DEFAULT), structuredClone(EXAMPLES[key].s));
}

// --------------------------------------------------------------------------
// THE RULES
// --------------------------------------------------------------------------
function check(s) {
    const out = [];
    const bad = (title, text) => out.push({ level: 'error', title, text });
    const warn = (title, text) => out.push({ level: 'warn', title, text });
    const note = (title, text) => out.push({ level: 'info', title, text });
    const c = CHARS[s.char], cat = c.cat, name = c.name;
    const datums = s.datums.filter(d => d.letter.trim());
    const hasDatum = datums.length > 0;
    const fos = isFOS(s.target);

    // Tolerance value
    if (s.value == null || !Number.isFinite(s.value) || s.value < 0) {
        bad('No valid tolerance value', 'The frame needs a tolerance value of zero or more.');
    } else if (s.value === 0) {
        if (s.mod === 'M' || s.mod === 'L') note('Zero tolerance at ' + (s.mod === 'M' ? 'MMC' : 'LMC'), `Legal. The feature must be perfect when it is at ${s.mod === 'M' ? 'MMC' : 'LMC'}; all its tolerance comes from bonus as it departs. Common for holes to give the size tolerance to position.`);
        else bad('Zero tolerance without Ⓜ or Ⓛ', 'A zero tolerance is only valid at MMC or LMC, where bonus provides the tolerance. At RFS it can\'t be made or inspected.');
    }

    // Datum requirements
    if (cat === 'form' && hasDatum) bad('Form tolerance with a datum', `${name} controls the shape of the feature by itself. Form tolerances never reference a datum; remove ${datums.map(d => d.letter).join(', ')}, or use an orientation or profile control if the relationship matters.`);
    if (cat === 'orientation' && !hasDatum) bad('Orientation tolerance without a datum', `${name} is measured relative to something: it needs at least one datum.`);
    if (cat === 'runout' && !hasDatum) bad('Runout without a datum', 'Runout is measured while rotating about a datum axis, so it needs a datum.');
    if ((s.char === 'concentricity' || s.char === 'symmetry') && !hasDatum) bad(`${name} without a datum`, `${name} is measured about a datum axis or center plane; it needs a datum.`);
    if (s.char === 'position' && !hasDatum) warn('Position without datums', 'Only valid when the features are located relative to each other (e.g. the spacing within a pattern, or coaxial features). If the feature must be located on the part, add datums.');
    if (cat === 'profile' && !hasDatum) note('Profile without datums', 'Controls size and shape only (form), not where the surface is or how it is oriented.');

    // Legacy
    if (s.char === 'concentricity' || s.char === 'symmetry') warn(`${name} was removed in Y14.5-2018`, `Still valid on drawings made to Y14.5-2009 or earlier. On new drawings use ${s.char === 'concentricity' ? 'position, runout or profile' : 'position or profile'}; they are easier to inspect.`);

    // Characteristic vs. feature
    if ((s.char === 'circularity' || s.char === 'cylindricity') && (s.target === 'plane' || s.target === 'width')) bad(`${name} on ${TARGETS[s.target]}`, `${name} needs a round feature (a cylinder${s.char === 'circularity' ? ', cone or sphere' : ''}).`);
    if (s.char === 'cylindricity' && s.target === 'curved') warn('Cylindricity on a general curved surface', 'Cylindricity only applies to cylinders. For other curved surfaces use profile of a surface.');
    if (s.char === 'flatness' && (s.target === 'cyl' || s.target === 'curved')) bad(`Flatness on ${TARGETS[s.target]}`, 'Flatness applies to a flat surface, or to the median plane of a slot or tab.');
    if (s.char === 'position' && !fos) bad('Position on a surface that is not a feature of size', 'Position locates the axis or center plane of a feature of size. To locate a surface, use profile of a surface with datums.');
    if (s.char === 'symmetry' && s.target !== 'width') bad(`Symmetry on ${TARGETS[s.target]}`, 'Symmetry controls the center plane of a slot or tab (width feature of size).');
    if (s.char === 'concentricity' && s.target !== 'cyl') bad(`Concentricity on ${TARGETS[s.target]}`, 'Concentricity controls the median points of a round feature.');
    if (cat === 'runout' && s.target === 'width') bad('Runout on a slot or tab', 'Runout applies to surfaces around a datum axis (diameters) or faces perpendicular to it.');

    // Diameter symbol
    const diaOK = s.target === 'cyl' && ['straightness', 'position', 'angularity', 'perpendicularity', 'parallelism', 'concentricity'].includes(s.char);
    if (s.dia && !diaOK) {
        if (['flatness', 'circularity', 'cylindricity', 'profileLine', 'profileSurface', 'circularRunout', 'totalRunout', 'symmetry'].includes(s.char)) bad(`Ø with ${name}`, `${name} never takes Ø: its zone is ${cat === 'runout' ? 'an indicator reading' : cat === 'profile' ? 'a band around the true profile' : s.char === 'symmetry' ? 'two parallel planes' : 'a band between two surfaces'}, not a cylinder.`);
        else bad('Ø on a feature that has no axis', 'Ø makes the zone a cylinder, which only makes sense for the axis of a hole or pin.');
    }
    if (!s.dia && s.target === 'cyl') {
        if (s.char === 'position' || s.char === 'concentricity') warn('No Ø on a hole or pin', 'Without Ø the zone is two parallel planes (one direction only), not a cylinder. For holes and pins Ø is almost always intended.');
        if (cat === 'orientation') note('Axis controlled in one direction', 'Without Ø the axis is held between two parallel planes; with Ø it would be held within a cylinder (all directions).');
        if (s.char === 'straightness') note('Straightness of surface lines', 'Without Ø it controls each line element of the surface. With Ø it would control the axis instead.');
    }
    if (s.dia && s.char === 'straightness' && s.target === 'cyl') note('Straightness of the axis', 'With Ø it controls the derived median line (axis). The feature may then exceed the perfect-form boundary of Rule #1.');

    // Material condition on the tolerance
    if (s.mod !== 'none') {
        const m = s.mod === 'M' ? 'Ⓜ' : 'Ⓛ';
        if (!fos) bad(`${m} on ${TARGETS[s.target]}`, `${m} only applies to features of size (holes, pins, slots, tabs): a surface has no size to depart from.`);
        else if (cat === 'runout' || s.char === 'concentricity' || s.char === 'symmetry') bad(`${m} with ${name}`, `${name} is always regardless of feature size: ${m} is not allowed.`);
        else if (s.char === 'circularity' || s.char === 'cylindricity' || cat === 'profile') bad(`${m} with ${name}`, `${m} is not allowed on ${name.toLowerCase()} tolerance values.`);
        else if (s.char === 'straightness' && !s.dia && s.target === 'cyl') bad(`${m} on straightness of surface lines`, `${m} on straightness needs Ø: it then applies to the axis (derived median line).`);
        else if (s.char === 'flatness') note(`Flatness of the median plane at ${s.mod === 'M' ? 'MMC' : 'LMC'}`, 'Legal on a slot or tab: it controls the derived median plane, and the feature may exceed its perfect-form boundary.');
        else note(`Bonus tolerance (${s.mod === 'M' ? 'MMC' : 'LMC'})`, s.mod === 'M'
            ? 'The zone grows as the feature departs from MMC. This allows a fixed functional gauge at virtual condition.'
            : 'The zone grows as the feature departs from LMC. Used to protect minimum wall thickness; not checkable with a fixed gauge.');
    }

    // Datums
    const letters = s.datums.map(d => d.letter.trim().toUpperCase());
    const firstBlank = letters.indexOf('');
    if (firstBlank !== -1 && letters.slice(firstBlank).some(l => l)) bad('Gap in the datum order', 'Fill datums left to right: primary, then secondary, then tertiary.');
    const seen = new Set();
    datums.forEach(d => {
        const L = d.letter.trim().toUpperCase();
        const i = s.datums.indexOf(d);
        if (!/^[A-Z]{1,2}(-[A-Z]{1,2})?$/.test(L)) bad(`Datum "${d.letter}" is not a datum letter`, 'Use capital letters (A, B, AA...), or a common datum like A-B.');
        if (/[IOQ]/.test(L)) bad(`Datum letter ${L}`, 'The letters I, O and Q are not used for datums: they are easily confused with 1 and 0.');
        if (seen.has(L)) bad(`Datum ${L} used twice`, 'Each datum can appear only once in a frame.');
        seen.add(L);
        if (d.mod !== 'none' && !d.fos) bad(`${d.mod === 'M' ? 'MMB' : 'LMB'} on datum ${L}`, `${d.mod === 'M' ? 'Ⓜ' : 'Ⓛ'} after a datum letter means MMB/LMB, which only applies when the datum feature is a feature of size (a hole, pin, slot or tab). Tick "feature of size" if it is one.`);
        else if (d.mod !== 'none') note(`Datum ${L} at ${d.mod === 'M' ? 'MMB' : 'LMB'} (${ROLE[i]})`, 'The datum feature\'s departure from its boundary allows datum shift: extra movement of the whole pattern. A functional gauge accounts for it; many CMM reports ignore it.');
        if (cat === 'runout' && i === 0 && !d.fos) warn('Runout from a flat datum', 'Runout needs a datum axis, usually from a diameter (or a face plus a diameter). A flat primary datum alone gives no axis to rotate about.');
    });

    // Other modifiers
    if (s.projected != null) {
        if (!(s.char === 'position' || cat === 'orientation') || !fos) bad('Ⓟ on this control', 'A projected tolerance zone is used with position or orientation of a hole or pin (typically tapped holes and press-fit pins).');
        else if (!(s.projected > 0)) bad('Ⓟ without a height', 'The projected zone needs its height (minimum: the thickness of the mating part).');
        else note(`Projected zone ${s.projected}`, `The zone extends ${s.projected} above the surface, where the mating part sits, so a tilted thread can't push the bolt into it.`);
    }
    if (s.uValue != null) {
        if (cat !== 'profile') bad('Ⓤ on this control', 'Ⓤ (unequally disposed) is only used with profile tolerances.');
        else if (s.value != null && s.uValue > s.value) bad('Ⓤ value larger than the tolerance', 'The value after Ⓤ is how much of the zone lies on the material-adding side; it can\'t exceed the total tolerance.');
        else note(`Unequal profile zone`, `${s.uValue} of the ${s.value} zone lies on the side that adds material, the rest on the side that removes it.`);
    }
    if (s.tangent && cat !== 'orientation') warn('Ⓣ on this control', 'The tangent plane modifier is normally used with orientation tolerances of flat surfaces.');
    else if (s.tangent) note('Tangent plane', 'Only the plane touching the high points must be within the zone; the surface between them is not controlled by this frame.');
    if (s.free) note('Free state', 'This requirement applies with the part unrestrained. Other requirements are usually checked restrained, as a note should say.');
    if (s.char === 'angularity' && hasDatum) note('Basic angle', 'The angle to the datum must be a basic (boxed) dimension on the drawing; the tolerance is a width, not degrees.');

    // Rendered text uses (M), (L)... instead of Unicode circled letters (DECODER_SPEC §4)
    const plain = str => str.replace(/Ⓜ/g, '(M)').replace(/Ⓛ/g, '(L)').replace(/Ⓟ/g, '(P)').replace(/Ⓤ/g, '(U)').replace(/Ⓣ/g, '(T)');
    return out.map(f => ({ ...f, title: plain(f.title), text: plain(f.text) }));
}

// --------------------------------------------------------------------------
// RENDERING
// --------------------------------------------------------------------------
let zones = null, controlsRoot = null;

export function draw(canvas) {
    [[260, 'WHAT THE RULES SAY'], [640, 'IN PLAIN ENGLISH']].forEach(([y, lbl]) => {
        canvas.appendChild(el('line', { x1: 0, y1: y, x2: 1000, y2: y, stroke: '#e2e8f0', 'stroke-width': 1 }));
        canvas.appendChild(txt(lbl, 40, y + 20, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    });
    canvas.appendChild(txt('THE FRAME', 40, 24, { size: 10, fill: '#94a3b8', spacing: 2, bold: true }));
    zones = { frame: el('g'), findings: el('g'), sentence: el('g') };
    Object.values(zones).forEach(z => canvas.appendChild(z));
    update();
}

function update() {
    if (!zones) return;
    Object.values(zones).forEach(z => { while (z.firstChild) z.removeChild(z.firstChild); });
    const findings = check(state);
    renderFrame(zones.frame, state, findings);
    renderFindings(zones.findings, findings);
    renderSentence(zones.sentence, state, findings);
}

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

function wrapText(g, str, x, y, maxW, size, fill, lineH, bold = false) {
    const perLine = Math.floor(maxW / (size * 0.52));
    let line = '', ly = y;
    for (const w of str.split(' ')) {
        if ((line + ' ' + w).trim().length > perLine) {
            g.appendChild(txt(line.trim(), x, ly, { size, fill, bold }));
            line = w; ly += lineH;
        } else line = (line + ' ' + w).trim();
    }
    if (line) g.appendChild(txt(line, x, ly, { size, fill, bold }));
    return ly;
}

const INK = '#0f172a';
const S = { stroke: INK, 'stroke-width': 2, fill: 'none' };
const fmtV = v => (v == null || !Number.isFinite(v) ? '?' : String(+v.toFixed(4)));

// Draw the frame centered at (cx, y) with cell height h
function renderFrame(g, s, findings) {
    const h = 52, y = 90, R = 11;
    const valStr = fmtV(s.value);
    const tolItems = [];
    if (s.dia) tolItems.push({ t: 'dia', w: 26 });
    tolItems.push({ t: 'text', s: valStr, w: valStr.length * 14 + 4 });
    if (s.mod !== 'none') tolItems.push({ t: 'mod', s: s.mod, w: 2 * R + 6 });
    if (s.free) tolItems.push({ t: 'mod', s: 'F', w: 2 * R + 6 });
    if (s.tangent) tolItems.push({ t: 'mod', s: 'T', w: 2 * R + 6 });
    if (s.projected != null) { tolItems.push({ t: 'mod', s: 'P', w: 2 * R + 6 }); tolItems.push({ t: 'text', s: fmtV(s.projected), w: fmtV(s.projected).length * 14 + 6 }); }
    if (s.uValue != null) { tolItems.push({ t: 'mod', s: 'U', w: 2 * R + 6 }); tolItems.push({ t: 'text', s: fmtV(s.uValue), w: fmtV(s.uValue).length * 14 + 6 }); }
    const tolW = tolItems.reduce((a, it) => a + it.w, 0) + 24;

    const datums = s.datums.filter(d => d.letter.trim());
    const dCells = datums.map(d => ({ d, w: Math.max(h, d.letter.trim().length * 16 + (d.mod !== 'none' ? 2 * R + 14 : 0) + 22) }));
    const totalW = h + tolW + dCells.reduce((a, c) => a + c.w, 0);
    let x = 500 - totalW / 2;
    const cy = y + h / 2;

    g.appendChild(el('rect', { x, y, width: totalW, height: h, fill: '#fff', stroke: INK, 'stroke-width': 2.5 }));
    // Characteristic
    g.appendChild(gdtChar(s.char, x + h / 2, cy, h * 0.62));
    x += h;
    g.appendChild(el('line', { x1: x, y1: y, x2: x, y2: y + h, ...S, 'stroke-width': 2.5 }));
    // Tolerance cell
    let tx = x + 12;
    for (const it of tolItems) {
        if (it.t === 'dia') g.appendChild(diaSymbol(tx - 2, cy + 9, 24));
        if (it.t === 'text') g.appendChild(txt(it.s, tx, cy, { size: 24, mono: true, bold: true, baseline: 'central' }));
        if (it.t === 'mod') g.appendChild(circledMod(tx + R + 2, cy, R, it.s));
        tx += it.w;
    }
    x += tolW;
    // Datum cells
    for (const { d, w } of dCells) {
        g.appendChild(el('line', { x1: x, y1: y, x2: x, y2: y + h, ...S, 'stroke-width': 2.5 }));
        const L = d.letter.trim().toUpperCase();
        const lw = L.length * 16;
        const contentW = lw + (d.mod !== 'none' ? 2 * R + 6 : 0);
        const lx = x + (w - contentW) / 2;
        g.appendChild(txt(L, lx, cy, { size: 24, bold: true, baseline: 'central' }));
        if (d.mod !== 'none') g.appendChild(circledMod(lx + lw + 4 + R, cy, R, d.mod));
        x += w;
    }

    g.appendChild(txt(`${CHARS[s.char].name}, applied to ${TARGETS[s.target]}`, 500, y + h + 34, { size: 14, fill: '#475569', anchor: 'middle' }));
    if (datums.length) {
        g.appendChild(txt(datums.map((d, i) => `${d.letter.trim().toUpperCase()} = ${ROLE[i]}${d.fos ? ' (feature of size)' : ''}`).join('   ·   '), 500, y + h + 56, { size: 12.5, fill: '#94a3b8', anchor: 'middle' }));
    }

    // Verdict pill
    const errors = findings.filter(f => f.level === 'error').length;
    const warns = findings.filter(f => f.level === 'warn').length;
    const [label, fill, stroke, color] = errors ? ['NOT VALID', '#fee2e2', '#dc2626', '#b91c1c']
        : warns ? ['VALID · CHECK NOTES', '#fef3c7', '#d97706', '#92400e'] : ['VALID', '#dcfce7', '#16a34a', '#15803d'];
    const pw = label.length * 10 + 40;
    g.appendChild(el('rect', { x: 960 - pw, y: 30, width: pw, height: 36, rx: 18, fill, stroke, 'stroke-width': 2 }));
    g.appendChild(txt(label, 960 - pw / 2, 48, { size: 15, bold: true, fill: color, anchor: 'middle', baseline: 'central' }));
}

function renderFindings(g, findings) {
    const order = { error: 0, warn: 1, info: 2 };
    const list = [...findings].sort((a, b) => order[a.level] - order[b.level]);
    const style = {
        error: { bar: '#dc2626', bg: '#fef2f2', tag: 'ILLEGAL', tagFill: '#b91c1c' },
        warn: { bar: '#d97706', bg: '#fffbeb', tag: 'CHECK', tagFill: '#92400e' },
        info: { bar: '#2563eb', bg: '#eff6ff', tag: 'NOTE', tagFill: '#1d4ed8' }
    };
    if (list.length === 0) {
        g.appendChild(txt('No rule is broken, and there is nothing unusual to point out.', 40, 320, { size: 15, fill: '#15803d', bold: true }));
        return;
    }
    let y = 296;
    const colW = 440;
    let col = 0;
    for (const f of list) {
        const st = style[f.level];
        const lines = Math.ceil(f.text.length / 66);
        const hgt = 44 + lines * 17;
        if (y + hgt > 628) {
            if (col === 0) { col = 1; y = 296; } else {
                g.appendChild(txt(`+ ${list.length - list.indexOf(f)} more`, 520, 630, { size: 12, fill: '#64748b' }));
                break;
            }
        }
        const cx = 40 + col * (colW + 40);
        g.appendChild(el('rect', { x: cx, y, width: colW, height: hgt, rx: 8, fill: st.bg }));
        g.appendChild(el('rect', { x: cx, y, width: 5, height: hgt, rx: 2, fill: st.bar }));
        g.appendChild(txt(st.tag, cx + 18, y + 22, { size: 10.5, bold: true, fill: st.tagFill, spacing: 1 }));
        g.appendChild(txt(f.title, cx + 18 + st.tag.length * 8 + 12, y + 22, { size: 14, bold: true, fill: '#0f172a' }));
        wrapText(g, f.text, cx + 18, y + 42, colW - 30, 12.5, '#334155', 17);
        y += hgt + 10;
    }
}

function renderSentence(g, s, findings) {
    const c = CHARS[s.char];
    const datums = s.datums.filter(d => d.letter.trim());
    const v = fmtV(s.value);
    let zone;
    if (c.cat === 'runout') zone = `a full indicator movement of no more than ${v} while the part rotates about the datum axis`;
    else if (s.char === 'circularity' || s.char === 'cylindricity') zone = `a radial band ${v} wide`;
    else if (c.cat === 'profile') zone = s.uValue != null ? `a band ${v} wide around the true profile (${fmtV(s.uValue)} of it on the material-adding side)` : `a band ${v} wide centered on the true profile`;
    else zone = s.dia ? `a cylindrical zone Ø${v}` : `a zone ${v} wide (between two parallel ${s.target === 'cyl' || c.cat === 'form' && s.char === 'straightness' ? 'lines or planes' : 'planes'})`;
    const what = s.target === 'cyl' ? (s.dia || ['position', 'concentricity'].includes(s.char) ? 'the axis of the hole or pin' : 'the surface of the hole or pin')
        : s.target === 'width' ? (['position', 'symmetry'].includes(s.char) || s.mod !== 'none' ? 'the center plane of the slot or tab' : 'the surfaces of the slot or tab')
            : 'the surface';
    const cond = s.mod === 'M' ? ' at MMC (growing by the bonus as the feature departs from MMC)' : s.mod === 'L' ? ' at LMC (growing as the feature departs from LMC)' : isFOS(s.target) && c.cat !== 'form' ? ', regardless of its size' : '';
    const ref = datums.length ? `, relative to ${datums.map((d, i) => `datum ${d.letter.trim().toUpperCase()}${d.mod !== 'none' ? ` at ${d.mod === 'M' ? 'MMB' : 'LMB'}` : ''} (${ROLE[i]})`).join(', ')}` : '';
    let sentence = `${c.name}: ${what} must lie within ${zone}${cond}${ref}.`;
    if (c.cat === 'runout') sentence = `${c.name}: ${what} must show ${zone}${ref}.`;

    const errors = findings.filter(f => f.level === 'error');
    if (errors.length) sentence = `As written this frame is not valid (${errors.length} rule${errors.length > 1 ? 's' : ''} broken, see above). Read literally: ` + sentence.charAt(0).toLowerCase() + sentence.slice(1);
    wrapText(g, sentence, 40, 684, 920, 16, '#0f172a', 22);
}

// --------------------------------------------------------------------------
// CONTROLS
// --------------------------------------------------------------------------
const INPUT = 'w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white';
const section = (title, body) => `<div><p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">${title}</p>${body}</div>`;

export function loadControls(container) {
    controlsRoot = container;
    render();
}

function render() {
    const c = controlsRoot;
    if (!c) return;
    const opt = (v, t, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`;
    const datumRow = (d, i) => `
        <div class="grid grid-cols-12 gap-1.5 items-center">
          <span class="col-span-3 text-xs text-slate-500">${ROLE[i]}</span>
          <input data-d="${i}" data-f="letter" type="text" maxlength="5" value="${d.letter}" class="${INPUT} col-span-2 uppercase text-center font-bold">
          <select data-d="${i}" data-f="mod" class="${INPUT} col-span-3">${opt('none', 'RMB', d.mod)}${opt('M', 'MMB Ⓜ', d.mod)}${opt('L', 'LMB Ⓛ', d.mod)}</select>
          <label class="col-span-4 text-[11px] text-slate-500 flex items-center gap-1"><input data-d="${i}" data-f="fos" type="checkbox" ${d.fos ? 'checked' : ''}> feature of size</label>
        </div>`;

    c.innerHTML = `
    <div class="space-y-5">
      ${section('Try an example', `
        <select id="fc-example" class="${INPUT}"><option value="">Choose an example…</option>
          ${Object.entries(EXAMPLES).map(([k, e]) => `<option value="${k}">${e.label}</option>`).join('')}</select>`)}
      ${section('Characteristic and feature', `
        <select id="fc-char" class="${INPUT}">${Object.entries(CHARS).map(([k, v]) => opt(k, v.name, state.char)).join('')}</select>
        <label class="block text-xs text-slate-500 mt-2 mb-1">Applied to</label>
        <select id="fc-target" class="${INPUT}">${Object.entries(TARGETS).map(([k, v]) => opt(k, v.charAt(0).toUpperCase() + v.slice(1), state.target)).join('')}</select>`)}
      ${section('Tolerance', `
        <div class="grid grid-cols-3 gap-2 items-end">
          <label class="text-sm flex items-center gap-2 pb-2"><input id="fc-dia" type="checkbox" ${state.dia ? 'checked' : ''}> Ø</label>
          <div><label class="block text-xs text-slate-500 mb-1">Value</label><input id="fc-value" type="number" step="any" value="${state.value ?? ''}" class="${INPUT}"></div>
          <div><label class="block text-xs text-slate-500 mb-1">Material</label><select id="fc-mod" class="${INPUT}">${opt('none', 'RFS', state.mod)}${opt('M', 'MMC Ⓜ', state.mod)}${opt('L', 'LMC Ⓛ', state.mod)}</select></div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div><label class="block text-xs text-slate-500 mb-1">Ⓟ projected height</label><input id="fc-projected" type="number" step="any" value="${state.projected ?? ''}" placeholder="none" class="${INPUT}"></div>
          <div><label class="block text-xs text-slate-500 mb-1">Ⓤ value</label><input id="fc-u" type="number" step="any" value="${state.uValue ?? ''}" placeholder="none" class="${INPUT}"></div>
        </div>
        <div class="flex gap-4 mt-2 text-sm">
          <label class="flex items-center gap-2"><input id="fc-free" type="checkbox" ${state.free ? 'checked' : ''}> Ⓕ free state</label>
          <label class="flex items-center gap-2"><input id="fc-tangent" type="checkbox" ${state.tangent ? 'checked' : ''}> Ⓣ tangent plane</label>
        </div>`)}
      ${section('Datums (blank = none)', `<div class="space-y-2">${state.datums.map(datumRow).join('')}</div>
        <p class="text-[11px] text-slate-400 mt-2">Tick "feature of size" when the datum feature is a hole, pin, slot or tab.</p>`)}
      ${section('Local Notes (MTM)', `
        <textarea id="fc-notes" rows="3" placeholder="Shop-specific interpretations…" class="${INPUT}"></textarea>
        <p class="text-[10px] text-slate-400 mt-1">Saved on this machine automatically.</p>`)}
    </div>`;

    const $ = id => c.querySelector('#' + id);
    const numOrNull = e => { const v = parseFloat(e.value); return e.value === '' || !Number.isFinite(v) ? null : v; };
    $('fc-example').onchange = e => { if (e.target.value) { loadExample(e.target.value); render(); update(); } };
    $('fc-char').onchange = e => { state.char = e.target.value; update(); };
    $('fc-target').onchange = e => { state.target = e.target.value; update(); };
    $('fc-dia').onchange = e => { state.dia = e.target.checked; update(); };
    $('fc-value').oninput = e => { state.value = numOrNull(e.target); update(); };
    $('fc-mod').onchange = e => { state.mod = e.target.value; update(); };
    $('fc-projected').oninput = e => { state.projected = numOrNull(e.target); update(); };
    $('fc-u').oninput = e => { state.uValue = numOrNull(e.target); update(); };
    $('fc-free').onchange = e => { state.free = e.target.checked; update(); };
    $('fc-tangent').onchange = e => { state.tangent = e.target.checked; update(); };
    c.querySelectorAll('[data-d]').forEach(inp => {
        const d = state.datums[+inp.dataset.d], f = inp.dataset.f;
        const ev = inp.type === 'text' ? 'oninput' : 'onchange';
        inp[ev] = () => { d[f] = inp.type === 'checkbox' ? inp.checked : inp.value; update(); };
    });

    const notes = $('fc-notes');
    try {
        notes.value = localStorage.getItem('decoder_notes_frame_checker') || '';
        notes.oninput = () => { try { localStorage.setItem('decoder_notes_frame_checker', notes.value); } catch (e) { /* ignore */ } };
    } catch (e) { /* storage unavailable */ }
    update();
}
