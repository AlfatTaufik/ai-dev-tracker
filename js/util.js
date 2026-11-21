// Small helpers: escaping, dates, derived stats.
import { M, P, WEEK_TARGET, MONTHS_ID, MONTHS_LONG } from './data.js';

/** Escape any user text before it goes into HTML (text or attribute). */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
  })[c]);
}

/** Only http(s) links are ever rendered. */
export function safeUrl(u) {
  const s = String(u ?? '').trim();
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
}

// ---------- Dates (always local time, as YYYY-MM-DD strings) ----------
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
export const todayStr = () => ymd(new Date());

/** Monday of the week that contains dt. */
export function weekStart(dt) {
  const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
}

export const fmtShort = (s) => { const d = parseYmd(s); return `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`; };
export const fmtLong = (s) => { const d = parseYmd(s); return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtHours = (min) => { const h = Math.round((min / 60) * 10) / 10; return Number.isInteger(h) ? String(h) : h.toFixed(1); };

// ---------- Derived data ----------

/** Month that contains today; before the roadmap → first, after → last. */
export function activeMonth(today = todayStr()) {
  if (today < M[0].start) return M[0];
  return M.find((m) => today >= m.start && today <= m.end) ?? M[M.length - 1];
}

/** Base tasks + custom tasks for one month. Custom tasks get the month end as date. */
export function monthTasks(data, month) {
  const custom = data.custom
    .filter((c) => c.m === month.id)
    .map((c) => ({ id: c.id, t: c.text, d: '', custom: true }));
  return [...month.tasks, ...custom];
}

export function monthProgress(data, month) {
  const tasks = monthTasks(data, month);
  const done = tasks.filter((t) => data.done[t.id]).length;
  return { done, total: tasks.length, tasks };
}

export function totals(data) {
  let done = 0, total = 0;
  for (const m of M) { const p = monthProgress(data, m); done += p.done; total += p.total; }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function minutesBetween(data, from, to) {
  return data.log.reduce((sum, e) => (e.d >= from && e.d <= to ? sum + e.m : sum), 0);
}

export function thisWeekMinutes(data, now = new Date()) {
  const start = weekStart(now);
  return minutesBetween(data, ymd(start), ymd(addDays(start, 6)));
}

/** Last 8 weeks, oldest first: [{start:'YYYY-MM-DD', minutes, hours}] */
export function weeks(data, count = 8, now = new Date()) {
  const cur = weekStart(now);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const s = addDays(cur, -7 * i);
    const minutes = minutesBetween(data, ymd(s), ymd(addDays(s, 6)));
    out.push({ start: ymd(s), minutes, hours: minutes / 60, hit: minutes >= WEEK_TARGET * 60 });
  }
  return out;
}

/** Consecutive days with at least one log entry, ending today (or yesterday). */
export function streak(data, now = new Date()) {
  const days = new Set(data.log.map((e) => e.d));
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}

export function projectsOnline(data) {
  return P.filter((p) => data.projects[p.id]?.status === 'online').length;
}

/** Undone base tasks whose date has passed. */
export function overdue(data, today = todayStr()) {
  const out = [];
  for (const m of M) for (const t of m.tasks) if (!data.done[t.id] && t.d < today) out.push({ ...t, month: m });
  return out;
}

/** Next undone dated task from today on (or the earliest overdue one). */
export function nextDeadline(data, today = todayStr()) {
  for (const m of M) for (const t of m.tasks) if (!data.done[t.id] && t.d >= today) return { ...t, month: m };
  return null;
}

export function daysUntil(dateStr, today = todayStr()) {
  return Math.round((parseYmd(dateStr) - parseYmd(today)) / 86400000);
}
