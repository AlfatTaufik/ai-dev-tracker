// Accounts: Firebase Auth (Google or email + password) and one Firestore document per user
// at trackers/{uid} = { json: "<tracker data>", updated: <server time> }.
// Sharing (optional) keeps a read-only copy at shares/{uid}, readable by anyone with the link.
// The Firebase SDK (pinned version, from Google's CDN) is only downloaded when accounts
// are configured and someone signs in, so the site stays light for everyone else.
import { FIREBASE_CONFIG } from './firebase-config.js';
import { norm } from './store.js';

export class SyncError extends Error {}
export const OFFLINE = 'offline';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
export const enabled = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

let loading = null;
/** Load and start Firebase once. Throws SyncError(OFFLINE) when the SDK can't be downloaded. */
function load() {
  if (!enabled) return Promise.reject(new SyncError('Akun belum diaktifkan di situs ini.'));
  loading ??= (async () => {
    const [{ initializeApp }, A, F] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = A.getAuth(app);
    auth.languageCode = 'id';
    return { auth, db: F.getFirestore(app), A, F };
  })().catch((err) => {
    loading = null;
    console.warn('[tracker] firebase:', err);
    throw new SyncError(OFFLINE);
  });
  return loading;
}

/** Start downloading the SDK early (when the login card comes into view), so the Google popup opens right on click. */
export function preload() { if (enabled) load().catch(() => {}); }

const AUTH_MSG = {
  'auth/invalid-credential': 'Email atau kata sandi salah.',
  'auth/wrong-password': 'Email atau kata sandi salah.',
  'auth/user-not-found': 'Email atau kata sandi salah.',
  'auth/invalid-login-credentials': 'Email atau kata sandi salah.',
  'auth/email-already-in-use': 'Email itu sudah terdaftar. Pakai tombol Masuk.',
  'auth/weak-password': 'Kata sandi minimal 6 karakter.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/missing-password': 'Isi kata sandi dulu.',
  'auth/popup-closed-by-user': 'Jendela login ditutup sebelum selesai.',
  'auth/cancelled-popup-request': 'Jendela login ditutup sebelum selesai.',
  'auth/popup-blocked': 'Popup login diblokir browser. Izinkan popup untuk situs ini, atau masuk dengan email.',
  'auth/network-request-failed': 'Tidak ada internet. Coba lagi saat online.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.',
  'auth/user-disabled': 'Akun ini dinonaktifkan.',
  'auth/unauthorized-domain': 'Domain ini belum diizinkan di Firebase (Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'Cara masuk ini belum diaktifkan di Firebase (Authentication → Sign-in method).',
  'auth/requires-recent-login': 'Demi keamanan, keluar lalu masuk lagi, kemudian coba hapus akun.',
  'auth/user-mismatch': 'Akun Google yang dipilih berbeda dengan akun yang sedang masuk.',
};
const authError = (err) => (err instanceof SyncError ? err
  : new SyncError(AUTH_MSG[err?.code] ?? `Gagal masuk (${err?.code || 'tidak diketahui'}). Coba lagi.`));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** method: 'google' | 'in' (email sign in) | 'up' (email sign up). Returns the Firebase user. */
export async function signIn(method, email = '', password = '') {
  if (method !== 'google') {
    if (!EMAIL.test(email)) throw new SyncError('Format email tidak valid.');
    if (password.length < 6) throw new SyncError('Kata sandi minimal 6 karakter.');
  }
  const { auth, A } = await load().catch((err) => {
    throw err.message === OFFLINE ? new SyncError('Tidak bisa memuat layanan akun. Periksa internet lalu coba lagi.') : err;
  });
  try {
    if (method === 'google') {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return (await A.signInWithPopup(auth, provider)).user;
    }
    if (method === 'up') return (await A.createUserWithEmailAndPassword(auth, email, password)).user;
    return (await A.signInWithEmailAndPassword(auth, email, password)).user;
  } catch (err) {
    throw authError(err);
  }
}

export async function resetPassword(email) {
  if (!EMAIL.test(email)) throw new SyncError('Tulis email akunmu dulu, lalu klik lagi.');
  const { auth, A } = await load();
  try { await A.sendPasswordResetEmail(auth, email); } catch (err) { throw authError(err); }
}

export async function signOut() {
  if (!loading) return;
  const { auth, A } = await load();
  await A.signOut(auth);
}

