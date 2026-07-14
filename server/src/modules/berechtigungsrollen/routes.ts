/**
 * BERECHTIGUNGSROLLEN — Endpunkte
 * ---------------------------------------------------------------
 * Verwaltung der Zugriffsrollen und ihrer Modul-Freischaltungen.
 * Nur für Administratoren (requireRole('admin')). Später steuern diese
 * Rollen selbst den Zugriff; bis dahin gilt weiter users.role.
 *
 * Administrator-Sonderrolle: ist_admin=TRUE -> Vollzugriff per Definition.
 * Ihre Modulrechte werden NICHT aus rollen_module gelesen, sondern immer als
 * "alle Module" zurückgegeben; sie sind nicht abwählbar und die Rolle ist
 * nicht löschbar.
 */
import { Router } from 'express';
import { pool, query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { MODULE, MODUL_KEYS } from '../../berechtigungen/module.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';

export const berechtigungsrollenRouter = Router();

/** Katalog aller Module/Submodule (für die Rechteanzeige im Rollen-Detail). */
berechtigungsrollenRouter.get('/module', requireRole('admin'), async (_req, res) => {
  res.json(MODULE);
});

/** Alle Rollen (Tabellenansicht). */
berechtigungsrollenRouter.get('/', requireRole('admin'), async (_req, res) => {
  res.json(await query('SELECT id, name, ist_admin, system, erstellt_am FROM berechtigungsrollen ORDER BY ist_admin DESC, lower(name)'));
});

/** Rollen-Detail inkl. der freigeschalteten Modul-Keys. */
berechtigungsrollenRouter.get('/:id', requireRole('admin'), async (req, res) => {
  const rolle = (await query<any>('SELECT id, name, ist_admin, system FROM berechtigungsrollen WHERE id = $1', [req.params.id]))[0];
  if (!rolle) return res.status(404).json({ error: 'Rolle nicht gefunden.' });
  let moduleKeys: string[];
  if (rolle.ist_admin) {
    // Admin: immer alle Module (auch künftige) — Vollzugriff per Definition.
    moduleKeys = MODULE.map((m) => m.key);
  } else {
    moduleKeys = (await query<{ modul_key: string }>('SELECT modul_key FROM rollen_module WHERE rolle_id = $1', [req.params.id]))
      .map((r) => r.modul_key);
  }
  res.json({ ...rolle, module: moduleKeys });
});

/** Neue Rolle anlegen. */
berechtigungsrollenRouter.post('/', requireRole('admin'), async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Name erforderlich.' });
  const exists = (await query('SELECT id FROM berechtigungsrollen WHERE lower(name) = lower($1)', [name]))[0];
  if (exists) return res.status(400).json({ error: 'Rolle existiert bereits.' });
  const row = (await query<{ id: string }>('INSERT INTO berechtigungsrollen (name) VALUES ($1) RETURNING id', [name]))[0];
  await auditLog({ tabelle: 'berechtigungsrollen', datensatzId: row.id, aktion: 'create', actor: req.user, nachher: { id: Number(row.id), name } });
  res.json({ id: Number(row.id), name });
});

/** Ein einzelnes Modulrecht einer Rolle setzen/entfernen (Checkbox). */
berechtigungsrollenRouter.put('/:id/modul', requireRole('admin'), async (req, res) => {
  const rolle = (await query<any>('SELECT id, ist_admin FROM berechtigungsrollen WHERE id = $1', [req.params.id]))[0];
  if (!rolle) return res.status(404).json({ error: 'Rolle nicht gefunden.' });
  if (rolle.ist_admin) return res.status(400).json({ error: 'Der Administrator hat unveränderlichen Vollzugriff.' });
  const key = String(req.body?.modul_key ?? '');
  const an = req.body?.aktiv === true;
  if (!MODUL_KEYS.has(key)) return res.status(400).json({ error: 'Unbekanntes Modul.' });
  const vorher = (await query<{ modul_key: string }>('SELECT modul_key FROM rollen_module WHERE rolle_id = $1', [req.params.id])).map((r) => r.modul_key);
  if (an) {
    await query('INSERT INTO rollen_module (rolle_id, modul_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, key]);
  } else {
    await query('DELETE FROM rollen_module WHERE rolle_id = $1 AND modul_key = $2', [req.params.id, key]);
  }
  const nachher = (await query<{ modul_key: string }>('SELECT modul_key FROM rollen_module WHERE rolle_id = $1', [req.params.id])).map((r) => r.modul_key);
  await auditLog({ tabelle: 'rollen_module', datensatzId: String(req.params.id), aktion: 'update', actor: req.user,
    vorher: { module: vorher }, nachher: { module: nachher } });
  res.json({ ok: true, module: nachher });
});

/** Rolle löschen (Administrator/System-Rollen geschützt). */
berechtigungsrollenRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const rolle = (await query<any>('SELECT id, name, ist_admin, system FROM berechtigungsrollen WHERE id = $1', [req.params.id]))[0];
  if (!rolle) return res.status(404).json({ error: 'Rolle nicht gefunden.' });
  if (rolle.ist_admin || rolle.system) return res.status(400).json({ error: 'Diese Rolle ist geschützt und kann nicht gelöscht werden.' });
  await query('DELETE FROM berechtigungsrollen WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'berechtigungsrollen', datensatzId: String(req.params.id), aktion: 'delete', actor: req.user, vorher: rolle });
  res.json({ ok: true });
});
