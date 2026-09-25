// js/modules/learn/asme_iso.js
// ASME Y14.5 vs ISO GPS: how to tell which rulebook a drawing follows, and
// the differences that change how you read it. Side-by-side cards with a
// "what it means for you" line. HTML beside the (hidden) canvas.

import { linkify } from '../../glossary.js';
import { takeFocus } from '../../focus.js';

// Clues on a drawing, and which standard they point to
export const CLUES = [
    ['"ASME Y14.5" in the title block or notes', 'ASME'],
    ['"ISO 8015", "ISO GPS" or "ISO 1101" in the title block or notes', 'ISO'],
    ['First-angle projection symbol', 'Usually ISO'],
    ['General tolerance note "ISO 2768-m" (or -mK)', 'ISO'],
    ['Ⓔ after a size (envelope asked for)', 'ISO'],
    ['Ⓘ after a size (independency asked for)', 'ASME'],
    ['UZ, CZ, SZ, (GG), (GX), [CF], [DV] in or next to frames', 'ISO'],
    ['Ⓤ in a profile frame, CR radius, composite (two-row, one symbol) frames', 'ASME'],
    ['Inch dimensions', 'Almost always ASME']
];

// big: the difference changes pass / fail, not just the look
export const TOPICS = [
    { id: 'size', group: 'Big differences', big: true, title: 'Does size control form?',
      asme: 'Yes: Rule #1. A pin at its largest size must be perfectly straight and round (the envelope).',
      iso: 'No: independency (ISO 8015). Size is checked point by point only; form needs its own tolerance or a general one. Ⓔ after the size asks for the envelope.',
      you: 'On an ISO drawing, a bent pin with every caliper reading in tolerance passes the size requirement. Check form separately, or look for Ⓔ.',
      link: ['MATERIAL', 'rule1', 'Rule #1 Envelope'] },
    { id: 'measure', group: 'Big differences', big: true, title: 'How a size is measured',
      asme: 'Local sizes plus the envelope at MMC (Rule #1). The standard does not name a measuring method.',
      iso: 'Two-point size by default (ISO 14405-1). Other methods can be asked for with modifiers: (GG) least squares, (GX) largest inscribed, (GN) smallest circumscribed, (CC) from circumference.',
      you: 'On ISO drawings, look after the size for a modifier in brackets; it tells the inspector how to measure.' },
    { id: 'concentricity', group: 'Big differences', big: true, title: 'Concentricity and symmetry',
      asme: 'Removed in the 2018 edition. Use position, profile or runout instead.',
      iso: 'Still in use: coaxiality / concentricity (◎) and symmetry (⌯) control the derived median line or plane.',
      you: 'On an ISO drawing ◎ and ⌯ are current symbols, not old ones. Read them as a tolerance on the median points.',
      link: ['CHARACTERISTICS', 'concentricity', 'Concentricity'] },
    { id: 'pattern', group: 'Big differences', big: true, title: 'Patterns of holes',
      asme: 'Composite frames (one symbol, two rows): the upper row locates the pattern, the lower row controls spacing inside it. Several patterns to the same datums act as one by default (simultaneous requirement).',
      iso: 'No composite frames. A pattern tolerated as one group is marked CZ (combined zone). Patterns are separate unless SIM (simultaneous) is written.',
      you: 'Two-row frames mean ASME. On ISO drawings look for CZ and SIM; without SIM, two patterns may be checked separately.',
      link: ['DECODE', 'composite_frames', 'Feature Control Frames'] },
    { id: 'general', group: 'Big differences', big: true, title: 'Default (general) tolerances',
      asme: 'Set by each company in the title block, usually by decimal places.',
      iso: 'Usually a note: ISO 2768-1 (f, m, c, v) for sizes and angles, ISO 2768-2 (H, K, L) or ISO 22081 for form and orientation.',
      you: 'On ISO drawings, find the note and look up the table; the number of decimals does not set the tolerance.',
      link: ['DECODE', 'general_tolerances', 'General Tolerances'] },
    { id: 'axis', group: 'Symbols and notation', title: 'Axis or surface?',
      asme: 'A frame placed with the size dimension (or under it) controls the axis or center plane. Attached to the surface or an extension line, it controls the surface.',
      iso: 'Decided by the leader arrow: in line with the dimension line = the derived axis or median plane; clearly offset from it = the surface.',
      you: 'On ISO drawings, look at exactly where the arrow lands relative to the dimension line.' },
    { id: 'profile', group: 'Symbols and notation', title: 'Profile zone not centred',
      asme: 'Ⓤ followed by how much of the zone lies outside the material: 0.3 Ⓤ 0.1 means 0.1 outside, 0.2 inside.',
      iso: 'UZ followed by how far the zone centre moves (+ outside, − inside): the same zone is written 0.3 UZ−0.05.',
      you: 'Same idea, different numbers: ASME gives the outside amount, ISO the shift of the centre. Work out both limits before judging a part.',
      link: ['CHARACTERISTICS', 'surface_profile', 'Surface Profile'] },
    { id: 'datums', group: 'Symbols and notation', title: 'Datum modifiers',
      asme: 'Ⓜ / Ⓛ after the datum letter (MMB / LMB); ▷ translation modifier; datum targets and movable targets.',
      iso: 'Ⓜ / Ⓛ after the letter too, plus bracket modifiers such as [CF] contacting feature, [DV] variable distance, [PD] pitch diameter, [SL] straight line.',
      you: 'Brackets after a datum letter mean ISO; ask quality how their CMM simulates them.',
      link: ['MATERIAL', 'datum_shift', 'Datum Shift'] },
    { id: 'cr', group: 'Symbols and notation', title: 'Controlled radius',
      asme: 'CR: the radius must be a smooth curve with no flats or reversals, inside the limits.',
      iso: 'No CR. A plain radius is a size; smoothness needs a profile tolerance.',
      you: 'CR on a drawing means ASME. On ISO drawings, a radius tolerance alone does not stop flats.' },
    { id: 'basic', group: 'Same idea, different name', title: 'Boxed dimensions',
      asme: 'Basic dimension.',
      iso: 'Theoretically exact dimension (TED).',
      you: 'Both mean the perfect value; the tolerance comes from a geometric frame, never from ±.' },
    { id: 'mmc', group: 'Same idea, different name', title: 'Ⓜ in a frame',
      asme: 'MMC modifier: bonus tolerance as the feature departs from MMC.',
      iso: 'Maximum material requirement (MMR): the same effect, defined as a boundary (maximum material virtual condition).',
      you: 'Read it the same way: the tolerance grows as the feature departs from its MMC size.',
      link: ['MATERIAL', 'bonus', 'Bonus Tolerance'] },
    { id: 'projection', group: 'Same idea, different name', title: 'View layout',
      asme: 'Third-angle projection is normal.',
      iso: 'First-angle projection is common (either is allowed; the symbol tells you).',
      you: 'Always check the projection symbol before reading views.',
      link: ['DECODE', 'projection', 'First vs Third Angle'] },
    { id: 'surface', group: 'Same idea, different name', title: 'Surface finish',
      asme: 'ASME Y14.36: often Ra in microinches (e.g. 63) above the check mark.',
      iso: 'ISO 1302 / 21920: parameter and value written after the symbol, e.g. Ra 1.6 (micrometres).',
      you: 'Ra 63 µin is about Ra 1.6 µm. Check the unit before comparing.',
      link: ['DECODE', 'surface_finish', 'Surface Finish'] },
    { id: 'threads', group: 'Same idea, different name', title: 'Threads',
      asme: 'Unified threads, e.g. 1/4-20 UNC-2B (B = internal, A = external).',
      iso: 'Metric threads, e.g. M8 × 1.25-6H (capital letter = internal, small = external).',
      you: 'The class letter tells you hole or bolt in both systems.',
      link: ['DECODE', 'hole_callouts', 'Holes, Threads & Patterns'] }
];
const GROUPS = ['Big differences', 'Symbols and notation', 'Same idea, different name'];

