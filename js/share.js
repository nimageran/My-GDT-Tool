// js/share.js
// Links and copied results.
//  - Every tool has its own address: #/CAT/sym (the browser's Back works).
//  - "Link" adds the tool's settings (?s=…) and units (&u=…), so a colleague
//    opens the same case. Tools opt in with:  export const share = shareable(state, [keys])
//  - "Copy result" puts the tool's result in plain text on the clipboard.

/**
 * Pick the keys of a tool's state that make up its case (numbers, choices,
 * measured points), to put in a link and to restore from one.
 * keys: list of state keys; 'units' is allowed even before the tool set it.
 */
export function shareable(state, keys) {
    const ok = v => v === null || ['number', 'string', 'boolean'].includes(typeof v) || Array.isArray(v) || (typeof v === 'object' && v.constructor === Object);
    return {
        get() {
            const o = {};
            for (const k of keys) if (k in state && ok(state[k])) o[k] = state[k];
            return o;
        },
        set(o) {
            for (const k of keys) {
                if (!(k in o) || !ok(o[k])) continue;
                if (k in state && state[k] !== null && o[k] !== null && typeof state[k] !== typeof o[k]) continue;   // wrong type: ignore
                state[k] = structuredClone(o[k]);
            }
        }
    };
}

// --- address ---------------------------------------------------------------

const enc = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

/** '#/CAT/sym' plus optional settings and units. */
export function toolHash(cat, sym, settings = null, units = null) {
    const q = [];
    if (units) q.push(`u=${units}`);
    if (settings && Object.keys(settings).length) q.push(`s=${enc(settings)}`);
    return `#/${cat}/${sym}${q.length ? '?' + q.join('&') : ''}`;
}

/** Read the address: { cat, sym, units, settings } or null. */
export function parseHash(hash = location.hash) {
    const m = /^#\/([A-Z_]+)\/([a-z0-9_]+)(?:\?(.*))?$/.exec(hash);
    if (!m) return null;
    const params = new URLSearchParams(m[3] || '');
    let settings = null;
    try { if (params.get('s')) settings = dec(params.get('s')); } catch (e) { settings = null; }
    const u = params.get('u');
    return { cat: m[1], sym: m[2], units: u === 'mm' || u === 'in' ? u : null, settings };
}

// --- clipboard and message ---------------------------------------------------

export async function copyText(str) {
    try {
        await navigator.clipboard.writeText(str);
        return true;
    } catch (e) {
        // Older browsers / not https: a hidden text box and the copy command
        const ta = document.createElement('textarea');
        ta.value = str;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        let done = false;
        try { done = document.execCommand('copy'); } catch (err) { done = false; }
        ta.remove();
        return done;
    }
}

let toastTimer = null;
export function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.setAttribute('role', 'status');
        t.className = 'fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-8 z-[60] bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-xl max-w-[90vw] text-center';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// --- the result on the canvas, as text ---------------------------------------------

/**
 * Plain-text result of the open tool: the results strip / card summary
 * (data-summary), else the "IN PLAIN ENGLISH" text of a decoder. '' if none.
 */
export function resultText(svg) {
    if (!svg || svg.style.display === 'none') return '';
    const parts = [...svg.querySelectorAll('[data-summary]')].map(g => g.dataset.summary);
    if (parts.length) return parts.join('\n');
    // Decoders: the lines drawn below the "IN PLAIN ENGLISH" heading
    const texts = [...svg.querySelectorAll('text')];
    const label = texts.find(t => /^in plain english$/i.test(t.textContent.trim()));
    if (!label) return '';
    const y0 = label.getBBox().y;
    return texts.filter(t => t !== label && t.getBBox().y > y0 + 4 && t.getBBox().y < y0 + 220)
        .map(t => t.textContent.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
}
