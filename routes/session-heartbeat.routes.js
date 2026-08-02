import { Router } from 'express';

import requireAuth from '../middleware/require-auth.js';
import requireCsrf from '../middleware/require-csrf.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

// Сам heartbeat ничего не сохраняет вручную:
// requireAuth обновляет lastUsedAt по SESSION_TOUCH_INTERVAL_MS.
router.post('/', requireAuth, requireCsrf, (req, res) => {
  return res.status(204).send();
});

export default router;
