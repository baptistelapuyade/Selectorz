# Selectorz Automix – Spike (`mix-engine/`)

Go/No-go-Prototyp für den Automix (Umsetzungsplan v0.3, Phase S). Eine schlichte lokale Testseite ohne Design:
Dateien ablegen → Analyse (Beat This!) → Auto-Mix nach 3.3 → Übergänge nachjustieren → Vorschau im Browser und Export (MP3 320 kbps oder WAV) aus demselben Graphen.

**Alles läuft lokal.** Audio wird nie hochgeladen. Aus dem Netz kommen nur einmalig die Modelldateien (`npm run models`).

---

## Starten

Voraussetzungen: Node.js 20.19 oder neuer, ein aktueller Chrome (WebGPU) am Laptop. Safari und Firefox laufen auch, dann meist ohne WebGPU.

```bash
cd mix-engine
npm install
npm run models      # lädt beide Beat-This!-Modelle nach public/models/ (ca. 95 MB, einmalig)
npm run dev         # startet http://localhost:5173
```

Dann <http://localhost:5173> in Chrome öffnen.

- `npm test` startet die Unit-Tests (Planung, Bearbeiten, Zeitleiste, Raster, Postprocessing, Stretching, AIFF, WAV).
- `npm run typecheck` prüft die Typen.

Zum kleinen Modell: Es ist dasselbe Beat This! in klein (`small0`, ca. 2 M statt 20 M Parameter): schneller, laut den Autoren etwas ungenauer. Fertige ONNX-Dateien gibt es nur als Kopien auf Hugging Face; `npm run models` probiert zwei Quellen (die zweite mit veröffentlichter Prüfsumme) und schreibt die Prüfsumme in `public/models/models.json`. Eine vorhandene Datei wird nie überschrieben; neu laden mit `npm run models -- --force`.

**Falls `npm run models` das kleine Modell nicht laden kann**, lässt es sich aus dem offiziellen Checkpoint selbst erzeugen:

```bash
python -m venv .venv && . .venv/bin/activate
pip install "beat-this==1.1.0" torch onnx onnxruntime
python scripts/export_onnx.py --checkpoint small0     # optional auch final0
```

### Testtracks

Lege deine Tracks in `mix-engine/test-audio/`. Der Ordner steht in `.gitignore`; nur die leere `.gitkeep` ist versioniert, die Dateien kommen nie ins Repo. Auf der Testseite ziehst du sie einfach per Drag & Drop hinein (oder wählst sie über den Dateidialog). Formate: MP3, WAV, AIFF, FLAC, M4A.

Tipp: Nummeriere die Dateien (`01_…`, `02_…`). Beim Ablegen wird nach Dateinamen sortiert, das ist die Reihenfolge im Mix. Mit ↑ ↓ lässt sie sich ändern.

## Bedienung

1. **Dateien** ablegen.
2. **Einstellungen**: zuerst Modell „klein“, Ausführung „auto“. Für den Modellvergleich das Häkchen „zusätzlich mit dem anderen Modell vergleichen“ setzen (verdoppelt die Analysezeit).
3. **„Analysieren und mixen“**: Analyse, Planung und Strecken laufen nacheinander. Danach sind Vorschau, Export und Tests bereit. Analysen landen im lokalen Cache des Browsers (IndexedDB, nur Zahlen, kein Audio): Ein zweiter Lauf mit denselben Dateien und demselben Modell startet in Sekunden. „Cache leeren“ erzwingt eine neue Analyse.
4. **Vorschau**: „▶ Von vorn“ oder in der Übergangsliste „▶ anhören“ (startet 8 s vor dem Übergang).
5. **Übergänge nachjustieren** (Vorstufe von Screen 3 „Shape“), direkt in der Übergangsliste:
   - **Verschieben**: Out bzw. In um −8/−1/+1/+8 Takte. Out und In bewegen sich getrennt; gemeinsam bleiben beide Tracks taktgenau übereinander.
   - **Länge**: 8, 16, 32, 64 Takte (Bass swap in der Mitte).
   - **Stil**: Blend (lange Blende), Quick (je ein Takt Ein- und Ausblenden um den Wechsel), Cut (harter Schnitt auf der Eins).
   - **Bass swap** an/aus.
   - **„Set the one here“** in der Track-Tabelle: Eins um −1/+1 Beat verschieben, wenn ein Track um einen Beat versetzt einsteigt.
   - Ungültige Änderungen (über das Trackende, Überlappung) werden abgelehnt, mit Grund in der Statuszeile. Geänderte Übergänge tragen ein ✎. Neu gestreckt wird nur, wenn ein Übergang mehr als 32 Takte aus dem gestreckten Bereich wandert.
   - Läuft die Vorschau, spielt sie nach der Änderung an derselben Stelle weiter.
