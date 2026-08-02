import prisma from '../lib/prisma.js';

import {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
  getSessionCookieClearOptions,
} from '../config/security.js';

import { hashToken } from '../services/session.service.js';

function rejectRequest(res, pageMode = false) {
  res.clearCookie(
    SESSION_COOKIE_NAME,
    getSessionCookieClearOptions(),
  );

  if (pageMode) {
    return res.redirect(303, '/admin/login');
  }

  return res.status(401).json({
    success: false,
    message: 'Требуется авторизация.',
  });
}

async function authenticate(req, res, next, pageMode = false) {
  try {
    const rawToken = String(
      req.cookies?.[SESSION_COOKIE_NAME] || '',
    );

    if (!rawToken || rawToken.length > 256) {
      return rejectRequest(res, pageMode);
    }

    const session = await prisma.adminSession.findUnique({
      where: {
        tokenHash: hashToken(rawToken),
      },

      include: {
        admin: {
          select: {
            id: true,
            login: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!session) {
      return rejectRequest(res, pageMode);
    }

    const now = Date.now();

    const absoluteExpired =
      session.expiresAt.getTime() <= now;

    const idleExpired =
      session.lastUsedAt.getTime() +
        SESSION_IDLE_TTL_MS <=
      now;

    if (absoluteExpired || idleExpired) {
      await prisma.adminSession
        .delete({
          where: {
            id: session.id,
          },
        })
        .catch(() => undefined);

      return rejectRequest(res, pageMode);
    }

    const shouldTouchSession =
      session.lastUsedAt.getTime() +
        SESSION_TOUCH_INTERVAL_MS <=
      now;

    if (shouldTouchSession) {
      await prisma.adminSession.update({
        where: {
          id: session.id,
        },
        data: {
          lastUsedAt: new Date(now),
        },
      });
    }

    req.auth = {
      admin: session.admin,

      session: {
        id: session.id,
        csrfTokenHash: session.csrfTokenHash,
        expiresAt: session.expiresAt,
      },
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  return authenticate(req, res, next, false);
}

requireAuth.page = function requirePageAuth(req, res, next) {
  return authenticate(req, res, next, true);
};

export default requireAuth;
