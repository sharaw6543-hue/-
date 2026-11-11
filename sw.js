// Апп болгон суулгах боломжтой болгох хамгийн энгийн service worker (кэшгүй).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
