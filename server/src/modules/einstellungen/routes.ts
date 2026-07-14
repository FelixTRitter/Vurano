/**
 * MODUL EINSTELLUNGEN — HTTP-SCHICHT
 * ---------------------------------------------------------------
 * Persönliche Einstellungen des angemeldeten Benutzers. Aktuell:
 * Darstellung (Farbschema hell/dunkel + Führungsfarbe). Jeder
 * Benutzer ändert nur die eigenen Werte — keine Rollenprüfung nötig.
 *
 * Erweitern: neue Einstellungsgruppe = neues GET/PUT-Paar hier,
 * Validierung in validation.ts, Spalten per neuer Migration.
 */
import { Router } from 'express';
import { query } from '../../db.js';
import { validateDarstellung } from './validation.js';

export const einstellungenRouter = Router();

einstellungenRouter.get('/darstellung', async (req, res) => {
  const row = (
    await query<{ theme: string; akzentfarbe: string }>(
      'SELECT theme, akzentfarbe FROM users WHERE id = $1',
      [req.user!.id],
    )
  )[0];
  res.json(row);
});

einstellungenRouter.put('/darstellung', async (req, res) => {
  const r = validateDarstellung(req.body ?? {});
  if (!r.ok) return res.status(400).json({ error: r.error });
  await query('UPDATE users SET theme = $2, akzentfarbe = $3 WHERE id = $1', [
    req.user!.id, r.theme, r.akzentfarbe,
  ]);
  res.json({ ok: true });
});
