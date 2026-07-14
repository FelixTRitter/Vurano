/**
 * MEINE DATEN (Selbstauskunft, Art. 15 DSGVO)
 * ---------------------------------------------------------------
 * Erreichbar über den User-Button in der Topbar. Zeigt dem
 * angemeldeten Benutzer die Personaldaten und Dokumente des mit ihm
 * verknüpften Mitarbeiters (nur die eigenen!). Dokumente können
 * heruntergeladen werden; Löschen ist bewusst nicht möglich —
 * stattdessen "Löschung beantragen": das Büro sieht den Antrag in
 * der Personalakte und prüft ihn gegen die Aufbewahrungspflichten.
 */
import { API, fmt, el, Modal } from './ic/helpers.js';

export async function openMeineDaten(): Promise<void> {
  const d = await API.get('/api/selbst');
  if (!d.mitarbeiter) {
    Modal.open('Meine Daten', '<p style="color:var(--text-muted)">Ihrem Benutzerkonto ist kein Mitarbeiter zugeordnet. Wenden Sie sich bei Bedarf an die Verwaltung.</p>', { hideOk: true });
    return;
  }
  const m = d.mitarbeiter;
  const kv = (label: string, wert: any) =>
    wert ? `<div class="kv"><span class="kv-label">${label}</span><span class="kv-value">${wert}</span></div>` : '';

  const dokZeile = (dok: any) => `
    <div class="dok-zeile" data-id="${dok.id}">
      <a href="/api/selbst/dokumente/${dok.id}/download" class="dok-name" title="Herunterladen">${fmt.esc(dok.dateiname)}</a>
      ${dok.loeschantrag
        ? '<span class="badge dok-antrag">Löschung beantragt</span>'
        : `<button class="btn btn-sm" data-antrag="${dok.id}" type="button">Löschung beantragen</button>`}
    </div>`;

  const body = el(`
    <div>
      <div class="detail-kv" style="margin-bottom:14px">
        ${kv('Name', fmt.esc([m.anrede, m.vorname, m.nachname].filter(Boolean).join(' ')))}
        ${kv('Rolle', fmt.esc(m.rolle_name || ''))}
        ${kv('Eintritt', fmt.date(m.eintritt))}
        ${kv('Private Anschrift', [m.strasse, [m.plz, m.ort].filter(Boolean).join(' ')].filter(Boolean).map(fmt.esc).join('<br>'))}
        ${kv('E-Mail', fmt.esc(m.email || ''))}
      </div>
      <h3 style="font-size:13px;margin:0 0 8px">Meine Unterlagen</h3>
      ${d.dokumente.length ? d.dokumente.map(dokZeile).join('') : '<p style="color:var(--text-muted);font-size:13px">Keine Unterlagen hinterlegt.</p>'}
      <p class="hinweis" style="margin-top:12px">Nach Art. 15 DSGVO sehen Sie hier die zu Ihrer Person gespeicherten Daten.
      Löschungen führt die Verwaltung nach Prüfung der gesetzlichen Aufbewahrungsfristen durch — Ihr Antrag wird dokumentiert.</p>
    </div>`);

  body.querySelectorAll('[data-antrag]').forEach((b: any) => b.addEventListener('click', async () => {
    if (!confirm('Löschung dieser Datei beantragen? Die Verwaltung prüft den Antrag.')) return;
    try {
      await API.post(`/api/selbst/dokumente/${b.dataset.antrag}/loeschantrag`);
      Modal.close();
      openMeineDaten();
    } catch (e: any) { alert(e.message); }
  }));

  Modal.open('Meine Daten', body, { hideOk: true });
}
