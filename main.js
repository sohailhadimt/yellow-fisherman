import * as THREE from 'three';
import { BIZ, PANELS, SEASONING, REVIEWS, MENU_LIST } from './config.js';
import { sendLead, isDemo } from './leads.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const gbp = n => '£' + n.toFixed(2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const narrow = () => innerWidth < 900;
const loaderBar = $('#loader .bar i');
loaderBar.style.width = '25%';

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
$('#menuGrid').innerHTML = MENU_LIST.map(([g, items]) => `<div class="mg"><h4>${g}</h4>` + items.map(([n, p]) => `<div class="mi"><span>${n}</span><i></i><b>${gbp(p)}</b></div>`).join('') + '</div>').join('');
$('#cards').innerHTML = REVIEWS.map(r => `<div class="card"><div class="q">“</div><p>${r.q}</p><cite>${r.who} · ${r.src}</cite></div>`).join('');

/* ---------------- sound + haptics (synthesised, no files) ---------------- */
let actx = null, muted = localStorage.getItem('yf_mute') === '1';
const sndBtn = $('#sndBtn');
const paintSnd = () => { sndBtn.textContent = muted ? '🔇' : '🔈'; sndBtn.setAttribute('aria-pressed', String(!muted)); };
paintSnd();
sndBtn.onclick = () => { muted = !muted; localStorage.setItem('yf_mute', muted ? '1' : '0'); paintSnd(); if (!muted) blip('pop'); };
function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (actx.state === 'suspended') actx.resume(); return actx; }
function blip(kind) {
  if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime;
  const g = c.createGain(); g.connect(c.destination);
  if (kind === 'pop') {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1250, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); o.start(t); o.stop(t + 0.16);
  } else if (kind === 'land') {
    const n = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(); s.buffer = n; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    g.gain.value = 0.22; s.connect(f); f.connect(g); s.start(t);
    const o = c.createOscillator(), g2 = c.createGain(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g2); g2.connect(c.destination); o.start(t); o.stop(t + 0.18);
  } else if (kind === 'wrap') {
    const n = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.4 + 0.6 * Math.random() * Math.sin(i / d.length * Math.PI));
    const s = c.createBufferSource(); s.buffer = n; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); s.connect(f); f.connect(g); s.start(t);
  }
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ---------------- hero ---------------- */
const vid = $('#heroVid');
vid.src = narrow() ? 'media/hero-fryer-sm.mp4' : 'media/hero-fryer.mp4';
vid.play().catch(() => {});

