/**
 * Tests für Farbschema & Führungsfarbe: Anwendung der CSS-Variablen,
 * data-theme-Attribut, Abdunkelungs-Mathematik, Defaults.
 */
import { describe, it, expect } from 'vitest';
import { applyTheme, darken, setSavedTheme, applySavedTheme, loadStoredTheme, DEFAULT_AKZENT, DEFAULT_THEME } from '../src/theme.js';

describe('Theme', () => {
  it('setzt data-theme und die Führungsfarben-Variablen', () => {
    applyTheme('dunkel', '#F97316');
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dunkel');
    expect(root.style.getPropertyValue('--iv-primary')).toBe('#F97316');
    expect(root.style.getPropertyValue('--iv-primary-hover')).toBe(darken('#F97316'));
  });
  it('fällt bei unbekanntem Schema auf hell zurück', () => {
    applyTheme('neon' as any, '#123456');
    expect(document.documentElement.dataset.theme).toBe('hell');
  });
  it('Default ist hell mit Vurano-Orange', () => {
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('hell');
    expect(document.documentElement.style.getPropertyValue('--iv-primary')).toBe(DEFAULT_AKZENT);
  });
  it('Vorschau leckt nicht: applySavedTheme stellt den gespeicherten Stand wieder her', () => {
    setSavedTheme('dunkel', '#3B82F6');           // gespeichert (wie nach Login/Speichern)
    applyTheme('hell', '#FF0000');                 // Live-Vorschau in den Einstellungen
    expect(document.documentElement.dataset.theme).toBe('hell');
    applySavedTheme();                             // Modul verlassen ohne Speichern
    expect(document.documentElement.dataset.theme).toBe('dunkel');
    expect(document.documentElement.style.getPropertyValue('--iv-primary')).toBe('#3B82F6');
  });
  it('merkt sich das Schema für die Anmeldeseite (localStorage)', () => {
    setSavedTheme('dunkel', '#3B82F6');
    applyTheme('hell', '#FF0000');                 // etwas anderes anwenden
    loadStoredTheme();                             // wie beim nächsten App-Start
    expect(document.documentElement.dataset.theme).toBe('dunkel');
    localStorage.clear();
    setSavedTheme(DEFAULT_THEME, DEFAULT_AKZENT);
  });
  it('darken dunkelt korrekt ab und bleibt gültiges Hex', () => {
    expect(darken('#FFFFFF', 0.5)).toBe('#808080');
    expect(darken('#000000')).toBe('#000000');
    expect(darken('#F97316')).toMatch(/^#[0-9A-F]{6}$/);
  });
});
