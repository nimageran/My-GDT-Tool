// js/units.js
// One mm / inch setting for the whole tool, chosen in the top bar and saved
// in this browser. Tools read it when they draw; when it changes, the active
// tool is reloaded and converts its own numbers (same part, other unit).

const KEY = 'units_v1';
export const MM_PER_IN = 25.4;

let current = load();

function load() {
    try {
        const u = localStorage.getItem(KEY);
        if (u === 'mm' || u === 'in') return u;
    } catch (e) { /* storage unavailable: use the default */ }
    return 'in';
}

export const getUnits = () => current;
export const isInch = () => current === 'in';

export function setUnits(u) {
    if ((u !== 'mm' && u !== 'in') || u === current) return;
    current = u;
    try { localStorage.setItem(KEY, u); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gdt:units', { detail: u }));
}

/** '"' after inch values, ' mm' after metric ones. */
export const suffix = (u = current) => (u === 'in' ? '"' : ' mm');
/** Short name for labels: 'in' or 'mm'. */
export const unitName = (u = current) => (u === 'in' ? 'in' : 'mm');
/** Usual decimals: 0.0001" or 0.001 mm. */
export const decimals = (u = current) => (u === 'in' ? 4 : 3);
/** Value with its unit, e.g. 0.0150" or 0.381 mm. */
export const fmt = (v, d = decimals()) => v.toFixed(d) + suffix();
/** Input step: 0.001" or 0.01 mm. */
export const step = (u = current) => (u === 'in' ? 0.001 : 0.01);

/** A length written in inches (a constant in the code), in the current unit. */
export const fromIn = v => (current === 'in' ? v : v * MM_PER_IN);
/** A "per inch" value written in the code (e.g. px per inch), per current unit. */
export const perFromIn = v => (current === 'in' ? v : v / MM_PER_IN);
/** A length written in mm (a constant in the code), in the current unit. */
export const fromMm = v => (current === 'mm' ? v : v / MM_PER_IN);

const round = (v, u) => +v.toFixed(u === 'in' ? 5 : 4);

/**
 * Bring a tool's stored numbers into the current unit. Call at the start of
 * draw() and loadControls().
 *   native:    the unit the tool's defaults are written in
 *   lengths:   keys holding lengths (numbers, or arrays / objects of numbers)
 *   perLength: keys holding "per unit" values (e.g. px per inch), divided
 *   nice:      optional { mm: {...}, in: {...} } defaults used instead of
 *              converting the first time the tool opens in the other unit
 *   custom:    optional (state, conv) => void for lengths inside mixed
 *              objects (conv(v) converts one number)
 * Returns true when the numbers changed.
 */
export function syncUnits(state, { native, lengths = [], perLength = [], nice = {}, custom = null }) {
    if (!state.units) {
        state.units = native;
        if (current !== native && nice[current]) {
            Object.assign(state, structuredClone(nice[current]));
            state.units = current;
            return true;
        }
    }
    if (state.units === current) return false;
    const k = current === 'mm' ? MM_PER_IN : 1 / MM_PER_IN;
    const conv = v => (typeof v === 'number' ? round(v * k, current)
        : Array.isArray(v) ? v.map(conv)
        : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, conv(b)]))
        : v);
    for (const key of lengths) if (key in state) state[key] = conv(state[key]);
    for (const key of perLength) if (typeof state[key] === 'number') state[key] = state[key] / k;
    if (custom) custom(state, conv);
    state.units = current;
    return true;
}
