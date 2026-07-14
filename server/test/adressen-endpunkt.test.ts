/**
 * Test des Adress-Endpunkts (Proxy-Verhalten): Mindestlänge, Fehler-Fallback
 * auf leere Liste (Formular bleibt nutzbar), Struktur.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { adressenRouter } from '../src/modules/adressen/routes.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/adressen', adressenRouter);
  return a;
}

describe('GET /api/adressen/suche', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('liefert [] bei weniger als 3 Zeichen (keine externe Anfrage)', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const res = await request(app()).get('/api/adressen/suche?q=ab');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('gibt bei Dienstausfall [] zurück statt eines Fehlers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const res = await request(app()).get('/api/adressen/suche?q=Steinbeis');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('reicht Vorschläge durch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{ properties: { street: 'Hauptstr', housenumber: '1', postcode: '8000', city: 'Zürich', country: 'Switzerland' } }] }),
    })));
    const res = await request(app()).get('/api/adressen/suche?q=Hauptstr');
    expect(res.status).toBe(200);
    expect(res.body[0].ort).toBe('Zürich');
    expect(res.body[0].land).toBe('Schweiz');
  });
});
