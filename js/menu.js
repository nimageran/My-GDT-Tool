// js/menu.js
// Application-style navigation: a menu bar of tabs, each opening a drop-down
// of its tools (in columns by group, with a one-line description), plus a
// path bar showing where you are with previous / next buttons.
// Behaves like a desktop menu: click a tab to open it; while one is open,
// hovering another tab switches to it; Esc or a click outside closes it.

import { GDT_HIERARCHY } from './config.js';
import { EXPLAIN, ALIASES } from './explain.js';

const nav = document.getElementById('categoryNav');
const crumbs = document.getElementById('pathCrumbs');
const count = document.getElementById('pathCount');
const prevBtn = document.getElementById('prevTool');
const nextBtn = document.getElementById('nextTool');

let pick = null;                 // (cat, sym) => void, supplied by main.js
let panel = null, openCat = null;
const active = { cat: null, sym: null };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const firstSentence = s => (s.match(/^.*?[.?!](\s|$)/)?.[0] ?? s).trim();

/** One-line description of a tool for the menu. */
export function toolDesc(sym, d) {
    if (d.desc) return d.desc;
    const e = EXPLAIN[ALIASES[sym] ?? sym];
    if (e) return firstSentence(e.simple[0].replace(/\*\*/g, ''));
    return d.summary ? firstSentence(d.summary) : '';
}

const tools = cat => Object.entries(GDT_HIERARCHY[cat].symbols);
const single = cat => tools(cat).length === 1;

// --------------------------------------------------------------------------
// Menu bar
// --------------------------------------------------------------------------

const TAB = 'shrink-0 px-2 py-1.5 rounded-md text-[13px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors';
const TAB_IDLE = 'text-slate-300 hover:text-white hover:bg-slate-800';
const TAB_OPEN = 'bg-slate-700 text-white';
const TAB_ACTIVE = 'bg-blue-600 text-white';

function renderBar() {
    nav.innerHTML = '';
    for (const [cat, tab] of Object.entries(GDT_HIERARCHY)) {
        const b = document.createElement('button');
        b.dataset.cat = cat;
        b.setAttribute('role', 'menuitem');
        if (!single(cat)) b.setAttribute('aria-haspopup', 'true');
        // Home is an icon (the logo also goes home), to keep the bar on one line
        if (cat === 'HOME') { b.title = 'Home: start page'; b.setAttribute('aria-label', 'Home'); }
        b.innerHTML = cat === 'HOME' ? '<i class="fa-solid fa-house text-sm"></i>'
            : `<span>${esc(tab.label)}</span>${single(cat) ? '' : '<i class="fa-solid fa-chevron-down text-[9px] opacity-60"></i>'}`;
        b.onclick = e => {
            e.stopPropagation();
            if (single(cat)) { close(); pick(cat, tools(cat)[0][0]); }
            else if (openCat === cat) close();
            else open(cat);
        };
        b.onmouseenter = () => {
            if (!openCat || openCat === cat) return;
            if (single(cat)) close(); else open(cat);
        };
        nav.appendChild(b);
    }
    styleBar();
    fitBar();
}

// Show the tabs only when they all fit on one line; otherwise the ☰ button
// opens the same tools as a full-screen list.
const menuBtn = document.getElementById('mobileMenuBtn');
function fitBar() {
    nav.classList.remove('hidden');
    const fits = nav.scrollWidth <= nav.clientWidth + 1;
    nav.classList.toggle('hidden', !fits);
    menuBtn.classList.toggle('hidden', fits);
}
new ResizeObserver(() => fitBar()).observe(document.querySelector('header'));

function styleBar() {
    nav.querySelectorAll('button[data-cat]').forEach(b => {
        const c = b.dataset.cat;
        b.className = `${TAB} ${c === openCat ? TAB_OPEN : c === active.cat ? TAB_ACTIVE : TAB_IDLE}`;
        b.setAttribute('aria-expanded', String(c === openCat));
    });
}

// --------------------------------------------------------------------------
// Drop-down
// --------------------------------------------------------------------------

