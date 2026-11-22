// Init + event listeners.
import { M, MASCOT_SRC, TICKER, HABIT_MAX, HABIT_AI_MIN } from './data.js';
import {
  store, subscribe, loadLocal, loadRepoFile, update, editHere,
  exportJSON, importFile, clearAll, watchOtherTabs,
} from './store.js';
import { renderAll, ui, updateLinkHint, onRender } from './render.js';
import { initNetwork } from './network.js';
import { initHero } from './hero.js';
import { initMotion, scrollToEl, refresh, stopScroll, startScroll } from './motion.js';
import { coachPrompt, descPrompt, copyText } from './prompts.js';
import { startSync, onSync, connect, disconnect, syncNow, signIn, resetPassword, accountsEnabled } from './sync.js';
import { preload as preloadAccount } from './account.js';
import { initFocus } from './focus.js';
import { activeMonth, monthProgress, todayStr, habitActive, habitsToday } from './util.js';

const $ = (id) => document.getElementById(id);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let hero = null;

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
  if (store.data.done[id]) hero?.burst(id);
  const after = month && monthProgress(store.data, month);
  if (month && after.done === after.total && before.done < before.total) {
    toast(`✦ ${month.name} beres — satu fase selesai`);
  }
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

// ---------- Habits ----------
function setHabitDay(d, id, day, on) {
  const h = d.habits.find((x) => x.id === id);
  if (!h || !habitActive(h, day)) return;
  const has = h.days.includes(day);
  if (on && !has) { h.days.push(day); h.days.sort(); }
  if (!on && has) h.days = h.days.filter((x) => x !== day);
}

function toggleHabit(id, day) {
  if (store.readOnly || day > todayStr()) return;
  const h = store.data.habits.find((x) => x.id === id);
  if (!h) return;
  const before = habitsToday(store.data);
  update((d) => setHabitDay(d, id, day, !h.days.includes(day)));
  const after = habitsToday(store.data);
  if (day === todayStr() && after.total && after.done === after.total && before.done < before.total) {
    toast('✦ Semua kebiasaan hari ini beres');
  }
}

let armTimer = 0;
function deleteHabit(btn) {
  const id = btn.dataset.h;
  const h = store.data.habits.find((x) => x.id === id);
  if (!h) return;
  clearTimeout(armTimer);
  if (ui.hbArmed !== id) {
    // First click arms the button (render shows "Hapus?"); a second click within 4s deletes.
    ui.hbArmed = id;
    renderAll();
    armTimer = setTimeout(() => { ui.hbArmed = ''; renderAll(); }, 4000);
    return;
  }
  ui.hbArmed = '';
  update((d) => { d.habits = d.habits.filter((x) => x.id !== id); });
  toast(`Kebiasaan dihapus: ${h.name}`);
  $('hb-new').focus({ preventScroll: true });
  refresh();
}

/** Arrow keys move the roving focus around the 7-day habit grid. */
function habitKeys(e) {
  const cell = e.target.closest('.hb-cell');
  if (!cell) return;
  const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  const all = [...$('hb-rows').querySelectorAll('.hb-cell:not(:disabled)')];
  let next = null;
  if (step) {
    let r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    for (let i = 0; i < 8 && !next; i++) {
      r += step[0]; c += step[1];
      if (c < 0 || c > 6 || r < 0) break;
      next = all.find((b) => Number(b.dataset.r) === r && Number(b.dataset.c) === c);
      if (!next && !all.some((b) => Number(b.dataset.r) === r)) break;
    }
  } else if (e.key === 'Home' || e.key === 'End') {
    const row = all.filter((b) => b.dataset.r === cell.dataset.r);
    next = e.key === 'Home' ? row[0] : row[row.length - 1];
  } else return;
  e.preventDefault();
  if (!next) return;
  cell.tabIndex = -1;
  next.tabIndex = 0;
  ui.hbFocus = next.dataset.fkey;
  next.focus();
}

function openMonth(id) {
  ui.month = id;
  renderAll();
  scrollToEl($('roadmap'));
  const first = document.querySelector('#tasks .cb:not(:checked):not(:disabled)') ?? $(`tab-${ui.month}`);
  first?.focus({ preventScroll: true });
}

function selectMonth(id, focus = false) {
  ui.month = id;
  renderAll();
  refresh();
  if (focus) $(`tab-${id}`)?.focus();
}