const state = { search: '', group: 'all' };
let svgRef = null, overlay = null, controlsRoot = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'asme_iso';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);
    const f = takeFocus('asme_iso');                     // topic id, from the search
    const t = TOPICS.find(x => x.id === f);
    if (t) Object.assign(state, { search: t.title, group: 'all' });
    renderPage();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

export function unload() {
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = svgRef = null;
}

function visible() {
    const q = state.search.trim().toLowerCase();
    return TOPICS.filter(t => (state.group === 'all' || t.group === state.group) &&
        (!q || `${t.title} ${t.asme} ${t.iso} ${t.you}`.toLowerCase().includes(q)));
}

function card(t) {
    return `
      <article class="bg-white border ${t.big ? 'border-amber-300' : 'border-slate-200'} rounded-lg p-4" data-entry="${esc(t.title)}">
        <div class="flex items-baseline justify-between gap-3 mb-2">
          <h4 class="text-lg font-bold text-slate-900">${esc(t.title)}
            ${t.big ? '<span class="ml-2 align-middle text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">Changes pass / fail</span>' : ''}</h4>
          ${t.link ? `<button data-link="${t.id}" class="text-xs font-bold text-blue-700 hover:underline shrink-0">${esc(t.link[2])} ▶</button>` : ''}
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="rounded bg-blue-50 px-3 py-2"><div class="text-[11px] font-extrabold tracking-widest text-blue-800 mb-1">ASME Y14.5</div><p class="ai-text text-sm text-slate-800 leading-relaxed">${esc(t.asme)}</p></div>
          <div class="rounded bg-emerald-50 px-3 py-2"><div class="text-[11px] font-extrabold tracking-widest text-emerald-800 mb-1">ISO GPS</div><p class="ai-text text-sm text-slate-800 leading-relaxed">${esc(t.iso)}</p></div>
        </div>
        <p class="ai-text mt-3 text-sm text-slate-700"><span class="font-bold text-slate-900">What it means for you:</span> ${esc(t.you)}</p>
      </article>`;
}

