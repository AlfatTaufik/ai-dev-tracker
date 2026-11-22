// Service worker: makes the tracker installable and usable offline.
// Own files: network first (so a new deploy shows up right away), cache as fallback.
// If the network is slow, the cached copy is served after a short wait and refreshed in the background.
// CDN files (fonts, GSAP, Lenis, Firebase SDK) have versioned URLs, so they are cache first.
const SHELL = 'aidev-shell-v4';
const CDN = 'aidev-cdn-v2'; // v2: scripts now load with crossorigin (SRI)
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'progress.json',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/sections.css',
  'js/main.js', 'js/data.js', 'js/store.js', 'js/util.js', 'js/render.js', 'js/network.js',
  'js/hero.js', 'js/motion.js', 'js/prompts.js', 'js/merge.js', 'js/sync.js',
  'js/account.js', 'js/firebase-config.js', 'js/focus.js', 'js/resources.js',
  'assets/favicon.svg', 'assets/mascot.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
];
// www.gstatic.com serves the pinned Firebase SDK (only when accounts are on). Firebase's own
// API calls go to other hosts and are never cached.
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'www.gstatic.com'];
const SLOW_MS = 2500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aidev-') && k !== SHELL && k !== CDN).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req, e));
  else if (CDN_HOSTS.includes(url.hostname)) e.respondWith(cacheFirst(req));
});

async function networkFirst(req, event) {
  const cache = await caches.open(SHELL);
  const key = req.mode === 'navigate' ? './' : req;
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  const cached = await cache.match(key, { ignoreSearch: true });
  if (!cached) return network;
  const slow = new Promise((resolve) => setTimeout(() => resolve(cached), SLOW_MS));
  return Promise.race([network.catch(() => cached), slow]);
}

async function cacheFirst(req) {
  const cache = await caches.open(CDN);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
