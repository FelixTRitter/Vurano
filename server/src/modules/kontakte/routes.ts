/**
 * Adressverwaltung (Personen & Firmen) + Adressschlüssel.
 * Portierung von Immo Control routes/kontakte.js: gleiche Endpunkte, Felder
 * und Antwortformen; SQL von sql.js/SQLite nach PostgreSQL übersetzt
 * (LIKE→ILIKE, COLLATE NOCASE→lower(), last_insert_rowid→RETURNING id),
 * N+1-Zeilenabfragen durch zwei Sammelabfragen ersetzt.
 * Lesen: alle angemeldeten Rollen. Schreiben: admin und buero.
 */
import { Router } from 'express';
import { pool, query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { FIELDS, pick, validate } from './validation.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';

export const kontakteRouter = Router();

/** Adressschlüssel-Zuordnung neu setzen (in einer Transaktion des Aufrufers). */
async function setKategorien(client: { query: Function }, kontaktId: number | string, ids: unknown): Promise<void> {
  await client.query('DELETE FROM kontakt_kategorie_map WHERE kontakt_id = $1', [kontaktId]);
  // Eingabe deduplizieren (zusätzlich zu PK + ON CONFLICT): derselbe
  // Adressschlüssel darf einem Kontakt nie mehrfach zugewiesen werden.
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean).map((x) => Number(x)))];
  for (const kid of list) {
    await client.query(
      'INSERT INTO kontakt_kategorie_map (kontakt_id, kategorie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [kontaktId, kid],
    );
  }
}

/* ----------------------------- Kategorien ----------------------------- */
// (vor /:id definieren, damit "kategorien" nicht als id interpretiert wird)
kontakteRouter.get('/kategorien', async (_req, res) => {
  res.json(await query('SELECT * FROM kontakt_kategorien ORDER BY lower(name)'));
});

kontakteRouter.post('/kategorien', requireRole('admin', 'buero'), async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Name erforderlich.' });
  const exists = (
    await query('SELECT id FROM kontakt_kategorien WHERE lower(name) = lower($1)', [name])
  )[0];
  if (exists) return res.status(400).json({ error: 'Kategorie existiert bereits.' });
  const row = (
    await query<{ id: string }>('INSERT INTO kontakt_kategorien (name) VALUES ($1) RETURNING id', [name])
  )[0];
  res.json({ id: Number(row.id), name });
});

