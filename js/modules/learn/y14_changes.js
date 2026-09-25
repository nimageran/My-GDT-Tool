// js/modules/learn/y14_changes.js
// ASME Y14.5-2009 vs 2018: which edition a drawing uses, what changed, and
// (just as useful) what did not. A drawing is always read by the edition it
// names. Uses the shared compare page.

import { makeComparePage } from './compare_page.js';

export const CLUES = [
    ['"ASME Y14.5-2018" in the title block or notes', '2018', 'green'],
    ['"ASME Y14.5-2009" in the title block or notes', '2009', 'blue'],
    ['"ASME Y14.5M-1994" (or older)', '1994 or older', 'grey'],
    ['Concentricity ◎ or symmetry ⌯ on an ASME drawing', '2009 or older', 'blue'],
    ['Ⓘ after a size, the all-over symbol (two circles at the leader bend), or a small triangle in a profile frame', '2018', 'green'],
    ['Ⓤ in a profile frame, or CF (continuous feature) next to a size', '2009 or later', 'grey']
];

// big: changes how the feature is inspected
export const TOPICS = [
    { id: 'concentricity', group: 'Removed in 2018', big: true, title: 'Concentricity',
      y2009: 'Concentricity ◎ controls the centre points (median points) of a round feature: they must lie in a small cylinder around the datum axis.',
      y2018: 'Removed. Coaxial features are controlled with position, runout, or profile of a surface instead.',
      you: 'On a 2009 drawing, ◎ is still a real requirement: inspect it as written (median points, not the surface). On newer designs, expect position (for fit) or runout (for rotating parts) instead.',
      link: ['CHARACTERISTICS', 'concentricity', 'Concentricity'] },
    { id: 'symmetry', group: 'Removed in 2018', big: true, title: 'Symmetry',
      y2009: 'Symmetry ⌯ controls the centre points of a slot or tab: they must lie between two planes centred on the datum centre plane.',
      y2018: 'Removed. A centred slot or tab is controlled with position of its centre plane, or with profile.',
      you: 'On a 2009 drawing, ⌯ is still valid: check the midpoints of the slot, not just its walls. Do not swap it for position yourself; ask for a drawing change if needed.',
      link: ['CHARACTERISTICS', 'symmetry', 'Symmetry'] },
    { id: 'independency', group: 'New in 2018', title: 'Switching off Rule #1',
      y2009: 'Rule #1 applies to every size. To turn it off, the drawing needs a note such as "PERFECT FORM AT MMC NOT REQUIRED".',
      y2018: 'The independency symbol Ⓘ written after the size does the same job.',
      you: 'Ⓘ means size is checked point by point only; bending or out-of-round is limited only by other tolerances. It is also a sign the drawing is 2018 (or ISO).',
      link: ['MATERIAL', 'rule1', 'Rule #1 Envelope'] },
    { id: 'all_over', group: 'New in 2018', title: 'All over',
      y2009: 'To apply a profile to every surface, the note ALL OVER is written under the frame.',
      y2018: 'An all-over symbol: two small concentric circles where the leader bends.',
      you: 'Two circles = every surface of the part. One circle is still all around (the outline in that view). Easy to confuse, so look closely.',
      link: ['DECODE', 'symbol_finder', 'Symbol Finder'] },
    { id: 'dynamic', group: 'New in 2018', title: 'Dynamic profile',
      y2009: 'To tighten the shape of a profiled surface, a second profile frame or a separate form tolerance is added.',
      y2018: 'A small triangle after the tolerance in a profile frame (dynamic profile) controls the form of the surface. Its zone may grow or shrink evenly, so it does not control the size or location.',
      you: 'Read a triangle in a profile frame as "shape only": the surface must follow the perfect shape within that band, wherever the other rows allow it to sit.',
      link: ['CHARACTERISTICS', 'surface_profile', 'Surface Profile'] },
    { id: 'rule1', group: 'Did not change', title: 'Rule #1 and the defaults',
      y2009: 'Rule #1 (perfect form at MMC) applies by default. No modifier means RFS for features and RMB for datum features.',
      y2018: 'The same.',
      you: 'Size, bonus and datum defaults are read the same way in both editions.',
      link: ['MATERIAL', 'bonus', 'Bonus Tolerance'] },
    { id: 'datums', group: 'Did not change', title: 'Datums and modifiers',
      y2009: 'Introduced MMB / LMB after a datum letter, the translation modifier ▷, movable datum targets, Ⓤ unequally disposed profile, CF and SF.',
      y2018: 'All kept.',
      you: 'A drawing using these can be 2009 or 2018: check the title block for the edition.',
      link: ['MATERIAL', 'datum_shift', 'Datum Shift'] },
    { id: 'frames', group: 'Did not change', title: 'Frames and the other characteristics',
      y2009: 'Feature control frames, composite frames, and the other twelve characteristics (form, profile, orientation, position, runout).',
      y2018: 'Read the same way; the standard was reorganised and many explanations were clarified.',
      you: 'Everything you learned about frames and zones still applies. Only the items above differ.',
      link: ['DECODE', 'composite_frames', 'Feature Control Frames'] }
];
const GROUPS = ['Removed in 2018', 'New in 2018', 'Did not change'];

const page = makeComparePage({
    id: 'y14_changes',
    title: 'Y14.5-2009 vs 2018',
    intro: 'Most drawings you meet use one of these two editions. The differences are few, but two of them change how a feature is inspected. <b>Always read a drawing by the edition it names</b>, even if a newer one exists.',
    cluesTitle: 'Which edition is this drawing? Look for these clues',
    clues: CLUES,
    cluesNote: 'No edition named? Ask. Older drawings (1994 and before) follow earlier rules that differ in places, for example how datums of size are simulated.',
    cols: [{ key: 'y2009', label: 'Y14.5-2009', colour: 'blue' }, { key: 'y2018', label: 'Y14.5-2018', colour: 'green' }],
    topics: TOPICS,
    groups: GROUPS,
    bigLabel: 'Changes how you inspect',
    placeholder: 'e.g. concentricity, Ⓘ, all over',
    remember: { title: 'The one to remember', text: 'A 2009 drawing with concentricity or symmetry is still valid. Inspect it as written. Replacing it with position or runout is a design change, so it needs the customer\'s approval and a new revision.' },
    footnote: 'This page lists the changes that matter when reading drawings. Y14.5-2018 also reorganised the standard and clarified many rules without changing how they are read.'
});

export const { draw, loadControls, unload } = page;
