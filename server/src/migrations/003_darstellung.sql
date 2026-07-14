-- Darstellung pro Benutzer: Farbschema (hell/dunkel) und frei wählbare
-- Führungsfarbe (Hex). Default: helles Schema mit Vurano-Orange.
ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'hell' CHECK (theme IN ('hell', 'dunkel'));
ALTER TABLE users ADD COLUMN akzentfarbe TEXT NOT NULL DEFAULT '#F97316';