6. **Export**: Format wählen (MP3 320 kbps CBR als Standard, WAV 16 Bit verlustfrei), „Exportieren“, danach erscheint der Download-Link. Die MP3 wird im Worker kodiert, während die nächsten Abschnitte gerendert werden.
7. **Rezept**: „Rezept (JSON) anzeigen“ bzw. „Rezept kopieren“.
8. **Gleichheitstests**: prüfen, dass Vorschau und Export dasselbe ausgeben (Plan 3.4).
9. **Messwerte**: „Messwerte kopieren“ legt alle Zahlen als JSON in die Zwischenablage (ohne Audio, nur Titel und Zahlen). Das bitte nach dem Hörtest mitschicken.

Der Cache speichert die Rohdaten der Analyse (Beats, Bandenergie je Frame). Raster, Eins, Phrasen und Intro/Outro werden beim Laden neu abgeleitet; Verbesserungen an diesen Schritten greifen also ohne neue Inferenz.

Master-Tempo und Übergangslänge lassen sich nach der Analyse ändern („Neu planen“). Neu gestreckt wird nur, wenn sich das Master-Tempo ändert oder ein Übergang aus dem gestreckten Bereich herausfällt.

## Was die Seite misst

| Messwert | Bedeutung |
|---|---|
| Dekodieren / Merkmale / Inferenz / Analyse gesamt | Zeit pro Track. „Modell laden“ fällt nur beim ersten Track an. |
| Analyse gesamt, Strecken gesamt, Ablegen bis hörbar | Wanduhr für alle Tracks. |
| BPM (Raster) / BPM (Median) | Raster: Regression über alle Beats (genau, das zählt). Median: wie in 3.3 beschrieben, nur zum Vergleich (auf 20-ms-Frames gerundet). |
| Raster-Abw., passende Beats | Wie gut die Beats auf ein konstantes Raster passen. Unter ca. 10 ms und über 90 % ist gut; sonst Hinweis „Tempowechsel?“. |
| Feinjustierung | Um wie viele ms das Raster an den Kick-Einsätzen nachgezogen wurde (max. ±25 ms). |
| Eins aus | „Modell“ = Downbeats von Beat This!; „Phrasen“ = korrigiert, weil die großen Energiewechsel ab dem ersten Beat auf 8-Takt-Grenzen liegen (Beat This! verwechselt bei manchen Tracks die Takthälften). |
| erster Schlag | Anteil der erkannten Downbeats, die zur gewählten „Eins“ passen. |
| Intro bis / Outro ab | Phrasengrenzen; in Klammern, woraus sie abgeleitet sind (`energy`, `bass` oder `default`). Als Intro zählt nur ein ruhigerer Anfang in den ersten 64 Takten; startet ein Track gleich voll, ist das Intro 0 und der Einstieg liegt am Anfang. Als Outro zählt nur eine ruhigere Strecke bis zum Ende; sonst liegt der Ausstieg in den letzten 32 Takten. |
| Übergänge | Track raus/rein, Out-Takt, In-Takt, Länge in Takten und Sekunden, Bass swap, Position im Mix. |
| Export | Format, Renderzeit und Gesamtzeit inkl. Kodieren, Echtzeitfaktor, Zahl der Abschnitte (30 s + 2 s Vorlauf), Spitzenpegel, übersteuerte Samples, Dateigröße. |
| Speicher | Eigene Rechnung der gestreckten Puffer, dazu die Browser-Messung (`measureUserAgentSpecificMemory`, nur Chrome, kann bis zu 20 s dauern). |
| Gleichheit | Abweichung Abschnitte vs. am Stück und Live-Mitschnitt vs. Export. |

