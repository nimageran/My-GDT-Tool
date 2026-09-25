// js/modules/inspection/methods.js
// Measurement Methods: how each characteristic is actually checked, and where
// each method can mislead. Two views: by characteristic ("I have to check
// flatness, how?") and by equipment ("I have V-blocks, what can they check?").
// HTML beside the (hidden) canvas.

import { linkify } from '../../glossary.js';
import { takeFocus } from '../../focus.js';

// level: shop = surface plate / hand tools, gauge = hard gauge, lab = CMM or form machine
export const LEVELS = {
    shop: { label: 'Shop floor', cls: 'bg-slate-200 text-slate-700' },
    gauge: { label: 'Gauge', cls: 'bg-amber-100 text-amber-800' },
    lab: { label: 'Lab / CMM', cls: 'bg-blue-100 text-blue-800' }
};

export const CHARS = [
    { id: 'size', group: 'Size', sym: '⌀', name: 'Size (diameter, width)',
      link: ['MATERIAL', 'rule1', 'Rule #1 Envelope'],
      methods: [
          { level: 'shop', how: 'Caliper or micrometer', steps: 'Measure across the feature at several places and angles. Every reading must be inside the limits.' },
          { level: 'shop', how: 'Bore gauge (holes)', steps: 'Zero it on a ring or setting master, rock it to find the smallest reading, and repeat at several depths and angles.' },
          { level: 'gauge', how: 'Go / no-go gauges', steps: 'The GO gauge (full-length pin or ring at MMC) must pass over the whole feature; the NO-GO must not enter at any point.' }
      ],
      misleads: [
          'A caliper or micrometer is a two-point check: it cannot see a bent shaft or a banana-shaped hole. Rule #1 (perfect form at MMC) is only proven by a full-length GO gauge or a CMM.',
          'A three-lobed (triangular) shape measures the same in every direction with a micrometer, yet is out of round.',
          'Use a tool about ten times finer than the tolerance: a 0.02 mm caliper is not good enough for a ±0.01 mm size.',
          'Temperature: parts are measured at 20 °C. A hot part straight off the machine reads big.'
      ] },
    { id: 'straightness', group: 'Form', sym: '⏤', name: 'Straightness',
      link: ['CHARACTERISTICS', 'straightness', 'Straightness'],
      methods: [
          { level: 'shop', how: 'Surface plate + indicator', steps: 'For a line on a surface: set the part so the line is level, run an indicator along it; the total movement (FIM) is the straightness.' },
          { level: 'gauge', how: 'GO gauge (axis, with Ⓜ)', steps: 'For straightness of an axis at MMC: a ring or sleeve at virtual condition must slide over the full length.' },
          { level: 'lab', how: 'CMM', steps: 'Take points along the line (or sections along the axis) and let the software fit the smallest zone.' }
      ],
      misleads: [
          'Surface-line straightness and axis straightness are different checks. Look where the frame points: at the surface, or at the size dimension.',
          'Resting a bent part on the plate lets it rock; support it so it does not move while you sweep.'
      ] },
    { id: 'flatness', group: 'Form', sym: '⏥', name: 'Flatness',
      link: ['CHARACTERISTICS', 'flatness', 'Flatness'],
      methods: [
          { level: 'shop', how: 'Surface plate, jacks + indicator', steps: 'Set the surface UP on three adjustable supports, level it so three far-apart points read the same, then sweep the whole surface. The total reading is the flatness.' },
          { level: 'shop', how: 'On the plate + feeler gauge', steps: 'For rough checks only: rest the surface face-down and see which feeler slides under. It finds large gaps, not small errors.' },
          { level: 'lab', how: 'CMM or optical flat', steps: 'CMM: many points over the whole face. Optical flat: small lapped faces, count the light bands.' }
      ],
      misleads: [
          'Resting the part on its bottom and sweeping the top measures parallelism, not flatness. A wedge-shaped but perfectly flat part would fail.',
          'Too few CMM points can miss a dip or a raised edge. Cover the whole surface, including near edges.'
      ] },
    { id: 'circularity', group: 'Form', sym: '○', name: 'Circularity (roundness)',
      link: ['CHARACTERISTICS', 'circularity', 'Circularity'],
      methods: [
          { level: 'lab', how: 'Roundness machine', steps: 'The part turns on a precise spindle; a probe traces each section. The best method.' },
          { level: 'shop', how: 'V-block + indicator', steps: 'Rotate the part in a V-block and read the indicator. Quick, but only an estimate (see below).' },
          { level: 'lab', how: 'CMM', steps: 'Scan (or take many points around) each cross-section and evaluate each circle on its own.' }
      ],
      misleads: [
          'A micrometer misses odd lobing (3, 5 lobes); a V-block over- or under-reads depending on the number of lobes and the V angle.',
          'Runout is not roundness: a perfectly round part mounted off-centre shows runout. Do not use a runout reading as a circularity result.',
          'Each cross-section is judged on its own; a taper can still pass circularity.'
      ] },
    { id: 'cylindricity', group: 'Form', sym: '⌭', name: 'Cylindricity',
      link: ['CHARACTERISTICS', 'cylindricity', 'Cylindricity'],
      methods: [
          { level: 'lab', how: 'Form machine (roundness + vertical travel)', steps: 'Trace many sections along the length, all related to one axis; the software fits one pair of coaxial cylinders.' },
          { level: 'lab', how: 'CMM', steps: 'Many sections or a helical scan over the full length.' }
      ],
      misleads: [
          'Checking circularity at a few sections does not prove cylindricity: taper, barrel and bending are missed.',
          'A shop-floor check (V-block, rotate and traverse) is only a rough screen.'
      ] },
    { id: 'profile', group: 'Profile', sym: '⌓', name: 'Profile (line and surface)',
      link: ['CHARACTERISTICS', 'surface_profile', 'Surface Profile'],
      methods: [
          { level: 'lab', how: 'CMM against the CAD model', steps: 'Align to the datums in the frame (A, then B, then C), then compare every point to the true shape. Each point must fall inside the band.' },
          { level: 'shop', how: 'Optical comparator / vision system', steps: 'For 2D shapes (line profile): overlay the part silhouette on a chart with the tolerance band drawn.' },
          { level: 'gauge', how: 'Template or fixture with checking pins', steps: 'Shop check for sheet metal and trim edges: gaps measured with feelers or flush pins.' }
      ],
      misleads: [
          'Best-fit alignment is only allowed when the frame has NO datums. With datums, best-fit hides location errors and passes bad parts.',
          'The number in the frame is the total band width: 0.4 means ±0.2 (unless Ⓤ says otherwise).',
          'Too few points on a curved surface miss the worst spot.'
      ] },
    { id: 'orientation', group: 'Orientation', sym: '∥ ⊥ ∠', name: 'Parallelism, perpendicularity, angularity',
      link: ['CHARACTERISTICS', 'perpendicularity', 'Perpendicularity'],
      methods: [
          { level: 'shop', how: 'Parallelism: surface plate + indicator', steps: 'Rest datum face on the plate (it sits on its high points, like the datum simulator), sweep the controlled face. The total reading is the parallelism.' },
          { level: 'shop', how: 'Perpendicularity: angle plate or square', steps: 'Clamp the datum face against an angle plate (or stand the part on it), then run the indicator up and down the controlled face.' },
          { level: 'shop', how: 'Angularity: sine bar or sine plate', steps: 'Tilt the part by the basic angle with gauge blocks under the sine bar, so the controlled face is level; then sweep it like parallelism.' },
          { level: 'lab', how: 'CMM', steps: 'Build the datum from points on the datum face, then measure the controlled feature against it.' }
      ],
      misleads: [
          'Burrs, chips or dirt under the datum face tilt the whole part. Clean and deburr first.',
          'For a hole (axis), put a snug gauge pin in it and measure the pin at two heights; a loose pin hides the error.',
          'Orientation does not control location: a face can be perfectly parallel and still at the wrong height.'
      ] },
    { id: 'position', group: 'Location', sym: '⌖', name: 'Position',
      link: ['INSPECTION', 'cmm_position', 'CMM Position Calculator'],
      methods: [
          { level: 'lab', how: 'CMM', steps: 'Set up the datums in frame order (A primary, B secondary, C tertiary). Measure each hole centre; position = 2 × the distance from the true position. Add bonus if Ⓜ.' },
          { level: 'gauge', how: 'Functional gauge (with Ⓜ)', steps: 'Pins at virtual condition, placed at true position on a fixture that simulates the datums. If the part drops on, the pattern passes (sizes are checked separately).' },
          { level: 'shop', how: 'Surface plate + height gauge + gauge pins', steps: 'Rest on datums, measure each pin height in X and Y from the datum faces, then convert to position.' }
      ],
      misleads: [
          'Aligning the CMM to the holes (best fit) instead of the datums hides the real error.',
          'Forgetting bonus tolerance (or datum shift) rejects good parts. Report the actual hole size with each position.',
          'A hole measured at the top only can be tilted below. For deep holes check at two depths.',
          'Position is a diameter zone: 0.1 X and 0.1 Y off is 0.283 position, not 0.1.'
      ] },
    { id: 'concentricity', group: 'Location', sym: '◎ ⌯', name: 'Concentricity and symmetry (2009 or older)',
      link: ['CHARACTERISTICS', 'concentricity', 'Concentricity'],
      methods: [
          { level: 'lab', how: 'CMM or form machine', steps: 'Find the midpoints of many opposite point pairs (median points) along the feature. All must lie in the zone around the datum axis or plane.' },
          { level: 'shop', how: 'Symmetry: surface plate + indicator', steps: 'Measure each wall from the datum centre plane at matching spots, then flip the part and repeat. Each midpoint is half the difference.' }
      ],
      misleads: [
          'Runout is often used instead because it is easier. A pass on runout of the same value is usually accepted; a runout fail does not prove a concentricity fail. Agree this with the customer first.',
          'Both are slow and costly to measure properly. That is one reason they were removed in Y14.5-2018.'
      ] },
    { id: 'runout', group: 'Runout', sym: '↗\uFE0E ⌰', name: 'Circular and total runout',
      link: ['CHARACTERISTICS', 'circular_runout', 'Circular Runout'],
      methods: [
          { level: 'shop', how: 'V-blocks, centres or collet + indicator', steps: 'Hold the part on its datum diameter(s), put the indicator square to the surface, rotate one full turn. Circular: read each section separately. Total: slide the indicator along the whole surface while turning; one total reading.' },
          { level: 'lab', how: 'Roundness machine or CMM', steps: 'Align to the datum axis, then evaluate the surface in rotation.' }
      ],
      misleads: [
          'Holding the part between centres uses the centre holes, not the datum diameters. That is only right when the centre holes ARE the datum.',
          'An out-of-round datum diameter rocks in a V-block and adds error.',
          'Indicator tipped at an angle reads less than the truth (cosine error).',
          'For total runout, several separate circular readings do not add up to the answer. Use one continuous reading.'
      ] }
];

