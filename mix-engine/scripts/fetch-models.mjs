#!/usr/bin/env node
// Lädt die Beat-This!-Modelle (ONNX, MIT) nach public/models/.
// Es werden nur Modelldateien heruntergeladen; Audio verlässt nie den Rechner.
//
//   npm run models            # beide Modelle
//   npm run models -- large   # nur das große
//   npm run models -- small   # nur das kleine
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
    // ONNX-Export der unveränderten final0-Gewichte (MIT), Johannes Gorset
    url: 'https://github.com/jgorset/beat-this/releases/download/v1.0.0/beat-this.onnx',
    sha256: '5d8a94ce99fb33a6b26df6f6d8076decd52b8fd9439e3206d9b8bcdb1c2881bd',
  },
  small: {
    file: 'beat-this-small0.onnx',
    checkpoint: 'small0 (ca. 2 M Parameter)',
    // ONNX-Export der small0-Gewichte (MIT), Hugging Face „ashudesai/songbird-models“.
    // Noch keine gepinnte Prüfsumme: beim ersten Laden wird sie ausgegeben und
    // in models.json festgehalten. Alternative: scripts/export_onnx.py (offizieller Checkpoint).
    url: 'https://huggingface.co/ashudesai/songbird-models/resolve/main/small0.onnx',
    sha256: null,
  },
};

const wanted = process.argv.slice(2).filter((a) => a in MODELS);
const keys = wanted.length ? wanted : Object.keys(MODELS);
mkdirSync(outDir, { recursive: true });

const manifestPath = join(outDir, 'models.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

for (const key of keys) {
  const m = MODELS[key];
  const target = join(outDir, m.file);
  if (existsSync(target)) {
    const hash = sha256(readFileSync(target));
    if (!m.sha256 || hash === m.sha256) {
      console.log(`✓ ${m.file} ist schon da (${hash.slice(0, 12)}…)`);
      manifest[key] = { file: m.file, checkpoint: m.checkpoint, sha256: hash, source: manifest[key]?.source ?? m.url };
      continue;
    }
    console.log(`! ${m.file} hat eine andere Prüfsumme, lade neu`);
  }
  console.log(`↓ ${key}: ${m.url}`);
  let res;
  try {
    res = await fetch(m.url, { redirect: 'follow' });
  } catch (err) {
    res = { ok: false, status: err?.cause?.code ?? String(err) };
  }
  if (!res.ok) {
    console.error(`✗ Download fehlgeschlagen (${res.status}). Alternative für "${key}": python scripts/export_onnx.py --checkpoint ${key === 'large' ? 'final0' : 'small0'}`);
    process.exitCode = 1;
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = sha256(buf);
  if (m.sha256 && hash !== m.sha256) {
    console.error(`✗ Prüfsumme stimmt nicht für ${m.file}: ${hash}`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(target, buf);
  manifest[key] = { file: m.file, checkpoint: m.checkpoint, sha256: hash, source: m.url };
  console.log(`✓ ${m.file} (${(buf.length / 1e6).toFixed(1)} MB, sha256 ${hash})`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
