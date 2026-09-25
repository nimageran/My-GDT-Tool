// js/modules/learn/practice.js
// Learning path and quizzes: six short lessons in order, each with the tools
// to study and five questions built from real callouts. Instant feedback with
// the reason and a link to the tool that teaches it. Progress is saved in this
// browser. HTML beside the (hidden) canvas.

import { featureControlFrame } from '../../theme.js';
import { projectionSymbol } from '../drawing/sheet.js';
import { linkify } from '../../glossary.js';
import { takeFocus } from '../../focus.js';
import { LESSONS, PASS_MARK, loadProgress, saveProgress, lessonStatus } from './lessons.js';

const state = { view: 'path', li: 0, qi: 0, picked: null, session: {} };
let svgRef = null, overlay = null, controlsRoot = null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));
const NS = 'http://www.w3.org/2000/svg';

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'practice';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);
    const f = takeFocus('practice');                      // lesson id: start that quiz
    const li = LESSONS.findIndex(l => l.id === f);
    if (li >= 0) startQuiz(li, false); else render();
    document.addEventListener('keydown', onKey);
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

export function unload() {
    document.removeEventListener('keydown', onKey);
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = svgRef = null;
}

/** The first lesson not yet done (or the last one). */
export function nextLessonIndex(progress = loadProgress()) {
    const i = LESSONS.findIndex(l => !lessonStatus(l, progress).done);
    return i < 0 ? LESSONS.length - 1 : i;
}

// --------------------------------------------------------------------------
// Flow
// --------------------------------------------------------------------------

function startQuiz(li, rerender = true) {
    Object.assign(state, { view: 'quiz', li, qi: 0, picked: null, session: {} });
    render();
    if (rerender) renderControls();
}

function pick(i) {
    if (state.picked !== null || state.view !== 'quiz') return;
    const q = LESSONS[state.li].questions[state.qi];
    state.picked = i;
    const correct = i === q.answer;
    state.session[q.id] = correct;
    const p = loadProgress();
    p[q.id] = { choice: i, correct };
    saveProgress(p);
    render();
    renderControls();
}

function next() {
    const lesson = LESSONS[state.li];
    if (state.picked === null) return;
    if (state.qi < lesson.questions.length - 1) Object.assign(state, { qi: state.qi + 1, picked: null });
    else state.view = 'result';
    render();
}

function onKey(e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.getElementById('search-modal')) return;
    if (state.view !== 'quiz') return;
    const n = LESSONS[state.li].questions[state.qi].options.length;
    const k = parseInt(e.key, 10);
    if (k >= 1 && k <= n) pick(k - 1);         // Enter is handled by the focused "Next" button
}

// --------------------------------------------------------------------------
// Rendering
// --------------------------------------------------------------------------

function render() {
    if (!overlay) return;
    if (state.view === 'quiz') renderQuiz();
    else if (state.view === 'result') renderResult();
    else renderPath();
    overlay.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(...b.dataset.go.split(':')));
    overlay.querySelectorAll('.pq-text').forEach(p => linkify(p));
    overlay.scrollTop = 0;
}

const chip = ([cat, sym, label]) => `<button data-go="${cat}:${sym}" class="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full px-2.5 py-1">${esc(label)} ▶</button>`;

function renderPath() {
    const p = loadProgress();
    const stats = LESSONS.map(l => lessonStatus(l, p));
    const done = stats.filter(s => s.done).length;
    const correct = stats.reduce((n, s) => n + s.correct, 0), total = stats.reduce((n, s) => n + s.total, 0);
    const nextI = nextLessonIndex(p);
    overlay.innerHTML = `
      <div class="max-w-3xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Learn</div>
        <h2 class="text-3xl font-extrabold text-slate-900 mb-1">Learning path</h2>
        <p class="text-slate-600 mb-5 leading-relaxed">Six short lessons, in the order you need them. For each one, look at the tools first, then check yourself with five questions. Get <b>${PASS_MARK} of 5</b> right to complete a lesson.</p>
        <div class="bg-white border border-slate-200 rounded-xl p-4 mb-6">
          <div class="flex justify-between text-sm mb-2"><span class="font-bold text-slate-800">${done} of ${LESSONS.length} lessons complete</span><span class="text-slate-500">${correct} of ${total} questions right</span></div>
          <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-green-500 rounded-full" style="width:${done / LESSONS.length * 100}%"></div></div>
        </div>
        <ol class="space-y-3">
          ${LESSONS.map((l, i) => {
              const s = stats[i], isNext = i === nextI && !s.done;
              const badge = s.done ? '<i class="fa-solid fa-check"></i>' : i + 1;
              const ring = s.done ? 'bg-green-500 text-white' : isNext ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600';
              const status = s.answered ? `${s.correct} of ${s.total} right` : 'Not started';
              return `
                <li class="bg-white border ${isNext ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'} rounded-xl p-4 flex gap-4">
                  <span class="shrink-0 w-9 h-9 rounded-full ${ring} flex items-center justify-center font-bold">${badge}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-3">
                      <h3 class="text-lg font-bold text-slate-900">${esc(l.title)} ${isNext ? '<span class="ml-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">Next up</span>' : ''}</h3>
                      <span class="text-xs ${s.done ? 'text-green-700 font-bold' : 'text-slate-500'} shrink-0">${s.done ? 'Complete · ' : ''}${status}</span>
                    </div>
                    <p class="pq-text text-sm text-slate-600 mt-0.5">${esc(l.goal)}</p>
                    <div class="flex flex-wrap items-center gap-1.5 mt-3">
                      <span class="text-xs font-bold text-slate-500 mr-1">Study:</span>${l.study.map(chip).join('')}
                      <button data-quiz="${i}" class="ml-auto text-sm font-bold rounded-lg px-4 py-1.5 ${isNext ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${s.answered ? 'Retry quiz' : 'Take the quiz'}</button>
                    </div>
                  </div>
                </li>`;
          }).join('')}
        </ol>
      </div>`;
    overlay.querySelectorAll('[data-quiz]').forEach(b => b.onclick = () => startQuiz(+b.dataset.quiz));
}

