/**
 * MODUL ADRESSVERWALTUNG (Seite "kontakte")
 * ---------------------------------------------------------------
 * Personen & Firmen mit frei verwaltbaren Adressschlüsseln
 * (Mehrfachzuordnung), Detail-Modal mit vCard-QR-Code.
 *
 * Herkunft: 1:1 portiert aus Immo Control public/app.js — deshalb
 * bewusst JavaScript statt TypeScript; Logik, Markup und Verhalten
 * sind unverändert, nur die ES-Modul-Imports kamen hinzu.
 *
 * Aufbau (Muster für alle Fachmodule im Client):
 *   Kontakte.renderList(root)   Listenansicht in #content rendern
 *   Kontakte.openForm(...)      Erfassen/Bearbeiten im Modal
 *   Kontakte.openDetail(k)      Detail-Modal
 *   Kontakte.openKategorien()   Adressschlüssel verwalten
 *   Router.register('kontakte', …)  bindet die Seite an die Navigation
 */
import { API, fmt, el, Modal, fieldVals, Sorter, laenderOptions, buildVCard, qrSvgFor, bindAdressSuche } from './ic/helpers.js';
import { Router, Shell } from './ic/router.js';

/* ===================== Modul: Adressverwaltung ===================== */
const Kontakte = {
  filter: { suche: '', typ: '', kategorie: '' },
  kategorien: [],

  ortLabel(k) { return [k.plz, k.ort].filter(Boolean).join(' ') || '–'; },
  typBadge(k) { return `<span class="badge">${k.typ === 'firma' ? 'Firma' : 'Person'}</span>`; },

  // Nur einen Adressschlüssel anzeigen (bevorzugt den gefilterten); weitere als "…"-Pille
  katCell(k) {
    const kats = k.kategorien || [];
    if (!kats.length) return { html: '–', val: '' };
    let first = kats[0];
    if (this.filter.kategorie) {
      const hit = kats.find(c => String(c.id) === String(this.filter.kategorie));
      if (hit) first = hit;
    }
    const more = kats.length - 1;
    const all = kats.map(c => c.name).join(', ');
    const html = `<div style="display:flex;gap:4px;align-items:center;white-space:nowrap">
      <span class="badge">${fmt.esc(first.name)}</span>
      ${more > 0 ? `<span class="badge badge-more" title="${fmt.esc(all)}">…</span>` : ''}
    </div>`;
    return { html, val: first.name };
  },

  async loadKategorien() {
    this.kategorien = await API.get('/api/kontakte/kategorien');
    return this.kategorien;
  },

  async renderList(root) {
    const kategorienLaden = this.loadKategorien(); // parallel zur Liste
    const params = new URLSearchParams();
    if (this.filter.suche) params.set('suche', this.filter.suche);
    if (this.filter.typ) params.set('typ', this.filter.typ);
    if (this.filter.kategorie) params.set('kategorie', this.filter.kategorie);
    const [data] = await Promise.all([API.get('/api/kontakte?' + params.toString()), kategorienLaden]);

    const katOpts = ['<option value="">Alle Adressschlüssel</option>']
      .concat(this.kategorien.map(c => `<option value="${c.id}" ${String(this.filter.kategorie) === String(c.id) ? 'selected' : ''}>${fmt.esc(c.name)}</option>`))
      .join('');

    const rows = data.map(k => {
      const kc = this.katCell(k);
      return `
      <tr class="clickable" data-id="${k.id}">
        <td data-val="${k.typ}">${this.typBadge(k)}</td>
        <td data-val="${fmt.esc(k.display_name || '')}">
          <span class="cell-strong">${fmt.esc((k.display_name || '–').replace(/\r?\n/g, ' '))}</span>
          ${k.firma_name ? `<div class="sub">${fmt.esc(k.firma_name)}</div>` : ''}
          ${(k.personen && k.personen.length) ? `<div class="sub">${k.personen.map(p => fmt.esc(p.display_name)).join(', ')}</div>` : ''}
        </td>
        <td data-val="${fmt.esc(kc.val)}">${kc.html}</td>
        <td data-val="${fmt.esc(k.ort || '')}">${fmt.esc(this.ortLabel(k))}</td>
        <td data-val="${fmt.esc(k.email || '')}">${k.email ? `<a href="mailto:${fmt.esc(k.email)}" onclick="event.stopPropagation()">${fmt.esc(k.email)}</a>` : '–'}</td>
        <td data-val="${fmt.esc(k.telefon || '')}">${fmt.esc(k.telefon || '–')}</td>
        <td>
          <div class="row-actions">
            <button class="act-btn" data-edit="${k.id}" title="Bearbeiten"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            ${k.typ === 'firma' ? `<button class="act-btn" data-addperson="${k.id}" title="Person hinzufügen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>` : ''}
            <button class="act-btn danger" data-del="${k.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join('');

    const view = el(`
      <div class="kontakte-page">
        <div class="page-header">
          <div>
            <div class="page-title">Adressverwaltung</div>
            <div class="page-subtitle">${(() => { const p = data.filter(k => k.typ === 'person').length, fi = data.filter(k => k.typ === 'firma').length; return `${p} Person${p === 1 ? '' : 'en'}, ${fi} Firm${fi === 1 ? 'a' : 'en'}`; })()}</div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-secondary" id="btn-person">＋ Person</button>
            <button class="btn btn-primary" id="btn-firma">＋ Firma</button>
          </div>
        </div>

        <div class="filter-bar">
          <input type="search" id="k-suche" name="immo-suche" autocomplete="off" placeholder="Suche nach Name, Ort …" value="${fmt.esc(this.filter.suche)}">
          <button class="btn btn-secondary" id="k-reset" title="Filter zurücksetzen">Zurücksetzen</button>
          <select id="k-typ">
            <option value="">Alle Typen</option>
            <option value="person" ${this.filter.typ === 'person' ? 'selected' : ''}>Personen</option>
            <option value="firma" ${this.filter.typ === 'firma' ? 'selected' : ''}>Firmen</option>
          </select>
          <select id="k-kat">${katOpts}</select>
          <button class="btn btn-secondary" id="k-kat-manage">Adressschlüssel verwalten</button>
        </div>

        ${data.length === 0 ? `
          <div class="card"><div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <h3>Keine Kontakte</h3><p>Erfassen Sie Personen oder Firmen. Jeder Adresse können ein oder mehrere Adressschlüssel zugewiesen werden.</p>
          </div></div>
        ` : `
          <div class="tbl-wrap"><table class="data" id="tbl-kontakte">
            <colgroup>
              <col class="cg-typ"><col class="cg-name"><col class="cg-kat"><col class="cg-ort"><col class="cg-email"><col class="cg-tel"><col class="cg-akt">
            </colgroup>
            <thead><tr>
              <th data-sort="typ" class="col-typ">Typ</th>
              <th data-sort="name" class="col-name">Name</th>
              <th data-sort="kat" class="col-kat">Adressschlüssel</th>
              <th data-sort="ort" class="col-ort">Ort</th>
              <th data-sort="email" class="col-email">E-Mail</th>
              <th data-sort="tel" class="col-tel">Telefon</th>
              <th class="col-akt"></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        `}
      </div>`);

    // Buttons
    view.querySelector('#btn-person').addEventListener('click', () => this.openForm(null, 'person'));
    view.querySelector('#btn-firma').addEventListener('click', () => this.openForm(null, 'firma'));
    view.querySelector('#k-kat-manage').addEventListener('click', () => this.openKategorien());

    // Filter
    let deb;
    view.querySelector('#k-suche').addEventListener('input', (e) => {
      clearTimeout(deb);
      deb = setTimeout(() => {
        this.filter.suche = e.target.value.trim();
        // merken, dass die Suche den Neuaufbau ausgelöst hat + Cursor-Position,
        // damit der Fokus danach zurück ins Suchfeld springt (Weitertippen/Korrigieren)
        this._sucheFokus = e.target.selectionStart;
        this.renderList(root);
      }, 750);
    });
    view.querySelector('#k-typ').addEventListener('change', (e) => { this.filter.typ = e.target.value; this.renderList(root); });
    view.querySelector('#k-kat').addEventListener('change', (e) => { this.filter.kategorie = e.target.value; this.renderList(root); });
    view.querySelector('#k-reset').addEventListener('click', () => { clearTimeout(deb); this.filter = { suche: '', typ: '', kategorie: '' }; this.renderList(root); });

    // Zeile anklicken -> Detailseite (zweite Seitennavigation), nicht mehr Modal
    view.querySelectorAll('#tbl-kontakte tbody tr.clickable').forEach(tr =>
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-actions') || e.target.closest('a')) return;
        Router.go('kontakte/' + tr.dataset.id);
      }));

    // Row actions
    view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.openForm(b.dataset.edit); }));
    view.querySelectorAll('[data-addperson]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.openForm(null, 'person', b.dataset.addperson); }));
    view.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Kontakt löschen?')) return;
      await API.del('/api/kontakte/' + b.dataset.del);
      this.renderList(root);
    }));

    root.innerHTML = ''; root.appendChild(view);
    Sorter.init(view.querySelector('#tbl-kontakte'));

    // Fokus zurück ins Suchfeld, wenn der Neuaufbau von der Suche kam —
    // so kann man ohne Klick weitertippen oder korrigieren. Der Cursor
    // wird ans Ende (bzw. an die gemerkte Position) gesetzt.
    if (this._sucheFokus != null) {
      const sf = view.querySelector('#k-suche');
      if (sf) {
        sf.focus();
        const pos = Math.min(this._sucheFokus, sf.value.length);
        try { sf.setSelectionRange(pos, pos); } catch { /* type=search erlaubt es evtl. nicht */ }
      }
      this._sucheFokus = null;
    }
  },

  /* -------------------- Detailseite (Ebene 2) -------------------- */
  /* Ersetzt das frühere Detail-Modal. Personen: Detailkarte mit QR.
     Firmen: Reiter (Kontaktdaten | Umsätze); im Reiter Kontaktdaten links
     die Firmeninfos, rechts oben die scrollbare Ansprechpartnerliste,
     rechts unten der angeklickte Ansprechpartner. */
  async renderDetail(root, id) {
    let k;
    try { k = await API.get('/api/kontakte/' + id); }
    catch { root.innerHTML = '<div class="card"><div class="empty-state"><h3>Nicht gefunden</h3></div></div>'; return; }

    const spine = el(`<div class="detail-rail">
      <button class="rail-back" id="kd-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Adressverwaltung</button>
      <div class="rail-title">${fmt.esc((k.typ === 'firma' ? (k.firmenname || 'Firma') : [k.vorname, k.nachname].filter(Boolean).join(' ')).replace(/\r?\n/g, ' '))}</div>
      <div class="rail-sub">${k.typ === 'firma' ? 'Firma' : 'Person'}</div>
      <button class="btn btn-sm" id="kd-edit" style="margin-top:14px">Bearbeiten</button>
    </div>`);
    Shell.enterDetail(spine);
    spine.querySelector('#kd-back').addEventListener('click', () => Router.go('kontakte'));
    spine.querySelector('#kd-edit').addEventListener('click', () =>
      this.openForm(id, k.typ, undefined, () => { this.renderDetail(root, id); }));

    root.innerHTML = '';
    if (k.typ === 'firma') root.appendChild(await this.firmaDetail(k, root));
    else root.appendChild(this.personDetail(k));
  },

  personDetail(k) {
    const row = (label, value) => value ? `<div class="kv"><span class="kv-label">${label}</span><span class="kv-value">${value}</span></div>` : '';
    const adresse = [k.strasse, k.adresszusatz, [k.plz, k.ort].filter(Boolean).join(' '), k.land].filter(Boolean).map(fmt.esc).join('<br>');
    const kats = (k.kategorien && k.kategorien.length)
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${k.kategorien.map(c => `<span class="badge">${fmt.esc(c.name)}</span>`).join('')}</div>` : '';
    const qr = qrSvgFor(buildVCard(k));
    return el(`
      <div class="detail-with-qr">
        <div class="detail-kv">
          ${row('Name', fmt.esc([k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ')))}
          ${row('Firma', fmt.esc(k.firma_name || ''))}
          ${row('Adressschlüssel', kats)}
          ${row('Adresse', adresse)}
          ${row('E-Mail (privat)', k.email ? `<a href="mailto:${fmt.esc(k.email)}">${fmt.esc(k.email)}</a>` : '')}
          ${row('Telefon (privat)', fmt.esc(k.telefon || ''))}
          ${row('Mobil (privat)', fmt.esc(k.mobil || ''))}
          ${row('Sprache', fmt.esc(k.sprache || ''))}
          ${row('Geburtsdatum', fmt.date(k.geburtsdatum))}
          ${row('Notizen', k.notizen ? fmt.esc(k.notizen).replace(/\n/g, '<br>') : '')}
        </div>
        ${qr ? `<div class="detail-qr"><div class="qr-box">${qr}</div><div class="qr-cap">Mit der Handykamera scannen,<br>um den Kontakt zu speichern</div></div>` : ''}
      </div>`);
  },

  async firmaDetail(k, root) {
    const row = (label, value) => value ? `<div class="kv"><span class="kv-label">${label}</span><span class="kv-value">${value}</span></div>` : '';
    const adresse = [k.strasse, k.adresszusatz, [k.plz, k.ort].filter(Boolean).join(' '), k.land].filter(Boolean).map(fmt.esc).join('<br>');
    const kats = (k.kategorien && k.kategorien.length)
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${k.kategorien.map(c => `<span class="badge">${fmt.esc(c.name)}</span>`).join('')}</div>` : '';
    // Firmierung kann zweizeilig sein -> Umbruch als echten <br> darstellen
    const firmierungHtml = fmt.esc(k.firmenname || '').replace(/\r?\n/g, '<br>');

    const wrap = el(`
      <div>
        <div class="tabs" id="kd-tabs">
          <button class="tab active" data-tab="kontakt">Kontaktdaten</button>
          <button class="tab" data-tab="umsatz">Umsätze</button>
        </div>
        <div id="kd-tab-kontakt" class="firma-split">
          <div class="card firma-info-card">
            <h2 class="card-titel">Firmendaten</h2>
            <div class="detail-kv">
              ${row('Firmierung', firmierungHtml)}
              ${row('Adressschlüssel', kats)}
              ${row('Adresse', adresse)}
              ${row('E-Mail', k.email ? `<a href="mailto:${fmt.esc(k.email)}">${fmt.esc(k.email)}</a>` : '')}
              ${row('Telefon', fmt.esc(k.telefon || ''))}
              ${row('Website', k.website ? `<a href="${fmt.esc(/^https?:\/\//.test(k.website) ? k.website : 'https://' + k.website)}" target="_blank" rel="noopener">${fmt.esc(k.website)}</a>` : '')}
              ${row('USt-IdNr.', fmt.esc(k.ust_id || ''))}
              ${row('Steuernummer', fmt.esc(k.steuernummer || ''))}
              ${row('Handelsregisternummer', fmt.esc(k.handelsregister_nummer || ''))}
              ${row('Registergericht', fmt.esc(k.registergericht || ''))}
              ${row('EORI-Nummer', fmt.esc(k.eori_nummer || ''))}
              ${row('Notizen', k.notizen ? fmt.esc(k.notizen).replace(/\n/g, '<br>') : '')}
            </div>
          </div>
          <div class="firma-partner">
            <div class="card partner-liste-card">
              <div class="partner-head">
                <h2 class="card-titel">Ansprechpartner</h2>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-sm" id="ap-existing">Bestehende Person</button>
                  <button class="btn btn-sm" id="ap-add">＋ Neu</button>
                </div>
              </div>
              <div class="partner-such" id="ap-such-box" hidden>
                <input type="search" id="ap-suche" class="partner-suche" placeholder="Suche nach Name oder Position…" autocomplete="off">
              </div>
              <div class="partner-liste" id="ap-liste"></div>
            </div>
            <div class="card partner-detail-card" id="ap-detail">
              <div class="empty-state" style="padding:16px"><p>Ansprechpartner auswählen</p></div>
            </div>
          </div>
        </div>
        <div id="kd-tab-umsatz" class="firma-split" hidden>
          <div class="card" style="width:100%"><div class="empty-state"><h3>Umsätze</h3><p>Kommt später — hier erscheinen die Umsätze aus Projekten.</p></div></div>
        </div>
      </div>`);

    wrap.querySelectorAll('#kd-tabs .tab').forEach(t => t.addEventListener('click', () => {
      wrap.querySelectorAll('#kd-tabs .tab').forEach(x => x.classList.toggle('active', x === t));
      wrap.querySelector('#kd-tab-kontakt').hidden = t.dataset.tab !== 'kontakt';
      wrap.querySelector('#kd-tab-umsatz').hidden = t.dataset.tab !== 'umsatz';
    }));

    const liste = wrap.querySelector('#ap-liste');
    const detail = wrap.querySelector('#ap-detail');
    // WICHTIG: In den Ansprechpartner-Details werden NUR geschäftliche Daten
    // gezeigt — nie private (E-Mail privat, private Anschrift etc.).
    const zeigePartner = (p) => {
      detail.innerHTML = `
        <div class="partner-detail-inner">
          <div class="partner-detail-name">${fmt.esc([p.anrede, p.vorname, p.nachname].filter(Boolean).join(' '))}</div>
          ${row('Position', fmt.esc(p.position || ''))}
          ${row('Telefon (geschäftlich)', fmt.esc(p.firma_telefon || ''))}
          ${row('Mobil (geschäftlich)', fmt.esc(p.firma_mobil || ''))}
          ${row('E-Mail (geschäftlich)', p.firma_email ? `<a href="mailto:${fmt.esc(p.firma_email)}">${fmt.esc(p.firma_email)}</a>` : '')}
          ${row('Sprache', fmt.esc(p.sprache || ''))}
          <div class="partner-actions">
            <button class="btn btn-sm" data-ap-edit="${p.id}">Bearbeiten</button>
            <button class="btn btn-sm" data-ap-move="${p.id}">Zu anderer Firma</button>
            <button class="btn btn-sm btn-secondary" data-ap-remove="${p.id}">Von Firma entfernen</button>
          </div>
        </div>`;
      detail.querySelector('[data-ap-edit]').addEventListener('click', () => this.editPartner(p, k.id, root));
      detail.querySelector('[data-ap-move]').addEventListener('click', () => this.movePartner(p, k.id, root));
      detail.querySelector('[data-ap-remove]').addEventListener('click', async () => {
        if (!confirm(`${p.vorname} ${p.nachname} von dieser Firma entfernen?\nDie Person bleibt in der Adressverwaltung erhalten.`)) return;
        try { await API.put('/api/kontakte/' + p.id + '/firma', { firma_id: null }); this.renderDetail(root, k.id); }
        catch (e) { alert(e.message); }
      });
    };
    // Suchfeld nur zeigen, wenn es überhaupt Ansprechpartner gibt
    const suchBox = wrap.querySelector('#ap-such-box');
    const sucheInput = wrap.querySelector('#ap-suche');
    const renderPartner = () => {
      const aps = k.ansprechpartner || [];
      suchBox.hidden = aps.length === 0;
      const q = (sucheInput.value || '').trim().toLowerCase();
      // Filter auf Name (Anrede/Vor-/Nachname) ODER Position
      const gefiltert = q
        ? aps.filter(p => {
            const name = [p.anrede, p.vorname, p.nachname].filter(Boolean).join(' ').toLowerCase();
            return name.includes(q) || (p.position || '').toLowerCase().includes(q);
          })
        : aps;
      if (aps.length === 0) {
        liste.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px">Noch keine Ansprechpartner.</p>';
      } else if (gefiltert.length === 0) {
        liste.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px">Kein Ansprechpartner passt zur Suche.</p>';
      } else {
        liste.innerHTML = gefiltert.map(p => `<button class="partner-row" data-id="${p.id}"><span class="partner-row-name">${fmt.esc([p.anrede, p.vorname, p.nachname].filter(Boolean).join(' '))}</span><span class="partner-row-pos">${fmt.esc(p.position || '')}</span></button>`).join('');
      }
      liste.querySelectorAll('.partner-row').forEach(b => b.addEventListener('click', () => {
        liste.querySelectorAll('.partner-row').forEach(x => x.classList.toggle('active', x === b));
        zeigePartner(aps.find(p => String(p.id) === b.dataset.id));
      }));
    };
    sucheInput.addEventListener('input', renderPartner);
    renderPartner();
    wrap.querySelector('#ap-add').addEventListener('click', () => this.openPartnerForm(k.id, root));
    wrap.querySelector('#ap-existing').addEventListener('click', () => this.addExistingPartner(k.id, root));
    return wrap;
  },

  // Neuen Ansprechpartner anlegen. Reihenfolge geschäftlich; KEINE privaten
  // Felder (die werden später über die Adressverwaltung gepflegt).
  async openPartnerForm(firmaId, root) {
    const anredeOpts = ['<option value="">–</option>'].concat(['Herr', 'Frau', 'Dr.', 'Prof.'].map(a => `<option>${a}</option>`)).join('');
    const body = el(`
      <div><div class="form-grid">
        <div class="field"><label>Anrede</label><select data-field="anrede">${anredeOpts}</select></div>
        <div class="field"><label>Vorname</label><input data-field="vorname"></div>
        <div class="field"><label>Nachname <span class="req">*</span></label><input data-field="nachname"></div>
        <div class="field"><label>Telefon (geschäftlich)</label><input data-field="firma_telefon"></div>
        <div class="field"><label>Mobil (geschäftlich)</label><input data-field="firma_mobil"></div>
        <div class="field"><label>E-Mail (geschäftlich)</label><input data-field="firma_email" type="email"></div>
        <div class="field"><label>Position</label><input data-field="position" placeholder="z. B. Einkaufsleiter"></div>
      </div></div>`);
    Modal.open('Ansprechpartner hinzufügen', body, {
      focusSelector: '[data-field="vorname"]',
      onOk: async () => {
        const d = fieldVals(body);
        if (!d.nachname) { alert('Nachname ist erforderlich.'); return false; }
        try { await API.post('/api/kontakte/' + firmaId + '/ansprechpartner', d); }
        catch (e) { alert(e.message); return false; }
        Modal.close();
        this.renderDetail(root, firmaId);
        return false;
      }
    });
  },

  // Bestehende (firmenlose) Person als Ansprechpartner zuordnen.
  async addExistingPartner(firmaId, root) {
    const frei = await API.get('/api/kontakte/personen/frei');
    if (!frei.length) {
      Modal.open('Bestehende Person', '<p style="color:var(--text-muted)">Es gibt derzeit keine Person ohne Firmenzuordnung. Legen Sie über „＋ Neu" einen neuen Ansprechpartner an.</p>', { hideOk: true });
      return;
    }
    const body = el(`
      <div>
        <div class="field"><label>Person suchen &amp; auswählen</label>
          <input type="search" id="ep-suche" class="pick-suche" placeholder="Name…" autocomplete="off">
        </div>
        <div class="pick-liste" id="ep-liste"></div>
        <div class="form-grid" style="margin-top:12px">
          <div class="form-section">In dieser Firma (geschäftlich)</div>
          <div class="field"><label>Position</label><input data-field="position" placeholder="z. B. Einkaufsleiter"></div>
          <div class="field"><label>Telefon (geschäftlich)</label><input data-field="firma_telefon"></div>
          <div class="field"><label>Mobil (geschäftlich)</label><input data-field="firma_mobil"></div>
          <div class="field"><label>E-Mail (geschäftlich)</label><input data-field="firma_email" type="email"></div>
          <p class="hinweis full">Die gewählte Person wird dieser Firma zugeordnet. Die geschäftlichen Angaben ergänzen die bestehenden Personendaten.</p>
        </div>
      </div>`);

    let ausgewaehlt = null;
    const liste = body.querySelector('#ep-liste');
    const suche = body.querySelector('#ep-suche');
    const render = () => {
      const q = (suche.value || '').trim().toLowerCase();
      const treffer = q
        ? frei.filter(p => [p.vorname, p.nachname].filter(Boolean).join(' ').toLowerCase().includes(q))
        : frei;
      liste.innerHTML = treffer.length
        ? treffer.map(p => `<button type="button" class="pick-row ${ausgewaehlt === p.id ? 'active' : ''}" data-id="${p.id}">${fmt.esc([p.vorname, p.nachname].filter(Boolean).join(' '))}</button>`).join('')
        : '<p class="pick-leer">Keine Person passt zur Suche.</p>';
      liste.querySelectorAll('.pick-row').forEach(b => b.addEventListener('click', () => {
        ausgewaehlt = Number(b.dataset.id);
        liste.querySelectorAll('.pick-row').forEach(x => x.classList.toggle('active', x === b));
      }));
    };
    suche.addEventListener('input', render);
    render();

    Modal.open('Bestehende Person hinzufügen', body, {
      okLabel: 'Zuordnen',
      focusSelector: '#ep-suche',
      onOk: async () => {
        if (!ausgewaehlt) { alert('Bitte eine Person auswählen.'); return false; }
        const d = fieldVals(body);
        try {
          await API.put('/api/kontakte/' + ausgewaehlt + '/firma', {
            firma_id: Number(firmaId),
            position: d.position,
            firma_telefon: d.firma_telefon, firma_email: d.firma_email, firma_mobil: d.firma_mobil,
          });
        } catch (e) { alert(e.message); return false; }
        Modal.close();
        this.renderDetail(root, firmaId);
        return false;
      }
    });
  },

  async movePartner(p, aktuelleFirmaId, root) {
    const firmen = (await API.get('/api/kontakte?typ=firma')).filter(f => f.id !== aktuelleFirmaId);
    if (!firmen.length) { alert('Keine andere Firma vorhanden.'); return; }
    const body = el(`
      <div>
        <div class="field"><label>Zielfirma suchen</label>
          <input type="search" id="mv-suche" class="pick-suche" placeholder="Firmenname…" autocomplete="off">
        </div>
        <div class="pick-liste" id="mv-liste"></div>
      </div>`);

    let ausgewaehlt = null;
    const liste = body.querySelector('#mv-liste');
    const suche = body.querySelector('#mv-suche');
    const render = () => {
      const q = (suche.value || '').trim().toLowerCase();
      const treffer = q ? firmen.filter(f => (f.firmenname || '').toLowerCase().includes(q)) : firmen;
      liste.innerHTML = treffer.length
        ? treffer.map(f => `<button type="button" class="pick-row ${ausgewaehlt === f.id ? 'active' : ''}" data-id="${f.id}">${fmt.esc(f.firmenname)}</button>`).join('')
        : '<p class="pick-leer">Keine Firma passt zur Suche.</p>';
      liste.querySelectorAll('.pick-row').forEach(b => b.addEventListener('click', () => {
        ausgewaehlt = Number(b.dataset.id);
        liste.querySelectorAll('.pick-row').forEach(x => x.classList.toggle('active', x === b));
      }));
    };
    suche.addEventListener('input', render);
    render();

    Modal.open(`${p.vorname} ${p.nachname} verschieben`, body, {
      okLabel: 'Verschieben',
      focusSelector: '#mv-suche',
      onOk: async () => {
        if (!ausgewaehlt) { alert('Bitte eine Zielfirma auswählen.'); return false; }
        try { await API.put('/api/kontakte/' + p.id + '/firma', { firma_id: ausgewaehlt }); }
        catch (e) { alert(e.message); return false; }
        Modal.close();
        this.renderDetail(root, aktuelleFirmaId);
        return false;
      }
    });
  },

  // Ansprechpartner IM FIRMENKONTEXT bearbeiten: nur Daten, die zur Firma
  // gehören (Anrede/Name + geschäftliche Rollendaten). Private Felder werden
  // hier bewusst NICHT angeboten — die pflegt man über die Adressverwaltung.
  async editPartner(p, firmaId, root) {
    const anredeOpts = ['<option value="">–</option>']
      .concat(['Herr', 'Frau', 'Dr.', 'Prof.'].map(a => `<option ${p.anrede === a ? 'selected' : ''}>${a}</option>`)).join('');
    const v = (key) => fmt.esc(p[key] ?? '');
    const body = el(`
      <div><div class="form-grid">
        <div class="field"><label>Anrede</label><select data-field="anrede">${anredeOpts}</select></div>
        <div class="field"><label>Vorname</label><input data-field="vorname" value="${v('vorname')}"></div>
        <div class="field"><label>Nachname <span class="req">*</span></label><input data-field="nachname" value="${v('nachname')}"></div>
        <div class="field"><label>Telefon (geschäftlich)</label><input data-field="firma_telefon" value="${v('firma_telefon')}"></div>
        <div class="field"><label>Mobil (geschäftlich)</label><input data-field="firma_mobil" value="${v('firma_mobil')}"></div>
        <div class="field"><label>E-Mail (geschäftlich)</label><input data-field="firma_email" type="email" value="${v('firma_email')}"></div>
        <div class="field"><label>Position</label><input data-field="position" value="${v('position')}"></div>
      </div></div>`);
    Modal.open('Ansprechpartner bearbeiten', body, {
      focusSelector: '[data-field="vorname"]',
      onOk: async () => {
        const d = fieldVals(body);
        if (!d.nachname) { alert('Nachname ist erforderlich.'); return false; }
        try {
          // gezieltes Teilupdate über den firma-Endpunkt (firma_id bleibt unverändert),
          // plus Anrede/Name über den Kontakt-Endpunkt — beides ohne private Felder anzufassen.
          await API.put('/api/kontakte/' + p.id + '/rolle', {
            anrede: d.anrede, vorname: d.vorname, nachname: d.nachname,
            position: d.position, firma_email: d.firma_email,
            firma_telefon: d.firma_telefon, firma_mobil: d.firma_mobil,
          });
        } catch (e) { alert(e.message); return false; }
        Modal.close();
        this.renderDetail(root, firmaId);
        return false;
      }
    });
  },


  // Adressschlüssel als Dropdown (Mehrfachauswahl per Chips). Auswahl steht
  // in this._formKats; das Dropdown fügt hinzu, Chips entfernen wieder.
  katDropdownHtml(selectedIds) {
    this._formKats = (selectedIds || []).map(Number);
    if (!this.kategorien.length) return '<span class="sub">Noch keine Adressschlüssel – über „Adressschlüssel verwalten" anlegen.</span>';
    return `
      <div class="kat-picker">
        <select id="kf-kat-select"><option value="">＋ Adressschlüssel hinzufügen…</option></select>
        <div class="kat-chips" id="kf-kat-chips"></div>
      </div>`;
  },
  bindKatDropdown(root) {
    const sel = root.querySelector('#kf-kat-select');
    const chips = root.querySelector('#kf-kat-chips');
    if (!sel || !chips) return;
    // WICHTIG: kategorie.id kommt als String aus JSON, _formKats sind Numbers.
    // Alle Vergleiche über Number(), sonst greifen weder Filter noch Dedupe
    // (das war die Ursache: Chips leer, Duplikate möglich, Auswahl "verschwand").
    const render = () => {
      chips.innerHTML = this._formKats.length
        ? this._formKats.map(id => {
            const k = this.kategorien.find(c => Number(c.id) === Number(id));
            return k ? `<span class="kat-chip">${fmt.esc(k.name)} <button type="button" data-katweg="${id}" title="Entfernen">×</button></span>` : '';
          }).join('')
        : '<span class="sub" style="color:var(--text-muted);font-size:12.5px">Noch kein Adressschlüssel zugewiesen.</span>';
      sel.innerHTML = '<option value="">＋ Adressschlüssel hinzufügen…</option>' +
        this.kategorien.filter(c => !this._formKats.some(id => Number(id) === Number(c.id)))
          .map(c => `<option value="${c.id}">${fmt.esc(c.name)}</option>`).join('');
      chips.querySelectorAll('[data-katweg]').forEach(b =>
        b.addEventListener('click', () => {
          this._formKats = this._formKats.filter(x => Number(x) !== Number(b.dataset.katweg));
          render();
        }));
    };
    sel.addEventListener('change', () => {
      const id = Number(sel.value);
      // Dedupe: denselben Schlüssel nie zweimal aufnehmen
      if (id && !this._formKats.some(x => Number(x) === id)) this._formKats.push(id);
      sel.value = '';
      render();
    });
    render();
  },

  // Adress-Autovervollständigung (Photon/OSM über den Server-Proxy).
  // Hängt an das Straßenfeld eine Vorschlagsliste; bei Auswahl werden
  // Strasse, PLZ, Ort und Land des Formulars automatisch befüllt. Der Dienst
  // ist optional: fällt er aus, bleibt das Feld ganz normal manuell nutzbar.
  async openForm(id, defaultTyp = 'person', firmaId, onSaved) {
    // Abweichung von Immo Control: alle Daten PARALLEL laden statt nacheinander
    // (sequentielle awaits multiplizieren die Netzwerklatenz — siehe CLAUDE.md).
    const [, k, firmen] = await Promise.all([
      this.loadKategorien(),
      id ? API.get('/api/kontakte/' + id) : Promise.resolve({}),
      API.get('/api/kontakte?typ=firma'),
    ]);
    const typ = k.typ || defaultTyp;
    const v = (key) => fmt.esc(k[key] ?? '');
    const katBlock = `
      <div class="field full"><label>Adressschlüssel</label>
        ${this.katDropdownHtml(k.kategorie_ids)}
      </div>`;

    let body;
    if (typ === 'firma') {
      body = el(`
        <div>
          <div class="form-grid">
            <div class="field full"><label>Firmierung <span class="req">*</span></label><textarea data-field="firmenname" rows="2" class="firmierung-input" placeholder="Firmenname (bei Bedarf zweizeilig)">${v('firmenname')}</textarea></div>
            <div class="field full"><label>Strasse und Hausnummer</label><input data-field="strasse" value="${v('strasse')}"></div>
            <div class="field full"><label>Adresszusatz</label><input data-field="adresszusatz" value="${v('adresszusatz')}" placeholder="z. B. c/o, Gebäude, Etage"></div>
            <div class="field"><label>PLZ</label><input data-field="plz" value="${v('plz')}"></div>
            <div class="field"><label>Ort</label><input data-field="ort" value="${v('ort')}"></div>
            <div class="field"><label>Land</label><select data-field="land">${laenderOptions(k.land)}</select></div>
            <div class="field"><label>E-Mail</label><input data-field="email" type="email" value="${v('email')}"></div>
            <div class="field"><label>Telefon</label><input data-field="telefon" value="${v('telefon')}"></div>
            <div class="field"><label>Website</label><input data-field="website" value="${v('website')}" placeholder="www.beispiel.ch"></div>
            <div class="form-section">Steuer- &amp; Registerangaben</div>
            <div class="field"><label>USt-IdNr.</label><input data-field="ust_id" value="${v('ust_id')}"></div>
            <div class="field"><label>Steuernummer</label><input data-field="steuernummer" value="${v('steuernummer')}"></div>
            <div class="field"><label>Handelsregisternummer</label><input data-field="handelsregister_nummer" value="${v('handelsregister_nummer')}"></div>
            <div class="field"><label>Registergericht</label><input data-field="registergericht" value="${v('registergericht')}"></div>
            <div class="field"><label>EORI-Nummer</label><input data-field="eori_nummer" value="${v('eori_nummer')}" placeholder="falls erforderlich"></div>
            <div class="field full"><label>Notizen</label><textarea data-field="notizen">${v('notizen')}</textarea></div>
            ${katBlock}
          </div>
        </div>`);
    } else {
      const firmaOpts = ['<option value="">– keine –</option>']
        .concat(firmen.filter(fm => fm.id !== Number(id))
          .map(fm => `<option value="${fm.id}" ${String(k.firma_id ?? firmaId) === String(fm.id) ? 'selected' : ''}>${fmt.esc(fm.firmenname)}</option>`)).join('');
      const anredeOpts = ['<option value="">–</option>']
        .concat(['Herr', 'Frau', 'Dr.', 'Prof.'].map(a => `<option ${k.anrede === a ? 'selected' : ''}>${a}</option>`)).join('');
      body = el(`
        <div>
          <div class="form-grid">
            <div class="field"><label>Anrede</label><select data-field="anrede">${anredeOpts}</select></div>
            <div class="field"><label>Firma (optional)</label><select data-field="firma_id">${firmaOpts}</select></div>
            <div class="field"><label>Vorname</label><input data-field="vorname" value="${v('vorname')}"></div>
            <div class="field"><label>Nachname <span class="req">*</span></label><input data-field="nachname" value="${v('nachname')}"></div>
            <div class="field full"><label>Strasse und Hausnummer</label><input data-field="strasse" value="${v('strasse')}"></div>
            <div class="field full"><label>Adresszusatz</label><input data-field="adresszusatz" value="${v('adresszusatz')}" placeholder="z. B. c/o, Gebäude, Etage"></div>
            <div class="field"><label>PLZ</label><input data-field="plz" value="${v('plz')}"></div>
            <div class="field"><label>Ort</label><input data-field="ort" value="${v('ort')}"></div>
            <div class="field"><label>Land</label><select data-field="land">${laenderOptions(k.land)}</select></div>
            <div class="field"><label>E-Mail (privat)</label><input data-field="email" type="email" value="${v('email')}"></div>
            <div class="field"><label>Telefon (privat)</label><input data-field="telefon" value="${v('telefon')}"></div>
            <div class="field"><label>Mobil (privat)</label><input data-field="mobil" value="${v('mobil')}"></div>
            <div class="field"><label>Sprache</label><input data-field="sprache" value="${v('sprache')}" placeholder="z. B. Deutsch"></div>
            <div class="field"><label>Geburtsdatum</label><input data-field="geburtsdatum" type="date" value="${v('geburtsdatum')}"></div>
            <div class="field full"><label>Notizen</label><textarea data-field="notizen">${v('notizen')}</textarea></div>
            ${katBlock}
          </div>
        </div>`);
    }

    this.bindKatDropdown(body);
    bindAdressSuche(body);
    Modal.open(id ? (typ === 'firma' ? 'Firma bearbeiten' : 'Person bearbeiten') : (typ === 'firma' ? 'Firma erfassen' : 'Person erfassen'), body, {
      focusSelector: typ === 'firma' ? '[data-field="firmenname"]' : '[data-field="anrede"]',
      submitOnEnter: true,
      onOk: async () => {
        const d = fieldVals(body);
        d.typ = typ;
        d.kategorie_ids = this._formKats.slice();
        if (typ === 'firma' && !d.firmenname) { alert('Firmenname ist erforderlich.'); return false; }
        if (typ === 'person' && !d.nachname) { alert('Nachname ist erforderlich.'); return false; }
        let savedId = id;
        try {
          if (id) await API.put('/api/kontakte/' + id, d);
          else { const resp = await API.post('/api/kontakte', d); savedId = resp && resp.id; }
        } catch (e) { alert(e.message); return false; }
        if (onSaved) { Modal.close(); onSaved(savedId); return false; }
        this.renderList(document.getElementById('content'));
      }
    });
  },

  async openKategorien() {
    await this.loadKategorien();
    const list = (cats) => cats.length
      ? cats.map(c => `<div class="kat-row" data-id="${c.id}"><span>${fmt.esc(c.name)}</span><button class="act-btn danger" data-katdel="${c.id}" title="Löschen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></div>`).join('')
      : '<p style="color:var(--text-muted);font-size:13px">Noch keine Adressschlüssel.</p>';

    const body = el(`
      <div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input id="kat-neu" placeholder="Neuer Adressschlüssel…" style="flex:1;padding:8px 11px;border:0.5px solid var(--border);border-radius:var(--radius)">
          <button class="btn btn-primary btn-sm" id="kat-add">Hinzufügen</button>
        </div>
        <div id="kat-list">${list(this.kategorien)}</div>
      </div>`);

    const refresh = async () => { await this.loadKategorien(); body.querySelector('#kat-list').innerHTML = list(this.kategorien); bindDel(); };
    const bindDel = () => body.querySelectorAll('[data-katdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.del('/api/kontakte/kategorien/' + b.dataset.katdel); await refresh(); }
      catch (e) { alert(e.message); }
    }));
    // Neuen Adressschlüssel anlegen (per Button ODER Enter im Eingabefeld)
    const addKat = async () => {
      const feld = body.querySelector('#kat-neu');
      const name = feld.value.trim();
      if (!name) return;
      try { await API.post('/api/kontakte/kategorien', { name }); feld.value = ''; await refresh(); feld.focus(); }
      catch (e) { alert(e.message); }
    };
    body.querySelector('#kat-add').addEventListener('click', addKat);
    // Enter im Feld = Hinzufügen (nicht das Modal schließen). stopPropagation
    // verhindert, dass der globale Submit-Handler des Modals ("Schliessen") greift.
    body.querySelector('#kat-neu').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addKat(); }
    });
    bindDel();

    Modal.open('Adressschlüssel verwalten', body, {
      okLabel: 'Schliessen',
      submitOnEnter: false,   // Enter soll hier NICHT global schließen (Feld hat eigenen Handler)
      focusSelector: '#kat-neu',
      onOk: () => { this.renderList(document.getElementById('content')); }
    });
  }
};

Router.register('kontakte', (root, param) => {
  if (param) return Kontakte.renderDetail(root, param);
  Shell.exitDetail();
  return Kontakte.renderList(root);
});

export { Kontakte };
