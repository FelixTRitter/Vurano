import type { Request, Response, NextFunction } from 'express';
import { getSessionUser, type SessionUser } from './session.js';

export const SESSION_COOKIE = 'erp_session';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

/** Minimaler Cookie-Parser — wir brauchen nur ein Cookie. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Hängt req.user an, falls eine gültige Session existiert. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (token) {
    const user = await getSessionUser(token);
    if (user) req.user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });
  next();
}

/**
 * Zugriffsberechtigung nach Rolle. Beispiel:
 *   router.post('/', requireRole('admin', 'buero'), handler)
 */
export function requireRole(...roles: SessionUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Nicht angemeldet' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Keine Berechtigung' });
    next();
  };
}
