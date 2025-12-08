// js/main.js
import { GDT_HIERARCHY } from './config.js';

// --- GLOBAL STATE ---
let activeCategory = null;
let activeSymbolKey = null;
let currentModule = null; 

// --- DOM ELEMENTS ---
const categoryNav = document.getElementById('categoryNav');
const symbolList = document.getElementById('symbolList'); // Changed from symbolNav
const toolbarLabel = document.getElementById('toolbarLabel');
const canvas = document.getElementById('mainCanvas');
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
        btn.innerHTML = `<i class="fa-solid ${data.icon}"></i> ${data.label}`;
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
            b.className = `px-3 py-1.5 rounded text-xs font-bold uppercase bg-blue-600 text-white border-blue-500 shadow-sm flex items-center gap-2`;
        } else {
            b.className = `px-3 py-1.5 rounded text-xs font-bold uppercase text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-2 border border-transparent`;
        }
    });

    renderSymbolToolbar(catKey);
}

// --- 3. RENDER SECONDARY TOOLBAR (The Ribbon) ---
function renderSymbolToolbar(catKey) {
    symbolList.innerHTML = '';
    const symbols = GDT_HIERARCHY[catKey].symbols;
    
    const keys = Object.keys(symbols);

    // Auto-select first symbol if none active or category switched
    // (Optional: You can remove this if you want an "empty" state)
    // if (keys.length > 0) loadSymbolModule(catKey, keys[0]);

    for (const [key, data] of Object.entries(symbols)) {
        const btn = document.createElement('button');
        
        // "Pill" Style Button
        btn.className = `group flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap`;
        
        btn.innerHTML = `
            <span class="font-mono font-bold text-lg leading-none">${data.iconChar}</span> 
            <span>${data.name}</span>
        `;
        
        btn.onclick = () => loadSymbolModule(catKey, key);
        btn.dataset.sym = key;
        symbolList.appendChild(btn);
    }
    
    // Re-highlight active symbol if it exists in this category
    if (activeSymbolKey && symbols[activeSymbolKey]) {
        updateSymbolHighlight(activeSymbolKey);
    }
}

function updateSymbolHighlight(symKey) {
    document.querySelectorAll('#symbolList button').forEach(b => {
        if (b.dataset.sym === symKey) {
            // Active Pill Style
            b.className = `group flex items-center gap-2 px-4 py-2 rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 whitespace-nowrap`;
        } else {
            // Inactive Pill Style
            b.className = `group flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap`;
        }
    });
}

// --- 4. MODULE LOADING ---
async function loadSymbolModule(catKey, symKey) {
    activeSymbolKey = symKey;
    updateSymbolHighlight(symKey);

    const catData = GDT_HIERARCHY[catKey];
    const symData = catData.symbols[symKey];

    // Clear Canvas
    canvas.innerHTML = ''; 
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
function setupSidebarToggle() {
    const toggleSidebar = () => {
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
    };

    toggleControlsBtn.onclick = toggleSidebar;
    expandControlsBtn.onclick = toggleSidebar;
}

init();