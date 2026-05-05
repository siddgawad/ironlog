import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (password.length < 8) return res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'EMAIL_TAKEN' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, name });

    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, onboardingComplete: false },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        onboardingComplete: user.onboardingComplete,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const allowed = [
      'name', 'age', 'sex', 'weightKg', 'heightCm',
      'primaryGoal', 'experienceLevel', 'daysPerWeek', 'equipment',
      'currentLifts', 'targetLifts', 'notes', 'injuries',
    ];
    const update = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true })
      .select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/onboarding-complete', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { onboardingComplete: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
