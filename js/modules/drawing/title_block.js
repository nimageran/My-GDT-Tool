// js/modules/drawing/title_block.js
// The title block: the box in the bottom-right corner of every drawing.
// Click a field (on the drawing or in the sidebar) to see what it means,
// what to check, and the usual mistakes.

import { createSVG } from '../../drawing_utils.js';
import { COLORS, text, wrapText } from '../../theme.js';
import { titleBlock, TITLE_FIELDS, UI, esc, goTo } from './sheet.js';
import { takeFocus } from '../../focus.js';

// Plain-language notes for each field
export const FIELD_INFO = {
    tolerances: {
        name: 'Default tolerances ("unless otherwise specified")',
        meaning: 'The tolerance for every dimension that has no tolerance written next to it. The number of decimal places in the dimension picks the line to use. It also says the units.',
        check: 'Count the decimals on the dimension, then read the matching line. 25.0 has one decimal, so here it is 25.0 ±0.2.',
        watch: 'Every company uses its own values. The same 25.0 can be ±0.2 here and ±0.1 at the next company, so read this box on every new drawing.',
        link: ['DECODE', 'general_tolerances', 'General tolerance calculator']
    },
    standard: {
        name: 'Standard',
        meaning: 'The rulebook used to read the drawing. ASME Y14.5 is the US standard; ISO drawings follow ISO 8015 and related standards.',
        check: 'Note the year. Some rules changed between editions (for example, concentricity and symmetry were removed in 2018).',
        watch: 'ASME and ISO read some things differently. Under ASME, a size tolerance also controls form (Rule #1); under ISO it does not, unless the drawing says so. If no standard is shown, ask.'
    },
    projection: {
        name: 'Projection symbol',
        meaning: 'Shows how the views are arranged. Third angle (US, Canada) puts the top view above the front view. First angle (Europe, Asia) puts it below.',
        check: 'Look at the cone symbol before you read any view. Circles on the left means third angle.',
        watch: 'Reading a first-angle drawing as third angle mirrors the part: you would put a hole on the wrong side.',
        link: ['DECODE', 'projection', 'First vs third angle']
    },
    company: {
        name: 'Company',
        meaning: 'Who owns the design. Often there is also a note saying the drawing is confidential.',
        check: 'Make sure the drawing comes from the customer or the design owner you expect.',
        watch: 'Do not send a customer\'s drawing to a supplier without permission if it is marked confidential.'
    },
    title: {
        name: 'Title (part name)',
        meaning: 'The name of the part. It is usually written noun first: "BRACKET, MOUNTING" rather than "mounting bracket".',
        check: 'Use it to confirm you have the right part, but always trust the part number over the name.',
        watch: 'Two different parts can have the same name. Only the number is unique.'
    },
    number: {
        name: 'Part / drawing number',
        meaning: 'The unique ID of the part. It is used to order, store, make and inspect it.',
        check: 'Match it exactly to the job traveller, purchase order or work order.',
        watch: 'The part number and drawing number are sometimes different. One drawing may also show several variants as dash numbers (10-4217-01, -02) in a table.'
    },
    revision: {
        name: 'Revision (REV)',
        meaning: 'The version of the drawing. Each change raises the letter (A, B, C...). The revision block lists what changed.',
        check: 'The revision must match the one on your order or traveller. If they differ, stop and ask.',
        watch: 'Making parts to an old revision is one of the most common and expensive mistakes. Check the revision block to see what changed.'
    },
    material: {
        name: 'Material',
        meaning: 'What the part is made of, including the grade and the heat-treat state (the temper, like T6).',
        check: 'The material certificate from the supplier must match, including the temper.',
        watch: '6061-T6 and 6061-T651 are both "6061" but not the same: the T651 plate has been stretched to relieve stress, so it warps less when machined.'
    },
    finish: {
        name: 'Finish',
        meaning: 'The coating or treatment after machining, like anodize, paint or plating. It can also point to a spec number.',
        check: 'Look in the notes for whether dimensions apply before or after the coating.',
        watch: 'Coatings add thickness. Hard anodize can add about 0.025 mm per side, enough to make a tight hole undersize.'
    },
    scale: {
        name: 'Scale',
        meaning: 'The size of the drawing compared to the real part. 1:1 is full size, 1:2 is half size, 2:1 is twice the real size.',
        check: 'Use it only to get a feel for the part size.',
        watch: 'Never measure a printed drawing with a ruler. Printers and PDFs resize the sheet. If a dimension is missing, ask for it.'
    },
    sheet: {
        name: 'Sheet',
        meaning: 'Which sheet this is, and how many there are in total.',
        check: '"1 OF 3" means two more sheets exist. Make sure you have all of them.',
        watch: 'Extra views, sections and notes often live on sheet 2 or 3. Missing a sheet means missing requirements.'
    },
    drawn: {
        name: 'Drawn by',
        meaning: 'The person who made the drawing, usually with a date.',
        check: 'This is who to ask when something is unclear, along with the checker.',
        watch: 'A drawing with no approval names or dates may still be a draft. Do not make production parts from it.'
    },
    checked: {
        name: 'Checked / approved by',
        meaning: 'The person who reviewed the drawing and approved it for use.',
        check: 'A released drawing has approval names and dates, or a "released" stamp from the document system.',
        watch: 'A drawing marked "PRELIMINARY" or "NOT FOR PRODUCTION" must not be used to make parts.'
    }
};

