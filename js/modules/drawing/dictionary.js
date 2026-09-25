// js/modules/drawing/dictionary.js
// Shared page for the "dictionary" tools (lines & views, notes & abbreviations):
// a searchable list of cards, each with an optional small drawing, its
// meaning, an example and a watch-out. HTML beside the (hidden) canvas.

import { linkify } from '../../glossary.js';
import { UI, esc, goTo } from './sheet.js';
import { takeFocus } from '../../focus.js';

/**
 * Create a dictionary tool.
 * cfg: { id, kicker, title, intro, groups: [{ name, entries: [{ name, aka?, sample?, meaning, example?, watch?, see? }] }], tip }
 * sample is an SVG inner-markup string drawn in a 200 × 90 box.
 * Returns the module's { draw, loadControls, unload }.
 */
export function makeDictionary(cfg) {
    const state = { search: '', group: 'all' };
    let svgRef = null, overlay = null, controlsRoot = null;

    const all = cfg.groups.flatMap(g => g.entries.map(e => ({ ...e, group: g.name })));

    function visible() {
        const q = state.search.trim().toLowerCase();
        return all.filter(e => (state.group === 'all' || e.group === state.group) &&
            (!q || `${e.name} ${e.aka ?? ''} ${e.meaning} ${e.example ?? ''}`.toLowerCase().includes(q)));
    }

    function renderList() {
        if (!overlay) return;
        const list = visible();
        const groups = cfg.groups.map(g => ({ name: g.name, items: list.filter(e => e.group === g.name) })).filter(g => g.items.length);
        overlay.innerHTML = `
          <div class="max-w-3xl mx-auto px-6 py-8">
            <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">${esc(cfg.kicker)}</div>
            <h2 class="text-3xl font-extrabold text-slate-900 mb-1">${esc(cfg.title)}</h2>
            <p class="text-slate-600 mb-6 leading-relaxed">${cfg.intro}</p>
            ${list.length === 0 ? '<p class="text-slate-500">Nothing found. Try a shorter word.</p>' : ''}
            ${groups.map(g => `
              <section class="mb-8">
                <h3 class="text-sm font-extrabold text-blue-700 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wide">${esc(g.name)}</h3>
                <div class="space-y-3">
                  ${g.items.map(e => `
                    <article class="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4" data-entry="${esc(e.name)}">
                      ${e.sample ? `<div class="shrink-0 bg-slate-50 border border-slate-100 rounded w-[200px] h-[90px] self-start">
                          <svg viewBox="0 0 200 90" width="200" height="90" aria-hidden="true">${e.sample}</svg></div>` : ''}
                      <div class="min-w-0 flex-1">
                        <div class="flex items-baseline justify-between gap-3">
                          <h4 class="text-lg font-bold text-slate-900">${esc(e.name)}${e.aka ? ` <span class="text-sm font-normal text-slate-500">${esc(e.aka)}</span>` : ''}</h4>
                          ${e.see ? `<button data-see="${esc(e.name)}" class="${UI.link} shrink-0">${esc(e.see[2])} ▶</button>` : ''}
                        </div>
                        <p class="dx-text text-slate-700 mt-1 leading-relaxed">${esc(e.meaning)}</p>
                        ${e.example ? `<p class="dx-text mt-2 text-sm text-slate-600 bg-blue-50 rounded px-3 py-2"><span class="font-semibold text-blue-800">Example:</span> ${esc(e.example)}</p>` : ''}
                        ${e.watch ? `<p class="dx-text mt-2 text-sm text-amber-900 bg-amber-50 rounded px-3 py-2"><span class="font-semibold">Watch out:</span> ${esc(e.watch)}</p>` : ''}
                      </div>
                    </article>`).join('')}
                </div>
              </section>`).join('')}
          </div>`;
        overlay.querySelectorAll('article').forEach(a => a.querySelectorAll('.dx-text').forEach(p => linkify(p, { skipTerms: [a.dataset.entry] })));
        overlay.querySelectorAll('[data-see]').forEach(b => {
            const e = all.find(x => x.name === b.dataset.see);
            b.onclick = () => goTo(e.see[0], e.see[1]);
        });
    }

    function renderControls() {
        if (!controlsRoot) return;
        const seg = (value, label) => `<button data-group="${esc(value)}" class="${UI.segBtn} ${state.group === value ? UI.segOn : UI.segOff}">${esc(label)}</button>`;
        controlsRoot.innerHTML = `
            <div class="${UI.card}">
                <h4 class="${UI.h4}">Search</h4>
                <input id="dx-search" type="search" value="${esc(state.search)}" placeholder="${esc(cfg.placeholder ?? 'Search')}"
                    class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="${UI.card}">
                <h4 class="${UI.h4}">Show</h4>
                <div class="flex flex-wrap gap-1.5">${seg('all', 'All')}${cfg.groups.map(g => seg(g.name, g.name)).join('')}</div>
            </div>
            ${cfg.tip ? `<div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900" data-nogloss>
                <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> Tip</div>
                <div class="text-xs opacity-90 leading-relaxed">${cfg.tip}</div></div>` : ''}`;
        const s = controlsRoot.querySelector('#dx-search');
        s.oninput = () => { state.search = s.value; renderList(); };
        controlsRoot.querySelectorAll('[data-group]').forEach(b => b.onclick = () => {
            state.group = b.dataset.group;
            renderList();
            renderControls();
        });
    }

    return {
        draw(svg) {
            svgRef = svg;
            const f = takeFocus(cfg.id);                     // entry name, from the search
            if (f) Object.assign(state, { search: f, group: 'all' });
            svg.style.display = 'none';
            overlay = document.createElement('div');
            overlay.dataset.moduleOverlay = cfg.id;
            overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
            svg.parentElement.appendChild(overlay);
            renderList();
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

// --- Small SVG-markup helpers for the samples ------------------------------------

const INK = '#0f172a';
export const S = {
    line: (x1, y1, x2, y2, w = 1.2, dash = '') =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`,
    path: (d, w = 1.2, fill = 'none', dash = '') =>
        `<path d="${d}" stroke="${INK}" stroke-width="${w}" fill="${fill}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`,
    rect: (x, y, w, h, sw = 2.2, fill = '#fff') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${INK}" stroke-width="${sw}" fill="${fill}"/>`,
    circle: (cx, cy, r, w = 2.2, dash = '', fill = 'none') =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${INK}" stroke-width="${w}" fill="${fill}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`,
    text: (s, x, y, size = 11, anchor = 'middle', weight = 700) =>
        `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" font-family="ui-monospace, monospace" fill="${INK}">${s}</text>`,
    arrow: (x1, y1, x2, y2) => {
        const a = Math.atan2(y2 - y1, x2 - x1), L = 7, W = 3;
        const p1 = [x2 - L * Math.cos(a) + W * Math.sin(a), y2 - L * Math.sin(a) - W * Math.cos(a)];
        const p2 = [x2 - L * Math.cos(a) - W * Math.sin(a), y2 - L * Math.sin(a) + W * Math.cos(a)];
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1"/><path d="M${x2},${y2} L${p1} L${p2} Z" fill="${INK}"/>`;
    },
    hatch: (x, y, w, h, id) =>
        `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="${INK}" stroke-width="0.8"/></pattern></defs>` +
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>`
};
export const DASH = { hidden: '6 3', center: '16 3 3 3', phantom: '16 3 3 3 3 3' };
