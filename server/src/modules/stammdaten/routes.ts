/**
 * STAMMDATEN — Funktionen & Qualifikationen
 * ---------------------------------------------------------------
 * Zwei frei verwaltbare Stammdatenlisten für die Mitarbeiterverwaltung:
 *  - Funktionen: Stellenbezeichnung/Position (Projektleiter, Fertigung …),
 *    ein Mitarbeiter hat genau eine.
 *  - Qualifikationen: Fähigkeiten/Skills (Elektriker, AutoCAD …), ein
 *    Mitarbeiter kann mehrere haben.
 * Gepflegte Listen verhindern Wildwuchs (z. B. "Produktions-" vs.
 * "Fertigungsmitarbeiter"). Anlegen/Löschen mit In-Verwendung-Schutz.
 */
import { Router } from 'express';
import { query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';

export const stammdatenRouter = Router();

/**
 * Baut CRUD-Endpunkte für eine einfache Stammdatentabelle (id, name).
 * usedCheck zählt Verwendungen, damit nichts gelöscht wird, das noch hängt.
 */
function stammdatenCrud(tabelle: 'funktionen' | 'qualifikationen', usedCheck: (id: string) => Promise<number>, usedLabel: string) {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await query(`SELECT id, name FROM ${tabelle} ORDER BY lower(name)`));
  });
  r.post('/', requireRole('admin', 'buero'), async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Name erforderlich.' });
    const exists = (await query(`SELECT id FROM ${tabelle} WHERE lower(name) = lower($1)`, [name]))[0];
    if (exists) return res.status(400).json({ error: 'Eintrag existiert bereits.' });
    const row = (await query<{ id: string }>(`INSERT INTO ${tabelle} (name) VALUES ($1) RETURNING id`, [name]))[0];
    await auditLog({ tabelle, datensatzId: row.id, aktion: 'create', actor: req.user, nachher: { id: Number(row.id), name } });
    res.json({ id: Number(row.id), name });
  });
  r.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
    const inUse = await usedCheck(String(req.params.id));
    if (inUse > 0) return res.status(400).json({ error: `Wird von ${inUse} Mitarbeiter(n) verwendet.` });
    const vorher = await ladeSnapshot(tabelle, String(req.params.id));
    await query(`DELETE FROM ${tabelle} WHERE id = $1`, [req.params.id]);
    await auditLog({ tabelle, datensatzId: String(req.params.id), aktion: 'delete', actor: req.user, vorher });
    res.json({ ok: true });
  });
  return r;
}

const zaehleFunktion = async (id: string) =>
  Number((await query<{ c: string }>('SELECT COUNT(*) AS c FROM mitarbeiter WHERE funktion_id = $1', [id]))[0].c);
const zaehleQualifikation = async (id: string) =>
  Number((await query<{ c: string }>('SELECT COUNT(*) AS c FROM mitarbeiter_qualifikationen WHERE qualifikation_id = $1', [id]))[0].c);

stammdatenRouter.use('/funktionen', stammdatenCrud('funktionen', zaehleFunktion, 'Mitarbeiter'));
stammdatenRouter.use('/qualifikationen', stammdatenCrud('qualifikationen', zaehleQualifikation, 'Mitarbeiter'));

/* -------------------- Einheiten -------------------- */
/* Eigenständig, weil Einheiten zwei Felder (kuerzel/name) und eine
   Bearbeiten-Funktion haben. Sortierung: erst nach sortierung, dann Kürzel. */
const einheitenRouter = Router();

einheitenRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT id, kuerzel, name, sortierung FROM einheiten ORDER BY sortierung, lower(kuerzel)'));
});

einheitenRouter.post('/', requireRole('admin', 'buero'), async (req, res) => {
  const kuerzel = String(req.body?.kuerzel ?? '').trim();
  const name = String(req.body?.name ?? '').trim() || null;
  if (!kuerzel) return res.status(400).json({ error: 'Kürzel erforderlich.' });
  const exists = (await query('SELECT id FROM einheiten WHERE lower(kuerzel) = lower($1)', [kuerzel]))[0];
  if (exists) return res.status(400).json({ error: 'Einheit existiert bereits.' });
  const row = (await query<{ id: string }>('INSERT INTO einheiten (kuerzel, name) VALUES ($1, $2) RETURNING id', [kuerzel, name]))[0];
  await auditLog({ tabelle: 'einheiten', datensatzId: row.id, aktion: 'create', actor: req.user, nachher: { id: Number(row.id), kuerzel, name } });
  res.json({ id: Number(row.id), kuerzel, name });
});

