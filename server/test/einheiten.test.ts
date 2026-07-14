/**
 * Tests Einheiten: Anlegen (Kürzel-Pflicht, Duplikatschutz), Bearbeiten
 * (Kollisionsschutz), Löschen. Vorbefüllung wird per Migration geprüft (E2E).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));
vi.mock('../src/auth/middleware.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/audit/log.js', () => ({ auditLog: vi.fn(), ladeSnapshot: vi.fn(async () => ({ id: 1, kuerzel: 'alt', name: null })) }));

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

describe('Einheiten', () => {
  beforeEach(() => queryMock.mockReset());

  it('legt eine Einheit mit Kürzel und Name an', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: '20' }]);
    const res = await request(await app()).post('/api/stammdaten/einheiten').send({ kuerzel: 'kg', name: 'Kilogramm' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 20, kuerzel: 'kg', name: 'Kilogramm' });
  });

  it('lehnt Einheit ohne Kürzel ab', async () => {
    const res = await request(await app()).post('/api/stammdaten/einheiten').send({ name: 'Ohne Kürzel' });
    expect(res.status).toBe(400);
  });

  it('lehnt doppeltes Kürzel ab', async () => {
    queryMock.mockResolvedValueOnce([{ id: '1' }]);
    const res = await request(await app()).post('/api/stammdaten/einheiten').send({ kuerzel: 'm²' });
    expect(res.status).toBe(400);
  });

  it('bearbeitet eine Einheit', async () => {
    queryMock
      .mockResolvedValueOnce([])   // Kollisionsprüfung
      .mockResolvedValueOnce([]);  // UPDATE
    const res = await request(await app()).put('/api/stammdaten/einheiten/1').send({ kuerzel: 'kg', name: 'Kilogramm' });
    expect(res.status).toBe(200);
  });

  it('verhindert Kürzel-Kollision beim Bearbeiten', async () => {
    queryMock.mockResolvedValueOnce([{ id: '2' }]);  // anderes Kürzel existiert
    const res = await request(await app()).put('/api/stammdaten/einheiten/1').send({ kuerzel: 'm' });
    expect(res.status).toBe(400);
  });

  it('löscht eine Einheit', async () => {
    queryMock.mockResolvedValueOnce([]);  // DELETE
    const res = await request(await app()).delete('/api/stammdaten/einheiten/1');
    expect(res.status).toBe(200);
  });
});
