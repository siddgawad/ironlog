import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/booking/status — returns current consultation booking status
// Currently returns 'none' for all users (no booking system yet — WhatsApp first)
router.get('/status', requireAuth, async (_req, res) => {
  res.json({
    status: 'none',
    consultationType: null,
    nextCheckInDate: null,
    message: 'Book via WhatsApp to activate your plan.',
  });
});

export default router;
