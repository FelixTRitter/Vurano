/**
 * VERTRIEB > Verkaufsartikelstamm
 * ---------------------------------------------------------------
 * Liste der Verkaufsartikel (Teiletyp 'verkaufsartikel' der gemeinsamen
 * Artikeltabelle). Klick auf einen Artikel öffnet die Detailseite mit
 * zweiter Seitennavigation und Reitern im MainContent:
 *   - Artikelinformationen (Stammdaten des Artikels)
 *   - Kalkulation (Platzhalter, kommt später)
 * Anlegen/Bearbeiten über ein Modal.
 */
import { API, fmt, el, Modal, fieldVals } from './ic/helpers.js';
import { Router, Shell } from './ic/router.js';

const TEILETYP = 'verkaufsartikel';

const Verkaufsartikel = {
  _einheiten: [] as any[],
  _sprachen: [] as any[],
  _firmaSprache: 'de',
  _waehrung: 'CHF',

  async ladeHilfsdaten(): Promise<void> {
    const [einheiten, sprachen, firma] = await Promise.all([
      API.get('/api/stammdaten/einheiten'),
      API.get('/api/stammdaten/sprachen'),
      API.get('/api/konfiguration/firma').catch(() => ({})),
    ]);
    this._einheiten = einheiten;
    this._sprachen = sprachen;
    this._firmaSprache = (firma && firma.standard_sprache) || 'de';
    this._waehrung = (firma && firma.waehrung) || 'CHF';
  },

  /* Anzeige-Helfer. NUMERIC kommt aus der Datenbank als Zeichenkette —
     deshalb vor dem Formatieren in eine Zahl wandeln. Leer bleibt leer. */
  geld(n: any): string {
    return (n === null || n === undefined || n === '') ? '–' : fmt.money(Number(n), this._waehrung);
  },
  stunden(n: any): string {
    return (n === null || n === undefined || n === '') ? '–' : fmt.num(Number(n)) + ' h';
  },

  async renderList(root: HTMLElement): Promise<void> {
    Shell.exitDetail();
    const artikel = await API.get('/api/artikel?teiletyp=' + TEILETYP);
    const rows = artikel.length
      ? artikel.map((a: any) => `
          <tr class="clickable" data-id="${a.id}">
            <td><span class="cell-strong">${fmt.esc(a.artikelnummer || '–')}</span></td>
            <td>${fmt.esc(a.bezeichnung)}</td>
            <td>${fmt.esc(a.einheit_kuerzel || '–')}</td>
            <td class="num">${fmt.esc(this.geld(a.verkaufspreis))}</td>
            <td class="row-actions"><button class="act-btn danger" data-del="${a.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="sub" style="color:var(--text-muted)">Noch keine Verkaufsartikel.</td></tr>';

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">Verkaufsartikelstamm</div>
            <div class="page-subtitle">Verkaufsartikel anlegen und pflegen.</div>
          </div>
          <button class="btn" id="art-neu">＋ Verkaufsartikel</button>
        </div>
        <div class="card">
          <div class="tbl-wrap"><table class="data" id="tbl-artikel">
            <colgroup><col style="width:180px"><col><col style="width:100px"><col style="width:140px"><col style="width:70px"></colgroup>
            <thead><tr><th>Artikelnummer</th><th>Bezeichnung</th><th>Einheit</th><th class="num">Verkaufspreis</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
      </div>`);

    view.querySelectorAll('tr.clickable').forEach((tr) =>
      tr.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.row-actions')) return;
        Router.go('verkaufsartikel/' + (tr as HTMLElement).dataset.id);
      }));
    view.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Verkaufsartikel löschen?')) return;
        try { await API.del('/api/artikel/' + (b as HTMLElement).dataset.del); this.renderList(root); }
        catch (err: any) { alert(err.message); }
      }));
    view.querySelector('#art-neu')!.addEventListener('click', () => this.openForm(root, null));

    root.innerHTML = '';
    root.appendChild(view);
  },

  openForm(root: HTMLElement, a: any | null, onSaved?: () => void): void {
    const v = (f: string) => fmt.esc(a?.[f] ?? '');
    const einheitOpts = ['<option value="">– keine –</option>']
      .concat(this._einheiten.map((e: any) => `<option value="${e.id}" ${String(a?.einheit_id) === String(e.id) ? 'selected' : ''}>${fmt.esc(e.kuerzel)}${e.name ? ' – ' + fmt.esc(e.name) : ''}</option>`)).join('');
    const vorgabeSprache = a?.sprache_code || this._firmaSprache;
    const spracheOpts = this._sprachen.map((s: any) => `<option value="${s.code}" ${vorgabeSprache === s.code ? 'selected' : ''}>${fmt.esc(s.name)}</option>`).join('');

    // Texte nur beim ANLEGEN im Modal (Ersttext in der Originalsprache).
    // Beim Bearbeiten werden sie im Detail gepflegt — dort mehrsprachig.
    const textFelder = a ? '' : `
        <div class="field full"><label>Verkaufstext</label><textarea data-field="verkaufstext" rows="9" class="txt-gross" placeholder="Beschreibung für Angebot/Verkauf">${v('verkaufstext')}</textarea></div>
        <div class="field full"><label>LV-Text</label><textarea data-field="lv_text" rows="9" class="txt-gross" placeholder="Text für das Leistungsverzeichnis">${v('lv_text')}</textarea></div>`;

    const body = el(`
      <div class="form-grid">
        <div class="field"><label>Artikelnummer</label><input data-field="artikelnummer" value="${v('artikelnummer')}" placeholder="z. B. VK-1001"></div>
        <div class="field"><label>Einheit</label><select data-field="einheit_id">${einheitOpts}</select></div>
        <div class="field full"><label>Artikelbezeichnung <span class="req">*</span></label><input data-field="bezeichnung" value="${v('bezeichnung')}" placeholder="z. B. Schrank Modell Basel"></div>
        ${textFelder}
        <div class="field"><label>${a ? 'Originalsprache' : 'Sprache'}</label><select data-field="sprache_code">${spracheOpts}</select></div>
        <div class="field"><label>Materialkosten (${fmt.esc(this._waehrung)})</label><input data-field="materialkosten" value="${v('materialkosten')}" inputmode="decimal" placeholder="z. B. 780.00"></div>
        <div class="field"><label>Verkaufspreis (${fmt.esc(this._waehrung)})</label><input data-field="verkaufspreis" value="${v('verkaufspreis')}" inputmode="decimal" placeholder="z. B. 1250.00"></div>

        <div class="form-section">Zeitdauern (Stunden)</div>
        <div class="field"><label>Planungsdauer</label><input data-field="planungsdauer" value="${v('planungsdauer')}" inputmode="decimal" placeholder="z. B. 2.5"></div>
        <div class="field"><label>Produktionsdauer</label><input data-field="produktionsdauer" value="${v('produktionsdauer')}" inputmode="decimal" placeholder="z. B. 8"></div>
        <div class="field"><label>Montagedauer</label><input data-field="montagedauer" value="${v('montagedauer')}" inputmode="decimal" placeholder="z. B. 4"></div>
      </div>`);

    Modal.open(a ? 'Verkaufsartikel bearbeiten' : 'Verkaufsartikel erfassen', body, {
      okLabel: 'Speichern',
      wide: true,
      focusSelector: '[data-field="artikelnummer"]',
      onOk: async () => {
        const d: any = fieldVals(body);
        if (!d.bezeichnung || !d.bezeichnung.trim()) { alert('Artikelbezeichnung ist erforderlich.'); return false; }
        d.teiletyp = TEILETYP;
        try {
          if (a) await API.put('/api/artikel/' + a.id, d);
          else await API.post('/api/artikel', d);
        } catch (err: any) { alert(err.message); return false; }
        if (onSaved) onSaved(); else this.renderList(root);
      },
    });
  },

  async renderDetail(root: HTMLElement, id: string): Promise<void> {
    let a: any;
    try { a = await API.get('/api/artikel/' + id); }
    catch { root.innerHTML = '<div class="card"><div class="empty-state"><h3>Nicht gefunden</h3></div></div>'; return; }

    const spine = el(`<div class="detail-rail">
      <button class="rail-back" id="a-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Verkaufsartikelstamm</button>
      <div class="rail-title">${fmt.esc(a.bezeichnung)}</div>
      <div class="rail-sub">${fmt.esc(a.artikelnummer || 'ohne Artikelnummer')}</div>
    </div>`);
    Shell.enterDetail(spine);
    spine.querySelector('#a-back')!.addEventListener('click', () => Router.go('verkaufsartikel'));

    const info = (label: string, value: any) =>
      `<div class="kv"><span class="kv-label">${label}</span><span class="kv-value">${value || '–'}</span></div>`;

    // Reiter: Artikelinformationen + Kalkulation + je einer für die drei
    // Phasen. Die drei Phasen-Reiter sind vorerst leer — dort entstehen später
    // die Werte, aus denen sich die jeweiligen Dauern ergeben.
    const REITER: Array<[string, string]> = [
      ['info', 'Artikelinformationen'],
      ['kalk', 'Kalkulation'],
      ['planung', 'Planung'],
      ['produktion', 'Produktion'],
      ['montage', 'Montage'],
    ];
    const platzhalter = (titel: string, text: string) =>
      `<div class="empty-state"><h3>${titel}</h3><p>${text}</p></div>`;

    const wrap = el(`
      <div>
        <div class="page-header"><div>
          <div class="page-title">${fmt.esc(a.bezeichnung)}</div>
          <div class="page-subtitle">Verkaufsartikel</div>
        </div><button class="btn" id="art-edit">Bearbeiten</button></div>
        <div class="tabs" id="art-tabs">
          ${REITER.map(([k, l], i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
        </div>

        <div id="art-tab-info">
          <div class="card">
            <div class="detail-kv">
              ${info('Artikelnummer', fmt.esc(a.artikelnummer || ''))}
              ${info('Bezeichnung', fmt.esc(a.bezeichnung))}
              ${info('Einheit', fmt.esc(a.einheit_kuerzel || ''))}
              ${info('Materialkosten', fmt.esc(this.geld(a.materialkosten)))}
              ${info('Verkaufspreis', fmt.esc(this.geld(a.verkaufspreis)))}
              ${info('Originalsprache', fmt.esc(a.sprache_name || a.sprache_code || ''))}
              ${info('Planungsdauer', fmt.esc(this.stunden(a.planungsdauer)))}
              ${info('Produktionsdauer', fmt.esc(this.stunden(a.produktionsdauer)))}
              ${info('Montagedauer', fmt.esc(this.stunden(a.montagedauer)))}
            </div>
          </div>
          <div class="card" id="karte-texte"></div>
        </div>

        <div id="art-tab-kalk" class="card" hidden>${platzhalter('Kalkulation', 'Kommt später — hier entsteht die Kalkulation, aus der auch der Verkaufspreis stammt.')}</div>
        <div id="art-tab-planung" class="card" hidden>${platzhalter('Planung', 'Kommt später — hier entstehen die Angaben, aus denen sich die Planungsdauer ergibt.')}</div>
        <div id="art-tab-produktion" class="card" hidden>${platzhalter('Produktion', 'Kommt später — hier entstehen die Angaben, aus denen sich die Produktionsdauer ergibt.')}</div>
        <div id="art-tab-montage" class="card" hidden>${platzhalter('Montage', 'Kommt später — hier entstehen die Angaben, aus denen sich die Montagedauer ergibt.')}</div>
      </div>`);

    wrap.querySelectorAll('#art-tabs .tab').forEach((t) =>
      t.addEventListener('click', () => {
        const ziel = (t as HTMLElement).dataset.tab;
        wrap.querySelectorAll('#art-tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
        for (const [k] of REITER) {
          (wrap.querySelector('#art-tab-' + k) as HTMLElement).hidden = k !== ziel;
        }
      }));
    wrap.querySelector('#art-edit')!.addEventListener('click', () =>
      this.openForm(root, a, () => this.renderDetail(root, id)));

    root.innerHTML = '';
    root.appendChild(wrap);
    this.bindTexte(wrap.querySelector('#karte-texte') as HTMLElement, a);
  },

  /**
   * Text-Container: Verkaufstext und LV-Text nebeneinander, je Sprache.
   * Vorausgewählt ist die Originalsprache des Artikels. Für andere Sprachen
   * kann ein Übersetzungsentwurf per Klick erzeugt werden; er wird NICHT
   * automatisch gespeichert — erst prüfen/korrigieren, dann speichern.
   * Bereits gespeicherte Übersetzungen werden geladen (kein erneuter KI-Aufruf).
   */
  bindTexte(karte: HTMLElement, a: any): void {
    // Texte je Sprachcode in eine Karte legen (auch ungespeicherte Entwürfe)
    const texte = new Map<string, any>();
    for (const t of (a.texte || [])) texte.set(t.sprache_code, { ...t });

    const spracheOpts = this._sprachen.map((s: any) => {
      const vorhanden = texte.get(s.code);
      const marke = s.code === a.sprache_code ? ' (Original)'
        : vorhanden ? (vorhanden.quelle === 'ki' ? ' • KI-Entwurf' : ' •') : '';
      return `<option value="${s.code}" ${s.code === a.sprache_code ? 'selected' : ''}>${fmt.esc(s.name)}${marke}</option>`;
    }).join('');

    karte.innerHTML = `
      <div class="texte-kopf">
        <div>
          <h3 class="card-title">Texte</h3>
          <p class="sub" style="color:var(--text-muted);margin:0">Originalsprache: ${fmt.esc(a.sprache_name || a.sprache_code || '–')}. Andere Sprachen können übersetzt und nachbearbeitet werden.</p>
        </div>
        <div class="texte-aktionen">
          <select id="txt-sprache">${spracheOpts}</select>
          <button class="btn btn-sm" id="txt-uebersetzen">Übersetzen</button>
          <button class="btn btn-primary btn-sm" id="txt-speichern">Speichern</button>
        </div>
      </div>
      <div id="txt-hinweis" class="txt-hinweis" hidden></div>
      <div class="texte-grid">
        <div class="field"><label>Verkaufstext</label><textarea id="txt-verkauf" class="txt-gross txt-detail"></textarea></div>
        <div class="field"><label>LV-Text</label><textarea id="txt-lv" class="txt-gross txt-detail"></textarea></div>
      </div>`;

    const sel = karte.querySelector('#txt-sprache') as HTMLSelectElement;
    const tVerkauf = karte.querySelector('#txt-verkauf') as HTMLTextAreaElement;
    const tLv = karte.querySelector('#txt-lv') as HTMLTextAreaElement;
    const btnUeb = karte.querySelector('#txt-uebersetzen') as HTMLButtonElement;
    const btnSave = karte.querySelector('#txt-speichern') as HTMLButtonElement;
    const hinweis = karte.querySelector('#txt-hinweis') as HTMLElement;

    const zeigeHinweis = (text: string, art: 'info' | 'warn' | 'fehler' = 'info') => {
      hinweis.textContent = text;
      hinweis.className = 'txt-hinweis ' + art;
      hinweis.hidden = !text;
    };

    const laden = () => {
      const code = sel.value;
      const t = texte.get(code);
      tVerkauf.value = t?.verkaufstext ?? '';
      tLv.value = t?.lv_text ?? '';
      const istOriginal = code === a.sprache_code;
      btnUeb.hidden = istOriginal;   // die Originalsprache übersetzt man nicht
      if (istOriginal) zeigeHinweis('');
      else if (t?.quelle === 'ki') zeigeHinweis('KI-Entwurf — bitte prüfen und speichern.', 'warn');
      else if (t) zeigeHinweis('');
      else zeigeHinweis('Für diese Sprache liegt noch kein Text vor. „Übersetzen" erzeugt einen Entwurf.', 'info');
    };
    sel.addEventListener('change', laden);
    laden();

    btnUeb.addEventListener('click', async () => {
      const ziel = sel.value;
      btnUeb.disabled = true;
      const alt = btnUeb.textContent;
      btnUeb.textContent = 'Übersetzt …';
      try {
        const e = await API.post('/api/artikel/' + a.id + '/uebersetzen', { ziel_sprache: ziel });
        tVerkauf.value = e.verkaufstext ?? '';
        tLv.value = e.lv_text ?? '';
        texte.set(ziel, { sprache_code: ziel, verkaufstext: e.verkaufstext, lv_text: e.lv_text, quelle: 'ki' });
        zeigeHinweis('KI-Entwurf erzeugt — bitte prüfen und speichern. Gespeichert wird erst mit „Speichern".', 'warn');
      } catch (err: any) {
        zeigeHinweis(err.message || 'Übersetzung fehlgeschlagen.', 'fehler');
      } finally {
        btnUeb.disabled = false;
        btnUeb.textContent = alt;
      }
    });

    btnSave.addEventListener('click', async () => {
      const code = sel.value;
      btnSave.disabled = true;
      try {
        const r = await API.put('/api/artikel/' + a.id + '/text/' + code,
          { verkaufstext: tVerkauf.value, lv_text: tLv.value });
        texte.set(code, { sprache_code: code, verkaufstext: tVerkauf.value, lv_text: tLv.value, quelle: r.quelle });
        // Sprachauswahl neu beschriften (Marker „KI-Entwurf" verschwindet)
        [...sel.options].forEach((o) => {
          if (o.value !== code) return;
          const name = this._sprachen.find((s: any) => s.code === code)?.name ?? code;
          o.textContent = name + (code === a.sprache_code ? ' (Original)' : ' •');
        });
        zeigeHinweis('Gespeichert.', 'info');
      } catch (err: any) {
        zeigeHinweis(err.message || 'Speichern fehlgeschlagen.', 'fehler');
      } finally {
        btnSave.disabled = false;
      }
    });
  },
};

Router.register('verkaufsartikel', async (root: HTMLElement, param?: string) => {
  await Verkaufsartikel.ladeHilfsdaten();
  if (param) return Verkaufsartikel.renderDetail(root, param);
  return Verkaufsartikel.renderList(root);
});

export { Verkaufsartikel };