/** Pack the tab's groups into a few columns of about the same height. */
function columns(cat) {
    const groups = [];
    for (const [sym, d] of tools(cat)) {
        const name = d.group ?? '';
        if (!groups.length || groups[groups.length - 1].name !== name) groups.push({ name, items: [] });
        groups[groups.length - 1].items.push([sym, d]);
    }
    const total = tools(cat).length;
    const target = Math.max(5, Math.ceil(total / 3));
    const cols = [];
    for (const g of groups) {
        const last = cols[cols.length - 1];
        const size = last ? last.reduce((n, x) => n + x.items.length, 0) : Infinity;
        if (last && size + g.items.length <= target) last.push(g);
        else cols.push([g]);
    }
    return cols;
}

function item(cat, sym, d) {
    const on = cat === active.cat && sym === active.sym;
    const badge = d.planned
        ? '<span class="ml-1.5 text-[10px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 rounded px-1.5 py-0.5">soon</span>'
        : d.legacy ? '<span class="ml-1.5 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded px-1.5 py-0.5" title="Removed in ASME Y14.5-2018; kept for older drawings">2009</span>' : '';
    return `
      <button data-sym="${sym}" role="menuitem" class="menu-item w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors ${on ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-100 focus:bg-slate-100'} ${d.planned ? 'opacity-70' : ''} outline-none">
        <span class="shrink-0 w-8 h-8 rounded-md ${on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-mono font-bold text-base leading-none">${esc(d.iconChar)}</span>
        <span class="min-w-0">
          <span class="flex items-center text-sm font-semibold ${d.planned ? 'text-slate-500' : 'text-slate-900'}">${esc(d.name)}${badge}</span>
          <span class="block text-xs text-slate-500 leading-snug mt-0.5">${esc(toolDesc(sym, d))}</span>
        </span>
      </button>`;
}

