const CACHE = 'party-room-shell-v2.0';
const CORE = ['/offline.html', '/offline.css', '/assets/app/icon-192.png', '/assets/app/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('uno-party-shell-')||key.startsWith('party-room-shell-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  // Never cache live hands, Socket.IO requests, cross-origin traffic or media ranges.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/socket.io/') || url.pathname === '/health' || request.headers.has('range')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !/\.(?:js|css|svg|png|webmanifest)$/.test(url.pathname)) return;
  // Revalidate scripts so a fresh Railway deployment never boots stale game code.
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.status === 200 && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || Response.error()));
});
