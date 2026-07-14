-- Adresszusatz (z. B. "c/o ...", Gebäude, Etage) — eigene Zeile in der
-- Anschrift, für Personen und Firmen. Der Firmenname (firmenname) darf
-- künftig einen Zeilenumbruch enthalten (zweizeilige Firmierung); das
-- braucht keine Migration, da TEXT bereits Umbrüche speichert.
ALTER TABLE kontakte ADD COLUMN adresszusatz TEXT;