/* ---------------- loader ---------------- */
let loaded = false;
function finishLoad() {
  if (loaded) return; loaded = true;
  loaderBar.style.width = '100%';
  setTimeout(() => $('#loader').classList.add('done'), 300);
  if (!reduce) {
    gsap.from('.hero .mega span', { yPercent: 115, opacity: 0, stagger: 0.12, duration: 1.1, ease: 'power4.out', delay: 0.35 });
    gsap.from('.hero .kicker, .hero .sub, .hero-cta, .rating-chip', { y: 24, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out', delay: 0.7 });
  }
  setTimeout(loadWalk, 400);
}
{
  const poster = new Image(); poster.src = 'media/hero-poster.webp';
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.all([new Promise(r => { poster.onload = poster.onerror = r; }), fonts]).then(() => { loaderBar.style.width = '70%'; setTimeout(finishLoad, 250); });
  setTimeout(finishLoad, 3500);
}

/* ---------------- walk-in: scroll-scrubbed photoreal frames ---------------- */
const N = 97, frames = new Array(N);
const saveData = navigator.connection && navigator.connection.saveData;
const prefix = saveData ? 's' : '';
const wc = $('#walkCanvas'), wctx = wc.getContext('2d');
let wProg = 0, look = 0, lookT = 0, walkStarted = false;
function loadWalk() {
  if (walkStarted) return; walkStarted = true;
  const order = [0, N - 1]; for (let step = 16; step >= 1; step = step >> 1) for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
  let k = 0; const par = 6;
  const next = () => { if (k >= order.length) return; const i = order[k++]; const im = new Image(); im.decoding = 'async'; im.onload = () => { frames[i] = im; if (i === 0 || Math.abs(i - Math.round(wProg * (N - 1))) < 3) drawWalk(); next(); }; im.onerror = next; im.src = `media/walk/${prefix}${String(i).padStart(3, '0')}.webp`; };
  for (let j = 0; j < par; j++) next();
}
function nearest(i) { for (let d = 0; d < N; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; } return null; }
function sizeCanvas(c) { const dpr = Math.min(devicePixelRatio || 1, 2); const r = c.getBoundingClientRect(); const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } }
function drawWalk() {
  const im = nearest(Math.round(wProg * (N - 1))); if (!im) return;
  sizeCanvas(wc); const W = wc.width, H = wc.height;
  const s = Math.max(W / im.width, H / im.height) * 1.08; const dw = im.width * s, dh = im.height * s;
  const x = (W - dw) / 2 - look * (dw - W) / 2 * 0.9, y = (H - dh) / 2;
  wctx.drawImage(im, x, y, dw, dh);
}
ScrollTrigger.create({ trigger: '#walk', start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: st => {
  wProg = st.progress; drawWalk(); loadWalk();
  $$('.wline').forEach(el => { const a = +el.dataset.at; el.classList.toggle('on', wProg >= a && wProg < a + 0.24); });
  $('#hotspot').classList.toggle('gone', wProg > 0.04);
}});
addEventListener('resize', () => { drawWalk(); });
// drag (or mouse) to look around
{
  const st = $('#walkStage'); let sx = null, base = 0;
  st.addEventListener('pointerdown', e => { sx = e.clientX; base = lookT; });
  addEventListener('pointerup', () => { sx = null; });
  st.addEventListener('pointermove', e => {
    if (sx !== null) lookT = clamp(base - (e.clientX - sx) / (innerWidth * 0.5), -1, 1);
    else if (e.pointerType === 'mouse') lookT = clamp((e.clientX / innerWidth - 0.5) * -0.8, -1, 1);
  });
  const tick = () => { const d = lookT - look; if (Math.abs(d) > 0.001) { look += d * 0.12; drawWalk(); } if (sx === null && !matchMedia('(pointer:fine)').matches) lookT *= 0.985; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
// tap-to-walk: glide the whole way in
function autoWalk() {
  const target = $('#counter').getBoundingClientRect().top + scrollY - (narrow() ? 0 : 0);
  const from = scrollY, dist = target - from; if (dist <= 0) return;
  const p = { y: from };
  gsap.to(p, { y: target, duration: reduce ? 0.01 : clamp(dist / innerHeight * 1.3, 1.2, 6.5), ease: 'power1.inOut', onUpdate: () => scrollTo(0, p.y) });
  ac();
}
$('#hotspot').onclick = autoWalk;
$('#walkBtn').onclick = e => { e.preventDefault(); loadWalk(); autoWalk(); };

/* ---------------- counter: floating glass menu panels ---------------- */
const ITEMS = {}; PANELS.forEach(p => p.items.forEach(it => { ITEMS[it.id] = { ...it, panel: p.id }; }));
const ring = $('#ring');
ring.innerHTML = PANELS.map((p, i) => `
  <div class="panel" data-i="${i}"><div class="bob" style="animation-delay:${-i * 0.7}s"><div class="glass panel-in">
    <div class="ph"><span class="pn">0${i + 1}</span><h3>${p.title}</h3></div>
    <div class="items">${p.items.map(it => `
      <button class="it" data-id="${it.id}">
        <span class="th"><img src="media/dish/${it.img}.webp" alt="" loading="lazy"></span>
        <span class="nm">${it.name}${it.withChips ? `<small>with chips ${gbp(it.withChips)}</small>` : it.note ? `<small>${it.note}</small>` : ''}</span>
        <span class="pr">${gbp(it.price)}</span><span class="plus">+</span>
      </button>`).join('')}</div>
  </div></div></div>`).join('');
$('#dots').innerHTML = PANELS.map((p, i) => `<button aria-label="${p.title}" data-i="${i}"></button>`).join('');
const panels = $$('.panel'); let cur = 0; const P = PANELS.length;
function layoutRing() {
  const W = panels[0].offsetWidth || 340;
  panels.forEach((el, i) => {
    let rel = i - cur; rel = ((rel + P / 2) % P + P) % P - P / 2;
    const a = Math.abs(rel);
    el.style.transform = `translate3d(${rel * W * (narrow() ? 1.0 : 1.02)}px,0,${-a * W * 0.75}px) rotateY(${-rel * 38}deg)`;
    el.style.opacity = String(clamp(1.1 - a * (narrow() ? 0.62 : 0.5), 0, 1));
    el.style.zIndex = String(100 - Math.round(a * 10));
    el.classList.toggle('front', a < 0.5);
  });
  const fi = ((Math.round(cur) % P) + P) % P;
  $$('#dots button').forEach((d, i) => d.classList.toggle('on', i === fi));
}
const rs = { v: 0 };
function goTo(target) { gsap.to(rs, { v: target, duration: reduce ? 0 : 0.6, ease: 'power3.out', onUpdate: () => { cur = rs.v; layoutRing(); } }); }
$('#prevP').onclick = () => { goTo(Math.round(cur) - 1); blip('pop'); };
$('#nextP').onclick = () => { goTo(Math.round(cur) + 1); blip('pop'); };
$$('#dots button').forEach(d => d.onclick = () => { const i = +d.dataset.i; const base = Math.round(cur); let diff = ((i - base) % P + P) % P; if (diff > P / 2) diff -= P; goTo(base + diff); });
addEventListener('resize', layoutRing);
layoutRing();
// swipe / drag to turn the panels
{
  const m = $('#menu3d'); let sx = null, sy = 0, start = 0, dragging = false, lastX = 0, vel = 0, lastT = 0;
  m.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; start = cur; dragging = false; lastX = e.clientX; lastT = performance.now(); vel = 0; gsap.killTweensOf(rs); });
  m.addEventListener('pointermove', e => {
    if (sx === null) return; const dx = e.clientX - sx;
    if (!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - sy)) { dragging = true; m.setPointerCapture(e.pointerId); }
    if (dragging) { const W = panels[0].offsetWidth; cur = start - dx / (W * 0.9); rs.v = cur; layoutRing(); const t = performance.now(); vel = (e.clientX - lastX) / Math.max(1, t - lastT); lastX = e.clientX; lastT = t; }
  });
  const end = () => { if (sx === null) return; sx = null; if (dragging) { const tgt = Math.round(cur - vel * 0.6); goTo(Math.abs(tgt - start) > 1 ? start + Math.sign(tgt - start) : tgt); blip('pop'); m.dataset.justDragged = '1'; setTimeout(() => delete m.dataset.justDragged, 60); } };
  m.addEventListener('pointerup', end); m.addEventListener('pointercancel', end);
}
// parallax depth: background drifts against the floating glass
{
  const bg = $('#counterBg'), m3 = $('#menu3d'); let tx = 0, ty = 0, x = 0, y = 0;
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; });
  addEventListener('deviceorientation', e => { if (e.gamma == null) return; tx = clamp(e.gamma / 40, -0.5, 0.5); ty = clamp((e.beta - 45) / 60, -0.5, 0.5); });
  const t = () => { x += (tx - x) * 0.06; y += (ty - y) * 0.06; bg.style.transform = `scale(1.1) translate3d(${-x * 2.2}%, ${-y * 1.6}%, 0)`; m3.style.transform = `translate3d(${x * 14}px, ${y * 8}px, 0) rotateX(${-y * 4}deg) rotateY(${x * 6}deg)`; requestAnimationFrame(t); };
  if (!reduce) requestAnimationFrame(t);
}

