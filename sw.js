// Service worker : appli hors-ligne + notifications push.
const CACHE = 'tgvmax-v8';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/engine.js', 'js/stations.js', 'js/chat.js', 'js/worker.js', 'js/crypto.js', 'js/ui.js', 'js/sync.js', 'js/config.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => fetch(new Request(u, { cache: 'reload' })).then((r) => { if (r.ok) return c.put(u, r); }).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/data/max.json')) { // données : réseau d'abord, copie locale en secours
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req, { cache: 'no-cache' }).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'TGV MAX', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Place TGV MAX', {
    body: d.body || '', tag: d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './', book: d.book || 'https://www.sncf-connect.com/' },
    actions: [{ action: 'book', title: 'Réserver sur SNCF Connect' }], renotify: !!d.tag,
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = e.action === 'book' ? d.book : d.url;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    if (e.action !== 'book') { const c = cs.find((x) => 'focus' in x); if (c) return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
