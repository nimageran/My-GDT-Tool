// js/modules/drawing/lines_views.js
// Line types and view types: what each one looks like and what it tells you.

import { makeDictionary, S, DASH } from './dictionary.js';

const block = (x = 50, y = 20, w = 100, h = 50) => S.rect(x, y, w, h);

const LINES = [
    { name: 'Visible line', aka: '(object line)',
      sample: S.line(20, 45, 180, 45, 2.6),
      meaning: 'A thick, solid line. It shows an edge or outline you can actually see from this direction.',
      example: 'The outside shape of a plate in the front view is drawn with visible lines.' },
    { name: 'Hidden line', aka: '(dashed line)',
      sample: block() + S.line(85, 20, 85, 70, 1.2, DASH.hidden) + S.line(115, 20, 115, 70, 1.2, DASH.hidden),
      meaning: 'Short dashes. An edge that exists but is behind material, so you cannot see it from this direction.',
      example: 'A hole drilled through a block shows as a circle from the top, and as two dashed lines from the front.',
      watch: 'Busy drawings often leave hidden lines out. No dashed line does not mean nothing is there; check the other views.' },
    { name: 'Center line',
      sample: S.circle(100, 45, 22) + S.line(66, 45, 134, 45, 1, DASH.center) + S.line(100, 11, 100, 79, 1, DASH.center),
      meaning: 'A thin line of long and short dashes. It marks the centre of a hole, shaft or symmetric shape.',
      example: 'Two crossing centre lines mark the centre of a hole; dimensions to the hole are taken to where they cross.',
      watch: 'A centre line is not an edge. Do not measure to it on the part: it is an idea, found from the hole itself.' },
    { name: 'Phantom line',
      sample: block(60, 30, 80, 40) + S.path('M60,30 L40,12 L120,12 L140,30', 1, 'none', DASH.phantom),
      meaning: 'A thin line of one long and two short dashes. It shows something that is not part of this part: a mating part, another position of a moving part, or material that will be removed.',
      example: 'A lever drawn solid in its closed position, with its open position shown in phantom.' },
    { name: 'Dimension and extension lines',
      sample: S.rect(50, 15, 100, 35) + S.line(50, 53, 50, 78, 1) + S.line(150, 53, 150, 78, 1) + S.arrow(100, 72, 52, 72) + S.arrow(100, 72, 148, 72) + `<rect x="87" y="64" width="26" height="14" fill="#f8fafc"/>` + S.text('50', 100, 75),
      meaning: 'Thin lines. Extension lines come out from the part; the dimension line with arrowheads runs between them and carries the number.',
      example: 'Two extension lines from the ends of a plate and a dimension line between them reading 50.',
      watch: 'Extension lines start with a small gap from the part, so they are not mistaken for edges.' },
    { name: 'Leader line',
      sample: S.circle(60, 50, 16) + S.arrow(140, 18, 72, 40) + S.line(140, 18, 175, 18, 1) + S.text('Ø10', 158, 14, 11),
      meaning: 'A thin line from a note or callout to the feature it describes. An arrowhead touches an edge; a dot means it points to a surface.',
      example: 'A leader from "Ø10 THRU" with its arrow on the hole edge.' },
    { name: 'Cutting-plane line', aka: '(section line)',
      sample: block(60, 25, 80, 40) + S.line(40, 45, 160, 45, 2.4, '18 4 4 4') + S.arrow(40, 45, 40, 22) + S.arrow(160, 45, 160, 22) + S.text('A', 30, 20, 12) + S.text('A', 170, 20, 12),
      meaning: 'A thick line with arrows at both ends. It shows where the part is cut (only in your imagination) to make a section view. The arrows point the way you look.',
      example: 'Line A-A across a flange, with a view labelled "SECTION A-A" elsewhere on the sheet.',
      watch: 'Match the letters: section A-A belongs to cutting line A-A. The arrows tell you which half you are looking at.' },
    { name: 'Section lining', aka: '(hatching)',
      sample: S.hatch(40, 20, 45, 50, 'lv-h1') + S.hatch(115, 20, 45, 50, 'lv-h2') + S.rect(40, 20, 45, 50, 2.2, 'none') + S.rect(115, 20, 45, 50, 2.2, 'none'),
      meaning: 'Thin parallel lines at an angle. They show solid material that the imaginary cut went through. Empty space (like a hole) is left blank.',
      example: 'A cut through a tube shows two hatched walls with a blank gap between them.',
      watch: 'Different parts in one section use different hatch angles. The pattern can also hint at the material, but the title block is the real source.' },
    { name: 'Break line',
      sample: S.line(20, 25, 70, 25, 2.2) + S.line(20, 65, 70, 65, 2.2) + S.path('M70,25 Q62,35 70,45 Q78,55 70,65', 1.2) +
              S.line(130, 25, 180, 25, 2.2) + S.line(130, 65, 180, 65, 2.2) + S.path('M130,25 Q122,35 130,45 Q138,55 130,65', 1.2),
      meaning: 'A wavy or zig-zag line that cuts off part of a long object so it fits the sheet, or cuts away a small area to show inside.',
      example: 'A 2 m shaft drawn with the middle removed. Its length dimension is still the true 2000 mm.',
      watch: 'The part is not really shorter. Always trust the dimension, never the drawn length.' },
    { name: 'Chain line (thick)',
      sample: S.line(20, 55, 180, 55, 2.2) + S.line(60, 44, 140, 44, 2.4, '14 3 3 3') + S.text('HARDEN', 100, 30, 10),
      meaning: 'A thick long-and-short dash line drawn next to a surface. It marks an area with a special requirement, such as hardening, coating or a tighter finish.',
      example: 'A chain line along 20 mm of a shaft with the note "INDUCTION HARDEN THIS AREA".' }
];

