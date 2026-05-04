// Service worker mínimo: necesario para que Chrome marque la app como
// "instalable" y muestre el banner "Add to Home Screen". No cachea nada
// (la app necesita Supabase realtime), solo deja pasar las requests.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Sin handler intencionalmente: cada request va a network normal.
});
