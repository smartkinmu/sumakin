self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open('pwa-sample-cache-v1').then(function(cache) {
            return cache.addAll([
                '/',
                '/index.html',
                '/manifest.json',
                '/service-worker.js',
                '/sumakin/icon-192x192.png',
                '/sumakin/icon-512x512.png'
            ]);
        })
    );
});

self.addEventListener('activate', function(event) {
    var cacheWhitelist = ['pwa-sample-cache-v1'];
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
        fetch(event.request).then(function(response) {
            return response;
        }).catch(function() {
            return caches.match(event.request);
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
});
