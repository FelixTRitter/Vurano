import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  // Verbindungen NICHT nach Inaktivität schließen (Default wäre 10 s):
  // Unter Windows läuft der Weg zur Datenbank durch die Portweiterleitung
  // von Docker Desktop, und jeder NEUE Verbindungsaufbau dort kann
  // sporadisch 1-3 s hängen. Stehende, warmgehaltene Verbindungen
  // vermeiden diese Aussetzer vollständig.
  idleTimeoutMillis: 0,      // 0 = nie wegen Inaktivität schließen
  keepAlive: true,           // TCP-Keepalive gegen stilles Kappen
  max: 10,                   // Obergrenze des Pools
  connectionTimeoutMillis: 5000, // klare Fehlermeldung statt endlosem Hängen
});

/** Bequemer Query-Helfer mit Typparameter für die Zeilenform. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as any[]);
  return result.rows;
}