/* ---------------- cart + real pricing ---------------- */
const cart = {}; // id -> qty
const trayEls = []; // {id, el}
const season = new Set(['Salt', 'Vinegar']);
function priceLines() {
  let chipsLeft = cart.mchips || 0; const out = [];
  for (const p of PANELS) for (const it of p.items) {
    const q = cart[it.id] || 0; if (!q) continue;
    if (it.id === 'mchips') continue;
    if (it.withChips) { const pair = Math.min(q, chipsLeft); chipsLeft -= pair; if (pair) out.push({ id: it.id, meal: true, q: pair, n: `${it.name} & chips`, p: pair * it.withChips }); if (q - pair) out.push({ id: it.id, q: q - pair, n: it.name, p: (q - pair) * it.price }); }
    else out.push({ id: it.id, q, n: it.name, p: q * it.price });
  }
  if (chipsLeft) out.push({ id: 'mchips', q: chipsLeft, n: 'Medium chips', p: chipsLeft * ITEMS.mchips.price });
  // keep chips line near the top for readability
  return out;
}
const total = () => priceLines().reduce((s, l) => s + l.p, 0);
const count = () => Object.values(cart).reduce((s, q) => s + q, 0);
function renderOrder() {
  const lines = priceLines();
  $('#cnt').textContent = count();
  $('#total').textContent = gbp(total());
  $('#lines').innerHTML = lines.length ? lines.map(l => `<div class="ln"><span class="q">${l.q}×</span><span class="n">${l.n}${l.meal ? '<small>meal price</small>' : ''}</span><b>${gbp(l.p)}</b><span class="qb"><button data-dec="${l.id}" data-meal="${l.meal ? 1 : ''}" aria-label="Remove one">−</button><button data-inc="${l.id}" data-meal="${l.meal ? 1 : ''}" aria-label="Add one">+</button></span></div>`).join('') : '<p class="muted">Your tray is empty. Tap a dish on the menu.</p>';
  $('#order').classList.toggle('has', count() > 0);
  $('#trayHint').classList.toggle('gone', count() > 0);
  document.body.classList.toggle('carting', count() > 0);
}
$('#season').innerHTML = '<span>Seasoning</span>' + SEASONING.map(s => `<button class="chip ${season.has(s) ? 'on' : ''}" data-s="${s}">${s}</button>`).join('');
$('#season').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const s = b.dataset.s; season.has(s) ? season.delete(s) : season.add(s); b.classList.toggle('on'); blip('pop'); };
$('#lines').onclick = e => {
  const d = e.target.closest('[data-dec]'), i = e.target.closest('[data-inc]');
  if (d) { removeOne(d.dataset.dec); if (d.dataset.meal) removeOne('mchips'); blip('pop'); buzz(8); }
  if (i) { addItem(i.dataset.inc, null); if (i.dataset.meal) addItem('mchips', null); }
};
$('#orderToggle').onclick = () => { $('#order').classList.toggle('open'); };

