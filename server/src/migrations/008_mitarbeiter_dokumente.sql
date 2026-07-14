-- Personalakte: Dokumente je Mitarbeiter (DSGVO-relevant).
-- speicher_name = Zufallsname auf der Festplatte (nie der Originalname,
-- keine Rückschlüsse, keine Kollisionen); Auslieferung NUR über
-- authentifizierte Endpunkte, nie statisch. ordner = einfache logische
-- Ablagestruktur. Löschanträge (Art. 17 DSGVO vs. Aufbewahrungspflichten)
-- werden mit Antragsteller und Zeitpunkt dokumentiert und vom Büro geprüft.
CREATE TABLE mitarbeiter_dokumente (
  id              BIGSERIAL PRIMARY KEY,
  mitarbeiter_id  BIGINT NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,
  dateiname       TEXT NOT NULL,
  ordner          TEXT NOT NULL DEFAULT 'Allgemein',
  mime            TEXT,
  groesse         BIGINT NOT NULL DEFAULT 0,
  speicher_name   TEXT NOT NULL UNIQUE,
  hochgeladen_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  loeschantrag    BOOLEAN NOT NULL DEFAULT FALSE,
  loeschantrag_von BIGINT REFERENCES users(id) ON DELETE SET NULL,
  loeschantrag_am TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ma_dok_ma_idx ON mitarbeiter_dokumente(mitarbeiter_id);
