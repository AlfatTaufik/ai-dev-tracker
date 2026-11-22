// State, localStorage, norm(), export/import, progress.json view mode.
import { KEY, M, P, ST, HABIT_DEFAULTS, HABIT_MAX } from './data.js';

const TASK_IDS = new Set(M.flatMap((m) => m.tasks.map((t) => t.id)));
const MONTH_IDS = new Set(M.map((m) => m.id));

export function emptyProject() {
  return { status: '', github: '', demo: '', notes: '', desc: '' };
}

export function empty() {
  return {
    done: {},
    custom: [],
    projects: Object.fromEntries(P.map((p) => [p.id, emptyProject()])),
    log: [],
    habits: defaultHabits(),
    updated: '',
  };
}

export function defaultHabits() {
  return HABIT_DEFAULTS.map((h) => ({ ...h, days: [] }));
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * Validate and clean any data from localStorage or an imported file.
 * Unknown keys are dropped, types are checked, text is capped.
 * Throws a readable error when the input is not tracker data at all.
 */
export function norm(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Isi file bukan data AI Dev Tracker.');
  }
  const known = ['done', 'custom', 'projects', 'log', 'habits', 'updated'];
  if (!known.some((k) => k in raw)) throw new Error('Isi file bukan data AI Dev Tracker.');

  const out = empty();

  if (Array.isArray(raw.custom)) {
    const seen = new Set();
    for (const c of raw.custom.slice(0, 500)) {
      if (!c || typeof c !== 'object') continue;
      const id = str(c.id, 64);
      const text = str(c.text, 200).trim();
      if (!/^c[\w-]+$/.test(id) || seen.has(id) || !MONTH_IDS.has(c.m) || !text) continue;
      seen.add(id);
      out.custom.push({ id, m: c.m, text });
    }
  }

  const ids = new Set([...TASK_IDS, ...out.custom.map((c) => c.id)]);
  if (raw.done && typeof raw.done === 'object' && !Array.isArray(raw.done)) {
    for (const [k, v] of Object.entries(raw.done)) if (v === true && ids.has(k)) out.done[k] = true;
  }

  if (raw.projects && typeof raw.projects === 'object') {
    for (const p of P) {
      const s = raw.projects[p.id];
      if (!s || typeof s !== 'object') continue;
      out.projects[p.id] = {
        status: typeof s.status === 'string' && s.status in ST ? s.status : '',
        github: str(s.github, 300).trim(),
        demo: str(s.demo, 300).trim(),
        notes: str(s.notes, 2000),
        desc: str(s.desc, 2000),
      };
    }
  }

  if (Array.isArray(raw.log)) {
    for (const e of raw.log.slice(-5000)) {
      if (!e || typeof e !== 'object') continue;
      const m = Number(e.m);
      if (typeof e.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.d)) continue;
      if (!Number.isFinite(m) || m < 1 || m > 1440) continue;
      out.log.push({ d: e.d, m: Math.round(m), n: str(e.n, 200) });
    }
  }

  // Habits: missing key (older files) keeps the defaults; an array replaces them.
  if (Array.isArray(raw.habits)) {
    out.habits = [];
    const seen = new Set();
    for (const h of raw.habits.slice(0, HABIT_MAX)) {
      if (!h || typeof h !== 'object') continue;
      const id = str(h.id, 64);
      const name = str(h.name, 60).trim();
      if (!/^h[\w-]+$/.test(id) || seen.has(id) || !name) continue;
      seen.add(id);
      const goal = Number(h.goal);
      const days = Array.isArray(h.days)
        ? [...new Set(h.days.filter((d) => typeof d === 'string' && YMD.test(d)))].sort().slice(-2000)
        : [];
      out.habits.push({
        id, name,
        goal: Number.isInteger(goal) && goal >= 1 && goal <= 7 ? goal : 7,
        end: typeof h.end === 'string' && YMD.test(h.end) ? h.end : '',
        days,
      });
    }
  }

  if (typeof raw.updated === 'string' && !Number.isNaN(Date.parse(raw.updated))) out.updated = raw.updated;
  return out;
}

// ---------- State ----------
export const store = {
  data: empty(),
  readOnly: false,
  /** 'local' | 'file' | 'empty' */
  source: 'empty',
};

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** @param {{reset?: boolean}} [info] reset = data replaced wholesale (load/import/clear) */
export const emit = (info = {}) => listeners.forEach((fn) => fn(info));

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    store.data = norm(JSON.parse(raw));
    store.source = 'local';
    return true;
  } catch (err) {
    console.warn('[tracker] could not read saved data:', err);
    return false;
  }
}

/** True when data holds any progress at all. */
export function hasProgress(d) {
  return Object.keys(d.done).length > 0 || d.custom.length > 0 || d.log.length > 0
    || d.habits.some((h) => h.days.length)
    || Object.values(d.projects).some((p) => p.status || p.github || p.demo || p.notes || p.desc);
}

/**
 * View mode: localStorage is empty and progress.json in the repo has progress.
 * The repo ships an empty progress.json (so there is never a 404); replace it with
 * your exported file to turn view mode on for visitors.
 */
export async function loadRepoFile() {
  try {
    const res = await fetch('progress.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = norm(await res.json());
    if (!hasProgress(data)) return false;
    store.data = data;
    store.readOnly = true;
    store.source = 'file';
    return true;
  } catch {
    return false;
  }
}

function persist() {
  store.data.updated = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(store.data));
    return true;
  } catch (err) {
    console.warn('[tracker] could not save:', err);
    return false;
  }
}

/** Mutate data, save, notify. Ignored in view mode. */
export function update(fn) {
  if (store.readOnly) return false;
  fn(store.data);
  persist();
  store.source = 'local';
  emit();
  return true;
}

/** Leave view mode: copy the displayed data into this browser. */
export function editHere() {
  store.readOnly = false;
  persist();
  store.source = 'local';
  emit({ reset: true });
}

export function exportJSON() {
  const data = { ...store.data, updated: store.data.updated || new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'progress.json' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace all data with an imported file. Throws a readable error. */
export async function importFile(file) {
  if (file.size > 2_000_000) throw new Error('File terlalu besar (maks 2 MB).');
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('File bukan JSON yang valid.');
  }
  store.data = norm(parsed);
  store.readOnly = false;
  persist();
  store.source = 'local';
  emit({ reset: true });
  return store.data;
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  store.data = empty();
  store.readOnly = false;
  store.source = 'empty';
  emit({ reset: true });
}

/** Keep several open tabs in sync. */
export function watchOtherTabs() {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    if (e.newValue === null) { store.data = empty(); store.source = 'empty'; emit({ reset: true }); return; }
    try {
      store.data = norm(JSON.parse(e.newValue));
      store.readOnly = false;
      store.source = 'local';
      emit({ reset: true });
    } catch { /* ignore bad data from elsewhere */ }
  });
}
