/**
 * ÜBERSETZUNG — Provider-Abstraktion
 * ---------------------------------------------------------------
 * Kapselt den KI-Übersetzungsdienst hinter einer schmalen Schnittstelle,
 * damit der Anbieter später ohne Änderung am restlichen Code getauscht werden
 * kann (analog zum Adress-Provider).
 *
 * Aktiv: Anthropic Messages-API. Konfiguration über Umgebungsvariablen:
 *   ANTHROPIC_API_KEY   — Pflicht; ohne Schlüssel ist die Übersetzung schlicht
 *                         nicht verfügbar (die Oberfläche meldet das sauber,
 *                         Texte bleiben von Hand pflegbar).
 *   UEBERSETZUNG_MODELL — optional, überschreibt das Standardmodell.
 *
 * Grundsatz (siehe CLAUDE.md): Die KI liefert einen ENTWURF, keine Wahrheit.
 * Der Aufrufer speichert nichts automatisch — der Anwender prüft, korrigiert
 * und speichert selbst. Gerade Fachbegriffe im Handwerk brauchen den Blick
 * eines Menschen.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODELL = process.env.UEBERSETZUNG_MODELL || 'claude-sonnet-5';

export interface UebersetzungsEingabe {
  verkaufstext: string;
  lvText: string;
  quellSprache: string;   // Klarname, z. B. "Deutsch"
  zielSprache: string;    // Klarname, z. B. "Englisch"
}

export interface UebersetzungsErgebnis {
  verkaufstext: string;
  lv_text: string;
}

/** Ist ein Übersetzungsdienst konfiguriert? */
export function uebersetzungVerfuegbar(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Entfernt Markdown-Zaunzeichen, falls das Modell sie trotz Anweisung setzt. */
function jsonBereinigen(text: string): string {
  return text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
}

/**
 * Übersetzt Verkaufs- und LV-Text in die Zielsprache.
 * Wirft bei fehlender Konfiguration oder Dienstfehler — der Aufrufer wandelt
 * das in eine verständliche Meldung um.
 */
export async function uebersetze(e: UebersetzungsEingabe): Promise<UebersetzungsErgebnis> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Übersetzungsdienst ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt).');

  const system =
    'Du bist Fachübersetzer für Handwerks- und Fertigungsbetriebe. Übersetze die Texte ' +
    `von ${e.quellSprache} nach ${e.zielSprache}. Behalte Fachbegriffe, Masse, Normen und ` +
    'Artikelbezeichnungen korrekt bei; übersetze nicht wörtlich, sondern fachlich üblich. ' +
    'Behalte Zeilenumbrüche und die Struktur der Vorlage bei. ' +
    'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt der Form ' +
    '{"verkaufstext": "...", "lv_text": "..."} — ohne Vorrede, ohne Markdown-Zaun. ' +
    'Ist ein Eingabetext leer, gib für ihn eine leere Zeichenkette zurück.';

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELL,
      max_tokens: 4000,
      system,
      messages: [{
        role: 'user',
        content: JSON.stringify({ verkaufstext: e.verkaufstext || '', lv_text: e.lvText || '' }),
      }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Übersetzungsdienst nicht erreichbar (HTTP ${res.status}). ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
  let parsed: Partial<UebersetzungsErgebnis>;
  try {
    parsed = JSON.parse(jsonBereinigen(text));
  } catch {
    throw new Error('Antwort des Übersetzungsdienstes war nicht lesbar.');
  }
  return {
    verkaufstext: String(parsed.verkaufstext ?? ''),
    lv_text: String(parsed.lv_text ?? ''),
  };
}
