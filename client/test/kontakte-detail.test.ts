import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountShell, stubFetch } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';
import { Router } from '../src/ic/router.js';

describe('Kontakte-Liste', () => {
  beforeEach(() => mountShell());

  it('Zeilenklick navigiert zur Detailseite (kein Modal)', async () => {
    stubFetch({
      '/api/kontakte/kategorien': [],
      '/api/kontakte': [{ id: 5, typ: 'firma', firmenname: 'Muster AG' }],
    });
    const goSpy = vi.spyOn(Router, 'go');
    const root = document.getElementById('content')!;
    await Kontakte.renderList(root);
    const tr = root.querySelector('#tbl-kontakte tbody tr.clickable') as HTMLElement;
    expect(tr).toBeTruthy();
    tr.click();
    expect(goSpy).toHaveBeenCalledWith('kontakte/5');
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});

describe('Kontakte-Detailseite', () => {
  beforeEach(() => mountShell());

  it('renderDetail ist eine Funktion und rendert die Firmen-Detailseite mit Reitern', async () => {
    const { Kontakte } = await import('../src/kontakte.js');
    expect(typeof Kontakte.renderDetail).toBe('function');
    stubFetch({
      '/api/kontakte/7': {
        id: 7, typ: 'firma', firmenname: 'Bauwerk AG', ust_id: 'CHE-1',
        ansprechpartner: [{ id: 9, vorname: 'Anna', nachname: 'Meier', position: 'Einkauf' }],
      },
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '7');
    expect(root.querySelector('#kd-tabs')).toBeTruthy();
    expect(root.textContent).toContain('Kontaktdaten');
    expect(root.textContent).toContain('Umsätze');
    expect(root.querySelector('#ap-liste')!.textContent).toContain('Meier');
  });
});

describe('Ansprechpartner-Detail (nur geschäftliche Daten)', () => {
  beforeEach(() => mountShell());

  it('zeigt geschäftliche Felder, aber keine private E-Mail', async () => {
    const { Kontakte } = await import('../src/kontakte.js');
    expect(typeof Kontakte.addExistingPartner).toBe('function');
    stubFetch({
      '/api/kontakte/7': {
        id: 7, typ: 'firma', firmenname: 'Bauwerk AG',
        ansprechpartner: [{
          id: 9, vorname: 'Anna', nachname: 'Meier', position: 'Einkauf',
          firma_email: 'a.meier@bauwerk.ch', firma_telefon: '031',
          email: 'privat@gmx.ch', // privat — darf NICHT erscheinen
        }],
      },
    });
    const root = document.getElementById('content')!;
    await Kontakte.renderDetail(root, '7');
    (root.querySelector('.partner-row') as HTMLElement).click();
    const detail = root.querySelector('#ap-detail')!.textContent!;
    expect(detail).toContain('a.meier@bauwerk.ch'); // geschäftlich sichtbar
    expect(detail).not.toContain('privat@gmx.ch');  // privat verborgen
  });
});
