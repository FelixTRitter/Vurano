-- Fundament: Benutzer, Sessions und die Adressverwaltung (Kontakte).
-- Die Adressverwaltung ist 1:1 aus Immo Control übernommen: Personen & Firmen
-- mit frei verwaltbaren Adressschlüsseln (Mehrfachzuordnung über Join-Tabelle).

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'buero', 'monteur')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE kontakt_kategorien (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE kontakte (
  id           BIGSERIAL PRIMARY KEY,
  typ          TEXT NOT NULL DEFAULT 'person' CHECK (typ IN ('person', 'firma')),
  firma_id     BIGINT REFERENCES kontakte(id) ON DELETE SET NULL,
  anrede       TEXT,
  vorname      TEXT,
  nachname     TEXT,
  firmenname   TEXT,
  strasse      TEXT,
  plz          TEXT,
  ort          TEXT,
  land         TEXT DEFAULT 'Schweiz',
  email        TEXT,
  telefon      TEXT,
  mobil        TEXT,
  website      TEXT,
  geburtsdatum TEXT,
  notizen      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kontakte_firma_idx ON kontakte(firma_id);

CREATE TABLE kontakt_kategorie_map (
  kontakt_id   BIGINT NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,
  kategorie_id BIGINT NOT NULL REFERENCES kontakt_kategorien(id) ON DELETE CASCADE,
  PRIMARY KEY (kontakt_id, kategorie_id)
);

-- Standard-Adressschlüssel (über die UI erweiter- und löschbar)
INSERT INTO kontakt_kategorien (name) VALUES ('Kunde'), ('Lieferant');
