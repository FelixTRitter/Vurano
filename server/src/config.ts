/**
 * ZENTRALE KONFIGURATION
 * ---------------------------------------------------------------
 * Alle Laufzeit-Einstellungen an einem Ort, gespeist aus
 * Umgebungsvariablen (.env, siehe .env.example). Neue Einstellungen
 * IMMER hier ergänzen — nie process.env direkt in Modulen lesen.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://erp:erp@127.0.0.1:5432/erp',
  sessionTtlHours: 12,
  /** Ablage für hochgeladene Dokumente — bewusst AUSSERHALB von client/dist,
      wird nie statisch ausgeliefert, nur über geprüfte Endpunkte. */
  uploadsDir: process.env.UPLOADS_DIR ?? 'data/uploads',
};
