import { describe, it, expect } from 'vitest';
import { validateFirma, waehrungFuer, istGueltigeIban, normalisiereIban } from '../src/modules/konfiguration/validation.js';

describe('Stammdaten Firma', () => {
  it('verlangt Firmenname und gültiges Land', () => {
    expect(validateFirma({ land: 'DE' }).ok).toBe(false);
    expect(validateFirma({ firmenname: 'Muster GmbH', land: 'AT' }).ok).toBe(false);
    const r = validateFirma({ firmenname: ' Muster GmbH ', land: 'CH', plz: '' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.firmenname).toBe('Muster GmbH'); expect(r.value.plz).toBeNull(); }
  });
  it('leitet die Bezugswährung aus dem Land ab', () => {
    expect(waehrungFuer('DE')).toBe('EUR');
    expect(waehrungFuer('CH')).toBe('CHF');
  });
});

describe('IBAN-Validierung (Mod-97)', () => {
  it('akzeptiert gültige deutsche und Schweizer IBANs (auch mit Leerzeichen)', () => {
    expect(istGueltigeIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(istGueltigeIban('CH93 0076 2011 6238 5295 7')).toBe(true);
  });
  it('weist Prüfziffernfehler und Unsinn ab', () => {
    expect(istGueltigeIban('DE89 3704 0044 0532 0130 01')).toBe(false); // letzte Ziffer gedreht
    expect(istGueltigeIban('HALLO')).toBe(false);
    expect(istGueltigeIban('')).toBe(false);
  });
  it('normalisiert auf Großschreibung ohne Leerzeichen', () => {
    expect(normalisiereIban(' ch93 0076 2011 6238 5295 7 ')).toBe('CH9300762011623852957');
  });
});

describe('Unternehmen: Listen-Validierung', () => {
  const basis = { firmenname: 'Muster GmbH', land: 'DE' };
  it('Geschäftsführung braucht Namen', () => {
    expect(validateFirma({ ...basis, geschaeftsfuehrung: [{ name: '' }] }).ok).toBe(false);
    expect(validateFirma({ ...basis, geschaeftsfuehrung: [{ name: 'Max Muster', funktion: 'GF' }] }).ok).toBe(true);
  });
  it('Banken: ungültige IBAN wird abgewiesen, erstes Konto wird Standard', () => {
    expect(validateFirma({ ...basis, banken: [{ iban: 'DE00 1111' }] }).ok).toBe(false);
    const r = validateFirma({ ...basis, banken: [{ iban: 'DE89370400440532013000' }, { iban: 'CH9300762011623852957' }] });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.banken[0].ist_standard).toBe(true); expect(r.value.banken[1].ist_standard).toBe(false); }
  });
  it('mehr als ein Standardkonto wird abgewiesen', () => {
    const r = validateFirma({ ...basis, banken: [
      { iban: 'DE89370400440532013000', ist_standard: true },
      { iban: 'CH9300762011623852957', ist_standard: true },
    ]});
    expect(r.ok).toBe(false);
  });
});
