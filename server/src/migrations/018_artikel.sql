-- ARTIKEL (gemeinsame Tabelle für alle Teiletypen)
-- ---------------------------------------------------------------
-- EINE Tabelle für ALLE Teiletypen (Verkaufsartikel, Kaufartikel, Baugruppen,
-- Lagerteile, Meterware, Halbzeuge). Der Diskriminator ist teiletyp. Das ist
-- die Grundlage für die spätere Stückliste (Bill of Materials): Ein Artikel
-- kann aus mehreren anderen Artikeln bestehen -> eine Kreuztabelle
-- artikel<->artikel (self-referencing), die auf DIESE eine Tabelle zeigt.
-- Jeder Teiletyp bekommt später ein eigenes Submodul, das dieselbe Tabelle
-- nach teiletyp gefiltert anzeigt.
--
-- teiletyp ist HARDCODED (CHECK-Constraint hier + Konstante im Code).
CREATE TABLE artikel (
  id            BIGSERIAL PRIMARY KEY,
  teiletyp      TEXT NOT NULL CHECK (teiletyp IN (
                  'verkaufsartikel', 'kaufartikel', 'baugruppe',
                  'lagerteil', 'meterware', 'halbzeug')),
  artikelnummer TEXT,
  bezeichnung   TEXT NOT NULL,
  verkaufstext  TEXT,                 -- längerer Beschreibungstext (Verkauf)
  lv_text       TEXT,                 -- Leistungsverzeichnis-Text
  einheit_id    BIGINT REFERENCES einheiten(id) ON DELETE SET NULL,
  sprache_code  TEXT,                 -- Sprache, in der Verkaufs-/LV-Text verfasst ist
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Artikelnummer eindeutig, sofern gesetzt (leere/NULL erlaubt Mehrfach).
CREATE UNIQUE INDEX artikel_artikelnummer_idx
  ON artikel(artikelnummer) WHERE artikelnummer IS NOT NULL AND artikelnummer <> '';
CREATE INDEX artikel_teiletyp_idx ON artikel(teiletyp);
