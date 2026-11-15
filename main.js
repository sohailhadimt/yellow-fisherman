import * as THREE from 'three';
import { BIZ, PANELS, SEASONING, REVIEWS, MENU_LIST } from './config.js';
import { sendLead, isDemo } from './leads.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const gbp = n => '£' + n.toFixed(2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const narrow = () => innerWidth < 900;
const MOBILE = narrow() || matchMedia('(pointer:coarse)').matches;
const loaderBar = $('#loader .bar i');
loaderBar.style.width = '25%';
if (MOBILE) document.documentElement.classList.add('lite');

/* ---------------- smooth scroll (Lenis) driven by GSAP's ticker ---------------- */
const lenis = new window.Lenis({ lerp: reduce ? 1 : 0.085, smoothWheel: !reduce, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
const goY = (y, o = {}) => lenis.scrollTo(y, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4), ...o });

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

/* ---------------- sound: street ambience → door chime → fryer sizzle (synthesised) ---------------- */
let actx = null, muted = localStorage.getItem('yf_mute') === '1', amb = null;
const sndBtn = $('#sndBtn');
const paintSnd = () => { sndBtn.textContent = muted ? '🔇' : '🔈'; sndBtn.setAttribute('aria-pressed', String(!muted)); };
paintSnd();
function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (actx.state === 'suspended') actx.resume(); return actx; }
function noiseBuf(c, secs, fn) { const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; d[i] = fn(w, i, d.length, last); last = d[i]; } return b; }
function startAmbience() {
  const c = ac(); if (!c || amb) return;
  const master = c.createGain(); master.gain.value = muted ? 0 : 1; master.connect(c.destination);
  const loop = (buf, filt, f, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = filt; fl.frequency.value = f; if (q) fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return g; };
  const street = loop(noiseBuf(c, 4, (w, i, n, l) => (l + 0.02 * w) / 1.02), 'lowpass', 520);            // distant traffic rumble
  const sizzle = loop(noiseBuf(c, 3, (w) => w * (Math.random() < 0.012 ? 1 : 0.18)), 'bandpass', 4200, 0.7); // fryer crackle
  const room = loop(noiseBuf(c, 4, (w, i, n, l) => (l + 0.05 * w) / 1.05), 'bandpass', 380, 0.6);        // warm room tone
  amb = { master, street, sizzle, room };
}
function setAmb(vp) {
  if (!amb) return; const t = actx.currentTime;
  amb.street.gain.setTargetAtTime(0.5 * (1 - sstep(0.3, 0.45, vp)), t, 0.12);
  amb.sizzle.gain.setTargetAtTime(0.13 * sstep(0.4, 0.55, vp) * (1 - 0.35 * sstep(0.8, 1, vp)), t, 0.2);
  amb.room.gain.setTargetAtTime(0.35 * sstep(0.38, 0.55, vp), t, 0.2);
}
function blip(kind) {
  if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime;
  const g = c.createGain(); g.connect(c.destination);
  if (kind === 'pop') {
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1250, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); o.start(t); o.stop(t + 0.16);
  } else if (kind === 'land') {
    const s = c.createBufferSource(); s.buffer = noiseBuf(c, 0.18, (w, i, n) => w * Math.pow(1 - i / n, 3)); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    g.gain.value = 0.2; s.connect(f); f.connect(g); s.start(t);
    const o = c.createOscillator(), g2 = c.createGain(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g2.gain.setValueAtTime(0.22, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g2); g2.connect(c.destination); o.start(t); o.stop(t + 0.18);
  } else if (kind === 'chime') { // shop-door bell
    [[1318, 0.12], [1976, 0.07], [2637, 0.04]].forEach(([f, v], k) => { const o = c.createOscillator(), gg = c.createGain(); o.frequency.value = f; gg.gain.setValueAtTime(0.0001, t + k * 0.11); gg.gain.exponentialRampToValueAtTime(v, t + k * 0.11 + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.11 + 1.6); o.connect(gg); gg.connect(c.destination); o.start(t + k * 0.11); o.stop(t + k * 0.11 + 1.7); });
  } else if (kind === 'whoosh') {
    const s = c.createBufferSource(); s.buffer = noiseBuf(c, 0.9, (w, i, n) => w * Math.sin(Math.PI * i / n)); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.8); g.gain.value = 0.16; s.connect(f); f.connect(g); s.start(t);
  } else if (kind === 'wrap') {
    const s = c.createBufferSource(); s.buffer = noiseBuf(c, 0.5, (w, i, n) => w * (0.4 + 0.6 * Math.random() * Math.sin(i / n * Math.PI))); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); s.connect(f); f.connect(g); s.start(t);
  }
}
sndBtn.onclick = () => { muted = !muted; localStorage.setItem('yf_mute', muted ? '1' : '0'); paintSnd(); startAmbience(); if (amb) amb.master.gain.setTargetAtTime(muted ? 0 : 1, actx.currentTime, 0.1); if (!muted) blip('pop'); };
addEventListener('pointerdown', () => { if (!muted) startAmbience(); }, { once: true });
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

