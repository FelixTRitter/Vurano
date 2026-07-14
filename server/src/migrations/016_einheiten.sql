-- STAMMDATEN: EINHEITEN
-- ---------------------------------------------------------------
-- Mengeneinheiten für spätere Positionen (Angebote, Rechnungen, Material).
-- kuerzel = das, was auf Belegen erscheint (m², Stk, kg); name = optionale
-- ausgeschriebene Bezeichnung. sortierung steuert die Reihenfolge in Listen,
-- damit gängige Einheiten oben stehen statt rein alphabetisch.
-- Wird mit den gängigsten Einheiten vorbefüllt; der User kann erweitern,
-- bearbeiten und löschen.
CREATE TABLE einheiten (
  id         BIGSERIAL PRIMARY KEY,
  kuerzel    TEXT NOT NULL UNIQUE,
  name       TEXT,
  sortierung INTEGER NOT NULL DEFAULT 100
);

INSERT INTO einheiten (kuerzel, name, sortierung) VALUES
  ('Stk',   'Stück',            10),
  ('Pausch','Pauschal',         20),
  ('h',     'Stunde',           30),
  ('Tag',   'Tag',              40),
  ('lfm',   'Laufmeter',        50),
  ('mm',    'Millimeter',       60),
  ('cm',    'Zentimeter',       70),
  ('m',     'Meter',            80),
  ('m²',    'Quadratmeter',     90),
  ('m³',    'Kubikmeter',      100),
  ('g',     'Gramm',           110),
  ('kg',    'Kilogramm',       120),
  ('t',     'Tonne',           130),
  ('l',     'Liter',           140),
  ('Set',   'Satz / Set',      150),
  ('Paar',  'Paar',            160),
  ('Rolle', 'Rolle',           170),
  ('Sack',  'Sack',            180);
