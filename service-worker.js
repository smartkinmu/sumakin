const CACHE_NAME = 'pwa-sample-cache-v2';

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                './',
                './index.html',
                './logs.html',
                './settings.html',
                './manifest.json',
                './scripts.js',
                './styles.css',
                './service-worker.js',
                './icon-192x192.png',
                './icon-512x512.png'
            ]).catch(error => {
                console.error('Failed to cache', error);
            });
        })
    );
});

self.addEventListener('activate', function(event) {
    var cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response.clone();
            } else {
                return fetch(event.request).then(function(response) {
                    // 新しいリクエストをキャッシュに保存
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                });
            }
        })
    );
});

// クライアントからのメッセージを受け取るリスナー
self.addEventListener('message', function(event) {
    if (event.data.action === 'close') {
        self.clients.matchAll().then(function(clients) {
            clients.forEach(client => client.navigate(client.url));
        });
    }
    if (event.data.action === 'sync') {
        event.waitUntil(
            caches.keys().then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        return caches.delete(cacheName);
                    })
                );
            })
        );
    }
});