/* ---------------- the walk-in: one continuous 1080p dolly shot ---------------- */
// Every frame is a keyframe (ffmpeg -g 1), so scrubbing is exact; "Walk in" plays it natively at 24fps
// and the scroll position follows the video, which is the smoothest possible path.
const vid = $('#walkVid'), poster = $('#walkPoster'), stage = $('#walkStage'), cam = $('#cam');
const SRC = MOBILE ? { v: 'media/walk-720.mp4', p: 'media/street-sm.webp', end: 'media/counter-sm.webp' } : { v: 'media/walk-1080.mp4', p: 'media/street.webp', end: 'media/counter.webp' };
poster.src = SRC.p; vid.src = SRC.v; vid.load();
const V_END = 0.84; // share of the walk section spent walking; the rest is standing at the counter
let dur = 12.04, vCur = 0, autoplay = false, vp = 0, lastVp = -1, arrived = false, chimed = false, whooshed = false;
vid.addEventListener('loadedmetadata', () => { dur = vid.duration || dur; });
vid.addEventListener('loadeddata', () => { poster.classList.add('gone'); });
const walkEl = $('#walk');
const walkRange = () => walkEl.offsetHeight - innerHeight;
const arriveY = () => walkEl.offsetTop + walkRange() * V_END + 2;
const walkP = () => clamp((scrollY - walkEl.offsetTop) / walkRange(), 0, 1);

// loader: show the street as soon as its still is decoded
let loaded = false;
function finishLoad() {
  if (loaded) return; loaded = true; loaderBar.style.width = '100%';
  setTimeout(() => $('#loader').classList.add('done'), 250);
  if (!reduce) {
    gsap.from('.intro .mega span', { yPercent: 110, opacity: 0, stagger: 0.12, duration: 1.4, ease: 'expo.out', delay: 0.35 });
    gsap.from('.intro .kicker, .intro-cta, .rating-chip, .walk-ui', { y: 24, opacity: 0, stagger: 0.08, duration: 1.1, ease: 'power3.out', delay: 0.6 });
    gsap.fromTo(cam, { scale: 1.08 }, { scale: 1, duration: 2.6, ease: 'power3.out', clearProps: 'scale' });
  }
}
{ const im = new Image(); im.src = SRC.p; im.decode().catch(() => {}).then(() => { loaderBar.style.width = '70%'; setTimeout(finishLoad, 200); }); setTimeout(finishLoad, 3500); }

const thr = $('#threshold'), intro = $('#intro'), walkUi = $('#walkUi'), progBar = $('#progBar'), bloom = $('.threshold .bloom'), leak = $('.threshold .leak'), wlines = $$('.wline'), vign = $('.walk-vignette');
const setIntro = gsap.quickSetter(intro, 'css'), setCam = gsap.quickSetter(cam, 'css');
let lastT = performance.now();
function walkTick() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const p = walkP();
  if (autoplay) {
    vCur = vid.currentTime;
    const y = walkEl.offsetTop + walkRange() * V_END * (vCur / dur);
    lenis.scrollTo(y, { immediate: true, force: true });
    if (vid.ended || vCur >= dur - 0.06) endAutoplay(true);
  } else {
    const target = clamp(p / V_END, 0, 1) * dur;
    vCur += (target - vCur) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - vCur) < 0.004) vCur = target;
    if (vid.readyState >= 2 && !vid.seeking && Math.abs(vid.currentTime - vCur) > 0.5 / 24) vid.currentTime = Math.min(vCur, dur - 0.04);
  }
  vp = clamp(vCur / dur, 0, 1);
  if (Math.abs(vp - lastVp) > 0.0005) {
    lastVp = vp;
    // intro copy drifts away as the walk starts
    const io = 1 - sstep(0.0, 0.07, vp); setIntro({ opacity: io, y: -60 * (1 - io), pointerEvents: io < 0.3 ? 'none' : 'auto' });
    walkUi.style.opacity = String(1 - sstep(0.75, 0.9, vp)); progBar.style.transform = `scaleX(${vp})`;
    // the threshold: bloom, light leak, a touch of push and (desktop) motion blur as we cross the door
    const k = Math.exp(-Math.pow((vp - 0.403) / 0.04, 2)); // door threshold ≈ 4.85s of 12s
    thr.style.visibility = k < 0.01 ? 'hidden' : 'visible'; bloom.style.opacity = String(k * 0.85); leak.style.opacity = String(k * 0.7); leak.style.transform = `translate3d(${(vp - 0.403) * -900}%,0,0) rotate(12deg)`;
    setCam({ scale: 1 + 0.035 * k, filter: MOBILE || k < 0.05 ? 'none' : `blur(${(k * 1.4).toFixed(2)}px)` });
    vign.style.opacity = String(1 - 0.35 * k);
    wlines.forEach(el => el.classList.toggle('on', vp >= +el.dataset.a && vp < +el.dataset.b));
    if (vp > 0.355 && !whooshed) { whooshed = true; blip('whoosh'); } if (vp < 0.3) whooshed = false;
    if (vp > 0.385 && !chimed) { chimed = true; blip('chime'); buzz(10); } if (vp < 0.32) chimed = false;
    setAmb(vp);
    if (vp > 0.5) preloadDishes();
  }
  const at = p >= V_END - 0.004 && vp > 0.985;
  if (at !== arrived) { arrived = at; arrive(at); }
}
gsap.ticker.add(walkTick);

