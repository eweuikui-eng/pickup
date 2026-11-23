const CACHE = 'pickup-v15';
const ASSETS = ['./', './index.html', './manifest.webmanifest',
                './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 页面本身：缓存优先，秒开；同时后台拉新版，下次打开就是新的
  if (req.mode === 'navigate') {
    const net = fetch(req).then(res => {
      if (res && res.ok) {
        return caches.open(CACHE)
          .then(c => c.put('./index.html', res.clone()))
          .then(() => res);
      }
      return res;
    }).catch(() => null);

    e.waitUntil(net.catch(() => {}));

    e.respondWith(
      caches.match('./index.html').then(cached => {
        if (cached) return cached;
        return net.then(res => res || caches.match('./'));
      })
    );
    return;
  }

  // 其它静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => r))
  );
});
