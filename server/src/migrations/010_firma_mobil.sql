-- Geschäftliche Mobilnummer eines Ansprechpartners (Rolle an der Firma),
-- getrennt von der privaten Mobilnummer der Person (kontakte.mobil).
ALTER TABLE kontakte ADD COLUMN firma_mobil TEXT;
