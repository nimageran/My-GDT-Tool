// js/search.js
// Search everything: type what you see on a drawing (a word, an
// abbreviation, a symbol name, a fit like 25 H7/g6) and jump to the tool
// that explains it, already showing that item.
// Opens from the header button, or with "/" or Ctrl+K anywhere.

import { GDT_HIERARCHY } from './config.js';

let index = null;          // built on first open (loads the data modules)
let results = [];
let active = 0;
let modal = null;

const TYPES = {
    fit: { label: 'Fit', cls: 'bg-rose-100 text-rose-800' },
    thread: { label: 'Thread', cls: 'bg-teal-100 text-teal-800' },
    tool: { label: 'Tool', cls: 'bg-blue-100 text-blue-800' },
    symbol: { label: 'Symbol', cls: 'bg-indigo-100 text-indigo-800' },
    term: { label: 'Term', cls: 'bg-emerald-100 text-emerald-800' },
    note: { label: 'Note', cls: 'bg-amber-100 text-amber-800' },
    line: { label: 'Line / view', cls: 'bg-slate-200 text-slate-800' },
    field: { label: 'Title block', cls: 'bg-sky-100 text-sky-800' },
    step: { label: 'How to read', cls: 'bg-violet-100 text-violet-800' },
    compare: { label: 'ASME vs ISO', cls: 'bg-lime-100 text-lime-800' },
    planned: { label: 'Coming soon', cls: 'bg-slate-100 text-slate-500' }
};

const SUGGESTIONS = ['H7/g6', 'TYP', 'all around', 'bonus', 'datum', 'first angle', 'Ra', 'counterbore', 'revision', 'fillet weld'];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym, focus) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym, focus } }));

// --------------------------------------------------------------------------
// Index
// --------------------------------------------------------------------------

async function buildIndex() {
    const [ex, gl, sf, notes, lines, tb, rc, ai] = await Promise.all([
        import('./explain.js'), import('./glossary.js'), import('./modules/decode/symbol_finder.js'),
        import('./modules/drawing/drawing_notes.js'), import('./modules/drawing/lines_views.js'),
        import('./modules/drawing/title_block.js'), import('./modules/drawing/read_checklist.js'),
        import('./modules/learn/asme_iso.js')
    ]);
    const items = [];

    // Tools (and planned tools, so a search says what is coming)
    for (const [cat, tab] of Object.entries(GDT_HIERARCHY)) {
        for (const [sym, t] of Object.entries(tab.symbols)) {
            const e = ex.EXPLAIN[ex.ALIASES[sym] ?? sym];
            const body = e ? [e.title, ...e.terms.flat(), ...e.simple].join(' ').replace(/\*\*/g, '') : '';
            items.push({
                type: t.planned ? 'planned' : 'tool', title: t.name, sub: `${tab.label}${t.group ? ' · ' + t.group : ''}`,
                keys: [sym.replace(/_/g, ' ')], text: `${body} ${t.summary ?? ''}`, boost: t.planned ? -5 : 6,
                open: () => go(cat, sym)
            });
        }
    }
    // Drawing symbols
    const fam = Object.fromEntries(sf.FAMILIES.map(f => [f.key, f.label]));
    for (const s of sf.SYMBOLS) {
        items.push({
            type: 'symbol', title: s.name, sub: fam[s.family], keys: (s.aliases ?? '').split(/\s+/).filter(Boolean),
            text: s.meaning, snippet: s.meaning, open: () => go('DECODE', 'symbol_finder', s.name)
        });
    }
    // Glossary
    for (const g of gl.GLOSSARY) {
        items.push({
            type: 'term', title: g.term, sub: 'Glossary', keys: g.match, text: `${g.meaning} ${g.example ?? ''}`, snippet: g.meaning,
            open: () => { window.__glossaryFocus = g.term; go('LEARN', 'glossary'); }
        });
    }
    // Notes & abbreviations, lines & views
    const dict = (list, type, sym, sub) => list.forEach(e => items.push({
        type, title: e.name, sub, keys: [e.aka ?? ''], text: `${e.meaning} ${e.example ?? ''}`, snippet: e.meaning,
        open: () => go('DECODE', sym, e.name)
    }));
    dict(notes.ABBREVIATIONS, 'note', 'drawing_notes', 'Abbreviation');
    dict(notes.NOTES, 'note', 'drawing_notes', 'Common note');
    dict(lines.LINES, 'line', 'lines_views', 'Line type');
    dict(lines.VIEWS, 'line', 'lines_views', 'View type');
    // Title block fields
    for (const [id, f] of Object.entries(tb.FIELD_INFO)) {
        items.push({
            type: 'field', title: f.name, sub: 'Title block field', keys: [id], text: `${f.meaning} ${f.check}`, snippet: f.meaning,
            open: () => go('DECODE', 'title_block', id)
        });
    }
    // Steps of the reading order
    rc.STEPS.forEach((s, i) => {
        if (i === 0) return;
        items.push({
            type: 'step', title: `Step ${i}: ${s.title}`, sub: 'How to Read a Drawing', keys: [], text: `${s.look} ${s.check.join(' ')}`, snippet: s.look,
            boost: -2, open: () => go('DECODE', 'read_checklist', i)
        });
    });
    // ASME vs ISO differences
    for (const t of ai.TOPICS) {
        items.push({
            type: 'compare', title: t.title, sub: 'ASME vs ISO GPS', keys: [], text: `${t.asme} ${t.iso} ${t.you}`, snippet: t.you,
            open: () => go('LEARN', 'asme_iso', t.id)
        });
    }
    return items;
}