## Aufbau

Engine-Code ist UI-unabhängig und liegt unter `src/engine/` (Modulgrenzen wie Plan 3.1). Die Testseite `src/app/main.ts` nutzt nur `src/engine/index.ts`.

| Modul | Datei(en) | Inhalt |
|---|---|---|
| decode | `decode/decode.ts`, `decode/aiff.ts` | `decodeAudioData` mit Resampling über `OfflineAudioContext`; eigener AIFF/AIFF-C-Parser (Chrome/Firefox können kein AIFF) |
| analyze | `analyze/*.ts`, Worker `analyze.worker.ts` | Log-Mel wie Beat This! (22 050 Hz, 50 fps, 128 Bänder), ONNX Runtime Web mit WebGPU und WASM-Fallback, Fenster 1500 Frames mit 6 Frames Rand, „minimal“-Postprocessing ohne DBN, robustes Beat-Raster, 8-Takt-Phrasen, Energie pro Takt in drei Bändern, Intro/Outro, Lautheit (BS.1770) |
| plan | `plan/plan.ts`, `plan/timeline.ts` | Reine Funktionen: `plan()` (Analyse → Rezept) und `resolveTimeline()` (Rezept → Zeiten und Automationen). Unit-Tests in `plan/plan.test.ts` |
| stretch | `stretch/*.ts`, Worker `stretch.worker.ts` | Signalsmith Stretch offline im Worker-Pool, latenzkompensiert, Tonhöhe bleibt |
| graph | `graph/mixGraph.ts`, `graph/live.ts` | Ein Graph für AudioContext und OfflineAudioContext: Quelle → Trim → Low-Shelf (Bass swap) → Fader → Summe → Limiter |
| render | `render/render.ts` | Export in Abschnitten mit Vorlauf, Gleichheitstests |
| plan (Bearbeiten) | `plan/edit.ts` | Reine Funktionen `editTransition()` und `shiftGrid()` mit Prüfung (`validateRecipe()`); Unit-Tests in `plan/edit.test.ts` |
| encode | `encode/wav.ts`, `encode/mp3.ts`, Worker `mp3.worker.ts` | WAV 16 Bit; MP3 320 kbps CBR mit LAME 3.100 (WASM) im Worker, abschnittsweise |
| Cache | `cache.ts` | Analyse-Cache in IndexedDB (Schlüssel: Dateiname, Größe, Änderungsdatum, Modell, Engine-Version) |

Das **Rezept** (`MixRecipe`) enthält nur Entscheidungen: Master-Tempo, Gain pro Track, Raster-Korrektur, pro Übergang Out-Takt, In-Takt, Länge, Bass-swap-Takt und Stil. Alle Zeiten leitet `resolveTimeline()` daraus ab. So muss der Editor später nur das Rezept ändern, und der Server speichert nur das Rezept (G2).

### Entscheidungen und Abweichungen im Spike

