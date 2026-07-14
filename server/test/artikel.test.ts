/**
 * Tests Artikel/Verkaufsartikelstamm: Teiletyp-Validierung, Anlegen
 * (Bezeichnung-Pflicht, Artikelnummer-Duplikat), Teiletyp-Filter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));
vi.mock('../src/auth/middleware.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/audit/log.js', () => ({ auditLog: vi.fn(), ladeSnapshot: vi.fn(async () => ({ id: 1, teiletyp: 'verkaufsartikel' })) }));

import express from 'express';
import request from 'supertest';

async function app() {
  const { artikelRouter } = await import('../src/modules/artikel/routes.js');
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { (req as any).user = { id: 1, name: 'Admin', role: 'admin' }; next(); });
  a.use('/api/artikel', artikelRouter);
  return a;
}

describe('Teiletypen', () => {
  it('enthält die sechs hardcoded Typen', async () => {
    const { TEILETYPEN, TEILETYP_KEYS } = await import('../src/modules/artikel/teiletypen.js');
    expect(TEILETYPEN).toHaveLength(6);
    for (const k of ['verkaufsartikel', 'kaufartikel', 'baugruppe', 'lagerteil', 'meterware', 'halbzeug']) {
      expect(TEILETYP_KEYS.has(k as never)).toBe(true);
    }
  });
});

describe('Artikel-Endpunkte', () => {
  beforeEach(() => queryMock.mockReset());

  it('legt einen Verkaufsartikel an', async () => {
    queryMock.mockResolvedValueOnce([{ id: '10' }]); // INSERT ... RETURNING
    const res = await request(await app()).post('/api/artikel').send({ teiletyp: 'verkaufsartikel', bezeichnung: 'Schrank' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 10 });
  });

  it('lehnt ungültigen Teiletyp ab', async () => {
    const res = await request(await app()).post('/api/artikel').send({ teiletyp: 'quatsch', bezeichnung: 'X' });
    expect(res.status).toBe(400);
  });

  it('verlangt eine Bezeichnung', async () => {
    const res = await request(await app()).post('/api/artikel').send({ teiletyp: 'verkaufsartikel' });
    expect(res.status).toBe(400);
  });

  it('lehnt doppelte Artikelnummer ab', async () => {
    queryMock.mockResolvedValueOnce([{ id: '5' }]); // Duplikatprüfung findet Treffer
    const res = await request(await app()).post('/api/artikel').send({ teiletyp: 'verkaufsartikel', bezeichnung: 'X', artikelnummer: 'VK-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bereits vergeben/i);
  });

  it('lehnt unbekannten Teiletyp-Filter ab', async () => {
    const res = await request(await app()).get('/api/artikel?teiletyp=quatsch');
    expect(res.status).toBe(400);
  });

  it('filtert nach mehreren Teiletypen (Komma-Liste)', async () => {
    queryMock.mockResolvedValueOnce([{ id: 1, teiletyp: 'kaufartikel' }, { id: 2, teiletyp: 'halbzeug' }]);
    const res = await request(await app()).get('/api/artikel?teiletyp=kaufartikel,halbzeug');
    expect(res.status).toBe(200);
    // ANY($1) mit dem Typen-Array
    const call = queryMock.mock.calls[0];
    expect(call[1][0]).toEqual(['kaufartikel', 'halbzeug']);
  });

  it('lehnt Komma-Liste mit ungültigem Typ ab', async () => {
    const res = await request(await app()).get('/api/artikel?teiletyp=kaufartikel,quatsch');
    expect(res.status).toBe(400);
  });

  it('speichert Verkaufspreis, Materialkosten und die drei Dauern', async () => {
    queryMock.mockResolvedValueOnce([{ id: '11' }]);
    const res = await request(await app()).post('/api/artikel').send({
      teiletyp: 'verkaufsartikel', bezeichnung: 'Schrank',
      verkaufspreis: '1250.00', materialkosten: '780.00',
      planungsdauer: '2.5', produktionsdauer: '8', montagedauer: '4',
    });
    expect(res.status).toBe(200);
    const params = queryMock.mock.calls[0][1] as any[];
    // Reihenfolge: … verkaufspreis, materialkosten, planungsdauer, produktionsdauer, montagedauer
    expect(params.slice(-5)).toEqual([1250, 780, 2.5, 8, 4]);
  });

  it('akzeptiert Komma und Schweizer Hochkomma als Zahleneingabe', async () => {
    queryMock.mockResolvedValueOnce([{ id: '12' }]);
    await request(await app()).post('/api/artikel').send({
      teiletyp: 'verkaufsartikel', bezeichnung: 'X',
      verkaufspreis: "1'250,50", materialkosten: '780,25', planungsdauer: '2,25',
    });
    const params = queryMock.mock.calls[0][1] as any[];
    expect(params.slice(-5)).toEqual([1250.5, 780.25, 2.25, null, null]);
  });

  it('leere Zahlenfelder werden null (nicht 0)', async () => {
    queryMock.mockResolvedValueOnce([{ id: '13' }]);
    await request(await app()).post('/api/artikel').send({
      teiletyp: 'verkaufsartikel', bezeichnung: 'X', verkaufspreis: '', materialkosten: '', planungsdauer: '',
    });
    const params = queryMock.mock.calls[0][1] as any[];
    expect(params.slice(-5)).toEqual([null, null, null, null, null]);
  });

  it('lehnt negative Werte ab', async () => {
    const res = await request(await app()).post('/api/artikel').send({
      teiletyp: 'verkaufsartikel', bezeichnung: 'X', verkaufspreis: '-5',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negativ/i);
  });

  it('lehnt unsinnige Zahleneingaben ab', async () => {
    const res = await request(await app()).post('/api/artikel').send({
      teiletyp: 'verkaufsartikel', bezeichnung: 'X', montagedauer: 'viel',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gültige Zahl/i);
  });

  it('lehnt negative Materialkosten ab', async () => {
    const res = await request(await app()).post('/api/artikel').send({
      teiletyp: 'verkaufsartikel', bezeichnung: 'X', materialkosten: '-1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Materialkosten.*negativ/i);
  });
});
