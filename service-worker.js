// Отдельный Service Worker для Web Push. Не кеширует запросы и не
// вмешивается в работу сайта, форм и административной панели.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* malformed payload */ }
  event.waitUntil(self.registration.showNotification(data.title || 'RioCar', {
    body: data.body || 'Поступила новая заявка.',
    icon: '/site/img/riocar-push-192.png',
    badge: '/site/img/riocar-push-192.png',
    tag: data.tag || `riocar-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/admin/requests' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requested = String(event.notification.data?.url || '/admin/requests');
  const target = new URL(requested, self.location.origin);
  const safeTarget = target.origin === self.location.origin &&
    target.pathname.startsWith('/admin/') ? target.href :
    new URL('/admin/requests', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin &&
      new URL(client.url).pathname.startsWith('/admin/'));
    if (existing) {
      await existing.navigate(safeTarget);
      return existing.focus();
    }
    return clients.openWindow(safeTarget);
  })());
});
