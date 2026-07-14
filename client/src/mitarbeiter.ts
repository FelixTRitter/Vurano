/**
 * Modul Mitarbeiter (Mitarbeiterverwaltung).
 * Liste: zwei gleichzeitig sichtbare, intern scrollbare Tabellen (aktiv /
 * ausgetreten). Erfassung/Bearbeitung im scrollbaren Modal. Detail nach
 * Klick: Hauptnavigation klappt ein, Grunddaten in der zweiten Seitenleiste
 * (Shell.enterDetail), alle Daten bearbeitbar im MainContent.
 */
import { API, fmt, el, Modal, fieldVals, Sorter, bindAdressSuche } from './ic/helpers.js';
import { Router, Shell } from './ic/router.js';

/* Länder mit ISO-Code; deutscher Anzeigename über Intl abgeleitet */
const LAND_CODES = ['CH','DE','AT','FR','IT','LI','ES','PT','NL','BE','LU','DK','SE','NO','FI','IS','IE','GB','PL','CZ','SK','HU','SI','HR','BA','RS','ME','MK','AL','GR','BG','RO','MD','UA','BY','RU','EE','LV','LT','MT','CY','TR','MC','AD','SM','US','CA','AU','NZ','CN','JP','KR','IN','IL','AE','SA','QA','KW','OM','JO','LB','IQ','IR','SY','YE','EG','MA','DZ','TN','LY'];
const landName = (() => {
  const dn = new Intl.DisplayNames(['de'], { type: 'region' });
  return (code: string) => { try { return dn.of(code) ?? code; } catch { return code; } };
})();
function landOptions(selectedCode?: string | null): string {
  const sel = selectedCode || 'CH';
  const list = LAND_CODES.includes(sel) ? [...LAND_CODES] : [sel, ...LAND_CODES];
  return list
    .map((c) => ({ c, n: landName(c) }))
    .sort((a, b) => a.n.localeCompare(b.n, 'de'))
    .map(({ c, n }) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${fmt.esc(n)} (${c})</option>`)
    .join('');
}

const ZIVILSTAND = ['ledig', 'verheiratet', 'eingetragene Partnerschaft', 'geschieden', 'verwitwet'];

const Mitarbeiter: any = {
  funktionen: [] as any[],
  qualifikationen: [] as any[],
  modelle: [] as any[],
  firma: null as any,

  async loadStammdaten(): Promise<void> {
    [this.funktionen, this.qualifikationen, this.modelle, this.firma] = await Promise.all([
      API.get('/api/stammdaten/funktionen'),
      API.get('/api/stammdaten/qualifikationen'),
      API.get('/api/konfiguration/arbeitszeitmodelle'),
      API.get('/api/konfiguration/firma'),
    ]);
  },

  /**
   * Länderabhängige Texte. Maßgeblich ist das VERSICHERUNGSLAND des
   * Arbeitsverhältnisses (Erwerbsortprinzip) — nicht Wohnort, nicht
   * Firmensitz. Der Grenzgänger mit Wohnort DE und Arbeitsort CH hat
   * eine AHV-Nummer. Default: Land des Unternehmens.
   */
  svLabel(land: string): string {
    return land === 'CH' ? 'AHV-Nummer' : 'Sozialversicherungsnummer';
  },
  svPlaceholder(land: string): string {
    return land === 'CH' ? '756.XXXX.XXXX.XX' : '12 123456 A 123';
  },
  religionen(land: string): string[] {
    return land === 'CH'
      ? ['konfessionslos', 'evangelisch-reformiert', 'römisch-katholisch', 'christkatholisch', 'israelitisch', 'andere']
      : ['konfessionslos', 'evangelisch', 'römisch-katholisch', 'alt-katholisch', 'israelitisch', 'andere'];
  },
  bewilligungen(land: string): string[] {
    return land === 'CH'
      ? ['', 'B', 'C', 'G', 'L', 'F', 'N']
      : ['', 'keiner erforderlich (EU/EWR/CH)', 'Aufenthaltserlaubnis', 'Blaue Karte EU', 'Niederlassungserlaubnis', 'Daueraufenthalt-EU', 'Visum'];
  },

  name(m: any): string {
    return [m.vorname, m.nachname].filter(Boolean).join(' ');
  },

  /* ------------------------------ Liste ------------------------------ */
  async renderList(root: HTMLElement): Promise<void> {
    // Detailziel #mitarbeiter/<id>
    const parts = location.hash.slice(1).split('/');
    if (parts[0] === 'mitarbeiter' && parts[1]) return this.renderDetail(root, parts[1]);

    const data = await API.get('/api/mitarbeiter');
    const aktive = data.filter((m: any) => m.aktiv);
    const inaktive = data.filter((m: any) => !m.aktiv);

    const rows = (list: any[]) => list.map((m: any) => `
      <tr class="clickable" data-id="${m.id}">
        <td>${fmt.esc(m.anrede || '–')}</td>
        <td data-val="${fmt.esc(m.vorname || '')}">${fmt.esc(m.vorname || '–')}</td>
        <td data-val="${fmt.esc(m.nachname || '')}"><span class="cell-strong">${fmt.esc(m.nachname || '–')}</span></td>
        <td data-val="${fmt.esc(m.funktion_name || '')}">${m.funktion_name ? `<span class="badge">${fmt.esc(m.funktion_name)}</span>` : '–'}</td>
        <td data-val="${fmt.esc(m.eintritt || '')}">${fmt.date(m.eintritt)}</td>
      </tr>`).join('');

    const table = (id: string, list: any[], leer: string) => list.length === 0
      ? `<div class="card"><div class="empty-state"><p>${leer}</p></div></div>`
      : `<div class="tbl-wrap tbl-scroll"><table class="data" id="${id}">
          <thead><tr>
            <th data-sort="anrede">Anrede</th><th data-sort="vorname">Vorname</th>
            <th data-sort="nachname">Nachname</th><th data-sort="funktion">Funktion</th>
            <th data-sort="eintritt">Eintritt</th>
          </tr></thead>
          <tbody>${rows(list)}</tbody>
        </table></div>`;

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">Mitarbeiter</div>
            <div class="page-subtitle">${aktive.length} aktiv, ${inaktive.length} ausgetreten</div>
          </div>
          <button class="btn btn-primary" id="btn-neu">＋ Neuer Mitarbeiter</button>
        </div>
        <div class="split-tables">
          <div class="tbl-card">
            <h2>Aktive Mitarbeiter</h2>
            ${table('tbl-ma-aktiv', aktive, 'Noch keine Mitarbeiter erfasst.')}
          </div>
          <div class="tbl-card tbl-card-small">
            <h2>Ausgetretene Mitarbeiter</h2>
            ${table('tbl-ma-inaktiv', inaktive, 'Keine ausgetretenen Mitarbeiter.')}
          </div>
        </div>
      </div>`);

    view.querySelector('#btn-neu')!.addEventListener('click', () => this.openForm(null));
    view.querySelectorAll('tr.clickable').forEach((tr: any) =>
      tr.addEventListener('click', () => Router.navigate('#mitarbeiter/' + tr.dataset.id)));

    root.innerHTML = '';
    root.appendChild(view);
    Sorter.init(view.querySelector('#tbl-ma-aktiv'), { sortBy: 'nachname' });
    Sorter.init(view.querySelector('#tbl-ma-inaktiv'));
  },

  /* ------------------------- Formular (Modal) ------------------------- */
  async openForm(id: number | string | null, onSaved?: (id: any) => void): Promise<void> {
    // Stammdaten und Datensatz parallel laden (Latenz addiert sich sonst)
    const [, m]: [void, any] = await Promise.all([
      this.loadStammdaten(),
      id ? API.get('/api/mitarbeiter/' + id) : Promise.resolve({}),
    ]);
    const v = (key: string) => fmt.esc(m[key] ?? '');
    const opts = (list: any[], selId: any, leerHinweis: string) =>
      list.length === 0
        ? `<option value="">– ${leerHinweis} –</option>`
        : ['<option value="">–</option>']
            .concat(list.map((r: any) => `<option value="${r.id}" ${String(selId) === String(r.id) ? 'selected' : ''}>${fmt.esc(r.name)}</option>`))
            .join('');
    const anredeOpts = ['<option value="">–</option>']
      .concat(['Herr', 'Frau'].map((a) => `<option ${m.anrede === a ? 'selected' : ''}>${a}</option>`)).join('');
    const zivilOpts = ['<option value="">–</option>']
      .concat(ZIVILSTAND.map((z) => `<option ${m.zivilstand === z ? 'selected' : ''}>${z}</option>`)).join('');
    const svLand: string = m.sv_land || this.firma?.land || 'DE';
    const auswahl = (werte: string[], aktuell: any, leer = '–') => {
      const liste = aktuell && !werte.includes(aktuell) ? [aktuell, ...werte] : werte;
      return liste.map((w) => `<option value="${fmt.esc(w)}" ${aktuell === w ? 'selected' : ''}>${fmt.esc(w) || leer}</option>`).join('');
    };

    const body = el(`
      <div>
        <div class="form-grid">
          <div class="form-section">Personalien</div>
          <div class="field"><label>Anrede</label><select data-field="anrede">${anredeOpts}</select></div>
          <div class="field" aria-hidden="true"></div>
          <div class="field"><label>Vorname</label><input data-field="vorname" value="${v('vorname')}"></div>
          <div class="field"><label>Nachname <span class="req">*</span></label><input data-field="nachname" value="${v('nachname')}"></div>

          <div class="form-section">Private Anschrift &amp; Kontakt</div>
          <div class="field full"><label>Strasse &amp; Hausnummer</label><input data-field="strasse" value="${v('strasse')}"></div>
          <div class="field"><label>PLZ</label><input data-field="plz" value="${v('plz')}"></div>
          <div class="field"><label>Ort</label><input data-field="ort" value="${v('ort')}"></div>
          <div class="field"><label>Land (mit Ländercode)</label><select data-field="land_code" id="mf-land">${landOptions(m.land_code)}</select></div>
          <div class="field"><label>Telefonnr.</label><input data-field="telefon" value="${v('telefon')}"></div>
          <div class="field"><label>Mobilnr.</label><input data-field="mobil" value="${v('mobil')}"></div>
          <div class="field"><label>E-Mailadresse</label><input data-field="email" type="email" value="${v('email')}"></div>

          <div class="form-section">Firmenkontakt &amp; Anstellung</div>
          <div class="field"><label>Telefonnr. (Firma)</label><input data-field="firma_telefon" value="${v('firma_telefon')}"></div>
          <div class="field"><label>E-Mailadresse (Firma)</label><input data-field="firma_email" type="email" value="${v('firma_email')}"></div>
          <div class="field"><label>Funktion</label><select data-field="funktion_id">${opts(this.funktionen, m.funktion_id, 'in Stammdaten → Qualifikation / Funktionen anlegen')}</select></div>
          <div class="field full"><label>Qualifikationen</label>
            <div class="qual-auswahl">${this.qualifikationen.length
              ? this.qualifikationen.map((q: any) => {
                  const gesetzt = (m.qualifikationen || []).some((x: any) => Number(x.id) === Number(q.id));
                  return `<label class="qual-chip"><input type="checkbox" data-qual="${q.id}" ${gesetzt ? 'checked' : ''}> ${fmt.esc(q.name)}</label>`;
                }).join('')
              : '<span class="sub" style="color:var(--text-muted)">Noch keine Qualifikationen — in Stammdaten anlegen.</span>'}</div>
          </div>
          <div class="field"><label>Eintrittsdatum</label><input data-field="eintritt" type="date" value="${v('eintritt')}"></div>
          <div class="field"><label>Arbeitszeitmodell</label><select data-field="arbeitszeitmodell_id">${opts(this.modelle, m.arbeitszeitmodell_id, 'in Konfiguration → Arbeitszeitmodelle anlegen')}</select></div>
          <div class="field"><label class="chk" style="margin-top:22px"><input type="checkbox" id="mf-austritt-toggle" ${m.austritt ? 'checked' : ''}> Ausgetreten</label></div>
          <div class="field" id="mf-austritt-feld" ${m.austritt ? '' : 'hidden'}><label>Austrittsdatum <span class="req">*</span></label><input data-field="austritt" type="date" value="${v('austritt')}"></div>

          <div class="form-section">Lohn- &amp; steuerrelevante Angaben</div>
          <div class="field"><label>Versicherungsland <span class="hinweis">(Land des Arbeitsverhältnisses)</span></label>
            <select data-field="sv_land" id="mf-sv-land">
              <option value="DE" ${svLand === 'DE' ? 'selected' : ''}>Deutschland</option>
              <option value="CH" ${svLand === 'CH' ? 'selected' : ''}>Schweiz</option>
            </select>
          </div>
          <div class="field"><label>Geburtsdatum</label><input data-field="geburtsdatum" type="date" value="${v('geburtsdatum')}"></div>
          <div class="field"><label id="mf-sv-label">${this.svLabel(svLand)}</label><input data-field="ahv_nummer" id="mf-sv-nummer" value="${v('ahv_nummer')}" placeholder="${this.svPlaceholder(svLand)}"></div>
          <div class="field"><label>Zivilstand</label><select data-field="zivilstand">${zivilOpts}</select></div>
          <div class="field"><label>Staatsangehörigkeit</label><input data-field="staatsangehoerigkeit" value="${v('staatsangehoerigkeit')}"></div>
          <div class="field"><label id="mf-bew-label">Aufenthaltsbewilligung</label><select data-field="aufenthaltsbewilligung" id="mf-bewilligung">${auswahl(this.bewilligungen(svLand), m.aufenthaltsbewilligung ?? '')}</select></div>
          <div class="field sv-ch" ${svLand === 'CH' ? '' : 'hidden'}>
            <label class="chk"><input type="checkbox" data-field="quellensteuer" ${m.quellensteuer ? 'checked' : ''}> Quellensteuerpflichtig</label>
            <span class="hinweis">Ausländische Mitarbeitende ohne Niederlassungsbewilligung C sowie Grenzgänger.</span>
          </div>
          <div class="field sv-de" ${svLand === 'DE' ? '' : 'hidden'}><label>Steuerliche Identifikationsnummer</label><input data-field="steuer_id" value="${v('steuer_id')}" placeholder="11-stellig, für ELStAM"></div>
          <div class="field sv-de" ${svLand === 'DE' ? '' : 'hidden'}><label>Steuerklasse</label><select data-field="steuerklasse">${auswahl(['', 'I', 'II', 'III', 'IV', 'V', 'VI'], m.steuerklasse ?? '')}</select></div>
          <div class="field"><label>Religion / Konfession <span class="hinweis">(Kirchensteuermerkmal)</span></label><select data-field="religion" id="mf-religion">${auswahl(['', ...this.religionen(svLand)], m.religion ?? '')}</select></div>
          <div class="field"><label>Anzahl Kinder</label><input data-field="kinder" type="number" min="0" step="1" value="${v('kinder')}"></div>
          <div class="field"><label>IBAN (Lohnzahlung)</label><input data-field="iban" value="${v('iban')}"></div>
          <div class="field"><label>Kontoinhaber <span class="hinweis">(falls abweichend)</span></label><input data-field="kontoinhaber" value="${v('kontoinhaber')}"></div>
          <div class="field full"><label>Notizen</label><textarea data-field="notizen">${v('notizen')}</textarea></div>

          <div class="form-section">Unterlagen (Personalakte)</div>
          <div class="field full">
            <div class="dropzone" id="mf-dropzone">
              Dateien hierher ziehen oder <label class="dropzone-link">auswählen<input type="file" id="mf-dateien" multiple hidden></label>
            </div>
            <div id="mf-datei-liste" class="datei-pending-liste"></div>
            <span class="hinweis">Die Dateien werden beim Speichern in der Personalakte abgelegt (Ordner „Allgemein"; verschieben/umbenennen in der Detailansicht).</span>
          </div>
        </div>
      </div>`);

    // Ausgewählte/gezogene Dateien bis zum Speichern sammeln
    const pendingDateien: File[] = [];
    const dz = body.querySelector('#mf-dropzone') as HTMLElement;
    const dateiListe = body.querySelector('#mf-datei-liste') as HTMLElement;
    const zeigePending = () => {
      dateiListe.innerHTML = pendingDateien
        .map((f, i) => `<span class="datei-chip">${fmt.esc(f.name)} <button type="button" data-weg="${i}" title="Entfernen">×</button></span>`)
        .join('');
      dateiListe.querySelectorAll('[data-weg]').forEach((b: any) =>
        b.addEventListener('click', () => { pendingDateien.splice(Number(b.dataset.weg), 1); zeigePending(); }));
    };
    const aufnehmen = (liste: FileList | null) => {
      for (const f of Array.from(liste ?? [])) pendingDateien.push(f);
      zeigePending();
    };
    (body.querySelector('#mf-dateien') as HTMLInputElement).addEventListener('change', (e) =>
      aufnehmen((e.target as HTMLInputElement).files));
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('drag');
      aufnehmen((e as DragEvent).dataTransfer?.files ?? null);
    });

    // Adress-Autovervollständigung am Strassenfeld (wie in der Adressverwaltung).
    // Füllt Strasse/PLZ/Ort und das Land (hier als Ländercode geführt).
    bindAdressSuche(body);

    // Versicherungsland umschalten: Labels, Blöcke und Auswahllisten folgen live
    const svSelect = body.querySelector('#mf-sv-land') as HTMLSelectElement;
    svSelect.addEventListener('change', () => {
      const land = svSelect.value;
      (body.querySelector('#mf-sv-label') as HTMLElement).textContent = this.svLabel(land);
      (body.querySelector('#mf-sv-nummer') as HTMLInputElement).placeholder = this.svPlaceholder(land);
      body.querySelectorAll('.sv-ch').forEach((n: any) => (n.hidden = land !== 'CH'));
      body.querySelectorAll('.sv-de').forEach((n: any) => (n.hidden = land !== 'DE'));
      (body.querySelector('#mf-bewilligung') as HTMLSelectElement).innerHTML =
        this.bewilligungen(land).map((b: string) => `<option value="${fmt.esc(b)}">${fmt.esc(b) || '–'}</option>`).join('');
      (body.querySelector('#mf-religion') as HTMLSelectElement).innerHTML =
        ['', ...this.religionen(land)].map((r: string) => `<option value="${fmt.esc(r)}">${fmt.esc(r) || '–'}</option>`).join('');
    });

    // Austritt-Toggle: an -> Datum Pflicht; aus -> Datum löschen, Mitarbeiter aktiv
    const toggle = body.querySelector('#mf-austritt-toggle') as HTMLInputElement;
    const austrittFeld = body.querySelector('#mf-austritt-feld') as HTMLElement;
    const austrittInput = body.querySelector('[data-field="austritt"]') as HTMLInputElement;
    toggle.addEventListener('change', () => {
      austrittFeld.hidden = !toggle.checked;
      if (!toggle.checked) austrittInput.value = '';
    });

    Modal.open(id ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter erfassen', body, {
      focusSelector: '[data-field="anrede"]',
      onOk: async () => {
        const d: any = fieldVals(body);
        if (toggle.checked && !d.austritt) { alert('Bitte Austrittsdatum angeben (oder "Ausgetreten" deaktivieren).'); return false; }
        if (!toggle.checked) d.austritt = null;
        const landSel = body.querySelector('#mf-land') as HTMLSelectElement;
        d.land = landSel.selectedOptions[0]?.textContent?.replace(/\s*\([A-Z]{2}\)\s*$/, '') ?? null;
        if (!d.nachname) { alert('Nachname ist erforderlich.'); return false; }
        // Qualifikationen (Mehrfachauswahl) als ID-Liste mitgeben
        d.qualifikation_ids = [...body.querySelectorAll('[data-qual]:checked')].map((c) => Number((c as HTMLElement).dataset.qual));
        let savedId: any = id;
        try {
          if (id) await API.put('/api/mitarbeiter/' + id, d);
          else { const resp = await API.post('/api/mitarbeiter', d); savedId = resp && resp.id; }
          if (pendingDateien.length > 0) {
            const fd = new FormData();
            for (const f of pendingDateien) fd.append('dateien', f);
            await API.upload('/api/mitarbeiter/' + savedId + '/dokumente', fd);
          }
        } catch (e: any) { alert(e.message); return false; }
        if (onSaved) { onSaved(savedId); return false; }
        Router.navigate(id ? '#mitarbeiter/' + id : '#mitarbeiter');
      },
    });
  },

  /* ------------------- Detail (zweite Seitenleiste) ------------------- */
  async renderDetail(root: HTMLElement, id: number | string): Promise<void> {
    const [m]: any[] = await Promise.all([
      API.get('/api/mitarbeiter/' + id),
      this.firma ? Promise.resolve() : this.loadStammdaten(),
    ]);

    // Grunddaten links: was die Tabelle als Spalten zeigt
    const rail = el(`
      <div class="rail-basics">
        <button class="rail-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Mitarbeiter
        </button>
        <div class="rail-name">${fmt.esc(this.name(m) || '–')}</div>
        <div class="rail-sub">${fmt.esc(m.anrede || '')}</div>
        <div class="kv"><span class="kv-label">Funktion</span><span class="kv-value">${fmt.esc(m.funktion_name || '–')}</span></div>
        ${(m.qualifikationen && m.qualifikationen.length) ? `<div class="kv"><span class="kv-label">Qualifikationen</span><span class="kv-value" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${m.qualifikationen.map((q: any) => `<span class="badge">${fmt.esc(q.name)}</span>`).join('')}</span></div>` : ''}
        <div class="kv"><span class="kv-label">Eintritt</span><span class="kv-value">${fmt.date(m.eintritt)}</span></div>
        <div class="kv"><span class="kv-label">Status</span><span class="kv-value">${m.aktiv ? 'Aktiv' : 'Ausgetreten' + (m.austritt ? ' per ' + fmt.date(m.austritt) : '')}</span></div>
      </div>`);
    rail.querySelector('.rail-back')!.addEventListener('click', () => Router.navigate('#mitarbeiter'));
    Shell.enterDetail(rail);

    const kv = (label: string, value: any) =>
      `<div class="kv"><span class="kv-label">${label}</span><span class="kv-value">${value || '–'}</span></div>`;
    const adresse = [m.strasse, [m.plz, m.ort].filter(Boolean).join(' '),
      m.land ? `${fmt.esc(m.land)}${m.land_code ? ' (' + fmt.esc(m.land_code) + ')' : ''}` : '']
      .filter(Boolean).join('<br>');

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">${fmt.esc(this.name(m) || 'Mitarbeiter')}</div>
            <div class="page-subtitle">${m.aktiv ? 'Aktiver Mitarbeiter' : 'Ausgetreten'}</div>
          </div>
          <button class="btn btn-primary" id="btn-bearbeiten">Bearbeiten</button>
        </div>
        <div class="card">
          <h2 style="font-size:14px;margin:0 0 10px">Personalien &amp; private Kontaktdaten</h2>
          <div class="detail-kv">
            ${kv('Anrede', fmt.esc(m.anrede || ''))}
            ${kv('Vorname', fmt.esc(m.vorname || ''))}
            ${kv('Nachname', fmt.esc(m.nachname || ''))}
            ${kv('Private Anschrift', adresse)}
            ${kv('Telefonnr.', fmt.esc(m.telefon || ''))}
            ${kv('Mobilnr.', fmt.esc(m.mobil || ''))}
            ${kv('E-Mailadresse', m.email ? `<a href="mailto:${fmt.esc(m.email)}">${fmt.esc(m.email)}</a>` : '')}
          </div>
        </div>
        <div class="card">
          <h2 style="font-size:14px;margin:0 0 10px">Firmenkontakt &amp; Anstellung</h2>
          <div class="detail-kv">
            ${kv('Telefonnr. (Firma)', fmt.esc(m.firma_telefon || ''))}
            ${kv('E-Mailadresse (Firma)', m.firma_email ? `<a href="mailto:${fmt.esc(m.firma_email)}">${fmt.esc(m.firma_email)}</a>` : '')}
            ${kv('Funktion', fmt.esc(m.funktion_name || ''))}
            ${kv('Arbeitszeitmodell', fmt.esc(m.arbeitszeitmodell_name || ''))}
            ${kv('Eintrittsdatum', fmt.date(m.eintritt))}
            ${kv('Austrittsdatum', fmt.date(m.austritt))}
          </div>
        </div>
        <div class="card">
          <h2 style="font-size:14px;margin:0 0 10px">Lohn- &amp; steuerrelevante Angaben</h2>
          <div class="detail-kv">
            ${kv('Versicherungsland', m.sv_land === 'CH' ? 'Schweiz' : m.sv_land === 'DE' ? 'Deutschland' : '')}
            ${kv('Geburtsdatum', fmt.date(m.geburtsdatum))}
            ${kv(this.svLabel(m.sv_land || this.firma?.land || 'DE'), fmt.esc(m.ahv_nummer || ''))}
            ${kv('Zivilstand', fmt.esc(m.zivilstand || ''))}
            ${kv('Staatsangehörigkeit', fmt.esc(m.staatsangehoerigkeit || ''))}
            ${kv('Aufenthaltsbewilligung', fmt.esc(m.aufenthaltsbewilligung || ''))}
            ${(m.sv_land || this.firma?.land) === 'CH' ? kv('Quellensteuerpflichtig', m.quellensteuer ? 'Ja' : 'Nein') : ''}
            ${(m.sv_land || this.firma?.land) === 'DE' ? kv('Steuerliche Identifikationsnummer', fmt.esc(m.steuer_id || '')) + kv('Steuerklasse', fmt.esc(m.steuerklasse || '')) : ''}
            ${kv('Religion / Konfession', fmt.esc(m.religion || ''))}
            ${kv('Anzahl Kinder', m.kinder ?? '')}
            ${kv('IBAN', fmt.esc(m.iban || ''))}
            ${kv('Kontoinhaber', fmt.esc(m.kontoinhaber || ''))}
            ${kv('Notizen', m.notizen ? fmt.esc(m.notizen).replace(/\n/g, '<br>') : '')}
          </div>
        </div>
      </div>`);
    view.querySelector('#btn-bearbeiten')!.addEventListener('click', () =>
      this.openForm(id, () => { Modal.close(); this.renderDetail(root, id); }));

    // Personalakte: Dokumente ganz unten
    view.appendChild(await this.dokumenteCard(id, () => this.renderDetail(root, id)));

    root.innerHTML = '';
    root.appendChild(view);
  },

  /* ------------------- Personalakte (Dokumente) ------------------- */
  async dokumenteCard(maId: number | string, refresh: () => void): Promise<HTMLElement> {
    const doks: any[] = await API.get(`/api/mitarbeiter/${maId}/dokumente`);
    const ordnerListe = [...new Set(doks.map((d) => d.ordner))].sort((a, b) => a.localeCompare(b, 'de'));

    const zeile = (d: any) => `
      <div class="dok-zeile" data-id="${d.id}">
        <a href="/api/mitarbeiter/dokumente/${d.id}/download" class="dok-name" title="Herunterladen">${fmt.esc(d.dateiname)}</a>
        ${d.loeschantrag ? '<span class="badge dok-antrag" title="Der Mitarbeiter hat die Löschung beantragt — Aufbewahrungsfristen prüfen!">Löschung beantragt</span>' : ''}
        <span class="dok-groesse">${fmt.size ? fmt.size(d.groesse) : d.groesse + ' B'}</span>
        <button class="act-btn" data-umbenennen title="Umbenennen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
        <button class="act-btn" data-verschieben title="In Ordner verschieben"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
        <button class="act-btn danger" data-loeschen title="Endgültig löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
      </div>`;

    const gruppen = ordnerListe.map((o) => `
      <div class="dok-ordner">
        <div class="dok-ordner-titel">📁 ${fmt.esc(o)}</div>
        ${doks.filter((d) => d.ordner === o).map(zeile).join('')}
      </div>`).join('');

    const card = el(`
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="font-size:14px;margin:0">Unterlagen (Personalakte)</h2>
          <label class="btn btn-sm" style="cursor:pointer">＋ Dateien hochladen<input type="file" multiple hidden id="dok-upload"></label>
        </div>
        ${doks.length ? gruppen : '<p style="color:var(--text-muted);font-size:13px">Noch keine Unterlagen abgelegt — Dateien hierher ziehen oder hochladen.</p>'}
      </div>`);

    // Upload (Auswahl + Drag&Drop direkt auf die Karte)
    const hochladen = async (liste: FileList | null) => {
      if (!liste || liste.length === 0) return;
      const fd = new FormData();
      for (const f of Array.from(liste)) fd.append('dateien', f);
      try { await API.upload(`/api/mitarbeiter/${maId}/dokumente`, fd); refresh(); }
      catch (e: any) { alert(e.message); }
    };
    (card.querySelector('#dok-upload') as HTMLInputElement).addEventListener('change', (e) =>
      hochladen((e.target as HTMLInputElement).files));
    card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag'));
    card.addEventListener('drop', (e) => {
      e.preventDefault(); card.classList.remove('drag');
      hochladen((e as DragEvent).dataTransfer?.files ?? null);
    });

    // Aktionen je Datei
    card.querySelectorAll('.dok-zeile').forEach((z: any) => {
      const dok = doks.find((d) => String(d.id) === z.dataset.id);
      z.querySelector('[data-umbenennen]').addEventListener('click', async () => {
        const neu = prompt('Neuer Dateiname:', dok.dateiname);
        if (!neu || neu === dok.dateiname) return;
        try { await API.put('/api/mitarbeiter/dokumente/' + dok.id, { dateiname: neu, ordner: dok.ordner }); refresh(); }
        catch (e: any) { alert(e.message); }
      });
      z.querySelector('[data-verschieben]').addEventListener('click', async () => {
        const ziel = prompt(`In welchen Ordner verschieben?\nVorhanden: ${ordnerListe.join(', ')}\n(Neuer Name legt den Ordner an)`, dok.ordner);
        if (!ziel || ziel === dok.ordner) return;
        try { await API.put('/api/mitarbeiter/dokumente/' + dok.id, { dateiname: dok.dateiname, ordner: ziel }); refresh(); }
        catch (e: any) { alert(e.message); }
      });
      z.querySelector('[data-loeschen]').addEventListener('click', async () => {
        if (!confirm(`"${dok.dateiname}" endgültig löschen?${dok.loeschantrag ? '' : '\nHinweis: Aufbewahrungsfristen (Lohnunterlagen 6-10 Jahre) beachten.'}`)) return;
        try { await API.del('/api/mitarbeiter/dokumente/' + dok.id); refresh(); }
        catch (e: any) { alert(e.message); }
      });
    });

    return card;
  },
};

Router.register('mitarbeiter', (root: HTMLElement) => Mitarbeiter.renderList(root));

export { Mitarbeiter };
