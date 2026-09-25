// js/legibility.js
// Keeps canvas text readable on smaller screens. The canvas is drawn in a
// fixed 1000 × 800 space and scaled to fit the window, so on a laptop a
// 12-unit label can end up 9 px tall. This raises any text that would appear
// smaller than MIN_PX on screen, and re-checks after every redraw and resize.
// Mark a group with data-fixed-size to leave its text alone.

const MIN_PX = 11.5;     // smallest on-screen size for canvas text
const MAX_GROWTH = 1.6;  // never more than this × the drawn size, to protect tight layouts

let svg = null, frame = 0;
// Redraws are fixed straight away (before the browser paints), so tools that
// redraw every animation frame never show small text; resizes are batched.
const mutations = new MutationObserver(apply);
const resize = new ResizeObserver(schedule);

/** Start watching a (new) canvas <svg>. */
export function watchCanvas(el) {
    mutations.disconnect();
    resize.disconnect();
    svg = el;
    mutations.observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['font-size', 'transform', 'style'] });
    resize.observe(svg);
    schedule();
}

function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
}

// Size the module asked for: its own attribute, else inherited from the parent
function drawnSize(t) {
    const own = parseFloat(t.getAttribute('font-size'));
    if (Number.isFinite(own)) return own;
    return parseFloat(getComputedStyle(t.parentNode).fontSize) || 16;
}

function apply() {
    if (!svg?.isConnected || svg.style.display === 'none') return;
    mutations.disconnect();
    for (const t of svg.querySelectorAll('text')) {
        if (t.closest('[data-fixed-size]')) continue;
        const m = t.getScreenCTM();
        if (!m) continue;
        const scale = Math.hypot(m.a, m.b);
        const size = drawnSize(t);
        const needed = Math.min(MIN_PX / scale, size * MAX_GROWTH);
        if (needed > size + 0.01) t.style.fontSize = `${needed.toFixed(2)}px`;
        else if (t.style.fontSize) t.style.fontSize = '';
    }
    mutations.observe(svg, { childList: true, subtree: true, attributes: true, attributeFilter: ['font-size', 'transform', 'style'] });
}
