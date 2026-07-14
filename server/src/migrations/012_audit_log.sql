-- ZENTRALES ÄNDERUNGSPROTOKOLL (CRUD-Audit)
-- ---------------------------------------------------------------
-- Eine einzige Tabelle, in die JEDE Änderung an JEDER fachlichen Tabelle
-- fließt: wer, wann, welche Tabelle, welcher Datensatz, welche Aktion und
-- der Datenstand vorher/nachher. Wird anwendungsseitig befüllt (der
-- eingeloggte User steht in req.user). Ein späteres, separates Betrachtungs-
-- programm liest ausschließlich aus dieser Tabelle (Tabelle wählen ->
-- Datensatz suchen -> Verlauf ansehen); es schreibt hier nichts.
--
-- Bewusst NICHT an die Fachtabellen gekoppelt (keine Foreign Keys), damit
-- das Protokoll erhalten bleibt, auch wenn ein Datensatz gelöscht wird.
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tabelle     TEXT        NOT NULL,          -- z. B. 'kontakte', 'mitarbeiter'
  datensatz_id TEXT       NOT NULL,          -- PK des betroffenen Datensatzes (als Text, tabellenübergreifend)
  aktion      TEXT        NOT NULL CHECK (aktion IN ('create', 'update', 'delete')),
  user_id     INTEGER,                       -- wer (users.id); NULL bei Systemaktionen
  user_name   TEXT,                          -- Klartextname zum Zeitpunkt der Änderung (bleibt lesbar, auch wenn User später umbenannt/gelöscht wird)
  zeitpunkt   TIMESTAMPTZ NOT NULL DEFAULT now(),
  vorher      JSONB,                         -- Datenstand vor der Änderung (NULL bei create)
  nachher     JSONB                          -- Datenstand nach der Änderung (NULL bei delete)
);

-- Indizes für die spätere Suche im Betrachtungsprogramm:
CREATE INDEX audit_log_tabelle_datensatz_idx ON audit_log (tabelle, datensatz_id, zeitpunkt DESC);
CREATE INDEX audit_log_user_idx              ON audit_log (user_id, zeitpunkt DESC);
CREATE INDEX audit_log_zeitpunkt_idx         ON audit_log (zeitpunkt DESC);
