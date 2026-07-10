// modules/decode/composite_frames.js
// PLACEHOLDER — replace this whole file with the real module when built.
// Build request for a new conversation (see DECODER_SPEC.md §7):
//   upload DECODER_SPEC.md + symbols.js + welding.js, then ask:
//   "Build composite_frames.js per the spec."

const NS = "http://www.w3.org/2000/svg";
function el(t, a = {}) {
    const e = document.createElementNS(NS, t);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    return e;
}
function txt(str, x, y, size, fill, bold) {
    const t = el('text', { x, y, 'font-size': size, fill,
        'font-family': 'ui-sans-serif, system-ui, sans-serif' });
    if (bold) t.setAttribute('font-weight', '700');
    t.textContent = str;
    return t;
}

export function draw(canvas) {
    const g = el('g');
    g.appendChild(el('rect', { x: 150, y: 180, width: 700, height: 320,
        rx: 12, fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': 1.5, 'stroke-dasharray': '8 6' }));
    g.appendChild(txt('ROADMAP #4', 190, 230, 12, '#94a3b8', true));
    g.appendChild(txt('Composite Frames & Datum Comparison Decoder', 190, 265, 24, '#0f172a', true));
    g.appendChild(txt('Planned scope:', 190, 305, 14, '#64748b', true));
    g.appendChild(txt('\u2022  Composite vs multi-single-segment position frames', 200, 335, 14, '#334155'));
    g.appendChild(txt('\u2022  Pattern-locating vs feature-relating (comparing feature to feature)', 200, 365, 14, '#334155'));
    g.appendChild(txt('\u2022  Datum feature modifiers, U F P boundary modifiers', 200, 395, 14, '#334155'));
    g.appendChild(txt('\u2022  2X / SIM / ALL OVER / between symbol', 200, 425, 14, '#334155'));
    g.appendChild(txt('\u2022  Preview: pattern with two tolerance zone sets', 200, 455, 14, '#334155'));
    canvas.appendChild(g);
}

export function loadControls(container) {
    container.innerHTML = `
      <div class="p-4 bg-slate-50 rounded border border-slate-200 text-sm text-slate-600 space-y-2">
        <p class="font-bold text-slate-700">Not built yet</p>
        <p>To build this module, start a new Claude conversation, upload
        <span class="font-mono text-xs">DECODER_SPEC.md</span>,
        <span class="font-mono text-xs">symbols.js</span> and
        <span class="font-mono text-xs">welding.js</span>, then ask:</p>
        <p class="font-mono text-xs bg-white border border-slate-200 rounded p-2">Build composite_frames.js per the spec.</p>
        <p>Save the result over this file. No config changes needed.</p>
      </div>`;
}
