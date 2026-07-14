-- Mitarbeiterverwaltung: Mitarbeiter, Rollen, Arbeitszeitmodelle,
-- Verknüpfung Benutzer <-> Mitarbeiter.
-- Rollen tragen künftig die Zugriffsberechtigungen auf Module (Ausbau folgt);
-- bis dahin bleibt users.role die technische Zugriffsrolle.

CREATE TABLE rollen (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE arbeitszeitmodelle (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE mitarbeiter (
  id                   BIGSERIAL PRIMARY KEY,
  anrede               TEXT,
  vorname              TEXT,
  nachname             TEXT NOT NULL,
  -- Private Anschrift
  strasse              TEXT,
  land                 TEXT,
  land_code            TEXT,
  plz                  TEXT,
  ort                  TEXT,
  -- Private Kontaktdaten
  telefon              TEXT,
  mobil                TEXT,
  email                TEXT,
  -- Firmenkontaktdaten
  firma_telefon        TEXT,
  firma_email          TEXT,
  -- Anstellung
  rolle_id             BIGINT REFERENCES rollen(id) ON DELETE SET NULL,
  arbeitszeitmodell_id BIGINT REFERENCES arbeitszeitmodelle(id) ON DELETE SET NULL,
  eintritt             TEXT,
  austritt             TEXT,   -- gesetzt = Mitarbeiter inaktiv (ab diesem Datum)
  pensum               NUMERIC, -- in Prozent
  -- Lohn- / steuerrelevante Angaben (CH)
  geburtsdatum         TEXT,
  ahv_nummer           TEXT,
  zivilstand           TEXT,
  staatsangehoerigkeit TEXT,
  aufenthaltsbewilligung TEXT,  -- B/C/G/L …, quellensteuerrelevant
  quellensteuer        BOOLEAN NOT NULL DEFAULT FALSE,
  religion             TEXT,    -- Konfession (Kirchensteuer)
  kinder               INTEGER,
  iban                 TEXT,    -- Lohnzahlung
  notizen              TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mitarbeiter_rolle_idx ON mitarbeiter(rolle_id);

ALTER TABLE users ADD COLUMN mitarbeiter_id BIGINT REFERENCES mitarbeiter(id) ON DELETE SET NULL;
