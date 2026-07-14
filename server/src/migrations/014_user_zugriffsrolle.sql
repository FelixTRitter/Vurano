-- USER -> ZUGRIFFSROLLE (Ablösung der hartcodierten users.role)
-- ---------------------------------------------------------------
-- Bisher wählte die User-Verwaltung eine Zugriffsrolle aus einer fest im
-- Code verdrahteten Liste (admin/buero/monteur). Ab jetzt verweist jeder
-- User auf einen Datensatz in berechtigungsrollen (frei verwaltbar).
--
-- Übergang: users.role bleibt VORERST bestehen und wird synchron gehalten,
-- weil die vielen requireRole('admin','buero')-Prüfungen darauf aufsetzen.
-- Die "ist_admin"-Rolle entspricht role='admin'; sonstige Rollen erhalten
-- role='buero' als sicheres Nicht-Admin-Äquivalent, bis die Modulrechte die
-- Prüfungen vollständig übernehmen.

-- Die zuvor hartcodierten Rollen als echte, frei verwaltbare Datensätze
-- anlegen (Administrator existiert bereits aus Migration 013).
INSERT INTO berechtigungsrollen (name) VALUES ('Büro')    ON CONFLICT (name) DO NOTHING;
INSERT INTO berechtigungsrollen (name) VALUES ('Monteur') ON CONFLICT (name) DO NOTHING;

ALTER TABLE users ADD COLUMN zugriffsrolle_id BIGINT REFERENCES berechtigungsrollen(id);

-- Bestandsuser den passenden Rollen zuordnen (anhand der bisherigen role).
UPDATE users SET zugriffsrolle_id = (SELECT id FROM berechtigungsrollen WHERE ist_admin = TRUE LIMIT 1)
  WHERE role = 'admin';
UPDATE users SET zugriffsrolle_id = (SELECT id FROM berechtigungsrollen WHERE name = 'Büro')
  WHERE role = 'buero';
UPDATE users SET zugriffsrolle_id = (SELECT id FROM berechtigungsrollen WHERE name = 'Monteur')
  WHERE role = 'monteur';
-- Fallback: alles ohne Zuordnung auf Büro (sicheres Nicht-Admin-Default).
UPDATE users SET zugriffsrolle_id = (SELECT id FROM berechtigungsrollen WHERE name = 'Büro')
  WHERE zugriffsrolle_id IS NULL;