const trayItems = $('#trayItems'), trayWrap = $('#trayWrap');
function landingSpot(it) {
  // inside the tray opening, lower items further forward
  const n = trayEls.length;
  const x = 0.24 + ((n * 0.37 + Math.random() * 0.2) % 1) * 0.56;
  const y = 0.30 + Math.random() * 0.22;
  return { x, y, rot: (Math.random() - 0.5) * 34 };
}
function placeInTray(id, spot) {
  const it = ITEMS[id]; const el = document.createElement('img');
  el.src = `media/dish/${it.img}.webp`; el.alt = it.name; el.className = 'ti';
  el.style.left = (spot.x * 100) + '%'; el.style.top = (spot.y * 100) + '%';
  el.style.width = (it.size * 100) + '%';
  el.style.setProperty('--r', spot.rot + 'deg'); el.style.zIndex = String(Math.round(spot.y * 100));
  trayItems.appendChild(el); trayEls.push({ id, el });
  return el;
}
function addItem(id, fromEl) {
  cart[id] = (cart[id] || 0) + 1;
  const it = ITEMS[id]; const spot = landingSpot(it);
  const tr = trayWrap.getBoundingClientRect();
  const finalW = tr.width * it.size;
  const done = () => {
    const el = placeInTray(id, spot);
    if (!reduce) { gsap.fromTo(el, { scale: 1.12 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' }); gsap.fromTo(trayWrap, { scaleY: 0.94, scaleX: 1.03 }, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1,0.4)' }); }
    renderOrder(); blip('land'); buzz(14); fx.puff(tr.left + tr.width * spot.x, tr.top + tr.height * spot.y);
    if (!reduce) gsap.fromTo('#total', { scale: 1.35, color: '#ffd21f' }, { scale: 1, color: '#fff', duration: 0.5, ease: 'back.out(2)' });
  };
  if (!fromEl || reduce) { done(); return; }
  blip('pop'); buzz(8);
  const r = fromEl.getBoundingClientRect();
  const fly = document.createElement('img'); fly.src = `media/dish/${it.img}.webp`; fly.className = 'fly'; document.body.appendChild(fly);
  const startW = r.width, popW = Math.min(innerWidth * 0.5, 300) * (0.6 + it.size);
  const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
  const ex = tr.left + tr.width * spot.x, ey = tr.top + tr.height * spot.y;
  const px = clamp(sx + (narrow() ? 0 : 40), popW / 2, innerWidth - popW / 2), py = Math.max(sy - 90, popW / 2 + 40);
  const s = { t: 0 };
  gsap.set(fly, { width: startW, x: sx - startW / 2, y: sy - startW / 2, rotate: 0, opacity: 0.6 });
  const tl = gsap.timeline({ onComplete: () => { fly.remove(); done(); } });
  tl.to(fly, { width: popW, x: px - popW / 2, y: py - popW / 2, rotate: -8, opacity: 1, duration: 0.32, ease: 'back.out(1.8)' })
    .to(fly, { filter: 'drop-shadow(0 30px 40px rgba(0,0,0,.6)) brightness(1.08)', duration: 0.2 }, 0)
    .to(s, { t: 1, duration: 0.62, ease: 'power2.in', onUpdate: () => {
      const t = s.t, cx = (px + ex) / 2, cy = Math.min(py, ey) - 140;
      const bx = (1 - t) * (1 - t) * px + 2 * (1 - t) * t * cx + t * t * ex, by = (1 - t) * (1 - t) * py + 2 * (1 - t) * t * cy + t * t * ey;
      const w = popW + (finalW - popW) * t;
      gsap.set(fly, { width: w, x: bx - w / 2, y: by - w * 0.4, rotate: -8 + (spot.rot + 8) * t });
    } }, 0.38);
}
function removeOne(id) {
  if (!cart[id]) return; cart[id]--; if (!cart[id]) delete cart[id];
  for (let i = trayEls.length - 1; i >= 0; i--) if (trayEls[i].id === id) { const { el } = trayEls[i]; trayEls.splice(i, 1); gsap.to(el, { y: -40, opacity: 0, scale: 0.6, duration: 0.3, onComplete: () => el.remove() }); break; }
  renderOrder();
}
ring.addEventListener('click', e => {
  if ($('#menu3d').dataset.justDragged) return;
  const pnl = e.target.closest('.panel'); if (!pnl) return;
  const b = e.target.closest('.it');
  if (!pnl.classList.contains('front')) { const i = +pnl.dataset.i; const base = Math.round(cur); let diff = ((i - base) % P + P) % P; if (diff > P / 2) diff -= P; goTo(base + diff); return; }
  if (!b) return;
  b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  addItem(b.dataset.id, b.querySelector('.th img'));
});
renderOrder();

