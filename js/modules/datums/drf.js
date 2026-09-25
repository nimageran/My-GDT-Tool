// js/modules/datums/drf.js
// Datum Reference Frame in 3D (three.js): a part seats against datum
// simulators in order (3-2-1) and its six degrees of freedom lock one by
// one. Swapping the order on an out-of-square part shows datum precedence.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- STATE ---
const state = {
    order: ['A', 'B', 'C'],   // Datum precedence
    skewed: true,             // Out-of-square part (exaggerated)
    step: 0,                  // 0 = free, 1..3 = datums applied
    showArrows: true
};

// --- GEOMETRY (scene units) ---
// three.js axes: x → engineering X (normal to C), y → engineering Z (normal
// to A, up), z → engineering Y (normal to B).
const W = 3.0, H = 1.6, D = 2.0;
const SKEW_DEG = 7;                        // Back face lean, exaggerated
const AXIS = { A: 1, B: 2, C: 0 };         // Datum → three.js axis it is normal to
const ENG = ['X', 'Z', 'Y'];               // three.js axis index → engineering name
const FACE_NAME = { A: 'bottom face', B: 'back face', C: 'side face' };
const START_POS = new THREE.Vector3(3.5, 2.3, 3.3);
const START_ROT = new THREE.Euler(0.22, 0.55, -0.16);

const COLORS = {
    background: 0xf8fafc,
    datum: 0xe2e8f0,
    datumEdge: 0x0f172a,
    part: 0xb8b6ad,
    partEdge: 0x334155,
    contact: 0x0f172a,
    free: 0xf59e0b,
    gap: 0xdc2626
};

// --- RUNTIME ---
let svgRef = null, overlay = null, renderer = null, scene = null, camera = null, controls = null;
let partMesh = null, partEdges = null, arrowGroup = null, contactGroup = null, gapGroup = null;
let rafId = null, resizeObs = null, controlsContainer = null;
let pose = null, tween = null;
const datumLabels = {};

// --- EXPORTED METHODS ---

export function draw(svg) {
    svgRef = svg;
    const host = svg.parentElement;
    svg.style.display = 'none';

    overlay = document.createElement('div');
    overlay.dataset.moduleOverlay = 'drf';
    overlay.className = 'absolute inset-0 flex flex-col';
    overlay.innerHTML = `
        <div class="relative flex-1 min-h-0" id="drf-view">
            <div class="absolute top-4 left-4 bg-white/90 border border-slate-200 rounded-lg px-4 py-3 shadow-sm pointer-events-none">
                <div id="drf-step" class="text-xs font-bold tracking-widest text-slate-500 uppercase"></div>
                <div class="text-xs text-slate-400 mt-1">Drag to orbit · scroll to zoom</div>
            </div>
        </div>
        <div class="shrink-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-6 items-center">
            <div class="text-center shrink-0 w-28">
                <div id="drf-count" class="text-3xl font-extrabold text-slate-800"></div>
                <div class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">locked</div>
            </div>
            <div id="drf-chips" class="grid grid-cols-3 gap-2 shrink-0"></div>
            <div class="border-l border-slate-200 pl-6 min-w-0">
                <div class="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1">In plain English</div>
                <p id="drf-sentence" class="text-sm text-slate-700 leading-relaxed"></p>
            </div>
        </div>`;
    host.appendChild(overlay);

    initScene(overlay.querySelector('#drf-view'));
    for (const k of Object.keys(datumLabels)) delete datumLabels[k];
    setDatumLabels();
    pose = computePose(state.step);
    applyPose(pose);
    refreshAnnotations();
    loop();
}

export function loadControls(container) {
    controlsContainer = container;
    renderControls();
}

export function unload() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    resizeObs?.disconnect();
    controls?.dispose();
    scene?.traverse(obj => {
        obj.geometry?.dispose();
        const m = obj.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose(); x.dispose(); });
    });
    renderer?.dispose();
    overlay?.remove();
    if (svgRef) svgRef.style.display = '';
    overlay = renderer = scene = camera = controls = null;
    partMesh = partEdges = arrowGroup = contactGroup = gapGroup = null;
    pose = tween = null;
    for (const k of Object.keys(datumLabels)) delete datumLabels[k];
    svgRef = null;
}

