// js/modules/learn/lessons.js
// The learning path: six short lessons, each with the tools to study and a
// five-question quiz built from real drawing callouts. Pure data.
//
// Question fields:
//   id        stable key (progress is saved by it; never reuse an id)
//   q         the question, plain words
//   fig       optional figure: { fcf: {featureControlFrame options} },
//             { code: 'Ø20 H7/g6' } or { projection: 'third' | 'first' }
//   options   answers; answer = index of the right one
//   why       the explanation shown after answering
//   tool      [cat, sym, label] of the tool that teaches it

export const LESSONS = [
    {
        id: 'sheet', title: 'Read the sheet',
        goal: 'Find the facts every drawing gives before any GD&T: revision, units, default tolerances, view layout and notes.',
        study: [['DECODE', 'read_checklist', 'How to Read a Drawing'], ['DECODE', 'title_block', 'Title Block'], ['DECODE', 'general_tolerances', 'General Tolerances']],
        questions: [
            { id: 's1', q: 'Your work order says part 10-4217 REV B. The drawing you were handed is REV C. What do you do?',
              options: ['Make it to REV C, because it is the newest', 'Make it to REV B, because the work order says so', 'Stop and ask which revision is right', 'Make it to REV C and write a note'],
              answer: 2, why: 'The drawing and the order must match. If they differ, making parts to either one can scrap the batch. Stop and ask first.',
              tool: ['DECODE', 'title_block', 'Title Block'] },
            { id: 's2', q: 'The title block says "X.X ±0.2   X.XX ±0.1". A length is written 40.0 with no tolerance of its own. What is a good part?',
              options: ['39.9 to 40.1', '39.8 to 40.2', '39.5 to 40.5', 'Exactly 40.0'],
              answer: 1, why: '40.0 has one decimal place, so it takes the X.X line: ±0.2, which gives 39.8 to 40.2.',
              tool: ['DECODE', 'general_tolerances', 'General Tolerances'] },
            { id: 's3', q: 'The title block shows this projection symbol. How are the views laid out?', fig: { projection: 'third' },
              options: ['Third angle: top view above the front view', 'First angle: top view below the front view'],
              answer: 0, why: 'Circles on the left, cone on the right means third angle. Each view sits on the side you look from, so the top view is above the front view.',
              tool: ['DECODE', 'projection', 'First vs Third Angle'] },
            { id: 's4', q: 'A dimension 25 is drawn inside a box. How much may the part be off from 25?',
              options: ['The title block default', 'Nothing: 25 must be exact', 'It has no ± of its own: the allowed error comes from a GD&T frame', '±0.5, always'],
              answer: 2, why: 'A boxed (basic) dimension is the perfect value. The tolerance comes from the feature control frame of the feature it locates, never from the title block.',
              tool: ['DECODE', 'read_checklist', 'How to Read a Drawing'] },
            { id: 's5', q: 'Note 3 says "DIMENSIONS APPLY AFTER ANODIZE". A hole is Ø10.00 +0.02/0. What should the machinist aim for before anodizing?',
              options: ['Exactly Ø10.00', 'A little bigger, so the hole is Ø10.00 to 10.02 after the coating', 'A little smaller, because anodize removes material'],
              answer: 1, why: 'Anodize grows on the surface, so it makes a hole smaller. The size is checked after coating, so the hole is machined a little oversize.',
              tool: ['DECODE', 'drawing_notes', 'Notes & Abbreviations'] }
        ]
    },
    {
        id: 'frames', title: 'Symbols and frames',
        goal: 'Read a feature control frame from left to right, and know what the common symbols and modifiers mean.',
        study: [['DECODE', 'symbol_finder', 'Symbol Finder'], ['DECODE', 'composite_frames', 'Feature Control Frames']],
        questions: [
            { id: 'f1', q: 'In this frame, what does the Ø in front of 0.2 mean?', fig: { fcf: { symbol: 'position', tolerance: '0.2', diameter: true, modifier: 'M', datums: ['A', 'B', 'C'] } },
              options: ['The hole is 0.2 in diameter', 'The tolerance zone is a cylinder 0.2 across', 'The part may move ±0.2 in X and Y'],
              answer: 1, why: 'Ø before the tolerance makes the zone round: a cylinder 0.2 in diameter around the true position. The axis must stay inside it.',
              tool: ['CHARACTERISTICS', 'position', 'Position'] },
            { id: 'f2', q: 'With this frame, which datum does the part touch first when it is set up?', fig: { fcf: { symbol: 'position', tolerance: '0.2', diameter: true, datums: ['A', 'B', 'C'] } },
              options: ['A', 'B', 'C', 'It does not matter'],
              answer: 0, why: 'Datums are read left to right: A is primary (the part sits on it first), then B, then C.',
              tool: ['DATUMS', 'drf', 'Datum Reference Frame'] },
            { id: 'f3', q: 'A flatness frame has no datum letters. Why?', fig: { fcf: { symbol: 'flatness', tolerance: '0.05' } },
              options: ['The designer forgot them', 'Datum A is implied', 'Flatness is a form control: it only checks shape, so it never uses a datum'],
              answer: 2, why: 'Form controls (straightness, flatness, circularity, cylindricity) only compare a feature with its own perfect shape. A datum would make no sense.',
              tool: ['CHARACTERISTICS', 'flatness', 'Flatness'] },
            { id: 'f4', q: 'A profile frame has a small circle where its leader line bends. What does the circle mean?',
              options: ['The feature is round', 'All around: the requirement goes all the way around the outline in that view', 'Measure at one point only'],
              answer: 1, why: 'A circle at the bend of the leader is the all-around symbol. Two circles would mean all over.',
              tool: ['DECODE', 'symbol_finder', 'Symbol Finder'] },
            { id: 'f5', q: 'This frame is on a flat face. What is the tolerance zone?', fig: { fcf: { symbol: 'perpendicularity', tolerance: '0.1', datums: ['A'] } },
              options: ['Two parallel planes 0.1 apart, at exactly 90° to datum A', 'A cylinder 0.1 across', 'An angle of ±0.1°'],
              answer: 0, why: 'On a surface, perpendicularity gives two parallel planes the tolerance apart, standing at 90° to the datum. The whole face must fit between them.',
              tool: ['CHARACTERISTICS', 'perpendicularity', 'Perpendicularity'] }
        ]
    },
    {
        id: 'size', title: 'Size, bonus and Rule #1',
        goal: 'Work out bonus tolerance, see why perfect form is needed at MMC, and find the worst-case boundary.',
        study: [['MATERIAL', 'bonus', 'Bonus Tolerance'], ['MATERIAL', 'rule1', 'Rule #1 Envelope'], ['MATERIAL', 'virtual_condition', 'Virtual & Resultant Condition']],
        questions: [
            { id: 'z1', q: 'A hole is Ø10 +0.1/0 with this frame. The hole measures Ø10.06. How much position tolerance is allowed?', fig: { fcf: { symbol: 'position', tolerance: '0.2', diameter: true, modifier: 'M', datums: ['A', 'B', 'C'] } },
              options: ['Ø0.20', 'Ø0.26', 'Ø0.14', 'Ø0.30'],
              answer: 1, why: 'MMC of the hole is Ø10.00. At Ø10.06 it is 0.06 away from MMC, so it earns 0.06 bonus: 0.20 + 0.06 = Ø0.26.',
              tool: ['MATERIAL', 'bonus', 'Bonus Tolerance'] },
            { id: 'z2', q: 'Same hole and frame. It measures Ø10.03 and its position is Ø0.25. Pass or fail?', fig: { fcf: { symbol: 'position', tolerance: '0.2', diameter: true, modifier: 'M', datums: ['A', 'B', 'C'] } },
              options: ['Pass', 'Fail'],
              answer: 1, why: 'At Ø10.03 the bonus is only 0.03, so the allowed position is 0.20 + 0.03 = Ø0.23. The measured Ø0.25 is too much.',
              tool: ['MATERIAL', 'bonus', 'Bonus Tolerance'] },
            { id: 'z3', q: 'An ASME drawing: pin Ø10 ±0.1. The pin is made at Ø10.10 everywhere, but it is bent by 0.03. Pass or fail?',
              options: ['Pass: every caliper reading is in tolerance', 'Fail: at MMC it must be perfectly straight (Rule #1)'],
              answer: 1, why: 'MMC of the pin is Ø10.10. Rule #1 needs perfect form at MMC, so 10.10 + 0.03 = 10.13 will not go into a Ø10.10 ring gauge.',
              tool: ['MATERIAL', 'rule1', 'Rule #1 Envelope'] },
            { id: 'z4', q: 'A hole Ø10 +0.1/0 has position Ø0.2 Ⓜ. What is its virtual condition (the smallest space it ever leaves)?',
              options: ['Ø10.0', 'Ø9.8', 'Ø10.3', 'Ø9.9'],
              answer: 1, why: 'For a hole at MMC: MMC − position tolerance = 10.0 − 0.2 = Ø9.8. A Ø9.8 gauge pin must always fit.',
              tool: ['MATERIAL', 'virtual_condition', 'Virtual & Resultant Condition'] },
            { id: 'z5', q: 'The frame has no Ⓜ (it is RFS). The hole is Ø10 +0.1/0 and measures Ø10.08. How much bonus does it get?', fig: { fcf: { symbol: 'position', tolerance: '0.2', diameter: true, datums: ['A', 'B', 'C'] } },
              options: ['0.08', '0.04', 'None'],
              answer: 2, why: 'Without Ⓜ or Ⓛ the tolerance applies regardless of feature size: no bonus, whatever the size.',
              tool: ['MATERIAL', 'bonus', 'Bonus Tolerance'] }
        ]
    },
    {
        id: 'datums', title: 'Datums',
        goal: 'Know how datums hold the part, why their order matters, and what datum shift gives.',
        study: [['DATUMS', 'drf', 'Datum Reference Frame'], ['DATUMS', 'precedence', 'Datum Precedence'], ['MATERIAL', 'datum_shift', 'Datum Shift']],
        questions: [
            { id: 'd1', q: 'A flat part sits on its primary datum plane A. At least how many points must touch it?',
              options: ['1', '2', '3', '4'],
              answer: 2, why: 'The 3-2-1 rule: 3 points on the primary, 2 on the secondary, 1 on the tertiary. Three points define a plane.',
              tool: ['DATUMS', 'drf', 'Datum Reference Frame'] },
            { id: 'd2', q: 'One drawing says datums A | B | C, another B | A | C for the same part. Can the results differ?',
              options: ['No, the letters are the same', 'Yes: the order sets which face the part is pushed against first'],
              answer: 1, why: 'The primary datum gets the most contact and controls orientation first. Swapping the order changes how the part sits, so measurements change.',
              tool: ['DATUMS', 'precedence', 'Datum Precedence'] },
            { id: 'd3', q: 'The frame ends in B Ⓜ. Datum hole B is Ø10 +0.1/0 and measures Ø10.06. The gauge pin for B is Ø10.00. How far can the part slide on it in any direction?',
              options: ['0.06', '0.03', '0.10', 'No movement'],
              answer: 1, why: 'The play is 10.06 − 10.00 = 0.06 across, so the part can move half of that, 0.03, in any direction.',
              tool: ['MATERIAL', 'datum_shift', 'Datum Shift'] },
            { id: 'd4', q: 'Four holes are each 0.12 off to the right (position Ø0.24, allowed Ø0.2). Datum shift of 0.05 is available. Does it save the part?',
              options: ['Yes: the pattern slides right 0.05, so each hole is 0.07 off (Ø0.14)', 'No: datum shift is never extra tolerance'],
              answer: 0, why: 'The whole pattern moves together with the gauge. Here all holes are off the same way, so sliding the part helps every hole at once.',
              tool: ['MATERIAL', 'datum_shift', 'Datum Shift'] },
            { id: 'd5', q: 'A functional gauge accepts a part (datum B at MMB). The CMM report, aligned to B\'s own axis, rejects it. Which follows the drawing?',
              options: ['The CMM report', 'The functional gauge, because the drawing allows datum shift'],
              answer: 1, why: 'B Ⓜ allows the part to shift on a fixed-size pin, which is exactly what the gauge does. A CMM that aligns to B\'s own axis ignores that shift.',
              tool: ['MATERIAL', 'datum_shift', 'Datum Shift'] }
        ]
    },
    {
        id: 'fits', title: 'Fits and stack-ups',
        goal: 'Turn a fit code into limits, and add up tolerances around an assembly.',
        study: [['STACKUPS', 'fits', 'ISO Fits'], ['STACKUPS', 'stackup', 'Tolerance Stack-up'], ['STACKUPS', 'fasteners', 'Fastener Formulas']],
        questions: [
            { id: 'p1', q: 'In the callout below, which part does H7 apply to?', fig: { code: 'Ø20 H7/g6' },
              options: ['The hole', 'The shaft', 'Both'],
              answer: 0, why: 'Capital letters are holes, small letters are shafts. H7 is the hole, g6 the shaft.',
              tool: ['STACKUPS', 'fits', 'ISO Fits'] },
            { id: 'p2', q: 'Ø20 H7/g6: the hole is 20.000 to 20.021 and the shaft 19.980 to 19.993. What is the tightest case?',
              options: ['0.007 mm gap', '0.041 mm gap', '0.013 mm interference', '0.020 mm gap'],
              answer: 0, why: 'Tightest = smallest hole − biggest shaft = 20.000 − 19.993 = 0.007 mm. Always a gap, so it is a clearance fit.',
              tool: ['STACKUPS', 'fits', 'ISO Fits'] },
            { id: 'p3', q: 'Which of these is an interference (press) fit?',
              options: ['H7/g6', 'H7/h6', 'H7/k6', 'H7/s6'],
              answer: 3, why: 'With an H7 hole, g and h give clearance, k and n are transition, and s and u give interference (p is usually a light press). H7/s6 is a medium drive fit.',
              tool: ['STACKUPS', 'fits', 'ISO Fits'] },
            { id: 'p4', q: 'Four parts in a row, each ±0.1. What is the worst-case tolerance of the total length?',
              options: ['±0.1', '±0.2', '±0.4', '±0.8'],
              answer: 2, why: 'Worst case adds every tolerance: 0.1 + 0.1 + 0.1 + 0.1 = ±0.4. (A statistical RSS estimate would be √(4 × 0.1²) = ±0.2.)',
              tool: ['STACKUPS', 'stackup', 'Tolerance Stack-up'] },
            { id: 'p5', q: 'A bolt and nut hold two plates. The bolt is at most Ø8.0 (F) and the holes are at least Ø9.0 (H). What position tolerance can each plate have at MMC?',
              options: ['Ø0.5', 'Ø1.0', 'Ø2.0', 'Ø0.1'],
              answer: 1, why: 'Floating fastener: T = H − F = 9.0 − 8.0 = Ø1.0 for each part.',
              tool: ['STACKUPS', 'fasteners', 'Fastener Formulas'] }
        ]
    },
    {
        id: 'iso', title: 'ASME vs ISO',
        goal: 'Tell which rulebook a drawing uses, and read it with the right defaults.',
        study: [['LEARN', 'asme_iso', 'ASME vs ISO GPS']],
        questions: [
            { id: 'i1', q: 'A drawing says "ISO 8015". A pin is Ø20 ±0.05 with no form tolerance. Every caliper reading is 19.98, but it is bowed 0.08. Does it meet the size requirement?',
              options: ['Yes: under ISO, size does not control form', 'No: it breaks the envelope at MMC'],
              answer: 0, why: 'ISO 8015 uses independency: size is checked point by point only. The bow would need its own form tolerance (or Ⓔ) to be limited.',
              tool: ['LEARN', 'asme_iso', 'ASME vs ISO GPS'] },
            { id: 'i2', q: 'Which clue on a drawing points to ISO?',
              options: ['A two-row composite position frame', 'A note "GENERAL TOLERANCES ISO 2768-mK"', 'CR in front of a radius', 'Inch dimensions'],
              answer: 1, why: 'ISO 2768 general tolerance notes are ISO. Composite frames, CR and inch units all point to ASME.',
              tool: ['LEARN', 'asme_iso', 'ASME vs ISO GPS'] },
            { id: 'i3', q: 'On an ISO drawing, the size Ø12 ±0.05 is followed by Ⓔ. What does Ⓔ ask for?',
              options: ['Perfect form at MMC (the envelope, like ASME Rule #1)', 'An extra-fine surface finish', 'Measure with a CMM'],
              answer: 0, why: 'Ⓔ is the envelope requirement: the ISO way to ask for what ASME does by default with Rule #1.',
              tool: ['MATERIAL', 'rule1', 'Rule #1 Envelope'] },
            { id: 'i4', q: 'An ISO drawing uses the concentricity symbol ◎. What is true?',
              options: ['It is out of date and can be ignored', 'It is a current ISO symbol: read it as a tolerance on the centre points'],
              answer: 1, why: 'ASME removed concentricity in 2018, but ISO still uses it. On an ISO drawing it is a real requirement.',
              tool: ['LEARN', 'asme_iso', 'ASME vs ISO GPS'] },
            { id: 'i5', q: 'An ASME profile frame reads 0.3 Ⓤ 0.1. How much of the zone lies outside the material?',
              options: ['0.3', '0.2', '0.1', '0.15'],
              answer: 2, why: 'The number after Ⓤ is the part of the zone outside the material: 0.1 outside, so 0.2 inside. In ISO the same zone is written 0.3 UZ−0.05.',
              tool: ['LEARN', 'asme_iso', 'ASME vs ISO GPS'] }
        ]
    }
];

export const PASS_MARK = 4;          // of 5, to count a lesson as done
export const STORE = 'practice_v1';

/** Saved answers: { [questionId]: { choice, correct } } */
export function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch { return {}; }
}
export function saveProgress(p) {
    try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* not critical */ }
}

/** Per-lesson summary: answered, correct, done. */
export function lessonStatus(lesson, progress) {
    const answered = lesson.questions.filter(q => progress[q.id]).length;
    const correct = lesson.questions.filter(q => progress[q.id]?.correct).length;
    return { answered, correct, total: lesson.questions.length, done: correct >= PASS_MARK };
}