export const TOOLS = [
    { id: 'caliper', level: 'shop', name: 'Caliper',
      good: 'Quick sizes, lengths, steps. Resolution 0.01–0.02 mm.',
      limit: 'Two-point only; jaws flex; not for tight tolerances (below about ±0.05 mm).',
      checks: ['size'] },
    { id: 'micrometer', level: 'shop', name: 'Micrometer',
      good: 'Accurate outside sizes, resolution 0.001–0.01 mm.',
      limit: 'Two-point only: misses bending and odd lobing.',
      checks: ['size'] },
    { id: 'pin_gauges', level: 'gauge', name: 'Pin, plug and ring gauges (go / no-go)',
      good: 'Fast yes/no for hole and shaft sizes; a full-length GO checks the Rule #1 envelope.',
      limit: 'No number, so no trend data. Gauges wear and need calibration.',
      checks: ['size', 'straightness'] },
    { id: 'plate', level: 'shop', name: 'Surface plate, height gauge and indicator',
      good: 'Flatness, parallelism, heights, and (with angle plates and sine bars) perpendicularity and angularity. The plate acts as the datum.',
      limit: 'Slow for many features; the result depends on how the part is supported.',
      checks: ['straightness', 'flatness', 'orientation', 'position', 'concentricity'] },
    { id: 'vblock', level: 'shop', name: 'V-blocks and centres',
      good: 'Runout, and a quick roundness screen.',
      limit: 'Odd lobing and an out-of-round datum distort the reading; centres use centre holes, not the datum diameter.',
      checks: ['circularity', 'runout'] },
    { id: 'roundness', level: 'lab', name: 'Roundness / form machine',
      good: 'The best for circularity, cylindricity, runout and coaxiality.',
      limit: 'Lab only; the part must fit on the spindle.',
      checks: ['circularity', 'cylindricity', 'runout', 'concentricity'] },
    { id: 'cmm', level: 'lab', name: 'CMM (coordinate measuring machine)',
      good: 'Almost everything: position, profile, orientation, form; builds the datum reference frame in software.',
      limit: 'Only as good as the program: datum setup, number of points, fitting method. Always read the alignment line on the report.',
      checks: ['size', 'straightness', 'flatness', 'circularity', 'cylindricity', 'profile', 'orientation', 'position', 'concentricity', 'runout'] },
    { id: 'comparator', level: 'shop', name: 'Optical comparator / vision system',
      good: '2D outlines, radii, angles and line profile of small or flat parts.',
      limit: 'Sees only the silhouette in one view; edge lighting affects the reading.',
      checks: ['profile', 'size'] },
    { id: 'functional', level: 'gauge', name: 'Functional (attribute) gauge',
      good: 'Fast pass/fail for position and profile at MMC: if it assembles to the gauge, it assembles to the mating part.',
      limit: 'Only valid with Ⓜ (or MMB) in the frame. No number; costly to make; sizes still need a separate check.',
      checks: ['position', 'straightness', 'profile'] }
];