// --- SCENE SETUP ---

function initScene(host) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(COLORS.background);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(9.5, 6.5, 10.5);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(2.2, 0.9, 1.8);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 5;
    controls.maxDistance = 30;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(sun);

    buildDatums();
    buildPart();
    arrowGroup = new THREE.Group();
    contactGroup = new THREE.Group();
    gapGroup = new THREE.Group();
    scene.add(arrowGroup, contactGroup, gapGroup);

    const resize = () => {
        const w = host.clientWidth, h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = w + 'px';
        renderer.domElement.style.height = h + 'px';
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    resizeObs = new ResizeObserver(resize);
    resizeObs.observe(host);
    resize();
}

function makeLabel(str, { color = '#0f172a', bg = 'rgba(255,255,255,0.9)', size = 0.55 } = {}) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '700 44px Inter, ui-sans-serif, system-ui, sans-serif';
    const w = Math.ceil(ctx.measureText(str).width) + 36;
    c.width = w; c.height = 72;
    ctx.font = '700 44px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(0, 0, w, 72, 14); ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, 18, 38);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(size * w / 72, size, 1);
    sprite.renderOrder = 10;
    return sprite;
}

function buildDatums() {
    const S = 6.5, T = 4.2;
    const planes = {
        A: { size: [S, S], rot: [-Math.PI / 2, 0, 0], pos: [S / 2, 0, S / 2], opacity: 0.95 },
        B: { size: [S, T], rot: [0, 0, 0], pos: [S / 2, T / 2, 0], opacity: 0.55 },
        C: { size: [S, T], rot: [0, Math.PI / 2, 0], pos: [0, T / 2, S / 2], opacity: 0.55 }
    };
    for (const [name, p] of Object.entries(planes)) {
        const geo = new THREE.PlaneGeometry(...p.size);
        const mat = new THREE.MeshStandardMaterial({
            color: COLORS.datum, transparent: p.opacity < 1, opacity: p.opacity,
            side: THREE.DoubleSide, roughness: 0.9, depthWrite: p.opacity >= 0.9
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.set(...p.rot);
        mesh.position.set(...p.pos);
        mesh.receiveShadow = name === 'A';
        scene.add(mesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COLORS.datumEdge }));
        edges.rotation.copy(mesh.rotation);
        edges.position.copy(mesh.position);
        scene.add(edges);
    }
    // Engineering axes along the plane intersections, labelled at the far ends
    const axes = [
        { dir: [1, 0, 0], len: S + 0.3, label: 'X' }, { dir: [0, 0, 1], len: S + 0.3, label: 'Y' }, { dir: [0, 1, 0], len: T + 0.3, label: 'Z' }
    ];
    for (const a of axes) {
        const arrow = new THREE.ArrowHelper(new THREE.Vector3(...a.dir), new THREE.Vector3(0, 0, 0), a.len, 0x0f172a, 0.3, 0.14);
        scene.add(arrow);
        const l = makeLabel(a.label, { size: 0.42, bg: 'rgba(255,255,255,0)' });
        l.material.depthTest = true;
        l.position.set(...a.dir.map(v => v * (a.len + 0.35)));
        if (a.label === 'Z') l.position.set(0.45, T - 0.2, 0.45);   // keep it inside the default view
        scene.add(l);
    }
}

function setDatumLabels() {
    const role = ['primary', 'secondary', 'tertiary'];
    const spots = { A: [1.9, 0.05, 5.3], B: [4.6, 3.8, 0.02], C: [0.02, 3.8, 4.6] };
    for (const name of ['A', 'B', 'C']) {
        if (datumLabels[name]) {
            scene.remove(datumLabels[name]);
            datumLabels[name].material.map.dispose();
            datumLabels[name].material.dispose();
        }
        const l = makeLabel(`Datum ${name} · ${role[state.order.indexOf(name)]}`, { size: 0.3 });
        l.position.set(...spots[name]);
        scene.add(l);
        datumLabels[name] = l;
    }
}

