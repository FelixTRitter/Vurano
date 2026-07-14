/**
 * Tests der mehrsprachigen Artikeltexte:
 *  - Text je Sprache speichern (quelle 'original' vs. 'manuell')
 *  - Übersetzungs-Entwurf erzeugen (speichert NICHTS)
 *  - Fehlerfälle: Dienst nicht konfiguriert, gleiche Sprache, kein Originaltext
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));
vi.mock('../src/auth/middleware.js', () => ({
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/audit/log.js', () => ({ auditLog: vi.fn(), ladeSnapshot: vi.fn(async () => ({ id: 1 })) }));

const { verfuegbarMock, uebersetzeMock } = vi.hoisted(() => ({
  verfuegbarMock: vi.fn(() => true),
  uebersetzeMock: vi.fn(async () => ({ verkaufstext: 'Solid oak cabinet.', lv_text: 'Supply and install.' })),
}));
vi.mock('../src/modules/uebersetzung/provider.js', () => ({
  uebersetzungVerfuegbar: verfuegbarMock,
  uebersetze: uebersetzeMock,
}));

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

describe('Artikeltexte speichern', () => {
  beforeEach(() => { queryMock.mockReset(); verfuegbarMock.mockReturnValue(true); });

  it('speichert die Originalsprache mit quelle "original"', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }])  // Artikel
      .mockResolvedValueOnce([{ code: 'de' }])                  // Sprache bekannt
      .mockResolvedValueOnce([])                                // vorher (keiner)
      .mockResolvedValueOnce([])                                // INSERT/UPSERT
      .mockResolvedValueOnce([{ sprache_code: 'de' }]);         // nachher
    const res = await request(await app()).put('/api/artikel/1/text/de')
      .send({ verkaufstext: 'Massivholzschrank.', lv_text: 'Lieferung.' });
    expect(res.status).toBe(200);
    expect(res.body.quelle).toBe('original');
  });

  it('speichert eine Fremdsprache mit quelle "manuell" (auch nach KI-Entwurf)', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }])
      .mockResolvedValueOnce([{ code: 'en' }])
      .mockResolvedValueOnce([{ sprache_code: 'en', quelle: 'ki' }])  // vorher: KI-Entwurf
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ sprache_code: 'en' }]);
    const res = await request(await app()).put('/api/artikel/1/text/en')
      .send({ verkaufstext: 'Solid oak cabinet.', lv_text: '' });
    expect(res.status).toBe(200);
    expect(res.body.quelle).toBe('manuell');   // vom Menschen geprüft
  });

  it('lehnt eine unbekannte Sprache ab', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }])
      .mockResolvedValueOnce([]);   // Sprache nicht gefunden
    const res = await request(await app()).put('/api/artikel/1/text/xx').send({ verkaufstext: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('Übersetzungs-Entwurf', () => {
  beforeEach(() => { queryMock.mockReset(); verfuegbarMock.mockReturnValue(true); uebersetzeMock.mockClear(); });

  it('liefert einen Entwurf und speichert ihn NICHT', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }])                        // Artikel
      .mockResolvedValueOnce([{ code: 'de', name: 'Deutsch' }, { code: 'en', name: 'Englisch' }]) // Sprachen
      .mockResolvedValueOnce([{ verkaufstext: 'Massivholzschrank.', lv_text: 'Lieferung.' }]);    // Originaltext
    const res = await request(await app()).post('/api/artikel/1/uebersetzen').send({ ziel_sprache: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.verkaufstext).toBe('Solid oak cabinet.');
    expect(res.body.quelle).toBe('ki');
    // Der Provider bekam die Klarnamen der Sprachen
    expect(uebersetzeMock).toHaveBeenCalledWith(expect.objectContaining({
      quellSprache: 'Deutsch', zielSprache: 'Englisch',
    }));
    // kein INSERT/UPDATE auf artikel_texte
    const schreibend = queryMock.mock.calls.filter((c) => /INSERT|UPDATE/i.test(String(c[0])));
    expect(schreibend).toHaveLength(0);
  });

  it('meldet 503, wenn kein Übersetzungsdienst konfiguriert ist', async () => {
    verfuegbarMock.mockReturnValue(false);
    const res = await request(await app()).post('/api/artikel/1/uebersetzen').send({ ziel_sprache: 'en' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/nicht konfiguriert/i);
  });

  it('lehnt die Originalsprache als Ziel ab', async () => {
    queryMock.mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }]);
    const res = await request(await app()).post('/api/artikel/1/uebersetzen').send({ ziel_sprache: 'de' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bereits in dieser Sprache/i);
  });

  it('meldet, wenn es keinen Originaltext zum Übersetzen gibt', async () => {
    queryMock
      .mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }])
      .mockResolvedValueOnce([{ code: 'de', name: 'Deutsch' }, { code: 'en', name: 'Englisch' }])
      .mockResolvedValueOnce([]);   // kein Originaltext
    const res = await request(await app()).post('/api/artikel/1/uebersetzen').send({ ziel_sprache: 'en' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/noch keinen Text/i);
  });

  it('reicht einen Dienstfehler als 502 weiter', async () => {
    uebersetzeMock.mockRejectedValueOnce(new Error('Übersetzungsdienst nicht erreichbar (HTTP 429).'));
    queryMock
      .mockResolvedValueOnce([{ id: 1, sprache_code: 'de' }])
      .mockResolvedValueOnce([{ code: 'de', name: 'Deutsch' }, { code: 'en', name: 'Englisch' }])
      .mockResolvedValueOnce([{ verkaufstext: 'x', lv_text: '' }]);
    const res = await request(await app()).post('/api/artikel/1/uebersetzen').send({ ziel_sprache: 'en' });
    expect(res.status).toBe(502);
  });
});
