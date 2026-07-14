/**
 * Tests der gemeinsamen Adress-Autovervollständigung (Basisschicht).
 * Sie wird von Adressverwaltung UND Mitarbeiterverwaltung genutzt und muss
 * beide Land-Feldarten bedienen: Namen (data-field="land") und ISO-Code
 * (data-field="land_code").
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { stubFetch } from './helpers.js';
import { bindAdressSuche } from '../src/ic/helpers.js';

const VORSCHLAG = {
  label: 'Hauptstr. 1, 10115 Berlin, Deutschland',
  strasse: 'Hauptstr. 1',
  plz: '10115',
  ort: 'Berlin',
  land: 'Deutschland',
  land_code: 'DE',
};

/** Baut ein Formular mit Adressfeldern; landTyp bestimmt die Art des Land-Felds. */
function formular(landTyp: 'name' | 'code' | 'keins'): HTMLElement {
  const body = document.createElement('div');
  let landFeld = '';
  if (landTyp === 'name') {
    landFeld = `<div class="field"><select data-field="land">
      <option value="Schweiz">Schweiz</option><option value="Deutschland">Deutschland</option></select></div>`;
  } else if (landTyp === 'code') {
    landFeld = `<div class="field"><select data-field="land_code">
      <option value="CH">Schweiz (CH)</option><option value="DE">Deutschland (DE)</option></select></div>`;
  }
  body.innerHTML = `
    <div class="field"><input data-field="strasse"></div>
    <div class="field"><input data-field="adresszusatz" value="c/o Meier"></div>
    <div class="field"><input data-field="plz"></div>
    <div class="field"><input data-field="ort"></div>
    ${landFeld}`;
  document.body.appendChild(body);
  return body;
}

/** Tippt in das Strassenfeld und wartet die Entprellung ab. */
async function tippen(body: HTMLElement, text: string): Promise<void> {
  const strasse = body.querySelector('[data-field="strasse"]') as HTMLInputElement;
  strasse.value = text;
  strasse.focus();
  strasse.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 320)); // 250 ms Entprellung + Puffer
}

describe('bindAdressSuche', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubFetch({ '/api/adressen/suche': [VORSCHLAG] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('füllt Strasse, PLZ, Ort und den Ländercode (Mitarbeiter-Formular)', async () => {
    const body = formular('code');
    bindAdressSuche(body);
    await tippen(body, 'Hauptstr');

    const item = body.querySelector('.adr-item') as HTMLElement;
    expect(item).not.toBeNull();
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect((body.querySelector('[data-field="strasse"]') as HTMLInputElement).value).toBe('Hauptstr. 1');
    expect((body.querySelector('[data-field="plz"]') as HTMLInputElement).value).toBe('10115');
    expect((body.querySelector('[data-field="ort"]') as HTMLInputElement).value).toBe('Berlin');
    expect((body.querySelector('[data-field="land_code"]') as HTMLSelectElement).value).toBe('DE');
  });

  it('füllt den Ländernamen (Adressverwaltungs-Formular)', async () => {
    const body = formular('name');
    bindAdressSuche(body);
    await tippen(body, 'Hauptstr');
    (body.querySelector('.adr-item') as HTMLElement)
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect((body.querySelector('[data-field="land"]') as HTMLSelectElement).value).toBe('Deutschland');
  });

  it('löst beim Land ein change-Event aus (landabhängige Logik reagiert)', async () => {
    const body = formular('code');
    const sel = body.querySelector('[data-field="land_code"]') as HTMLSelectElement;
    const gerufen = vi.fn();
    sel.addEventListener('change', gerufen);

    bindAdressSuche(body);
    await tippen(body, 'Hauptstr');
    (body.querySelector('.adr-item') as HTMLElement)
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect(gerufen).toHaveBeenCalled();
  });

  it('überschreibt den Adresszusatz nicht', async () => {
    const body = formular('code');
    bindAdressSuche(body);
    await tippen(body, 'Hauptstr');
    (body.querySelector('.adr-item') as HTMLElement)
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect((body.querySelector('[data-field="adresszusatz"]') as HTMLInputElement).value).toBe('c/o Meier');
  });

  it('sucht erst ab 3 Zeichen', async () => {
    const body = formular('code');
    bindAdressSuche(body);
    await tippen(body, 'ab');
    expect(body.querySelector('.adr-item')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bleibt bei Ausfall des Dienstes ruhig (Feld manuell nutzbar)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const body = formular('code');
    bindAdressSuche(body);
    await tippen(body, 'Hauptstr');
    // keine Vorschläge, kein Absturz — das Strassenfeld behält die Eingabe
    expect(body.querySelector('.adr-item')).toBeNull();
    expect((body.querySelector('[data-field="strasse"]') as HTMLInputElement).value).toBe('Hauptstr');
  });

  it('tut nichts, wenn das Formular kein Strassenfeld hat', () => {
    const body = document.createElement('div');
    body.innerHTML = '<div class="field"><input data-field="ort"></div>';
    document.body.appendChild(body);
    expect(() => bindAdressSuche(body)).not.toThrow();
  });
});