// Box with its back face (toward B) leaning by SKEW_DEG when skewed
function partGeometry() {
    const geo = new THREE.BoxGeometry(W, H, D);
    const delta = state.skewed ? H * Math.tan(SKEW_DEG * Math.PI / 180) : 0;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > 0 && pos.getZ(i) < 0) pos.setZ(i, pos.getZ(i) + delta);
    }
    geo.computeVertexNormals();
    return geo;
}

function localCorners() {
    const delta = state.skewed ? H * Math.tan(SKEW_DEG * Math.PI / 180) : 0;
    const c = [];
    for (const x of [-W / 2, W / 2]) for (const y of [-H / 2, H / 2]) for (const z of [-D / 2, D / 2]) {
        c.push(new THREE.Vector3(x, y, (y > 0 && z < 0) ? z + delta : z));
    }
    return c;
}

// Outward normal (local) of the face that meets each datum
function faceNormal(letter) {
    if (letter === 'A') return new THREE.Vector3(0, -1, 0);
    if (letter === 'C') return new THREE.Vector3(-1, 0, 0);
    const delta = state.skewed ? H * Math.tan(SKEW_DEG * Math.PI / 180) : 0;
    return new THREE.Vector3(0, delta, -H).normalize();
}

// Local corners of the face that meets each datum
function faceCorners(letter) {
    const c = localCorners();
    if (letter === 'A') return c.filter(v => v.y < 0);
    if (letter === 'C') return c.filter(v => v.x < 0);
    return c.filter(v => v.z < 0);   // back face (top back corners are shifted but still z < 0)
}

function buildPart() {
    if (partMesh) {
        scene.remove(partMesh, partEdges);
        partMesh.geometry.dispose();
        partEdges.geometry.dispose();
    }
    const geo = partGeometry();
    partMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.part, roughness: 0.55, metalness: 0.25 }));
    partMesh.castShadow = true;
    partEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: COLORS.partEdge }));
    scene.add(partMesh, partEdges);
}

// --- POSE: seat the part against the datums in order ---

const unit = i => new THREE.Vector3(...[0, 1, 2].map(k => (k === i ? 1 : 0)));

function worldCorners(q, p, corners = localCorners()) {
    return corners.map(v => v.clone().applyQuaternion(q).add(p));
}

function computePose(step) {
    const q = new THREE.Quaternion().setFromEuler(START_ROT);
    const p = START_POS.clone();
    for (let k = 0; k < step; k++) {
        const letter = state.order[k];
        const ax = AXIS[letter];
        const e = unit(ax);
        const nW = faceNormal(letter).applyQuaternion(q);

        if (k === 0) {
            // Primary: turn so the face lies flat on the datum
            q.premultiply(new THREE.Quaternion().setFromUnitVectors(nW, e.clone().negate()));
        } else if (k === 1) {
            // Secondary: only turning about the primary axis is still free
            const ea = unit(AXIS[state.order[0]]);
            const proj = nW.clone().sub(ea.clone().multiplyScalar(nW.dot(ea))).normalize();
            const target = e.clone().negate();
            const angle = Math.atan2(ea.dot(proj.clone().cross(target)), proj.dot(target));
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(ea, angle));
        }
        // Slide along the datum normal until the part touches it
        const min = Math.min(...worldCorners(q, p).map(v => v.getComponent(ax)));
        p.setComponent(ax, p.getComponent(ax) - min);
    }
    return { q, p };
}

function applyPose({ q, p }) {
    partMesh.quaternion.copy(q);
    partMesh.position.copy(p);
    partEdges.quaternion.copy(q);
    partEdges.position.copy(p);
}

function goToStep(step, animate = true) {
    state.step = Math.max(0, Math.min(3, step));
    const target = computePose(state.step);
    clearAnnotations();
    if (!animate || !pose) {
        pose = target;
        applyPose(pose);
        refreshAnnotations();
    } else {
        tween = { from: { q: partMesh.quaternion.clone(), p: partMesh.position.clone() }, to: target, t0: performance.now(), ms: 900 };
    }
    renderControls();
    updateHud();
}

// --- DEGREES OF FREEDOM ---

