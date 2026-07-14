import { describe, it, expect } from 'vitest';
import { pick, validate, FIELDS } from '../src/modules/kontakte/validation.js';

describe('Kontakte pick()', () => {
  it('setzt Leerstrings und fehlende Felder auf null', () => {
    const d = pick({ vorname: '', nachname: 'Muster' });
    expect(d.vorname).toBeNull();
    expect(d.nachname).toBe('Muster');
    expect(d.notizen).toBeNull();
  });
  it('setzt Defaults wie Immo Control: typ=person, land=Schweiz', () => {
    const d = pick({});
    expect(d.typ).toBe('person');
    expect(d.land).toBe('Schweiz');
  });
  it('übernimmt nur bekannte Felder', () => {
    const d = pick({ nachname: 'X', boese_spalte: 'y' } as any);
    expect('boese_spalte' in d).toBe(false);
    expect(Object.keys(d).length).toBe(FIELDS.length);
  });
});

describe('Kontakte validate()', () => {
  it('Firma braucht Firmenname', () => {
    expect(validate(pick({ typ: 'firma' }))).toBe('Firmenname erforderlich.');
    expect(validate(pick({ typ: 'firma', firmenname: 'Muster AG' }))).toBeNull();
  });
  it('Person braucht Nachname', () => {
    expect(validate(pick({ typ: 'person' }))).toBe('Nachname erforderlich.');
    expect(validate(pick({ nachname: 'Ritter' }))).toBeNull();
  });
});
