/**
 * Tests für den portierten Router: Navigations-Bindung, Markierungslogik,
 * Fallback-Verhalten — die Fehlerklasse aus dem v1f-Review.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell } from './helpers.js';
import { Router } from '../src/ic/router.js';

function seiten() {
  const calls: string[] = [];
  Router.pages = {};
  for (const name of ['dashboard', 'kontakte', 'mitarbeiter', 'users']) {
    Router.register(name, (root: HTMLElement) => {
      calls.push(name);
      root.innerHTML = `<div class="page-title">${name}</div>`;
    });
  }
  return calls;
}

describe('Router', () => {
  beforeEach(() => mountShell());

  it('rendert die Standardseite dashboard bei leerem Hash', () => {
    const calls = seiten();
    Router.init();
    expect(calls.at(-1)).toBe('dashboard');
    expect(document.querySelector('.nav-link.active')!.getAttribute('data-page')).toBe('dashboard');
  });

  it('Gruppenköpfe ohne data-page lösen KEINE Navigation aus', () => {
    const calls = seiten();
    Router.init();
    const vorher = calls.length;
    (document.querySelector('.nav-group-head') as HTMLElement).click();
    expect(calls.length).toBe(vorher);           // kein Render
    expect(location.hash).not.toContain('undefined');
  });

  it('markiert immer die tatsächlich gerenderte Seite (Fallback-Invariante)', () => {
    seiten();
    Router.init();
    Router.navigate('#gibtesnicht');
    expect(document.querySelector('#content .page-title')!.textContent).toBe('dashboard');
    expect(document.querySelector('.nav-link.active')!.getAttribute('data-page')).toBe('dashboard');
  });

  it('navigiert per Klick auf ein Submodul und markiert es', () => {
    seiten();
    Router.init();
    (document.querySelector('[data-page="mitarbeiter"]') as HTMLElement).click();
    expect(document.querySelector('#content .page-title')!.textContent).toBe('mitarbeiter');
    expect(document.querySelector('.nav-link.active')!.getAttribute('data-page')).toBe('mitarbeiter');
  });

  it('go() ignoriert leere Ziele', () => {
    const calls = seiten();
    Router.init();
    const vorher = calls.length;
    Router.go(undefined as any);
    expect(calls.length).toBe(vorher);
  });
});
