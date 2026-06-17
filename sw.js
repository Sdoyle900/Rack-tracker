// RackTrack service worker — caches the static app shell so it opens instantly
// and survives brief signal loss. Live data (Supabase) always goes to the network.
const CACHE_NAME = 'racktrack-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests for our own origin's shell files.
  // Everything else (Supabase API calls, storage uploads, QR scans with query params) goes straight to network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '/')));

  if (!isShellFile) return; // let it pass through untouched — never intercept Supabase or scan requests

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Update cache with fresh copy in the background
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req)) // offline fallback to cached shell
  );
});
