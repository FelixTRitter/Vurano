/**
 * CRUD-DOKUMENTATION — Endpunkte (Betrachtungstool fürs Audit-Log)
 * ---------------------------------------------------------------
 * Liest AUSSCHLIESSLICH aus audit_log (schreibt dort nie). Man wählt ein
 * Modul/Submodul; die dazugehörigen Tabellen werden über MODUL_TABELLEN
 * aufgelöst und deren Protokolleinträge geliefert. Nur für Administratoren.
 *
 * WICHTIG (Team-Regel): Kommt ein neues protokolliertes Modul dazu, hier die
 * Modul->Tabellen-Zuordnung ergänzen, damit sein Verlauf auswählbar ist.
 */
import { Router } from 'express';
import { query } from '../../db.js';
import { requireRole } from '../../auth/middleware.js';

export const crudDokuRouter = Router();

// Welcher Modul-Key betrifft welche Datenbank-Tabelle(n)?
const MODUL_TABELLEN: Record<string, { label: string; tabellen: string[] }> = {
  kontakte:            { label: 'Adressverwaltung',   tabellen: ['kontakte'] },
  verkaufsartikel:     { label: 'Verkaufsartikelstamm', tabellen: ['artikel', 'artikel_texte'] },
  teilestamm:          { label: 'Teilestamm',        tabellen: ['artikel'] },
  mitarbeiter:         { label: 'Mitarbeiter',        tabellen: ['mitarbeiter'] },
  users:               { label: 'User Verwaltung',    tabellen: ['users'] },
  arbeitszeitmodelle:  { label: 'Arbeitszeitmodelle', tabellen: ['arbeitszeitmodelle'] },
  unternehmen:         { label: 'Unternehmen',        tabellen: ['firma_stammdaten'] },
  rollen:              { label: 'Zugriffsrollen',     tabellen: ['berechtigungsrollen', 'rollen_module'] },
  qualifikationen:     { label: 'Qualifikationen', tabellen: ['funktionen', 'qualifikationen', 'mitarbeiter_qualifikationen'] },
  einheiten:           { label: 'Einheiten',       tabellen: ['einheiten'] },
  sprachen:            { label: 'Sprachen',        tabellen: ['sprachen'] },
};

/** Auswählbare Module (nur solche, für die es protokollierte Tabellen gibt). */
crudDokuRouter.get('/module', requireRole('admin'), async (_req, res) => {
  res.json(Object.entries(MODUL_TABELLEN).map(([key, v]) => ({ key, label: v.label })));
});

/**
 * Protokolleinträge eines Moduls, optional gefiltert nach Datensatz-ID oder
 * Freitext. Neueste zuerst; Limit gegen Überlast.
 */
crudDokuRouter.get('/:modulKey', requireRole('admin'), async (req, res) => {
  const eintrag = MODUL_TABELLEN[String(req.params.modulKey)];
  if (!eintrag) return res.status(404).json({ error: 'Unbekanntes Modul.' });
  const params: unknown[] = [eintrag.tabellen];
  let sql = `SELECT id, tabelle, datensatz_id, aktion, user_name, zeitpunkt, vorher, nachher
               FROM audit_log WHERE tabelle = ANY($1)`;
  const datensatzId = String(req.query.datensatz_id ?? '').trim();
  if (datensatzId) { params.push(datensatzId); sql += ` AND datensatz_id = $${params.length}`; }
  const suche = String(req.query.suche ?? '').trim();
  if (suche) {
    params.push('%' + suche.toLowerCase() + '%');
    sql += ` AND (lower(user_name) LIKE $${params.length} OR lower(vorher::text) LIKE $${params.length} OR lower(nachher::text) LIKE $${params.length})`;
  }
  sql += ' ORDER BY id DESC LIMIT 500';
  res.json(await query(sql, params));
});
