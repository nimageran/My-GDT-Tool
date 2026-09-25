// js/modules/stackups/iso286.js
// ISO 286-1 limits and fits for sizes up to 500 mm: standard tolerance
// grades IT4 to IT11 and the fundamental deviations for the common hole and
// shaft letters. All deviations in µm. Pure data and maths, no DOM.
//
// A size range is "over lo, up to and including hi" (the first starts at 0).

// Main size ranges for tolerance grades (upper limits, mm)
const MAIN = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];

// Standard tolerance grades IT (µm), one value per main range
export const IT = {
    3: [2, 2.5, 2.5, 3, 4, 4, 5, 6, 8, 10, 12, 13, 15],
    4: [3, 4, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20],
    5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27],
    6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
    7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63],
    8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
    9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155],
    10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185, 210, 230, 250],
    11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400]
};
export const GRADES = [5, 6, 7, 8, 9, 10, 11];

// Some letters change inside a main range, so they use finer ranges
const FINE = [3, 6, 10, 18, 24, 30, 40, 50, 65, 80, 100, 120, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500];

// Shaft fundamental deviations (µm).
// a-h: upper deviation es (≤ 0). k-u: lower deviation ei (≥ 0).
const SHAFT = {
    c: { side: 'es', fine: [-60, -70, -80, -95, -110, -110, -120, -130, -140, -150, -170, -180, -200, -210, -230, -240, -260, -280, -300, -330, -360, -400, -440, -480] },
    d: { side: 'es', main: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230] },
    e: { side: 'es', main: [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135] },
    f: { side: 'es', main: [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68] },
    g: { side: 'es', main: [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20] },
    h: { side: 'es', main: Array(13).fill(0) },
    // k: this value for grades 4 to 7 only; 0 for other grades
    k: { side: 'ei', main: [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5] },
    m: { side: 'ei', main: [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23] },
    n: { side: 'ei', main: [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40] },
    p: { side: 'ei', main: [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68] },
    r: { side: 'ei', fine: [10, 15, 19, 23, 28, 28, 34, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80, 84, 94, 98, 108, 114, 126, 132] },
    s: { side: 'ei', fine: [14, 19, 23, 28, 35, 35, 43, 43, 53, 59, 71, 79, 92, 100, 108, 122, 130, 140, 158, 170, 190, 208, 232, 252] },
    u: { side: 'ei', fine: [18, 23, 28, 33, 41, 48, 60, 70, 87, 102, 124, 144, 170, 190, 210, 236, 258, 284, 315, 350, 390, 435, 490, 540] }
};
export const SHAFT_LETTERS = ['c', 'd', 'e', 'f', 'g', 'h', 'js', 'k', 'm', 'n', 'p', 'r', 's', 'u'];
export const HOLE_LETTERS = SHAFT_LETTERS.map(l => l.toUpperCase());

const rangeIndex = (limits, size) => limits.findIndex(hi => size <= hi);

/** Index of the main size range, or -1 when outside 0 < size ≤ 500 mm. */
export function mainRange(size) {
    return size > 0 ? rangeIndex(MAIN, size) : -1;
}

/** Standard tolerance IT (µm) for a grade and size. */
export function itValue(grade, size) {
    return IT[grade][mainRange(size)];
}

function shaftFundamental(letter, size, grade) {
    const d = SHAFT[letter];
    let v = d.main ? d.main[mainRange(size)] : d.fine[rangeIndex(FINE, size)];
    if (letter === 'k' && (grade < 4 || grade > 7)) v = 0;
    return { side: d.side, v };
}

/** js / JS: symmetric ±IT/2; for grades 7 to 11 an odd IT is rounded down to even first. */
function halfIT(grade, size) {
    let it = itValue(grade, size);
    if (grade >= 7 && it % 2 === 1) it -= 1;
    return it / 2;
}

/** Shaft limits: { upper, lower } deviations in µm. */
export function shaftDeviations(letter, grade, size) {
    const it = itValue(grade, size);
    if (letter === 'js') return { upper: halfIT(grade, size), lower: -halfIT(grade, size) };
    const f = shaftFundamental(letter, size, grade);
    return f.side === 'es' ? { upper: f.v, lower: f.v - it } : { upper: f.v + it, lower: f.v };
}

