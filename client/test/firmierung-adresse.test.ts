/**
 * Tests v2h: zweizeilige Firmierung (Umbruch bleibt erhalten, wird aber in
 * Liste/Rail einzeilig dargestellt) und Adresszusatz in der Detailanzeige.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

describe('Zweizeilige Firmierung', () => {
  beforeEach(() => mountShell());

  it('zeigt den Umbruch im Firmendetail als <br>', async () => {
    stubFetch({
      '/api/kontakte/5': {
        id: 5, typ: 'firma', firmenname: 'Muster AG\nAbteilung Technik',
        strasse: 'Hauptstr. 1', adresszusatz: 'c/o Meier', plz: '8000', ort: 'Zürich', land: 'Schweiz',
        ansprechpartner: [],
      },
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '5');
    // Firmierung: der Umbruch erscheint als <br> im kv-value
    const html = root.innerHTML;
    expect(html).toContain('Muster AG<br>Abteilung Technik');
    // Rail-Titel einzeilig (kein <br>, Umbruch -> Leerzeichen)
    const rail = document.querySelector('.rail-title')!.textContent!;
    expect(rail).toBe('Muster AG Abteilung Technik');
  });

  it('zeigt den Adresszusatz in der Detail-Adresse', async () => {
    stubFetch({
      '/api/kontakte/5': {
        id: 5, typ: 'firma', firmenname: 'Muster AG',
        strasse: 'Hauptstr. 1', adresszusatz: 'c/o Meier', plz: '8000', ort: 'Zürich', land: 'Schweiz',
        ansprechpartner: [],
      },
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '5');
    const html = root.innerHTML;
    expect(html).toContain('c/o Meier');
    // Reihenfolge: Strasse vor Zusatz vor PLZ/Ort
    expect(html.indexOf('Hauptstr. 1')).toBeLessThan(html.indexOf('c/o Meier'));
    expect(html.indexOf('c/o Meier')).toBeLessThan(html.indexOf('Zürich'));
  });

  it('stellt den Firmennamen in der Liste einzeilig dar', async () => {
    stubFetch({
      '/api/kontakte/kategorien': [],
      '/api/kontakte': [{ id: 5, typ: 'firma', display_name: 'Muster AG\nAbteilung Technik', firmenname: 'Muster AG\nAbteilung Technik' }],
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderList(root);
    const zelle = root.querySelector('.cell-strong')!.textContent!;
    expect(zelle).toBe('Muster AG Abteilung Technik'); // Umbruch -> Leerzeichen
    expect(root.querySelector('.cell-strong')!.innerHTML).not.toContain('<br>');
  });
});