function dofStatus(step) {
    // key → datum letter that locked it (null = free)
    const status = {};
    for (const i of [0, 1, 2]) { status['T' + i] = null; status['R' + i] = null; }
    const [p, s, t] = state.order.map(l => AXIS[l]);
    if (step >= 1) {
        status['T' + p] = state.order[0];
        for (const i of [0, 1, 2]) if (i !== p) status['R' + i] = state.order[0];
    }
    if (step >= 2) { status['T' + s] = state.order[1]; status['R' + p] = state.order[1]; }
    if (step >= 3) status['T' + t] = state.order[2];
    return status;
}

// --- ANNOTATIONS (arrows, contacts, gap) ---

function clearGroup(g) {
    while (g.children.length) {
        const c = g.children.pop();
        c.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); });
    }
}

function clearAnnotations() {
    clearGroup(arrowGroup); clearGroup(contactGroup); clearGroup(gapGroup);
}

function freeMaterial() {
    return new THREE.MeshBasicMaterial({ color: COLORS.free, depthTest: false, transparent: true, opacity: 0.95 });
}

function translationArrow(axis, center) {
    const g = new THREE.Group();
    for (const sign of [1, -1]) {
        const dir = unit(axis).multiplyScalar(sign);
        const a = new THREE.ArrowHelper(dir, center, 2.0, COLORS.free, 0.35, 0.2);
        a.line.material.depthTest = false;
        a.cone.material.depthTest = false;
        a.renderOrder = 5;
        g.add(a);
    }
    return g;
}

function rotationArrow(axis, center) {
    const g = new THREE.Group();
    const r = 1.45, arc = Math.PI * 1.45;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 64, arc), freeMaterial());
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), freeMaterial());
    cone.position.set(r * Math.cos(arc), r * Math.sin(arc), 0);
    cone.rotation.z = arc;
    torus.renderOrder = cone.renderOrder = 5;
    g.add(torus, cone);
    if (axis === 0) g.rotation.y = Math.PI / 2;
    if (axis === 1) g.rotation.x = -Math.PI / 2;
    g.position.copy(center);
    return g;
}

function refreshAnnotations() {
    clearAnnotations();
    const status = dofStatus(state.step);
    const center = partMesh.position.clone();

    if (state.showArrows) {
        for (const i of [0, 1, 2]) {
            if (!status['T' + i]) arrowGroup.add(translationArrow(i, center));
            if (!status['R' + i]) arrowGroup.add(rotationArrow(i, center));
        }
    }

    // Contact points: 3 on the primary, 2 on the secondary, 1 on the tertiary
    const need = [3, 2, 1];
    const q = partMesh.quaternion, p = partMesh.position;
    for (let k = 0; k < state.step; k++) {
        const letter = state.order[k];
        const ax = AXIS[letter];
        const touching = worldCorners(q, p, faceCorners(letter)).filter(v => Math.abs(v.getComponent(ax)) < 1e-4);
        pickSpread(touching, need[k]).forEach(v => {
            const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12),
                new THREE.MeshBasicMaterial({ color: COLORS.contact, depthTest: false }));
            dot.position.copy(v);
            dot.renderOrder = 6;
            contactGroup.add(dot);
        });
    }

    // Gap: a seated face that does not sit flat on its datum
    const gap = currentGap();
    if (gap) {
        const from = gap.corner, to = gap.corner.clone().setComponent(gap.axis, 0);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, from.distanceTo(to), 8),
            new THREE.MeshBasicMaterial({ color: COLORS.gap, depthTest: false }));
        rod.position.copy(from.clone().add(to).multiplyScalar(0.5));
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        rod.renderOrder = 6;
        gapGroup.add(rod);
        const l = makeLabel(`gap ${gap.size.toFixed(2)}`, { color: '#dc2626', size: 0.3 });
        l.position.copy(from.clone().add(to).multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.35, 0));
        gapGroup.add(l);
    }
}

// The largest distance of a seated face's corners from its datum
function currentGap() {
    const q = partMesh.quaternion, p = partMesh.position;
    let worst = null;
    for (let k = 0; k < state.step; k++) {
        const letter = state.order[k];
        const ax = AXIS[letter];
        for (const v of worldCorners(q, p, faceCorners(letter))) {
            const d = v.getComponent(ax);
            if (d > 1e-3 && (!worst || d > worst.size)) worst = { letter, axis: ax, corner: v, size: d };
        }
    }
    return worst;
}