einheitenRouter.put('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('einheiten', String(req.params.id));
  if (!vorher) return res.status(404).json({ error: 'Einheit nicht gefunden.' });
  const kuerzel = String(req.body?.kuerzel ?? '').trim();
  const name = String(req.body?.name ?? '').trim() || null;
  if (!kuerzel) return res.status(400).json({ error: 'Kürzel erforderlich.' });
  const kollision = (await query('SELECT id FROM einheiten WHERE lower(kuerzel) = lower($1) AND id <> $2', [kuerzel, req.params.id]))[0];
  if (kollision) return res.status(400).json({ error: 'Kürzel bereits vergeben.' });
  await query('UPDATE einheiten SET kuerzel = $2, name = $3 WHERE id = $1', [req.params.id, kuerzel, name]);
  await auditLog({ tabelle: 'einheiten', datensatzId: String(req.params.id), aktion: 'update', actor: req.user,
    vorher, nachher: await ladeSnapshot('einheiten', String(req.params.id)) });
  res.json({ ok: true });
});

einheitenRouter.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('einheiten', String(req.params.id));
  if (!vorher) return res.status(404).json({ error: 'Einheit nicht gefunden.' });
  await query('DELETE FROM einheiten WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'einheiten', datensatzId: String(req.params.id), aktion: 'delete', actor: req.user, vorher });
  res.json({ ok: true });
});

stammdatenRouter.use('/einheiten', einheitenRouter);

/* -------------------- Sprachen (Belegsprachen) -------------------- */
/* code = ISO 639-1 (für spätere KI-Übersetzung), name = Anzeigename.
   Die als Firmen-Standardsprache gesetzte Sprache kann nicht gelöscht werden. */
const sprachenRouter = Router();

sprachenRouter.get('/', async (_req, res) => {
  res.json(await query('SELECT id, code, name, sortierung FROM sprachen ORDER BY sortierung, lower(name)'));
});

sprachenRouter.post('/', requireRole('admin', 'buero'), async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toLowerCase();
  const name = String(req.body?.name ?? '').trim();
  if (!code || !name) return res.status(400).json({ error: 'Code und Name erforderlich.' });
  if (!/^[a-z]{2,3}$/.test(code)) return res.status(400).json({ error: 'Code muss ein ISO-Sprachkürzel sein (z. B. de, en, fr).' });
  const exists = (await query('SELECT id FROM sprachen WHERE code = $1', [code]))[0];
  if (exists) return res.status(400).json({ error: 'Sprache existiert bereits.' });
  const row = (await query<{ id: string }>('INSERT INTO sprachen (code, name) VALUES ($1, $2) RETURNING id', [code, name]))[0];
  await auditLog({ tabelle: 'sprachen', datensatzId: row.id, aktion: 'create', actor: req.user, nachher: { id: Number(row.id), code, name } });
  res.json({ id: Number(row.id), code, name });
});

sprachenRouter.put('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('sprachen', String(req.params.id));
  if (!vorher) return res.status(404).json({ error: 'Sprache nicht gefunden.' });
  const code = String(req.body?.code ?? '').trim().toLowerCase();
  const name = String(req.body?.name ?? '').trim();
  if (!code || !name) return res.status(400).json({ error: 'Code und Name erforderlich.' });
  if (!/^[a-z]{2,3}$/.test(code)) return res.status(400).json({ error: 'Code muss ein ISO-Sprachkürzel sein (z. B. de, en, fr).' });
  const kollision = (await query('SELECT id FROM sprachen WHERE code = $1 AND id <> $2', [code, req.params.id]))[0];
  if (kollision) return res.status(400).json({ error: 'Code bereits vergeben.' });
  await query('UPDATE sprachen SET code = $2, name = $3 WHERE id = $1', [req.params.id, code, name]);
  await auditLog({ tabelle: 'sprachen', datensatzId: String(req.params.id), aktion: 'update', actor: req.user,
    vorher, nachher: await ladeSnapshot('sprachen', String(req.params.id)) });
  res.json({ ok: true });
});

sprachenRouter.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('sprachen', String(req.params.id)) as { code?: string } | null;
  if (!vorher) return res.status(404).json({ error: 'Sprache nicht gefunden.' });
  // Schutz: die als Firmen-Standardsprache gesetzte Sprache darf nicht weg.
  const std = (await query<{ standard_sprache: string }>('SELECT standard_sprache FROM firma_stammdaten WHERE id = TRUE'))[0];
  if (std && vorher.code === std.standard_sprache)
    return res.status(400).json({ error: 'Diese Sprache ist als Standardsprache gesetzt und kann nicht gelöscht werden.' });
  await query('DELETE FROM sprachen WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'sprachen', datensatzId: String(req.params.id), aktion: 'delete', actor: req.user, vorher });
  res.json({ ok: true });
});

stammdatenRouter.use('/sprachen', sprachenRouter);
