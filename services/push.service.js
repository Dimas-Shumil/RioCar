import webpush from 'web-push';
import prisma from '../lib/prisma.js';

const configured = Boolean(
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT,
);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export function pushConfigured() {
  return configured;
}

// Только администраторы могут добавлять/удалять подписки.
// Отправка не является частью транзакции создания заявки.
export async function sendNewLeadNotification(lead) {
  if (!configured) return { sent: 0, disabled: true };

  const subscriptions = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const payload = JSON.stringify({
    title: `RioCar · Новая заявка №${lead.id}`,
    body: `${lead.name} · ${lead.car} · ${lead.phone}`,
    url: `/admin/requests?lead=${lead.id}`,
    tag: `riocar-lead-${lead.id}`,
  });

  const results = await Promise.allSettled(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60, timeout: 7000 },
      );
      return 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      } else {
        console.error('RioCar Web Push:', error.message);
      }
      return 0;
    }
  }));

  return { sent: results.reduce((count, entry) => count +
    (entry.status === 'fulfilled' ? entry.value : 0), 0) };
}

export async function sendTestNotification(adminId) {
  if (!configured) return { sent: 0, disabled: true };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { adminId },
  });
  const payload = JSON.stringify({
    title: 'RioCar · Проверка уведомлений',
    body: 'Push-уведомления работают. Новые заявки будут приходить сюда.',
    url: '/admin/requests',
    tag: `riocar-test-${Date.now()}`,
  });
  const results = await Promise.allSettled(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 300, timeout: 7000 },
      );
      return 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      } else {
        console.error('RioCar Web Push test:', error.message);
      }
      return 0;
    }
  }));
  return { sent: results.reduce((count, entry) => count +
    (entry.status === 'fulfilled' ? entry.value : 0), 0) };
}
