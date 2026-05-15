import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/status', requireAuth, async (req, res) => {
  res.json({
    isPro: Boolean(req.user?.isPro),
    expiresAt: req.user?.proExpiresAt ?? null,
  });
});

export default router;
