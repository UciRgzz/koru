const CACHE_NAME = 'koru-v2';
const STATIC = ['/img/Koru_logo.jpeg'];

// Instalar y activar inmediatamente
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC))
  );
  self.skipWaiting(); // ← crítico: activa el SW sin esperar
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // ← crítico: toma control inmediato de todas las pestañas
});

// Fetch: pass-through (necesario para que Chrome mantenga el SW vivo)
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Mostrar notificación push
self.addEventListener('push', e => {
  if (!e.data) return;
  const { titulo, cuerpo, url } = e.data.json();

  e.waitUntil(
    self.registration.showNotification(titulo, {
      body:     cuerpo,
      icon:     '/img/Koru_logo.jpeg',
      badge:    '/img/Koru_logo.jpeg',
      vibrate:  [300, 100, 300, 100, 600],
      tag:      'koru-pedido',
      renotify: true,
      data:     { url },
      actions:  [{ action: 'ver', title: '👁 Ver mi pedido' }],
    })
  );
});

// Al tocar la notificación → abrir la URL correcta
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      // Buscar pestaña con esa URL exacta
      const match = lista.find(c => c.url.includes(url));
      if (match) return match.focus();
      return clients.openWindow(url); // Si no existe, abrir nueva
    })
  );
});