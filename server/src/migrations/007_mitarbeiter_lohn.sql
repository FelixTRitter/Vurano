-- Länderrichtige Lohn-/Steuererfassung pro Mitarbeiter:
-- sv_land = Versicherungsland des Arbeitsverhältnisses (Erwerbsortprinzip,
-- NICHT Wohnort/Firmensitz — Grenzgänger!). Es steuert:
--   CH: AHV-Nummer, Bewilligung B/C/G/L/F/N, Quellensteuerpflicht
--   DE: SV-Nummer, Aufenthaltstitel, Steuer-ID + Steuerklasse (I-VI)
-- kontoinhaber: Lohnzahlung auf abweichendes Konto (zulässig, aber zu
-- dokumentieren). ahv_nummer bleibt das gemeinsame Feld für AHV-/SV-Nummer.
ALTER TABLE mitarbeiter ADD COLUMN sv_land TEXT CHECK (sv_land IN ('DE', 'CH'));
ALTER TABLE mitarbeiter ADD COLUMN steuer_id TEXT;      -- DE: Steuerliche Identifikationsnummer
ALTER TABLE mitarbeiter ADD COLUMN steuerklasse TEXT;   -- DE: I-VI
ALTER TABLE mitarbeiter ADD COLUMN kontoinhaber TEXT;   -- falls abweichend vom Mitarbeiter
