const name = 'oax-evidence-shell-v3';
const assets = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(name).then((cache) => cache.addAll(assets)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('oax-evidence-shell-') && key !== name,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.search ||
    !assets.some(
      (asset) =>
        new URL(asset, self.registration.scope).pathname === url.pathname,
    )
  )
    return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});
