// js/modules/learn/notebook.js
// My Notebook page: your own notes (company rules, decoded callouts, lessons
// learned), searchable, with tags, pins and backup. Storage and the editor
// are in js/notes.js. HTML beside the (hidden) canvas.

import { takeFocus } from '../../focus.js';
import {
    NOTE_TYPES, CHEAT_SHEET, loadNotes, sortedNotes, deleteNote, togglePin,
    openNoteEditor, exportJSON, exportText, importJSON
} from '../../notes.js';

const state = { search: '', type: 'all', tag: null, focus: null };
let svgRef = null, overlay = null, controlsRoot = null;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));
const refresh = () => { renderPage(); renderControls(); };

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'notebook';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);
    state.focus = takeFocus('notebook') ?? null;          // note id, from the search
    if (state.focus) Object.assign(state, { search: '', type: 'all', tag: null });
    window.addEventListener('gdt:notes-changed', refresh);
    renderPage();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

export function unload() {
    window.removeEventListener('gdt:notes-changed', refresh);
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = svgRef = null;
}

function visible() {
    const q = state.search.trim().toLowerCase();
    return sortedNotes().filter(n => (state.type === 'all' || n.type === state.type) &&
        (!state.tag || (n.tags ?? []).includes(state.tag)) &&
        (!q || `${n.title} ${n.body} ${n.ref} ${(n.tags ?? []).join(' ')} ${n.tool?.name ?? ''}`.toLowerCase().includes(q)));
}

const when = iso => { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };

function card(n) {
    const t = NOTE_TYPES[n.type] ?? NOTE_TYPES.general;
    const hi = state.focus === n.id;
    return `
      <article id="note-${esc(n.id)}" class="bg-white border ${hi ? 'border-blue-500 ring-2 ring-blue-200' : n.pinned ? 'border-amber-300' : 'border-slate-200'} rounded-xl p-4">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-[11px] font-bold rounded px-1.5 py-0.5 ${t.cls}"><i class="fa-solid ${t.icon} mr-1"></i>${t.label}</span>
              ${n.ref ? `<span class="text-xs font-mono bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">${esc(n.ref)}</span>` : ''}
              ${n.pinned ? '<span class="text-xs text-amber-600"><i class="fa-solid fa-thumbtack"></i> pinned</span>' : ''}
            </div>
            <h3 class="text-lg font-bold text-slate-900 leading-snug">${esc(n.title) || '<span class="text-slate-400">(no title)</span>'}</h3>
          </div>
          <div class="flex gap-1 shrink-0">
            <button data-pin="${esc(n.id)}" class="w-8 h-8 rounded hover:bg-slate-100 ${n.pinned ? 'text-amber-500' : 'text-slate-400'}" title="${n.pinned ? 'Unpin' : 'Pin to the top'}"><i class="fa-solid fa-thumbtack"></i></button>
            <button data-edit="${esc(n.id)}" class="w-8 h-8 rounded hover:bg-slate-100 text-slate-500" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button data-del="${esc(n.id)}" class="w-8 h-8 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        ${n.body ? `<div class="mt-2 text-sm text-slate-800 whitespace-pre-wrap font-mono leading-relaxed">${esc(n.body)}</div>` : ''}
        <div class="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
          ${(n.tags ?? []).map(tag => `<button data-tag="${esc(tag)}" class="bg-slate-100 hover:bg-blue-100 text-slate-600 rounded-full px-2 py-0.5">#${esc(tag)}</button>`).join('')}
          ${n.tool ? `<button data-tool="${esc(n.tool.cat)}:${esc(n.tool.sym)}" class="text-blue-700 font-semibold hover:underline"><i class="fa-solid fa-link mr-1"></i>${esc(n.tool.name)}</button>` : ''}
          <span class="ml-auto text-slate-400">${n.updated !== n.created ? 'edited ' : ''}${when(n.updated)}</span>
        </div>
      </article>`;
}

function renderPage() {
    if (!overlay) return;
    const all = loadNotes();
    const list = visible();
    const filtered = state.search || state.type !== 'all' || state.tag;
    overlay.innerHTML = `
      <div class="max-w-3xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Learn</div>
        <div class="flex flex-wrap items-end justify-between gap-3 mb-1">
          <h2 class="text-3xl font-extrabold text-slate-900">My Notebook</h2>
          <div class="flex gap-2">
            <button id="nb-cheat" class="text-sm font-bold rounded-lg px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700"><i class="fa-solid fa-building mr-1"></i>Company cheat sheet</button>
            <button id="nb-new" class="text-sm font-bold rounded-lg px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white"><i class="fa-solid fa-plus mr-1"></i>New note</button>
          </div>
        </div>
        <p class="text-slate-600 mb-6 leading-relaxed">Your own notes: each company's rules, callouts you have decoded, and lessons learned. Add one from any tool with <b>+ Note</b> in the bar at the top; global search finds them too.</p>
        ${all.length === 0 ? `
          <div class="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
            <i class="fa-solid fa-book-open text-4xl text-slate-300 mb-3"></i>
            <p class="text-lg font-bold text-slate-800">No notes yet</p>
            <p class="text-slate-600 mt-1 max-w-md mx-auto">A good first note is a <b>company cheat sheet</b>: the standard, units, default tolerances and notes your company or customer always uses.</p>
            <button id="nb-cheat2" class="mt-4 text-sm font-bold rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white">Start a company cheat sheet</button>
          </div>` : `
          ${filtered ? `<p class="text-sm text-slate-500 mb-3">${list.length} of ${all.length} notes shown${state.tag ? ` with #${esc(state.tag)}` : ''}. <button id="nb-clear" class="text-blue-700 font-semibold hover:underline">Show all</button></p>` : ''}
          <div class="space-y-3">${list.map(card).join('') || '<p class="text-slate-500">No note matches. Try a shorter word.</p>'}</div>`}
      </div>`;

    const on = (id, fn) => { const e = overlay.querySelector(id); if (e) e.onclick = fn; };
    on('#nb-new', () => openNoteEditor());
    on('#nb-cheat', () => openNoteEditor({ ...CHEAT_SHEET }));
    on('#nb-cheat2', () => openNoteEditor({ ...CHEAT_SHEET }));
    on('#nb-clear', () => { Object.assign(state, { search: '', type: 'all', tag: null }); refresh(); });
    overlay.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => togglePin(b.dataset.pin));
    overlay.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openNoteEditor(loadNotes().find(n => n.id === b.dataset.edit)));
    overlay.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const n = loadNotes().find(x => x.id === b.dataset.del);
        if (n && confirm(`Delete the note "${n.title}"? This cannot be undone.`)) deleteNote(n.id);
    });
    overlay.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { state.tag = b.dataset.tag; refresh(); });
    overlay.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => go(...b.dataset.tool.split(':')));
    if (state.focus) overlay.querySelector(`#note-${CSS.escape(state.focus)}`)?.scrollIntoView({ block: 'center' });
}

