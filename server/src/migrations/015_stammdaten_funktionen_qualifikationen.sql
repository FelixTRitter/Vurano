-- STAMMDATEN: FUNKTIONEN & QUALIFIKATIONEN
-- ---------------------------------------------------------------
-- Die frühere Tabelle "rollen" war die Mitarbeiter-FUNKTIONSrolle (Titel/
-- Stellenbezeichnung wie "Projektleiter"). Sie wird jetzt eindeutig in
-- "funktionen" umbenannt (die Bezeichnung "Rolle" ist seit den Zugriffsrollen
-- doppeldeutig). Zusätzlich kommen QUALIFIKATIONEN (Fähigkeiten/Skills wie
-- "Elektriker", "AutoCAD") als eigene Stammdaten dazu.
--
-- Kardinalität: ein Mitarbeiter hat GENAU EINE Funktion (funktion_id), aber
-- MEHRERE Qualifikationen (n:m über mitarbeiter_qualifikationen).

-- 1) rollen -> funktionen (Tabelle + Fremdschlüsselspalte am Mitarbeiter)
ALTER TABLE rollen RENAME TO funktionen;
ALTER TABLE mitarbeiter RENAME COLUMN rolle_id TO funktion_id;

-- 2) Qualifikationen als Stammdaten
CREATE TABLE qualifikationen (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 3) n:m-Zuordnung Mitarbeiter <-> Qualifikationen
CREATE TABLE mitarbeiter_qualifikationen (
  mitarbeiter_id   BIGINT NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  qualifikation_id BIGINT NOT NULL REFERENCES qualifikationen(id) ON DELETE CASCADE,
  PRIMARY KEY (mitarbeiter_id, qualifikation_id)
);
CREATE INDEX mitarbeiter_qualifikationen_q_idx ON mitarbeiter_qualifikationen(qualifikation_id);
