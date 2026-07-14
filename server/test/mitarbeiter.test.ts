import { describe, it, expect } from 'vitest';
import { pick, validate } from '../src/modules/mitarbeiter/validation.js';

describe('Mitarbeiter pick()/validate()', () => {
  it('Nachname ist Pflicht', () => {
    expect(validate(pick({}))).toBe('Nachname erforderlich.');
    expect(validate(pick({ nachname: 'Muster' }))).toBeNull();
  });
  it('Quellensteuer-Checkbox (1/0) wird zu boolean', () => {
    expect(pick({ nachname: 'X', quellensteuer: 1 }).quellensteuer).toBe(true);
    expect(pick({ nachname: 'X', quellensteuer: 0 }).quellensteuer).toBe(false);
  });
  it('Kinder muss ganze Zahl >= 0 sein', () => {
    expect(validate(pick({ nachname: 'X', kinder: '2' }))).toBeNull();
    expect(validate(pick({ nachname: 'X', kinder: '1.5' }))).toContain('ganze Zahl');
  });
  it('Pensum 1–100', () => {
    expect(validate(pick({ nachname: 'X', pensum: '80' }))).toBeNull();
    expect(validate(pick({ nachname: 'X', pensum: '120' }))).toContain('Pensum');
  });
  it('Leerstrings werden null (austritt leer = aktiv)', () => {
    expect(pick({ nachname: 'X', austritt: '' }).austritt).toBeNull();
  });
});

describe('Länderrichtige Lohnfelder', () => {
  it('sv_land nur DE/CH, Steuerklasse nur I-VI', () => {
    expect(validate(pick({ nachname: 'X', sv_land: 'AT' }))).toContain('Versicherungsland');
    expect(validate(pick({ nachname: 'X', sv_land: 'CH' }))).toBeNull();
    expect(validate(pick({ nachname: 'X', steuerklasse: 'VII' }))).toContain('Steuerklasse');
    expect(validate(pick({ nachname: 'X', steuerklasse: 'IV' }))).toBeNull();
  });
});
