-- STAMMDATEN: SPRACHEN (Belegsprachen)
-- ---------------------------------------------------------------
-- Verfügbare Sprachen für Belege (Angebote, Rechnungen). Die BEDIENsprache
-- der Software bleibt davon unberührt (deutsch). Hier geht es nur darum, in
-- welcher Sprache ein Beleg ausgestellt werden kann.
--
-- code = ISO 639-1 (de, en, fr …) — wird später für die KI-Übersetzung
-- gebraucht (Zielsprache). name = Anzeigename. sortierung: gängige oben.
-- Vorbefüllt mit den im DACH-/CH-Raum gängigsten Sprachen; erweiterbar,
-- bearbeitbar, löschbar.
CREATE TABLE sprachen (
  id         BIGSERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,   -- ISO 639-1, kleingeschrieben
  name       TEXT NOT NULL,
  sortierung INTEGER NOT NULL DEFAULT 100
);

INSERT INTO sprachen (code, name, sortierung) VALUES
  ('de', 'Deutsch',    10),
  ('en', 'Englisch',   20),
  ('fr', 'Französisch', 30),
  ('it', 'Italienisch', 40);

-- Standard-Belegsprache des Unternehmens (Vorbelegung bei neuen Angeboten).
-- Gehört zu den Firmenstammdaten, nicht in eine eigene Tabelle. Default: de.
ALTER TABLE firma_stammdaten ADD COLUMN standard_sprache TEXT NOT NULL DEFAULT 'de';
