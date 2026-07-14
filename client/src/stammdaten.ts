/**
 * STAMMDATEN > Qualifikation / Funktionen
 * ---------------------------------------------------------------
 * Zwei nebeneinander geführte Stammdatenlisten für die Mitarbeiter:
 *  - Funktionen (Stellenbezeichnung, ein Mitarbeiter hat genau eine)
 *  - Qualifikationen (Fähigkeiten, ein Mitarbeiter kann mehrere haben)
 * Gepflegte Listen statt Freitext -> kein Wildwuchs.
 */
import { API, fmt, el } from './ic/helpers.js';
import { Router } from './ic/router.js';

/** Baut eine Karte mit Anlege-Feld und Liste für eine Stammdatentabelle. */
function stammListe(titel: string, apiPath: string, platzhalter: string) {
  return async (container: HTMLElement) => {
    const render = async () => {
      const eintraege = await API.get(apiPath);
      const rows = eintraege.length
        ? eintraege.map((r: any) => `
            <div class="kat-row" data-id="${r.id}">
              <span>${fmt.esc(r.name)}</span>
              <button class="act-btn danger" data-del="${r.id}" title="Löschen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>`).join('')
        : '<p class="sub" style="color:var(--text-muted)">Noch keine Einträge.</p>';
      container.querySelector('.stamm-liste')!.innerHTML = rows;
      container.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!confirm('Eintrag löschen?')) return;
          try { await API.del(apiPath + '/' + (b as HTMLElement).dataset.del); await render(); }
          catch (e: any) { alert(e.message); }
        }));
    };

    const neu = container.querySelector('.stamm-neu') as HTMLInputElement;
    const anlegen = async () => {
      const name = neu.value.trim();
      if (!name) return;
      try { await API.post(apiPath, { name }); neu.value = ''; await render(); neu.focus(); }
      catch (e: any) { alert(e.message); }
    };
    container.querySelector('.stamm-add')!.addEventListener('click', anlegen);
    neu.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); anlegen(); } });
    await render();
  };
}

async function renderStammdaten(root: HTMLElement): Promise<void> {
  const view = el(`
    <div>
      <div class="page-header"><div>
        <div class="page-title">Qualifikation / Funktionen</div>
        <div class="page-subtitle">Stammdaten für die Mitarbeiterverwaltung. Aus diesen Listen wird beim Mitarbeiter ausgewählt.</div>
      </div></div>
      <div class="stamm-grid">
        <div class="card" id="karte-funktionen">
          <h3 class="card-title">Funktionen</h3>
          <p class="sub" style="color:var(--text-muted);margin-bottom:12px">Stellenbezeichnung (z. B. Projektleiter, Fertigungsmitarbeiter). Ein Mitarbeiter hat genau eine Funktion.</p>
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input class="stamm-neu" placeholder="Neue Funktion …" style="flex:1;padding:8px 11px;border:0.5px solid var(--border);border-radius:var(--radius)">
            <button class="btn btn-primary btn-sm stamm-add">Hinzufügen</button>
          </div>
          <div class="stamm-liste"></div>
        </div>
        <div class="card" id="karte-qualifikationen">
          <h3 class="card-title">Qualifikationen</h3>
          <p class="sub" style="color:var(--text-muted);margin-bottom:12px">Fähigkeiten/Skills (z. B. Elektriker, AutoCAD, Revit). Ein Mitarbeiter kann mehrere haben.</p>
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input class="stamm-neu" placeholder="Neue Qualifikation …" style="flex:1;padding:8px 11px;border:0.5px solid var(--border);border-radius:var(--radius)">
            <button class="btn btn-primary btn-sm stamm-add">Hinzufügen</button>
          </div>
          <div class="stamm-liste"></div>
        </div>
      </div>
    </div>`);

  root.innerHTML = '';
  root.appendChild(view);
  await stammListe('Funktionen', '/api/stammdaten/funktionen', 'Neue Funktion …')(view.querySelector('#karte-funktionen')!);
  await stammListe('Qualifikationen', '/api/stammdaten/qualifikationen', 'Neue Qualifikation …')(view.querySelector('#karte-qualifikationen')!);
}

Router.register('qualifikationen', renderStammdaten);

export { renderStammdaten };
