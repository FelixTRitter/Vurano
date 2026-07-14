/**
 * PERSONALAKTE — DOKUMENTE JE MITARBEITER (DSGVO)
 * ---------------------------------------------------------------
 * Zugriff: Lesen/Schreiben nur admin + buero (Personalakten!). Der
 * betroffene Mitarbeiter selbst greift über das Modul selbstauskunft
 * auf die EIGENEN Dokumente zu (Art. 15 DSGVO) und kann dort die
 * Löschung beantragen (Art. 17 — Prüfung durch das Büro wegen
 * Aufbewahrungspflichten, deshalb kein Selbst-Löschen).
 *
 * Ablage: Zufallsname unter config.uploadsDir (nie öffentlich,
 * nie der Originalname). Download streamt durch den Server.
 *
 * Endpunkte (unter /api/mitarbeiter gemountet):
 *   GET    /:id/dokumente              Liste
 *   POST   /:id/dokumente              Upload (multipart, Feld "dateien")
 *   GET    /dokumente/:dokId/download  Datei
 *   PUT    /dokumente/:dokId           Umbenennen / in Ordner verschieben
 *   DELETE /dokumente/:dokId           Endgültig löschen (Datei + Eintrag)
 */
import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { config } from '../../config.js';

mkdirSync(config.uploadsDir, { recursive: true });

/** Dateinamen entschärfen: Pfadbestandteile und Steuerzeichen entfernen. */
export function sanitizeDateiname(name: unknown): string {
  const nurName = String(name ?? '').split(/[\\/]/).pop() ?? '';
  const sauber = nurName.replace(/[\u0000-\u001f]/g, '').trim();
  return sauber || 'unbenannt';
}

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, _file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
});

export const dokumenteRouter = Router();
dokumenteRouter.use(requireRole('admin', 'buero'));

dokumenteRouter.get('/:id/dokumente', async (req, res) => {
  res.json(
    await query(
      `SELECT id, dateiname, ordner, mime, groesse, loeschantrag, loeschantrag_am, created_at
         FROM mitarbeiter_dokumente WHERE mitarbeiter_id = $1
        ORDER BY lower(ordner), lower(dateiname)`,
      [req.params.id],
    ),
  );
});

dokumenteRouter.post('/:id/dokumente', upload.array('dateien'), async (req, res) => {
  const ma = (await query('SELECT id FROM mitarbeiter WHERE id = $1', [req.params.id]))[0];
  if (!ma) return res.status(404).json({ error: 'Mitarbeiter nicht gefunden.' });
  const dateien = (req.files as Express.Multer.File[]) ?? [];
  if (dateien.length === 0) return res.status(400).json({ error: 'Keine Dateien empfangen.' });
  const ordner = sanitizeDateiname(req.body?.ordner || 'Allgemein');
  for (const f of dateien) {
    await query(
      `INSERT INTO mitarbeiter_dokumente (mitarbeiter_id, dateiname, ordner, mime, groesse, speicher_name, hochgeladen_von)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, sanitizeDateiname(Buffer.from(f.originalname, 'latin1').toString('utf8')), ordner, f.mimetype, f.size, f.filename, req.user!.id],
    );
  }
  res.json({ ok: true, anzahl: dateien.length });
});

dokumenteRouter.get('/dokumente/:dokId/download', async (req, res) => {
  const d = (await query<any>('SELECT * FROM mitarbeiter_dokumente WHERE id = $1', [req.params.dokId]))[0];
  if (!d) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.setHeader('Content-Type', d.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`);
  createReadStream(path.join(config.uploadsDir, d.speicher_name)).pipe(res);
});

dokumenteRouter.put('/dokumente/:dokId', async (req, res) => {
  const d = (await query<any>('SELECT id FROM mitarbeiter_dokumente WHERE id = $1', [req.params.dokId]))[0];
  if (!d) return res.status(404).json({ error: 'Nicht gefunden.' });
  const dateiname = sanitizeDateiname(req.body?.dateiname);
  const ordner = sanitizeDateiname(req.body?.ordner || 'Allgemein');
  await query('UPDATE mitarbeiter_dokumente SET dateiname = $2, ordner = $3 WHERE id = $1', [
    req.params.dokId, dateiname, ordner,
  ]);
  res.json({ ok: true });
});

dokumenteRouter.delete('/dokumente/:dokId', async (req, res) => {
  const d = (await query<any>('DELETE FROM mitarbeiter_dokumente WHERE id = $1 RETURNING speicher_name', [req.params.dokId]))[0];
  if (!d) return res.status(404).json({ error: 'Nicht gefunden.' });
  await unlink(path.join(config.uploadsDir, d.speicher_name)).catch(() => { /* Datei fehlt bereits */ });
  res.json({ ok: true });
});
