/**
 * User-Verwaltung: Benutzerkonten anlegen, bearbeiten, (de)aktivieren und
 * mit Mitarbeitern verknüpfen. Nur für die Zugriffsrolle admin.
 * users.role (admin/buero/monteur) bleibt die technische Zugriffsrolle,
 * bis das rollenbasierte Berechtigungssystem sie ablöst.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';

export const usersRouter = Router();
usersRouter.use(requireRole('admin'));

/**
 * Leitet aus einer Zugriffsrolle das technische role-Kürzel ab, das die
 * bestehenden requireRole()-Prüfungen erwarten. Admin-Rolle -> 'admin',
 * sonst 'buero' als sicheres Nicht-Admin-Äquivalent. (Übergangslösung, bis
 * die Modulrechte die Prüfungen vollständig tragen.)
 */
async function roleKuerzelFuer(zugriffsrolleId: number | null): Promise<'admin' | 'buero'> {
  if (!zugriffsrolleId) return 'buero';
  const r = (await query<{ ist_admin: boolean }>('SELECT ist_admin FROM berechtigungsrollen WHERE id = $1', [zugriffsrolleId]))[0];
  return r?.ist_admin ? 'admin' : 'buero';
}

/** Auswählbare Zugriffsrollen für die User-Verwaltung. */
usersRouter.get('/zugriffsrollen', async (_req, res) => {
  res.json(await query('SELECT id, name, ist_admin FROM berechtigungsrollen ORDER BY ist_admin DESC, lower(name)'));
});

usersRouter.get('/', async (_req, res) => {
  res.json(
    await query(`
      SELECT u.id, u.email, u.name, u.role, u.active, u.mitarbeiter_id, u.totp_aktiv,
             u.zugriffsrolle_id, br.name AS zugriffsrolle_name,
             TRIM(COALESCE(m.vorname,'') || ' ' || COALESCE(m.nachname,'')) AS mitarbeiter_name
        FROM users u
        LEFT JOIN mitarbeiter m ON u.mitarbeiter_id = m.id
        LEFT JOIN berechtigungsrollen br ON u.zugriffsrolle_id = br.id
       ORDER BY lower(u.email)`),
  );
});

usersRouter.post('/', async (req, res) => {
  const { email, name, password, zugriffsrolle_id, mitarbeiter_id } = req.body ?? {};
  if (!email || !name || !password) return res.status(400).json({ error: 'E-Mail, Name und Passwort erforderlich.' });
  const rolleId = Number(zugriffsrolle_id) || null;
  if (!rolleId) return res.status(400).json({ error: 'Zugriffsrolle erforderlich.' });
  const rolleExists = (await query('SELECT id FROM berechtigungsrollen WHERE id = $1', [rolleId]))[0];
  if (!rolleExists) return res.status(400).json({ error: 'Ungültige Zugriffsrolle.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Passwort: mindestens 8 Zeichen.' });
  const mail = String(email).toLowerCase().trim();
  const exists = (await query('SELECT id FROM users WHERE email = $1', [mail]))[0];
  if (exists) return res.status(400).json({ error: 'E-Mail bereits vergeben.' });
  const hash = await bcrypt.hash(String(password), 12);
  const role = await roleKuerzelFuer(rolleId);  // technisches Kürzel synchron halten
  const row = (
    await query<{ id: string }>(
      'INSERT INTO users (email, name, password_hash, role, zugriffsrolle_id, mitarbeiter_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [mail, name, hash, role, rolleId, mitarbeiter_id || null],
    )
  )[0];
  await auditLog({ tabelle: 'users', datensatzId: row.id, aktion: 'create',
    actor: req.user, nachher: await ladeSnapshot('users', row.id) });
  res.json({ id: Number(row.id) });
});

/**
 * 2FA zurücksetzen (Handy verloren): Geheimnis und Status löschen,
 * Wiederherstellungscodes, vertraute Geräte und Sessions entfernen —
 * der Benutzer richtet 2FA beim nächsten Login neu ein.
 */
usersRouter.post('/:id/totp-reset', async (req, res) => {
  const u = (await query('SELECT id FROM users WHERE id = $1', [req.params.id]))[0];
  if (!u) return res.status(404).json({ error: 'Nicht gefunden.' });
  await query('UPDATE users SET totp_secret = NULL, totp_aktiv = FALSE WHERE id = $1', [req.params.id]);
  await query('DELETE FROM users_recovery_codes WHERE user_id = $1', [req.params.id]);
  await query('DELETE FROM trusted_devices WHERE user_id = $1', [req.params.id]);
  await query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);
  await auditLog({ tabelle: 'users', datensatzId: String(req.params.id), aktion: 'update',
    actor: req.user, nachher: await ladeSnapshot('users', String(req.params.id)) });
  res.json({ ok: true });
});

/**
 * Benutzer löschen. Das eigene Konto ist geschützt (sonst sperrt sich der
 * letzte Admin aus). Sessions, Wiederherstellungscodes und vertraute Geräte
 * hängen per ON DELETE CASCADE am Benutzer; ein verknüpfter Mitarbeiter
 * bleibt selbstverständlich bestehen.
 */
usersRouter.delete('/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user!.id))
    return res.status(400).json({ error: 'Das eigene Konto kann nicht gelöscht werden.' });
  const vorher = await ladeSnapshot('users', String(req.params.id));
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'users', datensatzId: String(req.params.id), aktion: 'delete',
    actor: req.user, vorher });
  res.json({ ok: true });
});

usersRouter.put('/:id', async (req, res) => {
  const u = (await query<any>('SELECT * FROM users WHERE id = $1', [req.params.id]))[0];
  if (!u) return res.status(404).json({ error: 'Nicht gefunden.' });
  const { name, zugriffsrolle_id, active, mitarbeiter_id, password } = req.body ?? {};
  const rolleId = Number(zugriffsrolle_id) || null;
  if (!rolleId) return res.status(400).json({ error: 'Zugriffsrolle erforderlich.' });
  const rolle = (await query<{ ist_admin: boolean }>('SELECT ist_admin FROM berechtigungsrollen WHERE id = $1', [rolleId]))[0];
  if (!rolle) return res.status(400).json({ error: 'Ungültige Zugriffsrolle.' });
  const role = rolle.ist_admin ? 'admin' : 'buero';  // technisches Kürzel synchron halten
  const willBeActive = active !== false && active !== 0 && active !== '0';
  // Selbstaussperrung verhindern: das eigene Konto darf nicht deaktiviert oder
  // aus der Admin-Rolle genommen werden.
  if (String(u.id) === String(req.user!.id) && (!willBeActive || !rolle.ist_admin))
    return res.status(400).json({ error: 'Das eigene Konto kann nicht deaktiviert oder herabgestuft werden.' });
  const vorher = await ladeSnapshot('users', String(req.params.id));
  await query('UPDATE users SET name=$2, role=$3, zugriffsrolle_id=$4, active=$5, mitarbeiter_id=$6 WHERE id=$1', [
    req.params.id, name || u.name, role, rolleId, willBeActive, mitarbeiter_id || null,
  ]);
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Passwort: mindestens 8 Zeichen.' });
    const hash = await bcrypt.hash(String(password), 12);
    await query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.params.id, hash]);
    await query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]); // alte Sitzungen beenden
  }
  await auditLog({ tabelle: 'users', datensatzId: String(req.params.id), aktion: 'update',
    actor: req.user, vorher, nachher: await ladeSnapshot('users', String(req.params.id)) });
  res.json({ ok: true });
});
