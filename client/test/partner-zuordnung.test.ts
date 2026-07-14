/**
 * Tests für die Zuordnungs-Modals (v2e): durchsuchbare Auswahl beim
 * Verschieben zu anderer Firma und beim Zuordnen bestehender Personen;
 * Modal schließt nach erfolgreichem Speichern.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

describe('Ansprechpartner verschieben (movePartner)', () => {
  beforeEach(() => {
    mountShell();
    (Kontakte as any).renderDetail = vi.fn(); // Neuaufbau der Seite abfangen
  });

  it('filtert Zielfirmen und verschiebt bei Auswahl, Modal schließt', async () => {
    const puts: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opt: any) => {
      const method = opt?.method || 'GET';
      const pfad = String(url).split('?')[0];
      if (pfad === '/api/kontakte' && method === 'GET') {
        return { ok: true, status: 200, json: async () => [
          { id: 10, firmenname: 'Alpha AG' },
          { id: 11, firmenname: 'Beta GmbH' },
          { id: 12, firmenname: 'Gamma AG' },
        ]} as Response;
      }
      if (pfad === '/api/kontakte/5/firma' && method === 'PUT') {
        puts.push(JSON.parse(opt.body));
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }));

    await (Kontakte as any).movePartner({ id: 5, vorname: 'Eva', nachname: 'Test' }, 99, document.getElementById('content'));
    // Filter: "beta" zeigt nur Beta GmbH
    const suche = document.querySelector('#mv-suche') as HTMLInputElement;
    suche.value = 'beta';
    suche.dispatchEvent(new Event('input'));
    let rows = document.querySelectorAll('#mv-liste .pick-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Beta');
    // auswählen + bestätigen
    (rows[0] as HTMLElement).click();
    // Direkt den OK-Button klicken:
    const okBtn = document.querySelector('[data-ok]') as HTMLElement;
    okBtn?.click();
    await new Promise(r => setTimeout(r, 20));
    expect(puts).toEqual([{ firma_id: 11 }]);
    expect(document.querySelector('.modal-overlay')).toBeNull(); // Modal geschlossen
  });

  it('verschiebt nicht ohne Auswahl', async () => {
    stubFetch({ '/api/kontakte': [{ id: 10, firmenname: 'Alpha AG' }] });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await (Kontakte as any).movePartner({ id: 5, vorname: 'Eva', nachname: 'Test' }, 99, document.getElementById('content'));
    const okBtn = document.querySelector('[data-ok]') as HTMLElement;
    okBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    expect(alertSpy).toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).not.toBeNull(); // bleibt offen
  });
});

describe('Bestehende Person zuordnen (addExistingPartner)', () => {
  beforeEach(() => {
    mountShell();
    (Kontakte as any).renderDetail = vi.fn();
  });

  it('filtert freie Personen nach Name', async () => {
    stubFetch({ '/api/kontakte/personen/frei': [
      { id: 1, vorname: 'Anna', nachname: 'Meier' },
      { id: 2, vorname: 'Bruno', nachname: 'Keller' },
    ]});
    await (Kontakte as any).addExistingPartner(7, document.getElementById('content'));
    const suche = document.querySelector('#ep-suche') as HTMLInputElement;
    suche.value = 'keller';
    suche.dispatchEvent(new Event('input'));
    const rows = document.querySelectorAll('#ep-liste .pick-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Keller');
  });
});
