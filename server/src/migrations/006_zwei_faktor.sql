-- Zwei-Faktor-Authentifizierung (TOTP, RFC 6238) — Pflicht für alle Benutzer.
-- totp_secret wird beim ersten Login erzeugt; totp_aktiv erst nach
-- bestätigtem Erst-Code. Sessions kennen einen "pending"-Zustand zwischen
-- Passwort- und Code-Schritt. Vertrauenswürdige Geräte überspringen den
-- Code 30 Tage. Wiederherstellungscodes (nur Admins) liegen gehasht vor.

ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_aktiv BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sessions ADD COLUMN pending BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE users_recovery_codes (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  verwendet BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX recovery_user_idx ON users_recovery_codes(user_id);

CREATE TABLE trusted_devices (
  token      TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX trusted_user_idx ON trusted_devices(user_id);