function renderControls() {
    if (!controlsRoot) return;
    const notes = loadNotes();
    const tags = [...new Set(notes.flatMap(n => n.tags ?? []))].sort((a, b) => a.localeCompare(b));
    const segBtn = 'px-2 py-1.5 text-xs font-bold rounded border transition-colors';
    const seg = (v, label, n) => `<button data-type="${v}" class="${segBtn} ${state.type === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}">${esc(label)} <span class="opacity-60">${n}</span></button>`;
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Search my notes</h4>
            <input id="nb-search" type="search" value="${esc(state.search)}" placeholder="e.g. Acme, 10-4217, position"
                class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Show</h4>
            <div class="flex flex-wrap gap-1.5">${seg('all', 'All', notes.length)}${Object.entries(NOTE_TYPES).map(([k, t]) => seg(k, t.label, notes.filter(n => n.type === k).length)).join('')}</div>
            ${tags.length ? `<h4 class="font-bold text-xs text-slate-500 uppercase mt-4 mb-2">Tags</h4>
            <div class="flex flex-wrap gap-1.5">${tags.map(t => `<button data-tagf="${esc(t)}" class="text-xs rounded-full px-2 py-0.5 ${state.tag === t ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-blue-100 text-slate-600'}">#${esc(t)}</button>`).join('')}</div>` : ''}
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Backup</h4>
            <p class="text-xs text-slate-600 mb-2">Notes are kept in this browser only. Clearing browser data, or using another computer, loses them unless you export.</p>
            <div class="grid grid-cols-2 gap-2">
                <button id="nb-export" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-2 rounded text-slate-700 font-bold" ${notes.length ? '' : 'disabled'}><i class="fa-solid fa-download mr-1"></i>BACKUP FILE</button>
                <button id="nb-import" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-2 rounded text-slate-700 font-bold"><i class="fa-solid fa-upload mr-1"></i>RESTORE</button>
                <button id="nb-text" class="col-span-2 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-2 rounded text-slate-700 font-bold" ${notes.length ? '' : 'disabled'}><i class="fa-solid fa-file-lines mr-1"></i>EXPORT AS TEXT (TO PRINT OR SHARE)</button>
            </div>
            <input id="nb-file" type="file" accept=".json,application/json" class="hidden">
            <p id="nb-msg" class="text-xs mt-2 hidden"></p>
        </div>`;
    const s = controlsRoot.querySelector('#nb-search');
    s.oninput = () => { state.search = s.value; state.focus = null; renderPage(); };
    controlsRoot.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { state.type = b.dataset.type; refresh(); });
    controlsRoot.querySelectorAll('[data-tagf]').forEach(b => b.onclick = () => { state.tag = state.tag === b.dataset.tagf ? null : b.dataset.tagf; refresh(); });
    controlsRoot.querySelector('#nb-export').onclick = exportJSON;
    controlsRoot.querySelector('#nb-text').onclick = exportText;
    const file = controlsRoot.querySelector('#nb-file');
    controlsRoot.querySelector('#nb-import').onclick = () => file.click();
    file.onchange = () => {
        const f = file.files[0];
        if (!f) return;
        importJSON(f).then(({ added, updated }) => {
            msg(`Restored: ${added} new, ${updated} updated.`, false);
        }).catch(err => msg(`Could not read that file: ${err.message}`, true));
    };
}

function msg(text, bad) {
    const m = controlsRoot?.querySelector('#nb-msg');
    if (!m) return;
    m.textContent = text;
    m.className = `text-xs mt-2 ${bad ? 'text-red-600' : 'text-green-700'}`;
}