export const RULES = [
    ['Set up the datums first', 'Hold the part the way the frame says: primary datum on its high points, then secondary, then tertiary.'],
    ['Use a tool ten times finer', 'The instrument should resolve about one tenth of the tolerance (the 10% rule).'],
    ['Clean, deburr, 20 °C', 'Dirt, burrs and heat are the most common reasons two people get different numbers.'],
    ['Read the CMM alignment', 'A report aligned by best fit when the frame has datums is not measuring what the drawing asks.']
];

const GROUPS = ['Size', 'Form', 'Profile', 'Orientation', 'Location', 'Runout'];

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const go = (cat, sym) => window.dispatchEvent(new CustomEvent('gdt:navigate', { detail: { cat, sym } }));
const tag = level => `<span class="text-[11px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap ${LEVELS[level].cls}">${LEVELS[level].label}</span>`;

const state = { view: 'char', search: '', level: 'all' };
let svgRef = null, overlay = null, controlsRoot = null;

const charText = c => `${c.name} ${c.methods.map(m => `${m.how} ${m.steps}`).join(' ')} ${c.misleads.join(' ')}`;
const toolText = t => `${t.name} ${t.good} ${t.limit}`;

function visibleChars() {
    const q = state.search.trim().toLowerCase();
    return CHARS.filter(c => (state.level === 'all' || c.methods.some(m => m.level === state.level)) &&
        (!q || charText(c).toLowerCase().includes(q)));
}
function visibleTools() {
    const q = state.search.trim().toLowerCase();
    return TOOLS.filter(t => (state.level === 'all' || t.level === state.level) && (!q || toolText(t).toLowerCase().includes(q)));
}