/** Hole limits: { upper, lower } deviations in µm. */
export function holeDeviations(letter, grade, size) {
    const it = itValue(grade, size);
    const l = letter.toLowerCase();
    if (l === 'js') return { upper: halfIT(grade, size), lower: -halfIT(grade, size) };
    const f = shaftFundamental(l, size, grade);
    if (f.side === 'es') {
        // C to H: lower deviation EI is the mirror of the shaft's es
        const EI = -f.v;
        return { upper: EI + it, lower: EI };
    }
    // K to U: upper deviation ES is the mirror of the shaft's ei, plus a small
    // correction Δ for the finer grades (K, M, N up to IT8; P and beyond up to
    // IT7), so that e.g. H7/p6 and P7/h6 give the same fit. No Δ at 3 mm or less.
    const i = mainRange(size);
    const delta = i === 0 ? 0 : IT[grade][i] - IT[grade - 1][i];
    let ES;
    if (l === 'k') ES = grade <= 8 ? -f.v + delta : 0;
    else if (l === 'm') ES = grade <= 8 ? -f.v + delta : -f.v;
    else if (l === 'n') ES = grade <= 8 ? -f.v + delta : (i === 0 ? -4 : 0);
    else ES = grade <= 7 ? -f.v + delta : -f.v;
    return { upper: ES, lower: ES - it };
}

/** Full fit: limits in mm and the clearance range (negative = interference). */
export function computeFit(size, hole, shaft) {
    const H = holeDeviations(hole.letter, hole.grade, size);
    const S = shaftDeviations(shaft.letter, shaft.grade, size);
    const maxClear = H.upper - S.lower;            // biggest hole, smallest shaft
    const minClear = H.lower - S.upper;            // smallest hole, biggest shaft
    const type = minClear >= 0 ? 'clearance' : maxClear <= 0 ? 'interference' : 'transition';
    return { hole: H, shaft: S, maxClear, minClear, type };
}

// Preferred fits (ISO 286-2 / ANSI B4.2), hole basis
export const PREFERRED = [
    { hole: 'H11', shaft: 'c11', name: 'Loose running', use: 'Wide clearance for rough or dirty conditions, or parts that expand. Agricultural hinges, pivots on outdoor equipment.' },
    { hole: 'H9', shaft: 'd9', name: 'Free running', use: 'Not for accuracy: large speed or temperature changes, heavy journal pressure. Large bearings, idler pulleys.' },
    { hole: 'H8', shaft: 'f7', name: 'Close running', use: 'Accurate running at moderate speed. Spindles in plain bearings, gearbox shafts, pumps.' },
    { hole: 'H7', shaft: 'g6', name: 'Sliding', use: 'Parts that move and turn freely but locate accurately. Slide valves, pistons, sliding gears.' },
    { hole: 'H7', shaft: 'h6', name: 'Locational clearance', use: 'Snug fit for locating parts that are assembled and taken apart by hand. Spigots, locating bores.' },
    { hole: 'H7', shaft: 'k6', name: 'Locational transition', use: 'Accurate location, a compromise between clearance and interference. Gears and pulleys on shafts with a key.' },
    { hole: 'H7', shaft: 'n6', name: 'Locational transition (tight)', use: 'More accurate location where more interference is allowed. Bushings, couplings.' },
    { hole: 'H7', shaft: 'p6', name: 'Locational interference', use: 'Rigid, accurate location without special bore pressure. Dowel pins, bushings pressed in.' },
    { hole: 'H7', shaft: 's6', name: 'Medium drive', use: 'Ordinary steel parts pressed together, or shrink fits on light sections. Bearings in housings, gears on shafts.' },
    { hole: 'H7', shaft: 'u6', name: 'Force', use: 'Parts that stay permanently joined under high load, or shrink fits. Heavy-duty couplings, wheels on axles.' }
];

/** Split a class like "H7" or "js6" into { letter, grade }. */
export function parseClass(s) {
    const m = /^([a-zA-Z]{1,2})(\d{1,2})$/.exec(s.trim());
    return m ? { letter: m[1], grade: +m[2] } : null;
}
