const CACHE_NAME = 'casino-pattern-ai-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-512.png'
];

// On install, prepare the offline shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cache inicial criado. Salvando assets estáticos.');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// On activate, clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept requests for offline capability
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Cache strictly GET requests
  if (req.method !== 'GET') return;

  // Do not intercept third-party APIs or server calls
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests (routes or main page reloading)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Dynamically cache the new index.html under the navigation URL and common fallback paths
              cache.put(req, responseToCache);
              cache.put('/index.html', responseToCache.clone());
              cache.put('/', responseToCache.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req) || caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Asset caching (JS, CSS, images, etc.)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache immediately, then fetch and update the cache in background
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResponse);
            });
          }
        }).catch(() => {
          // Ignore network errors in the background when completely offline
        });

        return cachedResponse;
      }

      // If not in cache, fetch from network and cache a clone
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        console.warn('[Service Worker] Falha ao buscar asset não-cacheado offline:', url.pathname);
        if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
          return caches.match('/index.html') || caches.match('/');
        }
      });
    })
  );
});
