import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

function rateLimitResponse(_req, res) {
  return res.status(429).json({ error: 'RATE_LIMIT' });
}

export function configureSecurity(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(
    mongoSanitize({
      replaceWith: '_',
    })
  );
}

export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse,
});

export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse,
});

export const aiLimiter = rateLimit({
  windowMs: ONE_MINUTE,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitResponse,
});
