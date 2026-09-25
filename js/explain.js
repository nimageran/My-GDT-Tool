// js/explain.js
// ============================================================================
// EXPLAIN PANEL: one plain-language explanation per tool, always in the same
// three parts:
//   1. Key terms   (the harder words, each with a short meaning)
//   2. In simple words   (at most 6 sentences, important words in **bold**)
//   3. Example   (a short real case with numbers, ending in the result)
// plus a one-line hint on how to use the tool.
//
// Writing rules for new entries:
//   - short sentences, everyday words; explain a term the first time it appears
//   - no capitals for emphasis
//   - examples use the same units as the tool and end with pass / fail / action
// ============================================================================

export const EXPLAIN = {
    straightness: {
        title: 'Straightness',
        terms: [
            ['Line element', 'One straight line drawn along the surface, in one direction.'],
            ['Axis (derived median line)', 'The centre line of a pin or hole, made of the centre points of each slice.'],
            ['Form control', 'A control of shape only. It is never tied to a datum.']
        ],
        simple: [
            'Straightness checks **how straight a line** on the part is.',
            'On a surface, each line along it must fit between **two parallel lines** that are the tolerance apart.',
            'If the frame shows **Ø** before the value, it checks the **axis** of a pin or hole instead, inside a thin cylinder.',
            'It never uses a **datum**: it only cares about shape, not where the part is.'
        ],
        example: [
            'A shaft has straightness 0.002" on its surface.',
            'You lay a straight edge along it and find the biggest gap along one line: 0.0015".',
            'That line passes, because 0.0015 is less than 0.002.',
            'Repeat on other lines around the shaft: every one must pass.'
        ],
        tool: 'Use the presets or drag the points to bend the line and watch it against the zone.'
    },

    flatness: {
        title: 'Flatness',
        terms: [
            ['Two parallel planes', 'Two perfect flat sheets, the tolerance apart. The surface must fit between them.'],
            ['Peak and valley', 'The highest and the lowest point of the surface.'],
            ['Floating zone', 'The two planes may tilt and move to fit the surface as well as possible.']
        ],
        simple: [
            'Flatness checks **how flat a surface** is.',
            'All its points must fit between **two parallel planes** that are the tolerance apart.',
            'The planes can **tilt to fit** the surface, so only the shape counts, not the angle.',
            'The flatness error is the **highest point minus the lowest point** after that best fit.',
            'It never has a **datum**.'
        ],
        example: [
            'A mounting plate has flatness 0.004".',
            'On a surface plate, the dial reads from −0.001" to +0.002" across the face.',
            'The spread is 0.003", so it passes.',
            'If one corner read +0.004", the spread would be 0.005" and it would fail.'
        ],
        tool: 'Drag the white points up or down to bow or twist the plate.'
    },

    circularity: {
        title: 'Circularity (roundness)',
        terms: [
            ['Cross-section', 'A slice straight across a round feature.'],
            ['Concentric circles', 'Two circles with the same centre.'],
            ['Lobing', 'A shape with 2 or 3 slightly flat sides (oval or triangle-like).']
        ],
        simple: [
            'Circularity checks **how round each slice** of a shaft or hole is.',
            'Every point of one slice must fit between **two circles with the same centre**, the tolerance apart (measured on the radius).',
            'The circles find **their own best centre**: the part\'s axis does not matter.',
            'Each **slice is checked on its own**.',
            'It never has a datum, and it does not control the size.'
        ],
        example: [
            'A pin has circularity 0.001".',
            'In one slice, the largest radius is 0.2505" and the smallest is 0.2497".',
            'The difference is 0.0008", so that slice passes.',
            'Careful: a 3-lobe shape can measure the same diameter everywhere with a caliper, yet still fail roundness.'
        ],
        tool: 'Add oval or 3-lobe error with the sliders and rotate the part.'
    },

    cylindricity: {
        title: 'Cylindricity',
        terms: [
            ['Coaxial cylinders', 'Two cylinders sharing the same centre line.'],
            ['Taper', 'The diameter changes from one end to the other.'],
            ['Barrel', 'The middle is fatter (or thinner) than the ends.']
        ],
        simple: [
            'Cylindricity checks the **whole surface** of a shaft or hole at once.',
            'All points must fit between **two cylinders with the same axis**, the tolerance apart.',
            'It combines **roundness, straightness and taper** in one check.',
            'Like all form controls, it has **no datum**.',
            'It is strict and costly to inspect, so it is kept for **precision fits**.'
        ],
        example: [
            'A hydraulic piston has cylindricity 0.0005".',
            'Every slice is round within 0.0003", but the diameter grows 0.0008" from one end to the other (0.0004" on the radius).',
            'Together the surface needs a band of about 0.0007", so it fails, even though each slice alone looked fine.'
        ],
        tool: 'Add taper, barrel, bend or oval error. Each slider value is the band that error needs on its own. The tool finds the best-fit axis and size, just like a real check, and shows the narrowest band that holds the whole surface.'
    },

    line_profile: {
        title: 'Profile of a line',
        terms: [
            ['True profile', 'The perfect shape, defined by boxed (basic) dimensions or the CAD model.'],
            ['Line element', 'One 2D slice through the surface.'],
            ['Equal split', 'By default the band lies half outside and half inside the perfect shape.']
        ],
        simple: [
            'Profile of a line checks the **shape of a curve**, one **slice at a time**.',
            'Each slice must stay within a **band around the perfect shape**, the tolerance wide.',
            'By default the band is **split equally**: half each side.',
            'With datums it also controls **angle and location**; without datums, only the shape.'
        ],
        example: [
            'A cam edge has profile of a line 0.030" to datum A.',
            'The band is 0.015" each side of the perfect curve.',
            'At one spot the edge is 0.010" outside: fine.',
            'At another spot it is 0.020" inside: that spot fails.'
        ],
        tool: 'Add surface error and see where the curve leaves the band.'
    },

    surface_profile: {
        title: 'Profile of a surface',
        terms: [
            ['True profile', 'The perfect 3D shape, from basic dimensions or the CAD model.'],
            ['Ⓤ (unequal)', 'Moves the band so more of it lies on one side of the perfect shape.'],
            ['Datum reference frame', 'The set of datums (A, B, C) that fixes where the part is.']
        ],
        simple: [
            'Profile of a surface checks a **whole surface in 3D** against its perfect shape.',
            'Every point must be within a **band around the true profile**, the tolerance wide.',
            'The band is **split equally** unless the frame shows **Ⓤ**.',
            'With datums it controls **shape, size, angle and location** at once, which makes it the most powerful GD&T control.',
            'Without datums, it controls only the shape.'
        ],
        example: [
            'A curved cover has surface profile 0.030" to A, B and C, so the band is ±0.015" around the CAD surface.',
            'A CMM scan finds one point 0.018" proud of the surface.',
            'That point fails, even though the rest of the surface is within ±0.005".'
        ],
        tool: 'Drag the white points to deform the surface; red shows where it leaves the band.'
    },

    angularity: {
        title: 'Angularity',
        terms: [
            ['Basic angle', 'The exact angle, shown in a box on the drawing.'],
            ['Zone width', 'The tolerance: a distance, not an angle.'],
            ['Datum', 'The reference surface the angle is measured from.']
        ],
        simple: [
            'Angularity checks that a surface or axis sits at the **right angle** to a datum (any angle other than 90° or 0°).',
            'The surface must fit between **two parallel planes** the tolerance apart, tilted at the **basic angle**.',
            'The tolerance is a **distance** (like 0.020"), **not degrees**.',
            'The zone may move closer or farther, so it controls only the **tilt**, not the location.'
        ],
        example: [
            'A 45° face, 0.300" long, has angularity 0.020" to datum A.',
            'It is made at 47°: over its length it tilts about 0.300 × sin(2°) ≈ 0.010" away from perfect, so it passes.',
            'At 49° it tilts about 0.021", so it fails.'
        ],
        tool: 'Change the angle error with the slider; the zone follows the surface.'
    },

    perpendicularity: {
        title: 'Perpendicularity',
        terms: [
            ['Perpendicular', 'Exactly 90° to the datum.'],
            ['Lean', 'How far the top of the surface sits from a perfect 90° line.'],
            ['Floating zone', 'The zone may slide sideways; only the lean counts.']
        ],
        simple: [
            'Perpendicularity checks that a surface or axis stands at **90° to a datum**.',
            'The surface must fit between **two parallel planes** that stay at 90° to the datum.',
            'The tolerance is a **width**, not an angle.',
            'The zone may **slide sideways**, so only the **lean** matters, not where the surface is.',
            'With **Ø**, it controls the axis of a pin or hole inside a thin cylinder.'
        ],
        example: [
            'A wall 0.300" tall has perpendicularity 0.015" to datum A (the base).',
            'Its top leans 0.012" from a perfect vertical, so it passes.',
            'If it leaned 0.020", it would fail, even though that is only about 3.8°.'
        ],
        tool: 'Drag the round handle at the top of the block to tilt it.'
    },

    parallelism: {
        title: 'Parallelism',
        terms: [
            ['Parallel', 'Running in the same direction as the datum, like two rails.'],
            ['Datum', 'The reference surface, often the face the part sits on.']
        ],
        simple: [
            'Parallelism checks that a surface or axis runs **parallel to a datum**.',
            'All points must fit between **two planes parallel to the datum**, the tolerance apart.',
            'The zone may move up or down, so it controls **tilt and waviness**, not the **distance** to the datum.',
            'That distance is checked separately, by the size dimension.'
        ],
        example: [
            'A top face must be parallel within 0.50 mm to the bottom face (datum A).',
            'Heights measured across the top range from 20.10 to 20.45 mm.',
            'The spread is 0.35 mm, so parallelism passes.',
            'Whether 20.10 to 20.45 is the right height is judged by the size tolerance.'
        ],
        tool: 'Change the tilt and the tolerance.'
    },

    position: {
        title: 'Position (with MMC and bonus)',
        terms: [
            ['True position', 'The perfect location, set by boxed (basic) dimensions from the datums.'],
            ['MMC', 'Maximum material condition: the smallest hole or the biggest pin allowed.'],
            ['Bonus', 'Extra tolerance you get when the hole is bigger (or the pin smaller) than its MMC size.'],
            ['Virtual condition', 'The worst-case boundary: the size of a fixed gauge pin that must always fit.']
        ],
        simple: [
            'Position controls **where a hole or pin is**.',
            'Its **centre (axis)** must sit inside a **round zone** around the perfect location.',
            'The number in the frame is the zone\'s **diameter**, so position = **2 × the offset**.',
            'With **Ⓜ**, the zone grows by the **bonus** when the hole is bigger than its smallest size.',
            'Without a modifier (RFS), the zone never changes.'
        ],
        example: [
            'A hole Ø0.500" +0.010/−0 has position Ø0.030 Ⓜ.',
            'It measures Ø0.506" and its centre is 0.017" from perfect: position = 2 × 0.017 = 0.034".',
            'That looks too big for 0.030.',
            'But the hole is 0.006" over its smallest size, so the allowed zone is 0.030 + 0.006 = 0.036": it passes.'
        ],
        tool: 'Drag the axis point, change the measured size, and switch between RFS, MMC and LMC.'
    },

    concentricity: {
        title: 'Concentricity (legacy)',
        terms: [
            ['Median points', 'Midpoints between opposite points around the surface.'],
            ['Datum axis', 'The reference centre line.'],
            ['Legacy', 'Removed from ASME Y14.5 in 2018; still found on older drawings.']
        ],
        simple: [
            'Concentricity checks that the **centre points** of a round feature line up with a **datum axis**.',
            'Take opposite points around the surface and find their **midpoints**; all of them must fit inside a **small cylinder** around the datum axis.',
            'It is slow and hard to inspect, so it was **removed from the standard in 2018**.',
            'On new drawings you will see **position, runout or profile** instead.'
        ],
        example: [
            'A shaft step has concentricity Ø0.005" to datum A.',
            'Midpoints measured along the step wander up to 0.002" from the axis: 2 × 0.002 = 0.004", so it passes.',
            'A 3-lobe shape can have the same diameter everywhere and still move its midpoints, and fail.'
        ],
        tool: 'Add offset or 3-lobe error and watch the midpoints.'
    },

    symmetry: {
        title: 'Symmetry (legacy)',
        terms: [
            ['Centre plane', 'The plane halfway between two opposite faces.'],
            ['Opposed points', 'Pairs of points straight across a slot or tab.'],
            ['Legacy', 'Removed from ASME Y14.5 in 2018; still found on older drawings.']
        ],
        simple: [
            'Symmetry checks that a **slot or tab is centred** on a datum centre plane.',
            'The **midpoints** between its two walls must lie within **two planes** around the datum plane, the tolerance apart.',
            'It was **removed from the standard in 2018**.',
            'Today, **position** of the slot or tab does the same job and is easier to inspect.'
        ],
        example: [
            'A keyway has symmetry 0.020" to datum A.',
            'The left wall is 0.130" from the datum plane and the right wall 0.120".',
            'The midpoint is 0.005" off centre, which needs a zone 0.010" wide, so it passes.'
        ],
        tool: 'Drag the slot left and right.'
    },

    circular_runout: {
        title: 'Circular runout',
        terms: [
            ['FIM', 'Full indicator movement: the highest minus the lowest dial reading.'],
            ['Datum axis', 'The axis the part spins about (e.g. set by V-blocks or centres).'],
            ['Circular element', 'One ring (slice) of the surface.']
        ],
        simple: [
            'Circular runout checks how much a round surface **wobbles** when the part **spins on its datum axis**.',
            'A dial indicator touches **one slice** at a time; the needle\'s **total movement** in one turn must not exceed the tolerance.',
            'It catches both **out-of-round** and **off-centre** errors in that slice.',
            'Each slice is checked separately, so it does **not catch taper** along the length.'
        ],
        example: [
            'A pulley seat has circular runout 0.010" to datum A.',
            'The part spins in V-blocks; at one slice the dial moves from −0.003" to +0.004".',
            'FIM = 0.007", so that slice passes; check several slices, and each must pass.'
        ],
        tool: 'Add eccentricity or ovality and watch the dial and the chart.'
    },

    total_runout: {
        title: 'Total runout',
        terms: [
            ['FIM', 'Full indicator movement: the highest minus the lowest dial reading.'],
            ['A-B', 'A datum axis made by two features together, e.g. two bearing seats.'],
            ['Taper', 'The diameter changes along the length.']
        ],
        simple: [
            'Total runout checks the **whole surface** while the part spins on its datum axis.',
            'The dial indicator **slides along the full length** while the part turns; its **total movement over everything** must stay within the tolerance.',
            'It catches **wobble, out-of-round, taper and bend** together.',
            'That makes it **stricter** than circular runout.'
        ],
        example: [
            'A shaft has total runout 0.012" to A-B.',
            'Each slice alone moves the dial only 0.005", but one end is bigger than the other and the shaft is slightly bent.',
            'Over the full sweep the dial goes from −0.004" to +0.010" = 0.014", so it fails; circular runout alone would have passed.'
        ],
        tool: 'Add taper or bend and watch the scan.'
    },

    drf: {
        title: 'Datum reference frame',
        terms: [
            ['Datum', 'A perfect reference (plane or axis) that measurements start from.'],
            ['Datum feature', 'The real surface on the part that creates the datum.'],
            ['Degrees of freedom', 'The 6 ways a part can move: slide along X, Y, Z and turn about X, Y, Z.'],
            ['3-2-1', 'At least 3 points of contact on the first datum, 2 on the second, 1 on the third.']
        ],
        simple: [
            'Datums tell everyone **how to hold the part** before measuring it.',
            'The part sits on the **primary datum** first (3 points), is pushed against the **secondary** (2 points), then the **tertiary** (1 point).',
            'Together they lock all **6 degrees of freedom**, so every measurement starts from the **same setup**.',
            'The **order in the frame** (A|B|C) is the order of contact.',
            'On a real, imperfect part, **changing the order changes the setup** and the results.'
        ],
        example: [
            'A bracket has position to A|B|C.',
            'Inspection puts face A on the granite plate, slides face B against an angle plate, then pushes face C against a stop.',
            'If someone uses B first instead, an out-of-square part sits differently and may pass or fail wrongly.',
            'Always set up in the frame\'s order.'
        ],
        tool: 'Step through the datums, then switch the order and the out-of-square part to see the difference.'
    },

    symbol_finder: {
        title: 'Symbol Finder',
        terms: [
            ['ASME Y14.5', 'The US standard for GD&T.'],
            ['ISO', 'The international standards, common in Europe and Asia.'],
            ['Feature control frame', 'The box on a drawing that holds a GD&T requirement.']
        ],
        simple: [
            'The Symbol Finder is a **picture dictionary** of drawing symbols.',
            '**Find the shape** you see on the drawing, by family or by searching a word, and click it.',
            'You get its **name**, what it **means** in plain words, and the **common mistake** people make with it.',
            'Buttons then open the tool that **decodes it in full**.',
            'Check the title block first: a few symbols mean different things in **ASME and ISO**.'
        ],
        example: [
            'You see a circle with a slash, then a number, then an M inside a circle.',
            'Search "diameter" and "MMC": the first means a round zone, the second means the tolerance grows as the hole gets bigger.',
            'Then open the Position tool to see it working with your numbers.'
        ],
        tool: 'Browse a family on the left, or search by name.'
    },

    composite_frames: {
        title: 'Feature control frames',
        terms: [
            ['Feature control frame', 'The box with the symbol, the tolerance and the datums.'],
            ['Composite frame', 'Two rows sharing one symbol: the top row locates the pattern, the bottom row controls the holes relative to each other.'],
            ['Datum shift', 'Extra movement allowed when a datum hole is bigger than its smallest size (Ⓜ after a datum letter).']
        ],
        simple: [
            'This decoder lets you **rebuild any frame** from a drawing and read it in plain words.',
            'A frame is read **left to right**: the **symbol**, the **tolerance** with its modifiers, then the **datums** in order.',
            'Two rows sharing one symbol is a **composite** frame: the top row places the whole pattern, the bottom row only controls the holes **to each other**.',
            'Two separate frames stacked are **independent** requirements.',
            'Warnings appear for the common misreadings.'
        ],
        example: [
            'A composite frame reads: position Ø0.5 Ⓜ to A, B, C on the top row and Ø0.1 Ⓜ to A on the bottom row.',
            'The hole pattern may sit anywhere within Ø0.5 of its perfect place.',
            'But the holes must be within Ø0.1 of their correct spacing and square to A.',
            'So the pattern may shift a little as a group, while the holes stay well spaced.'
        ],
        tool: 'Rebuild the frame from your drawing and read the sentence and warnings.'
    },

    frame_checker: {
        title: 'Frame Legality Checker',
        terms: [
            ['Illegal frame', 'A frame that breaks a rule of the standard, so its meaning is not clear.'],
            ['Feature of size', 'A hole, pin, slot or tab: something with a size you can measure.'],
            ['MMB', 'Ⓜ after a datum letter: that datum is held by a fixed-size gauge, so the part may shift a little.']
        ],
        simple: [
            'The checker tells you if a frame **follows the rules** of ASME Y14.5-2018.',
            'Rebuild the frame, and each finding is marked **Illegal** (not valid), **Check** (legal, but often a mistake) or **Note** (what it means for you).',
            'It catches things like **datums on form controls**, **Ⓜ on a flat surface** and a **missing Ø** on holes.',
            'Use it before you **question a supplier\'s drawing**, or before sending your own.'
        ],
        example: [
            'A drawing shows flatness 0.05 with datum A.',
            'The checker marks it Illegal: flatness never uses a datum.',
            'The designer probably meant parallelism 0.05 to A, so ask them before inspecting.'
        ],
        tool: 'Try the examples first, then rebuild frames from your own drawings.'
    },

    hole_callouts: {
        title: 'Holes, threads and patterns',
        terms: [
            ['Counterbore', 'A flat-bottomed, larger hole at the top, for a bolt head.'],
            ['Countersink', 'A cone at the top of a hole, for a flat-head screw.'],
            ['Spotface', 'A very shallow counterbore, just to give a flat seat.'],
            ['nX', 'Number of identical holes, e.g. 4X = four holes.']
        ],
        simple: [
            'This decoder reads **hole callouts**: the note next to a hole with Ø, depth and symbols.',
            'Read it **top to bottom**: the count (**4X**), the hole size, the depth or **THRU**, then counterbore, countersink or spotface.',
            'The **4X applies to every line** of the note.',
            'For threads it decodes notes like **M8×1.25-6H** or **3/8-16 UNC-2B** field by field.',
            'The preview shows the hole cut in half so you can see its shape.'
        ],
        example: [
            'A note says 4X Ø9 THRU, then a counterbore symbol Ø15, depth 9.',
            'It means four holes of 9 mm through the part, each with a counterbore 15 mm wide and 9 mm deep.',
            'That fits an M8 socket-head screw with its head just below the surface.'
        ],
        tool: 'Rebuild the note from your drawing; the preview and sentence update as you go.'
    },

    welding: {
        title: 'Welding symbols',
        terms: [
            ['Reference line', 'The horizontal line that the weld symbol sits on.'],
            ['Arrow side / other side', 'The side of the joint the arrow touches, and the far side.'],
            ['Fillet weld', 'A triangle-shaped weld in a corner.'],
            ['CJP', 'Complete joint penetration: the weld goes all the way through the joint.']
        ],
        simple: [
            'This decoder reads **welding symbols** (AWS A2.4, with an ISO option).',
            'A symbol **below the reference line** means weld on the **arrow side**; **above** means the **other side**.',
            'The number on the left is the **weld size**; numbers on the right give the **length and spacing**.',
            'Extra marks add meaning: a **circle** means weld all around, a **flag** means weld on site.',
            'The preview shows the actual weld on the joint.'
        ],
        example: [
            'A triangle below the line, with 6 on its left and 50-150 on its right.',
            'It means 6 mm fillet welds on the arrow side, in 50 mm segments spaced 150 mm centre to centre.',
            'So there are 100 mm gaps between the welds.'
        ],
        tool: 'Rebuild the symbol from your drawing; switch between AWS and ISO.'
    },

    surface_finish: {
        title: 'Surface finish',
        terms: [
            ['Ra', 'Average roughness height, in µm (or µin on older US drawings).'],
            ['Rz', 'Average peak-to-valley height; usually about 4 to 7 times Ra.'],
            ['Lay', 'The direction of the machining marks.'],
            ['Cut-off (λc)', 'The measuring length the roughness instrument uses.']
        ],
        simple: [
            'This decoder reads **surface finish symbols**: the check-mark shape sitting on a surface.',
            'A **bar** across it means machining is required; a **circle** in it means do not machine.',
            'The number is a **maximum roughness**, most often **Ra** in µm (on older US drawings, µin).',
            'By default **up to 16% of readings may be over** the value; "max" means none may.',
            'Other positions give the **process, lay direction and machining allowance**.'
        ],
        example: [
            'A check mark with a bar and "Ra 1.6" means: machine this surface to an average roughness of 1.6 µm or better.',
            'That is a typical good turned or milled finish.',
            'On an older US drawing, "63" means 63 µin, which is about the same (1.6 µm).'
        ],
        tool: 'Rebuild the symbol; the profile on the right shows what Ra or Rz actually measures.'
    },

    cmm_position: {
        title: 'CMM Position Calculator',
        terms: [
            ['CMM', 'Coordinate measuring machine: it measures the X, Y, Z of points on the part.'],
            ['Basic X / Y', 'The perfect location of the hole, from the drawing.'],
            ['Offset', 'The straight-line distance from the perfect centre to the measured centre.']
        ],
        simple: [
            'This calculator checks **hole positions from a CMM report**.',
            'Type or **paste** each hole\'s basic X and Y, its measured X and Y, and its **measured size**.',
            'It works out **position** (2 × the offset), the **bonus** from each hole\'s size, and **pass or fail** for each hole.',
            'Every hole must pass on its own, because the zones are **tied to the datums**.',
            '**Copy the results** as a table for your report.'
        ],
        example: [
            'Hole H3 should be at X 3.000, Y 3.000 and measures X 3.019, Y 3.012, Ø0.504.',
            'Offset = √(0.019² + 0.012²) = 0.0225, so position = Ø0.045.',
            'Allowed = 0.030 + 0.004 bonus = 0.034, so it fails.',
            'Before rejecting, check that the report printed the diameter, not the radius.'
        ],
        tool: 'Paste from Excel or a CMM report. Your data stays in this browser.'
    },

    stackup: {
        title: 'Tolerance stack-up',
        terms: [
            ['Stack-up', 'Adding up dimensions and tolerances around a chain of parts to predict a gap.'],
            ['Worst case', 'Every part at its worst limit at the same time.'],
            ['RSS', 'Root sum square: a statistical estimate, less pessimistic than worst case.']
        ],
        simple: [
            'A stack-up answers one question: **will the parts fit every time**?',
            'Walk from one side of the gap through each part to the other side, adding (**+**) or subtracting (**−**) each dimension.',
            '**Worst case** adds all the tolerances: guaranteed, but pessimistic.',
            '**RSS** is realistic when the processes are **stable and centred**.',
            'The chart shows **which tolerance matters most**, so you know what to tighten.'
        ],
        example: [
            'Housing 20 ±0.1, spacer 8 ±0.05, bearing 10 +0/−0.12, cover lip 1.8 ±0.05: the nominal gap is 0.2 mm.',
            'Worst case, the gap can reach −0.05 mm, so the parts could clash.',
            'RSS predicts 0.115 to 0.405 mm, inside the requirement.',
            'Fine for production from good processes; risky for a one-off.'
        ],
        tool: 'Edit the loop in the sidebar, or load the example.'
    },

    fasteners: {
        title: 'Fastener formulas',
        terms: [
            ['Floating fastener', 'A bolt and nut: both parts have clearance holes.'],
            ['Fixed fastener', 'A screw in a tapped hole, or a pressed-in pin.'],
            ['H and F', 'H = the smallest clearance hole; F = the largest bolt.'],
            ['Projected zone Ⓟ', 'A tolerance zone that extends above the part, where the mating part sits.']
        ],
        simple: [
            'These formulas give the **position tolerance** that guarantees the bolts always go in.',
            '**Floating** (bolt and nut): each part gets T = **H − F**.',
            '**Fixed** (tapped hole): T₁ + T₂ = **H − F**, so each part gets **about half**.',
            'Always use the **smallest hole** and the **largest bolt**, not the nominal sizes.',
            'Tapped holes also need a **projected zone**, so a tilted thread cannot push the bolt into the other part.'
        ],
        example: [
            'An M8 bolt (F = 8.0 mm) goes through Ø9.0 holes (H).',
            'Floating: each part may have position Ø1.0 at MMC.',
            'If one part is tapped instead: only about Ø0.5 each (0.5 + 0.5 = 1.0).'
        ],
        tool: 'Pick a screw and the joint type; red in the section shows where the parts would clash.'
    },

    rule1: {
        title: 'Rule #1 (the envelope rule)',
        terms: [
            ['Envelope', 'A perfect shape at the MMC size: a perfect ring for a pin, a perfect pin for a hole.'],
            ['Two-point size', 'The size a caliper or micrometer measures between two points. It cannot see a bend.'],
            ['Independency (Ⓘ)', 'Size and shape are checked separately. The default on ISO drawings.']
        ],
        simple: [
            'Under ASME, a pin or hole must have **perfect form at MMC**: this is **Rule #1**.',
            'So a pin made at its **largest size must be perfectly straight**; as it gets smaller, it may **bend by the difference**.',
            'A **caliper cannot see a bend**, so a bent pin can measure fine at every point and still not fit a **ring gauge at MMC**.',
            'The check is: **size + bend ≤ MMC** for a pin, **size − bend ≥ MMC** for a hole.',
            '**ISO drawings do not use Rule #1** (independency); they need **Ⓔ** after the size to ask for it.'
        ],
        example: [
            'A pin is Ø10 ±0.1, so its MMC is Ø10.1.',
            'It is made at Ø10.1 with a 0.05 bend: every caliper reading is 10.1, which is in tolerance.',
            'But 10.1 + 0.05 = 10.15 will not go into the Ø10.1 ring gauge, so it fails.',
            'The same bend on a pin made at Ø9.9 is fine: 9.9 + 0.05 = 9.95.'
        ],
        tool: 'Move the size and bend sliders, switch pin or hole, or turn Rule #1 off (independency) to compare.'
    },

    virtual_condition: {
        title: 'Virtual & resultant condition',
        terms: [
            ['Virtual condition (VC)', 'The worst-case boundary from the size at MMC plus the geometric tolerance. For a hole: MMC − tolerance. For a pin: MMC + tolerance.'],
            ['Resultant condition (RC)', 'The other extreme: the feature at LMC with all its bonus used.'],
            ['Boundary', 'A perfect circle (or cylinder) the feature never crosses, whatever its size and position.']
        ],
        simple: [
            'A hole can be small **and** off position at the same time, so it leaves **less space than its size says**.',
            'The **smallest space a hole ever leaves** is its **virtual condition**: MMC − position tolerance (at Ⓜ).',
            'The **most space a pin ever takes** is its virtual condition: MMC + position tolerance.',
            'If the **pin\'s boundary is not bigger than the hole\'s**, the parts **always assemble**.',
            'The **resultant condition** is the other extreme; use it for the **thinnest wall**.'
        ],
        example: [
            'Hole Ø10 +0.1/0 with position Ø0.2 Ⓜ: it never leaves less than 10.0 − 0.2 = Ø9.8.',
            'Pin Ø9.6 +0/−0.1 with position Ø0.1 Ⓜ: it never takes more than 9.6 + 0.1 = Ø9.7.',
            '9.8 − 9.7 = 0.1, so the parts always go together.',
            'A fixed gauge pin of Ø9.8 checks the hole.'
        ],
        tool: 'Enter the hole and the pin, pick Ⓜ, RFS or Ⓛ, and see both boundaries and the worst-case gap.'
    },

    datum_shift: {
        title: 'Datum shift (MMB)',
        terms: [
            ['MMB', 'Maximum material boundary: the fixed size of the gauge pin (or hole) that holds a datum feature referenced with Ⓜ.'],
            ['Datum shift', 'The part sliding on that gauge pin because the datum hole is bigger than the pin.'],
            ['RMB', 'No modifier on the datum: the part is held on the datum feature\'s own axis, with no play.']
        ],
        simple: [
            'When a frame says **B Ⓜ**, datum hole B is held on a **gauge pin at its MMB size**.',
            'If B is made **bigger**, the part can **slide on the pin**: half the difference in any direction.',
            'The **whole pattern of zones moves together** with the pin, like one gauge.',
            'So it rescues holes that are **all off the same way**, but **not holes off in opposite directions**.',
            'Many **CMM reports ignore datum shift**, so a part a gauge accepts may be rejected on paper.'
        ],
        example: [
            'Four holes are all about 0.12 off to the right; allowed position Ø0.2, so each measures about Ø0.24 and fails.',
            'Datum hole B is Ø10.08 on a Ø10.00 pin: the part may slide 0.04.',
            'Sliding it right cuts every hole to about Ø0.16: the part passes.'
        ],
        tool: 'Change B\'s size, switch B Ⓜ and B (RMB), edit the hole offsets, or try the presets.'
    },

    process_capability: {
        title: 'Process capability guide',
        terms: [
            ['Process capability', 'How tight a tolerance a process can hold, part after part.'],
            ['Routine', 'A normal shop holds it every day, at normal cost.'],
            ['With care', 'Possible, but needs a good machine, a stable setup and checking: more scrap and cost.'],
            ['Ra', 'Average surface roughness, in µm.']
        ],
        simple: [
            'Every process has a **range of tolerances it can hold**: sand casting ±1 mm or so, grinding a few microns.',
            'Enter the tolerance from the drawing and the chart shows which processes hold it **routinely**, **with care**, or **not at all**.',
            'Add a **surface finish** if the drawing asks for one, because some processes cannot reach it.',
            'Tighter tolerances **cost more**, and the cost climbs steeply below about ±0.025 mm.',
            'Use it to **question tight tolerances** before they reach the shop.'
        ],
        example: [
            'A bore is Ø20 +0.021/0, so about ±0.01 mm.',
            'The chart shows grinding, wire EDM and honing hold it routinely, while reaming, boring, turning and milling need care.',
            'So the shop will drill, then ream or bore carefully (or grind), and the cost is about 9× a loose tolerance.'
        ],
        tool: 'Type a tolerance (± each side) in mm or inch, optionally a finish, and read which processes fit.'
    },

    cpk: {
        title: 'Cp / Cpk',
        terms: [
            ['Standard deviation (σ)', 'How spread out the measurements are. About 99.7% of parts fall within ±3σ of the average.'],
            ['Cp', 'Could the spread fit inside the limits if it were perfectly centred? Tolerance ÷ 6σ.'],
            ['Cpk', 'Does it fit where it actually is? The distance from the average to the nearest limit ÷ 3σ.'],
            ['ppm', 'Parts per million out of spec.']
        ],
        simple: [
            '**Cp** compares the **width of the tolerance** with the **width of the process spread**.',
            '**Cpk** also looks at **where** the process sits: if it drifts towards one limit, Cpk drops.',
            'A Cpk of **1.33** is the usual target; **1.67** for critical parts; below **1.0** some parts will be out of spec.',
            'If **Cp is fine but Cpk is low**, just **re-centre** the process; if **both are low**, the spread itself must shrink.',
            'For **position, flatness or runout**, use **upper limit only**.'
        ],
        example: [
            'A Ø10.00 ±0.05 bore: 40 parts average 10.018 with σ = 0.012.',
            'Cp = 0.10 ÷ (6 × 0.012) = 1.39: the spread would fit.',
            'Cpk = (10.05 − 10.018) ÷ (3 × 0.012) = 0.89: it runs too close to the upper limit.',
            'Moving the tool offset by −0.018 brings Cpk up to about 1.39.'
        ],
        tool: 'Paste measurements (a column from Excel works), set the limits and the target, and read the advice.'
    },

    plus_minus: {
        title: '± to position',
        terms: [
            ['± (coordinate) tolerance', 'Separate limits in X and Y: the allowed area is a square or rectangle.'],
            ['Position tolerance', 'One round zone around the true position, given as a diameter.'],
            ['Equivalent position', 'The circle through the corners of the ± square: Ø = 2 × √(X² + Y²).']
        ],
        simple: [
            'With **±X and ±Y**, the hole centre must stay in a **square**.',
            'But its **corners** are already allowed, so the real distance you accept is the **diagonal**.',
            'A **round position zone** through those corners allows the **same worst case** and gives about **57% more area**.',
            'Parts just outside the **flat sides of the square** are **good** but rejected by ±.',
            'Converting position **back** to ± gives the **square inside the circle**, which throws away half the zone.'
        ],
        example: [
            'A hole is located ±0.1 in X and ±0.1 in Y.',
            'The equivalent position is Ø = 2 × √(0.1² + 0.1²) = Ø0.283.',
            'A hole off by 0.13 in X only fails ± (0.13 > 0.1), but its position is Ø0.26, inside Ø0.283.',
            'It is a good part, and position would accept it.'
        ],
        tool: 'Set ±X and ±Y, then drag the hole centre (or use the presets) and compare the two checks.'
    },

    datum_targets: {
        title: 'Datum targets',
        terms: [
            ['Datum target', 'A named spot (point, line or small area) where the part is touched to set a datum.'],
            ['Target symbol', 'A circle split in two: target size on top (for areas), datum letter and number below (A1).'],
            ['Basic dimension', 'A boxed, exact dimension. Here it places each target.'],
            ['Fixture', 'The holder with pads and pins at the target spots.']
        ],
        simple: [
            'A **rough surface** (casting, forging, sheet metal) is **never flat**, so resting it on the whole face would rock.',
            '**Datum targets** name the **exact spots** to touch instead: **X** for a point, a **phantom line** for a line, a **hatched patch** for an area.',
            'Usually **3 targets** set the primary datum, **2** the secondary and **1** the tertiary (**3-2-1**).',
            '**Boxed dimensions** place each target, and the **fixture** has a pad or pin at each one.',
            'Machining and inspection must use the **same targets**, or their results will not agree.'
        ],
        example: [
            'A cast bracket shows A1, A2, A3 on its bottom face and B1, B2 on one edge, C1 on the end.',
            'The inspection fixture has three rest pads, two edge pins and one end pin at those basic positions.',
            'The part is set on the pads, pushed against B1 and B2, then against C1: every casting now sits the same way.'
        ],
        tool: 'Switch between the drawing and the fixture, pick points, lines or areas, and click a target to see its basic dimensions.'
    },

    notebook: {
        title: 'My Notebook',
        terms: [
            ['Company cheat sheet', 'A ready-made note listing what a company or customer always uses: standard, units, projection, default tolerances, edge breaks, who to ask.'],
            ['Decoded callout', 'A note of a callout you worked out, with the drawing number, so you never decode it twice.'],
            ['Backup file', 'A file with all your notes, to keep safe or move to another computer.']
        ],
        simple: [
            'The notebook is **your own record**: what each **company or customer** does, **callouts you decoded**, and **lessons learned**.',
            'Add a note **from any tool** with **+ Note** in the bar at the top; it is **linked back** to that tool.',
            'Notes have **tags** and an optional **drawing number**, and **global search finds them** next to the tool\'s own answers.',
            'They are saved **in this browser only**, so **export a backup** now and then.'
        ],
        example: [
            'You join a new company and fill in a cheat sheet: ASME Y14.5-2009, inches, third angle, X.XX ±.01, X.XXX ±.005, break edges .010 max.',
            'A month later you decode a tricky composite frame on drawing 55-102 and save it as a decoded callout with the tag "composite".',
            'Next time you meet it, pressing / and typing 55-102 brings your note straight up.'
        ],
        tool: 'Press New note or Company cheat sheet; search, filter by type or tag, pin the important ones, and export a backup.'
    },

    y14_changes: {
        title: 'Y14.5-2009 vs 2018',
        terms: [
            ['Edition', 'The year of the standard the drawing follows, written in the title block or notes.'],
            ['Concentricity / symmetry', 'Controls on the centre points of a round feature or a slot. Removed in 2018.'],
            ['Ⓘ', 'Independency: switches off Rule #1 for that size (new symbol in 2018).'],
            ['Dynamic profile', 'A triangle in a profile frame: controls the shape of a surface, not its size or location (new in 2018).']
        ],
        simple: [
            'A drawing is **always read by the edition it names**, even if a newer one exists.',
            'The **2018** edition **removed concentricity and symmetry**; newer drawings use **position, runout or profile** instead.',
            'On a **2009 drawing**, those two symbols are **still valid** and must be **inspected as written**.',
            '2018 **added a few symbols**: **Ⓘ**, the **all-over** double circle, and **dynamic profile**.',
            '**Everything else**, including Rule #1, bonus, datums and frames, **reads the same**.'
        ],
        example: [
            'A 2009 drawing shows ◎ Ø0.05 A on a shaft.',
            'The inspector must check the centre points of the shaft sections against datum axis A, not just its runout.',
            'If the customer wants runout instead (easier to check), that is a drawing change: a new revision, approved by them.'
        ],
        tool: 'Start with the clues at the top, then read or search the cards.'
    },

    practice: {
        title: 'Learning path & quizzes',
        terms: [
            ['Lesson', 'A short topic with the tools to study and five questions.'],
            ['Pass mark', '4 of 5 right completes a lesson.'],
            ['Progress', 'Your answers, saved in this browser so you can continue later.']
        ],
        simple: [
            'The path has **six lessons in order**: the sheet, symbols and frames, size and bonus, datums, fits, and ASME vs ISO.',
            'For each lesson, **look at the tools listed first**, then **take the quiz**.',
            'Every question comes from a **real callout**, and after answering you see **why**, with a link to the tool that teaches it.',
            'Get **4 of 5** to complete a lesson; retry as often as you like.'
        ],
        example: [
            'Lesson 3 asks: a hole Ø10 +0.1/0 with position Ø0.2 Ⓜ measures Ø10.06; how much position is allowed?',
            'You pick Ø0.20 and see: not quite, it earns 0.06 bonus, so Ø0.26.',
            'One click on "Bonus Tolerance" shows you the same case on the zone diagram.'
        ],
        tool: 'Pick a lesson, study its tools, then press "Take the quiz". Keys 1 to 4 answer, Enter goes on.'
    },

    asme_iso: {
        title: 'ASME vs ISO GPS',
        terms: [
            ['ASME Y14.5', 'The US rulebook for dimensions and GD&T.'],
            ['ISO GPS', 'The international rulebook (Geometrical Product Specifications), spread over many ISO standards.'],
            ['Independency', 'Size and form are checked separately. The ISO default (ISO 8015).'],
            ['Ⓔ', 'Envelope requirement: on an ISO drawing, asks for perfect form at MMC, like ASME Rule #1.']
        ],
        simple: [
            'Most symbols **look the same** in ASME and ISO, but a **few rules are different**.',
            'First find **which rulebook** the drawing names: "ASME Y14.5" or "ISO 8015 / ISO GPS".',
            'The biggest difference: **ISO has no Rule #1**, so a size tolerance **does not limit bending or out-of-round**.',
            'ISO also keeps **concentricity and symmetry**, uses **CZ / SIM** instead of composite frames, and puts **general tolerances** in an ISO 2768 note.',
            'Some things are just **different names**: a basic dimension is a **TED** in ISO.'
        ],
        example: [
            'A German drawing says "ISO 8015" and "Ø20 ±0.05" on a pin, with no form tolerance.',
            'Every caliper reading is 19.98, but the pin is bowed 0.08.',
            'Under ISO it meets the size requirement, because size does not control form.',
            'Under ASME Rule #1 it would fail: 19.98 + 0.08 = 20.06, bigger than the Ø20.05 MMC.'
        ],
        tool: 'Start with the clue list at the top, then search or filter the side-by-side cards.'
    },

    fits: {
        title: 'ISO fits (H7/g6)',
        terms: [
            ['Fit', 'How a shaft sits in a hole: loose, snug or pressed.'],
            ['Tolerance class', 'A letter and a number, like H7. The letter sets where the zone sits; the number sets how wide it is.'],
            ['IT grade', 'The number in the class. Lower = tighter. IT7 at 20 mm is 21 µm wide.'],
            ['Hole basis', 'The hole is H (its smallest size is exactly the nominal), and the shaft letter picks the fit.']
        ],
        simple: [
            'A code like **Ø20 H7/g6** gives the hole and the shaft each a **tolerance zone** from a standard table (ISO 286).',
            '**Capital letters are holes, small letters are shafts.**',
            'The **letter** says where the zone sits compared to the nominal size; the **number** says how wide it is.',
            'Compare the **biggest shaft with the smallest hole** (tightest case) and the **smallest shaft with the biggest hole** (loosest case).',
            'Always a gap is a **clearance fit**, always a press is an **interference fit**, and either is a **transition fit**.'
        ],
        example: [
            'Ø20 H7/g6: the hole is 20.000 to 20.021 and the shaft 19.980 to 19.993.',
            'Tightest: 20.000 − 19.993 = 0.007 mm gap. Loosest: 20.021 − 19.980 = 0.041 mm gap.',
            'Always a gap, so it is a clearance fit: the shaft slides in and turns freely but is located accurately.'
        ],
        tool: 'Enter the size and pick the hole and shaft classes, type a callout like "25 H7/p6", or pick a preferred fit.'
    },

    read_checklist: {
        title: 'How to read a drawing',
        terms: [
            ['Title block', 'The box in the bottom-right corner with the part number, revision, material and default tolerances.'],
            ['Revision (REV)', 'The version of the drawing: A, B, C... Each change raises the letter.'],
            ['Notes', 'Rules written as text that apply to the whole part.'],
            ['Datum', 'A face or feature the part is held and measured from, shown as a letter in a box.']
        ],
        simple: [
            'Read a drawing in **the same order every time**, so nothing is missed.',
            'Start with the **title block**: part number, **revision**, units, standard and view layout.',
            'Then look at the **views** until you can picture the part in 3D.',
            'Then read the **default tolerances** and **every note**, because they apply everywhere.',
            'Only then read the **datums**, the dimensions and the GD&T frames.',
            'Last, check the **revision block** to see what changed recently.'
        ],
        example: [
            'You get a drawing for part 10-4217 and your work order says REV B.',
            'Step 1 already stops you: the drawing is REV C.',
            'The revision block says the holes changed from Ø9 to Ø10.',
            'Making REV B parts would have scrapped the whole batch.',
            'You ask for the right work order before cutting any metal.'
        ],
        tool: 'Press Next to walk through the sample drawing; the lit-up area is where to look.'
    },

    title_block: {
        title: 'Title block',
        terms: [
            ['Title block', 'The box in the bottom-right corner of a drawing, with its key facts.'],
            ['Revision', 'The version letter of the drawing.'],
            ['Temper', 'The heat-treat state of a metal, like T6 in 6061-T6.'],
            ['"Unless otherwise specified"', 'The default rule, used when nothing else is written.']
        ],
        simple: [
            'The **title block** is the ID card of the drawing.',
            'It says **what the part is** (number, name, revision), **what it is made of** (material, finish) and **how to read it** (units, standard, projection).',
            'It also gives the **default tolerance** for dimensions that have none written.',
            'Check the **part number** and **revision** first, every time.',
            'Layouts differ between companies, but the fields are almost always the same.'
        ],
        example: [
            'The title block says material AL 6061-T6 and finish CLEAR ANODIZE.',
            'The supplier sends 6061-T4 bar: the temper is wrong, so it is rejected.',
            'The default tolerance line "X.X ±0.2" means a dimension of 40.0 may be 39.8 to 40.2.'
        ],
        tool: 'Click any box of the title block to see what it means, what to check and what to watch out for.'
    },

    projection: {
        title: 'First angle vs third angle',
        terms: [
            ['Projection', 'How the views of a part are placed on the sheet around the front view.'],
            ['Third angle', 'Each view sits on the same side you look from. Used in the US and Canada.'],
            ['First angle', 'Each view sits on the opposite side. Used in Europe and much of Asia.']
        ],
        simple: [
            'A drawing shows a part from several directions, called **views**.',
            'In **third angle**, the top view is **above** the front view and the right view is **to the right**.',
            'In **first angle**, it is the other way: the top view is **below** and the right view is **to the left**.',
            'The **cone symbol** in the title block tells you which: **circles on the left means third angle**.',
            'Mixing them up gives a **mirror-image** part.'
        ],
        example: [
            'A German supplier sends a drawing with the cone on the left and circles on the right: first angle.',
            'The view to the left of the front view is therefore the view from the right side.',
            'A slot you see in it is on the right end of the part, not the left.'
        ],
        tool: 'Switch between third and first angle and watch the views jump sides.'
    },

    lines_views: {
        title: 'Lines & views',
        terms: [
            ['Hidden line', 'A dashed line: an edge behind material.'],
            ['Center line', 'A long-short dash line through the middle of a hole or round shape.'],
            ['Section view', 'A view of the part cut open, with hatching on the cut material.'],
            ['Detail view', 'A small area drawn again larger.']
        ],
        simple: [
            'Every line has a meaning, shown by its **thickness** and **dash pattern**.',
            '**Thick solid** lines are edges you can see; **dashed** lines are edges hidden behind material.',
            '**Center lines** mark the middle of holes and round parts.',
            'A **section view** shows the part cut open; the **hatching** marks solid material.',
            'Always find a feature in **every view**: the views line up with each other.'
        ],
        example: [
            'A block shows a circle in the front view.',
            'In the top view, two dashed lines line up with the circle and run the full depth.',
            'So it is a hole that goes all the way through.'
        ],
        tool: 'Search or filter the list; each card shows what the line or view looks like.'
    },

    general_tolerances: {
        title: 'General tolerances',
        terms: [
            ['General tolerance', 'The tolerance a dimension gets when none is written next to it.'],
            ['Decimal places', 'The number of digits after the point: 25.0 has one, 25.00 has two.'],
            ['ISO 2768', 'A standard table of general tolerances, picked with a class letter: f, m, c or v.']
        ],
        simple: [
            'Every dimension has a tolerance, even if **none is written** next to it.',
            'Most US drawings take it from the **title block**, by the number of **decimal places**.',
            'Many European drawings say **ISO 2768-m** instead: the tolerance then depends on the **size** and the **class**.',
            'A tolerance written on the dimension **always wins**.',
            '**Boxed (basic) dimensions** never use the general tolerance.'
        ],
        example: [
            'The title block says "X.X ±0.2" and a length is written 40.0.',
            'The part is good from 39.8 to 40.2.',
            'On an ISO 2768-m drawing, the same 40 mm length is ±0.3, so 39.7 to 40.3.'
        ],
        tool: 'Choose title block or ISO 2768, type the dimension, and read the good range.'
    },

    drawing_notes: {
        title: 'Notes & abbreviations',
        terms: [
            ['UOS', 'Unless otherwise specified: the default, unless something else is written.'],
            ['TYP', 'Typical: applies to all the matching features.'],
            ['REF', 'Reference: for information only, not inspected.']
        ],
        simple: [
            'Drawings use **short words** to save space, like **TYP**, **REF** and **THRU**.',
            'The **notes** block lists rules for the **whole part**, like edge breaks, coatings and default finish.',
            'A note counts **as much as a dimension**.',
            'Read **all the notes before starting** work, not after.'
        ],
        example: [
            'Note 3 says "DIMENSIONS APPLY AFTER ANODIZE".',
            'A Ø10.00 +0.02 hole must be machined a little bigger, because anodize makes it smaller.',
            'Machining it to 10.01 before coating could make it undersize after.'
        ],
        tool: 'Search for any short word or note; filter by abbreviations or common notes.'
    }
};

