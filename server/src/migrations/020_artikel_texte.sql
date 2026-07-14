-- ARTIKELTEXTE JE SPRACHE (Übersetzungsspeicher) + Umbenennung Produktionsdauer
-- ---------------------------------------------------------------
-- 1) "Fertigungsdauer" heisst fachlich Produktionsdauer (passend zum Reiter
--    "Produktion" im Artikeldetail).
ALTER TABLE artikel RENAME COLUMN fertigungsdauer TO produktionsdauer;

-- 2) Verkaufs- und LV-Text werden mehrsprachig. Bisher lagen sie direkt am
--    Artikel; ab jetzt in einer eigenen Tabelle JE SPRACHE. artikel.sprache_code
--    bleibt und markiert die ORIGINALSPRACHE (in der der Text verfasst wurde).
--
--    quelle dokumentiert die Herkunft:
--      'original' = in der Originalsprache verfasst
--      'ki'       = automatisch übersetzter Entwurf (noch nicht geprüft)
--      'manuell'  = von Hand verfasst oder eine KI-Übersetzung nachbearbeitet
--    Damit sieht man später, welche Übersetzungen noch ungeprüft sind.
--
--    Die gespeicherte Übersetzung IST der Cache: Ist ein Text für eine Sprache
--    vorhanden, wird er geladen — es entsteht kein erneuter KI-Aufruf.
CREATE TABLE artikel_texte (
  artikel_id      BIGINT NOT NULL REFERENCES artikel(id) ON DELETE CASCADE,
  sprache_code    TEXT   NOT NULL,
  verkaufstext    TEXT,
  lv_text         TEXT,
  quelle          TEXT   NOT NULL DEFAULT 'manuell'
                    CHECK (quelle IN ('original', 'ki', 'manuell')),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artikel_id, sprache_code)
);

-- Originalsprache sicherstellen, bevor die Texte umgezogen werden.
UPDATE artikel SET sprache_code = 'de' WHERE sprache_code IS NULL OR sprache_code = '';

-- Bestehende Texte verlustfrei in die neue Tabelle übernehmen (als Original).
INSERT INTO artikel_texte (artikel_id, sprache_code, verkaufstext, lv_text, quelle)
SELECT id, sprache_code, verkaufstext, lv_text, 'original'
  FROM artikel
 WHERE verkaufstext IS NOT NULL OR lv_text IS NOT NULL;

ALTER TABLE artikel DROP COLUMN verkaufstext;
ALTER TABLE artikel DROP COLUMN lv_text;
