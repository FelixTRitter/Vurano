/**
 * Test der Ansprechpartner-Suche im Firmen-Detail: Filter nach Name
 * ODER Position, Leerzustand bei kein Treffer, Suchfeld nur bei Partnern.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

const FIRMA = {
  id: 7, typ: 'firma', firmenname: 'Bauwerk AG',
  ansprechpartner: [
    { id: 1, vorname: 'Anna', nachname: 'Meier', position: 'Einkauf' },
    { id: 2, vorname: 'Bruno', nachname: 'Keller', position: 'Technische Leitung' },
    { id: 3, vorname: 'Clara', nachname: 'Suter', position: 'Buchhaltung' },
  ],
};

describe('Ansprechpartner-Suche', () => {
  beforeEach(() => mountShell());

  it('filtert nach Nachname', async () => {
    stubFetch({ '/api/kontakte/7': FIRMA });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '7');
    const suche = root.querySelector('#ap-suche') as HTMLInputElement;
    expect(root.querySelector('#ap-such-box')!.hasAttribute('hidden')).toBe(false);
    suche.value = 'keller';
    suche.dispatchEvent(new Event('input'));
    const rows = root.querySelectorAll('.partner-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Keller');
  });

  it('filtert nach Position', async () => {
    stubFetch({ '/api/kontakte/7': FIRMA });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '7');
    const suche = root.querySelector('#ap-suche') as HTMLInputElement;
    suche.value = 'leitung';
    suche.dispatchEvent(new Event('input'));
    const rows = root.querySelectorAll('.partner-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Bruno');
  });

  it('zeigt Leerzustand bei keinem Treffer', async () => {
    stubFetch({ '/api/kontakte/7': FIRMA });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '7');
    const suche = root.querySelector('#ap-suche') as HTMLInputElement;
    suche.value = 'xyz123';
    suche.dispatchEvent(new Event('input'));
    expect(root.querySelectorAll('.partner-row').length).toBe(0);
    expect(root.querySelector('#ap-liste')!.textContent).toContain('Kein Ansprechpartner passt');
  });

  it('blendet das Suchfeld aus, wenn es keine Ansprechpartner gibt', async () => {
    stubFetch({ '/api/kontakte/8': { id: 8, typ: 'firma', firmenname: 'Leer AG', ansprechpartner: [] } });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '8');
    expect(root.querySelector('#ap-such-box')!.hasAttribute('hidden')).toBe(true);
  });
});
