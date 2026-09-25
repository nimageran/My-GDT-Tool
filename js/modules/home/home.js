// js/modules/home/home.js
// Start page: the first thing anyone sees. "What do you need to do?" start
// points, a search box, and a map of every tool. HTML beside the (hidden)
// canvas, like the other text pages.

import { GDT_HIERARCHY } from '../../config.js';
import { openSearch } from '../../search.js';
import { toolDesc } from '../../menu.js';
import { LESSONS, loadProgress, lessonStatus } from '../learn/lessons.js';

// Common jobs, in the words someone would use at their desk
const TASKS = [
    { icon: 'fa-list-check', title: 'Read a drawing, step by step', text: 'The order to read any drawing in, on a sample sheet.', cat: 'DECODE', sym: 'read_checklist', star: true },
    { icon: 'fa-shapes', title: 'I see a symbol I don\'t know', text: 'Find it by its picture and read what it means.', cat: 'DECODE', sym: 'symbol_finder' },
    { icon: 'fa-table-cells', title: 'Decode a feature control frame', text: 'Rebuild the frame and read it in plain words.', cat: 'DECODE', sym: 'composite_frames' },
    { icon: 'fa-plus-minus', title: 'No tolerance is written: what is it?', text: 'Title block defaults and ISO 2768.', cat: 'DECODE', sym: 'general_tolerances' },
    { icon: 'fa-circle-dot', title: 'Will these parts fit together?', text: 'Worst-case boundaries of a pin and a hole.', cat: 'MATERIAL', sym: 'virtual_condition' },
    { icon: 'fa-ruler-combined', title: 'What does H7/g6 mean?', text: 'Real limits and the fit type from an ISO fit.', cat: 'STACKUPS', sym: 'fits' },
    { icon: 'fa-globe', title: 'Is this drawing ASME or ISO?', text: 'Clues to tell, and the rules that change.', cat: 'LEARN', sym: 'asme_iso' },
    { icon: 'fa-location-crosshairs', title: 'Check a hole position from a CMM report', text: 'Position with bonus, hole by hole.', cat: 'INSPECTION', sym: 'cmm_position' }
];

let svgRef = null, overlay = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'home';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);
    render();
}