const state = { selected: 'revision' };
let svgRef = null, controlsRoot = null;

export function draw(svg) {
    svgRef = svg;
    const f = takeFocus('title_block');
    if (FIELD_INFO[f]) state.selected = f;
    render();
}

export function loadControls(container) {
    controlsRoot = container;
    renderControls();
}

function select(id) {
    state.selected = id;
    render();
    renderControls();
}

function render() {
    const svg = svgRef;
    if (!svg) return;
    svg.innerHTML = '';
    svg.appendChild(createSVG('rect', { x: 0, y: 0, width: 1000, height: 800, fill: '#f8fafc' }));

    svg.appendChild(text('Click any box of the title block', 500, 36, { size: 15, fill: COLORS.muted, anchor: 'middle' }));
    const k = 2.1;
    const tb = titleBlock(59, 52, k, { highlight: state.selected, onClick: select });
    svg.appendChild(tb.g);

    // Detail card for the selected field
    const info = FIELD_INFO[state.selected];
    const cardY = 460;
    svg.appendChild(createSVG('rect', { x: 40, y: cardY, width: 920, height: 320, rx: 10, fill: '#fff', stroke: '#2563eb', 'stroke-width': 2 }));
    svg.appendChild(text(info.name, 64, cardY + 38, { size: 22, weight: 800, fill: COLORS.ink }));

    let y = cardY + 72;
    const block = (label, body, color) => {
        svg.appendChild(text(label, 64, y, { size: 12, weight: 800, fill: color, letterSpacing: 1 }));
        const w = wrapText(body, 64, y + 22, 108, 21, { size: 15, fill: COLORS.text });
        svg.appendChild(w);
        y += 22 + w.childNodes.length * 21 + 14;
    };
    block('WHAT IT TELLS YOU', info.meaning, '#1d4ed8');
    block('WHAT TO CHECK', info.check, '#15803d');
    block('WATCH OUT', info.watch, '#b45309');
}

function renderControls() {
    if (!controlsRoot) return;
    const info = FIELD_INFO[state.selected];
    controlsRoot.innerHTML = `
        <div class="${UI.card}">
            <h4 class="${UI.h4}">Fields</h4>
            <div class="grid grid-cols-2 gap-1.5">
                ${TITLE_FIELDS.map(f => `<button data-field="${f.id}" class="${UI.segBtn} text-left ${f.id === state.selected ? UI.segOn : UI.segOff}">${esc(f.label)}</button>`).join('')}
            </div>
        </div>
        ${info.link ? `<button id="tb-link" class="${UI.smallBtn} w-full py-2">${esc(info.link[2])} ▶</button>` : ''}
        <div class="${UI.warn}">
            <div class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> First three things to check</div>
            <ol class="text-xs list-decimal pl-4 space-y-1">
                <li>Part number matches your order.</li>
                <li>Revision matches your order.</li>
                <li>You have every sheet ("1 OF 3" means three).</li>
            </ol>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed">Title blocks look different at every company, but almost all have these same fields. Find them first on any new drawing.</p>`;
    controlsRoot.querySelectorAll('[data-field]').forEach(b => b.onclick = () => select(b.dataset.field));
    const l = controlsRoot.querySelector('#tb-link');
    if (l) l.onclick = () => goTo(info.link[0], info.link[1]);
}
