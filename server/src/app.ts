/**
 * EXPRESS-APP (Fabrik)
 * ---------------------------------------------------------------
 * Baut die HTTP-Schicht zusammen: JSON-Parser, Benutzer-Auflösung,
 * API-Router der Module, Auslieferung des Client-Builds, zentrale
 * Fehlerbehandlung (Express 5 fängt async-Fehler automatisch).
 *
 * NEUES MODUL EINHÄNGEN (2 Zeilen):
 *   import { xyzRouter } from './modules/xyz/routes.js';
 *   app.use('/api/xyz', requireAuth, xyzRouter);
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachUser, requireAuth } from './auth/middleware.js';
import { authRouter } from './auth/routes.js';
import { kontakteRouter } from './modules/kontakte/routes.js';
import { mitarbeiterRouter } from './modules/mitarbeiter/routes.js';
import { konfigurationRouter } from './modules/konfiguration/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { einstellungenRouter } from './modules/einstellungen/routes.js';
import { selbstauskunftRouter } from './modules/selbstauskunft/routes.js';
import { adressenRouter } from './modules/adressen/routes.js';
import { berechtigungsrollenRouter } from './modules/berechtigungsrollen/routes.js';
import { crudDokuRouter } from './modules/cruddoku/routes.js';
import { stammdatenRouter } from './modules/stammdaten/routes.js';
import { artikelRouter } from './modules/artikel/routes.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  // DIAGNOSE: langsame Requests im Server-Log sichtbar machen.
  // Steht hier bei gefühlter Trägheit NICHTS, liegt die Verzögerung auf dem
  // Transportweg (Vite-Proxy, VPN-Erweiterung, Docker-Portweiterleitung) —
  // steht hier eine Zeile, ist es Server/Datenbank.
  const LANGSAM_AB_MS = 300;
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (ms >= LANGSAM_AB_MS)
        console.warn(`[langsam] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${ms.toFixed(0)} ms`);
    });
    next();
  });

  app.use(attachUser);

  // API — hier hängt jedes Modul seinen Router ein.
  app.use('/api/auth', authRouter);
  app.use('/api/kontakte', requireAuth, kontakteRouter);
  app.use('/api/adressen', requireAuth, adressenRouter);
  app.use('/api/berechtigungsrollen', requireAuth, berechtigungsrollenRouter);
  app.use('/api/crud-doku', requireAuth, crudDokuRouter);
  app.use('/api/stammdaten', requireAuth, stammdatenRouter);
  app.use('/api/artikel', requireAuth, artikelRouter);
  app.use('/api/mitarbeiter', requireAuth, mitarbeiterRouter);
  app.use('/api/konfiguration', requireAuth, konfigurationRouter);
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/einstellungen', requireAuth, einstellungenRouter);
  app.use('/api/selbst', requireAuth, selbstauskunftRouter);
  // Beispiel für das nächste Modul:
  // app.use('/api/auftraege', requireAuth, auftraegeRouter);

  // Produktions-Build des Clients ausliefern (npm run build im Root).
  const clientDist = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../client/dist',
  );
  app.use(express.static(clientDist));

  // Zentrale Fehlerbehandlung: keine Stacktraces an den Client.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      res.status(500).json({ error: 'Interner Serverfehler' });
    },
  );

  return app;
}