function startAutoplay() {
  if (reduce) { goY(arriveY(), { duration: 0.01 }); return; }
  startAmbience(); blip('pop');
  const p = walkP(); if (p >= V_END) return;
  if (vid.readyState < 2) { goY(arriveY(), { duration: 9, easing: t => t }); return; }
  vid.currentTime = vCur; autoplay = true; document.body.classList.add('autowalk');
  vid.play().catch(() => { autoplay = false; goY(arriveY(), { duration: 9, easing: t => t }); });
}
function endAutoplay(done) {
  if (!autoplay) return; autoplay = false; vid.pause(); document.body.classList.remove('autowalk');
  if (done) { vCur = dur; lenis.scrollTo(arriveY(), { immediate: true, force: true }); }
}
['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { if (autoplay) endAutoplay(false); }, { passive: true }));
$('#walkBtn').onclick = startAutoplay;
stage.addEventListener('click', e => { if (vp < 0.02 && !e.target.closest('a,button,.counter')) startAutoplay(); });
$('#navOrder').onclick = e => { e.preventDefault(); if (walkP() < 0.05) startAutoplay(); else goY(arriveY()); };

/* ---------------- arriving: the floating menus are the destination ---------------- */
const counter = $('#counter');
let arriveTl = null;
const makeArrive = () => gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
  .fromTo('.counter-head', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2 }, 0)
  .fromTo('.panel-in', { y: 90, z: 0, opacity: 0, scale: 0.86, rotationX: 18 }, { y: 0, opacity: 1, scale: 1, rotationX: 0, duration: 1.5, stagger: 0.07 }, 0.1)
  .fromTo('.ring-nav', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1 }, 0.5)
  .fromTo('#trayWrap', { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3 }, 0.35);
function arrive(on) {
  counter.classList.toggle('live', on); document.body.classList.toggle('at-counter', on);
  if (!arriveTl) arriveTl = makeArrive();
  if (on) { arriveTl.timeScale(1).play(); fx.start(); layoutRing(); } else { arriveTl.timeScale(2.2).reverse(); fx.stop(); }
}

/* ---------------- counter: floating glass menu panels with drag + momentum ---------------- */
const ITEMS = {}; PANELS.forEach(p => p.items.forEach(it => { ITEMS[it.id] = { ...it, panel: p.id }; }));
const ring = $('#ring');
ring.innerHTML = PANELS.map((p, i) => `
  <div class="panel" data-i="${i}"><div class="bob" style="animation-delay:${-i * 0.9}s"><div class="glass panel-in">
    <div class="ph"><span class="pn">0${i + 1}</span><h3>${p.title}</h3></div>
    <div class="items">${p.items.map(it => `
      <button class="it" data-id="${it.id}">
        <span class="th"><img src="media/dish/${it.img}.webp" alt="" decoding="async"></span>
        <span class="nm">${it.name}${it.withChips ? `<small>with chips ${gbp(it.withChips)}</small>` : it.note ? `<small>${it.note}</small>` : ''}</span>
        <span class="pr">${gbp(it.price)}</span><span class="plus">+</span>
      </button>`).join('')}</div>
  </div></div></div>`).join('');
