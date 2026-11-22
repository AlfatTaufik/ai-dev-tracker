// Rendering. Every piece of user text goes through esc().
import { M, P, ST, WEEK_TARGET, MONTHS_LONG } from './data.js';
import { store } from './store.js';
import { renderNetwork } from './network.js';
import {
  esc, safeUrl, activeMonth, monthProgress, totals, thisWeekMinutes, weeks, streak,
  projectsOnline, nextDeadline, overdue, daysUntil, fmtHours, fmtShort, fmtLong, todayStr, ymd, parseYmd,
} from './util.js';

export const ui = {
  month: activeMonth().id, // month shown in the checklist
  pop: null,               // node id that just toggled (animation)
};

const $ = (id) => document.getElementById(id);
const monthWord = (m) => MONTHS_LONG[parseYmd(m.start).getMonth()];

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
  const hours = Math.round((thisWeekMinutes(data) / 60) * 10) / 10;
  $('hero-phase-text').textContent = `${month.phase.replace('FASE', 'Fase')} · ${month.stage}`;
  $('st-pct').innerHTML = num(t.pct);
  $('st-done').innerHTML = num(t.done);
  $('st-total').textContent = t.total;
  $('st-hours').innerHTML = num(hours, 1);
  $('st-online').innerHTML = num(projectsOnline(data));
  $('hero-sr').textContent = `Bulan aktif ${month.name}, ${month.phase}: ${month.stage}. Progres ${t.pct} persen.`;
}

// ---------- Bulan ini (manifesto) ----------
const NUM_WORDS = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'];
const say = (n) => NUM_WORDS[n] ?? String(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function renderNow(data) {
  const month = activeMonth();
  const mp = monthProgress(data, month);
  const left = mp.total - mp.done;
  const next = nextDeadline(data);
  const late = overdue(data).length;

  // Segments: [text, emphasised?]. Built from roadmap text, escaped anyway.
  const seg = [[`${monthWord(month)}.`, true], [`${month.phase.replace('FASE', 'Fase')} — ${month.stage.toLowerCase()}.`, false]];
  if (left > 0) seg.push([cap(`${say(left)} dari ${say(mp.total)} tugas tersisa.`), false]);
  else seg.push(['Semua tugas bulan ini beres.', false]);
  if (next) {
    const dd = daysUntil(next.d);
    const when = dd === 0 ? 'hari ini' : dd === 1 ? 'besok' : `${say(dd)} hari lagi`;
    seg.push([`Tenggat berikutnya ${when}:`, false], [next.t.charAt(0).toLowerCase() + next.t.slice(1) + '.', false]);
  }
  if (late) seg.push([cap(`${say(late)} tugas terlambat.`), true]);
  seg.push(['Pelan boleh,', false], ['berhenti jangan.', true]);

  let i = 0;
  const html = seg.map(([text, em]) => {
    const words = text.split(/\s+/).map((w) => `<span class="w" style="--i:${i++}">${esc(w)}</span>`).join(' ');
    return em ? `<em>${words}</em>` : words;
  }).join(' ');
  const el = $('manifesto');
  el.style.setProperty('--n', i);
  el.innerHTML = html;
  $('now-ghost').textContent = monthWord(month);

  renderNetwork(data, { activeId: month.id, readOnly: store.readOnly, pop: ui.pop });
  const t = totals(data);
  $('nn-count').textContent = `${t.done}/${t.total}`;
}

// ---------- Phases ----------
function renderPhases(data) {
  const today = todayStr();
  const nowId = activeMonth().id;
  $('phase-track').innerHTML = M.map((m, i) => {
    const p = monthProgress(data, m);
    const complete = p.total > 0 && p.done === p.total;
    const state = m.id === nowId ? 'is-active' : complete ? 'is-done' : m.start > today ? 'is-next' : 'is-past';
    const tag = { 'is-active': '● Sekarang', 'is-done': 'Selesai', 'is-next': 'Nanti', 'is-past': 'Tertinggal' }[state];
    const shown = p.tasks.slice(0, 3);
    const more = p.tasks.length - shown.length;
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    return `<li class="phase ${state}">
      <button class="phase-btn" type="button" data-action="open-month" data-month="${m.id}" data-cursor="Buka">
        <span class="phase-top"><span class="phase-num" aria-hidden="true">${String(i).padStart(2, '0')}</span><span class="phase-tag mono">${tag}</span></span>
        <span class="phase-when mono">${esc(m.name)} — ${esc(m.phase)}</span>
        <span class="phase-stage">${esc(m.stage)}</span>
        <span class="phase-list">${shown.map((t) => `<span class="${data.done[t.id] ? 'is-done' : ''}">${esc(t.t)}</span>`).join('')}${more > 0 ? `<span class="more">${more} tugas lainnya</span>` : ''}</span>
        <span class="phase-foot"><span class="bar" aria-hidden="true"><i style="--w:${pct}%"></i></span><span class="mono tnum">${p.done}/${p.total}<span class="sr-only"> tugas selesai. Buka di checklist.</span></span></span>
      </button>
    </li>`;
  }).join('');
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
      return `<button class="tab${p.done === p.total && p.total ? ' is-done' : ''}" type="button" role="tab"
        id="tab-${m.id}" data-fkey="tab-${m.id}" data-action="month" data-month="${m.id}"
        aria-selected="${sel}" aria-controls="cl-panel" tabindex="${sel ? 0 : -1}">${isNow ? '<span class="dot" aria-hidden="true"></span>' : ''}${m.short} <span class="tnum">${p.done}/${p.total}</span>${isNow ? '<span class="sr-only"> (bulan aktif)</span>' : ''}</button>`;
    }).join('');
  });
}

