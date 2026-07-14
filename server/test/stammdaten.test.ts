/**
 * Tests Stammdaten: Funktionen/Qualifikationen anlegen, Duplikatschutz,
 * In-Verwendung-Schutz beim Löschen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));
vi.mock('../src/auth/middleware.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/audit/log.js', () => ({ auditLog: vi.fn(), ladeSnapshot: vi.fn() }));

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

describe('Stammdaten Funktionen & Qualifikationen', () => {
  beforeEach(() => queryMock.mockReset());

  it('legt eine Funktion an', async () => {
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: '3' }]);
    const res = await request(await app()).post('/api/stammdaten/funktionen').send({ name: 'Projektleiter' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, name: 'Projektleiter' });
  });

  it('lehnt doppelte Qualifikation ab', async () => {
    queryMock.mockResolvedValueOnce([{ id: '1' }]); // existiert bereits
    const res = await request(await app()).post('/api/stammdaten/qualifikationen').send({ name: 'Elektriker' });
    expect(res.status).toBe(400);
  });

  it('verhindert das Löschen einer verwendeten Funktion', async () => {
    queryMock.mockResolvedValueOnce([{ c: '2' }]); // 2 Mitarbeiter nutzen sie
    const res = await request(await app()).delete('/api/stammdaten/funktionen/5');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/verwendet/i);
  });

  it('löscht eine ungenutzte Qualifikation', async () => {
    queryMock
      .mockResolvedValueOnce([{ c: '0' }])  // usedCheck
      .mockResolvedValueOnce([])            // ladeSnapshot (gemockt) -> egal
      .mockResolvedValueOnce([]);           // DELETE
    const res = await request(await app()).delete('/api/stammdaten/qualifikationen/9');
    expect(res.status).toBe(200);
  });
});
