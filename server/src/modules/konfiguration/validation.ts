/**
 * MODUL KONFIGURATION — VALIDIERUNG
 * ---------------------------------------------------------------
 * Reine, testbare Prüf-Funktionen. Aktuell: Stammdaten Firma.
 * land entscheidet die Bezugswährung: DE -> EUR, CH -> CHF.
 */
export const LAENDER_FIRMA = ['DE', 'CH'] as const;
export type FirmaLand = (typeof LAENDER_FIRMA)[number];

export function waehrungFuer(land: FirmaLand): 'EUR' | 'CHF' {
  return land === 'CH' ? 'CHF' : 'EUR';
}

/**
 * IBAN-Prüfziffernvalidierung (ISO 13616, Mod-97): die ersten vier
 * Zeichen ans Ende, Buchstaben -> Zahlen (A=10 … Z=35), Rest mod 97
 * muss 1 ergeben. Fängt praktisch jeden Tippfehler ab.
 */
export function normalisiereIban(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, '').toUpperCase();
}
export function istGueltigeIban(v: unknown): boolean {
  const iban = normalisiereIban(v);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const wert = /[A-Z]/.test(zeichen) ? String(zeichen.charCodeAt(0) - 55) : zeichen;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

export interface BankInput { id: number | null; bezeichnung: string | null; iban: string; bic: string | null; ist_standard: boolean; }
export interface GfInput { id: number | null; name: string; funktion: string | null; }

export interface FirmaInput {
  firmenname: string;
  rechtsform: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: FirmaLand;
  standard_sprache: string;
  handelsregister_nummer: string | null;
  register_stelle: string | null;
  mwst_id: string | null;
  steuernummer: string | null;
  uid_nummer: string | null;
  zaz_konto: string | null;
  eori_nummer: string | null;
  praeferenz_bewilligungen: string | null;
  geschaeftsfuehrung: GfInput[];
  banken: BankInput[];
}

export function validateFirma(body: Record<string, unknown>): { ok: true; value: FirmaInput } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const firmenname = str(body?.firmenname);
  if (!firmenname) return { ok: false, error: 'Firmenname erforderlich.' };
  const land = body?.land;
  if (!LAENDER_FIRMA.includes(land as FirmaLand))
    return { ok: false, error: 'Land muss Deutschland (DE) oder Schweiz (CH) sein.' };

  // Geschäftsführung: jede Zeile braucht einen Namen
  const gf: GfInput[] = [];
  for (const row of Array.isArray(body?.geschaeftsfuehrung) ? (body.geschaeftsfuehrung as any[]) : []) {
    const name = str(row?.name);
    if (!name) return { ok: false, error: 'Geschäftsführung: Name darf nicht leer sein.' };
    gf.push({ id: row?.id ? Number(row.id) : null, name, funktion: str(row?.funktion) });
  }

  // Banken: IBAN Pflicht + Prüfziffer; genau EIN Standardkonto
  const banken: BankInput[] = [];
  for (const row of Array.isArray(body?.banken) ? (body.banken as any[]) : []) {
    const iban = normalisiereIban(row?.iban);
    if (!istGueltigeIban(iban))
      return { ok: false, error: `Bankverbindung: IBAN "${iban || '(leer)'}" ist ungültig (Prüfziffer).` };
    banken.push({
      id: row?.id ? Number(row.id) : null,
      bezeichnung: str(row?.bezeichnung),
      iban,
      bic: str(row?.bic) ? String(row.bic).replace(/\s+/g, '').toUpperCase() : null,
      ist_standard: row?.ist_standard === true || row?.ist_standard === 1 || row?.ist_standard === '1',
    });
  }
  if (banken.length > 0 && !banken.some((b) => b.ist_standard)) banken[0].ist_standard = true;
  if (banken.filter((b) => b.ist_standard).length > 1)
    return { ok: false, error: 'Es kann nur ein Standardkonto geben.' };

  return {
    ok: true,
    value: {
      firmenname,
      rechtsform: str(body?.rechtsform),
      strasse: str(body?.strasse),
      plz: str(body?.plz),
      ort: str(body?.ort),
      land: land as FirmaLand,
      standard_sprache: (str(body?.standard_sprache) || 'de').toLowerCase(),
      handelsregister_nummer: str(body?.handelsregister_nummer),
      register_stelle: str(body?.register_stelle),
      mwst_id: str(body?.mwst_id),
      steuernummer: str(body?.steuernummer),
      uid_nummer: str(body?.uid_nummer),
      zaz_konto: str(body?.zaz_konto),
      eori_nummer: str(body?.eori_nummer),
      praeferenz_bewilligungen: str(body?.praeferenz_bewilligungen),
      geschaeftsfuehrung: gf,
      banken,
    },
  };
}
