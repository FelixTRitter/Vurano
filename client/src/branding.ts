/**
 * BRANDING (Topbar links)
 * ---------------------------------------------------------------
 * Zeigt links oben Logo und Namen des Handwerksunternehmens aus den
 * Stammdaten Firma (Konfiguration). Solange dort kein Firmenname
 * gepflegt ist: Vurano-Logo + "Vurano ERP" als Fallback.
 * Logo des Unternehmens: vorerst Initialen des Firmennamens im
 * Farbschema-Kasten; ein Logo-Upload folgt in einer späteren Version.
 *
 * updateBranding(firma) nach dem Login (main.ts) und nach dem
 * Speichern der Stammdaten (konfiguration.ts) aufrufen.
 */
export function updateBranding(firma: { firmenname?: string } | null): void {
  const nameEl = document.getElementById('firm-name');
  const logoEl = document.getElementById('firm-logo');
  if (!nameEl || !logoEl) return;
  const name = firma?.firmenname?.trim();
  if (name) {
    nameEl.textContent = name;
    const initialen = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    logoEl.classList.remove('brand-logo-img');
    logoEl.textContent = initialen;
  } else {
    nameEl.textContent = 'Vurano ERP';
    logoEl.classList.add('brand-logo-img');
    logoEl.innerHTML = '<img src="/favicon.svg" alt="Vurano">';
  }
}
