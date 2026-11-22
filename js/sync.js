// Sync between devices. Two ways to store the cloud copy:
//   - account: Firebase login (Google or email), one Firestore document per user (js/account.js)
//   - gist:    a secret GitHub Gist, every device pastes the same token (scope: gist only)
// Only one is active at a time. Its settings live in this browser's localStorage under
// their own key; the tracker data format is unchanged.
import { store, subscribe, replaceData, norm } from './store.js';
import { merge, same } from './merge.js';
import * as account from './account.js';
import { SyncError, OFFLINE } from './account.js';

export { SyncError };

const SKEY = 'aidev-sync-v1';
const FILE = 'aidev-tracker.json';
const API = 'https://api.github.com';
export const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=AI%20Dev%20Tracker';
export const accountsEnabled = account.enabled;

/** {kind:'gist', token, gistId, base, last} | {kind:'account', uid, email, base, last} */
let cfg = readCfg();
export const sync = { state: cfg ? 'idle' : 'off', msg: '', last: cfg?.last ?? '', kind: cfg?.kind ?? '', email: cfg?.email ?? '' };

const listeners = new Set();
export const onSync = (fn) => { listeners.add(fn); fn(sync); };
function set(state, msg = '') {
  Object.assign(sync, { state, msg, kind: cfg?.kind ?? '', email: cfg?.email ?? '', last: cfg?.last ?? '' });
  listeners.forEach((fn) => fn(sync));
}

function readCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (!c || typeof c !== 'object') return null;
    if (c.kind === 'account') return typeof c.uid === 'string' && account.enabled ? c : null;
    // Settings saved before accounts existed have no kind: they are gist settings.
    return typeof c.token === 'string' && typeof c.gistId === 'string' ? { ...c, kind: 'gist' } : null;
  } catch { return null; }
}
function saveCfg() {
  try { localStorage.setItem(SKEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}
export const connected = () => !!cfg;


// ---------- Remote: GitHub Gist ----------
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
    throw new SyncError(OFFLINE);
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

const gistRemote = {
  /** Read the cloud copy, let fn merge, write back when something changed. Returns the merged data. */
  async transact(fn) {
    const gist = await api(`/gists/${cfg.gistId}`);
    let remote = null;
    if (gist) {
      const f = gist.files?.[FILE];
      let text = f?.content ?? '';
      if (f?.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
      try { remote = norm(JSON.parse(text)); } catch { remote = null; }
    }
    const { merged, write } = fn(remote);
    if (!gist) cfg.gistId = (await newGist(merged)).id; // gist was deleted: start a new one from this device
    else if (write) await api(`/gists/${cfg.gistId}`, { method: 'PATCH', body: { files: { [FILE]: { content: content(merged) } } } });
    return merged;
  },
};

// ---------- Connect / disconnect ----------
/** Gist: finds the gist made by another device, or creates one. */
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
    use({ kind: 'gist', token, gistId, base: null, last: '' });
    await syncNow();
    return { created };
  } catch (err) {
    cfg = readCfg();
    set(cfg ? 'error' : 'off', err.message === OFFLINE ? 'Tidak ada internet. Coba lagi saat online.' : err.message);
    throw err;
  }
}

/**
 * Account: sign in (method 'google' | 'in' | 'up') and sync with the user's document.
 * Signing into the same account again keeps the last-synced base, so nothing is merged twice.
 */
export async function signIn(method, email, password) {
  set('busy', 'Masuk…');
  try {
    const user = await account.signIn(method, email, password);
    const keep = cfg?.kind === 'account' && cfg.uid === user.uid ? cfg.base : null;
    use({ kind: 'account', uid: user.uid, email: user.email || '', base: keep, last: '' });
    await syncNow();
    return user;
  } catch (err) {
    // Login failed: the caller shows why. Whatever was active before stays as it was.
    cfg = readCfg();
    set(cfg ? 'idle' : 'off');
    throw err;
  }
}

export const resetPassword = (email) => account.resetPassword(email);

/** Forget the cloud link on this device (and sign out of the account). Data stays here and in the cloud. */
export async function disconnect() {
  const wasAccount = cfg?.kind === 'account';
  stopWatch();
  remote = null;
  cfg = null;
  try { localStorage.removeItem(SKEY); } catch { /* ignore */ }
  set('off');
  if (wasAccount) await account.signOut().catch(() => {});
}

function use(next) {
  stopWatch();
  remote = null;
  cfg = next;
  saveCfg();
}

// ---------- Engine ----------
let remote = null; // Promise of {transact, watch?} for the active cfg
let unwatch = null;
function stopWatch() { unwatch?.(); unwatch = null; }

function getRemote() {
  if (!remote) {
    if (cfg.kind === 'gist') remote = Promise.resolve(gistRemote);
    else {
      const uid = cfg.uid;
      remote = account.remoteFor(uid).then((r) => {
        // Live updates: another device saved, so pull now. Our own saves match the base and are skipped.
        if (r.watch && !unwatch) {
          unwatch = r.watch((json) => {
            try { if (cfg?.base && same(norm(JSON.parse(json)), cfg.base)) return; } catch { /* sync anyway */ }
            later(300);
          });
        }
        return r;
      });
    }
    remote.catch(() => { remote = null; }); // retry the setup next time
  }
  return remote;
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
  const mine = cfg;
  try {
    const r = await getRemote();
    // Work on copies: store.data is mutated in place by update(), and the base must never move with it.
    const local = clone(store.data);
    const merged = await r.transact((rem) => {
      const m = rem ? merge(mine.base, local, rem) : local;
      return { merged: m, write: !rem || !same(m, rem) };
    });
    if (cfg !== mine) return; // signed out or switched while saving

    if (!same(store.data, local)) {
      // The user changed something while we were talking to the server. Keep the old base:
      // the next run merges that change with what was just pushed.
      again = true;
    } else {
      if (!same(merged, local)) {
        const projectsChanged = JSON.stringify(merged.projects) !== JSON.stringify(local.projects);
        replaceData(clone(merged), { reset: projectsChanged, pulled: true });
      }
      cfg.base = clone(merged);
    }
    cfg.last = new Date().toISOString();
    saveCfg();
    set('idle');
  } catch (err) {
    if (cfg !== mine) return;
    if (err instanceof SyncError && err.message === OFFLINE) set('offline', 'Offline. Perubahan disinkronkan saat kembali online.');
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
  // Accounts get live updates, so polling is only needed for the gist.
  setInterval(() => { if (document.visibilityState === 'visible' && cfg?.kind === 'gist') syncNow(); }, 60_000);
  if (cfg) syncNow();
}
