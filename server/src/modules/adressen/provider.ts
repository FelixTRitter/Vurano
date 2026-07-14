/**
 * ADRESS-AUTOVERVOLLSTÄNDIGUNG — Provider-Abstraktion
 * ---------------------------------------------------------------
 * Kapselt den externen Adressdienst hinter einer schmalen Schnittstelle,
 * damit der Anbieter später ohne Änderung am restlichen Code getauscht
 * werden kann (z. B. Photon -> Google Places oder selbst gehostetes Photon).
 *
 * Aktuell aktiv: PHOTON (OpenStreetMap-basiert, kostenlos, kein API-Key).
 * Der Basis-URL ist über die Umgebungsvariable PHOTON_URL überschreibbar —
 * so lässt sich später eine selbst gehostete Instanz eintragen, ohne dass
 * Kundenadressen jemals einen fremden Server erreichen.
 */

export interface AdressVorschlag {
  label: string;      // vollständige Anzeige, z. B. "Steinbeisstr. 4, 71272 Renningen, Deutschland"
  strasse: string;    // Straße + Hausnummer
  plz: string;
  ort: string;
  land: string;       // deutscher Landesname (passend zur Länderliste im Client)
  land_code: string;  // ISO-Ländercode (DE, CH …) — für Formulare, die den Code führen (z. B. Mitarbeiter)
  lat?: number;
  lon?: number;
}

const PHOTON_URL = process.env.PHOTON_URL || 'https://photon.komoot.io/api/';

// OSM/Photon liefert Ländernamen teils englisch/lokal — hier die für uns
// relevanten auf die deutschen Namen der Client-Länderliste mappen.
const LAND_MAP: Record<string, string> = {
  Germany: 'Deutschland', Deutschland: 'Deutschland',
  Switzerland: 'Schweiz', Schweiz: 'Schweiz', Suisse: 'Schweiz', Svizzera: 'Schweiz',
  Austria: 'Österreich', Österreich: 'Österreich',
  France: 'Frankreich', Italy: 'Italien', Italia: 'Italien',
  'United States': 'USA', 'United States of America': 'USA',
  'United Kingdom': 'Vereinigtes Königreich',
  Egypt: 'Ägypten', Netherlands: 'Niederlande', Belgium: 'Belgien',
  Spain: 'Spanien', Poland: 'Polen', Portugal: 'Portugal',
  'Czech Republic': 'Tschechien', Czechia: 'Tschechien',
  Liechtenstein: 'Liechtenstein', Luxembourg: 'Luxemburg',
};

function landDe(name: string | undefined): string {
  if (!name) return '';
  return LAND_MAP[name] || name;
}

interface PhotonFeature {
  properties: {
    name?: string; street?: string; housenumber?: string;
    postcode?: string; city?: string; town?: string; village?: string;
    country?: string; countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

/** Fragt den Adressdienst nach Vorschlägen zu einem Suchtext. */
export async function adressVorschlaege(query: string, limit = 6): Promise<AdressVorschlag[]> {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=de`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Vurano-ERP/1.0' } });
  if (!res.ok) throw new Error('Adressdienst nicht erreichbar');
  const data = (await res.json()) as { features?: PhotonFeature[] };
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    const ort = p.city || p.town || p.village || '';
    const strasse = [p.street || p.name, p.housenumber].filter(Boolean).join(' ');
    const land = landDe(p.country);
    const label = [strasse, [p.postcode, ort].filter(Boolean).join(' '), land].filter(Boolean).join(', ');
    const coords = f.geometry?.coordinates;
    return {
      label, strasse, plz: p.postcode || '', ort, land,
      land_code: (p.countrycode || '').toUpperCase(),
      lat: coords ? coords[1] : undefined,
      lon: coords ? coords[0] : undefined,
    };
  }).filter((v) => v.label);
}
