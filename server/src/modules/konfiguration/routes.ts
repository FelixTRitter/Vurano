/**
 * Konfiguration: frei verwaltbare Rollen und Arbeitszeitmodelle.
 * Gleiches Muster wie die Adressschlüssel der Adressverwaltung
 * (Anlegen, Löschen mit In-Verwendung-Schutz).
 * Rollen tragen künftig die Modulberechtigungen (Ausbau folgt).
 */
import { Router } from 'express';
import { pool, query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { validateFirma, waehrungFuer, type FirmaLand } from './validation.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';

export const konfigurationRouter = Router();

function crud(table: 'rollen' | 'arbeitszeitmodelle', usedIn: string, usedCol: string) {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await query(`SELECT * FROM ${table} ORDER BY lower(name)`));
  });
  r.post('/', requireRole('admin', 'buero'), async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Name erforderlich.' });
    const exists = (await query(`SELECT id FROM ${table} WHERE lower(name) = lower($1)`, [name]))[0];
    if (exists) return res.status(400).json({ error: 'Eintrag existiert bereits.' });
    const row = (
      await query<{ id: string }>(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id`, [name])
    )[0];
    await auditLog({ tabelle: table, datensatzId: row.id, aktion: 'create', actor: req.user, nachher: { id: Number(row.id), name } });
    res.json({ id: Number(row.id), name });
  });
  r.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
    const inUse = Number(
      (await query<{ c: string }>(`SELECT COUNT(*) AS c FROM ${usedIn} WHERE ${usedCol} = $1`, [req.params.id]))[0].c,
    );
    if (inUse > 0)
      return res.status(400).json({ error: `Wird von ${inUse} Mitarbeiter(n) verwendet.` });
    const vorher = await ladeSnapshot(table, String(req.params.id));
    await query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    await auditLog({ tabelle: table, datensatzId: String(req.params.id), aktion: 'delete', actor: req.user, vorher });
    res.json({ ok: true });
  });
  return r;
}

/* ---------------- Stammdaten Firma (Singleton) ----------------
   GET für alle Rollen (Topbar-Branding, länderspezifische Labels),
   PUT nur admin/buero. Liefert die abgeleitete Bezugswährung mit. */
konfigurationRouter.get('/firma', async (_req, res) => {
  const [f, gf, banken] = await Promise.all([
    query<any>('SELECT * FROM firma_stammdaten WHERE id = TRUE'),
    query<any>('SELECT * FROM firma_geschaeftsfuehrung ORDER BY id'),
    query<any>('SELECT * FROM firma_banken ORDER BY id'),
  ]);
  res.json({ ...f[0], waehrung: waehrungFuer(f[0].land as FirmaLand), geschaeftsfuehrung: gf, banken });
});

konfigurationRouter.put('/firma', requireRole('admin', 'buero'), async (req, res) => {
  const r = validateFirma(req.body ?? {});
  if (!r.ok) return res.status(400).json({ error: r.error });
  const vorher = (await query<any>('SELECT * FROM firma_stammdaten WHERE id = TRUE'))[0];
  const v = r.value;
  // Alles in EINER Transaktion. Listen werden per Upsert gepflegt:
  // Zeilen mit id -> UPDATE, ohne id -> INSERT, weggelassene ids -> DELETE.
  // So bleiben Bank-IDs stabil (künftige Verweise aus Rechnungen/Zahlungen).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE firma_stammdaten SET firmenname=$1, rechtsform=$2, strasse=$3, plz=$4, ort=$5, land=$6,
              handelsregister_nummer=$7, register_stelle=$8, mwst_id=$9, steuernummer=$10,
              uid_nummer=$11, zaz_konto=$12, eori_nummer=$13, praeferenz_bewilligungen=$14,
              standard_sprache=$15
        WHERE id = TRUE`,
      [v.firmenname, v.rechtsform, v.strasse, v.plz, v.ort, v.land,
       v.handelsregister_nummer, v.register_stelle, v.mwst_id, v.steuernummer,
       v.uid_nummer, v.zaz_konto, v.eori_nummer, v.praeferenz_bewilligungen,
       v.standard_sprache],
    );

    const upsert = async (tabelle: string, spalten: string[], rows: any[]) => {
      const behalten: number[] = [];
      for (const row of rows) {
        if (row.id) {
          const set = spalten.map((c, i) => `${c}=$${i + 2}`).join(', ');
          await client.query(`UPDATE ${tabelle} SET ${set} WHERE id=$1`, [row.id, ...spalten.map((c) => row[c])]);
          behalten.push(row.id);
        } else {
          const ph = spalten.map((_, i) => `$${i + 1}`).join(', ');
          const neu = await client.query(
            `INSERT INTO ${tabelle} (${spalten.join(', ')}) VALUES (${ph}) RETURNING id`,
            spalten.map((c) => row[c]),
          );
          behalten.push(Number(neu.rows[0].id));
        }
      }
      if (behalten.length === 0) await client.query(`DELETE FROM ${tabelle}`);
      else await client.query(`DELETE FROM ${tabelle} WHERE NOT (id = ANY($1))`, [behalten]);
    };
    await upsert('firma_geschaeftsfuehrung', ['name', 'funktion'], v.geschaeftsfuehrung);
    await upsert('firma_banken', ['bezeichnung', 'iban', 'bic', 'ist_standard'], v.banken);

    await client.query('COMMIT');
    const nachher = (await query<any>('SELECT * FROM firma_stammdaten WHERE id = TRUE'))[0];
    await auditLog({ tabelle: 'firma_stammdaten', datensatzId: 'TRUE', aktion: 'update', actor: req.user, vorher, nachher });
    res.json({ ok: true, waehrung: waehrungFuer(v.land) });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// Hinweis: Die frühere Route /api/konfiguration/rollen (Mitarbeiter-
// Funktionsrollen) ist nach /api/stammdaten/funktionen umgezogen; die
// Tabelle "rollen" heißt jetzt "funktionen" (Migration 015).
konfigurationRouter.use('/arbeitszeitmodelle', crud('arbeitszeitmodelle', 'mitarbeiter', 'arbeitszeitmodell_id'));
