-- Ausbau der Firmen-Stammdaten zum Submodul "Unternehmen":
-- Registereintrag, Steuern (MWST-ID, Steuernummer DE, UID CH), Zoll
-- (EORI, ZAZ-Konto CH, Präferenz-/Bewilligungsnummern) sowie
-- Geschäftsführung und Bankverbindungen als eigene Tabellen.
-- Banken haben stabile IDs, weil Rechnungen/Zahlungsläufe später
-- darauf verweisen; ist_standard markiert das Konto für Dokumente.

ALTER TABLE firma_stammdaten ADD COLUMN handelsregister_nummer TEXT;
ALTER TABLE firma_stammdaten ADD COLUMN register_stelle TEXT;        -- DE: Registergericht, CH: Handelsregisteramt
ALTER TABLE firma_stammdaten ADD COLUMN mwst_id TEXT;                -- DE: USt-IdNr., CH: MWST-Nr. (CHE-… MWST)
ALTER TABLE firma_stammdaten ADD COLUMN steuernummer TEXT;           -- nur DE
ALTER TABLE firma_stammdaten ADD COLUMN uid_nummer TEXT;             -- nur CH (CHE-xxx.xxx.xxx)
ALTER TABLE firma_stammdaten ADD COLUMN zaz_konto TEXT;              -- nur CH, optional (Zahlungsverfahren, kein EORI-Pendant)
ALTER TABLE firma_stammdaten ADD COLUMN eori_nummer TEXT;            -- DE Pflichtfall; CH bei EU-Export
ALTER TABLE firma_stammdaten ADD COLUMN praeferenz_bewilligungen TEXT; -- z. B. Ermächtigter Ausführer, Bewilligungsnummern

CREATE TABLE firma_geschaeftsfuehrung (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  funktion TEXT
);

CREATE TABLE firma_banken (
  id           BIGSERIAL PRIMARY KEY,
  bezeichnung  TEXT,
  iban         TEXT NOT NULL,
  bic          TEXT,
  ist_standard BOOLEAN NOT NULL DEFAULT FALSE
);
