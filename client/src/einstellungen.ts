/**
 * MODUL EINSTELLUNGEN (Seite "einstellungen")
 * ---------------------------------------------------------------
 * Persönliche Einstellungen des angemeldeten Benutzers.
 * Abschnitt "Darstellung": Farbschema (Dropdown hell/dunkel) und
 * Führungsfarbe (Farbwähler, Default Vurano-Orange). Änderungen
 * wirken sofort als Live-Vorschau; "Speichern" schreibt sie über
 * PUT /api/einstellungen/darstellung ans Benutzerkonto, sodass sie
 * auf jedem Gerät gelten.
 *
 * Erweitern: neue Einstellungsgruppe = neue Karte in dieser Datei
 * + GET/PUT im Server-Modul einstellungen.
 */
import { API, fmt, el } from './ic/helpers.js';
import { Router } from './ic/router.js';
import { applyTheme, applySavedTheme, setSavedTheme, DEFAULT_AKZENT } from './theme.js';

const Einstellungen: any = {
  async render(root: HTMLElement): Promise<void> {
    const d = await API.get('/api/einstellungen/darstellung');

    const view = el(`
      <div>
        <div class="page-header"><div><div class="page-title">Einstellungen</div></div></div>
        <div class="card">
          <h2 style="font-size:14px;margin:0 0 14px">Darstellung</h2>
          <div class="form-grid">
            <div class="field">
              <label>Farbschema</label>
              <select id="es-theme">
                <option value="hell" ${d.theme === 'hell' ? 'selected' : ''}>Hell</option>
                <option value="dunkel" ${d.theme === 'dunkel' ? 'selected' : ''}>Dunkel</option>
              </select>
            </div>
            <div class="field">
              <label>Führungsfarbe</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input id="es-farbe" type="color" value="${fmt.esc(d.akzentfarbe)}" style="width:44px;height:32px;padding:2px;border:0.5px solid var(--border);border-radius:var(--radius);background:transparent">
                <button class="btn btn-sm" id="es-reset" type="button" title="Auf Standard-Orange zurücksetzen">Standard</button>
              </div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin:10px 0 14px">
            Änderungen werden sofort als Vorschau angewendet und gelten nach dem
            Speichern für dieses Benutzerkonto auf allen Geräten.
          </p>
          <button class="btn btn-primary" id="es-speichern">Speichern</button>
          <span id="es-status" style="margin-left:10px;font-size:13px;color:var(--text-muted)"></span>
        </div>
      </div>`);

    const theme = view.querySelector('#es-theme') as HTMLSelectElement;
    const farbe = view.querySelector('#es-farbe') as HTMLInputElement;
    const status = view.querySelector('#es-status') as HTMLElement;

    const vorschau = () => applyTheme(theme.value, farbe.value);
    theme.addEventListener('change', vorschau);
    farbe.addEventListener('input', vorschau);
    view.querySelector('#es-reset')!.addEventListener('click', () => {
      farbe.value = DEFAULT_AKZENT;
      vorschau();
    });

    view.querySelector('#es-speichern')!.addEventListener('click', async () => {
      try {
        await API.put('/api/einstellungen/darstellung', { theme: theme.value, akzentfarbe: farbe.value.toUpperCase() });
        // Gespeicherten Stand nachziehen — damit bleibt die Auswahl auch nach
        // Modulwechseln bestehen und die Anmeldeseite nutzt sie beim nächsten Mal.
        setSavedTheme(theme.value, farbe.value.toUpperCase());
        status.textContent = 'Gespeichert.';
        setTimeout(() => (status.textContent = ''), 2500);
      } catch (e: any) {
        alert(e.message);
        applySavedTheme();
      }
    });

    // Verlässt man die Einstellungen ohne zu speichern, wird eine laufende
    // Live-Vorschau verworfen (einmaliger Listener, räumt sich selbst auf).
    window.addEventListener('hashchange', () => applySavedTheme(), { once: true });

    root.innerHTML = '';
    root.appendChild(view);
  },
};

Router.register('einstellungen', (root: HTMLElement) => Einstellungen.render(root));

export { Einstellungen };
