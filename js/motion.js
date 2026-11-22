// Motion layer. Everything here is optional: if GSAP/Lenis fail to load or the
// user prefers reduced motion, the page still works and shows all content.
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

let lenis = null;
let refreshTimer = 0;

/** Smooth-scroll to an element (Lenis when available). */
export function scrollToEl(el, { offset = 0 } = {}) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();

/** Call after content changes height (debounced). */
export function refresh() {
  if (!window.ScrollTrigger) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => window.ScrollTrigger.refresh(), 150);
}

// ---------- Clock ----------
function clock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const d = new Date();
    el.textContent = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 15000);
}

// ---------- Intro + hero entrance ----------
function intro() {
  return new Promise((resolve) => {
    const finish = () => { root.classList.add('hero-in'); resolve(); };
    if (!root.classList.contains('intro')) { requestAnimationFrame(() => requestAnimationFrame(finish)); return; }
    const loader = document.getElementById('loader');
    const count = document.getElementById('loader-count');
    const bar = document.getElementById('loader-bar');
    const t0 = performance.now();
    const dur = 750;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      count.textContent = String(Math.round(e * 100)).padStart(3, '0');
      bar.style.width = `${e * 100}%`;
      if (p < 1) { requestAnimationFrame(step); return; }
      loader.classList.add('is-out');
      try { sessionStorage.setItem('aidev-intro', '1'); } catch { /* ignore */ }
      setTimeout(finish, 250);
      setTimeout(() => root.classList.remove('intro'), 1000);
    };
    requestAnimationFrame(step);
  });
}

// ---------- Cursor, magnetic buttons, project preview (plain JS) ----------
function cursor() {
  const el = document.getElementById('cursor');
  const label = document.getElementById('cursor-label');
  root.classList.add('has-cursor');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  const loop = () => {
    cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
  const sel = 'a, button, summary, label.task-main, .node, [data-cursor], .cb, select';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest(sel);
    el.classList.toggle('is-hover', !!t);
    const text = t?.closest('[data-cursor]')?.dataset.cursor;
    el.classList.toggle('is-label', !!text);
    if (text) label.textContent = text;
  });
  document.addEventListener('pointerleave', () => el.classList.remove('is-hover', 'is-label'));
}

function magnetic() {
  document.addEventListener('pointermove', (e) => {
    const m = e.target.closest('[data-magnetic]');
    document.querySelectorAll('[data-magnetic].is-mag').forEach((n) => {
      if (n !== m) { n.classList.remove('is-mag'); n.style.transform = ''; }
    });
    if (!m) return;
    const r = m.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    m.classList.add('is-mag');
    m.style.transform = `translate(${dx * 0.22}px, ${dy * 0.32}px)`;
  }, { passive: true });
}

function projectPreview() {
  const box = document.getElementById('pf-preview');
  const art = document.getElementById('pf-preview-art');
  const text = document.getElementById('pf-preview-text');
  const ideas = {
    p1: { label: 'Tabular · scikit-learn', idea: 'Prediksi end-to-end untuk data tabular, dari EDA sampai aplikasi web.' },
    p2: { label: 'Vision · PyTorch', idea: 'Klasifikasi gambar dengan transfer learning, bisa dicoba di browser.' },
    p3: { label: 'LLM · RAG', idea: 'Chatbot yang menjawab dari materi kuliah, lengkap dengan sumbernya.' },
  };
  let x = 0, y = 0, cx = 0, cy = 0, on = false, raf = 0;
  const loop = () => {
    cx += (x - cx) * 0.14; cy += (y - cy) * 0.14;
    box.style.transform = `translate3d(${cx + 28}px, ${cy - 160}px, 0)`;
    if (on || Math.abs(x - cx) > 0.5) raf = requestAnimationFrame(loop); else raf = 0;
  };
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; if (on && !raf) loop(); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const row = e.target.closest('.pf-row[data-preview]');
    if (row) {
      const pid = row.dataset.preview;
      const info = ideas[pid];
      art.innerHTML = `<div class="art art-${pid}" data-label="${info.label}"></div>`;
      text.textContent = info.idea;
      if (!on) { cx = x; cy = y; }
      on = true; box.classList.add('is-on');
      if (!raf) loop();
    } else if (on) {
      on = false; box.classList.remove('is-on');
    }
  });
}

// ---------- GSAP + Lenis ----------
function scrollMotion() {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!gsap || !ScrollTrigger) { root.classList.add('no-gsap'); return; }
  gsap.registerPlugin(ScrollTrigger);

  if (Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Section headings rise out of their masks
  gsap.utils.toArray('.h2').forEach((h) => {
    gsap.from(h.querySelectorAll('.mask > span'), {
      yPercent: 108, duration: 1.2, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: h, start: 'top 88%', once: true },
    });
  });

  // Blocks fade up
  gsap.utils.toArray('.nn-card, .cl-card, .coach, .hb-top, .hb-card, .hb-map, .pf-item, .fo-grid, .log-top, .log-lower, .data-card, .now-actions, .footer-cols').forEach((el) => {
    gsap.from(el, {
      y: 56, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  // Manifesto: words light up as you scroll
  const man = document.getElementById('manifesto');
  man.style.setProperty('--p', 0);
  ScrollTrigger.create({
    trigger: man, start: 'top 82%', end: 'bottom 50%', scrub: true,
    onUpdate: (self) => man.style.setProperty('--p', self.progress.toFixed(3)),
  });
  gsap.to('#now-ghost', { xPercent: -18, ease: 'none', scrollTrigger: { trigger: '.now', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Hero drifts and fades as you leave it
  gsap.to('.hero-inner', { yPercent: 14, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-canvas', { scale: 1.12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Ticker: constant loop that speeds up with scroll velocity
  const loopTween = gsap.to('#ticker', { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
  let boost = 1;
  ScrollTrigger.create({ onUpdate: (self) => { boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 6); } });
  gsap.ticker.add(() => { boost += (1 - boost) * 0.06; loopTween.timeScale(boost); });

  // Phases: pinned horizontal scroll on wide screens
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px) and (min-height: 600px)', () => {
    const section = document.querySelector('.phases');
    const track = document.getElementById('phase-track');
    section.classList.add('is-pinned');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: section, pin: '.phases-pin', start: 'top top', end: () => `+=${dist()}`, scrub: 0.8, invalidateOnRefresh: true },
    });
    return () => { section.classList.remove('is-pinned'); tween.scrollTrigger?.kill(); tween.kill(); gsap.set(track, { x: 0 }); };
  });

  // Week bars grow in
  ScrollTrigger.create({
    trigger: '#weeks', start: 'top 85%', once: true,
    onEnter: () => gsap.from('#weeks .col-bar', { scaleY: 0, duration: 1.1, ease: 'expo.out', stagger: 0.05 }),
  });

  // Images/fonts can change heights after load
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/** @returns {Promise<void>} resolves when the hero entrance has started */
export function initMotion() {
  clock();
  if (reduced) { root.classList.add('no-motion', 'hero-in'); return Promise.resolve(); }
  if (finePointer) { cursor(); magnetic(); projectPreview(); }
  scrollMotion();
  return intro();
}