// ---------- Count-up (once, after the hero entrance) ----------
function countUp() {
  if (reduced()) return;
  const els = [...document.querySelectorAll('#stats [data-count], #gauge [data-count]')];
  const start = performance.now();
  const dur = 1200;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const e = 1 - (1 - p) ** 4;
    for (const el of els) {
      const v = Number(el.dataset.count);
      const dec = Number(el.dataset.dec) || 0;
      el.textContent = dec ? (Math.round(v * e * 10) / 10).toFixed(dec).replace(/\.0$/, '') : String(Math.round(v * e));
    }
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- Static bits ----------
function setupMascots() {
  document.querySelectorAll('img[data-mascot]').forEach((img) => { img.src = MASCOT_SRC; });
}

function setupTicker() {
  const line = TICKER.map((t) => `${t}<b>✦</b>`).join('');
  $('ticker').innerHTML = `<span>${line}</span><span>${line}</span>`;
}

function setupNav() {
  const menu = $('menu');
  const opener = $('menu-open');
  opener.addEventListener('click', () => { menu.showModal(); stopScroll(); opener.setAttribute('aria-expanded', 'true'); });
  $('menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => { startScroll(); opener.setAttribute('aria-expanded', 'false'); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.close(); });
}

/**
 * Add a study session to the log. Once the day's total reaches 30 minutes the
 * "Belajar AI" habit is ticked for that day (so two short pomodoros count too).
 * Returns false in view mode, else {tick}.
 */
function logSession(d, m, n) {
  if (store.readOnly) return false;
  const ai = store.data.habits.find((h) => h.id === 'h-ai');
  const before = store.data.log.reduce((s, e) => (e.d === d ? s + e.m : s), 0);
  const tick = !!ai && before + m >= HABIT_AI_MIN && habitActive(ai, d) && !ai.days.includes(d);
  update((data) => {
    data.log.push({ d, m: Math.round(m), n });
    if (tick) setHabitDay(data, 'h-ai', d, true);
  });
  return { tick };
}

function setupLogForm() {
  const date = $('log-date');
  date.value = todayStr();
  date.max = todayStr();
}

// ---------- Events ----------
function setupEvents() {
  // In-page links use the smooth scroller and move focus to the target.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.dataset.action || e.defaultPrevented) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    scrollToEl(target);
    history.replaceState(null, '', a.getAttribute('href'));
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;

    switch (a) {
      case 'month': selectMonth(el.dataset.month); break;
      case 'open-month': openMonth(el.dataset.month); break;
      case 'del-task': deleteTask(el.dataset.id); break;
      case 'habit': ui.hbFocus = el.dataset.fkey; ui.hbPop = el.dataset.fkey; toggleHabit(el.dataset.h, el.dataset.d); break;
      case 'del-habit': deleteHabit(el); break;
      case 'del-log': {
        const idx = Number(el.dataset.idx);
        update((d) => { d.log.splice(idx, 1); });
        ($('log-list').querySelector('[data-action="del-log"]') ?? $('log-note')).focus({ preventScroll: true });
        toast('Log dihapus');
        break;
      }
      case 'goto-month': e.preventDefault(); openMonth(activeMonth().id); break;
      case 'goto-coach': {
        e.preventDefault();
        scrollToEl($('coach'), { offset: -120 });
        const ok = await copyText(coachPrompt(store.data), { status: $('coach-status'), fallback: $('coach-fallback') });
        if (ok) { $('coach-copy').focus({ preventScroll: true }); toast('✦ Prompt AI coach tersalin'); }
        break;
      }
      case 'copy-coach': {
        const ok = await copyText(coachPrompt(store.data), { status: $('coach-status'), fallback: $('coach-fallback') });
        if (ok) toast('✦ Prompt AI coach tersalin');
        break;
      }
      case 'copy-desc': {
        const pid = el.dataset.pid;
        const ok = await copyText(descPrompt(store.data, pid), { status: $(`pf-${pid}-status-msg`), fallback: $(`pf-${pid}-fallback`) });
        if (ok) toast('✦ Prompt deskripsi tersalin');
        break;
      }
      case 'export':
        exportJSON();
        setDataStatus('progress.json diunduh. Simpan di root repo kalau ingin tampil di mode lihat.');
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
      case 'install': install(); break;
      case 'sync-now': syncNow(); break;
      case 'sync-off': {
        const wasAccount = connectedKind === 'account';
        await disconnect();
        syncMsg(wasAccount
          ? 'Kamu sudah keluar. Progres tetap ada di browser ini dan di akunmu. Kalau ini bukan perangkatmu, hapus juga datanya lewat “Hapus semua data”.'
          : 'Sinkron diputus di perangkat ini. Data tetap ada di sini dan di gist.');
        (accountsEnabled ? $('acct-email') : $('sync-token')).focus();
        break;
      }
      case 'acct-google': accountSignIn('google', el); break;
      case 'acct-reset': {
        const email = $('acct-email').value.trim();
        try {
          await resetPassword(email);
          syncMsg(`Link untuk membuat kata sandi baru dikirim ke ${email}. Cek juga folder spam.`);
        } catch (err) {
          syncMsg(err.message, true);
          $('acct-email').focus();
        }
        break;
      }
      case 'edit-here':
        editHere();
        toast('Mode edit — data disalin ke browser ini');
        $('main').focus({ preventScroll: true });
        break;
      default: break;
    }
  });

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

  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('new-task');
    if (addTask(input.value)) { input.value = ''; toast('Tugas ditambahkan'); refresh(); } else input.focus();
  });

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
    const { tick } = logSession(d, m, n);
    const ai = store.data.habits.find((h) => h.id === 'h-ai');
    status.classList.remove('is-error');
    status.textContent = `Tercatat: ${Math.round(m)} menit.${tick ? ` Kebiasaan “${ai.name}” ikut dicentang.` : ''}`;
    $('log-note').value = '';
    toast(`+${Math.round(m)} menit tercatat${tick ? ' · kebiasaan ✓' : ''}`);
    refresh();
  });

  $('hb-rows').addEventListener('keydown', habitKeys);

  $('hb-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('hb-new');
    const name = input.value.trim().slice(0, 60);
    const status = $('hb-status');
    status.classList.add('is-error');
    if (!name) { status.textContent = 'Tulis nama kebiasaannya dulu.'; input.focus(); return; }
    if (store.data.habits.length >= HABIT_MAX) { status.textContent = `Maksimal ${HABIT_MAX} kebiasaan. Hapus satu dulu.`; return; }
    if (store.data.habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) { status.textContent = 'Kebiasaan itu sudah ada.'; input.focus(); return; }
    const goal = Math.min(7, Math.max(1, Number($('hb-goal').value) || 7));
    const id = `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    update((d) => { d.habits.push({ id, name, goal, end: '', days: [] }); });
    status.classList.remove('is-error');
    status.textContent = `Ditambahkan: ${name}.`;
    input.value = '';
    toast('Kebiasaan ditambahkan');
    refresh();
  });

  $('projects').addEventListener('input', (e) => {
    const f = e.target.closest('[data-pfield]');
    if (!f) return;
    const pid = f.closest('form').dataset.pid;
    update((d) => { d.projects[pid][f.dataset.pfield] = f.value; }); // maxlength caps input; norm() caps on load
    updateLinkHint(store.data, pid);
  });
  $('projects').addEventListener('toggle', refresh, true);

  $('import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await importFile(file);
      ui.month = activeMonth().id;
      setupLogForm();
      setDataStatus(`Impor berhasil: ${Object.keys(data.done).length} tugas selesai, ${data.log.length} log, ${data.custom.length} tugas sendiri, ${data.habits.length} kebiasaan.`);
      refresh();
    } catch (err) {
      setDataStatus(`Impor gagal: ${err.message}`, true);
    }
  });
}

// ---------- Account + sync between devices ----------
let connectedKind = '';
/** auto: the message only describes the sync state, and is cleared when that state passes. */
function syncMsg(msg, isError = false, auto = false) {
  const el = $('sync-status');
  el.classList.toggle('is-error', isError);
  el.textContent = msg;
  el.dataset.auto = auto ? '1' : '';
}

function renderSync(s) {
  const card = $('akun');
  connectedKind = s.state === 'off' ? '' : s.kind;
  card.dataset.state = s.state;
  const isAccount = s.kind === 'account';
  // On error the forms stay, so you can sign in again or paste a new token.
  $('sync-off').hidden = s.state !== 'off' && s.state !== 'error';
  $('sync-on').hidden = s.state === 'off';
  const hm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`; };
  $('sync-state-text').textContent = {
    off: accountsEnabled ? 'Belum masuk' : 'Belum terhubung',
    idle: s.last ? `Tersinkron · ${hm(s.last)}` : 'Tersinkron',
    busy: s.msg || 'Menyinkronkan…',
    offline: 'Offline · menunggu internet',
    error: 'Sinkron bermasalah',
  }[s.state];
  const who = $('sync-who');
  who.textContent = '';
  if (isAccount) who.append('Masuk sebagai ', Object.assign(document.createElement('strong'), { textContent: s.email || 'akun Google' }), '.');
  else who.textContent = 'Tersambung ke GitHub Gist.';
  $('sync-off-btn').textContent = isAccount ? 'Keluar dari akun' : 'Putuskan di perangkat ini';
  if (s.state === 'error' || s.state === 'offline') syncMsg(s.msg, s.state === 'error', true);
  else if ($('sync-status').dataset.auto && s.state === 'idle') syncMsg('');
  $('confirm-sync').hidden = s.state === 'off';

  const nav = $('nav-acct');
  nav.classList.toggle('is-on', isAccount && s.state !== 'off');
  $('nav-acct-text').textContent = isAccount && s.state !== 'off' ? 'Akun' : accountsEnabled ? 'Masuk' : 'Akun';
}

