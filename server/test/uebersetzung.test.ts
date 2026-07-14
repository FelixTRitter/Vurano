/**
 * Tests des Übersetzungs-Providers: JSON-Antwort auswerten, Markdown-Zaun
 * tolerieren, ohne Konfiguration sauber abbrechen, Dienstfehler melden.
 * Der echte Dienst wird dabei nicht gerufen (fetch ist gemockt).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

describe('Übersetzungs-Provider', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('meldet Verfügbarkeit anhand des API-Schlüssels', async () => {
    const { uebersetzungVerfuegbar } = await import('../src/modules/uebersetzung/provider.js');
    expect(uebersetzungVerfuegbar()).toBe(true);
    delete process.env.ANTHROPIC_API_KEY;
    expect(uebersetzungVerfuegbar()).toBe(false);
  });

  it('wertet die JSON-Antwort aus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"verkaufstext":"Solid oak cabinet.","lv_text":"Supply and install."}' }] }),
    })));
    const { uebersetze } = await import('../src/modules/uebersetzung/provider.js');
    const r = await uebersetze({ verkaufstext: 'Massivholzschrank.', lvText: 'Lieferung und Montage.', quellSprache: 'Deutsch', zielSprache: 'Englisch' });
    expect(r.verkaufstext).toBe('Solid oak cabinet.');
    expect(r.lv_text).toBe('Supply and install.');
  });

  it('toleriert einen Markdown-Zaun um das JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '```json\n{"verkaufstext":"A","lv_text":"B"}\n```' }] }),
    })));
    const { uebersetze } = await import('../src/modules/uebersetzung/provider.js');
    const r = await uebersetze({ verkaufstext: 'x', lvText: 'y', quellSprache: 'Deutsch', zielSprache: 'Englisch' });
    expect(r).toEqual({ verkaufstext: 'A', lv_text: 'B' });
  });

  it('schickt Ziel- und Quellsprache an das Modell', async () => {
    const spy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"verkaufstext":"","lv_text":""}' }] }),
    }));
    vi.stubGlobal('fetch', spy);
    const { uebersetze } = await import('../src/modules/uebersetzung/provider.js');
    await uebersetze({ verkaufstext: 'x', lvText: '', quellSprache: 'Deutsch', zielSprache: 'Französisch' });
    const body = JSON.parse((spy.mock.calls[0][1] as any).body);
    expect(body.system).toContain('Deutsch');
    expect(body.system).toContain('Französisch');
    expect(body.model).toBeTruthy();
  });

  it('bricht ohne API-Schlüssel verständlich ab', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { uebersetze } = await import('../src/modules/uebersetzung/provider.js');
    await expect(uebersetze({ verkaufstext: 'x', lvText: '', quellSprache: 'Deutsch', zielSprache: 'Englisch' }))
      .rejects.toThrow(/nicht konfiguriert/i);
  });

  it('meldet einen Fehler des Dienstes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, text: async () => 'rate limited' })));
    const { uebersetze } = await import('../src/modules/uebersetzung/provider.js');
    await expect(uebersetze({ verkaufstext: 'x', lvText: '', quellSprache: 'Deutsch', zielSprache: 'Englisch' }))
      .rejects.toThrow(/nicht erreichbar/i);
  });

  it('meldet eine unlesbare Antwort', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Klar, hier die Übersetzung: ...' }] }),
    })));
    const { uebersetze } = await import('../src/modules/uebersetzung/provider.js');
    await expect(uebersetze({ verkaufstext: 'x', lvText: '', quellSprache: 'Deutsch', zielSprache: 'Englisch' }))
      .rejects.toThrow(/nicht lesbar/i);
  });
});
