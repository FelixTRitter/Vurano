/**
 * Konfiguration: Rollen und Arbeitszeitmodelle — je ein Submodul,
 * gleiches Bedienmuster wie die Adressschlüssel der Adressverwaltung.
 */
import { API, fmt, el, fieldVals } from './ic/helpers.js';
import { updateBranding } from './branding.js';
import { Router } from './ic/router.js';

function listPage(titel: string, untertitel: string, apiPath: string, platzhalter: string) {
  return async (root: HTMLElement): Promise<void> => {
    const eintraege = await API.get(apiPath);
    const rows = eintraege.map((r: any) => `
      <div class="kat-row" data-id="${r.id}">
        <span>${fmt.esc(r.name)}</span>
        <button class="act-btn danger" data-del="${r.id}" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`).join('');

    const view = el(`
      <div>
        <div class="page-header">
          <div>
            <div class="page-title">${fmt.esc(titel)}</div>
            <div class="page-subtitle">${fmt.esc(untertitel)}</div>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;gap:8px;margin-bottom:14px">
            <input id="neu-name" placeholder="${fmt.esc(platzhalter)}" style="flex:1;padding:8px 11px;border:0.5px solid var(--border);border-radius:var(--radius)">
            <button class="btn btn-primary btn-sm" id="btn-add">Hinzufügen</button>
          </div>
          <div id="liste">${rows || '<p style="color:var(--text-muted);font-size:13px">Noch keine Einträge.</p>'}</div>
        </div>
      </div>`);

    const refresh = () => Router.navigate(location.hash);
    view.querySelector('#btn-add')!.addEventListener('click', async () => {
      const input = view.querySelector('#neu-name') as HTMLInputElement;
      const name = input.value.trim();
      if (!name) return;
      try { await API.post(apiPath, { name }); refresh(); }
      catch (e: any) { alert(e.message); }
    });
    (view.querySelector('#neu-name') as HTMLInputElement).addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') (view.querySelector('#btn-add') as HTMLButtonElement).click();
    });
    view.querySelectorAll('[data-del]').forEach((b: any) => b.addEventListener('click', async () => {
      if (!confirm('Eintrag löschen?')) return;
      try { await API.del(apiPath + '/' + b.dataset.del); refresh(); }
      catch (e: any) { alert(e.message); }
    }));

    root.innerHTML = '';
    root.appendChild(view);
  };
}

/* ---------------------- Unternehmen ---------------------- */
/* Vollständige Unternehmens-Stammdaten: Firma & Adresse, Register-
   eintrag, Steuern, Zoll, Geschäftsführung (mehrere Personen) und
   Bankverbindungen (mehrere Konten, IBAN mit Prüfziffernvalidierung,
   genau ein Standardkonto). Das Land (DE/CH) blendet länderspezifische
   Felder um: Registergericht/Handelsregisteramt, USt-IdNr./MWST-Nr.,
   Steuernummer (DE), UID + ZAZ-Konto (CH). Diese Daten sind die Quelle
   für Branding, Rechnungsangaben und Dokumente (Absender). */
