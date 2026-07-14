-- ARTIKEL: Verkaufspreis und Zeitdauern
-- ---------------------------------------------------------------
-- verkaufspreis: aktuell manuell erfasst; sobald die Kalkulation existiert,
--   wird der Wert von dort gespeist (die Kalkulation ist dann die Quelle).
--   NUMERIC(12,2) statt Fliesskomma — bei Geldbeträgen sind Rundungsfehler
--   von float inakzeptabel.
-- Dauern in STUNDEN als Dezimalzahl (z. B. 2.50 = 2 h 30 min). Stunden sind
--   im Handwerk die übliche Bezugsgrösse und multiplizieren sich später
--   direkt mit einem Stundensatz zu Kosten.
ALTER TABLE artikel ADD COLUMN verkaufspreis   NUMERIC(12,2);
ALTER TABLE artikel ADD COLUMN planungsdauer   NUMERIC(10,2);
ALTER TABLE artikel ADD COLUMN fertigungsdauer NUMERIC(10,2);
ALTER TABLE artikel ADD COLUMN montagedauer    NUMERIC(10,2);