function renderPage() {
    if (!overlay) return;
    const list = visible();
    const showClues = !state.search && state.group === 'all';
    overlay.innerHTML = `
      <div class="max-w-4xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Learn</div>
        <h2 class="text-3xl font-extrabold text-slate-900 mb-1">ASME vs ISO GPS</h2>
        <p class="text-slate-600 mb-6 leading-relaxed">Most symbols look the same in both systems, but a few rules are different, and they can turn a pass into a fail. First find out <b>which rulebook the drawing uses</b>, then read it with that rulebook's defaults.</p>
        ${showClues ? `
        <section class="bg-white border border-slate-200 rounded-lg p-4 mb-8">
          <h3 class="text-sm font-extrabold text-slate-800 mb-3">Which rulebook is this drawing? Look for these clues</h3>
          <table class="w-full text-sm">
            ${CLUES.map(([c, s]) => `<tr class="border-t border-slate-100"><td class="py-1.5 pr-3 text-slate-700">${esc(c)}</td>
              <td class="py-1.5 text-right whitespace-nowrap"><span class="text-xs font-bold rounded px-2 py-0.5 ${s.includes('ISO') ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">${esc(s)}</span></td></tr>`).join('')}
          </table>
          <p class="text-sm text-slate-500 mt-3">No standard named at all? Ask the customer. Do not assume: a European supplier drawing is often ISO even when your company works to ASME.</p>
        </section>` : ''}
        ${list.length === 0 ? '<p class="text-slate-500">Nothing found. Try a shorter word.</p>' : ''}
        ${GROUPS.map(g => {
            const items = list.filter(t => t.group === g);
            return items.length ? `
              <section class="mb-8">
                <h3 class="text-sm font-extrabold text-blue-700 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wide">${esc(g)}</h3>
                <div class="space-y-3">${items.map(card).join('')}</div>
              </section>` : '';
        }).join('')}
      </div>`;
    overlay.querySelectorAll('article').forEach(a => a.querySelectorAll('.ai-text').forEach(p => linkify(p, { skipTerms: [a.dataset.entry] })));
    overlay.querySelectorAll('[data-link]').forEach(b => {
        const t = TOPICS.find(x => x.id === b.dataset.link);
        b.onclick = () => go(t.link[0], t.link[1]);
    });
    overlay.scrollTop = 0;
}

function renderControls() {
    if (!controlsRoot) return;
    const segBtn = 'px-2 py-1.5 text-xs font-bold rounded border transition-colors';
    const seg = (v, label) => `<button data-group="${esc(v)}" class="${segBtn} ${state.group === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}">${esc(label)}</button>`;
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Search</h4>
            <input id="ai-search" type="search" value="${esc(state.search)}" placeholder="e.g. envelope, CZ, threads"
                class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Show</h4>
            <div class="flex flex-wrap gap-1.5">${seg('all', 'All')}${GROUPS.map(g => seg(g, g)).join('')}</div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> The one to remember</div>
            <div class="text-xs leading-relaxed">ISO drawings do not have Rule #1. A size tolerance alone does not limit bending, bowing or out-of-round. If form matters and there is no form tolerance, no general geometric tolerance and no Ⓔ, ask before you accept the part.</div>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">This page covers the differences you meet most when reading drawings. The full ISO GPS system is spread over many standards (ISO 8015, 1101, 5459, 14405, 2768, 22081 and more).</p>`;
    const s = controlsRoot.querySelector('#ai-search');
    s.oninput = () => { state.search = s.value; renderPage(); };
    controlsRoot.querySelectorAll('[data-group]').forEach(b => b.onclick = () => {
        state.group = b.dataset.group;
        renderPage();
        renderControls();
    });
}