$('#dots').innerHTML = PANELS.map((p, i) => `<button aria-label="${p.title}" data-i="${i}"></button>`).join('');
const panels = $$('.panel'); const P = PANELS.length; const rs = { v: 0 }; let cur = 0, PW = 360;
const measure = () => { PW = panels[0].offsetWidth || 360; };
function layoutRing() {
  const spread = narrow() ? 1.0 : 1.02;
  panels.forEach((el, i) => {
    let rel = i - cur; rel = ((rel + P / 2) % P + P) % P - P / 2;
    const a = Math.abs(rel);
    el.style.transform = `translate3d(${(rel * PW * spread).toFixed(1)}px,0,${(-a * PW * 0.75).toFixed(1)}px) rotateY(${(-rel * 38).toFixed(2)}deg)`;
    el.style.opacity = String(clamp(1.1 - a * (narrow() ? 0.62 : 0.5), 0, 1).toFixed(3));
    el.classList.toggle('front', a < 0.5);
  });
  const fi = ((Math.round(cur) % P) + P) % P;
  $$('#dots button').forEach((d, i) => d.classList.toggle('on', i === fi));
}
function glideTo(target, dur = 0.9) { gsap.to(rs, { v: target, duration: reduce ? 0 : dur, ease: 'expo.out', overwrite: true, onUpdate: () => { cur = rs.v; layoutRing(); } }); }
const nearestIdx = i => { const base = Math.round(cur); let diff = ((i - base) % P + P) % P; if (diff > P / 2) diff -= P; return base + diff; };
$('#prevP').onclick = () => { glideTo(Math.round(cur) - 1); blip('pop'); };
$('#nextP').onclick = () => { glideTo(Math.round(cur) + 1); blip('pop'); };
$$('#dots button').forEach(d => d.onclick = () => glideTo(nearestIdx(+d.dataset.i)));
addEventListener('resize', () => { measure(); layoutRing(); });
measure(); layoutRing();
{
  const m = $('#menu3d'); let sx = null, sy = 0, start = 0, dragging = false, samples = [];
  m.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; start = cur; dragging = false; samples = [[performance.now(), e.clientX]]; gsap.killTweensOf(rs); });
  m.addEventListener('pointermove', e => {
    if (sx === null) return; const dx = e.clientX - sx;
    if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - sy)) { dragging = true; try { m.setPointerCapture(e.pointerId); } catch (_) {} }
    if (dragging) { cur = start - dx / (PW * 0.95); rs.v = cur; layoutRing(); samples.push([performance.now(), e.clientX]); if (samples.length > 6) samples.shift(); }
  });
  const end = () => {
    if (sx === null) return; sx = null; if (!dragging) return;
    const [t0, x0] = samples[0], [t1, x1] = samples[samples.length - 1]; const v = (x1 - x0) / Math.max(16, t1 - t0); // px/ms
    const throwP = -v * 260 / (PW * 0.95); // where momentum would carry the ring
    let tgt = Math.round(cur + throwP); tgt = clamp(tgt, Math.round(start) - 2, Math.round(start) + 2);
    glideTo(tgt, clamp(0.7 + Math.abs(tgt - cur) * 0.25, 0.7, 1.4)); blip('pop');
    m.dataset.justDragged = '1'; setTimeout(() => delete m.dataset.justDragged, 80);
  };
  m.addEventListener('pointerup', end); m.addEventListener('pointercancel', end);
}
// parallax depth on desktop: the glass drifts against the room
if (!MOBILE && !reduce) {
  const m3 = $('#menu3d'); const q = { x: 0, y: 0 };
  const qx = gsap.quickTo(q, 'x', { duration: 1.2, ease: 'power3.out' }), qy = gsap.quickTo(q, 'y', { duration: 1.2, ease: 'power3.out' });
  addEventListener('pointermove', e => { if (!arrived) return; qx(e.clientX / innerWidth - 0.5); qy(e.clientY / innerHeight - 0.5); });
  gsap.ticker.add(() => { if (!arrived) return; m3.style.transform = `translate3d(${(q.x * 16).toFixed(2)}px,${(q.y * 10).toFixed(2)}px,0) rotateY(${(q.x * 5).toFixed(2)}deg) rotateX(${(-q.y * 3).toFixed(2)}deg)`; });
}

// decode every dish before anything flies, so no first-flight hitch
let dishesReady = null;
function preloadDishes() { if (dishesReady) return dishesReady; const set = new Set(Object.values(ITEMS).map(i => i.img)); dishesReady = Promise.all([...set].map(n => { const im = new Image(); im.src = `media/dish/${n}.webp`; return im.decode().catch(() => {}); })); return dishesReady; }

