// js/main.js
import { watchCanvas } from './legibility.js';
import { setFocus } from './focus.js';
import { initSearch } from './search.js';
import { initMenu, setActive, getActive } from './menu.js';
import { openNoteEditor } from './notes.js';
import { GDT_HIERARCHY } from './config.js';
import { createSVG } from './drawing_utils.js';
import { COLORS, text, wrapText } from './theme.js';
import { hasExplanation, openExplain, closeExplain } from './explain.js';
import { linkify } from './glossary.js';
import { getUnits, setUnits } from './units.js';

// --- GLOBAL STATE ---
let activeSymbolKey = null;
let currentModule = null; 

// --- DOM ELEMENTS ---
let canvas = document.getElementById('mainCanvas');
const controlsContent = document.getElementById('controlsContent');

// Sidebar Toggles
const controlsPanel = document.getElementById('controlsPanel');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');
const expandControlsBtn = document.getElementById('expandControlsBtn');
const explainBtn = document.getElementById('explainBtn');

// --- INITIALIZATION ---
function init() {
    initMenu(loadSymbolModule);
    setupSidebarToggle();
    document.getElementById('homeLogo').onclick = () => loadSymbolModule('HOME', 'home');
    // Recorder: note anything from any tool, linked back to it
    document.getElementById('addNoteBtn').onclick = () => {
        const t = getActive();
        openNoteEditor(t && t.cat !== 'HOME' && t.sym !== 'notebook' ? { tool: t } : {});
    };
    document.getElementById('notebookBtn').onclick = () => loadSymbolModule('LEARN', 'notebook');
    setupUnitsToggle();
    // Open on the start page, never straight into a specialist tool
    loadSymbolModule('HOME', 'home');
}

// Roadmap entry: describe the planned tool instead of loading a module
function showPlannedTool(catKey, data) {
    canvas.appendChild(createSVG('rect', {
        x: 170, y: 220, width: 660, height: 300, rx: 16,
        fill: COLORS.card, stroke: COLORS.faint, 'stroke-dasharray': '8 6', 'stroke-width': 1.5
    }));
    canvas.appendChild(text(`ON THE ROADMAP · ${GDT_HIERARCHY[catKey].label.toUpperCase()}`, 210, 270,
        { size: 12, weight: 700, fill: COLORS.nominal, letterSpacing: '0.08em' }));
    canvas.appendChild(text(data.name, 210, 310, { size: 28, weight: 800, fill: COLORS.ink }));
    canvas.appendChild(wrapText(data.summary, 210, 355, 62, 26, { size: 17, fill: COLORS.text }));

    controlsContent.innerHTML = `
        <div class="p-4 bg-slate-50 rounded border border-slate-200 text-sm text-slate-600 space-y-2">
            <p class="font-bold text-slate-700">Not built yet</p>
            <p>${data.name} is planned for the <span class="font-semibold">${GDT_HIERARCHY[catKey].label}</span> tab.
            The description on the canvas is its intended scope.</p>
        </div>`;
}

// --- 4. MODULE LOADING ---
async function loadSymbolModule(catKey, symKey) {
    activeSymbolKey = symKey;
    setActive(catKey, symKey);

    const catData = GDT_HIERARCHY[catKey];
    const symData = catData.symbols[symKey];

    // Stop the previous module (animation loops, listeners) before clearing
    if (currentModule && typeof currentModule.unload === 'function') {
        currentModule.unload();
    }
    currentModule = null;

    // Explain button: shown when this tool has a plain-language explanation
    closeExplain();
    explainBtn.classList.toggle('hidden', !hasExplanation(symKey));

    // Remove anything a module mounted beside the canvas (e.g. a 3D view)
    document.querySelectorAll('[data-module-overlay]').forEach(el => el.remove());

    // Fresh canvas element: drops mouse listeners the old module attached
    const freshCanvas = canvas.cloneNode(false);
    freshCanvas.style.display = '';
    canvas.replaceWith(freshCanvas);
    canvas = freshCanvas;
    watchCanvas(canvas);

    if (symData.planned) {
        showPlannedTool(catKey, symData);
        return;
    }
    controlsContent.innerHTML = '<div class="flex items-center justify-center h-40"><i class="fa-solid fa-circle-notch fa-spin text-blue-500 text-2xl"></i></div>';

    try {
        currentModule = await import(symData.filePath);
        
        if (typeof currentModule.draw === 'function') {
            currentModule.draw(canvas);
        }
        if (typeof currentModule.loadControls === 'function') {
            currentModule.loadControls(controlsContent);
        }

        // Ensure controls are visible when a module loads
        if(controlsPanel.classList.contains('w-0')) {
             toggleSidebar();
        }

    } catch (error) {
        console.error(error);
        controlsContent.innerHTML = `<p class="text-red-500">Error loading ${symData.name}</p>`;
    }
}

// --- UNITS: one mm / inch switch; the open tool reloads in the new unit ---
function setupUnitsToggle() {
    const box = document.getElementById('unitsToggle');
    const paint = () => box.querySelectorAll('[data-u]').forEach(b => {
        const on = b.dataset.u === getUnits();
        b.className = `px-2.5 py-1.5 transition-colors ${on ? 'bg-yellow-500 text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`;
        b.setAttribute('aria-pressed', on);
    });
    box.querySelectorAll('[data-u]').forEach(b => b.onclick = () => setUnits(b.dataset.u));
    window.addEventListener('gdt:units', () => {
        paint();
        const t = getActive();
        if (t) loadSymbolModule(t.cat, t.sym);
    });
    paint();
}

// --- 5. UI UTILITIES (Sidebar Toggle) ---
function toggleSidebar() {
    const isCollapsed = controlsPanel.classList.contains('w-0');
    
    if (isCollapsed) {
        // EXPAND
        controlsPanel.classList.remove('w-0', 'border-none');
        controlsPanel.classList.add('w-[26rem]', 'border-r');
        expandControlsBtn.classList.add('hidden');
    } else {
        // COLLAPSE
        controlsPanel.classList.remove('w-[26rem]', 'border-r');
        controlsPanel.classList.add('w-0', 'border-none'); // Hide width and border
        expandControlsBtn.classList.remove('hidden');
    }
}

function setupSidebarToggle() {
    toggleControlsBtn.onclick = toggleSidebar;
    expandControlsBtn.onclick = toggleSidebar;
    explainBtn.onclick = () => openExplain(activeSymbolKey);
}

// Glossary underlines in the sidebar's explanatory text (notes, warnings,
// descriptions). Tools rebuild their controls often, so watch for changes.
const NOTE_SELECTOR = '.leading-relaxed, li, p';
let glossTimer = null;
const glossObserver = new MutationObserver(() => {
    clearTimeout(glossTimer);
    glossTimer = setTimeout(() => {
        glossObserver.disconnect();
        controlsContent.querySelectorAll(NOTE_SELECTOR).forEach(el => {
            if (!el.querySelector(NOTE_SELECTOR)) linkify(el);
        });
        glossObserver.observe(controlsContent, { childList: true, subtree: true });
    }, 120);
});
glossObserver.observe(controlsContent, { childList: true, subtree: true });

// Tools can open another tool: window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym, focus } }))
// focus (optional): the item the tool should show first (see js/focus.js)
window.addEventListener('gdt:navigate', (e) => {
    const { cat, sym, focus } = e.detail || {};
    if (!GDT_HIERARCHY[cat]?.symbols[sym]) return;
    if (focus !== undefined) setFocus(sym, focus);
    loadSymbolModule(cat, sym);
});

init();
initSearch();