let signingIn = false;
async function accountSignIn(method, btn) {
  if (signingIn) return;
  signingIn = true;
  const email = $('acct-email').value.trim();
  const pass = $('acct-pass').value;
  btn?.setAttribute('aria-busy', 'true');
  syncMsg(method === 'google' ? 'Membuka jendela login Google…' : 'Masuk…');
  try {
    const user = await signIn(method, email, pass);
    $('acct-pass').value = '';
    syncMsg(method === 'up'
      ? `Akun dibuat untuk ${user.email}. Progres di perangkat ini sudah tersimpan di akunmu. Masuk dengan akun yang sama di perangkat lain.`
      : `Halo${user.email ? `, ${user.email}` : ''}. Progres di perangkat ini dan di akunmu sudah digabung.`);
    toast('✦ Masuk — progres tersimpan di akun');
    refresh();
  } catch (err) {
    syncMsg(err.message, true);
    if (method !== 'google') (err.message.includes('sandi') ? $('acct-pass') : $('acct-email')).focus();
  } finally {
    signingIn = false;
    btn?.removeAttribute('aria-busy');
  }
}

function setupSync() {
  onSync(renderSync);
  if (accountsEnabled) {
    $('acct-login').hidden = false;
    // Fetch the login code before the click, so the Google popup isn't blocked.
    const card = $('akun');
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { preloadAccount(); io.disconnect(); } }, { rootMargin: '400px' }).observe(card);
    $('acct-form').addEventListener('submit', (e) => {
      e.preventDefault();
      accountSignIn(e.submitter?.value === 'up' ? 'up' : 'in', e.submitter);
    });
  } else {
    $('acct-unset').hidden = false;
    $('gist-alt').open = true;
  }
  $('sync-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('sync-token');
    try {
      const { created } = await connect(input.value);
      input.value = '';
      syncMsg(created
        ? 'Terhubung. Gist baru dibuat dari progres di perangkat ini. Sekarang tempel token yang sama di perangkat lain.'
        : 'Terhubung ke gist yang sudah ada. Progres dari perangkat lain sudah digabung ke sini.');
      toast('✦ Sinkron aktif');
      refresh();
    } catch (err) {
      syncMsg(err.message === 'offline' ? 'Tidak ada internet. Coba lagi saat online.' : err.message, true);
      input.focus();
    }
  });
}

