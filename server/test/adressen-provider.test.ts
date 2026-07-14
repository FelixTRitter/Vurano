/**
 * Test des Adress-Providers: Photon-Feature -> unser AdressVorschlag,
 * inkl. Ländername-Mapping (englisch/OSM -> deutsche Länderliste).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('adressVorschlaege (Photon-Provider)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('mappt ein Photon-Feature auf Strasse/PLZ/Ort/Land (deutsch)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{
        properties: { street: 'Steinbeisstr.', housenumber: '4', postcode: '71272', city: 'Renningen', country: 'Germany' },
        geometry: { coordinates: [8.9, 48.7] },
      }]}),
    })));
    const { adressVorschlaege } = await import('../src/modules/adressen/provider.js');
    const r = await adressVorschlaege('Steinbeisstr 4');
    expect(r).toHaveLength(1);
    expect(r[0].strasse).toBe('Steinbeisstr. 4');
    expect(r[0].plz).toBe('71272');
    expect(r[0].ort).toBe('Renningen');
    expect(r[0].land).toBe('Deutschland');      // Germany -> Deutschland
    expect(r[0].label).toContain('Renningen');
  });

  it('mappt USA/Egypt korrekt und nutzt town/village als Ort-Fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [
        { properties: { name: '5th Avenue', housenumber: '100', postcode: '10001', city: 'New York', country: 'United States' } },
        { properties: { street: 'Nile St', village: 'Gizeh', country: 'Egypt' } },
      ]}),
    })));
    const { adressVorschlaege } = await import('../src/modules/adressen/provider.js');
    const r = await adressVorschlaege('x');
    expect(r[0].land).toBe('USA');
    expect(r[1].land).toBe('Ägypten');
    expect(r[1].ort).toBe('Gizeh');   // village-Fallback
  });

  it('wirft bei nicht erreichbarem Dienst', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const { adressVorschlaege } = await import('../src/modules/adressen/provider.js');
    await expect(adressVorschlaege('x')).rejects.toThrow();
  });

  it('liefert den ISO-Ländercode mit (für Formulare, die den Code führen)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{
        properties: { street: 'Hauptstr', housenumber: '1', postcode: '10115', city: 'Berlin', country: 'Germany', countrycode: 'de' },
      }]}),
    })));
    const { adressVorschlaege } = await import('../src/modules/adressen/provider.js');
    const r = await adressVorschlaege('Hauptstr');
    expect(r[0].land).toBe('Deutschland');   // Name für die Adressverwaltung
    expect(r[0].land_code).toBe('DE');       // Code (Grossbuchstaben) für die Mitarbeiterverwaltung
  });

  it('setzt land_code auf leer, wenn der Dienst keinen liefert', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ features: [{ properties: { street: 'X', city: 'Y', country: 'Germany' } }] }),
    })));
    const { adressVorschlaege } = await import('../src/modules/adressen/provider.js');
    const r = await adressVorschlaege('X');
    expect(r[0].land_code).toBe('');
  });
});
