/**
 * User Verwaltung (Submodul der Systemverwaltung).
 * Benutzerkonten anlegen, bearbeiten, (de)aktivieren und mit Mitarbeitern
 * verknüpfen. Sichtbar nur für die Zugriffsrolle admin — users.role bleibt
 * die technische Zugriffsrolle, bis das Berechtigungssystem sie ablöst.
 */
import { API, fmt, el, Modal, fieldVals, Sorter } from './ic/helpers.js';
import { Router } from './ic/router.js';

const Users: any = {
  async renderList(root: HTMLElement): Promise<void> {
    let data: any[], mitarbeiter: any[], zugriffsrollen: any[];
    try {
      // Benutzer, Mitarbeiter und Zugriffsrollen parallel laden
      [data, mitarbeiter, zugriffsrollen] = await Promise.all([
        API.get('/api/users'),
        API.get('/api/mitarbeiter'),
        API.get('/api/users/zugriffsrollen'),
      ]);
      this._zugriffsrollen = zugriffsrollen;
    } catch (e: any) {
      root.innerHTML = '';
      root.appendChild(el(`<div class="card"><div class="empty-state"><h3>Kein Zugriff</h3><p>${fmt.esc(e.message)}</p></div></div>`));
      return;
    }

    const rows = data.map((u: any) => `
      <tr class="clickable" data-id="${u.id}">
        <td data-val="${fmt.esc(u.email)}"><span class="cell-strong">${fmt.esc(u.email)}</span></td>
        <td>${fmt.esc(u.name)}</td>
        <td><span class="badge">${fmt.esc(u.zugriffsrolle_name || '—')}</span></td>
        <td>${fmt.esc((u.mitarbeiter_name || '').trim() || '–')}</td>
        <td>${u.totp_aktiv ? 'Aktiv' : '<span class="badge">Ausstehend</span>'}</td>
        <td>${u.active ? 'Aktiv' : '<span class="badge">Deaktiviert</span>'}</td>
      </tr>`).join('');

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">User Verwaltung</div>
            <div class="page-subtitle">${data.length} Benutzerkonten</div>
          </div>
          <button class="btn btn-primary" id="btn-neu">＋ Neuer Benutzer</button>
        </div>
        <div class="tbl-wrap"><table class="data" id="tbl-users">
          <thead><tr>
            <th data-sort="email">E-Mail</th><th data-sort="name">Name</th>
            <th data-sort="rolle">Zugriffsrolle</th><th data-sort="ma">Mitarbeiter</th>
            <th data-sort="totp">2FA</th><th data-sort="status">Status</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`);

    view.querySelector('#btn-neu')!.addEventListener('click', () => this.openForm(null, mitarbeiter));
    view.querySelectorAll('tr.clickable').forEach((tr: any) =>
      tr.addEventListener('click', () => {
        const u = data.find((x: any) => String(x.id) === tr.dataset.id);
        if (u) this.openForm(u, mitarbeiter);
      }));

    root.innerHTML = '';
    root.appendChild(view);
    Sorter.init(view.querySelector('#tbl-users'), { sortBy: 'email' });
  },

  openForm(u: any | null, mitarbeiter: any[]): void {
    const v = (key: string) => fmt.esc(u?.[key] ?? '');
    const rollen = this._zugriffsrollen || [];
    const rolleOpts = rollen
      .map((r: any) => `<option value="${r.id}" ${String(u?.zugriffsrolle_id) === String(r.id) ? 'selected' : ''}>${fmt.esc(r.name)}</option>`).join('');
    const maOpts = ['<option value="">– keine Verknüpfung –</option>']
      .concat(mitarbeiter.map((m: any) =>
        `<option value="${m.id}" ${String(u?.mitarbeiter_id) === String(m.id) ? 'selected' : ''}>${fmt.esc([m.vorname, m.nachname].filter(Boolean).join(' '))}</option>`))
      .join('');

    const body = el(`
      <div>
        <div class="form-grid">
          <div class="field"><label>E-Mail <span class="req">*</span></label><input data-field="email" type="email" value="${v('email')}" ${u ? 'disabled' : ''}></div>
          <div class="field"><label>Name <span class="req">*</span></label><input data-field="name" value="${v('name')}"></div>
          <div class="field"><label>Zugriffsrolle</label><select data-field="zugriffsrolle_id">${rolleOpts}</select></div>
          <div class="field"><label>Mitarbeiter</label><select data-field="mitarbeiter_id">${maOpts}</select></div>
          <div class="field"><label>${u ? 'Neues Passwort (leer = unverändert)' : 'Passwort *'}</label><input data-field="password" type="password" autocomplete="new-password"></div>
          ${u ? `<div class="field"><label class="chk" style="margin-top:22px"><input type="checkbox" data-field="active" ${u.active ? 'checked' : ''}> Konto aktiv</label></div>` : ''}
          ${u ? `<div class="field full" style="border-top:0.5px solid var(--border);padding-top:12px">
            <button class="btn btn-sm" id="uf-totp-reset" type="button">2FA zurücksetzen</button>
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px">Bei Handyverlust: Benutzer richtet 2FA beim nächsten Login neu ein (alle Sitzungen werden beendet).</span>
          </div>` : ''}
          ${u ? `<div class="field full">
            <button class="btn btn-sm" id="uf-loeschen" type="button" style="color:var(--negative,#b3372c);border-color:currentColor">Benutzer löschen</button>
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px">Entfernt das Konto endgültig. Ein verknüpfter Mitarbeiter bleibt erhalten.</span>
          </div>` : ''}
        </div>
      </div>`);

    body.querySelector('#uf-totp-reset')?.addEventListener('click', async () => {
      if (!confirm(`2FA für ${u.email} zurücksetzen?`)) return;
      try {
        await API.post('/api/users/' + u.id + '/totp-reset');
        alert('2FA zurückgesetzt — Einrichtung erfolgt beim nächsten Login.');
        Modal.close();
        Router.navigate('#users');
      } catch (e: any) { alert(e.message); }
    });

    body.querySelector('#uf-loeschen')?.addEventListener('click', async () => {
      if (!confirm(`Benutzer ${u.email} endgültig löschen?`)) return;
      try {
        await API.del('/api/users/' + u.id);
        Modal.close();
        Router.navigate('#users');
      } catch (e: any) { alert(e.message); }
    });

    Modal.open(u ? 'Benutzer bearbeiten' : 'Benutzer anlegen', body, {
      focusSelector: u ? '[data-field="name"]' : '[data-field="email"]',
      onOk: async () => {
        const d: any = fieldVals(body);
        if (u) d.email = u.email;
        if (!u && (!d.email || !d.name || !d.password)) { alert('E-Mail, Name und Passwort sind erforderlich.'); return false; }
        try {
          if (u) await API.put('/api/users/' + u.id, d);
          else await API.post('/api/users', d);
        } catch (e: any) { alert(e.message); return false; }
        Router.navigate('#users');
      },
    });
  },
};

Router.register('users', (root: HTMLElement) => Users.renderList(root));

export { Users };