async function unternehmenPage(root: HTMLElement): Promise<void> {
  const [f, sprachen] = await Promise.all([
    API.get('/api/konfiguration/firma'),
    API.get('/api/stammdaten/sprachen'),
  ]);
  const v = (key: string) => fmt.esc(f[key] ?? '');
  const istCH = () => (root.querySelector('#fs-land') as HTMLSelectElement)?.value === 'CH';

  const gfRow = (g: any = {}) => `
    <div class="liste-row gf-row" data-id="${g.id ?? ''}">
      <input class="gf-name" placeholder="Name" value="${fmt.esc(g.name ?? '')}" style="flex:2">
      <input class="gf-funktion" placeholder="Funktion (z. B. Geschäftsführer)" value="${fmt.esc(g.funktion ?? '')}" style="flex:2">
      <button class="act-btn danger row-del" title="Entfernen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
    </div>`;
  const bankRow = (b: any = {}) => `
    <div class="liste-row bank-row" data-id="${b.id ?? ''}">
      <input class="bank-bezeichnung" placeholder="Bezeichnung / Bank" value="${fmt.esc(b.bezeichnung ?? '')}" style="flex:2">
      <input class="bank-iban" placeholder="IBAN" value="${fmt.esc(b.iban ?? '')}" style="flex:3">
      <input class="bank-bic" placeholder="BIC (optional)" value="${fmt.esc(b.bic ?? '')}" style="flex:1.5">
      <label class="chk bank-std-label" title="Standardkonto für Dokumente"><input type="radio" name="bank-standard" class="bank-standard" ${b.ist_standard ? 'checked' : ''}> Standard</label>
      <button class="act-btn danger row-del" title="Entfernen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
    </div>`;

  const view = el(`
    <div>
      <div class="page-header">
        <div>
          <div class="page-title">Unternehmen</div>
          <div class="page-subtitle">Stammdaten des Betriebs — Grundlage für Branding, Rechnungsangaben und Dokumente.</div>
        </div>
      </div>

      <div class="card">
        <div class="form-grid">
          <div class="form-section">Firma &amp; Adresse</div>
          <div class="field"><label>Firmenname <span class="req">*</span></label><input data-field="firmenname" value="${v('firmenname')}"></div>
          <div class="field"><label>Rechtsform</label><input data-field="rechtsform" value="${v('rechtsform')}" placeholder="z. B. GmbH, AG, e. K."></div>
          <div class="field full"><label>Strasse &amp; Hausnummer</label><input data-field="strasse" value="${v('strasse')}"></div>
          <div class="field"><label>PLZ</label><input data-field="plz" value="${v('plz')}"></div>
          <div class="field"><label>Ort</label><input data-field="ort" value="${v('ort')}"></div>
          <div class="field"><label>Land</label>
            <select data-field="land" id="fs-land">
              <option value="DE" ${f.land === 'DE' ? 'selected' : ''}>Deutschland</option>
              <option value="CH" ${f.land === 'CH' ? 'selected' : ''}>Schweiz</option>
            </select>
          </div>
          <div class="field"><label>Bezugswährung</label><input id="fs-waehrung" value="${f.waehrung}" disabled></div>
          <div class="field"><label>Standard-Belegsprache</label>
            <select data-field="standard_sprache">
              ${sprachen.map((s: any) => `<option value="${s.code}" ${(f.standard_sprache || 'de') === s.code ? 'selected' : ''}>${fmt.esc(s.name)}</option>`).join('')}
            </select>
          </div>

          <div class="form-section">Registereintrag</div>
          <div class="field"><label>Handelsregisternummer</label><input data-field="handelsregister_nummer" value="${v('handelsregister_nummer')}" placeholder="z. B. HRB 12345 / CH-…"></div>
          <div class="field"><label id="lbl-register">Registergericht</label><input data-field="register_stelle" value="${v('register_stelle')}"></div>

          <div class="form-section">Steuern</div>
          <div class="field"><label id="lbl-mwst">USt-IdNr.</label><input data-field="mwst_id" value="${v('mwst_id')}"></div>
          <div class="field land-de"><label>Steuernummer</label><input data-field="steuernummer" value="${v('steuernummer')}"></div>
          <div class="field land-ch"><label>UID</label><input data-field="uid_nummer" value="${v('uid_nummer')}" placeholder="CHE-123.456.789"></div>

          <div class="form-section">Zoll</div>
          <div class="field"><label>EORI-Nummer</label><input data-field="eori_nummer" value="${v('eori_nummer')}" placeholder="DE… / bei EU-Export"></div>
          <div class="field land-ch"><label>ZAZ-Konto</label><input data-field="zaz_konto" value="${v('zaz_konto')}" placeholder="Zahlungsverfahren der Zollverwaltung"></div>
          <div class="field full"><label>Präferenzberechtigungen / Bewilligungsnummern</label><textarea data-field="praeferenz_bewilligungen" placeholder="z. B. Ermächtigter Ausführer DE/1234/EA">${v('praeferenz_bewilligungen')}</textarea></div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="font-size:14px;margin:0">Geschäftsführung</h2>
          <button class="btn btn-sm" id="gf-add" type="button">＋ Person</button>
        </div>
        <div id="gf-liste">${(f.geschaeftsfuehrung ?? []).map(gfRow).join('')}</div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="font-size:14px;margin:0">Bankverbindungen</h2>
          <button class="btn btn-sm" id="bank-add" type="button">＋ Bankverbindung</button>
        </div>
        <div id="bank-liste">${(f.banken ?? []).map(bankRow).join('')}</div>
      </div>

      <div style="margin-top:16px">
        <button class="btn btn-primary" id="fs-speichern">Speichern</button>
        <span id="fs-status" style="margin-left:10px;font-size:13px;color:var(--text-muted)"></span>
      </div>
    </div>`);

  // Länderspezifische Felder und Labels umschalten
  const land = view.querySelector('#fs-land') as HTMLSelectElement;
  function landAnwenden(): void {
    const ch = land.value === 'CH';
    (view.querySelector('#fs-waehrung') as HTMLInputElement).value = ch ? 'CHF' : 'EUR';
    (view.querySelector('#lbl-register') as HTMLElement).textContent = ch ? 'Handelsregisteramt' : 'Registergericht';
    (view.querySelector('#lbl-mwst') as HTMLElement).textContent = ch ? 'MWST-Nr.' : 'USt-IdNr.';
    view.querySelectorAll('.land-de').forEach((n: any) => (n.hidden = ch));
    view.querySelectorAll('.land-ch').forEach((n: any) => (n.hidden = !ch));
  }
  land.addEventListener('change', landAnwenden);
  landAnwenden();

  // Zeilen hinzufügen/entfernen (Delegation fängt auch neue Zeilen)
  view.querySelector('#gf-add')!.addEventListener('click', () =>
    view.querySelector('#gf-liste')!.insertAdjacentHTML('beforeend', gfRow()));
  view.querySelector('#bank-add')!.addEventListener('click', () =>
    view.querySelector('#bank-liste')!.insertAdjacentHTML('beforeend', bankRow()));
  view.addEventListener('click', (e) => {
    const del = (e.target as HTMLElement).closest('.row-del');
    if (del) del.closest('.liste-row')!.remove();
  });

  view.querySelector('#fs-speichern')!.addEventListener('click', async () => {
    const d: any = fieldVals(view);
    d.geschaeftsfuehrung = [...view.querySelectorAll('.gf-row')].map((r: any) => ({
      id: r.dataset.id ? Number(r.dataset.id) : null,
      name: r.querySelector('.gf-name').value,
      funktion: r.querySelector('.gf-funktion').value,
    })).filter((g) => g.name.trim() !== '' || g.funktion.trim() !== '');
    d.banken = [...view.querySelectorAll('.bank-row')].map((r: any) => ({
      id: r.dataset.id ? Number(r.dataset.id) : null,
      bezeichnung: r.querySelector('.bank-bezeichnung').value,
      iban: r.querySelector('.bank-iban').value,
      bic: r.querySelector('.bank-bic').value,
      ist_standard: r.querySelector('.bank-standard').checked,
    })).filter((b) => b.iban.trim() !== '' || b.bezeichnung.trim() !== '');
    try {
      await API.put('/api/konfiguration/firma', d);
      updateBranding({ firmenname: d.firmenname });
      const status = view.querySelector('#fs-status') as HTMLElement;
      status.textContent = 'Gespeichert.';
      setTimeout(() => (status.textContent = ''), 2500);
      Router.navigate('#unternehmen'); // frisch laden (IDs neuer Zeilen)
    } catch (e: any) { alert(e.message); }
  });

  root.innerHTML = '';
  root.appendChild(view);
}
Router.register('unternehmen', unternehmenPage);

// Hinweis: Die frühere "Rollen"-Seite verwaltete Mitarbeiter-FUNKTIONSrollen
// (Tabelle "rollen", hängt am Arbeitszeitmodell). Das neue Submodul "Rollen"
// (src/rollen.ts) sind BERECHTIGUNGSrollen — ein anderes Konzept. Die
// Funktionsrollen-Verwaltung wird später an passender Stelle wieder
// angebunden; die Daten bleiben erhalten.

Router.register('arbeitszeitmodelle', listPage(
  'Arbeitszeitmodelle',
  'Frei definierbare Arbeitszeitmodelle für die Anstellung.',
  '/api/konfiguration/arbeitszeitmodelle',
  'Neues Arbeitszeitmodell … (z. B. Vollzeit 42 h)',
));