// ---------- Install (PWA) ----------
let installEvent = null;
function setupInstall() {
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((err) => console.warn('[tracker] service worker:', err)));
  }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) { $('install').hidden = false; $('install-ios').hidden = false; }
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    $('install').hidden = false;
    $('install-btn').hidden = false;
  });
  addEventListener('appinstalled', () => {
    installEvent = null;
    $('install').hidden = true;
    toast('✦ Terpasang — buka dari layar utama');
  });
}

async function install() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('install-btn').hidden = true;
}

function setDataStatus(msg, isError = false) {
  const el = $('data-status');
  el.classList.toggle('is-error', isError);
  el.textContent = msg;
}

// ---------- Init ----------
async function init() {
  setupMascots();
  setupTicker();
  setupNav();
  setupLogForm();
  setupInstall();
  setupSync();
  initNetwork($('nn'), { onToggle: toggle });
  hero = initHero($('hero-canvas'), { reduced: reduced() });
  onRender((data) => hero.update(data, activeMonth().id));
  subscribe(renderAll);
  subscribe((info) => { if (info.pulled) toast('↓ Progres dari perangkat lain dimuat'); });

  if (!loadLocal()) await loadRepoFile();
  renderAll({ reset: true });
  setupEvents();
  initFocus({ onLog: logSession, onTaskDone: (id) => { if (!store.data.done[id]) toggle(id); }, toast });
  watchOtherTabs();
  startSync();

  await initMotion();
  countUp();
}

init();
