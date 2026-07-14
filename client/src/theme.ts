/**
 * FARBSCHEMA & FÜHRUNGSFARBE
 * ---------------------------------------------------------------
 * Zwei Zustände, sauber getrennt:
 *   - GESPEICHERT: der am Benutzerkonto hinterlegte Stand (setSavedTheme,
 *     gesetzt nach /api/auth/me und nach dem Speichern in den
 *     Einstellungen). Wird zusätzlich in localStorage gemerkt, damit
 *     schon die ANMELDESEITE im zuletzt genutzten Schema erscheint.
 *   - VORSCHAU: applyTheme(...) mit beliebigen Werten (Live-Vorschau in
 *     den Einstellungen). Beim Verlassen ohne Speichern setzt
 *     applySavedTheme() zurück — die Vorschau "leckt" nie in andere Module.
 *
 * Technik: data-theme ("hell"|"dunkel") am <html> + CSS-Variablen
 * --iv-primary/--iv-primary-hover; Dunkel-Palette in erp.css.
 */
export const DEFAULT_THEME = 'hell';
export const DEFAULT_AKZENT = '#F97316'; // Vurano-Orange
const STORAGE_KEY = 'vurano-darstellung';

let gespeichert = { theme: DEFAULT_THEME, akzentfarbe: DEFAULT_AKZENT };

/** Hex-Farbe um einen Faktor abdunkeln (0.12 = 12 % dunkler). */
export function darken(hex: string, faktor = 0.12): string {
  const n = parseInt(hex.slice(1), 16);
  const k = (v: number) => Math.max(0, Math.round(v * (1 - faktor)));
  const r = k((n >> 16) & 255), g = k((n >> 8) & 255), b = k(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

/** Darstellung anwenden (auch für die Live-Vorschau). */
export function applyTheme(theme: string = DEFAULT_THEME, akzentfarbe: string = DEFAULT_AKZENT): void {
  const root = document.documentElement;
  root.dataset.theme = theme === 'dunkel' ? 'dunkel' : 'hell';
  root.style.setProperty('--iv-primary', akzentfarbe);
  root.style.setProperty('--iv-primary-hover', darken(akzentfarbe));
}

/** Gespeicherten Stand setzen, anwenden und fürs nächste Laden merken. */
export function setSavedTheme(theme: string, akzentfarbe: string): void {
  gespeichert = { theme, akzentfarbe };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(gespeichert)); } catch { /* z. B. Private Mode */ }
  applyTheme(theme, akzentfarbe);
}

/** Zurück auf den gespeicherten Stand (Vorschau verwerfen). */
export function applySavedTheme(): void {
  applyTheme(gespeichert.theme, gespeichert.akzentfarbe);
}

export function getSavedTheme(): { theme: string; akzentfarbe: string } {
  return { ...gespeichert };
}

/** Beim App-Start: zuletzt genutztes Schema laden (gilt für die Anmeldeseite). */
export function loadStoredTheme(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d.theme === 'string' && typeof d.akzentfarbe === 'string') gespeichert = d;
    }
  } catch { /* defekter Eintrag -> Defaults */ }
  applySavedTheme();
}
