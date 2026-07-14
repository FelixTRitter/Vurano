/**
 * MODUL-REGISTRY — zentrale Liste aller Module/Submodule
 * ---------------------------------------------------------------
 * Die EINE Quelle der Wahrheit für das Berechtigungssystem. Jeder Eintrag
 * ist ein Zugriffs-„Schlüssel", auf den eine Rolle Zugriff erhalten kann.
 *
 * WICHTIG (Team-Regel, siehe CLAUDE.md): Kommt ein neues Submodul in die
 * Navigation, MUSS es hier ergänzt werden — sonst taucht es nicht in der
 * Rollen-Rechteverwaltung auf. Die Reihenfolge/Gruppierung hier bestimmt
 * auch die Anzeige im Rollen-Detail.
 *
 * Granularität: aktuell pro Submodul (die Submodule sind die eigentlichen
 * Arbeitsmodule). Feinere Schlüssel (Aktionen, sensible Felder) können
 * später als zusätzliche Einträge ergänzt werden, ohne das Modell zu ändern —
 * der Schlüssel ist einfach ein String.
 */

export interface ModulEintrag {
  key: string;        // eindeutiger Berechtigungsschlüssel, z. B. 'kontakte'
  label: string;      // Anzeigename
  gruppe: string;     // Überschrift/Gruppierung in der Rechteverwaltung
}

export const MODULE: ModulEintrag[] = [
  // Hauptbereich (eigenständige Module)
  { key: 'dashboard',          label: 'Dashboard',           gruppe: 'Allgemein' },
  { key: 'verkaufsartikel',    label: 'Verkaufsartikelstamm', gruppe: 'Vertrieb' },
  { key: 'projektabwicklung',  label: 'Projektabwicklung',   gruppe: 'Betrieb' },
  { key: 'materialwirtschaft', label: 'Materialwirtschaft',  gruppe: 'Betrieb' },
  { key: 'produktionsplanung', label: 'Produktionsplanung',  gruppe: 'Betrieb' },
  { key: 'warenlieferung',     label: 'Warenlieferung',      gruppe: 'Betrieb' },
  { key: 'montageverwaltung',  label: 'Montageverwaltung',   gruppe: 'Betrieb' },
  { key: 'service',            label: 'Service',             gruppe: 'Betrieb' },
  { key: 'kontakte',           label: 'Adressverwaltung',    gruppe: 'Betrieb' },
  { key: 'teilestamm',         label: 'Teilestamm',          gruppe: 'Betrieb' },
  // Mitarbeiterverwaltung (Submodule)
  { key: 'mitarbeiter',        label: 'Mitarbeiter',         gruppe: 'Mitarbeiterverwaltung' },
  { key: 'arbeitszeitmodelle', label: 'Arbeitszeitmodelle',  gruppe: 'Mitarbeiterverwaltung' },
  // Stammdaten (Submodule)
  { key: 'unternehmen',        label: 'Unternehmen',         gruppe: 'Stammdaten' },
  { key: 'qualifikationen',    label: 'Qualifikationen',      gruppe: 'Stammdaten' },
  { key: 'einheiten',          label: 'Einheiten',           gruppe: 'Stammdaten' },
  { key: 'sprachen',           label: 'Sprachen',            gruppe: 'Stammdaten' },
  // Systemverwaltung (Submodule)
  { key: 'users',              label: 'User Verwaltung',     gruppe: 'Systemverwaltung' },
  { key: 'rollen',             label: 'Zugriffsrollen',      gruppe: 'Systemverwaltung' },
  { key: 'crud-doku',          label: 'CRUD-Dokumentation',  gruppe: 'Systemverwaltung' },
  // Einstellungen (persönlich — jeder darf seine eigenen)
  { key: 'einstellungen',      label: 'Einstellungen',       gruppe: 'Persönlich' },
];

export const MODUL_KEYS = new Set(MODULE.map((m) => m.key));