function charCard(c) {
    const methods = c.methods.filter(m => state.level === 'all' || m.level === state.level);
    return `
      <article class="bg-white border border-slate-200 rounded-lg p-4" data-entry="${esc(c.name)}">
        <div class="flex items-baseline justify-between gap-3 mb-3">
          <h4 class="text-lg font-bold text-slate-900"><span class="text-blue-700 mr-2">${esc(c.sym)}</span>${esc(c.name)}</h4>
          <button data-link="${c.id}" class="text-xs font-bold text-blue-700 hover:underline shrink-0">${esc(c.link[2])} ▶</button>
        </div>
        <div class="text-[11px] font-extrabold tracking-widest text-emerald-800 mb-1">HOW TO CHECK IT</div>
        <ol class="space-y-2 mb-3">
          ${methods.map((m, i) => `<li class="rounded bg-emerald-50 px-3 py-2">
            <div class="flex items-center gap-2 mb-0.5"><span class="font-bold text-slate-900 text-sm">${i + 1}. ${esc(m.how)}</span>${tag(m.level)}</div>
            <p class="mt-text text-sm text-slate-700 leading-relaxed">${esc(m.steps)}</p></li>`).join('')}
        </ol>
        <div class="text-[11px] font-extrabold tracking-widest text-amber-800 mb-1">WHERE IT CAN MISLEAD</div>
        <ul class="rounded bg-amber-50 px-3 py-2 space-y-1">
          ${c.misleads.map(x => `<li class="mt-text text-sm text-slate-800 leading-relaxed pl-4 -indent-4">⚠ ${esc(x)}</li>`).join('')}
        </ul>
      </article>`;
}

