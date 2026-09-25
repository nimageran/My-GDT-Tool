// js/modules/learn/glossary.js
// The Glossary page: every term in plain words, A to Z, searchable, with
// cross-links between terms and buttons to the tool that shows each one.
// Text-heavy, so it is HTML beside the (hidden) canvas, like the 3D tools.

import { GLOSSARY, linkify } from '../../glossary.js';

const state = { search: '' };
let svgRef = null, overlay = null, controlsRoot = null;

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/Ⓜ/g, 'Ⓜ\uFE0E');
const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'en', { numeric: true }));
const letterOf = t => (/[a-z]/i.test(t[0]) ? t[0].toUpperCase() : '#');

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'glossary';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);

    // Opened from a hover card's "Glossary" link: show that term
    if (window.__glossaryFocus) {
        state.search = window.__glossaryFocus;
        delete window.__glossaryFocus;
    }
    renderList();
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
    if (!q) return sorted;
    return sorted.filter(g => `${g.term} ${g.match.join(' ')} ${g.meaning}`.toLowerCase().includes(q));
}

function renderList() {
    if (!overlay) return;
    const list = visible();
    const groups = {};
    list.forEach(g => (groups[letterOf(g.term)] ??= []).push(g));

    overlay.innerHTML = `
      <div class="max-w-3xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Learn</div>
        <h2 class="text-3xl font-extrabold text-slate-900 mb-1">Glossary</h2>
        <p class="text-slate-500 mb-6">${list.length} of ${GLOSSARY.length} terms${state.search ? ` matching "${esc(state.search)}"` : ''}. Underlined words in any explanation open a short version of these.</p>
        ${list.length === 0 ? '<p class="text-slate-500">Nothing found. Try a shorter word.</p>' : ''}
        ${Object.entries(groups).map(([letter, items]) => `
          <section id="gl-${letter}" class="mb-6">
            <h3 class="text-sm font-extrabold text-blue-700 border-b border-blue-100 pb-1 mb-3">${letter}</h3>
            <div class="space-y-3">
              ${items.map((g, i) => `
                <article class="bg-white border border-slate-200 rounded-lg p-4" data-entry="${esc(g.term)}">
                  <div class="flex items-baseline justify-between gap-3">
                    <h4 class="text-lg font-bold text-slate-900">${esc(g.term)}</h4>
                    ${g.see ? `<button data-see="${letter}-${i}" class="text-xs font-bold text-blue-700 hover:underline shrink-0">${esc(g.see.label)} ▶</button>` : ''}
                  </div>
                  <p class="gl-text text-slate-700 mt-1 leading-relaxed">${esc(g.meaning)}</p>
                  ${g.example ? `<p class="gl-text mt-2 text-sm text-slate-600 bg-blue-50 rounded px-3 py-2"><span class="font-semibold text-blue-800">Example:</span> ${esc(g.example)}</p>` : ''}
                </article>`).join('')}
            </div>
          </section>`).join('')}
      </div>`;

    // Cross-link other terms inside each meaning (not the entry's own term)
    overlay.querySelectorAll('article').forEach(a => {
        a.querySelectorAll('.gl-text').forEach(p => linkify(p, { skipTerms: [a.dataset.entry] }));
    });
    Object.entries(groups).forEach(([letter, items]) => items.forEach((g, i) => {
        const b = overlay.querySelector(`[data-see="${letter}-${i}"]`);
        if (b) b.onclick = () => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat: g.see.cat, sym: g.see.sym } }));
    }));
    overlay.scrollTop = 0;
}

function renderControls() {
    if (!controlsRoot) return;
    const letters = [...new Set(sorted.map(g => letterOf(g.term)))];
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Search</h4>
            <input id="gl-search" type="search" value="${esc(state.search)}" placeholder="e.g. bonus, datum, Ra"
                class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Jump to</h4>
            <div class="flex flex-wrap gap-1.5">
                ${letters.map(l => `<button data-letter="${l}" class="w-8 h-8 rounded bg-slate-100 hover:bg-blue-100 text-sm font-bold text-slate-700">${l}</button>`).join('')}
            </div>
        </div>
        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900" data-nogloss>
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Tip</div>
            <div class="text-xs opacity-90">Words with a dotted underline anywhere in the tool are in this glossary. Hover over them (or tap on a phone) for a quick meaning.</div>
        </div>`;

    const search = controlsRoot.querySelector('#gl-search');
    search.oninput = () => { state.search = search.value; renderList(); };
    controlsRoot.querySelectorAll('[data-letter]').forEach(b => b.onclick = () => {
        if (state.search) { state.search = ''; search.value = ''; renderList(); }
        overlay?.querySelector(`#gl-${b.dataset.letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}
