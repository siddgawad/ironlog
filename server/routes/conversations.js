import { Router } from 'express';
import Conversation from '../models/Conversation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Returns the user's single chat thread, optionally paginated.
// Newest messages last (so client can append-render).
router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const before = req.query.before; // ISO date — only return messages before this

    let convo = await Conversation.findOne({ userId: req.userId });
    if (!convo) {
      convo = await Conversation.create({ userId: req.userId, messages: [] });
    }

    let messages = convo.messages;
    if (before) {
      const cutoff = new Date(before);
      messages = messages.filter((m) => m.timestamp < cutoff);
    }

    // Take last N (most recent within limit)
    const slice = messages.slice(-limit);
    const hasMore = messages.length > limit;

    res.json({
      messages: slice,
      hasMore,
      totalCount: convo.messages.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    await Conversation.findOneAndUpdate(
      { userId: req.userId },
      { messages: [] }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
