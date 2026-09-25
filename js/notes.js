// js/notes.js
// My Notebook: storage, the note editor (used by the Notebook page and by
// the "+ Note" button in the path bar), and backup export / import.
// Notes live in this browser's localStorage, so export is the backup.
// Changes fire window event 'gdt:notes-changed'.

const STORE = 'notebook_v1';

export const NOTE_TYPES = {
    convention: { label: 'Company / customer rule', cls: 'bg-blue-100 text-blue-800', icon: 'fa-building' },
    callout: { label: 'Decoded callout', cls: 'bg-indigo-100 text-indigo-800', icon: 'fa-crosshairs' },
    lesson: { label: 'Lesson learned', cls: 'bg-amber-100 text-amber-800', icon: 'fa-lightbulb' },
    general: { label: 'General', cls: 'bg-slate-200 text-slate-700', icon: 'fa-note-sticky' }
};

export const CHEAT_SHEET = {
    type: 'convention',
    title: 'Company cheat sheet: ',
    body: [
        'Standard (ASME Y14.5-2018 / 2009 / ISO): ',
        'Units: ',
        'Projection (third / first angle): ',
        'Default tolerances: X ±   X.X ±   X.XX ±   angles ±',
        'General tolerance note (e.g. ISO 2768-m): ',
        'Default surface finish: ',
        'Edge break / deburr rule: ',
        'Dimensions before or after coating: ',
        'How revisions are released: ',
        'Who to ask about drawings: '
    ].join('\n'),
    tags: ['cheat sheet']
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const changed = () => window.dispatchEvent(new CustomEvent('gdt:notes-changed'));

// --------------------------------------------------------------------------
// Storage
// --------------------------------------------------------------------------

export function loadNotes() {
    try {
        const d = JSON.parse(localStorage.getItem(STORE));
        return Array.isArray(d?.notes) ? d.notes : [];
    } catch { return []; }
}

function saveNotes(notes) {
    try {
        localStorage.setItem(STORE, JSON.stringify({ version: 1, notes }));
        return true;
    } catch {
        alert('Could not save: this browser is blocking storage (private window?). Export your notes to keep them.');
        return false;
    }
}

export function upsertNote(note) {
    const notes = loadNotes();
    const now = new Date().toISOString();
    const i = notes.findIndex(n => n.id === note.id);
    if (i >= 0) notes[i] = { ...notes[i], ...note, updated: now };
    else notes.push({ pinned: false, tags: [], ...note, id: note.id ?? `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, created: now, updated: now });
    if (saveNotes(notes)) changed();
}

export function deleteNote(id) {
    if (saveNotes(loadNotes().filter(n => n.id !== id))) changed();
}

export function togglePin(id) {
    const notes = loadNotes();
    const n = notes.find(x => x.id === id);
    if (!n) return;
    n.pinned = !n.pinned;
    if (saveNotes(notes)) changed();
}

/** Pinned first, then the most recently changed. */
export function sortedNotes(notes = loadNotes()) {
    return [...notes].sort((a, b) => (b.pinned - a.pinned) || String(b.updated).localeCompare(String(a.updated)));
}

// --------------------------------------------------------------------------
// Backup
// --------------------------------------------------------------------------

function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const today = () => new Date().toISOString().slice(0, 10);

export function exportJSON() {
    download(`gdt-notebook-${today()}.json`, JSON.stringify({ app: 'GDT tool notebook', version: 1, exported: new Date().toISOString(), notes: loadNotes() }, null, 2), 'application/json');
}

export function exportText() {
    const lines = [`MY GD&T NOTEBOOK (exported ${today()})`, ''];
    for (const n of sortedNotes()) {
        lines.push(`## ${n.title || '(no title)'}`);
        lines.push(`${NOTE_TYPES[n.type]?.label ?? 'Note'}${n.ref ? ` · ${n.ref}` : ''}${n.tags?.length ? ` · tags: ${n.tags.join(', ')}` : ''}${n.tool ? ` · tool: ${n.tool.name}` : ''}`);
        lines.push('', n.body || '', '', '---', '');
    }
    download(`gdt-notebook-${today()}.md`, lines.join('\n'), 'text/markdown');
}

/** Merge notes from a backup file: new ids are added, same ids keep the newer copy. */
export function importJSON(file) {
    return file.text().then(t => {
        const incoming = JSON.parse(t).notes;
        if (!Array.isArray(incoming)) throw new Error('Not a notebook backup file.');
        const notes = loadNotes();
        let added = 0, updated = 0;
        for (const n of incoming) {
            if (!n?.id) continue;
            const i = notes.findIndex(x => x.id === n.id);
            if (i < 0) { notes.push(n); added++; }
            else if (String(n.updated) > String(notes[i].updated)) { notes[i] = n; updated++; }
        }
        if (saveNotes(notes)) changed();
        return { added, updated };
    });
}

// --------------------------------------------------------------------------
// Editor (modal)
// --------------------------------------------------------------------------

const input = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none';

/**
 * Open the editor. note: an existing note to edit, or defaults for a new one
 * (e.g. { tool: {cat, sym, name} } or the cheat sheet template).
 */
export function openNoteEditor(note = {}) {
    closeNoteEditor();
    const isNew = !note.id;
    const n = { type: 'general', title: '', body: '', ref: '', tags: [], ...note };
    const modal = document.createElement('div');
    modal.id = 'note-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 pt-[6vh] overflow-y-auto';
    modal.innerHTML = `
      <form class="bg-white rounded-xl shadow-2xl w-full max-w-xl" role="dialog" aria-modal="true" aria-label="${isNew ? 'New note' : 'Edit note'}">
        <div class="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-book mr-2 text-blue-600"></i>${isNew ? 'New note' : 'Edit note'}</h2>
          <button type="button" data-close class="text-slate-400 hover:text-slate-700 text-xl px-2" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="px-5 py-4 space-y-3">
          <div class="flex flex-wrap gap-1.5">
            ${Object.entries(NOTE_TYPES).map(([k, t]) => `<label class="cursor-pointer"><input type="radio" name="type" value="${k}" class="peer sr-only" ${n.type === k ? 'checked' : ''}>
              <span class="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 border border-slate-200 text-slate-600 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white"><i class="fa-solid ${t.icon}"></i>${t.label}</span></label>`).join('')}
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">TITLE</label>
            <input name="title" required maxlength="140" value="${esc(n.title)}" placeholder="e.g. Acme Corp: default tolerances" class="${input}"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-xs font-bold text-slate-500 mb-1">DRAWING / PART NO. (OPTIONAL)</label>
              <input name="ref" maxlength="80" value="${esc(n.ref)}" placeholder="e.g. 10-4217 REV C" class="${input}"></div>
            <div><label class="block text-xs font-bold text-slate-500 mb-1">TAGS (COMMA SEPARATED)</label>
              <input name="tags" maxlength="200" value="${esc((n.tags ?? []).join(', '))}" placeholder="e.g. acme, position" class="${input}"></div>
          </div>
          <div><label class="block text-xs font-bold text-slate-500 mb-1">NOTE</label>
            <textarea name="body" rows="9" class="${input} font-mono leading-relaxed" placeholder="What you found out, in your own words.">${esc(n.body)}</textarea></div>
          ${n.tool ? `<div class="flex items-center gap-2 text-sm text-slate-600"><i class="fa-solid fa-link text-slate-400"></i>Linked to <b>${esc(n.tool.name)}</b>
              <label class="ml-auto text-xs flex items-center gap-1"><input type="checkbox" name="keepTool" checked> keep link</label></div>` : ''}
          <p class="text-xs text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Saved in this browser only. Use Export in the notebook to keep a backup.</p>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-4">
          <button type="button" data-close class="text-sm font-bold rounded-lg px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700">Cancel</button>
          <button type="submit" class="text-sm font-bold rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white">Save note</button>
        </div>
      </form>`;
    document.body.appendChild(modal);
    const form = modal.querySelector('form');
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) closeNoteEditor(); });
    modal.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); closeNoteEditor(); }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
    });
    form.onsubmit = e => {
        e.preventDefault();
        const f = new FormData(form);
        const keepTool = n.tool && f.get('keepTool');
        upsertNote({
            ...(isNew ? {} : { id: n.id }),
            type: f.get('type') || 'general',
            title: String(f.get('title')).trim(),
            ref: String(f.get('ref')).trim(),
            tags: String(f.get('tags')).split(',').map(t => t.trim()).filter(Boolean),
            body: String(f.get('body')),
            tool: keepTool ? n.tool : null
        });
        closeNoteEditor();
    };
    // Put the cursor where typing is most likely
    const title = form.querySelector('[name=title]');
    if (n.title.endsWith(': ')) {                       // template: finish the title first
        title.focus();
        title.setSelectionRange(title.value.length, title.value.length);
    } else if (n.title && n.body) {
        const body = form.querySelector('[name=body]');
        body.focus();
        const firstGap = n.body.indexOf(': \n');
        body.setSelectionRange(firstGap >= 0 ? firstGap + 2 : body.value.length, firstGap >= 0 ? firstGap + 2 : body.value.length);
    } else title.focus();
}

export function closeNoteEditor() {
    document.getElementById('note-modal')?.remove();
}