export function loadControls(container) {
    container.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">New here?</h4>
            <p class="text-sm text-slate-700 leading-relaxed">Follow the <button data-go="LEARN:practice" class="font-semibold text-blue-700 hover:underline">learning path</button>: six short lessons, each with a quiz. Or, with a drawing in front of you, open <button data-go="DECODE:read_checklist" class="font-semibold text-blue-700 hover:underline">How to Read a Drawing</button> and go through it in 11 steps.</p>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Getting around</h4>
            <ul class="text-sm text-slate-700 space-y-2">
                <li><kbd class="font-mono text-xs border border-slate-300 rounded px-1.5">/</kbd> or <kbd class="font-mono text-xs border border-slate-300 rounded px-1.5">Ctrl K</kbd>: search anything you see on a drawing.</li>
                <li>The menus at the top list every tool, with a line on what each one does.</li>
                <li>Each tool has an <b>Explain</b> button with the idea in simple words.</li>
                <li><b>mm | inch</b> (top bar) sets the units for every tool.</li>
                <li>Words with a dotted underline show their meaning when you point at them.</li>
                <li><b>+ Note</b> (top right) saves what you learn to <button data-go="LEARN:notebook" class="font-semibold text-blue-700 hover:underline">My Notebook</button>, linked to the tool.</li>
            </ul>
        </div>`;
    container.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(...b.dataset.go.split(':')));
}

export function unload() {
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = svgRef = null;
}

// Trainer: where you are on the learning path, with one click to continue
function learningBanner() {
    const p = loadProgress();
    const stats = LESSONS.map(l => lessonStatus(l, p));
    const done = stats.filter(s => s.done).length;
    const next = stats.findIndex(s => !s.done);
    const started = stats.some(s => s.answered);
    const title = next < 0 ? 'You have finished the learning path.' : started
        ? `Learning path: ${done} of ${LESSONS.length} lessons done` : 'Learn GD&T step by step';
    const sub = next < 0 ? 'Retry any quiz to keep it fresh.' : started
        ? `Next: lesson ${next + 1}, ${LESSONS[next].title}.` : 'Six short lessons, each with a five-question quiz from real drawings.';
    return `
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-10 flex flex-wrap items-center gap-4">
          <span class="w-10 h-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center"><i class="fa-solid fa-graduation-cap"></i></span>
          <div class="flex-1 min-w-[14rem]">
            <div class="font-bold text-slate-900">${esc(title)}</div>
            <div class="text-sm text-slate-500">${esc(sub)}</div>
            <div class="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden max-w-sm"><div class="h-full bg-green-500" style="width:${done / LESSONS.length * 100}%"></div></div>
          </div>
          <button id="home-path" class="text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 py-2">See the path</button>
          ${next >= 0 ? `<button id="home-learn" data-lesson="${LESSONS[next].id}" class="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2">${started ? 'Continue' : 'Start lesson 1'} <i class="fa-solid fa-arrow-right ml-1"></i></button>` : ''}
        </div>`;
}

function render() {
    const tabs = Object.entries(GDT_HIERARCHY).filter(([cat]) => cat !== 'HOME');
    overlay.innerHTML = `
      <div class="max-w-5xl mx-auto px-6 py-8">
        <h2 class="text-3xl font-extrabold text-slate-900">What do you need to do?</h2>
        <p class="text-slate-600 mt-1 mb-5">A helper for reading engineering drawings and GD&amp;T, in plain words.</p>

        <button id="home-search" class="w-full flex items-center gap-3 bg-white border-2 border-slate-200 hover:border-blue-400 rounded-xl px-4 py-3 text-left shadow-sm transition-colors mb-8">
          <i class="fa-solid fa-magnifying-glass text-slate-400 text-lg"></i>
          <span class="flex-1 text-lg text-slate-400">Type what you see on the drawing: TYP, H7/g6, all around, M8x1…</span>
          <kbd class="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 font-mono">/</kbd>
        </button>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          ${TASKS.map((t, i) => `
            <button data-task="${i}" class="group flex flex-col items-start justify-start text-left bg-white border ${t.star ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'} hover:border-blue-400 hover:shadow-md rounded-xl p-4 transition-all">
              <span class="w-10 h-10 rounded-lg ${t.star ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'} flex items-center justify-center mb-3"><i class="fa-solid ${t.icon}"></i></span>
              <span class="block font-bold text-slate-900 leading-snug">${esc(t.title)}</span>
              <span class="block text-sm text-slate-500 mt-1 leading-snug">${esc(t.text)}</span>
              ${t.star ? '<span class="inline-block mt-2 text-[11px] font-bold uppercase tracking-wide text-blue-700">Start here</span>' : ''}
            </button>`).join('')}
        </div>

        ${learningBanner()}

        <h3 class="text-sm font-extrabold text-slate-500 uppercase tracking-widest mb-3">All tools</h3>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${tabs.map(([cat, tab]) => `
            <section class="bg-white border border-slate-200 rounded-xl p-4">
              <h4 class="font-bold text-slate-900 mb-2 flex items-center gap-2"><i class="fa-solid ${tab.icon} text-blue-600 text-sm"></i>${esc(tab.label)}</h4>
              <ul class="space-y-0.5">
                ${Object.entries(tab.symbols).map(([sym, d]) => `
                  <li><button data-tool="${cat}:${sym}" title="${esc(toolDesc(sym, d))}" class="w-full text-left text-sm px-2 py-1 rounded hover:bg-blue-50 ${d.planned ? 'text-slate-400' : 'text-slate-700'} flex items-center gap-2">
                    <span class="w-5 text-center font-mono font-bold text-slate-500">${esc(d.iconChar)}</span>${esc(d.name)}${d.planned ? '<span class="ml-auto text-[10px] font-bold uppercase text-slate-400">soon</span>' : ''}</button></li>`).join('')}
              </ul>
            </section>`).join('')}
        </div>
      </div>`;
    overlay.querySelector('#home-search').onclick = () => openSearch();
    const cont = overlay.querySelector('#home-learn');
    if (cont) cont.onclick = () => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat: 'LEARN', sym: 'practice', focus: cont.dataset.lesson } }));
    const path = overlay.querySelector('#home-path');
    if (path) path.onclick = () => go('LEARN', 'practice');
    overlay.querySelectorAll('[data-task]').forEach(b => b.onclick = () => { const t = TASKS[+b.dataset.task]; go(t.cat, t.sym); });
    overlay.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => go(...b.dataset.tool.split(':')));
}
