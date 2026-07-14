/**
 * Regressionstests Adressverwaltung: Ladeaufrufe des Formulars müssen
 * PARALLEL starten (sequentielle awaits waren die Ursache der 1–2 s
 * Modal-Verzögerung) — und die Liste rendert korrekt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

describe('Kontakte.openForm', () => {
  beforeEach(() => mountShell());

  it('startet alle Ladeaufrufe parallel (nicht nacheinander)', async () => {
    // fetch, das NIE antwortet: bei paralleler Ladung sind trotzdem sofort
    // mehrere Requests unterwegs; sequentieller Code käme nur auf einen.
    const aufrufe: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      aufrufe.push(String(url).split('?')[0]);
      return new Promise(() => {}); // hängt absichtlich
    }));
    void Kontakte.openForm(7); // Bearbeiten: Kategorien + Kontakt + Firmen
    await Promise.resolve();   // Microtasks abarbeiten
    expect(aufrufe.length).toBeGreaterThanOrEqual(3);
    expect(aufrufe).toContain('/api/kontakte/kategorien');
    expect(aufrufe).toContain('/api/kontakte/7');
  });

  it('rendert das Firmen-Formular nach dem Laden', async () => {
    stubFetch({
      '/api/kontakte/kategorien': [{ id: 1, name: 'Kunde' }],
      '/api/kontakte': [],
    });
    await Kontakte.openForm(null, 'firma');
    expect(document.body.textContent).toContain('Firmierung');
    expect(document.body.textContent).toContain('Adressschlüssel');
    document.querySelector('.modal-overlay')?.remove();
  });
});
