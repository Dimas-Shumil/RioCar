import { Router } from 'express';

import prisma from '../lib/prisma.js';
import requireAuth from '../middleware/require-auth.js';
import requireCsrf from '../middleware/require-csrf.js';

const router = Router();

const LEAD_STATUSES = new Set(['NEW', 'IN_PROGRESS', 'CONTACTED', 'COMPLETED']);

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.use(requireAuth);

function parsePositiveInteger(value, fallback) {
  const number = Number.parseInt(String(value || ''), 10);

  if (!Number.isSafeInteger(number) || number < 1) {
    return fallback;
  }

  return number;
}

function parseLeadId(value) {
  const id = Number.parseInt(String(value || ''), 10);

  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return id;
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function requestMatchesSearch(request, search) {
  if (!search) {
    return true;
  }

  const fields = [
    request.name,
    request.phone,
    request.car,
    request.tripDate,
    request.carYear,
    request.carPrice,
    request.message,
  ];

  return fields.some((field) => normalizeSearch(field).includes(search));
}

function normalizeStatus(value) {
  const status = String(value || '')
    .trim()
    .toUpperCase();

  return LEAD_STATUSES.has(status) ? status : '';
}

/*
 * Получение списка заявок
 *
 * GET /api/admin/requests
 * GET /api/admin/requests?search=Павел
 * GET /api/admin/requests?status=NEW
 * GET /api/admin/requests?page=1&limit=20
 */
router.get('/', async (req, res, next) => {
  try {
    const search = normalizeSearch(req.query.search);
    const requestedStatus = String(req.query.status || '')
      .trim()
      .toUpperCase();

    if (
      requestedStatus &&
      requestedStatus !== 'ALL' &&
      !LEAD_STATUSES.has(requestedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Передан неизвестный статус заявки.',
      });
    }

    const status =
      requestedStatus && requestedStatus !== 'ALL' ? requestedStatus : '';

    const page = parsePositiveInteger(req.query.page, 1);

    const limit = Math.min(parsePositiveInteger(req.query.limit, 20), 50);

    const where = status
      ? {
          status,
        }
      : {};

    const [allRequests, groupedStatuses] = await Promise.all([
      prisma.lead.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          status: true,

          name: true,
          phone: true,
          car: true,

          tripDate: true,
          carYear: true,
          carPrice: true,
          message: true,
          page: true,

          createdAt: true,
          updatedAt: true,

          client: {
            select: {
              id: true,
              comment: true,
            },
          },
        },
      }),

      prisma.lead.groupBy({
        by: ['status'],

        _count: {
          _all: true,
        },
      }),
    ]);

    const filteredRequests = allRequests.filter((request) =>
      requestMatchesSearch(request, search),
    );

    const total = filteredRequests.length;

    const requests = filteredRequests.slice((page - 1) * limit, page * limit);

    const statusCounts = {
      ALL: 0,
      NEW: 0,
      IN_PROGRESS: 0,
      CONTACTED: 0,
      COMPLETED: 0,
    };

    groupedStatuses.forEach((item) => {
      const count = Number(item._count?._all) || 0;

      statusCounts[item.status] = count;
      statusCounts.ALL += count;
    });

    return res.status(200).json({
      success: true,

      requests,

      filters: {
        search,
        status: status || 'ALL',
        statusCounts,
      },

      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
});

/*
 * Получение одной заявки
 *
 * GET /api/admin/requests/1
 */
router.get('/:id', async (req, res, next) => {
  try {
    const requestId = parseLeadId(req.params.id);

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный идентификатор заявки.',
      });
    }

    const request = await prisma.lead.findUnique({
      where: {
        id: requestId,
      },

      select: {
        id: true,
        status: true,

        name: true,
        phone: true,
        car: true,

        tripDate: true,
        carYear: true,
        carPrice: true,
        message: true,
        page: true,

        createdAt: true,
        updatedAt: true,

        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            comment: true,
            createdAt: true,

            _count: {
              select: {
                leads: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена.',
      });
    }

    return res.status(200).json({
      success: true,
      request,
    });
  } catch (error) {
    return next(error);
  }
});

/*
 * Изменение статуса
 *
 * PATCH /api/admin/requests/1/status
 */
router.patch('/:id/status', requireCsrf, async (req, res, next) => {
  try {
    const requestId = parseLeadId(req.params.id);

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный идентификатор заявки.',
      });
    }

    const status = normalizeStatus(req.body?.status);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Выберите корректный статус заявки.',
      });
    }

    const existingRequest = await prisma.lead.findUnique({
      where: {
        id: requestId,
      },

      select: {
        id: true,
      },
    });

    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена.',
      });
    }

    const request = await prisma.lead.update({
      where: {
        id: requestId,
      },

      data: {
        status,
      },

      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Статус заявки обновлён.',
      request,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
