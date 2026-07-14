/**
 * SELBSTAUSKUNFT ("Meine Daten", Art. 15 DSGVO)
 * ---------------------------------------------------------------
 * Jeder angemeldete Benutzer (jede Rolle) sieht hier ausschließlich
 * die Personaldaten und Dokumente des MIT IHM VERKNÜPFTEN Mitarbeiters
 * (users.mitarbeiter_id). Löschen ist bewusst NICHT möglich — nur ein
 * dokumentierter Löschantrag (Art. 17 vs. Aufbewahrungspflichten),
 * den das Büro in der Personalakte sieht und prüft.
 */
import { Router } from 'express';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { query } from '../../db.js';
import { config } from '../../config.js';

export const selbstauskunftRouter = Router();

async function eigeneMitarbeiterId(userId: number): Promise<number | null> {
  const u = (await query<any>('SELECT mitarbeiter_id FROM users WHERE id = $1', [userId]))[0];
  return u?.mitarbeiter_id ?? null;
}

selbstauskunftRouter.get('/', async (req, res) => {
  const maId = await eigeneMitarbeiterId(req.user!.id);
  if (!maId) return res.json({ mitarbeiter: null, dokumente: [] });
  const [ma, dokumente] = await Promise.all([
    query<any>(
      `SELECT m.*, r.name AS rolle_name, a.name AS arbeitszeitmodell_name
         FROM mitarbeiter m
         LEFT JOIN rollen r ON m.rolle_id = r.id
         LEFT JOIN arbeitszeitmodelle a ON m.arbeitszeitmodell_id = a.id
        WHERE m.id = $1`, [maId]),
    query(
      `SELECT id, dateiname, ordner, groesse, loeschantrag, created_at
         FROM mitarbeiter_dokumente WHERE mitarbeiter_id = $1
        ORDER BY lower(ordner), lower(dateiname)`, [maId]),
  ]);
  res.json({ mitarbeiter: ma[0] ?? null, dokumente });
});

selbstauskunftRouter.get('/dokumente/:dokId/download', async (req, res) => {
  const maId = await eigeneMitarbeiterId(req.user!.id);
  const d = (await query<any>(
    'SELECT * FROM mitarbeiter_dokumente WHERE id = $1 AND mitarbeiter_id = $2',
    [req.params.dokId, maId],
  ))[0];
  if (!d) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.setHeader('Content-Type', d.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`);
  createReadStream(path.join(config.uploadsDir, d.speicher_name)).pipe(res);
});

selbstauskunftRouter.post('/dokumente/:dokId/loeschantrag', async (req, res) => {
  const maId = await eigeneMitarbeiterId(req.user!.id);
  const d = (await query<any>(
    `UPDATE mitarbeiter_dokumente
        SET loeschantrag = TRUE, loeschantrag_von = $3, loeschantrag_am = now()
      WHERE id = $1 AND mitarbeiter_id = $2 RETURNING id`,
    [req.params.dokId, maId, req.user!.id],
  ))[0];
  if (!d) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.json({ ok: true });
});
