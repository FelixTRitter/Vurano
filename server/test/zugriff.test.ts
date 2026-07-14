/**
 * Tests der Zugriffsauflösung: Admin erhält alle Module, eine normale Rolle
 * nur die freigeschalteten (plus 'einstellungen' als persönlicher Bereich).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
vi.mock('../src/db.js', () => ({ query: (...a: unknown[]) => queryMock(...a) }));

describe('erlaubteModuleFuer', () => {
  beforeEach(() => queryMock.mockReset());

  it('Admin bekommt ALLE Module', async () => {
    queryMock.mockResolvedValueOnce([{ zugriffsrolle_id: 1, ist_admin: true }]);
    const { erlaubteModuleFuer } = await import('../src/berechtigungen/zugriff.js');
    const { MODULE } = await import('../src/berechtigungen/module.js');
    const mods = await erlaubteModuleFuer(1);
    expect(mods).toEqual(MODULE.map((m) => m.key));
  });

  it('normale Rolle bekommt nur freigeschaltete Module + einstellungen', async () => {
    queryMock
      .mockResolvedValueOnce([{ zugriffsrolle_id: 2, ist_admin: false }])   // User+Rolle
      .mockResolvedValueOnce([{ modul_key: 'kontakte' }]);                   // rollen_module
    const { erlaubteModuleFuer } = await import('../src/berechtigungen/zugriff.js');
    const mods = await erlaubteModuleFuer(5);
    expect(mods).toContain('kontakte');
    expect(mods).toContain('einstellungen');       // persönlicher Bereich immer dabei
    expect(mods).not.toContain('mitarbeiter');     // nicht freigeschaltet
    expect(mods).not.toContain('users');
  });

  it('Rolle ohne Freischaltungen bekommt nur einstellungen', async () => {
    queryMock
      .mockResolvedValueOnce([{ zugriffsrolle_id: 3, ist_admin: false }])
      .mockResolvedValueOnce([]);                                            // keine Module
    const { erlaubteModuleFuer } = await import('../src/berechtigungen/zugriff.js');
    const mods = await erlaubteModuleFuer(6);
    expect(mods).toEqual(['einstellungen']);
  });

  it('User ganz ohne Zugriffsrolle bekommt nur einstellungen', async () => {
    queryMock.mockResolvedValueOnce([{ zugriffsrolle_id: null, ist_admin: null }]);
    const { erlaubteModuleFuer } = await import('../src/berechtigungen/zugriff.js');
    const mods = await erlaubteModuleFuer(7);
    expect(mods).toEqual(['einstellungen']);
  });
});
