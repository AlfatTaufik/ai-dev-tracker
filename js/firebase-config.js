// Firebase web config for accounts (Google / email login + cloud save).
// Leave it null and the site works as before: no login, only the GitHub Gist option.
// To turn accounts on, follow "Akun" in README.md and paste the config from
// Firebase console → Project settings → Your apps → Web app, like this:
//
// export const FIREBASE_CONFIG = {
//   apiKey: 'AIza…',
//   authDomain: 'nama-proyek.firebaseapp.com',
//   projectId: 'nama-proyek',
//   appId: '1:…:web:…',
// };
//
// These values are meant to be public. Each user can only read and write their own
// document; that is enforced by firestore.rules, not by hiding this file.
export const FIREBASE_CONFIG = null;