// Choose n points spread out from the touching ones
function pickSpread(points, n) {
    if (points.length <= n) return points;
    if (n === 1) return [points[0]];
    let best = [points[0], points[1]], bestD = -1;
    for (const a of points) for (const b of points) {
        const d = a.distanceTo(b);
        if (d > bestD) { bestD = d; best = [a, b]; }
    }
    if (n === 2) return best;
    const third = points.filter(v => !best.includes(v))
        .sort((u, v) => (v.distanceTo(best[0]) + v.distanceTo(best[1])) - (u.distanceTo(best[0]) + u.distanceTo(best[1])))[0];
    return [...best, third];
}

// --- HUD (step caption, DOF chips, sentence) ---

function updateHud() {
    if (!overlay) return;
    const status = dofStatus(state.step);
    const locked = Object.values(status).filter(Boolean).length;
    const role = ['primary', 'secondary', 'tertiary'];

    overlay.querySelector('#drf-step').textContent = state.step === 0
        ? `Free part · frame ${state.order.join(' | ')}`
        : `Step ${state.step} of 3 · datum ${state.order[state.step - 1]} ${role[state.step - 1]}`;
    overlay.querySelector('#drf-count').textContent = `${locked} / 6`;

    // Chips in engineering order: X, Y, Z (three.js axes 0, 2, 1)
    const chips = [];
    for (const kind of ['T', 'R']) {
        for (const i of [0, 2, 1]) {
            const by = status[kind + i];
            const label = kind === 'T' ? `Slide ${ENG[i]}` : `Turn about ${ENG[i]}`;
            chips.push(by
                ? `<div class="px-3 py-1.5 rounded-md bg-slate-100 text-slate-500 text-xs font-semibold whitespace-nowrap"><i class="fa-solid fa-lock text-[10px] mr-1"></i>${label} <span class="text-slate-400">· ${by}</span></div>`
                : `<div class="px-3 py-1.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold whitespace-nowrap">${label} <span class="text-amber-500">· free</span></div>`);
        }
    }
    overlay.querySelector('#drf-chips').innerHTML = chips.join('');
    overlay.querySelector('#drf-sentence').textContent = sentence();
}

function sentence() {
    const [p, s, t] = state.order;
    const eng = l => ENG[AXIS[l]];
    switch (state.step) {
        case 0:
            return 'Nothing holds the part yet: it can slide along X, Y and Z and turn about all three. Measure it twice and you would get two different answers.';
        case 1:
            return `Primary datum ${p}: the ${FACE_NAME[p]} rests on at least 3 points of ${p}. That stops sliding along ${eng(p)} and both tilts. 3 degrees of freedom locked, 3 still free.`;
        case 2: {
            let str = `Secondary datum ${s}: pushed against ${s} until at least 2 points touch. That stops sliding along ${eng(s)} and turning about ${eng(p)}. 5 locked, 1 free.`;
            if (state.skewed) str += ` The part is out of square, so its ${FACE_NAME[s]} can't sit flat on ${s}: it touches along one edge and leaves a gap. Swap the datum order and the part sits differently.`;
            return str;
        }
        default: {
            let str = `Tertiary datum ${t}: slid until 1 point touches ${t}. All 6 degrees of freedom are locked, so the part sits the same way every time and measurements repeat.`;
            if (state.skewed) str += ` Because ${p} is primary, ${p} decides how the part sits, and the out-of-square error shows up as a gap at ${s}.`;
            return str;
        }
    }
}

// --- RENDER LOOP ---