- **Dekodieren im Haupt-Thread.** `decodeAudioData` gibt es nur dort (kein AudioContext im Worker); der Browser dekodiert intern trotzdem außerhalb des UI-Threads. Analyse und Stretching laufen in Workern.
- **Zweimal dekodieren statt Original halten** (3.5): erst 22 050 Hz mono für die Analyse, dann nach der Planung 44,1 kHz Stereo für das Stretching. Gehalten wird nur der gestreckte Bereich plus 32 Takte Rand pro Seite. Das Original wird sofort verworfen.
- **Beat-Raster per Regression.** Der BPM-Median aus 20-ms-Frames ist zu grob (122 BPM erscheint als 120). Über 32 Takte würde schon 0,1 % Fehler rund 60 ms Versatz bedeuten. Deshalb robuste Suche über Periode und Phase, danach Regression. Konstantes Tempo pro Track (G5).
- **Bass swap** über ein Low-Shelf (180 Hz, −40 dB) mit Rampe von einem halben Beat auf der Eins in der Mitte des Übergangs. Der kommende Track blendet bis zum Swap ein, der gehende danach aus (Equal-Power-Kurven).
- **Limiter** = `DynamicsCompressorNode` (Schwelle −2 dB, Ratio 20) nach −2 dB Summenabsenkung. Er verzögert den Mix um ca. 6 ms. Für das Produkt ist ein eigener Limiter als AudioWorklet sinnvoll (browserübergreifend gleich).
- **Lautheit** wird auf Mono bei 22 050 Hz gemessen; für die relative Angleichung reicht das. Ziel ist der Median der Tracks (begrenzt auf −14 bis −8 LUFS), Anhebung max. +6 dB.
- **Master-Tempo** (O3): Standard Median, umschaltbar auf Track 1 oder „kleinste maximale Streckung“. Ab 6 % Streckung gibt es einen Hinweis plus Tempo-Vorschlag.
- **MP3** mit LAME 3.100 (LGPL) als eigene, unveränderte, austauschbare WASM-Datei. Lizenzprüfung und Pflichten in `LICENSES.md`.

## Vorab-Prüfung (synthetische Tracks, ohne Hörtest)

Vor der Übergabe lief der Spike in der Entwicklungsumgebung (headless Chrome, 2 CPU-Kerne, keine GPU, also WASM; großes Modell) mit acht synthetischen House-Tracks (122–127 BPM, alle fünf Formate, dazu Break am Anfang und Tempowechsel). Die Zahlen sind nur ein Rahmen; auf einem Laptop mit WebGPU und dem kleinen Modell sollte die Analyse deutlich schneller sein. Genau das soll der Spike auf deinem Rechner messen.

| Prüfung | Ergebnis |
|---|---|
| Formate MP3, WAV, AIFF (eigener Parser), FLAC, M4A | alle dekodiert |
| BPM gegen die Wahrheit | auf ±0,003 BPM genau |
| Rasterfehler nach Feinjustierung | ≤ 2,2 ms (ohne Feinjustierung bis 13 ms) |
| Versatz der Beats beider Tracks im Übergang | ca. 2 ms |
| Phrasen, Intro/Outro | Intro-Ende Takt 16, Outro ab Takt 80, wie erzeugt |
| Tempowechsel-Track | Hinweis „Beat-Raster unsicher“ erscheint |
| Abschnitte vs. am Stück, Live vs. Export | bitgenau gleich (Abweichung −∞ dB) |
| Analyse (WASM, großes Modell, 2 Kerne) | ca. 56 s pro 3-Minuten-Track |
| Strecken | ca. 4,5 s pro 3-Minuten-Track (ein Worker) |
| Export WAV | ca. 130–160× Echtzeit |
| Export MP3 320 kbps | ca. 50× Echtzeit (Kodieren im Worker), Datei 320 kbps CBR, 44,1 kHz Stereo |
| MP3 gegen WAV | gleich bis auf die übliche Encoder-Verzögerung von 1105 Samples (25 ms) am Anfang; für die Tracklist bedeutungslos |
| Übergänge bearbeiten | Verschieben, Länge, Stil, Bass swap und „Set the one here“ greifen ohne neues Stretching; Gleichheitstests danach weiter bitgenau; ungültige Änderungen werden mit Grund abgelehnt |
| Analyse-Cache | zweiter Lauf mit denselben 2 Tracks: 9 s statt 2 min |
| Lange Tracks (6 × ca. 6,7 min, 35-min-Mix) | Analyse ca. 115 s pro Track (WASM, großes Modell, 2 Kerne); Strecken ca. 10 s pro Track; MP3-Export 44 s; Versatz im Übergang ≤ 2 ms; automatisch 32-Takt-Übergänge |
| Speicher lange Tracks | gestreckte Puffer 814 MB (≈ 136 MB pro Track, weil Ein- und Ausstieg fast den ganzen Track umfassen); alle Chrome-Prozesse zusammen ca. 2,3–2,5 GB (RSS, inkl. Browser und GPU-Prozess) |

