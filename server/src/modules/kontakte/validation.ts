/**
 * Feldliste und Eingabeaufbereitung — 1:1 aus Immo Control (routes/kontakte.js,
 * pick()), als reine testbare Funktion. Das Alt-Flag `lieferant` wurde nicht
 * übernommen (in Immo Control ungenutzt; die Zuordnung läuft über Adressschlüssel).
 */
export const FIELDS = [
  'typ', 'firma_id', 'anrede', 'vorname', 'nachname', 'firmenname',
  'strasse', 'adresszusatz', 'plz', 'ort', 'land', 'email', 'telefon', 'mobil', 'website',
  'geburtsdatum', 'notizen',
  // Person: zusätzliche Stammfelder
  'abteilung', 'sprache',
  // Person in Ansprechpartner-Rolle (Daten an der Firmen-Beziehung)
  'position', 'firma_email', 'firma_telefon', 'firma_mobil',
  // Firma: Steuer-/Registerangaben
  'ust_id', 'steuernummer', 'handelsregister_nummer', 'registergericht', 'eori_nummer',
] as const;

export type KontaktInput = Record<(typeof FIELDS)[number], unknown>;

export function pick(body: Record<string, unknown>): KontaktInput {
  const o = {} as KontaktInput;
  for (const f of FIELDS) {
    const v = body?.[f];
    o[f] = v === '' || v === undefined ? null : v;
  }
  if (!o.typ) o.typ = 'person';
  if (!o.land) o.land = 'Schweiz';
  return o;
}

/** Pflichtfeldprüfung wie in Immo Control. Gibt Fehlertext oder null zurück. */
export function validate(d: KontaktInput): string | null {
  if (d.typ === 'firma' && !String(d.firmenname ?? '').trim()) return 'Firmenname erforderlich.';
  if (d.typ === 'person' && !d.nachname) return 'Nachname erforderlich.';
  return null;
}