/* ---------------- cart + real pricing ---------------- */
const cart = {}; // id -> qty
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
  $('#lines').innerHTML = lines.length ? lines.map(l => `<div class="ln"><span class="q">${l.q}×</span><span class="n">${l.n}${l.meal ? '<small>meal price</small>' : ''}</span><b>${gbp(l.p)}</b><span class="qb"><button data-dec="${l.id}" data-meal="${l.meal ? 1 : ''}" aria-label="Remove one">−</button><button data-inc="${l.id}" data-meal="${l.meal ? 1 : ''}" aria-label="Add one">+</button></span></div>`).join('') : '<p class="muted">Your tray is empty. Tap a dish on the menu.</p>';
  $('#order').classList.toggle('has', count() > 0);
  $('#trayHint').classList.toggle('gone', count() > 0);
  document.body.classList.toggle('carting', count() > 0);
}
$('#season').innerHTML = '<span>Seasoning</span>' + SEASONING.map(s => `<button class="chip ${season.has(s) ? 'on' : ''}" data-s="${s}">${s}</button>`).join('');
$('#season').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const s = b.dataset.s; season.has(s) ? season.delete(s) : season.add(s); b.classList.toggle('on'); blip('pop'); };
$('#lines').onclick = e => {
  const d = e.target.closest('[data-dec]'), i = e.target.closest('[data-inc]');
  if (d) { removeOne(d.dataset.dec); if (d.dataset.meal) removeOne('mchips'); buzz(8); }
  if (i) { addItem(i.dataset.inc, null); if (i.dataset.meal) addItem('mchips', null); }
};
$('#orderToggle').onclick = () => { $('#order').classList.toggle('open'); };

const trayItems = $('#trayItems'), trayWrap = $('#trayWrap'), traySide = $('#traySide'), trayBadges = $('#trayBadges'), trayGlow = $('#trayGlow');
/* Fixed slot layout, in % of the box image (bottom-centre anchor). Mains lie along the long side,
   chips sit in the right-hand end, sides tuck behind the front lip, drinks stand on the counter beside the box. */