// order bar only when it's useful
const onScroll = () => { document.body.classList.toggle('scrolled', scrollY > innerHeight * 0.8); document.body.classList.toggle('at-foot', $('.foot').getBoundingClientRect().top < innerHeight * 0.85); };
addEventListener('scroll', onScroll, { passive: true }); onScroll();
ScrollTrigger.create({ trigger: '#counter', start: 'top 60%', end: 'bottom 40%', onToggle: st => document.body.classList.toggle('at-counter', st.isActive) });

/* ---------------- atmosphere: steam, embers, lamp bloom (Three.js) ---------------- */
const fx = (() => {
  const canvas = $('#fx'); const api = { puff() {} };
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch (e) { canvas.remove(); return api; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene(); let W = 1, H = 1; const cam = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const smokes = []; const steamMat = () => new THREE.SpriteMaterial({ map: tex, color: 0xfff1dc, transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 46; i++) { const s = new THREE.Sprite(steamMat()); s.userData = { life: Math.random(), speed: 0.12 + Math.random() * 0.1, src: i % 3, drift: Math.random() * 6.28 }; scene.add(s); smokes.push(s); }
  const puffs = [];
  // embers / dust in warm light
  const NE = 70, eg = new THREE.BufferGeometry(), ep = new Float32Array(NE * 3), ev = [];
  for (let i = 0; i < NE; i++) { ep[i * 3] = Math.random(); ep[i * 3 + 1] = Math.random(); ep[i * 3 + 2] = 0; ev.push([(Math.random() - 0.5) * 0.01, 0.006 + Math.random() * 0.014, Math.random() * 6.28]); }
  eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: tex, color: 0xffc35a, size: 7, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
  scene.add(embers);
  // lamp bloom
  const lamps = [[0.302, 0.035, 1], [0.405, 0.115, 0.8]].map(([x, y, k]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb347, transparent: true, opacity: 0.55 * k, blending: THREE.AdditiveBlending, depthWrite: false })); s.userData = { x, y, k }; scene.add(s); return s; });
  // background "cover" mapping so effects sit on the right parts of the photo
  const IMG = { w: 1152, h: 864 };
  function map(u, v) { const s = Math.max(W / IMG.w, H / IMG.h) * 1.1; const dw = IMG.w * s, dh = IMG.h * s; return [(W - dw) / 2 + u * dw, (H - dh) / 2 + v * dh, s]; }
  const sources = [[0.17, 0.36, 0.2], [0.42, 0.36, 0.16], [0.62, 0.34, 0.1]];
  function resize() { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; renderer.setSize(W, H, false); cam.right = W; cam.top = H; cam.updateProjectionMatrix(); }
  let visible = false, last = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(loop); } }).observe(canvas);
  addEventListener('resize', resize); resize();
  api.puff = (cx, cy) => {
    const r = canvas.getBoundingClientRect(); const x = cx - r.left, y = cy - r.top;
    for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(steamMat()); s.userData = { x: x + (Math.random() - 0.5) * 40, y: y - 10, life: 0, sp: 0.6 + Math.random() * 0.5 }; scene.add(s); puffs.push(s); }
  };
  function loop(now) {
    if (!visible) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    for (const s of smokes) {
      const d = s.userData; d.life += dt * d.speed; if (d.life > 1) { d.life = 0; d.drift = Math.random() * 6.28; }
      const [u, v, wv] = sources[d.src]; const [bx, by, sc] = map(u + Math.sin(d.drift) * wv * 0.5, v);
      const rise = d.life * 300 * sc;
      s.position.set(bx + Math.sin(t * 0.6 + d.drift) * 30 * d.life, H - (by - rise), 0);
      const size = (80 + d.life * 260) * sc; s.scale.set(size, size, 1);
      s.material.opacity = Math.sin(d.life * Math.PI) * 0.09;
    }
    for (let i = puffs.length - 1; i >= 0; i--) { const s = puffs[i], d = s.userData; d.life += dt * d.sp; if (d.life > 1) { scene.remove(s); s.material.dispose(); puffs.splice(i, 1); continue; } s.position.set(d.x + Math.sin(t * 2 + i) * 10 * d.life, H - (d.y - d.life * 140), 1); const z = 40 + d.life * 160; s.scale.set(z, z, 1); s.material.opacity = Math.sin(d.life * Math.PI) * 0.22; }
    const pa = eg.attributes.position.array;
    for (let i = 0; i < NE; i++) { const v = ev[i]; pa[i * 3 + 1] += v[1] * dt * 3; pa[i * 3] += Math.sin(t + v[2]) * 0.0006; if (pa[i * 3 + 1] > 1) { pa[i * 3 + 1] = 0; pa[i * 3] = Math.random(); } }
    eg.attributes.position.needsUpdate = true; embers.scale.set(W, H, 1);
    for (const l of lamps) { const [x, y, sc] = map(l.userData.x, l.userData.y); l.position.set(x, H - y, 0); const z = 260 * sc * (1 + Math.sin(t * 3.1 + l.userData.k * 5) * 0.03); l.scale.set(z, z, 1); }
    renderer.render(scene, cam); requestAnimationFrame(loop);
  }
  return api;
})();