import { GLOSSARY, linkify } from './glossary.js';

// Tools that share another tool's explanation
export const ALIASES = { bonus: 'position', precedence: 'drf' };

export function hasExplanation(symKey) {
    return !!EXPLAIN[ALIASES[symKey] ?? symKey];
}

// --- Rendering ---

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// \uFE0E asks for the plain text form of Ⓜ, which some systems draw as an emoji
const rich = s => esc(s).replace(/Ⓜ/g, 'Ⓜ\uFE0E').replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900">$1</strong>');

export function openExplain(symKey) {
    const e = EXPLAIN[ALIASES[symKey] ?? symKey];
    if (!e) return;
    closeExplain();

    const modal = document.createElement('div');
    modal.id = 'explain-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" role="dialog" aria-modal="true" aria-labelledby="explain-title">
        <div class="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Explain</div>
            <h2 id="explain-title" class="text-2xl font-extrabold text-slate-900">${esc(e.title)}</h2>
          </div>
          <button id="explain-close" class="text-slate-400 hover:text-slate-700 text-xl px-2" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-6 py-5 space-y-6 text-slate-700">
          <section>
            <h3 class="text-xs font-bold tracking-widest text-slate-500 uppercase mb-2">1. Key terms</h3>
            <table class="w-full text-sm border border-slate-200 rounded">
              <tbody>
                ${e.terms.map(([t, m], i) => `
                  <tr class="${i % 2 ? 'bg-slate-50' : ''}">
                    <td class="align-top font-semibold text-slate-900 px-3 py-2 w-40 border-r border-slate-200">${esc(t)}</td>
                    <td class="px-3 py-2">${rich(m)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </section>
          <section>
            <h3 class="text-xs font-bold tracking-widest text-slate-500 uppercase mb-2">2. In simple words</h3>
            <p class="leading-relaxed">${e.simple.map(rich).join(' ')}</p>
          </section>
          <section class="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h3 class="text-xs font-bold tracking-widest text-blue-700 uppercase mb-2">3. Example</h3>
            <p class="leading-relaxed text-slate-800">${e.example.map(rich).join(' ')}</p>
          </section>
          <p class="text-sm text-slate-500"><i class="fa-solid fa-hand-pointer mr-1"></i><span class="font-semibold">In this tool:</span> ${rich(e.tool)}</p>
        </div>
      </div>`;

    modal.addEventListener('click', ev => { if (ev.target === modal) closeExplain(); });
    document.body.appendChild(modal);

    // Underline glossary terms in the text, except those already defined in
    // the key terms table or named in the title
    const defined = [e.title, ...e.terms.map(t => t[0])].join(' ').toLowerCase();
    const skipTerms = GLOSSARY.filter(g => g.match.some(w => defined.includes(w.toLowerCase()))).map(g => g.term);
    modal.querySelectorAll('section p').forEach(p => linkify(p, { skipTerms }));
    modal.querySelector('#explain-close').onclick = closeExplain;
    modal.querySelector('#explain-close').focus();
}

export function closeExplain() {
    document.getElementById('explain-modal')?.remove();
}

document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeExplain(); });
