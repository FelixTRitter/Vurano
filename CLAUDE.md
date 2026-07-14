# Handwerker ERP — Konventionen für Mensch und KI

Diese Datei ist der Vertrag zwischen den drei Gründern und Claude (Code).
Jede Session beginnt mit diesen Regeln. Änderungen an dieser Datei nur per PR
mit Zustimmung aller drei.

## Architektur

- Monorepo mit npm-Workspaces: `server/` (Express 5 + PostgreSQL; Express 5 wegen nativer async-Fehlerbehandlung — Fehler aus async-Handlern landen in der zentralen Fehler-Middleware statt den Prozess zu crashen), `client/` (Vanilla-TS-SPA mit Vite).
- Multi-User, Session-Cookie-Auth, Rollen: `admin`, `buero`, `monteur`.
- App und PostgreSQL laufen auf demselben gehosteten Server. Ein NAS dient
  ausschließlich als Backup-Ziel — nie als Live-Datenquelle.
- Nichts Cloud-Anbieter-Spezifisches hartkodieren (spätere On-Premise-Deployments
  bei Pilotkunden müssen möglich bleiben).

## Modul-Muster (verbindlich)

Jeder Fachbereich (Vertrieb, Service, Montage, …) ist ein Modul unter
`server/src/modules/<name>/` mit genau drei Dateien:

- `validation.ts` — reine, testbare Funktionen ohne DB und ohne Express
- `repository.ts` — der gesamte SQL-Zugriff des Moduls
- `routes.ts` — HTTP-Schicht: Statuscodes, `requireRole(...)`, keine Geschäftslogik

Submodule in der Navigation: `.nav-group` mit `.nav-group-head` (auf-/zuklappbar)
und eingerückten `.nav-sub-link`-Einträgen — Muster siehe Mitarbeiterverwaltung
und Konfiguration in `index.html`.

Client-seitig folgt die SPA dem Immo-Control-Muster: Shell in `index.html`
(Topbar, Icon-Seitennavigation, Kontext-Leisten, Footer), Basisschicht 1:1
portiert unter `client/src/ic/` (helpers.js: API/fmt/el/Modal/fieldVals/Sorter;
router.js: Hash-Router + Shell). Jedes Modul registriert seine Seite per
`Router.register('<name>', renderFn)` und rendert in `#content`.
Referenz für Backend UND Frontend ist das Modul **kontakte** (Adressverwaltung).
Die `ic/*.js`-Dateien sind bewusst JavaScript (wörtliche Portierung aus
Immo Control) mit losen `.d.ts`-Deklarationen; neuer Code entsteht in TypeScript.

## Datenbank

- Schemaänderungen NUR über neue Dateien in `server/src/migrations/` —
  fortlaufend nummeriert, append-only. Nie eine gemergte Migration ändern.
- Migrationen, die gemeinsame Tabellen (users, kunden, …) betreffen,
  brauchen Review von allen drei Gründern. Modulinterne Tabellen: normales Review.
- Domänenbegriffe auf Deutsch (kontakte, auftraege, artikel), SQL-Schlüsselwörter englisch.

## Stammdaten: Funktionen & Qualifikationen

Die frühere Tabelle "rollen" (Mitarbeiter-Funktionsrolle) heißt ab Migration
015 "funktionen"; `mitarbeiter.rolle_id` -> `funktion_id`. Zusätzlich gibt es
"qualifikationen" (Skills) und die n:m-Tabelle "mitarbeiter_qualifikationen".

