import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { BIZ, MENU, REVIEWS, MENU_LIST } from './config.js';
import { sendLead, isDemo } from './leads.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;
const narrow = () => innerWidth < 900;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const gbp = n => '£' + n.toFixed(2);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const loaderBar = $('#loader .bar i');
loaderBar.style.width = '30%';

/* ---------------- static content ---------------- */
$$('[data-tel]').forEach(a => a.href = 'tel:' + BIZ.phoneTel);
$$('[data-phone]').forEach(e => e.textContent = BIZ.phone);
$$('[data-rating]').forEach(e => e.textContent = BIZ.rating.toFixed(1));
$$('[data-reviews]').forEach(e => e.textContent = BIZ.reviewCount);
$$('[data-address]').forEach(e => e.textContent = BIZ.address);
$$('[data-maps]').forEach(a => a.href = BIZ.mapsUrl);
$$('[data-fb]').forEach(a => a.href = BIZ.facebook);
$$('[data-collect]').forEach(e => e.textContent = BIZ.delivery.collectMins);
const todayIdx = (new Date().getDay() + 6) % 7;
['#hoursFaq', '#hoursFoot'].forEach(sel => {
  $(sel).innerHTML = BIZ.hours.map(([d, h], i) => `<div class="${i === todayIdx ? 'today' : ''}"><span>${d}</span><span>${h}</span></div>`).join('');
});
$('#menuGrid').innerHTML = MENU_LIST.map(([g, items]) => `<h4>${g}</h4>` + items.map(([n, p]) => `<div class="mi"><span>${n}</span><b>${gbp(p)}</b></div>`).join('')).join('');
$('#cards').innerHTML = REVIEWS.map(r => `<div class="card"><div class="stars">“</div><p>${r.q}</p><cite>${r.who} · ${r.src}</cite></div>`).join('');

/* ---------------- order state + pricing (real menu rules) ---------------- */
const order = { fish: 'mcod', chips: 'mchips', extras: {}, season: new Set(['Salt', 'Vinegar']) };
const byId = id => [...MENU.fish, ...MENU.chips, ...MENU.extras].find(x => x.id === id);
function priceLines() {
  const L = [];
  const f = order.fish && byId(order.fish), c = byId(order.chips);
  if (f && f.withChips && c.id === 'mchips') L.push({ n: `${f.name} & chips (meal price)`, p: f.withChips, deal: true });
  else { if (f) L.push({ n: f.name, p: f.price }); if (c && c.price) L.push({ n: c.name, p: c.price }); }
  for (const [id, q] of Object.entries(order.extras)) if (q) { const e = byId(id); L.push({ n: `${q > 1 ? q + ' × ' : ''}${e.name}`, p: e.price * q }); }
  if (order.season.size) L.push({ n: [...order.season].join(', '), p: 0 });
  return L;
}
const total = () => priceLines().reduce((s, l) => s + l.p, 0);

let tab = 'fish';
function renderOpts() {
  const box = $('#opts'); let h = '';
  if (tab === 'fish') h = [{ id: '', name: 'No fish', price: 0 }, ...MENU.fish].map(f => `<button class="opt ${order.fish === f.id ? 'on' : ''}" data-fish="${f.id}">${f.name}<small>${f.id ? gbp(f.price) : '–'}</small></button>`).join('');
  if (tab === 'chips') h = MENU.chips.map(c => `<button class="opt ${order.chips === c.id ? 'on' : ''}" data-chips="${c.id}">${c.name}<small>${c.price ? gbp(c.price) : '–'}</small></button>`).join('');
  if (tab === 'extras') h = MENU.extras.map(e => { const q = order.extras[e.id] || 0; return `<button class="opt ${q ? 'on' : ''}" data-extra="${e.id}">${e.name}<small>${gbp(e.price)}</small>${q ? `<span class="q">×${q}</span><span class="minus" data-minus="${e.id}" role="button" aria-label="Remove one">−</span>` : ''}</button>`; }).join('');
  if (tab === 'season') h = MENU.seasoning.map(s => `<button class="opt ${order.season.has(s) ? 'on' : ''}" data-season="${s}">${s}<small>Free</small></button>`).join('');
  box.innerHTML = h;
  const L = priceLines();
  $('#lines').innerHTML = L.length ? L.map(l => `<div class="${l.deal ? 'deal' : ''}"><span>${l.n}</span><span>${l.p ? gbp(l.p) : ''}</span></div>`).join('') : '<div>Your box is empty</div>';
  $('#total').textContent = gbp(total()); $('#total2').textContent = gbp(total());
}
$$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; $$('.tab').forEach(t => t.classList.toggle('on', t === b)); renderOpts(); });
$('#opts').addEventListener('click', e => {
  const m = e.target.closest('[data-minus]');
  if (m) { e.stopPropagation(); const id = m.dataset.minus; order.extras[id] = Math.max(0, (order.extras[id] || 0) - 1); renderOpts(); sync(); return; }
  const b = e.target.closest('.opt'); if (!b) return;
  if (b.dataset.fish !== undefined) order.fish = b.dataset.fish;
  if (b.dataset.chips) order.chips = b.dataset.chips;
  if (b.dataset.extra) { const id = b.dataset.extra; order.extras[id] = Math.min(4, (order.extras[id] || 0) + 1); }
  if (b.dataset.season) { const s = b.dataset.season; order.season.has(s) ? order.season.delete(s) : (order.season.add(s), sprinkle(s)); }
  renderOpts(); sync();
});
renderOpts();