Nach Analyse und Strecken werden die Worker beendet, damit der WASM-Speicher von ONNX Runtime und Signalsmith frei wird; bei Bedarf starten sie neu. Größter weiterer Hebel für Phase E: gestreckte Puffer als 16-Bit-Ganzzahlen halten und Abschnitte erst beim Abspielen/Rendern in AudioBuffer umwandeln (halbiert die 814 MB).
| Speicher | ca. 64 MB gestreckter Puffer pro 3-Minuten-Track; Browser gesamt ca. 0,8–0,9 GB bei 2–3 Tracks |

Die Feinjustierung („Feinjustierung“ in der Analyse-Tabelle) richtet das Raster nach Beat This! an den Kick-Einsätzen aus. Ohne sie lag der Versatz im Übergang bei rund 7,5 ms, weil das Modell je nach Material einige Millisekunden früher oder später markiert.

## Hörtest: worauf achten

Pro Übergang (in der Übergangsliste „▶ anhören“, dann im Export gegenhören):

1. **Taktgenau?** Laufen die Kicks beider Tracks über den ganzen Übergang deckungsgleich, ohne Flammen oder Galoppieren? Driftet es gegen Ende auseinander?
2. **Richtige Eins?** Setzt der kommende Track auf der Eins einer Phrase ein, oder um einen oder zwei Beats versetzt?
3. **Phrase passt?** Fällt der Übergang an eine musikalische Grenze (Ende von 8/16/32 Takten), oder mitten in eine Phrase, einen Break oder einen Vocal?
4. **Bass swap:** Ist der Wechsel sauber, ohne Moment mit doppeltem Bass (Wummern) oder ohne Bass (Loch)?
5. **Länge:** Wirken 16 bzw. 32 Takte passend, zu lang oder zu kurz?
6. **Lautheit:** Springt die Lautstärke beim Wechsel? Pumpt der Limiter hörbar, vor allem in der ersten Hälfte, wenn beide Tracks laufen?
7. **Klang nach dem Stretching:** Hörst du Artefakte (Phasing, verwaschene Hi-Hats, „metallische“ Stimmen)? Steht in der Track-Tabelle eine große Tempoänderung, besonders genau hinhören.
8. **Klicks:** Knackser am Anfang und Ende von Tracks oder Übergängen?
9. **Vorschau = Export:** Klingt der Export genauso wie die Vorschau? (Die Gleichheitstests bestätigen das für das unkomprimierte Signal.) Bei der MP3 zusätzlich: Hörst du Kompressionsartefakte gegenüber der WAV?
10. **Die zwei schwierigen Fälle:** Break am Anfang (wird das Intro/die Eins richtig erkannt?) und Tempowechsel (erscheint der Hinweis „Beat-Raster unsicher“, und wie klingt es trotzdem?).
11. **Nachjustieren:** Lässt sich ein schlechter Übergang mit Verschieben, Länge, Stil oder „Set the one here“ retten? Was hast du geändert?

Bitte pro Übergang kurz notieren: Nummer, Urteil (gut / geht so / schlecht) und was auffällt. Dazu die kopierten Messwerte (JSON, enthält auch das Rezept mit deinen Änderungen) und welches Modell lief.

## Bekannte Grenzen (bewusst außerhalb des Spikes)

- Kein grafischer Editor (Griffe auf der Timeline); die Bearbeitung läuft über Knöpfe in der Übergangsliste, aber über dieselben Engine-Funktionen.
- Konstantes Tempo pro Track; Tracks mit Tempowechsel werden nur gemeldet.
- Kein OPFS: die gestreckten Puffer liegen im Arbeitsspeicher.
- Die Reihenfolge der Tracks wird nicht automatisch optimiert (Reihenfolge = Ablage-Reihenfolge).
