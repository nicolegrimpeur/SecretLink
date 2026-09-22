#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const check = process.argv.includes('--check');
// Utilisé par le hook npm `version` : ajoute à l'index les fichiers de cette
// liste, pour qu'elle reste la seule à maintenir.
const stage = process.argv.includes('--stage');

// Les lockfiles portent la version à deux endroits (`version` et
// `packages[''].version`). Les comparer tous les deux : en mode --check, ne
// regarder que le premier laisserait passer une dérive introduite par un
// `npm install` externe, que la CI est justement là pour voir.
const npm = (file) => ({
  file,
  read: (json) => [json.version, json.packages?.['']?.version].filter((v) => v !== undefined),
  write: (json) => {
    json.version = version;
    if (json.packages?.['']) json.packages[''].version = version;
  },
});

const files = [
  npm('client/package.json'),
  npm('client/package-lock.json'),
  npm('server/package.json'),
  npm('server/package-lock.json'),
  npm('e2e/package.json'),
  npm('e2e/package-lock.json'),
  {
    // Champ `info.version` du format Postman v2.1 : la collection décrit l'API
    // de cette version-là, elle bouge donc avec le reste.
    file: 'api/SecretLink API.json',
    read: (json) => [json.info.version],
    write: (json) => {
      // Placé juste après `name` pour rester lisible en tête de fichier. L'ancien
      // `version` est extrait de `rest`, sinon l'étalement l'écraserait.
      const { name, version: _previous, ...rest } = json.info;
      json.info = { name, version, ...rest };
    },
  },
];

let drift = 0;

for (const { file, read, write } of files) {
  const path = resolve(root, file);
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  const found = read(json);
  if (found.every((v) => v === version)) continue;

  drift++;
  if (check) {
    console.error(`[drift]  ${file}  ${[...new Set(found)].join(' / ') || '(absente)'} ≠ ${version}`);
    continue;
  }

  console.log(`[synced] ${file}  ${found[0] ?? '(absente)'} → ${version}`);
  write(json);
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

if (!drift) console.log(`Tout est à ${version}`);
if (check && drift) process.exit(1);

if (stage) execFileSync('git', ['add', '--', ...files.map((f) => f.file)], { cwd: root, stdio: 'inherit' });
