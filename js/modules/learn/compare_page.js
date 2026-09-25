// js/modules/learn/compare_page.js
// Shared page for side-by-side comparisons (ASME vs ISO, Y14.5-2009 vs 2018):
// a clue list ("which one is this drawing?"), then cards with two columns and
// a "what it means for you" line, with search, group filter and tool links.
// HTML beside the (hidden) canvas.

import { linkify } from '../../glossary.js';
import { takeFocus } from '../../focus.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));

const COL = {
    blue: { box: 'bg-blue-50', head: 'text-blue-800', tag: 'bg-blue-100 text-blue-800' },
    green: { box: 'bg-emerald-50', head: 'text-emerald-800', tag: 'bg-emerald-100 text-emerald-800' },
    grey: { tag: 'bg-slate-200 text-slate-700' }
};

/**
 * cfg: {
 *   id, title, intro (HTML), cluesTitle, cluesNote,
 *   clues: [[text, tag, colour]] (colour 'blue' | 'green' | 'grey'),
 *   cols: [{ key, label, colour }, { key, label, colour }],
 *   topics: [{ id, group, title, big?, [cols[0].key], [cols[1].key], you, link? }],
 *   groups, bigLabel, placeholder, remember: { title, text }, footnote
 * }
 * Returns the module's { draw, loadControls, unload }.
 */
export function makeComparePage(cfg) {
    const state = { search: '', group: 'all' };
    let svgRef = null, overlay = null, controlsRoot = null;
    const [A, B] = cfg.cols;

    function visible() {
        const q = state.search.trim().toLowerCase();
        return cfg.topics.filter(t => (state.group === 'all' || t.group === state.group) &&
            (!q || `${t.title} ${t[A.key]} ${t[B.key]} ${t.you}`.toLowerCase().includes(q)));
    }

    const column = (col, body) => `<div class="rounded ${COL[col.colour].box} px-3 py-2"><div class="text-[11px] font-extrabold tracking-widest ${COL[col.colour].head} mb-1">${esc(col.label)}</div><p class="cp-text text-sm text-slate-800 leading-relaxed">${esc(body)}</p></div>`;

    function card(t) {
        return `
          <article class="bg-white border ${t.big ? 'border-amber-300' : 'border-slate-200'} rounded-lg p-4" data-entry="${esc(t.title)}">
            <div class="flex items-baseline justify-between gap-3 mb-2">
              <h4 class="text-lg font-bold text-slate-900">${esc(t.title)}
                ${t.big ? `<span class="ml-2 align-middle text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">${esc(cfg.bigLabel)}</span>` : ''}</h4>
              ${t.link ? `<button data-link="${t.id}" class="text-xs font-bold text-blue-700 hover:underline shrink-0">${esc(t.link[2])} ▶</button>` : ''}
            </div>
            <div class="grid sm:grid-cols-2 gap-3">${column(A, t[A.key])}${column(B, t[B.key])}</div>
            <p class="cp-text mt-3 text-sm text-slate-700"><span class="font-bold text-slate-900">What it means for you:</span> ${esc(t.you)}</p>
          </article>`;
    }

    function renderPage() {
        if (!overlay) return;
        const list = visible();
        const showClues = !state.search && state.group === 'all';
        overlay.innerHTML = `
          <div class="max-w-4xl mx-auto px-6 py-8">
            <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Learn</div>
            <h2 class="text-3xl font-extrabold text-slate-900 mb-1">${esc(cfg.title)}</h2>
            <p class="text-slate-600 mb-6 leading-relaxed">${cfg.intro}</p>
            ${showClues ? `
            <section class="bg-white border border-slate-200 rounded-lg p-4 mb-8">
              <h3 class="text-sm font-extrabold text-slate-800 mb-3">${esc(cfg.cluesTitle)}</h3>
              <table class="w-full text-sm">
                ${cfg.clues.map(([c, tag, colour]) => `<tr class="border-t border-slate-100"><td class="py-1.5 pr-3 text-slate-700">${esc(c)}</td>
                  <td class="py-1.5 text-right whitespace-nowrap"><span class="text-xs font-bold rounded px-2 py-0.5 ${COL[colour].tag}">${esc(tag)}</span></td></tr>`).join('')}
              </table>
              <p class="text-sm text-slate-500 mt-3">${esc(cfg.cluesNote)}</p>
            </section>` : ''}
            ${list.length === 0 ? '<p class="text-slate-500">Nothing found. Try a shorter word.</p>' : ''}
            ${cfg.groups.map(g => {
                const items = list.filter(t => t.group === g);
                return items.length ? `
                  <section class="mb-8">
                    <h3 class="text-sm font-extrabold text-blue-700 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wide">${esc(g)}</h3>
                    <div class="space-y-3">${items.map(card).join('')}</div>
                  </section>` : '';
            }).join('')}
          </div>`;
        overlay.querySelectorAll('article').forEach(a => a.querySelectorAll('.cp-text').forEach(p => linkify(p, { skipTerms: [a.dataset.entry] })));
        overlay.querySelectorAll('[data-link]').forEach(b => {
            const t = cfg.topics.find(x => x.id === b.dataset.link);
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
                <input id="cp-search" type="search" value="${esc(state.search)}" placeholder="${esc(cfg.placeholder)}"
                    class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
                <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Show</h4>
                <div class="flex flex-wrap gap-1.5">${seg('all', 'All')}${cfg.groups.map(g => seg(g, g)).join('')}</div>
            </div>
            <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(cfg.remember.title)}</div>
                <div class="text-xs leading-relaxed">${esc(cfg.remember.text)}</div>
            </div>
            <p class="text-xs text-slate-500 leading-relaxed">${esc(cfg.footnote)}</p>`;
        const s = controlsRoot.querySelector('#cp-search');
        s.oninput = () => { state.search = s.value; renderPage(); };
        controlsRoot.querySelectorAll('[data-group]').forEach(b => b.onclick = () => {
            state.group = b.dataset.group;
            renderPage();
            renderControls();
        });
    }

    return {
        draw(svg) {
            svgRef = svg;
            svg.style.display = 'none';
            overlay = document.createElement('div');
            overlay.dataset.moduleOverlay = cfg.id;
            overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
            svg.parentElement.appendChild(overlay);
            const focus = takeFocus(cfg.id);   // topic id, from the search
            const t = cfg.topics.find(x => x.id === focus);
            if (t) Object.assign(state, { search: t.title, group: 'all' });
            renderPage();
        },
        loadControls(container) {
            controlsRoot = container;
            renderControls();
        },
        unload() {
            overlay?.remove();
            if (svgRef) svgRef.style.display = '';
            overlay = svgRef = null;
        }
    };
}
