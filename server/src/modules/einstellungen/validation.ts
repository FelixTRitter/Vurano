/**
 * MODUL EINSTELLUNGEN — VALIDIERUNG
 * ---------------------------------------------------------------
 * Reine, testbare Prüf-Funktionen für die Darstellungseinstellungen.
 * Erweitern: neue Einstellungsgruppen bekommen eigene validate-Funktionen.
 */
export const THEMES = ['hell', 'dunkel'] as const;
export type Theme = (typeof THEMES)[number];

/** Hex-Farbe im Format #RRGGBB (Groß-/Kleinschreibung egal). */
export function istHexFarbe(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function validateDarstellung(body: Record<string, unknown>): { ok: true; theme: Theme; akzentfarbe: string } | { ok: false; error: string } {
  const theme = body?.theme;
  const farbe = body?.akzentfarbe;
  if (!THEMES.includes(theme as Theme)) return { ok: false, error: 'Ungültiges Farbschema.' };
  if (!istHexFarbe(farbe)) return { ok: false, error: 'Führungsfarbe muss eine Hex-Farbe (#RRGGBB) sein.' };
  return { ok: true, theme: theme as Theme, akzentfarbe: (farbe as string).toUpperCase() };
}
