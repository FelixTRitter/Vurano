/**
 * Tests für die Navigationsgruppen: grüner Balken nur bei aktivem Submodul,
 * Auf-/Zuklappen per Klick, automatisches Einklappen beim Modulwechsel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell } from './helpers.js';
import { initNavGroups, syncNavGroups } from '../src/nav.js';

const gruppe = () => document.querySelector('.nav-group')!;

describe('Navigationsgruppen', () => {
  beforeEach(() => {
    mountShell();
    initNavGroups();
  });

  it('Klick auf den Gruppenkopf klappt auf und wieder zu', () => {
    const head = document.querySelector('.nav-group-head') as HTMLElement;
    head.click();
    expect(gruppe().classList.contains('open')).toBe(true);
    head.click();
    expect(gruppe().classList.contains('open')).toBe(false);
  });

  it('has-active (grüner Balken) nur, wenn ein Submodul aktiv ist', () => {
    syncNavGroups();
    expect(gruppe().classList.contains('has-active')).toBe(false);
    document.querySelector('[data-page="mitarbeiter"]')!.classList.add('active');
    syncNavGroups();
    expect(gruppe().classList.contains('has-active')).toBe(true);
    expect(gruppe().classList.contains('open')).toBe(true);
  });

  it('klappt beim Wechsel zu einem anderen Modul automatisch ein', () => {
    (document.querySelector('.nav-group-head') as HTMLElement).click(); // manuell geöffnet
    expect(gruppe().classList.contains('open')).toBe(true);
    // Navigation zu Dashboard: kein Submodul aktiv
    syncNavGroups();
    expect(gruppe().classList.contains('open')).toBe(false);
    expect(gruppe().classList.contains('has-active')).toBe(false);
  });

  it('klappt die eingeklappte Navigation aus und öffnet die Gruppe beim Klick auf den Kopf', () => {
    const app = document.getElementById('app')!;
    app.classList.add('nav-collapsed');   // Navigation ist eingeklappt (nur Icons)
    (document.querySelector('.nav-group-head') as HTMLElement).click();
    // Navigation ist wieder ausgeklappt UND die Gruppe offen
    expect(app.classList.contains('nav-collapsed')).toBe(false);
    expect(gruppe().classList.contains('open')).toBe(true);
  });

  it('Akkordeon: das Öffnen einer Gruppe schließt die andere (nur eine offen)', () => {
    // frische Shell mit ZWEI Gruppen aufbauen und dann erst binden
    const nav = document.querySelector('.nav-group')!.parentElement!;
    const li = document.createElement('li');
    li.className = 'nav-group';
    li.setAttribute('data-group', 'g2');
    li.innerHTML = `<button class="nav-link nav-group-head" type="button"><span class="nav-label">Systemverwaltung</span></button>
      <ul class="nav-sub"><li><a class="nav-link nav-sub-link" data-page="rollen">Rollen</a></li></ul>`;
    nav.appendChild(li);
    // frisch klonen, damit die in beforeEach gesetzten Handler weg sind, dann
    // EINMAL binden -> echte initNavGroups-Logik wird getestet
    document.querySelectorAll('.nav-group-head').forEach((b) => {
      const neu = b.cloneNode(true);
      b.parentNode!.replaceChild(neu, b);
    });
    initNavGroups();

    const koepfe = [...document.querySelectorAll('.nav-group-head')] as HTMLElement[];
    const gruppen = [...document.querySelectorAll('.nav-group')];
    koepfe[0].click();
    expect(gruppen[0].classList.contains('open')).toBe(true);
    expect(gruppen[1].classList.contains('open')).toBe(false);
    // zweite Gruppe öffnen -> erste schließt
    koepfe[1].click();
    expect(gruppen[0].classList.contains('open')).toBe(false);
    expect(gruppen[1].classList.contains('open')).toBe(true);
    // erneuter Klick auf die offene zweite Gruppe schließt sie wieder
    koepfe[1].click();
    expect(gruppen[1].classList.contains('open')).toBe(false);
  });
});
