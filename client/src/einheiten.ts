/**
 * STAMMDATEN > Einheiten
 * ---------------------------------------------------------------
 * Mengeneinheiten für spätere Positionen (Angebote, Rechnungen, Material).
 * kuerzel = Belegdarstellung (m², Stk, kg), name = optionale Bezeichnung.
 * Wird vorbefüllt ausgeliefert; anlegen, bearbeiten und löschen möglich.
 */
import { API, fmt, el, Modal, fieldVals } from './ic/helpers.js';
import { Router } from './ic/router.js';

const Einheiten = {
  async render(root: HTMLElement): Promise<void> {
    const einheiten = await API.get('/api/stammdaten/einheiten');
    const rows = einheiten.length
      ? einheiten.map((e: any) => `
          <tr data-id="${e.id}">
            <td><span class="cell-strong">${fmt.esc(e.kuerzel)}</span></td>
            <td>${fmt.esc(e.name || '–')}</td>
            <td class="row-actions">
              <button class="act-btn" data-edit="${e.id}" title="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="act-btn danger" data-del="${e.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="sub" style="color:var(--text-muted)">Noch keine Einheiten.</td></tr>';

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">Einheiten</div>
            <div class="page-subtitle">Mengeneinheiten für Positionen in Angeboten, Rechnungen und Material.</div>
          </div>
          <button class="btn" id="einheit-neu">＋ Einheit</button>
        </div>
        <div class="card">
          <div class="tbl-wrap"><table class="data" id="tbl-einheiten">
            <colgroup><col style="width:160px"><col><col style="width:100px"></colgroup>
            <thead><tr><th>Kürzel</th><th>Bezeichnung</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
      </div>`);

    view.querySelector('#einheit-neu')!.addEventListener('click', () => this.openForm(root, null));
    view.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const e = einheiten.find((x: any) => String(x.id) === (b as HTMLElement).dataset.edit);
        this.openForm(root, e);
      }));
    view.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Einheit löschen?')) return;
        try { await API.del('/api/stammdaten/einheiten/' + (b as HTMLElement).dataset.del); this.render(root); }
        catch (e: any) { alert(e.message); }
      }));

    root.innerHTML = '';
    root.appendChild(view);
  },

  openForm(root: HTMLElement, e: any | null): void {
    const v = (f: string) => fmt.esc(e?.[f] ?? '');
    const body = el(`
      <div class="form-grid">
        <div class="field"><label>Kürzel <span class="req">*</span></label><input data-field="kuerzel" value="${v('kuerzel')}" placeholder="z. B. m², Stk, kg"></div>
        <div class="field"><label>Bezeichnung</label><input data-field="name" value="${v('name')}" placeholder="z. B. Quadratmeter (optional)"></div>
      </div>`);

    Modal.open(e ? 'Einheit bearbeiten' : 'Einheit erfassen', body, {
      okLabel: 'Speichern',
      focusSelector: '[data-field="kuerzel"]',
      onOk: async () => {
        const d: any = fieldVals(body);
        if (!d.kuerzel || !d.kuerzel.trim()) { alert('Kürzel ist erforderlich.'); return false; }
        try {
          if (e) await API.put('/api/stammdaten/einheiten/' + e.id, d);
          else await API.post('/api/stammdaten/einheiten', d);
        } catch (err: any) { alert(err.message); return false; }
        this.render(root);
      },
    });
  },
};

Router.register('einheiten', (root: HTMLElement) => Einheiten.render(root));

export { Einheiten };
