/**
 * Test v2k: nach der (entprellten) Suche in der Adressverwaltung bleibt der
 * Fokus im Suchfeld, damit man ohne Klick weitertippen/korrigieren kann.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

describe('Adressverwaltung-Suche behält Fokus', () => {
  beforeEach(() => {
    mountShell();
    // Filter zurücksetzen, damit Tests unabhängig sind
    (Kontakte as any).filter = { suche: '', typ: '', kategorie: '' };
  });

  it('setzt nach einem such-ausgelösten Neuaufbau den Fokus zurück ins Suchfeld', async () => {
    vi.useFakeTimers();
    stubFetch({
      '/api/kontakte/kategorien': [],
      '/api/kontakte': [{ id: 1, typ: 'person', display_name: 'Anna' }],
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderList(root);

    const suche = root.querySelector('#k-suche') as HTMLInputElement;
    suche.focus();
    suche.value = 'ann';
    suche.setSelectionRange(3, 3);
    suche.dispatchEvent(new Event('input'));

    // Entprellung (750 ms) auslösen -> renderList wird erneut aufgerufen
    await vi.advanceTimersByTimeAsync(800);
    vi.useRealTimers();
    await Promise.resolve();

    const neuesFeld = document.querySelector('#k-suche') as HTMLInputElement;
    expect(document.activeElement).toBe(neuesFeld);   // Fokus wieder im (neuen) Suchfeld
    expect(neuesFeld.value).toBe('ann');
  });

  it('behält den Fokus NICHT ohne Such-Auslöser (z. B. nach anderem Render)', async () => {
    stubFetch({
      '/api/kontakte/kategorien': [],
      '/api/kontakte': [{ id: 1, typ: 'person', display_name: 'Anna' }],
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderList(root);
    // Kein Such-Flag gesetzt -> Fokus soll nicht erzwungen ins Suchfeld
    expect(document.activeElement).not.toBe(root.querySelector('#k-suche'));
  });
});
