import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const TOKEN_TTL = '30d';

export function signToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'NO_TOKEN' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}
