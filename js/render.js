// Rendering. Every piece of user text goes through esc().
import { M, P, ST, WEEK_TARGET } from './data.js';
import { store } from './store.js';
import { renderNetwork } from './network.js';
import {
  esc, safeUrl, activeMonth, monthProgress, totals, thisWeekMinutes, weeks, streak,
  projectsOnline, nextDeadline, overdue, daysUntil, fmtHours, fmtShort, fmtLong, todayStr, ymd,
} from './util.js';

export const ui = {
  month: activeMonth().id, // month shown in the checklist
  pop: null,               // node id that just toggled (animation)
};

const $ = (id) => document.getElementById(id);

/** A number that count-up can animate once on load. */
const num = (value, dec = 0) =>
  `<span class="tnum" data-count="${value}" data-dec="${dec}">${dec ? value.toFixed(dec).replace(/\.0$/, '') : value}</span>`;

/** Re-render a container and put focus back on the same logical control. */
function keepFocus(container, fn) {
  const a = document.activeElement;
  const key = container.contains(a) ? a?.dataset?.fkey : null;
  fn();
  if (key) container.querySelector(`[data-fkey="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}

// ---------- Hero ----------
function renderHero(data) {
  const month = activeMonth();
  const t = totals(data);
  const hours = thisWeekMinutes(data) / 60;
  $('cap-phase').textContent = `( ${month.phase} )`;
  $('cap-month').textContent = month.short;
  $('cap-pct').innerHTML = num(t.pct);
  $('cap-sr').textContent = `Bulan aktif ${month.name}, ${month.phase}. Progres total ${t.pct} persen.`;
  $('hero-stats').innerHTML =
    `( ${num(t.done)} DARI ${t.total} TUGAS + ${num(Math.round(hours * 10) / 10, 1)} JAM MINGGU INI + ${projectsOnline(data)}/${P.length} PROYEK ONLINE )`;
}

// ---------- Bulan ini ----------
function renderNow(data) {
  const month = activeMonth();
  const mp = monthProgress(data, month);
  $('now-stage').textContent = month.stage;
  $('now-count').textContent = `${mp.done}/${mp.total}`;
  $('now-count-sr').textContent = `${mp.done} dari ${mp.total} tugas ${month.name} selesai.`;

  const next = nextDeadline(data);
  const late = overdue(data).length;
  const parts = [];
  if (mp.total - mp.done > 0) parts.push(`${mp.total - mp.done} TUGAS TERSISA`);
  else parts.push('BULAN INI BERES');
  if (next) {
    const dd = daysUntil(next.d);
    parts.push(`TENGGAT BERIKUTNYA: ${next.t} · ${dd === 0 ? 'HARI INI' : dd === 1 ? 'BESOK' : `${dd} HARI LAGI`}`);
  }
  if (late) parts.push(`<b>${late} TERLAMBAT</b>`);
  // Parts are built from roadmap text (not user text) but escape anyway; <b> marks emphasis.
  $('now-meta').innerHTML = parts
    .map((p) => `( ${p.startsWith('<b>') ? p : esc(p)} )`)
    .join(' + ');

  renderNetwork(data, { activeId: month.id, readOnly: store.readOnly, pop: ui.pop });
}

// ---------- Checklist ----------
function renderChips(data) {
  const wrap = $('chips');
  const nowId = activeMonth().id;
  keepFocus(wrap, () => {
    wrap.innerHTML = M.map((m) => {
      const p = monthProgress(data, m);
      const sel = m.id === ui.month;
      const isNow = m.id === nowId;
      return `<button class="chip${p.done === p.total && p.total ? ' is-done' : ''}" type="button" role="tab"
        id="tab-${m.id}" data-fkey="tab-${m.id}" data-action="month" data-month="${m.id}"
        aria-selected="${sel}" aria-controls="cl-panel" tabindex="${sel ? 0 : -1}">${isNow ? '<span class="dot" aria-hidden="true"></span>' : ''}( ${m.short} ${p.done}/${p.total} )${isNow ? '<span class="sr-only"> (bulan aktif)</span>' : ''}</button>`;
    }).join('');
  });
}

function renderChecklist(data) {
  const month = M.find((m) => m.id === ui.month) ?? M[0];
  const mp = monthProgress(data, month);
  const today = todayStr();
  const ro = store.readOnly;
  const pct = mp.total ? Math.round((mp.done / mp.total) * 100) : 0;

  const panel = $('cl-panel');
  panel.setAttribute('aria-labelledby', `tab-${month.id}`);

  $('cl-title-month').textContent = `${month.name} · ${month.stage}`;
  $('cl-phase').textContent = `( ${month.phase} · ${mp.done}/${mp.total} )`;
  $('cl-bar').style.setProperty('--w', `${pct}%`);
  $('cl-bar').parentElement.setAttribute('aria-label', `${pct}% tugas bulan ini selesai`);

  const list = $('tasks');
  keepFocus(list, () => {
    list.innerHTML = mp.tasks.map((t) => {
      const done = !!data.done[t.id];
      const late = !done && t.d && t.d < today;
      const date = t.d
        ? `<span class="task-date label${late ? ' is-late' : ''}">${late ? 'TERLAMBAT · ' : ''}${fmtShort(t.d)}</span>`
        : '<span class="task-date label">( SENDIRI )</span>';
      const del = t.custom && !ro
        ? `<button class="icon-btn task-del" type="button" data-action="del-task" data-id="${esc(t.id)}" data-fkey="del-${esc(t.id)}" aria-label="Hapus tugas: ${esc(t.t)}">×</button>`
        : '';
      return `<li class="task${done ? ' is-done' : ''}" data-id="${esc(t.id)}">
        <label class="task-main">
          <input class="cb" type="checkbox" data-action="toggle" data-id="${esc(t.id)}" data-fkey="cb-${esc(t.id)}" ${done ? 'checked' : ''} ${ro ? 'disabled' : ''}>
          <span class="task-body"><span class="task-text">${esc(t.t)}</span>${date}</span>
        </label>
        ${del}
      </li>`;
    }).join('') || '<li class="task-empty muted">Belum ada tugas.</li>';
  });
}

// ---------- Portfolio ----------
function projectView(data, p, i) {
  const s = data.projects[p.id];
  const gh = safeUrl(s.github);
  const demo = safeUrl(s.demo);
  const links = [
    gh && `<a class="pf-link" href="${esc(gh)}" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span><span class="sr-only"> (tab baru)</span></a>`,
    demo && `<a class="pf-link" href="${esc(demo)}" target="_blank" rel="noopener noreferrer">Demo <span aria-hidden="true">↗</span><span class="sr-only"> (tab baru)</span></a>`,
  ].filter(Boolean).join('');
  return `
    <div class="pf-top">
      <span class="pf-num display" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="status-chip" data-st="${esc(s.status)}">( ${esc(ST[s.status].toUpperCase())} )</span>
    </div>
    <h3 class="pf-title" id="pf-${p.id}-title">${esc(p.title)}</h3>
    <p class="label muted pf-stack">${esc(p.stack)}</p>
    ${s.desc.trim()
      ? `<p class="pf-desc" lang="en">${esc(s.desc)}</p>`
      : `<p class="pf-desc muted">Deskripsi menyusul. <span class="pf-idea">${esc(p.idea)}</span></p>`}
    ${links ? `<p class="pf-links">${links}</p>` : ''}`;
}

function renderProjectViews(data) {
  P.forEach((p, i) => { $(`pf-view-${p.id}`).innerHTML = projectView(data, p, i); });
}

/** Forms are built only on reset, so typing is never interrupted by re-renders. */
export function buildProjects(data) {
  $('projects').innerHTML = P.map((p, i) => {
    const s = data.projects[p.id];
    const f = (name) => `pf-${p.id}-${name}`;
    return `<article class="card pf-card" aria-labelledby="pf-${p.id}-title">
      <div class="pf-view" id="pf-view-${p.id}">${projectView(data, p, i)}</div>
      <details class="pf-edit edit-only">
        <summary class="btn btn-secondary btn-sm"><span class="when-closed">Edit</span><span class="when-open">Tutup edit</span><span class="sr-only"> ${esc(p.title)}</span></summary>
        <form class="pf-form" data-pid="${p.id}" novalidate>
          <label class="field"><span>Status</span>
            <select class="select" id="${f('status')}" data-pfield="status">
              ${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select></label>
          <label class="field"><span>Link GitHub</span>
            <input class="input" type="url" inputmode="url" id="${f('github')}" data-pfield="github" value="${esc(s.github)}" placeholder="https://github.com/…" maxlength="300" autocomplete="off"></label>
          <label class="field"><span>Link demo</span>
            <input class="input" type="url" inputmode="url" id="${f('demo')}" data-pfield="demo" value="${esc(s.demo)}" placeholder="https://…" maxlength="300" autocomplete="off"></label>
          <label class="field"><span>Catatan</span>
            <textarea class="textarea" id="${f('notes')}" data-pfield="notes" maxlength="2000" rows="3" placeholder="Apa yang dibuat, dataset, hasil, angka…">${esc(s.notes)}</textarea></label>
          <label class="field"><span>Deskripsi (English)</span>
            <textarea class="textarea" id="${f('desc')}" data-pfield="desc" maxlength="2000" rows="4" lang="en" placeholder="Short portfolio description in English">${esc(s.desc)}</textarea></label>
          <p class="pf-hint muted" id="${f('hint')}"></p>
          <button class="btn btn-sm" type="button" data-action="copy-desc" data-pid="${p.id}">Salin prompt deskripsi</button>
          <p class="status" id="${f('status-msg')}" aria-live="polite"></p>
          <div class="fallback" id="${f('fallback')}" hidden>
            <label class="field"><span>Prompt (salin manual)</span><textarea class="textarea" rows="8" readonly></textarea></label>
          </div>
        </form>
      </details>
    </article>`;
  }).join('');
  P.forEach((p) => updateLinkHint(data, p.id));
}

export function updateLinkHint(data, pid) {
  const s = data.projects[pid];
  const bad = ['github', 'demo'].filter((k) => s[k] && !safeUrl(s[k]));
  const el = $(`pf-${pid}-hint`);
  if (el) el.textContent = bad.length ? `Link ${bad.join(' dan ')} harus diawali http:// atau https:// supaya tampil.` : '';
}

// ---------- Log ----------
const PETALS = (() => {
  // Flower: a ring of circles + a centre disc = scalloped badge.
  const n = 14, R = 38, r = 13;
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s += `<circle cx="${(50 + R * Math.cos(a)).toFixed(2)}" cy="${(50 + R * Math.sin(a)).toFixed(2)}" r="${r}"/>`;
  }
  return s;
})();

function renderLog(data) {
  const ro = store.readOnly;
  const entries = data.log.map((e, idx) => ({ ...e, idx }))
    .sort((a, b) => (a.d === b.d ? b.idx - a.idx : a.d < b.d ? 1 : -1))
    .slice(0, 10);
  const list = $('log-list');
  keepFocus(list, () => {
    list.innerHTML = entries.length ? entries.map((e) => `
      <li class="log-item">
        <span class="log-date label tnum">${esc(fmtShort(e.d))} <span class="muted">${esc(e.d.slice(0, 4))}</span></span>
        <span class="log-min tnum">${e.m} mnt</span>
        <span class="log-note">${e.n ? esc(e.n) : '<span class="muted">Tanpa catatan</span>'}</span>
        ${ro ? '' : `<button class="icon-btn" type="button" data-action="del-log" data-idx="${e.idx}" data-fkey="log-${e.idx}" aria-label="Hapus log ${esc(fmtLong(e.d))}, ${e.m} menit">×</button>`}
      </li>`).join('')
      : '<li class="log-empty muted">Belum ada catatan. Catat sesi belajar pertamamu di atas.</li>';
  });

  const min = thisWeekMinutes(data);
  const hours = min / 60;
  const pct = Math.min(100, Math.round((hours / WEEK_TARGET) * 100));
  $('flower').innerHTML = `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="petals"><g class="petal-outline">${PETALS}</g><g class="petal-fill">${PETALS}</g></g>
      <circle class="flower-core" cx="50" cy="50" r="38"/>
    </svg>
    <div class="flower-body">
      <span class="label">( MINGGU INI )</span>
      <span class="flower-num display">${num(Math.round(hours * 10) / 10, 1)}/${WEEK_TARGET}<small>J</small></span>
      <span class="label">${pct}% TARGET</span>
    </div>
    <span class="sr-only">${fmtHours(min)} dari target ${WEEK_TARGET} jam minggu ini, ${pct} persen.</span>`;

  const ws = weeks(data);
  const max = Math.max(WEEK_TARGET * 1.25, ...ws.map((w) => w.hours));
  const chart = $('weeks');
  chart.style.setProperty('--target', `${(WEEK_TARGET / max) * 100}%`);
  chart.innerHTML = ws.map((w, i) => `
    <li class="wk${w.hit ? ' is-hit' : ''}${i === ws.length - 1 ? ' is-now' : ''}">
      <span class="wk-label label tnum">${fmtShort(w.start)}</span>
      <span class="wk-track" aria-hidden="true"><i style="width:${Math.max(w.minutes ? 2 : 0, (w.hours / max) * 100).toFixed(1)}%"></i></span>
      <span class="wk-val tnum">${fmtHours(w.minutes)} j</span>
      <span class="sr-only">Minggu mulai ${fmtLong(w.start)}: ${fmtHours(w.minutes)} jam${w.hit ? ', target tercapai' : ''}.</span>
    </li>`).join('');

  const total = data.log.reduce((s, e) => s + e.m, 0);
  const st = streak(data);
  $('log-extra').textContent = `( ${st} HARI BERUNTUN ) + ( TOTAL ${fmtHours(total)} JAM ) + ( ${data.log.length} SESI )`;
}

// ---------- Data + mode ----------
function renderData(data) {
  const el = $('data-updated');
  if (data.updated) {
    const d = new Date(data.updated);
    const hm = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
    el.textContent = `( TERAKHIR DISIMPAN: ${fmtLong(ymd(d)).toUpperCase()}, ${hm} )`;
  } else {
    el.textContent = '( BELUM ADA DATA TERSIMPAN )';
  }
}

function renderMode() {
  document.body.classList.toggle('is-readonly', store.readOnly);
  $('viewbar').hidden = !store.readOnly;
}

export function renderAll(info = {}) {
  const data = store.data;
  renderMode();
  if (info.reset) {
    buildProjects(data);
    if (!M.some((m) => m.id === ui.month)) ui.month = activeMonth().id;
  }
  renderHero(data);
  renderNow(data);
  renderChips(data);
  renderChecklist(data);
  renderProjectViews(data);
  renderLog(data);
  renderData(data);
  ui.pop = null;
}
