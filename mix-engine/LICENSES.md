# Lizenzen (Spike `mix-engine/`)

Stand: 11.11.2026. Regel: nur MIT o. ä. permissive Lizenzen; keine GPL/AGPL.

## Im Browser ausgeliefert

| Baustein | Version | Lizenz | Wofür |
|---|---|---|---|
| [onnxruntime-web](https://github.com/microsoft/onnxruntime) (Microsoft) | 1.31.1 | MIT | Inferenz von Beat This! (WebGPU, WASM) |
| ↳ onnxruntime-common | 1.31.1 | MIT | Abhängigkeit |
| ↳ protobufjs, @protobufjs/* | 7.6.6 | BSD-3-Clause | Abhängigkeit |
| ↳ flatbuffers | 25.9.23 | Apache-2.0 | Abhängigkeit |
| ↳ long | 5.3.2 | Apache-2.0 | Abhängigkeit |
| ↳ guid-typescript | 1.0.9 | ISC | Abhängigkeit |
| ↳ platform | 1.3.6 | MIT | Abhängigkeit |
| [signalsmith-stretch](https://signalsmith-audio.co.uk/code/stretch/) (Geraint Luff) | 1.3.2 | MIT | Time-Stretching (WASM); die im Paket eingebettete WASM-Fabrik wird zur Build-Zeit unverändert herausgeschnitten (`vite.config.ts`) |
| [wasm-media-encoders](https://github.com/arseneyr/wasm-media-encoders) (arseneyr) | 0.7.0 | MIT (JS-Teil) | Lädt und steuert den MP3-Encoder (`licenses/wasm-media-encoders-LICENSE`) |
| ↳ `mp3.wasm`: [LAME](https://lame.sourceforge.io/) 3.100 | 3.100 | **LGPL 2 oder später** | MP3-Kodierung 320 kbps; siehe nächster Abschnitt |

## MP3-Encoder: Lizenzprüfung (Stand 11.11.2026)

Kurz: **Einsetzbar, auch kommerziell**, wenn wir die LGPL-Pflichten einhalten. Das ist meine Einschätzung aus den Lizenztexten, keine Rechtsberatung; für den Launch gehört der Punkt zur ohnehin geplanten kurzen rechtlichen Prüfung (Umsetzungsplan O9).

- **Es gibt praktisch keinen MP3-Encoder ohne LAME.** Alle geprüften Browser-Pakete (`wasm-media-encoders`, `lame-wasm`, `@mediabunny/mp3-encoder`, `vmsg`, `lamejs`) enthalten LAME oder eine Portierung davon, und damit LGPL-Code. Das gilt auch dann, wenn ein Paket für sich nur „MIT“ oder „MPL-2.0“ angibt. Browser bieten keine eigene MP3-Kodierung (WebCodecs/MediaRecorder: Opus, AAC).
- **LGPL ist nicht GPL.** Unsere Regel „keine GPL/AGPL“ bleibt eingehalten. LAME selbst schreibt in seiner `LICENSE`: Kommerzielle Nutzung ist erlaubt, wenn man LAME als separate Bibliothek einbindet, LAME nennt und auf die Website verlinkt und eigene Änderungen an LAME unter LGPL zurückgibt (`licenses/lame/LICENSE`, Lizenztext in `licenses/lame/COPYING`).
- **Patente:** Die MP3-Patente sind ausgelaufen (2017); Lizenzgebühren fallen nicht an.

So erfüllen wir die Pflichten:

1. **Separate, austauschbare Bibliothek:** LAME liegt als eigene Datei `mp3.wasm` vor, die zur Laufzeit geladen wird (im Build als eigenes Asset). Unser Code ist nicht mit LAME verschmolzen; wer will, kann die Datei durch eine selbst gebaute ersetzen.
2. **Unverändert:** Wir verändern LAME nicht. Der Build von wasm-media-encoders nutzt LAME 3.100 mit einer einzigen Anpassung (Debug-Ausgabe `printf` abgeschaltet, 2 Zeilen), öffentlich als [arseneyr/lame@98db548](https://github.com/arseneyr/lame/commit/98db548e8e851defbba3184125ce10725355c332); Build-Skript im [wasm-media-encoders-Repository](https://github.com/arseneyr/wasm-media-encoders).
3. **Nennung und Quelltext:** Lizenztext und Hinweis liegen in `licenses/lame/`. Die Testseite nennt LAME mit Link und Quelltext-Verweis im Abschnitt „Lizenzen“. Im Produkt braucht es dasselbe auf einer Lizenzseite (später Aufgabe in Phase X).
4. **Keine Klauseln dagegen:** Nutzungsbedingungen dürfen Reverse Engineering von LAME nicht verbieten und das Ersetzen der Bibliothek nicht verhindern (LGPL 2, Abschnitt 6).

## Modelle (nicht im Repo, per `npm run models` geladen)

| Modell | Lizenz | Quelle |
|---|---|---|
| Beat This! `final0` (groß, ~20 M Parameter), ONNX | MIT (Code und Gewichte, © 2024 Institute of Computational Perception, JKU Linz) | ONNX-Export der unveränderten Gewichte von Johannes Gorset (MIT), GitHub-Release `jgorset/beat-this` v1.0.0, SHA-256 `5d8a94ce…81bd` |
| Beat This! `small0` (klein, ~2 M Parameter), ONNX | MIT (wie oben) | ONNX-Export auf Hugging Face `ashudesai/songbird-models` (MIT); Ausweichquelle `Andremi/audioweb-models` mit veröffentlichter SHA-256 `6d9e1b3e…9f09`. Prüfsumme wird in `public/models/models.json` festgehalten. Alternative: selbst exportieren mit `scripts/export_onnx.py` aus dem offiziellen Checkpoint |

Paper: Foscarin, Schlüter, Widmer (2024), „Beat this! Accurate beat tracking without DBN postprocessing“, ISMIR 2024.

## Eigener Code

Vorverarbeitung (Log-Mel wie upstream), Fensterung, „minimal“-Postprocessing, Raster, Phrasen, Intro/Outro, Lautheit (BS.1770), AIFF-Parser, Planung, Graph, Rendering und WAV-Schreiber sind eigene Implementierungen in TypeScript. Vorverarbeitung und Postprocessing folgen dem Verfahren von Beat This! (MIT).

## Nur Entwicklung (nicht ausgeliefert)

Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0), @types/node (MIT). Vite bringt `lightningcss` (MPL-2.0, dateibasiertes Copyleft) als Build-Werkzeug mit; es landet nicht im ausgelieferten Code und wird nicht verändert.

Das Export-Skript `scripts/export_onnx.py` nutzt bei Bedarf `beat-this` (MIT), PyTorch (BSD-3-Clause), `onnx` (Apache-2.0) und `onnxruntime` (MIT) lokal.

## Bewusst nicht verwendet

- madmom (DBN-Postprocessing): per Vorgabe ausgeschlossen (die madmom-Modelle stehen unter CC BY-NC-SA). Beat This! läuft hier mit dem eigenen „minimal“-Postprocessing ohne DBN.
- Essentia (AGPL), Rubber Band (GPL), SoundTouch-basierte Stretcher (LGPL).