function renderChecklist(data) {
  const month = M.find((m) => m.id === ui.month) ?? M[0];
  const mp = monthProgress(data, month);
  const today = todayStr();
  const ro = store.readOnly;
  const pct = mp.total ? Math.round((mp.done / mp.total) * 100) : 0;

  $('cl-panel').setAttribute('aria-labelledby', `tab-${month.id}`);
  $('cl-phase').textContent = `${month.phase} — ${month.stage}`;
  $('cl-title-month').textContent = month.name;
  $('cl-count').innerHTML = `${mp.done}<small>/${mp.total}</small>`;
  $('cl-bar').style.setProperty('--w', `${pct}%`);
  $('cl-bar-wrap').setAttribute('aria-label', `${pct}% tugas ${month.name} selesai`);

  const list = $('tasks');
  keepFocus(list, () => {
    list.innerHTML = mp.tasks.map((t) => {
      const done = !!data.done[t.id];
      const late = !done && t.d && t.d < today;
      const date = t.d
        ? `<span class="task-date${late ? ' is-late' : ''}">${late ? 'Terlambat · ' : 'Target '}${fmtShort(t.d)}</span>`
        : '<span class="task-date">Tugas sendiri</span>';
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
function projectRow(data, p, i) {
  const s = data.projects[p.id];
  return `
    <span class="pf-num mono">(${String(i + 1).padStart(2, '0')})</span>
    <h3 class="pf-title" id="pf-${p.id}-title">${esc(p.title)}</h3>
    <span class="pf-meta">
      <span class="status-pill" data-st="${esc(s.status)}">${esc(ST[s.status])}</span>
      <span class="pf-stack mono">${esc(p.stack)}</span>
    </span>`;
}

function projectInfo(data, p) {
  const s = data.projects[p.id];
  const gh = safeUrl(s.github);
  const demo = safeUrl(s.demo);
  const links = [
    gh && `<a class="pf-link" href="${esc(gh)}" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span><span class="sr-only"> (tab baru)</span></a>`,
    demo && `<a class="pf-link" href="${esc(demo)}" target="_blank" rel="noopener noreferrer">Demo <span aria-hidden="true">↗</span><span class="sr-only"> (tab baru)</span></a>`,
  ].filter(Boolean).join('');
  const desc = s.desc.trim()
    ? `<p class="pf-desc" lang="en">${esc(s.desc)}</p>`
    : `<p class="pf-desc"><span class="muted">Deskripsi menyusul.</span> ${esc(p.idea)}</p>`;
  return `${desc}${links ? `<p class="pf-links">${links}</p>` : ''}`;
}

function renderProjectViews(data) {
  P.forEach((p, i) => {
    $(`pf-row-${p.id}`).innerHTML = projectRow(data, p, i);
    $(`pf-info-${p.id}`).innerHTML = projectInfo(data, p);
  });
}

/** Forms are built only on reset, so typing is never interrupted by re-renders. */
export function buildProjects(data) {
  $('projects').innerHTML = P.map((p, i) => {
    const s = data.projects[p.id];
    const f = (name) => `pf-${p.id}-${name}`;
    return `<li class="pf-item">
      <div class="pf-row" id="pf-row-${p.id}" data-preview="${p.id}">${projectRow(data, p, i)}</div>
      <div class="pf-body">
        <div class="pf-info" id="pf-info-${p.id}">${projectInfo(data, p)}</div>
        <details class="pf-edit edit-only">
          <summary class="btn btn-ghost btn-sm" data-cursor><span class="when-closed">Edit proyek</span><span class="when-open">Tutup</span><span class="sr-only"> ${esc(p.title)}</span></summary>
          <form class="pf-form" data-pid="${p.id}" novalidate>
            <label class="field"><span>Status</span>
              <select class="select" id="${f('status')}" data-pfield="status">
                ${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v}</option>`).join('')}
              </select></label>
            <label class="field"><span>Link GitHub</span>
              <input class="input" type="url" inputmode="url" id="${f('github')}" data-pfield="github" value="${esc(s.github)}" placeholder="https://github.com/…" maxlength="300" autocomplete="off"></label>
            <label class="field wide"><span>Link demo</span>
              <input class="input" type="url" inputmode="url" id="${f('demo')}" data-pfield="demo" value="${esc(s.demo)}" placeholder="https://…" maxlength="300" autocomplete="off"></label>
            <label class="field"><span>Catatan</span>
              <textarea class="textarea" id="${f('notes')}" data-pfield="notes" maxlength="2000" rows="3" placeholder="Dataset, pendekatan, hasil, angka…">${esc(s.notes)}</textarea></label>
            <label class="field"><span>Deskripsi (English)</span>
              <textarea class="textarea" id="${f('desc')}" data-pfield="desc" maxlength="2000" rows="3" lang="en" placeholder="Short portfolio description in English">${esc(s.desc)}</textarea></label>
            <p class="pf-hint wide" id="${f('hint')}"></p>
            <div class="wide">
              <button class="btn btn-ink btn-sm" type="button" data-action="copy-desc" data-pid="${p.id}">Salin prompt deskripsi <span class="arr" aria-hidden="true">→</span></button>
              <p class="status" id="${f('status-msg')}" aria-live="polite"></p>
            </div>
            <div class="fallback wide" id="${f('fallback')}" hidden>
              <label class="field"><span>Prompt (salin manual)</span><textarea class="textarea" rows="8" readonly></textarea></label>
            </div>
          </form>
        </details>
      </div>
    </li>`;
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
const R = 92;
const C = 2 * Math.PI * R;

function renderGauge(data) {
  const el = $('gauge');
  const min = thisWeekMinutes(data);
  const hours = Math.round((min / 60) * 10) / 10;
  const frac = Math.min(1, min / (WEEK_TARGET * 60));
  if (!el.dataset.ready) {
    let ticks = '';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r1 = i % 6 === 0 ? 99 : 100.5;
      ticks += `<line x1="${(100 + r1 * Math.cos(a)).toFixed(2)}" y1="${(100 + r1 * Math.sin(a)).toFixed(2)}" x2="${(100 + 104 * Math.cos(a)).toFixed(2)}" y2="${(100 + 104 * Math.sin(a)).toFixed(2)}"/>`;
    }
    el.innerHTML = `
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <g class="g-ticks">${ticks}</g>
        <circle class="g-track" cx="100" cy="100" r="${R}"/>
        <circle class="g-val" id="g-val" cx="100" cy="100" r="${R}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}"/>
      </svg>
      <div class="gauge-center">
        <span class="mono muted">Minggu ini</span>
        <span class="gauge-num" id="g-num"></span>
        <span class="gauge-of" id="g-of"></span>
      </div>
      <p class="sr-only" id="g-sr"></p>`;
    el.dataset.ready = '1';
  }
  $('g-num').innerHTML = num(hours, 1);
  $('g-of').textContent = `dari ${WEEK_TARGET} jam · ${Math.round(frac * 100)}%`;
  $('g-sr').textContent = `${fmtHours(min)} dari target ${WEEK_TARGET} jam minggu ini.`;
  const val = $('g-val');
  setTimeout(() => val.setAttribute('stroke-dashoffset', (C * (1 - frac)).toFixed(2)), 60);
}

function renderLog(data) {
  const ro = store.readOnly;
  renderGauge(data);

  const total = data.log.reduce((s, e) => s + e.m, 0);
  $('log-stats').innerHTML = `
    <div><dt class="mono">Beruntun</dt><dd>${streak(data)}<small> hari</small></dd></div>
    <div><dt class="mono">Total</dt><dd>${fmtHours(total)}<small> jam</small></dd></div>
    <div><dt class="mono">Sesi</dt><dd>${data.log.length}</dd></div>`;

  const ws = weeks(data);
  const max = Math.max(WEEK_TARGET * 1.25, ...ws.map((w) => w.hours));
  const chart = $('weeks');
  chart.style.setProperty('--target', (WEEK_TARGET / max).toFixed(3));
  chart.innerHTML = ws.map((w, i) => `
    <li class="col${w.hit ? ' is-hit' : ''}${i === ws.length - 1 ? ' is-now' : ''}">
      <span class="col-val tnum" aria-hidden="true">${fmtHours(w.minutes)}</span>
      <span class="col-track" aria-hidden="true"><i class="col-bar" style="--h:${((w.hours / max) * 100).toFixed(1)}%"></i></span>
      <span class="col-label" aria-hidden="true">${i === ws.length - 1 ? 'Kini' : fmtShort(w.start)}</span>
      <span class="sr-only">Minggu mulai ${fmtLong(w.start)}: ${fmtHours(w.minutes)} jam${w.hit ? ', target tercapai' : ''}.</span>
    </li>`).join('');

  const entries = data.log.map((e, idx) => ({ ...e, idx }))
    .sort((a, b) => (a.d === b.d ? b.idx - a.idx : a.d < b.d ? 1 : -1))
    .slice(0, 10);
  const list = $('log-list');
  keepFocus(list, () => {
    list.innerHTML = entries.length ? entries.map((e) => `
      <li class="log-item">
        <span class="log-date mono tnum">${esc(fmtShort(e.d))} ${esc(e.d.slice(2, 4))}</span>
        <span class="log-min tnum">${e.m}m</span>
        <span class="log-note">${e.n ? esc(e.n) : '<span class="muted">Tanpa catatan</span>'}</span>
        ${ro ? '' : `<button class="icon-btn" type="button" data-action="del-log" data-idx="${e.idx}" data-fkey="log-${e.idx}" aria-label="Hapus log ${esc(fmtLong(e.d))}, ${e.m} menit">×</button>`}
      </li>`).join('')
      : '<li class="log-empty">Belum ada catatan. Sesi pertama dimulai dari form di atas.</li>';
  });
}

// ---------- Data + mode ----------
function renderData(data) {
  const el = $('data-updated');
  if (data.updated) {
    const d = new Date(data.updated);
    const hm = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
    el.textContent = `Terakhir disimpan ${fmtLong(ymd(d))}, ${hm}`;
  } else {
    el.textContent = 'Belum ada data tersimpan';
  }
}

function renderMode() {
  document.body.classList.toggle('is-readonly', store.readOnly);
  $('viewbar').hidden = !store.readOnly;
}

const listeners = new Set();
/** Called after every render (hero canvas, motion refresh). */
export const onRender = (fn) => listeners.add(fn);

export function renderAll(info = {}) {
  const data = store.data;
  renderMode();
  if (info.reset) {
    buildProjects(data);
    if (!M.some((m) => m.id === ui.month)) ui.month = activeMonth().id;
  }
  renderHero(data);
  renderNow(data);
  renderPhases(data);
  renderChips(data);
  renderChecklist(data);
  renderProjectViews(data);
  renderLog(data);
  renderData(data);
  ui.pop = null;
  listeners.forEach((fn) => fn(data, info));
}
