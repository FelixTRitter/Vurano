-- ARTIKEL: Materialkosten
-- ---------------------------------------------------------------
-- Eigenes Attribut (nicht aus dem Verkaufspreis abgeleitet). Wie der
-- Verkaufspreis wird der Wert später aus der Kalkulation gespeist; bis dahin
-- ist er von Hand erfassbar. NUMERIC(12,2) wie alle Geldbeträge — bei Geld
-- sind Fliesskomma-Rundungsfehler inakzeptabel.
ALTER TABLE artikel ADD COLUMN materialkosten NUMERIC(12,2);
