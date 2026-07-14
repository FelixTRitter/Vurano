/**
 * Mitarbeiterverwaltung. aktiv = kein Austrittsdatum oder Austritt in der
 * Zukunft. Lesen: alle Rollen; Schreiben: admin und buero.
 */
import { Router } from 'express';
import { query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { FIELDS, pick, validate } from './validation.js';
import { dokumenteRouter } from './dokumente.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';

export const mitarbeiterRouter = Router();
mitarbeiterRouter.use(dokumenteRouter); // Personalakte: /:id/dokumente, /dokumente/:dokId

const BASE_SELECT = `
  SELECT m.*, f.name AS funktion_name, a.name AS arbeitszeitmodell_name,
         (m.austritt IS NULL OR m.austritt = '' OR m.austritt::date > CURRENT_DATE) AS aktiv,
         COALESCE((
           SELECT json_agg(json_build_object('id', q.id, 'name', q.name) ORDER BY lower(q.name))
             FROM mitarbeiter_qualifikationen mq JOIN qualifikationen q ON q.id = mq.qualifikation_id
            WHERE mq.mitarbeiter_id = m.id
         ), '[]'::json) AS qualifikationen
    FROM mitarbeiter m
    LEFT JOIN funktionen f ON m.funktion_id = f.id
    LEFT JOIN arbeitszeitmodelle a ON m.arbeitszeitmodell_id = a.id`;

/** Setzt die Qualifikations-Zuordnung eines Mitarbeiters (n:m) neu. */
async function setQualifikationen(mitarbeiterId: string | number, ids: unknown): Promise<void> {
  const liste = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n)) : [];
  await query('DELETE FROM mitarbeiter_qualifikationen WHERE mitarbeiter_id = $1', [mitarbeiterId]);
  for (const qid of new Set(liste)) {
    await query('INSERT INTO mitarbeiter_qualifikationen (mitarbeiter_id, qualifikation_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [mitarbeiterId, qid]);
  }
}

mitarbeiterRouter.get('/', async (_req, res) => {
  res.json(await query(`${BASE_SELECT} ORDER BY lower(m.nachname), lower(COALESCE(m.vorname,''))`));
});

mitarbeiterRouter.get('/:id', async (req, res) => {
  const m = (await query<any>(`${BASE_SELECT} WHERE m.id = $1`, [req.params.id]))[0];
  if (!m) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.json(m);
});

mitarbeiterRouter.post('/', requireRole('admin', 'buero'), async (req, res) => {
  const d = pick(req.body ?? {});
  const err = validate(d);
  if (err) return res.status(400).json({ error: err });
  const cols = FIELDS.join(', ');
  const ph = FIELDS.map((_, i) => `$${i + 1}`).join(', ');
  const row = (
    await query<{ id: string }>(`INSERT INTO mitarbeiter (${cols}) VALUES (${ph}) RETURNING id`, FIELDS.map((f) => d[f]))
  )[0];
  await setQualifikationen(row.id, req.body?.qualifikation_ids);
  await auditLog({ tabelle: 'mitarbeiter', datensatzId: row.id, aktion: 'create',
    actor: req.user, nachher: await ladeSnapshot('mitarbeiter', row.id) });
  res.json({ id: Number(row.id) });
});

mitarbeiterRouter.put('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const exists = (await query('SELECT id FROM mitarbeiter WHERE id = $1', [req.params.id]))[0];
  if (!exists) return res.status(404).json({ error: 'Nicht gefunden.' });
  const d = pick(req.body ?? {});
  const err = validate(d);
  if (err) return res.status(400).json({ error: err });
  const vorher = await ladeSnapshot('mitarbeiter', String(req.params.id));
  const set = FIELDS.map((f, i) => `${f} = $${i + 1}`).join(', ');
  await query(`UPDATE mitarbeiter SET ${set} WHERE id = $${FIELDS.length + 1}`, [
    ...FIELDS.map((f) => d[f]),
    req.params.id,
  ]);
  if (req.body?.qualifikation_ids !== undefined) await setQualifikationen(String(req.params.id), req.body.qualifikation_ids);
  await auditLog({ tabelle: 'mitarbeiter', datensatzId: String(req.params.id), aktion: 'update',
    actor: req.user, vorher, nachher: await ladeSnapshot('mitarbeiter', String(req.params.id)) });
  res.json({ ok: true });
});

mitarbeiterRouter.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('mitarbeiter', String(req.params.id));
  // users.mitarbeiter_id löst sich per ON DELETE SET NULL
  await query('DELETE FROM mitarbeiter WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'mitarbeiter', datensatzId: String(req.params.id), aktion: 'delete',
    actor: req.user, vorher });
  res.json({ ok: true });
});
