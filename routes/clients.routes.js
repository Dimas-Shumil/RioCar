import { Router } from 'express';

import prisma from '../lib/prisma.js';
import requireAuth from '../middleware/require-auth.js';
import requireCsrf from '../middleware/require-csrf.js';

const router = Router();

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

function parseClientId(value) {
  const id = Number.parseInt(String(value || ''), 10);

  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return id;
}

function normalizeText(value, maxLength = 500) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/\s+/g, ' ')
    .trim();
}

function clientMatchesSearch(client, search) {
  if (!search) {
    return true;
  }

  const fields = [client.name, client.phone, client.comment];

  return fields.some((field) => normalizeSearchText(field).includes(search));
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    digits = `7${digits}`;
  }

  if (digits.length !== 11 || !digits.startsWith('79')) {
    return '';
  }

  return `+7 (${digits.slice(1, 4)}) ${digits.slice(
    4,
    7,
  )}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

/*
 * Список клиентов
 *
 * GET /api/admin/clients
 * GET /api/admin/clients?search=Павел
 * GET /api/admin/clients?page=1&limit=20
 */
router.get('/', async (req, res, next) => {
  try {
    const search = normalizeSearchText(normalizeText(req.query.search, 100));

    const page = parsePositiveInteger(req.query.page, 1);

    const limit = Math.min(parsePositiveInteger(req.query.limit, 20), 50);

    const allClients = await prisma.client.findMany({
      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,
        name: true,
        phone: true,
        comment: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            leads: true,
          },
        },

        leads: {
          orderBy: {
            createdAt: 'desc',
          },

          take: 1,

          select: {
            id: true,
            status: true,
            car: true,
            tripDate: true,
            createdAt: true,
          },
        },
      },
    });

    const filteredClients = allClients.filter((client) =>
      clientMatchesSearch(client, search),
    );

    const total = filteredClients.length;

    const clients = filteredClients.slice((page - 1) * limit, page * limit);

    return res.status(200).json({
      success: true,

      clients,

      filters: {
        search,
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
 * Ручное добавление клиента
 *
 * POST /api/admin/clients
 */
router.post('/', requireCsrf, async (req, res, next) => {
  try {
    const name = normalizeText(req.body?.name, 60);
    const phone = normalizePhone(req.body?.phone);
    const comment = normalizeText(req.body?.comment, 1000);

    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректное имя клиента.',
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный номер телефона.',
      });
    }

    const existingClient = await prisma.client.findUnique({
      where: {
        phone,
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: `Клиент с таким телефоном уже существует: ${existingClient.name}.`,
        clientId: existingClient.id,
      });
    }

    const client = await prisma.client.create({
      data: {
        name,
        phone,
        comment: comment || null,
      },

      select: {
        id: true,
        name: true,
        phone: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Клиент добавлен.',
      client,
    });
  } catch (error) {
    return next(error);
  }
});

/*
 * Карточка клиента и история заявок
 *
 * GET /api/admin/clients/1
 */
router.get('/:id', async (req, res, next) => {
  try {
    const clientId = parseClientId(req.params.id);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный идентификатор клиента.',
      });
    }

    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
      },

      select: {
        id: true,
        name: true,
        phone: true,
        comment: true,
        createdAt: true,
        updatedAt: true,

        leads: {
          orderBy: {
            createdAt: 'desc',
          },

          select: {
            id: true,
            status: true,

            car: true,
            tripDate: true,
            carYear: true,
            carPrice: true,
            message: true,
            page: true,

            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Клиент не найден.',
      });
    }

    return res.status(200).json({
      success: true,
      client,
    });
  } catch (error) {
    return next(error);
  }
});

/*
 * Изменение данных клиента
 *
 * PATCH /api/admin/clients/1
 */
router.patch('/:id', requireCsrf, async (req, res, next) => {
  try {
    const clientId = parseClientId(req.params.id);

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный идентификатор клиента.',
      });
    }

    const name = normalizeText(req.body?.name, 60);

    const phone = normalizePhone(req.body?.phone);

    const comment = normalizeText(req.body?.comment, 1000);

    if (name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректное имя клиента.',
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Введите корректный номер телефона.',
      });
    }

    const existingClient = await prisma.client.findUnique({
      where: {
        id: clientId,
      },

      select: {
        id: true,
        phone: true,
      },
    });

    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: 'Клиент не найден.',
      });
    }

    const phoneOwner = await prisma.client.findUnique({
      where: {
        phone,
      },

      select: {
        id: true,
      },
    });

    if (phoneOwner && phoneOwner.id !== clientId) {
      return res.status(409).json({
        success: false,
        message: 'Клиент с таким телефоном уже существует.',
      });
    }

    const client = await prisma.client.update({
      where: {
        id: clientId,
      },

      data: {
        name,
        phone,
        comment: comment || null,
      },

      select: {
        id: true,
        name: true,
        phone: true,
        comment: true,
        updatedAt: true,
      },
    });

    /*
     * Обновляем имя и телефон в заявках клиента,
     * чтобы старые заявки не показывали устаревшие данные.
     */
    await prisma.lead.updateMany({
      where: {
        clientId,
      },

      data: {
        name,
        phone,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Данные клиента обновлены.',
      client,
    });
  } catch (error) {
    return next(error);
  }
});

/*
 * Удаление клиента
 *
 * DELETE /api/admin/clients/1
 *
 * Удалять разрешено только клиента без заявок.
 */
router.delete(
  '/:id',
  requireCsrf,
  async (req, res, next) => {
    try {
      const clientId = parseClientId(req.params.id);

      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный идентификатор клиента.',
        });
      }

      const client = await prisma.client.findUnique({
        where: {
          id: clientId,
        },

        select: {
          id: true,
          name: true,

          _count: {
            select: {
              leads: true,
            },
          },
        },
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Клиент не найден.',
        });
      }

      if (client._count.leads > 0) {
        return res.status(409).json({
          success: false,
          message:
            'Нельзя удалить клиента, у которого есть заявки. История обращений должна быть сохранена.',
        });
      }

      await prisma.client.delete({
        where: {
          id: clientId,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Клиент удалён.',
        deletedClientId: clientId,
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
