// Sync between devices through a secret GitHub Gist owned by the user.
// Every device uses the same GitHub token (scope: gist only). The token lives in
// this browser's localStorage under its own key; tracker data format is unchanged.
import { store, subscribe, replaceData, norm } from './store.js';
import { merge, same } from './merge.js';

const SKEY = 'aidev-sync-v1';
const FILE = 'aidev-tracker.json';
const API = 'https://api.github.com';
export const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=AI%20Dev%20Tracker';

/** {token, gistId, base, last} */
let cfg = readCfg();
export const sync = { state: cfg ? 'idle' : 'off', msg: '', last: cfg?.last ?? '' };

const listeners = new Set();
export const onSync = (fn) => { listeners.add(fn); fn(sync); };
function set(state, msg = '') {
  sync.state = state;
  sync.msg = msg;
  listeners.forEach((fn) => fn(sync));
}

function readCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(SKEY) || 'null');
    return c && typeof c.token === 'string' && typeof c.gistId === 'string' ? c : null;
  } catch { return null; }
}
function saveCfg() {
  try { localStorage.setItem(SKEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}
export const connected = () => !!cfg;

class SyncError extends Error {}

async function api(path, { method = 'GET', body, token = cfg?.token } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new SyncError('offline');
  }
  if (res.status === 401) throw new SyncError('Token ditolak GitHub (salah, dicabut, atau kedaluwarsa). Hubungkan ulang dengan token baru.');
  if (res.status === 403 || res.status === 422) throw new SyncError('Token tidak punya izin gist, atau batas akses GitHub tercapai. Coba lagi nanti.');
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncError(`GitHub membalas ${res.status}. Coba lagi nanti.`);
  return res.status === 204 ? {} : res.json();
}

const content = (data) => JSON.stringify(data, null, 1);
const clone = (data) => JSON.parse(JSON.stringify(data));
const newGist = (data, token) => api('/gists', {
  method: 'POST', token,
  body: { description: 'AI Dev Tracker sync (jangan dihapus)', public: false, files: { [FILE]: { content: content(data) } } },
});

/** Connect this device. Finds the gist made by another device, or creates one. */
export async function connect(token) {
  token = token.trim();
  if (!/^(gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(token)) {
    throw new SyncError('Itu bukan token GitHub. Token diawali ghp_ atau github_pat_.');
  }
  set('busy', 'Menghubungkan…');
  try {
    let gistId = '';
    for (let page = 1; page <= 5 && !gistId; page++) {
      const list = await api(`/gists?per_page=100&page=${page}`, { token });
      if (!list?.length) break;
      gistId = list.find((g) => g.files && FILE in g.files)?.id ?? '';
    }
    let created = false;
    if (!gistId) {
      gistId = (await newGist(store.data, token)).id;
      created = true;
    }
    cfg = { token, gistId, base: null, last: '' };
    saveCfg();
    await syncNow();
    return { created };
  } catch (err) {
    cfg = readCfg();
    set(cfg ? 'error' : 'off', err.message === 'offline' ? 'Tidak ada internet. Coba lagi saat online.' : err.message);
    throw err;
  }
}

/** Forget the token on this device. Data stays here and in the gist. */
export function disconnect() {
  cfg = null;
  try { localStorage.removeItem(SKEY); } catch { /* ignore */ }
  sync.last = '';
  set('off');
}

let running = null;
let again = false;

/** Pull, merge, push. Safe to call often; overlapping calls are folded into one more run. */
export function syncNow() {
  if (!cfg || store.readOnly) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again && cfg);
  })().finally(() => { running = null; });
  return running;
}

async function runOnce() {
  set('busy', 'Menyinkronkan…');
  try {
    const gist = await api(`/gists/${cfg.gistId}`);
    let remote = null;
    if (gist) {
      const f = gist.files?.[FILE];
      let text = f?.content ?? '';
      if (f?.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
      try { remote = norm(JSON.parse(text)); } catch { remote = null; }
    }
    // Work on copies: store.data is mutated in place by update(), and the base must never move with it.
    const local = clone(store.data);
    const merged = remote ? merge(cfg.base, local, remote) : local;

    if (!gist) { // gist was deleted: start a new one from this device
      cfg.gistId = (await newGist(merged)).id;
    } else if (!remote || !same(merged, remote)) {
      await api(`/gists/${cfg.gistId}`, { method: 'PATCH', body: { files: { [FILE]: { content: content(merged) } } } });
    }

    if (!same(store.data, local)) {
      // The user changed something while we were talking to GitHub. Keep the old base:
      // the next run merges that change with what was just pushed.
      again = true;
    } else {
      if (!same(merged, local)) {
        const projectsChanged = JSON.stringify(merged.projects) !== JSON.stringify(local.projects);
        replaceData(clone(merged), { reset: projectsChanged, pulled: true });
      }
      cfg.base = merged;
    }
    cfg.last = new Date().toISOString();
    sync.last = cfg.last;
    saveCfg();
    set('idle');
  } catch (err) {
    if (err instanceof SyncError && err.message === 'offline') set('offline', 'Offline. Perubahan disinkronkan saat kembali online.');
    else set('error', err instanceof SyncError ? err.message : 'Sinkron gagal. Coba lagi nanti.');
    if (!(err instanceof SyncError)) console.warn('[tracker] sync:', err);
  }
}

let timer = 0;
const later = (ms = 1500) => { clearTimeout(timer); timer = setTimeout(syncNow, ms); };

/** Start background syncing: after every local change, on focus, when back online, and every minute. */
export function startSync() {
  subscribe((info) => { if (!info.fromSync && cfg) later(); });
  addEventListener('online', () => later(200));
  addEventListener('focus', () => later(200));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(200); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60_000);
  if (cfg) syncNow();
}
