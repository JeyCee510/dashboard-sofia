// Service worker de la PWA.
// No cachea nada (la app depende de Supabase realtime), pero sí maneja las
// notificaciones push del equipo (leads nuevos, pagos, comprobantes).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Sin handler intencionalmente: cada request va a network normal.
});

// ── Push: mostrar la notificación ──
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  const titulo = data.titulo || 'Dashboard Sofía';
  const opciones = {
    body: data.cuerpo || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'general',      // agrupa avisos del mismo tipo
    renotify: !!data.renotify,
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

// ── Tap en la notificación: enfocar la app (o abrirla) ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) { if (c.navigate) c.navigate(destino); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
