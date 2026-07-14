/* Portiert 1:1 aus Immo Control public/app.js (Helfer-Schicht).
   Änderungen: nur ES-Modul-Exports; Logik unverändert. */
/* --------------------- Sichtbare Fehlermeldung --------------------- */
function showFatal(msg) {
  console.error('[Handwerker ERP]', msg);
  const box = document.getElementById('fatal-error');
  if (box) { box.textContent = 'Fehler: ' + msg; box.hidden = false; }
}
window.addEventListener('error', (e) => showFatal(e.message || 'Unbekannter Fehler'));
window.addEventListener('unhandledrejection', (e) =>
  showFatal((e.reason && e.reason.message) ? e.reason.message : String(e.reason)));

const API = {
  async get(url) { return this._req('GET', url); },
  async post(url, body) { return this._req('POST', url, body); },
  async put(url, body) { return this._req('PUT', url, body); },
  async del(url) { return this._req('DELETE', url); },
  async upload(url, formData) {
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
    return data;
  },
  async _req(method, url, body) {
    const opt = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const res = await fetch(url, opt);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Fehler');
    return data;
  }
};

/* --------------------------- Formatierung --------------------------- */
const fmt = {
  chf(n) {
    if (n === null || n === undefined || n === '') return '–';
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n);
  },
  money(n, cur) {
    if (n === null || n === undefined || n === '') return '–';
    try { return new Intl.NumberFormat('de-CH', { style: 'currency', currency: cur || 'CHF' }).format(n); }
    catch (_) { return new Intl.NumberFormat('de-CH').format(n) + ' ' + (cur || 'CHF'); }
  },
  num(n) {
    if (n === null || n === undefined || n === '') return '–';
    return new Intl.NumberFormat('de-CH').format(n);
  },
  area(n) {
    if (n === null || n === undefined || n === '' || +n === 0) return '–';
    return new Intl.NumberFormat('de-CH').format(n) + ' m²';
  },
  date(s) {
    if (!s) return '–';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('de-CH');
  },
  esc(s) {    return String(s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
};

function fmtMonat(s) {
  if (!s) return '–';
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? `${m[2]}.${m[1]}` : s;
}
function fmtSize(bytes) {  if (!bytes && bytes !== 0) return '–';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

const ART_LABEL = {
  WOHNUNG: 'Eigentumswohnung',
  EFH: 'Einfamilienhaus',
  MFH: 'Mehrfamilienhaus',
  PARKPLATZ: 'Parkplätze / Garage',
  GEWERBE: 'Büro / Gewerbe / Lager',
  GESCHAEFTSHAUS: 'Geschäftshaus',
  BUERO: 'Büro / Gewerbe / Lager'   // Legacy-Wert: gleiche Anzeige wie GEWERBE
};
// Reihenfolge im Auswahlfeld „Art der Liegenschaft"
const ART_ORDER = ['WOHNUNG', 'EFH', 'MFH', 'PARKPLATZ', 'GEWERBE', 'GESCHAEFTSHAUS'];
// Einzel-Arten haben genau eine (automatische) Einheit; alle anderen mehrere.
const ART_EINZEL = ['EFH', 'WOHNUNG'];
const istEinzelArt = (art) => ART_EINZEL.includes(art);
const STATUS_LABEL = { vermietet: 'Vermietet', leerstehend: 'Leerstehend', gekuendigt: 'Gekündigt', reserviert: 'Reserviert' };

// Standard-Ausstattung je Art der Liegenschaft
const AUSSTATTUNG_WOHNEN = ['Parkplatz / Garage', 'Waschmaschine', 'Trockner', 'Einbauküche', 'Aufzug', 'Garten / Terrasse', 'Balkon', 'Kinderwagenraum', 'Fahrradkeller', 'Kellerabteil'];
const AUSSTATTUNG_GEWERBE = ['Parkplatz / Garage', 'Einbauküche'];
function ausstattungStd(art) {
  if (['WOHNUNG', 'EFH', 'MFH'].includes(art)) return AUSSTATTUNG_WOHNEN;
  if (['GEWERBE', 'BUERO', 'GESCHAEFTSHAUS'].includes(art)) return AUSSTATTUNG_GEWERBE;
  return [];
}

const RAUM_TYPEN = ['Wohnzimmer', 'Schlafzimmer', 'Esszimmer', 'Wohn-/Esszimmer', 'Küche', 'Bad', 'WC', 'Abstellraum', 'Zusätzliches Zimmer'];
const ZAEHLER_TYPEN = ['Kaltwasser', 'Warmwasser', 'Wärmemenge', 'Strom', 'Gas', 'Sonstiges'];

const WAEHRUNGEN = ['CHF', 'EUR', 'GBP'];
function waehrungOptions(selected) {
  const sel = selected || 'CHF';
  return WAEHRUNGEN.map(w => `<option value="${w}" ${w === sel ? 'selected' : ''}>${w}</option>`).join('');
}

// Länder-Auswahl (Europa/Westen, Naher Osten, Nordafrika, Russland, China u. a.)
const LAENDER = ['Ägypten','Albanien','Algerien','Andorra','Australien','Belarus','Belgien','Bosnien und Herzegowina','Bulgarien','China','Dänemark','Deutschland','Estland','Finnland','Frankreich','Griechenland','Indien','Irak','Iran','Irland','Island','Israel','Italien','Japan','Jemen','Jordanien','Kanada','Katar','Kroatien','Kuwait','Lettland','Libanon','Libyen','Liechtenstein','Litauen','Luxemburg','Malta','Marokko','Moldau','Monaco','Montenegro','Neuseeland','Niederlande','Nordmazedonien','Norwegen','Oman','Österreich','Polen','Portugal','Rumänien','Russland','San Marino','Saudi-Arabien','Schweden','Schweiz','Serbien','Slowakei','Slowenien','Spanien','Südkorea','Syrien','Tschechien','Tunesien','Türkei','Ukraine','Ungarn','USA','Vereinigte Arabische Emirate','Vereinigtes Königreich','Zypern'].sort((a, b) => a.localeCompare(b, 'de'));
function laenderOptions(selected) {
  const sel = selected || 'Schweiz';
  const list = LAENDER.includes(sel) ? LAENDER : [sel, ...LAENDER];
  return list.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
}

// vCard 3.0 aus einem Kontakt erzeugen (für QR / Handy-Import)
function vcardEscape(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function buildVCard(k) {
  const L = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (k.typ === 'firma') {
    L.push('FN:' + vcardEscape(k.firmenname || ''));
    L.push('ORG:' + vcardEscape(k.firmenname || ''));
  } else {
    const fn = [k.anrede, k.vorname, k.nachname].filter(Boolean).join(' ');
    L.push('N:' + [vcardEscape(k.nachname), vcardEscape(k.vorname), '', vcardEscape(k.anrede), ''].join(';'));
    L.push('FN:' + vcardEscape(fn || k.nachname || ''));
    if (k.firma_name) L.push('ORG:' + vcardEscape(k.firma_name));
  }
  const adrType = k.typ === 'firma' ? 'WORK' : 'HOME';
  if (k.telefon) L.push(`TEL;TYPE=${adrType},VOICE:` + vcardEscape(k.telefon));
  if (k.email) L.push('EMAIL;TYPE=INTERNET:' + vcardEscape(k.email));
  if (k.typ === 'firma' && k.website) {
    const url = /^https?:\/\//.test(k.website) ? k.website : 'https://' + k.website;
    L.push('URL:' + vcardEscape(url));
  }
  if (k.strasse || k.plz || k.ort || k.land) {
    L.push(`ADR;TYPE=${adrType}:;;` + [vcardEscape(k.strasse), vcardEscape(k.ort), '', vcardEscape(k.plz), vcardEscape(k.land)].join(';'));
  }
  if (k.typ === 'person' && k.geburtsdatum) L.push('BDAY:' + k.geburtsdatum);
  if (k.kategorien && k.kategorien.length) L.push('CATEGORIES:' + k.kategorien.map(c => vcardEscape(c.name)).join(','));
  if (k.notizen) L.push('NOTE:' + vcardEscape(k.notizen));
  L.push('END:VCARD');
  return L.join('\r\n');
}
function qrSvgFor(text) {
  if (typeof qrcode === 'undefined') return '';
  try {
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];   // Umlaute korrekt kodieren
    }
    const qr = qrcode(0, 'L');           // Typ automatisch, ECC niedrig = mehr Kapazität
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (e) { return ''; }
}
/* --------------------------- Hilfsfunktion --------------------------- */
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ----------------------------- Modal ----------------------------- */
const Modal = {
  open(title, bodyHtml, { okLabel = 'Speichern', onOk, focusSelector, submitOnEnter = true, hideOk, wide, xwide, noFooter } = {}) {
    this.close();
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal${xwide ? ' modal-xwide' : (wide ? ' modal-wide' : '')}">
          <div class="modal-head">
            <span class="modal-title">${fmt.esc(title)}</span>
            <button class="act-btn" data-close title="Schliessen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body"></div>
          ${noFooter ? '' : `<div class="modal-foot">
            <button class="btn btn-secondary" data-close>${hideOk ? 'Schliessen' : 'Abbrechen'}</button>
            ${hideOk ? '' : `<button class="btn btn-primary" data-ok>${fmt.esc(okLabel)}</button>`}
          </div>`}
        </div>
      </div>`);
    overlay.querySelector('.modal-body').appendChild(typeof bodyHtml === 'string' ? el(`<div>${bodyHtml}</div>`) : bodyHtml);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) this.close(); });
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.close()));
    const doOk = async () => {
      if (onOk) { const keep = await onOk(); if (keep === false) return; }
      this.close();
    };
    const okBtn = overlay.querySelector('[data-ok]');
    if (okBtn) okBtn.addEventListener('click', doOk);
    // Esc schliesst, Enter speichert (ausser in mehrzeiligen Feldern)
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
      if (submitOnEnter && !hideOk && e.key === 'Enter' && !e.shiftKey
          && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON'
          && !e.target.closest('[data-no-enter]')) {
        e.preventDefault(); doOk();
      }
    });
    document.body.appendChild(overlay);
    this._overlay = overlay;
    const focusEl = (focusSelector && overlay.querySelector(focusSelector)) || overlay.querySelector('input,select,textarea');
    if (focusEl) focusEl.focus();
  },
  close() { if (this._overlay) { this._overlay.remove(); this._overlay = null; } }
};

function fieldVals(scope) {
  const o = {};
  scope.querySelectorAll('[data-field]').forEach(i => {
    o[i.dataset.field] = (i.type === 'checkbox') ? (i.checked ? 1 : 0) : i.value;
  });
  return o;
}

/* ----------------------- Sortierbare Tabellen ----------------------- */
const Sorter = {
  init(table, opts = {}) {
    if (!table) return;
    const ths = [...table.querySelectorAll('thead th[data-sort]')];
    ths.forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => this._sort(table, th, th.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc'));
    });
    if (opts.sortBy) {
      const th = table.querySelector(`thead th[data-sort="${opts.sortBy}"]`);
      if (th) this._sort(table, th, opts.dir || 'asc');
    }
  },
  _sort(table, th, dir) {
    [...table.querySelectorAll('thead th[data-sort]')].forEach(o => {
      o.removeAttribute('data-dir');
      const s = o.querySelector('.sort-ind'); if (s) s.remove();
    });
    th.setAttribute('data-dir', dir);
    const col = [...th.parentNode.children].indexOf(th);
    const tbody = table.querySelector('tbody');
    const rows = [...tbody.querySelectorAll('tr')];
    const val = (tr) => {
      const td = tr.children[col]; if (!td) return '';
      const dv = td.getAttribute('data-val');
      return (dv !== null ? dv : td.textContent).trim();
    };
    rows.sort((a, b) => {
      const x = val(a), y = val(b);
      const nx = parseFloat(x.replace(/[^0-9.\-]/g, '')), ny = parseFloat(y.replace(/[^0-9.\-]/g, ''));
      let cmp;
      if (x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny) && /\d/.test(x) && /\d/.test(y) && !/[a-zA-Z]/.test(x) && !/[a-zA-Z]/.test(y))
        cmp = nx - ny;
      else cmp = x.localeCompare(y, 'de', { sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    });
    rows.forEach(r => tbody.appendChild(r));
    const ind = document.createElement('span');
    ind.className = 'sort-ind';
    ind.textContent = dir === 'asc' ? ' \u25B2' : ' \u25BC';
    th.appendChild(ind);
  }
};

/* --------------- Adress-Autovervollständigung (Photon über Server-Proxy) ---------------
   Hängt an das Straßenfeld eines Formulars eine Vorschlagsliste; bei Auswahl
   werden Strasse, PLZ, Ort und Land automatisch befüllt. Wird von mehreren
   Fachmodulen genutzt (Adressverwaltung, Mitarbeiter), deshalb liegt sie hier
   in der Basisschicht statt in einem einzelnen Modul.

   Land-Feld: Formulare führen das Land entweder als NAMEN (data-field="land",
   z. B. Adressverwaltung) oder als ISO-CODE (data-field="land_code", z. B.
   Mitarbeiter). Beide werden bedient — je nachdem, welches Feld vorhanden ist.
   Nach dem Setzen wird ein change-Event ausgelöst, damit landabhängige Logik
   des Formulars (z. B. umschaltende Felder) reagieren kann.

   Der Dienst ist optional: Fällt er aus, erscheinen einfach keine Vorschläge
   und das Feld bleibt ganz normal von Hand ausfüllbar. */
function bindAdressSuche(body) {
  const strasse = body.querySelector('[data-field="strasse"]');
  if (!strasse) return;
  const setF = (feld, wert) => { const el2 = body.querySelector(`[data-field="${feld}"]`); if (el2 && wert) el2.value = wert; };

  // Vorschlags-Container unter das Straßenfeld setzen
  const feld = strasse.closest('.field');
  feld.style.position = 'relative';
  const box = document.createElement('div');
  box.className = 'adr-vorschlaege';
  box.hidden = true;
  feld.appendChild(box);

  let timer = null;
  let aktiv = -1;
  let letzte = [];

  const schliessen = () => { box.hidden = true; box.innerHTML = ''; aktiv = -1; };
  const zeigen = (items) => {
    letzte = items;
    if (!items.length) return schliessen();
    box.innerHTML = items.map((v, i) =>
      `<button type="button" class="adr-item ${i === aktiv ? 'active' : ''}" data-i="${i}">${fmt.esc(v.label)}</button>`).join('');
    box.hidden = false;
    box.querySelectorAll('.adr-item').forEach(b =>
      b.addEventListener('mousedown', (e) => { e.preventDefault(); waehle(Number(b.dataset.i)); }));
  };
  // Land setzen — je nach Formular über den Namen oder den ISO-Code.
  const setLand = (v) => {
    const selCode = body.querySelector('[data-field="land_code"]');
    if (selCode && v.land_code) {
      const opt = [...selCode.options].find(o => o.value === v.land_code);
      if (opt) { selCode.value = opt.value; selCode.dispatchEvent(new Event('change', { bubbles: true })); }
      return;
    }
    const selName = body.querySelector('[data-field="land"]');
    if (selName && v.land) {
      const opt = [...selName.options].find(o => o.value === v.land || o.text === v.land);
      if (opt) { selName.value = opt.value; selName.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  };
  const waehle = (i) => {
    const v = letzte[i];
    if (!v) return;
    // Adresszusatz (c/o o. Ä.) wird bewusst NICHT angefasst — der bleibt stehen.
    setF('strasse', v.strasse);
    setF('plz', v.plz);
    setF('ort', v.ort);
    setLand(v);
    schliessen();
  };

  strasse.setAttribute('autocomplete', 'off');
  strasse.addEventListener('input', () => {
    const q = strasse.value.trim();
    clearTimeout(timer);
    if (q.length < 3) return schliessen();
    // Entprellen: erst 250 ms nach der letzten Eingabe anfragen
    timer = setTimeout(async () => {
      try {
        const items = await API.get('/api/adressen/suche?q=' + encodeURIComponent(q));
        if (document.activeElement === strasse) zeigen(items);
      } catch { schliessen(); }
    }, 250);
  });
  // Tastatursteuerung: Pfeile + Enter + Escape
  strasse.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); aktiv = Math.min(aktiv + 1, letzte.length - 1); zeigen(letzte); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aktiv = Math.max(aktiv - 1, 0); zeigen(letzte); }
    else if (e.key === 'Enter' && aktiv >= 0) { e.preventDefault(); waehle(aktiv); }
    else if (e.key === 'Escape') { schliessen(); }
  });
  strasse.addEventListener('blur', () => setTimeout(schliessen, 150));
}

export { showFatal, API, fmt, fmtMonat, fmtSize, LAENDER, laenderOptions,
         vcardEscape, buildVCard, qrSvgFor, el, Modal, fieldVals, Sorter,
         bindAdressSuche };
