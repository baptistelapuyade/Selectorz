#!/usr/bin/env node
// Lädt die Beat-This!-Modelle (ONNX, MIT) nach public/models/.
// Es werden nur Modelldateien heruntergeladen; Audio verlässt nie den Rechner.
//
//   npm run models            # beide Modelle
//   npm run models -- large   # nur das große
//   npm run models -- small   # nur das kleine
//   npm run models -- --force # neu herunterladen
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'models');

const MODELS = {
  large: {
    file: 'beat-this-final0.onnx',
    checkpoint: 'final0 (ca. 20 M Parameter)',
    sources: [
      // ONNX-Export der unveränderten final0-Gewichte (MIT), Johannes Gorset
      { url: 'https://github.com/jgorset/beat-this/releases/download/v1.0.0/beat-this.onnx', sha256: '5d8a94ce99fb33a6b26df6f6d8076decd52b8fd9439e3206d9b8bcdb1c2881bd' },
    ],
  },
  small: {
    file: 'beat-this-small0.onnx',
    checkpoint: 'small0 (ca. 2 M Parameter)',
    sources: [
      // ONNX-Export der small0-Gewichte (MIT), Hugging Face „ashudesai/songbird-models“,
      // Eingang [batch, frames, 128]. Prüfsumme wird beim ersten Laden festgehalten.
      { url: 'https://huggingface.co/ashudesai/songbird-models/resolve/main/small0.onnx', sha256: null },
      // Ausweichquelle mit veröffentlichter Prüfsumme (Hugging Face „Andremi/audioweb-models“)
      { url: 'https://huggingface.co/Andremi/audioweb-models/resolve/main/analysis/beat_this_small.onnx', sha256: '6d9e1b3ebdb953b0bacf6755e6fa421e04e74709cdbe4abcc6f0e4b432c89f09' },
    ],
    maxBytes: 40e6,
  },
};

const force = process.argv.includes('--force');
const wanted = process.argv.slice(2).filter((a) => a in MODELS);
const keys = wanted.length ? wanted : Object.keys(MODELS);
mkdirSync(outDir, { recursive: true });

const manifestPath = join(outDir, 'models.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

for (const key of keys) {
  const m = MODELS[key];
  const target = join(outDir, m.file);
  if (existsSync(target) && !force) {
    // vorhandene Datei behalten (auch selbst exportierte); --force lädt neu
    const hash = sha256(readFileSync(target));
    const src = m.sources.find((x) => x.sha256 === hash);
    console.log(`✓ ${m.file} ist schon da (sha256 ${hash.slice(0, 12)}…${src ? ', bekannte Quelle' : ''})`);
    manifest[key] = { file: m.file, checkpoint: m.checkpoint, sha256: hash, source: src?.url ?? manifest[key]?.source ?? 'lokal' };
    continue;
  }
  let saved = false;
  for (const src of m.sources) {
    console.log(`↓ ${key}: ${src.url}`);
    let res;
    try {
      res = await fetch(src.url, { redirect: 'follow' });
    } catch (err) {
      res = { ok: false, status: err?.cause?.code ?? String(err) };
    }
    if (!res.ok) {
      console.error(`  ✗ Download fehlgeschlagen (${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const hash = sha256(buf);
    if (src.sha256 && hash !== src.sha256) {
      console.error(`  ✗ Prüfsumme stimmt nicht: ${hash}`);
      continue;
    }
    if (m.maxBytes && buf.length > m.maxBytes) {
      console.error(`  ✗ Datei ist mit ${(buf.length / 1e6).toFixed(0)} MB zu groß für das kleine Modell`);
      continue;
    }
    writeFileSync(target, buf);
    manifest[key] = { file: m.file, checkpoint: m.checkpoint, sha256: hash, source: src.url };
    console.log(`✓ ${m.file} (${(buf.length / 1e6).toFixed(1)} MB, sha256 ${hash})`);
    saved = true;
    break;
  }
  if (!saved) {
    console.error(`✗ „${key}“ konnte nicht geladen werden. Alternative: python scripts/export_onnx.py --checkpoint ${key === 'large' ? 'final0' : 'small0'}`);
    process.exitCode = 1;
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
