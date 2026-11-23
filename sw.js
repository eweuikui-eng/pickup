/* 离线优先：壳子先缓存，瓦片按需存最近看过的 */
const VERSION = 'im-flat-mwtekn4k';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.bundle.js',
  './icon.png',
  './manifest.webmanifest',
  './cn-cities.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => null))
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

let tileOps = 0;

async function trimTiles(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > 500) {
    for (const req of keys.slice(0, keys.length - 400)) await cache.delete(req);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 版本文件永远要最新的，不能被缓存挡住
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(
        () => new Response('{}', { headers: { 'content-type': 'application/json' } })
      )
    );
    return;
  }

  // 地图瓦片
  if (url.hostname.endsWith('autonavi.com') || url.hostname.endsWith('datav.aliyun.com')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION + '-tiles');
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(req, res.clone());
            if (++tileOps % 40 === 0) trimTiles(VERSION + '-tiles');
          }
          return res;
        } catch (err) {
          return hit || Response.error();
        }
      })()
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // 页面导航：先网络，再缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(VERSION);
          cache.put('./index.html', res.clone());
          return res;
        } catch (err) {
          const cache = await caches.open(VERSION);
          return (await cache.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // 静态资源：先缓存
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return hit || Response.error();
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