- Ein Mitarbeiter hat GENAU EINE Funktion (funktion_id), aber MEHRERE
  Qualifikationen (n:m). Verwaltung im Modul "Stammdaten" > Submodul
  "Qualifikation / Funktionen" (Modul-Key 'qualifikationen', /api/stammdaten/*).
- Endpunkte: /api/stammdaten/funktionen und /api/stammdaten/qualifikationen
  (crud mit In-Verwendung-Schutz + Audit). Die alte /api/konfiguration/rollen
  ist entfernt.
- Mitarbeiter-Routes liefern funktion_name und qualifikationen[] (JSON-Array)
  mit; POST/PUT nehmen qualifikation_ids entgegen (setQualifikationen). Im
  Client: Funktion = Dropdown, Qualifikationen = Chip-Mehrfachauswahl.

## Sprachen & Mehrsprachigkeit (Ist-Stand + Ausblick)

Die BEDIENsprache der Software ist deutsch und bleibt es vorerst. Getrennt
davon die BELEGsprachen (Angebote/Rechnungen):
- Stammdatentabelle `sprachen` (code = ISO 639-1, name, sortierung),
  vorbefüllt de/en/fr/it; Modul Stammdaten > Sprachen (anlegen/bearbeiten/
  löschen). Der `code` ist bewusst ISO, weil ihn die spätere KI-Übersetzung
  als Zielsprache braucht.
- Standard-Belegsprache des Unternehmens: Feld `firma_stammdaten.
  standard_sprache` (Default 'de'), einstellbar im Modul Unternehmen. Die als
  Standard gesetzte Sprache ist gegen Löschen geschützt.

Geplanter Übersetzungs-Workflow (NOCH NICHT gebaut, kommt mit dem
Verkaufsartikel-/Angebotsmodul): Der Verkaufsartikel hat einen Verkaufstext in
der Standardsprache. Weitere Sprachen werden AM ARTIKEL gepflegt (Übersetzungs-
speicher), per "Übersetzen"-Button KI-Erstentwurf, danach bearbeitbar und
speicherbar. Das Angebot referenziert diese gepflegten Übersetzungen (Single
Source of Truth); fehlt eine Sprache, wird sie zuerst am Stammartikel übernommen.
Prinzipien: einmal übersetzen + cachen (kein Live-Aufruf pro Angebot);
KI-Übersetzung als überschreibbarer Vorschlag (Fachbegriffe!).

## Artikel & Teiletypen (Verkaufsartikelstamm)

EINE gemeinsame Tabelle `artikel` für ALLE Teiletypen (Diskriminator
`teiletyp`), damit die spätere Stückliste (BOM) eine self-referencing
Kreuztabelle artikel<->artikel wird statt polymorpher Referenzen auf getrennte
Tabellen. Jeder Teiletyp bekommt ein eigenes Submodul, das dieselbe Tabelle
nach `teiletyp` gefiltert zeigt.

- Teiletypen sind HARDCODED: `server/src/modules/artikel/teiletypen.ts`
  (verkaufsartikel, kaufartikel, baugruppe, lagerteil, meterware, halbzeug) +
  CHECK-Constraint in Migration 018. Bei neuem Typ beide Stellen pflegen.
- Endpunkte `/api/artikel` (Liste mit ?teiletyp=…, Detail, CRUD, Audit).
- Verkaufsartikel-Attribute: artikelnummer (optional, unique wenn gesetzt),
  bezeichnung (Pflicht), verkaufstext, lv_text, einheit_id (→ einheiten),
  sprache_code (→ sprachen, Default = Firmen-Standardsprache).
- Modul: Vertrieb ist ein Container (nav-group), Submodul
  "Verkaufsartikelstamm" (Client `verkaufsartikel.ts`, Detail-Basis mit zweiter
  Navigation + Reitern Artikelinformationen | Kalkulation[Platzhalter]).
- Zwei Bedien-Ansichten auf DIESELBE Tabelle: Verkaufsartikelstamm (Modul
  Vertrieb, nur teiletyp=verkaufsartikel) und Teilestamm (eigenständiges Modul,
  alle übrigen Teiletypen; Teiletyp als Spalte + Auswahl beim Anlegen). Der
  Listen-Endpunkt /api/artikel akzeptiert ?teiletyp= als Komma-Liste mehrerer
  Typen (WHERE teiletyp = ANY).
- Zahlen (verkaufspreis NUMERIC(12,2); planungs-/produktions-/montagedauer in
  STUNDEN als NUMERIC): Eingaben werden tolerant geparst ("1234.50", "1234,50",
  "1'234.50"); leer = NULL, negativ wird abgelehnt (`zahl()` / `pruefeZahlen()`).
- MEHRSPRACHIGE TEXTE (Migration 020): Verkaufs-/LV-Text liegen NICHT mehr am
  Artikel, sondern in `artikel_texte` (artikel_id + sprache_code als PK, quelle
  'original'|'ki'|'manuell'). `artikel.sprache_code` = Originalsprache.
  Die gespeicherte Übersetzung IST der Cache — kein erneuter KI-Aufruf.
  - `PUT /api/artikel/:id` fasst Texte nur an, wenn sie mitgesendet werden
    (Teilupdate!); ändert sich die Originalsprache ohne Texte, wandert der
    Originaltext mit (nur wenn die Zielsprache frei ist).
  - `PUT /api/artikel/:id/text/:sprache` speichert eine Sprachfassung
    (quelle: 'original' in der Originalsprache, sonst 'manuell').
  - `POST /api/artikel/:id/uebersetzen` liefert nur einen ENTWURF und speichert
    NICHTS — der Anwender prüft, korrigiert und speichert selbst.
- Übersetzungs-Provider `server/src/modules/uebersetzung/provider.ts` (Anthropic
  Messages-API), abstrahiert wie der Adress-Provider. ENV: `ANTHROPIC_API_KEY`
  (ohne Schlüssel meldet der Endpunkt sauber 503), `UEBERSETZUNG_MODELL`
  (optional). Im Client: Artikeldetail > Reiter Artikelinformationen >
  Karte "Texte" (Sprachauswahl, Übersetzen, Speichern, zweispaltig).
- Artikeldetail-Reiter: Artikelinformationen | Kalkulation | Planung |
  Produktion | Montage (die letzten vier vorerst Platzhalter; dort entstehen
  später Verkaufspreis bzw. die drei Dauern).
- OFFEN: Stücklisten-Kreuztabelle (artikel besteht aus artikeln); Inhalte der
  Reiter Kalkulation/Planung/Produktion/Montage; weitere teiletyp-spezifische
  Felder (z. B. Lieferant/Einkaufspreis bei Kaufartikeln).

## Adress-Autovervollständigung (gemeinsam genutzt)

`bindAdressSuche(body)` liegt in der BASISSCHICHT (`client/src/ic/helpers.js`,
Typen in `helpers.d.ts`) — nicht in einem Fachmodul, weil sie von mehreren
genutzt wird (Adressverwaltung, Mitarbeiterverwaltung). Bei neuen Formularen
mit Adressfeldern einfach `bindAdressSuche(body)` nach dem Aufbau aufrufen.

- Erwartete Felder im Formular: `data-field="strasse"` (Pflicht, sonst tut die
  Funktion nichts), `plz`, `ort` und EINES von `land` (Ländername, z. B.
  Adressverwaltung) oder `land_code` (ISO-Code, z. B. Mitarbeiter). Nach dem
  Setzen des Landes wird ein change-Event ausgelöst, damit landabhängige
  Formularlogik reagiert. `adresszusatz` wird NIE überschrieben.
- Der Photon-Provider (`server/src/modules/adressen/provider.ts`) liefert
  sowohl `land` (deutscher Name) als auch `land_code` (ISO, Grossbuchstaben).
- Ausfall des Dienstes = keine Vorschläge, Feld bleibt manuell nutzbar.

## Änderungsprotokoll / Audit (verbindlich)

Jede fachliche Tabelle wird bei CREATE, UPDATE und DELETE protokolliert —
zentral über `src/audit/log.ts`. Das ist Pflicht für bestehende UND neue
Tabellen.

- In jedem schreibenden Endpunkt `auditLog({ tabelle, datensatzId, aktion,
  actor: req.user, vorher, nachher })` aufrufen. `vorher`/`nachher` über
  `ladeSnapshot(tabelle, id)` holen (vor dem UPDATE/DELETE bzw. nach dem
  INSERT/UPDATE). Bei `create` nur `nachher`, bei `delete` nur `vorher`.
- `auditLog` ist best effort: Ein Protokollfehler darf die Fachaktion NIE
  scheitern lassen (die Funktion wirft nicht).
- Sensible Felder (Passwort-Hash, TOTP-Secret …) werden von `ladeSnapshot`
  automatisch maskiert (`GEHEIME_FELDER` in log.ts erweitern, falls eine neue
  Tabelle weitere Geheimnisse führt).
- Persönliche Präferenzen (z. B. eigenes Theme in /einstellungen) werden NICHT
  protokolliert — das wäre Rauschen.
- Ein separates Betrachtungsprogramm (Tabelle wählen → Datensatz suchen →
  Verlauf ansehen) liest später NUR aus `audit_log`; es ist noch nicht gebaut
  und kommt in einem eigenen Prompt. Das Datenmodell (audit_log) steht bereits.

## Berechtigungen & Modul-Registry (verbindlich)

Zugriffsrollen liegen in `berechtigungsrollen` (getrennt von den
Mitarbeiter-Funktionsrollen in `rollen`!). Die Rolle **Administrator**
(ist_admin=TRUE) hat unveränderlichen Vollzugriff auf ALLE Module, auch
künftige — ihre Rechte kommen nicht aus `rollen_module`, sondern gelten per
Definition; sie ist nicht abwählbar und nicht löschbar.

- Die EINE Quelle der Wahrheit für Module ist `src/berechtigungen/module.ts`
  (MODULE-Liste). **Kommt ein neues Submodul in die Navigation, MUSS es dort
  ergänzt werden** — sonst fehlt es in der Rollen-Rechteverwaltung. Granularität
  aktuell pro Submodul; feinere Schlüssel (Aktionen, sensible Felder) können
  später als weitere Einträge ergänzt werden (Schlüssel ist ein String).
- Für neue NICHT-Admin-Rollen ist ein neues Modul standardmäßig AUS
  (deny by default); der Admin bekommt es automatisch (Vollzugriff).
- Wird ein neues Modul protokolliert, in `src/modules/cruddoku/routes.ts`
  die Modul->Tabellen-Zuordnung (MODUL_TABELLEN) ergänzen, damit sein
  Änderungsverlauf in der CRUD-Dokumentation auswählbar ist.
- Die Navigationssichtbarkeit richtet sich ab v2t nach den Modulrechten der
  Zugriffsrolle: `/api/auth/me` liefert die erlaubten Modul-Keys
  (`erlaubteModuleFuer`, src/berechtigungen/zugriff.ts); der Client blendet
  die Navigation danach ein und der Router-Guard leitet direkte URLs auf
  gesperrte Module um. Admin (ist_admin) erhält immer alle. 'einstellungen'
  ist immer erlaubt (persönlicher Bereich).
- OFFEN (nächster Schritt): der API-Endpunkt-Schutz basiert noch auf
  requireRole('admin','buero'); die Umstellung auf modulbasierte Prüfung
  (requireModul(key) via erlaubteModuleFuer) ist die eigentliche
  Sicherheitsgrenze gegen manipulierte API-Aufrufe.
- Admin-only-Submodule (aktuell Rollen, CRUD-Dokumentation) werden im Frontend
  für Nicht-Admins ausgeblendet; der echte Schutz ist serverseitig
  requireRole('admin').

## Layout-Konventionen (verbindlich)

- **Kartenabstand:** EINE Regel für die ganze Anwendung —
  `.card + .card { margin-top: var(--card-gap) }` in `client/src/style.css`,
  Grösse in `:root { --card-gap }`. **Nie per Inline-Stil nachbessern**
  (`style="margin-top:…"` an einer Karte ist ein Fehler). Raster, die Karten
  selbst anordnen (firma-split, firma-partner, stamm-grid), regeln den Abstand
  über `gap: var(--card-gap)` und schalten die globale Regel per
  `> .card + .card { margin-top: 0 }` ab — kommt ein neues Karten-Raster dazu,
  dort ebenso verfahren.
- **Lange Texte** (Verkaufs-/LV-Text im Artikeldetail): feste Höhe
  (`.txt-detail`, 440px) statt min-height, damit das Feld selbst scrollt und
  die Seite nicht streckt; Aufziehen bleibt über `resize: vertical` möglich.

## Tests (verbindlich)

- `npm test` im Root führt Server- (vitest) und Client-Tests (vitest + jsdom)
  aus. VOR JEDER AUSLIEFERUNG (ZIP oder Merge) müssen alle Tests grün sein —
  keine Ausnahme. Das ist dieselbe Disziplin wie die jsdom-Suite von Immo Control.
- Jedes neue Modul bringt eigene Tests mit: reine Logik (validation.ts) als
  Unit-Test im Server, Rendering/Verhalten als jsdom-Test unter client/test/.
- Fehlerbehebungen bekommen einen Regressionstest, der den Fehler vor der
  Korrektur nachweisen würde (Beispiel: test/router.test.ts, Gruppenkopf-Bug).

## Dateistruktur & Dokumentation (verbindlich)

Server: EIN Modul = EIN Ordner unter `server/src/modules/<name>/` mit
`routes.ts` (Pflicht: HTTP + SQL) und `validation.ts` (wenn Eingaben geprüft
werden — reine, testbare Funktionen ohne DB/Express).
Client: EIN Fachmodul = EINE Datei `client/src/<name>.ts` (bzw. .js bei
1:1-Portierungen); die geteilte Basisschicht liegt unter `client/src/ic/`.
Querschnittslogik (z. B. Navigationsgruppen) bekommt eine eigene kleine Datei
(`nav.ts`), damit sie testbar bleibt und keine Datei ins Gigantische wächst.

Jede Datei beginnt mit einem Kopfkommentar auf Deutsch: WAS macht die Datei,
WIE spielt sie mit dem Rest zusammen, WIE erweitert man sie. Ein Entwickler,
der die Datei zum ersten Mal öffnet, muss sich ohne fremde Hilfe zurechtfinden.

## Zusammenarbeit

- Ein GitHub-Issue = ein Arbeitspaket = ein Feature-Branch = ein PR. Branches
  leben Tage, nicht Wochen.
- Jeder Gründer besitzt Module end-to-end; Modulgrenzen sind Dateigrenzen.
  In fremden Modulen nur per PR mit Review des Besitzers arbeiten.
- CI (Build + Tests) muss grün sein, bevor gemergt wird.
- Kein direkter Push auf `main`.

## Berechtigungen (Erweiterungspfad)

Aktuell rollenbasiert per `requireRole()`. Wenn Pilotkunden feinere Rechte
brauchen: Tabellen `roles` + `permissions` einführen und `requireRole` durch
`requirePermission('kunden.schreiben')` ersetzen — die Middleware-Signatur
ist dafür vorbereitet.

## Plattformneutralität (verbindlich)

Entwickelt wird auf Windows, deployt auf Linux. Deshalb: keine
Unix-Shell-Befehle (rm, cp, mv, &&-Ketten mit Pfad-Tricks) in
npm-Skripten — Dateioperationen laufen über kleine Node-Skripte
unter `scripts/` (Beispiel: server/scripts/copy-migrations.mjs).
Pfade im Code immer mit `node:path` zusammensetzen, nie mit
fest verdrahteten Schrägstrichen.

## Stil

- TypeScript strict, ESM, keine neuen Abhängigkeiten ohne Absprache im Issue.
- Fehlertexte für Benutzer auf Deutsch, präzise, ohne Stacktraces.

## Versionierung

Auslieferungsversion in `client/src/version.ts` (Schema 1a…1z → 2a…2z, im
Footer sichtbar). Bei jeder ZIP-/Release-Auslieferung erhöhen.