const SLOTS = {
  main:  [{ x: 47, y: 53 }, { x: 58, y: 45 }, { x: 36, y: 46 }],
  chips: [{ x: 76, y: 60 }, { x: 84, y: 50 }],
  side:  [{ x: 25, y: 57 }, { x: 39, y: 62 }, { x: 58, y: 69 }, { x: 16, y: 51 }],
  drink: [{ x: 107, y: 97 }, { x: 119, y: 97 }, { x: -7, y: 97 }],
};
const LOOK = { // width (% of box) and resting angle per dish picture
  cod2: [36, 13], scampi: [25, 4], kebab: [29, 2], burger: [21, 0], fishcake: [16, 0],
  chips: [22, 0], peas: [14, 0], curry: [14, 0], sausage: [30, 13], saveloy: [23, 10], gherkin: [12, 0], can: [11, 0],
};
const ASPECT = { burger: 518 / 640, can: 640 / 266, chips: 498 / 640, cod2: 372 / 640, curry: 586 / 640, fishcake: 472 / 640, gherkin: 503 / 640, kebab: 470 / 640, peas: 636 / 640, sausage: 334 / 640, saveloy: 465 / 640, scampi: 453 / 640 };
const groupOf = it => it.img === 'can' ? 'drink' : it.img === 'chips' ? 'chips' : ['peas', 'curry', 'sausage', 'saveloy', 'gherkin', 'fishcake'].includes(it.img) ? 'side' : 'main';
const placed = {}; // id -> {el, badge, slot, group}
function freeSlot(group) {
  const used = Object.values(placed).filter(p => p.group === group).map(p => p.idx);
  for (let i = 0; i < SLOTS[group].length; i++) if (!used.includes(i)) return { idx: i, ...SLOTS[group][i] };
  const n = used.length - SLOTS[group].length + 1, last = SLOTS[group][SLOTS[group].length - 1]; // overflow: stack neatly behind the last slot
  return { idx: 100 + n, x: last.x - 3 * n, y: last.y - 4 * n };
}
function makeSlot(id) {
  const it = ITEMS[id], g = groupOf(it), s = freeSlot(g), [w, r] = LOOK[it.img] || [18, 0];
  const el = document.createElement('div'); el.className = 'ts ts-' + g;
  el.innerHTML = `<i class="cs"></i><img src="media/dish/${it.img}.webp" alt="${it.name}">`;
  Object.assign(el.style, { left: s.x + '%', top: s.y + '%', width: w + '%', zIndex: String(Math.round(s.y * 10)) });
  gsap.set(el, { xPercent: -50, yPercent: -100, rotation: r, transformOrigin: '50% 100%' });
  (g === 'drink' ? traySide : trayItems).appendChild(el);
  const badge = document.createElement('b'); badge.className = 'qty'; Object.assign(badge.style, { left: (s.x + w * 0.42) + '%', top: (s.y - 6) + '%' }); trayBadges.appendChild(badge);
  placed[id] = { el, badge, idx: s.idx, group: g, x: s.x, y: s.y, w, r, k: 1 };
  relayout(g, id); return placed[id];
}
// more dishes in a group -> the group scales down a touch so nothing crowds
function relayout(group, skip) {
  const ps = Object.entries(placed).filter(([, p]) => p.group === group);
  const n = ps.length, k = group === 'main' ? [1, 1, 0.88, 0.78][Math.min(n, 3)] : group === 'side' ? (n > 3 ? 0.88 : 1) : 1;
  ps.forEach(([id, p]) => { p.k = k; if (id === skip) gsap.set(p.el, { scale: k }); else gsap.to(p.el, { scale: k, duration: 0.6, ease: 'power3.out' }); });
}
function slotPoint(p) { const tr = trayWrap.getBoundingClientRect(); return { x: tr.left + tr.width * p.x / 100, y: tr.top + tr.height * p.y / 100, w: tr.width * p.w / 100 * p.k }; }
function paintBadge(id) { const p = placed[id]; if (!p) return; const q = cart[id] || 0; p.badge.textContent = q > 1 ? '×' + q : ''; p.badge.classList.toggle('on', q > 1); }
function pulseSlot(p) {
  Object.assign(trayGlow.style, { left: p.x + '%', top: (p.y - 4) + '%', width: (p.w * 1.5) + '%' });
  gsap.fromTo(trayGlow, { opacity: 0, scale: 0.7 }, { opacity: 0.9, scale: 1, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.05 });
}
// one tasteful sound: a soft card-on-card "thock"
function softLand() {
  if (muted) return; const c = ac(); if (!c) return; const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.2);
  const s = c.createBufferSource(); s.buffer = noiseBuf(c, 0.06, (w, i, n) => w * Math.pow(1 - i / n, 4)); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const g2 = c.createGain(); g2.gain.value = 0.08; s.connect(f); f.connect(g2); g2.connect(c.destination); s.start(t);
}
// the total ticks up rather than jumping
const shownTotal = { v: 0 };
function tickTotal() { gsap.to(shownTotal, { v: total(), duration: 0.5, ease: 'power2.out', overwrite: true, onUpdate: () => { $('#total').textContent = gbp(shownTotal.v); } }); }
// one flight at a time; fast taps queue up
const queue = []; let flying = false;
function addItem(id, fromEl) {
  cart[id] = (cart[id] || 0) + 1;
  const from = fromEl ? fromEl.getBoundingClientRect() : null;
  queue.push({ id, from }); if (!flying) nextFlight();
}
function nextFlight() {
  const job = queue.shift(); if (!job) { flying = false; return; } flying = true;
  const { id, from } = job; const it = ITEMS[id];
  const isNew = !placed[id]; const p = placed[id] || makeSlot(id);
  const land = () => {
    renderOrder(); paintBadge(id); tickTotal(); softLand(); buzz(10); pulseSlot(p);
    if (!isNew) gsap.fromTo(p.el, { scale: p.k * 1.06 }, { scale: p.k, duration: 0.35, ease: 'power2.out' });
    if (p.badge.classList.contains('on')) gsap.fromTo(p.badge, { scale: 1.4 }, { scale: 1, duration: 0.35, ease: 'back.out(2)' });
    nextFlight();
  };
  if (reduce || !from) {
    if (isNew) gsap.fromTo(p.el, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: reduce ? 0 : 0.35, ease: 'power3.out' });
    land(); return;
  }
  if (isNew) { gsap.set(p.el, { opacity: 0 }); gsap.set(p.el.querySelector('.cs'), { opacity: 0, scaleX: 0.4 }); }
  const sp = slotPoint(p);
  const fly = document.createElement('img'); fly.src = `media/dish/${it.img}.webp`; fly.className = 'fly'; fly.style.width = sp.w + 'px'; document.body.appendChild(fly);
  const h = sp.w * (ASPECT[it.img] || 0.75);
  const s0 = from.width / sp.w;
  const ax = from.left + from.width / 2, ay = from.top + from.height / 2 + (h * s0) / 2; // bottom-centre of the thumbnail
  const lift = { x: ax, y: ay - 22 };
  const c = { x: (lift.x + sp.x) / 2, y: Math.min(lift.y, sp.y) - Math.max(80, Math.abs(sp.y - lift.y) * 0.35) }; // gentle lob
  const put = (x, y, sc, rot) => gsap.set(fly, { x: x - sp.w / 2, y: y - h, scale: sc, rotation: rot, transformOrigin: '50% 100%', force3D: true });
  put(ax, ay, s0, 0);
  const st = { t: 0 };
  const tl = gsap.timeline({ onComplete: () => { if (isNew) gsap.set(p.el, { opacity: 1 }); fly.remove(); land(); } });
  tl.to(fly, { y: `-=22`, scale: s0 * 1.12, duration: 0.16, ease: 'power2.out' })
    .to(st, { t: 1, duration: 0.42, ease: 'power3.inOut', onUpdate: () => {
      const t = st.t, u = 1 - t;
      const x = u * u * lift.x + 2 * u * t * c.x + t * t * sp.x, y = u * u * lift.y + 2 * u * t * c.y + t * t * (sp.y - 10);
      put(x, y, s0 * 1.12 + (1 - s0 * 1.12) * t, p.r * t - 6 * Math.sin(t * Math.PI));
    } })
    .to(fly, { y: `+=10`, duration: 0.16, ease: 'back.out(1.4)' })
    .to(isNew ? p.el.querySelector('.cs') : {}, { opacity: 1, scaleX: 1, duration: 0.3, ease: 'power2.out' }, 0.42);
}
function removeOne(id) {
  if (!cart[id]) return; cart[id]--;
  const p = placed[id];
  if (!cart[id]) {
    delete cart[id];
    if (p) { delete placed[id]; p.badge.remove(); gsap.to(p.el, { y: -36, opacity: 0, duration: 0.42, ease: 'power3.in', onComplete: () => p.el.remove() }); relayout(p.group); }
  } else paintBadge(id);
  renderOrder(); tickTotal();
}
ring.addEventListener('click', e => {
  if ($('#menu3d').dataset.justDragged) return;
  const pnl = e.target.closest('.panel'); if (!pnl) return;
  if (!pnl.classList.contains('front')) { glideTo(nearestIdx(+pnl.dataset.i)); return; }
  const b = e.target.closest('.it'); if (!b) return;
  gsap.fromTo(b, { backgroundColor: 'rgba(255,210,31,.32)' }, { backgroundColor: 'rgba(255,210,31,0)', duration: 0.8, ease: 'power2.out', clearProps: 'backgroundColor' });
  addItem(b.dataset.id, b.querySelector('.th img'));
});
renderOrder();
const onScroll = () => { document.body.classList.toggle('scrolled', scrollY > 40 && walkP() >= 1); document.body.classList.toggle('at-foot', $('.foot').getBoundingClientRect().top < innerHeight * 0.85); };
lenis.on('scroll', onScroll); onScroll();

