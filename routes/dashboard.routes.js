import { Router } from 'express';

import prisma from '../lib/prisma.js';
import requireAuth from '../middleware/require-auth.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const now = new Date();

    const [
      leads,
      cars,
      hiddenCars,
      activePromotions,
      latestLeads,
    ] = await Promise.all([
      prisma.lead.count(),

      prisma.car.count(),

      prisma.car.count({
        where: {
          isActive: false,
        },
      }),

      prisma.publication.count({
        where: {
          type: 'PROMOTION',
          isActive: true,

          AND: [
            {
              OR: [
                { startsAt: null },
                { startsAt: { lte: now } },
              ],
            },
            {
              OR: [
                { endsAt: null },
                { endsAt: { gte: now } },
              ],
            },
          ],
        },
      }),

      prisma.lead.findMany({
        orderBy: {
          createdAt: 'desc',
        },

        take: 6,

        select: {
          id: true,
          name: true,
          phone: true,
          car: true,
          tripDate: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return res.status(200).json({
      stats: {
        leads,
        cars,
        hiddenCars,
        activePromotions,
      },

      latestLeads,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
