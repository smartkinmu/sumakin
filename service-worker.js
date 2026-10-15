const CACHE_NAME = 'pwa-sample-cache-v72';

// オフラインで使うために、あらかじめ取り込んでおくファイル
const PRECACHE_URLS = [
    './',
    './index.html',
    './logs.html',
    './due_logs.html',
    './settings.html',
    './backup.html',
    './manual.html',
    './manifest.json',
    './scripts.js',
    './common.js',
    './logs-page.js',
    './styles.css',
    './service-worker.js',
    './icon-192x192.png',
    './icon-512x512.png',
    './apple-touch-icon.png'
];

/**
 * 取り込むファイルを、ブラウザのHTTPキャッシュを通さずに取得する。
 * 1つでも取得できなければ失敗にする（一部だけのキャッシュでは、オフラインで画面が崩れるため）。
 * @returns {Promise<Response[]>} 取得した応答（PRECACHE_URLS と同じ順）
 */
function fetchPrecacheFiles() {
    return Promise.all(PRECACHE_URLS.map(url =>
        fetch(new Request(url, { cache: 'reload' })).then(response => {
            if (!response.ok) {
                throw new Error(`${url}: ${response.status}`);
            }
            return response;
        })
    ));
}

self.addEventListener('install', event => {
    self.skipWaiting();
    // 失敗したら install も失敗させる。古いキャッシュを残したまま、次の機会にやり直す
    event.waitUntil(
        fetchPrecacheFiles().then(responses =>
            caches.open(CACHE_NAME).then(cache =>
                Promise.all(responses.map((response, i) => cache.put(PRECACHE_URLS[i], response)))
            )
        )
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
                    // 同じサイトのGETで、正しく取得できたものだけをキャッシュに保存する
                    // （エラーの応答や、外部の解析用スクリプトを残し続けないため）
                    const sameOrigin = new URL(event.request.url).origin === self.location.origin;
                    if (event.request.method === 'GET' && sameOrigin && response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                }).catch(function(error) {
                    if (event.request.mode === 'navigate') {
                        // ページ遷移の失敗は通常のネットワークエラーとして伝える
                        throw error;
                    }
                    // サブリソースのみ、キャッシュにない場合は空レスポンスで返す
                    return new Response('', { status: 408, statusText: 'Network Error' });
                });
            }
        })
    );
});

// クライアントからのメッセージを受け取るリスナー
self.addEventListener('message', function(event) {
    if (!event.data) return;
    if (event.data.action === 'close') {
        self.clients.matchAll().then(function(clients) {
            clients.forEach(client => client.navigate(client.url));
        });
    }
    // 「更新」：最新のファイルがすべて取得できたときだけキャッシュを取り替える。
    // 先に消すと、オフラインや取得の失敗でアプリが開けなくなるため
    if (event.data.action === 'refresh') {
        const port = event.ports && event.ports[0];
        event.waitUntil(
            fetchPrecacheFiles()
                .then(responses => caches.open(CACHE_NAME).then(cache =>
                    Promise.all(responses.map((response, i) => cache.put(PRECACHE_URLS[i], response)))
                ))
                .then(() => port && port.postMessage({ ok: true }))
                .catch(error => {
                    console.error('Failed to refresh cache', error);
                    if (port) port.postMessage({ ok: false });
                })
        );
    }
});