/* ---------------- fried-to-order band: lazy cinematic loop ---------------- */
{ const fv = $('#friedVid'); let set = false; new IntersectionObserver(es => { const on = es[0].isIntersecting; if (on && !set) { fv.src = MOBILE ? 'media/hero-fryer-sm.mp4' : 'media/hero-fryer.mp4'; set = true; } on ? fv.play().catch(() => {}) : fv.pause(); }, { rootMargin: '200px' }).observe(fv); }

/* ---------------- atmosphere at the counter: steam, embers, lamp bloom (Three.js) ---------------- */
const fx = (() => {
  const canvas = $('#fx'); const api = { puff() {}, start() {}, stop() {} };
  if (reduce) { canvas.remove(); return api; }
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch (e) { canvas.remove(); return api; }
  renderer.setPixelRatio(1); // soft particles don't need retina pixels
  const scene = new THREE.Scene(); let W = 1, H = 1; const camO = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const mat = () => new THREE.SpriteMaterial({ map: tex, color: 0xfff1dc, transparent: true, opacity: 0, depthWrite: false });
  const smokes = []; for (let i = 0; i < (MOBILE ? 18 : 36); i++) { const s = new THREE.Sprite(mat()); s.userData = { life: Math.random(), speed: 0.1 + Math.random() * 0.08, src: i % 3, drift: Math.random() * 6.28 }; scene.add(s); smokes.push(s); }
  const puffs = [];
  const NE = MOBILE ? 28 : 60, eg = new THREE.BufferGeometry(), ep = new Float32Array(NE * 3), ev = [];
  for (let i = 0; i < NE; i++) { ep[i * 3] = Math.random(); ep[i * 3 + 1] = Math.random(); ev.push([0.006 + Math.random() * 0.012, Math.random() * 6.28]); }
  eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: tex, color: 0xffc35a, size: 6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
  scene.add(embers);
  // lamp positions in the final frame of the walk-in (u,v of the 4:3 frame)
  const lamps = [[0.235, 0.13, 0.9], [0.535, 0.11, 1], [0.87, 0.09, 1]].map(([x, y, k]) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb347, transparent: true, opacity: 0.4 * k, blending: THREE.AdditiveBlending, depthWrite: false })); s.userData = { x, y, k }; scene.add(s); return s; });
  const sources = [[0.44, 0.58, 0.06], [0.3, 0.56, 0.06], [0.62, 0.56, 0.06]];
  function map(u, v) { const s = Math.max(W / 1440, H / 1080); const dw = 1440 * s, dh = 1080 * s; return [(W - dw) / 2 + u * dw, (H - dh) / 2 + v * dh, s]; }
  function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); camO.right = W; camO.top = H; camO.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  let running = false, frame = 0, last = performance.now();
  api.start = () => { if (running) return; running = true; canvas.classList.add('on'); last = performance.now(); gsap.ticker.add(loop); };
  api.stop = () => { running = false; canvas.classList.remove('on'); gsap.ticker.remove(loop); };
  api.puff = (cx, cy) => { for (let i = 0; i < (MOBILE ? 3 : 5); i++) { const s = new THREE.Sprite(mat()); s.userData = { x: cx + (Math.random() - 0.5) * 40, y: cy - 10, life: 0, sp: 0.6 + Math.random() * 0.5 }; scene.add(s); puffs.push(s); } };
  function loop() {
    frame++; if (MOBILE && frame % 2) return; // 30fps is plenty for drifting steam on phones
    const now = performance.now(), dt = Math.min(0.06, (now - last) / 1000); last = now; const t = now / 1000;
    for (const s of smokes) {
      const d = s.userData; d.life += dt * d.speed; if (d.life > 1) { d.life = 0; d.drift = Math.random() * 6.28; }
      const [u, v, wv] = sources[d.src]; const [bx, by, sc] = map(u + Math.sin(d.drift) * wv * 0.5, v);
      s.position.set(bx + Math.sin(t * 0.6 + d.drift) * 30 * d.life, H - (by - d.life * 320 * sc), 0);
      const size = (90 + d.life * 280) * sc; s.scale.set(size, size, 1); s.material.opacity = Math.sin(d.life * Math.PI) * 0.08;
    }
    for (let i = puffs.length - 1; i >= 0; i--) { const s = puffs[i], d = s.userData; d.life += dt * d.sp; if (d.life > 1) { scene.remove(s); s.material.dispose(); puffs.splice(i, 1); continue; } s.position.set(d.x + Math.sin(t * 2 + i) * 10 * d.life, H - (d.y - d.life * 140), 1); const z = 40 + d.life * 160; s.scale.set(z, z, 1); s.material.opacity = Math.sin(d.life * Math.PI) * 0.22; }
    const pa = eg.attributes.position.array;
    for (let i = 0; i < NE; i++) { pa[i * 3 + 1] += ev[i][0] * dt * 3; pa[i * 3] += Math.sin(t + ev[i][1]) * 0.0006; if (pa[i * 3 + 1] > 1) { pa[i * 3 + 1] = 0; pa[i * 3] = Math.random(); } }
    eg.attributes.position.needsUpdate = true; embers.scale.set(W, H, 1);
    for (const l of lamps) { const [x, y, sc] = map(l.userData.x, l.userData.y); l.position.set(x, H - y, 0); const z = 240 * sc * (1 + Math.sin(t * 3.1 + l.userData.k * 5) * 0.03); l.scale.set(z, z, 1); }
    renderer.render(scene, camO);
  }
  return api;
})();