function figure(fig) {
    if (fig.code) return `<div class="inline-block font-mono text-2xl font-bold text-slate-900 bg-white border-2 border-slate-800 rounded px-4 py-2">${esc(fig.code)}</div>`;
    return '<div data-fig class="inline-block bg-white border border-slate-200 rounded-lg p-3"></div>';
}

function mountFigure(fig) {
    const host = overlay.querySelector('[data-fig]');
    if (!host) return;
    const svg = document.createElementNS(NS, 'svg');
    if (fig.fcf) {
        const f = featureControlFrame(2, 2, fig.fcf);
        svg.setAttribute('viewBox', `0 0 ${f.width + 4} ${f.height + 4}`);
        svg.setAttribute('width', (f.width + 4) * 1.3);
        svg.setAttribute('height', (f.height + 4) * 1.3);
        svg.appendChild(f.g);
    } else if (fig.projection) {
        svg.setAttribute('viewBox', '0 0 150 70');
        svg.setAttribute('width', 225);
        svg.setAttribute('height', 105);
        svg.appendChild(projectionSymbol(12, 14, 30, fig.projection));
    }
    host.appendChild(svg);
}

function renderQuiz() {
    const lesson = LESSONS[state.li], q = lesson.questions[state.qi];
    const answered = state.picked !== null;
    const right = answered && state.picked === q.answer;
    const dots = lesson.questions.map((qq, i) => {
        const r = state.session[qq.id];
        const c = r === true ? 'bg-green-500' : r === false ? 'bg-red-500' : i === state.qi ? 'bg-blue-600' : 'bg-slate-200';
        return `<span class="w-8 h-1.5 rounded-full ${c}"></span>`;
    }).join('');
    overlay.innerHTML = `
      <div class="max-w-2xl mx-auto px-6 py-8">
        <button id="pq-back" class="text-sm text-slate-500 hover:text-blue-700 mb-3"><i class="fa-solid fa-arrow-left mr-1"></i> Learning path</button>
        <div class="flex items-center justify-between mb-2">
          <div class="text-[11px] font-bold tracking-widest text-blue-700 uppercase">Lesson ${state.li + 1} · ${esc(lesson.title)}</div>
          <div class="text-xs text-slate-500">Question ${state.qi + 1} of ${lesson.questions.length}</div>
        </div>
        <div class="flex gap-1.5 mb-6">${dots}</div>
        <h2 class="pq-text text-xl font-bold text-slate-900 leading-snug mb-4">${esc(q.q)}</h2>
        ${q.fig ? `<div class="mb-5">${figure(q.fig)}</div>` : ''}
        <div class="space-y-2">
          ${q.options.map((o, i) => {
              let look = 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50';
              if (answered) {
                  if (i === q.answer) look = 'bg-green-50 border-green-500 text-green-900';
                  else if (i === state.picked) look = 'bg-red-50 border-red-500 text-red-900';
                  else look = 'bg-white border-slate-200 opacity-60';
              }
              const mark = answered && i === q.answer ? '<i class="fa-solid fa-check text-green-600"></i>' : answered && i === state.picked ? '<i class="fa-solid fa-xmark text-red-600"></i>' : '';
              return `<button data-opt="${i}" ${answered ? 'disabled' : ''} class="w-full flex items-center gap-3 text-left border-2 rounded-lg px-4 py-3 transition-colors ${look}">
                  <span class="shrink-0 w-6 h-6 rounded border border-slate-300 text-xs font-bold text-slate-500 flex items-center justify-center">${i + 1}</span>
                  <span class="flex-1">${esc(o)}</span>${mark}</button>`;
          }).join('')}
        </div>
        ${answered ? `
          <div class="mt-5 rounded-lg p-4 ${right ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}">
            <div class="font-bold ${right ? 'text-green-800' : 'text-amber-900'} mb-1">${right ? 'Right.' : 'Not quite.'}</div>
            <p class="pq-text text-slate-800 leading-relaxed">${esc(q.why)}</p>
            ${q.tool ? `<div class="mt-3 text-sm"><span class="text-slate-500">Learn it in:</span> ${chip(q.tool)}</div>` : ''}
          </div>
          <div class="mt-5 flex justify-end">
            <button id="pq-next" class="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg px-5 py-2">${state.qi < lesson.questions.length - 1 ? 'Next question' : 'See my score'} <i class="fa-solid fa-arrow-right ml-1"></i></button>
          </div>` : `<p class="mt-4 text-xs text-slate-400">Tip: press 1 to ${q.options.length} to answer, then Enter for the next question.</p>`}
      </div>`;
    if (q.fig && !q.fig.code) mountFigure(q.fig);
    overlay.querySelector('#pq-back').onclick = () => { state.view = 'path'; render(); renderControls(); };
    overlay.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => pick(+b.dataset.opt));
    const n = overlay.querySelector('#pq-next');
    if (n) { n.onclick = next; n.focus(); }
}

