// js/config.js
// ============================================================================
// Navigation: tabs (menu bar) → tools (drop-down menu). Tabs are in the
// order a drawing reader needs them: start page, read the drawing, then the
// GD&T concepts behind it, then fits, inspection and learning. The first tab
// opens on start.
//
// Tool entry fields:
//   name, iconChar ... menu label and icon (Unicode is fine here, navigation only)
//   filePath ........ module to load (exports draw, loadControls, optional unload)
//   group ........... optional column heading in the drop-down menu
//   desc ............ optional one-line description in the menu (otherwise the
//                     first sentence of the tool's Explain text, or its summary)
//   legacy .......... removed from the current standard, kept for old drawings
//   planned ......... on the roadmap: shown greyed with its `summary`, no file.
//                     To build one: write the module, add filePath, delete planned.
// ============================================================================


export const GDT_HIERARCHY = {
    // Start page: what do you need to do?
    HOME: {
        label: "Home",
        icon: "fa-house",
        symbols: {
            home: { name: "Start Here", iconChar: "⌂", filePath: './modules/home/home.js', desc: "What do you need to do? Start points and a map of every tool." }
        }
    },

    // reading a drawing, from the basics of the sheet to hard callouts
    // (decoders follow decode/DECODER_SPEC.md)
    DECODE: {
        label: "Read Drawings",
        icon: "fa-magnifying-glass",
        symbols: {
            read_checklist: { group: "Drawing basics", name: "How to Read a Drawing", iconChar: "☰", filePath: './modules/drawing/read_checklist.js', desc: "The order to read any drawing in, on a sample sheet." },
            title_block: { group: "Drawing basics", name: "Title Block", iconChar: "▤", filePath: './modules/drawing/title_block.js', desc: "What each box of the title block means and what to check." },
            projection: { group: "Drawing basics", name: "First vs Third Angle", iconChar: "◎", filePath: './modules/drawing/projection.js', desc: "Where the views go: third angle or first angle." },
            lines_views: { group: "Drawing basics", name: "Lines & Views", iconChar: "┅", filePath: './modules/drawing/lines_views.js' },
            general_tolerances: { group: "Drawing basics", name: "General Tolerances", iconChar: "±", filePath: './modules/drawing/general_tolerances.js' },
            drawing_notes: { group: "Drawing basics", name: "Notes & Abbreviations", iconChar: "✎", filePath: './modules/drawing/drawing_notes.js' },

            symbol_finder: { group: "Decode callouts", name: "Symbol Finder", iconChar: "⌕", filePath: './modules/decode/symbol_finder.js', desc: "A picture dictionary of drawing symbols." },
            composite_frames: { group: "Decode callouts", name: "Feature Control Frames", iconChar: "▣", filePath: './modules/decode/composite_frames.js', desc: "Rebuild any feature control frame and read it in plain words." },
            hole_callouts: { group: "Decode callouts", name: "Holes, Threads & Patterns", iconChar: "⌀", filePath: './modules/decode/hole_callouts.js', desc: "Hole and thread notes: Ø, depth, counterbore, M8 × 1.25." },
            welding: { group: "Decode callouts", name: "Welding Symbols", iconChar: "▷", filePath: './modules/decode/welding.js', desc: "Welding symbols: weld type, size, which side, all around." },
            surface_finish: { group: "Decode callouts", name: "Surface Finish", iconChar: "√", filePath: './modules/decode/surface_finish.js', desc: "Surface finish symbols: Ra, lay, process, allowance." },
            frame_checker: { group: "Decode callouts", name: "Frame Legality Checker", iconChar: "✓", filePath: './modules/decode/frame_checker.js', desc: "Is this frame legal under ASME Y14.5-2018?" }
        }
    },

    // the 14 characteristics, each as an interactive tolerance zone
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

    // modifiers and the boundaries they create
    MATERIAL: {
        label: "Material Condition",
        icon: "fa-expand",
        symbols: {
            bonus: { name: "Bonus Tolerance (MMC / LMC)", iconChar: "Ⓜ", filePath: './modules/location/position.js', desc: "Extra position tolerance when a hole or pin is made away from MMC." },
            virtual_condition: { name: "Virtual & Resultant Condition", iconChar: "◌", filePath: './modules/material/virtual_condition.js', desc: "Will this pin always fit this hole? The worst-case boundaries." },
            rule1: { name: "Rule #1 Envelope", iconChar: "▭", filePath: './modules/material/rule1.js', desc: "Perfect form at MMC: why a bent pin can fail the gauge." },
            datum_shift: { name: "Datum Shift (MMB)", iconChar: "⇄", filePath: './modules/material/datum_shift.js', desc: "How far a part can slide on a datum pin at MMB, and when it helps." }
        }
    },

    // how parts are held and measured from
    DATUMS: {
        label: "Datums",
        icon: "fa-cube",
        symbols: {
            drf: { name: "Datum Reference Frame (3D)", iconChar: "⌗", filePath: './modules/datums/drf.js', desc: "How datums A, B and C hold the part, in 3D." },
            precedence: { name: "Datum Precedence (3D)", iconChar: "⇅", filePath: './modules/datums/drf.js', desc: "Why the order of the datums changes the result, in 3D." },
            datum_targets: { name: "Datum Targets", iconChar: "⊗", filePath: './modules/datums/datum_targets.js', desc: "Points, lines and areas that set the datums on castings, forgings and sheet metal." }
        }
    },

    // assembly math
    STACKUPS: {
        label: "Stack-ups & Fits",
        icon: "fa-layer-group",
        symbols: {
            stackup: { name: "Tolerance Stack-up", iconChar: "≡", filePath: './modules/stackups/stackup.js', desc: "Will the parts fit every time? Worst case and RSS." },
            fasteners: { name: "Fastener Formulas", iconChar: "⊕", filePath: './modules/stackups/fasteners.js', desc: "Position tolerance that guarantees the bolts go in." },
            fits: { name: "ISO Fits (H7/g6)", iconChar: "⌗", filePath: './modules/stackups/fits.js', desc: "Turn Ø20 H7/g6 into real limits and the fit type." }
        }
    },

    // what quality does with the drawing
    INSPECTION: {
        label: "Inspection",
        icon: "fa-microscope",
        symbols: {
            cmm_position: { name: "CMM Position Calculator", iconChar: "⌖", filePath: './modules/inspection/cmm_position.js', desc: "Check hole positions from a CMM report, with bonus." },
            methods: { name: "Measurement Methods", iconChar: "⏚", planned: true,
                summary: "How each characteristic is actually checked (surface plate and indicator, V-blocks, CMM, functional gauge) and where each method can mislead." },
            functional_gauge: { name: "Functional Gauge Designer", iconChar: "⊞", planned: true,
                summary: "Size gauge pins at virtual condition and lay out a go gauge for a hole pattern, including datum pins at MMB." }
        }
    },

    // standards and practice
    LEARN: {
        label: "Learn",
        icon: "fa-graduation-cap",
        symbols: {
            notebook: { name: "My Notebook", iconChar: "✎", filePath: './modules/learn/notebook.js', desc: "Your own notes: company rules, decoded callouts, lessons learned." },
            glossary: { name: "Glossary", iconChar: "Aa", filePath: './modules/learn/glossary.js', desc: "Every term in plain words, A to Z." },
            practice: { name: "Learning Path & Quizzes", iconChar: "?", filePath: './modules/learn/practice.js', desc: "Six short lessons in order, each with a quiz to check yourself." },
            y14_changes: { name: "Y14.5-2009 vs 2018", iconChar: "Δ", planned: true,
                summary: "What changed between editions, including the removal of concentricity and symmetry and what to use instead." },
            asme_iso: { name: "ASME vs ISO GPS", iconChar: "≠", filePath: './modules/learn/asme_iso.js', desc: "Which rulebook a drawing uses, and what that changes." }
        }
    },

    // can the shop make it, and at what cost
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
    }
};
