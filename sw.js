/* 푸로찜 BUSINESS INTELLIGENCE · Service Worker
   정적 자산만 캐시한다. GAS API 응답(POST)은 절대 캐시하지 않는다. */
var CACHE = 'prozyme-bi-v1';
var SHELL = [
  './index.html',
  './manifest.json',
  './R9.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { /* 개별 실패는 무시 */ });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  // ① GAS / 외부 API : 절대 캐시하지 않음 (항상 네트워크)
  var url = req.url || '';
  if (req.method !== 'GET') return;                              // POST 는 SW 를 통과시키지 않음
  if (url.indexOf('script.google.com') >= 0) return;
  if (url.indexOf('api.notion.com') >= 0) return;

  // ② Chart.js CDN : 캐시 우선
  if (url.indexOf('cdn.jsdelivr.net') >= 0) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // ③ 문서/정적 자산 : 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