function loop() {
    rafId = requestAnimationFrame(loop);
    if (tween) {
        const k = Math.min(1, (performance.now() - tween.t0) / tween.ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const q = new THREE.Quaternion().slerpQuaternions(tween.from.q, tween.to.q, e);
        const p = new THREE.Vector3().lerpVectors(tween.from.p, tween.to.p, e);
        applyPose({ q, p });
        if (k >= 1) {
            pose = tween.to;
            tween = null;
            refreshAnnotations();
        }
    }
    controls.update();
    renderer.render(scene, camera);
}

// --- CONTROLS UI ---

const segBtn = 'flex-1 px-2 py-1.5 text-xs font-bold rounded border transition-colors';
const segOn = 'bg-blue-600 text-white border-blue-600';
const segOff = 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50';

function renderControls() {
    if (!controlsContainer) return;
    const ord = state.order.join('');
    const role = ['primary', 'secondary', 'tertiary'];
    const steps = [
        { n: 0, label: 'Free part', sub: '0 of 6 locked' },
        ...state.order.map((l, i) => ({ n: i + 1, label: `Seat on ${l} (${role[i]})`, sub: `${[3, 2, 1][i]} point${i < 2 ? 's' : ''} of contact` }))
    ];

    controlsContainer.innerHTML = `
        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Datum order in the frame</h4>
            <div class="flex gap-2">
                <button data-order="ABC" class="${segBtn} ${ord === 'ABC' ? segOn : segOff}">A | B | C</button>
                <button data-order="BAC" class="${segBtn} ${ord === 'BAC' ? segOn : segOff}">B | A | C</button>
            </div>
            <h4 class="font-bold text-xs text-slate-500 uppercase mt-4 mb-3">Part</h4>
            <div class="flex gap-2">
                <button data-skew="0" class="${segBtn} ${!state.skewed ? segOn : segOff}">Perfectly square</button>
                <button data-skew="1" class="${segBtn} ${state.skewed ? segOn : segOff}">Out of square</button>
            </div>
            <p class="text-xs text-slate-400 mt-2">Out of square: the back face leans ${SKEW_DEG}° (exaggerated so you can see it).</p>
        </div>

        <div class="bg-white p-4 rounded shadow-sm border border-slate-200">
            <h4 class="font-bold text-xs text-slate-500 uppercase mb-3">Set up the part</h4>
            <div class="space-y-2">
                ${steps.map(s => `
                    <button data-step="${s.n}" class="w-full text-left px-3 py-2 rounded border ${state.step === s.n ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}">
                        <div class="text-sm font-bold ${state.step === s.n ? 'text-blue-700' : 'text-slate-700'}">${s.n === 0 ? '' : s.n + '. '}${s.label}</div>
                        <div class="text-xs text-slate-400">${s.sub}</div>
                    </button>`).join('')}
            </div>
            <div class="flex gap-2 mt-3">
                <button id="drf-reset" class="flex-1 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-2 rounded text-slate-700 font-bold">RESET</button>
                <button id="drf-next" class="flex-1 text-xs bg-slate-800 hover:bg-slate-700 px-2 py-2 rounded text-white font-bold" ${state.step === 3 ? 'disabled style="opacity:.4"' : ''}>NEXT STEP ▶</button>
            </div>
            <label class="flex items-center gap-2 mt-3 text-sm text-slate-600">
                <input type="checkbox" id="drf-arrows" ${state.showArrows ? 'checked' : ''}> Show free directions (orange arrows)
            </label>
        </div>

        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-900">
            <div class="font-bold mb-1"><i class="fa-solid fa-lightbulb"></i> The 3-2-1 rule</div>
            <div class="text-xs opacity-90 leading-relaxed">
                The primary datum needs at least 3 points of contact, the secondary 2, the tertiary 1. Together they remove all 6 degrees of freedom, so inspection and machining set the part up the same way. The order in the frame is the order of contact, and on a real (imperfect) part, a different order gives a different setup.
            </div>
        </div>
    `;

    const c = controlsContainer;
    c.querySelectorAll('[data-order]').forEach(b => b.onclick = () => {
        state.order = b.dataset.order.split('');
        if (scene) setDatumLabels();
        goToStep(state.step, false);
    });
    c.querySelectorAll('[data-skew]').forEach(b => b.onclick = () => {
        state.skewed = b.dataset.skew === '1';
        if (scene) buildPart();
        goToStep(state.step, false);
    });
    c.querySelectorAll('[data-step]').forEach(b => b.onclick = () => goToStep(+b.dataset.step));
    c.querySelector('#drf-reset').onclick = () => goToStep(0);
    c.querySelector('#drf-next').onclick = () => goToStep(state.step + 1);
    c.querySelector('#drf-arrows').onchange = e => { state.showArrows = e.target.checked; if (scene && !tween) refreshAnnotations(); };

    updateHud();
}
