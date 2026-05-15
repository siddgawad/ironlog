import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const TOKEN_TTL = '30d';

export function signToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'NO_TOKEN' });
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }

  try {
    const user = await User.findById(payload.uid).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'USER_NOT_FOUND' });
    req.userId = user._id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
