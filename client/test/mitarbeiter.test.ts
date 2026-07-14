/**
 * DOM-Tests für das Mitarbeiter-Modul: beide Tabellen (aktiv/ausgetreten),
 * Zuordnung der Zeilen, Spalteninhalte.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Mitarbeiter } from '../src/mitarbeiter.js';

const DATEN = [
  { id: 1, anrede: 'Herr', vorname: 'Peter', nachname: 'Huber', funktion_name: 'Monteur', eintritt: '2024-03-01', aktiv: true },
  { id: 2, anrede: 'Frau', vorname: 'Anna', nachname: 'Keller', funktion_name: 'Geschäftsführer', eintritt: '2020-01-01', austritt: '2025-06-30', aktiv: false },
];

describe('Mitarbeiter-Liste', () => {
  beforeEach(() => {
    mountShell();
    location.hash = '#mitarbeiter';
    stubFetch({
      '/api/mitarbeiter': DATEN,
      '/api/stammdaten/funktionen': [],
      '/api/stammdaten/qualifikationen': [],
      '/api/konfiguration/arbeitszeitmodelle': [],
      '/api/konfiguration/firma': { land: 'DE', waehrung: 'EUR' },
    });
  });

  it('rendert aktive und ausgetretene Mitarbeiter in getrennten Tabellen', async () => {
    const root = document.getElementById('content')!;
    await Mitarbeiter.renderList(root);
    const aktiv = root.querySelector('#tbl-ma-aktiv tbody')!;
    const inaktiv = root.querySelector('#tbl-ma-inaktiv tbody')!;
    expect(aktiv.querySelectorAll('tr').length).toBe(1);
    expect(inaktiv.querySelectorAll('tr').length).toBe(1);
    expect(aktiv.textContent).toContain('Huber');
    expect(inaktiv.textContent).toContain('Keller');
  });

  it('zeigt die spezifizierten Spalten inkl. Funktion als Badge', async () => {
    const root = document.getElementById('content')!;
    await Mitarbeiter.renderList(root);
    const kopf = root.querySelector('#tbl-ma-aktiv thead')!.textContent!;
    for (const spalte of ['Anrede', 'Vorname', 'Nachname', 'Funktion', 'Eintritt']) {
      expect(kopf).toContain(spalte);
    }
    expect(root.querySelector('#tbl-ma-aktiv .badge')!.textContent).toBe('Monteur');
  });

  it('zeigt Leerzustände, wenn keine Daten vorhanden sind', async () => {
    stubFetch({
      '/api/mitarbeiter': [],
      '/api/stammdaten/funktionen': [],
      '/api/stammdaten/qualifikationen': [],
      '/api/konfiguration/arbeitszeitmodelle': [],
      '/api/konfiguration/firma': { land: 'DE', waehrung: 'EUR' },
    });
    const root = document.getElementById('content')!;
    await Mitarbeiter.renderList(root);
    expect(root.textContent).toContain('Noch keine Mitarbeiter erfasst.');
    expect(root.textContent).toContain('Keine ausgetretenen Mitarbeiter.');
  });
});
