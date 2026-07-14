/**
 * ADRESS-AUTOVERVOLLSTÄNDIGUNG — Endpunkt
 * ---------------------------------------------------------------
 * GET /api/adressen/suche?q=...  -> Liste von Adressvorschlägen.
 * Der Server ist bewusst als PROXY vorgeschaltet (statt Direktaufruf aus
 * dem Browser): So bleibt ein etwaiger API-Schlüssel geheim, Rate-Limiting
 * und Caching sind möglich, und bei selbst gehostetem Photon verlässt keine
 * Eingabe des Anwenders den eigenen Server.
 */
import { Router } from 'express';
import { adressVorschlaege } from './provider.js';

export const adressenRouter = Router();

// einfache In-Memory-Zwischenspeicherung gleicher Anfragen (5 Minuten)
const cache = new Map<string, { zeit: number; daten: unknown }>();
const CACHE_MS = 5 * 60 * 1000;

adressenRouter.get('/suche', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) return res.json([]); // erst ab 3 Zeichen suchen
  const key = q.toLowerCase();
  const treffer = cache.get(key);
  if (treffer && Date.now() - treffer.zeit < CACHE_MS) return res.json(treffer.daten);
  try {
    const daten = await adressVorschlaege(q);
    cache.set(key, { zeit: Date.now(), daten });
    res.json(daten);
  } catch {
    // Fehler des externen Dienstes nicht als 500 durchreichen — das Formular
    // soll bei Ausfall einfach ohne Vorschläge weiter benutzbar bleiben.
    res.json([]);
  }
});