// --------------------------------------------------------------------------
// Matching
// --------------------------------------------------------------------------

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function score(item, phrase, words) {
    const title = item.title.toLowerCase();
    const keys = item.keys.map(k => k.toLowerCase());
    const body = item.text.toLowerCase();
    let s = 0;
    if (title === phrase || keys.includes(phrase)) s += 100;
    else if (title.startsWith(phrase)) s += 60;
    else if (keys.some(k => k.startsWith(phrase))) s += 45;
    else if (title.includes(phrase)) s += 30;
    for (const w of words) {
        const start = new RegExp(`(^|[^a-z0-9])${reEsc(w)}`);
        if (start.test(title)) s += 20;
        else if (keys.some(k => start.test(k))) s += 15;
        else if (title.includes(w)) s += 8;
        else if (start.test(body)) s += w.length > 2 ? 4 : 1;
        else if (w.length > 3 && body.includes(w)) s += 1;
        else return 0;                                    // every word must match somewhere
    }
    return s + (item.boost ?? 0);
}

// A fit callout: "25 H7/g6", "Ø25 h7/g6", "H7", "g6"
async function fitResult(q) {
    const m = /^\s*[øØ]?\s*(\d+(?:\.\d+)?)?\s*([a-zA-Z]{1,2})\s*(\d{1,2})\s*(?:\/\s*([a-zA-Z]{1,2})\s*(\d{1,2}))?\s*$/.exec(q);
    if (!m) return null;
    const iso = await import('./modules/stackups/iso286.js');
    const size = m[1] ? +m[1] : undefined;
    let hole, shaft;
    if (m[4]) {
        hole = { letter: m[2].toUpperCase(), grade: +m[3] };
        shaft = { letter: m[4].toLowerCase(), grade: +m[5] };
    } else if (m[2][0] === m[2][0].toUpperCase()) hole = { letter: m[2].toUpperCase(), grade: +m[3] };
    else shaft = { letter: m[2].toLowerCase(), grade: +m[3] };
    const ok = c => !c || ((c === hole ? iso.HOLE_LETTERS : iso.SHAFT_LETTERS).includes(c.letter) && iso.GRADES.includes(c.grade));
    if (!ok(hole) || !ok(shaft) || (size !== undefined && !(size > 0 && size <= 500))) return null;
    const cls = c => `${c.letter}${c.grade}`;
    const label = `${size ? 'Ø' + size + ' ' : ''}${[hole, shaft].filter(Boolean).map(cls).join('/')}`;
    let snippet = hole && !shaft ? `${cls(hole)} is a hole tolerance class (capital letter).`
        : shaft && !hole ? `${cls(shaft)} is a shaft tolerance class (small letter).` : 'A hole and shaft fit.';
    if (size && hole && shaft) {
        const f = iso.computeFit(size, hole, shaft);
        const mm = d => (size + d / 1000).toFixed(3);
        snippet = `Hole ${mm(f.hole.lower)} to ${mm(f.hole.upper)}, shaft ${mm(f.shaft.lower)} to ${mm(f.shaft.upper)}: ${f.type} fit.`;
    }
    return {
        type: 'fit', title: `ISO fit ${label}`, sub: 'Stack-ups & Fits · ISO Fits', snippet,
        open: () => go('STACKUPS', 'fits', { size, hole, shaft })
    };
}

