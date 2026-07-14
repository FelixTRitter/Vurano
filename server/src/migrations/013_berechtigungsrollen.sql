-- BERECHTIGUNGSROLLEN (Zugriffssteuerung)
-- ---------------------------------------------------------------
-- BEWUSST getrennt von der bestehenden Tabelle "rollen" (das sind
-- Mitarbeiter-FUNKTIONSrollen wie "Elektriker", die am Arbeitszeitmodell
-- hängen). Hier geht es um ZUGRIFFSrollen: welche Rolle darf welches Modul.
--
-- Der Administrator ist eine geschützte Sonderrolle (ist_admin = TRUE):
-- Vollzugriff per Definition, auch auf künftige Module — seine Rechte werden
-- NICHT aus der Zuordnungstabelle gelesen, sondern gelten immer. Deshalb ist
-- er weder löschbar noch in seinen Rechten abwählbar.
CREATE TABLE berechtigungsrollen (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  ist_admin  BOOLEAN NOT NULL DEFAULT FALSE,  -- Sonderrolle mit unabänderlichem Vollzugriff
  system     BOOLEAN NOT NULL DEFAULT FALSE,  -- systemseitig angelegt, nicht löschbar
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zuordnung Rolle -> freigeschaltetes Modul (nur für NICHT-Admin-Rollen
-- relevant; der Admin ignoriert diese Tabelle und hat immer Vollzugriff).
CREATE TABLE rollen_module (
  rolle_id   BIGINT NOT NULL REFERENCES berechtigungsrollen(id) ON DELETE CASCADE,
  modul_key  TEXT   NOT NULL,
  PRIMARY KEY (rolle_id, modul_key)
);

-- Erste (und aktuell einzige) Rolle: Administrator, geschützt.
INSERT INTO berechtigungsrollen (name, ist_admin, system) VALUES ('Administrator', TRUE, TRUE);
