/**
 * TEILESTAMM (eigenständiges Modul)
 * ---------------------------------------------------------------
 * Erfasst alle Teiletypen AUSSER Verkaufsartikel (Kaufartikel, Baugruppe,
 * Lagerteil, Meterware, Halbzeug). Nutzt dieselbe Artikeltabelle wie der
 * Verkaufsartikelstamm (gemeinsame Basis für die spätere Stückliste), nur
 * nach Teiletyp gefiltert. Anlegen mit Teiletyp-Auswahl; Teiletyp als Spalte.
 */
import { API, fmt, el, Modal, fieldVals } from './ic/helpers.js';
import { Router } from './ic/router.js';

const Teilestamm = {
  _typen: [] as any[],          // alle Teiletypen (ohne verkaufsartikel)
  _einheiten: [] as any[],

  async ladeHilfsdaten(): Promise<void> {
    const [typen, einheiten] = await Promise.all([
      API.get('/api/artikel/teiletypen'),
      API.get('/api/stammdaten/einheiten'),
    ]);
    this._typen = typen.filter((t: any) => t.key !== 'verkaufsartikel');
    this._einheiten = einheiten;
  },

  typLabel(key: string): string {
    const t = this._typen.find((x: any) => x.key === key);
    return t ? t.label : key;
  },

  async render(root: HTMLElement): Promise<void> {
    await this.ladeHilfsdaten();
    const keys = this._typen.map((t: any) => t.key).join(',');
    const artikel = await API.get('/api/artikel?teiletyp=' + encodeURIComponent(keys));

    const rows = artikel.length
      ? artikel.map((a: any) => `
          <tr data-id="${a.id}">
            <td><span class="badge">${fmt.esc(this.typLabel(a.teiletyp))}</span></td>
            <td><span class="cell-strong">${fmt.esc(a.artikelnummer || '–')}</span></td>
            <td>${fmt.esc(a.bezeichnung)}</td>
            <td>${fmt.esc(a.einheit_kuerzel || '–')}</td>
            <td class="row-actions">
              <button class="act-btn" data-edit="${a.id}" title="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="act-btn danger" data-del="${a.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="sub" style="color:var(--text-muted)">Noch keine Teile.</td></tr>';

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">Teilestamm</div>
            <div class="page-subtitle">Kauf- und Fertigungsteile: Kaufartikel, Baugruppen, Lagerteile, Meterware, Halbzeuge.</div>
          </div>
          <button class="btn" id="teil-neu">＋ Teil</button>
        </div>
        <div class="card">
          <div class="tbl-wrap"><table class="data" id="tbl-teile">
            <colgroup><col style="width:150px"><col style="width:170px"><col><col style="width:100px"><col style="width:100px"></colgroup>
            <thead><tr><th>Teiletyp</th><th>Artikelnummer</th><th>Bezeichnung</th><th>Einheit</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
      </div>`);

    view.querySelector('#teil-neu')!.addEventListener('click', () => this.openForm(root, null));
    view.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = artikel.find((x: any) => String(x.id) === (b as HTMLElement).dataset.edit);
        this.openForm(root, a);
      }));
    view.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Teil löschen?')) return;
        try { await API.del('/api/artikel/' + (b as HTMLElement).dataset.del); this.render(root); }
        catch (e: any) { alert(e.message); }
      }));

    root.innerHTML = '';
    root.appendChild(view);
  },

  openForm(root: HTMLElement, a: any | null): void {
    const v = (f: string) => fmt.esc(a?.[f] ?? '');
    const typOpts = this._typen
      .map((t: any) => `<option value="${t.key}" ${a?.teiletyp === t.key ? 'selected' : ''}>${fmt.esc(t.label)}</option>`).join('');
    const einheitOpts = ['<option value="">– keine –</option>']
      .concat(this._einheiten.map((e: any) => `<option value="${e.id}" ${String(a?.einheit_id) === String(e.id) ? 'selected' : ''}>${fmt.esc(e.kuerzel)}${e.name ? ' – ' + fmt.esc(e.name) : ''}</option>`)).join('');

    const body = el(`
      <div class="form-grid">
        <div class="field"><label>Teiletyp <span class="req">*</span></label><select data-field="teiletyp" ${a ? 'disabled' : ''}>${typOpts}</select></div>
        <div class="field"><label>Einheit</label><select data-field="einheit_id">${einheitOpts}</select></div>
        <div class="field"><label>Artikelnummer</label><input data-field="artikelnummer" value="${v('artikelnummer')}" placeholder="z. B. KA-2001"></div>
        <div class="field full"><label>Bezeichnung <span class="req">*</span></label><input data-field="bezeichnung" value="${v('bezeichnung')}" placeholder="z. B. Schraube M4x30"></div>
      </div>`);

    Modal.open(a ? 'Teil bearbeiten' : 'Teil erfassen', body, {
      okLabel: 'Speichern',
      focusSelector: a ? '[data-field="artikelnummer"]' : '[data-field="teiletyp"]',
      onOk: async () => {
        const d: any = fieldVals(body);
        // teiletyp bei Bearbeitung nicht änderbar (disabled liefert keinen Wert)
        if (a) d.teiletyp = a.teiletyp;
        if (!d.teiletyp) { alert('Teiletyp ist erforderlich.'); return false; }
        if (!d.bezeichnung || !d.bezeichnung.trim()) { alert('Bezeichnung ist erforderlich.'); return false; }
        try {
          if (a) await API.put('/api/artikel/' + a.id, d);
          else await API.post('/api/artikel', d);
        } catch (err: any) { alert(err.message); return false; }
        this.render(root);
      },
    });
  },
};

Router.register('teilestamm', (root: HTMLElement) => Teilestamm.render(root));

export { Teilestamm };
