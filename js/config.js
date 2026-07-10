// js/config.js

export const GDT_HIERARCHY = {
    // CATEGORY 1: FORM
    FORM: {
        label: "Form",
        icon: "fa-shapes", 
        symbols: {
            straightness: { 
                name: "Straightness", 
                iconChar: "—", 
                filePath: './modules/form/straightness.js' 
            },
            flatness: { 
                name: "Flatness", 
                iconChar: "⏥", 
                filePath: './modules/form/flatness.js' 
            },
            circularity: { 
                name: "Circularity", 
                iconChar: "○", 
                filePath: './modules/form/circularity.js' 
            },
            cylindricity: { 
                name: "Cylindricity", 
                iconChar: "⌭", 
                filePath: './modules/form/cylindricity.js' 
            }
        }
    },

    // CATEGORY 2: PROFILE
    PROFILE: {
        label: "Profile",
        icon: "fa-bezier-curve",
        symbols: {
            line_profile: { 
                name: "Line Profile", 
                iconChar: "⌓", 
                filePath: './modules/profile/line_profile.js' 
            },
            surface_profile: { 
                name: "Surface Profile", 
                iconChar: "⌓", 
                filePath: './modules/profile/surface_profile.js' 
            }
        }
    },

    // CATEGORY 3: ORIENTATION
    ORIENTATION: {
        label: "Orientation",
        icon: "fa-ruler-combined",
        symbols: {
            angularity: { 
                name: "Angularity", 
                iconChar: "∠", 
                filePath: './modules/orientation/angularity.js' 
            },
            perpendicularity: { 
                name: "Perpendicularity", 
                iconChar: "⊥", 
                filePath: './modules/orientation/perpendicularity.js' 
            },
            parallelism: { 
                name: "Parallelism", 
                iconChar: "∥", 
                filePath: './modules/orientation/parallelism.js' 
            }
        }
    },

    // CATEGORY 4: LOCATION
    LOCATION: {
        label: "Location",
        icon: "fa-crosshairs",
        symbols: {
            position: { 
                name: "Position", 
                iconChar: "⌖", 
                filePath: './modules/location/position.js' 
            },
            concentricity: { 
                name: "Concentricity", 
                iconChar: "◎", 
                filePath: './modules/location/concentricity.js' 
            },
            symmetry: { 
                name: "Symmetry", 
                iconChar: "⌯", 
                filePath: './modules/location/symmetry.js' 
            }
        }
    },

    // CATEGORY 5: RUNOUT
    RUNOUT: {
        label: "Runout",
        icon: "fa-arrows-spin",
        symbols: {
            circular_runout: { 
                name: "Circular Runout", 
                iconChar: "↗", 
                filePath: './modules/runout/circular_runout.js' 
            },
            total_runout: { 
                name: "Total Runout", 
                iconChar: "⌰", 
                filePath: './modules/runout/total_runout.js' 
            }
        }
    },

    // CATEGORY 6: DECODE — reverse-engineering hard drawing callouts.
    // Registered once; future modules OVERWRITE their placeholder file.
    // Config never needs editing again (see DECODER_SPEC.md §7).
    DECODE: {
        label: "Decode",
        icon: "fa-magnifying-glass",
        symbols: {
            welding: {
                name: "Welding Symbol",
                iconChar: "▷",
                filePath: './modules/decode/welding.js'
            },
            hole_callouts: {
                name: "Holes & Patterns",
                iconChar: "⌀",
                filePath: './modules/decode/hole_callouts.js'
            },
            surface_finish: {
                name: "Surface Finish",
                iconChar: "√",
                filePath: './modules/decode/surface_finish.js'
            },
            composite_frames: {
                name: "Composite & Datums",
                iconChar: "▣",
                filePath: './modules/decode/composite_frames.js'
            },
            fits: {
                name: "Fits (H7/g6)",
                iconChar: "⌗",
                filePath: './modules/decode/fits.js'
            }
        }
    }
};
