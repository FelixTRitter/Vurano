/**
 * CRUD-DOKUMENTATION (Konfiguration > CRUD-Dokumentation)
 * ---------------------------------------------------------------
 * Betrachtungstool für das zentrale Änderungsprotokoll (audit_log).
 * Man wählt ein Modul/Submodul; darunter erscheinen dessen Protokoll-
 * einträge (wer/wann/Aktion) mit ausklappbarem Vorher/Nachher-Vergleich.
 * Rein lesend. Nur für Administratoren erreichbar.
 */
import { API, fmt, el } from './ic/helpers.js';
import { Router } from './ic/router.js';

const AKTION_LABEL: Record<string, string> = { create: 'Angelegt', update: 'Geändert', delete: 'Gelöscht' };

async function renderCrudDoku(root: HTMLElement): Promise<void> {
  const module = await API.get('/api/crud-doku/module');
  const optionen = ['<option value="">– Modul wählen –</option>']
    .concat(module.map((m: any) => `<option value="${m.key}">${fmt.esc(m.label)}</option>`)).join('');

  const view = el(`
    <div>
      <div class="page-header"><div>
        <div class="page-title">CRUD-Dokumentation</div>
        <div class="page-subtitle">Änderungsverlauf: wer hat wann welchen Datensatz angelegt, geändert oder gelöscht.</div>
      </div></div>
      <div class="card">
        <div class="filter-bar">
          <select id="cd-modul" style="min-width:220px">${optionen}</select>
          <input id="cd-suche" placeholder="Suche (Name, Wert …)" style="flex:1;min-width:180px">
          <input id="cd-datensatz" placeholder="Datensatz-ID" style="width:130px">
        </div>
        <div id="cd-ergebnis"><p class="sub" style="color:var(--text-muted)">Bitte ein Modul wählen.</p></div>
      </div>
    </div>`);

  const modulSel = view.querySelector('#cd-modul') as HTMLSelectElement;
  const sucheInp = view.querySelector('#cd-suche') as HTMLInputElement;
  const dsInp = view.querySelector('#cd-datensatz') as HTMLInputElement;
  const ergebnis = view.querySelector('#cd-ergebnis') as HTMLElement;

  const lade = async () => {
    const key = modulSel.value;
    if (!key) { ergebnis.innerHTML = '<p class="sub" style="color:var(--text-muted)">Bitte ein Modul wählen.</p>'; return; }
    const p = new URLSearchParams();
    if (sucheInp.value.trim()) p.set('suche', sucheInp.value.trim());
    if (dsInp.value.trim()) p.set('datensatz_id', dsInp.value.trim());
    ergebnis.innerHTML = '<p class="sub" style="color:var(--text-muted)">Lädt …</p>';
    let eintraege: any[];
    try { eintraege = await API.get('/api/crud-doku/' + key + (p.toString() ? '?' + p.toString() : '')); }
    catch (e: any) { ergebnis.innerHTML = `<p class="sub" style="color:var(--negative)">${fmt.esc(e.message)}</p>`; return; }
    if (!eintraege.length) { ergebnis.innerHTML = '<p class="sub" style="color:var(--text-muted)">Keine Einträge gefunden.</p>'; return; }

    ergebnis.innerHTML = `
      <table class="data cd-tabelle">
        <thead><tr><th>Zeitpunkt</th><th>Aktion</th><th>Benutzer</th><th>Tabelle</th><th>Datensatz</th><th></th></tr></thead>
        <tbody>${eintraege.map((e, i) => `
          <tr class="cd-zeile" data-i="${i}">
            <td>${fmt.esc(new Date(e.zeitpunkt).toLocaleString('de-CH'))}</td>
            <td><span class="cd-aktion cd-${e.aktion}">${AKTION_LABEL[e.aktion] || e.aktion}</span></td>
            <td>${fmt.esc(e.user_name || '—')}</td>
            <td>${fmt.esc(e.tabelle)}</td>
            <td>${fmt.esc(String(e.datensatz_id))}</td>
            <td><button class="act-btn" data-diff="${i}" title="Details">▾</button></td>
          </tr>
          <tr class="cd-detail" data-detail="${i}" hidden><td colspan="6"><pre class="cd-diff">${fmt.esc(diffText(e))}</pre></td></tr>
        `).join('')}</tbody>
      </table>`;

    ergebnis.querySelectorAll('[data-diff]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = (b as HTMLElement).dataset.diff;
        const zeile = ergebnis.querySelector(`[data-detail="${i}"]`) as HTMLElement;
        zeile.hidden = !zeile.hidden;
        (b as HTMLElement).textContent = zeile.hidden ? '▾' : '▴';
      }));
  };

  modulSel.addEventListener('change', lade);
  let deb: any;
  const entprellt = () => { clearTimeout(deb); deb = setTimeout(lade, 400); };
  sucheInp.addEventListener('input', entprellt);
  dsInp.addEventListener('input', entprellt);

  root.innerHTML = '';
  root.appendChild(view);
}

/** Erzeugt einen lesbaren Vorher/Nachher-Vergleich (nur geänderte Felder). */
function diffText(e: any): string {
  const vor = e.vorher || {};
  const nach = e.nachher || {};
  if (e.aktion === 'create') return 'Angelegt mit:\n' + felderText(nach);
  if (e.aktion === 'delete') return 'Gelöscht (Stand vorher):\n' + felderText(vor);
  // update: nur geänderte Felder zeigen
  const keys = new Set([...Object.keys(vor), ...Object.keys(nach)]);
  const zeilen: string[] = [];
  for (const k of keys) {
    const a = JSON.stringify(vor[k]);
    const b = JSON.stringify(nach[k]);
    if (a !== b) zeilen.push(`${k}: ${a ?? '–'} → ${b ?? '–'}`);
  }
  return zeilen.length ? zeilen.join('\n') : '(keine inhaltliche Änderung erfasst)';
}

function felderText(obj: Record<string, unknown>): string {
  return Object.entries(obj).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
}

Router.register('crud-doku', renderCrudDoku);

export { renderCrudDoku };
