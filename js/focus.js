// Pomodoro timer ("Fokus" section). A dial like a kitchen timer, one turn = 60 minutes:
// drag the knob (or use arrow keys, a preset, or the minutes box) to set the length, start, and
// the coloured wedge runs down. Longer than an hour means winding past 12 again: the full hours
// left show as a dim ring under the bright wedge.
// Finished focus sessions go straight into the study log. Timer state is kept per device
// (localStorage 'aidev-focus-v1'), so a reload or a closed tab doesn't lose a running session.
import { store, subscribe } from './store.js';
import { activeMonth, monthTasks, todayStr, ymd, parseYmd, focusStats, fmtHours, esc } from './util.js';
import { FOCUS_TAG, DAYS_ID, DAYS_LONG } from './data.js';

const KEY = 'aidev-focus-v1';
const EVERY = 4; // focus sessions before a long break
const MODES = {
  focus: { label: 'Fokus', min: 5, max: 240, def: 25, presets: [25, 50, 60, 90, 120, 180] },
  short: { label: 'Istirahat', min: 1, max: 30, def: 5, presets: [5, 10, 15] },
  long: { label: 'Istirahat panjang', min: 5, max: 60, def: 15, presets: [15, 20, 30, 45, 60] },
};
const MIN = 60_000;
const TURN = 60 * MIN; // one full turn of the dial
const R = 74; // ring radius in the 220×220 viewBox
const C = 2 * Math.PI * R;

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** 25:00, or 1:30:00 from one hour up. */
const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  return `${h ? `${h}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
/** "25 menit", "1 jam 30 menit" */
const words = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} jam` : '', m ? `${m} menit` : ''].filter(Boolean).join(' ');
};
/** Short label for the preset buttons: 25, 1 j, 1½ j */
const short = (min) => (min < 60 ? `${min}` : `${Math.floor(min / 60)}${min % 60 === 30 ? '½' : ''} jam`);

let st = load();
let hooks = { onLog: () => false, onTaskDone: () => {}, toast: () => {} };
let loop = 0;
let endTimer = 0;
let audio = null;
let lastText = '';
let inView = true;
const baseTitle = document.title;

function fresh() {
  return { mode: 'focus', run: false, end: 0, left: MODES.focus.def * MIN, total: MODES.focus.def * MIN, cycle: 0, task: '', mins: { focus: 25, short: 5, long: 15 }, auto: false, sound: true };
}
function load() {
  const s = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return s;
    for (const m of Object.keys(MODES)) {
      const v = Number(raw.mins?.[m]);
      if (Number.isInteger(v)) s.mins[m] = clamp(v, MODES[m].min, MODES[m].max);
    }
    if (raw.mode in MODES) s.mode = raw.mode;
    s.total = Number.isFinite(raw.total) && raw.total > 0 && raw.total <= MODES[s.mode].max * MIN ? raw.total : s.mins[s.mode] * MIN;
    s.left = Number.isFinite(raw.left) ? clamp(raw.left, 0, s.total) : s.total;
    s.run = raw.run === true && Number.isFinite(raw.end);
    s.end = s.run ? raw.end : 0;
    s.cycle = Number.isInteger(raw.cycle) ? clamp(raw.cycle, 0, EVERY) : 0;
    s.task = typeof raw.task === 'string' ? raw.task.slice(0, 64) : '';
    s.auto = raw.auto === true;
    s.sound = raw.sound !== false;
  } catch { /* defaults */ }
  return s;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

const remaining = () => (st.run ? Math.max(0, st.end - Date.now()) : st.left);
const adjustable = () => !st.run && st.left === st.total;

// ---------- Actions ----------
function start() {
  if (st.run) return;
  if (st.left <= 0) st.left = st.total;
  st.run = true;
  st.end = Date.now() + st.left;
  save();
  unlockAudio();
  setStatus('');
  render();
}

function pause() {
  if (!st.run) return;
  st.left = remaining();
  st.run = false;
  st.end = 0;
  save();
  render();
}

function reset() {
  st.run = false;
  st.end = 0;
  st.total = st.left = st.mins[st.mode] * MIN;
  save();
  setStatus('');
  render();
}

function setMinutes(min) {
  if (!adjustable()) return;
  const m = MODES[st.mode];
  const v = clamp(Math.round(min), m.min, m.max);
  if (v === st.mins[st.mode]) return;
  st.mins[st.mode] = v;
  st.total = st.left = v * MIN;
  save();
  render();
}

const elapsed = () => Math.floor((st.total - remaining()) / MIN);

/** Skip ahead. In a focus session the minutes done so far are still logged. */
function skip() {
  finish({ natural: false, minutes: elapsed() });
}

// ---------- Confirm before throwing away focus minutes ----------
let pending = null; // {mode, from}: the mode to go to, and the button that asked
const atRisk = () => st.mode === 'focus' && !store.readOnly && elapsed() >= 1;

/** Go to `mode` (the current one for "Ulang"), asking first when minutes would be lost. */
function leave(mode, from) {
  if (mode === st.mode && from.dataset.foMode) return; // pressing the active mode does nothing
  if (!atRisk()) { closeConfirm(); goTo(mode); return; }
  pending = { mode, from };
  $('fo-confirm').hidden = false;
  paintConfirm();
  $('fo-keep').focus();
}
function goTo(mode) {
  st.mode = mode;
  reset();
}
/** focusBack: put focus on the button that asked (or Start, when that one is now disabled). */
function closeConfirm(focusBack = false) {
  if (!pending) return;
  const { from } = pending;
  pending = null;
  $('fo-confirm').hidden = true;
  if (focusBack) (from.disabled ? $('fo-toggle') : from).focus();
}
function answerConfirm(answer) {
  if (!pending) return;
  const { mode } = pending;
  const min = elapsed();
  let msg = '';
  if (answer === 'keep') {
    finish({ natural: false, minutes: min, quiet: true });
    msg = `+${words(min)} fokus tercatat di log.`;
  }
  if (answer !== 'cancel') { goTo(mode); setStatus(msg || 'Sesi dibuang, tidak dicatat.'); }
  closeConfirm(true);
}
function paintConfirm() {
  const text = `Catat ${words(elapsed())}`;
  if (pending && $('fo-keep').textContent !== text) $('fo-keep').textContent = text;
}

/**
 * Move to the next step of the cycle.
 * natural: the countdown reached zero (chime, notification, auto start).
 * late: it reached zero while the page was closed.
 */
function finish({ natural, minutes, late = false, quiet = false }) {
  if (!quiet && pending) { // the session ended while the question was open
    const inside = $('fo-confirm').contains(document.activeElement);
    closeConfirm();
    if (inside) $('fo-toggle').focus({ preventScroll: true });
  }
  const was = st.mode;
  const endedAt = st.run ? Math.min(st.end, Date.now()) : Date.now();
  let msg = '';

  if (was === 'focus') {
    const min = natural ? Math.round(st.total / MIN) : minutes;
    if (min >= 1) {
      const t = taskOf(st.task);
      const res = hooks.onLog(ymd(new Date(endedAt)), min, t ? `${FOCUS_TAG} · ${t.t}` : FOCUS_TAG);
      if (res) msg = `+${words(min)} fokus tercatat di log${res.tick ? ' · kebiasaan ✓' : ''}.`;
      else if (store.readOnly) msg = 'Mode lihat: sesi tidak dicatat.';
      st.cycle = Math.min(EVERY, st.cycle + 1);
    } else msg = 'Sesi dilewati, belum ada satu menit untuk dicatat.';
    st.mode = st.cycle >= EVERY ? 'long' : 'short';
  } else {
    if (was === 'long') st.cycle = 0;
    st.mode = 'focus';
    msg = 'Istirahat selesai. Siap fokus lagi?';
  }

  st.total = st.left = st.mins[st.mode] * MIN;
  st.run = false;
  st.end = 0;
  if (natural && !late && st.auto) { st.run = true; st.end = Date.now() + st.left; }
  save();

  const next = `${MODES[st.mode].label} ${words(st.mins[st.mode])}${st.run ? ' dimulai' : ''}`;
  if (late) msg = `Sesi ${MODES[was].label.toLowerCase()} selesai saat halaman tertutup. ${msg}`;
  setStatus(`${msg} Berikutnya: ${next}.`, was === 'focus' && st.task && taskOf(st.task) && !store.data.done[st.task]);
  if (natural && !late) {
    chime();
    navigator.vibrate?.([180, 90, 180]);
    notify(was === 'focus' ? 'Sesi fokus selesai ✦' : 'Istirahat selesai', `Berikutnya: ${next}.`);
    hooks.toast(was === 'focus' ? '✦ Sesi fokus selesai' : 'Istirahat selesai · ayo lanjut');
  }
  render();
}

/** Called often while running; finishes the session once time is up. */
function tick() {
  if (st.run && remaining() <= 0) {
    // Another tab may already have finished this session: trust what is saved.
    const saved = load();
    if (saved.run !== st.run || saved.end !== st.end) { st = saved; if (!atRisk()) closeConfirm(); render(); return; }
    finish({ natural: true });
    return;
  }
  paint();
}

// ---------- Sound + notifications ----------
function unlockAudio() {
  if (!st.sound || audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function chime() {
  if (!st.sound || !audio) return;
  try {
    audio.resume();
    const t0 = audio.currentTime + 0.02;
    [784, 988, 1319].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = t0 + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch { /* no sound */ }
}
function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
  const opts = { body, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: 'aidev-focus' };
  // Mobile Chrome only allows notifications through the service worker.
  navigator.serviceWorker?.getRegistration().then((r) => (r ? r.showNotification(title, opts) : new Notification(title, opts))).catch(() => {});
}

// ---------- Rendering ----------
function taskOf(id) {
  if (!id) return null;
  return monthTasks(store.data, activeMonth()).find((t) => t.id === id) ?? null;
}

function build() {
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const r1 = major ? 89 : 91;
    ticks += `<line${major ? ' class="major"' : ''} x1="${(110 + r1 * Math.sin(a)).toFixed(2)}" y1="${(110 - r1 * Math.cos(a)).toFixed(2)}" x2="${(110 + 95 * Math.sin(a)).toFixed(2)}" y2="${(110 - 95 * Math.cos(a)).toFixed(2)}"/>`;
  }
  let nums = '';
  for (let m = 0; m < 60; m += 5) {
    const a = (m / 60) * Math.PI * 2;
    nums += `<text x="${(110 + 104 * Math.sin(a)).toFixed(2)}" y="${(110 - 104 * Math.cos(a)).toFixed(2)}">${m}</text>`;
  }
  $('fo-dial').insertAdjacentHTML('afterbegin', `
    <svg class="fo-svg" viewBox="0 0 220 220" aria-hidden="true">
      <g class="fo-ticks">${ticks}</g>
      <g class="fo-nums">${nums}</g>
      <circle class="fo-track" cx="110" cy="110" r="${R}"/>
      <circle class="fo-arc fo-full" id="fo-full" cx="110" cy="110" r="${R}"/>
      <circle class="fo-arc" id="fo-arc" cx="110" cy="110" r="${R}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" transform="rotate(-90 110 110)"/>
    </svg>`);
}

/** Cheap per-tick update: time, wedge, knob, title. */
function paint() {
  paintConfirm();
  const left = remaining();
  const text = clock(left);
  const full = Math.max(0, Math.ceil(left / TURN) - 1); // whole hours under the current turn
  const frac = (left - full * TURN) / TURN;
  $('fo-dial').classList.toggle('has-full', full > 0);
  $('fo-arc').setAttribute('stroke-dashoffset', (C * (1 - frac)).toFixed(2));
  const a = frac * Math.PI * 2;
  const knob = $('fo-knob');
  knob.style.left = `${((110 + R * Math.sin(a)) / 220) * 100}%`;
  knob.style.top = `${((110 - R * Math.cos(a)) / 220) * 100}%`;
  if (text !== lastText) {
    lastText = text;
    $('fo-time').textContent = text;
    $('fo-time').classList.toggle('is-long', text.length > 5);
    $('fo-pill-time').textContent = text;
    document.title = st.run ? `${text} · ${MODES[st.mode].label} — AIDEV` : baseTitle;
  }
}

function render() {
  const m = MODES[st.mode];
  const dial = $('fo-dial');
  dial.dataset.mode = st.mode;
  dial.classList.toggle('is-run', st.run);
  dial.classList.toggle('is-paused', !st.run && st.left < st.total);
  $('fo-mode').textContent = st.run ? m.label : st.left < st.total ? `${m.label} · dijeda` : m.label;

  const knob = $('fo-knob');
  const mins = st.mins[st.mode];
  knob.setAttribute('aria-label', `Durasi ${m.label.toLowerCase()}`);
  knob.setAttribute('aria-valuemin', m.min);
  knob.setAttribute('aria-valuemax', m.max);
  knob.setAttribute('aria-valuenow', mins);
  knob.setAttribute('aria-valuetext', words(mins));
  knob.setAttribute('aria-disabled', String(!adjustable()));

  renderLengths();

  document.querySelectorAll('[data-fo-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.foMode === st.mode)));

  const toggle = $('fo-toggle');
  toggle.querySelector('.fo-toggle-text').textContent = st.run ? 'Jeda' : st.left < st.total ? 'Lanjutkan' : 'Mulai';
  toggle.setAttribute('aria-pressed', String(st.run));
  $('fo-skip').textContent = st.mode === 'focus' ? 'Selesai sekarang' : 'Lewati istirahat';
  $('fo-reset').disabled = !st.run && st.left === st.total;

  $('fo-cycle').innerHTML = Array.from({ length: EVERY }, (_, i) => `<i class="${i < st.cycle ? 'is-on' : ''}"></i>`).join('')
    + `<span class="sr-only">${st.cycle} dari ${EVERY} sesi fokus sebelum istirahat panjang</span>`;

  $('fo-auto').checked = st.auto;
  $('fo-sound').checked = st.sound;
  renderNotifyBtn();
  renderTasks();
  renderToday();

  clearInterval(loop);
  clearTimeout(endTimer);
  if (st.run) {
    loop = setInterval(tick, 250);
    endTimer = setTimeout(tick, remaining() + 30); // a single timer still fires on time in a background tab
  }
  lastText = '';
  paint();
  renderPill();
}

/** Preset lengths + the minutes box for the current mode. */
function renderLengths() {
  const m = MODES[st.mode];
  const mins = st.mins[st.mode];
  const box = $('fo-presets');
  if (box.dataset.mode !== st.mode) {
    box.dataset.mode = st.mode;
    box.innerHTML = m.presets.map((v) => `<button class="fo-preset" type="button" data-fo-min="${v}" aria-label="${words(v)}">${short(v)}</button>`).join('');
  }
  box.querySelectorAll('[data-fo-min]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.foMin) === mins));
    b.disabled = !adjustable();
  });
  const input = $('fo-min');
  input.min = m.min;
  input.max = m.max;
  input.disabled = !adjustable();
  input.value = mins;
  $('fo-min-hint').textContent = `${m.min}–${m.max}`;
}

function renderTasks() {
  const sel = $('fo-task');
  const month = activeMonth();
  const tasks = monthTasks(store.data, month);
  const opts = [`<option value="">Belajar bebas</option>`];
  for (const t of tasks) {
    const label = `${store.data.done[t.id] ? '✓ ' : ''}${t.t}`;
    opts.push(`<option value="${t.id}">${label.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])}</option>`);
  }
  const html = opts.join('');
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  if (st.task && !tasks.some((t) => t.id === st.task)) st.task = '';
  sel.value = st.task;
  $('fo-task-month').textContent = month.name;
}

function renderToday() {
  const today = todayStr();
  const mine = store.data.log.filter((e) => e.d === today && e.n.startsWith(FOCUS_TAG));
  const min = mine.reduce((s, e) => s + e.m, 0);
  $('fo-today-n').textContent = mine.length;
  $('fo-today-min').textContent = min;
  $('fo-today-dots').innerHTML = mine.slice(0, 16).map(() => '<i></i>').join('') + (mine.length > 16 ? `<span>+${mine.length - 16}</span>` : '');

  const f = focusStats(store.data, 7);
  const max = Math.max(60, ...f.perDay.map((d) => d.min));
  $('fo-week-total').textContent = fmtHours(f.total);
  $('fo-bars').innerHTML = f.perDay.map((d) => `<li class="${d.d === today ? 'is-today' : ''}${d.min ? ' has' : ''}">
      <i style="--h:${((d.min / max) * 100).toFixed(1)}%"></i><span>${DAYS_ID[parseYmd(d.d).getDay()]}</span></li>`).join('');
  $('fo-week-sr').textContent = `Menit fokus 7 hari terakhir: ${f.perDay.map((d) => `${DAYS_LONG[parseYmd(d.d).getDay()]} ${d.min}`).join(', ')}.`;
  $('fo-week-meta').innerHTML = f.sessions
    ? `Rata-rata ${f.avg} menit per sesi${f.top ? ` · paling banyak: <strong>${esc(f.top[0])}</strong> (${fmtHours(f.top[1])} jam)` : ''}`
    : 'Belum ada sesi fokus dalam 7 hari terakhir.';
}

function renderNotifyBtn() {
  const b = $('fo-notify');
  if (!('Notification' in window)) { b.hidden = true; return; }
  const p = Notification.permission;
  b.disabled = p !== 'default';
  b.textContent = p === 'granted' ? 'Notifikasi aktif ✓' : p === 'denied' ? 'Notifikasi diblokir browser' : 'Izinkan notifikasi';
}

function renderPill() {
  const pill = $('fo-pill');
  pill.hidden = !st.run || inView;
  pill.dataset.mode = st.mode;
  $('fo-pill-mode').textContent = MODES[st.mode].label;
}

function setStatus(msg, offerDone = false) {
  const el = $('fo-status');
  el.textContent = msg;
  if (offerDone) {
    const t = taskOf(st.task);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'link-btn';
    b.dataset.foAction = 'task-done';
    b.textContent = `Tandai “${t.t}” selesai`;
    el.append(' ', b);
  }
}

// ---------- Dial input (drag + keyboard) ----------
function angleMinutes(e) {
  const r = $('fo-dial').getBoundingClientRect();
  const x = e.clientX - (r.left + r.width / 2);
  const y = e.clientY - (r.top + r.height / 2);
  let a = Math.atan2(x, -y); // 0 at 12 o'clock, clockwise
  if (a < 0) a += Math.PI * 2;
  return (a / (Math.PI * 2)) * 60;
}

function setupDial() {
  const dial = $('fo-dial');
  const knob = $('fo-knob');
  let dragging = false;
  let raw = 0;  // minutes the pointer has wound to, across turns
  let last = 0; // pointer angle in minutes (0-60) at the previous event
  /** Shortest way round from one angle to another, in minutes (-30 to 30). */
  const turn = (from, to) => ((to - from + 90) % 60) - 30;
  dial.addEventListener('pointerdown', (e) => {
    if (!adjustable() || e.button !== 0) return;
    const r = dial.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
    const onKnob = knob.contains(e.target);
    if (dist < 0.45 && !onKnob) return; // the centre is for reading, not dragging
    const cur = st.mins[st.mode];
    last = angleMinutes(e);
    // Grabbing the knob keeps the value; pressing the ring jumps there within the current hour.
    raw = onKnob ? cur : Math.floor((cur - 1) / 60) * 60 + (last < 0.5 ? 60 : last);
    dragging = true;
    dial.setPointerCapture(e.pointerId);
    dial.classList.add('is-drag');
    knob.focus({ preventScroll: true });
    setMinutes(raw);
    e.preventDefault();
  });
  const move = (e) => {
    if (!dragging) return;
    const m = MODES[st.mode];
    const a = angleMinutes(e);
    raw = clamp(raw + turn(last, a), m.min - 25, m.max + 25); // a little slack past both ends
    last = a;
    setMinutes(raw);
  };
  dial.addEventListener('pointermove', move);
  const end = () => { dragging = false; dial.classList.remove('is-drag'); };
  dial.addEventListener('pointerup', end);
  dial.addEventListener('pointercancel', end);

  knob.addEventListener('keydown', (e) => {
    const m = MODES[st.mode];
    const cur = st.mins[st.mode];
    const step = e.shiftKey ? 5 : 1;
    const next = {
      ArrowUp: cur + step, ArrowRight: cur + step, ArrowDown: cur - step, ArrowLeft: cur - step,
      PageUp: cur + 15, PageDown: cur - 15, Home: m.min, End: m.max,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    if (!adjustable()) { setStatus('Jeda lalu tekan Ulang untuk mengubah durasi.'); return; }
    setMinutes(next);
  });
}

// ---------- Init ----------
export function initFocus(h) {
  hooks = { ...hooks, ...h };
  build();
  setupDial();

  $('fokus').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fo-mode], [data-fo-min], [data-fo-action], #fo-toggle, #fo-reset, #fo-skip, #fo-notify');
    if (!b) return;
    if (b.dataset.foMode) leave(b.dataset.foMode, b);
    else if (b.dataset.foMin) setMinutes(Number(b.dataset.foMin));
    else if (b.id === 'fo-toggle') (st.run ? pause : start)();
    else if (b.id === 'fo-reset') leave(st.mode, b);
    else if (b.id === 'fo-skip') skip();
    else if (b.id === 'fo-notify') Notification.requestPermission().then(renderNotifyBtn);
    else if (b.dataset.foAction?.startsWith('confirm-')) answerConfirm(b.dataset.foAction.slice(8));
    else if (b.dataset.foAction === 'task-done' && st.task) {
      hooks.onTaskDone(st.task);
      setStatus('Tugas ditandai selesai. Pilih tugas berikutnya di atas.');
      st.task = '';
      save();
      renderTasks();
    }
  });
  $('fo-confirm').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); answerConfirm('cancel'); } });
  $('fo-min').addEventListener('change', (e) => {
    const m = MODES[st.mode];
    const v = Number(e.target.value);
    const ok = e.target.value !== '' && Number.isFinite(v) && v >= m.min && v <= m.max;
    setStatus(ok ? '' : `Isi antara ${m.min} dan ${m.max} menit.`);
    if (e.target.value !== '' && Number.isFinite(v)) setMinutes(v);
    e.target.value = st.mins[st.mode];
  });
  $('fo-task').addEventListener('change', (e) => { st.task = e.target.value; save(); });
  $('fo-auto').addEventListener('change', (e) => { st.auto = e.target.checked; save(); });
  $('fo-sound').addEventListener('change', (e) => { st.sound = e.target.checked; save(); if (st.sound) unlockAudio(); });

  // The floating pill shows the countdown while the dial is off screen.
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; renderPill(); }, { threshold: 0.15 }).observe($('fo-dial'));

  // Catch up after the page was closed, the device slept, or another tab changed the timer.
  addEventListener('storage', (e) => { if (e.key === KEY) { st = load(); if (!atRisk()) closeConfirm(); render(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  subscribe(() => { renderTasks(); renderToday(); });

  if (st.run && remaining() <= 0) finish({ natural: true, late: true });
  else render();
}
