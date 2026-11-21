// Init + event listeners.
import { M, MASCOT_SRC, TICKER } from './data.js';
import {
  store, subscribe, loadLocal, loadRepoFile, update, editHere,
  exportJSON, importFile, clearAll, watchOtherTabs,
} from './store.js';
import { renderAll, ui, updateLinkHint } from './render.js';
import { initNetwork } from './network.js';
import { coachPrompt, descPrompt, copyText } from './prompts.js';
import { activeMonth, monthProgress, todayStr } from './util.js';

const $ = (id) => document.getElementById(id);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Toast ----------
let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}

// ---------- Actions ----------
function monthOf(id) {
  return M.find((m) => m.tasks.some((t) => t.id === id)) ?? M.find((m) => store.data.custom.some((c) => c.id === id && c.m === m.id));
}

function toggle(id) {
  if (store.readOnly) return;
  const month = monthOf(id);
  const before = month && monthProgress(store.data, month);
  ui.pop = id;
  update((d) => { if (d.done[id]) delete d.done[id]; else d.done[id] = true; });
  const after = month && monthProgress(store.data, month);
  if (month && after.done === after.total && before.done < before.total) celebrate(month);
}

function celebrate(month) {
  toast(`( ${month.short} BERES ) + SATU BULAN SELESAI`);
  if (reduced()) return;
  const cap = $('capsule');
  cap.classList.remove('party');
  void cap.offsetWidth; // restart animation
  cap.classList.add('party');
}

function addTask(text) {
  const t = text.trim();
  if (!t) return false;
  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  update((d) => { d.custom.push({ id, m: ui.month, text: t.slice(0, 200) }); });
  return true;
}

function deleteTask(id) {
  update((d) => {
    d.custom = d.custom.filter((c) => c.id !== id);
    delete d.done[id];
  });
  $('new-task').focus();
}

function gotoMonth() {
  ui.month = activeMonth().id;
  renderAll();
  $('roadmap').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const first = document.querySelector('#tasks .cb:not(:checked):not(:disabled)') ?? $(`tab-${ui.month}`);
  first?.focus({ preventScroll: true });
}

function selectMonth(id, focus = false) {
  ui.month = id;
  renderAll();
  if (focus) $(`tab-${id}`)?.focus();
}

// ---------- Fit text: giant words fill their container without wrapping ----------
function fitText() {
  document.querySelectorAll('.fit').forEach((el) => {
    const inner = el.querySelector('.fit-inner');
    const max = Number(el.dataset.max) || 2000;
    el.style.fontSize = '100px';
    const w = inner.getBoundingClientRect().width;
    const avail = el.clientWidth;
    if (!w || !avail) return;
    const fs = Math.min(max, (100 * avail) / w) * 0.995;
    el.style.fontSize = `${fs}px`;
    if (el.id === 'hero-title') $('top').style.setProperty('--hs', `${fs}px`);
  });
}