function toolCard(t) {
    const names = t.checks.map(id => CHARS.find(c => c.id === id));
    return `
      <article class="bg-white border border-slate-200 rounded-lg p-4" data-entry="${esc(t.name)}">
        <div class="flex items-center gap-2 mb-2"><h4 class="text-lg font-bold text-slate-900">${esc(t.name)}</h4>${tag(t.level)}</div>
        <div class="grid sm:grid-cols-2 gap-3 mb-3">
          <div class="rounded bg-emerald-50 px-3 py-2"><div class="text-[11px] font-extrabold tracking-widest text-emerald-800 mb-1">GOOD FOR</div><p class="mt-text text-sm text-slate-800 leading-relaxed">${esc(t.good)}</p></div>
          <div class="rounded bg-amber-50 px-3 py-2"><div class="text-[11px] font-extrabold tracking-widest text-amber-800 mb-1">WATCH OUT</div><p class="mt-text text-sm text-slate-800 leading-relaxed">${esc(t.limit)}</p></div>
        </div>
        <div class="flex flex-wrap gap-1.5 items-center"><span class="text-xs font-bold text-slate-500 mr-1">Checks:</span>
          ${names.map(c => `<button data-char="${c.id}" class="text-xs font-bold rounded-full border border-slate-300 px-2 py-0.5 text-slate-700 hover:bg-slate-100">${esc(c.sym)} ${esc(c.name)}</button>`).join('')}</div>
      </article>`;
}

