/**
 * ZENTRALES ÄNDERUNGSPROTOKOLL — Schreibhelfer
 * ---------------------------------------------------------------
 * Eine Funktion, mit der JEDES Modul eine CRUD-Änderung protokolliert.
 * Bewusst schlank gehalten: Der Aufrufer übergibt Tabelle, Datensatz-ID,
 * Aktion, den handelnden User (aus req.user) und den Datenstand
 * vorher/nachher. Alles Weitere (Zeitstempel, Speicherung) passiert hier.
 *
 * Grundsätze:
 *  - Fehler beim Protokollieren dürfen die eigentliche Fachaktion NIE
 *    scheitern lassen (best effort). Ein misslungenes Log wird geloggt,
 *    aber nicht an den Aufrufer durchgereicht.
 *  - Der User-Name wird als Klartext mitgespeichert, damit das Protokoll
 *    lesbar bleibt, selbst wenn der User später umbenannt oder gelöscht wird.
 *  - Für neue Tabellen ist nichts weiter nötig als ein Aufruf von auditLog()
 *    an der jeweiligen Insert-/Update-/Delete-Stelle (bzw. withAudit()).
 */
import { query } from '../db.js';

export type AuditAktion = 'create' | 'update' | 'delete';

export interface AuditActor {
  id?: number | null;
  name?: string | null;
}

export interface AuditEintrag {
  tabelle: string;
  datensatzId: string | number;
  aktion: AuditAktion;
  actor?: AuditActor | null;   // i. d. R. req.user
  vorher?: unknown;            // Datenstand vor der Änderung (bei create weglassen)
  nachher?: unknown;          // Datenstand nach der Änderung (bei delete weglassen)
}

/** Schreibt einen Protokolleintrag. Best effort — wirft nie. */
export async function auditLog(e: AuditEintrag): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (tabelle, datensatz_id, aktion, user_id, user_name, vorher, nachher)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        e.tabelle,
        String(e.datensatzId),
        e.aktion,
        e.actor?.id ?? null,
        e.actor?.name ?? null,
        e.vorher != null ? JSON.stringify(e.vorher) : null,
        e.nachher != null ? JSON.stringify(e.nachher) : null,
      ],
    );
  } catch (err) {
    // Protokollfehler nicht eskalieren — die Fachaktion war bereits erfolgreich.
    console.error('[audit] Protokolleintrag fehlgeschlagen:', (err as Error).message);
  }
}

// Felder, die NIE ins Klartext-Protokoll dürfen (Geheimnisse). Werden im
// Snapshot durch einen Platzhalter ersetzt, damit man zwar SIEHT, dass sich
// das Feld geändert hat, aber nie den tatsächlichen Wert protokolliert.
const GEHEIME_FELDER = new Set([
  'password_hash', 'passwort_hash', 'totp_secret', 'recovery_code_hash', 'code_hash',
]);

function maskiere(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = GEHEIME_FELDER.has(k) ? (v == null ? null : '***') : v;
  }
  return out;
}

/**
 * Liest den aktuellen Stand eines Datensatzes (für vorher/nachher-Snapshots).
 * Sensible Felder (Passwort-Hash, TOTP-Secret ...) werden maskiert.
 */
export async function ladeSnapshot(tabelle: string, id: string | number): Promise<unknown> {
  // Tabellenname stammt ausschließlich aus serverseitigem Code (nie aus
  // Nutzereingaben), daher ist die Interpolation hier unkritisch.
  const rows = await query(`SELECT * FROM ${tabelle} WHERE id = $1`, [id]);
  return maskiere((rows[0] as Record<string, unknown>) ?? null);
}
