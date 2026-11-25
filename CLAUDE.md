# Selectorz – Arbeitsweise im Repo

Gilt für jede Code-Änderung, ohne dass der Product Owner (Baptiste) es neu sagen muss. Festgelegt am 19.11.2026.

## Workflow für jedes Feature und jede Code-Änderung

1. **Plan vor dem Code.** Kurz festhalten: was gebaut wird, welche PRD-Anforderungen gelten (IDs wie AUTH-01, CHAIN-04), und die **Abnahmekriterien**, woran wir erkennen, dass es fertig ist. Quelle zuerst PRD Abschnitt 22 (Akzeptanzszenarien). Der PO gibt den Plan frei, bevor gebaut wird. Ausnahme: reine Korrekturen und Tests für bereits Gebautes; dort steht der Plan im Pull Request.
2. **Tests zuerst festlegen**, passend zur Ebene:
   - Logik: Unit-Tests (Vitest).
   - Rechte, Zustände, Atomarität in der Datenbank: Datenbank-Tests gegen lokales Supabase (z. B. „C kann nach B-Beitritt nichts schreiben“, „zwei Tabs erzeugen genau einen Zug“).
   - Ganze Abläufe (Login, Kette, Veröffentlichen): Browser-Tests (Playwright) gegen lokales Supabase; Login-Mails werden über Mailpit abgefangen.
3. **Bauen**, bis alle Tests grün sind. **Jeder Screen wie sein Board** (Design-Leinwand „Selectorz Designrichtungen“, Ordner `project/`):
   - Vor dem Bauen alle Boards des Ablaufs heraussuchen (mobil und Desktop, alle Zustände), damit kein Screen fehlt.
   - Maße, Farben, Texte und Aufbau aus dem **Quelltext des Boards** übernehmen, nicht aus einem gerenderten Screenshot (Vorlagen-Werte rendern dort teils nicht).
   - Vor dem PR jeden gebauten Screen neben sein Board legen, in drei Breiten: Handy (390 px), 1440 px, großes Display (2560 px). Inhalt bleibt in einem Container (meist höchstens 1440 px). Die Bilder kommen in den PR, Abweichungen stehen dort ausdrücklich.
   - Ändert sich beim Coden ein sichtbarer Text oder ein Element, wird das Board mit angepasst; gebaute Screens stehen als „Built“-Boards daneben.
4. **Freigabe:** Pull Request mit Plan, Abnahmekriterien und Testergebnis. GitHub-CI muss grün sein; Vercel-Vorschau zum Anschauen. Erst nach Freigabe durch den PO wird nach `main` gemergt. Nie direkt auf `main` pushen.

Ehrlich berichten: Was nicht getestet werden konnte, steht ausdrücklich im Pull Request.

## Aufbau

- `web/` – Next.js 16 (App Router, Cache Components), Tailwind 4, Supabase (`@supabase/ssr`). Vor Code an Next-APIs `web/AGENTS.md` beachten (Doku liegt in `node_modules/next/dist/docs/`).
- `mix-engine/` – Automix im Browser (Beat This!, Signalsmith Stretch, LAME als eigene `mp3.wasm`). Lizenzen in `mix-engine/LICENSES.md`.
- `supabase/` – lokale Supabase-Konfiguration, Migrationen und Mail-Templates.
- `.github/workflows/` – CI: Lint, Typen, Tests, Build, Browser-Tests.

## Regeln

- Nur permissive Lizenzen (keine GPL/AGPL). Neue Abhängigkeit = Lizenz prüfen und in die Lizenzliste.
- Keine Audiodateien, Modelle oder Geheimnisse ins Repo. Secret Keys nie in Code, Chat oder Logs.
- Supabase in der EU (Frankfurt); jede Tabelle mit Row Level Security.
- Produkttexte auf Englisch, Doku und Commits auf Deutsch.
- Design-Tokens nur aus `web/src/app/globals.css` (Quelle: Projekt-Doc „Design-System v0.1“).