const VIEWS = [
    { name: 'Principal views', aka: '(front, top, right side)',
      sample: S.rect(40, 45, 60, 35) + S.rect(40, 10, 60, 25) + S.rect(110, 45, 25, 35) + S.text('F', 70, 67, 10) + S.text('T', 70, 27, 10) + S.text('R', 122, 67, 10),
      meaning: 'The main views, each looking straight at the part from one direction. Most parts need two or three.',
      example: 'Front view in the middle, top view above it, right view to its right (third angle).',
      see: ['DECODE', 'projection', 'First vs third angle'] },
    { name: 'Full section view',
      sample: S.hatch(50, 20, 30, 50, 'lv-h3') + S.hatch(120, 20, 30, 50, 'lv-h4') + S.rect(50, 20, 100, 50, 2.2, 'none') + S.line(80, 20, 80, 70, 2.2) + S.line(120, 20, 120, 70, 2.2),
      meaning: 'The part imagined cut all the way through along a cutting-plane line, with the front half taken away. It shows the inside clearly without hidden lines.',
      example: 'A "SECTION A-A" of a housing shows the bore, grooves and wall thickness as hatched walls.' },
    { name: 'Half section',
      sample: S.hatch(100, 20, 20, 50, 'lv-h5') + S.rect(50, 20, 100, 50, 2.2, 'none') + S.line(100, 12, 100, 78, 1, DASH.center) + S.line(120, 20, 120, 70, 2.2) + S.line(80, 20, 80, 70, 1.2, DASH.hidden),
      meaning: 'Only one quarter is cut away. One half of the view shows the outside, the other half the inside. Used for symmetric parts.',
      example: 'A pulley: left of the centre line is the outside, right of it is the cut showing the hub.' },
    { name: 'Broken-out section',
      sample: block() + S.path('M100,20 Q92,35 104,48 Q114,60 106,70', 1.2) + S.hatch(106, 20, 44, 50, 'lv-h6') + S.circle(128, 45, 8, 2, '', '#fff'),
      meaning: 'A small area cut away inside a normal view, bounded by a break line, to show one hidden detail.',
      example: 'A small cut-away on a shaft to show a cross hole or a keyway depth.' },
    { name: 'Removed or revolved section',
      sample: S.rect(20, 35, 100, 20) + S.line(70, 22, 70, 68, 2.2, '10 3 3 3') + S.hatch(145, 25, 40, 40, 'lv-h7') + S.rect(145, 25, 40, 40, 2.2, 'none') + S.text('B-B', 165, 80, 10),
      meaning: 'The shape of a slice drawn on its own (removed) or rotated in place on the view (revolved). It shows the cross-section of a bar, rib or arm.',
      example: 'A lever arm with "SECTION B-B" showing it is a 12 × 6 rectangle at that point.' },
    { name: 'Detail view',
      sample: S.rect(20, 25, 70, 40) + S.circle(80, 30, 12, 1, DASH.phantom) + S.text('C', 98, 18, 11) + S.circle(150, 45, 32, 1, DASH.phantom) + S.path('M125,45 L150,45 L150,20', 2.2) + S.text('C (4:1)', 150, 88, 10),
      meaning: 'A small area circled on a view and drawn again larger somewhere else, with its own scale.',
      example: '"DETAIL C SCALE 4:1" showing a small groove that is too tiny to dimension in the main view.',
      watch: 'The detail is drawn at a different scale, but the dimensions in it are still real sizes.' },
    { name: 'Auxiliary view',
      sample: S.path('M20,70 L20,40 L60,20 L100,20 L100,70 Z', 2.2) + S.arrow(30, 12, 42, 26) + S.path('M125,60 L165,30 L185,55 L145,85 Z', 2.2),
      meaning: 'A view looking straight at a slanted surface. In the normal views that surface looks squashed, so its true shape and size only show here.',
      example: 'A 30° angled face with a hole in it: only the auxiliary view shows the hole as a true circle.' },
    { name: 'Partial view',
      sample: S.rect(40, 25, 70, 40) + S.circle(75, 45, 10) + S.path('M110,25 Q118,45 110,65', 1.2),
      meaning: 'Only part of a view is drawn, cut off with a break line, because the rest adds nothing.',
      example: 'Only the end of a long bar is drawn in the side view, just to show the pattern of holes.' },
    { name: 'Isometric (pictorial) view',
      sample: S.path('M100,15 L150,35 L100,55 L50,35 Z', 1.8, '#f1f5f9') + S.path('M50,35 L50,65 L100,85 L100,55', 1.8, '#e2e8f0') + S.path('M100,85 L150,65 L150,35', 1.8, '#cbd5e1'),
      meaning: 'A 3D-looking picture of the part, drawn to help you understand the shape.',
      example: 'A small shaded 3D view in a corner of the sheet.',
      watch: 'Pictorial views are usually for reference only. Take sizes from the dimensioned views, not from the picture.' }
];

const dict = makeDictionary({
    id: 'lines_views',
    kicker: 'Drawing basics',
    title: 'Lines & views',
    intro: 'Every line on a drawing has a meaning, shown by its <b>thickness</b> and <b>dash pattern</b>. And each view looks at the part from one direction, or cuts it open to show the inside.',
    placeholder: 'e.g. hidden, section, detail',
    groups: [{ name: 'Lines', entries: LINES }, { name: 'Views', entries: VIEWS }],
    tip: 'To understand a feature, find it in every view. A hole is a circle in one view and two dashed (hidden) lines in the next, always lined up with each other.'
});

export const { draw, loadControls, unload } = dict;
export { LINES, VIEWS };