function open(cat) {
    close(false);
    openCat = cat;
    panel = document.createElement('div');
    panel.id = 'menuPanel';
    panel.setAttribute('role', 'menu');
    panel.className = 'fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 flex flex-wrap gap-2';
    panel.style.maxWidth = 'calc(100vw - 16px)';
    panel.innerHTML = columns(cat).map(col => `
        <div class="w-[18rem] space-y-2">
          ${col.map(g => `
            <div>
              ${g.name ? `<div class="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">${esc(g.name)}</div>` : ''}
              ${g.items.map(([sym, d]) => item(cat, sym, d)).join('')}
            </div>`).join('')}
        </div>`).join('');
    document.body.appendChild(panel);

    // Place under the tab, kept inside the window
    const r = nav.querySelector(`[data-cat="${cat}"]`).getBoundingClientRect();
    panel.style.top = `${r.bottom + 6}px`;
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - panel.offsetWidth - 8))}px`;

    panel.querySelectorAll('.menu-item').forEach(b => b.onclick = () => { close(); pick(cat, b.dataset.sym); });
    panel.addEventListener('keydown', e => {
        const items = [...panel.querySelectorAll('.menu-item')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    styleBar();
}

function close(restyle = true) {
    panel?.remove();
    panel = null;
    openCat = null;
    if (restyle) styleBar();
}

document.addEventListener('click', e => {
    if (panel && !panel.contains(e.target) && !nav.contains(e.target) && !crumbs.contains(e.target)) close();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel) {
        const cat = openCat;
        close();
        nav.querySelector(`[data-cat="${cat}"]`)?.focus();
    }
});
window.addEventListener('resize', () => close());

// --------------------------------------------------------------------------
// Phones: every tab and tool in one full-screen list (tabs open like an accordion)
// --------------------------------------------------------------------------

let sheet = null;

export function openMobileMenu() {
    closeMobileMenu();
    let expanded = active.cat && !single(active.cat) ? active.cat : null;
    sheet = document.createElement('div');
    sheet.id = 'mobileMenu';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'All tools');
    sheet.className = 'fixed inset-0 z-50 bg-white flex flex-col';
    const render = () => {
        sheet.innerHTML = `
          <div class="shrink-0 flex items-center justify-between px-4 h-12 border-b border-slate-200 bg-slate-900 text-white">
            <span class="font-bold">All tools</span>
            <button data-close class="w-10 h-10 -mr-2 text-slate-200" aria-label="Close"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            ${Object.entries(GDT_HIERARCHY).map(([cat, tab]) => {
                const one = single(cat), open = cat === expanded, on = cat === active.cat;
                return `
                  <div class="border-b border-slate-100">
                    <button data-tab="${cat}" class="w-full flex items-center justify-between px-3 py-3 text-left font-semibold ${on ? 'text-blue-700' : 'text-slate-800'}" aria-expanded="${open}">
                      <span>${esc(tab.label)} ${one ? '' : `<span class="text-xs font-normal text-slate-400 ml-1">${tools(cat).length}</span>`}</span>
                      <i class="fa-solid ${one ? 'fa-chevron-right' : open ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs text-slate-400"></i>
                    </button>
                    ${open ? `<div class="pb-2">${tools(cat).map(([sym, d]) => item(cat, sym, d)).join('')}</div>` : ''}
                  </div>`;
            }).join('')}
          </div>`;
        sheet.querySelector('[data-close]').onclick = closeMobileMenu;
        sheet.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
            const cat = b.dataset.tab;
            if (single(cat)) { closeMobileMenu(); pick(cat, tools(cat)[0][0]); return; }
            expanded = expanded === cat ? null : cat;
            render();
            sheet.querySelector(`[data-tab="${cat}"]`)?.scrollIntoView({ block: 'nearest' });
        });
        sheet.querySelectorAll('.menu-item').forEach(b => b.onclick = () => {
            const cat = b.closest('div.border-b').querySelector('[data-tab]').dataset.tab;
            closeMobileMenu();
            pick(cat, b.dataset.sym);
        });
    };
    render();
    document.body.appendChild(sheet);
}

export function closeMobileMenu() {
    sheet?.remove();
    sheet = null;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet) closeMobileMenu(); });

// --------------------------------------------------------------------------
// Path bar
// --------------------------------------------------------------------------

const built = cat => tools(cat).filter(([, d]) => !d.planned).map(([s]) => s);

function renderPath() {
    const { cat, sym } = active;
    const tab = GDT_HIERARCHY[cat], d = tab.symbols[sym];
    const sep = '<li class="text-slate-300"><i class="fa-solid fa-chevron-right text-[10px]"></i></li>';
    const parts = [`<li><button data-home class="hover:text-blue-700" title="Start page"><i class="fa-solid fa-house"></i></button></li>`];
    if (cat !== 'HOME') {
        parts.push(sep.replace('class="text-slate-300"', 'class="hidden sm:block text-slate-300"'), `<li class="hidden sm:block"><button data-open-tab="${cat}" class="hover:text-blue-700 hover:underline">${esc(tab.label)}</button></li>`);
        if (d.group) parts.push(sep.replace('class="text-slate-300"', 'class="hidden md:block text-slate-300"'), `<li class="hidden md:block">${esc(d.group)}</li>`);
    }
    parts.push(sep, `<li class="font-semibold text-slate-900 truncate">${esc(d.name)}</li>`);
    crumbs.innerHTML = parts.join('');
    crumbs.querySelector('[data-home]').onclick = () => { close(); pick('HOME', 'home'); };
    const t = crumbs.querySelector('[data-open-tab]');
    if (t) t.onclick = e => { e.stopPropagation(); openCat === cat ? close() : open(cat); };

    const list = built(cat), i = list.indexOf(sym);
    count.textContent = list.length > 1 && i >= 0 ? `${i + 1} of ${list.length}` : '';
    prevBtn.disabled = !(i > 0);
    nextBtn.disabled = !(i >= 0 && i < list.length - 1);
    prevBtn.onclick = () => { if (i > 0) pick(cat, list[i - 1]); };
    nextBtn.onclick = () => { if (i < list.length - 1) pick(cat, list[i + 1]); };
}

// --------------------------------------------------------------------------

export function initMenu(onPick) {
    pick = onPick;
    renderBar();
}

/** The tool now open: { cat, sym, name }. */
export function getActive() {
    const d = GDT_HIERARCHY[active.cat]?.symbols[active.sym];
    return d ? { cat: active.cat, sym: active.sym, name: d.name } : null;
}

/** Called by main.js whenever a tool is loaded. */
export function setActive(cat, sym) {
    active.cat = cat;
    active.sym = sym;
    styleBar();
    renderPath();
}
