/**
 * BERECHTIGUNGSROLLEN (Konfiguration > Rollen)
 * ---------------------------------------------------------------
 * Tabelle aller Zugriffsrollen. Klick auf eine Rolle öffnet das Detail
 * (zweite Seitennavigation) mit allen Modulen/Submodulen als Checkboxen —
 * hier wird festgelegt, worauf die Rolle Zugriff hat.
 *
 * Administrator: Sonderrolle mit unveränderlichem Vollzugriff (alle Häkchen
 * gesetzt und gesperrt; Rolle nicht löschbar).
 */
import { API, fmt, el } from './ic/helpers.js';
import { Router, Shell } from './ic/router.js';

const Rollen = {
  async renderList(root: HTMLElement): Promise<void> {
    Shell.exitDetail();
    const rollen = await API.get('/api/berechtigungsrollen');
    const rows = rollen.map((r: any) => `
      <tr class="clickable" data-id="${r.id}">
        <td><span class="cell-strong">${fmt.esc(r.name)}</span></td>
        <td>${r.ist_admin ? '<span class="badge">Vollzugriff</span>' : ''}</td>
        <td>${r.system ? '<span class="sub" style="color:var(--text-muted)">geschützt</span>' : ''}</td>
        <td class="row-actions">${r.system ? '' : `<button class="act-btn danger" data-del="${r.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>`}</td>
      </tr>`).join('');

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">Zugriffsrollen</div>
            <div class="page-subtitle">Zugriffsrollen und ihre Modulberechtigungen</div>
          </div>
          <button class="btn" id="rolle-neu">＋ Rolle</button>
        </div>
        <div class="tbl-wrap"><table class="data" id="tbl-rollen">
          <thead><tr><th>Name</th><th>Zugriff</th><th></th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`);

    view.querySelectorAll('#tbl-rollen tbody tr.clickable').forEach((tr) =>
      tr.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.row-actions')) return;
        Router.go('rollen/' + (tr as HTMLElement).dataset.id);
      }));
    view.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Rolle löschen?')) return;
        try { await API.del('/api/berechtigungsrollen/' + (b as HTMLElement).dataset.del); this.renderList(root); }
        catch (err: any) { alert(err.message); }
      }));
    view.querySelector('#rolle-neu')!.addEventListener('click', () => this.neueRolle(root));

    root.innerHTML = '';
    root.appendChild(view);
  },

  async neueRolle(root: HTMLElement): Promise<void> {
    const name = prompt('Name der neuen Rolle:');
    if (!name || !name.trim()) return;
    try { await API.post('/api/berechtigungsrollen', { name: name.trim() }); this.renderList(root); }
    catch (e: any) { alert(e.message); }
  },

  async renderDetail(root: HTMLElement, id: string): Promise<void> {
    let rolle: any, module: any[];
    try {
      [rolle, module] = await Promise.all([
        API.get('/api/berechtigungsrollen/' + id),
        API.get('/api/berechtigungsrollen/module'),
      ]);
    } catch { root.innerHTML = '<div class="card"><div class="empty-state"><h3>Nicht gefunden</h3></div></div>'; return; }

    const spine = el(`<div class="detail-rail">
      <button class="rail-back" id="r-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Zugriffsrollen</button>
      <div class="rail-title">${fmt.esc(rolle.name)}</div>
      <div class="rail-sub">${rolle.ist_admin ? 'Vollzugriff (geschützt)' : 'Zugriffsrolle'}</div>
    </div>`);
    Shell.enterDetail(spine);
    spine.querySelector('#r-back')!.addEventListener('click', () => Router.go('rollen'));

    const aktiv = new Set<string>(rolle.module);
    // nach Gruppe ordnen
    const gruppen: Record<string, any[]> = {};
    for (const m of module) { (gruppen[m.gruppe] ||= []).push(m); }

    const gruppenHtml = Object.entries(gruppen).map(([gruppe, mods]) => `
      <div class="rechte-gruppe">
        <div class="rechte-gruppe-titel">${fmt.esc(gruppe)}</div>
        ${mods.map((m) => `
          <label class="rechte-zeile">
            <input type="checkbox" data-modul="${m.key}" ${aktiv.has(m.key) ? 'checked' : ''} ${rolle.ist_admin ? 'disabled' : ''}>
            <span>${fmt.esc(m.label)}</span>
          </label>`).join('')}
      </div>`).join('');

    const view = el(`
      <div>
        <div class="page-header"><div>
          <div class="page-title">${fmt.esc(rolle.name)}</div>
          <div class="page-subtitle">${rolle.ist_admin ? 'Diese Rolle hat unveränderlichen Vollzugriff auf alle Module — auch auf künftig hinzukommende.' : 'Modulzugriff per Häkchen festlegen. Änderungen werden sofort gespeichert.'}</div>
        </div></div>
        <div class="card"><div class="rechte-grid">${gruppenHtml}</div></div>
      </div>`);

    if (!rolle.ist_admin) {
      view.querySelectorAll('input[data-modul]').forEach((cb) =>
        cb.addEventListener('change', async (e) => {
          const box = e.target as HTMLInputElement;
          try {
            await API.put('/api/berechtigungsrollen/' + id + '/modul', { modul_key: box.dataset.modul, aktiv: box.checked });
          } catch (err: any) { alert(err.message); box.checked = !box.checked; }
        }));
    }

    root.innerHTML = '';
    root.appendChild(view);
  },
};

Router.register('rollen', (root: HTMLElement, param?: string) => {
  if (param) return Rollen.renderDetail(root, param);
  return Rollen.renderList(root);
});

export { Rollen };
