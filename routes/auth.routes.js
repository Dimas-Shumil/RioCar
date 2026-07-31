import { randomBytes } from 'node:crypto';

import express from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import prisma from '../lib/prisma.js';

import requireAuth from '../middleware/require-auth.js';
import requireCsrf from '../middleware/require-csrf.js';
import validateOrigin from '../middleware/validate-origin.js';

import {
  createAdminSession,
  deleteAdminSession,
  rotateCsrfToken,
} from '../services/session.service.js';

import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getSessionCookieClearOptions,
} from '../config/security.js';

const router = express.Router();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

const loginSchema = z
  .object({
    login: z
      .string()
      .trim()
      .min(3)
      .max(64),

    password: z
      .string()
      .min(1)
      .max(128),
  })
  .strict();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  message: {
    success: false,
    message: 'Слишком много попыток входа. Повторите позже.',
  },
});

const dummyPasswordHashPromise = argon2.hash(
  randomBytes(32).toString('hex'),
  ARGON2_OPTIONS,
);

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');

  next();
});

// Вход

router.post(
  '/login',
  loginLimiter,
  validateOrigin,
  async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Проверьте логин и пароль.',
        });
      }

      const { login, password } = parsed.data;

      const admin = await prisma.admin.findUnique({
        where: {
          login,
        },
        select: {
          id: true,
          login: true,
          passwordHash: true,
        },
      });

      const passwordHash = admin
        ? admin.passwordHash
        : await dummyPasswordHashPromise;

      const passwordMatches = await argon2
        .verify(passwordHash, password)
        .catch(() => false);

      if (!admin || !passwordMatches) {
        return res.status(401).json({
          success: false,
          message: 'Неверный логин или пароль.',
        });
      }

      const {
        sessionToken,
        csrfToken,
      } = await createAdminSession({
        adminId: admin.id,
        req,
      });

      await prisma.admin.update({
        where: {
          id: admin.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      });

      res.cookie(
        SESSION_COOKIE_NAME,
        sessionToken,
        getSessionCookieOptions(),
      );

      return res.status(200).json({
        success: true,
        message: 'Авторизация выполнена.',

        admin: {
          id: admin.id,
          login: admin.login,
        },

        csrfToken,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// Проверка сессии

router.get(
  '/session',
  requireAuth,
  (req, res) => {
    return res.status(200).json({
      success: true,
      authenticated: true,

      admin: {
        id: req.auth.admin.id,
        login: req.auth.admin.login,
        lastLoginAt: req.auth.admin.lastLoginAt,
      },
    });
  },
);

// Получение нового CSRF-токена

router.post(
  '/csrf',
  validateOrigin,
  requireAuth,
  async (req, res, next) => {
    try {
      const csrfToken = await rotateCsrfToken(
        req.auth.session.id,
      );

      return res.status(200).json({
        success: true,
        csrfToken,
      });
    } catch (error) {
      return next(error);
    }
  },
);

// Выход

router.post(
  '/logout',
  validateOrigin,
  requireAuth,
  requireCsrf,
  async (req, res, next) => {
    try {
      await deleteAdminSession(
        req.auth.session.id,
      );

      res.clearCookie(
        SESSION_COOKIE_NAME,
        getSessionCookieClearOptions(),
      );

      return res.status(200).json({
        success: true,
        message: 'Вы вышли из админ-панели.',
      });
    } catch (error) {
      return next(error);
    }
  },
);

export default router;