// A metric thread: "M6", "M8x1", "M10 x 1.25"
async function threadResult(q) {
    const m = /^\s*M\s*(\d+(?:\.\d+)?)\s*(?:[x×]\s*(\d+(?:\.\d+)?))?\s*(?:-\s*\w+)?\s*$/i.exec(q);
    if (!m) return null;
    const { COARSE } = await import('./modules/decode/hole_callouts.js');
    const size = +m[1], coarse = COARSE[size];
    if (!coarse && !m[2]) return null;
    const pitch = m[2] ? +m[2] : coarse;
    const kind = pitch === coarse ? 'coarse pitch' : 'fine pitch';
    return {
        type: 'thread', title: `Metric thread M${size} × ${pitch}`, sub: 'Read Drawings · Holes, Threads & Patterns',
        snippet: `${size} mm outside diameter, ${pitch} mm between threads (${kind}). Tap drill about Ø${(size - pitch).toFixed(1)}.`,
        open: () => go('DECODE', 'hole_callouts', { thread: { size, pitch } })
    };
}

async function search(q) {
    const phrase = q.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!phrase) return [];
    const words = phrase.split(' ');
    const ranked = index.map(it => ({ it, s: score(it, phrase, words) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s);
    // Keep the first few whatever they are (a passing mention can still be the
    // useful one), then drop weak matches when strong ones exist
    const cut = ranked.length ? ranked[0].s * 0.2 : 0;
    const found = ranked.filter((r, i) => i < 6 || r.s >= cut).slice(0, 14).map(r => r.it);
    const thread = await threadResult(q);
    if (thread) found.unshift(thread);
    const fit = await fitResult(q);
    if (!fit) return found;
    // A full callout ("25 H7/g6") is surely a fit; a bare "M6" may be a thread, so list it lower
    const surely = /\/|\d\s*[a-zA-Z]/.test(q.trim().replace(/^[øØ]/, ''));
    const at = surely ? 0 : Math.min(3, found.length);
    return [...found.slice(0, at), fit, ...found.slice(at, 13)];
}

// --------------------------------------------------------------------------
// Palette UI
// --------------------------------------------------------------------------

// Mark the query words where they start a word, working on the plain text
// so the markup can never be broken
function highlight(str, q) {
    const marks = [];
    for (const w of q.trim().split(/\s+/).filter(w => w.length > 1)) {
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${reEsc(w)})`, 'giu');
        for (const m of str.matchAll(re)) marks.push([m.index + m[1].length, m.index + m[0].length]);
    }
    marks.sort((a, b) => a[0] - b[0]);
    let out = '', at = 0;
    for (const [a, b] of marks) {
        if (a < at) continue;
        out += esc(str.slice(at, a)) + `<mark class="bg-yellow-100 text-inherit rounded px-0.5">${esc(str.slice(a, b))}</mark>`;
        at = b;
    }
    return out + esc(str.slice(at));
}

async function open(prefill = '') {
    if (modal) return;
    modal = document.createElement('div');
    modal.id = 'search-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 pt-[8vh]';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Search">
        <div class="flex items-center gap-3 px-4 border-b border-slate-200">
          <i class="fa-solid fa-magnifying-glass text-slate-400"></i>
          <input id="search-input" type="text" autocomplete="off" spellcheck="false"
            placeholder="What do you see on the drawing? e.g. TYP, H7/g6, all around, datum"
            class="flex-1 py-4 text-lg outline-none bg-transparent text-slate-900 placeholder:text-slate-400">
          <kbd class="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div id="search-results" class="max-h-[60vh] overflow-y-auto"></div>
        <div class="px-4 py-2 border-t border-slate-100 text-xs text-slate-500 flex gap-4">
          <span><kbd class="border border-slate-200 rounded px-1">↑</kbd> <kbd class="border border-slate-200 rounded px-1">↓</kbd> move</span>
          <span><kbd class="border border-slate-200 rounded px-1">Enter</kbd> open</span>
          <span class="ml-auto">Searches tools, symbols, glossary, notes, lines &amp; views, ASME vs ISO, fits and threads</span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    const input = modal.querySelector('#search-input');
    input.value = prefill;
    input.focus();
    input.addEventListener('input', () => update(input.value));
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    const box = modal.querySelector('#search-results');
    if (!index) {
        box.innerHTML = '<p class="px-4 py-6 text-slate-500">Loading…</p>';
        index = await buildIndex();
    }
    update(input.value);
}

function close() {
    modal?.remove();
    modal = null;
}

let seq = 0;
async function update(q) {
    const box = modal?.querySelector('#search-results');
    if (!box || !index) return;
    const mine = ++seq;
    const list = await search(q);
    if (mine !== seq || !modal) return;                 // a newer keystroke won
    results = list;
    active = 0;
    if (!q.trim()) {
        box.innerHTML = `
          <div class="px-4 py-5">
            <p class="text-sm text-slate-600 mb-3">Type a word, an abbreviation or a callout from your drawing. For example:</p>
            <div class="flex flex-wrap gap-2">${SUGGESTIONS.map(s => `<button data-suggest="${esc(s)}" class="text-sm px-3 py-1 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-700 font-mono">${esc(s)}</button>`).join('')}</div>
            <p class="text-sm text-slate-500 mt-4">Only know what a symbol looks like? Open the <button data-open-finder class="text-blue-700 font-semibold hover:underline">Symbol Finder</button> and browse by picture.</p>
          </div>`;
        box.querySelectorAll('[data-suggest]').forEach(b => b.onclick = () => {
            const input = modal.querySelector('#search-input');
            input.value = b.dataset.suggest;
            input.focus();
            update(input.value);
        });
        box.querySelector('[data-open-finder]').onclick = () => { close(); go('DECODE', 'symbol_finder'); };
        return;
    }
    if (!list.length) {
        box.innerHTML = `<div class="px-4 py-6 text-slate-600">
            <p>Nothing found for "<b>${esc(q)}</b>".</p>
            <p class="text-sm text-slate-500 mt-1">Try a shorter or different word. For a symbol you cannot name, open the <button data-open-finder class="text-blue-700 font-semibold hover:underline">Symbol Finder</button>.</p></div>`;
        box.querySelector('[data-open-finder]').onclick = () => { close(); go('DECODE', 'symbol_finder'); };
        return;
    }
    box.innerHTML = list.map((r, i) => `
        <button data-i="${i}" class="search-row w-full text-left px-4 py-2.5 flex items-start gap-3 border-b border-slate-50 hover:bg-blue-50">
          <span class="shrink-0 mt-0.5 text-[11px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 w-24 text-center ${TYPES[r.type].cls}">${TYPES[r.type].label}</span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-slate-900">${highlight(r.title, q)} <span class="font-normal text-xs text-slate-500">${esc(r.sub)}</span></span>
            ${r.snippet ? `<span class="block text-sm text-slate-600 truncate">${highlight(r.snippet, q)}</span>` : ''}
          </span>
        </button>`).join('');
    box.querySelectorAll('.search-row').forEach(b => {
        b.onclick = () => choose(+b.dataset.i);
        b.onmousemove = () => { if (active !== +b.dataset.i) setActive(+b.dataset.i); };
    });
    setActive(0);
}

function setActive(i) {
    if (!results.length || !modal) return;
    active = (i + results.length) % results.length;
    modal.querySelectorAll('.search-row').forEach((b, j) => {
        b.classList.toggle('bg-blue-50', j === active);
        if (j === active) b.scrollIntoView({ block: 'nearest' });
    });
}

function choose(i) {
    const r = results[i];
    if (!r) return;
    close();
    r.open();
}

export function initSearch() {
    document.getElementById('searchBtn')?.addEventListener('click', () => open());
    document.addEventListener('keydown', e => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
        if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing && !modal)) {
            e.preventDefault();
            open();
        }
    });
}
