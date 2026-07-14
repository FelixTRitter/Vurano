/**
 * ARTIKEL — Endpunkte (aktuell genutzt vom Verkaufsartikelstamm)
 * ---------------------------------------------------------------
 * Eine gemeinsame Tabelle für alle Teiletypen; die Liste wird über den
 * Query-Parameter ?teiletyp=... gefiltert. Der Verkaufsartikelstamm ruft
 * teiletyp=verkaufsartikel auf. Weitere Teiletypen bekommen später eigene
 * Submodule auf demselben Endpunkt. Alle Schreibzugriffe werden protokolliert.
 */
import { Router } from 'express';
import { query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';
import { auditLog, ladeSnapshot } from '../../audit/log.js';
import { TEILETYPEN, TEILETYP_KEYS } from './teiletypen.js';
import { uebersetze, uebersetzungVerfuegbar } from '../uebersetzung/provider.js';

export const artikelRouter = Router();

const BASE_SELECT = `
  SELECT a.id, a.teiletyp, a.artikelnummer, a.bezeichnung,
         a.einheit_id, a.sprache_code, a.erstellt_am,
         a.verkaufspreis, a.materialkosten, a.planungsdauer, a.produktionsdauer, a.montagedauer,
         e.kuerzel AS einheit_kuerzel, s.name AS sprache_name
    FROM artikel a
    LEFT JOIN einheiten e ON a.einheit_id = e.id
    LEFT JOIN sprachen s ON a.sprache_code = s.code`;

/**
 * Wandelt eine Zahleneingabe robust in eine Zahl (oder null).
 * Anwender tippen je nach Gewohnheit "1234.50", "1234,50" oder "1'234.50" —
 * alle drei müssen ankommen. Leere Eingabe = null (nicht 0!).
 */
function zahl(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const s = String(v).trim().replace(/['\s]/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Prüft Preis/Dauern auf Plausibilität. Gibt eine Fehlermeldung oder null zurück. */
function pruefeZahlen(b: Record<string, unknown>): string | null {
  const felder: Array<[string, string]> = [
    ['verkaufspreis', 'Verkaufspreis'],
    ['materialkosten', 'Materialkosten'],
    ['planungsdauer', 'Planungsdauer'],
    ['produktionsdauer', 'Produktionsdauer'],
    ['montagedauer', 'Montagedauer'],
  ];
  for (const [key, label] of felder) {
    const roh = b[key];
    if (roh === null || roh === undefined || String(roh).trim() === '') continue;
    const n = zahl(roh);
    if (n === null) return `${label}: keine gültige Zahl.`;
    if (n < 0) return `${label} darf nicht negativ sein.`;
  }
  return null;
}

/** Hardcoded Teiletypen (für Auswahl/Anzeige im Client). */
artikelRouter.get('/teiletypen', async (_req, res) => {
  res.json(TEILETYPEN);
});

/** Liste, optional nach einem oder mehreren teiletypen gefiltert (Komma-Liste). */
artikelRouter.get('/', async (req, res) => {
  const roh = String(req.query.teiletyp ?? '').trim();
  const typen = roh ? roh.split(',').map((t) => t.trim()).filter(Boolean) : [];
  for (const t of typen) {
    if (!TEILETYP_KEYS.has(t as never)) return res.status(400).json({ error: 'Unbekannter Teiletyp.' });
  }
  const sql = typen.length
    ? `${BASE_SELECT} WHERE a.teiletyp = ANY($1) ORDER BY a.teiletyp, a.artikelnummer NULLS LAST, lower(a.bezeichnung)`
    : `${BASE_SELECT} ORDER BY a.teiletyp, a.artikelnummer NULLS LAST, lower(a.bezeichnung)`;
  res.json(await query(sql, typen.length ? [typen] : []));
});

/** Detail eines Artikels — inkl. aller Sprachfassungen der Texte. */
artikelRouter.get('/:id', async (req, res) => {
  const row = (await query<any>(`${BASE_SELECT} WHERE a.id = $1`, [req.params.id]))[0];
  if (!row) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  row.texte = await ladeTexte(String(req.params.id));
  res.json(row);
});

function pruefeArtikelnummer(nr: string): string | null {
  return nr && nr.length > 60 ? 'Artikelnummer zu lang.' : null;
}

/**
 * Schreibt den Text einer Sprache (anlegen oder ersetzen).
 * quelle: 'original' (Originalsprache), 'ki' (Entwurf), 'manuell' (geprüft/getippt).
 */
async function setzeText(
  artikelId: string | number, sprache: string,
  verkaufstext: unknown, lvText: unknown, quelle: 'original' | 'ki' | 'manuell',
): Promise<void> {
  await query(
    `INSERT INTO artikel_texte (artikel_id, sprache_code, verkaufstext, lv_text, quelle, aktualisiert_am)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (artikel_id, sprache_code)
     DO UPDATE SET verkaufstext = EXCLUDED.verkaufstext, lv_text = EXCLUDED.lv_text,
                   quelle = EXCLUDED.quelle, aktualisiert_am = now()`,
    [artikelId, sprache, String(verkaufstext ?? '') || null, String(lvText ?? '') || null, quelle],
  );
}

/** Lädt alle Sprachfassungen eines Artikels. */
async function ladeTexte(artikelId: string | number): Promise<unknown[]> {
  return query(
    `SELECT t.sprache_code, t.verkaufstext, t.lv_text, t.quelle, t.aktualisiert_am, s.name AS sprache_name
       FROM artikel_texte t LEFT JOIN sprachen s ON s.code = t.sprache_code
      WHERE t.artikel_id = $1
      ORDER BY s.sortierung NULLS LAST, t.sprache_code`,
    [artikelId],
  );
}

/** Anlegen. */
artikelRouter.post('/', requireRole('admin', 'buero'), async (req, res) => {
  const b = req.body ?? {};
  const teiletyp = String(b.teiletyp ?? '').trim();
  if (!TEILETYP_KEYS.has(teiletyp as never)) return res.status(400).json({ error: 'Gültiger Teiletyp erforderlich.' });
  const bezeichnung = String(b.bezeichnung ?? '').trim();
  if (!bezeichnung) return res.status(400).json({ error: 'Bezeichnung erforderlich.' });
  const artikelnummer = String(b.artikelnummer ?? '').trim() || null;
  if (artikelnummer) {
    const nrErr = pruefeArtikelnummer(artikelnummer);
    if (nrErr) return res.status(400).json({ error: nrErr });
    const dup = (await query('SELECT id FROM artikel WHERE artikelnummer = $1', [artikelnummer]))[0];
    if (dup) return res.status(400).json({ error: 'Artikelnummer bereits vergeben.' });
  }
  const zahlErr = pruefeZahlen(b);
  if (zahlErr) return res.status(400).json({ error: zahlErr });
  const sprache = String(b.sprache_code ?? '').trim() || 'de';
  const row = (await query<{ id: string }>(
    `INSERT INTO artikel (teiletyp, artikelnummer, bezeichnung, einheit_id, sprache_code,
                          verkaufspreis, materialkosten, planungsdauer, produktionsdauer, montagedauer)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [teiletyp, artikelnummer, bezeichnung,
     Number(b.einheit_id) || null, sprache,
     zahl(b.verkaufspreis), zahl(b.materialkosten),
     zahl(b.planungsdauer), zahl(b.produktionsdauer), zahl(b.montagedauer)],
  ))[0];
  // Text der Originalsprache separat ablegen (nur wenn überhaupt etwas drinsteht)
  if (String(b.verkaufstext ?? '') || String(b.lv_text ?? '')) {
    await setzeText(row.id, sprache, b.verkaufstext, b.lv_text, 'original');
  }
  await auditLog({ tabelle: 'artikel', datensatzId: row.id, aktion: 'create',
    actor: req.user, nachher: await ladeSnapshot('artikel', row.id) });
  res.json({ id: Number(row.id) });
});

/** Bearbeiten (Teilupdate der bekannten Felder; teiletyp bleibt unverändert). */
artikelRouter.put('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('artikel', String(req.params.id)) as any;
  if (!vorher) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  const b = req.body ?? {};
  const bezeichnung = String(b.bezeichnung ?? '').trim();
  if (!bezeichnung) return res.status(400).json({ error: 'Bezeichnung erforderlich.' });
  const artikelnummer = String(b.artikelnummer ?? '').trim() || null;
  if (artikelnummer) {
    const dup = (await query('SELECT id FROM artikel WHERE artikelnummer = $1 AND id <> $2', [artikelnummer, req.params.id]))[0];
    if (dup) return res.status(400).json({ error: 'Artikelnummer bereits vergeben.' });
  }
  const zahlErr = pruefeZahlen(b);
  if (zahlErr) return res.status(400).json({ error: zahlErr });
  const sprache = String(b.sprache_code ?? '').trim() || vorher.sprache_code || 'de';
  await query(
    `UPDATE artikel SET artikelnummer=$2, bezeichnung=$3, einheit_id=$4, sprache_code=$5,
            verkaufspreis=$6, materialkosten=$7, planungsdauer=$8, produktionsdauer=$9, montagedauer=$10
      WHERE id=$1`,
    [req.params.id, artikelnummer, bezeichnung,
     Number(b.einheit_id) || null, sprache,
     zahl(b.verkaufspreis), zahl(b.materialkosten),
     zahl(b.planungsdauer), zahl(b.produktionsdauer), zahl(b.montagedauer)],
  );
  // Texte nur anfassen, wenn sie mitgesendet wurden (Teilupdate) — sonst
  // würde ein Speichern aus dem Modal die Texte anderer Sprachen gefährden.
  if (b.verkaufstext !== undefined || b.lv_text !== undefined) {
    await setzeText(String(req.params.id), sprache, b.verkaufstext, b.lv_text, 'original');
  } else if (sprache !== vorher.sprache_code) {
    // Originalsprache wurde korrigiert ("der Text ist doch Englisch"): Der
    // vorhandene Originaltext wandert mit, statt verwaist zurückzubleiben.
    // Nur, wenn in der Zielsprache noch nichts liegt (sonst überschriebe man
    // eine bestehende Übersetzung).
    const belegt = (await query('SELECT 1 FROM artikel_texte WHERE artikel_id = $1 AND sprache_code = $2',
      [req.params.id, sprache]))[0];
    if (!belegt) {
      await query('UPDATE artikel_texte SET sprache_code = $3 WHERE artikel_id = $1 AND sprache_code = $2',
        [req.params.id, vorher.sprache_code, sprache]);
    }
  }
  await auditLog({ tabelle: 'artikel', datensatzId: String(req.params.id), aktion: 'update',
    actor: req.user, vorher, nachher: await ladeSnapshot('artikel', String(req.params.id)) });
  res.json({ ok: true });
});

/** Löschen. */
artikelRouter.delete('/:id', requireRole('admin', 'buero'), async (req, res) => {
  const vorher = await ladeSnapshot('artikel', String(req.params.id));
  if (!vorher) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  await query('DELETE FROM artikel WHERE id = $1', [req.params.id]);
  await auditLog({ tabelle: 'artikel', datensatzId: String(req.params.id), aktion: 'delete', actor: req.user, vorher });
  res.json({ ok: true });
});

/* -------------------- Mehrsprachige Texte -------------------- */

/**
 * Text einer Sprache speichern (Verkaufs- und LV-Text).
 * quelle wird auf 'manuell' gesetzt, sobald ein Mensch speichert — auch wenn
 * der Text ursprünglich von der KI kam. Ist es die Originalsprache des
 * Artikels, bleibt 'original' erhalten.
 */
artikelRouter.put('/:id/text/:sprache', requireRole('admin', 'buero'), async (req, res) => {
  const artikel = (await query<any>('SELECT id, sprache_code FROM artikel WHERE id = $1', [req.params.id]))[0];
  if (!artikel) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  const sprache = String(req.params.sprache).toLowerCase();
  const bekannt = (await query('SELECT code FROM sprachen WHERE code = $1', [sprache]))[0];
  if (!bekannt) return res.status(400).json({ error: 'Unbekannte Sprache.' });

  const vorher = (await query('SELECT * FROM artikel_texte WHERE artikel_id = $1 AND sprache_code = $2',
    [req.params.id, sprache]))[0] ?? null;
  const quelle = sprache === artikel.sprache_code ? 'original' : 'manuell';
  await setzeText(String(req.params.id), sprache, req.body?.verkaufstext, req.body?.lv_text, quelle);
  const nachher = (await query('SELECT * FROM artikel_texte WHERE artikel_id = $1 AND sprache_code = $2',
    [req.params.id, sprache]))[0] ?? null;
  await auditLog({ tabelle: 'artikel_texte', datensatzId: `${req.params.id}/${sprache}`,
    aktion: vorher ? 'update' : 'create', actor: req.user, vorher, nachher });
  res.json({ ok: true, quelle });
});

/**
 * Übersetzungs-ENTWURF für eine Zielsprache erzeugen (per Klick in der
 * Oberfläche). Speichert bewusst NICHTS: Der Anwender prüft, korrigiert und
 * speichert selbst — KI-Übersetzungen sind Vorschläge, keine Wahrheit.
 * Quelle ist immer der Text der Originalsprache des Artikels.
 */
artikelRouter.post('/:id/uebersetzen', requireRole('admin', 'buero'), async (req, res) => {
  if (!uebersetzungVerfuegbar())
    return res.status(503).json({ error: 'Übersetzungsdienst ist nicht konfiguriert.' });

  const artikel = (await query<any>('SELECT id, sprache_code FROM artikel WHERE id = $1', [req.params.id]))[0];
  if (!artikel) return res.status(404).json({ error: 'Artikel nicht gefunden.' });
  const ziel = String(req.body?.ziel_sprache ?? '').toLowerCase();
  if (!ziel) return res.status(400).json({ error: 'Zielsprache erforderlich.' });
  if (ziel === artikel.sprache_code)
    return res.status(400).json({ error: 'Der Text liegt bereits in dieser Sprache vor.' });

  const sprachen = await query<{ code: string; name: string }>('SELECT code, name FROM sprachen');
  const nameVon = (code: string) => sprachen.find((s) => s.code === code)?.name ?? code;
  if (!sprachen.some((s) => s.code === ziel)) return res.status(400).json({ error: 'Unbekannte Zielsprache.' });

  const original = (await query<any>(
    'SELECT verkaufstext, lv_text FROM artikel_texte WHERE artikel_id = $1 AND sprache_code = $2',
    [req.params.id, artikel.sprache_code]))[0];
  if (!original || (!original.verkaufstext && !original.lv_text))
    return res.status(400).json({ error: 'Es gibt noch keinen Text in der Originalsprache zum Übersetzen.' });

  try {
    const ergebnis = await uebersetze({
      verkaufstext: original.verkaufstext || '',
      lvText: original.lv_text || '',
      quellSprache: nameVon(artikel.sprache_code),
      zielSprache: nameVon(ziel),
    });
    // Nur den Entwurf zurückgeben — Speichern ist eine bewusste Handlung.
    res.json({ ...ergebnis, quelle: 'ki' });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});
