// Service Worker – KORU notificaciones push
const CACHE = 'koru-v1';

// Muestra la notificación cuando llega un push del servidor
self.addEventListener('push', event => {
  if (!event.data) return;
  const { titulo, cuerpo, url } = event.data.json();

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body:    cuerpo,
      icon:    '/img/Koru_logo.jpeg',
      badge:   '/img/Koru_logo.jpeg',
      vibrate: [300, 100, 300, 100, 600],
      tag:     'koru-pedido',          // reemplaza la notif anterior del mismo pedido
      renotify: true,
      data:    { url },
      actions: [{ action: 'ver', title: '👁 Ver mi pedido' }],
    })
  );
});

// Al tocar la notificación, abre o enfoca la página de seguimiento
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(lista => {
        for (const client of lista) {
          if ('focus' in client) { client.focus(); return; }
        }
        return clients.openWindow(url);
      })
  );
});
