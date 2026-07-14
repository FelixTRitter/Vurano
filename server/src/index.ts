/**
 * SERVER-EINSTIEGSPUNKT
 * ---------------------------------------------------------------
 * Ablauf beim Start: 1) ausstehende Migrationen anwenden
 * 2) Express-App bauen (app.ts) 3) auf config.port lauschen.
 * Start lokal: npm run dev (tsx) — produktiv: node dist/index.js
 */
import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { config } from './config.js';

await migrate();
createApp().listen(config.port, () => {
  console.log(`ERP-Server läuft auf http://localhost:${config.port}`);
});
