// js/main.js
import { GDT_HIERARCHY } from './config.js';
import { createSVG } from './drawing_utils.js';
import { COLORS, text, wrapText } from './theme.js';

// --- GLOBAL STATE ---
let activeCategory = null;
let activeSymbolKey = null;
let currentModule = null; 

// --- DOM ELEMENTS ---
const categoryNav = document.getElementById('categoryNav');
const symbolList = document.getElementById('symbolList'); // Changed from symbolNav
const toolbarLabel = document.getElementById('toolbarLabel');
let canvas = document.getElementById('mainCanvas');
const controlsContent = document.getElementById('controlsContent');

// Sidebar Toggles
const controlsPanel = document.getElementById('controlsPanel');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');
const expandControlsBtn = document.getElementById('expandControlsBtn');

// --- INITIALIZATION ---
function init() {
    renderCategoryNav();
    setupSidebarToggle();
    
    // Select default
    const firstCat = Object.keys(GDT_HIERARCHY)[0];
    selectCategory(firstCat);
}

// --- 1. RENDER TOP NAVIGATION (Categories) ---
function renderCategoryNav() {
    categoryNav.innerHTML = '';
    
    for (const [key, data] of Object.entries(GDT_HIERARCHY)) {
        const btn = document.createElement('button');
        // Compact top nav
        btn.className = `px-3 py-1.5 rounded text-xs font-bold uppercase transition-all flex items-center gap-2 border border-transparent`;
        btn.innerHTML = `<span class="hidden 2xl:inline"><i class="fa-solid ${data.icon}"></i></span>${data.label}`;
        btn.onclick = () => selectCategory(key);
        btn.dataset.cat = key; 
        categoryNav.appendChild(btn);
    }
}

// --- 2. HANDLE CATEGORY SELECTION ---
function selectCategory(catKey) {
    activeCategory = catKey;
    toolbarLabel.innerText = GDT_HIERARCHY[catKey].label; // Update toolbar label

    // Styling logic for Top Nav
    document.querySelectorAll('#categoryNav button').forEach(b => {
        if (b.dataset.cat === catKey) {
            b.className = `px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap shrink-0 bg-blue-600 text-white border-blue-500 shadow-sm flex items-center gap-2`;
        } else {
            b.className = `px-3 py-1.5 rounded text-xs font-bold uppercase whitespace-nowrap shrink-0 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-2 border border-transparent`;
        }
    });

    renderSymbolToolbar(catKey);
}

// --- 3. RENDER SECONDARY TOOLBAR (The Ribbon) ---
const PILL = 'group flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap';
const PILL_ACTIVE = 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100';
const PILL_IDLE = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';
const PILL_PLANNED = 'border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:text-slate-600';
const PILL_PLANNED_ACTIVE = 'border-dashed border-slate-400 bg-white text-slate-700 ring-1 ring-slate-200';

function renderSymbolToolbar(catKey) {
    symbolList.innerHTML = '';
    const symbols = GDT_HIERARCHY[catKey].symbols;
    let lastGroup = null;

    for (const [key, data] of Object.entries(symbols)) {
        // Sub-heading when the group changes (e.g. Form | Profile | ...)
        if (data.group && data.group !== lastGroup) {
            const label = document.createElement('span');
            label.className = `text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0 ${lastGroup ? 'border-l border-slate-200 pl-3 ml-1' : ''}`;
            label.textContent = data.group;
            symbolList.appendChild(label);
            lastGroup = data.group;
        }

        const btn = document.createElement('button');
        btn.dataset.sym = key;
        if (data.planned) btn.dataset.planned = 'true';

        const badge = data.planned
            ? '<span class="text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-500 rounded px-1.5 py-0.5">soon</span>'
            : data.legacy
                ? '<span class="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded px-1.5 py-0.5" title="Removed in ASME Y14.5-2018; kept for legacy drawings">2009</span>'
                : '';
        btn.innerHTML = `
            <span class="font-mono font-bold text-lg leading-none">${data.iconChar}</span>
            <span>${data.name}</span>${badge}
        `;
        if (data.legacy) btn.title = 'Removed in ASME Y14.5-2018; kept for legacy drawings';

        btn.onclick = () => loadSymbolModule(catKey, key);
        symbolList.appendChild(btn);
    }

    updateSymbolHighlight(activeSymbolKey);
}

function updateSymbolHighlight(symKey) {
    document.querySelectorAll('#symbolList button').forEach(b => {
        const active = b.dataset.sym === symKey;
        const look = b.dataset.planned
            ? (active ? PILL_PLANNED_ACTIVE : PILL_PLANNED)
            : (active ? PILL_ACTIVE : PILL_IDLE);
        b.className = `${PILL} ${look}`;
    });
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
    updateSymbolHighlight(symKey);

    const catData = GDT_HIERARCHY[catKey];
    const symData = catData.symbols[symKey];

    // Stop the previous module (animation loops, listeners) before clearing
    if (currentModule && typeof currentModule.unload === 'function') {
        currentModule.unload();
    }
    currentModule = null;

    // Remove anything a module mounted beside the canvas (e.g. a 3D view)
    document.querySelectorAll('[data-module-overlay]').forEach(el => el.remove());

    // Fresh canvas element: drops mouse listeners the old module attached
    const freshCanvas = canvas.cloneNode(false);
    freshCanvas.style.display = '';
    canvas.replaceWith(freshCanvas);
    canvas = freshCanvas;

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
}

// Tools can open another tool: window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }))
window.addEventListener('gdt:navigate', (e) => {
    const { cat, sym } = e.detail || {};
    if (!GDT_HIERARCHY[cat]?.symbols[sym]) return;
    selectCategory(cat);
    loadSymbolModule(cat, sym);
});

init();
