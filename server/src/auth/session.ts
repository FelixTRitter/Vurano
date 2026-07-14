/**
 * SESSION-VERWALTUNG
 * ---------------------------------------------------------------
 * Serverseitige Sessions in der Tabelle sessions: beim Login wird
 * ein Zufallstoken erzeugt und als httpOnly-Cookie gesetzt
 * (auth/routes.ts); attachUser (auth/middleware.ts) löst das Token
 * bei jedem Request zum Benutzer auf. Ablauf nach
 * config.sessionTtlHours; Passwortwechsel löscht alle Sessions
 * des Benutzers (modules/users).
 */
import crypto from 'node:crypto';
import { query } from '../db.js';
import { config } from '../config.js';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'buero' | 'monteur';
  theme: 'hell' | 'dunkel';
  akzentfarbe: string;
}

/** Session anlegen. pending=true zwischen Passwort- und 2FA-Schritt. */
export async function createSession(userId: number, pending = false): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionTtlHours * 3600_000);
  await query('INSERT INTO sessions (token, user_id, expires_at, pending) VALUES ($1, $2, $3, $4)', [
    token,
    userId,
    expires,
    pending,
  ]);
  return token;
}

/** Benutzer einer PENDING-Session (für die 2FA-Endpunkte, inkl. Geheimnis). */
export async function getPendingUser(token: string): Promise<any | null> {
  const rows = await query<any>(
    `SELECT u.id, u.email, u.role, u.totp_secret, u.totp_aktiv
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.pending AND s.expires_at > now() AND u.active`,
    [token],
  );
  return rows[0] ?? null;
}

/** Pending-Session nach erfolgreichem zweiten Faktor scharfschalten. */
export async function aktiviereSession(token: string): Promise<void> {
  await query('UPDATE sessions SET pending = FALSE WHERE token = $1', [token]);
}

/* ---------------- Vertrauenswürdige Geräte (30 Tage) ---------------- */
export async function createTrustedDevice(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await query('INSERT INTO trusted_devices (token, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')', [token, userId]);
  return token;
}

export async function istVertrautesGeraet(token: string, userId: number): Promise<boolean> {
  const rows = await query('SELECT 1 FROM trusted_devices WHERE token = $1 AND user_id = $2 AND expires_at > now()', [token, userId]);
  return rows.length > 0;
}

export async function getSessionUser(token: string): Promise<SessionUser | null> {
  const rows = await query<SessionUser>(
    `SELECT u.id, u.email, u.name, u.role, u.theme, u.akzentfarbe
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND NOT s.pending AND s.expires_at > now() AND u.active`,
    [token],
  );
  return rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}