/* ---------------- reveal-on-scroll for the info sections ---------------- */
if (!reduce) $$('.solid .sec-title, .card, .mg, details, .shop figure').forEach(el => gsap.from(el, { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));

/* ---------------- order flow (kept: modal, slots, validation, leads) ---------------- */
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
const seasonTxt = () => season.size ? 'Seasoning: ' + [...season].join(', ') : 'No seasoning';
$('#wrapBtn').onclick = () => {
  if (count() <= 0) { gsap.fromTo('#trayWrap', { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' }); $('#trayHint').classList.add('nudge'); setTimeout(() => $('#trayHint').classList.remove('nudge'), 900); return; }
  $('#miniSum').innerHTML = priceLines().map(l => `${l.q}× ${l.n} · ${gbp(l.p)}`).join('<br>') + `<br><span class="muted">${seasonTxt()}</span><br><b>Total ${gbp(total())}</b>`;
  $('#total2').textContent = gbp(total());
  $('#orderForm').hidden = false; $('#orderDone').hidden = true; fillSlots();
  blip('wrap'); buzz([10, 40, 10]);
  if (!reduce) { gsap.to('.ti', { left: '50%', top: '42%', scale: 0.7, duration: 0.45, ease: 'power2.in', stagger: 0.02 }); gsap.fromTo('#trayWrap', { y: 0 }, { y: -14, yoyo: true, repeat: 1, duration: 0.3, delay: 0.45 }); }
  setTimeout(() => { modal.hidden = false; $('#order').classList.remove('open'); if (!reduce) gsap.from('.sheet', { y: 60, opacity: 0, duration: 0.45, ease: 'power3.out' }); $('#fName').focus({ preventScroll: true }); }, reduce ? 0 : 750);
};
function untuck() { trayEls.forEach(({ el }) => { const sp = { x: 0.24 + Math.random() * 0.56, y: 0.30 + Math.random() * 0.22 }; gsap.to(el, { left: sp.x * 100 + '%', top: sp.y * 100 + '%', scale: 1, duration: 0.5, ease: 'back.out(1.6)' }); }); }
modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) { modal.hidden = true; untuck(); } });
$('#sendBtn').onclick = async () => {
  const name = $('#fName').value.trim(), phone = $('#fPhone').value.trim(), post = $('#fPost').value.trim();
  const warn = m => { $('#warn').textContent = m; };
  if (!name) return warn('Please add your name.');
  if (phone.replace(/\D/g, '').length < 10) return warn('Please add a mobile number so the shop can confirm.');
  if (method === 'Delivery' && total() < BIZ.delivery.minOrder) return warn(`Delivery minimum is £${BIZ.delivery.minOrder}. Add a bit more, or switch to collection.`);
  if (method === 'Delivery' && !/^[A-Z]{1,2}\d/i.test(post)) return warn('Please add your delivery postcode.');
  $('#sendBtn').disabled = true;
  try {
    await sendLead({ name, phone, method, postcode: post, when: $('#fTime').value, notes: [$('#fNotes').value.trim(), seasonTxt()].filter(Boolean).join(' · '), items: priceLines().map(l => `${l.q}× ${l.n} ${gbp(l.p)}`), total: +total().toFixed(2), source: 'website walk-in counter' });
    const first = name.split(' ')[0];
    $('#doneTitle').textContent = `It's wrapped, ${first}!`;
    $('#doneText').textContent = `Your ${method.toLowerCase()} order request (${gbp(total())}, ${$('#fTime').value}) has gone to The Yellow Fisherman. They'll ring ${phone} to confirm.`;
    $('#demoNote').textContent = isDemo() ? 'Concept preview: this request is saved to the demo owner dashboard only. It has not been sent to the shop.' : '';
    $('#orderForm').hidden = true; $('#orderDone').hidden = false;
    if (!reduce) gsap.from('.tick', { scale: 0, rotate: -90, duration: 0.6, ease: 'back.out(2)' });
  } catch (e) { warn('Could not send just now. Please call the shop.'); }
  $('#sendBtn').disabled = false;
};
window.__yf = { cart, total, priceLines, addItem, goTo };
