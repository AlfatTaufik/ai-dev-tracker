// Sync between devices through the user's account (Firebase, see js/account.js).
// The link to the account lives in this browser's localStorage under its own key;
// the tracker data format is unchanged. Optional sharing keeps a read-only copy up to date.
import { store, subscribe, replaceData } from './store.js';
import { merge, same } from './merge.js';
import * as account from './account.js';
import { SyncError, OFFLINE } from './account.js';

export { SyncError };
const SKEY = 'aidev-sync-v1';
export const accountsEnabled = account.enabled;

/** {uid, email, provider, base, last} */
let cfg = readCfg();
export const sync = {
  state: cfg ? 'idle' : 'off',
  msg: '',
  last: cfg?.last ?? '',
  email: cfg?.email ?? '',
  provider: cfg?.provider ?? '',
  share: null,       // true / false once known, null while unknown
  legacyGist: false, // this device had GitHub Gist sync, which was removed
};

const listeners = new Set();
export const onSync = (fn) => { listeners.add(fn); fn(sync); };
function set(state, msg = '') {
  Object.assign(sync, { state, msg, email: cfg?.email ?? '', last: cfg?.last ?? '', provider: cfg?.provider ?? sync.provider });
  listeners.forEach((fn) => fn(sync));
}

function readCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (c && c.kind === 'account' && typeof c.uid === 'string' && account.enabled) return c;
    if (c && typeof c.token === 'string') {
      // GitHub Gist sync was removed: forget the token on this device.
      localStorage.removeItem(SKEY);
      queueMicrotask(() => { sync.legacyGist = true; set(sync.state); });
    }
    return null;
  } catch { return null; }
}
function saveCfg() {
  try { localStorage.setItem(SKEY, JSON.stringify({ kind: 'account', ...cfg })); } catch { /* ignore */ }
}
export const connected = () => !!cfg;
export const shareUrl = () => (cfg ? `${location.origin}${location.pathname}?lihat=${encodeURIComponent(cfg.uid)}` : '');

const clone = (data) => JSON.parse(JSON.stringify(data));
/** What a share link shows: everything except the private weekly reflections. */
const shareCopy = (data) => ({ ...clone(data), reviews: {} });

// ---------- Sign in / out ----------
/**
 * Sign in (method 'google' | 'in' (email) | 'up' (email sign up)) and sync with the user's document.
 * Signing into the same account again keeps the last-synced base, so nothing is merged twice.
 */
export async function signIn(method, email, password) {
  set('busy', 'Masuk…');
  try {
    const user = await account.signIn(method, email, password);
    const keep = cfg?.uid === user.uid ? cfg.base : null;
    use({ uid: user.uid, email: user.email || '', provider: account.providerOf(user), base: keep, last: '' });
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

/** Sign out on this device. Data stays here and in the account. */
export async function disconnect() {
  forget();
  set('off');
  await account.signOut().catch(() => {});
}

/** Delete the account and its cloud data. Data in this browser stays. */
export async function deleteAccount(password) {
  if (!cfg) return;
  await account.deleteAccount(cfg.uid, password);
  forget();
  set('off');
}

/** Turn the read-only share link on or off. */
export async function setShare(on) {
  if (!cfg) return;
  const r = await getRemote();
  const copy = shareCopy(store.data);
  if (on) { await r.share(copy); lastShared = JSON.stringify(copy); } else { await r.unshare(); lastShared = ''; }
  sync.share = on;
  set(sync.state === 'busy' ? 'idle' : sync.state);
}

function forget() {
  stopWatch();
  remote = null;
  cfg = null;
  sync.share = null;
  lastShared = '';
  try { localStorage.removeItem(SKEY); } catch { /* ignore */ }
}

function use(next) {
  stopWatch();
  remote = null;
  sync.share = null;
  lastShared = '';
  cfg = next;
  saveCfg();
}

// ---------- Engine ----------
let remote = null; // Promise of the account remote for the active cfg
let unwatch = null;
let lastShared = '';
function stopWatch() { unwatch?.(); unwatch = null; }

function getRemote() {
  if (!remote) {
    remote = account.remoteFor(cfg.uid).then((r) => {
      // Live updates: another device saved, so pull now. Our own saves match the base and are skipped.
      if (!unwatch) {
        unwatch = r.watch((json) => {
          try { if (cfg?.base && same(JSON.parse(json), cfg.base)) return; } catch { /* sync anyway */ }
          later(300);
        });
      }
      if (cfg && cfg.provider !== r.provider) { cfg.provider = r.provider; saveCfg(); }
      if (sync.share === null) r.isShared().then((v) => { sync.share = v; set(sync.state); }).catch(() => {});
      return r;
    });
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
    if (cfg !== mine) return; // signed out while saving

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
      if (sync.share) {
        const copy = shareCopy(merged);
        const json = JSON.stringify(copy);
        if (json !== lastShared) { await r.share(copy); lastShared = json; }
      }
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

/** Start background syncing: after every local change, on focus, and when back online. */
export function startSync() {
  subscribe((info) => { if (!info.fromSync && cfg) later(); });
  addEventListener('online', () => later(200));
  addEventListener('focus', () => later(200));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') later(200); });
  if (cfg) syncNow();
}
