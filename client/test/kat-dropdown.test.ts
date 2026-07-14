/**
 * Regressionstests Adressschlüssel-Dropdown (v2a): der String/Number-Bug,
 * der Chips leer ließ, Duplikate zuließ und die Auswahl "verschwinden" ließ.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell } from './helpers.js';
import { Kontakte } from '../src/kontakte.js';

beforeEach(() => {
  mountShell();
  // kategorie.id als String — genau wie es aus JSON kommt
  (Kontakte as any).kategorien = [
    { id: '1', name: 'Kunde' },
    { id: '2', name: 'Lieferant' },
    { id: '3', name: 'Handwerker' },
  ];
});

function mountPicker(selectedIds: number[]) {
  const html = (Kontakte as any).katDropdownHtml(selectedIds);
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  (Kontakte as any).bindKatDropdown(root);
  return root;
}

describe('Adressschlüssel-Dropdown', () => {
  it('zeigt vorausgewählte Schlüssel als Chips (String-ID vs Number)', () => {
    const root = mountPicker([1, 2]);
    const chips = root.querySelectorAll('.kat-chip');
    expect(chips.length).toBe(2);
    expect(root.textContent).toContain('Kunde');
    expect(root.textContent).toContain('Lieferant');
  });

  it('bietet im Dropdown nur noch NICHT gewählte Schlüssel an', () => {
    const root = mountPicker([1]);
    const opts = [...root.querySelectorAll('#kf-kat-select option')].map(o => o.textContent);
    expect(opts.some(o => o!.includes('Kunde'))).toBe(false);      // schon gewählt
    expect(opts.some(o => o!.includes('Lieferant'))).toBe(true);   // noch wählbar
  });

  it('fügt einen Schlüssel hinzu und listet ihn als Chip', () => {
    const root = mountPicker([]);
    const sel = root.querySelector('#kf-kat-select') as HTMLSelectElement;
    sel.value = '2';
    sel.dispatchEvent(new Event('change'));
    expect((Kontakte as any)._formKats).toEqual([2]);
    expect(root.querySelectorAll('.kat-chip').length).toBe(1);
    expect(root.textContent).toContain('Lieferant');
  });

  it('verhindert denselben Schlüssel doppelt', () => {
    const root = mountPicker([1]);
    const sel = root.querySelector('#kf-kat-select') as HTMLSelectElement;
    sel.value = '1'; // bereits gewählt (steht gar nicht mehr zur Wahl, aber erzwungen)
    sel.dispatchEvent(new Event('change'));
    expect((Kontakte as any)._formKats.filter((x: number) => x === 1).length).toBe(1);
  });

  it('entfernt einen Schlüssel per Chip-×', () => {
    const root = mountPicker([1, 2]);
    const wegBtn = root.querySelector('.kat-chip [data-katweg="1"]') as HTMLElement;
    wegBtn.click();
    expect((Kontakte as any)._formKats).toEqual([2]);
    expect(root.querySelectorAll('.kat-chip').length).toBe(1);
  });
});
