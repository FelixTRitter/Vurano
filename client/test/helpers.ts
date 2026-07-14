/**
 * Gemeinsame Test-Hilfen: minimale App-Shell im jsdom aufbauen und
 * fetch durch einen steuerbaren Stub ersetzen.
 */
import { vi } from 'vitest';

/** Baut die für Router/Nav nötige Grundstruktur der Shell auf. */
export function mountShell(): void {
  document.body.innerHTML = `
    <div id="fatal-error" hidden></div>
    <div id="app" class="app">
      <nav class="sidebar"><ul class="nav-list">
        <li><a href="#dashboard" class="nav-link" data-page="dashboard"><span class="nav-label">Dashboard</span></a></li>
        <li><a href="#kontakte" class="nav-link" data-page="kontakte"><span class="nav-label">Adressverwaltung</span></a></li>
        <li class="nav-group" data-group="g1">
          <button class="nav-link nav-group-head" type="button"><span class="nav-label">Mitarbeiterverwaltung</span></button>
          <ul class="nav-sub">
            <li><a href="#mitarbeiter" class="nav-link nav-sub-link" data-page="mitarbeiter"><span class="nav-label">Mitarbeiter</span></a></li>
            <li><a href="#users" class="nav-link nav-sub-link" data-page="users"><span class="nav-label">User Verwaltung</span></a></li>
          </ul>
        </li>
      </ul></nav>
      <aside class="context-panel rail-off" id="context-panel"></aside>
      <aside class="context-panel rail-off" id="context-panel-2"></aside>
      <main class="content" id="content"></main>
    </div>`;
  location.hash = '';
}

/** fetch-Stub: Pfad-Präfix -> JSON-Antwort. Unbekannte Pfade -> 404. */
export function stubFetch(routen: Record<string, unknown>): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const pfad = String(url).split('?')[0];
    for (const [prefix, data] of Object.entries(routen)) {
      if (pfad === prefix) {
        return { ok: true, status: 200, json: async () => data } as Response;
      }
    }
    return { ok: false, status: 404, json: async () => ({ error: 'Nicht gefunden.' }) } as Response;
  }));
}
