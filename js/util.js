// Small helpers: escaping, dates, derived stats.
import { M, P, WEEK_TARGET, MONTHS_ID, MONTHS_LONG, DAYS_ID, DAYS_LONG, FOCUS_TAG } from './data.js';

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
export const fmtDay = (s) => { const d = parseYmd(s); return `${DAYS_ID[d.getDay()]} ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`; };
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

// ---------- Habits ----------
/** A habit counts on a day when it has no end date or the day is on/before it. */
export const habitActive = (h, day) => !h.end || day <= h.end;

/** Last n days ending today, oldest first, as YYYY-MM-DD. */
export function lastDays(n = 7, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(ymd(addDays(now, -i)));
  return out;
}

/** Days this habit was done in the current Monday-Sunday week. */
export function habitWeekCount(h, now = new Date()) {
  const from = ymd(weekStart(now));
  const to = ymd(addDays(weekStart(now), 6));
  return h.days.filter((d) => d >= from && d <= to).length;
}

/** Consecutive done days ending today (or yesterday, so today is not a broken streak yet). */
export function habitStreak(h, now = new Date()) {
  const days = new Set(h.days);
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(ymd(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}

/** Longest run of consecutive done days, ever. */
export function habitBest(h) {
  let best = 0, run = 0, prev = null;
  for (const s of h.days) {
    const d = parseYmd(s);
    run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** {done, total} for habits that run today. */
export function habitsToday(data, today = todayStr()) {
  const act = data.habits.filter((h) => habitActive(h, today));
  return { done: act.filter((h) => h.days.includes(today)).length, total: act.length };
}

/** Share of each day's running habits that were done: Map day -> {done, total}. */
export function habitDayMap(data, days) {
  const sets = data.habits.map((h) => ({ h, set: new Set(h.days) }));
  const out = new Map();
  for (const day of days) {
    let done = 0, total = 0;
    for (const { h, set } of sets) if (habitActive(h, day)) { total++; if (set.has(day)) done++; }
    out.set(day, { done, total });
  }
  return out;
}

/** Weekly goals met over the last 4 weeks, as a percent (each habit capped at 100%). */
export function habitConsistency(data, now = new Date()) {
  // Count from the first day anything was ticked, so a new tracker doesn't start at 0%.
  const first = data.habits.map((h) => h.days[0]).filter(Boolean).sort()[0];
  if (!first) return 0;
  const days = lastDays(28, now).filter((d) => d >= first);
  const parts = [];
  for (const h of data.habits) {
    const live = days.filter((d) => habitActive(h, d));
    if (!live.length) continue;
    const set = new Set(h.days);
    const want = (h.goal * live.length) / 7;
    parts.push(Math.min(1, live.filter((d) => set.has(d)).length / want));
  }
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0;
}

/** Days (up to today) on which every running habit was done. */
export function perfectDays(data, today = todayStr()) {
  const all = new Set(data.habits.flatMap((h) => h.days));
  let n = 0;
  for (const [, v] of habitDayMap(data, [...all].filter((d) => d <= today))) if (v.total && v.done === v.total) n++;
  return n;
}

// ---------- Focus + weekly review ----------
export const isFocus = (e) => e.n.startsWith(FOCUS_TAG);
/** Task text from a pomodoro log note ("Pomodoro · task"), or '' for free study. */
export const focusTask = (e) => e.n.slice(FOCUS_TAG.length).replace(/^\s*·\s*/, '');

/** Focus minutes per day for the last n days, plus the most focused task. */
export function focusStats(data, n = 7, now = new Date()) {
  const days = lastDays(n, now);
  const from = days[0];
  const entries = data.log.filter((e) => isFocus(e) && e.d >= from);
  const perDay = days.map((d) => ({ d, min: entries.filter((e) => e.d === d).reduce((s, e) => s + e.m, 0) }));
  const byTask = new Map();
  for (const e of entries) { const t = focusTask(e); if (t) byTask.set(t, (byTask.get(t) ?? 0) + e.m); }
  const top = [...byTask].sort((a, b) => b[1] - a[1])[0] ?? null;
  const total = entries.reduce((s, e) => s + e.m, 0);
  return { perDay, total, sessions: entries.length, avg: entries.length ? Math.round(total / entries.length) : 0, top };
}

/** Monday (YYYY-MM-DD) of the week that contains the given day. */
export const weekOf = (day = todayStr()) => ymd(weekStart(parseYmd(day)));

/** Everything the weekly review shows for the Monday-Sunday week starting at `start`. */
export function weekSummary(data, start, today = todayStr()) {
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(parseYmd(start), i)));
  const end = days[6];
  const inWeek = (e) => e.d >= start && e.d <= end;
  const log = data.log.filter(inWeek);
  const minutes = log.reduce((s, e) => s + e.m, 0);
  const focus = log.filter(isFocus);
  const perDay = days.map((d) => log.filter((e) => e.d === d).reduce((s, e) => s + e.m, 0));
  const bestI = perDay.indexOf(Math.max(...perDay));
  const upto = today < end ? today : end;

  const habits = [];
  for (const h of data.habits) {
    const live = days.filter((d) => habitActive(h, d) && d <= upto);
    if (!live.length) continue;
    const done = h.days.filter((d) => d >= start && d <= end).length;
    const want = Math.min(h.goal, days.filter((d) => habitActive(h, d)).length);
    habits.push({ h, done, want, met: done >= want, gap: want - done });
  }
  const missed = habits.filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap)[0] ?? null;

  const due = [];
  for (const m of M) for (const t of m.tasks) if (t.d >= start && t.d <= end) due.push({ ...t, done: !!data.done[t.id] });

  return {
    start, end, days,
    minutes,
    hit: minutes >= WEEK_TARGET * 60,
    activeDays: new Set(log.map((e) => e.d)).size,
    focusSessions: focus.length,
    focusMin: focus.reduce((s, e) => s + e.m, 0),
    best: perDay[bestI] ? { day: days[bestI], name: DAYS_LONG[parseYmd(days[bestI]).getDay()], min: perDay[bestI] } : null,
    habits,
    habitsMet: habits.filter((x) => x.met).length,
    missed,
    due,
    overdue: overdue(data, upto < today ? addDaysYmd(end, 1) : today),
    review: data.reviews[start] ?? {},
    promise: data.reviews[ymd(addDays(parseYmd(start), -7))]?.next ?? '',
  };
}
const addDaysYmd = (s, n) => ymd(addDays(parseYmd(s), n));