/* ---------------- reveal-on-scroll for the info sections ---------------- */
if (!reduce) $$('.solid .sec-title, .card, .mg, details, .shop figure, .fried-copy').forEach(el => gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));

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
  if (count() <= 0) { gsap.fromTo('#trayWrap', { x: -8 }, { x: 0, duration: 0.6, ease: 'power3.out' }); $('#trayHint').classList.add('nudge'); setTimeout(() => $('#trayHint').classList.remove('nudge'), 900); return; }
  $('#miniSum').innerHTML = priceLines().map(l => `${l.q}× ${l.n} · ${gbp(l.p)}`).join('<br>') + `<br><span class="muted">${seasonTxt()}</span><br><b>Total ${gbp(total())}</b>`;
  $('#total2').textContent = gbp(total());
  $('#orderForm').hidden = false; $('#orderDone').hidden = true; fillSlots();
  blip('wrap'); buzz([10, 40, 10]);
  if (!reduce) gsap.fromTo('#trayWrap', { y: 0 }, { y: -12, yoyo: true, repeat: 1, duration: 0.4, ease: 'power2.inOut' });
  setTimeout(() => { modal.hidden = false; lenis.stop(); $('#order').classList.remove('open'); if (!reduce) gsap.from('.sheet', { y: 60, opacity: 0, duration: 0.45, ease: 'power3.out' }); $('#fName').focus({ preventScroll: true }); }, reduce ? 0 : 900);
};
function untuck() {}
modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) { modal.hidden = true; lenis.start(); untuck(); } });
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
window.__yf = { placed, cart, total, priceLines, addItem, glideTo, lenis, arriveY, startAutoplay };
