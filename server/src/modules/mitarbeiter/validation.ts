/** Feldliste und Eingabeaufbereitung Mitarbeiter — Muster wie Modul kontakte. */
export const FIELDS = [
  'anrede', 'vorname', 'nachname',
  'strasse', 'land', 'land_code', 'plz', 'ort',
  'telefon', 'mobil', 'email',
  'firma_telefon', 'firma_email',
  'funktion_id', 'arbeitszeitmodell_id', 'eintritt', 'austritt', 'pensum',
  'geburtsdatum', 'ahv_nummer', 'zivilstand', 'staatsangehoerigkeit',
  'aufenthaltsbewilligung', 'quellensteuer', 'religion', 'kinder', 'iban',
  'kontoinhaber', 'sv_land', 'steuer_id', 'steuerklasse',
  'notizen',
] as const;

export type MitarbeiterInput = Record<(typeof FIELDS)[number], unknown>;

export function pick(body: Record<string, unknown>): MitarbeiterInput {
  const o = {} as MitarbeiterInput;
  for (const f of FIELDS) {
    const v = body?.[f];
    o[f] = v === '' || v === undefined ? null : v;
  }
  // Typkoersionen für die Datenbank
  o.quellensteuer = o.quellensteuer === true || o.quellensteuer === 1 || o.quellensteuer === '1';
  if (o.kinder !== null) o.kinder = Number(o.kinder);
  if (o.pensum !== null) o.pensum = Number(o.pensum);
  return o;
}

export const STEUERKLASSEN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function validate(d: MitarbeiterInput): string | null {
  if (!d.nachname) return 'Nachname erforderlich.';
  if (d.sv_land !== null && d.sv_land !== 'DE' && d.sv_land !== 'CH')
    return 'Versicherungsland muss DE oder CH sein.';
  if (d.steuerklasse !== null && !STEUERKLASSEN.includes(String(d.steuerklasse)))
    return 'Steuerklasse muss I bis VI sein.';
  if (d.kinder !== null && (!Number.isInteger(d.kinder) || (d.kinder as number) < 0))
    return 'Anzahl Kinder muss eine ganze Zahl sein.';
  if (d.pensum !== null && (Number.isNaN(d.pensum) || (d.pensum as number) <= 0 || (d.pensum as number) > 100))
    return 'Pensum muss zwischen 1 und 100 liegen.';
  return null;
}
