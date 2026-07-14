/**
 * Tests Berechtigungsrollen: Modul-Registry vollständig, Admin-Sonderrolle
 * (Vollzugriff, nicht abwählbar, nicht löschbar), normale Rolle togglebar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ pool: {}, query: (...a: unknown[]) => queryMock(...a) }));
vi.mock('../src/auth/middleware.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/audit/log.js', () => ({ auditLog: vi.fn(), ladeSnapshot: vi.fn() }));

import express from 'express';
import request from 'supertest';

async function app() {
  const { berechtigungsrollenRouter } = await import('../src/modules/berechtigungsrollen/routes.js');
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { (req as any).user = { id: 1, name: 'Admin', role: 'admin' }; next(); });
  a.use('/api/berechtigungsrollen', berechtigungsrollenRouter);
  return a;
}

describe('Modul-Registry', () => {
  it('enthält alle bekannten Submodule inkl. crud-doku', async () => {
    const { MODULE, MODUL_KEYS } = await import('../src/berechtigungen/module.js');
    const keys = MODULE.map((m) => m.key);
    for (const k of ['kontakte', 'mitarbeiter', 'users', 'arbeitszeitmodelle', 'unternehmen', 'rollen', 'crud-doku']) {
      expect(keys).toContain(k);
    }
    expect(MODUL_KEYS.has('crud-doku')).toBe(true);
  });
});

describe('Berechtigungsrollen-Endpunkte', () => {
  beforeEach(() => queryMock.mockReset());

  it('Admin-Detail liefert ALLE Module (auch ohne Zuordnungszeilen)', async () => {
    queryMock.mockResolvedValueOnce([{ id: 1, name: 'Administrator', ist_admin: true, system: true }]);
    const res = await request(await app()).get('/api/berechtigungsrollen/1');
    expect(res.status).toBe(200);
    const { MODULE } = await import('../src/berechtigungen/module.js');
    expect(res.body.module).toEqual(MODULE.map((m) => m.key));  // Vollzugriff per Definition
  });

  it('verweigert das Ändern von Admin-Modulrechten', async () => {
    queryMock.mockResolvedValueOnce([{ id: 1, ist_admin: true }]);
    const res = await request(await app()).put('/api/berechtigungsrollen/1/modul').send({ modul_key: 'kontakte', aktiv: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unveränderlichen Vollzugriff/i);
  });

  it('schützt Admin/System-Rollen vor dem Löschen', async () => {
    queryMock.mockResolvedValueOnce([{ id: 1, name: 'Administrator', ist_admin: true, system: true }]);
    const res = await request(await app()).delete('/api/berechtigungsrollen/1');
    expect(res.status).toBe(400);
  });

  it('normale Rolle: Modulrecht setzen fügt Zeile hinzu', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: 2, ist_admin: false }])       // Rolle laden
      .mockResolvedValueOnce([])                                   // vorher
      .mockResolvedValueOnce([])                                   // INSERT
      .mockResolvedValueOnce([{ modul_key: 'kontakte' }]);         // nachher
    const res = await request(await app()).put('/api/berechtigungsrollen/2/modul').send({ modul_key: 'kontakte', aktiv: true });
    expect(res.status).toBe(200);
    expect(res.body.module).toContain('kontakte');
  });

  it('lehnt unbekannte Modul-Keys ab', async () => {
    queryMock.mockResolvedValueOnce([{ id: 2, ist_admin: false }]);
    const res = await request(await app()).put('/api/berechtigungsrollen/2/modul').send({ modul_key: 'gibtsnicht', aktiv: true });
    expect(res.status).toBe(400);
  });
});