kontakteRouter.delete('/kategorien/:id', requireRole('admin', 'buero'), async (req, res) => {
  const inUse = Number(
    (
      await query<{ c: string }>(
        'SELECT COUNT(*) AS c FROM kontakt_kategorie_map WHERE kategorie_id = $1',
        [req.params.id],
      )
    )[0].c,
  );
  if (inUse > 0)
    return res.status(400).json({ error: `Adressschlüssel wird von ${inUse} Adresse(n) verwendet.` });
  await query('DELETE FROM kontakt_kategorien WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ----------------------------- Kontakte ----------------------------- */
kontakteRouter.get('/', async (req, res) => {
  const { suche, typ, kategorie } = req.query as Record<string, string | undefined>;
  let sql = `
    SELECT k.*,
      CASE WHEN k.typ='firma' THEN k.firmenname
           ELSE TRIM(COALESCE(k.vorname,'') || ' ' || COALESCE(k.nachname,'')) END AS display_name,
      f.firmenname AS firma_name
    FROM kontakte k
    LEFT JOIN kontakte f ON k.firma_id = f.id
    WHERE 1=1`;
  const params: unknown[] = [];
  if (typ) { params.push(typ); sql += ` AND k.typ = $${params.length}`; }
  if (kategorie) {
    params.push(kategorie);
    sql += ` AND EXISTS (SELECT 1 FROM kontakt_kategorie_map m WHERE m.kontakt_id = k.id AND m.kategorie_id = $${params.length})`;
  }
  if (suche) {
    params.push(`%${suche}%`);
    const p = `$${params.length}`;
    sql += ` AND (k.vorname ILIKE ${p} OR k.nachname ILIKE ${p} OR k.firmenname ILIKE ${p} OR k.email ILIKE ${p} OR k.ort ILIKE ${p})`;
  }
  sql += ' ORDER BY lower(CASE WHEN k.typ=\'firma\' THEN k.firmenname ELSE TRIM(COALESCE(k.vorname,\'\') || \' \' || COALESCE(k.nachname,\'\')) END)';
  const rows = await query<any>(sql, params);

  // Adressschlüssel und Firmen-Personen gesammelt nachladen (statt N+1)
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    const kats = await query<any>(
      `SELECT m.kontakt_id, kat.id, kat.name
         FROM kontakt_kategorie_map m JOIN kontakt_kategorien kat ON m.kategorie_id = kat.id
        WHERE m.kontakt_id = ANY($1) ORDER BY lower(kat.name)`,
      [ids],
    );
    const personen = await query<any>(
      `SELECT firma_id, id, TRIM(COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) AS display_name
         FROM kontakte WHERE firma_id = ANY($1) ORDER BY lower(COALESCE(nachname,''))`,
      [ids],
    );
    for (const k of rows) {
      k.kategorien = kats
        .filter((c) => String(c.kontakt_id) === String(k.id))
        .map((c) => ({ id: Number(c.id), name: c.name }));
      if (k.typ === 'firma')
        k.personen = personen
          .filter((p) => String(p.firma_id) === String(k.id))
          .map((p) => ({ id: Number(p.id), display_name: p.display_name }));
    }
  }
  res.json(rows);
});

/** Personen ohne Firmenzuordnung (Auswahl für "bestehende Person als Ansprechpartner"). */
kontakteRouter.get('/personen/frei', async (_req, res) => {
  res.json(await query(
    `SELECT id, anrede, vorname, nachname, email, telefon, mobil
       FROM kontakte WHERE typ = 'person' AND firma_id IS NULL
      ORDER BY lower(nachname), lower(vorname)`,
  ));
});

kontakteRouter.get('/:id', async (req, res) => {
  const k = (await query<any>('SELECT * FROM kontakte WHERE id = $1', [req.params.id]))[0];
  if (!k) return res.status(404).json({ error: 'Nicht gefunden.' });
  const katRows = await query<{ id: string; name: string }>(
    `SELECT kat.id, kat.name FROM kontakt_kategorie_map m
       JOIN kontakt_kategorien kat ON m.kategorie_id = kat.id
      WHERE m.kontakt_id = $1 ORDER BY lower(kat.name)`,
    [req.params.id],
  );
  k.kategorie_ids = katRows.map((r) => Number(r.id));
  k.kategorien = katRows.map((r) => ({ id: Number(r.id), name: r.name }));
  // Firma: verknüpfte Ansprechpartner (Personen) mitliefern
  if (k.typ === 'firma') {
    k.ansprechpartner = await query<any>(
      `SELECT id, anrede, vorname, nachname, position, sprache, firma_email, firma_telefon, firma_mobil, mobil, email
         FROM kontakte WHERE firma_id = $1 AND typ = 'person'
        ORDER BY lower(nachname), lower(vorname)`,
      [req.params.id],
    );
  }
  // Person: zugeordnete Firma (Name) mitliefern
  if (k.typ === 'person' && k.firma_id) {
    const f = (await query<any>('SELECT firmenname FROM kontakte WHERE id = $1', [k.firma_id]))[0];
    k.firma_name = f?.firmenname ?? null;
  }
  res.json(k);
});

/** Ansprechpartner im Firmenkontext aktualisieren: NUR erlaubte Felder
    (Anrede/Name + geschäftliche Rollendaten). Private Felder (private
    E-Mail, private Anschrift, Geburtsdatum ...) bleiben unangetastet —
    kein Vollersatz, gezieltes Whitelist-Update. */
kontakteRouter.put('/:id/rolle', requireRole('admin', 'buero'), async (req, res) => {
  const erlaubt = ['anrede', 'vorname', 'nachname', 'position', 'firma_email', 'firma_telefon', 'firma_mobil'] as const;
  const sets: string[] = [];
  const werte: unknown[] = [req.params.id];
  for (const f of erlaubt) {
    if (req.body?.[f] !== undefined) {
      werte.push(req.body[f] === '' ? null : req.body[f]);
      sets.push(`${f} = $${werte.length}`);
    }
  }
  if (sets.length === 0) return res.json({ ok: true });
  await query(`UPDATE kontakte SET ${sets.join(', ')} WHERE id = $1 AND typ = 'person'`, werte);
  res.json({ ok: true });
});


/* ------------- Ansprechpartner (Person <-> Firma) ------------- */
/* Ein Ansprechpartner IST eine Person mit gesetzter firma_id. Anlegen =
   Person mit firma_id anlegen; Zuordnen/Verschieben = firma_id ändern;
   Entfernen = firma_id auf NULL (Person bleibt erhalten, wird NICHT
   gelöscht). Löschen der Person läuft wie bei jedem Kontakt über DELETE /:id. */
kontakteRouter.post('/:firmaId/ansprechpartner', requireRole('admin', 'buero'), async (req, res) => {
  const firma = (await query<any>('SELECT id FROM kontakte WHERE id = $1 AND typ = $2', [req.params.firmaId, 'firma']))[0];
  if (!firma) return res.status(404).json({ error: 'Firma nicht gefunden.' });
  const d = pick({ ...req.body, typ: 'person', firma_id: Number(req.params.firmaId) });
  const err = validate(d);
  if (err) return res.status(400).json({ error: err });
  const cols = FIELDS.join(', ');
  const ph = FIELDS.map((_, i) => `$${i + 1}`).join(', ');
  const row = (await query<any>(`INSERT INTO kontakte (${cols}) VALUES (${ph}) RETURNING id`, FIELDS.map((f) => d[f])))[0];
  res.json({ id: Number(row.id) });
});

/** Bestehende Person einer Firma zuordnen oder zu anderer Firma verschieben
    (firma_id=null löst die Zuordnung). Optional werden geschäftliche
    Rollendaten (position, firma_email, firma_telefon, firma_mobil) mitgesetzt —
    gezieltes Teilupdate, KEIN Vollersatz der Person. */
kontakteRouter.put('/:id/firma', requireRole('admin', 'buero'), async (req, res) => {
  const zielId = req.body?.firma_id != null ? Number(req.body.firma_id) : null;
  if (zielId !== null) {
    const firma = (await query<any>('SELECT id FROM kontakte WHERE id = $1 AND typ = $2', [zielId, 'firma']))[0];
    if (!firma) return res.status(400).json({ error: 'Zielfirma nicht gefunden.' });
  }
  // Nur ausdrücklich übergebene Rollenfelder aktualisieren
  const rollenfelder = ['position', 'firma_email', 'firma_telefon', 'firma_mobil'] as const;
  const sets: string[] = ['firma_id = $2'];
  const werte: unknown[] = [req.params.id, zielId];
  for (const f of rollenfelder) {
    if (req.body?.[f] !== undefined) {
      werte.push(req.body[f] === '' ? null : req.body[f]);
      sets.push(`${f} = $${werte.length}`);
    }
  }
  await query(`UPDATE kontakte SET ${sets.join(', ')} WHERE id = $1 AND typ = 'person'`, werte);
  res.json({ ok: true });
});

kontakteRouter.post('/', requireRole('admin', 'buero'), async (req, res) => {
  const d = pick(req.body ?? {});
  const err = validate(d);
  if (err) return res.status(400).json({ error: err });
  const cols = FIELDS.join(', ');
  const ph = FIELDS.map((_, i) => `$${i + 1}`).join(', ');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (
      await client.query(`INSERT INTO kontakte (${cols}) VALUES (${ph}) RETURNING id`, FIELDS.map((f) => d[f]))
    ).rows[0];
    await setKategorien(client, row.id, req.body?.kategorie_ids);
    await client.query('COMMIT');
    await auditLog({ tabelle: 'kontakte', datensatzId: row.id, aktion: 'create',
      actor: req.user, nachher: await ladeSnapshot('kontakte', row.id) });
    res.json({ id: Number(row.id) });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

kontakteRouter.put('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const exists = (await query('SELECT id FROM kontakte WHERE id = $1', [req.params.id]))[0];
  if (!exists) return res.status(404).json({ error: 'Nicht gefunden.' });
  const vorher = await ladeSnapshot('kontakte', String(req.params.id));
  const err = validate(pick(req.body ?? {}));
  if (err) return res.status(400).json({ error: err });
  // TEILUPDATE statt Vollersatz: nur Felder aktualisieren, die tatsächlich im
  // Request stehen. Sonst löscht ein Formular, das nicht alle Spalten kennt
  // (z. B. das Personenformular ohne die Ansprechpartner-Rollenfelder
  // position/firma_email/firma_telefon/firma_mobil/sprache), diese Werte auf
  // NULL — genau der beobachtete Datenverlust beim Bearbeiten einer Person,
  // die zugleich Ansprechpartner ist.
  const felder = FIELDS.filter((f) => req.body?.[f] !== undefined);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (felder.length > 0) {
      const set = felder.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const werte = felder.map((f) => {
        const v = req.body[f];
        return typeof v === 'string' && v.trim() === '' ? null : v;
      });
      await client.query(`UPDATE kontakte SET ${set} WHERE id = $${felder.length + 1}`, [...werte, req.params.id]);
    }
    if (req.body?.kategorie_ids !== undefined) await setKategorien(client, String(req.params.id), req.body.kategorie_ids);
    await client.query('COMMIT');
    await auditLog({ tabelle: 'kontakte', datensatzId: String(req.params.id), aktion: 'update',
      actor: req.user, vorher, nachher: await ladeSnapshot('kontakte', String(req.params.id)) });
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

kontakteRouter.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('kontakte', String(req.params.id));
  // firma_id wird per ON DELETE SET NULL gelöst, die Map per ON DELETE CASCADE
  await query('DELETE FROM kontakte WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'kontakte', datensatzId: String(req.params.id), aktion: 'delete',
    actor: req.user, vorher });
  res.json({ ok: true });
});
