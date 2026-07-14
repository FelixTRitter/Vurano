/**
 * STAMMDATEN > Sprachen (Belegsprachen)
 * ---------------------------------------------------------------
 * Verfügbare Sprachen für Belege (Angebote, Rechnungen). Die Bediensprache
 * der Software bleibt deutsch. code = ISO 639-1 (für spätere KI-Übersetzung),
 * name = Anzeigename. Vorbefüllt ausgeliefert; anlegen/bearbeiten/löschen.
 */
import { API, fmt, el, Modal, fieldVals } from './ic/helpers.js';
import { Router } from './ic/router.js';

const Sprachen = {
  async render(root: HTMLElement): Promise<void> {
    const sprachen = await API.get('/api/stammdaten/sprachen');
    const rows = sprachen.length
      ? sprachen.map((s: any) => `
          <tr data-id="${s.id}">
            <td><span class="badge" style="font-family:ui-monospace,monospace">${fmt.esc(s.code)}</span></td>
            <td><span class="cell-strong">${fmt.esc(s.name)}</span></td>
            <td class="row-actions">
              <button class="act-btn" data-edit="${s.id}" title="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="act-btn danger" data-del="${s.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="sub" style="color:var(--text-muted)">Noch keine Sprachen.</td></tr>';

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">Sprachen</div>
            <div class="page-subtitle">Belegsprachen für Angebote und Rechnungen. Die Standardsprache wird unter Unternehmen festgelegt.</div>
          </div>
          <button class="btn" id="sprache-neu">＋ Sprache</button>
        </div>
        <div class="card">
          <div class="tbl-wrap"><table class="data" id="tbl-sprachen">
            <colgroup><col style="width:110px"><col><col style="width:100px"></colgroup>
            <thead><tr><th>Code</th><th>Sprache</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
      </div>`);

    view.querySelector('#sprache-neu')!.addEventListener('click', () => this.openForm(root, null));
    view.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = sprachen.find((x: any) => String(x.id) === (b as HTMLElement).dataset.edit);
        this.openForm(root, s);
      }));
    view.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Sprache löschen?')) return;
        try { await API.del('/api/stammdaten/sprachen/' + (b as HTMLElement).dataset.del); this.render(root); }
        catch (e: any) { alert(e.message); }
      }));

    root.innerHTML = '';
    root.appendChild(view);
  },

  openForm(root: HTMLElement, s: any | null): void {
    const v = (f: string) => fmt.esc(s?.[f] ?? '');
    const body = el(`
      <div class="form-grid">
        <div class="field"><label>Code <span class="req">*</span></label><input data-field="code" value="${v('code')}" placeholder="z. B. de, en, fr" maxlength="3" style="text-transform:lowercase"></div>
        <div class="field"><label>Sprache <span class="req">*</span></label><input data-field="name" value="${v('name')}" placeholder="z. B. Deutsch, Englisch"></div>
      </div>
      <p class="sub" style="color:var(--text-muted);margin-top:4px">Der Code ist das ISO-Sprachkürzel und wird später für die automatische Übersetzung genutzt.</p>`);

    Modal.open(s ? 'Sprache bearbeiten' : 'Sprache erfassen', body, {
      okLabel: 'Speichern',
      focusSelector: '[data-field="code"]',
      onOk: async () => {
        const d: any = fieldVals(body);
        if (!d.code || !d.code.trim() || !d.name || !d.name.trim()) { alert('Code und Sprache sind erforderlich.'); return false; }
        try {
          if (s) await API.put('/api/stammdaten/sprachen/' + s.id, d);
          else await API.post('/api/stammdaten/sprachen', d);
        } catch (err: any) { alert(err.message); return false; }
        this.render(root);
      },
    });
  },
};

Router.register('sprachen', (root: HTMLElement) => Sprachen.render(root));

export { Sprachen };
