// js/glossary.js
// ============================================================================
// GLOSSARY: one plain-language list of the terms used across the tool, plus
// the hover definitions that appear wherever those terms are written.
//
// Entry fields:
//   term      the name shown
//   match     words to recognise in text (case-insensitive; UPPERCASE entries
//             like 'MMC' match exactly)
//   meaning   one or two short sentences, everyday words
//   example   optional short case with numbers
//   see       optional { cat, sym, label } to open the tool that shows it
//   nolink    true = listed in the glossary but not underlined in text
//             (too common to be useful)
// Writing rules: same as js/explain.js.
// ============================================================================

const tool = (cat, sym, label) => ({ cat, sym, label });

export const GLOSSARY = [
    { term: '3-2-1 rule', match: ['3-2-1'],
      meaning: 'The part touches the primary datum at 3 or more points, the secondary at 2 and the tertiary at 1. That holds it still in the same way every time.',
      see: tool('DATUMS', 'drf', 'Datum reference frame') },
    { term: 'Actual mating size', match: ['actual mating size', 'mating size'],
      meaning: 'The size of the biggest perfect pin that fits into the hole (or the smallest perfect ring that fits over the pin). This is the size used to work out bonus.',
      example: 'A slightly bent hole measures Ø10.05 with calipers but only accepts a Ø10.02 gauge pin: its mating size is 10.02.' },
    { term: 'All around', match: ['all around'],
      meaning: 'A small circle at the bend of a leader line: the requirement applies all the way around the outline shown in that view.',
      see: tool('DECODE', 'symbol_finder', 'Symbol Finder') },
    { term: 'All over', match: ['all over'],
      meaning: 'Two small circles at the bend of a leader line: the requirement applies to every surface of the part.' },
    { term: 'Angularity', match: ['angularity'],
      meaning: 'A surface or axis must sit at a given angle to a datum, inside a zone of a set width.',
      see: tool('CHARACTERISTICS', 'angularity', 'Angularity') },
    { term: 'ASME Y14.5', match: ['ASME Y14.5', 'Y14.5'],
      meaning: 'The US standard for dimensions and GD&T. The current edition is from 2018.' },
    { term: 'Axis', match: ['axis'], nolink: true,
      meaning: 'The centre line of a hole, pin or shaft.' },
    { term: 'Basic dimension', match: ['basic dimension', 'basic dimensions', 'basic angle'],
      meaning: 'A number in a box. It is the exact, perfect value; how far the part may be off comes from a GD&T frame, not from ±.',
      example: 'A boxed 25 to a hole means its perfect spot is 25 from the datum; the position tolerance says how far off it may be.' },
    { term: 'Between', match: ['between symbol'],
      meaning: 'A double arrow with two letters (A to B): the requirement applies only between those two points.' },
    { term: 'Bonus tolerance', match: ['bonus tolerance', 'bonus'],
      meaning: 'Extra tolerance you get when a feature with Ⓜ is made away from its MMC size.',
      example: 'Hole Ø10 +0.1/−0, position Ø0.2 Ⓜ. Made at Ø10.06, it gets 0.06 bonus: allowed Ø0.26.',
      see: tool('MATERIAL', 'bonus', 'Bonus Tolerance') },
    { term: 'Circular runout', match: ['circular runout'],
      meaning: 'How much one ring of a round surface wobbles on a dial indicator while the part spins on its datum axis.',
      see: tool('CHARACTERISTICS', 'circular_runout', 'Circular Runout') },
    { term: 'Circularity', match: ['circularity', 'roundness'],
      meaning: 'How round each slice of a shaft or hole is: every point of the slice must fit between two circles with the same centre.',
      see: tool('CHARACTERISTICS', 'circularity', 'Circularity') },
    { term: 'CJP', match: ['CJP', 'complete joint penetration'],
      meaning: 'Complete joint penetration: the weld goes all the way through the joint. On a groove weld symbol with no depth given, CJP is assumed.',
      see: tool('DECODE', 'welding', 'Welding Symbols') },
    { term: 'CMM', match: ['CMM', 'coordinate measuring machine'],
      meaning: 'Coordinate measuring machine: it touches or scans the part and records points in X, Y and Z.',
      see: tool('INSPECTION', 'cmm_position', 'CMM Position Calculator') },
    { term: 'Common datum (A-B)', match: ['common datum', 'A-B'],
      meaning: 'Two datum features used together as one datum, for example two bearing seats making one axis.' },
    { term: 'Composite frame', match: ['composite frame', 'composite'],
      meaning: 'Two rows sharing one symbol. The top row places the whole pattern; the bottom row controls the features relative to each other.',
      see: tool('DECODE', 'composite_frames', 'Feature Control Frames') },
    { term: 'Concentricity', match: ['concentricity'],
      meaning: 'The midpoints of a round feature must lie within a small cylinder around a datum axis. Removed from ASME Y14.5 in 2018.',
      see: tool('CHARACTERISTICS', 'concentricity', 'Concentricity') },
    { term: 'Controlled radius (CR)', match: ['controlled radius'],
      meaning: 'A radius that must be a smooth curve, with no flat spots or reversals. Stricter than a plain R.' },
    { term: 'Counterbore', match: ['counterbore', 'counterbored'],
      meaning: 'A flat-bottomed, larger hole at the top of a hole, so a bolt head sits below the surface.',
      see: tool('DECODE', 'hole_callouts', 'Holes, Threads & Patterns') },
    { term: 'Countersink', match: ['countersink', 'countersunk'],
      meaning: 'A cone at the top of a hole for a flat-head screw. Given as diameter × included (full) angle.',
      see: tool('DECODE', 'hole_callouts', 'Holes, Threads & Patterns') },
    { term: 'Cut-off (λc)', match: ['cut-off', 'sampling length', 'λc'],
      meaning: 'The length the roughness instrument uses for each measurement. A different cut-off can give a different reading.',
      see: tool('DECODE', 'surface_finish', 'Surface Finish') },
    { term: 'Cylindricity', match: ['cylindricity'],
      meaning: 'The whole surface of a shaft or hole must fit between two cylinders with the same axis. Combines roundness, straightness and taper.',
      see: tool('CHARACTERISTICS', 'cylindricity', 'Cylindricity') },
    { term: 'Datum', match: ['datum', 'datums'],
      meaning: 'A perfect reference (plane, axis or point) that measurements start from. The real part creates it by resting against tables, plates or gauge pins.',
      see: tool('DATUMS', 'drf', 'Datum reference frame') },
    { term: 'Datum feature', match: ['datum feature', 'datum features'],
      meaning: 'The real surface or feature on the part that creates a datum. It is marked on the drawing with a triangle and a boxed letter.' },
    { term: 'Datum feature simulator', match: ['datum feature simulator', 'datum simulator', 'simulator'],
      meaning: 'The real equipment that stands in for a datum: a granite table, an angle plate, a gauge pin or a chuck.' },
    { term: 'Datum reference frame', match: ['datum reference frame', 'reference frame'],
      meaning: 'The set of datums (usually A, B, C) that fixes how the part is held and measured.',
      see: tool('DATUMS', 'drf', 'Datum reference frame') },
    { term: 'Datum shift', match: ['datum shift'],
      meaning: 'Extra movement allowed when a datum hole or pin is called out with Ⓜ after its letter and is made away from its boundary size.',
      example: 'Datum B is a Ø10 hole at MMB, made at Ø10.1: on a Ø10 gauge pin the part may shift up to 0.05 in any direction.',
      see: tool('MATERIAL', 'datum_shift', 'Datum Shift') },
    { term: 'Datum target', match: ['datum target', 'datum targets', 'target point', 'target area'],
      meaning: 'A specific point, line or area used as a datum instead of a whole surface. Common on castings, forgings and sheet metal.',
      example: 'A casting rests on three target points A1, A2, A3 instead of its whole rough face.',
      see: tool('DATUMS', 'datum_targets', 'Datum Targets') },
    { term: 'Degrees of freedom', match: ['degrees of freedom', 'degree of freedom'],
      meaning: 'The 6 ways a part can move: slide along X, Y and Z, and turn about X, Y and Z.',
      see: tool('DATUMS', 'drf', 'Datum reference frame') },
    { term: 'Derived median line / plane', match: ['derived median line', 'derived median plane', 'median plane', 'median line'],
      meaning: 'An imaginary line (or plane) made of the midpoints of a feature. Used when straightness or flatness is applied to the axis or centre plane.' },
    { term: 'Feature', match: ['feature'], nolink: true,
      meaning: 'Any physical part of the part: a face, hole, slot, pin or edge.' },
    { term: 'Feature control frame', match: ['feature control frame', 'feature control frames'],
      meaning: 'The rectangular box holding a GD&T requirement: symbol, then tolerance and modifiers, then datums.',
      see: tool('DECODE', 'frame_checker', 'Frame Legality Checker') },
    { term: 'Feature of size', match: ['feature of size', 'features of size'],
      meaning: 'A feature with a size measured between opposite points: a hole, pin, slot or tab. Only these can use Ⓜ or Ⓛ.' },
    { term: 'FIM', match: ['FIM', 'full indicator movement'],
      meaning: 'Full indicator movement: the highest minus the lowest reading of a dial indicator during a check.' },
    { term: 'Fillet weld', match: ['fillet weld', 'fillet welds'],
      meaning: 'A triangle-shaped weld in the corner between two parts. The number to its left is the leg size.',
      see: tool('DECODE', 'welding', 'Welding Symbols') },
    { term: 'Flatness', match: ['flatness'],
      meaning: 'How flat a surface is: all its points must fit between two parallel planes. Never has a datum.',
      see: tool('CHARACTERISTICS', 'flatness', 'Flatness') },
    { term: 'Floating / fixed fastener', match: ['floating fastener', 'fixed fastener'],
      meaning: 'Floating: a bolt and nut through clearance holes in both parts. Fixed: a screw in a tapped hole or a pressed pin, which gets about half the position tolerance.',
      see: tool('STACKUPS', 'fasteners', 'Fastener Formulas') },
    { term: 'Form control', match: ['form control', 'form controls', 'form tolerance', 'form tolerances'],
      meaning: 'A control of shape only: straightness, flatness, circularity and cylindricity. It never has a datum.' },
    { term: 'Free state (Ⓕ)', match: ['free state'],
      meaning: 'The requirement applies with the part unclamped, as it sits freely. Used for thin or flexible parts.' },
    { term: 'GD&T', match: ['GD&T'],
      meaning: 'Geometric dimensioning and tolerancing: symbols that say how much a feature\'s shape, angle and location may vary.' },
    { term: 'Independency (Ⓘ)', match: ['independency'],
      meaning: 'Rule #1 does not apply to this size: size and shape are checked separately. ISO drawings work this way by default.',
      see: tool('MATERIAL', 'rule1', 'Rule #1 Envelope') },
    { term: 'ISO GPS', match: ['ISO GPS', 'ISO 8015'],
      meaning: 'The international (ISO) system for GD&T. It looks similar to ASME but has some different defaults, for example no Rule #1.',
      see: tool('LEARN', 'asme_iso', 'ASME vs ISO GPS') },
    { term: 'Lay', match: ['lay direction', 'lay symbol', 'surface lay'],
      meaning: 'The direction of the machining marks on a surface, shown by a small symbol next to the surface finish mark.',
      see: tool('DECODE', 'surface_finish', 'Surface Finish') },
    { term: 'LMC', match: ['LMC', 'least material condition'],
      meaning: 'Least material condition: the biggest hole or the smallest pin allowed, so the least material is left.',
      example: 'Hole Ø10 +0.1/−0: LMC = Ø10.1. Pin Ø10 +0/−0.1: LMC = Ø9.9.' },
    { term: 'MMB / LMB', match: ['MMB', 'LMB'],
      meaning: 'Ⓜ or Ⓛ after a datum letter: that datum is held by a fixed-size gauge, so the part may shift a little on it (datum shift).',
      see: tool('MATERIAL', 'datum_shift', 'Datum Shift') },
    { term: 'MMC', match: ['MMC', 'maximum material condition'],
      meaning: 'Maximum material condition: the smallest hole or the biggest pin allowed, so the most material is left.',
      example: 'Hole Ø10 +0.1/−0: MMC = Ø10.0. Pin Ø10 +0/−0.1: MMC = Ø10.0.',
      see: tool('MATERIAL', 'bonus', 'Bonus Tolerance') },
    { term: 'Nominal size', match: ['nominal size', 'nominal'],
      meaning: 'The target size written on the drawing, before any tolerance.' },
    { term: 'nX (number of places)', match: ['number of places'],
      meaning: 'A count like 4X in front of a callout: it applies to that many identical features, and to every line of the note below it.' },
    { term: 'Orientation control', match: ['orientation control', 'orientation tolerance', 'orientation tolerances'],
      meaning: 'Angularity, perpendicularity or parallelism: they control tilt relative to a datum, always need a datum, and do not control location.' },
    { term: 'Parallelism', match: ['parallelism'],
      meaning: 'A surface or axis must run parallel to a datum, within a zone of a set width.',
      see: tool('CHARACTERISTICS', 'parallelism', 'Parallelism') },
    { term: 'Perpendicularity', match: ['perpendicularity'],
      meaning: 'A surface or axis must stand at 90° to a datum, within a zone of a set width.',
      see: tool('CHARACTERISTICS', 'perpendicularity', 'Perpendicularity') },
    { term: 'Position', match: ['position'],
      meaning: 'Where a hole, pin, slot or tab is: its axis or centre plane must be inside a zone around its perfect location.',
      see: tool('CHARACTERISTICS', 'position', 'Position') },
    { term: 'Profile', match: ['profile of a surface', 'profile of a line', 'surface profile', 'line profile'],
      meaning: 'The surface (or each slice of it) must stay within a band around its perfect shape. With datums it also controls angle and location.',
      see: tool('CHARACTERISTICS', 'surface_profile', 'Surface Profile') },
    { term: 'Projected tolerance zone (Ⓟ)', match: ['projected tolerance zone', 'projected zone'],
      meaning: 'The tolerance zone extends above the part by the height shown, where the mating part sits. Used on tapped holes and pressed pins.',
      see: tool('STACKUPS', 'fasteners', 'Fastener Formulas') },
    { term: 'Ra', match: ['Ra'],
      meaning: 'Average roughness height of a surface, in µm (or µin on older US drawings). Ra 1.6 µm is a typical good machined finish.',
      see: tool('DECODE', 'surface_finish', 'Surface Finish') },
    { term: 'Reference dimension', match: ['reference dimension'],
      meaning: 'A number in brackets. It is for information only and is not inspected.' },
    { term: 'Resultant condition', match: ['resultant condition'],
      meaning: 'The other worst-case boundary of a feature, on the opposite side from virtual condition. Used to check minimum wall thickness.',
      example: 'Hole Ø10 +0.1/−0 with position Ø0.2 Ⓜ: resultant condition = 10.1 + 0.2 + 0.1 bonus = Ø10.4.',
      see: tool('MATERIAL', 'virtual_condition', 'Virtual & Resultant Condition') },
    { term: 'RFS', match: ['RFS', 'regardless of feature size'],
      meaning: 'Regardless of feature size: no bonus; the tolerance stays the same whatever the size. It is the default when no modifier is shown.' },
    { term: 'RSS', match: ['RSS', 'root sum square'],
      meaning: 'Root sum square: a statistical way to add tolerances in a stack-up. More realistic than worst case when processes are stable and centred.',
      see: tool('STACKUPS', 'stackup', 'Tolerance Stack-up') },
    { term: 'Rule #1 (envelope rule)', match: ['Rule #1', 'envelope rule'],
      meaning: 'In ASME, a feature of size must not go beyond perfect form at its MMC size. So a pin at its biggest size must also be perfectly straight.',
      example: 'A pin Ø10 ±0.1 must fit in a perfect Ø10.1 ring gauge along its whole length.',
      see: tool('MATERIAL', 'rule1', 'Rule #1 Envelope') },
    { term: 'Runout', match: ['runout'],
      meaning: 'How much a surface wobbles on a dial indicator while the part spins on its datum axis. Circular runout checks one ring at a time; total runout checks the whole surface.',
      see: tool('CHARACTERISTICS', 'total_runout', 'Total Runout') },
    { term: 'Rz', match: ['Rz'],
      meaning: 'Average peak-to-valley height of a surface. Usually about 4 to 7 times the Ra value.',
      see: tool('DECODE', 'surface_finish', 'Surface Finish') },
    { term: 'Spotface', match: ['spotface', 'spotfaced'],
      meaning: 'A very shallow counterbore, machined just deep enough to give a flat seat for a bolt head or washer.',
      see: tool('DECODE', 'hole_callouts', 'Holes, Threads & Patterns') },
    { term: 'Stack-up', match: ['stack-up', 'stack-ups', 'stackup'],
      meaning: 'Adding up dimensions and tolerances around a chain of parts to predict a gap, and whether the parts will always fit.',
      see: tool('STACKUPS', 'stackup', 'Tolerance Stack-up') },
    { term: 'Straightness', match: ['straightness'],
      meaning: 'How straight a line on the surface (or, with Ø, the axis) is.',
      see: tool('CHARACTERISTICS', 'straightness', 'Straightness') },
    { term: 'Symmetry', match: ['symmetry'],
      meaning: 'The midpoints of a slot or tab must lie close to a datum centre plane. Removed from ASME Y14.5 in 2018.',
      see: tool('CHARACTERISTICS', 'symmetry', 'Symmetry') },
    { term: 'Tangent plane (Ⓣ)', match: ['tangent plane'],
      meaning: 'Only the plane touching the high points of the surface must be within the zone, not every point.' },
    { term: 'THRU', match: ['THRU'],
      meaning: 'The hole goes all the way through the part.' },
    { term: 'Tolerance', match: ['tolerance'], nolink: true,
      meaning: 'How much a size or feature is allowed to vary from perfect.' },
    { term: 'Tolerance zone', match: ['tolerance zone', 'tolerance zones'],
      meaning: 'The space the feature must stay inside: a band, a pair of planes or a small cylinder, depending on the control.' },
    { term: 'Total runout', match: ['total runout'],
      meaning: 'How much the whole surface wobbles on a dial indicator that slides along it while the part spins. Stricter than circular runout.',
      see: tool('CHARACTERISTICS', 'total_runout', 'Total Runout') },
    { term: 'True position', match: ['true position'],
      meaning: 'The perfect location of a feature, set by basic (boxed) dimensions from the datums.',
      see: tool('CHARACTERISTICS', 'position', 'Position') },
    { term: 'Unequally disposed profile (Ⓤ)', match: ['unequally disposed', 'unequal profile'],
      meaning: 'The profile band is not split equally: the number after Ⓤ is how much of it lies on the side that adds material.' },
    { term: 'Virtual condition', match: ['virtual condition'],
      meaning: 'The worst-case boundary of a feature: its MMC size combined with its geometric tolerance. It is the size of the fixed gauge pin that must always fit.',
      example: 'Hole Ø10 +0.1/−0 with position Ø0.2 Ⓜ: virtual condition = 10.0 − 0.2 = Ø9.8.',
      see: tool('MATERIAL', 'virtual_condition', 'Virtual & Resultant Condition') },
    { term: 'Worst case', match: ['worst case', 'worst-case'],
      meaning: 'Assuming every part is at its worst limit at the same time. Guaranteed to work, but pessimistic.',
      see: tool('STACKUPS', 'stackup', 'Tolerance Stack-up') },

    // ASME vs ISO
    { term: 'Envelope requirement (Ⓔ)', match: ['envelope requirement'],
      meaning: 'Ⓔ after a size on an ISO drawing: the feature must not go beyond perfect form at its MMC size, like ASME Rule #1.',
      see: tool('LEARN', 'asme_iso', 'ASME vs ISO GPS') },
    { term: 'Theoretically exact dimension (TED)', match: ['TED', 'theoretically exact dimension'],
      meaning: 'The ISO name for a basic dimension: a boxed, perfect value whose tolerance comes from a geometric frame.',
      see: tool('LEARN', 'asme_iso', 'ASME vs ISO GPS') },
    { term: 'CZ (combined zone)', match: ['CZ', 'combined zone'],
      meaning: 'ISO: the features of a pattern are toleranced as one group, with their zones locked together by the TEDs between them.',
      see: tool('LEARN', 'asme_iso', 'ASME vs ISO GPS') },
    { term: 'UZ', match: ['UZ'],
      meaning: 'ISO: the profile zone is not centred on the true profile. The number after UZ is how far the zone centre moves (+ outside the material, − inside).',
      example: '0.3 UZ−0.05 is the same zone as ASME 0.3 Ⓤ 0.1: 0.1 outside, 0.2 inside.',
      see: tool('LEARN', 'asme_iso', 'ASME vs ISO GPS') },

    // Manufacturing
    { term: 'Cp / Cpk', match: ['Cpk', 'Cp', 'process capability index'],
      meaning: 'Numbers that say whether a process can hold a tolerance. Cp compares the tolerance with the spread; Cpk also checks how centred the process is. 1.33 or more is the usual target.',
      example: 'Tolerance 0.10, spread 6σ = 0.072: Cp = 1.39. If the average drifts towards a limit, Cpk drops below Cp.',
      see: tool('MANUFACTURING', 'cpk', 'Cp / Cpk Calculator') },
    { term: 'Standard deviation', match: ['standard deviation', 'sigma'],
      meaning: 'How spread out a set of measurements is (σ). For a bell-shaped spread, about 99.7% of parts fall within ±3σ of the average.',
      see: tool('MANUFACTURING', 'cpk', 'Cp / Cpk Calculator') },

    // Fits
    { term: 'ISO fit', match: ['ISO fit', 'ISO fits', 'H7/g6', 'fit class'],
      meaning: 'A code like Ø20 H7/g6 that gives a hole (capital letter) and a shaft (small letter) tolerance zones from the ISO 286 tables, and so sets how tightly they fit.',
      example: 'Ø20 H7/g6: hole 20.000 to 20.021, shaft 19.980 to 19.993, always a 0.007 to 0.041 mm gap.',
      see: tool('STACKUPS', 'fits', 'ISO Fits') },
    { term: 'IT grade', match: ['IT grade', 'IT grades', 'tolerance grade'],
      meaning: 'The number in a fit class like H7. It sets how wide the tolerance is: a lower number is tighter. The width also grows with the size.',
      example: 'IT7 is 21 µm wide at 20 mm and 35 µm wide at 100 mm.',
      see: tool('STACKUPS', 'fits', 'ISO Fits') },
    { term: 'Clearance fit', match: ['clearance fit', 'clearance fits', 'running fit', 'sliding fit'],
      meaning: 'A fit where the shaft is always smaller than the hole, so there is always a gap and it slides in.',
      see: tool('STACKUPS', 'fits', 'ISO Fits') },
    { term: 'Transition fit', match: ['transition fit', 'transition fits'],
      meaning: 'A fit that can end up with a small gap or a slight press, depending on the actual sizes. Used for accurate location.',
      see: tool('STACKUPS', 'fits', 'ISO Fits') },
    { term: 'Interference fit', match: ['interference fit', 'interference fits', 'press fit', 'press-fit', 'shrink fit'],
      meaning: 'A fit where the shaft is always bigger than the hole, so it must be pressed in, or the hole heated or the shaft cooled first.',
      see: tool('STACKUPS', 'fits', 'ISO Fits') },
    { term: 'Hole basis', match: ['hole basis', 'hole-basis'],
      meaning: 'The usual way to choose fits: the hole is always H (smallest size = nominal), and the shaft letter sets the fit. Holes are made with fixed-size tools, so this keeps tooling simple.',
      see: tool('STACKUPS', 'fits', 'ISO Fits') },

    // Drawing basics
    { term: 'Title block', match: ['title block'],
      meaning: 'The box in the bottom-right corner of a drawing: part number, revision, material, units, standard and default tolerances.',
      see: tool('DECODE', 'title_block', 'Title Block') },
    { term: 'Revision block', match: ['revision block', 'revision table'],
      meaning: 'The table (usually top right) listing each revision letter, what changed, the date and who approved it.',
      see: tool('DECODE', 'read_checklist', 'How to Read a Drawing') },
    { term: 'Third angle projection', match: ['third angle', 'third-angle'],
      meaning: 'View layout used in the US and Canada: each view sits on the side you look from, so the top view is above the front view.',
      see: tool('DECODE', 'projection', 'First vs Third Angle') },
    { term: 'First angle projection', match: ['first angle', 'first-angle'],
      meaning: 'View layout used in Europe and much of Asia: each view sits on the opposite side, so the top view is below the front view.',
      see: tool('DECODE', 'projection', 'First vs Third Angle') },
    { term: 'General tolerance', match: ['general tolerance', 'general tolerances', 'default tolerance', 'default tolerances'],
      meaning: 'The tolerance a dimension gets when none is written next to it, from the title block or a note like ISO 2768-m.',
      example: 'Title block "X.X ±0.2": a length written 40.0 may be 39.8 to 40.2.',
      see: tool('DECODE', 'general_tolerances', 'General Tolerances') },
    { term: 'ISO 2768', match: ['ISO 2768'],
      meaning: 'A standard table of general tolerances. The class letter (f fine, m medium, c coarse, v very coarse) sets how loose they are.',
      example: 'ISO 2768-m: a 40 mm length with no tolerance written is ±0.3.',
      see: tool('DECODE', 'general_tolerances', 'General Tolerances') },
    { term: 'UOS', match: ['UOS', 'unless otherwise specified'],
      meaning: 'Unless otherwise specified: the rule applies everywhere except where the drawing says something different.',
      see: tool('DECODE', 'drawing_notes', 'Notes & Abbreviations') },
    { term: 'TYP', match: ['TYP'],
      meaning: 'Typical: the dimension or note applies to all the matching features, not just the one it points to.',
      see: tool('DECODE', 'drawing_notes', 'Notes & Abbreviations') },
    { term: 'Hidden line', match: ['hidden line', 'hidden lines'],
      meaning: 'A dashed line: an edge that exists but is behind material in this view.',
      see: tool('DECODE', 'lines_views', 'Lines & Views') },
    { term: 'Center line', match: ['center line', 'centre line', 'center lines', 'centre lines'],
      meaning: 'A thin long-and-short dash line marking the middle of a hole, shaft or symmetric shape.',
      see: tool('DECODE', 'lines_views', 'Lines & Views') },
    { term: 'Phantom line', match: ['phantom line', 'phantom lines'],
      meaning: 'A thin line of one long and two short dashes: a mating part, another position of a moving part, or material to be removed.',
      see: tool('DECODE', 'lines_views', 'Lines & Views') },
    { term: 'Section view', match: ['section view', 'section views'],
      meaning: 'A view of the part imagined cut open. Hatching marks the solid material that was cut.',
      see: tool('DECODE', 'lines_views', 'Lines & Views') },
    { term: 'Detail view', match: ['detail view', 'detail views'],
      meaning: 'A small circled area drawn again larger elsewhere on the sheet, with its own scale. Its dimensions are still real sizes.',
      see: tool('DECODE', 'lines_views', 'Lines & Views') },
    { term: 'Auxiliary view', match: ['auxiliary view', 'auxiliary views'],
      meaning: 'A view looking straight at a slanted surface, the only place its true shape and size show.',
      see: tool('DECODE', 'lines_views', 'Lines & Views') },
    { term: 'Break sharp edges', match: ['break sharp edges', 'edge break'],
      meaning: 'A note asking for a small chamfer or radius on every edge that has none shown, so no edge is razor sharp.',
      example: '"BREAK SHARP EDGES 0.2-0.5": a light 0.2 to 0.5 mm chamfer on each edge.',
      see: tool('DECODE', 'drawing_notes', 'Notes & Abbreviations') },
    { term: 'Burr', match: ['burr', 'burrs', 'deburr'],
      meaning: 'A small rough bit of metal left on an edge by a cutting tool. "Remove all burrs" means none may remain.' },
    { term: 'Temper', match: ['temper'],
      meaning: 'The heat-treat state of a metal, written after the grade, like T6 in 6061-T6. Same alloy, different temper, different strength.' },
    { term: 'Anodize', match: ['anodize', 'anodizing', 'anodized'],
      meaning: 'A coating grown on aluminium for wear and corrosion protection. It adds thickness, so tight holes and fits must allow for it.' }
];