const FS_MSG = {
  'permission-denied': 'Akses ke data akun ditolak. Pastikan aturan Firestore dari firestore.rules sudah dipasang.',
  unauthenticated: 'Sesi akun berakhir. Masuk lagi untuk melanjutkan sinkron.',
  'not-found': 'Database Firestore belum dibuat di Firebase console.',
  'resource-exhausted': 'Kuota harian Firebase habis. Sinkron jalan lagi besok.',
};
function fsError(err) {
  if (err instanceof SyncError) return err;
  if (['unavailable', 'deadline-exceeded'].includes(err?.code)) return new SyncError(OFFLINE);
  return new SyncError(FS_MSG[err?.code] ?? `Sinkron akun gagal (${err?.code || 'tidak diketahui'}). Coba lagi nanti.`);
}

/** 'password' for email accounts, else the provider id (e.g. 'google.com'). */
export const providerOf = (user) => (user?.providerData?.some((p) => p.providerId === 'password') ? 'password' : user?.providerData?.[0]?.providerId || 'google.com');

/** Read someone's shared progress (no login needed). */
export async function readShare(uid) {
  if (!/^[\w-]{1,128}$/.test(uid)) throw new SyncError('Link bagikan tidak valid.');
  const { db, F } = await load().catch(() => { throw new SyncError('Tidak bisa memuat progres yang dibagikan. Periksa internet.'); });
  let snap;
  try { snap = await within(F.getDoc(F.doc(db, 'shares', uid)), 15_000); } catch (err) { throw fsError(err); }
  if (!snap.exists()) throw new SyncError('Progres ini sudah tidak dibagikan.');
  return norm(JSON.parse(snap.data().json));
}

/**
 * Delete the signed-in account: confirm identity again (password, or the Google popup),
 * remove the cloud copy and the shared copy, then the login itself.
 */
export async function deleteAccount(uid, password = '') {
  const { auth, db, A, F } = await load();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new SyncError('Sesi akun berakhir. Masuk lagi dulu.');
  try {
    if (providerOf(user) === 'password') {
      if (!password) throw new SyncError('Tulis kata sandimu untuk konfirmasi.');
      await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, password));
    } else {
      await A.reauthenticateWithPopup(user, new A.GoogleAuthProvider());
    }
  } catch (err) {
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(err?.code)) throw new SyncError('Kata sandi salah.');
    throw authError(err);
  }
  try {
    await F.deleteDoc(F.doc(db, 'shares', uid));
    await F.deleteDoc(F.doc(db, 'trackers', uid));
  } catch (err) { throw fsError(err); }
  try { await A.deleteUser(user); } catch (err) { throw authError(err); }
}

/** Timeout so an offline transaction fails fast instead of retrying for a long time. */
const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new SyncError(OFFLINE)), ms))]);

/** The cloud copy for a signed-in user, in the shape the sync engine expects. */
export async function remoteFor(uid) {
  const { auth, db, F } = await load();
  await auth.authStateReady();
  if (auth.currentUser?.uid !== uid) throw new SyncError('Sesi akun berakhir. Masuk lagi untuk melanjutkan sinkron.');
  const ref = F.doc(db, 'trackers', uid);
  const shareRef = F.doc(db, 'shares', uid);
  const guard = async (p) => { try { return await within(p, 20_000); } catch (err) { throw fsError(err); } };
  return {
    provider: providerOf(auth.currentUser),
    async isShared() { return (await guard(F.getDoc(shareRef))).exists(); },
    share: (data) => guard(F.setDoc(shareRef, { json: JSON.stringify(data), updated: F.serverTimestamp() })),
    unshare: () => guard(F.deleteDoc(shareRef)),
    async transact(fn) {
      if (navigator.onLine === false) throw new SyncError(OFFLINE);
      try {
        // A transaction: if another device saves at the same moment, Firestore runs this again
        // with the newer copy, so neither device's changes are lost.
        return await within(F.runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          let remote = null;
          if (snap.exists()) { try { remote = norm(JSON.parse(snap.data().json)); } catch { remote = null; } }
          const { merged, write } = fn(remote);
          if (write) tx.set(ref, { json: JSON.stringify(merged), updated: F.serverTimestamp() });
          return merged;
        }), 20_000);
      } catch (err) {
        throw fsError(err);
      }
    },
    /** Calls cb(json) when the document changes on the server (not for the first snapshot). */
    watch(cb) {
      let first = true;
      return F.onSnapshot(ref, (snap) => {
        if (first) { first = false; return; }
        if (snap.metadata.hasPendingWrites || !snap.exists()) return;
        cb(snap.data().json);
      }, () => { /* errors show up on the next sync */ });
    },
  };
}
