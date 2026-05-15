export function requirePro(req, res, next) {
  if (!req.user?.isPro) {
    return res.status(403).json({ error: 'PRO_REQUIRED', upgradeUrl: 'ironlog://upgrade' });
  }
  next();
}