/* ---------------- 3D ---------------- */
const canvas = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }
const S = { camD: 6.6, camY: 2.5, lookY: 0.25, fishLift: 0, fry: 0, wrap: 0, build: 0, dim: 0, sway: 1, offX: 0, offY: 0 };
const O = { wrap: 0 }; // order wrap override
let sync = () => {}, sprinkle = () => {}, shake = () => {}, spinOnce = () => {};

if (!renderer) { $('#fallback').hidden = false; canvas.hidden = true; finishLoad(); }
else Promise.race([document.fonts.load('92px Anton'), new Promise(r => setTimeout(r, 1500))]).catch(() => {}).then(init3D);

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function hash(x, y, z) { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); }
function cnoise(x, y, z) { return Math.sin(x * 9.1 + Math.sin(z * 4.3)) * Math.cos(y * 7.7 + x * 3.1) * 0.5 + Math.sin(z * 13.7 + y * 5.3) * 0.3 + Math.sin((x + y + z) * 23.0) * 0.2; }

function init3D() {
  const dpr = Math.min(devicePixelRatio || 1, touch ? 1.75 : 2);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1230, 9, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 60);

  scene.add(new THREE.HemisphereLight(0x8fa3ff, 0x3a2200, 0.7));
  const key = new THREE.DirectionalLight(0xffe2a8, 2.6); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f8cff, 2.0); rim.position.set(-4, 3, -5); scene.add(rim);
  const fryLight = new THREE.PointLight(0xff8a1a, 0, 6, 1.5); fryLight.position.set(0, 1.2, 0.6); scene.add(fryLight);

  /* textures */
  const batterTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 90 + Math.random() * 120 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 3.2, 0, 7); g.fill(); }
  });
  batterTex.wrapS = batterTex.wrapT = THREE.RepeatWrapping; batterTex.repeat.set(3, 2); batterTex.colorSpace = THREE.NoColorSpace;
  const batterCol = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e2a443'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const r = Math.random(); g.fillStyle = r < .5 ? 'rgba(170,95,20,.35)' : r < .8 ? 'rgba(255,214,120,.4)' : 'rgba(120,60,10,.4)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 6, 0, 7); g.fill(); }
  });
  batterCol.wrapS = batterCol.wrapT = THREE.RepeatWrapping; batterCol.repeat.set(2, 1);
  const paperTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f1ead6'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,40,60,.45)';
    for (let c = 0; c < 3; c++) for (let y = 90; y < h - 20; y += 9) { const x0 = 22 + c * 162; g.fillRect(x0, y, 140 * (0.7 + Math.random() * 0.3), 3); }
    g.fillStyle = '#ffd21f'; g.fillRect(0, 18, w, 56);
    g.fillStyle = '#0b1230'; g.textAlign = 'center'; let fs = 40; do { g.font = fs + 'px Anton, Impact, sans-serif'; fs -= 2; } while (g.measureText('THE YELLOW FISHERMAN').width > w * 0.9); g.fillText('THE YELLOW FISHERMAN', w / 2, 60);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(200,170,90,.12)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 30, 0, 7); g.fill(); }
  });
  const kraft = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b98c56'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '90,60,30' : '230,200,150'},.12)`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); } });
  const boxFront = canvasTex(1024, 220, (g, w, h) => {
    g.fillStyle = '#b98c56'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '90,60,30' : '230,200,150'},.12)`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); }
    g.fillStyle = '#ffd21f'; g.fillRect(0, 40, w, 140);
    g.fillStyle = '#0b1230'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 100; do { g.font = fs + 'px Anton, Impact, sans-serif'; fs -= 4; } while (g.measureText('THE YELLOW FISHERMAN').width > w * 0.86); g.fillText('THE YELLOW FISHERMAN', w / 2, 112);
  });
  const shadowTex = canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const softTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });

  const batterMat = new THREE.MeshStandardMaterial({ map: batterCol, bumpMap: batterTex, bumpScale: 2.5, roughness: 0.62, metalness: 0, emissive: 0xff7a00, emissiveIntensity: 0 });
  const chipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, bumpMap: batterTex, bumpScale: 0.9, roughness: 0.62 });
  const kraftMat = new THREE.MeshStandardMaterial({ map: kraft, roughness: 0.92 });
  const frontMat = new THREE.MeshStandardMaterial({ map: boxFront, roughness: 0.9 });

  const world = new THREE.Group(); scene.add(world);
  const rig = new THREE.Group(); world.add(rig);

  // counter plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.4, 0.16, 72), new THREE.MeshStandardMaterial({ color: 0x141c45, metalness: 0.7, roughness: 0.35 }));
  plinth.position.y = -0.08; rig.add(plinth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.025, 8, 120), new THREE.MeshBasicMaterial({ color: 0xffd21f }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; rig.add(ring);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006; rig.add(shadow);

  // the box
  const W = 2.4, D = 1.6, H = 0.5, T = 0.04;
  const box = new THREE.Group(); rig.add(box);
  const part = (w, h, d, x, y, z, m = kraftMat) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); box.add(me); return me; };
  part(W + 2 * T, T, D + 2 * T, 0, T / 2, 0);
  part(W + 2 * T, H, T, 0, H / 2, D / 2 + T / 2, [kraftMat, kraftMat, kraftMat, kraftMat, frontMat, kraftMat]);
  part(W + 2 * T, H, T, 0, H / 2, -D / 2 - T / 2);
  part(T, H, D, -W / 2 - T / 2, H / 2, 0); part(T, H, D, W / 2 + T / 2, H / 2, 0);
  const liner = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95 }));
  liner.rotation.x = -Math.PI / 2; liner.position.y = T + 0.002; box.add(liner);

  // paper flaps
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, side: THREE.DoubleSide });
  function flapGeo() {
    const g = new THREE.PlaneGeometry(1.48, 1.95, 16, 8); g.translate(0.74, 0, 0); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.1 * Math.sin(Math.PI * x / 1.48) + 0.025 * cnoise(x * 2, 0, z * 2)); }
    g.computeVertexNormals(); return g;
  }
  const flaps = [];
  [[-1, 0.52], [1, 0.56]].forEach(([side, y]) => {
    const outer = new THREE.Group(); outer.position.set(side * (W / 2 + T), y, 0); outer.scale.x = -side;
    const inner = new THREE.Group(); outer.add(inner);
    inner.add(new THREE.Mesh(flapGeo(), paperMat)); box.add(outer); flaps.push(inner);
  });
  const OPEN = Math.PI + 0.32;

  /* geometries */
  function fishGeo(flat) {
    const g = new THREE.SphereGeometry(1, 64, 32); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const body = 0.5 + 0.5 * sstep(-1.15, 0.35, x);
      const zz = z * 0.4 * body * (1 + 0.08 * Math.sin(x * 5)), yy = y * (flat ? 0.15 : 0.21) * (0.6 + 0.4 * body);
      const lump = 0.07 * cnoise(x * 4.2, y * 4.2, z * 4.2) + 0.04 * cnoise(x * 11, y * 11 + 3, z * 11) + 0.02 * hash(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50));
      const k = 1 + lump; p.setXYZ(i, x * 0.66 * (1 + lump * 0.25), yy * k + (y > 0 ? 0.02 : 0), zz * k);
    }
    g.computeVertexNormals(); return g;
  }
  const geos = {
    fish: fishGeo(false), plaice: fishGeo(true),
    nugget: (() => { const g = new THREE.IcosahedronGeometry(0.1, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.18 * cnoise(v.x * 30, v.y * 30, v.z * 30)); v.y *= 0.75; v.x *= 1.3; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })(),
    chip: new THREE.BoxGeometry(0.4, 0.088, 0.088, 2, 1, 1),
    cake: (() => { const g = new THREE.CylinderGeometry(0.3, 0.32, 0.14, 32, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + 0.06 * cnoise(v.x * 9, v.y * 9, v.z * 9); p.setXYZ(i, v.x * n, v.y, v.z * n); } g.computeVertexNormals(); return g; })(),
    sausage: new THREE.CapsuleGeometry(0.1, 0.72, 6, 16), saveloy: new THREE.CapsuleGeometry(0.075, 0.6, 6, 16),
    gherkin: new THREE.CapsuleGeometry(0.09, 0.32, 6, 12), onion: new THREE.SphereGeometry(0.12, 24, 16),
    mars: new THREE.CapsuleGeometry(0.09, 0.42, 4, 12), pot: new THREE.CylinderGeometry(0.26, 0.21, 0.26, 32, 1, true), potLid: new THREE.CircleGeometry(0.245, 32),
    potBase: new THREE.CircleGeometry(0.21, 32), can: new THREE.CylinderGeometry(0.13, 0.13, 0.46, 32),
  };
  geos.chip.translate(0, 0, 0);
  const potMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, roughness: 0.8, side: THREE.DoubleSide });
  const peaMat = new THREE.MeshStandardMaterial({ color: 0x6f9a2a, roughness: 0.55, bumpMap: batterTex, bumpScale: 3 });
  const curryMat = new THREE.MeshStandardMaterial({ color: 0xb8741a, roughness: 0.25 });
  const canTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, 64 + Math.sin(x / w * Math.PI * 4) * 16); g.stroke(); });
  const mats = {
    sausage: batterMat, mars: new THREE.MeshStandardMaterial({ map: batterCol, bumpMap: batterTex, bumpScale: 2, color: 0xc08a50, roughness: .6 }),
    saveloy: new THREE.MeshStandardMaterial({ color: 0xc23a22, roughness: 0.35 }),
    gherkin: new THREE.MeshStandardMaterial({ color: 0x4f6b1c, roughness: 0.4, bumpMap: batterTex, bumpScale: 4 }),
    onion: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.2, transparent: true, opacity: 0.92 }),
    cake: new THREE.MeshStandardMaterial({ map: batterCol, bumpMap: batterTex, bumpScale: 4, color: 0xd09a5a, roughness: .7 }),
    can: [new THREE.MeshStandardMaterial({ map: canTex, metalness: 0.5, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.9, roughness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.9, roughness: 0.25 })],
  };
  function makePot(fill) { const g = new THREE.Group(); const w = new THREE.Mesh(geos.pot, potMat); w.position.y = 0.13; g.add(w); const b = new THREE.Mesh(geos.potBase, potMat); b.rotation.x = -Math.PI / 2; b.position.y = 0.002; g.add(b); const l = new THREE.Mesh(geos.potLid, fill); l.rotation.x = -Math.PI / 2; l.position.y = 0.22; g.add(l); return g; }
  function makeItem(kind) {
    switch (kind) {
      case 'peas': return makePot(peaMat);
      case 'curry': return makePot(curryMat);
      case 'can': { const m = new THREE.Mesh(geos.can, mats.can); m.position.y = 0.23; const g = new THREE.Group(); g.add(m); return g; }
      case 'onion': { const g = new THREE.Group(); const m = new THREE.Mesh(geos.onion, mats.onion); m.position.y = 0.12; g.add(m); return g; }
      case 'gherkin': { const g = new THREE.Group(); const m = new THREE.Mesh(geos.gherkin, mats.gherkin); m.rotation.z = Math.PI / 2; m.position.y = 0.09; g.add(m); return g; }
      case 'cake': return new THREE.Mesh(geos.cake, mats.cake);
      default: { const m = new THREE.Mesh(geos[kind], mats[kind]); m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); return g; }
    }
  }

  /* chips + scampi physics (instanced) */
  const MAXC = 48, MAXN = 12;
  const chipIM = new THREE.InstancedMesh(geos.chip, chipMat, MAXC); chipIM.count = 0; box.add(chipIM);
  const nugIM = new THREE.InstancedMesh(geos.nugget, batterMat, MAXN); nugIM.count = 0; box.add(nugIM);
  const col = new THREE.Color();
  for (let i = 0; i < MAXC; i++) chipIM.setColorAt(i, col.setHSL(0.1 + Math.random() * 0.03, 0.88, 0.42 + Math.random() * 0.12));
  let bodies = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpV = new THREE.Vector3();
  function region(kind) {
    const hasFish = order.fish && byId(order.fish).kind !== 'scampi';
    const hasScampi = order.fish === 'scampi';
    if (kind === 'nug') return [-1.15, -0.05];
    return hasFish ? [-0.05, 1.15] : hasScampi ? [0.05, 1.15] : [-1.15, 1.15];
  }
  function addBody(kind, delay) {
    const [a, b] = region(kind);
    bodies.push({ kind, p: new THREE.Vector3(lerp(a, b, Math.random()), 2.2 + Math.random() * 1.2, (Math.random() - .5) * 1.2), v: new THREE.Vector3((Math.random() - .5) * .6, -1, (Math.random() - .5) * .6),
      r: kind === 'nug' ? 0.1 : 0.085, yaw: Math.random() * 6.3, pitch: Math.random() * 6.3, roll: Math.random() * 6.3, wy: (Math.random() - .5) * 8, wp: (Math.random() - .5) * 14, rest: (Math.random() - .5) * 0.5,
      len: 0.75 + Math.random() * 0.45, born: performance.now() + delay, scale: 0, dying: false });
  }
  function pour(kind, n) { for (let i = 0; i < n; i++) addBody(kind, i * (reduce ? 0 : 28)); }
  function dumpKind(kind) { bodies.forEach(b => { if (b.kind === kind) b.dying = true; }); }
  shake = () => { bodies.forEach(b => { if (b.p.y < 1) { b.v.y += 2 + Math.random() * 2; b.v.x += (Math.random() - .5) * 1.5; b.v.z += (Math.random() - .5) * 1.5; b.wp += (Math.random() - .5) * 20; } }); };
  function stepPhysics(dt, now) {
    const live = bodies.filter(b => b.born <= now);
    for (const b of live) {
      b.scale = Math.min(1, b.scale + dt * 6);
      if (b.dying) { b.scale -= dt * 10; continue; }
      b.v.y -= 9.0 * dt; b.p.addScaledVector(b.v, dt);
      const [a, c] = region(b.kind), r = b.r;
      if (b.p.y < T + r) { b.p.y = T + r; if (b.v.y < 0) b.v.y *= -0.25; b.v.x *= 0.86; b.v.z *= 0.86; b.ground = true; } else b.ground = false;
      if (b.p.x < a + r) { b.p.x = a + r; b.v.x = Math.abs(b.v.x) * 0.4; }
      if (b.p.x > c - r) { b.p.x = c - r; b.v.x = -Math.abs(b.v.x) * 0.4; }
      if (b.p.z < -D / 2 + r) { b.p.z = -D / 2 + r; b.v.z = Math.abs(b.v.z) * 0.4; }
      if (b.p.z > D / 2 - r) { b.p.z = D / 2 - r; b.v.z = -Math.abs(b.v.z) * 0.4; }
    }
    for (let it = 0; it < 2; it++) for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = live[i], B = live[j]; if (A.dying || B.dying) continue;
      tmpV.subVectors(A.p, B.p); const d2 = tmpV.lengthSq(), rr = A.r + B.r;
      if (d2 < rr * rr && d2 > 1e-8) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5; tmpV.multiplyScalar(1 / d);
        A.p.addScaledVector(tmpV, push); B.p.addScaledVector(tmpV, -push);
        const rel = (A.v.x - B.v.x) * tmpV.x + (A.v.y - B.v.y) * tmpV.y + (A.v.z - B.v.z) * tmpV.z;
        if (rel < 0) { A.v.addScaledVector(tmpV, -rel * 0.6); B.v.addScaledVector(tmpV, rel * 0.6); }
        if (tmpV.y > 0.5) { A.v.x *= 0.92; A.v.z *= 0.92; A.ground = true; } else if (tmpV.y < -0.5) { B.v.x *= 0.92; B.v.z *= 0.92; B.ground = true; }
      }
    }
    let ci = 0, ni = 0;
    for (const b of live) {
      if (b.ground) { b.wp *= 0.8; b.wy *= 0.85; b.pitch = lerp(b.pitch, Math.round(b.pitch / Math.PI) * Math.PI + b.rest, 0.15); }
      b.yaw += b.wy * dt; b.pitch += b.wp * dt; b.roll += b.wp * 0.3 * dt;
      tmpE.set(b.roll, b.yaw, b.pitch, 'YXZ'); tmpQ.setFromEuler(tmpE);
      const s = Math.max(0, b.scale);
      if (b.kind === 'chip' && ci < MAXC) { tmpS.set(s * b.len, s, s); tmpM.compose(b.p, tmpQ, tmpS); chipIM.setMatrixAt(ci++, tmpM); }
      if (b.kind === 'nug' && ni < MAXN) { tmpS.setScalar(s); tmpM.compose(b.p, tmpQ, tmpS); nugIM.setMatrixAt(ni++, tmpM); }
    }
    bodies = bodies.filter(b => !(b.dying && b.scale <= 0));
    chipIM.count = ci; nugIM.count = ni;
    chipIM.instanceMatrix.needsUpdate = true; nugIM.instanceMatrix.needsUpdate = true;
    let top = T; for (const b of live) if (b.kind === 'chip' && !b.dying) top = Math.max(top, b.p.y); return top;
  }

  // cheese: melted blobs over the chips
  const cheese = new THREE.Group(); box.add(cheese); cheese.scale.setScalar(0.001);
  const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.28, emissive: 0x664400, emissiveIntensity: 0.25 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.SphereGeometry(1, 20, 10); const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) { const v = new THREE.Vector3().fromBufferAttribute(p, j); const n = 1 + 0.3 * cnoise(v.x * 3 + i, v.y * 3, v.z * 3); p.setXYZ(j, v.x * n, v.y * 0.25, v.z * n); }
    g.computeVertexNormals(); const m = new THREE.Mesh(g, cheeseMat); const r = 0.12 + Math.random() * 0.1; m.scale.set(r, r, r * 0.8);
    m.position.set((Math.random() - .5) * 0.9, (Math.random() - .5) * 0.06, (Math.random() - .5) * 1.0); cheese.add(m);
  }
  /* placed items (fish + extras) */
  const placed = new Map();
  let fishMesh = null, chipsNow = null;
  const fishBase = new THREE.Vector3();
  const inSlots = [[0.62, -0.32, 0.5], [0.55, 0.36, -0.4], [0.2, -0.05, 1.3], [0.85, 0.05, 1.7], [0.35, 0.5, 0.2], [0.75, -0.5, -0.9]];
  const outSlots = [[-1.45, 1.4], [-0.75, 1.55], [0.0, 1.6], [0.75, 1.55], [1.45, 1.4], [2.05, 0.9], [-2.05, 0.9], [2.2, 0.1], [-2.2, 0.1], [2.05, -0.75], [-2.05, -0.75], [1.4, -1.45], [-1.4, -1.45], [0, -1.6]];
  const insideKinds = new Set(['sausage', 'saveloy', 'mars', 'cake']);
  function drop(obj, x, y, z, ry) {
    obj.position.set(x, y + 2.6, z); obj.rotation.y = ry; obj.scale.setScalar(1);
    gsap.to(obj.position, { y, duration: reduce ? 0 : 0.9, ease: 'bounce.out' });
    if (!reduce) gsap.from(obj.rotation, { x: 1.2, z: -0.8, duration: 0.9, ease: 'power2.out' });
  }
  function lift(obj) { gsap.to(obj.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.25, onComplete: () => obj.parent && obj.parent.remove(obj) }); }
  sync = () => {
    // fish
    const fk = order.fish ? 'fish:' + order.fish : '';
    if ((fishMesh && fishMesh.userData.key) !== fk) {
      if (fishMesh) { lift(fishMesh); fishMesh = null; }
      dumpKind('nug');
      if (order.fish) {
        const f = byId(order.fish);
        if (f.kind === 'fish') {
          fishMesh = new THREE.Mesh(f.flat ? geos.plaice : geos.fish, batterMat); fishMesh.scale.setScalar(f.scale);
          fishMesh.userData.key = fk; box.add(fishMesh); fishBase.set(-0.5, 0.2, 0.02); drop(fishMesh, fishBase.x, fishBase.y, fishBase.z, 0.08);
          fishMesh.userData.base = fishBase.clone();
        } else if (f.kind === 'scampi') { fishMesh = new THREE.Group(); fishMesh.userData.key = fk; box.add(fishMesh); pour('nug', 12); }
        else { fishMesh = makeItem('cake'); fishMesh.userData.key = fk; box.add(fishMesh); fishBase.set(-0.6, 0.12, 0); drop(fishMesh, -0.6, 0.12, 0, 0); fishMesh.userData.base = fishBase.clone(); }
      }
      // re-pour chips into the new region
      if (chipsNow && chipsNow !== 'none') { dumpKind('chip'); pour('chip', byId(chipsNow).count); }
    }
    if (chipsNow !== order.chips) {
      dumpKind('chip'); chipsNow = order.chips; const c = byId(chipsNow);
      if (c.count) pour('chip', Math.min(MAXC, c.count));
      gsap.to(cheese.scale, { x: c.cheese ? 1 : 0.001, y: c.cheese ? 1 : 0.001, z: c.cheese ? 1 : 0.001, duration: 0.6, delay: c.cheese ? 1.4 : 0 });
    }
    // extras
    const want = new Set();
    let iIn = 0, iOut = 0;
    for (const e of MENU.extras) { const q = order.extras[e.id] || 0; for (let n = 0; n < q; n++) want.add(e.id + '#' + n); }
    for (const [k, obj] of placed) if (!want.has(k)) { lift(obj); placed.delete(k); }
    for (const e of MENU.extras) {
      const q = order.extras[e.id] || 0;
      for (let n = 0; n < q; n++) {
        const k = e.id + '#' + n; const inside = insideKinds.has(e.kind);
        const slot = inside ? inSlots[iIn++ % inSlots.length] : outSlots[iOut++ % outSlots.length];
        if (!placed.has(k)) { const obj = makeItem(e.kind); box.add(obj); placed.set(k, obj); obj.userData.inside = inside; drop(obj, slot[0], inside ? 0.42 : 0, slot[1], inside ? slot[2] : Math.random() * 3); }
        else { const obj = placed.get(k); gsap.to(obj.position, { x: slot[0], z: slot[1], duration: 0.4 }); }
      }
    }
  };

  /* seasoning particles */
  const sprinkles = [];
  sprinkle = (kind) => {
    const n = touch ? 70 : 120, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 2; pos[i * 3 + 1] = 2 + Math.random() * 0.8; pos[i * 3 + 2] = (Math.random() - .5) * 1.2; vel.push(-(1 + Math.random() * 1.5)); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size: kind === 'Salt' ? 0.035 : 0.06, color: kind === 'Salt' ? 0xffffff : 0xd8b46a, map: softTex, transparent: true, depthWrite: false, opacity: 0.95 });
    const pts = new THREE.Points(g, m); box.add(pts); sprinkles.push({ pts, vel, life: 1.6 });
  };

  /* steam, fryer bubbles, embers */
  const steam = [];
  const steamMat = new THREE.SpriteMaterial({ map: softTex, color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false });
  for (let i = 0; i < (touch ? 8 : 14); i++) { const s = new THREE.Sprite(steamMat.clone()); s.userData.t = Math.random(); s.userData.x = (Math.random() - .5) * 1.8; s.userData.z = (Math.random() - .5) * 1; box.add(s); steam.push(s); }
  const bubN = touch ? 90 : 160; const bubG = new THREE.BufferGeometry(); const bubP = new Float32Array(bubN * 3); const bubSeed = [];
  for (let i = 0; i < bubN; i++) bubSeed.push([Math.random() * 6.28, 0.35 + Math.random() * 0.75, Math.random()]);
  bubG.setAttribute('position', new THREE.BufferAttribute(bubP, 3));
  const bubM = new THREE.PointsMaterial({ size: 0.07, map: softTex, color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const bubbles = new THREE.Points(bubG, bubM); box.add(bubbles);
  const emN = touch ? 120 : 260; const emG = new THREE.BufferGeometry(); const emP = new Float32Array(emN * 3);
  for (let i = 0; i < emN; i++) { emP[i * 3] = (Math.random() - .5) * 16; emP[i * 3 + 1] = Math.random() * 8 - 1; emP[i * 3 + 2] = -2 - Math.random() * 8; }
  emG.setAttribute('position', new THREE.BufferAttribute(emP, 3));
  const embers = new THREE.Points(emG, new THREE.PointsMaterial({ size: 0.06, map: softTex, color: 0xffc83a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(embers);

  /* interaction: drag to spin, tap to shake */
  let userYaw = 0, yawVel = 0, down = null;
  const dz = $('#dragZone');
  dz.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, moved: false, horiz: null }; });
  addEventListener('pointermove', e => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (down.horiz === null && Math.hypot(dx, dy) > 6) down.horiz = Math.abs(dx) > Math.abs(dy);
    if (down.horiz) { userYaw += dx * 0.008; yawVel = dx * 0.008; down.x = e.clientX; down.y = e.clientY; down.moved = true; }
    else if (down.horiz === false) down.moved = true;
  });
  addEventListener('pointerup', () => { if (down && !down.moved) shake(); down = null; });
  spinOnce = () => gsap.to({ v: 0 }, { v: 1, duration: 1.2, ease: 'power3.inOut', onUpdate() { userYaw = this._base + this.targets()[0].v * Math.PI * 2; }, onStart() { this._base = userYaw; } });
  let mx = 0, my = 0; if (!touch) addEventListener('mousemove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  /* scroll choreography */
  const mob = narrow();
  const K = { hero: { camD: mob ? 9.4 : 7.2, camY: mob ? 3.6 : 2.6, lookY: mob ? -1.2 : 0.2, offX: mob ? 0 : -0.2, offY: 0 }, fry: { camD: mob ? 9.5 : 5.8, camY: 1.9, lookY: mob ? 1.0 : 0.9, offX: mob ? 0 : 0.12, offY: 0 }, wrapK: { camD: mob ? 9.6 : 6.4, camY: 3.6, lookY: 0.2, offX: mob ? 0 : -0.15, offY: mob ? 0.1 : 0 }, build: { camD: mob ? 9.2 : 6.4, camY: mob ? 5.2 : 3.9, lookY: mob ? 0.2 : 0.2, offX: mob ? 0 : 0.15, offY: mob ? 0.26 : 0 } };
  Object.assign(S, K.hero);
  const tl = gsap.timeline({ scrollTrigger: { trigger: '#top', start: 'top top', endTrigger: '#build', end: 'top top', scrub: reduce ? true : 0.9 } });
  tl.to(S, { ...K.fry, fishLift: 1, fry: 1, sway: 0.3, duration: 1, ease: 'power1.inOut' })
    .to(S, { duration: 0.35 })
    .to(S, { ...K.wrapK, fishLift: 0, fry: 0, wrap: 1, sway: 0.5, duration: 1, ease: 'power1.inOut' })
    .to(S, { duration: 0.3 })
    .to(S, { ...K.build, wrap: 0, build: 1, sway: 0, duration: 1, ease: 'power1.inOut' });
  gsap.to(S, { dim: 1, ease: 'none', scrollTrigger: { trigger: '#menu', start: 'top bottom', end: 'top 20%', scrub: true } });
  $$('.story .line').forEach(l => gsap.from(l, { xPercent: l.closest('#s-wrap') ? 40 : -40, opacity: 0, scrollTrigger: { trigger: l, start: 'top 90%', end: 'top 45%', scrub: true } }));

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  let last = performance.now(), visible = true, t = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = performance.now(); });
  sync();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (S.dim > 0.995) { canvas.style.opacity = 0; return; }
    canvas.style.opacity = String(1 - S.dim * 0.85);
    t += dt;
    const top = stepPhysics(dt, now);
    const pile = Math.min(top, 0.42); cheese.position.set(region('chip')[0] / 2 + region('chip')[1] / 2, pile + 0.03, 0);
    // fish lift into the fryer
    if (fishMesh && fishMesh.userData.base && !gsap.isTweening(fishMesh.position)) {
      const b = fishMesh.userData.base; fishMesh.position.set(b.x + S.fishLift * 0.5, b.y + S.fishLift * 1.25 + Math.sin(t * 3) * 0.03 * S.fry, b.z + S.fishLift * 0.4);
      fishMesh.rotation.set(-S.fishLift * 0.5, 0.08 + S.fishLift * (t * 0.8 % 6.283) * 0, S.fishLift * 0.25 + Math.sin(t * 1.7) * 0.06 * S.fry);
    }
    batterMat.emissiveIntensity = S.fry * (0.12 + Math.sin(t * 9) * 0.03);
    fryLight.intensity = S.fry * 9;
    for (const s of placed.values()) if (s.userData.inside && !gsap.isTweening(s.position)) s.position.y = lerp(s.position.y, Math.max(0.12, Math.min(top, 0.42) + 0.1), 0.1);
    // flaps
    const w = Math.max(S.wrap, O.wrap);
    flaps[0].rotation.z = lerp(OPEN, 0.02, sstep(0, 0.6, w));
    flaps[1].rotation.z = lerp(OPEN, 0.0, sstep(0.35, 1, w));
    // bubbles
    bubM.opacity = S.fry * 0.9;
    if (S.fry > 0.01 && fishMesh) for (let i = 0; i < bubN; i++) { const [a, r, o] = bubSeed[i]; const ph = (o + t * 0.6) % 1; bubP[i * 3] = fishMesh.position.x + Math.cos(a + t * 0.5) * r * 1.4; bubP[i * 3 + 1] = fishMesh.position.y - 0.4 + ph * 1.2; bubP[i * 3 + 2] = fishMesh.position.z + Math.sin(a + t * 0.5) * r * 0.7; }
    bubG.attributes.position.needsUpdate = true;
    // steam
    for (const s of steam) { s.userData.t = (s.userData.t + dt * 0.18) % 1; const k = s.userData.t; s.position.set(s.userData.x + Math.sin(k * 6 + s.userData.z * 9) * 0.15, 0.6 + k * 2.2, s.userData.z); s.scale.setScalar(0.4 + k * 1.3); s.material.opacity = Math.sin(k * Math.PI) * 0.13 * (1 - w); }
    // embers
    for (let i = 0; i < emN; i++) { emP[i * 3 + 1] += dt * (0.15 + (i % 7) * 0.03); if (emP[i * 3 + 1] > 7) emP[i * 3 + 1] = -1; }
    emG.attributes.position.needsUpdate = true;
    // sprinkles
    for (let i = sprinkles.length - 1; i >= 0; i--) { const sp = sprinkles[i]; sp.life -= dt; const a = sp.pts.geometry.attributes.position; for (let j = 0; j < sp.vel.length; j++) { const y = a.getY(j) + sp.vel[j] * dt; a.setY(j, Math.max(top + 0.05, y)); } a.needsUpdate = true; sp.pts.material.opacity = Math.min(1, sp.life); if (sp.life <= 0) { box.remove(sp.pts); sp.pts.geometry.dispose(); sprinkles.splice(i, 1); } }
    // rig + camera
    if (!down) { userYaw += yawVel; yawVel *= 0.92; }
    const sway = reduce ? 0 : S.sway;
    rig.rotation.y = userYaw + Math.sin(t * 0.35) * 0.45 * sway - 0.25 * sway;
    rig.position.y = Math.sin(t * 1.1) * 0.06 * sway;
    cam.position.set(mx * 0.8, S.camY - my * 0.4, S.camD);
    cam.lookAt(0, S.lookY, 0);
    cam.setViewOffset(innerWidth, innerHeight, S.offX * innerWidth, S.offY * innerHeight, innerWidth, innerHeight);
    renderer.render(scene, cam);
    if (!frame.done) { frame.done = true; finishLoad(); }
  }
  loaderBar.style.width = '70%';
  requestAnimationFrame(frame);
}

function finishLoad() {
  loaderBar.style.width = '100%';
  setTimeout(() => $('#loader').classList.add('done'), 350);
  if (!reduce) gsap.from('.hero .mega span', { yPercent: 110, opacity: 0, stagger: 0.12, duration: 1, ease: 'power4.out', delay: 0.3 });
}
setTimeout(() => { if (!$('#loader').classList.contains('done')) finishLoad(); }, 4000);

/* ---------------- order flow ---------------- */
const modal = $('#orderModal');
let method = 'Collection';
function parseH(s) { const m = s.match(/(\d+)(?::(\d+))?\s*(am|pm)/i); let h = +m[1] % 12 + (/pm/i.test(m[3]) ? 12 : 0); return h * 60 + (+m[2] || 0); }
function slots() {
  const out = [], now = new Date();
  for (let add = 0; add < 7 && out.length < 1; add++) {
    const d = new Date(now); d.setDate(now.getDate() + add); const idx = (d.getDay() + 6) % 7; const [day, hrs] = BIZ.hours[idx];
    const [o, c] = hrs.split('–').map(parseH); const last = c - 15; // online orders close 9:45pm
    const nowM = add ? 0 : now.getHours() * 60 + now.getMinutes();
    const open = o <= nowM && nowM < last;
    const start = Math.max(o + 15, Math.ceil((nowM + 30) / 15) * 15);
    const opts = [];
    if (!add && open) opts.push(['ASAP', `As soon as possible (about ${method === 'Collection' ? BIZ.delivery.collectMins : BIZ.delivery.deliverMins} min)`]);
    for (let m = start; m <= last; m += 15) { const hh = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); const lbl = `${add ? (add === 1 ? 'Tomorrow' : day) + ' ' : ''}${hh > 12 ? hh - 12 : hh}:${mm}${hh >= 12 ? 'pm' : 'am'}`; opts.push([lbl, lbl]); }
    if (opts.length) out.push(...opts);
  }
  return out;
}
function fillSlots() { $('#fTime').innerHTML = slots().map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); }
$$('#method button').forEach(b => b.onclick = () => { method = b.dataset.m; $$('#method button').forEach(x => x.classList.toggle('on', x === b)); $('.del-only').hidden = method !== 'Delivery'; fillSlots(); $('#warn').textContent = ''; });
$('#wrapBtn').onclick = () => {
  if (total() <= 0) { gsap.fromTo('#builder', { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.3)' }); return; }
  $('#miniSum').innerHTML = priceLines().map(l => `${l.n}${l.p ? ' · ' + gbp(l.p) : ''}`).join('<br>');
  $('#orderForm').hidden = false; $('#orderDone').hidden = true; fillSlots();
  gsap.to(O, { wrap: 1, duration: reduce ? 0 : 1.1, ease: 'power2.inOut' }); spinOnce();
  setTimeout(() => { modal.hidden = false; gsap.from('.sheet', { y: 60, opacity: 0, duration: 0.45, ease: 'power3.out' }); $('#fName').focus({ preventScroll: true }); }, reduce ? 0 : 1150);
};
modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) { modal.hidden = true; gsap.to(O, { wrap: 0, duration: 0.8 }); } });
$('#sendBtn').onclick = async () => {
  const name = $('#fName').value.trim(), phone = $('#fPhone').value.trim(), post = $('#fPost').value.trim();
  const warn = m => { $('#warn').textContent = m; };
  if (!name) return warn('Please add your name.');
  if (phone.replace(/\D/g, '').length < 10) return warn('Please add a mobile number so the shop can confirm.');
  if (method === 'Delivery' && total() < BIZ.delivery.minOrder) return warn(`Delivery minimum is £${BIZ.delivery.minOrder}. Add a bit more, or switch to collection.`);
  if (method === 'Delivery' && !/^[A-Z]{1,2}\d/i.test(post)) return warn('Please add your delivery postcode.');
  $('#sendBtn').disabled = true;
  try {
    await sendLead({ name, phone, method, postcode: post, when: $('#fTime').value, notes: $('#fNotes').value.trim(), items: priceLines().map(l => l.n + (l.p ? ' ' + gbp(l.p) : '')), total: +total().toFixed(2), source: 'website builder' });
    const first = name.split(' ')[0];
    $('#doneTitle').textContent = `It's wrapped, ${first}!`;
    $('#doneText').textContent = `Your ${method.toLowerCase()} order request (${gbp(total())}, ${$('#fTime').value}) has gone to The Yellow Fisherman. They'll ring ${phone} to confirm.`;
    $('#demoNote').textContent = isDemo() ? 'Concept preview: this request is saved to the demo owner dashboard only. It has not been sent to the shop.' : '';
    $('#orderForm').hidden = true; $('#orderDone').hidden = false;
    gsap.from('.tick', { scale: 0, rotate: -90, duration: 0.6, ease: 'back.out(2)' });
  } catch (e) { warn('Could not send just now. Please call the shop.'); }
  $('#sendBtn').disabled = false;
};
window.__yf = { order, total, priceLines };
