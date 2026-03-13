self.addEventListener('push', (event) => {
  const datos = event.data?.json() ?? {};

  event.waitUntil(
    self.registration.showNotification(datos.titulo ?? 'Beauty Time Pro', {
      body: datos.cuerpo,
      icon: datos.icono ?? '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: datos.url ?? '/' },
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});