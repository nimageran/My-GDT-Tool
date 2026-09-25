// js/config.js
// ============================================================================
// Navigation: tabs (top bar) → tools (ribbon). Tabs follow the jobs a
// manufacturing engineer does with GD&T: understand a characteristic, work
// out material condition and datums, read a drawing, inspect, stack up, make.
//
// Tool entry fields:
//   name, iconChar ... ribbon label (Unicode is fine here, navigation only)
//   filePath ........ module to load (exports draw, loadControls, optional unload)
//   group ........... optional sub-heading within the ribbon
//   legacy .......... removed from the current standard, kept for old drawings
//   planned ......... on the roadmap: shown greyed with its `summary`, no file.
//                     To build one: write the module, add filePath, delete planned.
// ============================================================================

export const GDT_HIERARCHY = {
    // TAB 1: the 14 characteristics, each as an interactive tolerance zone
    CHARACTERISTICS: {
        label: "Characteristics",
        icon: "fa-shapes",
        symbols: {
            straightness: { group: "Form", name: "Straightness", iconChar: "—", filePath: './modules/form/straightness.js' },
            flatness: { group: "Form", name: "Flatness", iconChar: "⏥", filePath: './modules/form/flatness.js' },
            circularity: { group: "Form", name: "Circularity", iconChar: "○", filePath: './modules/form/circularity.js' },
            cylindricity: { group: "Form", name: "Cylindricity", iconChar: "⌭", filePath: './modules/form/cylindricity.js' },

            line_profile: { group: "Profile", name: "Line Profile", iconChar: "⌒", filePath: './modules/profile/line_profile.js' },
            surface_profile: { group: "Profile", name: "Surface Profile", iconChar: "⌓", filePath: './modules/profile/surface_profile.js' },

            angularity: { group: "Orientation", name: "Angularity", iconChar: "∠", filePath: './modules/orientation/angularity.js' },
            perpendicularity: { group: "Orientation", name: "Perpendicularity", iconChar: "⊥", filePath: './modules/orientation/perpendicularity.js' },
            parallelism: { group: "Orientation", name: "Parallelism", iconChar: "∥", filePath: './modules/orientation/parallelism.js' },

            position: { group: "Location", name: "Position", iconChar: "⌖", filePath: './modules/location/position.js' },
            concentricity: { group: "Location", name: "Concentricity", iconChar: "◎", filePath: './modules/location/concentricity.js', legacy: true },
            symmetry: { group: "Location", name: "Symmetry", iconChar: "⌯", filePath: './modules/location/symmetry.js', legacy: true },

            circular_runout: { group: "Runout", name: "Circular Runout", iconChar: "↗", filePath: './modules/runout/circular_runout.js' },
            total_runout: { group: "Runout", name: "Total Runout", iconChar: "⌰", filePath: './modules/runout/total_runout.js' }
        }
    },

    // TAB 2: modifiers and the boundaries they create
    MATERIAL: {
        label: "Material Condition",
        icon: "fa-expand",
        symbols: {
            bonus: { name: "Bonus Tolerance (MMC / LMC)", iconChar: "Ⓜ", filePath: './modules/location/position.js' },
            virtual_condition: { name: "Virtual & Resultant Condition", iconChar: "◌", planned: true,
                summary: "The worst-case boundaries a mating part must clear. Compute virtual and resultant condition for holes and pins at MMC or LMC, and see which one matters for assembly and which for wall thickness." },
            rule1: { name: "Rule #1 Envelope", iconChar: "▭", planned: true,
                summary: "Perfect form at MMC: see why a bent pin fails a ring gauge even when every two-point size measurement is in tolerance, and when the independency symbol lifts the rule." },
            datum_shift: { name: "Datum Shift (MMB)", iconChar: "⇄", planned: true,
                summary: "The extra movement a pattern gets when a datum feature of size is referenced at MMB, and why a functional gauge allows it but a CMM report often ignores it." }
        }
    },

    // TAB 3: how parts are held and measured from
    DATUMS: {
        label: "Datums",
        icon: "fa-cube",
        symbols: {
            drf: { name: "Datum Reference Frame (3D)", iconChar: "⌗", filePath: './modules/datums/drf.js' },
            precedence: { name: "Datum Precedence (3D)", iconChar: "⇅", filePath: './modules/datums/drf.js' },
            datum_targets: { name: "Datum Targets", iconChar: "⊗", planned: true,
                summary: "Target points, lines and areas for castings, forgings and sheet metal, and how to build the fixture that simulates them." }
        }
    },

    // TAB 4: reading a drawing, from the basics of the sheet to hard callouts
    // (decoders follow decode/DECODER_SPEC.md)
    DECODE: {
        label: "Read Drawings",
        icon: "fa-magnifying-glass",
        symbols: {
            read_checklist: { group: "Drawing basics", name: "How to Read a Drawing", iconChar: "☰", filePath: './modules/drawing/read_checklist.js' },
            title_block: { group: "Drawing basics", name: "Title Block", iconChar: "▤", filePath: './modules/drawing/title_block.js' },
            projection: { group: "Drawing basics", name: "First vs Third Angle", iconChar: "◎", filePath: './modules/drawing/projection.js' },
            lines_views: { group: "Drawing basics", name: "Lines & Views", iconChar: "┅", filePath: './modules/drawing/lines_views.js' },
            general_tolerances: { group: "Drawing basics", name: "General Tolerances", iconChar: "±", filePath: './modules/drawing/general_tolerances.js' },
            drawing_notes: { group: "Drawing basics", name: "Notes & Abbreviations", iconChar: "✎", filePath: './modules/drawing/drawing_notes.js' },

            symbol_finder: { group: "Decode callouts", name: "Symbol Finder", iconChar: "⌕", filePath: './modules/decode/symbol_finder.js' },
            composite_frames: { group: "Decode callouts", name: "Feature Control Frames", iconChar: "▣", filePath: './modules/decode/composite_frames.js' },
            hole_callouts: { group: "Decode callouts", name: "Holes, Threads & Patterns", iconChar: "⌀", filePath: './modules/decode/hole_callouts.js' },
            welding: { group: "Decode callouts", name: "Welding Symbols", iconChar: "▷", filePath: './modules/decode/welding.js' },
            surface_finish: { group: "Decode callouts", name: "Surface Finish", iconChar: "√", filePath: './modules/decode/surface_finish.js' },
            frame_checker: { group: "Decode callouts", name: "Frame Legality Checker", iconChar: "✓", filePath: './modules/decode/frame_checker.js' }
        }
    },

    // TAB 5: what quality does with the drawing
    INSPECTION: {
        label: "Inspection",
        icon: "fa-microscope",
        symbols: {
            cmm_position: { name: "CMM Position Calculator", iconChar: "⌖", filePath: './modules/inspection/cmm_position.js' },
            methods: { name: "Measurement Methods", iconChar: "⏚", planned: true,
                summary: "How each characteristic is actually checked (surface plate and indicator, V-blocks, CMM, functional gauge) and where each method can mislead." },
            functional_gauge: { name: "Functional Gauge Designer", iconChar: "⊞", planned: true,
                summary: "Size gauge pins at virtual condition and lay out a go gauge for a hole pattern, including datum pins at MMB." }
        }
    },

    // TAB 6: assembly math
    STACKUPS: {
        label: "Stack-ups & Fits",
        icon: "fa-layer-group",
        symbols: {
            stackup: { name: "Tolerance Stack-up", iconChar: "≡", filePath: './modules/stackups/stackup.js' },
            fasteners: { name: "Fastener Formulas", iconChar: "⊕", filePath: './modules/stackups/fasteners.js' },
            fits: { name: "ISO Fits (H7/g6)", iconChar: "⌗", planned: true,
                summary: "ISO 286 fit decoder: nominal size + fit class → limit dimensions, clearance or interference range, and fit character, with a shaft-in-hole zone diagram." }
        }
    },

    // TAB 7: can the shop make it, and at what cost
    MANUFACTURING: {
        label: "Manufacturing",
        icon: "fa-industry",
        symbols: {
            process_capability: { name: "Process Capability Guide", iconChar: "⚙", planned: true,
                summary: "What turning, milling, grinding, reaming and EDM realistically hold, and how cost climbs as tolerances tighten." },
            cpk: { name: "Cp / Cpk Calculator", iconChar: "∿", planned: true,
                summary: "Paste measurements and see whether the process can hold the callout, with a histogram against the limits." },
            plus_minus: { name: "± to Position", iconChar: "⊡", planned: true,
                summary: "Convert coordinate ± tolerances to position and see why a round zone gives 57% more usable area than the square one." }
        }
    },

    // TAB 8: standards and practice
    LEARN: {
        label: "Learn",
        icon: "fa-graduation-cap",
        symbols: {
            glossary: { name: "Glossary", iconChar: "Aa", filePath: './modules/learn/glossary.js' },
            practice: { name: "Practice Scenarios", iconChar: "?", planned: true,
                summary: "Pass or fail, and why? Scenario quizzes built from real drawing callouts." },
            y14_changes: { name: "Y14.5-2009 vs 2018", iconChar: "Δ", planned: true,
                summary: "What changed between editions, including the removal of concentricity and symmetry and what to use instead." },
            asme_iso: { name: "ASME vs ISO GPS", iconChar: "≠", planned: true,
                summary: "The differences that matter when reading drawings from ISO-based suppliers: independency by default, datum systems, symbols." }
        }
    }
};
