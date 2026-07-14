/**
 * TEILETYPEN — hardcoded (Single Source of Truth im Code)
 * ---------------------------------------------------------------
 * Die festen Artikel-/Teiletypen. Bewusst NICHT als Stammdaten, sondern im
 * Code verankert (zusätzlich abgesichert durch einen CHECK-Constraint in der
 * DB). Reihenfolge = Anzeigereihenfolge.
 */
export const TEILETYPEN = [
  { key: 'verkaufsartikel', label: 'Verkaufsartikel', beispiel: 'z. B. ein Schrank' },
  { key: 'kaufartikel',     label: 'Kaufartikel',     beispiel: 'z. B. Schraube M4x30' },
  { key: 'baugruppe',       label: 'Baugruppe',       beispiel: 'z. B. Schranktüre mit Scharnieren' },
  { key: 'lagerteil',       label: 'Lagerteil',       beispiel: 'selbstgefertigt, aber gelagert' },
  { key: 'meterware',       label: 'Meterware',       beispiel: 'z. B. Profile' },
  { key: 'halbzeug',        label: 'Halbzeug',        beispiel: 'z. B. Eichenbrett 1200x3000x19mm' },
] as const;

export type TeiletypKey = (typeof TEILETYPEN)[number]['key'];
export const TEILETYP_KEYS = new Set(TEILETYPEN.map((t) => t.key));
