/**
 * Regressionstest Bug (v2b): PUT /:id ist ein TEILUPDATE. Ein Formular,
 * das nur einen Teil der Spalten kennt (Personenformular ohne die
 * Ansprechpartner-Rollenfelder), darf die nicht gesendeten Felder NICHT
 * auf NULL setzen. Wir prüfen die Feldauswahl-Logik isoliert.
 */
import { describe, it, expect } from 'vitest';
import { FIELDS } from '../src/modules/kontakte/validation.js';

// Nachbildung der Server-Logik: nur gesendete Felder werden aktualisiert.
function zuAktualisierendeFelder(body: Record<string, unknown>): string[] {
  return FIELDS.filter((f) => body[f] !== undefined);
}

describe('PUT /:id Teilupdate-Feldauswahl', () => {
  it('aktualisiert nur die im Request enthaltenen Felder', () => {
    const personBody = {
      typ: 'person', vorname: 'Eva', nachname: 'Test',
      strasse: 'Privatstr. 7', email: 'privat@gmx.ch', telefon: '031',
      // KEINE Rollenfelder: position, firma_email, firma_telefon, firma_mobil, sprache
    };
    const felder = zuAktualisierendeFelder(personBody);
    expect(felder).toContain('vorname');
    expect(felder).toContain('strasse');
    // Rollenfelder dürfen NICHT dabei sein -> bleiben in der DB erhalten
    expect(felder).not.toContain('position');
    expect(felder).not.toContain('firma_email');
    expect(felder).not.toContain('firma_telefon');
    expect(felder).not.toContain('firma_mobil');
  });

  it('leere Strings zählen als gesendet (Feld wird geleert), fehlende Felder nicht', () => {
    const felder = zuAktualisierendeFelder({ email: '', vorname: 'X' });
    expect(felder).toContain('email');   // "" ist gesendet -> wird auf NULL gesetzt
    expect(felder).toContain('vorname');
    expect(felder).not.toContain('telefon'); // gar nicht gesendet -> bleibt
  });
});
