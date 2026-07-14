/**
 * Test: neuen Adressschlüssel anlegen (openKategorien). Deckt den
 * gemeldeten Bug ab, dass sich Schlüssel nicht speichern lassen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountShell } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

describe('Adressschlüssel anlegen', () => {
  beforeEach(() => mountShell());

  it('POSTet den neuen Namen und lädt die Liste neu', async () => {
    const posts: any[] = [];
    let kategorien = [{ id: '1', name: 'Kunde' }];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opt: any) => {
      const method = opt?.method || 'GET';
      const pfad = String(url).split('?')[0];
      if (pfad === '/api/kontakte/kategorien' && method === 'POST') {
        const body = JSON.parse(opt.body);
        posts.push(body);
        kategorien = [...kategorien, { id: '2', name: body.name }];
        return { ok: true, status: 200, json: async () => ({ id: 2, name: body.name }) } as Response;
      }
      if (pfad === '/api/kontakte/kategorien' && method === 'GET') {
        return { ok: true, status: 200, json: async () => kategorien } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }));

    await Kontakte.openKategorien();
    const input = document.querySelector('#kat-neu') as HTMLInputElement;
    input.value = 'Subunternehmer';
    (document.querySelector('#kat-add') as HTMLElement).click();
    await new Promise(r => setTimeout(r, 20)); // async POST + refresh

    expect(posts).toEqual([{ name: 'Subunternehmer' }]);
    expect(document.querySelector('#kat-list')!.textContent).toContain('Subunternehmer');
  });
});

describe('Adressschlüssel anlegen per Enter', () => {
  beforeEach(() => mountShell());

  it('Enter im Namensfeld legt an (schließt NICHT das Modal)', async () => {
    const posts: any[] = [];
    let kategorien = [{ id: '1', name: 'Kunde' }];
    vi.stubGlobal('fetch', vi.fn(async (url: string, opt: any) => {
      const method = opt?.method || 'GET';
      const pfad = String(url).split('?')[0];
      if (pfad === '/api/kontakte/kategorien' && method === 'POST') {
        const body = JSON.parse(opt.body);
        posts.push(body);
        kategorien = [...kategorien, { id: '9', name: body.name }];
        return { ok: true, status: 200, json: async () => ({ id: 9, name: body.name }) } as Response;
      }
      if (pfad === '/api/kontakte/kategorien' && method === 'GET') {
        return { ok: true, status: 200, json: async () => kategorien } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }));

    await Kontakte.openKategorien();
    const input = document.querySelector('#kat-neu') as HTMLInputElement;
    input.value = 'Partner';
    // Enter im Feld auslösen
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 20));

    expect(posts).toEqual([{ name: 'Partner' }]);            // wurde angelegt
    expect(document.querySelector('.modal-overlay')).not.toBeNull(); // Modal noch offen
    expect(document.querySelector('#kat-list')!.textContent).toContain('Partner');
  });
});
