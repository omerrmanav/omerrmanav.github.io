// Service worker: uygulama kabuğu cache-first. fuel-price.json (günlük yakıt fiyatı) asla önbelleğe alınmaz: yalnızca ağ.
// Aynı alan adını paylaşan diğer projelerin önbelleklerine dokunmaz (yalnızca 'arac-shell-' ile başlayanları siler).
// Yeni sürüm yayınlarken SHELL_VERSION değerini artırın.
const SHELL_VERSION = 'v7';
const SHELL_CACHE = `arac-shell-${SHELL_VERSION}`;
const SHELL = [
  './', 'index.html', 'styles.css', 'reports.css', 'app.js', 'state.js', 'storage.js', 'dates.js',
  'format.js', 'icons.js', 'ui.js', 'forms.js', 'settings.js', 'provinces.js', 'fuelprice.js', 'calc.js', 'reports.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('arac-shell-') && n !== SHELL_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith('/fuel-price.json')) return; // ağ-yalnız: SW araya girmez
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (err) {
    if (req.mode === 'navigate') {
      const fallback = await caches.match('index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}
