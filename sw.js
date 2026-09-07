// Кешира обвивката на приложението, за да работи офлайн.
// Заявките към Claude API винаги минават по мрежата.

const CACHE = 'kcal-v3';
const SHELL = [
  './', './index.html', './css/app.css',
  './js/main.js', './js/util.js', './js/storage.js', './js/state.js',
  './js/energy.js', './js/vision.js',
  './js/views/day.js', './js/views/progress.js', './js/views/settings.js',
  './js/views/welcome.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname === 'api.anthropic.com') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        // Офлайн и без кеш: при навигация връщаме обвивката, иначе честна грешка.
        e.request.mode === 'navigate'
          ? caches.match('./index.html')
          : new Response('', { status: 504, statusText: 'Офлайн' })
      );
    })
  );
});