// --------------------------------------------------------------------------
// TEXT LINKING: underline known terms and show their meaning on hover / tap
// --------------------------------------------------------------------------

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAcronym = w => w === w.toUpperCase() && /[A-Z]/.test(w);

// One pattern per entry; longest words first so "total runout" wins over "runout"
const PATTERNS = GLOSSARY.filter(g => !g.nolink).map(g => {
    const words = [...g.match].sort((a, b) => b.length - a.length);
    const exact = words.filter(isAcronym), loose = words.filter(w => !isAcronym(w));
    const parts = [];
    if (loose.length) parts.push(new RegExp(`(?<![\\w-])(${loose.map(escRe).join('|')})(?![\\w-])`, 'i'));
    if (exact.length) parts.push(new RegExp(`(?<![\\w-])(${exact.map(escRe).join('|')})(?![\\w-])`));
    return { entry: g, parts, longest: words[0].length };
}).sort((a, b) => b.longest - a.longest);

const SKIP = 'button, label, input, select, option, textarea, a, .gloss, h1, h2, h3, h4, [data-nogloss]';

/**
 * Underline the first occurrence of each glossary term inside `root`.
 * opts.skipTerms: terms already defined nearby (not underlined).
 */
export function linkify(root, { skipTerms = [] } = {}) {
    if (!root) return;
    const skip = new Set(skipTerms.map(t => t.toLowerCase()));
    const done = new Set(root.querySelectorAll('.gloss').length ? [...root.querySelectorAll('.gloss')].map(e => e.dataset.term) : []);

    for (const { entry, parts } of PATTERNS) {
        if (done.has(entry.term) || skip.has(entry.term.toLowerCase())) continue;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (n.parentElement && !n.parentElement.closest(SKIP) && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        let node, hit = null;
        while (!hit && (node = walker.nextNode())) {
            for (const re of parts) {
                const m = re.exec(node.nodeValue);
                if (m && (!hit || m.index < hit.index)) hit = { node, index: m.index, text: m[1] };
            }
        }
        if (!hit) continue;
        const after = hit.node.splitText(hit.index);
        after.nodeValue = after.nodeValue.slice(hit.text.length);
        const span = document.createElement('span');
        span.className = 'gloss';
        span.dataset.term = entry.term;
        span.tabIndex = 0;
        span.textContent = hit.text;
        hit.node.parentNode.insertBefore(span, after);
        done.add(entry.term);
    }
}

export function findTerm(name) {
    return GLOSSARY.find(g => g.term === name);
}

// --- Tooltip (one shared element) ---
let tip = null, hideTimer = null;

function showTip(el) {
    const g = findTerm(el.dataset.term);
    if (!g) return;
    clearTimeout(hideTimer);
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'gloss-tip';
        tip.className = 'fixed z-[60] max-w-xs bg-slate-900 text-slate-100 text-sm rounded-lg shadow-xl p-3 leading-snug';
        tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        tip.addEventListener('mouseleave', scheduleHide);
        document.body.appendChild(tip);
    }
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/Ⓜ/g, 'Ⓜ\uFE0E');
    tip.innerHTML = `
        <div class="font-bold text-white mb-1">${esc(g.term)}</div>
        <div>${esc(g.meaning)}</div>
        ${g.example ? `<div class="mt-2 text-slate-300 text-xs"><span class="font-semibold">Example:</span> ${esc(g.example)}</div>` : ''}
        <div class="mt-2 flex gap-3 text-xs">
            ${g.see ? `<button data-go="tool" class="text-sky-300 hover:underline">${esc(g.see.label)} ▶</button>` : ''}
            <button data-go="glossary" class="text-sky-300 hover:underline">Glossary ▶</button>
        </div>`;
    tip.querySelector('[data-go="tool"]')?.addEventListener('click', () => navigate(g.see.cat, g.see.sym));
    tip.querySelector('[data-go="glossary"]').addEventListener('click', () => navigate('LEARN', 'glossary', g.term));
    tip.style.display = 'block';

    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = r.top - h - 8;
    tip.style.left = left + 'px';
    tip.style.top = Math.max(8, top) + 'px';
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (tip) tip.style.display = 'none'; }, 250);
}

function navigate(cat, sym, term) {
    if (tip) tip.style.display = 'none';
    document.getElementById('explain-modal')?.remove();
    if (term) window.__glossaryFocus = term;
    window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));
}

// Delegated listeners: work for every underlined term, wherever it is
document.addEventListener('mouseover', e => { const g = e.target.closest?.('.gloss'); if (g) showTip(g); });
document.addEventListener('mouseout', e => { if (e.target.closest?.('.gloss')) scheduleHide(); });
document.addEventListener('focusin', e => { const g = e.target.closest?.('.gloss'); if (g) showTip(g); });
document.addEventListener('focusout', e => { if (e.target.closest?.('.gloss')) scheduleHide(); });
document.addEventListener('click', e => {
    const g = e.target.closest?.('.gloss');
    if (g) { e.preventDefault(); showTip(g); return; }
    if (tip && !e.target.closest?.('#gloss-tip')) tip.style.display = 'none';
});