// ---------- Count-up (once, on load) ----------
function countUp() {
  if (reduced()) return;
  const els = [...document.querySelectorAll('#top [data-count], #flower [data-count]')];
  const start = performance.now();
  const dur = 750;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const e = 1 - (1 - p) ** 3;
    for (const el of els) {
      const v = Number(el.dataset.count);
      const dec = Number(el.dataset.dec) || 0;
      const cur = v * e;
      el.textContent = dec ? (Math.round(cur * 10) / 10).toFixed(dec).replace(/\.0$/, '') : String(Math.round(cur));
    }
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Static bits ----------
function setupMascots() {
  document.querySelectorAll('img[data-mascot]').forEach((img) => { img.src = MASCOT_SRC; });
}

function setupMarquee() {
  const line = TICKER.map((t) => `( ${t} ) <b>+</b> `).join('');
  $('marquee').innerHTML = `<span>${line}</span><span>${line}</span>`;
}

function setupNav() {
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menu = $('menu');
  const opener = $('menu-open');
  opener.addEventListener('click', () => { menu.showModal(); opener.setAttribute('aria-expanded', 'true'); });
  $('menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => opener.setAttribute('aria-expanded', 'false'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.close(); });
}

function setupLogForm() {
  const date = $('log-date');
  date.value = todayStr();
  date.max = todayStr();
}

// ---------- Events ----------
function setupEvents() {
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;

    switch (a) {
      case 'month': selectMonth(el.dataset.month); break;
      case 'del-task': deleteTask(el.dataset.id); break;
      case 'del-log': {
        const idx = Number(el.dataset.idx);
        update((d) => { d.log.splice(idx, 1); });
        ($('log-list').querySelector('[data-action="del-log"]') ?? $('log-note')).focus({ preventScroll: true });
        toast('( LOG DIHAPUS )');
        break;
      }
      case 'goto-month': e.preventDefault(); gotoMonth(); break;
      case 'goto-coach': {
        e.preventDefault();
        $('coach').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
        const ok = await copyText(coachPrompt(store.data), { status: $('coach-status'), fallback: $('coach-fallback') });
        if (ok) { $('coach-copy').focus({ preventScroll: true }); toast('( PROMPT AI COACH TERSALIN )'); }
        break;
      }
      case 'copy-coach': {
        const ok = await copyText(coachPrompt(store.data), { status: $('coach-status'), fallback: $('coach-fallback') });
        if (ok) toast('( PROMPT AI COACH TERSALIN )');
        break;
      }
      case 'copy-desc': {
        const pid = el.dataset.pid;
        const ok = await copyText(descPrompt(store.data, pid), { status: $(`pf-${pid}-status-msg`), fallback: $(`pf-${pid}-fallback`) });
        if (ok) toast('( PROMPT DESKRIPSI TERSALIN )');
        break;
      }
      case 'export':
        exportJSON();
        setDataStatus('progress.json diunduh. Simpan di folder repo kalau ingin tampil di mode lihat.');
        break;
      case 'import': $('import-file').click(); break;
      case 'ask-clear':
        $('confirm').hidden = false;
        $('confirm-cancel').focus();
        break;
      case 'cancel-clear':
        $('confirm').hidden = true;
        $('ask-clear').focus();
        break;
      case 'do-clear':
        clearAll();
        ui.month = activeMonth().id;
        $('confirm').hidden = true;
        setupLogForm();
        setDataStatus('Semua data di browser ini sudah dihapus.');
        $('ask-clear').focus();
        break;
      case 'edit-here':
        editHere();
        toast('( MODE EDIT ) + DATA DISALIN KE BROWSER INI');
        $('main').focus({ preventScroll: true });
        break;
      default: break;
    }
  });

  // Checkbox toggles
  document.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-action="toggle"]');
    if (cb) toggle(cb.dataset.id);
  });

  // Month tabs: arrow keys move + activate
  $('chips').addEventListener('keydown', (e) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = M.findIndex((m) => m.id === ui.month);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? M.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + M.length) % M.length;
    selectMonth(M[n].id, true);
    $(`tab-${M[n].id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  // Add custom task
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('new-task');
    if (addTask(input.value)) {
      input.value = '';
      toast('( TUGAS DITAMBAHKAN )');
    } else {
      input.focus();
    }
  });

  // Learning log
  $('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = $('log-date').value;
    const m = Number($('log-min').value);
    const n = $('log-note').value.trim().slice(0, 200);
    const status = $('log-status');
    status.classList.add('is-error');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { status.textContent = 'Isi tanggal dulu.'; $('log-date').focus(); return; }
    if (d > todayStr()) { status.textContent = 'Tanggal tidak boleh di masa depan.'; $('log-date').focus(); return; }
    if (!Number.isFinite(m) || m < 1 || m > 1440) { status.textContent = 'Menit harus antara 1 dan 1440.'; $('log-min').focus(); return; }
    update((data) => { data.log.push({ d, m: Math.round(m), n }); });
    status.classList.remove('is-error');
    status.textContent = `Tercatat: ${Math.round(m)} menit.`;
    $('log-note').value = '';
    toast(`( +${Math.round(m)} MENIT )`);
  });

  // Project fields save as you type
  $('projects').addEventListener('input', (e) => {
    const f = e.target.closest('[data-pfield]');
    if (!f) return;
    const pid = f.closest('form').dataset.pid;
    update((d) => { d.projects[pid][f.dataset.pfield] = f.value; }); // maxlength caps input; norm() caps on load
    updateLinkHint(store.data, pid);
  });

  // Import file
  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await importFile(file);
      ui.month = activeMonth().id;
      setupLogForm();
      setDataStatus(`Impor berhasil: ${Object.keys(data.done).length} tugas selesai, ${data.log.length} log, ${data.custom.length} tugas sendiri.`);
    } catch (err) {
      setDataStatus(`Impor gagal: ${err.message}`, true);
    }
  });
}

function setDataStatus(msg, isError = false) {
  const el = $('data-status');
  el.classList.toggle('is-error', isError);
  el.textContent = msg;
}

// ---------- Init ----------
async function init() {
  setupMascots();
  setupMarquee();
  setupNav();
  setupLogForm();
  initNetwork($('nn'), { onToggle: toggle });
  subscribe(renderAll);

  if (!loadLocal()) await loadRepoFile();
  renderAll({ reset: true });
  countUp();

  fitText();
  document.fonts?.ready.then(fitText);
  let raf = 0;
  addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitText); });

  setupEvents();
  watchOtherTabs();
  document.documentElement.classList.add('is-ready');
}

init();