function renderPage() {
    if (!overlay) return;
    const byChar = state.view === 'char';
    const chars = byChar ? visibleChars() : [];
    const tools = byChar ? [] : visibleTools();
    const empty = byChar ? chars.length === 0 : tools.length === 0;
    const showRules = !state.search && state.level === 'all';
    overlay.innerHTML = `
      <div class="max-w-4xl mx-auto px-6 py-8">
        <div class="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Inspection</div>
        <h2 class="text-3xl font-extrabold text-slate-900 mb-1">Measurement Methods</h2>
        <p class="text-slate-600 mb-6 leading-relaxed">How each callout is actually checked, from the shop floor to the CMM, and the traps that make a good part fail or a bad part pass. <b>The method must match what the frame asks</b>, not just what is easy to measure.</p>
        ${showRules ? `
        <section class="grid sm:grid-cols-2 gap-3 mb-8">
          ${RULES.map(([t, d]) => `<div class="bg-white border border-slate-200 rounded-lg p-3"><div class="font-bold text-slate-900 text-sm mb-0.5">${esc(t)}</div><p class="mt-text text-sm text-slate-600 leading-relaxed">${esc(d)}</p></div>`).join('')}
        </section>` : ''}
        ${empty ? '<p class="text-slate-500">Nothing found. Try a shorter word.</p>' : ''}
        ${byChar ? GROUPS.map(g => {
            const items = chars.filter(c => c.group === g);
            return items.length ? `
              <section class="mb-8">
                <h3 class="text-sm font-extrabold text-blue-700 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wide">${esc(g)}</h3>
                <div class="space-y-3">${items.map(charCard).join('')}</div>
              </section>` : '';
        }).join('') : `<div class="space-y-3">${tools.map(toolCard).join('')}</div>`}
      </div>`;
    overlay.querySelectorAll('article').forEach(a => a.querySelectorAll('.mt-text').forEach(p => linkify(p, { skipTerms: [a.dataset.entry] })));
    overlay.querySelectorAll('.mt-text').forEach(p => { if (!p.closest('article')) linkify(p); });
    overlay.querySelectorAll('[data-link]').forEach(b => {
        const c = CHARS.find(x => x.id === b.dataset.link);
        b.onclick = () => go(c.link[0], c.link[1]);
    });
    overlay.querySelectorAll('[data-char]').forEach(b => b.onclick = () => {
        Object.assign(state, { view: 'char', search: CHARS.find(c => c.id === b.dataset.char).name, level: 'all' });
        renderPage();
        renderControls();
    });
    overlay.scrollTop = 0;
}

function renderControls() {
    if (!controlsRoot) return;
    const segBtn = 'px-2 py-1.5 text-xs font-bold rounded border transition-colors';
    const seg = (key, v, label) => `<button data-${key}="${esc(v)}" class="${segBtn} ${state[key] === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}">${esc(label)}</button>`;
    controlsRoot.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Look up by</h4>
            <div class="flex flex-wrap gap-1.5">${seg('view', 'char', 'What to check')}${seg('view', 'tool', 'Equipment I have')}</div>
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Search</h4>
            <input id="mm-search" type="search" value="${esc(state.search)}" placeholder="e.g. flatness, V-block, best fit"
                class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-2">Show methods</h4>
            <div class="flex flex-wrap gap-1.5">${seg('level', 'all', 'All')}${Object.entries(LEVELS).map(([k, v]) => seg('level', k, v.label)).join('')}</div>
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Before you reject a part</div>
            <div class="text-xs leading-relaxed">Check the method first: datums set up in frame order, bonus and datum shift included, a fine enough tool, a clean part at room temperature. Most "bad" parts that turn out good fail one of these.</div>
        </div>`;
    const s = controlsRoot.querySelector('#mm-search');
    s.oninput = () => { state.search = s.value; renderPage(); };
    controlsRoot.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
        Object.assign(state, { view: b.dataset.view, search: '' });
        renderPage();
        renderControls();
    });
    controlsRoot.querySelectorAll('[data-level]').forEach(b => b.onclick = () => {
        state.level = b.dataset.level;
        renderPage();
        renderControls();
    });
}

export function draw(svg) {
    svgRef = svg;
    svg.style.display = 'none';
    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'methods';
    overlay.className = 'absolute inset-0 overflow-y-auto bg-slate-50';
    svg.parentElement.appendChild(overlay);
    const focus = takeFocus('methods');   // 'char:<id>' or 'tool:<id>', from the search
    if (focus) {
        const [view, id] = String(focus).split(':');
        const item = (view === 'tool' ? TOOLS : CHARS).find(x => x.id === id);
        if (item) Object.assign(state, { view, search: item.name, level: 'all' });
    }
    renderPage();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

export function unload() {
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = svgRef = null;
}
