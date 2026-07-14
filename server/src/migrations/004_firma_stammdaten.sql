-- Stammdaten der Handwerksfirma (genau EINE Zeile, Singleton).
-- land (DE/CH) steuert Bezugswährung (EUR/CHF) und länderspezifische
-- Erfassung (z. B. Sozialversicherungsnummer vs. AHV-Nummer beim
-- Mitarbeiter). Wird später für Dokumente (Absender) etc. herangezogen.
CREATE TABLE firma_stammdaten (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id), -- erzwingt genau eine Zeile
  firmenname TEXT NOT NULL DEFAULT '',
  rechtsform TEXT,
  strasse    TEXT,
  plz        TEXT,
  ort        TEXT,
  land       TEXT NOT NULL DEFAULT 'DE' CHECK (land IN ('DE', 'CH'))
);
INSERT INTO firma_stammdaten (id) VALUES (TRUE);
