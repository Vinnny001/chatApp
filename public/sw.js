const cacheName = 'chat-cache-v1';

const assets = [
  '/',
  '/chat.html',
  '/index.html',
  '/socket.io.min.js',
  '/manifest.json',
  // Add other static assets like CSS/images if needed
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});
