/**
 * ZUGRIFFSAUFLÖSUNG — welche Module darf ein Benutzer sehen/benutzen?
 * ---------------------------------------------------------------
 * Ermittelt die freigeschalteten Modul-Keys eines Users anhand seiner
 * Zugriffsrolle. Admin-Rolle (ist_admin) -> alle Module (auch künftige).
 * Normale Rolle -> genau die in rollen_module hinterlegten Keys.
 *
 * 'einstellungen' ist ein persönlicher Bereich (eigenes Theme) und immer
 * erlaubt — sonst käme ein Benutzer nicht an seine eigenen Einstellungen.
 */
import { query } from '../db.js';
import { MODULE } from './module.js';

const IMMER_ERLAUBT = ['einstellungen'];

/** Liefert die erlaubten Modul-Keys für einen Benutzer (per User-ID). */
export async function erlaubteModuleFuer(userId: number): Promise<string[]> {
  const u = (await query<{ zugriffsrolle_id: number | null; ist_admin: boolean | null }>(
    `SELECT u.zugriffsrolle_id, br.ist_admin
       FROM users u LEFT JOIN berechtigungsrollen br ON u.zugriffsrolle_id = br.id
      WHERE u.id = $1`,
    [userId],
  ))[0];

  // Admin: Vollzugriff auf alle Module (per Definition, auch neue).
  if (u?.ist_admin) return MODULE.map((m) => m.key);

  // Normale Rolle: die freigeschalteten Keys + immer-erlaubte persönliche.
  const keys = u?.zugriffsrolle_id
    ? (await query<{ modul_key: string }>('SELECT modul_key FROM rollen_module WHERE rolle_id = $1', [u.zugriffsrolle_id]))
        .map((r) => r.modul_key)
    : [];
  return Array.from(new Set([...keys, ...IMMER_ERLAUBT]));
}
