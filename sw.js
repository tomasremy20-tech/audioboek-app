const CACHE_NAME = 'audioboek-v19';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './icon.svg',
  './icon-maskable.svg',
  './manifest.json'
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and immediately take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML, cache-first for other assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only for API calls
  if (url.hostname === 'api.anthropic.com' || url.hostname.includes('cdnjs')) {
    return;
  }

  // Network-first for HTML (always get latest version)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/audioboek-app/') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for JS, CSS, images
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('./index.html');
    })
  );
});
