const CACHE = 'kanban-v1';
const STATIC = ['/', '/style.css', '/app.js', '/manifest.json', '/icons/icon.svg',
  '/locales/it.json', '/locales/en.json',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API → network first, fallback silenzioso
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503, headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }
  // Static assets → cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return resp;
    }))
  );
});
