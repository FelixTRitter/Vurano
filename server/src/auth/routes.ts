/**
 * AUTHENTIFIZIERUNG (Login mit Pflicht-2FA)
 * ---------------------------------------------------------------
 * Ablauf:
 *   POST /login {email, password}
 *     -> 2FA aktiv + Gerät vertraut:  volle Session      {ok:true}
 *     -> 2FA aktiv:                   pending-Session    {zweiterFaktor:true}
 *     -> 2FA noch nicht eingerichtet: pending-Session    {einrichtung:true}
 *   GET  /totp/setup        Geheimnis + otpauth-URL (nur pending, nicht aktiv)
 *   POST /totp/aktivieren   {code, geraetMerken} Erst-Code bestätigen ->
 *                           2FA scharf; Admins erhalten EINMALIG
 *                           Wiederherstellungscodes im Klartext zurück
 *   POST /totp              {code, geraetMerken} zweiter Faktor beim Login;
 *                           akzeptiert TOTP-Code ODER Wiederherstellungscode
 *   POST /logout, GET /me   wie gehabt
 * Rate-Limiting: max. 10 Fehlversuche / 15 min pro IP+Konto (Passwort
 * und Code getrennt gezählt), danach 429.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import {
  createSession, deleteSession, getPendingUser, aktiviereSession,
  createTrustedDevice, istVertrautesGeraet,
} from './session.js';
import { SESSION_COOKIE, readCookie, requireAuth } from './middleware.js';
import { generateSecret, verifyTotp, otpauthUrl, generateRecoveryCode, hashRecoveryCode } from './totp.js';
import { createLimiter } from './ratelimit.js';
import { erlaubteModuleFuer } from '../berechtigungen/zugriff.js';

export const authRouter = Router();
export const TRUSTED_COOKIE = 'erp_geraet';

const loginLimiter = createLimiter();
const codeLimiter = createLimiter();

const cookieOpts = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

function sessionCookie(res: any, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOpts, maxAge: 12 * 3600_000 });
}

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
  const key = `${req.ip}|${email.toLowerCase().trim()}`;
  if (loginLimiter.blockiert(key))
    return res.status(429).json({ error: 'Zu viele Fehlversuche — bitte 15 Minuten warten.' });

  const rows = await query<any>(
    'SELECT id, password_hash, totp_aktiv FROM users WHERE email = $1 AND active',
    [email.toLowerCase().trim()],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    loginLimiter.fehlversuch(key);
    return res.status(401).json({ error: 'Anmeldung fehlgeschlagen' });
  }
  loginLimiter.erfolg(key);

  // Vertrautes Gerät überspringt den Code (nur wenn 2FA überhaupt aktiv ist)
  const geraetToken = readCookie(req.headers.cookie, TRUSTED_COOKIE);
  if (user.totp_aktiv && geraetToken && (await istVertrautesGeraet(geraetToken, user.id))) {
    sessionCookie(res, await createSession(user.id));
    return res.json({ ok: true });
  }

  // pending-Session: bindet die folgenden 2FA-Schritte an diesen Login
  sessionCookie(res, await createSession(user.id, true));
  res.json(user.totp_aktiv ? { zweiterFaktor: true } : { einrichtung: true });
});

/** Einrichtung: Geheimnis erzeugen/liefern (nur solange 2FA nicht aktiv). */
authRouter.get('/totp/setup', async (req, res) => {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  const user = token ? await getPendingUser(token) : null;
  if (!user || user.totp_aktiv) return res.status(401).json({ error: 'Nicht zulässig.' });
  let secret = user.totp_secret;
  if (!secret) {
    secret = generateSecret();
    await query('UPDATE users SET totp_secret = $2 WHERE id = $1', [user.id, secret]);
  }
  res.json({ secret, url: otpauthUrl(user.email, secret) });
});

/** Erst-Code bestätigen -> 2FA scharf; Admins bekommen Wiederherstellungscodes. */
authRouter.post('/totp/aktivieren', async (req, res) => {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  const user = token ? await getPendingUser(token) : null;
  if (!user || user.totp_aktiv || !user.totp_secret) return res.status(401).json({ error: 'Nicht zulässig.' });
  if (!verifyTotp(user.totp_secret, req.body?.code))
    return res.status(400).json({ error: 'Code ungültig — bitte neu scannen bzw. aktuellen Code eingeben.' });

  await query('UPDATE users SET totp_aktiv = TRUE WHERE id = $1', [user.id]);
  await aktiviereSession(token!);
  if (req.body?.geraetMerken) {
    res.cookie(TRUSTED_COOKIE, await createTrustedDevice(user.id), { ...cookieOpts, maxAge: 30 * 24 * 3600_000 });
  }

  let recoveryCodes: string[] | undefined;
  if (user.role === 'admin') {
    recoveryCodes = Array.from({ length: 10 }, generateRecoveryCode);
    await query('DELETE FROM users_recovery_codes WHERE user_id = $1', [user.id]);
    for (const code of recoveryCodes) {
      await query('INSERT INTO users_recovery_codes (user_id, code_hash) VALUES ($1, $2)', [user.id, hashRecoveryCode(code)]);
    }
  }
  res.json({ ok: true, recoveryCodes });
});

/** Zweiter Faktor beim Login: TOTP-Code oder Wiederherstellungscode. */
authRouter.post('/totp', async (req, res) => {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  const user = token ? await getPendingUser(token) : null;
  if (!user || !user.totp_aktiv) return res.status(401).json({ error: 'Nicht zulässig.' });
  const key = `totp|${user.id}`;
  if (codeLimiter.blockiert(key))
    return res.status(429).json({ error: 'Zu viele Fehlversuche — bitte 15 Minuten warten.' });

  const eingabe = String(req.body?.code ?? '').trim();
  let gueltig = verifyTotp(user.totp_secret, eingabe);

  if (!gueltig && /^[A-Za-z2-7]{4}-[A-Za-z2-7]{4}$/.test(eingabe)) {
    // Wiederherstellungscode: einmalig verwendbar
    const geloescht = await query<any>(
      `UPDATE users_recovery_codes SET verwendet = TRUE
        WHERE user_id = $1 AND code_hash = $2 AND NOT verwendet RETURNING id`,
      [user.id, hashRecoveryCode(eingabe)],
    );
    gueltig = geloescht.length > 0;
  }

  if (!gueltig) {
    codeLimiter.fehlversuch(key);
    return res.status(400).json({ error: 'Code ungültig.' });
  }
  codeLimiter.erfolg(key);
  await aktiviereSession(token!);
  if (req.body?.geraetMerken) {
    res.cookie(TRUSTED_COOKIE, await createTrustedDevice(user.id), { ...cookieOpts, maxAge: 30 * 24 * 3600_000 });
  }
  res.json({ ok: true });
});

authRouter.post('/logout', async (req, res) => {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (token) await deleteSession(token);
  res.clearCookie(SESSION_COOKIE); // vertrautes Gerät bleibt bewusst bestehen
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const module = await erlaubteModuleFuer(req.user!.id);
  res.json({ ...req.user, module });
});
