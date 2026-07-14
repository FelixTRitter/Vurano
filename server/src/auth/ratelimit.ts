/**
 * LOGIN-RATE-LIMITING (im Speicher)
 * ---------------------------------------------------------------
 * Schützt Passwort- und Code-Eingabe vor Durchprobieren: pro Schlüssel
 * (IP+Benutzer) maximal N Fehlversuche im Zeitfenster; danach 429.
 * Erfolgreiche Anmeldung setzt den Zähler zurück. Im Speicher gehalten —
 * ausreichend für eine Instanz pro Kunde (Single-Tenant-Modell);
 * bei Mehr-Prozess-Betrieb später auf die Datenbank umstellen.
 */
export function createLimiter({ maxVersuche = 10, fensterMs = 15 * 60_000 } = {}) {
  const versuche = new Map<string, number[]>();
  return {
    blockiert(key: string, jetzt: number = Date.now()): boolean {
      const liste = (versuche.get(key) ?? []).filter((t) => jetzt - t < fensterMs);
      versuche.set(key, liste);
      return liste.length >= maxVersuche;
    },
    fehlversuch(key: string, jetzt: number = Date.now()): void {
      const liste = versuche.get(key) ?? [];
      liste.push(jetzt);
      versuche.set(key, liste);
    },
    erfolg(key: string): void {
      versuche.delete(key);
    },
  };
}
