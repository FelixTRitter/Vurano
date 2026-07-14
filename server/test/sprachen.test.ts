/**
 * Tests Sprachen: Anlegen (Code+Name-Pflicht, ISO-Format, Duplikat),
 * Bearbeiten, Löschen inkl. Schutz der gesetzten Standardsprache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));
vi.mock('../src/auth/middleware.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/audit/log.js', () => ({
  auditLog: vi.fn(),
  ladeSnapshot: vi.fn(async () => ({ id: 2, code: 'en', name: 'Englisch' })),
}));

import express from 'express';
import request from 'supertest';

async function app() {
  const { stammdatenRouter } = await import('../src/modules/stammdaten/routes.js');
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { (req as any).user = { id: 1, name: 'Admin', role: 'admin' }; next(); });
  a.use('/api/stammdaten', stammdatenRouter);
  return a;
}

describe('Sprachen', () => {
  beforeEach(() => queryMock.mockReset());

  it('legt eine Sprache mit Code und Name an', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: '5' }]);
    const res = await request(await app()).post('/api/stammdaten/sprachen').send({ code: 'es', name: 'Spanisch' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5, code: 'es', name: 'Spanisch' });
  });

  it('lehnt ungültigen Code ab', async () => {
    const res = await request(await app()).post('/api/stammdaten/sprachen').send({ code: 'Deutsch!', name: 'X' });
    expect(res.status).toBe(400);
  });

  it('normalisiert Code zu Kleinbuchstaben', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: '6' }]);
    const res = await request(await app()).post('/api/stammdaten/sprachen').send({ code: 'PT', name: 'Portugiesisch' });
    expect(res.body.code).toBe('pt');
  });

  it('lehnt doppelten Code ab', async () => {
    queryMock.mockResolvedValueOnce([{ id: '1' }]);
    const res = await request(await app()).post('/api/stammdaten/sprachen').send({ code: 'de', name: 'Deutsch' });
    expect(res.status).toBe(400);
  });

  it('schützt die gesetzte Standardsprache vor dem Löschen', async () => {
    // ladeSnapshot liefert code 'en'; firma_stammdaten.standard_sprache = 'en'
    queryMock.mockResolvedValueOnce([{ standard_sprache: 'en' }]);
    const res = await request(await app()).delete('/api/stammdaten/sprachen/2');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Standardsprache/i);
  });

  it('löscht eine nicht-Standard-Sprache', async () => {
    queryMock
      .mockResolvedValueOnce([{ standard_sprache: 'de' }])  // Standard ist 'de', gelöscht wird 'en'
      .mockResolvedValueOnce([]);                            // DELETE
    const res = await request(await app()).delete('/api/stammdaten/sprachen/2');
    expect(res.status).toBe(200);
  });
});