function renderResult() {
    const lesson = LESSONS[state.li];
    const score = lesson.questions.filter(q => state.session[q.id]).length;
    const passed = score >= PASS_MARK;
    const hasNext = state.li < LESSONS.length - 1;
    overlay.innerHTML = `
      <div class="max-w-2xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-blue-700 uppercase mb-2">Lesson ${state.li + 1} · ${esc(lesson.title)}</div>
        <div class="bg-white border ${passed ? 'border-green-300' : 'border-amber-300'} rounded-xl p-6 text-center mb-6">
          <div class="text-5xl font-extrabold ${passed ? 'text-green-600' : 'text-amber-600'}">${score} / ${lesson.questions.length}</div>
          <div class="text-lg font-bold text-slate-900 mt-2">${passed ? 'Lesson complete.' : 'Almost there.'}</div>
          <p class="text-slate-600 mt-1">${passed ? (hasNext ? 'Ready for the next lesson.' : 'That was the last lesson: you have finished the path.') : `You need ${PASS_MARK} of 5. Look again at the questions you missed, then retry.`}</p>
        </div>
        <ul class="space-y-2 mb-6">
          ${lesson.questions.map(q => `
            <li class="bg-white border border-slate-200 rounded-lg px-4 py-3 flex gap-3">
              ${state.session[q.id] ? '<i class="fa-solid fa-circle-check text-green-600 mt-1"></i>' : '<i class="fa-solid fa-circle-xmark text-red-500 mt-1"></i>'}
              <div class="min-w-0"><div class="text-sm text-slate-900">${esc(q.q)}</div>
                ${state.session[q.id] ? '' : `<div class="pq-text text-sm text-slate-600 mt-1"><b>Answer:</b> ${esc(q.options[q.answer])}. ${esc(q.why)}</div>`}</div>
            </li>`).join('')}
        </ul>
        <div class="flex flex-wrap gap-2 justify-end">
          <button id="pq-path" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg px-4 py-2">Learning path</button>
          <button id="pq-retry" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg px-4 py-2">Retry this lesson</button>
          ${passed && hasNext ? '<button id="pq-nextlesson" class="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg px-4 py-2">Next lesson <i class="fa-solid fa-arrow-right ml-1"></i></button>' : ''}
        </div>
      </div>`;
    overlay.querySelector('#pq-path').onclick = () => { state.view = 'path'; render(); renderControls(); };
    overlay.querySelector('#pq-retry').onclick = () => startQuiz(state.li);
    const nl = overlay.querySelector('#pq-nextlesson');
    if (nl) nl.onclick = () => { state.view = 'path'; state.li += 1; render(); renderControls(); };
    renderControls();
}

function renderControls() {
    if (!controlsRoot) return;
    const p = loadProgress();
    const stats = LESSONS.map(l => lessonStatus(l, p));
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Lessons</h4>
            <ol class="space-y-1">
                ${LESSONS.map((l, i) => `<li><button data-quiz="${i}" class="w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100 ${state.view !== 'path' && state.li === i ? 'bg-blue-50 font-bold text-blue-900' : 'text-slate-700'}">
                    <span class="w-5 text-center">${stats[i].done ? '<i class="fa-solid fa-check text-green-600"></i>' : `<span class="text-xs text-slate-400">${i + 1}</span>`}</span>
                    <span class="flex-1">${esc(l.title)}</span><span class="text-xs text-slate-400">${stats[i].answered ? `${stats[i].correct}/${stats[i].total}` : ''}</span></button></li>`).join('')}
            </ol>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">How it works</h4>
            <ul class="text-sm text-slate-700 space-y-1.5 list-disc pl-4">
                <li>Study the tools listed for a lesson, then take its quiz.</li>
                <li>After each answer you see why, and a link to the tool that explains it.</li>
                <li>Your progress is saved in this browser only.</li>
            </ul>
            <button id="pq-reset" class="mt-3 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-slate-700 font-bold w-full">RESET MY PROGRESS</button>
        </div>`;
    controlsRoot.querySelectorAll('[data-quiz]').forEach(b => b.onclick = () => startQuiz(+b.dataset.quiz));
    controlsRoot.querySelector('#pq-reset').onclick = () => {
        if (!confirm('Clear all your saved answers?')) return;
        saveProgress({});
        state.view = 'path';
        render();
        renderControls();
    };
}
