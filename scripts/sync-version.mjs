#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const check = process.argv.includes('--check');

const files = [
  'client/package.json',
  'client/package-lock.json',
  'server/package.json',
  'server/package-lock.json',
  'e2e/package.json',
  'e2e/package-lock.json',
];

let drift = 0;

for (const file of files) {
  const path = resolve(root, file);
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  // Les lockfiles portent la version à deux endroits. Les comparer tous les deux :
  // en mode --check, ne regarder que le premier laisserait passer une dérive
  // introduite par un `npm install` externe, que la CI est justement là pour voir.
  const nested = json.packages?.[''];
  const stale = json.version !== version || (nested && nested.version !== version);
  if (!stale) continue;

  drift++;
  if (check) {
    const found = nested && nested.version !== json.version
      ? `${json.version} / ${nested.version}`
      : json.version;
    console.error(`[drift]  ${file}  ${found} ≠ ${version}`);
    continue;
  }

  console.log(`[synced] ${file}  ${json.version} → ${version}`);
  json.version = version;
  if (nested) nested.version = version;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

if (!drift) console.log(`Tout est à ${version}`);
if (check && drift) process.exit(1);
