-- Adressverwaltung v1u-Ausbau.
-- Personen: Abteilung, Sprache (Mobil/E-Mail existieren bereits).
-- Firmen: Steuer-/Registerangaben analog Modul Unternehmen.
-- Ansprechpartner-Rolle: Eine PERSON wird über kontakte.firma_id einer
-- Firma zugeordnet (kein zweites Datenmodell — dieselbe Person bleibt
-- eine Person). Die GESCHÄFTLICHEN Kontaktdaten in dieser Rolle (Position,
-- Firmen-E-Mail, Durchwahl) gehören an die BEZIEHUNG, nicht an die Person,
-- damit private Felder frei bleiben können und dieselbe Person theoretisch
-- mehreren Firmen zugeordnet werden könnte.
ALTER TABLE kontakte ADD COLUMN abteilung TEXT;         -- Person: Freitext
ALTER TABLE kontakte ADD COLUMN sprache TEXT;           -- Person: Korrespondenzsprache
ALTER TABLE kontakte ADD COLUMN position TEXT;          -- Person in Firmen-Rolle: Funktion
ALTER TABLE kontakte ADD COLUMN firma_email TEXT;       -- geschäftliche E-Mail in der Rolle
ALTER TABLE kontakte ADD COLUMN firma_telefon TEXT;     -- Durchwahl in der Rolle

ALTER TABLE kontakte ADD COLUMN ust_id TEXT;            -- Firma: USt-IdNr. / MWST-Nr.
ALTER TABLE kontakte ADD COLUMN steuernummer TEXT;      -- Firma
ALTER TABLE kontakte ADD COLUMN handelsregister_nummer TEXT; -- Firma
ALTER TABLE kontakte ADD COLUMN registergericht TEXT;   -- Firma
ALTER TABLE kontakte ADD COLUMN eori_nummer TEXT;       -- Firma
