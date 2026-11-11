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

## Modelle (nicht im Repo, per `npm run models` geladen)

| Modell | Lizenz | Quelle |
|---|---|---|
| Beat This! `final0` (groß, ~20 M Parameter), ONNX | MIT (Code und Gewichte, © 2024 Institute of Computational Perception, JKU Linz) | ONNX-Export der unveränderten Gewichte von Johannes Gorset (MIT), GitHub-Release `jgorset/beat-this` v1.0.0, SHA-256 `5d8a94ce…81bd` |
| Beat This! `small0` (klein, ~2 M Parameter), ONNX | MIT (wie oben) | ONNX-Export auf Hugging Face `ashudesai/songbird-models` (MIT). Prüfsumme wird beim ersten Laden in `public/models/models.json` festgehalten. Alternative: selbst exportieren mit `scripts/export_onnx.py` aus dem offiziellen Checkpoint |

Paper: Foscarin, Schlüter, Widmer (2024), „Beat this! Accurate beat tracking without DBN postprocessing“, ISMIR 2024.

## Eigener Code

Vorverarbeitung (Log-Mel wie upstream), Fensterung, „minimal“-Postprocessing, Raster, Phrasen, Intro/Outro, Lautheit (BS.1770), AIFF-Parser, Planung, Graph, Rendering und WAV-Schreiber sind eigene Implementierungen in TypeScript. Vorverarbeitung und Postprocessing folgen dem Verfahren von Beat This! (MIT).

## Nur Entwicklung (nicht ausgeliefert)

Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0), @types/node (MIT). Vite bringt `lightningcss` (MPL-2.0, dateibasiertes Copyleft) als Build-Werkzeug mit; es landet nicht im ausgelieferten Code und wird nicht verändert.

Das Export-Skript `scripts/export_onnx.py` nutzt bei Bedarf `beat-this` (MIT), PyTorch (BSD-3-Clause), `onnx` (Apache-2.0) und `onnxruntime` (MIT) lokal.

## Bewusst nicht verwendet

- madmom (DBN-Postprocessing): per Vorgabe ausgeschlossen (die madmom-Modelle stehen unter CC BY-NC-SA). Beat This! läuft hier mit dem eigenen „minimal“-Postprocessing ohne DBN.
- Essentia (AGPL), Rubber Band (GPL), SoundTouch-basierte Stretcher (LGPL).
- MP3-Encoder (LAME, LGPL): im Spike nicht enthalten; Export nur WAV. Einbindung für MP3 320 kbps ist vor Phase X lizenzrechtlich zu prüfen (Umsetzungsplan 3.2, O4).
