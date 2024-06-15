// キャッシュバージョンを変更
const CACHE_NAME = 'pwa-sample-cache-v3';

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll([
                '/',
                '/index2.html',
                '/manifest2.json',
                '/service-worker2.js',
                '/scripts2.js',
                '/styles.css',
                '/icon-192x192.png',
                '/icon-512x512.png'
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
            // キャッシュに一致するリクエストがあれば返し、一致しなければネットワークから取得
            return response || fetch(event.request).then(function(response) {
                // 新しいリクエストをキャッシュに保存
                return caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
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
