import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import requireAuth from '../middleware/require-auth.js';
import requireCsrf from '../middleware/require-csrf.js';
import validateOrigin from '../middleware/validate-origin.js';
import { pushConfigured, sendTestNotification } from '../services/push.service.js';

const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireAuth);

const endpointSchema = z.string().url().max(3000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
});

const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().min(40).max(400).regex(/^[A-Za-z0-9_-]+$/),
    auth: z.string().min(8).max(200).regex(/^[A-Za-z0-9_-]+$/),
  }),
});

router.get('/status', async (req, res, next) => {
  try {
    const count = await prisma.pushSubscription.count({
      where: { adminId: req.auth.admin.id },
    });
    return res.json({
      success: true,
      configured: pushConfigured(),
      publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
      subscriptions: count,
    });
  } catch (error) { return next(error); }
});

router.post('/subscribe', validateOrigin, requireCsrf, async (req, res, next) => {
  try {
    if (!pushConfigured()) return res.status(503).json({
      success: false, message: 'Web Push не настроен на сервере.',
    });
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({
      success: false, message: 'Некорректная Push-подписка.',
    });
    const { endpoint, keys } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        adminId: req.auth.admin.id, endpoint, p256dh: keys.p256dh,
        auth: keys.auth, userAgent: String(req.get('user-agent') || '').slice(0, 500),
      },
      update: {
        adminId: req.auth.admin.id, p256dh: keys.p256dh, auth: keys.auth,
        userAgent: String(req.get('user-agent') || '').slice(0, 500),
      },
    });
    return res.status(201).json({ success: true });
  } catch (error) { return next(error); }
});

router.delete('/subscribe', validateOrigin, requireCsrf, async (req, res, next) => {
  try {
    const parsed = z.object({ endpoint: endpointSchema }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({
      success: false, message: 'Некорректная подписка.',
    });
    await prisma.pushSubscription.deleteMany({
      where: { adminId: req.auth.admin.id, endpoint: parsed.data.endpoint },
    });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

router.post('/test', validateOrigin, requireCsrf, async (req, res, next) => {
  try {
    if (!pushConfigured()) return res.status(503).json({
      success: false, message: 'Добавьте VAPID-ключи в .env.',
    });
    const result = await sendTestNotification(req.auth.admin.id);
    if (!result.sent) return res.status(409).json({
      success: false, message: 'Нет доступных Push-подписок или доставка не удалась.',
    });
    return res.json({ success: true, sent: result.sent });
  } catch (error) { return next(error); }
});

export default router;
