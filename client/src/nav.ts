/**
 * NAVIGATIONSGRUPPEN (Module mit Submodulen)
 * ---------------------------------------------------------------
 * Verhalten der aufklappbaren Gruppen in der Seitennavigation:
 *
 *   - Klick auf den Gruppenkopf klappt die Submodule auf/zu
 *     (Klasse "open"); der Kopf selbst navigiert NIE (kein data-page).
 *   - Ist die GESAMTE Seitennavigation eingeklappt (nur Icons sichtbar),
 *     klappt ein Klick auf einen Gruppenkopf sie zuerst wieder aus und
 *     öffnet dann die Gruppe — sonst blieben die Submodule unsichtbar.
 *   - Der grüne Balken (Klasse "has-active") erscheint nur, wenn ein
 *     Submodul der Gruppe aktiv ist — er zeigt immer an, was im
 *     MainContent sichtbar ist.
 *   - Beim Modulwechsel klappen Gruppen ohne aktives Submodul
 *     automatisch wieder ein.
 *
 * initNavGroups() einmal beim App-Start aufrufen; syncNavGroups()
 * läuft danach automatisch bei jeder Hash-Navigation.
 */
import { Shell } from './ic/router.js';

/** Gruppenzustand mit der aktuellen Navigation synchronisieren. */
export function syncNavGroups(root: ParentNode = document): void {
  root.querySelectorAll('.nav-group').forEach((g) => {
    const hatAktives = !!g.querySelector('.nav-sub-link.active');
    g.classList.toggle('has-active', hatAktives);
    g.classList.toggle('open', hatAktives);
  });
}

/** Klick-Verhalten der Gruppenköpfe binden und Synchronisierung starten. */
export function initNavGroups(root: ParentNode = document): void {
  root.querySelectorAll('.nav-group-head').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gruppe = btn.closest('.nav-group')!;
      // Ist die ganze Navigation eingeklappt? (Klasse an #app ist die
      // maßgebliche Quelle.) Dann zuerst ausklappen, damit die Submodule
      // überhaupt sichtbar/auswählbar werden.
      const eingeklappt = document.getElementById('app')?.classList.contains('nav-collapsed');
      if (eingeklappt) Shell.setCollapsed(false);

      // Akkordeon: soll diese Gruppe geöffnet werden, zuerst ALLE anderen
      // schließen — es ist stets nur eine Gruppe ausgeklappt. Ein erneuter
      // Klick auf die bereits offene Gruppe schließt sie wieder (außer wir
      // haben gerade eben ausgeklappt, dann bleibt sie offen).
      const sollOeffnen = eingeklappt || !gruppe.classList.contains('open');
      root.querySelectorAll('.nav-group.open').forEach((g) => { if (g !== gruppe) g.classList.remove('open'); });
      gruppe.classList.toggle('open', sollOeffnen);
    });
  });
  // Nach jeder Navigation (Router setzt die active-Klassen) nachziehen.
  window.addEventListener('hashchange', () => setTimeout(() => syncNavGroups(root), 0));
}
