// Three-way merge of tracker data, used by device sync.
// Data is flattened into key -> value pairs; for every key the side that changed
// since the last sync (the base) wins, so ticks, deletions and edits made on
// different devices all survive. If both sides changed the same key, local wins.
import { norm, hasProgress } from './store.js';

export function flatten(d) {
  const f = new Map();
  for (const k of Object.keys(d.done)) f.set(`done:${k}`, '1');
  for (const c of d.custom) f.set(`custom:${c.id}`, JSON.stringify([c.m, c.text]));
  for (const [pid, p] of Object.entries(d.projects)) {
    for (const [k, v] of Object.entries(p)) if (v) f.set(`proj:${pid}:${k}`, v);
  }
  const seen = new Map(); // identical log entries are counted: #1, #2, ...
  for (const e of d.log) {
    const key = `${e.d}|${e.m}|${e.n}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    f.set(`log:${key}#${n}`, '1');
  }
  for (const h of d.habits) {
    f.set(`habit:${h.id}`, JSON.stringify([h.name, h.goal, h.end]));
    for (const day of h.days) f.set(`hday:${h.id}:${day}`, '1');
  }
  for (const [id, list] of Object.entries(d.links)) for (const l of list) f.set(`link:${id}:${l.u}`, l.t);
  for (const [wk, r] of Object.entries(d.reviews)) for (const [k, v] of Object.entries(r)) f.set(`review:${wk}:${k}`, v);
  return f;
}

function unflatten(f, order) {
  const out = { done: {}, custom: [], projects: {}, log: [], habits: [], links: {}, reviews: {} };
  const habits = new Map();
  const days = [];
  for (const [k, v] of f) {
    const i = k.indexOf(':');
    const type = k.slice(0, i);
    const rest = k.slice(i + 1);
    if (type === 'done') out.done[rest] = true;
    else if (type === 'custom') { const [m, text] = JSON.parse(v); out.custom.push({ id: rest, m, text }); }
    else if (type === 'proj') { const j = rest.indexOf(':'); (out.projects[rest.slice(0, j)] ??= {})[rest.slice(j + 1)] = v; }
    else if (type === 'log') { const [d, m, ...n] = rest.slice(0, rest.lastIndexOf('#')).split('|'); out.log.push({ d, m: Number(m), n: n.join('|') }); }
    else if (type === 'habit') { const [name, goal, end] = JSON.parse(v); habits.set(rest, { id: rest, name, goal, end, days: [] }); }
    else if (type === 'hday') { const j = rest.lastIndexOf(':'); days.push([rest.slice(0, j), rest.slice(j + 1)]); }
    else if (type === 'link') { const j = rest.indexOf(':'); (out.links[rest.slice(0, j)] ??= []).push({ u: rest.slice(j + 1), t: v }); }
    else if (type === 'review') { const j = rest.indexOf(':'); (out.reviews[rest.slice(0, j)] ??= {})[rest.slice(j + 1)] = v; }
  }
  for (const [id, day] of days) habits.get(id)?.days.push(day); // days of a deleted habit are dropped
  for (const h of habits.values()) h.days.sort();
  // Keep the order the user sees: local first, then anything new from the other side.
  const rank = new Map();
  order.forEach((id) => { if (!rank.has(id)) rank.set(id, rank.size); });
  out.habits = [...habits.values()].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  out.custom.sort((a, b) => (a.id < b.id ? -1 : 1));
  out.log.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

/** True when two data objects hold the same progress (the `updated` stamp is ignored). */
export function same(a, b) {
  const fa = flatten(a), fb = flatten(b);
  if (fa.size !== fb.size) return false;
  for (const [k, v] of fa) if (fb.get(k) !== v) return false;
  // Order of habits is visible to the user, so it counts too.
  return a.habits.map((h) => h.id).join() === b.habits.map((h) => h.id).join();
}

/**
 * @param {object|null} base   data as it was after the last sync (null: never synced on this device)
 * @param {object} local
 * @param {object} remote
 */
export function merge(base, local, remote) {
  // First sync of a fresh device: just take what is already in the cloud.
  if (!base && !hasProgress(local)) return norm(remote);
  const B = base ? flatten(base) : new Map();
  const L = flatten(local), R = flatten(remote);
  const out = new Map();
  for (const k of new Set([...B.keys(), ...L.keys(), ...R.keys()])) {
    const b = B.get(k), l = L.get(k), r = R.get(k);
    const v = l === r ? l : l === b ? r : l; // remote wins only where local is unchanged
    if (v !== undefined) out.set(k, v);
  }
  const data = unflatten(out, [...local.habits, ...remote.habits].map((h) => h.id));
  data.updated = [local.updated, remote.updated].sort().pop() || '';
  return norm(data);
}
